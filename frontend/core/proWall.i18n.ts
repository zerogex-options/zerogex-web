// The locked Pro screen (core/proWall.ts) in the site's other languages
// (core/i18n/locales.ts). English is written in core/proWall.ts; each block
// here says the same thing, line for line, and tests/proWall.test.ts checks
// that every block covers every Pro page.
//
// Same voice as the rest of the site in each language: German says "du",
// Italian and Spanish "tu"/"tú", French "vous". The words for the plans, the
// trial and the guarantee are the pricing page's (app/pricing/Client.i18n.ts),
// and page names follow the menu: the ones it translates (Composite Score,
// Bot Trading, Pattern Insights, ...) are translated here too, and signal
// names it keeps in English stay English. Amounts stay "$59", as on the
// pricing page; dates arrive in the member's language (formatEtDateTime).
//
// Pure: type-only imports, so tests load it under bare node --test.

import type { Locale } from './i18n/locales.ts';
import type { ProWallText } from './proWall.ts';

// Italian elides the article before a day read with a vowel: "l'8 novembre",
// "dall'11 novembre", not "il 8" or "dal 11". Every date here starts with the
// day of the month.
function itOn(date: string): string {
  return /^(8|11)\b/.test(date) ? `l'${date}` : `il ${date}`;
}

function itFrom(date: string): string {
  return /^(8|11)\b/.test(date) ? `dall'${date}` : `dal ${date}`;
}

