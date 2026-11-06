// The free member's locked screen (core/basicWall.ts) in the site's other
// languages (core/i18n/locales.ts). English is written in core/basicWall.ts;
// each block here says the same thing, line for line, and
// tests/basicWall.test.ts checks that every block covers every Basic page.
//
// Same voice as the rest of the site in each language: German says "du",
// Italian and Spanish "tu"/"tú", French "vous". The words for the plans, the
// trial and the guarantee are the pricing page's (app/pricing/Client.i18n.ts),
// the Basic features are its Basic card word for word, and "wall alerts" is
// the Account page's name for them. Page names follow the menu: the ones it
// translates (Main Dashboard, My Dashboard, Live Bulletin, Basic Signal
// Dashboard, Strategy Builder, Live Options Quotes) are translated here too,
// and the ones it keeps in English stay English. Amounts stay "$39", as on the
// pricing page.
//
// Pure: type-only imports, so tests load it under bare node --test.

import type { Locale } from './i18n/locales.ts';
import type { BasicWallText } from './basicWall.ts';

const IT_SIGNALS = {
  pitch:
    'I sei segnali Basic sono letture continue del mercato delle opzioni, ognuno su una scala da -100 a +100 con una sparkline e i dati alla base del punteggio, affiancati nella Dashboard segnali base.',
};

const DE_SIGNALS = {
  pitch:
    'Die sechs Basic-Signale sind fortlaufende Lesarten des Optionsmarkts, jedes auf einer Skala von -100 bis +100 mit einer Sparkline und den Eingaben hinter dem Score, nebeneinander im Basis-Signal-Dashboard.',
};

const ES_SIGNALS = {
  pitch:
    'Las seis señales Basic son lecturas continuas del mercado de opciones, cada una en una escala de -100 a +100 con una sparkline y los datos detrás de la puntuación, una al lado de otra en el Panel de señales básico.',
};

const FR_SIGNALS = {
  pitch:
    'Les six signaux Basic sont des lectures continues du marché des options, chacun sur une échelle de -100 à +100 avec une sparkline et les données derrière le score, côte à côte dans le Tableau de signaux basique.',
};

