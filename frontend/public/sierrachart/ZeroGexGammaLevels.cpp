// ============================================================================
//  ZeroGEX Gamma Levels — Sierra Chart (ACSIL) study, auto-updating
//
//  Draws today's ZeroGEX dealer-positioning levels on any chart and keeps
//  them current by polling the ZeroGEX API:
//    • Gamma Flip   (regime line)
//    • Call Wall    (upside cap)
//    • Put Wall     (downside floor)
//    • Max Pain     (expiration magnet)
//    • Pin Strike   (0DTE pin magnet)
//
//  Like the NinjaTrader 8 indicator and unlike the free TradingView /
//  thinkorswim scripts, this one pulls the numbers for you. It requires a
//  ZeroGEX API key, which ships with the Pro plan — the code is free, the
//  data is gated by the key. Generate the key yourself at
//  zerogex.io/account#api-access (one-time reveal; generating a new key
//  revokes the previous one).
//    Get a key / plans:  https://zerogex.io
//    All integrations:   https://zerogex.io/integrations
//    API docs:           https://api.zerogex.io/docs
//
//  Endpoint:  GET {ApiBaseUrl}/api/v1/levels/{Symbol}?strikes=1&api_key=<key>
//
//  WHY THE KEY IS IN THE QUERY STRING, NOT AN Authorization HEADER
//  ACSIL's HTTP surface that is portable across Sierra Chart versions is
//  sc.MakeHTTPRequest(URL) — a bare GET with no way to attach request
//  headers. So /api/v1/levels accepts `?api_key=` in addition to the
//  Authorization / X-API-Key headers the other integrations use. That
//  acceptance is allowlisted to the levels routes alone and never extends to
//  any endpoint serving raw per-contract quotes. It is a real (small)
//  exposure trade — a query string is visible to any proxy in front of the
//  API and lands in access logs — so treat the key as you would a password
//  and rotate it from Account → API Access if a log ever leaks.
//
//  FUTURES: set Symbol to ES or NQ and the levels arrive already on the
//  futures price axis — no basis offset to work out, and nothing to re-enter
//  after a quarterly roll. ZeroGEX computes gamma from the SPX / NDX option
//  chains (there is no separate ES book) and carries the price-space levels
//  across server-side using a measured index/future ratio.
//
//  Informational and educational use only. Not financial advice. Options
//  trading involves significant risk.
//
//  BUILD / INSTALL
//    1. Copy this file into Sierra Chart's ACS_Source folder
//       (Analysis → Studies → Add Custom Study → "Open Source Code Folder",
//        typically C:\SierraChart\ACS_Source).
//    2. Analysis → Build Custom Studies DLL → Build. Sierra Chart ships its
//       own compiler, so there is no toolchain to install.
//    3. On a chart: Analysis → Studies → Add Custom Study →
//       "ZeroGEX Gamma Levels".
//    4. In the study settings, paste your API key and set Symbol to match
//       the chart (ES, NQ, SPX, SPY, QQQ or NDX).
//
//  Each level is a subgraph, so you can recolor, restyle or hide any of them
//  from the study's Subgraphs tab, and their values show in the Values Window
//  and are addressable from spreadsheet studies and alert conditions.
// ============================================================================

#include "sierrachart.h"

#include <cstring>
#include <cstdlib>

SCDLLName("ZeroGEX Studies")

// ---------------------------------------------------------------------------
//  Subgraph and input indices, named so the wiring below reads as prose.
// ---------------------------------------------------------------------------
enum ZeroGexSubgraphs
{
    SG_GAMMA_FLIP = 0,
    SG_CALL_WALL  = 1,
    SG_PUT_WALL   = 2,
    SG_MAX_PAIN   = 3,
    SG_PIN_STRIKE = 4,
    SG_COUNT      = 5
};

enum ZeroGexInputs
{
    IN_API_KEY      = 0,
    IN_SYMBOL       = 1,
    IN_REFRESH_SECS = 2,
    IN_API_BASE_URL = 3,
    IN_LOG_STATUS   = 4
};

