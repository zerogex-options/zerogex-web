// ============================================================================
//  ZeroGEX Gamma Levels — NinjaTrader 8 indicator (auto-updating)
//
//  Draws today's ZeroGEX dealer-positioning levels on any chart and keeps
//  them current by polling the ZeroGEX API:
//    • Gamma Flip   (regime line)
//    • Call Wall    (upside cap)
//    • Put Wall     (downside floor)
//    • Max Pain     (expiration magnet)
//    • Pin Strike   (0DTE pin magnet)
//    • GEX 1..N     (the strikes carrying the most dealer gamma)
//    • VWAP         (session volume-weighted average price)
//  …plus an optional right-anchored per-strike net-gamma histogram.
//
//  Unlike the free manual-entry TradingView script, this indicator pulls the
//  numbers for you. It requires a ZeroGEX API key, which ships with the Pro
//  plan — the code is free, the data is gated by the key. Generate the key
//  yourself at zerogex.io/account#api-access (one-time reveal; generating a
//  new key revokes the previous one).
//    Get a key / plans:  https://zerogex.io
//    API docs:           https://api.zerogex.io/docs
//
//  Endpoint:  GET {ApiBaseUrl}/api/v1/levels/{Symbol}
//  Auth:      Authorization: Bearer <your key>
//
//  Informational and educational use only. Not financial advice. Options
//  trading involves significant risk.
//
//  FUTURES: set Symbol to ES or NQ and the levels arrive already on the
//  futures price axis — no basis offset to enter and nothing to keep in sync.
//  ZeroGEX computes gamma from the SPX / NDX option chains (there is no
//  separate ES book) and carries the price-space levels across server-side
//  using a measured index/future ratio. Dealer exposure is deliberately NOT
//  rescaled, which is why the histogram's relative bar sizes stay correct.
//
//  INSTALL: NinjaTrader → New → NinjaScript Editor → right-click Indicators →
//  Import… (or paste this file into a new Indicator), then Compile (F5).
//  Add "ZeroGEX Gamma Levels" to a chart and set your API key + symbol in the
//  indicator settings.
// ============================================================================

#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Media;
using System.Xml.Serialization;
using NinjaTrader.Cbi;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Chart;
using NinjaTrader.Gui.Tools;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.DrawingTools;
#endregion

namespace NinjaTrader.NinjaScript.Indicators
{
    /// <summary>
    /// A snapshot of the four levels, plus freshness metadata. Assigned as a
    /// single immutable reference from the fetch thread and read on the data
    /// thread, so no lock is needed — the reference swap is atomic.
    /// </summary>
    public sealed class ZeroGexLevelsSnapshot
    {
        public double? GammaFlip;
        public double? CallWall;
        public double? PutWall;
        public double? MaxPain;
        public double? PinStrike;
        public double? Spot;

        // Per-strike net gamma, ascending by strike (the API sorts it that
        // way). Parallel lists rather than a bar type: the histogram only
        // ever needs these two columns.
        public List<double> ProfileStrike;
        public List<double> ProfileNetGex;

        // Session VWAP, from a second endpoint. Null when the extra call is
        // switched off or failed — it is additive, never load-bearing.
        public double? Vwap;
        public int? AgeSeconds;
        public string AsOf;
        public string Symbol;
    }

    public class ZeroGexGammaLevels : Indicator
    {
        // One shared client for the whole process: creating an HttpClient per
        // request exhausts sockets under polling. Auth is set per-request, not
        // on the client, so multiple charts with different keys are safe.
        private static readonly HttpClient _http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(10)
        };

        // Latest parsed snapshot (null until the first successful fetch). Volatile
        // so the data thread always sees the fetch thread's most recent write.
        private volatile ZeroGexLevelsSnapshot _snapshot;
        private volatile string _status = "starting…";

        private int _fetchInFlight;          // 0/1 guard via Interlocked — one fetch at a time
        private DateTime _lastFetchUtc = DateTime.MinValue;

        // Last-seen close for cross-alert edge detection (avoids re-alerting).
        private double _prevClose = double.NaN;

