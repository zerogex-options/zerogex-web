import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    pageTitle: 'Max Pain',
    regimeTitle: 'Max Pain Regime',
    badgePinRisk: 'Pin Risk Elevated',
    badgeUpside: 'Upside Magnet',
    badgeDownside: 'Downside Magnet',
    summaryIntro: 'Spot is {word} max pain by {move} points ({pct}%).',
    belowWord: 'below',
    aboveWord: 'above',
    summaryNeutral:
      'Price is already near the pin, so expect more mean-reversion behavior and faster failed breakouts.',
    summaryUpside:
      'A higher pin suggests dealer hedging can nudge price upward into expirations if buyers stay engaged.',
    summaryDownside:
      'A lower pin suggests gravity can remain to the downside into expiry, especially on failed bounces.',
    summaryOutro:
      'Day and swing traders can use this as context: fade overextensions near the pin, but treat decisive breaks away from max pain as trend-confirmation signals.',
    sectionSnapshotTitle: 'Max Pain Snapshot',
    sectionSnapshotTooltip: 'Current max pain context combining summary and intraday series.',
    currentMaxPainLabel: 'Current Max Pain (All Expirations)',
    currentMaxPainTooltip:
      "Whole-chain max pain: the single strike where the most option value across ALL listed expirations would expire worthless, pooled into one payout curve. Open interest only changes at settlement, so this is recomputed once a day (pre-market). It's the authoritative value and is what drives the Implied Move below.",
    impliedMoveLabel: 'Implied Move:',
    impliedMoveTitle: 'Implied move = Max Pain - Current Underlying',
    nearestExpMaxPainTitle: 'Nearest-Expiration Max Pain',
    nearestExpMaxPainTooltip:
      'Max pain for only the nearest non-expired expiration (often a daily or weekly contract) — the same value shown on the dashed Max Pain line in the chart below when its dropdown is set to that expiration. Because it covers a single expiration, it can sit a few points apart from the whole-chain Current Max Pain above, and it stays flat intraday since open interest only changes at settlement.',
    underlyingPriceTitle: 'Underlying Price',
    underlyingPriceTooltip: 'Latest underlying close mapped from /api/market/historical.',
    sectionOiTitle: 'Notional Open Interest by Strike',
    sectionOiTooltip:
      'Select expiration and view call/put notional by strike with max pain and underlying reference lines.',
    expirationLabel: 'Expiration:',
    errorLoadingData: 'Error loading data: {error}',
    noOiData: 'No max pain OI data available',
    sectionSeriesTitle: 'Max Pain vs Underlying Price',
    sectionSeriesTooltip: 'Timeseries of max pain (line) overlaid with underlying candlesticks.',
    noSeriesData: 'No max pain timeseries data available',
  },
  it: {
    pageTitle: 'Max Pain',
    regimeTitle: 'Regime di Max Pain',
    badgePinRisk: 'Rischio di Pinning Elevato',
    badgeUpside: 'Magnete al Rialzo',
    badgeDownside: 'Magnete al Ribasso',
    summaryIntro: 'Lo spot è {word} il max pain di {move} punti ({pct}%).',
    belowWord: 'sotto',
    aboveWord: 'sopra',
    summaryNeutral:
      'Il prezzo è già vicino al pin, quindi ci si aspetta più comportamento di mean-reversion e breakout falliti più rapidi.',
    summaryUpside:
      "Un pin più alto suggerisce che l'hedging dei dealer possa spingere il prezzo verso l'alto verso le scadenze, se i compratori restano coinvolti.",
    summaryDownside:
      'Un pin più basso suggerisce che la gravità possa restare al ribasso verso la scadenza, specialmente su rimbalzi falliti.',
    summaryOutro:
      'I trader intraday e swing possono usare questo come contesto: vendere le estensioni eccessive vicino al pin, ma trattare le rotture decise lontano dal max pain come segnali di conferma del trend.',
    sectionSnapshotTitle: 'Snapshot di Max Pain',
    sectionSnapshotTooltip: 'Contesto attuale del max pain che combina il riepilogo e la serie intraday.',
    currentMaxPainLabel: 'Max Pain Attuale (Tutte le Scadenze)',
    currentMaxPainTooltip:
      "Max pain su tutta la catena: lo strike unico in cui il maggior valore delle opzioni su TUTTE le scadenze quotate scadrebbe senza valore, riunito in un'unica curva di payout. L'open interest cambia solo al settlement, quindi viene ricalcolato una volta al giorno (pre-market). È il valore autorevole e determina l'Implied Move sotto.",
    impliedMoveLabel: 'Movimento Implicito:',
    impliedMoveTitle: 'Movimento implicito = Max Pain - Sottostante Attuale',
    nearestExpMaxPainTitle: 'Max Pain della Scadenza più Vicina',
    nearestExpMaxPainTooltip:
      'Max pain solo per la scadenza non ancora scaduta più vicina (spesso un contratto giornaliero o settimanale) — lo stesso valore mostrato nella linea tratteggiata di Max Pain nel grafico sotto quando il menu è impostato su quella scadenza. Poiché copre una singola scadenza, può differire di qualche punto dal Max Pain Attuale su tutta la catena mostrato sopra, e resta stabile durante la giornata perché l\'open interest cambia solo al settlement.',
    underlyingPriceTitle: 'Prezzo del Sottostante',
    underlyingPriceTooltip: "Ultima chiusura del sottostante mappata da /api/market/historical.",
    sectionOiTitle: 'Open Interest Nozionale per Strike',
    sectionOiTooltip:
      'Seleziona la scadenza e visualizza il nozionale call/put per strike con le linee di riferimento di max pain e del sottostante.',
    expirationLabel: 'Scadenza:',
    errorLoadingData: 'Errore nel caricamento dei dati: {error}',
    noOiData: 'Nessun dato di open interest per il max pain disponibile',
    sectionSeriesTitle: 'Max Pain vs Prezzo del Sottostante',
    sectionSeriesTooltip: 'Serie temporale del max pain (linea) sovrapposta alle candele del sottostante.',
    noSeriesData: 'Nessun dato della serie temporale del max pain disponibile',
  },
  de: {
    pageTitle: 'Max Pain',
    regimeTitle: 'Max-Pain-Regime',
    badgePinRisk: 'Erhöhtes Pin-Risiko',
    badgeUpside: 'Aufwärtsmagnet',
    badgeDownside: 'Abwärtsmagnet',
    summaryIntro: 'Der Spot liegt {move} Punkte ({pct}%) {word} dem Max Pain.',
    belowWord: 'unter',
    aboveWord: 'über',
    summaryNeutral:
      'Der Preis liegt bereits nahe am Pin, daher ist mit mehr Mean-Reversion-Verhalten und schnelleren gescheiterten Ausbrüchen zu rechnen.',
    summaryUpside:
      'Ein höherer Pin deutet darauf hin, dass Dealer-Hedging den Preis in Richtung der Verfallstermine nach oben schieben kann, solange Käufer engagiert bleiben.',
    summaryDownside:
      'Ein niedrigerer Pin deutet darauf hin, dass die Schwerkraft bis zum Verfall weiterhin nach unten wirken kann, besonders bei gescheiterten Erholungen.',
    summaryOutro:
      'Day- und Swing-Trader können dies als Kontext nutzen: Überdehnungen nahe am Pin gegen den Trend handeln, aber entschlossene Ausbrüche weg vom Max Pain als Trendbestätigungssignale werten.',
    sectionSnapshotTitle: 'Max-Pain-Snapshot',
    sectionSnapshotTooltip: 'Aktueller Max-Pain-Kontext, der Zusammenfassung und Intraday-Serie kombiniert.',
    currentMaxPainLabel: 'Aktueller Max Pain (Alle Verfallstermine)',
    currentMaxPainTooltip:
      'Ketten-übergreifender Max Pain: der einzelne Strike, an dem der meiste Optionswert über ALLE gelisteten Verfallstermine wertlos verfallen würde, zusammengefasst in einer Auszahlungskurve. Das Open Interest ändert sich nur beim Settlement, daher wird dieser Wert einmal täglich (vor Marktöffnung) neu berechnet. Es ist der maßgebliche Wert und treibt die Implied Move unten an.',
    impliedMoveLabel: 'Implizite Bewegung:',
    impliedMoveTitle: 'Implizite Bewegung = Max Pain - Aktueller Basiswert',
    nearestExpMaxPainTitle: 'Max Pain des Nächstliegenden Verfalls',
    nearestExpMaxPainTooltip:
      'Max Pain nur für den nächstliegenden, noch nicht abgelaufenen Verfall (oft ein Tages- oder Wochenkontrakt) — derselbe Wert, der in der gestrichelten Max-Pain-Linie im Chart unten angezeigt wird, wenn das Dropdown auf diesen Verfall eingestellt ist. Da er nur einen einzelnen Verfall abdeckt, kann er einige Punkte vom oben gezeigten ketten-übergreifenden Aktuellen Max Pain abweichen, und er bleibt intraday konstant, da sich das Open Interest nur beim Settlement ändert.',
    underlyingPriceTitle: 'Basiswertpreis',
    underlyingPriceTooltip: 'Letzter Basiswert-Schlusskurs, zugeordnet aus /api/market/historical.',
    sectionOiTitle: 'Nominales Open Interest nach Strike',
    sectionOiTooltip:
      'Verfall auswählen und Call/Put-Nominalwert nach Strike mit Referenzlinien für Max Pain und Basiswert anzeigen.',
    expirationLabel: 'Verfall:',
    errorLoadingData: 'Fehler beim Laden der Daten: {error}',
    noOiData: 'Keine Max-Pain-Open-Interest-Daten verfügbar',
    sectionSeriesTitle: 'Max Pain vs. Basiswertpreis',
    sectionSeriesTooltip: 'Zeitreihe des Max Pain (Linie), überlagert mit Basiswert-Kerzen.',
    noSeriesData: 'Keine Max-Pain-Zeitreihendaten verfügbar',
  },
  es: {
    pageTitle: 'Max Pain',
    regimeTitle: 'Régimen de Max Pain',
    badgePinRisk: 'Riesgo de Pin Elevado',
    badgeUpside: 'Magnetismo Alcista',
    badgeDownside: 'Magnetismo Bajista',
    summaryIntro: 'El spot está {word} del max pain por {move} puntos ({pct}%).',
    belowWord: 'por debajo',
    aboveWord: 'por encima',
    summaryNeutral:
      'El precio ya está cerca del pin, por lo que se espera más comportamiento de reversión a la media y rupturas fallidas más rápidas.',
    summaryUpside:
      'Un pin más alto sugiere que el hedging de los dealers puede empujar el precio hacia arriba hacia los vencimientos si los compradores permanecen activos.',
    summaryDownside:
      'Un pin más bajo sugiere que la gravedad puede seguir hacia abajo hasta el vencimiento, especialmente en rebotes fallidos.',
    summaryOutro:
      'Los traders intradía y de swing pueden usar esto como contexto: vender las sobreextensiones cerca del pin, pero tratar las rupturas decisivas lejos del max pain como señales de confirmación de tendencia.',
    sectionSnapshotTitle: 'Instantánea de Max Pain',
    sectionSnapshotTooltip: 'Contexto actual de max pain que combina el resumen y la serie intradía.',
    currentMaxPainLabel: 'Max Pain Actual (Todos los Vencimientos)',
    currentMaxPainTooltip:
      'Max pain de toda la cadena: el strike único donde la mayor parte del valor de las opciones en TODOS los vencimientos listados expiraría sin valor, agrupado en una única curva de pago. El open interest solo cambia en el settlement, por lo que se recalcula una vez al día (antes de la apertura). Es el valor autorizado y es lo que impulsa el Implied Move de abajo.',
    impliedMoveLabel: 'Movimiento Implícito:',
    impliedMoveTitle: 'Movimiento implícito = Max Pain - Subyacente Actual',
    nearestExpMaxPainTitle: 'Max Pain del Vencimiento más Cercano',
    nearestExpMaxPainTooltip:
      'Max pain solo para el vencimiento no expirado más cercano (a menudo un contrato diario o semanal) — el mismo valor mostrado en la línea discontinua de Max Pain en el gráfico de abajo cuando su menú desplegable está en ese vencimiento. Como cubre un solo vencimiento, puede diferir unos puntos del Max Pain Actual de toda la cadena mostrado arriba, y permanece estable durante el día porque el open interest solo cambia en el settlement.',
    underlyingPriceTitle: 'Precio del Subyacente',
    underlyingPriceTooltip: 'Último cierre del subyacente obtenido de /api/market/historical.',
    sectionOiTitle: 'Open Interest Nocional por Strike',
    sectionOiTooltip:
      'Selecciona el vencimiento y visualiza el nocional de calls/puts por strike con líneas de referencia de max pain y del subyacente.',
    expirationLabel: 'Vencimiento:',
    errorLoadingData: 'Error al cargar los datos: {error}',
    noOiData: 'No hay datos de open interest de max pain disponibles',
    sectionSeriesTitle: 'Max Pain vs Precio del Subyacente',
    sectionSeriesTooltip: 'Serie temporal del max pain (línea) superpuesta con velas del subyacente.',
    noSeriesData: 'No hay datos de la serie temporal de max pain disponibles',
  },
  fr: {
    pageTitle: 'Max Pain',
    regimeTitle: 'Régime de Max Pain',
    badgePinRisk: 'Risque de Pin Élevé',
    badgeUpside: 'Aimant Haussier',
    badgeDownside: 'Aimant Baissier',
    summaryIntro: 'Le spot est {word} le max pain de {move} points ({pct}%).',
    belowWord: 'en dessous',
    aboveWord: 'au-dessus',
    summaryNeutral:
      'Le prix est déjà proche du pin, il faut donc s\'attendre à plus de retour à la moyenne et à des cassures échouées plus rapides.',
    summaryUpside:
      'Un pin plus élevé suggère que la couverture des market makers peut poussser le prix vers le haut à l\'approche des échéances si les acheteurs restent actifs.',
    summaryDownside:
      'Un pin plus bas suggère que la gravité peut rester orientée à la baisse jusqu\'à l\'échéance, en particulier lors de rebonds échoués.',
    summaryOutro:
      'Les traders intrajournaliers et swing peuvent utiliser ceci comme contexte : vendre les excès près du pin, mais traiter les cassures nettes loin du max pain comme des signaux de confirmation de tendance.',
    sectionSnapshotTitle: 'Instantané du Max Pain',
    sectionSnapshotTooltip: 'Contexte actuel du max pain combinant le résumé et la série intrajournalière.',
    currentMaxPainLabel: 'Max Pain Actuel (Toutes Échéances)',
    currentMaxPainTooltip:
      "Max pain sur toute la chaîne : le strike unique où la plus grande valeur d'options sur TOUTES les échéances cotées expirerait sans valeur, regroupée en une seule courbe de paiement. L'open interest ne change qu'au règlement, donc ceci est recalculé une fois par jour (avant l'ouverture). C'est la valeur de référence et c'est elle qui déterminant l'Implied Move ci-dessous.",
    impliedMoveLabel: 'Mouvement Implicite :',
    impliedMoveTitle: 'Mouvement implicite = Max Pain - Sous-jacent Actuel',
    nearestExpMaxPainTitle: 'Max Pain de l\'Échéance la Plus Proche',
    nearestExpMaxPainTooltip:
      "Max pain pour la seule échéance non expirée la plus proche (souvent un contrat quotidien ou hebdomadaire) — la même valeur affichée sur la ligne pointillée de Max Pain dans le graphique ci-dessous lorsque le menu déroulant est réglé sur cette échéance. Comme elle ne couvre qu'une seule échéance, elle peut différer de quelques points du Max Pain Actuel sur toute la chaîne affiché ci-dessus, et elle reste stable en intrajournalier car l'open interest ne change qu'au règlement.",
    underlyingPriceTitle: 'Prix du Sous-jacent',
    underlyingPriceTooltip: 'Dernière clôture du sous-jacent, obtenue depuis /api/market/historical.',
    sectionOiTitle: 'Open Interest Notionnel par Strike',
    sectionOiTooltip:
      'Sélectionnez une échéance et visualisez le notionnel calls/puts par strike avec les lignes de référence du max pain et du sous-jacent.',
    expirationLabel: 'Échéance :',
    errorLoadingData: 'Erreur lors du chargement des données : {error}',
    noOiData: 'Aucune donnée d\'open interest de max pain disponible',
    sectionSeriesTitle: 'Max Pain vs Prix du Sous-jacent',
    sectionSeriesTooltip: 'Série temporelle du max pain (ligne) superposée aux chandeliers du sous-jacent.',
    noSeriesData: 'Aucune donnée de série temporelle de max pain disponible',
  },
};