// Persistent slots. Sierra Chart keeps these per study instance across calls.
// All three are ints on purpose: the int accessors are the oldest and most
// portable of the persistent-variable family, and nothing here needs more.
enum ZeroGexPersistent
{
    P_REQUEST_IN_FLIGHT = 1,  // a MakeHTTPRequest is outstanding
    P_LAST_POLL_SECONDS = 2,  // when the last request went out (see below)
    P_LEVELS_LOADED     = 3,  // at least one good snapshot has landed
    P_KEY_WARNING_SHOWN = 4   // the "set your API key" note has been logged
};

// How long an outstanding request may stay outstanding before it is written
// off. Without this the in-flight flag is a one-way latch: a request whose
// response never arrives — dropped connection, a Sierra Chart build that does
// not re-enter the study on a transport failure — leaves the flag set forever
// and the study silently stops updating, showing levels that look current and
// are hours old. That is the worst failure this file can have, so it gets a
// watchdog rather than a comment.
static const int REQUEST_TIMEOUT_SECONDS = 30;

// The poll floor that actually binds, matching the NinjaTrader indicator
// against the same endpoint. The analytics cycle behind /api/v1/levels is
// ~60s and unaligned, so polling at 30 halves worst-case staleness; below that
// there is nothing left to win and every extra request is rate limit spent on
// bytes that did not change. Enforced here rather than only through the input
// limits, because those govern the settings dialog and not a chartbook that
// already carries a smaller number.
static const int MINIMUM_REFRESH_SECONDS = 30;

// One day expressed in seconds. SCDateTime counts in days, and the refresh
// interval is configured in seconds, so every comparison needs this. Defined
// locally rather than relying on a platform macro so the file has one less
// version-dependent symbol in it.
static const double SECONDS_PER_DAY = 86400.0;

// SCDateTime counts days from 1899-12-30, which puts "now" around 46,000 —
// and 46,000 × 86,400 overflows a signed 32-bit int. So the poll clock counts
// seconds from a fixed offset instead of from SCDateTime's own epoch, which
// keeps it inside int range until roughly 2090 while staying exact to the
// second. Storing days in a float instead would have quantized the clock to
// about five minutes and broken every refresh interval shorter than that.
static const double POLL_CLOCK_EPOCH_DAYS = 40000.0;

/** Seconds on the poll clock right now.
 *
 *  Rounded, not truncated. days × 86400 does not land exactly on a whole
 *  second in binary floating point, so a plain cast — which truncates toward
 *  zero — loses up to a second on every reading and makes every interval
 *  measure one short. At the 15s minimum that is a 7% error. */
static int PollClockNow(SCStudyInterfaceRef sc)
{
    const double DaysSinceEpoch = sc.CurrentSystemDateTime.GetAsDouble() - POLL_CLOCK_EPOCH_DAYS;
    return static_cast<int>(DaysSinceEpoch * SECONDS_PER_DAY + 0.5);
}

// ---------------------------------------------------------------------------
//  Minimal JSON scanning.
//
//  The /api/v1/levels contract is a small, fixed shape and every key we read
//  ("gamma_flip", "call_wall", "put_wall", "max_pain", "pin_strike",
//  "age_seconds") appears exactly once in the document, so a scan for the
//  quoted key and a strtod on what follows is both sufficient and far smaller
//  than dragging a JSON library into a study DLL.
//
//  Returns false when the key is absent OR its value is JSON null — the two
//  cases the caller must treat identically. A null level means the analytics
//  engine could not resolve it for the latest snapshot, and the contract is
//  explicit that consumers hide rather than zero it: a Put Wall drawn at 0
//  would flatten the chart's price scale.
// ---------------------------------------------------------------------------
/** Parse a JSON number at ``Cursor``. Locale-independent by construction.
 *
 *  Deliberately NOT strtod. strtod honors LC_NUMERIC, and on an install whose
 *  locale uses a comma as the decimal separator it stops at the '.' — turning
 *  5950.25 into 5950 and drawing a level that is silently, plausibly wrong.
 *  A wrong line on a chart is worse than a missing one, and Sierra Chart has a
 *  large European user base, so the parse is done by hand against the JSON
 *  grammar, which always uses '.' regardless of where the machine is.
 *
 *  Accumulating the fraction digit by digit is very slightly less accurate
 *  than strtod's correctly-rounded conversion — on the order of 1e-12 for a
 *  four-figure price. Every value here is cast to float before it reaches a
 *  subgraph, and float resolution around 6000 is about 5e-4, so the difference
 *  cannot survive to the chart.
 */
