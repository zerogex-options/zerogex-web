import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    toggleTheme: 'Toggle theme',
    navPricing: 'Pricing',
    navFreeGammaLevels: 'Free Gamma Levels',
    heroPill: 'Real-Time GEX for 0DTE Traders',
    heroTitlePre: 'Read the dealer book before the move,',
    heroTitleHighlight: 'not after it.',
    heroSubtitle1:
      'ZeroGEX is real-time gamma exposure built for the way SPX and 0DTE actually trade today — live gamma flip, call and put walls, dealer positioning, and composite signals you can read.',
    heroSubtitle2:
      'No black-box scores. See the free, 15-minute-delayed gamma levels — or start a trial to read the live dealer book.',
    ctaOpenFreeGammaLevels: 'Open free gamma levels',
    ctaStartTrial: 'Start {days}-day free trial',
    noCardPreview: 'No card for the free preview',
    cancelAnytime: 'Cancel anytime, no email required',
    problemPill: 'Why 0DTE breaks delayed GEX',
    problemTitle: 'The chain moves under you between morning coffee and lunch.',
    problemSubtitle:
      'Same-day expiries now dominate SPX flow. That changes what dealer positioning means, how fast the regime can flip, and what a stale read costs.',
    pain1Title: 'Delayed feeds miss the flip',
    pain1Body:
      "A 15-minute-delayed GEX read is structurally wrong when the gamma flip is migrating intraday. The regime can change during the delay window, and the trade decisions that follow are out of sync with the actual dealer book.",
    pain2Title: 'Static screenshots miss the migration',
    pain2Body:
      "Walls, the flip, and the gamma magnet all migrate intraday. A call wall that's chasing price is a very different read than one that's holding — and a screenshot can't show you which one you're looking at.",
    pain3Title: 'Per-strike GEX misses sign consistency',
    pain3Body:
      'The retail shortcut of summing gamma × OI by strike can produce a positive headline number while the underlying curve says spot is below the flip. The headline and the regime line cannot contradict — but in some tools they do.',
    pain4Title: 'Aggregate gamma misses the 0DTE bucket',
    pain4Body:
      "When most of today's gamma sits in same-day options, an all-expiries average is the wrong read for the intraday tape. The 0DTE bucket is where the hedging actually happens.",
    solutionPill: 'How ZeroGEX is built',
    solutionTitle: 'Real-time, methodology-first, 0DTE-aware.',
    solutionSubtitle:
      "Built specifically for the structural reads that matter intraday — and structurally honest about what the data can and can't say.",
    feat1Title: 'Real-time dealer gamma',
    feat1Body:
      'Live spot-shift dealer gamma profile, recalculated continuously. The headline Net GEX and the gamma flip read off one curve — they cannot contradict each other.',
    feat2Title: 'Hardened gamma flip',
    feat2Body:
      'Interior, structural, and actionable-distance gates against grid-edge artifacts and noise-floor crossings. Reports NULL on degraded chains instead of silently freezing on a stale value.',
    feat3Title: 'Per-DTE bucketing',
    feat3Body:
      'Strike-by-DTE GEX heatmap so the 0DTE concentration that dominates the intraday tape is visible directly, not buried inside an all-expiries average.',
    feat4Title: 'Composite signal layer',
    feat4Body:
      'Squeeze Setup, Positioning Trap, Trap Detection, EOD Pressure — each with published methodology in the Education section, not black-box alerts.',
    feat5Title: 'Methodology you can read',
    feat5Body:
      "Every signal and structural read has a write-up explaining how it's built and when it fails. No magic numbers, no hidden multipliers.",
    feat6Title: 'Free read on the structural stack',
    feat6Body:
      'Net GEX, gamma flip, call wall, put wall, max pain, and the dealer gamma profile across SPX, SPY, and QQQ — open to anyone, no signup required, refreshed every 15 minutes.',
    proofPill: 'Free Gamma Levels',
    proofTitle: "See today's dealer book without paying for it.",
    proofSubtitle:
      'The free gamma-levels page surfaces the structural reads for SPX, SPY, and QQQ — Net GEX, gamma flip with distance from spot, call and put walls, max pain, and the dealer gamma profile. Refreshed every 15 minutes. Anonymous access, no signup, no card.',
    tiersPill: "Upgrade when you're ready",
    tiersTitle: 'Pricing built for the way 0DTE traders actually work.',
    tiersSubtitle:
      'Free 15-min-delayed gamma levels for the structural reads. Paid plans add real-time updates, the full dashboard, the signal layer, the Advanced Signals, and direct API access. Every plan starts with a {days}-day free trial — cancel anytime.',
    mostPopular: 'Most popular',
    includesTrial: 'Includes a {days}-day free trial.',
    basicFeat1: 'Real-time metrics and full strategy tools',
    basicFeat2: 'Access to Basic Signals',
    basicFeat3: 'Per-signal context fields and intraday timelines',
    basicFeat4: 'Designed for disciplined daily execution',
    proFeat1: 'Everything in Basic',
    proFeat2: 'Access to Advanced Signals (EOD Pressure, Trap Detection, Squeeze Setup, more)',
    proFeat3: 'Direct access to ZeroGEX APIs',
    proFeat4: 'Real-time scoring + historical score charts',
    annualBillingPre: 'Annual billing also available — see',
    pricingPageLink: 'the pricing page',
    annualBillingPost: 'for current promo pricing and annual savings.',
    eduPill: 'Read the methodology',
    eduTitle: 'Every read has a write-up.',
    eduSubtitle: 'The structural reads, the signal layer, and the methodology — all documented. Pick a starting point.',
    edu1Title: 'Gamma Exposure (GEX) Explained',
    edu1Body: 'The complete guide — pillar piece.',
    edu2Title: 'How to Read a Gamma Flip',
    edu2Body: 'Practical intraday workflow.',
    edu3Title: 'Gamma Walls Explained',
    edu3Body: 'Call wall, put wall, and how price reacts.',
    edu4Title: '0DTE Dealer Positioning',
    edu4Body: 'Why same-day expiries dominate the read.',
    edu5Title: 'Max Pain — Does It Work?',
    edu5Body: 'Evidence-honest read.',
    edu6Title: 'Vanna and Charm Explained',
    edu6Body: 'Second-order Greeks and dealer hedging.',
    readMore: 'Read',
    finalTitlePre: 'See the dealer book.',
    finalTitleHighlight: 'Decide for yourself.',
    finalSubtitle:
      "The free read is the same calculation paid users get — just 15 minutes behind. Try it on today's tape before you decide whether to upgrade.",
    seePricing: 'See pricing',
    disclaimer:
      'Educational content only — not financial advice. ZeroGEX surfaces structural reads on dealer positioning; trade decisions remain yours.',
  },
  it: {
    toggleTheme: 'Cambia tema',
    navPricing: 'Prezzi',
    navFreeGammaLevels: 'Livelli Gamma Gratuiti',
    heroPill: 'GEX in tempo reale per i trader 0DTE',
    heroTitlePre: 'Leggi il book dei dealer prima della mossa,',
    heroTitleHighlight: 'non dopo.',
    heroSubtitle1:
      "ZeroGEX è l'esposizione gamma in tempo reale costruita per il modo in cui SPX e le 0DTE si negoziano oggi — gamma flip live, call e put wall, posizionamento dei dealer e segnali composti che puoi leggere.",
    heroSubtitle2:
      'Nessun punteggio black-box. Guarda i livelli gamma gratuiti, ritardati di 15 minuti — oppure avvia una prova per leggere il book dei dealer in tempo reale.',
    ctaOpenFreeGammaLevels: 'Apri i livelli gamma gratuiti',
    ctaStartTrial: 'Avvia la prova gratuita di {days} giorni',
    noCardPreview: "Nessuna carta per l'anteprima gratuita",
    cancelAnytime: 'Annulla in qualsiasi momento, nessuna email richiesta',
    problemPill: 'Perché le 0DTE rompono il GEX ritardato',
    problemTitle: 'La catena si muove sotto di te tra il caffè del mattino e il pranzo.',
    problemSubtitle:
      'Le scadenze giornaliere ora dominano il flusso SPX. Questo cambia cosa significa il posizionamento dei dealer, quanto velocemente il regime può ribaltarsi e quanto costa una lettura obsoleta.',
    pain1Title: 'I feed ritardati perdono il flip',
    pain1Body:
      'Una lettura GEX ritardata di 15 minuti è strutturalmente errata quando il gamma flip si sposta durante la giornata. Il regime può cambiare durante la finestra di ritardo, e le decisioni di trading che seguono sono fuori sincrono con il book dei dealer reale.',
    pain2Title: 'Gli screenshot statici perdono la migrazione',
    pain2Body:
      "I wall, il flip e il magnete gamma migrano tutti durante la giornata. Un call wall che rincorre il prezzo è una lettura molto diversa rispetto a uno che tiene — e uno screenshot non può mostrarti quale dei due stai guardando.",
    pain3Title: 'Il GEX per strike perde la coerenza di segno',
    pain3Body:
      'La scorciatoia retail di sommare gamma × OI per strike può produrre un numero headline positivo mentre la curva sottostante dice che lo spot è sotto il flip. Il numero headline e la linea di regime non possono contraddirsi — ma in alcuni strumenti lo fanno.',
    pain4Title: 'Il gamma aggregato perde il bucket 0DTE',
    pain4Body:
      "Quando la maggior parte del gamma di oggi si trova in opzioni a scadenza giornaliera, una media su tutte le scadenze è la lettura sbagliata per il tape intraday. Il bucket 0DTE è dove avviene realmente l'hedging.",
    solutionPill: 'Come è costruito ZeroGEX',
    solutionTitle: 'In tempo reale, metodologia prima di tutto, consapevole delle 0DTE.',
    solutionSubtitle:
      'Costruito specificamente per le letture strutturali che contano durante la giornata — e strutturalmente onesto su cosa i dati possono e non possono dire.',
    feat1Title: 'Gamma dei dealer in tempo reale',
    feat1Body:
      'Profilo gamma dei dealer live spot-shift, ricalcolato continuamente. Il Net GEX headline e il gamma flip leggono dalla stessa curva — non possono contraddirsi.',
    feat2Title: 'Gamma flip irrobustito',
    feat2Body:
      'Gate interni, strutturali e di distanza attuabile contro artefatti ai margini della griglia e attraversamenti del rumore di fondo. Riporta NULL su catene degradate invece di congelarsi silenziosamente su un valore obsoleto.',
    feat3Title: 'Bucketing per DTE',
    feat3Body:
      'Heatmap GEX strike-per-DTE così la concentrazione 0DTE che domina il tape intraday è visibile direttamente, non sepolta dentro una media su tutte le scadenze.',
    feat4Title: 'Livello di segnali composti',
    feat4Body:
      'Squeeze Setup, Positioning Trap, Trap Detection, EOD Pressure — ognuno con metodologia pubblicata nella sezione Education, non alert black-box.',
    feat5Title: 'Metodologia che puoi leggere',
    feat5Body:
      'Ogni segnale e lettura strutturale ha un articolo che spiega come è costruito e quando fallisce. Nessun numero magico, nessun moltiplicatore nascosto.',
    feat6Title: 'Lettura gratuita sullo stack strutturale',
    feat6Body:
      'Net GEX, gamma flip, call wall, put wall, max pain e il profilo gamma dei dealer su SPX, SPY e QQQ — aperto a chiunque, nessuna registrazione richiesta, aggiornato ogni 15 minuti.',
    proofPill: 'Livelli Gamma Gratuiti',
    proofTitle: 'Guarda il book dei dealer di oggi senza pagarlo.',
    proofSubtitle:
      'La pagina dei livelli gamma gratuiti mostra le letture strutturali per SPX, SPY e QQQ — Net GEX, gamma flip con distanza dallo spot, call e put wall, max pain e il profilo gamma dei dealer. Aggiornato ogni 15 minuti. Accesso anonimo, nessuna registrazione, nessuna carta.',
    tiersPill: 'Passa al livello superiore quando sei pronto',
    tiersTitle: 'Prezzi pensati per il modo in cui lavorano davvero i trader 0DTE.',
    tiersSubtitle:
      "Livelli gamma gratuiti ritardati di 15 minuti per le letture strutturali. I piani a pagamento aggiungono aggiornamenti in tempo reale, la dashboard completa, il livello di segnali, gli Advanced Signals e l'accesso diretto alle API. Ogni piano inizia con una prova gratuita di {days} giorni — annulla in qualsiasi momento.",
    mostPopular: 'Più popolare',
    includesTrial: 'Include una prova gratuita di {days} giorni.',
    basicFeat1: 'Metriche in tempo reale e strumenti strategici completi',
    basicFeat2: 'Accesso ai Basic Signals',
    basicFeat3: 'Campi di contesto per segnale e timeline intraday',
    basicFeat4: "Pensato per un'esecuzione quotidiana disciplinata",
    proFeat1: 'Tutto quello incluso in Basic',
    proFeat2: 'Accesso agli Advanced Signals (EOD Pressure, Trap Detection, Squeeze Setup e altro)',
    proFeat3: 'Accesso diretto alle API di ZeroGEX',
    proFeat4: 'Scoring in tempo reale + grafici storici dei punteggi',
    annualBillingPre: 'Disponibile anche la fatturazione annuale — vedi',
    pricingPageLink: 'la pagina dei prezzi',
    annualBillingPost: 'per i prezzi promozionali attuali e il risparmio annuale.',
    eduPill: 'Leggi la metodologia',
    eduTitle: 'Ogni lettura ha un articolo dedicato.',
    eduSubtitle: 'Le letture strutturali, il livello di segnali e la metodologia — tutto documentato. Scegli un punto di partenza.',
    edu1Title: 'Gamma Exposure (GEX) spiegato',
    edu1Body: "La guida completa — l'articolo pilastro.",
    edu2Title: 'Come leggere un Gamma Flip',
    edu2Body: 'Flusso di lavoro pratico intraday.',
    edu3Title: 'Gamma Wall spiegati',
    edu3Body: 'Call wall, put wall e come reagisce il prezzo.',
    edu4Title: 'Posizionamento dei Dealer 0DTE',
    edu4Body: 'Perché le scadenze giornaliere dominano la lettura.',
    edu5Title: 'Max Pain — Funziona davvero?',
    edu5Body: 'Una lettura onesta basata sulle evidenze.',
    edu6Title: 'Vanna e Charm spiegati',
    edu6Body: 'Greche di secondo ordine e hedging dei dealer.',
    readMore: 'Leggi',
    finalTitlePre: 'Guarda il book dei dealer.',
    finalTitleHighlight: 'Decidi tu.',
    finalSubtitle:
      "La lettura gratuita è lo stesso calcolo che ricevono gli utenti a pagamento — solo 15 minuti in ritardo. Provala sul tape di oggi prima di decidere se fare l'upgrade.",
    seePricing: 'Vedi i prezzi',
    disclaimer:
      'Solo contenuto educativo — non è consulenza finanziaria. ZeroGEX mostra letture strutturali sul posizionamento dei dealer; le decisioni di trading restano tue.',
  },
  de: {
    toggleTheme: 'Theme wechseln',
    navPricing: 'Preise',
    navFreeGammaLevels: 'Kostenlose Gamma-Level',
    heroPill: 'Echtzeit-GEX für 0DTE-Trader',
    heroTitlePre: 'Lies das Dealer-Book vor dem Move,',
    heroTitleHighlight: 'nicht danach.',
    heroSubtitle1:
      'ZeroGEX ist Echtzeit-Gamma-Exposure, gebaut für die Art, wie SPX und 0DTE heute tatsächlich gehandelt werden — Live-Gamma-Flip, Call- und Put-Walls, Dealer-Positionierung und zusammengesetzte Signale, die du lesen kannst.',
    heroSubtitle2:
      'Keine Black-Box-Scores. Sieh dir die kostenlosen, 15 Minuten verzögerten Gamma-Level an — oder starte eine Testphase, um das Live-Dealer-Book zu lesen.',
    ctaOpenFreeGammaLevels: 'Kostenlose Gamma-Level öffnen',
    ctaStartTrial: '{days}-tägige kostenlose Testphase starten',
    noCardPreview: 'Keine Karte für die kostenlose Vorschau nötig',
    cancelAnytime: 'Jederzeit kündbar, keine E-Mail erforderlich',
    problemPill: 'Warum 0DTE verzögertes GEX zum Scheitern bringt',
    problemTitle: 'Die Kette bewegt sich unter dir zwischen Morgenkaffee und Mittagessen.',
    problemSubtitle:
      'Verfalltermine am selben Tag dominieren jetzt den SPX-Flow. Das verändert, was Dealer-Positionierung bedeutet, wie schnell sich das Regime umkehren kann und was eine veraltete Ablesung kostet.',
    pain1Title: 'Verzögerte Feeds verpassen den Flip',
    pain1Body:
      'Eine 15 Minuten verzögerte GEX-Ablesung ist strukturell falsch, wenn der Gamma-Flip sich intraday verschiebt. Das Regime kann sich während des Verzögerungsfensters ändern, und die daraus folgenden Handelsentscheidungen liegen dann nicht mehr im Einklang mit dem tatsächlichen Dealer-Book.',
    pain2Title: 'Statische Screenshots verpassen die Migration',
    pain2Body:
      'Walls, der Flip und der Gamma-Magnet wandern alle intraday. Ein Call-Wall, der dem Preis hinterherläuft, ist eine ganz andere Ablesung als einer, der hält — und ein Screenshot kann dir nicht zeigen, welchen der beiden du gerade siehst.',
    pain3Title: 'Per-Strike-GEX verpasst die Vorzeichenkonsistenz',
    pain3Body:
      'Die Retail-Abkürzung, Gamma × OI pro Strike zu summieren, kann eine positive Headline-Zahl erzeugen, während die zugrunde liegende Kurve sagt, dass der Spot unter dem Flip liegt. Headline-Zahl und Regimelinie dürfen sich nicht widersprechen — bei manchen Tools tun sie es aber.',
    pain4Title: 'Aggregiertes Gamma verpasst den 0DTE-Bucket',
    pain4Body:
      'Wenn der Großteil des heutigen Gammas in Optionen mit Verfall am selben Tag liegt, ist ein Durchschnitt über alle Laufzeiten die falsche Ablesung für das Intraday-Tape. Der 0DTE-Bucket ist der Ort, an dem das Hedging tatsächlich stattfindet.',
    solutionPill: 'Wie ZeroGEX aufgebaut ist',
    solutionTitle: 'Echtzeit, methodikorientiert, 0DTE-bewusst.',
    solutionSubtitle:
      'Speziell für die strukturellen Ablesungen gebaut, die intraday zählen — und strukturell ehrlich darüber, was die Daten sagen können und was nicht.',
    feat1Title: 'Echtzeit-Dealer-Gamma',
    feat1Body:
      'Live-Spot-Shift-Dealer-Gamma-Profil, kontinuierlich neu berechnet. Das Headline-Net-GEX und der Gamma-Flip lesen von derselben Kurve — sie können sich nicht widersprechen.',
    feat2Title: 'Gehärteter Gamma-Flip',
    feat2Body:
      'Interior-, strukturelle und aktionsdistanz-basierte Gates gegen Grid-Rand-Artefakte und Rauschgrenzüberschreitungen. Meldet NULL bei degradierten Chains, statt stillschweigend auf einem veralteten Wert einzufrieren.',
    feat3Title: 'Per-DTE-Bucketing',
    feat3Body:
      'Strike-nach-DTE-GEX-Heatmap, damit die 0DTE-Konzentration, die das Intraday-Tape dominiert, direkt sichtbar ist statt in einem Durchschnitt über alle Laufzeiten vergraben zu sein.',
    feat4Title: 'Zusammengesetzte Signal-Ebene',
    feat4Body:
      'Squeeze Setup, Positioning Trap, Trap Detection, EOD Pressure — jedes mit veröffentlichter Methodik im Education-Bereich, keine Black-Box-Alerts.',
    feat5Title: 'Methodik, die du lesen kannst',
    feat5Body:
      'Jedes Signal und jede strukturelle Ablesung hat einen Beitrag, der erklärt, wie es gebaut ist und wann es versagt. Keine Zauberzahlen, keine versteckten Multiplikatoren.',
    feat6Title: 'Kostenlose Ablesung des strukturellen Stacks',
    feat6Body:
      'Net GEX, Gamma-Flip, Call-Wall, Put-Wall, Max Pain und das Dealer-Gamma-Profil für SPX, SPY und QQQ — für jeden offen, keine Anmeldung erforderlich, alle 15 Minuten aktualisiert.',
    proofPill: 'Kostenlose Gamma-Level',
    proofTitle: 'Sieh dir das heutige Dealer-Book an, ohne dafür zu bezahlen.',
    proofSubtitle:
      'Die Seite mit den kostenlosen Gamma-Leveln zeigt die strukturellen Ablesungen für SPX, SPY und QQQ — Net GEX, Gamma-Flip mit Abstand zum Spot, Call- und Put-Walls, Max Pain und das Dealer-Gamma-Profil. Alle 15 Minuten aktualisiert. Anonymer Zugriff, keine Anmeldung, keine Karte.',
    tiersPill: 'Upgrade, wenn du bereit bist',
    tiersTitle: 'Preise, gebaut für die Art, wie 0DTE-Trader tatsächlich arbeiten.',
    tiersSubtitle:
      'Kostenlose, 15 Minuten verzögerte Gamma-Level für die strukturellen Ablesungen. Bezahlpläne fügen Echtzeit-Updates, das vollständige Dashboard, die Signal-Ebene, die Advanced Signals und direkten API-Zugang hinzu. Jeder Plan startet mit einer {days}-tägigen kostenlosen Testphase — jederzeit kündbar.',
    mostPopular: 'Am beliebtesten',
    includesTrial: 'Beinhaltet eine {days}-tägige kostenlose Testphase.',
    basicFeat1: 'Echtzeit-Metriken und vollständige Strategie-Tools',
    basicFeat2: 'Zugang zu Basic Signals',
    basicFeat3: 'Pro-Signal-Kontextfelder und Intraday-Zeitleisten',
    basicFeat4: 'Konzipiert für disziplinierte tägliche Ausführung',
    proFeat1: 'Alles aus Basic',
    proFeat2: 'Zugang zu Advanced Signals (EOD Pressure, Trap Detection, Squeeze Setup und mehr)',
    proFeat3: 'Direkter Zugang zu den ZeroGEX-APIs',
    proFeat4: 'Echtzeit-Scoring + historische Score-Charts',
    annualBillingPre: 'Jährliche Abrechnung ist ebenfalls verfügbar — siehe',
    pricingPageLink: 'die Preisseite',
    annualBillingPost: 'für aktuelle Aktionspreise und Jahresersparnisse.',
    eduPill: 'Die Methodik lesen',
    eduTitle: 'Jede Ablesung hat einen Beitrag.',
    eduSubtitle: 'Die strukturellen Ablesungen, die Signal-Ebene und die Methodik — alles dokumentiert. Wähle einen Startpunkt.',
    edu1Title: 'Gamma Exposure (GEX) erklärt',
    edu1Body: 'Der vollständige Leitfaden — der Grundlagenbeitrag.',
    edu2Title: 'Wie man einen Gamma-Flip liest',
    edu2Body: 'Praktischer Intraday-Workflow.',
    edu3Title: 'Gamma-Walls erklärt',
    edu3Body: 'Call-Wall, Put-Wall und wie der Preis reagiert.',
    edu4Title: '0DTE-Dealer-Positionierung',
    edu4Body: 'Warum Verfalltermine am selben Tag die Ablesung dominieren.',
    edu5Title: 'Max Pain — funktioniert es wirklich?',
    edu5Body: 'Eine evidenzbasierte, ehrliche Ablesung.',
    edu6Title: 'Vanna und Charm erklärt',
    edu6Body: 'Greeks zweiter Ordnung und Dealer-Hedging.',
    readMore: 'Lesen',
    finalTitlePre: 'Sieh dir das Dealer-Book an.',
    finalTitleHighlight: 'Entscheide selbst.',
    finalSubtitle:
      'Die kostenlose Ablesung ist dieselbe Berechnung, die zahlende Nutzer erhalten — nur 15 Minuten verzögert. Probier es am heutigen Tape aus, bevor du entscheidest, ob du upgraden willst.',
    seePricing: 'Preise ansehen',
    disclaimer:
      'Nur Bildungsinhalte — keine Finanzberatung. ZeroGEX zeigt strukturelle Ablesungen zur Dealer-Positionierung; Handelsentscheidungen bleiben deine eigenen.',
  },
  es: {
    toggleTheme: 'Cambiar tema',
    navPricing: 'Precios',
    navFreeGammaLevels: 'Niveles Gamma Gratuitos',
    heroPill: 'GEX en tiempo real para traders 0DTE',
    heroTitlePre: 'Lee el libro de los dealers antes del movimiento,',
    heroTitleHighlight: 'no después.',
    heroSubtitle1:
      'ZeroGEX es exposición gamma en tiempo real, construida para la forma en que SPX y las 0DTE realmente se negocian hoy — gamma flip en vivo, call y put walls, posicionamiento de dealers y señales compuestas que puedes leer.',
    heroSubtitle2:
      'Sin puntuaciones de caja negra. Mira los niveles gamma gratuitos, con 15 minutos de retraso — o inicia una prueba para leer el libro de dealers en vivo.',
    ctaOpenFreeGammaLevels: 'Abrir niveles gamma gratuitos',
    ctaStartTrial: 'Iniciar prueba gratuita de {days} días',
    noCardPreview: 'Sin tarjeta para la vista previa gratuita',
    cancelAnytime: 'Cancela en cualquier momento, sin correo requerido',
    problemPill: 'Por qué las 0DTE rompen el GEX retrasado',
    problemTitle: 'La cadena se mueve bajo tus pies entre el café de la mañana y el almuerzo.',
    problemSubtitle:
      'Los vencimientos del mismo día ahora dominan el flujo de SPX. Eso cambia lo que significa el posicionamiento de dealers, qué tan rápido puede voltearse el régimen y cuánto cuesta una lectura obsoleta.',
    pain1Title: 'Los feeds retrasados se pierden el flip',
    pain1Body:
      'Una lectura de GEX retrasada 15 minutos es estructuralmente incorrecta cuando el gamma flip está migrando intradía. El régimen puede cambiar durante la ventana de retraso, y las decisiones de trading que siguen quedan desincronizadas con el libro real de dealers.',
    pain2Title: 'Las capturas estáticas se pierden la migración',
    pain2Body:
      'Los walls, el flip y el imán de gamma migran todos intradía. Un call wall que persigue al precio es una lectura muy distinta a uno que se mantiene — y una captura de pantalla no puede mostrarte cuál de los dos estás viendo.',
    pain3Title: 'El GEX por strike pierde la consistencia de signo',
    pain3Body:
      'El atajo retail de sumar gamma × OI por strike puede producir un número principal positivo mientras la curva subyacente indica que el spot está por debajo del flip. El número principal y la línea de régimen no pueden contradecirse — pero en algunas herramientas lo hacen.',
    pain4Title: 'El gamma agregado se pierde el bucket 0DTE',
    pain4Body:
      'Cuando la mayor parte del gamma de hoy está en opciones que vencen el mismo día, un promedio de todos los vencimientos es la lectura equivocada para el tape intradía. El bucket 0DTE es donde realmente ocurre el hedging.',
    solutionPill: 'Cómo está construido ZeroGEX',
    solutionTitle: 'En tiempo real, centrado en la metodología, consciente de las 0DTE.',
    solutionSubtitle:
      'Construido específicamente para las lecturas estructurales que importan intradía — y estructuralmente honesto sobre lo que los datos pueden y no pueden decir.',
    feat1Title: 'Gamma de dealers en tiempo real',
    feat1Body:
      'Perfil de gamma de dealers en vivo con spot-shift, recalculado continuamente. El Net GEX principal y el gamma flip se leen de la misma curva — no pueden contradecirse.',
    feat2Title: 'Gamma flip reforzado',
    feat2Body:
      'Filtros interiores, estructurales y de distancia accionable contra artefactos de borde de cuadrícula y cruces de ruido de fondo. Reporta NULL en cadenas degradadas en lugar de congelarse silenciosamente en un valor obsoleto.',
    feat3Title: 'Agrupación por DTE',
    feat3Body:
      'Mapa de calor de GEX por strike y DTE para que la concentración 0DTE que domina el tape intradía sea visible directamente, sin quedar enterrada dentro de un promedio de todos los vencimientos.',
    feat4Title: 'Capa de señales compuestas',
    feat4Body:
      'Squeeze Setup, Positioning Trap, Trap Detection, EOD Pressure — cada una con metodología publicada en la sección de Educación, sin alertas de caja negra.',
    feat5Title: 'Metodología que puedes leer',
    feat5Body:
      'Cada señal y lectura estructural tiene un artículo que explica cómo está construida y cuándo falla. Sin números mágicos, sin multiplicadores ocultos.',
    feat6Title: 'Lectura gratuita del stack estructural',
    feat6Body:
      'Net GEX, gamma flip, call wall, put wall, max pain y el perfil de gamma de dealers en SPX, SPY y QQQ — abierto para cualquiera, sin registro, actualizado cada 15 minutos.',
    proofPill: 'Niveles Gamma Gratuitos',
    proofTitle: 'Mira el libro de dealers de hoy sin pagar por él.',
    proofSubtitle:
      'La página de niveles gamma gratuitos muestra las lecturas estructurales para SPX, SPY y QQQ — Net GEX, gamma flip con distancia al spot, call y put walls, max pain y el perfil de gamma de dealers. Actualizado cada 15 minutos. Acceso anónimo, sin registro, sin tarjeta.',
    tiersPill: 'Mejora tu plan cuando estés listo',
    tiersTitle: 'Precios pensados para cómo trabajan realmente los traders 0DTE.',
    tiersSubtitle:
      'Niveles gamma gratuitos con 15 minutos de retraso para las lecturas estructurales. Los planes de pago añaden actualizaciones en tiempo real, el panel completo, la capa de señales, los Advanced Signals y acceso directo a la API. Cada plan comienza con una prueba gratuita de {days} días — cancela en cualquier momento.',
    mostPopular: 'Más popular',
    includesTrial: 'Incluye una prueba gratuita de {days} días.',
    basicFeat1: 'Métricas en tiempo real y herramientas de estrategia completas',
    basicFeat2: 'Acceso a Basic Signals',
    basicFeat3: 'Campos de contexto por señal y líneas de tiempo intradía',
    basicFeat4: 'Diseñado para una ejecución diaria disciplinada',
    proFeat1: 'Todo lo incluido en Basic',
    proFeat2: 'Acceso a Advanced Signals (EOD Pressure, Trap Detection, Squeeze Setup y más)',
    proFeat3: 'Acceso directo a las APIs de ZeroGEX',
    proFeat4: 'Puntuación en tiempo real + gráficos históricos de puntuación',
    annualBillingPre: 'La facturación anual también está disponible — consulta',
    pricingPageLink: 'la página de precios',
    annualBillingPost: 'para conocer los precios promocionales actuales y el ahorro anual.',
    eduPill: 'Lee la metodología',
    eduTitle: 'Cada lectura tiene un artículo.',
    eduSubtitle: 'Las lecturas estructurales, la capa de señales y la metodología — todo documentado. Elige un punto de partida.',
    edu1Title: 'Gamma Exposure (GEX) explicado',
    edu1Body: 'La guía completa — el artículo principal.',
    edu2Title: 'Cómo leer un Gamma Flip',
    edu2Body: 'Flujo de trabajo práctico intradía.',
    edu3Title: 'Gamma Walls explicados',
    edu3Body: 'Call wall, put wall y cómo reacciona el precio.',
    edu4Title: 'Posicionamiento de Dealers en 0DTE',
    edu4Body: 'Por qué los vencimientos del mismo día dominan la lectura.',
    edu5Title: 'Max Pain — ¿Funciona realmente?',
    edu5Body: 'Una lectura honesta basada en evidencia.',
    edu6Title: 'Vanna y Charm explicados',
    edu6Body: 'Griegas de segundo orden y hedging de dealers.',
    readMore: 'Leer',
    finalTitlePre: 'Mira el libro de dealers.',
    finalTitleHighlight: 'Decide tú mismo.',
    finalSubtitle:
      'La lectura gratuita es el mismo cálculo que reciben los usuarios de pago — solo con 15 minutos de retraso. Pruébala en el tape de hoy antes de decidir si mejorar tu plan.',
    seePricing: 'Ver precios',
    disclaimer:
      'Solo contenido educativo — no es asesoría financiera. ZeroGEX muestra lecturas estructurales sobre el posicionamiento de dealers; las decisiones de trading siguen siendo tuyas.',
  },
  fr: {
    toggleTheme: 'Changer de thème',
    navPricing: 'Tarifs',
    navFreeGammaLevels: 'Niveaux Gamma Gratuits',
    heroPill: 'GEX en temps réel pour les traders 0DTE',
    heroTitlePre: 'Lisez le carnet des dealers avant le mouvement,',
    heroTitleHighlight: 'pas après.',
    heroSubtitle1:
      "ZeroGEX est une exposition gamma en temps réel conçue pour la manière dont SPX et les 0DTE se négocient réellement aujourd'hui — gamma flip en direct, call et put walls, positionnement des dealers, et signaux composites que vous pouvez lire.",
    heroSubtitle2:
      "Pas de scores boîte noire. Consultez les niveaux gamma gratuits, retardés de 15 minutes — ou lancez un essai pour lire le carnet des dealers en direct.",
    ctaOpenFreeGammaLevels: 'Ouvrir les niveaux gamma gratuits',
    ctaStartTrial: "Démarrer l'essai gratuit de {days} jours",
    noCardPreview: "Aucune carte requise pour l'aperçu gratuit",
    cancelAnytime: 'Annulez à tout moment, aucun e-mail requis',
    problemPill: 'Pourquoi les 0DTE cassent le GEX retardé',
    problemTitle: 'La chaîne bouge sous vos pieds entre le café du matin et le déjeuner.',
    problemSubtitle:
      'Les échéances du jour même dominent désormais le flux SPX. Cela change ce que signifie le positionnement des dealers, la vitesse à laquelle le régime peut basculer, et ce que coûte une lecture obsolète.',
    pain1Title: 'Les flux retardés manquent le flip',
    pain1Body:
      'Une lecture GEX retardée de 15 minutes est structurellement fausse lorsque le gamma flip migre en intraday. Le régime peut changer pendant la fenêtre de retard, et les décisions de trading qui suivent sont désynchronisées du carnet réel des dealers.',
    pain2Title: 'Les captures statiques manquent la migration',
    pain2Body:
      "Les walls, le flip et l'aimant gamma migrent tous en intraday. Un call wall qui poursuit le prix est une lecture très différente de celui qui tient bon — et une capture d'écran ne peut pas vous montrer lequel des deux vous regardez.",
    pain3Title: 'Le GEX par strike manque la cohérence de signe',
    pain3Body:
      "Le raccourci retail consistant à sommer gamma × OI par strike peut produire un chiffre principal positif alors que la courbe sous-jacente indique que le spot est sous le flip. Le chiffre principal et la ligne de régime ne peuvent pas se contredire — mais dans certains outils, c'est le cas.",
    pain4Title: 'Le gamma agrégé manque le bucket 0DTE',
    pain4Body:
      "Lorsque la majeure partie du gamma du jour se trouve dans des options expirant le jour même, une moyenne toutes échéances confondues est la mauvaise lecture pour le tape intraday. Le bucket 0DTE est là où le hedging se produit réellement.",
    solutionPill: 'Comment ZeroGEX est construit',
    solutionTitle: "Temps réel, méthodologie d'abord, conscient des 0DTE.",
    solutionSubtitle:
      "Conçu spécifiquement pour les lectures structurelles qui comptent en intraday — et structurellement honnête sur ce que les données peuvent et ne peuvent pas dire.",
    feat1Title: 'Gamma des dealers en temps réel',
    feat1Body:
      'Profil de gamma des dealers en direct avec spot-shift, recalculé en continu. Le Net GEX principal et le gamma flip se lisent sur la même courbe — ils ne peuvent pas se contredire.',
    feat2Title: 'Gamma flip renforcé',
    feat2Body:
      'Filtres internes, structurels et de distance actionnable contre les artefacts de bord de grille et les franchissements du bruit de fond. Renvoie NULL sur les chaînes dégradées plutôt que de se figer silencieusement sur une valeur obsolète.',
    feat3Title: 'Regroupement par DTE',
    feat3Body:
      'Carte thermique du GEX par strike et par DTE afin que la concentration 0DTE qui domine le tape intraday soit visible directement, sans être noyée dans une moyenne toutes échéances confondues.',
    feat4Title: 'Couche de signaux composites',
    feat4Body:
      'Squeeze Setup, Positioning Trap, Trap Detection, EOD Pressure — chacun avec une méthodologie publiée dans la section Éducation, pas des alertes boîte noire.',
    feat5Title: 'Une méthodologie que vous pouvez lire',
    feat5Body:
      'Chaque signal et chaque lecture structurelle dispose d\'un article expliquant comment il est construit et quand il échoue. Pas de nombres magiques, pas de multiplicateurs cachés.',
    feat6Title: 'Lecture gratuite de la pile structurelle',
    feat6Body:
      'Net GEX, gamma flip, call wall, put wall, max pain et le profil de gamma des dealers sur SPX, SPY et QQQ — ouvert à tous, sans inscription, actualisé toutes les 15 minutes.',
    proofPill: 'Niveaux Gamma Gratuits',
    proofTitle: "Consultez le carnet des dealers d'aujourd'hui sans payer.",
    proofSubtitle:
      'La page des niveaux gamma gratuits présente les lectures structurelles pour SPX, SPY et QQQ — Net GEX, gamma flip avec distance au spot, call et put walls, max pain et le profil de gamma des dealers. Actualisé toutes les 15 minutes. Accès anonyme, sans inscription, sans carte.',
    tiersPill: 'Passez au niveau supérieur quand vous êtes prêt',
    tiersTitle: 'Des tarifs conçus pour la façon dont les traders 0DTE travaillent réellement.',
    tiersSubtitle:
      "Niveaux gamma gratuits retardés de 15 minutes pour les lectures structurelles. Les forfaits payants ajoutent les mises à jour en temps réel, le tableau de bord complet, la couche de signaux, les Advanced Signals et un accès direct à l'API. Chaque forfait démarre avec un essai gratuit de {days} jours — annulable à tout moment.",
    mostPopular: 'Le plus populaire',
    includesTrial: 'Comprend un essai gratuit de {days} jours.',
    basicFeat1: 'Métriques en temps réel et outils de stratégie complets',
    basicFeat2: 'Accès aux Basic Signals',
    basicFeat3: 'Champs de contexte par signal et chronologies intraday',
    basicFeat4: 'Conçu pour une exécution quotidienne disciplinée',
    proFeat1: 'Tout ce qui est inclus dans Basic',
    proFeat2: 'Accès aux Advanced Signals (EOD Pressure, Trap Detection, Squeeze Setup et plus)',
    proFeat3: 'Accès direct aux API de ZeroGEX',
    proFeat4: 'Scoring en temps réel + graphiques historiques des scores',
    annualBillingPre: 'La facturation annuelle est également disponible — voir',
    pricingPageLink: 'la page des tarifs',
    annualBillingPost: 'pour les prix promotionnels actuels et les économies annuelles.',
    eduPill: 'Lire la méthodologie',
    eduTitle: 'Chaque lecture a son article.',
    eduSubtitle: 'Les lectures structurelles, la couche de signaux et la méthodologie — tout est documenté. Choisissez un point de départ.',
    edu1Title: 'Gamma Exposure (GEX) expliqué',
    edu1Body: "Le guide complet — l'article de référence.",
    edu2Title: 'Comment lire un Gamma Flip',
    edu2Body: 'Flux de travail pratique en intraday.',
    edu3Title: 'Les Gamma Walls expliqués',
    edu3Body: 'Call wall, put wall et la réaction du prix.',
    edu4Title: 'Positionnement des Dealers en 0DTE',
    edu4Body: 'Pourquoi les échéances du jour même dominent la lecture.',
    edu5Title: 'Max Pain — Est-ce que ça marche vraiment ?',
    edu5Body: 'Une lecture honnête fondée sur les données.',
    edu6Title: 'Vanna et Charm expliqués',
    edu6Body: 'Grecques de second ordre et hedging des dealers.',
    readMore: 'Lire',
    finalTitlePre: 'Consultez le carnet des dealers.',
    finalTitleHighlight: 'Décidez par vous-même.',
    finalSubtitle:
      "La lecture gratuite est le même calcul que celui des utilisateurs payants — juste retardé de 15 minutes. Testez-la sur le tape d'aujourd'hui avant de décider de passer au niveau supérieur.",
    seePricing: 'Voir les tarifs',
    disclaimer:
      'Contenu éducatif uniquement — pas un conseil financier. ZeroGEX présente des lectures structurelles sur le positionnement des dealers ; les décisions de trading restent les vôtres.',
  },
};
