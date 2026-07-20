import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    backToHelp: 'Back to Help Center',
    faqsBadge: 'FAQs',
    heading: 'Frequently Asked Questions',
    description:
      'Plain-English answers to the questions traders ask most often. Use the search box to jump straight to a question, or browse by category.',
    searchPlaceholder: 'Search FAQs...',
    noMatch: 'No FAQs match your search.',
    tryDifferent: 'Try a different query, or',
    emailSupport: 'email support',
    didntFind: "Didn't find your answer?",
    realQuestions: "Real questions don't always fit a category. Email",
    usuallyAnswer: '— we usually answer the same trading day.',

    gettingStartedTitle: 'Getting Started',
    gettingStartedBlurb: 'New to ZeroGEX? Start here.',
    whatIsZerogexQ: 'What is ZeroGEX?',
    whatIsZerogexA:
      'ZeroGEX is a real-time options analytics platform built around dealer positioning. It shows you where dealers are long or short gamma, where the gamma flip sits, where the call and put walls are, and runs a suite of real-time signals on top of all of it. The point is to give you the same lens market makers use to hedge — so you can read intraday price action in those terms.',
    whoItsForQ: 'Who is ZeroGEX built for?',
    whoItsForA:
      'Active intraday traders who trade SPY, SPX, or QQQ and want a structural read of the options market. Day traders, swing traders with intraday timing, quants who want signal data via API, and option-selling strategists for whom dealer positioning is the daily input. We are not a single-name equity research tool.',
    doINeedToSignUpQ: 'Do I need to sign up to use ZeroGEX?',
    doINeedToSignUpA:
      'The free Gamma Levels pages — SPX, SPY, and QQQ — are open to anyone with no account: the gamma flip, call and put walls, max pain, and dealer gamma profile, delayed about 15 minutes. The marketing site, Education Hub, articles, and guides are open too. The full real-time Dashboard, signals, metrics, strategy tools, and Live Bulletin require a paid plan (Basic or Pro). See the Pricing page for the live tier breakdown.',
    freeTrialQ: 'Is there a free trial?',
    freeTrialA:
      'Yes. Both Basic and Pro come with a free trial. The trial length is shown on the Pricing page. At the end of the trial, the subscription continues automatically at the rate you signed up at. Cancel before the trial ends to avoid being charged.',
    firstPageQ: 'What page should I open first?',
    firstPageA:
      "The Dashboard. It surfaces the regime label, net GEX, the gamma flip, the walls, max pain, the composite score, and the day's trade-bias chip — everything you need to orient. From there, drill into the signal page that matches what you're looking for.",

    dataRefreshTitle: 'Data &amp; Refresh',
    dataRefreshBlurb: 'Coverage, cadence, and how the streaming works.',
    symbolsQ: 'What symbols are currently supported?',
    symbolsA:
      'ZeroGEX provides full analytics coverage for SPY (S&P 500 ETF), SPX (S&P 500 Index), and QQQ (Nasdaq 100 ETF). These are the three most liquid, most gamma-rich underlyings in the U.S. options market — the instruments where dealer hedging activity has the greatest intraday impact.',
    singleNamesQ: 'Will you add single-name equities (AAPL, TSLA, NVDA, etc.)?',
    singleNamesA:
      'Not on the roadmap. The dealer-positioning model works best in instruments where institutional options flow dominates the underlying — that is the index complex. Single names have idiosyncratic-news noise that makes the GEX read less reliable.',
    futuresQ: 'Can I use ZeroGEX to trade futures like ES, MES, NQ, or MNQ?',
    futuresA:
      'Yes — you map the future to its index book. /ES and /MES trade off the SPX (and SPY) gamma levels; /NQ and /MNQ off QQQ today, with NDX coming. The structural levels are identical; only the price scale differs. When the cash index is closed, the Live Bulletin already shows the ES/NQ futures-implied price for context. Translating the levels directly into futures prices is on the roadmap.',
    refreshCadenceQ: 'How often does the data refresh?',
    refreshCadenceA:
      'Quotes and flow refresh every ~1 second during regular hours. Signal scores refresh every 1–5 seconds depending on the signal. The GEX surface refreshes every 5–15 seconds (the chain snapshot is the bottleneck). Everything streams — you do not need to reload the page.',
    preMarketQ: 'Does ZeroGEX show pre-market and after-hours data?',
    preMarketA:
      'Yes. The price tile shows extended-hours quotes alongside the prior regular-session close for context. Some signals (EOD Pressure, 0DTE Position Imbalance) only compute during the regular session by design.',
    dataSourceQ: 'Where does the data come from?',
    dataSourceA:
      "ZeroGEX uses OPRA-feed options data (the consolidated U.S. options tape) plus the underlying equity quote feed. Both are professional, institutional-grade real-time data sources. We don't disclose specific vendor names publicly.",
    historyDepthQ: 'How far back does historical data go?',
    historyDepthA:
      'Quotes and flow have several years of historical bars. Signal scores are backfilled to the inception of each signal. GEX surfaces have daily snapshot history; intraday GEX history is shorter. The Backtesting page surfaces the available range for whatever signal you select.',

    signalsCatTitle: 'Signals',
    signalsCatBlurb: 'How scores work, what triggers mean, and how to use them.',
    howManySignalsQ: 'How many signals does ZeroGEX run?',
    howManySignalsA:
      'Fourteen total — eight Advanced (event-driven, with discrete triggers) and six Basic (continuous, feeding the composite). See the Signals: Explained guide for the full reference matrix.',
    advancedVsBasicQ: 'What is the difference between Advanced and Basic signals?',
    advancedVsBasicA:
      'Advanced signals ask a sharp situational question and fire a discrete trigger when their score crosses a threshold. Basic signals are continuous reads that feed the composite score with a fixed weight. Advanced signals trigger; Basic signals weight.',
    scoreZeroQ: 'What does a signal score of 0 mean?',
    scoreZeroA:
      'Almost never "neutral market". For most signals it means the data is insufficient or this specific question has no answer right now. Read a 0 as "no read", not "no trade". A truly neutral market typically shows scores meandering around ±0.1, not a clean zero.',
    compositeScoreQ: 'What is the Composite Score?',
    compositeScoreA:
      'The Composite Score (internally MSI) is the blended read across all signals on the active symbol. It lives on the same [-1, +1] line as every individual signal. Positive ⇒ structural bullish lean; negative ⇒ bearish. Magnitude is conviction. Use it as a filter, not a forecast.',
    signalAlertsQ: 'Do I get alerts when signals fire?',
    signalAlertsA:
      'In-app, yes. Every trigger lands in the Live Bulletin and lights the corresponding signal card. ZeroGEX does not currently send signal alerts by SMS, push, or email — the in-app log is the system of record. We may add more channels if there is demand.',
    signalAccuracyQ: 'How accurate are the signals?',
    signalAccuracyA:
      'It depends on the signal, the regime, and how you use it. Signals are not standalone trade tickets — they are filters and triggers inside a process. The Backtesting page lets you replay any signal against historical data with your own rules. We strongly recommend out-of-sample validation before deploying any rule.',

    tiersBillingTitle: 'Tiers &amp; Billing',
    tiersBillingBlurb: 'Plans, pricing, refunds, and managing your subscription.',
    tiersQ: 'What are the tier differences?',
    tiersA:
      'Public is the free, browse-only experience (marketing site + education). Basic unlocks the Dashboard, Live Bulletin, all Metrics, Strategy Tools, and all Basic Signals. Pro adds all Advanced Signals, the Composite Score, Backtesting, and API access. The Pricing page has the live breakdown.',
    monthlyVsAnnualQ: 'Should I pay monthly or annual?',
    monthlyVsAnnualA:
      'Annual is meaningfully discounted versus monthly — the exact rate is on the Pricing page. Most active users switch to annual after a couple of months. You can switch in the Stripe billing portal at any time; proration handles the math.',
    switchPlanQ: 'How do I switch my plan (tier or monthly/annual)?',
    switchPlanA:
      'Open the Account page and click "Manage subscription" to open the Stripe billing portal — you can move between Basic and Pro and between monthly and annual right there. Upgrades (and monthly → annual) take effect immediately; downgrades and annual → monthly take effect at the end of your current period, so you keep what you paid for until then. Proration is applied and shows up on your next invoice, not as an upfront charge. If you’re still in your free trial, switching keeps the trial — you won’t be charged until it ends, and then you’re billed the new plan’s rate.',
    tierUpgradeQ: 'How do I upgrade from Basic to Pro?',
    tierUpgradeA:
      'Open the Account page, click "Manage subscription" to open the Stripe billing portal, and switch tiers there. Tier access updates immediately; the prorated difference is applied to your next invoice.',
    cancellationQ: 'How do I cancel?',
    cancellationA:
      'Through the Stripe billing portal, accessed from the Account page. Cancellation takes effect at the end of the current billing period — you keep paid access until then. After that, your tier reverts to Public; your account is not deleted.',
    refundsQ: 'Do you offer refunds?',
    refundsA:
      'The trial is unconditional — cancel before it ends and you are never charged. Paid subscriptions are billed in advance and not pro-rated on cancellation by default. For exceptions and edge cases, email support@zerogex.io and we will work it out.',
    billingIssueQ: 'My payment failed. What now?',
    billingIssueA:
      'Stripe retries automatically over several days. During the retry window, your subscription is "past due" and paid features stay available. Update the payment method in the portal to resolve. The most common failures are expired cards and address-verification mismatches.',
    referralsQ: 'How does the referral program work?',
    referralsA:
      'If enabled for your account, the Account page shows a Referrals panel with your code, link, and standings. Anyone who signs up using your code and converts to a paid plan earns you a credit on your next bill. Credits stack across referrals and apply automatically.',

    platformUsageTitle: 'Using the Platform',
    platformUsageBlurb: 'Practical questions on the daily workflow.',
    dashboardWorkflowQ: 'What is the right workflow for using ZeroGEX during a trading day?',
    dashboardWorkflowA:
      "Start simple. On the Dashboard, read the three levels that matter most first: the Gamma Flip (stabilizing vs. amplifying regime), then the Call Wall and Put Wall (your likely upside and downside friction). Pull up the GEX Strike Profile to see how that structure sits on price, then confirm with your own price action — VWAP, the opening-range break, whatever you already trust. Keep the Live Bulletin open in a second tab for trigger events. The levels tell you where to pay attention; your execution triggers tell you when. Don't try to watch all fourteen signals at once on day one.",
    multipleSymbolsQ: 'Can I view multiple symbols at once?',
    multipleSymbolsA:
      'Each browser tab can show one symbol. To view SPY, SPX, and QQQ side-by-side, open three tabs. The symbol picker is in the header.',
    mobileSupportQ: 'Does ZeroGEX work on mobile?',
    mobileSupportA:
      'Yes — every page is responsive. But the platform is built for desktop. The chart density assumes a wide screen. On mobile, the dashboard works for monitoring; complex multi-chart pages are denser than is ideal.',
    browserCompatQ: 'Which browsers are supported?',
    browserCompatA:
      'Evergreen Chrome, Edge, Firefox, and Safari. Older versions will technically work but will not get the performance optimizations. Aggressive ad blockers and script blockers sometimes break the streaming connection — allowlist zerogex.io if needed.',
    pageStaleQ: 'A page looks stale or frozen. What do I do?',
    pageStaleA:
      'Check the connection chip in the header. If it stays red across reloads, hard reload (Cmd+Shift+R / Ctrl+Shift+R). If still stuck, try an incognito window. If still stuck, email support with the page URL, your browser, and the timestamp.',
    optionsCalculatorQ: 'How does the Strategy Builder work?',
    optionsCalculatorA:
      'The Strategy Builder lets you construct any single- or multi-leg options strategy, prices it live with Black-Scholes against the active IV surface, and shows you the greeks plus a P&L scenario surface. It is a research tool, not a broker — you take the structure and put it on yourself.',

    accountTitle: 'Account &amp; Sign-in',
    accountBlurb: 'Authentication, passwords, and identity providers.',
    forgotPasswordQ: 'I forgot my password.',
    forgotPasswordA:
      'Use the Forgot Password page. A reset link is emailed; click it and set a new password. If the email does not arrive, check spam. If you signed up with Google or Apple, you do not have a password — sign in with the provider instead.',
    changeEmailQ: 'Can I change the email on my account?',
    changeEmailA:
      'The email is the account ID and cannot be changed in-app. To change it, email support@zerogex.io with verification of both the old and new addresses.',
    googleAppleQ: 'Can I sign in with Google or Apple?',
    googleAppleA:
      'Yes. Both Google and Apple sign-in are supported. You can link multiple providers to the same account from the Account page. If you want a password as a fallback, set one from the Account page too.',
    twoFactorQ: 'Does ZeroGEX support two-factor authentication?',
    twoFactorA:
      "For Google and Apple sign-ins, you use the provider's 2FA. For password sign-in, 2FA on the ZeroGEX account itself is not currently supported — using Google or Apple is the recommended path for elevated security.",
    emailVerificationQ: 'I never got the email-verification message.',
    emailVerificationA:
      'Check spam first. Click "Resend verification" on the in-app banner. If multiple resends do not arrive, the address may be misspelled or your mail server is rejecting our domain — email support@zerogex.io from the address in question.',
    deleteAccountQ: 'How do I delete my account?',
    deleteAccountA:
      'Email support@zerogex.io. Account deletion cancels any active subscription and removes account data per the Privacy policy. We confirm by email before processing.',

    apiTitle: 'API &amp; Developer',
    apiBlurb: 'For when you want the data programmatically.',
    apiPublicQ: 'Is the API publicly accessible?',
    apiPublicA:
      'The API documentation is at api.zerogex.io/docs and requires a Pro account. API access — including key generation and usage — is a Pro-tier feature. Public and Basic users do not have programmatic access.',
    apiDocsFormatQ: 'What format are the API docs in?',
    apiDocsFormatA:
      'OpenAPI 3.0. Both Swagger UI (interactive) and ReDoc (read-only) views are available. Responses are JSON.',
    apiRateLimitsQ: 'What are the API rate limits?',
    apiRateLimitsA:
      'Pro accounts get generous per-minute and per-day caps, sufficient for production dashboards and bots that respect normal request hygiene. Over-limit responses return 429 with a Retry-After header.',
    apiKeysQ: "I'm on Pro — how do I get my API key?",
    apiKeysA:
      "API access is a Pro feature. Self-serve key generation from your Account page is on the way; until it ships, keys are issued by hand — email support@zerogex.io from your account address and we'll send you a key plus setup notes. Use it as <code>Authorization: Bearer &lt;key&gt;</code> on every request. Email us to rotate or revoke a key.",
    apiStreamingQ: 'Is there a streaming endpoint or websocket?',
    apiStreamingA:
      'Not currently exposed publicly. The web platform uses an internal channel. For most use cases, polling at a sane cadence (every few seconds for live metrics) is sufficient.',

    methodologyTitle: 'Methodology',
    methodologyBlurb: 'How the numbers are actually computed.',
    whatIsGexQ: 'What is Gamma Exposure (GEX) and why does it matter?',
    whatIsGexA:
      "GEX is the aggregate sensitivity of options dealers' delta hedges to price moves in the underlying. When dealers are long gamma (positive net GEX at spot), they sell rallies and buy dips — a dampening effect on volatility. When they're short gamma, they chase price — an amplifying effect. Knowing the GEX regime tells you whether the market is likely to mean-revert or trend.",
    gammaFlipQ: 'How is the Gamma Flip level calculated?',
    gammaFlipA:
      'The flip is the level at which the dealer gamma curve crosses zero — calculated from a spot-shift dealer gamma profile, not a cumulative-net-GEX approximation. Above the flip, dealer hedging is stabilizing; below it, amplifying. See the Gamma Flip Calculation guide for the full methodology.',
    wallsExplainedQ: 'What are the call wall and put wall?',
    wallsExplainedA:
      'The strikes with the largest call gamma and put gamma respectively. They tend to act as intraday resistance and support, especially in positive gamma. The walls migrate intraday as flow comes in — watching the migration is informative on its own.',
    maxPainReliabilityQ: 'What is Max Pain, and how reliable is it?',
    maxPainReliabilityA:
      'Max pain is the strike that minimizes total option-buyer payout at expiration. It is most reliable in the final 24–48 hours before a meaningful expiry, especially for 0DTE on SPX. The honest read is that the "gamma magnet" — the wall structure — usually drives the pin, not the buyer-payout argument by itself. See the Max Pain article for the deep dive.',
    flowExplainedQ: 'What is "premium-weighted" flow?',
    flowExplainedA:
      'Premium-weighted flow multiplies contract volume by premium paid. It is the conviction read — a trader paying $500/contract is making a real bet; a trader scalping $0.05 lotto tickets is not. Raw volume treats them the same; premium-weighted flow does not.',
    pricingModelQ: 'What pricing model does the Strategy Builder use?',
    pricingModelA:
      'Black-Scholes with the live implied volatility surface. For SPX (European exercise) no adjustment is applied. For SPY and QQQ (American exercise) we add an early-exercise premium on deep-ITM legs near expiry.',

    supportTitle: 'Support &amp; Contact',
    supportBlurb: 'How to reach us when you need a human.',
    howToContactQ: 'How do I get help?',
    howToContactA:
      'Email support@zerogex.io. We answer fast — usually the same trading day. Include the page URL you were on, a screenshot if relevant, your browser and OS, and (for billing) your account email.',
    featureRequestsQ: 'Do you take feature requests?',
    featureRequestsA:
      'Yes. Email support@zerogex.io with the request and how you would use it. We prioritize against the existing roadmap.',
    bugReportsQ: 'I think I found a bug.',
    bugReportsA:
      'Email support@zerogex.io with the page, the steps to reproduce, the expected vs actual behavior, browser, OS, and an approximate timestamp. The more specific the report, the faster we can chase it.',
    phishingQ: 'I got a suspicious email claiming to be from ZeroGEX.',
    phishingA:
      'We send from zerogex.io and noreply@zerogex.io (and occasionally support@zerogex.io). We will never ask for your password or session token by email. If something looks off, forward it to support@zerogex.io and we will confirm or flag.',
  },
  it: {
    backToHelp: 'Torna al Centro assistenza',
    faqsBadge: 'FAQ',
    heading: 'Domande frequenti',
    description:
      'Risposte in linguaggio semplice alle domande più frequenti dei trader. Usa la casella di ricerca per andare direttamente a una domanda, oppure sfoglia per categoria.',
    searchPlaceholder: 'Cerca nelle FAQ...',
    noMatch: 'Nessuna FAQ corrisponde alla tua ricerca.',
    tryDifferent: 'Prova una ricerca diversa, oppure',
    emailSupport: 'scrivi al supporto',
    didntFind: 'Non hai trovato la tua risposta?',
    realQuestions: 'Le domande reali non sempre rientrano in una categoria. Scrivi a',
    usuallyAnswer: '— di solito rispondiamo lo stesso giorno di trading.',

    gettingStartedTitle: 'Per iniziare',
    gettingStartedBlurb: 'Nuovo su ZeroGEX? Inizia qui.',
    whatIsZerogexQ: 'Cos\'è ZeroGEX?',
    whatIsZerogexA:
      'ZeroGEX è una piattaforma di analisi opzioni in tempo reale costruita attorno al posizionamento dei dealer. Ti mostra dove i dealer sono long o short gamma, dove si trova il gamma flip, dove sono i call wall e i put wall, ed esegue una serie di segnali in tempo reale sopra a tutto questo. L\'obiettivo è darti la stessa lente che usano i market maker per fare hedging, così puoi leggere l\'azione di prezzo intraday in quei termini.',
    whoItsForQ: 'Per chi è pensato ZeroGEX?',
    whoItsForA:
      'Trader intraday attivi che operano su SPY, SPX o QQQ e vogliono una lettura strutturale del mercato delle opzioni. Day trader, swing trader con timing intraday, quant che vogliono i dati dei segnali via API e strategist di vendita di opzioni per cui il posizionamento dei dealer è l\'input quotidiano. Non siamo uno strumento di ricerca su singole azioni.',
    doINeedToSignUpQ: 'Devo registrarmi per usare ZeroGEX?',
    doINeedToSignUpA:
      'Le pagine gratuite Gamma Levels — SPX, SPY e QQQ — sono aperte a chiunque senza account: il gamma flip, i call e put wall, il max pain e il profilo di gamma dei dealer, con un ritardo di circa 15 minuti. Anche il sito marketing, l\'Education Hub, gli articoli e le guide sono liberamente accessibili. La Dashboard completa in tempo reale, i segnali, le metriche, gli strumenti di strategia e il Live Bulletin richiedono un piano a pagamento (Basic o Pro). Vedi la pagina Pricing per il dettaglio dei livelli attuali.',
    freeTrialQ: 'C\'è una prova gratuita?',
    freeTrialA:
      'Sì. Sia Basic che Pro includono una prova gratuita. La durata della prova è indicata nella pagina Pricing. Alla fine della prova, l\'abbonamento continua automaticamente alla tariffa a cui ti sei iscritto. Annulla prima della fine della prova per evitare l\'addebito.',
    firstPageQ: 'Quale pagina dovrei aprire per prima?',
    firstPageA:
      'La Dashboard. Mostra l\'etichetta di regime, il net GEX, il gamma flip, i wall, il max pain, il composite score e il chip di trade-bias della giornata — tutto ciò di cui hai bisogno per orientarti. Da lì, entra nella pagina del segnale che corrisponde a ciò che stai cercando.',

    dataRefreshTitle: 'Dati &amp; Aggiornamento',
    dataRefreshBlurb: 'Copertura, cadenza e funzionamento dello streaming.',
    symbolsQ: 'Quali simboli sono attualmente supportati?',
    symbolsA:
      'ZeroGEX offre copertura analitica completa per SPY (ETF S&P 500), SPX (Indice S&P 500) e QQQ (ETF Nasdaq 100). Sono i tre sottostanti più liquidi e più ricchi di gamma nel mercato delle opzioni USA — gli strumenti in cui l\'attività di hedging dei dealer ha il maggiore impatto intraday.',
    singleNamesQ: 'Aggiungerete singole azioni (AAPL, TSLA, NVDA, ecc.)?',
    singleNamesA:
      'Non è nella roadmap. Il modello di posizionamento dei dealer funziona meglio negli strumenti dove il flusso istituzionale di opzioni domina il sottostante — cioè il complesso degli indici. Le singole azioni hanno rumore da notizie idiosincratiche che rende la lettura del GEX meno affidabile.',
    futuresQ: 'Posso usare ZeroGEX per fare trading su futures come ES, MES, NQ o MNQ?',
    futuresA:
      'Sì — mappi il future sul suo book indice di riferimento. /ES e /MES seguono i livelli gamma di SPX (e SPY); /NQ e /MNQ seguono oggi QQQ, con NDX in arrivo. I livelli strutturali sono identici; cambia solo la scala di prezzo. Quando l\'indice cash è chiuso, il Live Bulletin mostra già il prezzo implicito dai futures ES/NQ per contesto. Tradurre i livelli direttamente in prezzi futures è nella roadmap.',
    refreshCadenceQ: 'Ogni quanto si aggiornano i dati?',
    refreshCadenceA:
      'Quote e flow si aggiornano ogni ~1 secondo durante l\'orario regolare. Gli score dei segnali si aggiornano ogni 1–5 secondi secondo il segnale. La superficie GEX si aggiorna ogni 5–15 secondi (lo snapshot della catena è il collo di bottiglia). Tutto è in streaming — non serve ricaricare la pagina.',
    preMarketQ: 'ZeroGEX mostra i dati pre-market e after-hours?',
    preMarketA:
      'Sì. Il riquadro prezzo mostra le quote fuori orario insieme alla chiusura della sessione regolare precedente per contesto. Alcuni segnali (EOD Pressure, 0DTE Position Imbalance) vengono calcolati solo durante la sessione regolare per progetto.',
    dataSourceQ: 'Da dove provengono i dati?',
    dataSourceA:
      'ZeroGEX usa dati opzioni dal feed OPRA (il tape consolidato delle opzioni USA) più il feed quote del sottostante equity. Entrambe sono fonti dati professionali di livello istituzionale in tempo reale. Non divulghiamo pubblicamente i nomi specifici dei fornitori.',
    historyDepthQ: 'Quanto indietro arriva lo storico dei dati?',
    historyDepthA:
      'Quote e flow hanno diversi anni di barre storiche. Gli score dei segnali sono ricostruiti fino all\'introduzione di ciascun segnale. Le superfici GEX hanno uno storico di snapshot giornalieri; lo storico GEX intraday è più breve. La pagina Backtesting mostra l\'intervallo disponibile per il segnale scelto.',

    signalsCatTitle: 'Segnali',
    signalsCatBlurb: 'Come funzionano gli score, cosa significano i trigger e come usarli.',
    howManySignalsQ: 'Quanti segnali gestisce ZeroGEX?',
    howManySignalsA:
      'Quattordici in totale — otto Advanced (basati su eventi, con trigger discreti) e sei Basic (continui, che alimentano il composite). Vedi la guida Signals: Explained per la matrice di riferimento completa.',
    advancedVsBasicQ: 'Qual è la differenza tra segnali Advanced e Basic?',
    advancedVsBasicA:
      'I segnali Advanced pongono una domanda situazionale precisa e fanno scattare un trigger discreto quando il loro score supera una soglia. I segnali Basic sono letture continue che alimentano il composite score con un peso fisso. I segnali Advanced innescano; i segnali Basic pesano.',
    scoreZeroQ: 'Cosa significa uno score del segnale pari a 0?',
    scoreZeroA:
      'Quasi mai "mercato neutrale". Per la maggior parte dei segnali significa che i dati sono insufficienti o che questa domanda specifica non ha risposta al momento. Leggi uno 0 come "nessuna lettura", non "nessun trade". Un mercato davvero neutrale tipicamente mostra score che oscillano intorno a ±0,1, non uno zero netto.',
    compositeScoreQ: 'Cos\'è il Composite Score?',
    compositeScoreA:
      'Il Composite Score (internamente MSI) è la lettura combinata di tutti i segnali sul simbolo attivo. Vive sulla stessa linea [-1, +1] di ogni singolo segnale. Positivo ⇒ inclinazione strutturale rialzista; negativo ⇒ ribassista. La magnitudine è la convinzione. Usalo come filtro, non come previsione.',
    signalAlertsQ: 'Ricevo avvisi quando i segnali scattano?',
    signalAlertsA:
      'In-app, sì. Ogni trigger arriva nel Live Bulletin e illumina la card del segnale corrispondente. ZeroGEX al momento non invia avvisi dei segnali via SMS, push o email — il log in-app è il registro ufficiale. Potremmo aggiungere altri canali se ci sarà domanda.',
    signalAccuracyQ: 'Quanto sono precisi i segnali?',
    signalAccuracyA:
      'Dipende dal segnale, dal regime e da come lo usi. I segnali non sono ticket di trade a sé stanti — sono filtri e trigger dentro un processo. La pagina Backtesting ti permette di replayare qualsiasi segnale sui dati storici con le tue regole. Consigliamo vivamente una validazione out-of-sample prima di applicare qualsiasi regola.',

    tiersBillingTitle: 'Piani &amp; Fatturazione',
    tiersBillingBlurb: 'Piani, prezzi, rimborsi e gestione dell\'abbonamento.',
    tiersQ: 'Quali sono le differenze tra i piani?',
    tiersA:
      'Public è l\'esperienza gratuita, solo consultazione (sito marketing + education). Basic sblocca la Dashboard, il Live Bulletin, tutte le Metriche, gli Strategy Tools e tutti i segnali Basic. Pro aggiunge tutti i segnali Advanced, il Composite Score, il Backtesting e l\'accesso API. La pagina Pricing ha il dettaglio aggiornato.',
    monthlyVsAnnualQ: 'Devo pagare mensile o annuale?',
    monthlyVsAnnualA:
      'L\'annuale ha uno sconto significativo rispetto al mensile — la tariffa esatta è sulla pagina Pricing. La maggior parte degli utenti attivi passa all\'annuale dopo un paio di mesi. Puoi cambiare nel portale di fatturazione Stripe in qualsiasi momento; il conguaglio gestisce automaticamente i calcoli.',
    switchPlanQ: 'Come cambio il mio piano (livello o mensile/annuale)?',
    switchPlanA:
      'Apri la pagina Account e clicca su "Manage subscription" per aprire il portale di fatturazione Stripe — da lì puoi passare tra Basic e Pro e tra mensile e annuale. Gli upgrade (e il passaggio mensile → annuale) hanno effetto immediato; i downgrade e il passaggio annuale → mensile hanno effetto alla fine del periodo corrente, così mantieni ciò che hai pagato fino ad allora. Il conguaglio viene applicato e appare sulla prossima fattura, non come addebito anticipato. Se sei ancora nella prova gratuita, il cambio mantiene la prova — non ti verrà addebitato nulla finché non termina, poi verrai fatturato alla tariffa del nuovo piano.',
    tierUpgradeQ: 'Come passo da Basic a Pro?',
    tierUpgradeA:
      'Apri la pagina Account, clicca su "Manage subscription" per aprire il portale di fatturazione Stripe e cambia livello lì. L\'accesso al livello si aggiorna immediatamente; la differenza in conguaglio viene applicata alla prossima fattura.',
    cancellationQ: 'Come annullo?',
    cancellationA:
      'Attraverso il portale di fatturazione Stripe, accessibile dalla pagina Account. L\'annullamento ha effetto alla fine del periodo di fatturazione corrente — mantieni l\'accesso a pagamento fino ad allora. Dopo, il tuo livello torna a Public; il tuo account non viene eliminato.',
    refundsQ: 'Offrite rimborsi?',
    refundsA:
      'La prova è incondizionata — annulla prima che finisca e non ti verrà mai addebitato nulla. Gli abbonamenti a pagamento sono fatturati in anticipo e non riproporzionati alla cancellazione per impostazione predefinita. Per eccezioni e casi particolari, scrivi a support@zerogex.io e troveremo una soluzione.',
    billingIssueQ: 'Il mio pagamento non è andato a buon fine. Cosa faccio?',
    billingIssueA:
      'Stripe riprova automaticamente per diversi giorni. Durante la finestra di ritentivo, il tuo abbonamento è "past due" e le funzionalità a pagamento restano disponibili. Aggiorna il metodo di pagamento nel portale per risolvere. I fallimenti più comuni sono carte scadute e discrepanze nella verifica dell\'indirizzo.',
    referralsQ: 'Come funziona il programma di referral?',
    referralsA:
      'Se attivato per il tuo account, la pagina Account mostra un pannello Referral con il tuo codice, link e classifica. Chiunque si registri usando il tuo codice e passi a un piano a pagamento ti fa guadagnare un credito sulla prossima fattura. I crediti si accumulano tra i referral e si applicano automaticamente.',

    platformUsageTitle: 'Uso della piattaforma',
    platformUsageBlurb: 'Domande pratiche sul flusso di lavoro quotidiano.',
    dashboardWorkflowQ: 'Qual è il flusso di lavoro corretto per usare ZeroGEX durante una giornata di trading?',
    dashboardWorkflowA:
      'Parti semplice. Sulla Dashboard, leggi prima i tre livelli più importanti: il Gamma Flip (regime stabilizzante vs amplificante), poi il Call Wall e il Put Wall (la probabile frizione al rialzo e al ribasso). Apri il GEX Strike Profile per vedere come quella struttura si posiziona sul prezzo, poi conferma con la tua azione di prezzo — VWAP, la rottura dell\'opening range, qualsiasi cosa in cui hai già fiducia. Tieni il Live Bulletin aperto in una seconda scheda per gli eventi trigger. I livelli ti dicono dove prestare attenzione; i tuoi trigger di esecuzione ti dicono quando. Non provare a monitorare tutti e quattordici i segnali contemporaneamente il primo giorno.',
    multipleSymbolsQ: 'Posso visualizzare più simboli contemporaneamente?',
    multipleSymbolsA:
      'Ogni scheda del browser può mostrare un simbolo. Per vedere SPY, SPX e QQQ affiancati, apri tre schede. Il selettore di simbolo è nell\'header.',
    mobileSupportQ: 'ZeroGEX funziona su mobile?',
    mobileSupportA:
      'Sì — ogni pagina è responsive. Ma la piattaforma è costruita per desktop. La densità dei grafici presuppone uno schermo largo. Su mobile, la dashboard funziona bene per il monitoraggio; le pagine con grafici multipli e complessi sono più dense di quanto sarebbe ideale.',
    browserCompatQ: 'Quali browser sono supportati?',
    browserCompatA:
      'Chrome, Edge, Firefox e Safari sempre aggiornati. Le versioni più vecchie funzioneranno tecnicamente ma non riceveranno le ottimizzazioni di performance. Ad blocker e script blocker aggressivi a volte interrompono la connessione di streaming — inserisci zerogex.io nella whitelist se necessario.',
    pageStaleQ: 'Una pagina sembra bloccata o non aggiornata. Cosa faccio?',
    pageStaleA:
      'Controlla il chip di connessione nell\'header. Se resta rosso dopo vari ricaricamenti, fai un hard reload (Cmd+Shift+R / Ctrl+Shift+R). Se il problema persiste, prova una finestra in incognito. Se persiste ancora, scrivi al supporto indicando l\'URL della pagina, il tuo browser e l\'orario.',
    optionsCalculatorQ: 'Come funziona lo Strategy Builder?',
    optionsCalculatorA:
      'Lo Strategy Builder ti permette di costruire qualsiasi strategia in opzioni a una o più gambe, la valuta in tempo reale con Black-Scholes sulla superficie di IV attiva, e ti mostra le greche più una superficie di scenario P&L. È uno strumento di ricerca, non un broker — sei tu a costruire la struttura e a metterla in atto.',

    accountTitle: 'Account &amp; Accesso',
    accountBlurb: 'Autenticazione, password e provider di identità.',
    forgotPasswordQ: 'Ho dimenticato la password.',
    forgotPasswordA:
      'Usa la pagina Forgot Password. Ti verrà inviato un link di reset via email; cliccalo e imposta una nuova password. Se l\'email non arriva, controlla lo spam. Se ti sei registrato con Google o Apple, non hai una password — accedi tramite il provider.',
    changeEmailQ: 'Posso cambiare l\'email del mio account?',
    changeEmailA:
      'L\'email è l\'ID dell\'account e non può essere cambiata dall\'app. Per cambiarla, scrivi a support@zerogex.io con verifica sia del vecchio che del nuovo indirizzo.',
    googleAppleQ: 'Posso accedere con Google o Apple?',
    googleAppleA:
      'Sì. Sono supportati sia l\'accesso con Google che con Apple. Puoi collegare più provider allo stesso account dalla pagina Account. Se vuoi una password come alternativa, puoi impostarla anche dalla pagina Account.',
    twoFactorQ: 'ZeroGEX supporta l\'autenticazione a due fattori?',
    twoFactorA:
      'Per gli accessi con Google e Apple, usi il 2FA del provider. Per l\'accesso con password, il 2FA sull\'account ZeroGEX stesso non è attualmente supportato — usare Google o Apple è il percorso consigliato per una sicurezza più elevata.',
    emailVerificationQ: 'Non ho mai ricevuto il messaggio di verifica email.',
    emailVerificationA:
      'Controlla prima lo spam. Clicca su "Resend verification" nel banner in-app. Se più tentativi di reinvio non arrivano, l\'indirizzo potrebbe essere scritto male o il tuo server di posta potrebbe rifiutare il nostro dominio — scrivi a support@zerogex.io dall\'indirizzo in questione.',
    deleteAccountQ: 'Come elimino il mio account?',
    deleteAccountA:
      'Scrivi a support@zerogex.io. L\'eliminazione dell\'account annulla qualsiasi abbonamento attivo e rimuove i dati dell\'account secondo la Privacy policy. Confermiamo via email prima di procedere.',

    apiTitle: 'API &amp; Sviluppatori',
    apiBlurb: 'Per quando vuoi i dati in modo programmatico.',
    apiPublicQ: 'L\'API è accessibile pubblicamente?',
    apiPublicA:
      'La documentazione API è su api.zerogex.io/docs e richiede un account Pro. L\'accesso API — inclusa la generazione e l\'uso delle chiavi — è una funzionalità del livello Pro. Gli utenti Public e Basic non hanno accesso programmatico.',
    apiDocsFormatQ: 'In che formato sono i documenti API?',
    apiDocsFormatA:
      'OpenAPI 3.0. Sono disponibili sia la vista Swagger UI (interattiva) che ReDoc (solo lettura). Le risposte sono in JSON.',
    apiRateLimitsQ: 'Quali sono i rate limit dell\'API?',
    apiRateLimitsA:
      'Gli account Pro ottengono limiti generosi al minuto e al giorno, sufficienti per dashboard di produzione e bot che rispettano una normale igiene delle richieste. Le risposte oltre il limite restituiscono 429 con un header Retry-After.',
    apiKeysQ: 'Sono su Pro — come ottengo la mia API key?',
    apiKeysA:
      'L\'accesso API è una funzionalità Pro. La generazione self-service delle chiavi dalla pagina Account è in arrivo; finché non sarà disponibile, le chiavi vengono rilasciate manualmente — scrivi a support@zerogex.io dall\'indirizzo del tuo account e ti manderemo una chiave più le note di setup. Usala come <code>Authorization: Bearer &lt;key&gt;</code> in ogni richiesta. Scrivici per ruotare o revocare una chiave.',
    apiStreamingQ: 'C\'è un endpoint di streaming o un websocket?',
    apiStreamingA:
      'Non è attualmente esposto pubblicamente. La piattaforma web usa un canale interno. Per la maggior parte dei casi d\'uso, il polling a una cadenza ragionevole (ogni pochi secondi per le metriche live) è sufficiente.',

    methodologyTitle: 'Metodologia',
    methodologyBlurb: 'Come vengono effettivamente calcolati i numeri.',
    whatIsGexQ: 'Cos\'è la Gamma Exposure (GEX) e perché è importante?',
    whatIsGexA:
      'Il GEX è la sensibilità aggregata degli hedge delta dei dealer di opzioni ai movimenti di prezzo del sottostante. Quando i dealer sono long gamma (net GEX positivo sul prezzo spot), vendono i rally e comprano i ribassi — un effetto attenuante sulla volatilità. Quando sono short gamma, seguono il prezzo — un effetto amplificante. Conoscere il regime GEX ti dice se il mercato tenderà a mean-revert o a fare trend.',
    gammaFlipQ: 'Come viene calcolato il livello del Gamma Flip?',
    gammaFlipA:
      'Il flip è il livello in cui la curva del gamma dei dealer attraversa lo zero — calcolato da un profilo di gamma dei dealer a spot-shift, non da un\'approssimazione basata sul net GEX cumulativo. Sopra il flip, l\'hedging dei dealer è stabilizzante; sotto, amplificante. Vedi la guida Gamma Flip Calculation per la metodologia completa.',
    wallsExplainedQ: 'Cosa sono il call wall e il put wall?',
    wallsExplainedA:
      'Gli strike con il maggiore gamma call e gamma put rispettivamente. Tendono ad agire come resistenza e supporto intraday, specialmente in gamma positivo. I wall migrano durante la giornata mentre arriva flow — osservare la migrazione è di per sé informativo.',
    maxPainReliabilityQ: 'Cos\'è il Max Pain e quanto è affidabile?',
    maxPainReliabilityA:
      'Il max pain è lo strike che minimizza il payout totale dei compratori di opzioni a scadenza. È più affidabile nelle ultime 24–48 ore prima di una scadenza significativa, specialmente per lo 0DTE su SPX. La lettura onesta è che il "magnete gamma" — la struttura dei wall — di solito guida il pin, non l\'argomento del payout dei compratori di per sé. Vedi l\'articolo Max Pain per l\'analisi approfondita.',
    flowExplainedQ: 'Cos\'è il flow "premium-weighted"?',
    flowExplainedA:
      'Il flow premium-weighted moltiplica il volume dei contratti per il premio pagato. È la lettura della convinzione — un trader che paga 500$/contratto sta facendo una scommessa vera; un trader che scalpa lotto ticket da 0,05$ non lo è. Il volume grezzo li tratta allo stesso modo; il flow premium-weighted non lo fa.',
    pricingModelQ: 'Che modello di pricing usa lo Strategy Builder?',
    pricingModelA:
      'Black-Scholes con la superficie di volatilità implicita in tempo reale. Per SPX (esercizio europeo) non viene applicato alcun aggiustamento. Per SPY e QQQ (esercizio americano) aggiungiamo un premio da esercizio anticipato sulle gambe deep-ITM vicino alla scadenza.',

    supportTitle: 'Supporto &amp; Contatti',
    supportBlurb: 'Come contattarci quando hai bisogno di parlare con una persona.',
    howToContactQ: 'Come posso ottenere assistenza?',
    howToContactA:
      'Scrivi a support@zerogex.io. Rispondiamo velocemente — di solito lo stesso giorno di trading. Includi l\'URL della pagina su cui eri, uno screenshot se pertinente, il tuo browser e sistema operativo e (per la fatturazione) l\'email del tuo account.',
    featureRequestsQ: 'Accettate richieste di funzionalità?',
    featureRequestsA:
      'Sì. Scrivi a support@zerogex.io con la richiesta e come la useresti. Diamo priorità in base alla roadmap esistente.',
    bugReportsQ: 'Penso di aver trovato un bug.',
    bugReportsA:
      'Scrivi a support@zerogex.io con la pagina, i passaggi per riprodurlo, il comportamento atteso rispetto a quello effettivo, browser, sistema operativo e un orario approssimativo. Più specifico è il report, più velocemente possiamo intervenire.',
    phishingQ: 'Ho ricevuto un\'email sospetta che dice di provenire da ZeroGEX.',
    phishingA:
      'Inviamo email da zerogex.io e noreply@zerogex.io (e occasionalmente support@zerogex.io). Non ti chiederemo mai la password o il token di sessione via email. Se qualcosa non ti sembra corretto, reindirizzalo a support@zerogex.io e confermeremo o segnaleremo.',
  },
  de: {
    backToHelp: 'Zurück zum Hilfe-Center',
    faqsBadge: 'FAQ',
    heading: 'Häufig gestellte Fragen',
    description:
      'Klare Antworten auf die Fragen, die Trader am häufigsten stellen. Nutze das Suchfeld, um direkt zu einer Frage zu gelangen, oder blättere nach Kategorie.',
    searchPlaceholder: 'FAQ durchsuchen...',
    noMatch: 'Keine FAQ entspricht deiner Suche.',
    tryDifferent: 'Versuche eine andere Suche oder',
    emailSupport: 'kontaktiere den Support',
    didntFind: 'Deine Antwort nicht gefunden?',
    realQuestions: 'Echte Fragen passen nicht immer in eine Kategorie. Schreibe an',
    usuallyAnswer: '— wir antworten meist noch am selben Handelstag.',

    gettingStartedTitle: 'Erste Schritte',
    gettingStartedBlurb: 'Neu bei ZeroGEX? Hier fängst du an.',
    whatIsZerogexQ: 'Was ist ZeroGEX?',
    whatIsZerogexA:
      'ZeroGEX ist eine Echtzeit-Options-Analyseplattform, die auf dem Positioning der Dealer aufbaut. Sie zeigt dir, wo Dealer long oder short Gamma sind, wo der Gamma-Flip liegt, wo sich die Call- und Put-Walls befinden, und betreibt darauf aufbauend eine Reihe von Echtzeitsignalen. Ziel ist es, dir dieselbe Perspektive zu geben, die Market Maker beim Hedging nutzen — damit du das Intraday-Preisverhalten in diesen Begriffen lesen kannst.',
    whoItsForQ: 'Für wen ist ZeroGEX gedacht?',
    whoItsForA:
      'Aktive Intraday-Trader, die SPY, SPX oder QQQ handeln und eine strukturelle Sicht auf den Optionsmarkt suchen. Daytrader, Swingtrader mit Intraday-Timing, Quants, die Signaldaten per API wollen, und Optionsstrategen, für die das Dealer-Positioning der tägliche Input ist. Wir sind kein Recherchetool für Einzelaktien.',
    doINeedToSignUpQ: 'Muss ich mich registrieren, um ZeroGEX zu nutzen?',
    doINeedToSignUpA:
      'Die kostenlosen Gamma-Levels-Seiten — SPX, SPY und QQQ — stehen jedem ohne Konto offen: der Gamma-Flip, Call- und Put-Walls, Max Pain und das Dealer-Gamma-Profil, mit etwa 15 Minuten Verzögerung. Auch die Marketing-Seite, der Education Hub, Artikel und Guides sind frei zugänglich. Das vollständige Echtzeit-Dashboard, Signale, Metriken, Strategie-Tools und das Live Bulletin erfordern einen kostenpflichtigen Plan (Basic oder Pro). Die aktuelle Tarifübersicht findest du auf der Pricing-Seite.',
    freeTrialQ: 'Gibt es eine kostenlose Testphase?',
    freeTrialA:
      'Ja. Sowohl Basic als auch Pro beinhalten eine kostenlose Testphase. Die Dauer der Testphase ist auf der Pricing-Seite angegeben. Am Ende der Testphase läuft das Abonnement automatisch zu dem Tarif weiter, zu dem du dich angemeldet hast. Kündige vor Ablauf der Testphase, um eine Abbuchung zu vermeiden.',
    firstPageQ: 'Welche Seite sollte ich als Erstes öffnen?',
    firstPageA:
      'Das Dashboard. Es zeigt das Regime-Label, das Netto-GEX, den Gamma-Flip, die Walls, Max Pain, den Composite Score und den Trade-Bias-Chip des Tages — alles, was du zur Orientierung brauchst. Von dort aus kannst du zur Signal-Seite wechseln, die zu deinem Anliegen passt.',

    dataRefreshTitle: 'Daten &amp; Aktualisierung',
    dataRefreshBlurb: 'Abdeckung, Aktualisierungsrhythmus und wie das Streaming funktioniert.',
    symbolsQ: 'Welche Symbole werden aktuell unterstützt?',
    symbolsA:
      'ZeroGEX bietet vollständige Analyseabdeckung für SPY (S&P-500-ETF), SPX (S&P-500-Index) und QQQ (Nasdaq-100-ETF). Das sind die drei liquidesten, gamma-reichsten Basiswerte im US-Optionsmarkt — die Instrumente, in denen das Hedging der Dealer den größten Intraday-Einfluss hat.',
    singleNamesQ: 'Werdet ihr Einzelaktien (AAPL, TSLA, NVDA usw.) hinzufügen?',
    singleNamesA:
      'Nicht auf der Roadmap. Das Dealer-Positioning-Modell funktioniert am besten bei Instrumenten, bei denen institutioneller Optionsflow den Basiswert dominiert — das ist der Index-Komplex. Einzelaktien haben idiosynkratisches News-Rauschen, das die GEX-Lesbarkeit weniger zuverlässig macht.',
    futuresQ: 'Kann ich ZeroGEX für den Handel mit Futures wie ES, MES, NQ oder MNQ nutzen?',
    futuresA:
      'Ja — du ordnest den Future seinem Index-Buch zu. /ES und /MES orientieren sich an den SPX- (und SPY-)Gamma-Levels; /NQ und /MNQ heute an QQQ, NDX folgt. Die strukturellen Levels sind identisch, nur die Preisskala unterscheidet sich. Wenn der Kassaindex geschlossen ist, zeigt das Live Bulletin bereits den futures-implizierten Preis von ES/NQ zur Orientierung. Die direkte Übersetzung der Levels in Futures-Preise steht auf der Roadmap.',
    refreshCadenceQ: 'Wie oft aktualisieren sich die Daten?',
    refreshCadenceA:
      'Quotes und Flow aktualisieren sich während der regulären Handelszeit etwa jede Sekunde. Signal-Scores aktualisieren sich je nach Signal alle 1–5 Sekunden. Die GEX-Oberfläche aktualisiert sich alle 5–15 Sekunden (der Chain-Snapshot ist der Flaschenhals). Alles läuft als Stream — du musst die Seite nicht neu laden.',
    preMarketQ: 'Zeigt ZeroGEX Pre-Market- und After-Hours-Daten?',
    preMarketA:
      'Ja. Die Preiskachel zeigt Kurse aus den erweiterten Handelszeiten zusammen mit dem vorherigen regulären Schlusskurs zur Einordnung. Einige Signale (EOD Pressure, 0DTE Position Imbalance) werden bewusst nur während der regulären Sitzung berechnet.',
    dataSourceQ: 'Woher kommen die Daten?',
    dataSourceA:
      'ZeroGEX nutzt Optionsdaten aus dem OPRA-Feed (das konsolidierte US-Optionsband) sowie den Kursfeed des Basiswerts. Beides sind professionelle Echtzeit-Datenquellen auf institutionellem Niveau. Wir nennen die konkreten Anbieternamen nicht öffentlich.',
    historyDepthQ: 'Wie weit reicht der historische Datensatz zurück?',
    historyDepthA:
      'Quotes und Flow verfügen über mehrere Jahre historischer Bars. Signal-Scores sind bis zur Einführung des jeweiligen Signals zurückgerechnet. GEX-Oberflächen haben eine tägliche Snapshot-Historie; die Intraday-GEX-Historie ist kürzer. Die Backtesting-Seite zeigt den verfügbaren Zeitraum für das jeweils gewählte Signal.',

    signalsCatTitle: 'Signale',
    signalsCatBlurb: 'Wie Scores funktionieren, was Trigger bedeuten und wie man sie nutzt.',
    howManySignalsQ: 'Wie viele Signale betreibt ZeroGEX?',
    howManySignalsA:
      'Insgesamt vierzehn — acht Advanced (ereignisgesteuert, mit diskreten Triggern) und sechs Basic (kontinuierlich, fließen in den Composite ein). Siehe den Leitfaden Signals: Explained für die vollständige Referenzmatrix.',
    advancedVsBasicQ: 'Was ist der Unterschied zwischen Advanced- und Basic-Signalen?',
    advancedVsBasicA:
      'Advanced-Signale stellen eine scharfe situative Frage und lösen einen diskreten Trigger aus, wenn ihr Score eine Schwelle überschreitet. Basic-Signale sind kontinuierliche Messwerte, die mit fester Gewichtung in den Composite Score einfließen. Advanced-Signale triggern; Basic-Signale gewichten.',
    scoreZeroQ: 'Was bedeutet ein Signal-Score von 0?',
    scoreZeroA:
      'Fast nie "neutraler Markt". Bei den meisten Signalen bedeutet es, dass die Datenlage unzureichend ist oder diese spezifische Frage aktuell keine Antwort hat. Lies eine 0 als "keine Aussage", nicht als "kein Trade". Ein wirklich neutraler Markt zeigt in der Regel Scores, die um ±0,1 pendeln, nicht eine glatte Null.',
    compositeScoreQ: 'Was ist der Composite Score?',
    compositeScoreA:
      'Der Composite Score (intern MSI) ist die kombinierte Auslesung aller Signale für das aktive Symbol. Er liegt auf derselben [-1, +1]-Skala wie jedes einzelne Signal. Positiv ⇒ strukturelle bullische Tendenz; negativ ⇒ bärisch. Die Größe steht für die Überzeugungsstärke. Nutze ihn als Filter, nicht als Prognose.',
    signalAlertsQ: 'Erhalte ich Benachrichtigungen, wenn Signale auslösen?',
    signalAlertsA:
      'In der App, ja. Jeder Trigger landet im Live Bulletin und lässt die entsprechende Signalkarte aufleuchten. ZeroGEX sendet Signalbenachrichtigungen derzeit nicht per SMS, Push oder E-Mail — das In-App-Protokoll ist die maßgebliche Aufzeichnung. Bei entsprechender Nachfrage ergänzen wir eventuell weitere Kanäle.',
    signalAccuracyQ: 'Wie genau sind die Signale?',
    signalAccuracyA:
      'Das hängt vom Signal, vom Marktregime und von der Nutzung ab. Signale sind keine eigenständigen Trade-Tickets — sie sind Filter und Trigger innerhalb eines Prozesses. Die Backtesting-Seite lässt dich jedes Signal mit deinen eigenen Regeln gegen historische Daten replayen. Wir empfehlen dringend eine Out-of-Sample-Validierung, bevor du eine Regel einsetzt.',

    tiersBillingTitle: 'Tarife &amp; Abrechnung',
    tiersBillingBlurb: 'Pläne, Preise, Rückerstattungen und Verwaltung deines Abonnements.',
    tiersQ: 'Was unterscheidet die Tarife?',
    tiersA:
      'Public ist die kostenlose, reine Browse-Erfahrung (Marketing-Seite + Education). Basic schaltet das Dashboard, das Live Bulletin, alle Metriken, Strategie-Tools und alle Basic-Signale frei. Pro fügt alle Advanced-Signale, den Composite Score, Backtesting und API-Zugang hinzu. Die aktuelle Übersicht findest du auf der Pricing-Seite.',
    monthlyVsAnnualQ: 'Sollte ich monatlich oder jährlich zahlen?',
    monthlyVsAnnualA:
      'Die jährliche Zahlung ist deutlich günstiger als monatlich — den genauen Satz findest du auf der Pricing-Seite. Die meisten aktiven Nutzer wechseln nach ein paar Monaten zu jährlich. Du kannst jederzeit im Stripe-Abrechnungsportal wechseln; die Rechnung wird automatisch anteilig berechnet.',
    switchPlanQ: 'Wie wechsle ich meinen Plan (Tarif oder monatlich/jährlich)?',
    switchPlanA:
      'Öffne die Account-Seite und klicke auf "Manage subscription", um das Stripe-Abrechnungsportal zu öffnen — dort kannst du zwischen Basic und Pro sowie zwischen monatlich und jährlich wechseln. Upgrades (und der Wechsel von monatlich zu jährlich) werden sofort wirksam; Downgrades und der Wechsel von jährlich zu monatlich werden erst am Ende der aktuellen Periode wirksam, sodass du das behältst, wofür du bereits bezahlt hast. Die anteilige Verrechnung erfolgt auf deiner nächsten Rechnung, nicht als Vorabbuchung. Wenn du dich noch in der kostenlosen Testphase befindest, bleibt die Testphase beim Wechsel erhalten — du wirst erst nach Ablauf berechnet, dann zum Satz des neuen Plans.',
    tierUpgradeQ: 'Wie upgrade ich von Basic auf Pro?',
    tierUpgradeA:
      'Öffne die Account-Seite, klicke auf "Manage subscription", um das Stripe-Abrechnungsportal zu öffnen, und wechsle dort den Tarif. Der Tarifzugang wird sofort aktualisiert; die anteilige Differenz wird auf deiner nächsten Rechnung berechnet.',
    cancellationQ: 'Wie kündige ich?',
    cancellationA:
      'Über das Stripe-Abrechnungsportal, aufrufbar von der Account-Seite. Die Kündigung wird am Ende der aktuellen Abrechnungsperiode wirksam — bis dahin behältst du den bezahlten Zugang. Danach fällt dein Tarif auf Public zurück; dein Konto wird nicht gelöscht.',
    refundsQ: 'Bietet ihr Rückerstattungen an?',
    refundsA:
      'Die Testphase ist bedingungslos — kündige vor ihrem Ende und dir wird nie etwas berechnet. Kostenpflichtige Abonnements werden im Voraus abgerechnet und standardmäßig bei Kündigung nicht anteilig zurückerstattet. Für Ausnahmen und Sonderfälle schreibe an support@zerogex.io, und wir finden eine Lösung.',
    billingIssueQ: 'Meine Zahlung ist fehlgeschlagen. Was jetzt?',
    billingIssueA:
      'Stripe versucht es über mehrere Tage automatisch erneut. Während des Wiederholungsfensters ist dein Abonnement "überfällig", und die bezahlten Funktionen bleiben verfügbar. Aktualisiere die Zahlungsmethode im Portal, um das Problem zu lösen. Die häufigsten Fehler sind abgelaufene Karten und Abweichungen bei der Adressprüfung.',
    referralsQ: 'Wie funktioniert das Empfehlungsprogramm?',
    referralsA:
      'Wenn es für dein Konto aktiviert ist, zeigt die Account-Seite ein Referrals-Panel mit deinem Code, Link und Stand. Jeder, der sich mit deinem Code registriert und zu einem kostenpflichtigen Plan wechselt, bringt dir eine Gutschrift auf deiner nächsten Rechnung. Gutschriften summieren sich über mehrere Empfehlungen und werden automatisch angewendet.',

    platformUsageTitle: 'Nutzung der Plattform',
    platformUsageBlurb: 'Praktische Fragen zum täglichen Arbeitsablauf.',
    dashboardWorkflowQ: 'Was ist der richtige Arbeitsablauf für die Nutzung von ZeroGEX während eines Handelstags?',
    dashboardWorkflowA:
      'Fang einfach an. Lies auf dem Dashboard zuerst die drei wichtigsten Levels: den Gamma-Flip (stabilisierendes vs. verstärkendes Regime), dann Call Wall und Put Wall (deine wahrscheinliche Reibung nach oben und unten). Öffne das GEX Strike Profile, um zu sehen, wie sich diese Struktur zum Preis verhält, und bestätige dann mit deiner eigenen Preisaktion — VWAP, der Opening-Range-Break, was auch immer du bereits vertraust. Halte das Live Bulletin in einem zweiten Tab offen für Trigger-Ereignisse. Die Levels sagen dir, worauf du achten sollst; deine Ausführungstrigger sagen dir, wann. Versuche nicht, am ersten Tag alle vierzehn Signale gleichzeitig zu beobachten.',
    multipleSymbolsQ: 'Kann ich mehrere Symbole gleichzeitig anzeigen?',
    multipleSymbolsA:
      'Jeder Browser-Tab kann ein Symbol anzeigen. Um SPY, SPX und QQQ nebeneinander zu sehen, öffne drei Tabs. Der Symbol-Auswähler befindet sich in der Kopfzeile.',
    mobileSupportQ: 'Funktioniert ZeroGEX auf dem Handy?',
    mobileSupportA:
      'Ja — jede Seite ist responsiv. Aber die Plattform ist für den Desktop gebaut. Die Chart-Dichte setzt einen breiten Bildschirm voraus. Auf dem Handy funktioniert das Dashboard gut zum Monitoring; komplexe Mehrfach-Chart-Seiten sind dichter, als es ideal wäre.',
    browserCompatQ: 'Welche Browser werden unterstützt?',
    browserCompatA:
      'Aktuelle Versionen von Chrome, Edge, Firefox und Safari. Ältere Versionen funktionieren technisch, erhalten aber nicht die Performance-Optimierungen. Aggressive Ad- und Script-Blocker unterbrechen manchmal die Streaming-Verbindung — setze zerogex.io bei Bedarf auf die Whitelist.',
    pageStaleQ: 'Eine Seite wirkt veraltet oder eingefroren. Was tue ich?',
    pageStaleA:
      'Prüfe den Verbindungs-Chip in der Kopfzeile. Bleibt er über mehrere Neuladevorgänge rot, mache einen Hard-Reload (Cmd+Shift+R / Ctrl+Shift+R). Hilft das nicht, probiere ein Inkognito-Fenster. Bleibt es weiterhin so, schreibe an den Support mit der Seiten-URL, deinem Browser und dem Zeitstempel.',
    optionsCalculatorQ: 'Wie funktioniert der Strategy Builder?',
    optionsCalculatorA:
      'Der Strategy Builder lässt dich jede Options-Strategie mit einem oder mehreren Legs aufbauen, bewertet sie live mit Black-Scholes gegenüber der aktiven IV-Oberfläche und zeigt dir die Greeks sowie eine P&L-Szenariooberfläche. Es ist ein Recherchetool, kein Broker — du übernimmst die Struktur und setzt sie selbst um.',

    accountTitle: 'Konto &amp; Anmeldung',
    accountBlurb: 'Authentifizierung, Passwörter und Identitätsanbieter.',
    forgotPasswordQ: 'Ich habe mein Passwort vergessen.',
    forgotPasswordA:
      'Nutze die Seite "Forgot Password". Ein Reset-Link wird per E-Mail versendet; klicke ihn an und setze ein neues Passwort. Wenn die E-Mail nicht ankommt, prüfe den Spam-Ordner. Wenn du dich mit Google oder Apple registriert hast, hast du kein Passwort — melde dich stattdessen über den Anbieter an.',
    changeEmailQ: 'Kann ich die E-Mail-Adresse meines Kontos ändern?',
    changeEmailA:
      'Die E-Mail-Adresse ist die Konto-ID und kann in der App nicht geändert werden. Um sie zu ändern, schreibe an support@zerogex.io mit Verifizierung sowohl der alten als auch der neuen Adresse.',
    googleAppleQ: 'Kann ich mich mit Google oder Apple anmelden?',
    googleAppleA:
      'Ja. Sowohl Google- als auch Apple-Anmeldung werden unterstützt. Du kannst mehrere Anbieter mit demselben Konto von der Account-Seite aus verknüpfen. Wenn du zusätzlich ein Passwort als Rückfalloption möchtest, kannst du das auch über die Account-Seite einrichten.',
    twoFactorQ: 'Unterstützt ZeroGEX Zwei-Faktor-Authentifizierung?',
    twoFactorA:
      'Bei Anmeldungen über Google und Apple nutzt du die 2FA des jeweiligen Anbieters. Bei der Anmeldung per Passwort wird 2FA für das ZeroGEX-Konto selbst derzeit nicht unterstützt — Google oder Apple zu verwenden ist der empfohlene Weg für höhere Sicherheit.',
    emailVerificationQ: 'Ich habe die E-Mail-Verifizierungsnachricht nie erhalten.',
    emailVerificationA:
      'Prüfe zuerst den Spam-Ordner. Klicke auf "Resend verification" im In-App-Banner. Kommen mehrere erneute Sendungen nicht an, ist die Adresse möglicherweise falsch geschrieben, oder dein Mailserver blockiert unsere Domain — schreibe von der betreffenden Adresse an support@zerogex.io.',
    deleteAccountQ: 'Wie lösche ich mein Konto?',
    deleteAccountA:
      'Schreibe an support@zerogex.io. Die Kontolöschung kündigt jedes aktive Abonnement und entfernt Kontodaten gemäß der Datenschutzrichtlinie. Wir bestätigen per E-Mail, bevor wir es umsetzen.',

    apiTitle: 'API &amp; Entwickler',
    apiBlurb: 'Für den programmatischen Zugriff auf die Daten.',
    apiPublicQ: 'Ist die API öffentlich zugänglich?',
    apiPublicA:
      'Die API-Dokumentation befindet sich unter api.zerogex.io/docs und erfordert ein Pro-Konto. API-Zugang — einschließlich Schlüsselerstellung und -nutzung — ist eine Pro-Funktion. Public- und Basic-Nutzer haben keinen programmatischen Zugriff.',
    apiDocsFormatQ: 'In welchem Format liegen die API-Dokumente vor?',
    apiDocsFormatA:
      'OpenAPI 3.0. Es stehen sowohl Swagger UI (interaktiv) als auch ReDoc (nur lesbar) zur Verfügung. Antworten erfolgen als JSON.',
    apiRateLimitsQ: 'Wie hoch sind die API-Ratenlimits?',
    apiRateLimitsA:
      'Pro-Konten erhalten großzügige Minuten- und Tageslimits, ausreichend für produktive Dashboards und Bots, die normale Anfrage-Hygiene einhalten. Antworten über dem Limit liefern 429 mit einem Retry-After-Header.',
    apiKeysQ: 'Ich habe Pro — wie bekomme ich meinen API-Schlüssel?',
    apiKeysA:
      'API-Zugang ist eine Pro-Funktion. Die Self-Service-Schlüsselerstellung über die Account-Seite kommt bald; bis dahin werden Schlüssel manuell ausgestellt — schreibe von deiner Konto-Adresse an support@zerogex.io, und wir senden dir einen Schlüssel plus Setup-Hinweise. Verwende ihn als <code>Authorization: Bearer &lt;key&gt;</code> bei jeder Anfrage. Schreibe uns, um einen Schlüssel zu rotieren oder zu widerrufen.',
    apiStreamingQ: 'Gibt es einen Streaming-Endpoint oder Websocket?',
    apiStreamingA:
      'Derzeit nicht öffentlich verfügbar. Die Web-Plattform nutzt einen internen Kanal. Für die meisten Anwendungsfälle reicht Polling in einem angemessenen Rhythmus (alle paar Sekunden für Live-Metriken).',

    methodologyTitle: 'Methodik',
    methodologyBlurb: 'Wie die Zahlen tatsächlich berechnet werden.',
    whatIsGexQ: 'Was ist Gamma Exposure (GEX) und warum ist es wichtig?',
    whatIsGexA:
      'GEX ist die aggregierte Sensitivität der Delta-Hedges der Options-Dealer gegenüber Preisbewegungen im Basiswert. Wenn Dealer long Gamma sind (positives Netto-GEX am Spot), verkaufen sie Rallys und kaufen Rückgänge — ein dämpfender Effekt auf die Volatilität. Wenn sie short Gamma sind, jagen sie dem Preis nach — ein verstärkender Effekt. Das GEX-Regime zu kennen sagt dir, ob der Markt eher zu Mean-Reversion oder zu Trends tendiert.',
    gammaFlipQ: 'Wie wird das Gamma-Flip-Level berechnet?',
    gammaFlipA:
      'Der Flip ist das Level, an dem die Dealer-Gamma-Kurve die Null-Linie kreuzt — berechnet aus einem Spot-Shift-Dealer-Gamma-Profil, nicht aus einer kumulativen-Netto-GEX-Näherung. Oberhalb des Flips ist das Hedging der Dealer stabilisierend, darunter verstärkend. Siehe den Leitfaden zur Gamma-Flip-Berechnung für die vollständige Methodik.',
    wallsExplainedQ: 'Was sind Call Wall und Put Wall?',
    wallsExplainedA:
      'Die Strikes mit dem größten Call-Gamma bzw. Put-Gamma. Sie wirken tendenziell als Intraday-Widerstand und -Unterstützung, besonders bei positivem Gamma. Die Walls wandern im Tagesverlauf, während Flow hereinkommt — diese Wanderung zu beobachten ist an sich schon aufschlussreich.',
    maxPainReliabilityQ: 'Was ist Max Pain, und wie zuverlässig ist es?',
    maxPainReliabilityA:
      'Max Pain ist der Strike, der den Gesamtauszahlungsbetrag für Optionskäufer bei Verfall minimiert. Am zuverlässigsten ist es in den letzten 24–48 Stunden vor einem bedeutenden Verfall, besonders bei 0DTE auf SPX. Die ehrliche Einschätzung ist, dass der "Gamma-Magnet" — die Wall-Struktur — meist den Pin treibt, nicht das Auszahlungsargument der Käufer allein. Siehe den Max-Pain-Artikel für die ausführliche Analyse.',
    flowExplainedQ: 'Was bedeutet "premium-gewichteter" Flow?',
    flowExplainedA:
      'Premium-gewichteter Flow multipliziert das Kontraktvolumen mit der gezahlten Prämie. Es ist die Überzeugungs-Kennzahl — ein Trader, der 500 $ pro Kontrakt zahlt, geht eine echte Wette ein; ein Trader, der 0,05-$-Lotto-Tickets scalpt, tut das nicht. Rohes Volumen behandelt beide gleich; premium-gewichteter Flow nicht.',
    pricingModelQ: 'Welches Pricing-Modell verwendet der Strategy Builder?',
    pricingModelA:
      'Black-Scholes mit der aktiven impliziten Volatilitätsoberfläche in Echtzeit. Für SPX (europäische Ausübung) wird keine Anpassung vorgenommen. Für SPY und QQQ (amerikanische Ausübung) fügen wir bei Deep-ITM-Legs nahe dem Verfall eine Prämie für vorzeitige Ausübung hinzu.',

    supportTitle: 'Support &amp; Kontakt',
    supportBlurb: 'Wie du uns erreichst, wenn du einen Menschen brauchst.',
    howToContactQ: 'Wie bekomme ich Hilfe?',
    howToContactA:
      'Schreibe an support@zerogex.io. Wir antworten schnell — meist noch am selben Handelstag. Gib die URL der Seite an, auf der du warst, bei Bedarf einen Screenshot, deinen Browser und dein Betriebssystem sowie (bei Abrechnungsfragen) deine Konto-E-Mail.',
    featureRequestsQ: 'Nehmt ihr Funktionswünsche entgegen?',
    featureRequestsA:
      'Ja. Schreibe an support@zerogex.io mit dem Wunsch und wie du ihn nutzen würdest. Wir priorisieren im Verhältnis zur bestehenden Roadmap.',
    bugReportsQ: 'Ich glaube, ich habe einen Bug gefunden.',
    bugReportsA:
      'Schreibe an support@zerogex.io mit der Seite, den Schritten zur Reproduktion, dem erwarteten gegenüber dem tatsächlichen Verhalten, Browser, Betriebssystem und einem ungefähren Zeitstempel. Je konkreter der Bericht, desto schneller können wir es angehen.',
    phishingQ: 'Ich habe eine verdächtige E-Mail erhalten, die angeblich von ZeroGEX stammt.',
    phishingA:
      'Wir senden von zerogex.io und noreply@zerogex.io (und gelegentlich support@zerogex.io). Wir werden dich niemals per E-Mail nach deinem Passwort oder Session-Token fragen. Wenn etwas verdächtig wirkt, leite es an support@zerogex.io weiter, und wir bestätigen oder markieren es.',
  },
  es: {
    backToHelp: 'Volver al Centro de ayuda',
    faqsBadge: 'Preguntas frecuentes',
    heading: 'Preguntas frecuentes',
    description:
      'Respuestas claras a las preguntas que los traders hacen con más frecuencia. Usa el cuadro de búsqueda para ir directo a una pregunta, o explora por categoría.',
    searchPlaceholder: 'Buscar en las preguntas frecuentes...',
    noMatch: 'Ninguna pregunta coincide con tu búsqueda.',
    tryDifferent: 'Prueba una búsqueda diferente, o',
    emailSupport: 'escribe a soporte',
    didntFind: '¿No encontraste tu respuesta?',
    realQuestions: 'Las preguntas reales no siempre encajan en una categoría. Escribe a',
    usuallyAnswer: '— normalmente respondemos el mismo día de trading.',

    gettingStartedTitle: 'Primeros pasos',
    gettingStartedBlurb: '¿Nuevo en ZeroGEX? Empieza aquí.',
    whatIsZerogexQ: '¿Qué es ZeroGEX?',
    whatIsZerogexA:
      'ZeroGEX es una plataforma de análisis de opciones en tiempo real construida alrededor del posicionamiento de los dealers. Te muestra dónde los dealers están largos o cortos de gamma, dónde se encuentra el gamma flip, dónde están los call wall y put wall, y ejecuta un conjunto de señales en tiempo real sobre todo eso. La idea es darte la misma perspectiva que usan los market makers para hacer hedging, para que puedas leer la acción del precio intradía en esos términos.',
    whoItsForQ: '¿Para quién está pensado ZeroGEX?',
    whoItsForA:
      'Traders intradía activos que operan SPY, SPX o QQQ y quieren una lectura estructural del mercado de opciones. Day traders, swing traders con timing intradía, quants que quieren datos de señales vía API, y estrategas de venta de opciones para quienes el posicionamiento de los dealers es el insumo diario. No somos una herramienta de análisis de acciones individuales.',
    doINeedToSignUpQ: '¿Necesito registrarme para usar ZeroGEX?',
    doINeedToSignUpA:
      'Las páginas gratuitas de Gamma Levels — SPX, SPY y QQQ — están abiertas a cualquiera sin cuenta: el gamma flip, los call y put wall, el max pain y el perfil de gamma de los dealers, con un retraso de unos 15 minutos. El sitio de marketing, el Education Hub, los artículos y las guías también son de acceso libre. El Dashboard completo en tiempo real, las señales, métricas, herramientas de estrategia y el Live Bulletin requieren un plan de pago (Basic o Pro). Consulta la página de Precios para el detalle actual de niveles.',
    freeTrialQ: '¿Hay una prueba gratuita?',
    freeTrialA:
      'Sí. Tanto Basic como Pro incluyen una prueba gratuita. La duración de la prueba aparece en la página de Precios. Al finalizar la prueba, la suscripción continúa automáticamente a la tarifa con la que te registraste. Cancela antes de que termine la prueba para evitar el cargo.',
    firstPageQ: '¿Qué página debería abrir primero?',
    firstPageA:
      'El Dashboard. Muestra la etiqueta de régimen, el net GEX, el gamma flip, los walls, el max pain, el composite score y el chip de sesgo de trade del día — todo lo que necesitas para orientarte. Desde ahí, entra en la página de la señal que corresponda a lo que buscas.',

    dataRefreshTitle: 'Datos &amp; Actualización',
    dataRefreshBlurb: 'Cobertura, cadencia y cómo funciona el streaming.',
    symbolsQ: '¿Qué símbolos se soportan actualmente?',
    symbolsA:
      'ZeroGEX ofrece cobertura analítica completa para SPY (ETF del S&P 500), SPX (Índice S&P 500) y QQQ (ETF del Nasdaq 100). Son los tres subyacentes más líquidos y con mayor gamma del mercado de opciones de EE. UU. — los instrumentos donde la actividad de hedging de los dealers tiene el mayor impacto intradía.',
    singleNamesQ: '¿Añadirán acciones individuales (AAPL, TSLA, NVDA, etc.)?',
    singleNamesA:
      'No está en la hoja de ruta. El modelo de posicionamiento de dealers funciona mejor en instrumentos donde el flujo institucional de opciones domina el subyacente — es decir, el complejo de índices. Las acciones individuales tienen ruido de noticias idiosincráticas que hace que la lectura del GEX sea menos confiable.',
    futuresQ: '¿Puedo usar ZeroGEX para operar futuros como ES, MES, NQ o MNQ?',
    futuresA:
      'Sí — mapeas el futuro a su libro de índice. /ES y /MES siguen los niveles gamma de SPX (y SPY); /NQ y /MNQ siguen hoy a QQQ, con NDX próximamente. Los niveles estructurales son idénticos; solo cambia la escala de precio. Cuando el índice de contado está cerrado, el Live Bulletin ya muestra el precio implícito de los futuros ES/NQ como contexto. Traducir los niveles directamente a precios de futuros está en la hoja de ruta.',
    refreshCadenceQ: '¿Con qué frecuencia se actualizan los datos?',
    refreshCadenceA:
      'Las cotizaciones y el flow se actualizan cada ~1 segundo durante el horario regular. Los scores de señales se actualizan cada 1–5 segundos según la señal. La superficie GEX se actualiza cada 5–15 segundos (el snapshot de la cadena es el cuello de botella). Todo funciona en streaming — no necesitas recargar la página.',
    preMarketQ: '¿ZeroGEX muestra datos de pre-market y after-hours?',
    preMarketA:
      'Sí. El panel de precio muestra las cotizaciones fuera de horario junto con el cierre de la sesión regular anterior para contexto. Algunas señales (EOD Pressure, 0DTE Position Imbalance) solo se calculan durante la sesión regular por diseño.',
    dataSourceQ: '¿De dónde provienen los datos?',
    dataSourceA:
      'ZeroGEX utiliza datos de opciones del feed OPRA (la cinta consolidada de opciones de EE. UU.) más el feed de cotización del subyacente. Ambas son fuentes de datos profesionales de nivel institucional en tiempo real. No divulgamos públicamente los nombres específicos de los proveedores.',
    historyDepthQ: '¿Hasta dónde llega el histórico de datos?',
    historyDepthA:
      'Las cotizaciones y el flow tienen varios años de barras históricas. Los scores de señales se calculan retroactivamente hasta el origen de cada señal. Las superficies GEX tienen historial de snapshots diarios; el historial de GEX intradía es más corto. La página de Backtesting muestra el rango disponible para la señal que selecciones.',

    signalsCatTitle: 'Señales',
    signalsCatBlurb: 'Cómo funcionan los scores, qué significan los triggers y cómo usarlos.',
    howManySignalsQ: '¿Cuántas señales ejecuta ZeroGEX?',
    howManySignalsA:
      'Catorce en total — ocho Advanced (basadas en eventos, con triggers discretos) y seis Basic (continuas, alimentan el composite). Consulta la guía Signals: Explained para la matriz de referencia completa.',
    advancedVsBasicQ: '¿Cuál es la diferencia entre señales Advanced y Basic?',
    advancedVsBasicA:
      'Las señales Advanced plantean una pregunta situacional precisa y disparan un trigger discreto cuando su score cruza un umbral. Las señales Basic son lecturas continuas que alimentan el composite score con un peso fijo. Las señales Advanced disparan; las señales Basic ponderan.',
    scoreZeroQ: '¿Qué significa un score de señal igual a 0?',
    scoreZeroA:
      'Casi nunca "mercado neutral". Para la mayoría de las señales significa que los datos son insuficientes o que esta pregunta específica no tiene respuesta en este momento. Lee un 0 como "sin lectura", no como "sin trade". Un mercado verdaderamente neutral típicamente muestra scores que oscilan alrededor de ±0,1, no un cero limpio.',
    compositeScoreQ: '¿Qué es el Composite Score?',
    compositeScoreA:
      'El Composite Score (internamente MSI) es la lectura combinada de todas las señales sobre el símbolo activo. Vive en la misma línea [-1, +1] que cada señal individual. Positivo ⇒ inclinación estructural alcista; negativo ⇒ bajista. La magnitud es la convicción. Úsalo como filtro, no como pronóstico.',
    signalAlertsQ: '¿Recibo alertas cuando se disparan las señales?',
    signalAlertsA:
      'Dentro de la app, sí. Cada trigger aparece en el Live Bulletin y enciende la tarjeta de señal correspondiente. ZeroGEX actualmente no envía alertas de señales por SMS, push o correo electrónico — el registro dentro de la app es el sistema oficial. Podríamos añadir más canales si hay demanda.',
    signalAccuracyQ: '¿Qué tan precisas son las señales?',
    signalAccuracyA:
      'Depende de la señal, del régimen y de cómo la uses. Las señales no son tickets de trade independientes — son filtros y triggers dentro de un proceso. La página de Backtesting te permite reproducir cualquier señal contra datos históricos con tus propias reglas. Recomendamos encarecidamente una validación fuera de muestra antes de implementar cualquier regla.',

    tiersBillingTitle: 'Niveles &amp; Facturación',
    tiersBillingBlurb: 'Planes, precios, reembolsos y gestión de tu suscripción.',
    tiersQ: '¿Cuáles son las diferencias entre niveles?',
    tiersA:
      'Public es la experiencia gratuita, solo de navegación (sitio de marketing + educación). Basic desbloquea el Dashboard, el Live Bulletin, todas las Métricas, las Herramientas de Estrategia y todas las Señales Basic. Pro añade todas las Señales Advanced, el Composite Score, Backtesting y acceso a la API. La página de Precios tiene el detalle actualizado.',
    monthlyVsAnnualQ: '¿Debería pagar mensual o anual?',
    monthlyVsAnnualA:
      'El anual tiene un descuento significativo frente al mensual — la tarifa exacta está en la página de Precios. La mayoría de los usuarios activos cambian a anual después de un par de meses. Puedes cambiar en el portal de facturación de Stripe en cualquier momento; el prorrateo se calcula automáticamente.',
    switchPlanQ: '¿Cómo cambio mi plan (nivel o mensual/anual)?',
    switchPlanA:
      'Abre la página de Cuenta y haz clic en "Manage subscription" para abrir el portal de facturación de Stripe — ahí puedes moverte entre Basic y Pro y entre mensual y anual. Las mejoras (y el paso de mensual a anual) tienen efecto inmediato; las bajadas de nivel y el paso de anual a mensual tienen efecto al final de tu período actual, así que mantienes lo que ya pagaste hasta entonces. El prorrateo se aplica y aparece en tu próxima factura, no como cargo anticipado. Si aún estás en tu prueba gratuita, cambiar mantiene la prueba — no se te cobrará hasta que termine, y luego se te facturará la tarifa del nuevo plan.',
    tierUpgradeQ: '¿Cómo actualizo de Basic a Pro?',
    tierUpgradeA:
      'Abre la página de Cuenta, haz clic en "Manage subscription" para abrir el portal de facturación de Stripe, y cambia de nivel ahí. El acceso al nivel se actualiza de inmediato; la diferencia prorrateada se aplica en tu próxima factura.',
    cancellationQ: '¿Cómo cancelo?',
    cancellationA:
      'A través del portal de facturación de Stripe, accesible desde la página de Cuenta. La cancelación tiene efecto al final del período de facturación actual — conservas el acceso pagado hasta entonces. Después, tu nivel vuelve a Public; tu cuenta no se elimina.',
    refundsQ: '¿Ofrecen reembolsos?',
    refundsA:
      'La prueba es incondicional — cancela antes de que termine y nunca se te cobrará nada. Las suscripciones pagas se facturan por adelantado y no se prorratean al cancelar por defecto. Para excepciones y casos particulares, escribe a support@zerogex.io y lo resolveremos.',
    billingIssueQ: 'Mi pago falló. ¿Qué hago ahora?',
    billingIssueA:
      'Stripe reintenta automáticamente durante varios días. Durante la ventana de reintento, tu suscripción está "vencida" y las funciones pagas siguen disponibles. Actualiza el método de pago en el portal para resolverlo. Los fallos más comunes son tarjetas caducadas y discrepancias en la verificación de dirección.',
    referralsQ: '¿Cómo funciona el programa de referidos?',
    referralsA:
      'Si está habilitado para tu cuenta, la página de Cuenta muestra un panel de Referidos con tu código, enlace y posición. Cualquiera que se registre usando tu código y pase a un plan pago te da un crédito en tu próxima factura. Los créditos se acumulan entre referidos y se aplican automáticamente.',

    platformUsageTitle: 'Uso de la plataforma',
    platformUsageBlurb: 'Preguntas prácticas sobre el flujo de trabajo diario.',
    dashboardWorkflowQ: '¿Cuál es el flujo de trabajo correcto para usar ZeroGEX durante un día de trading?',
    dashboardWorkflowA:
      'Empieza simple. En el Dashboard, lee primero los tres niveles más importantes: el Gamma Flip (régimen estabilizador vs. amplificador), luego el Call Wall y el Put Wall (tu probable fricción al alza y a la baja). Abre el GEX Strike Profile para ver cómo se posiciona esa estructura respecto al precio, y luego confirma con tu propia acción de precio — VWAP, la ruptura del rango de apertura, lo que ya te resulte confiable. Mantén el Live Bulletin abierto en una segunda pestaña para los eventos de trigger. Los niveles te dicen dónde prestar atención; tus triggers de ejecución te dicen cuándo. No intentes vigilar las catorce señales a la vez el primer día.',
    multipleSymbolsQ: '¿Puedo ver varios símbolos a la vez?',
    multipleSymbolsA:
      'Cada pestaña del navegador puede mostrar un símbolo. Para ver SPY, SPX y QQQ en paralelo, abre tres pestañas. El selector de símbolo está en la cabecera.',
    mobileSupportQ: '¿ZeroGEX funciona en móvil?',
    mobileSupportA:
      'Sí — todas las páginas son responsivas. Pero la plataforma está diseñada para escritorio. La densidad de los gráficos asume una pantalla ancha. En móvil, el dashboard funciona bien para monitorear; las páginas con múltiples gráficos complejos son más densas de lo ideal.',
    browserCompatQ: '¿Qué navegadores son compatibles?',
    browserCompatA:
      'Chrome, Edge, Firefox y Safari siempre actualizados. Las versiones antiguas funcionarán técnicamente pero no recibirán las optimizaciones de rendimiento. Los bloqueadores de anuncios y scripts agresivos a veces interrumpen la conexión de streaming — añade zerogex.io a la lista blanca si es necesario.',
    pageStaleQ: 'Una página se ve desactualizada o congelada. ¿Qué hago?',
    pageStaleA:
      'Revisa el chip de conexión en la cabecera. Si permanece rojo tras varias recargas, haz una recarga forzada (Cmd+Shift+R / Ctrl+Shift+R). Si sigue trabado, prueba una ventana de incógnito. Si persiste, escribe a soporte con la URL de la página, tu navegador y la marca de tiempo.',
    optionsCalculatorQ: '¿Cómo funciona el Strategy Builder?',
    optionsCalculatorA:
      'El Strategy Builder te permite construir cualquier estrategia de opciones de una o varias piernas, valorarla en vivo con Black-Scholes contra la superficie de IV activa, y muestra las griegas más una superficie de escenarios de P&L. Es una herramienta de investigación, no un bróker — tú tomas la estructura y la implementas tú mismo.',

    accountTitle: 'Cuenta &amp; Inicio de sesión',
    accountBlurb: 'Autenticación, contraseñas y proveedores de identidad.',
    forgotPasswordQ: 'Olvidé mi contraseña.',
    forgotPasswordA:
      'Usa la página de Contraseña olvidada. Se envía un enlace de restablecimiento por correo; haz clic en él y define una nueva contraseña. Si el correo no llega, revisa el spam. Si te registraste con Google o Apple, no tienes contraseña — inicia sesión con ese proveedor en su lugar.',
    changeEmailQ: '¿Puedo cambiar el correo de mi cuenta?',
    changeEmailA:
      'El correo es el identificador de la cuenta y no se puede cambiar dentro de la app. Para cambiarlo, escribe a support@zerogex.io con verificación tanto de la dirección antigua como de la nueva.',
    googleAppleQ: '¿Puedo iniciar sesión con Google o Apple?',
    googleAppleA:
      'Sí. Se admite el inicio de sesión con Google y con Apple. Puedes vincular varios proveedores a la misma cuenta desde la página de Cuenta. Si quieres una contraseña como respaldo, también puedes configurarla desde la página de Cuenta.',
    twoFactorQ: '¿ZeroGEX admite autenticación de dos factores?',
    twoFactorA:
      'Para los inicios de sesión con Google y Apple, usas el 2FA del proveedor. Para el inicio de sesión con contraseña, el 2FA en la propia cuenta de ZeroGEX no está actualmente soportado — usar Google o Apple es la vía recomendada para mayor seguridad.',
    emailVerificationQ: 'Nunca recibí el mensaje de verificación de correo.',
    emailVerificationA:
      'Revisa primero el spam. Haz clic en "Resend verification" en el banner dentro de la app. Si varios reenvíos no llegan, la dirección puede estar mal escrita o tu servidor de correo puede estar rechazando nuestro dominio — escribe a support@zerogex.io desde la dirección en cuestión.',
    deleteAccountQ: '¿Cómo elimino mi cuenta?',
    deleteAccountA:
      'Escribe a support@zerogex.io. La eliminación de la cuenta cancela cualquier suscripción activa y elimina los datos de la cuenta conforme a la política de Privacidad. Confirmamos por correo antes de procesarlo.',

    apiTitle: 'API &amp; Desarrolladores',
    apiBlurb: 'Para cuando quieres los datos de forma programática.',
    apiPublicQ: '¿La API es de acceso público?',
    apiPublicA:
      'La documentación de la API está en api.zerogex.io/docs y requiere una cuenta Pro. El acceso a la API — incluida la generación y el uso de claves — es una función del nivel Pro. Los usuarios Public y Basic no tienen acceso programático.',
    apiDocsFormatQ: '¿En qué formato están los documentos de la API?',
    apiDocsFormatA:
      'OpenAPI 3.0. Están disponibles tanto la vista de Swagger UI (interactiva) como ReDoc (solo lectura). Las respuestas son en JSON.',
    apiRateLimitsQ: '¿Cuáles son los límites de tasa de la API?',
    apiRateLimitsA:
      'Las cuentas Pro obtienen límites generosos por minuto y por día, suficientes para dashboards de producción y bots que respeten una higiene normal de solicitudes. Las respuestas que exceden el límite devuelven 429 con un encabezado Retry-After.',
    apiKeysQ: 'Estoy en Pro — ¿cómo obtengo mi clave de API?',
    apiKeysA:
      'El acceso a la API es una función Pro. La generación de claves de autoservicio desde tu página de Cuenta está en camino; hasta que se lance, las claves se emiten manualmente — escribe a support@zerogex.io desde la dirección de tu cuenta y te enviaremos una clave junto con notas de configuración. Úsala como <code>Authorization: Bearer &lt;key&gt;</code> en cada solicitud. Escríbenos para rotar o revocar una clave.',
    apiStreamingQ: '¿Hay un endpoint de streaming o un websocket?',
    apiStreamingA:
      'Actualmente no se expone públicamente. La plataforma web usa un canal interno. Para la mayoría de los casos de uso, hacer polling a una cadencia razonable (cada pocos segundos para métricas en vivo) es suficiente.',

    methodologyTitle: 'Metodología',
    methodologyBlurb: 'Cómo se calculan realmente los números.',
    whatIsGexQ: '¿Qué es la Gamma Exposure (GEX) y por qué importa?',
    whatIsGexA:
      'El GEX es la sensibilidad agregada de los hedges delta de los dealers de opciones ante movimientos de precio en el subyacente. Cuando los dealers están largos de gamma (net GEX positivo en el spot), venden los rallies y compran las caídas — un efecto amortiguador sobre la volatilidad. Cuando están cortos de gamma, persiguen el precio — un efecto amplificador. Conocer el régimen de GEX te dice si el mercado tiende a revertir a la media o a hacer tendencia.',
    gammaFlipQ: '¿Cómo se calcula el nivel del Gamma Flip?',
    gammaFlipA:
      'El flip es el nivel en el que la curva de gamma de los dealers cruza cero — calculado a partir de un perfil de gamma de dealers por desplazamiento de spot, no de una aproximación de GEX neto acumulado. Por encima del flip, el hedging de los dealers es estabilizador; por debajo, amplificador. Consulta la guía de cálculo del Gamma Flip para la metodología completa.',
    wallsExplainedQ: '¿Qué son el call wall y el put wall?',
    wallsExplainedA:
      'Los strikes con el mayor gamma de calls y de puts respectivamente. Tienden a actuar como resistencia y soporte intradía, especialmente en gamma positivo. Los walls migran durante el día a medida que llega flow — observar esa migración es informativo por sí solo.',
    maxPainReliabilityQ: '¿Qué es el Max Pain, y qué tan confiable es?',
    maxPainReliabilityA:
      'El max pain es el strike que minimiza el pago total a los compradores de opciones al vencimiento. Es más confiable en las últimas 24–48 horas antes de un vencimiento importante, especialmente para 0DTE en SPX. La lectura honesta es que el "imán de gamma" — la estructura de walls — suele impulsar el pin, no el argumento del pago a los compradores por sí solo. Consulta el artículo sobre Max Pain para el análisis a fondo.',
    flowExplainedQ: '¿Qué es el flow "ponderado por prima"?',
    flowExplainedA:
      'El flow ponderado por prima multiplica el volumen de contratos por la prima pagada. Es la lectura de convicción — un trader que paga $500/contrato está haciendo una apuesta real; un trader que hace scalping de tickets de lotería de $0.05 no lo está. El volumen bruto los trata igual; el flow ponderado por prima no.',
    pricingModelQ: '¿Qué modelo de precios usa el Strategy Builder?',
    pricingModelA:
      'Black-Scholes con la superficie de volatilidad implícita en vivo. Para SPX (ejercicio europeo) no se aplica ajuste alguno. Para SPY y QQQ (ejercicio americano) añadimos una prima de ejercicio anticipado en piernas deep-ITM cerca del vencimiento.',

    supportTitle: 'Soporte &amp; Contacto',
    supportBlurb: 'Cómo contactarnos cuando necesitas hablar con una persona.',
    howToContactQ: '¿Cómo obtengo ayuda?',
    howToContactA:
      'Escribe a support@zerogex.io. Respondemos rápido — normalmente el mismo día de trading. Incluye la URL de la página en la que estabas, una captura de pantalla si es relevante, tu navegador y sistema operativo y (para temas de facturación) el correo de tu cuenta.',
    featureRequestsQ: '¿Aceptan solicitudes de funciones?',
    featureRequestsA:
      'Sí. Escribe a support@zerogex.io con la solicitud y cómo la usarías. Priorizamos frente a la hoja de ruta existente.',
    bugReportsQ: 'Creo que encontré un error.',
    bugReportsA:
      'Escribe a support@zerogex.io con la página, los pasos para reproducirlo, el comportamiento esperado frente al real, navegador, sistema operativo y una marca de tiempo aproximada. Cuanto más específico sea el reporte, más rápido podremos atenderlo.',
    phishingQ: 'Recibí un correo sospechoso que dice ser de ZeroGEX.',
    phishingA:
      'Enviamos correos desde zerogex.io y noreply@zerogex.io (y ocasionalmente support@zerogex.io). Nunca te pediremos tu contraseña o token de sesión por correo. Si algo parece sospechoso, reenvíalo a support@zerogex.io y lo confirmaremos o marcaremos.',
  },
  fr: {
    backToHelp: "Retour au Centre d'aide",
    faqsBadge: 'FAQ',
    heading: 'Questions fréquentes',
    description:
      'Des réponses claires aux questions que les traders posent le plus souvent. Utilisez la barre de recherche pour accéder directement à une question, ou parcourez par catégorie.',
    searchPlaceholder: 'Rechercher dans les FAQ...',
    noMatch: 'Aucune FAQ ne correspond à votre recherche.',
    tryDifferent: "Essayez une autre recherche, ou",
    emailSupport: 'contactez le support',
    didntFind: "Vous n'avez pas trouvé votre réponse ?",
    realQuestions: "Les vraies questions ne rentrent pas toujours dans une catégorie. Écrivez à",
    usuallyAnswer: '— nous répondons généralement le jour même.',

    gettingStartedTitle: 'Pour commencer',
    gettingStartedBlurb: 'Nouveau sur ZeroGEX ? Commencez ici.',
    whatIsZerogexQ: "Qu'est-ce que ZeroGEX ?",
    whatIsZerogexA:
      "ZeroGEX est une plateforme d'analyse d'options en temps réel construite autour du positionnement des dealers. Elle vous montre où les dealers sont long ou short gamma, où se situe le gamma flip, où se trouvent les call wall et put wall, et exécute une série de signaux en temps réel par-dessus tout cela. L'objectif est de vous donner le même regard que celui des market makers pour couvrir leurs positions, afin que vous puissiez lire l'action des prix intrajournalière dans ces termes.",
    whoItsForQ: 'À qui ZeroGEX est-il destiné ?',
    whoItsForA:
      "Aux traders intrajournaliers actifs qui négocient SPY, SPX ou QQQ et veulent une lecture structurelle du marché des options. Day traders, swing traders avec un timing intrajournalier, quants qui veulent des données de signaux via API, et stratèges de vente d'options pour qui le positionnement des dealers est l'intrant quotidien. Nous ne sommes pas un outil de recherche sur les actions individuelles.",
    doINeedToSignUpQ: "Dois-je m'inscrire pour utiliser ZeroGEX ?",
    doINeedToSignUpA:
      "Les pages gratuites Gamma Levels — SPX, SPY et QQQ — sont accessibles à tous sans compte : le gamma flip, les call et put wall, le max pain et le profil de gamma des dealers, avec un délai d'environ 15 minutes. Le site marketing, l'Education Hub, les articles et les guides sont également en accès libre. Le Dashboard complet en temps réel, les signaux, les métriques, les outils de stratégie et le Live Bulletin nécessitent un forfait payant (Basic ou Pro). Consultez la page Tarifs pour le détail actuel des niveaux.",
    freeTrialQ: "Y a-t-il un essai gratuit ?",
    freeTrialA:
      "Oui. Basic et Pro comprennent tous les deux un essai gratuit. La durée de l'essai est indiquée sur la page Tarifs. À la fin de l'essai, l'abonnement se poursuit automatiquement au tarif auquel vous vous êtes inscrit. Annulez avant la fin de l'essai pour éviter d'être facturé.",
    firstPageQ: 'Quelle page devrais-je ouvrir en premier ?',
    firstPageA:
      "Le Dashboard. Il affiche l'étiquette de régime, le net GEX, le gamma flip, les walls, le max pain, le composite score et le chip de biais de trade du jour — tout ce dont vous avez besoin pour vous orienter. À partir de là, approfondissez avec la page de signal qui correspond à ce que vous recherchez.",

    dataRefreshTitle: 'Données &amp; Actualisation',
    dataRefreshBlurb: 'Couverture, cadence et fonctionnement du streaming.',
    symbolsQ: 'Quels symboles sont actuellement pris en charge ?',
    symbolsA:
      "ZeroGEX offre une couverture analytique complète pour SPY (ETF S&P 500), SPX (indice S&P 500) et QQQ (ETF Nasdaq 100). Ce sont les trois sous-jacents les plus liquides et les plus riches en gamma du marché des options américain — les instruments où l'activité de hedging des dealers a le plus grand impact intrajournalier.",
    singleNamesQ: 'Ajouterez-vous des actions individuelles (AAPL, TSLA, NVDA, etc.) ?',
    singleNamesA:
      "Pas au programme. Le modèle de positionnement des dealers fonctionne le mieux sur les instruments où le flux d'options institutionnel domine le sous-jacent — c'est-à-dire le complexe des indices. Les actions individuelles présentent un bruit lié à l'actualité idiosyncrasique qui rend la lecture du GEX moins fiable.",
    futuresQ: 'Puis-je utiliser ZeroGEX pour trader des futures comme ES, MES, NQ ou MNQ ?',
    futuresA:
      "Oui — vous associez le future à son carnet d'indice. /ES et /MES suivent les niveaux gamma de SPX (et SPY) ; /NQ et /MNQ suivent aujourd'hui QQQ, avec NDX à venir. Les niveaux structurels sont identiques ; seule l'échelle de prix diffère. Lorsque l'indice cash est fermé, le Live Bulletin affiche déjà le prix implicite des futures ES/NQ pour référence. Traduire directement les niveaux en prix de futures est au programme.",
    refreshCadenceQ: 'À quelle fréquence les données sont-elles actualisées ?',
    refreshCadenceA:
      "Les cotations et le flow s'actualisent environ toutes les secondes pendant les heures régulières. Les scores de signaux s'actualisent toutes les 1 à 5 secondes selon le signal. La surface GEX s'actualise toutes les 5 à 15 secondes (le snapshot de la chaîne est le goulot d'étranglement). Tout fonctionne en streaming — vous n'avez pas besoin de recharger la page.",
    preMarketQ: 'ZeroGEX affiche-t-il les données pré-marché et après-clôture ?',
    preMarketA:
      "Oui. La vignette de prix affiche les cotations hors séance aux côtés de la clôture de la séance régulière précédente pour le contexte. Certains signaux (EOD Pressure, 0DTE Position Imbalance) ne se calculent volontairement que pendant la séance régulière.",
    dataSourceQ: "D'où viennent les données ?",
    dataSourceA:
      "ZeroGEX utilise des données d'options provenant du flux OPRA (le tape consolidé des options américaines), ainsi que le flux de cotation du sous-jacent. Les deux sont des sources de données professionnelles de niveau institutionnel en temps réel. Nous ne divulguons pas publiquement les noms spécifiques des fournisseurs.",
    historyDepthQ: "Jusqu'où remonte l'historique des données ?",
    historyDepthA:
      "Les cotations et le flow disposent de plusieurs années de barres historiques. Les scores de signaux sont reconstitués jusqu'à la création de chaque signal. Les surfaces GEX ont un historique de snapshots quotidiens ; l'historique GEX intrajournalier est plus court. La page Backtesting affiche la plage disponible pour le signal choisi.",

    signalsCatTitle: 'Signaux',
    signalsCatBlurb: 'Comment fonctionnent les scores, ce que signifient les triggers et comment les utiliser.',
    howManySignalsQ: 'Combien de signaux ZeroGEX exécute-t-il ?',
    howManySignalsA:
      'Quatorze en tout — huit Advanced (basés sur des événements, avec des triggers discrets) et six Basic (continus, alimentant le composite). Voir le guide Signals: Explained pour la matrice de référence complète.',
    advancedVsBasicQ: 'Quelle est la différence entre les signaux Advanced et Basic ?',
    advancedVsBasicA:
      'Les signaux Advanced posent une question situationnelle précise et déclenchent un trigger discret lorsque leur score franchit un seuil. Les signaux Basic sont des lectures continues qui alimentent le composite score avec un poids fixe. Les signaux Advanced déclenchent ; les signaux Basic pondèrent.',
    scoreZeroQ: 'Que signifie un score de signal de 0 ?',
    scoreZeroA:
      'Presque jamais « marché neutre ». Pour la plupart des signaux, cela signifie que les données sont insuffisantes ou que cette question spécifique n\'a pas de réponse pour le moment. Lisez un 0 comme « pas de lecture », pas comme « pas de trade ». Un marché véritablement neutre affiche généralement des scores oscillant autour de ±0,1, pas un zéro net.',
    compositeScoreQ: "Qu'est-ce que le Composite Score ?",
    compositeScoreA:
      "Le Composite Score (en interne MSI) est la lecture combinée de tous les signaux sur le symbole actif. Il se situe sur la même échelle [-1, +1] que chaque signal individuel. Positif ⇒ inclinaison structurelle haussière ; négatif ⇒ baissière. L'amplitude reflète la conviction. Utilisez-le comme filtre, pas comme prévision.",
    signalAlertsQ: 'Suis-je alerté quand les signaux se déclenchent ?',
    signalAlertsA:
      "Dans l'application, oui. Chaque trigger apparaît dans le Live Bulletin et allume la carte de signal correspondante. ZeroGEX n'envoie pas actuellement d'alertes de signaux par SMS, push ou e-mail — le journal in-app est le registre officiel. Nous pourrions ajouter d'autres canaux si la demande existe.",
    signalAccuracyQ: 'Quelle est la précision des signaux ?',
    signalAccuracyA:
      "Cela dépend du signal, du régime et de la façon dont vous l'utilisez. Les signaux ne sont pas des tickets de trade autonomes — ce sont des filtres et des triggers au sein d'un processus. La page Backtesting vous permet de rejouer n'importe quel signal sur des données historiques avec vos propres règles. Nous recommandons vivement une validation hors échantillon avant de déployer une règle.",

    tiersBillingTitle: 'Niveaux &amp; Facturation',
    tiersBillingBlurb: 'Forfaits, tarifs, remboursements et gestion de votre abonnement.',
    tiersQ: 'Quelles sont les différences entre les niveaux ?',
    tiersA:
      "Public est l'expérience gratuite, en consultation uniquement (site marketing + éducation). Basic débloque le Dashboard, le Live Bulletin, toutes les Métriques, les outils de Stratégie et tous les signaux Basic. Pro ajoute tous les signaux Advanced, le Composite Score, le Backtesting et l'accès API. La page Tarifs présente le détail à jour.",
    monthlyVsAnnualQ: 'Dois-je payer mensuellement ou annuellement ?',
    monthlyVsAnnualA:
      "L'annuel est nettement réduit par rapport au mensuel — le taux exact figure sur la page Tarifs. La plupart des utilisateurs actifs passent à l'annuel après quelques mois. Vous pouvez changer dans le portail de facturation Stripe à tout moment ; le prorata gère automatiquement les calculs.",
    switchPlanQ: 'Comment changer mon forfait (niveau ou mensuel/annuel) ?',
    switchPlanA:
      "Ouvrez la page Compte et cliquez sur « Manage subscription » pour ouvrir le portail de facturation Stripe — vous pouvez y passer entre Basic et Pro, et entre mensuel et annuel. Les montées de gamme (et le passage mensuel → annuel) prennent effet immédiatement ; les rétrogradations et le passage annuel → mensuel prennent effet à la fin de votre période en cours, afin que vous conserviez ce que vous avez déjà payé jusqu'alors. Le prorata est appliqué et apparaît sur votre prochaine facture, pas comme une charge anticipée. Si vous êtes encore en période d'essai gratuite, le changement conserve l'essai — vous ne serez facturé qu'à la fin de celui-ci, puis au tarif du nouveau forfait.",
    tierUpgradeQ: 'Comment passer de Basic à Pro ?',
    tierUpgradeA:
      "Ouvrez la page Compte, cliquez sur « Manage subscription » pour ouvrir le portail de facturation Stripe, et changez de niveau à cet endroit. L'accès au niveau est mis à jour immédiatement ; la différence au prorata est appliquée sur votre prochaine facture.",
    cancellationQ: 'Comment annuler ?',
    cancellationA:
      "Via le portail de facturation Stripe, accessible depuis la page Compte. L'annulation prend effet à la fin de la période de facturation en cours — vous conservez l'accès payant jusque là. Ensuite, votre niveau revient à Public ; votre compte n'est pas supprimé.",
    refundsQ: 'Proposez-vous des remboursements ?',
    refundsA:
      "L'essai est inconditionnel — annulez avant sa fin et vous ne serez jamais facturé. Les abonnements payants sont facturés à l'avance et ne sont pas remboursés au prorata en cas d'annulation par défaut. Pour les exceptions et cas particuliers, écrivez à support@zerogex.io et nous trouverons une solution.",
    billingIssueQ: 'Mon paiement a échoué. Que faire maintenant ?',
    billingIssueA:
      "Stripe retente automatiquement sur plusieurs jours. Pendant la fenêtre de nouvelles tentatives, votre abonnement est « en retard » et les fonctionnalités payantes restent accessibles. Mettez à jour le moyen de paiement dans le portail pour résoudre le problème. Les échecs les plus fréquents sont les cartes expirées et les décalages de vérification d'adresse.",
    referralsQ: 'Comment fonctionne le programme de parrainage ?',
    referralsA:
      "S'il est activé pour votre compte, la page Compte affiche un panneau Parrainage avec votre code, votre lien et votre classement. Toute personne qui s'inscrit avec votre code et passe à un forfait payant vous rapporte un crédit sur votre prochaine facture. Les crédits s'accumulent entre les parrainages et s'appliquent automatiquement.",

    platformUsageTitle: 'Utilisation de la plateforme',
    platformUsageBlurb: 'Questions pratiques sur le flux de travail quotidien.',
    dashboardWorkflowQ: "Quel est le bon flux de travail pour utiliser ZeroGEX pendant une journée de trading ?",
    dashboardWorkflowA:
      "Commencez simplement. Sur le Dashboard, lisez d'abord les trois niveaux les plus importants : le Gamma Flip (régime stabilisateur vs. amplificateur), puis le Call Wall et le Put Wall (votre friction probable à la hausse et à la baisse). Ouvrez le GEX Strike Profile pour voir comment cette structure se positionne par rapport au prix, puis confirmez avec votre propre action des prix — VWAP, la rupture de la fourchette d'ouverture, tout ce en quoi vous avez déjà confiance. Gardez le Live Bulletin ouvert dans un second onglet pour les événements de trigger. Les niveaux vous disent où porter attention ; vos triggers d'exécution vous disent quand. N'essayez pas de surveiller les quatorze signaux à la fois le premier jour.",
    multipleSymbolsQ: 'Puis-je afficher plusieurs symboles à la fois ?',
    multipleSymbolsA:
      "Chaque onglet de navigateur peut afficher un symbole. Pour voir SPY, SPX et QQQ côte à côte, ouvrez trois onglets. Le sélecteur de symbole se trouve dans l'en-tête.",
    mobileSupportQ: 'ZeroGEX fonctionne-t-il sur mobile ?',
    mobileSupportA:
      "Oui — chaque page est responsive. Mais la plateforme est conçue pour le bureau. La densité des graphiques suppose un écran large. Sur mobile, le dashboard fonctionne bien pour la surveillance ; les pages complexes à plusieurs graphiques sont plus denses que l'idéal.",
    browserCompatQ: 'Quels navigateurs sont pris en charge ?',
    browserCompatA:
      "Chrome, Edge, Firefox et Safari à jour. Les versions plus anciennes fonctionneront techniquement mais n'obtiendront pas les optimisations de performance. Les bloqueurs de publicités et de scripts agressifs interrompent parfois la connexion de streaming — mettez zerogex.io en liste blanche si nécessaire.",
    pageStaleQ: 'Une page semble figée ou obsolète. Que faire ?',
    pageStaleA:
      "Vérifiez le chip de connexion dans l'en-tête. S'il reste rouge après plusieurs rechargements, effectuez un rechargement forcé (Cmd+Shift+R / Ctrl+Shift+R). Si le problème persiste, essayez une fenêtre de navigation privée. Si cela persiste encore, écrivez au support en indiquant l'URL de la page, votre navigateur et l'horodatage.",
    optionsCalculatorQ: 'Comment fonctionne le Strategy Builder ?',
    optionsCalculatorA:
      "Le Strategy Builder vous permet de construire n'importe quelle stratégie d'options à une ou plusieurs jambes, la valorise en direct avec Black-Scholes sur la surface d'IV active, et affiche les grecques ainsi qu'une surface de scénarios de P&L. C'est un outil de recherche, pas un courtier — vous prenez la structure et la mettez en place vous-même.",

    accountTitle: 'Compte &amp; Connexion',
    accountBlurb: "Authentification, mots de passe et fournisseurs d'identité.",
    forgotPasswordQ: "J'ai oublié mon mot de passe.",
    forgotPasswordA:
      "Utilisez la page Mot de passe oublié. Un lien de réinitialisation est envoyé par e-mail ; cliquez-le et définissez un nouveau mot de passe. Si l'e-mail n'arrive pas, vérifiez les spams. Si vous vous êtes inscrit avec Google ou Apple, vous n'avez pas de mot de passe — connectez-vous plutôt via le fournisseur.",
    changeEmailQ: "Puis-je changer l'e-mail de mon compte ?",
    changeEmailA:
      "L'e-mail est l'identifiant du compte et ne peut pas être modifié dans l'application. Pour le changer, écrivez à support@zerogex.io avec une vérification de l'ancienne et de la nouvelle adresse.",
    googleAppleQ: 'Puis-je me connecter avec Google ou Apple ?',
    googleAppleA:
      "Oui. La connexion via Google et via Apple sont toutes deux prises en charge. Vous pouvez lier plusieurs fournisseurs au même compte depuis la page Compte. Si vous souhaitez un mot de passe de secours, vous pouvez également le définir depuis la page Compte.",
    twoFactorQ: 'ZeroGEX prend-il en charge l\'authentification à deux facteurs ?',
    twoFactorA:
      "Pour les connexions via Google et Apple, vous utilisez le 2FA du fournisseur. Pour la connexion par mot de passe, le 2FA sur le compte ZeroGEX lui-même n'est pas actuellement pris en charge — utiliser Google ou Apple est la voie recommandée pour une sécurité renforcée.",
    emailVerificationQ: "Je n'ai jamais reçu le message de vérification d'e-mail.",
    emailVerificationA:
      "Vérifiez d'abord les spams. Cliquez sur « Resend verification » dans la bannière in-app. Si plusieurs renvois n'arrivent pas, l'adresse est peut-être mal orthographiée ou votre serveur de messagerie rejette notre domaine — écrivez à support@zerogex.io depuis l'adresse concernée.",
    deleteAccountQ: 'Comment supprimer mon compte ?',
    deleteAccountA:
      "Écrivez à support@zerogex.io. La suppression du compte annule tout abonnement actif et supprime les données du compte conformément à la politique de confidentialité. Nous confirmons par e-mail avant de procéder.",

    apiTitle: 'API &amp; Développeurs',
    apiBlurb: 'Pour quand vous voulez les données de façon programmatique.',
    apiPublicQ: "L'API est-elle accessible publiquement ?",
    apiPublicA:
      "La documentation de l'API se trouve sur api.zerogex.io/docs et nécessite un compte Pro. L'accès à l'API — y compris la génération et l'utilisation de clés — est une fonctionnalité de niveau Pro. Les utilisateurs Public et Basic n'ont pas d'accès programmatique.",
    apiDocsFormatQ: 'Dans quel format se trouve la documentation de l\'API ?',
    apiDocsFormatA:
      "OpenAPI 3.0. Les vues Swagger UI (interactive) et ReDoc (lecture seule) sont toutes deux disponibles. Les réponses sont en JSON.",
    apiRateLimitsQ: "Quelles sont les limites de débit de l'API ?",
    apiRateLimitsA:
      "Les comptes Pro bénéficient de plafonds généreux par minute et par jour, suffisants pour des dashboards de production et des bots respectant une hygiène de requêtes normale. Les réponses dépassant la limite renvoient 429 avec un en-tête Retry-After.",
    apiKeysQ: 'Je suis en Pro — comment obtenir ma clé API ?',
    apiKeysA:
      "L'accès à l'API est une fonctionnalité Pro. La génération de clés en libre-service depuis votre page Compte arrive bientôt ; jusqu'à son lancement, les clés sont émises manuellement — écrivez à support@zerogex.io depuis l'adresse de votre compte et nous vous enverrons une clé ainsi que des notes de configuration. Utilisez-la comme <code>Authorization: Bearer &lt;key&gt;</code> à chaque requête. Écrivez-nous pour faire tourner ou révoquer une clé.",
    apiStreamingQ: "Existe-t-il un endpoint de streaming ou un websocket ?",
    apiStreamingA:
      "Pas exposé publiquement pour le moment. La plateforme web utilise un canal interne. Pour la plupart des cas d'usage, un polling à une cadence raisonnable (toutes les quelques secondes pour les métriques en direct) suffit.",

    methodologyTitle: 'Méthodologie',
    methodologyBlurb: 'Comment les chiffres sont réellement calculés.',
    whatIsGexQ: "Qu'est-ce que le Gamma Exposure (GEX) et pourquoi est-ce important ?",
    whatIsGexA:
      "Le GEX est la sensibilité agrégée des hedges delta des dealers d'options aux mouvements de prix du sous-jacent. Quand les dealers sont long gamma (net GEX positif au spot), ils vendent les rallyes et achètent les baisses — un effet amortisseur sur la volatilité. Quand ils sont short gamma, ils poursuivent le prix — un effet amplificateur. Connaître le régime GEX vous indique si le marché est susceptible de revenir à la moyenne ou de faire tendance.",
    gammaFlipQ: 'Comment le niveau du Gamma Flip est-il calculé ?',
    gammaFlipA:
      "Le flip est le niveau où la courbe de gamma des dealers croise zéro — calculé à partir d'un profil de gamma des dealers par décalage de spot, et non d'une approximation par net GEX cumulé. Au-dessus du flip, le hedging des dealers est stabilisateur ; en dessous, amplificateur. Voir le guide de calcul du Gamma Flip pour la méthodologie complète.",
    wallsExplainedQ: 'Que sont le call wall et le put wall ?',
    wallsExplainedA:
      "Les strikes avec respectivement le plus grand gamma call et gamma put. Ils ont tendance à agir comme résistance et support intrajournaliers, en particulier en gamma positif. Les walls migrent en cours de journée à mesure que le flow arrive — observer cette migration est en soi informatif.",
    maxPainReliabilityQ: "Qu'est-ce que le Max Pain, et quelle est sa fiabilité ?",
    maxPainReliabilityA:
      "Le max pain est le strike qui minimise le paiement total aux acheteurs d'options à l'échéance. Il est le plus fiable dans les 24 à 48 dernières heures avant une échéance significative, en particulier pour le 0DTE sur SPX. La lecture honnête est que « l'aimant gamma » — la structure des walls — pilote généralement le pin, et non l'argument du paiement aux acheteurs seul. Voir l'article sur le Max Pain pour l'analyse approfondie.",
    flowExplainedQ: "Qu'est-ce que le flow « pondéré par la prime » ?",
    flowExplainedA:
      "Le flow pondéré par la prime multiplie le volume de contrats par la prime payée. C'est la lecture de conviction — un trader qui paie 500 $/contrat prend un vrai pari ; un trader qui scalpe des tickets de loterie à 0,05 $ ne le fait pas. Le volume brut les traite de la même façon ; le flow pondéré par la prime ne le fait pas.",
    pricingModelQ: 'Quel modèle de pricing utilise le Strategy Builder ?',
    pricingModelA:
      "Black-Scholes avec la surface de volatilité implicite en direct. Pour SPX (exercice européen), aucun ajustement n'est appliqué. Pour SPY et QQQ (exercice américain), nous ajoutons une prime d'exercice anticipé sur les jambes deep-ITM proches de l'échéance.",

    supportTitle: 'Support &amp; Contact',
    supportBlurb: "Comment nous contacter quand vous avez besoin de parler à un humain.",
    howToContactQ: 'Comment obtenir de l\'aide ?',
    howToContactA:
      "Écrivez à support@zerogex.io. Nous répondons rapidement — généralement le jour même de trading. Incluez l'URL de la page sur laquelle vous étiez, une capture d'écran si pertinent, votre navigateur et système d'exploitation, et (pour la facturation) l'e-mail de votre compte.",
    featureRequestsQ: 'Acceptez-vous les demandes de fonctionnalités ?',
    featureRequestsA:
      "Oui. Écrivez à support@zerogex.io avec la demande et comment vous l'utiliseriez. Nous priorisons par rapport à la feuille de route existante.",
    bugReportsQ: 'Je pense avoir trouvé un bug.',
    bugReportsA:
      "Écrivez à support@zerogex.io avec la page, les étapes pour reproduire, le comportement attendu par rapport au réel, le navigateur, le système d'exploitation et un horodatage approximatif. Plus le rapport est précis, plus vite nous pouvons agir.",
    phishingQ: 'J\'ai reçu un e-mail suspect prétendant venir de ZeroGEX.',
    phishingA:
      "Nous envoyons des e-mails depuis zerogex.io et noreply@zerogex.io (et occasionnellement support@zerogex.io). Nous ne vous demanderons jamais votre mot de passe ou votre jeton de session par e-mail. Si quelque chose vous paraît suspect, transférez-le à support@zerogex.io et nous confirmerons ou signalerons.",
  },
};