static bool ParseJsonNumber(const char* Cursor, double& OutValue)
{
    bool Negative = false;
    if (*Cursor == '-')
    {
        Negative = true;
        ++Cursor;
    }

    if (*Cursor < '0' || *Cursor > '9')
        return false;  // not a number (covers null, true, a quoted string)

    double Value = 0.0;
    while (*Cursor >= '0' && *Cursor <= '9')
        Value = Value * 10.0 + (*Cursor++ - '0');

    if (*Cursor == '.')
    {
        ++Cursor;
        double Scale = 0.1;
        while (*Cursor >= '0' && *Cursor <= '9')
        {
            Value += (*Cursor++ - '0') * Scale;
            Scale *= 0.1;
        }
    }

    if (*Cursor == 'e' || *Cursor == 'E')
    {
        ++Cursor;
        bool NegativeExponent = false;
        if (*Cursor == '-')
        {
            NegativeExponent = true;
            ++Cursor;
        }
        else if (*Cursor == '+')
        {
            ++Cursor;
        }

        int Exponent = 0;
        while (*Cursor >= '0' && *Cursor <= '9')
        {
            Exponent = Exponent * 10 + (*Cursor++ - '0');
            // Bounded so a garbled body carrying 1e999999999 cannot spin this
            // loop. Anything past double's range is not a level either way.
            if (Exponent > 400)
                return false;
        }

        for (int Step = 0; Step < Exponent; ++Step)
            Value = NegativeExponent ? Value / 10.0 : Value * 10.0;
    }

    OutValue = Negative ? -Value : Value;
    return true;
}

static bool ExtractJsonNumber(const SCString& Json, const char* Key, double& OutValue)
{
    SCString Needle;
    Needle.Format("\"%s\":", Key);

    // The closing quote in the needle is what keeps "pin_strike" from matching
    // "pin_strike_reason", which the response also carries at its top level.
    const char* Found = strstr(Json.GetChars(), Needle.GetChars());
    if (Found == NULL)
        return false;

    const char* Cursor = Found + Needle.GetLength();
    while (*Cursor == ' ' || *Cursor == '\t')
        ++Cursor;

    return ParseJsonNumber(Cursor, OutValue);
}

// ---------------------------------------------------------------------------
//  Write one level across the whole subgraph array, or hide it entirely.
//
//  A level is a horizontal line, so every element of the array carries the
//  same value — that is what makes it span the chart. When the API returns
//  null for a level we flip the subgraph to DRAWSTYLE_IGNORE instead of
//  writing zeros, so the line disappears without dragging the price scale
//  down to zero with it.
// ---------------------------------------------------------------------------
static void ApplyLevel(SCStudyInterfaceRef sc, int SubgraphIndex, bool HasValue, double Value)
{
    if (!HasValue)
    {
        sc.Subgraph[SubgraphIndex].DrawStyle = DRAWSTYLE_IGNORE;
        return;
    }

    sc.Subgraph[SubgraphIndex].DrawStyle = DRAWSTYLE_LINE;
    for (int Index = 0; Index < sc.ArraySize; ++Index)
        sc.Subgraph[SubgraphIndex][Index] = static_cast<float>(Value);
}