export const BASIC_WALL_TRANSLATIONS: Record<Exclude<Locale, 'en'>, BasicWallText> = {
  it: {
    labels: {
      heading: (page, plan) => `${page ?? 'Questa pagina'} fa parte di ${plan}`,
      imageCaption: (page) => `${page ?? 'ZeroGEX'} in una sessione passata: una lettura di esempio, non quella di oggi.`,
      comparePlans: 'Confronta i piani',
      freeLevels: 'Oppure continua a usare i livelli gratuiti e differiti',
      basicFeaturesHeading: 'Cosa include Basic',
      proFeaturesHeading: 'Tutto ciò che è incluso in Basic, più',
      howItWorks: (page) => (page ? `${page}: come funziona` : 'Come funziona'),
      seeAnnual: (plan) => `Vedi ${plan} annuale`,
    },
    copy: {
      price: ({ plan, amount }) => `${plan} costa ${amount} al mese.`,
      trialNoCard: (days) =>
        `Inizia con una prova gratuita di ${days} giorni, senza carta. Non ti viene addebitato nulla, a meno che tu non aggiunga una carta per mantenere il piano.`,
      trialCard: (days) =>
        `Inizia con una prova gratuita di ${days} giorni. Non ti viene addebitato nulla finché non termina, e puoi annullare in qualsiasi momento prima di allora.`,
      upFront: (days) => `Paghi in anticipo, con la garanzia soddisfatti o rimborsati di ${days} giorni.`,
      orBasicTrial: (days) => `Oppure inizia con la prova gratuita di ${days} giorni di Basic e passa a Pro da lì.`,
      orBasicTrialNoCard: (days) =>
        `Oppure inizia con la prova gratuita di ${days} giorni di Basic, senza carta, e passa a Pro da lì.`,
      unresolved: 'Scegli un piano nella pagina dei prezzi per sbloccarla.',
      annual: ({ plan, annual, perMonth }) =>
        `Oppure paga per un anno: ${plan} annuale costa ${annual}, circa ${perMonth} al mese.`,
      startTrial: 'Inizia la prova gratuita',
      getPlan: (plan) => `Abbonati a ${plan}`,
      startBasicTrial: 'Inizia con la prova di Basic',
    },
    features: [
      'Livelli in tempo reale per SPX, SPY, QQQ, NDX, ES e NQ: gamma flip, call/put wall e max pain',
      'La Dashboard principale e il Gamma Terminal in tempo reale, più una dashboard tutta tua da comporre con i widget',
      'Dealer Positioning, GEX Heatmap, GEX Strike Profile, Volatility e tutte le altre pagine delle metriche',
      'Flussi di opzioni: Flow Analysis, Smart Money, Hedging Flow e Market Tide',
      'Tutti e sei i Segnali Basic, tra cui Vanna/Charm Flow e Dealer Delta Pressure',
      'Avvisi sui muri quando il prezzo raggiunge o rompe un muro call o put, nell’app e via email',
      'Generatore di strategie e Quotazioni opzioni live',
    ],
    pitches: {
      '/dashboard': {
        pitch:
          "La Dashboard principale è la lettura live del mercato in un'unica schermata per SPX, SPY, QQQ, NDX, ES e NQ: dove sono posizionati i dealer (il regime di gamma, il gamma flip, i call e put wall) e cosa dice il tape (flussi e volatilità). È da qui che ti orienti in 30 secondi, prima di aprire qualsiasi altra pagina.",
        alt: 'Le schede dei livelli chiave nella Dashboard principale: call wall, put wall, net GEX e gamma flip',
      },
      '/my-dashboard': {
        pitch:
          'La mia dashboard è una bacheca che costruisci tu con le schede e i grafici di ZeroGEX, organizzata nel modo in cui fai trading.',
      },
      '/fuseline-radar': {
        pitch:
          "Il Fuseline Radar è costruito attorno a un singolo trade: imposti una Fuse, una direzione e uno o due target, e la pagina traccia il tuo percorso sul Gamma Chart accanto a una scala, strike per strike, del gamma modellato e di come è cambiato negli ultimi minuti. Organizza i dati attorno al tuo piano; non è un segnale di trading.",
      },
      '/live-bulletin': {
        pitch:
          "Il Bollettino live è una scheda live sul gamma dei dealer, un simbolo alla volta: il regime di gamma, il gamma flip, lo strike di pin, i call e put wall, il max pain, il net GEX, una banda di range atteso e una mappa del posizionamento, su un'unica scheda che puoi scaricare o condividere.",
      },
      '/gamma-exposure': {
        pitch:
          'Dealer Positioning è la mappa strutturale del book di opzioni: il net GEX allo spot, il gamma flip, i call e put wall e come il gamma dei dealer si distribuisce tra strike e scadenze. Ogni grafico risponde a una domanda: dove sono posizionati i dealer, e cosa dovranno fare quando il prezzo si muove?',
        alt: 'La heatmap del GEX per strike e giorni alla scadenza nella pagina Dealer Positioning',
      },
      '/greeks-gex': {
        pitch:
          "GEX Summary riunisce in un'unica schermata i numeri principali del GEX e i livelli che ne derivano, mappa il gamma dei dealer nel prezzo e nel tempo e mostra come regge il gamma flip sui diversi orizzonti delle opzioni e se il gamma dei dealer di oggi è insolito.",
      },
      '/gex-strike-profile': {
        pitch:
          'Il GEX Strike Profile mette il prezzo accanto al gamma modellato dei dealer e alle posizioni aperte, strike per strike, con il gamma flip e i call e put wall segnati, così vedi i livelli verso cui si sta muovendo il prezzo.',
        alt: 'Il GEX Strike Profile: il prezzo accanto a gamma e posizioni per strike, con il gamma flip e i wall segnati',
      },
      '/gex-heatmap': {
        pitch:
          "La GEX Heatmap dispone il gamma dei dealer in una griglia di strike per orario della sessione, così gli strike con molto gamma dei dealer risaltano come bande luminose.",
      },
      '/gamma-shift': {
        pitch:
          "Gamma Shift non mostra dove si trova il gamma dei dealer, ma come è cambiato in una finestra che scegli tu, separando il nuovo posizionamento dagli stessi contratti che si riprezzano al muoversi del prezzo, e quanta parte del book scade alla prossima chiusura.",
      },
      '/max-pain': {
        pitch:
          'Max Pain mostra, per ogni scadenza, lo strike in cui scade senza valore la maggior parte del premio delle opzioni, e lo legge accanto al profilo di gamma, così distingui un livello che fa da calamita da una coincidenza.',
      },
      '/flow-analysis': {
        pitch:
          'Flow Analysis è la vista del tape sul mercato delle opzioni: cosa è stato scambiato oggi e quale lato ha attraversato lo spread per farlo, con i contratti comprati e venduti, il premio netto e il put/call ratio sulla stessa linea temporale.',
      },
      '/smart-money': {
        pitch:
          'Smart Money filtra le operazioni in opzioni abbastanza grandi o insolite da essere la posizione di qualcuno e non rumore di copertura, le divide tra call e put e mostra come si forma il bias durante la giornata.',
      },
      '/hedging-flow': {
        pitch:
          'Hedging Flow stima la pressione di copertura dei dealer generata dalle operazioni in opzioni di oggi e la confronta con il prezzo: cosa il flusso di oggi costringe a fare i dealer, non solo cosa implica il book esistente.',
        alt: 'Hedging Flow su SPY: la pressione di copertura stimata dei dealer rispetto al prezzo durante la sessione',
      },
      '/forced-flow': {
        pitch:
          "Forced Flow guarda avanti: dal book di opzioni così com'è, quante azioni i dealer dovrebbero comprare o vendere per restare coperti se si muovono il prezzo, il tempo o la volatilità implicita, e il livello di flusso zero in cui quella copertura si annulla.",
      },
      '/market-tide': {
        pitch:
          "Market Tide legge insieme tutti gli indici seguiti da ZeroGEX: dove scorre il denaro in opzioni dell'intero mercato, con un punteggio da -100 a +100 corretto per il regime di gamma dei dealer che lo amplificherà o lo assorbirà.",
      },
      '/volatility': {
        pitch:
          "Volatility mette a confronto la volatilità implicita delle put e delle call lungo gli strike, per mostrare per quale lato il mercato paga di più, e la volatilità realizzata con quella prezzata dalla catena, per mostrare se quel prezzo è giustificato.",
      },
      '/basic-signals': IT_SIGNALS,
      '/tape-flow-bias': IT_SIGNALS,
      '/skew-delta': IT_SIGNALS,
      '/vanna-charm-flow': IT_SIGNALS,
      '/dealer-delta-pressure': IT_SIGNALS,
      '/gex-gradient': IT_SIGNALS,
      '/positioning-trap': IT_SIGNALS,
      '/option-contracts': {
        pitch:
          "Quotazioni opzioni live segue un singolo contratto di opzioni durante la sessione: il prezzo dell'ultimo scambio e il volume di ogni minuto, diviso a seconda che sia stato scambiato all'ask, al mid o al bid.",
      },
      '/options-calculator': {
        pitch:
          'Il Generatore di strategie prezza una strategia in opzioni a una o più gambe sulle quotazioni live e ne mostra il profitto o la perdita alla scadenza su un intervallo di prezzi.',
      },
      '/premium-heatmap': {
        pitch:
          "Premium Surface mappa il premio delle opzioni lungo strike e scadenze: il valore temporale rimasto in ogni call o put, o di quanto deve muoversi il prezzo perché vada in pareggio alla scadenza.",
      },
      '/spread-monitor': {
        pitch:
          "Lo Spread Monitor mostra l'ampiezza bid/ask quotata e la liquidità lungo la catena delle opzioni: se un mercato è negoziabile, non solo cosa significa.",
      },
      '/intraday-tools': {
        pitch:
          'Technicals è la lettura del simbolo attivo a partire dal prezzo: VWAP, opening range, picchi di volume e divergenze di momentum, tracciati rispetto al gamma flip, ai wall e al pin.',
      },
      '/pair-comparison': {
        pitch:
          'Pair Comparison mette fianco a fianco la struttura del gamma dei dealer di due tra SPY, QQQ, SPX e NDX: scale di net GEX allineate per strike e centrate sullo spot, con il gamma flip, i call e put wall e il max pain segnati.',
      },
    },
    genericPitch:
      'Basic è ZeroGEX in tempo reale: livelli in tempo reale per SPX, SPY, QQQ, NDX, ES e NQ, la Dashboard principale e il Gamma Terminal, tutte le pagine delle metriche, le pagine sui flussi di opzioni, i sei segnali Basic e gli avvisi sui muri.',
  },

  de: {
    labels: {
      heading: (page, plan) => `${page ?? 'Diese Seite'} ist Teil von ${plan}`,
      imageCaption: (page) => `${page ?? 'ZeroGEX'} an einem früheren Handelstag: ein Beispiel, nicht der heutige Stand.`,
      comparePlans: 'Pläne vergleichen',
      freeLevels: 'Oder nutze weiter die kostenlosen, verzögerten Level',
      basicFeaturesHeading: 'Das ist in Basic enthalten',
      proFeaturesHeading: 'Alles aus Basic, dazu',
      howItWorks: (page) => (page ? `${page} erklärt` : 'So funktioniert es'),
      seeAnnual: (plan) => `${plan} jährlich ansehen`,
    },
    copy: {
      price: ({ plan, amount }) => `${plan} kostet ${amount} im Monat.`,
      trialNoCard: (days) =>
        `Starte mit einer ${days}-tägigen kostenlosen Testphase, keine Karte nötig. Abgebucht wird nur, wenn du eine Karte hinterlegst, um deinen Plan zu behalten.`,
      trialCard: (days) =>
        `Starte mit einer ${days}-tägigen kostenlosen Testphase. Abgebucht wird erst nach ihrem Ende, und du kannst bis dahin jederzeit kündigen.`,
      upFront: (days) => `Du zahlst im Voraus, abgesichert durch die ${days}-Tage-Geld-zurück-Garantie.`,
      orBasicTrial: (days) =>
        `Oder starte mit der ${days}-tägigen kostenlosen Basic-Testphase und wechsle von dort zu Pro.`,
      orBasicTrialNoCard: (days) =>
        `Oder starte mit der ${days}-tägigen kostenlosen Basic-Testphase, ohne Karte, und wechsle von dort zu Pro.`,
      unresolved: 'Wähle auf der Preisseite einen Plan, um diese Seite freizuschalten.',
      annual: ({ plan, annual, perMonth }) =>
        `Oder zahle für ein Jahr: ${plan} jährlich kostet ${annual}, etwa ${perMonth} im Monat.`,
      startTrial: 'Kostenlose Testphase starten',
      getPlan: (plan) => `${plan} abonnieren`,
      startBasicTrial: 'Mit der Basic-Testphase starten',
    },
    features: [
      'Echtzeit-Level für SPX, SPY, QQQ, NDX, ES und NQ: Gamma-Flip, Call- und Put-Walls und Max Pain',
      'Haupt-Dashboard und Gamma Terminal in Echtzeit, dazu Mein Dashboard für dein eigenes Board',
      'Dealer Positioning, GEX Heatmap, GEX Strike Profile, Volatility und alle weiteren Metrik-Seiten',
      'Optionsflow: Flow Analysis, Smart Money, Hedging Flow und Market Tide',
      'Alle sechs Basic-Signale, darunter Vanna/Charm Flow und Dealer Delta Pressure',
      'Wand-Alarme, wenn der Kurs eine Call- oder Put-Wand erreicht oder bricht, in der App und per E-Mail',
      'Strategie-Builder und Live-Optionskurse',
    ],
    pitches: {
      '/dashboard': {
        pitch:
          'Das Haupt-Dashboard ist die Live-Lesart des Marktes auf einem Bildschirm für SPX, SPY, QQQ, NDX, ES und NQ: wo die Dealer positioniert sind (Gamma-Regime, Gamma Flip, Call- und Put-Walls) und was das Tape sagt (Flow und Volatilität). Hier orientierst du dich in 30 Sekunden, bevor du irgendeine andere Seite öffnest.',
        alt: 'Die Karten mit den wichtigsten Levels im Haupt-Dashboard: Call Wall, Put Wall, Net GEX und Gamma Flip',
      },
      '/my-dashboard': {
        pitch:
          'Mein Dashboard ist ein Board, das du dir selbst aus ZeroGEX-Karten und -Charts zusammenstellst, so angeordnet, wie du handelst.',
      },
      '/fuseline-radar': {
        pitch:
          "Das Fuseline Radar ist um einen einzelnen Trade gebaut: Du legst eine Fuse, eine Richtung und ein oder zwei Ziele fest, und die Seite zeichnet deine Route in den Gamma Chart, neben einer Leiter mit dem modellierten Gamma Strike für Strike und seiner Veränderung in den letzten Minuten. Die Seite ordnet die Daten um deinen Plan herum und ist kein Handelssignal.",
      },
      '/live-bulletin': {
        pitch:
          'Das Live-Bulletin ist eine Live-Übersicht zum Dealer-Gamma für jeweils ein Symbol: Gamma-Regime, Gamma Flip, Pin-Strike, Call- und Put-Walls, Max Pain, Net GEX, ein Band für die erwartete Spanne und eine Positionierungskarte, auf einer Karte, die du herunterladen oder teilen kannst.',
      },
      '/gamma-exposure': {
        pitch:
          'Dealer Positioning ist die Strukturkarte des Optionsbuchs: Net GEX am Spot, Gamma Flip, Call- und Put-Walls und wie sich das Dealer-Gamma über Strikes und Verfallstermine verteilt. Jeder Chart dort beantwortet eine Frage: Wo sind die Dealer positioniert, und was müssen sie tun, wenn sich der Kurs bewegt?',
        alt: 'Die GEX-Heatmap nach Strike und Tagen bis zum Verfall auf der Seite Dealer Positioning',
      },
      '/greeks-gex': {
        pitch:
          'GEX Summary zeigt die wichtigsten GEX-Zahlen und die Level, die sich daraus ergeben, auf einem Bildschirm, bildet das Dealer-Gamma über Preis und Zeit ab und zeigt, wie stabil der Gamma Flip über verschiedene Optionshorizonte ist und ob das heutige Dealer-Gamma ungewöhnlich ist.',
      },
      '/gex-strike-profile': {
        pitch:
          'Das GEX Strike Profile stellt den Kurs neben das modellierte Dealer-Gamma und die offenen Positionen, Strike für Strike, mit markiertem Gamma Flip sowie markierten Call- und Put-Walls, damit du die Level siehst, auf die sich der Kurs zubewegt.',
        alt: 'Das GEX Strike Profile: Kurs neben Gamma und Positionen je Strike, mit markiertem Gamma Flip und markierten Walls',
      },
      '/gex-heatmap': {
        pitch:
          "Die GEX Heatmap legt das Dealer-Gamma als Raster aus Strike und Uhrzeit der Sitzung an, sodass Strikes mit viel Dealer-Gamma als helle Bänder hervortreten.",
      },
      '/gamma-shift': {
        pitch:
          "Gamma Shift zeigt nicht, wo das Dealer-Gamma liegt, sondern wie es sich in einem von dir gewählten Zeitfenster verändert hat, aufgeteilt in neue Positionierung und dieselben Kontrakte, die sich mit dem Kurs neu bewerten, und wie viel des Buchs zum nächsten Handelsschluss verfällt.",
      },
      '/max-pain': {
        pitch:
          'Max Pain zeigt für jeden Verfallstermin den Strike, an dem die meiste Optionsprämie wertlos verfällt, und liest ihn neben dem Gamma-Profil, damit du ein Level, das wie ein Magnet wirkt, von einem Zufall unterscheiden kannst.',
      },
      '/flow-analysis': {
        pitch:
          'Flow Analysis ist die Tape-Ansicht des Optionsmarkts: was heute gehandelt wurde und welche Seite dafür den Spread überquert hat, mit gekauften und verkauften Kontrakten, Nettoprämie und Put/Call Ratio auf einer gemeinsamen Zeitachse.',
      },
      '/smart-money': {
        pitch:
          'Smart Money filtert Options-Prints heraus, die groß oder ungewöhnlich genug sind, um die Position von jemandem zu sein statt Absicherungsrauschen, teilt sie in Calls und Puts auf und zeigt, wie sich der Bias im Tagesverlauf aufbaut.',
      },
      '/hedging-flow': {
        pitch:
          'Hedging Flow schätzt den Absicherungsdruck der Dealer, den die heutigen Optionstrades erzeugen, und legt ihn neben den Kurs: was der heutige Flow die Dealer tun lässt, nicht nur, was das bestehende Buch impliziert.',
        alt: 'Hedging Flow für SPY: geschätzter Absicherungsdruck der Dealer gegenüber dem Kurs im Verlauf der Sitzung',
      },
      '/forced-flow': {
        pitch:
          'Forced Flow schaut nach vorn: Aus dem Optionsbuch, wie es jetzt steht, ergibt sich, wie viele Aktien die Dealer kaufen oder verkaufen müssten, um abgesichert zu bleiben, wenn sich Kurs, Zeit oder implizite Volatilität bewegen, und das Zero-Flow-Level, an dem sich diese Absicherung aufhebt.',
      },
      '/market-tide': {
        pitch:
          "Market Tide liest alle von ZeroGEX verfolgten Indizes auf einmal: wohin das Optionsgeld des gesamten Marktes fließt, als Score von -100 bis +100, angepasst an das Gamma-Regime der Dealer, das diesen Flow verstärken oder abfedern wird.",
      },
      '/volatility': {
        pitch:
          "Volatility stellt die implizite Volatilität von Puts und Calls über die Strikes gegenüber, um zu zeigen, für welche Seite der Markt mehr zahlt, und die realisierte Volatilität dem, was die Optionskette einpreist, um zu zeigen, ob dieser Preis gerechtfertigt ist.",
      },
      '/basic-signals': DE_SIGNALS,
      '/tape-flow-bias': DE_SIGNALS,
      '/skew-delta': DE_SIGNALS,
      '/vanna-charm-flow': DE_SIGNALS,
      '/dealer-delta-pressure': DE_SIGNALS,
      '/gex-gradient': DE_SIGNALS,
      '/positioning-trap': DE_SIGNALS,
      '/option-contracts': {
        pitch:
          'Live-Optionskurse verfolgt einen einzelnen Optionskontrakt durch die Sitzung: den letzten Handelspreis und das Volumen jeder Minute, aufgeteilt danach, ob zum Ask, zur Mitte oder zum Bid gehandelt wurde.',
      },
      '/options-calculator': {
        pitch:
          'Der Strategie-Builder bewertet eine Optionsstrategie mit einem oder mehreren Legs zu Live-Kursen und zeigt ihren Gewinn oder Verlust bei Verfall über eine Spanne von Kursen.',
      },
      '/premium-heatmap': {
        pitch:
          "Premium Surface bildet die Optionsprämie über Strikes und Verfallstermine ab: den verbleibenden Zeitwert jedes Calls oder Puts oder wie weit sich der Kurs bewegen muss, damit er bei Verfall die Gewinnschwelle erreicht.",
      },
      '/spread-monitor': {
        pitch:
          'Der Spread Monitor zeigt die quotierte Bid/Ask-Spanne und die Liquidität über die gesamte Optionskette: ob ein Markt handelbar ist, nicht nur, was er bedeutet.',
      },
      '/intraday-tools': {
        pitch:
          'Technicals ist die preisorientierte Lesart des aktiven Symbols: VWAP, Opening Range, Volumenspitzen und Momentum-Divergenzen, eingezeichnet gegen Gamma Flip, Walls und Pin.',
      },
      '/pair-comparison': {
        pitch:
          'Pair Comparison stellt die Dealer-Gamma-Struktur von zwei der Symbole SPY, QQQ, SPX und NDX nebeneinander: nach Strikes ausgerichtete Net-GEX-Leitern, zentriert auf den Spot, mit markiertem Gamma Flip, Call- und Put-Walls und Max Pain.',
      },
    },
    genericPitch:
      'Basic ist ZeroGEX live: Echtzeit-Level für SPX, SPY, QQQ, NDX, ES und NQ, das Haupt-Dashboard und das Gamma Terminal, alle Metrik-Seiten, die Optionsflow-Seiten, die sechs Basic-Signale und Wand-Alarme.',
  },

  es: {
    labels: {
      heading: (page, plan) => `${page ?? 'Esta página'} forma parte de ${plan}`,
      imageCaption: (page) => `${page ?? 'ZeroGEX'} en una sesión pasada: una lectura de ejemplo, no la de hoy.`,
      comparePlans: 'Comparar planes',
      freeLevels: 'O sigue usando los niveles gratuitos y diferidos',
      basicFeaturesHeading: 'Qué incluye Basic',
      proFeaturesHeading: 'Todo lo incluido en Basic, más',
      howItWorks: (page) => (page ? `${page}: cómo funciona` : 'Cómo funciona'),
      seeAnnual: (plan) => `Ver ${plan} anual`,
    },
    copy: {
      price: ({ plan, amount }) => `${plan} cuesta ${amount} al mes.`,
      trialNoCard: (days) =>
        `Empieza con una prueba gratuita de ${days} días, sin tarjeta. No se cobra nada a menos que añadas una tarjeta para mantener tu plan.`,
      trialCard: (days) =>
        `Empieza con una prueba gratuita de ${days} días. No se cobra nada hasta que termine, y puedes cancelar en cualquier momento antes de esa fecha.`,
      upFront: (days) => `Pagas por adelantado, con la garantía de devolución de ${days} días.`,
      orBasicTrial: (days) => `O empieza con la prueba gratuita de ${days} días de Basic y cambia a Pro desde ahí.`,
      orBasicTrialNoCard: (days) =>
        `O empieza con la prueba gratuita de ${days} días de Basic, sin tarjeta, y cambia a Pro desde ahí.`,
      unresolved: 'Elige un plan en la página de precios para desbloquearla.',
      annual: ({ plan, annual, perMonth }) =>
        `O paga por un año: ${plan} anual cuesta ${annual}, unos ${perMonth} al mes.`,
      startTrial: 'Empieza tu prueba gratuita',
      getPlan: (plan) => `Suscribirse a ${plan}`,
      startBasicTrial: 'Empieza con la prueba de Basic',
    },
    features: [
      'Niveles en tiempo real para SPX, SPY, QQQ, NDX, ES y NQ: gamma flip, call wall y put wall, y max pain',
      'El Panel principal y el Gamma Terminal en vivo, más Mi panel para armar tu propio tablero',
      'Dealer Positioning, GEX Heatmap, GEX Strike Profile, Volatility y todas las demás páginas de métricas',
      'Flujo de opciones: Flow Analysis, Smart Money, Hedging Flow y Market Tide',
      'Las seis Señales Basic, entre ellas Vanna/Charm Flow y Dealer Delta Pressure',
      'Alertas de muros cuando el precio llega a un muro call o put o lo rompe, en la app y por correo',
      'Creador de estrategias y Cotizaciones de opciones en vivo',
    ],
    pitches: {
      '/dashboard': {
        pitch:
          'El Panel principal es la lectura en vivo del mercado en una sola pantalla para SPX, SPY, QQQ, NDX, ES y NQ: dónde están posicionados los dealers (el régimen de gamma, el gamma flip, la call wall y la put wall) y qué dice el tape (flujo y volatilidad). Es donde te orientas en 30 segundos, antes de abrir cualquier otra página.',
        alt: 'Las tarjetas de niveles clave del Panel principal: call wall, put wall, net GEX y gamma flip',
      },
      '/my-dashboard': {
        pitch:
          'Mi panel es un tablero que armas tú mismo con tarjetas y gráficos de ZeroGEX, organizado según cómo operas.',
      },
      '/fuseline-radar': {
        pitch:
          "El Fuseline Radar está construido en torno a una sola operación: fijas una Fuse, una dirección y uno o dos objetivos, y la página dibuja tu ruta sobre el Gamma Chart junto a una escala, strike por strike, del gamma modelado y de cómo ha cambiado en los últimos minutos. Organiza los datos en torno a tu plan; no es una señal de trading.",
      },
      '/live-bulletin': {
        pitch:
          'El Boletín en vivo es una ficha en vivo del gamma de los dealers, un símbolo a la vez: el régimen de gamma, el gamma flip, el strike de pin, la call wall y la put wall, el max pain, el net GEX, una banda de rango esperado y un mapa de posicionamiento, en una sola tarjeta que puedes descargar o compartir.',
      },
      '/gamma-exposure': {
        pitch:
          'Dealer Positioning es el mapa estructural del libro de opciones: el net GEX en el spot, el gamma flip, la call wall y la put wall, y cómo se reparte el gamma de los dealers entre strikes y vencimientos. Cada gráfico responde a una pregunta: ¿dónde están posicionados los dealers y qué tendrán que hacer cuando se mueva el precio?',
        alt: 'El mapa de calor del GEX por strike y días al vencimiento en la página Dealer Positioning',
      },
      '/greeks-gex': {
        pitch:
          'GEX Summary reúne en una sola pantalla las cifras principales del GEX y los niveles que implican, mapea el gamma de los dealers en precio y tiempo, y muestra cómo se sostiene el gamma flip en los distintos horizontes de opciones y si el gamma de los dealers de hoy es inusual.',
      },
      '/gex-strike-profile': {
        pitch:
          'El GEX Strike Profile pone el precio junto al gamma modelado de los dealers y las posiciones abiertas, strike por strike, con el gamma flip, la call wall y la put wall marcados, para que veas los niveles hacia los que se mueve el precio.',
        alt: 'El GEX Strike Profile: el precio junto al gamma y las posiciones por strike, con el gamma flip y las walls marcados',
      },
      '/gex-heatmap': {
        pitch:
          "El GEX Heatmap dispone el gamma de los dealers en una cuadrícula de strike por hora de la sesión, para que los strikes con mucho gamma de los dealers resalten como bandas brillantes.",
      },
      '/gamma-shift': {
        pitch:
          "Gamma Shift no muestra dónde está el gamma de los dealers, sino cómo cambió en una ventana que eliges tú, separando el posicionamiento nuevo de los mismos contratos que se vuelven a valorar al moverse el precio, y cuánto del libro vence en el próximo cierre.",
      },
      '/max-pain': {
        pitch:
          'Max Pain muestra, para cada vencimiento, el strike en el que vence sin valor la mayor cantidad de prima de opciones, y lo lee junto al perfil de gamma, para que distingas un nivel que actúa como imán de una coincidencia.',
      },
      '/flow-analysis': {
        pitch:
          'Flow Analysis es la vista del tape del mercado de opciones: qué se negoció hoy y qué lado cruzó el spread para negociarlo, con los contratos comprados y vendidos, la prima neta y el put/call ratio sobre una misma línea de tiempo.',
      },
      '/smart-money': {
        pitch:
          'Smart Money filtra las operaciones de opciones lo bastante grandes o inusuales como para ser la posición de alguien y no ruido de cobertura, las separa en calls y puts, y muestra cómo se forma el sesgo a lo largo del día.',
      },
      '/hedging-flow': {
        pitch:
          'Hedging Flow estima la presión de cobertura de los dealers que generan las operaciones de opciones de hoy y la compara con el precio: lo que el flujo de hoy obliga a hacer a los dealers, no solo lo que implica el libro existente.',
        alt: 'Hedging Flow en SPY: la presión de cobertura estimada de los dealers frente al precio a lo largo de la sesión',
      },
      '/forced-flow': {
        pitch:
          'Forced Flow mira hacia delante: a partir del libro de opciones tal como está, cuántas acciones tendrían que comprar o vender los dealers para seguir cubiertos si se mueven el precio, el tiempo o la volatilidad implícita, y el nivel de flujo cero en el que esa cobertura se anula.',
      },
      '/market-tide': {
        pitch:
          "Market Tide lee a la vez todos los índices que sigue ZeroGEX: hacia dónde fluye el dinero en opciones de todo el mercado, con una puntuación de -100 a +100 ajustada por el régimen de gamma de los dealers que lo amplificará o lo absorberá.",
      },
      '/volatility': {
        pitch:
          "Volatility enfrenta la volatilidad implícita de puts y calls a lo largo de los strikes, para mostrar por qué lado paga más el mercado, y la volatilidad realizada frente a la que descuenta la cadena, para mostrar si ese precio está justificado.",
      },
      '/basic-signals': ES_SIGNALS,
      '/tape-flow-bias': ES_SIGNALS,
      '/skew-delta': ES_SIGNALS,
      '/vanna-charm-flow': ES_SIGNALS,
      '/dealer-delta-pressure': ES_SIGNALS,
      '/gex-gradient': ES_SIGNALS,
      '/positioning-trap': ES_SIGNALS,
      '/option-contracts': {
        pitch:
          'Cotizaciones de opciones en vivo sigue un contrato de opciones a lo largo de la sesión: el precio de la última operación y el volumen de cada minuto, separado según se negociara al ask, al mid o al bid.',
      },
      '/options-calculator': {
        pitch:
          'El Creador de estrategias valora una estrategia de opciones de una o varias patas con cotizaciones en vivo y muestra su ganancia o pérdida al vencimiento en un rango de precios.',
      },
      '/premium-heatmap': {
        pitch:
          "Premium Surface mapea la prima de las opciones a lo largo de strikes y vencimientos: el valor temporal que le queda a cada call o put, o cuánto tiene que moverse el precio para que alcance el punto de equilibrio al vencimiento.",
      },
      '/spread-monitor': {
        pitch:
          'El Spread Monitor muestra la amplitud bid/ask cotizada y la liquidez a lo largo de la cadena de opciones: si un mercado se puede operar, no solo lo que significa.',
      },
      '/intraday-tools': {
        pitch:
          'Technicals es la lectura del símbolo activo a partir del precio: el VWAP, el rango de apertura, los picos de volumen y la divergencia de momentum, trazados frente al gamma flip, las walls y el pin.',
      },
      '/pair-comparison': {
        pitch:
          'Pair Comparison pone lado a lado la estructura de gamma de los dealers de dos de SPY, QQQ, SPX y NDX: escalas de net GEX alineadas por strike y centradas en el spot, con el gamma flip, la call wall, la put wall y el max pain marcados.',
      },
    },
    genericPitch:
      'Basic es ZeroGEX en vivo: niveles en tiempo real para SPX, SPY, QQQ, NDX, ES y NQ, el Panel principal y el Gamma Terminal, todas las páginas de métricas, las páginas de flujo de opciones, las seis señales Basic y las alertas de muros.',
  },

  fr: {
    labels: {
      heading: (page, plan) => `${page ?? 'Cette page'} fait partie de ${plan}`,
      imageCaption: (page) =>
        `${page ?? 'ZeroGEX'} lors d'une séance passée : une lecture d'exemple, pas celle d'aujourd'hui.`,
      comparePlans: 'Comparer les offres',
      freeLevels: 'Ou continuez avec les niveaux gratuits et différés',
      basicFeaturesHeading: 'Ce que comprend Basic',
      proFeaturesHeading: 'Tout ce qui est inclus dans Basic, plus',
      howItWorks: (page) => (page ? `${page} : comment ça marche` : 'Comment ça marche'),
      seeAnnual: (plan) => `Voir ${plan} annuel`,
    },
    copy: {
      price: ({ plan, amount }) => `${plan} coûte ${amount} par mois.`,
      trialNoCard: (days) =>
        `Commencez par un essai gratuit de ${days} jours, sans carte. Rien n'est prélevé, sauf si vous ajoutez une carte pour garder votre abonnement.`,
      trialCard: (days) =>
        `Commencez par un essai gratuit de ${days} jours. Rien n'est prélevé avant la fin de l'essai, et vous pouvez annuler à tout moment d'ici là.`,
      upFront: (days) => `Vous payez d'avance, avec la garantie satisfait ou remboursé de ${days} jours.`,
      orBasicTrial: (days) =>
        `Ou commencez par l'essai gratuit de ${days} jours de Basic, puis passez à Pro depuis votre essai.`,
      orBasicTrialNoCard: (days) =>
        `Ou commencez par l'essai gratuit de ${days} jours de Basic, sans carte, puis passez à Pro depuis votre essai.`,
      unresolved: 'Choisissez une offre sur la page des tarifs pour la débloquer.',
      annual: ({ plan, annual, perMonth }) =>
        `Ou payez pour un an : ${plan} annuel coûte ${annual}, soit environ ${perMonth} par mois.`,
      startTrial: "Démarrer l'essai gratuit",
      getPlan: (plan) => `S'abonner à ${plan}`,
      startBasicTrial: "Commencer par l'essai Basic",
    },
    features: [
      'Niveaux en temps réel pour SPX, SPY, QQQ, NDX, ES et NQ : gamma flip, call wall et put wall, et max pain',
      'Le Tableau de bord principal et le Gamma Terminal en direct, plus Mon tableau de bord à composer vous-même',
      'Dealer Positioning, GEX Heatmap, GEX Strike Profile, Volatility et toutes les autres pages de métriques',
      'Flux d’options : Flow Analysis, Smart Money, Hedging Flow et Market Tide',
      'Les six Signaux Basic, dont Vanna/Charm Flow et Dealer Delta Pressure',
      'Alertes de murs quand le prix atteint ou casse un mur call ou put, dans l’app et par e-mail',
      'Générateur de stratégies et Cotations d’options en direct',
    ],
    pitches: {
      '/dashboard': {
        pitch:
          "Le Tableau de bord principal est la lecture en direct du marché sur un seul écran pour SPX, SPY, QQQ, NDX, ES et NQ : où sont positionnés les dealers (le régime de gamma, le gamma flip, la call wall et la put wall) et ce que dit le tape (flux et volatilité). C'est là que vous vous repérez en 30 secondes, avant d'ouvrir toute autre page.",
        alt: 'Les cartes des niveaux clés du Tableau de bord principal : call wall, put wall, net GEX et gamma flip',
      },
      '/my-dashboard': {
        pitch:
          'Mon tableau de bord est un écran que vous composez vous-même avec les cartes et graphiques ZeroGEX, organisé selon votre façon de trader.',
      },
      '/fuseline-radar': {
        pitch:
          "Le Fuseline Radar est construit autour d'un seul trade : vous fixez une Fuse, une direction et un ou deux objectifs, et la page trace votre route sur le Gamma Chart, à côté d'une échelle strike par strike du gamma modélisé et de son évolution sur les dernières minutes. Elle organise les données autour de votre plan ; ce n'est pas un signal de trading.",
      },
      '/live-bulletin': {
        pitch:
          'Le Bulletin en direct est un bilan en direct du gamma des dealers, un symbole à la fois : le régime de gamma, le gamma flip, le strike de pin, la call wall et la put wall, le max pain, le net GEX, une bande de range attendu et une cartographie du positionnement, sur une seule carte que vous pouvez télécharger ou partager.',
      },
      '/gamma-exposure': {
        pitch:
          "Dealer Positioning est la carte structurelle du carnet d'options : le net GEX au spot, le gamma flip, la call wall et la put wall, et la répartition du gamma des dealers entre strikes et échéances. Chaque graphique répond à une question : où sont positionnés les dealers, et que devront-ils faire quand le prix bouge ?",
        alt: "La heatmap du GEX par strike et par jours jusqu'à l'échéance sur la page Dealer Positioning",
      },
      '/greeks-gex': {
        pitch:
          "GEX Summary réunit sur un seul écran les principaux chiffres du GEX et les niveaux qu'ils impliquent, cartographie le gamma des dealers dans le prix et dans le temps, et montre la tenue du gamma flip selon les horizons d'options et si le gamma des dealers du jour est inhabituel.",
      },
      '/gex-strike-profile': {
        pitch:
          'Le GEX Strike Profile place le prix à côté du gamma modélisé des dealers et des positions ouvertes, strike par strike, avec le gamma flip, la call wall et la put wall indiqués, pour voir les niveaux vers lesquels le prix se dirige.',
        alt: 'Le GEX Strike Profile : le prix à côté du gamma et des positions par strike, avec le gamma flip et les walls indiqués',
      },
      '/gex-heatmap': {
        pitch:
          "La GEX Heatmap présente le gamma des dealers sous forme de grille, strike contre heure de la séance, pour que les strikes chargés en gamma des dealers ressortent en bandes lumineuses.",
      },
      '/gamma-shift': {
        pitch:
          "Gamma Shift montre non pas où se trouve le gamma des dealers, mais comment il a changé sur une fenêtre que vous choisissez, en séparant le nouveau positionnement des mêmes contrats revalorisés au fil du prix, ainsi que la part du carnet qui expire à la prochaine clôture.",
      },
      '/max-pain': {
        pitch:
          "Max Pain indique, pour chaque échéance, le strike où le plus de prime d'options expire sans valeur, et le lit à côté du profil de gamma, pour distinguer un niveau qui agit comme un aimant d'une simple coïncidence.",
      },
      '/flow-analysis': {
        pitch:
          "Flow Analysis est la vue du tape sur le marché des options : ce qui s'est échangé aujourd'hui et quel côté a franchi le spread pour le traiter, avec les contrats achetés et vendus, la prime nette et le put/call ratio sur une même ligne de temps.",
      },
      '/smart-money': {
        pitch:
          "Smart Money repère les transactions d'options assez grosses ou inhabituelles pour être la position de quelqu'un plutôt que du bruit de couverture, les répartit entre calls et puts, et montre comment le biais se construit au fil de la journée.",
      },
      '/hedging-flow': {
        pitch:
          "Hedging Flow estime la pression de couverture des dealers créée par les transactions d'options du jour et la met en regard du prix : ce que le flux du jour oblige les dealers à faire, pas seulement ce qu'implique le carnet existant.",
        alt: 'Hedging Flow sur SPY : la pression de couverture estimée des dealers face au prix au fil de la séance',
      },
      '/forced-flow': {
        pitch:
          "Forced Flow regarde vers l'avant : à partir du carnet d'options tel qu'il est, combien d'actions les dealers devraient acheter ou vendre pour rester couverts si le prix, le temps ou la volatilité implicite bougent, et le niveau de flux nul où cette couverture s'annule.",
      },
      '/market-tide': {
        pitch:
          "Market Tide lit d'un coup tous les indices suivis par ZeroGEX : où va l'argent des options à l'échelle du marché, noté de -100 à +100 et ajusté au régime de gamma des dealers qui va l'amplifier ou l'absorber.",
      },
      '/volatility': {
        pitch:
          "Volatility compare la volatilité implicite des puts et des calls selon les strikes, pour montrer de quel côté le marché paie le plus, et la volatilité réalisée à celle que la chaîne intègre dans ses prix, pour montrer si ce prix est mérité.",
      },
      '/basic-signals': FR_SIGNALS,
      '/tape-flow-bias': FR_SIGNALS,
      '/skew-delta': FR_SIGNALS,
      '/vanna-charm-flow': FR_SIGNALS,
      '/dealer-delta-pressure': FR_SIGNALS,
      '/gex-gradient': FR_SIGNALS,
      '/positioning-trap': FR_SIGNALS,
      '/option-contracts': {
        pitch:
          "Cotations d’options en direct suit un contrat d'options tout au long de la séance : le prix de la dernière transaction et le volume de chaque minute, réparti selon qu'il s'est échangé à l'ask, au mid ou au bid.",
      },
      '/options-calculator': {
        pitch:
          "Le Générateur de stratégies valorise une stratégie d'options à une ou plusieurs jambes aux cotations en direct et affiche son profit ou sa perte à l'échéance sur une plage de prix.",
      },
      '/premium-heatmap': {
        pitch:
          "Premium Surface cartographie la prime des options selon les strikes et les échéances : la valeur temps qui reste à chaque call ou put, ou de combien le prix doit bouger pour atteindre le point mort à l'échéance.",
      },
      '/spread-monitor': {
        pitch:
          "Le Spread Monitor affiche l'écart bid/ask coté et la liquidité sur toute la chaîne d'options : si un marché est négociable, pas seulement ce qu'il signifie.",
      },
      '/intraday-tools': {
        pitch:
          "Technicals est la lecture du symbole actif à partir du prix : le VWAP, l'opening range, les pics de volume et la divergence de momentum, tracés face au gamma flip, aux walls et au pin.",
      },
      '/pair-comparison': {
        pitch:
          'Pair Comparison met côte à côte la structure du gamma des dealers de deux symboles parmi SPY, QQQ, SPX et NDX : des échelles de net GEX alignées par strike et centrées sur le spot, avec le gamma flip, la call wall, la put wall et le max pain indiqués.',
      },
    },
    genericPitch:
      "Basic, c'est ZeroGEX en direct : des niveaux en temps réel pour SPX, SPY, QQQ, NDX, ES et NQ, le Tableau de bord principal et le Gamma Terminal, toutes les pages de métriques, les pages de flux d'options, les six signaux Basic et les alertes de murs.",
  },
};
