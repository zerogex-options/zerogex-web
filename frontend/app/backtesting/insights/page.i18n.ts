import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    backLinkText: 'Backtesting',
    pageTitle: 'Pattern Insights',
    descIntro:
      'Measured performance for each playbook pattern on the standardized realized-P&L backtest — net of bid/ask fills, slippage, and commission. One row per (pattern, underlying) pair, latest window per pair.',
    descBold: 'Past performance does not guarantee future returns.',
    descOutro: 'Use these as a sanity check, not a promise.',
    sourceOptionPnlLabel: 'Realized P&L',
    sourceOptionPnlTooltip:
      "Standardized single-leg backtest at the card's own target/stop, with real option fills, slippage, and commission. The honest measure.",
    sourceTouchLabel: 'Touch proxy (debug)',
    sourceTouchTooltip:
      'Debug view: did the underlying reach the target/stop? Ignores premium decay and bid/ask. NOT a measure of P&L — useful only as a sanity check.',
    allUnderlyings: 'All underlyings',
    hideThinSamples: 'Hide pairs with N < {n}',
    thinSampleTooltip:
      "Sub-{n} samples are noisy: the measured rate can swing materially as more trades resolve. Filter on to see only the pairs we'd trust today.",
    refreshLabel: 'Refresh',
    failedToLoad: 'Failed to load insights.',
    debugViewLabel: 'Debug view.',
    debugViewPart1:
      "The Win % column here counts whether the underlying's price reached the card's target before its stop —",
    debugViewNot: 'not',
    debugViewPart2:
      'whether the trade made money. Touch and realized option P&L can disagree wildly (e.g.',
    debugViewPart3: ': ~95% touch rate, ~85% loss rate on options). Use',
    debugViewPart4: 'for any trading decisions; this view exists only as an engine sanity check.',
    headerPattern: 'Pattern',
    headerUndl: 'Undl.',
    headerN: 'N',
    headerNTooltip:
      'Resolved trades in the 60-day calibration window after the per-pattern cooldown. Pairs with N < 40 are considered too small to trust.',
    headerWinPct: 'Win %',
    headerWinPctTooltip:
      'Share of trades whose net P&L was > 0 after slippage and commission. Not a coin-flip baseline: a pattern can have a low win rate and still be profitable overall if its winners are much larger than its losers (check PF and Avg / trade).',
    headerPf: 'PF',
    headerPfTooltip:
      'Profit factor = sum of winners ÷ absolute sum of losers. > 1.0 means the wins outpace the losses.',
    headerAvgTrade: 'Avg / trade',
    headerAvgTradeTooltip: 'Expectancy: net P&L per resolved trade, net of slippage and commission.',
    headerNetPnl: 'Net P&L',
    headerNetPnlTooltip: 'Sum of net_pnl across every trade in the window.',
    headerAvgWin: 'Avg win',
    headerAvgWinTooltip: 'Average dollar size of a winning trade (gross_win_pnl ÷ n_wins).',
    headerAvgLoss: 'Avg loss',
    headerAvgLossTooltip: 'Average dollar size of a losing trade (-gross_loss_pnl ÷ n_losses).',
    loadingText: 'Loading…',
    emptyTrustworthy: 'No pairs with at least {n} resolved trades yet.',
    emptyGeneral: 'No measurements for this source / underlying yet.',
    footerSpec:
      "Standardized spec: single-leg ATM entries at each card's own target/stop, with a +75% premium take-profit and −50% premium stop overlaid. Net of 1% slippage and $0.65 / contract commission. Rows refresh nightly from the calibration backtest.",
    footerLinkText: 'Run your own backtest →',
  },
  it: {
    backLinkText: 'Backtesting',
    pageTitle: 'Approfondimenti sui pattern',
    descIntro:
      'Performance misurata per ciascun pattern del playbook sul backtest standardizzato del P&L realizzato — al netto di fill bid/ask, slippage e commissioni. Una riga per coppia (pattern, sottostante), finestra più recente per coppia.',
    descBold: 'Le performance passate non garantiscono rendimenti futuri.',
    descOutro: 'Usali come verifica di plausibilità, non come una promessa.',
    sourceOptionPnlLabel: 'Realized P&L',
    sourceOptionPnlTooltip:
      "Backtest standardizzato a singola gamba al target/stop della card, con fill reali sulle opzioni, slippage e commissioni. La misura onesta.",
    sourceTouchLabel: 'Touch proxy (debug)',
    sourceTouchTooltip:
      "Vista di debug: il sottostante ha raggiunto il target/stop? Ignora il decadimento del premio e il bid/ask. NON è una misura del P&L — utile solo come verifica di plausibilità.",
    allUnderlyings: 'Tutti i sottostanti',
    hideThinSamples: 'Nascondi le coppie con N < {n}',
    thinSampleTooltip:
      "I campioni inferiori a {n} sono rumorosi: il tasso misurato può oscillare in modo significativo man mano che si risolvono altri trade. Attiva il filtro per vedere solo le coppie di cui fidarsi oggi.",
    refreshLabel: 'Aggiorna',
    failedToLoad: 'Impossibile caricare gli approfondimenti.',
    debugViewLabel: 'Vista di debug.',
    debugViewPart1:
      "La colonna Win % qui conta se il prezzo del sottostante ha raggiunto il target della card prima del suo stop —",
    debugViewNot: 'non',
    debugViewPart2:
      'se il trade ha guadagnato denaro. Il touch e il P&L reale sulle opzioni possono discordare fortemente (ad es.',
    debugViewPart3: ': ~95% tasso di touch, ~85% tasso di perdita sulle opzioni). Usa',
    debugViewPart4: 'per qualsiasi decisione di trading; questa vista esiste solo come verifica di plausibilità del motore.',
    headerPattern: 'Pattern',
    headerUndl: 'Sott.',
    headerN: 'N',
    headerNTooltip:
      'Trade risolti nella finestra di calibrazione di 60 giorni dopo il cooldown specifico del pattern. Le coppie con N < 40 sono considerate troppo piccole per essere attendibili.',
    headerWinPct: 'Win %',
    headerWinPctTooltip:
      'Quota di trade con P&L netto > 0 dopo slippage e commissioni. Non è un riferimento a moneta lanciata: un pattern può avere un win rate basso ed essere comunque profittevole nel complesso se i guadagni sono molto più grandi delle perdite (verifica PF e Avg / trade).',
    headerPf: 'PF',
    headerPfTooltip:
      'Profit factor = somma dei guadagni ÷ somma assoluta delle perdite. > 1.0 significa che i guadagni superano le perdite.',
    headerAvgTrade: 'Avg / trade',
    headerAvgTradeTooltip: 'Expectancy: P&L netto per trade risolto, al netto di slippage e commissioni.',
    headerNetPnl: 'Net P&L',
    headerNetPnlTooltip: 'Somma di net_pnl su tutti i trade della finestra.',
    headerAvgWin: 'Avg win',
    headerAvgWinTooltip: 'Dimensione media in dollari di un trade vincente (gross_win_pnl ÷ n_wins).',
    headerAvgLoss: 'Avg loss',
    headerAvgLossTooltip: 'Dimensione media in dollari di un trade in perdita (-gross_loss_pnl ÷ n_losses).',
    loadingText: 'Caricamento…',
    emptyTrustworthy: 'Ancora nessuna coppia con almeno {n} trade risolti.',
    emptyGeneral: 'Ancora nessuna misurazione per questa fonte / sottostante.',
    footerSpec:
      "Specifica standardizzata: ingressi ATM a singola gamba al target/stop di ciascuna card, con un take-profit del +75% del premio e uno stop del −50% del premio. Al netto dell'1% di slippage e di $0,65 / contratto di commissione. Le righe si aggiornano ogni notte dal backtest di calibrazione.",
    footerLinkText: 'Esegui il tuo backtest →',
  },
  de: {
    backLinkText: 'Backtesting',
    pageTitle: 'Muster-Einblicke',
    descIntro:
      'Gemessene Performance für jedes Playbook-Muster im standardisierten Backtest des realisierten P&L — netto von Bid/Ask-Fills, Slippage und Kommission. Eine Zeile pro (Muster, Basiswert)-Paar, jeweils das neueste Fenster.',
    descBold: 'Vergangene Performance ist keine Garantie für zukünftige Renditen.',
    descOutro: 'Nutze diese Werte als Plausibilitätscheck, nicht als Versprechen.',
    sourceOptionPnlLabel: 'Realized P&L',
    sourceOptionPnlTooltip:
      "Standardisierter Single-Leg-Backtest am eigenen Target/Stop der Card, mit echten Options-Fills, Slippage und Kommission. Das ehrliche Maß.",
    sourceTouchLabel: 'Touch-Proxy (Debug)',
    sourceTouchTooltip:
      'Debug-Ansicht: Hat der Basiswert das Target/Stop erreicht? Ignoriert Prämienverfall und Bid/Ask. KEIN Maß für P&L — nur als Plausibilitätscheck nützlich.',
    allUnderlyings: 'Alle Basiswerte',
    hideThinSamples: 'Paare mit N < {n} ausblenden',
    thinSampleTooltip:
      'Stichproben unter {n} sind verrauscht: Die gemessene Rate kann sich deutlich verschieben, sobald weitere Trades abgeschlossen sind. Filter aktivieren, um nur die Paare zu sehen, denen heute zu vertrauen ist.',
    refreshLabel: 'Aktualisieren',
    failedToLoad: 'Einblicke konnten nicht geladen werden.',
    debugViewLabel: 'Debug-Ansicht.',
    debugViewPart1:
      'Die Spalte Win % zählt hier, ob der Kurs des Basiswerts das Target der Card vor ihrem Stop erreicht hat —',
    debugViewNot: 'nicht',
    debugViewPart2:
      'ob der Trade Geld verdient hat. Touch und realisiertes Options-P&L können stark voneinander abweichen (z. B.',
    debugViewPart3: ': ~95 % Touch-Quote, ~85 % Verlustquote bei Optionen). Verwende',
    debugViewPart4: 'für jede Handelsentscheidung; diese Ansicht dient nur als Plausibilitätscheck der Engine.',
    headerPattern: 'Muster',
    headerUndl: 'Basisw.',
    headerN: 'N',
    headerNTooltip:
      'Abgeschlossene Trades im 60-Tage-Kalibrierungsfenster nach der musterspezifischen Cooldown-Zeit. Paare mit N < 40 gelten als zu klein, um vertrauenswürdig zu sein.',
    headerWinPct: 'Win %',
    headerWinPctTooltip:
      'Anteil der Trades mit netto P&L > 0 nach Slippage und Kommission. Kein Münzwurf-Maßstab: Ein Muster kann eine niedrige Win-Rate haben und trotzdem insgesamt profitabel sein, wenn die Gewinner deutlich größer sind als die Verlierer (siehe PF und Avg / trade).',
    headerPf: 'PF',
    headerPfTooltip:
      'Profit Factor = Summe der Gewinner ÷ absolute Summe der Verlierer. > 1,0 bedeutet, dass die Gewinne die Verluste übertreffen.',
    headerAvgTrade: 'Avg / trade',
    headerAvgTradeTooltip: 'Expectancy: Netto-P&L pro abgeschlossenem Trade, netto von Slippage und Kommission.',
    headerNetPnl: 'Net P&L',
    headerNetPnlTooltip: 'Summe von net_pnl über alle Trades im Fenster.',
    headerAvgWin: 'Avg win',
    headerAvgWinTooltip: 'Durchschnittliche Dollargröße eines Gewinn-Trades (gross_win_pnl ÷ n_wins).',
    headerAvgLoss: 'Avg loss',
    headerAvgLossTooltip: 'Durchschnittliche Dollargröße eines Verlust-Trades (-gross_loss_pnl ÷ n_losses).',
    loadingText: 'Lädt…',
    emptyTrustworthy: 'Noch keine Paare mit mindestens {n} abgeschlossenen Trades.',
    emptyGeneral: 'Noch keine Messungen für diese Quelle / diesen Basiswert.',
    footerSpec:
      'Standardisierte Spezifikation: Single-Leg-ATM-Einstiege am eigenen Target/Stop jeder Card, mit einem Take-Profit von +75 % der Prämie und einem Stop von −50 % der Prämie. Netto von 1 % Slippage und 0,65 $ / Kontrakt Kommission. Zeilen aktualisieren sich nächtlich aus dem Kalibrierungs-Backtest.',
    footerLinkText: 'Eigenen Backtest ausführen →',
  },
  es: {
    backLinkText: 'Backtesting',
    pageTitle: 'Perspectivas de patrones',
    descIntro:
      'Rendimiento medido para cada patrón del playbook en el backtest estandarizado de P&L realizado — neto de fills bid/ask, slippage y comisiones. Una fila por par (patrón, subyacente), la ventana más reciente por par.',
    descBold: 'El rendimiento pasado no garantiza rendimientos futuros.',
    descOutro: 'Usa esto como una verificación de sensatez, no como una promesa.',
    sourceOptionPnlLabel: 'Realized P&L',
    sourceOptionPnlTooltip:
      "Backtest estandarizado de una sola pata en el target/stop propio de la card, con fills reales de opciones, slippage y comisiones. La medida honesta.",
    sourceTouchLabel: 'Touch proxy (debug)',
    sourceTouchTooltip:
      'Vista de depuración: ¿el subyacente alcanzó el target/stop? Ignora el decaimiento de la prima y el bid/ask. NO es una medida del P&L — útil solo como verificación de sensatez.',
    allUnderlyings: 'Todos los subyacentes',
    hideThinSamples: 'Ocultar pares con N < {n}',
    thinSampleTooltip:
      'Las muestras por debajo de {n} son ruidosas: la tasa medida puede cambiar de forma significativa a medida que se resuelven más operaciones. Activa el filtro para ver solo los pares en los que confiar hoy.',
    refreshLabel: 'Actualizar',
    failedToLoad: 'No se pudieron cargar las perspectivas.',
    debugViewLabel: 'Vista de depuración.',
    debugViewPart1:
      'La columna Win % aquí cuenta si el precio del subyacente alcanzó el target de la card antes de su stop —',
    debugViewNot: 'no',
    debugViewPart2:
      'si la operación generó dinero. El touch y el P&L real de opciones pueden discrepar mucho (por ejemplo,',
    debugViewPart3: ': ~95% de tasa de touch, ~85% de tasa de pérdida en opciones). Usa',
    debugViewPart4: 'para cualquier decisión de trading; esta vista existe solo como verificación de sensatez del motor.',
    headerPattern: 'Patrón',
    headerUndl: 'Subyac.',
    headerN: 'N',
    headerNTooltip:
      'Operaciones resueltas en la ventana de calibración de 60 días tras el cooldown propio del patrón. Los pares con N < 40 se consideran demasiado pequeños para confiar en ellos.',
    headerWinPct: 'Win %',
    headerWinPctTooltip:
      'Proporción de operaciones con P&L neto > 0 tras slippage y comisiones. No es una referencia de moneda al aire: un patrón puede tener una tasa de aciertos baja y aun así ser rentable en general si sus ganancias son mucho mayores que sus pérdidas (revisa PF y Avg / trade).',
    headerPf: 'PF',
    headerPfTooltip:
      'Profit factor = suma de ganancias ÷ suma absoluta de pérdidas. > 1.0 significa que las ganancias superan a las pérdidas.',
    headerAvgTrade: 'Avg / trade',
    headerAvgTradeTooltip: 'Expectancy: P&L neto por operación resuelta, neto de slippage y comisiones.',
    headerNetPnl: 'Net P&L',
    headerNetPnlTooltip: 'Suma de net_pnl en todas las operaciones de la ventana.',
    headerAvgWin: 'Avg win',
    headerAvgWinTooltip: 'Tamaño medio en dólares de una operación ganadora (gross_win_pnl ÷ n_wins).',
    headerAvgLoss: 'Avg loss',
    headerAvgLossTooltip: 'Tamaño medio en dólares de una operación perdedora (-gross_loss_pnl ÷ n_losses).',
    loadingText: 'Cargando…',
    emptyTrustworthy: 'Todavía no hay pares con al menos {n} operaciones resueltas.',
    emptyGeneral: 'Todavía no hay mediciones para esta fuente / subyacente.',
    footerSpec:
      'Especificación estandarizada: entradas ATM de una sola pata en el target/stop propio de cada card, con un take-profit del +75% de la prima y un stop del −50% de la prima. Neto de 1% de slippage y $0.65 / contrato de comisión. Las filas se actualizan cada noche desde el backtest de calibración.',
    footerLinkText: 'Ejecuta tu propio backtest →',
  },
  fr: {
    backLinkText: 'Backtesting',
    pageTitle: 'Analyses de patterns',
    descIntro:
      'Performance mesurée pour chaque pattern du playbook sur le backtest standardisé du P&L réalisé — net des exécutions bid/ask, du slippage et des commissions. Une ligne par paire (pattern, sous-jacent), fenêtre la plus récente par paire.',
    descBold: 'Les performances passées ne garantissent pas les rendements futurs.',
    descOutro: 'Utilisez ces données comme un contrôle de cohérence, pas comme une promesse.',
    sourceOptionPnlLabel: 'Realized P&L',
    sourceOptionPnlTooltip:
      "Backtest standardisé à une seule jambe au target/stop propre de la card, avec des exécutions d'options réelles, du slippage et des commissions. La mesure honnête.",
    sourceTouchLabel: 'Touch proxy (debug)',
    sourceTouchTooltip:
      "Vue de débogage : le sous-jacent a-t-il atteint le target/stop ? Ignore la décroissance de la prime et le bid/ask. Ce n'est PAS une mesure du P&L — utile uniquement comme contrôle de cohérence.",
    allUnderlyings: 'Tous les sous-jacents',
    hideThinSamples: 'Masquer les paires avec N < {n}',
    thinSampleTooltip:
      "Les échantillons inférieurs à {n} sont bruités : le taux mesuré peut varier fortement à mesure que d'autres trades se résolvent. Activez le filtre pour ne voir que les paires fiables aujourd'hui.",
    refreshLabel: 'Actualiser',
    failedToLoad: 'Impossible de charger les analyses.',
    debugViewLabel: 'Vue de débogage.',
    debugViewPart1:
      'La colonne Win % compte ici si le prix du sous-jacent a atteint le target de la card avant son stop —',
    debugViewNot: 'non',
    debugViewPart2:
      'si le trade a rapporté de l\'argent. Le touch et le P&L réel des options peuvent diverger fortement (par ex.',
    debugViewPart3: " : ~95 % de taux de touch, ~85 % de taux de perte sur les options). Utilisez",
    debugViewPart4: 'pour toute décision de trading ; cette vue n\'existe que comme contrôle de cohérence du moteur.',
    headerPattern: 'Pattern',
    headerUndl: 'S.-jac.',
    headerN: 'N',
    headerNTooltip:
      'Trades résolus dans la fenêtre de calibration de 60 jours après le cooldown propre au pattern. Les paires avec N < 40 sont considérées trop réduites pour être fiables.',
    headerWinPct: 'Win %',
    headerWinPctTooltip:
      'Part des trades dont le P&L net était > 0 après slippage et commissions. Ce n\'est pas une référence de pile ou face : un pattern peut avoir un taux de réussite faible et rester rentable globalement si ses gains sont bien plus importants que ses pertes (vérifiez PF et Avg / trade).',
    headerPf: 'PF',
    headerPfTooltip:
      'Profit factor = somme des gains ÷ somme absolue des pertes. > 1,0 signifie que les gains dépassent les pertes.',
    headerAvgTrade: 'Avg / trade',
    headerAvgTradeTooltip: 'Expectancy : P&L net par trade résolu, net du slippage et des commissions.',
    headerNetPnl: 'Net P&L',
    headerNetPnlTooltip: 'Somme de net_pnl sur tous les trades de la fenêtre.',
    headerAvgWin: 'Avg win',
    headerAvgWinTooltip: 'Taille moyenne en dollars d\'un trade gagnant (gross_win_pnl ÷ n_wins).',
    headerAvgLoss: 'Avg loss',
    headerAvgLossTooltip: 'Taille moyenne en dollars d\'un trade perdant (-gross_loss_pnl ÷ n_losses).',
    loadingText: 'Chargement…',
    emptyTrustworthy: 'Aucune paire avec au moins {n} trades résolus pour le moment.',
    emptyGeneral: 'Aucune mesure pour cette source / ce sous-jacent pour le moment.',
    footerSpec:
      "Spécification standardisée : entrées ATM à une seule jambe au target/stop propre de chaque card, avec un take-profit de +75 % de la prime et un stop de −50 % de la prime. Net de 1 % de slippage et 0,65 $ / contrat de commission. Les lignes se mettent à jour chaque nuit à partir du backtest de calibration.",
    footerLinkText: 'Lancez votre propre backtest →',
  },
};
