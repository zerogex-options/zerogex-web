import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    pageTitle: 'Dealer Positioning Analysis',
    netGexTooltip:
      "Cumulative dealer gamma at the current spot price — the value of the same low→high cumulative curve whose zero crossing is the gamma flip, so it is always sign-consistent with the flip. Positive = dealers net long gamma here (pinning, mean-reversion); negative = net short gamma here (trending, vol amplification). The regime flips at the gamma flip level above. (Not the chain-wide total, which can carry the opposite sign when far-OTM strikes dominate the tail.)",
    ivRankTooltip:
      'Implied volatility rank derived from {volIndex} level. 0% = historically calm, 100% = extreme fear. Maps {volIndex} to a 0-100 percentile scale.',
    vannaTooltip:
      'Net vanna exposure across all strikes. Positive vanna = vol crush supports upside (tailwind). Negative vanna = vol crush pressures downside (headwind).',
    charmTooltip:
      'Net charm (delta decay over time) across all strikes. Shows whether time decay is systematically adding or removing directional delta pressure.',
    metricsSnapshotTitle: 'GEX Metrics Snapshot',
    metricsSnapshotTooltip:
      'Filter expirations and inspect strike-level net GEX, vanna, charm, OI, and volume from /api/gex/by-strike.',
    noStrikeData: 'No strike-level gamma data available',
    expirationsLabel: 'Expirations:',
    allButton: 'All',
    clearButton: 'Clear',
    clearButtonTitle: 'Clear all expiration selections',
    noExpirationsSelected: 'No expirations selected. Click an expiration or "All" to display data.',
    expandCardLabel: 'Expand card',
    locAboveCallWall:
      'Spot is above the call wall, so upside continuation can squeeze quickly but failed breakouts can snap back hard.',
    locBelowPutWall: 'Spot is below the put wall, so downside can accelerate fast if support keeps failing.',
    locNearPutWall:
      'Spot is just above the put wall, where failed breakdowns often reverse sharply and trap late shorts.',
    locNearCallWall: 'Spot is leaning toward the call wall, where breakouts can run if buyers keep pressure on.',
    locIncomplete: 'Wall placement is incomplete, so treat directional conviction as lower until structure is clearer.',
    gexUnclear: 'Dealer gamma at spot is unclear, so expect less reliable pinning behavior.',
    gexDeepLong:
      'Dealers are deeply long gamma at spot, which usually suppresses volatility and favors fade/mean-reversion over aggressive trend chasing.',
    gexNetLong: 'Dealers are net long gamma at spot, so price is more likely to mean-revert than sustain runaway moves.',
    gexDeepShort:
      'Dealers are deeply short gamma at spot, which often amplifies volatility and can punish late entries on both sides.',
    gexNetShort: 'Dealers are net short gamma at spot, which supports trend extension and larger directional swings.',
    flowBullish:
      'Vanna flow and charm decay are both adding a bullish tailwind as dealers rebalance delta across vol and time.',
    flowBearish:
      'Vanna flow and charm decay are both adding bearish pressure, so downside moves can snowball faster.',
    flowMixed: 'Vanna and charm are mixed, so directional follow-through is less trustworthy and fake-outs are more likely.',
    riskUnclear: 'Volatility regime is unclear; size risk conservatively.',
    riskElevated: 'Vol is elevated, so prioritize defined-risk structures and avoid oversized directional bets.',
    riskCalm:
      'Vol is relatively calm, which favors cleaner structure-driven entries but still requires trap awareness near walls.',
    riskMiddle: 'Vol is in a middle regime; stay selective and demand confirmation before pressing size.',
    crowdPutHeavy: 'Positioning is put-heavy, so failed downside can trigger sharp reflex squeezes.',
    crowdCallHeavy: 'Positioning is call-heavy, so upside failures can unwind quickly.',
    crowdBalanced: 'Positioning is fairly balanced, so wall behavior matters more than crowding extremes.',
    actionBearish:
      'Trading posture: bias toward momentum when structure confirms, but avoid chasing extended candles because reversals can be violent.',
    actionDefault:
      'Trading posture: favor disciplined entries near key levels, take profits faster on extensions, and be ready to fade obvious trap moves.',
    horizonIntraday:
      'Intraday lens: prioritize reaction at walls/flip and tighten risk quickly if tape fails to follow through.',
    horizonSwing:
      'Swing lens: focus on whether price can hold outside walls for multiple sessions before committing full size.',
  },
  it: {
    pageTitle: 'Analisi del Posizionamento dei Dealer',
    netGexTooltip:
      "Gamma cumulativo dei dealer al prezzo spot corrente — il valore della stessa curva cumulativa dal basso verso l'alto il cui incrocio con lo zero è il gamma flip, quindi è sempre coerente in segno con il flip. Positivo = i dealer sono net long gamma qui (pinning, mean-reversion); negativo = net short gamma qui (trend, amplificazione della volatilità). Il regime cambia al livello di gamma flip indicato sopra. (Non il totale sull'intera catena, che può avere segno opposto quando gli strike molto OTM dominano la coda.)",
    ivRankTooltip:
      "Rank di volatilità implicita derivato dal livello di {volIndex}. 0% = storicamente calmo, 100% = paura estrema. Mappa {volIndex} su una scala percentile 0-100.",
    vannaTooltip:
      "Esposizione netta alla vanna su tutti gli strike. Vanna positiva = il crush della volatilità favorisce il rialzo (tailwind). Vanna negativa = il crush della volatilità pressa al ribasso (headwind).",
    charmTooltip:
      "Charm netto (decadimento del delta nel tempo) su tutti gli strike. Mostra se il decadimento temporale sta sistematicamente aggiungendo o rimuovendo pressione direzionale sul delta.",
    metricsSnapshotTitle: 'Istantanea delle Metriche GEX',
    metricsSnapshotTooltip:
      'Filtra le scadenze e analizza net GEX, vanna, charm, OI e volume a livello di strike da /api/gex/by-strike.',
    noStrikeData: 'Nessun dato gamma a livello di strike disponibile',
    expirationsLabel: 'Scadenze:',
    allButton: 'Tutte',
    clearButton: 'Pulisci',
    clearButtonTitle: 'Deseleziona tutte le scadenze',
    noExpirationsSelected: 'Nessuna scadenza selezionata. Clicca su una scadenza o su "Tutte" per visualizzare i dati.',
    expandCardLabel: 'Espandi la card',
    locAboveCallWall:
      'Il prezzo spot è sopra il call wall, quindi la continuazione al rialzo può generare uno squeeze rapido, ma i breakout falliti possono rimbalzare bruscamente.',
    locBelowPutWall: 'Il prezzo spot è sotto il put wall, quindi il ribasso può accelerare rapidamente se il supporto continua a cedere.',
    locNearPutWall:
      'Il prezzo spot è appena sopra il put wall, dove i breakdown falliti spesso si invertono bruscamente e intrappolano gli short in ritardo.',
    locNearCallWall: 'Il prezzo spot si sta muovendo verso il call wall, dove i breakout possono correre se i compratori mantengono la pressione.',
    locIncomplete: 'Il posizionamento dei wall è incompleto, quindi considera la convinzione direzionale come più debole finché la struttura non è più chiara.',
    gexUnclear: 'Il gamma dei dealer al prezzo spot non è chiaro, quindi aspettati un comportamento di pinning meno affidabile.',
    gexDeepLong:
      "I dealer sono profondamente long gamma al prezzo spot, il che di solito comprime la volatilità e favorisce il fade/mean-reversion rispetto all'inseguimento aggressivo del trend.",
    gexNetLong: 'I dealer sono net long gamma al prezzo spot, quindi il prezzo è più propenso al mean-reversion che a sostenere movimenti fuori controllo.',
    gexDeepShort:
      "I dealer sono profondamente short gamma al prezzo spot, il che spesso amplifica la volatilità e può penalizzare gli ingressi tardivi su entrambi i lati.",
    gexNetShort: "I dealer sono net short gamma al prezzo spot, il che favorisce l'estensione del trend e oscillazioni direzionali più ampie.",
    flowBullish:
      'Il flusso di vanna e il decadimento di charm stanno entrambi aggiungendo un tailwind rialzista mentre i dealer riequilibrano il delta tra volatilità e tempo.',
    flowBearish:
      'Il flusso di vanna e il decadimento di charm stanno entrambi aggiungendo pressione ribassista, quindi i movimenti al ribasso possono amplificarsi più rapidamente.',
    flowMixed: 'Vanna e charm sono misti, quindi il follow-through direzionale è meno affidabile e i fake-out sono più probabili.',
    riskUnclear: 'Il regime di volatilità non è chiaro; dimensiona il rischio in modo conservativo.',
    riskElevated: 'La volatilità è elevata, quindi privilegia strutture a rischio definito ed evita scommesse direzionali sovradimensionate.',
    riskCalm:
      'La volatilità è relativamente calma, il che favorisce ingressi più puliti basati sulla struttura, ma richiede comunque attenzione alle trappole vicino ai wall.',
    riskMiddle: 'La volatilità è in un regime intermedio; resta selettivo e richiedi conferme prima di aumentare la size.',
    crowdPutHeavy: 'Il posizionamento è sbilanciato sui put, quindi un ribasso fallito può innescare squeeze reflessivi violenti.',
    crowdCallHeavy: 'Il posizionamento è sbilanciato sulle call, quindi i fallimenti al rialzo possono sciogliersi rapidamente.',
    crowdBalanced: 'Il posizionamento è piuttosto equilibrato, quindi il comportamento dei wall conta più degli estremi di affollamento.',
    actionBearish:
      'Postura di trading: privilegia il momentum quando la struttura conferma, ma evita di inseguire candele estese perché le inversioni possono essere violente.',
    actionDefault:
      'Postura di trading: privilegia ingressi disciplinati vicino ai livelli chiave, prendi profitto più rapidamente sulle estensioni e sii pronto a fare fade dei movimenti trappola evidenti.',
    horizonIntraday: 'Lente intraday: privilegia la reazione ai wall/flip e stringi rapidamente il rischio se il tape non segue.',
    horizonSwing: "Lente swing: valuta se il prezzo può mantenersi fuori dai wall per più sessioni prima di impegnare l'intera size.",
  },
  de: {
    pageTitle: 'Dealer-Positionierungsanalyse',
    netGexTooltip:
      'Kumuliertes Dealer-Gamma zum aktuellen Spot-Preis — der Wert derselben kumulativen Low-to-High-Kurve, deren Nulldurchgang der Gamma-Flip ist, daher stets vorzeichenkonsistent mit dem Flip. Positiv = Dealer sind hier net long gamma (Pinning, Mean-Reversion); negativ = net short gamma hier (Trending, Volatilitätsverstärkung). Das Regime wechselt am oben angegebenen Gamma-Flip-Niveau. (Nicht die Summe über die gesamte Kette, die ein entgegengesetztes Vorzeichen tragen kann, wenn weit OTM liegende Strikes den Tail dominieren.)',
    ivRankTooltip:
      'Implied-Volatility-Rank abgeleitet vom {volIndex}-Niveau. 0% = historisch ruhig, 100% = extreme Angst. Bildet {volIndex} auf eine Perzentilskala von 0-100 ab.',
    vannaTooltip:
      'Netto-Vanna-Exposure über alle Strikes. Positive Vanna = Vol-Crush unterstützt die Aufwärtsseite (Tailwind). Negative Vanna = Vol-Crush drückt die Abwärtsseite (Headwind).',
    charmTooltip:
      'Netto-Charm (Delta-Zerfall über die Zeit) über alle Strikes. Zeigt, ob der Zeitverfall systematisch gerichteten Delta-Druck hinzufügt oder entfernt.',
    metricsSnapshotTitle: 'GEX-Kennzahlen-Snapshot',
    metricsSnapshotTooltip:
      'Verfallstermine filtern und Net GEX, Vanna, Charm, OI und Volumen auf Strike-Ebene aus /api/gex/by-strike untersuchen.',
    noStrikeData: 'Keine Gamma-Daten auf Strike-Ebene verfügbar',
    expirationsLabel: 'Verfallstermine:',
    allButton: 'Alle',
    clearButton: 'Zurücksetzen',
    clearButtonTitle: 'Alle Verfallstermin-Auswahlen löschen',
    noExpirationsSelected: 'Keine Verfallstermine ausgewählt. Klicken Sie auf einen Verfallstermin oder auf „Alle", um Daten anzuzeigen.',
    expandCardLabel: 'Karte erweitern',
    locAboveCallWall:
      'Der Spot liegt über dem Call Wall, sodass eine Fortsetzung nach oben schnell einen Squeeze auslösen kann, gescheiterte Ausbrüche aber ebenso stark zurückschnappen können.',
    locBelowPutWall: 'Der Spot liegt unter dem Put Wall, sodass sich die Abwärtsbewegung schnell beschleunigen kann, wenn die Unterstützung weiter versagt.',
    locNearPutWall:
      'Der Spot liegt knapp über dem Put Wall, wo gescheiterte Breakdowns sich oft scharf umkehren und späte Shorts in die Falle locken.',
    locNearCallWall: 'Der Spot tendiert zum Call Wall, wo Ausbrüche laufen können, solange Käufer den Druck aufrechterhalten.',
    locIncomplete: 'Die Wall-Platzierung ist unvollständig, daher sollte die Richtungsüberzeugung als geringer eingeschätzt werden, bis die Struktur klarer ist.',
    gexUnclear: 'Das Dealer-Gamma am Spot ist unklar, daher ist mit weniger verlässlichem Pinning-Verhalten zu rechnen.',
    gexDeepLong:
      'Dealer sind am Spot stark long gamma, was Volatilität in der Regel dämpft und Fade/Mean-Reversion gegenüber aggressivem Trend-Following begünstigt.',
    gexNetLong: 'Dealer sind am Spot net long gamma, sodass der Preis eher zur Mean-Reversion tendiert als anhaltende, unkontrollierte Bewegungen zu tragen.',
    gexDeepShort:
      'Dealer sind am Spot stark short gamma, was Volatilität oft verstärkt und späte Einstiege auf beiden Seiten bestrafen kann.',
    gexNetShort: 'Dealer sind am Spot net short gamma, was Trendverlängerungen und größere gerichtete Ausschläge begünstigt.',
    flowBullish:
      'Vanna-Flow und Charm-Zerfall verstärken beide einen bullischen Tailwind, während Dealer Delta über Vol und Zeit umschichten.',
    flowBearish:
      'Vanna-Flow und Charm-Zerfall verstärken beide bärischen Druck, sodass sich Abwärtsbewegungen schneller selbst verstärken können.',
    flowMixed: 'Vanna und Charm sind gemischt, daher ist das gerichtete Follow-through weniger verlässlich und Fake-outs sind wahrscheinlicher.',
    riskUnclear: 'Das Volatilitätsregime ist unklar; Risiko konservativ dimensionieren.',
    riskElevated: 'Die Vol ist erhöht, daher sollten Strukturen mit definiertem Risiko priorisiert und übergroße gerichtete Wetten vermieden werden.',
    riskCalm:
      'Die Vol ist relativ ruhig, was saubere, strukturgetriebene Einstiege begünstigt, aber weiterhin Wachsamkeit vor Fallen nahe den Walls erfordert.',
    riskMiddle: 'Die Vol befindet sich in einem mittleren Regime; selektiv bleiben und Bestätigung verlangen, bevor die Positionsgröße erhöht wird.',
    crowdPutHeavy: 'Die Positionierung ist put-schwer, sodass ein gescheiterter Abwärtstrend scharfe Reflex-Squeezes auslösen kann.',
    crowdCallHeavy: 'Die Positionierung ist call-schwer, sodass Fehlschläge nach oben sich schnell auflösen können.',
    crowdBalanced: 'Die Positionierung ist relativ ausgeglichen, sodass das Wall-Verhalten wichtiger ist als Crowding-Extreme.',
    actionBearish:
      'Trading-Haltung: Momentum bevorzugen, wenn die Struktur bestätigt, aber keine ausgedehnten Kerzen verfolgen, da Umkehrungen heftig ausfallen können.',
    actionDefault:
      'Trading-Haltung: disziplinierte Einstiege nahe wichtiger Niveaus bevorzugen, Gewinne bei Extensionen schneller mitnehmen und bereit sein, offensichtliche Fallenbewegungen zu faden.',
    horizonIntraday: 'Intraday-Linse: Reaktion an Walls/Flip priorisieren und Risiko schnell straffen, wenn das Tape nicht folgt.',
    horizonSwing: 'Swing-Linse: fokussieren, ob der Preis über mehrere Sessions außerhalb der Walls bleiben kann, bevor die volle Positionsgröße eingesetzt wird.',
  },
  es: {
    pageTitle: 'Análisis de Posicionamiento de los Dealers',
    netGexTooltip:
      'Gamma acumulado de los dealers en el precio spot actual: el valor de la misma curva acumulativa de menor a mayor cuyo cruce por cero es el gamma flip, por lo que siempre es coherente en signo con el flip. Positivo = los dealers están net long gamma aquí (pinning, mean-reversion); negativo = net short gamma aquí (tendencia, amplificación de la volatilidad). El régimen cambia en el nivel de gamma flip indicado arriba. (No es el total de toda la cadena, que puede tener el signo opuesto cuando los strikes muy OTM dominan la cola.)',
    ivRankTooltip:
      'Rango de volatilidad implícita derivado del nivel de {volIndex}. 0% = históricamente calmado, 100% = miedo extremo. Mapea {volIndex} a una escala percentil de 0 a 100.',
    vannaTooltip:
      'Exposición neta a vanna en todos los strikes. Vanna positiva = el vol crush favorece el alza (tailwind). Vanna negativa = el vol crush presiona a la baja (headwind).',
    charmTooltip:
      'Charm neto (decaimiento del delta con el tiempo) en todos los strikes. Muestra si el decaimiento temporal está añadiendo o eliminando sistemáticamente presión direccional en el delta.',
    metricsSnapshotTitle: 'Instantánea de Métricas GEX',
    metricsSnapshotTooltip:
      'Filtra los vencimientos e inspecciona net GEX, vanna, charm, OI y volumen a nivel de strike desde /api/gex/by-strike.',
    noStrikeData: 'No hay datos de gamma a nivel de strike disponibles',
    expirationsLabel: 'Vencimientos:',
    allButton: 'Todos',
    clearButton: 'Limpiar',
    clearButtonTitle: 'Deseleccionar todos los vencimientos',
    noExpirationsSelected: 'No hay vencimientos seleccionados. Haz clic en un vencimiento o en "Todos" para mostrar los datos.',
    expandCardLabel: 'Expandir tarjeta',
    locAboveCallWall:
      'El spot está por encima del call wall, así que la continuación al alza puede generar un squeeze rápido, pero los breakouts fallidos pueden retroceder con fuerza.',
    locBelowPutWall: 'El spot está por debajo del put wall, así que la caída puede acelerarse rápidamente si el soporte sigue fallando.',
    locNearPutWall:
      'El spot está justo por encima del put wall, donde los breakdowns fallidos suelen revertirse con fuerza y atrapar a los shorts tardíos.',
    locNearCallWall: 'El spot se está inclinando hacia el call wall, donde los breakouts pueden correr si los compradores mantienen la presión.',
    locIncomplete: 'La ubicación de los walls está incompleta, así que trata la convicción direccional como menor hasta que la estructura sea más clara.',
    gexUnclear: 'El gamma de los dealers en el spot no está claro, así que espera un comportamiento de pinning menos fiable.',
    gexDeepLong:
      'Los dealers están profundamente long gamma en el spot, lo que suele suprimir la volatilidad y favorece el fade/mean-reversion frente a perseguir la tendencia de forma agresiva.',
    gexNetLong: 'Los dealers están net long gamma en el spot, así que es más probable que el precio revierta a la media en lugar de sostener movimientos descontrolados.',
    gexDeepShort:
      'Los dealers están profundamente short gamma en el spot, lo que a menudo amplifica la volatilidad y puede castigar las entradas tardías en ambos lados.',
    gexNetShort: 'Los dealers están net short gamma en el spot, lo que favorece la extensión de la tendencia y oscilaciones direccionales más amplias.',
    flowBullish:
      'El flujo de vanna y el decaimiento de charm están añadiendo un tailwind alcista mientras los dealers reequilibran el delta entre volatilidad y tiempo.',
    flowBearish:
      'El flujo de vanna y el decaimiento de charm están añadiendo presión bajista, así que los movimientos a la baja pueden acelerarse más rápido.',
    flowMixed: 'Vanna y charm son mixtos, así que el seguimiento direccional es menos fiable y los fake-outs son más probables.',
    riskUnclear: 'El régimen de volatilidad no está claro; dimensiona el riesgo de forma conservadora.',
    riskElevated: 'La vol está elevada, así que prioriza estructuras de riesgo definido y evita apuestas direccionales sobredimensionadas.',
    riskCalm:
      'La vol está relativamente calmada, lo que favorece entradas más limpias basadas en la estructura, pero aún requiere atención a las trampas cerca de los walls.',
    riskMiddle: 'La vol está en un régimen intermedio; mantente selectivo y exige confirmación antes de aumentar el tamaño de la posición.',
    crowdPutHeavy: 'El posicionamiento está cargado de puts, así que una caída fallida puede desencadenar squeezes reflejos violentos.',
    crowdCallHeavy: 'El posicionamiento está cargado de calls, así que los fallos al alza pueden deshacerse rápidamente.',
    crowdBalanced: 'El posicionamiento está bastante equilibrado, así que el comportamiento de los walls importa más que los extremos de crowding.',
    actionBearish:
      'Postura de trading: inclínate hacia el momentum cuando la estructura lo confirme, pero evita perseguir velas extendidas porque las reversiones pueden ser violentas.',
    actionDefault:
      'Postura de trading: favorece entradas disciplinadas cerca de niveles clave, toma beneficios más rápido en las extensiones y prepárate para hacer fade de movimientos trampa evidentes.',
    horizonIntraday: 'Lente intradía: prioriza la reacción en walls/flip y ajusta el riesgo rápidamente si el tape no sigue.',
    horizonSwing: 'Lente swing: enfócate en si el precio puede mantenerse fuera de los walls durante varias sesiones antes de comprometer el tamaño completo.',
  },
  fr: {
    pageTitle: 'Analyse du Positionnement des Dealers',
    netGexTooltip:
      "Gamma cumulé des dealers au prix spot actuel — la valeur de la même courbe cumulative du bas vers le haut dont le passage à zéro est le gamma flip, donc toujours cohérente en signe avec le flip. Positif = les dealers sont net long gamma ici (pinning, mean-reversion) ; négatif = net short gamma ici (tendance, amplification de la volatilité). Le régime bascule au niveau de gamma flip indiqué ci-dessus. (Pas le total sur l'ensemble de la chaîne, qui peut porter le signe opposé lorsque des strikes très OTM dominent la queue.)",
    ivRankTooltip:
      'Rang de volatilité implicite dérivé du niveau de {volIndex}. 0% = historiquement calme, 100% = peur extrême. Fait correspondre {volIndex} à une échelle de percentile de 0 à 100.',
    vannaTooltip:
      'Exposition nette au vanna sur tous les strikes. Vanna positif = le vol crush soutient la hausse (tailwind). Vanna négatif = le vol crush pèse sur la baisse (headwind).',
    charmTooltip:
      "Charm net (décroissance du delta dans le temps) sur tous les strikes. Indique si la décroissance temporelle ajoute ou retire systématiquement une pression directionnelle sur le delta.",
    metricsSnapshotTitle: 'Instantané des Métriques GEX',
    metricsSnapshotTooltip:
      "Filtrez les échéances et examinez le net GEX, le vanna, le charm, l'OI et le volume au niveau du strike depuis /api/gex/by-strike.",
    noStrikeData: 'Aucune donnée gamma au niveau du strike disponible',
    expirationsLabel: 'Échéances :',
    allButton: 'Toutes',
    clearButton: 'Effacer',
    clearButtonTitle: 'Désélectionner toutes les échéances',
    noExpirationsSelected: 'Aucune échéance sélectionnée. Cliquez sur une échéance ou sur « Toutes » pour afficher les données.',
    expandCardLabel: 'Agrandir la carte',
    locAboveCallWall:
      'Le spot est au-dessus du call wall, donc une continuation à la hausse peut déclencher un squeeze rapide, mais les breakouts ratés peuvent rebondir brutalement.',
    locBelowPutWall: "Le spot est en dessous du put wall, donc la baisse peut s'accélérer rapidement si le support continue de céder.",
    locNearPutWall:
      'Le spot est juste au-dessus du put wall, où les breakdowns ratés s\'inversent souvent brusquement et piègent les shorts tardifs.',
    locNearCallWall: 'Le spot penche vers le call wall, où les breakouts peuvent se poursuivre si les acheteurs maintiennent la pression.',
    locIncomplete: "Le positionnement des walls est incomplet, donc considérez la conviction directionnelle comme plus faible tant que la structure n'est pas plus claire.",
    gexUnclear: "Le gamma des dealers au spot n'est pas clair, attendez-vous donc à un comportement de pinning moins fiable.",
    gexDeepLong:
      'Les dealers sont profondément long gamma au spot, ce qui supprime généralement la volatilité et favorise le fade/mean-reversion plutôt que la poursuite agressive de la tendance.',
    gexNetLong: 'Les dealers sont net long gamma au spot, donc le prix est plus susceptible de revenir à la moyenne que de soutenir des mouvements incontrôlés.',
    gexDeepShort:
      'Les dealers sont profondément short gamma au spot, ce qui amplifie souvent la volatilité et peut pénaliser les entrées tardives des deux côtés.',
    gexNetShort: "Les dealers sont net short gamma au spot, ce qui favorise l'extension de la tendance et des oscillations directionnelles plus larges.",
    flowBullish:
      'Le flux de vanna et la décroissance de charm ajoutent tous deux un tailwind haussier tandis que les dealers rééquilibrent le delta entre volatilité et temps.',
    flowBearish:
      "Le flux de vanna et la décroissance de charm ajoutent tous deux une pression baissière, donc les mouvements à la baisse peuvent s'amplifier plus rapidement.",
    flowMixed: 'Vanna et charm sont mitigés, donc le suivi directionnel est moins fiable et les fake-outs sont plus probables.',
    riskUnclear: 'Le régime de volatilité n\'est pas clair ; dimensionnez le risque de manière conservatrice.',
    riskElevated: 'La vol est élevée, privilégiez donc des structures à risque défini et évitez les paris directionnels surdimensionnés.',
    riskCalm:
      'La vol est relativement calme, ce qui favorise des entrées plus propres basées sur la structure, mais nécessite tout de même de rester vigilant aux pièges près des walls.',
    riskMiddle: "La vol est dans un régime intermédiaire ; restez sélectif et exigez une confirmation avant d'augmenter la taille des positions.",
    crowdPutHeavy: 'Le positionnement est chargé en puts, donc une baisse ratée peut déclencher des squeezes réflexes violents.',
    crowdCallHeavy: 'Le positionnement est chargé en calls, donc les échecs à la hausse peuvent se dénouer rapidement.',
    crowdBalanced: 'Le positionnement est plutôt équilibré, donc le comportement des walls compte plus que les extrêmes de crowding.',
    actionBearish:
      'Posture de trading : privilégiez le momentum lorsque la structure confirme, mais évitez de poursuivre des bougies étendues car les inversions peuvent être violentes.',
    actionDefault:
      'Posture de trading : privilégiez des entrées disciplinées près des niveaux clés, prenez vos profits plus rapidement sur les extensions et soyez prêt à faire du fade sur les mouvements pièges évidents.',
    horizonIntraday: 'Lentille intraday : privilégiez la réaction aux walls/flip et resserrez rapidement le risque si le tape ne suit pas.',
    horizonSwing: "Lentille swing : concentrez-vous sur la capacité du prix à rester hors des walls pendant plusieurs séances avant d'engager la taille complète.",
  },
};
