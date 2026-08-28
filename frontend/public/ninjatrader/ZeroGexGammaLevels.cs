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
//  …plus an optional per-strike net-gamma histogram, pinned to the left
//  edge of the chart window so it stays put as bars form.
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

                // Opt-in: forty extra bars on the price panel, so an existing
                // user's chart shouldn't sprout them on update.
                ShowStrikeProfile = false;
                ProfileStrikeCount = 40;
                // Percent of panel width. Named "Bars" because the property
                // name is the workspace storage key and renaming it would
                // reset the value on every chart that already has one.
                ProfileWidthBars = 20;
                // Bar thickness in pixels. 5 gives the bars enough body to be
                // read at a glance without them merging into each other at
                // typical strike spacing.
                ProfileBarWidth = 5;

                // --- Style ---
                LineWidth = 2;
                ShowLabels = true;
                // Labels used to sit exactly ON their line, which reads fine
                // with four levels and becomes an unreadable smear once GEX
                // 1..10 and VWAP are on too. Nudging them up a few ticks costs
                // nothing and separates text from line. In ticks, so it scales
                // with the instrument; 0 restores the old behaviour.
                LabelOffsetTicks = 4;
                // Eight pixels clear of the right edge: enough to read, not
                // so much that the label drifts away from its own line.
                LabelRightOffsetPixels = 8;
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

            // Lines, labels and the histogram are drawn in OnRender, which the
            // chart drives. All that is left here is the info panel, which is a
            // Draw object because TextFixed is already anchored to the window
            // and works: there is nothing for the rewrite to fix.
            DrawInfoPanel(_snapshot);

            if (EnableAlerts)
                CheckCrossAlerts();

            _prevClose = Close[0];
        }

        // ------------------------------------------------------------------
        // Polling — throttled, single-in-flight, off the data thread
        // ------------------------------------------------------------------
        private void MaybeFetch()
        {
            // Floor of 30s, enforced here and not only by the Range attribute.
            // The attribute stops someone TYPING a smaller number; this stops a
            // workspace that already has one. A tester was found polling every
            // 10s, which is six requests for bytes that only change once a
            // minute — identical data, six times the rate-limit burn. 30 is
            // still a real choice: the analytics cycle is ~60s and unaligned,
            // so polling at 30 halves the worst-case staleness rather than
            // eliminating it. Below that there is nothing left to win.
            int poll = Math.Max(30, PollSeconds);
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
        // Rendering
        //
        // Everything except the info panel is drawn in OnRender, in device
        // pixels, rather than through the high-level Draw API.
        //
        // The Draw API anchors everything to bars. That is the right model for
        // a trendline and the wrong one for a level. Three separate reports,
        // from two testers, were all this one decision: labels pinned to the
        // last bar slid off screen the moment a trader scrolled back to study
        // a level that had held, leaving unlabelled lines and, in his words,
        // "I don't know what I am seeing"; the histogram was anchored the same
        // way and crawled leftward as bars formed, when a profile is supposed
        // to sit still; and there was no way to move a label off the price
        // action, because a bar anchor has only bars to move between and every
        // one of them has candles on it.
        //
        // OnRender has no bars in it. The chart hands us a panel and a price
        // scale, we convert prices to pixels ourselves, and anything placed
        // relative to a panel edge stays where it was put -- through scrolling,
        // through zooming, and through a rewind to last Tuesday. One change
        // answers all three reports, which is why this is a rewrite of the
        // drawing layer rather than three patches on top of the old one.
        //
        // Thread note: OnRender runs on the UI thread, OnBarUpdate on the data
        // thread. The only state crossing between them is _snapshot, which is
        // volatile and replaced wholesale rather than mutated, so a frame sees
        // either the old snapshot or the new one and never a half-built one.
        // The render model derived from it is built and read only here.
        // ------------------------------------------------------------------

        /// <summary>One horizontal level, reduced to what a frame needs.
        ///
        /// Label rather than a finished string because several levels routinely
        /// land on one strike and their names get joined — see AddLevel.</summary>
        private class RenderLevel
        {
            public double Price;
            public string Label;
            public Brush Stroke;
            public bool Dashed;
        }

        private readonly List<RenderLevel> _levels = new List<RenderLevel>();

        // Per-frame scratch for label de-collision, held as fields so a repaint
        // allocates nothing.
        private readonly List<int> _labelOrder = new List<int>();
        private readonly List<float> _labelY = new List<float>();

        /// <summary>Vertical space one label occupies, in pixels.</summary>
        private const float LabelLineHeight = 15f;
        private ZeroGexLevelsSnapshot _levelsBuiltFrom;
        private int _levelsBuiltCount = -1;

        /// <summary>Per-frame cache of Direct2D brushes.
        ///
        /// A Direct2D brush belongs to the render target and has to be built
        /// from the WPF one and then disposed. Doing that per shape is forty
        /// creates and disposes a frame with the histogram on, at whatever rate
        /// the chart repaints. There are only ever nine distinct colours, so
        /// they are converted once and dropped together at the end of the
        /// frame.</summary>
        private sealed class BrushCache : IDisposable
        {
            private readonly SharpDX.Direct2D1.RenderTarget _target;
            private readonly Dictionary<Brush, SharpDX.Direct2D1.Brush> _map =
                new Dictionary<Brush, SharpDX.Direct2D1.Brush>();

            public BrushCache(SharpDX.Direct2D1.RenderTarget target)
            {
                _target = target;
            }

            public SharpDX.Direct2D1.Brush Get(Brush wpf)
            {
                if (wpf == null)
                    return null;

                SharpDX.Direct2D1.Brush dx;
                if (_map.TryGetValue(wpf, out dx))
                    return dx;

                dx = wpf.ToDxBrush(_target);
                _map[wpf] = dx;
                return dx;
            }

            public void Dispose()
            {
                foreach (var dx in _map.Values)
                {
                    if (dx != null)
                        dx.Dispose();
                }

                _map.Clear();
            }
        }

        protected override void OnRender(ChartControl chartControl, ChartScale chartScale)
        {
            base.OnRender(chartControl, chartScale);

            if (RenderTarget == null || chartControl == null || chartScale == null || ChartPanel == null)
                return;

            var s = _snapshot;
            if (s == null)
                return;

            // A render exception is not a quiet failure: NinjaTrader calls this
            // every frame and would keep throwing every frame. Trap it, say so
            // in the panel, and leave the chart usable.
            try
            {
                BuildLevels(s);

                using (var brushes = new BrushCache(RenderTarget))
                using (var font = new SharpDX.DirectWrite.TextFormat(
                           NinjaTrader.Core.Globals.DirectWriteFactory, "Arial", 12f))
                {
                    // Labels are right-aligned into the margin, so the text ends
                    // at a fixed distance from the right edge however long it is.
                    font.TextAlignment = SharpDX.DirectWrite.TextAlignment.Trailing;

                    RenderProfile(s, chartScale, brushes);
                    RenderLevels(chartScale, font, brushes);
                }
            }
            catch (Exception ex)
            {
                _status = "render failed: " + ex.Message;
            }
        }

        /// <summary>Resolve a snapshot into the flat list a frame walks.
        ///
        /// Rebuilt only when the snapshot or the requested rank count changes.
        /// Ranking is a selection pass over up to 200 strikes and the chart can
        /// repaint many times a second, so it does not belong in the frame.</summary>
        private void BuildLevels(ZeroGexLevelsSnapshot s)
        {
            int want = ShowGexRanks ? Math.Max(1, GexRankCount) : 0;
            if (ReferenceEquals(_levelsBuiltFrom, s) && _levelsBuiltCount == want)
                return;

            _levels.Clear();

            AddLevel(ShowGammaFlip, s.GammaFlip, "Gamma Flip", FlipBrush, false);
            AddLevel(ShowCallWall, s.CallWall, "Call Wall", CallBrush, false);
            AddLevel(ShowPutWall, s.PutWall, "Put Wall", PutBrush, false);
            AddLevel(ShowMaxPain, s.MaxPain, "Max Pain", PainBrush, false);
            AddLevel(ShowPinStrike, s.PinStrike, "Pin Strike", PinBrush, false);
            AddLevel(ShowVwap, s.Vwap, "VWAP", VwapBrush, false);

            // GEX 1..N: the strikes carrying the most dealer gamma, ranked on
            // ABSOLUTE net gamma so a heavy put strike ranks alongside a heavy
            // call strike -- the question is "where is the most dealer gamma",
            // not "where is the most positive gamma". Costs no extra request:
            // the profile the histogram uses already holds every strike.
            // The two profile columns are parsed independently, so they are
            // walked to the shorter of the two rather than trusting them to
            // agree. A ragged payload should cost a missing rank, not an
            // IndexOutOfRange thrown once per frame inside the renderer.
            int strikes = (s.ProfileStrike == null || s.ProfileNetGex == null)
                ? 0
                : Math.Min(s.ProfileStrike.Count, s.ProfileNetGex.Count);

            if (want > 0 && strikes > 0)
            {
                int take = Math.Min(want, strikes);
                bool[] taken = new bool[strikes];

                for (int rank = 0; rank < take; rank++)
                {
                    int best = -1;
                    double bestMagnitude = 0;

                    for (int i = 0; i < strikes; i++)
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
                    AddLevel(true, s.ProfileStrike[best], "GEX " + (rank + 1), GexRankBrush, true);
                }
            }

            _levelsBuiltFrom = s;
            _levelsBuiltCount = want;
        }

        /// <summary>Add a level, or fold it into one already at that price.
        ///
        /// On ES the strikes are five points apart and the metrics collide
        /// constantly: a tester's chart had Put Wall, Max Pain and GEX 2 all on
        /// 7711.75, printing "Ma8GEX:2 7711.75" — three labels in the same
        /// pixel row, none of them readable. Drawing three lines there was just
        /// as pointless, since only the last one is visible.
        ///
        /// Folding them makes the chart say something truer than any of the
        /// three did alone: not "there is a level here" but "three different
        /// measures of dealer positioning agree on this strike". The headline
        /// walls are added before the ranked strikes, so the merged entry keeps
        /// the wall's colour, and stays solid unless every part of it is
        /// dashed.</summary>
        private void AddLevel(bool show, double? value, string label, Brush stroke, bool dashed)
        {
            if (!show || value == null || value.Value == 0)
                return;

            double price = value.Value;

            for (int i = 0; i < _levels.Count; i++)
            {
                if (_levels[i].Price != price)
                    continue;

                _levels[i].Label = _levels[i].Label + " · " + label;
                _levels[i].Dashed = _levels[i].Dashed && dashed;
                return;
            }

            _levels.Add(new RenderLevel
            {
                Price = price,
                Label = label,
                Stroke = stroke,
                Dashed = dashed
            });
        }

        private void RenderLevels(ChartScale chartScale, SharpDX.DirectWrite.TextFormat font, BrushCache brushes)
        {
            float left = ChartPanel.X;
            float right = ChartPanel.X + ChartPanel.W;
            float top = ChartPanel.Y;
            float bottom = ChartPanel.Y + ChartPanel.H;

            float width = Math.Max(1, LineWidth);
            float inset = Math.Max(0, LabelRightOffsetPixels);
            double lift = Math.Max(0, LabelOffsetTicks) * TickSize;

            _labelOrder.Clear();
            _labelY.Clear();

            for (int i = 0; i < _levels.Count; i++)
            {
                RenderLevel level = _levels[i];
                float y = (float)chartScale.GetYByValue(level.Price);

                // Outside the visible price range. Skipped rather than clamped:
                // a label pinned to the panel edge would assert a level is
                // somewhere it is not.
                if (y < top || y > bottom)
                    continue;

                SharpDX.Direct2D1.Brush stroke = brushes.Get(level.Stroke);
                if (stroke == null)
                    continue;

                if (level.Dashed)
                    DrawDashed(left, right, y, stroke, width);
                else
                    RenderTarget.DrawLine(new SharpDX.Vector2(left, y),
                                          new SharpDX.Vector2(right, y), stroke, width);

                if (!ShowLabels)
                    continue;

                // Collected rather than drawn, because where a label can sit
                // depends on the labels above it. Insertion-sorted by y on the
                // way in: at most a dozen levels, so this is cheaper and
                // simpler than sorting afterwards.
                float labelY = (float)chartScale.GetYByValue(level.Price + lift);
                int at = _labelY.Count;
                while (at > 0 && _labelY[at - 1] > labelY)
                    at--;

                _labelY.Insert(at, labelY);
                _labelOrder.Insert(at, i);
            }

            if (!ShowLabels)
                return;

            // Push each label below the one above it where they would overlap.
            //
            // Folding equal prices in AddLevel handles the common collision,
            // but levels a tick or two apart still land in the same pixel row:
            // Pin Strike at 7741.75 and VWAP at 7741.5 printed as one smear on
            // a tester's chart. Different prices genuinely need different
            // labels, so they are stacked rather than merged, in price order,
            // and each still carries its own number.
            //
            // Downward only, so the topmost label of a cluster stays on its own
            // line and the drift is predictable rather than centred and moving.
            float prevBottom = float.NegativeInfinity;

            for (int k = 0; k < _labelOrder.Count; k++)
            {
                float labelY = _labelY[k];
                if (labelY - LabelLineHeight < prevBottom)
                    labelY = prevBottom + LabelLineHeight;

                prevBottom = labelY;

                RenderLevel level = _levels[_labelOrder[k]];
                SharpDX.Direct2D1.Brush stroke = brushes.Get(level.Stroke);
                if (stroke == null)
                    continue;

                string text = level.Label + "  " +
                              level.Price.ToString("0.##", CultureInfo.InvariantCulture);
                float boxWidth = Math.Max(1f, (right - inset) - left);
                RenderTarget.DrawText(text, font,
                                      new SharpDX.RectangleF(left, labelY - LabelLineHeight,
                                                             boxWidth, LabelLineHeight - 1f),
                                      stroke);
            }
        }

        /// <summary>A dashed horizontal line, drawn as segments.
        ///
        /// Direct2D dashing needs a StrokeStyle built from a properties struct
        /// whose defaults are not all valid, and this file cannot be compiled
        /// here to find out which. Segments use nothing but DrawLine, which the
        /// solid levels have already proven on the same render target.</summary>
        private void DrawDashed(float x0, float x1, float y, SharpDX.Direct2D1.Brush brush, float width)
        {
            const float dash = 6f;
            const float gap = 6f;

            for (float x = x0; x < x1; x += dash + gap)
            {
                float end = Math.Min(x + dash, x1);
                RenderTarget.DrawLine(new SharpDX.Vector2(x, y), new SharpDX.Vector2(end, y), brush, width);
            }
        }

        /// <summary>Per-strike net-gamma histogram, pinned to the left edge.
        ///
        /// It used to run leftward from the last bar, so it crept across the
        /// chart as bars formed. A profile is a picture of where gamma sits in
        /// price, not an event at a moment in time, so it belongs in a fixed
        /// column -- the same way a volume profile does. Left rather than right
        /// because the labels now own the right margin.</summary>
        private void RenderProfile(ZeroGexLevelsSnapshot s, ChartScale chartScale, BrushCache brushes)
        {
            if (!ShowStrikeProfile || s.ProfileStrike == null || s.ProfileNetGex == null)
                return;

            // Shorter of the two columns, for the same reason as BuildLevels.
            int strikes = Math.Min(s.ProfileStrike.Count, s.ProfileNetGex.Count);
            if (strikes == 0)
                return;

            double maxAbs = 0;
            for (int i = 0; i < strikes; i++)
            {
                double magnitude = Math.Abs(s.ProfileNetGex[i]);
                if (magnitude > maxAbs)
                    maxAbs = magnitude;
            }

            if (maxAbs <= 0)
                return;

            float left = ChartPanel.X;
            float top = ChartPanel.Y;
            float bottom = ChartPanel.Y + ChartPanel.H;

            // ProfileWidthBars is a percentage of panel width now that the
            // histogram no longer measures itself in bars. The IDENTIFIER keeps
            // its old name deliberately: NinjaTrader stores a setting under the
            // property name, so renaming it would silently reset the value in
            // every workspace that already holds one. Only the label changed.
            float span = ChartPanel.W * Math.Min(100, Math.Max(1, ProfileWidthBars)) / 100f;
            float thickness = Math.Max(1, ProfileBarWidth);

            for (int i = 0; i < strikes; i++)
            {
                float y = (float)chartScale.GetYByValue(s.ProfileStrike[i]);
                if (y < top || y > bottom)
                    continue;

                double netGex = s.ProfileNetGex[i];
                float length = (float)(span * Math.Abs(netGex) / maxAbs);
                if (length < 1f)
                    length = 1f;

                SharpDX.Direct2D1.Brush fill = brushes.Get(netGex >= 0 ? ProfilePosBrush : ProfileNegBrush);
                if (fill == null)
                    continue;

                RenderTarget.FillRectangle(
                    new SharpDX.RectangleF(left, y - thickness / 2f, length, thickness), fill);
            }
        }

        private void DrawInfoPanel(ZeroGexLevelsSnapshot s)
        {
            if (ShowInfoPanel)
                Draw.TextFixed(this, "ZG_Info", BuildInfoText(s), TextPosition.TopRight);
            else
                RemoveDrawObject("ZG_Info");
        }

        /// <summary>Shown in the info panel so a screenshot identifies its own
        /// build. Two beta testers now compile this by hand from files sent by
        /// email, on their own schedules, which means at any moment they are on
        /// different versions and neither they nor we can tell which. A bug
        /// report against an unknown build costs a round trip to establish what
        /// is even being reported. Bump this on every file sent to a tester.</summary>
        private const string BuildVersion = "v1.6";

        private string BuildInfoText(ZeroGexLevelsSnapshot s)
        {
            if (s == null)
                return "ZeroGEX Gamma Levels " + BuildVersion + "\n" + _status;

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
                   "updated " + age + "  ·  zerogex.io " + BuildVersion + health;
        }

        /// <summary>Where a level's label sits, relative to its line. Ticks
        /// rather than points so one setting behaves the same on ES, NQ and
        /// SPX, whose tick sizes differ by an order of magnitude.</summary>
        private double LabelY(double price)
        {
            return price + Math.Max(0, LabelOffsetTicks) * TickSize;
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

        // Range DELIBERATELY stays wider than the interval we actually honour.
        //
        // NinjaTrader validates a persisted workspace value against this
        // attribute at LOAD time, and a value outside it is a hard modal error
        // that stops the indicator loading on that chart. Raising this floor
        // from 5 to 30 therefore broke every existing workspace holding a
        // smaller number — a user with six charts got six error dialogs and
        // lost the indicator on the chart he trades, having changed nothing.
        //
        // The rule this bug bought: a Range on a persisted property may only
        // ever WIDEN. It exists to catch typing, not to enforce policy. Policy
        // is the runtime clamp in MaybeFetch, which floors this at 30s and,
        // unlike an attribute, fixes an existing workspace instead of rejecting
        // it. Lower this bound freely; never raise it.
        [NinjaScriptProperty]
        [Range(1, 3600)]
        [Display(Name = "Poll interval (seconds — 30s minimum is applied)", Order = 4, GroupName = "1. Connection")]
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
        [Display(Name = "Histogram width (% of chart width)", Order = 11, GroupName = "2. Levels")]
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
        [Range(0, 100)]
        [Display(Name = "Label offset above line (ticks)", Order = 3, GroupName = "3. Style")]
        public int LabelOffsetTicks { get; set; }

        // Distance from the RIGHT EDGE OF THE WINDOW, not from a bar. This is
        // the setting the rewrite exists to make possible: a trader asked to
        // "scoot the numbers over so I can clearly see the bar action" and the
        // honest answer under the old drawing model was that he could not,
        // because a label anchored to a bar can only be moved to another bar
        // and every one of them has candles on it. Range is generous rather
        // than tuned: panels vary from a laptop half-screen to a 4K quadrant,
        // and a value too large for the panel is clamped at render time.
        [NinjaScriptProperty]
        [Range(0, 2000)]
        [Display(Name = "Label distance from right edge (pixels)", Order = 4, GroupName = "3. Style")]
        public int LabelRightOffsetPixels { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Show info panel", Order = 5, GroupName = "3. Style")]
        public bool ShowInfoPanel { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Enable cross alerts", Order = 6, GroupName = "3. Style")]
        public bool EnableAlerts { get; set; }

        [XmlIgnore]
        [Display(Name = "Gamma Flip color", Order = 7, GroupName = "3. Style")]
        public Brush FlipBrush { get; set; }

        [Browsable(false)]
        public string FlipBrushSerialize
        {
            get { return Serialize.BrushToString(FlipBrush); }
            set { FlipBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Call Wall color", Order = 8, GroupName = "3. Style")]
        public Brush CallBrush { get; set; }

        [Browsable(false)]
        public string CallBrushSerialize
        {
            get { return Serialize.BrushToString(CallBrush); }
            set { CallBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Put Wall color", Order = 9, GroupName = "3. Style")]
        public Brush PutBrush { get; set; }

        [Browsable(false)]
        public string PutBrushSerialize
        {
            get { return Serialize.BrushToString(PutBrush); }
            set { PutBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Max Pain color", Order = 10, GroupName = "3. Style")]
        public Brush PainBrush { get; set; }

        [Browsable(false)]
        public string PainBrushSerialize
        {
            get { return Serialize.BrushToString(PainBrush); }
            set { PainBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Pin Strike color", Order = 11, GroupName = "3. Style")]
        public Brush PinBrush { get; set; }

        [Browsable(false)]
        public string PinBrushSerialize
        {
            get { return Serialize.BrushToString(PinBrush); }
            set { PinBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "GEX 1..N color", Order = 12, GroupName = "3. Style")]
        public Brush GexRankBrush { get; set; }

        [Browsable(false)]
        public string GexRankBrushSerialize
        {
            get { return Serialize.BrushToString(GexRankBrush); }
            set { GexRankBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "VWAP color", Order = 13, GroupName = "3. Style")]
        public Brush VwapBrush { get; set; }

        [Browsable(false)]
        public string VwapBrushSerialize
        {
            get { return Serialize.BrushToString(VwapBrush); }
            set { VwapBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Histogram color (net positive)", Order = 14, GroupName = "3. Style")]
        public Brush ProfilePosBrush { get; set; }

        [Browsable(false)]
        public string ProfilePosBrushSerialize
        {
            get { return Serialize.BrushToString(ProfilePosBrush); }
            set { ProfilePosBrush = Serialize.StringToBrush(value); }
        }

        [XmlIgnore]
        [Display(Name = "Histogram color (net negative)", Order = 15, GroupName = "3. Style")]
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