// ---------------------------------------------------------------------------
//  The study
// ---------------------------------------------------------------------------
SCSFExport scsf_ZeroGexGammaLevels(SCStudyInterfaceRef sc)
{
    if (sc.SetDefaults)
    {
        sc.GraphName = "ZeroGEX Gamma Levels";
        sc.StudyDescription =
            "Draws the ZeroGEX dealer-positioning levels (Gamma Flip, Call Wall, "
            "Put Wall, Max Pain, Pin Strike) and keeps them current by polling the "
            "ZeroGEX API. Requires a ZeroGEX Pro API key — zerogex.io/integrations.";

        sc.GraphRegion = 0;      // main price graph
        sc.AutoLoop    = 0;      // we fill the whole array ourselves on refresh
        sc.FreeDLL     = 0;
        // Without this the study is only called when a tick arrives, which
        // would stall polling on a quiet chart — exactly when a stale Gamma
        // Flip is most misleading.
        sc.UpdateAlways = 1;
        sc.ValueFormat  = VALUEFORMAT_INHERITED;

        sc.Subgraph[SG_GAMMA_FLIP].Name = "Gamma Flip";
        sc.Subgraph[SG_GAMMA_FLIP].DrawStyle = DRAWSTYLE_LINE;
        sc.Subgraph[SG_GAMMA_FLIP].PrimaryColor = RGB(255, 152, 0);
        sc.Subgraph[SG_GAMMA_FLIP].LineWidth = 2;

        sc.Subgraph[SG_CALL_WALL].Name = "Call Wall";
        sc.Subgraph[SG_CALL_WALL].DrawStyle = DRAWSTYLE_LINE;
        sc.Subgraph[SG_CALL_WALL].PrimaryColor = RGB(242, 54, 69);
        sc.Subgraph[SG_CALL_WALL].LineWidth = 2;

        sc.Subgraph[SG_PUT_WALL].Name = "Put Wall";
        sc.Subgraph[SG_PUT_WALL].DrawStyle = DRAWSTYLE_LINE;
        sc.Subgraph[SG_PUT_WALL].PrimaryColor = RGB(8, 153, 129);
        sc.Subgraph[SG_PUT_WALL].LineWidth = 2;

        sc.Subgraph[SG_MAX_PAIN].Name = "Max Pain";
        sc.Subgraph[SG_MAX_PAIN].DrawStyle = DRAWSTYLE_DASH;
        sc.Subgraph[SG_MAX_PAIN].PrimaryColor = RGB(156, 39, 176);
        sc.Subgraph[SG_MAX_PAIN].LineWidth = 2;

        sc.Subgraph[SG_PIN_STRIKE].Name = "Pin Strike";
        sc.Subgraph[SG_PIN_STRIKE].DrawStyle = DRAWSTYLE_DASH;
        sc.Subgraph[SG_PIN_STRIKE].PrimaryColor = RGB(0, 176, 255);
        sc.Subgraph[SG_PIN_STRIKE].LineWidth = 2;

        sc.Input[IN_API_KEY].Name = "ZeroGEX API Key";
        sc.Input[IN_API_KEY].SetString("");

        sc.Input[IN_SYMBOL].Name = "Symbol (ES, NQ, SPX, SPY, QQQ, NDX)";
        sc.Input[IN_SYMBOL].SetString("ES");

        // 60s matches the analytics refresh cycle behind the endpoint, so
        // polling faster only spends rate limit re-fetching identical bytes.
        //
        // The limits here are deliberately WIDER than the policy. SetIntLimits
        // only constrains what someone can type into the settings dialog; a
        // chartbook saved with a smaller value, or a .cht passed between
        // traders, carries its own number straight past it. So the floor that
        // actually binds is the runtime clamp below, and this bound exists
        // only to catch typing. Same rule the NinjaTrader indicator arrived at
        // the hard way: widen this freely, never raise it.
        sc.Input[IN_REFRESH_SECS].Name = "Refresh Interval (Seconds - 30s minimum is applied)";
        sc.Input[IN_REFRESH_SECS].SetInt(60);
        sc.Input[IN_REFRESH_SECS].SetIntLimits(15, 3600);

        sc.Input[IN_API_BASE_URL].Name = "API Base URL";
        sc.Input[IN_API_BASE_URL].SetString("https://api.zerogex.io");

        sc.Input[IN_LOG_STATUS].Name = "Log Status Messages";
        sc.Input[IN_LOG_STATUS].SetYesNo(0);

        return;
    }

    const bool LogStatus = sc.Input[IN_LOG_STATUS].GetYesNo() != 0;

    // -----------------------------------------------------------------------
    //  A response landing is what re-enters this function after a request, so
    //  it is handled before anything else. sc.HTTPResponse is only non-empty
    //  on that call.
    // -----------------------------------------------------------------------
    if (sc.HTTPResponse.GetLength() > 0)
    {
        sc.SetPersistentInt(P_REQUEST_IN_FLIGHT, 0);

        const SCString Response = sc.HTTPResponse;

        // Sierra Chart reports transport failures through the same channel as
        // a body, so these two sentinels are errors, not JSON.
        if (Response == ACSIL_HTTP_REQUEST_ERROR_TEXT || Response == ACSIL_HTTP_EMPTY_RESPONSE_TEXT)
        {
            sc.AddMessageToLog("ZeroGEX: the request to the levels API failed. Check the machine's internet connection and the API Base URL setting.", 1);
            return;
        }

        // A 401 body is JSON too ({"detail":"Invalid or missing API key"}), so
        // it parses cleanly and yields no levels — which would otherwise look
        // like "the API has no data today" rather than "your key is wrong".
        // Naming it is the difference between a five-second fix and a ticket.
        if (strstr(Response.GetChars(), "\"levels\"") == NULL)
        {
            if (strstr(Response.GetChars(), "Invalid or missing API key") != NULL)
                sc.AddMessageToLog("ZeroGEX: the API rejected this key. Generate a fresh one at zerogex.io/account#api-access — only one key is active at a time, so generating a new key elsewhere revokes this one.", 1);
            else
                sc.AddMessageToLog("ZeroGEX: no levels in the API response. If this persists the symbol may not be covered — try ES, NQ, SPX, SPY, QQQ or NDX.", 1);
            return;
        }

        double GammaFlip = 0.0, CallWall = 0.0, PutWall = 0.0, MaxPain = 0.0, PinStrike = 0.0;
        const bool HasGammaFlip = ExtractJsonNumber(Response, "gamma_flip", GammaFlip);
        const bool HasCallWall  = ExtractJsonNumber(Response, "call_wall",  CallWall);
        const bool HasPutWall   = ExtractJsonNumber(Response, "put_wall",   PutWall);
        const bool HasMaxPain   = ExtractJsonNumber(Response, "max_pain",   MaxPain);
        const bool HasPinStrike = ExtractJsonNumber(Response, "pin_strike", PinStrike);

        ApplyLevel(sc, SG_GAMMA_FLIP, HasGammaFlip, GammaFlip);
        ApplyLevel(sc, SG_CALL_WALL,  HasCallWall,  CallWall);
        ApplyLevel(sc, SG_PUT_WALL,   HasPutWall,   PutWall);
        ApplyLevel(sc, SG_MAX_PAIN,   HasMaxPain,   MaxPain);
        ApplyLevel(sc, SG_PIN_STRIKE, HasPinStrike, PinStrike);

        sc.SetPersistentInt(P_LEVELS_LOADED, 1);

        if (LogStatus)
        {
            double AgeSeconds = 0.0;
            SCString Message;
            Message.Format(
                "ZeroGEX %s: flip=%.2f call=%.2f put=%.2f pain=%.2f pin=%.2f (data age %.0fs)",
                sc.Input[IN_SYMBOL].GetString(),
                HasGammaFlip ? GammaFlip : 0.0,
                HasCallWall  ? CallWall  : 0.0,
                HasPutWall   ? PutWall   : 0.0,
                HasMaxPain   ? MaxPain   : 0.0,
                HasPinStrike ? PinStrike : 0.0,
                ExtractJsonNumber(Response, "age_seconds", AgeSeconds) ? AgeSeconds : 0.0);
            sc.AddMessageToLog(Message, 0);
        }

        return;
    }

    // -----------------------------------------------------------------------
    //  Redraw on chart growth.
    //
    //  A new bar extends sc.ArraySize past the last index we filled, and a
    //  horizontal line that stops short of the right-hand edge is worse than
    //  no line at all — it reads as a level that ended. So the most recent
    //  snapshot is re-stamped across the new elements without re-fetching.
    // -----------------------------------------------------------------------
    if (sc.GetPersistentInt(P_LEVELS_LOADED) != 0 && sc.ArraySize > 0)
    {
        for (int SubgraphIndex = 0; SubgraphIndex < SG_COUNT; ++SubgraphIndex)
        {
            if (sc.Subgraph[SubgraphIndex].DrawStyle == DRAWSTYLE_IGNORE)
                continue;

            // Element 0 is as good as any — ApplyLevel stamped the same value
            // across every element, which is what makes the line horizontal.
            const float Value = sc.Subgraph[SubgraphIndex][0];

            // …unless the array was reallocated under us. Sierra Chart zeroes
            // the subgraph arrays on a full recalculation — a timeframe or
            // symbol change, more history loading in, a chart reload — and the
            // study is then called with a DrawStyle that still says LINE over
            // data that is all zeros. Stamping that zero across the chart
            // would draw every level at 0 and collapse the price scale, which
            // is a far louder failure than a missing line.
            //
            // So treat a zeroed array as "the snapshot is gone" and re-fetch
            // immediately (clearing the poll timer skips the interval wait).
            // The gap is one request, typically well under a second.
            if (Value == 0.0f)
            {
                sc.SetPersistentInt(P_LEVELS_LOADED, 0);
                sc.SetPersistentInt(P_LAST_POLL_SECONDS, 0);
                break;
            }

            const int StartIndex = sc.UpdateStartIndex > 0 ? sc.UpdateStartIndex : 0;
            for (int Index = StartIndex; Index < sc.ArraySize; ++Index)
                sc.Subgraph[SubgraphIndex][Index] = Value;
        }
    }

    // -----------------------------------------------------------------------
    //  Poll.
    // -----------------------------------------------------------------------
    SCString ApiKey = sc.Input[IN_API_KEY].GetString();
    ApiKey.Trim();
    if (ApiKey.GetLength() == 0)
    {
        // Logged once per study instance, not once per update. sc.UpdateAlways
        // means this function runs continuously, so an unguarded message would
        // fill the log while someone is still pasting their key in. A dedicated
        // flag rather than a UpdateStartIndex test, which is 0 on every full
        // recalculation and on a chart with no bars yet.
        if (sc.GetPersistentInt(P_KEY_WARNING_SHOWN) == 0)
        {
            sc.AddMessageToLog("ZeroGEX: set your API key in the study settings. Pro members generate one at zerogex.io/account#api-access.", 1);
            sc.SetPersistentInt(P_KEY_WARNING_SHOWN, 1);
        }
        return;
    }
    // Armed again once a key is present, so someone who clears the key later
    // is told about it rather than left with a silently dead study.
    sc.SetPersistentInt(P_KEY_WARNING_SHOWN, 0);

    const int NowSeconds = PollClockNow(sc);
    const int LastPollSeconds = sc.GetPersistentInt(P_LAST_POLL_SECONDS);

    if (sc.GetPersistentInt(P_REQUEST_IN_FLIGHT) != 0)
    {
        // A request is outstanding — unless it has been outstanding so long
        // that no response is coming. Without this the flag is a one-way
        // latch and a single lost response stops the study permanently while
        // it keeps displaying the last levels as though they were current.
        if ((NowSeconds - LastPollSeconds) < REQUEST_TIMEOUT_SECONDS)
            return;

        sc.SetPersistentInt(P_REQUEST_IN_FLIGHT, 0);
        if (LogStatus)
            sc.AddMessageToLog("ZeroGEX: no response within 30s — abandoning that request and retrying.", 0);
    }

    int RefreshSeconds = sc.Input[IN_REFRESH_SECS].GetInt();
    if (RefreshSeconds < MINIMUM_REFRESH_SECONDS)
        RefreshSeconds = MINIMUM_REFRESH_SECONDS;

    if (LastPollSeconds != 0 && (NowSeconds - LastPollSeconds) < RefreshSeconds)
        return;

    SCString Symbol = sc.Input[IN_SYMBOL].GetString();
    Symbol.Trim();
    Symbol.MakeUpper();

    SCString BaseUrl = sc.Input[IN_API_BASE_URL].GetString();
    BaseUrl.Trim();
    while (BaseUrl.GetLength() > 0 && BaseUrl.GetChars()[BaseUrl.GetLength() - 1] == '/')
        BaseUrl = BaseUrl.Left(BaseUrl.GetLength() - 1);

    // strikes=1 because this study draws lines and no histogram — asking for
    // the default 40-strike profile would move roughly forty times the bytes
    // per poll for data nothing here reads.
    SCString Url;
    Url.Format("%s/api/v1/levels/%s?strikes=1&api_key=%s",
               BaseUrl.GetChars(), Symbol.GetChars(), ApiKey.GetChars());

    if (sc.MakeHTTPRequest(Url) == 0)
    {
        sc.AddMessageToLog("ZeroGEX: could not start the request to the levels API. Check the API Base URL setting.", 1);
        return;
    }

    sc.SetPersistentInt(P_REQUEST_IN_FLIGHT, 1);
    sc.SetPersistentInt(P_LAST_POLL_SECONDS, NowSeconds);
}