        // Histogram bookkeeping. The bars are anchored with barsAgo, which
        // resolves to an absolute bar at draw time, so they have to be redrawn
        // as bars form or they drift away from the right edge. Redrawing every
        // tick would be dozens of Draw calls per tick on a fast chart, so the
        // redraw is gated on "new bar, new snapshot, or toggled".
        private int _gexRanksDrawn;
        private int _profileDrawn;
        private int _profileAnchorBar = -1;
        private bool _profileShown;
        private ZeroGexLevelsSnapshot _profileSnapshot;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "Auto-updating ZeroGEX dealer-positioning levels " +
                              "(Gamma Flip, Call Wall, Put Wall, Max Pain).";
                Name = "ZeroGEX Gamma Levels";
                Calculate = Calculate.OnEachTick;
                IsOverlay = true;                       // draw on the price panel
                DisplayInDataBox = false;
                DrawOnPricePanel = true;
                // Deliberately false. Suspending on an inactive tab means
                // NinjaTrader restarts the instance when you come back, which
                // drops the snapshot and used to blank the chart — reported as
                // "leave it an hour and the levels disappear". The saving was
                // one small request a minute; the cost was the indicator
                // appearing to break whenever you looked at another tab.
                IsSuspendedWhileInactive = false;
                PaintPriceMarkers = false;

                // --- Connection ---
                ApiBaseUrl = "https://api.zerogex.io";
                ApiKey = "";
                Symbol = "SPX";
                PollSeconds = 60;                       // matches the ~60s analytics cycle

                // --- Levels to show ---
                ShowGammaFlip = true;
                ShowCallWall = true;
                ShowPutWall = true;
                ShowMaxPain = true;
                ShowPinStrike = true;

                // Both default ON, unlike the histogram: these are a handful of
                // ordinary lines, not dozens of draw objects, and they are the
                // two things traders asked for by name.
                ShowGexRanks = true;
                GexRankCount = 4;
                ShowVwap = true;

                // Opt-in: this is 40 extra draw objects on the price panel, so
                // an existing user's chart shouldn't sprout them on update.
                ShowStrikeProfile = false;
                ProfileStrikeCount = 40;
                ProfileWidthBars = 20;
                // Bar thickness in pixels. The default Draw.Line stroke is 1px,
                // which reads as a hairline rather than a histogram; 5 gives the
                // bars enough body to be read at a glance without them merging
                // into each other at typical strike spacing.
                ProfileBarWidth = 5;

                // --- Style ---
                LineWidth = 2;
                ShowLabels = true;
                ShowInfoPanel = true;
                EnableAlerts = false;

