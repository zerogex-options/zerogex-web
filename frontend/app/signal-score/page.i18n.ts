import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    title: 'Composite Score',
    titleTooltip:
      'Composite Score, also known as the Market State Index (MSI), is a single 0–100 number that reads the current option-structure regime — not market direction. ' +
      'It blends six independent components — net dealer gamma sign, gamma anchor, put/call ratio, volatility regime, smart-money order-flow imbalance, and dealer delta pressure — ' +
      'each weighted to a max-points cap that sums to 100. ' +
      '50 is neutral; readings ≥70 indicate a tradable trend / expansion regime, 40–70 a controlled trend, 20–40 chop / range, and <20 high-risk reversal (mean-reversion only, fragile tape). ' +
      'A high MSI does not mean "bullish" — it means trends can run. A low MSI does not mean "bearish" — it means trends are unlikely to work.',
    intradayTooltip:
      "The MSI's path through today's session, plotted as 0–100 with shaded regime bands at <20 (high-risk reversal), 20–40 (chop), 40–70 (controlled trend), and ≥70 (trend / expansion). " +
      "Hover any point for the timestamp, score, regime, and the top-3 components that drove the reading.",
    contribTooltip:
      'Single horizontal bar showing each component\'s signed point contribution around the 50-baseline. ' +
      'Right-pushers (green) argue for a tradable / trending regime; left-pushers (red) argue for chop / pinning / reversal. ' +
      'Total visual offset equals |composite − 50|. Hover any segment for its raw score, contribution, and weight share.',
    reconnecting: 'Reconnecting… last values shown may be stale.',
    retryNow: 'Retry now',
    loadingGauge: 'Loading gauge…',
    loadingRegime: 'Loading regime…',
    loadingRanges: 'Loading ranges…',
    loadingChart: 'Loading chart…',
    noDataTitle: 'No score data for {symbol} yet.',
    noDataBody: 'The signal engine has no rows for this underlying. Try another symbol or check back during market hours.',
    scoreRanges: 'Score ranges',
    symbolLabel: 'Symbol',
    scaleLabel: 'Scale',
    neutralLabel: 'Neutral',
    componentContributions: 'Component Contributions',
    loadingContributions: 'Loading contributions…',
    componentsHeading: 'Components',
    intradayTrend: 'Intraday Trend',
    deltaSinceOpen: 'Δ since open',
    deltaLast5Min: 'Δ last 5 min',
    connecting: 'Connecting…',
    disconnectedRetrying: 'Disconnected — retrying',
    stale: 'Stale',
    staleAgo: 'Stale • {sec}s ago',
    liveLabel: 'LIVE',
    liveUpdatedAgo: 'LIVE • updated {sec}s ago',
    sessionOpen: 'Market Open',
    sessionPreMarket: 'Pre-market',
    sessionAfterHours: 'After-hours',
    sessionClosed: 'Closed',
    sessionHalted: 'Halted',
    sessionMarket: 'Market',
  },
  it: {
    title: 'Composite Score',
    titleTooltip:
      'Il Composite Score, noto anche come Market State Index (MSI), è un unico numero da 0 a 100 che legge il regime attuale della struttura delle opzioni — non la direzione del mercato. ' +
      'Combina sei componenti indipendenti — il segno del gamma netto dei dealer, l\'ancora gamma, il rapporto put/call, il regime di volatilità, lo squilibrio del flusso ordini smart-money e la pressione delta dei dealer — ' +
      'ciascuna pesata con un tetto massimo di punti che somma a 100. ' +
      '50 è neutrale; valori ≥70 indicano un regime di trend/espansione negoziabile, 40–70 un trend controllato, 20–40 chop/range, e <20 un\'inversione ad alto rischio (solo mean-reversion, tape fragile). ' +
      'Un MSI alto non significa "rialzista" — significa che i trend possono correre. Un MSI basso non significa "ribassista" — significa che i trend difficilmente funzioneranno.',
    intradayTooltip:
      "L'andamento dell'MSI durante la sessione odierna, tracciato da 0 a 100 con fasce di regime ombreggiate a <20 (inversione ad alto rischio), 20–40 (chop), 40–70 (trend controllato) e ≥70 (trend/espansione). " +
      "Passa sopra un punto per vedere orario, punteggio, regime e le prime 3 componenti che hanno determinato la lettura.",
    contribTooltip:
      'Una singola barra orizzontale che mostra il contributo con segno di ogni componente attorno alla baseline di 50. ' +
      'Le spinte a destra (verdi) sostengono un regime negoziabile/di trend; le spinte a sinistra (rosse) sostengono chop/pinning/inversione. ' +
      'Lo scostamento visivo totale è pari a |composite − 50|. Passa sopra un segmento per il suo punteggio grezzo, contributo e quota di peso.',
    reconnecting: 'Riconnessione in corso… i valori mostrati potrebbero essere non aggiornati.',
    retryNow: 'Riprova ora',
    loadingGauge: 'Caricamento gauge…',
    loadingRegime: 'Caricamento regime…',
    loadingRanges: 'Caricamento intervalli…',
    loadingChart: 'Caricamento grafico…',
    noDataTitle: 'Nessun dato di punteggio per {symbol} ancora.',
    noDataBody: 'Il signal engine non ha righe per questo sottostante. Prova un altro simbolo o riprova durante l\'orario di mercato.',
    scoreRanges: 'Intervalli di punteggio',
    symbolLabel: 'Simbolo',
    scaleLabel: 'Scala',
    neutralLabel: 'Neutrale',
    componentContributions: 'Contributi delle componenti',
    loadingContributions: 'Caricamento contributi…',
    componentsHeading: 'Componenti',
    intradayTrend: 'Trend intraday',
    deltaSinceOpen: 'Δ dall\'apertura',
    deltaLast5Min: 'Δ ultimi 5 min',
    connecting: 'Connessione in corso…',
    disconnectedRetrying: 'Disconnesso — nuovo tentativo',
    stale: 'Non aggiornato',
    staleAgo: 'Non aggiornato • {sec}s fa',
    liveLabel: 'LIVE',
    liveUpdatedAgo: 'LIVE • aggiornato {sec}s fa',
    sessionOpen: 'Mercato aperto',
    sessionPreMarket: 'Pre-market',
    sessionAfterHours: 'After-hours',
    sessionClosed: 'Chiuso',
    sessionHalted: 'Sospeso',
    sessionMarket: 'Mercato',
  },
  de: {
    title: 'Composite Score',
    titleTooltip:
      'Der Composite Score, auch bekannt als Market State Index (MSI), ist eine einzelne Zahl von 0–100, die das aktuelle Optionsstruktur-Regime abbildet — nicht die Marktrichtung. ' +
      'Er kombiniert sechs unabhängige Komponenten — das Vorzeichen des Netto-Dealer-Gamma, den Gamma-Anker, das Put/Call-Verhältnis, das Volatilitätsregime, das Smart-Money-Orderflow-Ungleichgewicht und den Dealer-Delta-Druck — ' +
      'jede mit einer maximalen Punktzahl gewichtet, die sich zu 100 summiert. ' +
      '50 ist neutral; Werte ≥70 deuten auf ein handelbares Trend-/Expansionsregime hin, 40–70 auf einen kontrollierten Trend, 20–40 auf Chop/Range und <20 auf eine risikoreiche Umkehr (nur Mean-Reversion, fragiles Tape). ' +
      'Ein hoher MSI bedeutet nicht "bullisch" — er bedeutet, dass Trends laufen können. Ein niedriger MSI bedeutet nicht "bärisch" — er bedeutet, dass Trends wahrscheinlich nicht funktionieren.',
    intradayTooltip:
      "Der Verlauf des MSI während der heutigen Sitzung, dargestellt von 0–100 mit schattierten Regimebändern bei <20 (risikoreiche Umkehr), 20–40 (Chop), 40–70 (kontrollierter Trend) und ≥70 (Trend/Expansion). " +
      "Fahren Sie über einen Punkt für Zeitstempel, Score, Regime und die drei wichtigsten Komponenten, die den Wert bestimmt haben.",
    contribTooltip:
      'Ein einzelner horizontaler Balken, der den vorzeichenbehafteten Punktbeitrag jeder Komponente um die 50-Basislinie zeigt. ' +
      'Rechts-Schieber (grün) sprechen für ein handelbares/trendendes Regime; Links-Schieber (rot) sprechen für Chop/Pinning/Umkehr. ' +
      'Die gesamte visuelle Verschiebung entspricht |composite − 50|. Fahren Sie über ein Segment für dessen Rohwert, Beitrag und Gewichtsanteil.',
    reconnecting: 'Verbindung wird wiederhergestellt… angezeigte Werte können veraltet sein.',
    retryNow: 'Jetzt erneut versuchen',
    loadingGauge: 'Gauge wird geladen…',
    loadingRegime: 'Regime wird geladen…',
    loadingRanges: 'Bereiche werden geladen…',
    loadingChart: 'Diagramm wird geladen…',
    noDataTitle: 'Noch keine Score-Daten für {symbol}.',
    noDataBody: 'Die Signal-Engine hat keine Zeilen für diesen Basiswert. Versuchen Sie ein anderes Symbol oder schauen Sie während der Handelszeiten erneut vorbei.',
    scoreRanges: 'Score-Bereiche',
    symbolLabel: 'Symbol',
    scaleLabel: 'Skala',
    neutralLabel: 'Neutral',
    componentContributions: 'Komponentenbeiträge',
    loadingContributions: 'Beiträge werden geladen…',
    componentsHeading: 'Komponenten',
    intradayTrend: 'Intraday-Trend',
    deltaSinceOpen: 'Δ seit Eröffnung',
    deltaLast5Min: 'Δ letzte 5 Min.',
    connecting: 'Verbindung wird aufgebaut…',
    disconnectedRetrying: 'Getrennt — erneuter Versuch',
    stale: 'Veraltet',
    staleAgo: 'Veraltet • vor {sec}s',
    liveLabel: 'LIVE',
    liveUpdatedAgo: 'LIVE • aktualisiert vor {sec}s',
    sessionOpen: 'Markt geöffnet',
    sessionPreMarket: 'Vorbörslich',
    sessionAfterHours: 'Nachbörslich',
    sessionClosed: 'Geschlossen',
    sessionHalted: 'Ausgesetzt',
    sessionMarket: 'Markt',
  },
  es: {
    title: 'Composite Score',
    titleTooltip:
      'El Composite Score, también conocido como Market State Index (MSI), es un único número de 0 a 100 que refleja el régimen actual de la estructura de opciones — no la dirección del mercado. ' +
      'Combina seis componentes independientes — el signo del gamma neto del dealer, el ancla de gamma, el ratio put/call, el régimen de volatilidad, el desequilibrio del flujo de órdenes smart-money y la presión delta del dealer — ' +
      'cada uno ponderado con un tope máximo de puntos que suma 100. ' +
      '50 es neutral; lecturas ≥70 indican un régimen de tendencia/expansión negociable, 40–70 una tendencia controlada, 20–40 chop/rango, y <20 una reversión de alto riesgo (solo mean-reversion, cinta frágil). ' +
      'Un MSI alto no significa "alcista" — significa que las tendencias pueden avanzar. Un MSI bajo no significa "bajista" — significa que es poco probable que las tendencias funcionen.',
    intradayTooltip:
      "La trayectoria del MSI durante la sesión de hoy, graficada de 0 a 100 con bandas de régimen sombreadas en <20 (reversión de alto riesgo), 20–40 (chop), 40–70 (tendencia controlada) y ≥70 (tendencia/expansión). " +
      "Pase el cursor sobre cualquier punto para ver la hora, el puntaje, el régimen y los 3 componentes principales que impulsaron la lectura.",
    contribTooltip:
      'Una sola barra horizontal que muestra la contribución con signo de cada componente alrededor de la línea base de 50. ' +
      'Los impulsores a la derecha (verdes) abogan por un régimen negociable/de tendencia; los de la izquierda (rojos) abogan por chop/pinning/reversión. ' +
      'El desplazamiento visual total equivale a |composite − 50|. Pase el cursor sobre un segmento para ver su puntaje bruto, contribución y participación de peso.',
    reconnecting: 'Reconectando… los últimos valores mostrados pueden estar desactualizados.',
    retryNow: 'Reintentar ahora',
    loadingGauge: 'Cargando indicador…',
    loadingRegime: 'Cargando régimen…',
    loadingRanges: 'Cargando rangos…',
    loadingChart: 'Cargando gráfico…',
    noDataTitle: 'Aún no hay datos de puntaje para {symbol}.',
    noDataBody: 'El motor de señales no tiene filas para este subyacente. Pruebe otro símbolo o vuelva a consultar durante el horario de mercado.',
    scoreRanges: 'Rangos de puntaje',
    symbolLabel: 'Símbolo',
    scaleLabel: 'Escala',
    neutralLabel: 'Neutral',
    componentContributions: 'Contribuciones de componentes',
    loadingContributions: 'Cargando contribuciones…',
    componentsHeading: 'Componentes',
    intradayTrend: 'Tendencia intradía',
    deltaSinceOpen: 'Δ desde apertura',
    deltaLast5Min: 'Δ últimos 5 min',
    connecting: 'Conectando…',
    disconnectedRetrying: 'Desconectado — reintentando',
    stale: 'Desactualizado',
    staleAgo: 'Desactualizado • hace {sec}s',
    liveLabel: 'LIVE',
    liveUpdatedAgo: 'LIVE • actualizado hace {sec}s',
    sessionOpen: 'Mercado abierto',
    sessionPreMarket: 'Pre-mercado',
    sessionAfterHours: 'Después del cierre',
    sessionClosed: 'Cerrado',
    sessionHalted: 'Suspendido',
    sessionMarket: 'Mercado',
  },
  fr: {
    title: 'Composite Score',
    titleTooltip:
      'Le Composite Score, aussi appelé Market State Index (MSI), est un nombre unique de 0 à 100 qui reflète le régime actuel de la structure des options — pas la direction du marché. ' +
      'Il combine six composantes indépendantes — le signe du gamma net des dealers, l\'ancre gamma, le ratio put/call, le régime de volatilité, le déséquilibre du flux d\'ordres smart-money et la pression delta des dealers — ' +
      'chacune pondérée avec un plafond de points maximal totalisant 100. ' +
      '50 est neutre ; des valeurs ≥70 indiquent un régime de tendance/expansion négociable, 40–70 une tendance contrôlée, 20–40 du chop/range, et <20 un renversement à haut risque (mean-reversion uniquement, tape fragile). ' +
      'Un MSI élevé ne signifie pas "haussier" — cela signifie que les tendances peuvent se poursuivre. Un MSI bas ne signifie pas "baissier" — cela signifie que les tendances ont peu de chances de fonctionner.',
    intradayTooltip:
      "La trajectoire du MSI au cours de la séance d'aujourd'hui, tracée de 0 à 100 avec des bandes de régime ombrées à <20 (renversement à haut risque), 20–40 (chop), 40–70 (tendance contrôlée) et ≥70 (tendance/expansion). " +
      "Survolez un point pour voir l'horodatage, le score, le régime et les 3 principales composantes ayant déterminé la lecture.",
    contribTooltip:
      'Une seule barre horizontale montrant la contribution signée de chaque composante autour de la ligne de base à 50. ' +
      'Les poussées vers la droite (vert) plaident pour un régime négociable/tendanciel ; les poussées vers la gauche (rouge) plaident pour du chop/pinning/renversement. ' +
      'Le décalage visuel total équivaut à |composite − 50|. Survolez un segment pour son score brut, sa contribution et sa part de poids.',
    reconnecting: 'Reconnexion en cours… les dernières valeurs affichées peuvent être obsolètes.',
    retryNow: 'Réessayer maintenant',
    loadingGauge: 'Chargement de la jauge…',
    loadingRegime: 'Chargement du régime…',
    loadingRanges: 'Chargement des plages…',
    loadingChart: 'Chargement du graphique…',
    noDataTitle: 'Aucune donnée de score pour {symbol} pour le moment.',
    noDataBody: 'Le moteur de signaux n\'a aucune ligne pour ce sous-jacent. Essayez un autre symbole ou revenez pendant les heures de marché.',
    scoreRanges: 'Plages de score',
    symbolLabel: 'Symbole',
    scaleLabel: 'Échelle',
    neutralLabel: 'Neutre',
    componentContributions: 'Contributions des composantes',
    loadingContributions: 'Chargement des contributions…',
    componentsHeading: 'Composantes',
    intradayTrend: 'Tendance intraday',
    deltaSinceOpen: 'Δ depuis l\'ouverture',
    deltaLast5Min: 'Δ 5 dernières min',
    connecting: 'Connexion…',
    disconnectedRetrying: 'Déconnecté — nouvelle tentative',
    stale: 'Obsolète',
    staleAgo: 'Obsolète • il y a {sec}s',
    liveLabel: 'LIVE',
    liveUpdatedAgo: 'LIVE • mis à jour il y a {sec}s',
    sessionOpen: 'Marché ouvert',
    sessionPreMarket: 'Avant-bourse',
    sessionAfterHours: 'Après-bourse',
    sessionClosed: 'Fermé',
    sessionHalted: 'Suspendu',
    sessionMarket: 'Marché',
  },
};
