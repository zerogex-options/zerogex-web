import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    freePreviewBadge: 'Free preview · Delayed ~15 minutes',
    noDataPrefix: 'Data is briefly unavailable — refresh in a minute, or',
    noDataLink: 'start a free trial',
    noDataSuffix: 'for the live read.',
    staleReadNotice:
      '{primary} data is temporarily delayed — this read reflects the last available {primary} snapshot, not the current session.',
    freePreviewStrip: 'Free preview · delayed approximately 15 minutes',
    liveLevelsPrefix: 'Live real-time levels are available inside the',
    dashboardLinkText: 'ZeroGEX dashboard',
    statusUnavailable: '{symbol} data temporarily unavailable',
    statusDelayed: '{symbol} data temporarily delayed',
    liveDashboardCta: 'Live {symbol} dashboard',
    gammaLevelsCta: '{symbol} gamma levels',
    levelReferenceSpotLabel: 'Reference spot (delayed)',
    levelReferenceSpotHint: 'Approximate, snapshot ≥15 min ago',
    levelCallWallLabel: 'Call wall',
    levelCallWallHint: 'Strike that tends to cap upside',
    levelPutWallLabel: 'Put wall',
    levelPutWallHint: 'Strike that tends to floor downside',
    levelGammaFlipLabel: 'Gamma flip',
    levelGammaFlipHint: 'Regime line — above = positive, below = negative',
    levelMaxPainLabel: 'Max pain',
    levelMaxPainHint: 'Strike where the most contracts expire worthless',
    levelNetGexLabel: 'Net dealer GEX (at spot)',
    snapshotLabel: 'Snapshot: {ts}',
    regimePositiveLabel: 'Positive gamma (suppressed vol)',
    regimePositiveBody:
      'Dealers are net long gamma at spot — mean-reversion is favored, pinning is more likely, breakouts tend to stall.',
    regimeNegativeLabel: 'Negative gamma (amplified vol)',
    regimeNegativeBody:
      'Dealers are net short gamma at spot — moves can accelerate, walls are more brittle, trend extension is the higher-probability path.',
    regimeNeutralLabel: 'At the gamma flip',
    regimeNeutralBody:
      'Spot is sitting on the gamma flip — the sign of dealer hedging is unstable here, and a small move tips the tape into the next regime.',
    regimeUnresolvedLabel: 'Gamma flip unresolved',
    regimeUnresolvedBody:
      "The dealer gamma flip couldn't be resolved from this snapshot — read these levels as provisional.",
    howToReadHeading: 'How to read these levels',
    callWallEduBody:
      'The strike where call-side dealer gamma piles up. Above a positive-gamma regime, price tends to stall here as dealers sell into rips to hedge. A break above is usually a tell that the regime itself is flipping.',
    putWallEduBody:
      'The strike where put-side dealer gamma piles up — typically the strongest dealer-hedged support in a positive-gamma session. Failing below the put wall in negative gamma is one of the cleaner bear-trend setups in the playbook.',
    gammaFlipEduBody:
      'The level where the cumulative dealer-gamma curve crosses zero. Above the flip, dealers are net long gamma (vol-suppressing). Below it, net short gamma (vol-amplifying). The single most useful regime line on the dealer book.',
    maxPainEduBody:
      'The strike that maximizes the dollar value of options expiring worthless. Useful as an expiration-day magnet, but the real mechanism most days is the gamma pin around max pain, not writer-payout arithmetic.',
    netGexEduTitle: 'Net dealer GEX (at spot)',
    netGexEduBody:
      "The cumulative dealer-gamma curve evaluated at the current price. Sign-consistent with the flip — positive means we're above it, negative means below. Magnitude says how deep into the regime we are.",
    oneCatchTitle: 'One catch',
    oneCatchBody:
      "These are derived analytics, intentionally delayed. They're great for context and for the daily X read; they're not enough on their own for active trading. Pair them with intraday flow, vanna/charm, and the regime signals on the live dashboard.",
    learnMoreHeading: 'Learn more',
    learnGammaFlip: 'What Is a Gamma Flip?',
    learnCallWall: 'What Is a Call Wall?',
    learnPutWall: 'What Is a Put Wall?',
    learnGex: 'What Is GEX in Trading?',
    learnNetGamma: 'SPX Net Gamma Exposure Today: Reading Net GEX',
    learnTradeGammaFlip: 'How Traders Use Gamma Levels',
    learnSpyVsSpx: 'SPY vs SPX Options: Which Gamma Levels Matter?',
    toolsHeading: 'Two free tools nobody else ships',
    toolsSubtext: 'No login required. Bookmark either — the URL stays valid every day.',
    forecastTitle: 'Daily Forecast',
    betaBadge: 'Beta',
    forecastBody:
      'Every morning at 7 AM ET we commit to a projected range, pin strike, and regime call — hashed and immutable. Every afternoon we grade ourselves in public.',
    replayTitle: 'Daily Replay',
    replayBody:
      'Scrub through any past session minute-by-minute. Watch walls shift, gamma flip drift, and per-strike GEX migrate. Drop two pins to see the delta between any two moments.',
    faqHeading: 'Frequently asked questions',
    faqQ1: 'What are {primary} gamma levels?',
    faqA1:
      '{primary} gamma levels are price zones where options dealer positioning may influence support, resistance, pinning, or volatility. Common levels include the gamma flip, call wall, put wall, and max pain.',
    faqQ2: 'What is the {primary} gamma flip?',
    faqA2:
      'The {primary} gamma flip is the price level where dealer positioning may shift from positive gamma to negative gamma, or vice versa. Above or below this level, market behavior can change from more stable and mean-reverting to more volatile and directional.',
    faqQ3: 'What is the {primary} call wall?',
    faqA3:
      'The {primary} call wall is a strike where call gamma exposure is concentrated. It can act as an upside magnet, resistance area, or pinning zone depending on broader positioning and price action.',
    faqQ4: 'What is the {primary} put wall?',
    faqA4:
      'The {primary} put wall is a strike where put gamma exposure is concentrated. It can act as a downside support area, hedge-pressure zone, or acceleration level if price breaks through it.',
    faqQ5: 'How often are ZeroGEX {primary} gamma levels updated?',
    faqA5:
      'ZeroGEX provides delayed free {primary} gamma levels on this page. Real-time levels are available inside the ZeroGEX dashboard.',
    snapshotTimestampPrefix: 'Snapshot timestamp (ET): {ts}.',
    disclaimerText:
      'Levels on this page are derived analytics rebuilt from a market-data snapshot that is intentionally held back ~15 minutes from the live ZeroGEX feed. Provided for informational purposes only — not investment advice. Options trading involves significant risk.',
  },
  it: {
    freePreviewBadge: 'Anteprima gratuita · Ritardo ~15 minuti',
    noDataPrefix: 'I dati sono temporaneamente non disponibili — aggiorna la pagina tra un minuto, oppure',
    noDataLink: 'avvia una prova gratuita',
    noDataSuffix: 'per la lettura in tempo reale.',
    staleReadNotice:
      'I dati {primary} sono temporaneamente in ritardo — questa lettura riflette l’ultimo snapshot {primary} disponibile, non la sessione corrente.',
    freePreviewStrip: 'Anteprima gratuita · ritardo di circa 15 minuti',
    liveLevelsPrefix: 'I livelli in tempo reale sono disponibili all’interno della',
    dashboardLinkText: 'dashboard ZeroGEX',
    statusUnavailable: 'Dati {symbol} temporaneamente non disponibili',
    statusDelayed: 'Dati {symbol} temporaneamente in ritardo',
    liveDashboardCta: 'Dashboard {symbol} in tempo reale',
    gammaLevelsCta: 'Livelli gamma {symbol}',
    levelReferenceSpotLabel: 'Spot di riferimento (ritardato)',
    levelReferenceSpotHint: 'Approssimativo, snapshot di almeno 15 minuti fa',
    levelCallWallLabel: 'Call wall',
    levelCallWallHint: 'Strike che tende a limitare il rialzo',
    levelPutWallLabel: 'Put wall',
    levelPutWallHint: 'Strike che tende a sostenere il ribasso',
    levelGammaFlipLabel: 'Gamma flip',
    levelGammaFlipHint: 'Linea di regime — sopra = positivo, sotto = negativo',
    levelMaxPainLabel: 'Max pain',
    levelMaxPainHint: 'Strike dove il maggior numero di contratti scade senza valore',
    levelNetGexLabel: 'Net GEX del dealer (allo spot)',
    snapshotLabel: 'Snapshot: {ts}',
    regimePositiveLabel: 'Gamma positiva (volatilità compressa)',
    regimePositiveBody:
      'I dealer sono net long gamma allo spot — il mean-reversion è favorito, il pinning è più probabile, i breakout tendono a bloccarsi.',
    regimeNegativeLabel: 'Gamma negativa (volatilità amplificata)',
    regimeNegativeBody:
      'I dealer sono net short gamma allo spot — i movimenti possono accelerare, i wall sono più fragili, l’estensione del trend è il percorso più probabile.',
    regimeNeutralLabel: 'Sul gamma flip',
    regimeNeutralBody:
      'Lo spot si trova sul gamma flip — qui il segno dell’hedging dei dealer è instabile, e un piccolo movimento fa passare il mercato al regime successivo.',
    regimeUnresolvedLabel: 'Gamma flip non risolto',
    regimeUnresolvedBody:
      'Il gamma flip dei dealer non è risolvibile da questo snapshot — considera questi livelli come provvisori.',
    howToReadHeading: 'Come leggere questi livelli',
    callWallEduBody:
      'Lo strike dove si accumula la gamma dei dealer lato call. Sopra un regime a gamma positiva, il prezzo tende a fermarsi qui perché i dealer vendono nei rialzi per fare hedging. Una rottura al di sopra è di solito un segnale che il regime stesso sta cambiando.',
    putWallEduBody:
      'Lo strike dove si accumula la gamma dei dealer lato put — tipicamente il supporto coperto dai dealer più forte in una sessione a gamma positiva. Rompere sotto il put wall in gamma negativa è uno dei setup ribassisti più chiari del playbook.',
    gammaFlipEduBody:
      'Il livello dove la curva cumulativa della gamma dei dealer attraversa lo zero. Sopra il flip, i dealer sono net long gamma (comprime la volatilità). Sotto, net short gamma (amplifica la volatilità). La linea di regime più utile sul book dei dealer.',
    maxPainEduBody:
      'Lo strike che massimizza il valore in dollari delle opzioni che scadono senza valore. Utile come magnete nei giorni di scadenza, ma il vero meccanismo nella maggior parte dei giorni è il gamma pin intorno al max pain, non l’aritmetica dei payout degli emittenti.',
    netGexEduTitle: 'Net GEX del dealer (allo spot)',
    netGexEduBody:
      'La curva cumulativa della gamma dei dealer valutata al prezzo corrente. Coerente nel segno con il flip — positivo significa che siamo sopra, negativo significa sotto. La magnitudo indica quanto siamo profondi nel regime.',
    oneCatchTitle: 'Un’avvertenza',
    oneCatchBody:
      'Questi sono dati derivati, intenzionalmente in ritardo. Sono ottimi per il contesto e per la lettura giornaliera su X; non bastano da soli per il trading attivo. Vanno affiancati al flusso intraday, a vanna/charm e ai segnali di regime nella dashboard live.',
    learnMoreHeading: 'Scopri di più',
    learnGammaFlip: 'Cos’è un gamma flip?',
    learnCallWall: 'Cos’è un call wall?',
    learnPutWall: 'Cos’è un put wall?',
    learnGex: 'Cos’è il GEX nel trading?',
    learnNetGamma: 'Net Gamma Exposure SPX oggi: come leggere il Net GEX',
    learnTradeGammaFlip: 'Come i trader usano i livelli gamma',
    learnSpyVsSpx: 'SPY vs SPX: quali livelli gamma contano?',
    toolsHeading: 'Due strumenti gratuiti che nessun altro offre',
    toolsSubtext: 'Nessuna registrazione richiesta. Aggiungi entrambi ai preferiti — l’URL resta valido ogni giorno.',
    forecastTitle: 'Previsione giornaliera',
    betaBadge: 'Beta',
    forecastBody:
      'Ogni mattina alle 7:00 ET ci impegniamo su un range previsto, uno strike di pin e una chiamata di regime — con hash e immutabili. Ogni pomeriggio ci valutiamo pubblicamente.',
    replayTitle: 'Replay giornaliero',
    replayBody:
      'Scorri qualsiasi sessione passata minuto per minuto. Osserva i wall spostarsi, il gamma flip muoversi e il GEX per strike migrare. Posiziona due pin per vedere la differenza tra due momenti qualsiasi.',
    faqHeading: 'Domande frequenti',
    faqQ1: 'Cosa sono i livelli gamma {primary}?',
    faqA1:
      'I livelli gamma {primary} sono zone di prezzo dove il posizionamento dei dealer di opzioni può influenzare supporto, resistenza, pinning o volatilità. I livelli comuni includono il gamma flip, il call wall, il put wall e il max pain.',
    faqQ2: 'Cos’è il gamma flip di {primary}?',
    faqA2:
      'Il gamma flip di {primary} è il livello di prezzo dove il posizionamento dei dealer può passare da gamma positiva a gamma negativa, o viceversa. Sopra o sotto questo livello, il comportamento del mercato può cambiare da più stabile e mean-reverting a più volatile e direzionale.',
    faqQ3: 'Cos’è il call wall di {primary}?',
    faqA3:
      'Il call wall di {primary} è uno strike dove si concentra l’esposizione gamma sulle call. Può agire come magnete al rialzo, area di resistenza o zona di pinning in base al posizionamento generale e all’andamento del prezzo.',
    faqQ4: 'Cos’è il put wall di {primary}?',
    faqA4:
      'Il put wall di {primary} è uno strike dove si concentra l’esposizione gamma sulle put. Può agire come area di supporto al ribasso, zona di pressione da hedging o livello di accelerazione se il prezzo lo rompe.',
    faqQ5: 'Con quale frequenza vengono aggiornati i livelli gamma {primary} di ZeroGEX?',
    faqA5:
      'ZeroGEX fornisce livelli gamma {primary} gratuiti e ritardati su questa pagina. I livelli in tempo reale sono disponibili nella dashboard ZeroGEX.',
    snapshotTimestampPrefix: 'Timestamp dello snapshot (ET): {ts}.',
    disclaimerText:
      'I livelli su questa pagina sono dati derivati ricostruiti da uno snapshot di mercato intenzionalmente ritardato di circa 15 minuti rispetto al feed live di ZeroGEX. Fornito solo a scopo informativo — non è consulenza di investimento. Il trading di opzioni comporta un rischio significativo.',
  },
  de: {
    freePreviewBadge: 'Kostenlose Vorschau · Verzögerung ~15 Minuten',
    noDataPrefix: 'Daten sind kurzzeitig nicht verfügbar — bitte in einer Minute aktualisieren, oder',
    noDataLink: 'kostenlose Testversion starten',
    noDataSuffix: 'für die Live-Ansicht.',
    staleReadNotice:
      'Die {primary}-Daten sind derzeit verzögert — diese Auswertung basiert auf dem letzten verfügbaren {primary}-Snapshot, nicht auf der aktuellen Sitzung.',
    freePreviewStrip: 'Kostenlose Vorschau · Verzögerung von etwa 15 Minuten',
    liveLevelsPrefix: 'Echtzeit-Level sind verfügbar im',
    dashboardLinkText: 'ZeroGEX-Dashboard',
    statusUnavailable: '{symbol}-Daten derzeit nicht verfügbar',
    statusDelayed: '{symbol}-Daten derzeit verzögert',
    liveDashboardCta: 'Live-{symbol}-Dashboard',
    gammaLevelsCta: '{symbol}-Gamma-Level',
    levelReferenceSpotLabel: 'Referenz-Spot (verzögert)',
    levelReferenceSpotHint: 'Näherungswert, Snapshot vor mindestens 15 Minuten',
    levelCallWallLabel: 'Call Wall',
    levelCallWallHint: 'Strike, der die Aufwärtsbewegung tendenziell begrenzt',
    levelPutWallLabel: 'Put Wall',
    levelPutWallHint: 'Strike, der die Abwärtsbewegung tendenziell absichert',
    levelGammaFlipLabel: 'Gamma Flip',
    levelGammaFlipHint: 'Regimelinie — darüber = positiv, darunter = negativ',
    levelMaxPainLabel: 'Max Pain',
    levelMaxPainHint: 'Strike, an dem die meisten Kontrakte wertlos verfallen',
    levelNetGexLabel: 'Netto-Dealer-GEX (am Spot)',
    snapshotLabel: 'Snapshot: {ts}',
    regimePositiveLabel: 'Positive Gamma (gedämpfte Volatilität)',
    regimePositiveBody:
      'Dealer sind am Spot net long Gamma — Mean-Reversion wird begünstigt, Pinning ist wahrscheinlicher, Ausbrüche tendieren zum Abflachen.',
    regimeNegativeLabel: 'Negative Gamma (verstärkte Volatilität)',
    regimeNegativeBody:
      'Dealer sind am Spot net short Gamma — Bewegungen können sich beschleunigen, Walls sind fragiler, Trendfortsetzung ist der wahrscheinlichere Pfad.',
    regimeNeutralLabel: 'Am Gamma Flip',
    regimeNeutralBody:
      'Der Spot liegt genau auf dem Gamma Flip — das Vorzeichen des Dealer-Hedgings ist hier instabil, und eine kleine Bewegung kippt den Markt in das nächste Regime.',
    regimeUnresolvedLabel: 'Gamma Flip nicht auflösbar',
    regimeUnresolvedBody:
      'Der Dealer-Gamma-Flip konnte aus diesem Snapshot nicht ermittelt werden — betrachten Sie diese Level als vorläufig.',
    howToReadHeading: 'So lesen Sie diese Level',
    callWallEduBody:
      'Der Strike, an dem sich die Call-seitige Dealer-Gamma konzentriert. Oberhalb eines Regimes mit positiver Gamma tendiert der Preis dazu, hier zu stocken, da Dealer in Rallyes verkaufen, um zu hedgen. Ein Durchbruch nach oben ist meist ein Zeichen, dass sich das Regime selbst dreht.',
    putWallEduBody:
      'Der Strike, an dem sich die Put-seitige Dealer-Gamma konzentriert — typischerweise der stärkste Dealer-gehedgte Support in einer Sitzung mit positiver Gamma. Ein Bruch unter den Put Wall bei negativer Gamma ist eines der saubersten Bear-Trend-Setups im Playbook.',
    gammaFlipEduBody:
      'Das Level, an dem die kumulierte Dealer-Gamma-Kurve die Null-Linie kreuzt. Über dem Flip sind Dealer net long Gamma (volatilitätsdämpfend). Darunter net short Gamma (volatilitätsverstärkend). Die nützlichste einzelne Regimelinie im Dealer-Book.',
    maxPainEduBody:
      'Der Strike, der den Dollarwert wertlos verfallender Optionen maximiert. Nützlich als Magnet am Verfallstag, aber der eigentliche Mechanismus an den meisten Tagen ist das Gamma-Pinning um den Max Pain, nicht die Payout-Arithmetik der Stillhalter.',
    netGexEduTitle: 'Netto-Dealer-GEX (am Spot)',
    netGexEduBody:
      'Die kumulierte Dealer-Gamma-Kurve am aktuellen Preis ausgewertet. Vorzeichenkonsistent mit dem Flip — positiv bedeutet, wir liegen darüber, negativ darunter. Der Betrag zeigt, wie tief wir im jeweiligen Regime stecken.',
    oneCatchTitle: 'Ein Haken',
    oneCatchBody:
      'Dies sind abgeleitete Analysen, absichtlich verzögert. Sie sind hervorragend für den Kontext und die tägliche X-Lektüre; für aktives Trading reichen sie allein nicht aus. Kombinieren Sie sie mit Intraday-Flow, Vanna/Charm und den Regimesignalen im Live-Dashboard.',
    learnMoreHeading: 'Mehr erfahren',
    learnGammaFlip: 'Was ist ein Gamma Flip?',
    learnCallWall: 'Was ist ein Call Wall?',
    learnPutWall: 'Was ist ein Put Wall?',
    learnGex: 'Was ist GEX im Trading?',
    learnNetGamma: 'SPX Net Gamma Exposure heute: Net GEX richtig lesen',
    learnTradeGammaFlip: 'Wie Trader Gamma-Level nutzen',
    learnSpyVsSpx: 'SPY vs. SPX: Welche Gamma-Level zählen?',
    toolsHeading: 'Zwei kostenlose Tools, die sonst niemand bietet',
    toolsSubtext: 'Keine Anmeldung erforderlich. Beide als Lesezeichen speichern — die URL bleibt täglich gültig.',
    forecastTitle: 'Tägliche Prognose',
    betaBadge: 'Beta',
    forecastBody:
      'Jeden Morgen um 7 Uhr ET legen wir uns auf einen prognostizierten Bereich, einen Pin-Strike und eine Regime-Einschätzung fest — gehasht und unveränderlich. Jeden Nachmittag bewerten wir uns öffentlich selbst.',
    replayTitle: 'Tägliches Replay',
    replayBody:
      'Durchsuchen Sie jede vergangene Sitzung Minute für Minute. Beobachten Sie, wie sich Walls verschieben, der Gamma Flip wandert und das GEX pro Strike migriert. Setzen Sie zwei Pins, um die Differenz zwischen zwei beliebigen Momenten zu sehen.',
    faqHeading: 'Häufig gestellte Fragen',
    faqQ1: 'Was sind {primary}-Gamma-Level?',
    faqA1:
      '{primary}-Gamma-Level sind Preiszonen, in denen die Positionierung von Options-Dealern Support, Widerstand, Pinning oder Volatilität beeinflussen kann. Zu den gängigen Levels zählen Gamma Flip, Call Wall, Put Wall und Max Pain.',
    faqQ2: 'Was ist der {primary}-Gamma-Flip?',
    faqA2:
      'Der {primary}-Gamma-Flip ist das Preisniveau, an dem sich die Dealer-Positionierung von positiver zu negativer Gamma verschieben kann oder umgekehrt. Über oder unter diesem Level kann sich das Marktverhalten von stabiler und mean-reverting zu volatiler und gerichteter verändern.',
    faqQ3: 'Was ist der {primary}-Call-Wall?',
    faqA3:
      'Der {primary}-Call-Wall ist ein Strike, an dem sich Call-Gamma-Exposure konzentriert. Er kann je nach übergeordneter Positionierung und Preisverlauf als Aufwärtsmagnet, Widerstandszone oder Pinning-Zone wirken.',
    faqQ4: 'Was ist der {primary}-Put-Wall?',
    faqA4:
      'Der {primary}-Put-Wall ist ein Strike, an dem sich Put-Gamma-Exposure konzentriert. Er kann als Abwärts-Supportzone, Hedge-Druckzone oder als Beschleunigungslevel wirken, falls der Preis ihn durchbricht.',
    faqQ5: 'Wie oft werden die {primary}-Gamma-Level von ZeroGEX aktualisiert?',
    faqA5:
      'ZeroGEX stellt auf dieser Seite kostenlose, verzögerte {primary}-Gamma-Level bereit. Echtzeit-Level sind im ZeroGEX-Dashboard verfügbar.',
    snapshotTimestampPrefix: 'Snapshot-Zeitstempel (ET): {ts}.',
    disclaimerText:
      'Die Level auf dieser Seite sind abgeleitete Analysen, die aus einem Marktdaten-Snapshot rekonstruiert wurden, der absichtlich rund 15 Minuten hinter dem Live-Feed von ZeroGEX zurückliegt. Nur zu Informationszwecken bereitgestellt — keine Anlageberatung. Optionshandel ist mit erheblichem Risiko verbunden.',
  },
  es: {
    freePreviewBadge: 'Vista previa gratuita · Retraso ~15 minutos',
    noDataPrefix: 'Los datos no están disponibles momentáneamente — actualiza en un minuto, o',
    noDataLink: 'inicia una prueba gratuita',
    noDataSuffix: 'para la lectura en vivo.',
    staleReadNotice:
      'Los datos de {primary} están temporalmente retrasados — esta lectura refleja el último snapshot disponible de {primary}, no la sesión actual.',
    freePreviewStrip: 'Vista previa gratuita · retraso de aproximadamente 15 minutos',
    liveLevelsPrefix: 'Los niveles en tiempo real están disponibles dentro del',
    dashboardLinkText: 'panel de ZeroGEX',
    statusUnavailable: 'Datos de {symbol} temporalmente no disponibles',
    statusDelayed: 'Datos de {symbol} temporalmente retrasados',
    liveDashboardCta: 'Panel en vivo de {symbol}',
    gammaLevelsCta: 'Niveles gamma de {symbol}',
    levelReferenceSpotLabel: 'Spot de referencia (retrasado)',
    levelReferenceSpotHint: 'Aproximado, snapshot de al menos 15 minutos',
    levelCallWallLabel: 'Call wall',
    levelCallWallHint: 'Strike que tiende a limitar la subida',
    levelPutWallLabel: 'Put wall',
    levelPutWallHint: 'Strike que tiende a sostener la bajada',
    levelGammaFlipLabel: 'Gamma flip',
    levelGammaFlipHint: 'Línea de régimen — por encima = positivo, por debajo = negativo',
    levelMaxPainLabel: 'Max pain',
    levelMaxPainHint: 'Strike donde vence sin valor el mayor número de contratos',
    levelNetGexLabel: 'Net GEX del dealer (en el spot)',
    snapshotLabel: 'Snapshot: {ts}',
    regimePositiveLabel: 'Gamma positiva (volatilidad suprimida)',
    regimePositiveBody:
      'Los dealers están net long gamma en el spot — se favorece la reversión a la media, el pinning es más probable y los breakouts tienden a estancarse.',
    regimeNegativeLabel: 'Gamma negativa (volatilidad amplificada)',
    regimeNegativeBody:
      'Los dealers están net short gamma en el spot — los movimientos pueden acelerarse, los walls son más frágiles y la extensión de tendencia es el escenario más probable.',
    regimeNeutralLabel: 'En el gamma flip',
    regimeNeutralBody:
      'El spot está justo en el gamma flip — el signo del hedging de los dealers es inestable aquí, y un pequeño movimiento hace que el mercado pase al siguiente régimen.',
    regimeUnresolvedLabel: 'Gamma flip no resuelto',
    regimeUnresolvedBody:
      'El gamma flip de los dealers no pudo resolverse a partir de este snapshot — trata estos niveles como provisionales.',
    howToReadHeading: 'Cómo leer estos niveles',
    callWallEduBody:
      'El strike donde se acumula la gamma de los dealers del lado call. Por encima de un régimen de gamma positiva, el precio tiende a detenerse aquí porque los dealers venden en los repuntes para cubrirse. Una ruptura por encima suele indicar que el propio régimen está cambiando.',
    putWallEduBody:
      'El strike donde se acumula la gamma de los dealers del lado put — típicamente el soporte cubierto por dealers más fuerte en una sesión de gamma positiva. Romper por debajo del put wall en gamma negativa es uno de los setups bajistas más claros del manual.',
    gammaFlipEduBody:
      'El nivel donde la curva acumulada de gamma de los dealers cruza cero. Por encima del flip, los dealers están net long gamma (suprime la volatilidad). Por debajo, net short gamma (amplifica la volatilidad). La línea de régimen más útil del libro de los dealers.',
    maxPainEduBody:
      'El strike que maximiza el valor en dólares de las opciones que vencen sin valor. Útil como imán en el día de vencimiento, pero el mecanismo real la mayoría de los días es el gamma pin alrededor del max pain, no la aritmética de pagos de los emisores.',
    netGexEduTitle: 'Net GEX del dealer (en el spot)',
    netGexEduBody:
      'La curva acumulada de gamma de los dealers evaluada al precio actual. Coherente en signo con el flip — positivo significa que estamos por encima, negativo que estamos por debajo. La magnitud indica qué tan profundo estamos en el régimen.',
    oneCatchTitle: 'Una advertencia',
    oneCatchBody:
      'Estos son datos analíticos derivados, intencionalmente retrasados. Son excelentes para el contexto y la lectura diaria en X; no son suficientes por sí solos para el trading activo. Combínalos con el flujo intradía, vanna/charm y las señales de régimen del panel en vivo.',
    learnMoreHeading: 'Más información',
    learnGammaFlip: '¿Qué es un gamma flip?',
    learnCallWall: '¿Qué es un call wall?',
    learnPutWall: '¿Qué es un put wall?',
    learnGex: '¿Qué es el GEX en el trading?',
    learnNetGamma: 'Net Gamma Exposure de SPX hoy: cómo leer el Net GEX',
    learnTradeGammaFlip: 'Cómo usan los traders los niveles gamma',
    learnSpyVsSpx: 'SPY vs SPX: ¿qué niveles gamma importan?',
    toolsHeading: 'Dos herramientas gratuitas que nadie más ofrece',
    toolsSubtext: 'No se requiere registro. Guarda cualquiera de ellas — la URL sigue siendo válida cada día.',
    forecastTitle: 'Pronóstico diario',
    betaBadge: 'Beta',
    forecastBody:
      'Cada mañana a las 7 AM ET nos comprometemos con un rango proyectado, un strike de pin y una llamada de régimen — con hash e inmutables. Cada tarde nos calificamos públicamente.',
    replayTitle: 'Replay diario',
    replayBody:
      'Recorre cualquier sesión pasada minuto a minuto. Observa cómo se mueven los walls, el gamma flip y cómo migra el GEX por strike. Coloca dos pines para ver la diferencia entre dos momentos cualesquiera.',
    faqHeading: 'Preguntas frecuentes',
    faqQ1: '¿Qué son los niveles gamma de {primary}?',
    faqA1:
      'Los niveles gamma de {primary} son zonas de precio donde el posicionamiento de los dealers de opciones puede influir en el soporte, la resistencia, el pinning o la volatilidad. Los niveles comunes incluyen el gamma flip, el call wall, el put wall y el max pain.',
    faqQ2: '¿Qué es el gamma flip de {primary}?',
    faqA2:
      'El gamma flip de {primary} es el nivel de precio donde el posicionamiento de los dealers puede pasar de gamma positiva a gamma negativa, o viceversa. Por encima o por debajo de este nivel, el comportamiento del mercado puede pasar de más estable y mean-reverting a más volátil y direccional.',
    faqQ3: '¿Qué es el call wall de {primary}?',
    faqA3:
      'El call wall de {primary} es un strike donde se concentra la exposición gamma de calls. Puede actuar como imán al alza, zona de resistencia o zona de pinning según el posicionamiento general y la acción del precio.',
    faqQ4: '¿Qué es el put wall de {primary}?',
    faqA4:
      'El put wall de {primary} es un strike donde se concentra la exposición gamma de puts. Puede actuar como zona de soporte a la baja, zona de presión de hedging o nivel de aceleración si el precio lo rompe.',
    faqQ5: '¿Con qué frecuencia se actualizan los niveles gamma de {primary} de ZeroGEX?',
    faqA5:
      'ZeroGEX ofrece niveles gamma gratuitos y retrasados de {primary} en esta página. Los niveles en tiempo real están disponibles dentro del panel de ZeroGEX.',
    snapshotTimestampPrefix: 'Marca de tiempo del snapshot (ET): {ts}.',
    disclaimerText:
      'Los niveles de esta página son datos analíticos derivados, reconstruidos a partir de un snapshot de mercado intencionalmente retrasado unos 15 minutos respecto al feed en vivo de ZeroGEX. Se proporcionan solo con fines informativos — no es asesoría de inversión. El trading de opciones implica un riesgo significativo.',
  },
  fr: {
    freePreviewBadge: 'Aperçu gratuit · Retard ~15 minutes',
    noDataPrefix: 'Les données sont momentanément indisponibles — actualisez dans une minute, ou',
    noDataLink: 'démarrez un essai gratuit',
    noDataSuffix: 'pour la lecture en direct.',
    staleReadNotice:
      'Les données {primary} sont temporairement retardées — cette lecture reflète le dernier instantané {primary} disponible, pas la session en cours.',
    freePreviewStrip: 'Aperçu gratuit · retard d’environ 15 minutes',
    liveLevelsPrefix: 'Les niveaux en temps réel sont disponibles dans le',
    dashboardLinkText: 'tableau de bord ZeroGEX',
    statusUnavailable: 'Données {symbol} temporairement indisponibles',
    statusDelayed: 'Données {symbol} temporairement retardées',
    liveDashboardCta: 'Tableau de bord {symbol} en direct',
    gammaLevelsCta: 'Niveaux gamma {symbol}',
    levelReferenceSpotLabel: 'Spot de référence (retardé)',
    levelReferenceSpotHint: 'Approximatif, instantané datant d’au moins 15 minutes',
    levelCallWallLabel: 'Call wall',
    levelCallWallHint: 'Strike qui tend à limiter la hausse',
    levelPutWallLabel: 'Put wall',
    levelPutWallHint: 'Strike qui tend à soutenir la baisse',
    levelGammaFlipLabel: 'Gamma flip',
    levelGammaFlipHint: 'Ligne de régime — au-dessus = positif, en dessous = négatif',
    levelMaxPainLabel: 'Max pain',
    levelMaxPainHint: 'Strike où le plus grand nombre de contrats expire sans valeur',
    levelNetGexLabel: 'Net GEX du dealer (au spot)',
    snapshotLabel: 'Instantané : {ts}',
    regimePositiveLabel: 'Gamma positive (volatilité comprimée)',
    regimePositiveBody:
      'Les dealers sont net long gamma au spot — le retour à la moyenne est favorisé, le pinning est plus probable, les breakouts tendent à s’essouffler.',
    regimeNegativeLabel: 'Gamma négative (volatilité amplifiée)',
    regimeNegativeBody:
      'Les dealers sont net short gamma au spot — les mouvements peuvent s’accélérer, les walls sont plus fragiles, l’extension de tendance est le scénario le plus probable.',
    regimeNeutralLabel: 'Sur le gamma flip',
    regimeNeutralBody:
      'Le spot se trouve juste sur le gamma flip — le signe du hedging des dealers est instable ici, et un petit mouvement fait basculer le marché dans le régime suivant.',
    regimeUnresolvedLabel: 'Gamma flip non résolu',
    regimeUnresolvedBody:
      'Le gamma flip des dealers n’a pas pu être déterminé à partir de cet instantané — considérez ces niveaux comme provisoires.',
    howToReadHeading: 'Comment lire ces niveaux',
    callWallEduBody:
      'Le strike où se concentre la gamma des dealers côté call. Au-dessus d’un régime à gamma positive, le prix tend à s’arrêter ici car les dealers vendent lors des hausses pour se couvrir. Une cassure au-dessus est généralement le signe que le régime lui-même bascule.',
    putWallEduBody:
      'Le strike où se concentre la gamma des dealers côté put — généralement le support couvert par les dealers le plus solide lors d’une session à gamma positive. Casser sous le put wall en gamma négative est l’un des setups baissiers les plus nets du playbook.',
    gammaFlipEduBody:
      'Le niveau où la courbe cumulée de gamma des dealers croise zéro. Au-dessus du flip, les dealers sont net long gamma (compresse la volatilité). En dessous, net short gamma (amplifie la volatilité). La ligne de régime la plus utile du book des dealers.',
    maxPainEduBody:
      'Le strike qui maximise la valeur en dollars des options qui expirent sans valeur. Utile comme aimant le jour de l’expiration, mais le mécanisme réel la plupart des jours est le gamma pin autour du max pain, pas l’arithmétique des paiements des vendeurs.',
    netGexEduTitle: 'Net GEX du dealer (au spot)',
    netGexEduBody:
      'La courbe cumulée de gamma des dealers évaluée au prix actuel. Cohérente en signe avec le flip — positif signifie que nous sommes au-dessus, négatif en dessous. L’ampleur indique à quel point nous sommes profondément dans le régime.',
    oneCatchTitle: 'Un bémol',
    oneCatchBody:
      'Il s’agit de données analytiques dérivées, intentionnellement retardées. Elles sont excellentes pour le contexte et la lecture quotidienne sur X ; elles ne suffisent pas seules pour le trading actif. Combinez-les avec le flux intrajournalier, vanna/charm et les signaux de régime du tableau de bord en direct.',
    learnMoreHeading: 'En savoir plus',
    learnGammaFlip: 'Qu’est-ce qu’un gamma flip ?',
    learnCallWall: 'Qu’est-ce qu’un call wall ?',
    learnPutWall: 'Qu’est-ce qu’un put wall ?',
    learnGex: 'Qu’est-ce que le GEX en trading ?',
    learnNetGamma: 'Net Gamma Exposure du SPX aujourd’hui : lire le Net GEX',
    learnTradeGammaFlip: 'Comment les traders utilisent les niveaux gamma',
    learnSpyVsSpx: 'SPY vs SPX : quels niveaux gamma comptent ?',
    toolsHeading: 'Deux outils gratuits que personne d’autre ne propose',
    toolsSubtext: 'Aucune inscription requise. Ajoutez l’un ou l’autre à vos favoris — l’URL reste valide chaque jour.',
    forecastTitle: 'Prévision quotidienne',
    betaBadge: 'Bêta',
    forecastBody:
      'Chaque matin à 7 h ET, nous nous engageons sur une fourchette projetée, un strike de pin et une lecture de régime — hachés et immuables. Chaque après-midi, nous nous évaluons publiquement.',
    replayTitle: 'Replay quotidien',
    replayBody:
      'Parcourez n’importe quelle session passée minute par minute. Observez les walls se déplacer, le gamma flip évoluer et le GEX par strike migrer. Placez deux pins pour voir l’écart entre deux moments quelconques.',
    faqHeading: 'Questions fréquentes',
    faqQ1: 'Que sont les niveaux gamma {primary} ?',
    faqA1:
      'Les niveaux gamma {primary} sont des zones de prix où le positionnement des dealers d’options peut influencer le support, la résistance, le pinning ou la volatilité. Les niveaux courants incluent le gamma flip, le call wall, le put wall et le max pain.',
    faqQ2: 'Qu’est-ce que le gamma flip {primary} ?',
    faqA2:
      'Le gamma flip {primary} est le niveau de prix où le positionnement des dealers peut passer d’une gamma positive à une gamma négative, ou l’inverse. Au-dessus ou en dessous de ce niveau, le comportement du marché peut passer de plus stable et mean-reverting à plus volatil et directionnel.',
    faqQ3: 'Qu’est-ce que le call wall {primary} ?',
    faqA3:
      'Le call wall {primary} est un strike où se concentre l’exposition gamma des calls. Il peut agir comme un aimant à la hausse, une zone de résistance ou une zone de pinning selon le positionnement global et l’évolution du prix.',
    faqQ4: 'Qu’est-ce que le put wall {primary} ?',
    faqA4:
      'Le put wall {primary} est un strike où se concentre l’exposition gamma des puts. Il peut agir comme une zone de support à la baisse, une zone de pression de couverture ou un niveau d’accélération si le prix le franchit.',
    faqQ5: 'À quelle fréquence les niveaux gamma {primary} de ZeroGEX sont-ils mis à jour ?',
    faqA5:
      'ZeroGEX fournit sur cette page des niveaux gamma {primary} gratuits et retardés. Les niveaux en temps réel sont disponibles dans le tableau de bord ZeroGEX.',
    snapshotTimestampPrefix: 'Horodatage de l’instantané (ET) : {ts}.',
    disclaimerText:
      'Les niveaux de cette page sont des données analytiques dérivées, reconstruites à partir d’un instantané de marché intentionnellement retardé d’environ 15 minutes par rapport au flux en direct de ZeroGEX. Fournis à titre informatif uniquement — ce n’est pas un conseil en investissement. Le trading d’options comporte un risque important.',
  },
};