                FlipBrush = Brushes.Orange;
                CallBrush = Brushes.Crimson;
                PutBrush = Brushes.SeaGreen;
                PainBrush = Brushes.MediumPurple;
                PinBrush = Brushes.DeepSkyBlue;
                ProfilePosBrush = Brushes.SteelBlue;
                ProfileNegBrush = Brushes.IndianRed;
                GexRankBrush = Brushes.Goldenrod;
                VwapBrush = Brushes.DodgerBlue;
            }
            else if (State == State.Terminated)
            {
                // Nothing to dispose: the HttpClient is process-static and the
                // fetch is fire-and-forget with its own guard.
            }
        }

        protected override void OnBarUpdate()
        {
            // Only act on the primary series and once there is a bar to anchor to.
            if (BarsInProgress != 0 || CurrentBar < 0)
                return;

            MaybeFetch();
            DrawLevels();

            if (EnableAlerts)
                CheckCrossAlerts();

            _prevClose = Close[0];
        }

        // ------------------------------------------------------------------
        // Polling — throttled, single-in-flight, off the data thread
        // ------------------------------------------------------------------
        private void MaybeFetch()
        {
            int poll = Math.Max(5, PollSeconds);
            if ((DateTime.UtcNow - _lastFetchUtc).TotalSeconds < poll)
                return;

            // Interlocked guard: skip if a fetch is already running.
            if (Interlocked.CompareExchange(ref _fetchInFlight, 1, 0) != 0)
                return;

            _lastFetchUtc = DateTime.UtcNow;

            if (string.IsNullOrWhiteSpace(ApiKey))
            {
                _status = "no API key set";
                Interlocked.Exchange(ref _fetchInFlight, 0);
                return;
            }

            // Fire-and-forget: never block the data thread on network I/O.
            Task.Run(async () =>
            {
                try
                {
                    var snap = await FetchAsync().ConfigureAwait(false);
                    if (snap != null)
                    {
                        _snapshot = snap;
                        _status = "ok";
                    }
                }
                catch (Exception ex)
                {
                    _status = ex.Message;
                    // Also to the Output window, so a user who cannot read the
                    // panel can copy something useful into a support email.
                    Print("ZeroGEX " + DateTime.Now.ToString("HH:mm:ss") +
                          " fetch failed: " + ex.Message);
                }
                finally
                {
                    Interlocked.Exchange(ref _fetchInFlight, 0);
                }
            });
        }

        private async Task<ZeroGexLevelsSnapshot> FetchAsync()
        {
            string baseUrl = (ApiBaseUrl ?? "").TrimEnd('/');
            string sym = Uri.EscapeDataString((Symbol ?? "").Trim().ToUpperInvariant());
            // strikes= is bounded 1..200 server-side; clamp here so a bad
            // setting can never turn into a 422.
            int want = Math.Min(200, Math.Max(1, ProfileStrikeCount));
            string url = baseUrl + "/api/v1/levels/" + sym +
                         "?strikes=" + want.ToString(CultureInfo.InvariantCulture);

            using (var req = new HttpRequestMessage(HttpMethod.Get, url))
            {
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", (ApiKey ?? "").Trim());
                req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                using (var resp = await _http.SendAsync(req).ConfigureAwait(false))
                {
                    string body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                    if (!resp.IsSuccessStatusCode)
                    {
                        int code = (int)resp.StatusCode;
                        // Name the two the user can act on. 401/403 almost always
                        // means the key was replaced elsewhere — only one key is
                        // active per account, so generating a new one silently
                        // retires the one sitting in this chart.
                        if (code == 401 || code == 403)
                            throw new Exception("key rejected (HTTP " + code +
                                                ") — generating a new API key retires the old one");
                        if (code == 429)
                            throw new Exception("rate limited (HTTP 429) — polling too often");
                        throw new Exception("HTTP " + code);
                    }

                    var snap = Parse(body);
                    if (snap != null && ShowVwap)
                        snap.Vwap = await FetchVwapAsync(baseUrl, sym).ConfigureAwait(false);

                    return snap;
                }
            }
        }

        /// <summary>Session VWAP from /api/technicals/vwap-deviation.
        ///
        /// Deliberately best-effort: a failure here returns null and leaves the
        /// levels intact, because VWAP is additive and should never cost the
        /// user the lines they actually came for.
        ///
        /// window_units=1 asks for a single bucket, so the flat extractor's
        /// first-match cannot pick up an older bar — and it keeps the payload
        /// tiny. (The endpoint orders newest-first anyway; this does not rely
        /// on that.) `vwap` is in the API's PRICE_FIELDS, so on an ES or NQ
        /// chart it arrives projected onto the futures axis like every other
        /// level.</summary>
        private async Task<double?> FetchVwapAsync(string baseUrl, string escapedSymbol)
        {
            string url = baseUrl + "/api/technicals/vwap-deviation?symbol=" + escapedSymbol +
                         "&timeframe=1min&window_units=1";

            try
            {
                using (var req = new HttpRequestMessage(HttpMethod.Get, url))
                {
                    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", (ApiKey ?? "").Trim());
                    req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                    using (var resp = await _http.SendAsync(req).ConfigureAwait(false))
                    {
                        if (!resp.IsSuccessStatusCode)
                            return null;

                        string body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                        return ExtractNumber(body, "vwap");
                    }
                }
            }
            catch (Exception)
            {
                return null;
            }
        }

        // ------------------------------------------------------------------
        // Dependency-free JSON extraction.
        //
        // The /api/v1/levels contract is a small, fixed shape and every key we
        // read (gamma_flip, call_wall, put_wall, max_pain, pin_strike, spot,
        // age_seconds, as_of) is globally unique in the payload, so a flat key
        // search over the whole body is safe and avoids pulling in a JSON
        // dependency the NinjaScript compiler wouldn't reference by default.
        //
        // Needles are quote-delimited ("key"), so a key that merely *prefixes*
        // another — "pin_strike" vs the sibling "pin_strike_reason", "spot" vs
        // "net_gex_at_spot" — cannot false-match.
        // ------------------------------------------------------------------
        private ZeroGexLevelsSnapshot Parse(string json)
        {
            if (string.IsNullOrEmpty(json))
                return null;

            var snap = new ZeroGexLevelsSnapshot
            {
                GammaFlip = ExtractNumber(json, "gamma_flip"),
                CallWall = ExtractNumber(json, "call_wall"),
                PutWall = ExtractNumber(json, "put_wall"),
                MaxPain = ExtractNumber(json, "max_pain"),
                PinStrike = ExtractNumber(json, "pin_strike"),
                Spot = ExtractNumber(json, "spot"),
                AgeSeconds = (int?)ExtractNumber(json, "age_seconds"),
                AsOf = ExtractString(json, "as_of"),
                Symbol = ExtractString(json, "symbol"),
            };

            ExtractProfile(json, snap);
            return snap;
        }

        /// <summary>Walk the "profile" array and pull (strike, net_gex) from each
        /// element. Scoping the flat extractor to one object at a time is what
        /// makes the repeated keys unambiguous; the elements contain only
        /// numbers, so brace-depth alone delimits them.</summary>
        private static void ExtractProfile(string json, ZeroGexLevelsSnapshot snap)
        {
            snap.ProfileStrike = new List<double>();
            snap.ProfileNetGex = new List<double>();

            int k = json.IndexOf("\"profile\"", StringComparison.Ordinal);
            if (k < 0)
                return;

            int open = json.IndexOf('[', k);
            if (open < 0)
                return;

            int i = open + 1;
            while (i < json.Length && json[i] != ']')
            {
                if (json[i] != '{')
                {
                    i++;
                    continue;
                }

                int depth = 0;
                int start = i;
                int j = i;
                for (; j < json.Length; j++)
                {
                    if (json[j] == '{')
                        depth++;
                    else if (json[j] == '}')
                    {
                        depth--;
                        if (depth == 0) { j++; break; }
                    }
                }

                string element = json.Substring(start, j - start);
                double? strike = ExtractNumber(element, "strike");
                double? netGex = ExtractNumber(element, "net_gex");
                if (strike.HasValue && netGex.HasValue)
                {
                    snap.ProfileStrike.Add(strike.Value);
                    snap.ProfileNetGex.Add(netGex.Value);
                }

                i = j;
            }
        }

        /// <summary>Return the numeric value that follows "key": — or null when
        /// the key is absent or its value is JSON null.</summary>
        private static double? ExtractNumber(string json, string key)
        {
            int valueStart = ValueStart(json, key);
            if (valueStart < 0)
                return null;

            // JSON null → no level.
            if (json.Length - valueStart >= 4 &&
                string.CompareOrdinal(json, valueStart, "null", 0, 4) == 0)
                return null;

            int i = valueStart;
            int end = i;
            while (end < json.Length)
            {
                char c = json[end];
                bool numeric = (c >= '0' && c <= '9') || c == '+' || c == '-' ||
                               c == '.' || c == 'e' || c == 'E';
                if (!numeric)
                    break;
                end++;
            }

            string token = json.Substring(i, end - i);
            double parsed;
            if (double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out parsed))
                return parsed;

            return null;
        }

        /// <summary>Return the string value that follows "key": (without quotes),
        /// or null.</summary>
        private static string ExtractString(string json, string key)
        {
            int valueStart = ValueStart(json, key);
            if (valueStart < 0 || valueStart >= json.Length || json[valueStart] != '"')
                return null;

            int start = valueStart + 1;
            int end = json.IndexOf('"', start);
            if (end < 0)
                return null;

            return json.Substring(start, end - start);
        }

        /// <summary>Index of the first non-space character after the colon that
        /// follows "key". Returns -1 if the key is not present.</summary>
        private static int ValueStart(string json, string key)
        {
            string needle = "\"" + key + "\"";
            int k = json.IndexOf(needle, StringComparison.Ordinal);
            if (k < 0)
                return -1;

            int colon = json.IndexOf(':', k + needle.Length);
            if (colon < 0)
                return -1;

            int i = colon + 1;
            while (i < json.Length && char.IsWhiteSpace(json[i]))
                i++;

            return i < json.Length ? i : -1;
        }

        // ------------------------------------------------------------------
        // Rendering (high-level Draw API — runs on the data thread)
        // ------------------------------------------------------------------
        private void DrawLevels()
        {
            var s = _snapshot; // single volatile read

            // With no snapshot — first load, or a fetch that failed — leave
            // whatever is already drawn alone and just say so in the panel.
            // Passing nulls through to DrawOne removes every line, which turns
            // a recoverable hiccup into "the indicator stopped working". The
            // levels themselves are a snapshot of an option book, so holding
            // the last good ones is both honest and useful; the panel's age
            // and status tell the trader how much to trust them.
            if (s == null)
            {
                DrawInfoPanel(null);
                return;
            }

            DrawOne("ZG_Flip", ShowGammaFlip, s?.GammaFlip, "Gamma Flip", FlipBrush);
            DrawOne("ZG_Call", ShowCallWall, s?.CallWall, "Call Wall", CallBrush);
            DrawOne("ZG_Put", ShowPutWall, s?.PutWall, "Put Wall", PutBrush);
            DrawOne("ZG_Pain", ShowMaxPain, s?.MaxPain, "Max Pain", PainBrush);
            DrawOne("ZG_Pin", ShowPinStrike, s?.PinStrike, "Pin Strike", PinBrush);
            DrawOne("ZG_Vwap", ShowVwap, s?.Vwap, "VWAP", VwapBrush);
            DrawGexRanks(s);
            DrawProfile(s);
            DrawInfoPanel(s);
        }

        private void DrawInfoPanel(ZeroGexLevelsSnapshot s)
        {
            if (ShowInfoPanel)
                Draw.TextFixed(this, "ZG_Info", BuildInfoText(s), TextPosition.TopRight);
            else
                RemoveDrawObject("ZG_Info");
        }

        private void DrawOne(string tag, bool show, double? value, string label, Brush brush)
        {
            // Remove a previously-drawn line when the level is hidden or unset,
            // so a toggled-off or newly-null level doesn't linger on the chart.
            if (!show || value == null || value.Value == 0)
            {
                RemoveDrawObject(tag);
                RemoveDrawObject(tag + "_txt");
                return;
            }

            double price = value.Value;
            Draw.HorizontalLine(this, tag, price, brush, DashStyleHelper.Solid, Math.Max(1, LineWidth));

            if (ShowLabels)
            {
                string text = label + "  " + price.ToString("0.##", CultureInfo.InvariantCulture);
                Draw.Text(this, tag + "_txt", text, 0, price, brush);
            }
            else
            {
                RemoveDrawObject(tag + "_txt");
            }
        }

        /// <summary>The strikes carrying the most dealer gamma, drawn as dashed
        /// lines labelled GEX 1..N — GEX 1 being the largest.
        ///
        /// Costs no extra request: the profile the histogram already uses holds
        /// every strike's net gamma, so this is a ranking of data in hand.
        /// Ranked on ABSOLUTE gamma, so a heavy put strike ranks alongside a
        /// heavy call strike — the question being answered is "where is the
        /// most dealer gamma", not "where is the most positive gamma".
        ///
        /// Selection rather than a sort: N is single digits against at most 200
        /// strikes, so this is cheaper than ordering the whole profile, and it
        /// avoids taking a LINQ dependency the NinjaScript compiler would have
        /// to resolve.</summary>
        private void DrawGexRanks(ZeroGexLevelsSnapshot s)
        {
            int drawn = 0;

            if (ShowGexRanks && s != null && s.ProfileStrike != null && s.ProfileStrike.Count > 0)
            {
                int want = Math.Min(Math.Max(1, GexRankCount), s.ProfileStrike.Count);
                bool[] taken = new bool[s.ProfileStrike.Count];

                for (int rank = 0; rank < want; rank++)
                {
                    int best = -1;
                    double bestMagnitude = 0;

                    for (int i = 0; i < s.ProfileStrike.Count; i++)
                    {
                        if (taken[i])
                            continue;

                        double magnitude = Math.Abs(s.ProfileNetGex[i]);
                        if (magnitude > bestMagnitude)
                        {
                            bestMagnitude = magnitude;
                            best = i;
                        }
                    }

                    // Ran out of strikes carrying any gamma at all.
                    if (best < 0)
                        break;

                    taken[best] = true;

                    string tag = "ZG_Gex" + (rank + 1);
                    double y = s.ProfileStrike[best];

                    // Dashed, so the ranked strikes stay visually distinct from
                    // the four headline walls.
                    Draw.HorizontalLine(this, tag, y, GexRankBrush, DashStyleHelper.Dash,
                                        Math.Max(1, LineWidth));

                    if (ShowLabels)
                    {
                        string text = "GEX " + (rank + 1) + "  " +
                                      y.ToString("0.##", CultureInfo.InvariantCulture);
                        Draw.Text(this, tag + "_txt", text, 0, y, GexRankBrush);
                    }
                    else
                    {
                        RemoveDrawObject(tag + "_txt");
                    }

                    drawn++;
                }
            }

            // Retire ranks left over from a larger count, or from the whole
            // group being switched off.
            for (int rank = drawn; rank < _gexRanksDrawn; rank++)
            {
                RemoveDrawObject("ZG_Gex" + (rank + 1));
                RemoveDrawObject("ZG_Gex" + (rank + 1) + "_txt");
            }

            _gexRanksDrawn = drawn;
        }

        /// <summary>Right-anchored per-strike net-gamma histogram: one horizontal
        /// segment per strike, running left from the last bar, its length scaled
        /// to |net_gex| against the largest bar in view.</summary>
        private void DrawProfile(ZeroGexLevelsSnapshot s)
        {
            bool stale = _profileAnchorBar != CurrentBar
                         || _profileShown != ShowStrikeProfile
                         || !ReferenceEquals(_profileSnapshot, s);
            if (!stale)
                return;

            int drawn = 0;

            if (ShowStrikeProfile && s != null && s.ProfileStrike != null && s.ProfileStrike.Count > 0)
            {
                double maxAbs = 0;
                for (int i = 0; i < s.ProfileNetGex.Count; i++)
                {
                    double magnitude = Math.Abs(s.ProfileNetGex[i]);
                    if (magnitude > maxAbs)
                        maxAbs = magnitude;
                }

                if (maxAbs > 0)
                {
                    // Never reach further left than the chart actually has bars.
                    int span = Math.Min(Math.Max(1, ProfileWidthBars), Math.Max(1, CurrentBar));

                    for (int i = 0; i < s.ProfileStrike.Count; i++)
                    {
                        double netGex = s.ProfileNetGex[i];
                        int length = (int)Math.Round(span * Math.Abs(netGex) / maxAbs);
                        if (length < 1)
                            length = 1;

                        double y = s.ProfileStrike[i];
                        // isAutoScale MUST be passed: the styled Draw.Line
                        // overload takes it as the third argument, and the
                        // unstyled one has no width at all — so a call without
                        // it matches no overload. false is also what we want:
                        // these bars sit at strike prices that can be far from
                        // the visible range, and letting them drive the Y axis
                        // would zoom the chart out from the price action.
                        Draw.Line(this, "ZG_Prof_" + i, false, length, y, 0, y,
                                  netGex >= 0 ? ProfilePosBrush : ProfileNegBrush,
                                  DashStyleHelper.Solid, Math.Max(1, ProfileBarWidth));
                        drawn++;
                    }
                }
            }

            // Retire bars left over from a wider profile, or from the histogram
            // being switched off.
            for (int i = drawn; i < _profileDrawn; i++)
                RemoveDrawObject("ZG_Prof_" + i);

            _profileDrawn = drawn;
            _profileAnchorBar = CurrentBar;
            _profileShown = ShowStrikeProfile;
            _profileSnapshot = s;
        }

        private string BuildInfoText(ZeroGexLevelsSnapshot s)
        {
            if (s == null)
                return "ZeroGEX Gamma Levels\n" + _status;

            string age = s.AgeSeconds.HasValue ? s.AgeSeconds.Value + "s ago" : "—";
            string sym = string.IsNullOrEmpty(s.Symbol) ? (Symbol ?? "") : s.Symbol;

            // Levels are held through a failure rather than wiped, so the panel
            // has to be the thing that admits they are no longer live.
            string health = _status == "ok"
                ? ""
                : "\n⚠ not updating: " + _status;

            return "ZeroGEX Gamma Levels — " + sym + "\n" +
                   "Flip "  + Fmt(s.GammaFlip) + "   Call " + Fmt(s.CallWall) + "\n" +
                   "Put "   + Fmt(s.PutWall)   + "   Pain " + Fmt(s.MaxPain) + "\n" +
                   "Pin "   + Fmt(s.PinStrike) + "   VWAP " + Fmt(s.Vwap) + "\n" +
                   "updated " + age + "  ·  zerogex.io" + health;
        }

        private static string Fmt(double? v)
        {
            return v.HasValue ? v.Value.ToString("0.##", CultureInfo.InvariantCulture) : "—";
        }

        // ------------------------------------------------------------------
        // Optional price-cross alerts
        // ------------------------------------------------------------------
        private void CheckCrossAlerts()
        {
            if (double.IsNaN(_prevClose))
                return;

            var s = _snapshot;
            if (s == null)
                return;

            CrossAlert("ZGX_Flip", s.GammaFlip, "Gamma Flip");
            CrossAlert("ZGX_Call", s.CallWall, "Call Wall");
            CrossAlert("ZGX_Put", s.PutWall, "Put Wall");
            CrossAlert("ZGX_Pain", s.MaxPain, "Max Pain");
            CrossAlert("ZGX_Pin", s.PinStrike, "Pin Strike");
            CrossAlert("ZGX_Vwap", s.Vwap, "VWAP");
        }

        private void CrossAlert(string id, double? level, string label)
        {
            if (level == null || level.Value == 0)
                return;

            double lv = level.Value;
            double now = Close[0];
            bool crossedUp = _prevClose < lv && now >= lv;
            bool crossedDown = _prevClose > lv && now <= lv;
            if (!crossedUp && !crossedDown)
                return;

            string dir = crossedUp ? "above" : "below";
            Alert(id, Priority.Medium,
                  "ZeroGEX: price crossed " + dir + " the " + label +
                  " (" + lv.ToString("0.##", CultureInfo.InvariantCulture) + ")",
                  "", 0, Brushes.Black, Brushes.White);
        }

        #region Properties

        [NinjaScriptProperty]
        [Display(Name = "API base URL", Order = 1, GroupName = "1. Connection")]
        public string ApiBaseUrl { get; set; }

        // Deliberately NOT [NinjaScriptProperty]. NinjaTrader prints every
        // NinjaScriptProperty into the indicator label at the top of the chart,
        // so marking the key as one puts the user's live credential in plain
        // text on screen — and into every screenshot they ever share. Without
        // the attribute the property still appears in the indicator's settings
        // dialog and still persists to the workspace; it just stops being part
        // of the label signature.
        //
        // PasswordPropertyText was here to mask the value in the grid as well,
        // and has been REMOVED. It is a prime suspect for the report that the
        // key stops working and has to be regenerated: if NinjaTrader's grid
        // writes the *displayed* text back to the property, the stored key
        // silently becomes a row of asterisks — and the user cannot tell,
        // because a masked real key looks exactly the same. Unproven, but the
        // attribute was only ever cosmetic and the leak that actually mattered
        // (the key in the chart label) is fixed by the missing
        // NinjaScriptProperty above. Do not re-add it without testing that the
        // key survives a workspace save and reload.
        [Display(Name = "API key (Bearer)", Order = 2, GroupName = "1. Connection")]
        public string ApiKey { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Symbol (ES / NQ / SPX / SPY / QQQ / NDX)", Order = 3, GroupName = "1. Connection")]
        public string Symbol { get; set; }

        [NinjaScriptProperty]
        [Range(5, 3600)]
        [Display(Name = "Poll interval (seconds)", Order = 4, GroupName = "1. Connection")]
        public int PollSeconds { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show Gamma Flip", Order = 1, GroupName = "2. Levels")]
        public bool ShowGammaFlip { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show Call Wall", Order = 2, GroupName = "2. Levels")]
        public bool ShowCallWall { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show Put Wall", Order = 3, GroupName = "2. Levels")]
        public bool ShowPutWall { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show Max Pain", Order = 4, GroupName = "2. Levels")]
        public bool ShowMaxPain { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show Pin Strike", Order = 5, GroupName = "2. Levels")]
        public bool ShowPinStrike { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show GEX 1..N (top gamma strikes)", Order = 6, GroupName = "2. Levels")]
        public bool ShowGexRanks { get; set; }

        [NinjaScriptProperty]
        [Range(1, 10)]
        [Display(Name = "How many GEX levels", Order = 7, GroupName = "2. Levels")]
        public int GexRankCount { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show VWAP", Order = 8, GroupName = "2. Levels")]
        public bool ShowVwap { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show strike profile histogram", Order = 9, GroupName = "2. Levels")]
        public bool ShowStrikeProfile { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Histogram strikes (nearest spot)", Order = 10, GroupName = "2. Levels")]
        public int ProfileStrikeCount { get; set; }

        [NinjaScriptProperty]
        [Range(1, 200)]
        [Display(Name = "Histogram width (bars)", Order = 11, GroupName = "2. Levels")]
        public int ProfileWidthBars { get; set; }

        [NinjaScriptProperty]
        [Range(1, 20)]
        [Display(Name = "Histogram bar thickness (pixels)", Order = 12, GroupName = "2. Levels")]
        public int ProfileBarWidth { get; set; }

        [NinjaScriptProperty]
        [Range(1, 5)]
        [Display(Name = "Line width", Order = 1, GroupName = "3. Style")]
        public int LineWidth { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show price labels", Order = 2, GroupName = "3. Style")]
        public bool ShowLabels { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show info panel", Order = 3, GroupName = "3. Style")]
        public bool ShowInfoPanel { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Enable cross alerts", Order = 4, GroupName = "3. Style")]
        public bool EnableAlerts { get; set; }

        [XmlIgnore]
        [Display(Name = "Gamma Flip color", Order = 5, GroupName = "3. Style")]
        public Brush FlipBrush { get; set; }

        [Browsable(false)]
        public string FlipBrushSerialize
        {
            get { return Serialize.BrushToString(FlipBrush); }
            set { FlipBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Call Wall color", Order = 6, GroupName = "3. Style")]
        public Brush CallBrush { get; set; }

        [Browsable(false)]
        public string CallBrushSerialize
        {
            get { return Serialize.BrushToString(CallBrush); }
            set { CallBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Put Wall color", Order = 7, GroupName = "3. Style")]
        public Brush PutBrush { get; set; }

        [Browsable(false)]
        public string PutBrushSerialize
        {
            get { return Serialize.BrushToString(PutBrush); }
            set { PutBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Max Pain color", Order = 8, GroupName = "3. Style")]
        public Brush PainBrush { get; set; }

        [Browsable(false)]
        public string PainBrushSerialize
        {
            get { return Serialize.BrushToString(PainBrush); }
            set { PainBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Pin Strike color", Order = 9, GroupName = "3. Style")]
        public Brush PinBrush { get; set; }

        [Browsable(false)]
        public string PinBrushSerialize
        {
            get { return Serialize.BrushToString(PinBrush); }
            set { PinBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "GEX 1..N color", Order = 10, GroupName = "3. Style")]
        public Brush GexRankBrush { get; set; }

        [Browsable(false)]
        public string GexRankBrushSerialize
        {
            get { return Serialize.BrushToString(GexRankBrush); }
            set { GexRankBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "VWAP color", Order = 11, GroupName = "3. Style")]
        public Brush VwapBrush { get; set; }

        [Browsable(false)]
        public string VwapBrushSerialize
        {
            get { return Serialize.BrushToString(VwapBrush); }
            set { VwapBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Histogram color (net positive)", Order = 12, GroupName = "3. Style")]
        public Brush ProfilePosBrush { get; set; }

        [Browsable(false)]
        public string ProfilePosBrushSerialize
        {
            get { return Serialize.BrushToString(ProfilePosBrush); }
            set { ProfilePosBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Histogram color (net negative)", Order = 13, GroupName = "3. Style")]
        public Brush ProfileNegBrush { get; set; }

        [Browsable(false)]
        public string ProfileNegBrushSerialize
        {
            get { return Serialize.BrushToString(ProfileNegBrush); }
            set { ProfileNegBrush = Serialize.StringToBrush(value); }
        }

        #endregion
    }
}