export const PRO_WALL_TRANSLATIONS: Record<Exclude<Locale, 'en'>, ProWallText> = {
  it: {
    labels: {
      heading: (page) => `${page ?? 'Questa pagina'} fa parte di Pro`,
      imageCaption: (page) => `${page ?? 'Pro'} in una sessione passata: una lettura di esempio, non quella di oggi.`,
      comparePlans: 'Confronta i piani',
      backToDashboard: 'Torna alla dashboard',
      seeAnnual: 'Vedi Pro annuale',
      featuresHeading: 'Tutto ciò che è incluso in Basic, più',
      howItWorks: (page) => (page ? `${page}: come funziona` : 'Come funziona'),
    },
    copy: {
      priceLine: ({ pro, more }) => `Pro costa ${pro} al mese, ${more} in più di Basic.`,
      guarantee: (days) => `, coperto dalla garanzia soddisfatti o rimborsati di ${days} giorni`,
      keepTrial: ({ trialEnd, pro, basic }) =>
        `La tua prova gratuita termina ${itOn(trialEnd)}. Passa a Pro ora e il resto della prova resta gratuito: il tuo primo pagamento sarà di ${pro} per Pro invece di ${basic} per Basic, e puoi comunque annullare in qualsiasi momento prima di allora.`,
      trialEarly: ({ pro, guarantee, opensAt }) =>
        `Se passi a Pro ora, la tua prova gratuita termina e Pro inizia oggi a ${pro}${guarantee}. Oppure aspetta: ${itFrom(opensAt)}, negli ultimi due giorni della prova, potrai passare a Pro e quei giorni resteranno gratuiti.`,
      trialOther: ({ guarantee }) =>
        `Se passi a Pro ora, la tua prova gratuita termina e Pro inizia oggi${guarantee}. Vedrai l'importo esatto prima di confermare.`,
      paid: "Passa a Pro dalla pagina dei prezzi. Stripe ti mostra l'importo esatto prima che cambi qualcosa.",
      pastDue:
        'Il tuo ultimo pagamento non è andato a buon fine. Aggiorna prima la carta nella pagina Account, poi potrai passare a Pro.',
      none: 'Confronta i piani e scegli quello che fa per te.',
      annual: ({ annual, perMonth, basic }) =>
        `Oppure paga per un anno: Pro annuale costa ${annual}, circa ${perMonth} al mese, meno dei ${basic} al mese di Basic.`,
      switchCta: 'Passa a Pro',
      updateCardCta: 'Aggiorna la carta',
    },
    features: [
      'Trade Bias e il Punteggio composito',
      'Tutti e otto i Segnali Avanzati, tra cui Squeeze Setup, Trap Detection ed EOD Pressure',
      'TradeWorkz: Trading con bot, Backtesting e Analisi dei pattern',
      'Accesso API: livelli, GEX, flussi, segnali e il loro storico, per il tuo codice',
      'Indicatori NinjaTrader e Sierra Chart che si aggiornano da soli',
    ],
    pitches: {
      '/trade-bias': {
        pitch:
          "Trade Bias riunisce il Punteggio composito e i segnali Basic e Avanzati in un'unica lettura del posizionamento dei dealer e della direzione in cui pende il flusso, con il regime, il bias e il relativo playbook su una sola schermata. Descrive il mercato; non lo prevede.",
        alt: 'La pagina Trade Bias: punteggio di bias, lettura live e schede di regime, bias e playbook',
      },
      '/signal-score': {
        pitch:
          "Il Punteggio composito è un punteggio di regime da 0 a 100 costruito da sei componenti della struttura delle opzioni: segno del net GEX, gamma anchor, put/call ratio, regime di volatilità, squilibrio dell'order flow smart-money e dealer delta pressure. Valori alti indicano un regime di trend in cui i movimenti possono correre; valori bassi indicano compressione. Ti dice il regime, non la direzione.",
        alt: "L'indicatore del Punteggio composito con le fasce di punteggio e il contributo di ogni componente",
      },
      '/advanced-signals': {
        pitch:
          'La Dashboard segnali avanzati è la griglia di trigger di tutti e otto i Segnali Avanzati: ogni scheda mostra il punteggio, il livello a cui il segnale scatta e se è scattato, con una matrice di confluenza e la timeline degli eventi di ogni segnale.',
      },
      '/eod-pressure': {
        pitch:
          'EOD Pressure chiede se la chiusura si sta fissando su un prezzo. Attivo negli ultimi 90 minuti della sessione, si basa su dealer charm allo spot, pin gravity, volatilità realizzata e flag di witching, e indica il prezzo verso cui la chiusura potrebbe essere attratta.',
        alt: 'La pagina EOD Pressure: punteggio, rampa temporale, target di pin, charm allo spot e regime di gamma',
      },
      '/gamma-vwap-confluence': {
        pitch:
          'Gamma/VWAP Confluence chiede se i livelli chiave si stanno accumulando su un unico prezzo: il gamma flip, il VWAP, il max pain, lo strike a max gamma e il call wall. In gamma positivo le sue letture sono fade; in gamma negativo, continuation.',
      },
      '/market-pressure': {
        pitch:
          'Il Market Pressure Index chiede se il mercato è carico per muoversi. Combina wall pinch, prossimità al flip, regime di gamma, vanna e charm, skew tra flusso premium e smart money, IV rank e compressione della volatilità realizzata in un punteggio di loading e una direzione.',
      },
      '/range-break-imminence': {
        pitch:
          'Range Break Imminence chiede se il range attuale sta per rompersi, da una lettura di compressione a 20 barre, skew, dealer delta e trap pressure. Da 65 in su è nella fascia Break Watch, dove la pagina consiglia di smettere di fare fade del range alla cieca.',
      },
      '/squeeze-setup': {
        pitch:
          'Squeeze Setup chiede se il mercato è compresso: un rilevatore di setup su più giorni costruito su flusso, momentum, prontezza del gamma, distanza dal gamma flip e regime del VIX.',
      },
      '/trap-detection': {
        pitch:
          'Trap Detection chiede se un breakout è appena fallito. Segnala come probabile fallimento la rottura di un wall, del VWAP, del gamma flip o dello strike a max gamma quando i dealer sono long gamma e il gamma si sta rafforzando.',
      },
      '/volatility-expansion': {
        pitch:
          'Volatility Expansion chiede se la volatilità sta per espandersi, a partire da net GEX, momentum normalizzato per la volatilità e volatilità realizzata.',
      },
      '/0dte-position-imbalance': {
        pitch:
          'La 0DTE Position Imbalance ti dice da che parte pendono oggi i trader 0DTE, in base a squilibrio del flusso call/put, rapporto call/put dello smart money, put/call ratio e moneyness, ponderati per le ore che mancano alla chiusura.',
      },
      '/trading-signals': {
        pitch:
          "Trading con bot fa girare come bot le strategie del catalogo ZeroGEX (fade sul call wall, rimbalzi sul put wall, rotture del gamma flip e altre). Segui un bot e ricevi i suoi ingressi e le sue uscite nell'app o via email.",
      },
      '/backtesting': {
        pitch:
          'Backtesting riesegue una strategia ZeroGEX, o una regola che costruisci tu, sui dati storici delle opzioni, prezzata come veri round trip su gambe di opzioni al netto di slippage e commissioni, con un tearsheet aggiustato per il rischio, un cono di esiti Monte Carlo e risultati per regime di gamma.',
      },
      '/backtesting/insights': {
        pitch:
          'Analisi dei pattern mostra la performance misurata di ogni strategia del catalogo ZeroGEX, le stesse strategie usate da Trading con bot e Backtesting.',
      },
    },
    genericPitch:
      "Pro aggiunge Trade Bias e il Punteggio composito, tutti e otto i Segnali Avanzati, i bot di TradeWorkz, backtesting e analisi dei pattern, l'accesso API e indicatori NinjaTrader e Sierra Chart che si aggiornano da soli.",
  },

  de: {
    labels: {
      heading: (page) => `${page ?? 'Diese Seite'} ist Teil von Pro`,
      imageCaption: (page) => `${page ?? 'Pro'} an einem früheren Handelstag: ein Beispiel, nicht der heutige Stand.`,
      comparePlans: 'Pläne vergleichen',
      backToDashboard: 'Zurück zum Dashboard',
      seeAnnual: 'Pro jährlich ansehen',
      featuresHeading: 'Alles aus Basic, dazu',
      howItWorks: (page) => (page ? `${page} erklärt` : 'So funktioniert es'),
    },
    copy: {
      priceLine: ({ pro, more }) => `Pro kostet ${pro} im Monat, ${more} mehr als Basic.`,
      guarantee: (days) => `, abgesichert durch die ${days}-Tage-Geld-zurück-Garantie`,
      keepTrial: ({ trialEnd, pro, basic }) =>
        `Deine kostenlose Testphase endet am ${trialEnd}. Wechsle jetzt und der Rest deiner Testphase bleibt kostenlos: Deine erste Zahlung beträgt dann ${pro} für Pro statt ${basic} für Basic, und du kannst bis dahin weiterhin jederzeit kündigen.`,
      trialEarly: ({ pro, guarantee, opensAt }) =>
        `Wenn du jetzt wechselst, endet deine kostenlose Testphase und Pro beginnt heute zum Preis von ${pro}${guarantee}. Oder warte: Ab dem ${opensAt}, in den letzten zwei Tagen deiner Testphase, kannst du wechseln und diese Tage kostenlos behalten.`,
      trialOther: ({ guarantee }) =>
        `Wenn du jetzt wechselst, endet deine kostenlose Testphase und Pro beginnt heute${guarantee}. Den genauen Betrag siehst du, bevor du bestätigst.`,
      paid: 'Wechsle über die Preisseite. Stripe zeigt dir den genauen Betrag, bevor sich etwas ändert.',
      pastDue:
        'Deine letzte Zahlung ist nicht durchgegangen. Aktualisiere zuerst deine Karte auf der Kontoseite, dann kannst du wechseln.',
      none: 'Vergleiche die Pläne und wähle den, der zu dir passt.',
      annual: ({ annual, perMonth, basic }) =>
        `Oder zahle für ein Jahr: Pro jährlich kostet ${annual}, etwa ${perMonth} im Monat, und damit weniger als die ${basic}, die Basic monatlich kostet.`,
      switchCta: 'Zu Pro wechseln',
      updateCardCta: 'Karte aktualisieren',
    },
    features: [
      'Trade Bias und der Gesamtscore',
      'Alle acht erweiterten Signale, darunter Squeeze Setup, Trap Detection und EOD Pressure',
      'TradeWorkz: Bot-Trading, Backtesting und Muster-Einblicke',
      'API-Zugang: Level, GEX, Flow, Signale und deren Historie, für deinen eigenen Code',
      'Automatisch aktualisierte Indikatoren für NinjaTrader und Sierra Chart',
    ],
    pitches: {
      '/trade-bias': {
        pitch:
          'Trade Bias fasst den Gesamtscore und die Basic- und erweiterten Signale zu einer Lesart der Dealer-Positionierung und der Richtung des Flows zusammen, mit Regime, Bias und dem passenden Playbook auf einem Bildschirm. Er beschreibt den Markt; er prognostiziert ihn nicht.',
        alt: 'Die Trade-Bias-Seite: Bias-Score, Live-Lesart sowie Karten zu Regime, Bias und Playbook',
      },
      '/signal-score': {
        pitch:
          'Der Gesamtscore ist ein Regime-Score von 0 bis 100 aus sechs Komponenten der Optionsstruktur: Net-GEX-Vorzeichen, Gamma Anchor, Put/Call Ratio, Volatilitätsregime, Smart-Money-Order-Flow-Ungleichgewicht und Dealer Delta Pressure. Hohe Werte bedeuten ein Trend-Regime, in dem Bewegungen laufen können; niedrige bedeuten Kompression. Er sagt dir das Regime, nicht die Richtung.',
        alt: 'Die Anzeige des Gesamtscores mit ihren Score-Bereichen und den Beiträgen der einzelnen Komponenten',
      },
      '/advanced-signals': {
        pitch:
          'Das Erweiterte Signal-Dashboard ist das Trigger-Raster für alle acht erweiterten Signale: Jede Karte zeigt den Score, die Schwelle, ab der das Signal auslöst, und ob es ausgelöst hat, dazu eine Confluence-Matrix und die Event-Timeline jedes Signals.',
      },
      '/eod-pressure': {
        pitch:
          'EOD Pressure fragt, ob der Schlusskurs gepinnt wird. Das Signal ist in den letzten 90 Minuten der Handelssitzung aktiv, basiert auf Dealer-Charm am Spot, Pin Gravity, realisierter Volatilität und Witching-Flags und nennt den Preis, zu dem der Schlusskurs gezogen werden könnte.',
        alt: 'Die EOD-Pressure-Seite: Score, Zeitrampe, Pin-Ziel, Charm am Spot und Gamma-Regime',
      },
      '/gamma-vwap-confluence': {
        pitch:
          'Gamma/VWAP Confluence fragt, ob sich wichtige Level bei einem Preis stapeln: Gamma Flip, VWAP, Max Pain, der Max-Gamma-Strike und die Call Wall. Bei positivem Gamma sind seine Lesarten Fade-Signale, bei negativem Gamma Continuation-Signale.',
      },
      '/market-pressure': {
        pitch:
          'Der Market Pressure Index fragt, ob der Markt für eine Bewegung geladen ist. Er kombiniert Wall Pinch, Flip-Nähe, das Gamma-Regime, Vanna und Charm, den Skew zwischen Premium- und Smart-Money-Flow, den IV-Rank und die Kompression der realisierten Volatilität zu einem Loading-Score und einer Richtung.',
      },
      '/range-break-imminence': {
        pitch:
          'Range Break Imminence fragt, ob die aktuelle Range kurz vor dem Bruch steht, auf Basis einer Kompressionslesart über 20 Bars, Skew, Dealer-Delta und Trap Pressure. Ab 65 liegt das Signal im Band Break Watch, in dem die Seite rät, die Range nicht mehr blind zu faden.',
      },
      '/squeeze-setup': {
        pitch:
          'Squeeze Setup fragt, ob der Markt zusammengepresst ist: ein mehrtägiger Setup-Detektor aus Flow, Momentum, Gamma-Bereitschaft, Abstand zum Gamma Flip und VIX-Regime.',
      },
      '/trap-detection': {
        pitch:
          'Trap Detection fragt, ob ein Breakout gerade gescheitert ist. Das Signal markiert einen Bruch durch eine Wall, den VWAP, den Gamma Flip oder den Max-Gamma-Strike als wahrscheinlich scheiternd, wenn die Dealer long Gamma sind und das Gamma zunimmt.',
      },
      '/volatility-expansion': {
        pitch:
          'Volatility Expansion fragt, ob die Volatilität kurz vor dem Ausbruch steht, auf Basis von Net GEX, volatilitätsnormalisiertem Momentum und realisierter Volatilität.',
      },
      '/0dte-position-imbalance': {
        pitch:
          'Die 0DTE Position Imbalance zeigt dir, in welche Richtung 0DTE-Trader heute tendieren, auf Basis von Call/Put-Flow-Ungleichgewicht, Smart-Money-Call/Put-Verhältnis, Put/Call Ratio und Moneyness, gewichtet nach den Stunden bis zum Handelsschluss.',
      },
      '/trading-signals': {
        pitch:
          'Bot-Trading lässt die Strategien aus dem ZeroGEX-Katalog (Call-Wall-Fades, Put-Wall-Bounces, Gamma-Flip-Brüche und mehr) als Bots laufen. Folge einem Bot und erhalte seine Ein- und Ausstiege in der App oder per E-Mail.',
      },
      '/backtesting': {
        pitch:
          'Backtesting spielt eine ZeroGEX-Strategie oder eine Regel, die du selbst baust, gegen historische Optionsdaten durch, bewertet als echte Options-Leg-Roundtrips abzüglich Slippage und Kommission, mit risikoadjustiertem Tearsheet, Monte-Carlo-Ergebniskegel und Ergebnissen nach Gamma-Regime.',
      },
      '/backtesting/insights': {
        pitch:
          'Die Seite Muster-Einblicke zeigt die gemessene Performance jeder Strategie im ZeroGEX-Katalog, also derselben Strategien, die Bot-Trading und Backtesting verwenden.',
      },
    },
    genericPitch:
      'Mit Pro kommen Trade Bias und der Gesamtscore, alle acht erweiterten Signale, TradeWorkz-Bots, Backtesting und Muster-Einblicke, API-Zugang sowie automatisch aktualisierte Indikatoren für NinjaTrader und Sierra Chart dazu.',
  },

  es: {
    labels: {
      heading: (page) => `${page ?? 'Esta página'} forma parte de Pro`,
      imageCaption: (page) => `${page ?? 'Pro'} en una sesión pasada: una lectura de ejemplo, no la de hoy.`,
      comparePlans: 'Comparar planes',
      backToDashboard: 'Volver al panel',
      seeAnnual: 'Ver Pro anual',
      featuresHeading: 'Todo lo incluido en Basic, más',
      howItWorks: (page) => (page ? `${page}: cómo funciona` : 'Cómo funciona'),
    },
    copy: {
      priceLine: ({ pro, more }) => `Pro cuesta ${pro} al mes, ${more} más que Basic.`,
      guarantee: (days) => `, cubierto por la garantía de devolución de ${days} días`,
      keepTrial: ({ trialEnd, pro, basic }) =>
        `Tu prueba gratuita termina el ${trialEnd}. Cambia ahora y el resto de la prueba sigue siendo gratis: tu primer pago pasa a ser de ${pro} por Pro en lugar de ${basic} por Basic, y aún puedes cancelar en cualquier momento antes de esa fecha.`,
      trialEarly: ({ pro, guarantee, opensAt }) =>
        `Si cambias ahora, tu prueba gratuita termina y Pro empieza hoy por ${pro}${guarantee}. O espera: a partir del ${opensAt}, en los dos últimos días de tu prueba, podrás cambiar y conservar gratis esos días.`,
      trialOther: ({ guarantee }) =>
        `Si cambias ahora, tu prueba gratuita termina y Pro empieza hoy${guarantee}. Verás el importe exacto antes de confirmar.`,
      paid: 'Cambia desde la página de precios. Stripe te muestra el importe exacto antes de que cambie nada.',
      pastDue:
        'Tu último pago no se pudo procesar. Primero actualiza tu tarjeta en la página de Cuenta y luego podrás cambiar.',
      none: 'Compara los planes y elige el que mejor te encaje.',
      annual: ({ annual, perMonth, basic }) =>
        `O paga por un año: Pro anual cuesta ${annual}, unos ${perMonth} al mes, menos que los ${basic} mensuales de Basic.`,
      switchCta: 'Cambiar a Pro',
      updateCardCta: 'Actualizar tarjeta',
    },
    features: [
      'Trade Bias y la Puntuación compuesta',
      'Las ocho Señales Avanzadas, entre ellas Squeeze Setup, Trap Detection y EOD Pressure',
      'TradeWorkz: Trading con bots, Backtesting y Análisis de patrones',
      'Acceso a la API: niveles, GEX, flujo, señales y su historial, para tu propio código',
      'Indicadores de NinjaTrader y Sierra Chart que se actualizan solos',
    ],
    pitches: {
      '/trade-bias': {
        pitch:
          'Trade Bias reúne la Puntuación compuesta y las señales Basic y Avanzadas en una única lectura del posicionamiento de los dealers y de hacia dónde se inclina el flujo, con el régimen, el sesgo y su playbook en una sola pantalla. Describe el mercado; no lo pronostica.',
        alt: 'La página Trade Bias: puntuación de sesgo, lectura en vivo y tarjetas de régimen, sesgo y playbook',
      },
      '/signal-score': {
        pitch:
          'La Puntuación compuesta es una puntuación de régimen de 0 a 100 construida a partir de seis componentes de la estructura de opciones: signo del net GEX, gamma anchor, put/call ratio, régimen de volatilidad, desequilibrio del order flow smart-money y dealer delta pressure. Las lecturas altas indican un régimen de tendencia en el que los movimientos pueden extenderse; las bajas, compresión. Te dice el régimen, no la dirección.',
        alt: 'El indicador de la Puntuación compuesta con sus rangos de puntuación y la contribución de cada componente',
      },
      '/advanced-signals': {
        pitch:
          'El Panel de señales avanzado es la cuadrícula de disparadores de las ocho Señales Avanzadas: cada tarjeta muestra la puntuación, el nivel en el que se dispara la señal y si ya se ha disparado, con una matriz de confluencia y la línea de tiempo de eventos de cada señal.',
      },
      '/eod-pressure': {
        pitch:
          'EOD Pressure pregunta si el cierre está quedando anclado a un precio. Activa en los últimos 90 minutos de la sesión, se basa en el dealer charm en el spot, la pin gravity, la volatilidad realizada y las flags de witching, e indica el precio hacia el que podría verse atraído el cierre.',
        alt: 'La página EOD Pressure: puntuación, rampa horaria, objetivo de pin, charm en el spot y régimen de gamma',
      },
      '/gamma-vwap-confluence': {
        pitch:
          'Gamma/VWAP Confluence pregunta si los niveles clave se están acumulando en un mismo precio: el gamma flip, el VWAP, el max pain, el strike de máximo gamma y la call wall. En gamma positivo sus lecturas son de fade; en gamma negativo, de continuation.',
      },
      '/market-pressure': {
        pitch:
          'El Market Pressure Index pregunta si el mercado está cargado para moverse. Combina el wall pinch, la proximidad al flip, el régimen de gamma, vanna y charm, el skew entre el flujo premium y el smart money, el IV rank y la compresión de la volatilidad realizada en una puntuación de loading y una dirección.',
      },
      '/range-break-imminence': {
        pitch:
          'Range Break Imminence pregunta si el rango actual está a punto de romperse, a partir de una lectura de compresión de 20 barras, el skew, el dealer delta y la trap pressure. A partir de 65 está en la banda Break Watch, donde la página indica dejar de hacer fade del rango a ciegas.',
      },
      '/squeeze-setup': {
        pitch:
          'Squeeze Setup pregunta si el mercado está comprimido: un detector de setups de varios días construido a partir del flujo, el momentum, la preparación del gamma, la distancia al gamma flip y el régimen del VIX.',
      },
      '/trap-detection': {
        pitch:
          'Trap Detection pregunta si un breakout acaba de fallar. Marca como probable fallo la ruptura de una wall, del VWAP, del gamma flip o del strike de máximo gamma cuando los dealers están long gamma y el gamma se está fortaleciendo.',
      },
      '/volatility-expansion': {
        pitch:
          'Volatility Expansion pregunta si la volatilidad está a punto de expandirse, a partir del net GEX, el momentum normalizado por volatilidad y la volatilidad realizada.',
      },
      '/0dte-position-imbalance': {
        pitch:
          'La 0DTE Position Imbalance te dice hacia dónde se inclinan hoy los traders 0DTE, a partir del desequilibrio del flujo call/put, el ratio call/put del smart money, el put/call ratio y la moneyness, ponderados por las horas que faltan para el cierre.',
      },
      '/trading-signals': {
        pitch:
          'Trading con bots ejecuta como bots las estrategias del catálogo de ZeroGEX (fades en la call wall, rebotes en la put wall, rupturas del gamma flip y más). Sigue uno y recibe sus entradas y salidas en la app o por email.',
      },
      '/backtesting': {
        pitch:
          'Backtesting reproduce una estrategia de ZeroGEX, o una regla que construyas tú, sobre datos históricos de opciones, valorada como round trips reales sobre patas de opciones, netos de slippage y comisión, con un tearsheet ajustado por riesgo, un cono de resultados Monte Carlo y resultados por régimen de gamma.',
      },
      '/backtesting/insights': {
        pitch:
          'Análisis de patrones muestra el rendimiento medido de cada estrategia del catálogo de ZeroGEX, las mismas estrategias que usan Trading con bots y Backtesting.',
      },
    },
    genericPitch:
      'Pro añade Trade Bias y la Puntuación compuesta, las ocho Señales Avanzadas, los bots de TradeWorkz, backtesting y análisis de patrones, acceso a la API e indicadores de NinjaTrader y Sierra Chart que se actualizan solos.',
  },

  fr: {
    labels: {
      heading: (page) => `${page ?? 'Cette page'} fait partie de Pro`,
      imageCaption: (page) =>
        `${page ?? 'Pro'} lors d'une séance passée : une lecture d'exemple, pas celle d'aujourd'hui.`,
      comparePlans: 'Comparer les offres',
      backToDashboard: 'Retour au tableau de bord',
      seeAnnual: 'Voir Pro annuel',
      featuresHeading: 'Tout ce qui est inclus dans Basic, plus',
      howItWorks: (page) => (page ? `${page} : comment ça marche` : 'Comment ça marche'),
    },
    copy: {
      priceLine: ({ pro, more }) => `Pro coûte ${pro} par mois, soit ${more} de plus que Basic.`,
      guarantee: (days) => `, couvert par la garantie satisfait ou remboursé de ${days} jours`,
      keepTrial: ({ trialEnd, pro, basic }) =>
        `Votre essai gratuit se termine le ${trialEnd}. Passez à Pro maintenant et la suite de votre essai reste gratuite : votre premier paiement sera de ${pro} pour Pro au lieu de ${basic} pour Basic, et vous pouvez toujours annuler à tout moment d'ici là.`,
      trialEarly: ({ pro, guarantee, opensAt }) =>
        `Passer à Pro maintenant met fin à votre essai gratuit et démarre Pro dès aujourd'hui à ${pro}${guarantee}. Ou attendez : à partir du ${opensAt}, pendant les deux derniers jours de votre essai, vous pourrez passer à Pro et garder ces jours gratuits.`,
      trialOther: ({ guarantee }) =>
        `Passer à Pro maintenant met fin à votre essai gratuit et démarre Pro dès aujourd'hui${guarantee}. Vous verrez le montant exact avant de confirmer.`,
      paid: 'Passez à Pro depuis la page des tarifs. Stripe vous indique le montant exact avant tout changement.',
      pastDue:
        "Votre dernier paiement n'est pas passé. Mettez d'abord à jour votre carte sur la page Compte, puis vous pourrez passer à Pro.",
      none: 'Comparez les offres pour choisir celle qui vous convient.',
      annual: ({ annual, perMonth, basic }) =>
        `Ou payez pour un an : Pro annuel coûte ${annual}, soit environ ${perMonth} par mois, moins que le prix mensuel de Basic (${basic}).`,
      switchCta: 'Passer à Pro',
      updateCardCta: 'Mettre à jour la carte',
    },
    features: [
      'Trade Bias et le Score composite',
      'Les huit Signaux Avancés, dont Squeeze Setup, Trap Detection et EOD Pressure',
      'TradeWorkz : Trading par bots, Backtesting et Analyse des motifs',
      'Accès API : niveaux, GEX, flux, signaux et leur historique, pour votre propre code',
      'Indicateurs NinjaTrader et Sierra Chart mis à jour automatiquement',
    ],
    pitches: {
      '/trade-bias': {
        pitch:
          'Trade Bias réunit le Score composite et les signaux Basic et Avancés en une seule lecture du positionnement des dealers et du sens dans lequel penche le flux, avec le régime, le biais et le playbook correspondant sur un même écran. Il décrit le marché ; il ne le prévoit pas.',
        alt: 'La page Trade Bias : score de biais, lecture en direct et cartes de régime, de biais et de playbook',
      },
      '/signal-score': {
        pitch:
          "Le Score composite est un score de régime de 0 à 100 construit à partir de six composantes de la structure d'options : signe du net GEX, gamma anchor, put/call ratio, régime de volatilité, déséquilibre du flux d'ordres smart-money et dealer delta pressure. Des valeurs élevées signalent un régime de tendance où les mouvements peuvent se prolonger ; des valeurs basses, une compression. Il vous indique le régime, pas la direction.",
        alt: 'La jauge du Score composite avec ses plages de score et la contribution de chaque composante',
      },
      '/advanced-signals': {
        pitch:
          "Le Tableau de signaux avancé est la grille de déclenchement des huit Signaux Avancés : chaque carte affiche le score, le seuil de déclenchement du signal et s'il s'est déclenché, avec une matrice de confluence et la chronologie des événements de chaque signal.",
      },
      '/eod-pressure': {
        pitch:
          'EOD Pressure cherche à savoir si la clôture est en train de se fixer sur un prix. Actif durant les 90 dernières minutes de la séance, il repose sur le dealer charm au spot, la pin gravity, la volatilité réalisée et les flags de witching, et indique le prix vers lequel la clôture pourrait être attirée.',
        alt: 'La page EOD Pressure : score, rampe horaire, cible de pin, charm au spot et régime de gamma',
      },
      '/gamma-vwap-confluence': {
        pitch:
          "Gamma/VWAP Confluence cherche à savoir si les niveaux clés s'empilent sur un même prix : le gamma flip, le VWAP, le max pain, le strike de gamma maximal et la call wall. En gamma positif, ses lectures sont des fades ; en gamma négatif, de la continuation.",
      },
      '/market-pressure': {
        pitch:
          "Le Market Pressure Index cherche à savoir si le marché est chargé pour bouger. Il combine le wall pinch, la proximité du flip, le régime de gamma, vanna et charm, le skew entre le flux premium et le smart money, l'IV rank et la compression de la volatilité réalisée en un score de loading et une direction.",
      },
      '/range-break-imminence': {
        pitch:
          "Range Break Imminence cherche à savoir si le range actuel est sur le point de casser, à partir d'une lecture de compression sur 20 barres, du skew, du dealer delta et de la trap pressure. À partir de 65, il est dans la bande Break Watch, où la page conseille d'arrêter de fader le range à l'aveugle.",
      },
      '/squeeze-setup': {
        pitch:
          'Squeeze Setup cherche à savoir si le marché est comprimé : un détecteur de setup sur plusieurs jours construit à partir du flux, du momentum, de la préparation du gamma, de la distance au gamma flip et du régime du VIX.',
      },
      '/trap-detection': {
        pitch:
          "Trap Detection cherche à savoir si un breakout vient d'échouer. Il signale qu'une cassure d'une wall, du VWAP, du gamma flip ou du strike de gamma maximal a de bonnes chances d'échouer lorsque les dealers sont long gamma et que le gamma se renforce.",
      },
      '/volatility-expansion': {
        pitch:
          "Volatility Expansion cherche à savoir si la volatilité est sur le point d'exploser, à partir du net GEX, du momentum normalisé par la volatilité et de la volatilité réalisée.",
      },
      '/0dte-position-imbalance': {
        pitch:
          "La 0DTE Position Imbalance vous indique de quel côté penchent les traders 0DTE aujourd'hui, à partir du déséquilibre du flux call/put, du ratio call/put du smart money, du put/call ratio et de la moneyness, pondérés par les heures restantes avant la clôture.",
      },
      '/trading-signals': {
        pitch:
          "Trading par bots fait tourner les stratégies du catalogue ZeroGEX (fades sur la call wall, rebonds sur la put wall, cassures du gamma flip et plus encore) sous forme de bots. Suivez-en un et recevez ses entrées et sorties dans l'app ou par e-mail.",
      },
      '/backtesting': {
        pitch:
          "Backtesting rejoue une stratégie ZeroGEX, ou une règle que vous construisez, sur des données d'options historiques, valorisée comme de véritables allers-retours sur jambes d'options, nets du slippage et de la commission, avec un tearsheet ajusté du risque, un cône de résultats Monte Carlo et des résultats par régime de gamma.",
      },
      '/backtesting/insights': {
        pitch:
          "La page Analyse des motifs présente la performance mesurée de chaque stratégie du catalogue ZeroGEX, les mêmes stratégies qu'utilisent Trading par bots et Backtesting.",
      },
    },
    genericPitch:
      "Pro ajoute Trade Bias et le Score composite, les huit Signaux Avancés, les bots TradeWorkz, le backtesting et l'analyse des motifs, l'accès API et des indicateurs NinjaTrader et Sierra Chart mis à jour automatiquement.",
  },
};
