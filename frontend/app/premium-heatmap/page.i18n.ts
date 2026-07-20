import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    pageTitle: 'Premium Surface',
    titleTooltip:
      'A 3D surface of option time value. X = strike, Y = days to expiration, ' +
      'Z = either extrinsic dollars (premium − intrinsic, floored at $0) or the ' +
      '% move from current spot to break even at expiry — toggle via the Z ' +
      'dropdown. Use the symbol selector in the header to change the underlying.',
    descExtrinsic: 'Extrinsic (time) value surface',
    descBreakevenPct: '% move from spot to breakeven at expiry',
    descFor: 'for',
    calls: 'calls',
    puts: 'puts',
    descExtrinsicDetail: 'premium minus intrinsic value across strikes and expirations.',
    descBreakevenDetail: 'how far spot must move (in %) for each contract to break even at expiry.',
    typeLabel: 'Type',
    maxDteLabel: 'Max DTE',
    strikesLabel: 'Strikes',
    zLabel: 'Z',
    optionTypeAria: 'Option type',
    maxDteAria: 'Maximum days to expiration',
    strikesAria: 'Number of strikes around spot',
    zAxisAria: 'Z-axis metric',
    callsOption: 'Calls',
    putsOption: 'Puts',
    daysUnit: 'days',
    maxSuffix: '(max)',
    strikesUnit: 'strikes',
    extrinsicOption: 'Extrinsic $',
    breakevenOption: '% to Breakeven',
    spotLabel: 'Spot',
    noDataMsg: 'No options premium data available for {symbol} {type} yet.',
    notEnoughGridMsg:
      'Not enough strikes/expirations to render a surface — try widening Max DTE or strike count.',
    noUsableDataMsg:
      'The snapshot returned strikes and expirations for {symbol} {type}, but no usable premium quotes ' +
      '(bid/ask/mid/last) — so there are no time-value points to plot. This usually means the latest ' +
      'option-chain snapshot has empty quotes.',
  },
  it: {
    pageTitle: 'Superficie del premio',
    titleTooltip:
      'Una superficie 3D del valore temporale delle opzioni. X = strike, Y = giorni alla scadenza, ' +
      'Z = valore estrinseco in dollari (premio − intrinseco, con minimo $0) oppure la ' +
      '% di movimento dal prezzo spot attuale al pareggio a scadenza — passa da uno all\'altro con il menu ' +
      'Z. Usa il selettore del simbolo nell\'intestazione per cambiare il sottostante.',
    descExtrinsic: 'Superficie del valore estrinseco (temporale)',
    descBreakevenPct: '% di movimento dallo spot al pareggio a scadenza',
    descFor: 'per',
    calls: 'call',
    puts: 'put',
    descExtrinsicDetail: 'premio meno valore intrinseco su strike e scadenze.',
    descBreakevenDetail: 'quanto deve muoversi lo spot (in %) affinché ciascun contratto vada in pareggio a scadenza.',
    typeLabel: 'Tipo',
    maxDteLabel: 'DTE massimi',
    strikesLabel: 'Strike',
    zLabel: 'Z',
    optionTypeAria: 'Tipo di opzione',
    maxDteAria: 'Giorni massimi alla scadenza',
    strikesAria: 'Numero di strike intorno allo spot',
    zAxisAria: 'Metrica dell\'asse Z',
    callsOption: 'Call',
    putsOption: 'Put',
    daysUnit: 'giorni',
    maxSuffix: '(massimo)',
    strikesUnit: 'strike',
    extrinsicOption: 'Estrinseco $',
    breakevenOption: '% al pareggio',
    spotLabel: 'Spot',
    noDataMsg: 'Nessun dato sui premi delle opzioni disponibile per {symbol} {type} al momento.',
    notEnoughGridMsg:
      'Strike/scadenze insufficienti per generare una superficie — prova ad aumentare i DTE massimi o il numero di strike.',
    noUsableDataMsg:
      'Lo snapshot ha restituito strike e scadenze per {symbol} {type}, ma nessuna quotazione di premio utilizzabile ' +
      '(bid/ask/mid/last) — quindi non ci sono punti di valore temporale da plottare. Di solito significa che l\'ultimo ' +
      'snapshot della catena di opzioni ha quotazioni vuote.',
  },
  de: {
    pageTitle: 'Prämien-Oberfläche',
    titleTooltip:
      'Eine 3D-Oberfläche des Zeitwerts von Optionen. X = Strike, Y = Tage bis zum Verfall, ' +
      'Z = entweder der extrinsische Wert in Dollar (Prämie − innerer Wert, mit Untergrenze $0) oder die ' +
      '% Bewegung vom aktuellen Spotpreis bis zum Break-even am Verfall — umschaltbar über das Z-' +
      'Dropdown. Verwende die Symbolauswahl in der Kopfzeile, um den Basiswert zu ändern.',
    descExtrinsic: 'Extrinsische (Zeit-)Wertoberfläche',
    descBreakevenPct: '% Bewegung vom Spot zum Break-even am Verfall',
    descFor: 'für',
    calls: 'Calls',
    puts: 'Puts',
    descExtrinsicDetail: 'Prämie abzüglich innerem Wert über Strikes und Verfallstermine.',
    descBreakevenDetail: 'wie weit sich der Spot (in %) bewegen muss, damit jeder Kontrakt am Verfall den Break-even erreicht.',
    typeLabel: 'Typ',
    maxDteLabel: 'Max. DTE',
    strikesLabel: 'Strikes',
    zLabel: 'Z',
    optionTypeAria: 'Optionstyp',
    maxDteAria: 'Maximale Tage bis zum Verfall',
    strikesAria: 'Anzahl der Strikes um den Spot',
    zAxisAria: 'Z-Achsen-Metrik',
    callsOption: 'Calls',
    putsOption: 'Puts',
    daysUnit: 'Tage',
    maxSuffix: '(max.)',
    strikesUnit: 'Strikes',
    extrinsicOption: 'Extrinsisch $',
    breakevenOption: '% bis Break-even',
    spotLabel: 'Spot',
    noDataMsg: 'Derzeit keine Optionsprämiendaten für {symbol} {type} verfügbar.',
    notEnoughGridMsg:
      'Zu wenige Strikes/Verfallstermine, um eine Oberfläche darzustellen — versuche, den max. DTE oder die Strike-Anzahl zu erhöhen.',
    noUsableDataMsg:
      'Der Snapshot lieferte Strikes und Verfallstermine für {symbol} {type}, aber keine verwertbaren Prämiennotierungen ' +
      '(Bid/Ask/Mid/Last) — es gibt also keine Zeitwertpunkte zum Plotten. Das bedeutet meist, dass der aktuelle ' +
      'Optionsketten-Snapshot leere Notierungen enthält.',
  },
  es: {
    pageTitle: 'Superficie de prima',
    titleTooltip:
      'Una superficie 3D del valor temporal de las opciones. X = strike, Y = días hasta el vencimiento, ' +
      'Z = valor extrínseco en dólares (prima − valor intrínseco, con mínimo de $0) o el ' +
      '% de movimiento desde el spot actual hasta el punto de equilibrio al vencimiento — se alterna con el ' +
      'menú desplegable Z. Usa el selector de símbolo en el encabezado para cambiar el subyacente.',
    descExtrinsic: 'Superficie de valor extrínseco (temporal)',
    descBreakevenPct: '% de movimiento desde el spot hasta el punto de equilibrio al vencimiento',
    descFor: 'para',
    calls: 'calls',
    puts: 'puts',
    descExtrinsicDetail: 'prima menos valor intrínseco a través de strikes y vencimientos.',
    descBreakevenDetail: 'cuánto debe moverse el spot (en %) para que cada contrato alcance el punto de equilibrio al vencimiento.',
    typeLabel: 'Tipo',
    maxDteLabel: 'DTE máx.',
    strikesLabel: 'Strikes',
    zLabel: 'Z',
    optionTypeAria: 'Tipo de opción',
    maxDteAria: 'Días máximos hasta el vencimiento',
    strikesAria: 'Número de strikes alrededor del spot',
    zAxisAria: 'Métrica del eje Z',
    callsOption: 'Calls',
    putsOption: 'Puts',
    daysUnit: 'días',
    maxSuffix: '(máx.)',
    strikesUnit: 'strikes',
    extrinsicOption: 'Extrínseco $',
    breakevenOption: '% al punto de equilibrio',
    spotLabel: 'Spot',
    noDataMsg: 'No hay datos de prima de opciones disponibles para {symbol} {type} por ahora.',
    notEnoughGridMsg:
      'No hay suficientes strikes/vencimientos para generar una superficie — intenta aumentar el DTE máximo o el número de strikes.',
    noUsableDataMsg:
      'El snapshot devolvió strikes y vencimientos para {symbol} {type}, pero sin cotizaciones de prima utilizables ' +
      '(bid/ask/mid/last), por lo que no hay puntos de valor temporal que graficar. Esto suele significar que el último ' +
      'snapshot de la cadena de opciones tiene cotizaciones vacías.',
  },
  fr: {
    pageTitle: 'Surface de prime',
    titleTooltip:
      'Une surface 3D de la valeur temps des options. X = strike, Y = jours jusqu\'à l\'échéance, ' +
      'Z = soit la valeur extrinsèque en dollars (prime − valeur intrinsèque, plancher $0), soit le ' +
      '% de mouvement du spot actuel jusqu\'au seuil de rentabilité à l\'échéance — à basculer via le menu ' +
      'déroulant Z. Utilisez le sélecteur de symbole dans l\'en-tête pour changer le sous-jacent.',
    descExtrinsic: 'Surface de valeur extrinsèque (temps)',
    descBreakevenPct: '% de mouvement du spot jusqu\'au seuil de rentabilité à l\'échéance',
    descFor: 'pour',
    calls: 'calls',
    puts: 'puts',
    descExtrinsicDetail: 'prime moins valeur intrinsèque sur les strikes et les échéances.',
    descBreakevenDetail: 'de combien le spot doit bouger (en %) pour que chaque contrat atteigne le seuil de rentabilité à l\'échéance.',
    typeLabel: 'Type',
    maxDteLabel: 'DTE max',
    strikesLabel: 'Strikes',
    zLabel: 'Z',
    optionTypeAria: 'Type d\'option',
    maxDteAria: 'Jours maximum jusqu\'à l\'échéance',
    strikesAria: 'Nombre de strikes autour du spot',
    zAxisAria: 'Métrique de l\'axe Z',
    callsOption: 'Calls',
    putsOption: 'Puts',
    daysUnit: 'jours',
    maxSuffix: '(max)',
    strikesUnit: 'strikes',
    extrinsicOption: 'Extrinsèque $',
    breakevenOption: '% au seuil de rentabilité',
    spotLabel: 'Spot',
    noDataMsg: 'Aucune donnée de prime d\'options disponible pour {symbol} {type} pour le moment.',
    notEnoughGridMsg:
      'Pas assez de strikes/échéances pour générer une surface — essayez d\'augmenter le DTE max ou le nombre de strikes.',
    noUsableDataMsg:
      'Le snapshot a renvoyé des strikes et des échéances pour {symbol} {type}, mais aucune cotation de prime utilisable ' +
      '(bid/ask/mid/last) — il n\'y a donc aucun point de valeur temps à tracer. Cela signifie généralement que le dernier ' +
      'snapshot de la chaîne d\'options contient des cotations vides.',
  },
};
