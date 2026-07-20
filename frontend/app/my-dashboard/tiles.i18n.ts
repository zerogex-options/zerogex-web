import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    priceTitle: '{symbol} Price',
    priceFuturesLabel: '◆ {ticker} futures',
    priceAwaitingContext: 'Awaiting previous-close context',
    priceDayVol: 'Day Vol: {volume}',
    priceTooltip: 'Current {symbol} price from the real-time quote feed.',
    netGexTitle: 'Net GEX',
    netGexTooltip:
      'Cumulative dealer gamma at the current spot price. Positive = dealers net long gamma (hedging dampens moves — pinning, mean-reversion, lower vol). Negative = dealers net short gamma (hedging amplifies moves — trending, higher vol). The regime flips at the gamma flip level.',
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Price where aggregate net gamma changes sign. The card shows the live dollar and percent distance from the current underlying so you can judge whether spot is above or below the flip.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      'Estimated strike where option-holder payout is minimized at expiry. The card shows the live dollar and percent distance from the current underlying so you can gauge how far spot is from the options pin.',
    callGexTitle: 'Call GEX',
    callGexTooltip:
      'Total gamma exposure from call options. Higher values indicate strong call positioning, which creates upside resistance as dealers hedge by selling into rallies.',
    putGexTitle: 'Put GEX',
    putGexTooltip:
      'Total gamma exposure from put options. Higher values indicate strong put positioning, which creates downside support as dealers hedge by buying into selloffs.',
    callWallTitle: 'Call Wall (Resistance)',
    callWallSubtitle: 'Heavy call open interest',
    callWallTooltip:
      'Strike with the heaviest call open interest. Tends to act as resistance as dealers sell into rallies toward it.',
    putWallTitle: 'Put Wall (Support)',
    putWallSubtitle: 'Heavy put open interest',
    putWallTooltip:
      'Strike with the heaviest put open interest. Tends to act as support as dealers buy into selloffs toward it.',
    netFlowTitle: 'Net Flow',
    netFlowSubtitle: 'contracts',
    netFlowTooltip: 'Cumulative call volume minus put volume for the current session.',
    netPremiumTitle: 'Net Premium',
    netPremiumTooltip: 'Cumulative call premium minus put premium for the current session.',
    putCallRatioTitle: 'Put/Call Ratio',
    putCallRatioTooltip: 'Cumulative put volume divided by cumulative call volume for the current session.',
    vixTitle: '{volIndex} Level',
    vixSubtitleFallback: 'Implied volatility',
    vixTooltip:
      "{volIndex} implied-volatility index — the market's expected 30-day volatility. Rising {volIndex} signals fear / demand for protection; falling signals calm.",
  },
  it: {
    priceTitle: 'Prezzo {symbol}',
    priceFuturesLabel: '◆ futures {ticker}',
    priceAwaitingContext: 'In attesa del contesto di chiusura precedente',
    priceDayVol: 'Volume giornaliero: {volume}',
    priceTooltip: 'Prezzo attuale di {symbol} dal feed quotazioni in tempo reale.',
    netGexTitle: 'Net GEX',
    netGexTooltip:
      "Gamma cumulativa dei dealer al prezzo spot attuale. Positivo = i dealer sono net long gamma (l'hedging attenua i movimenti — pinning, ritorno alla media, volatilità più bassa). Negativo = i dealer sono net short gamma (l'hedging amplifica i movimenti — trend, volatilità più alta). Il regime si inverte al livello di gamma flip.",
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Prezzo in cui la gamma netta aggregata cambia segno. La scheda mostra la distanza in tempo reale, in dollari e percentuale, dal sottostante attuale, così puoi capire se lo spot è sopra o sotto il flip.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      "Strike stimato in cui il payout dei detentori di opzioni è minimizzato a scadenza. La scheda mostra la distanza in tempo reale, in dollari e percentuale, dal sottostante attuale, così puoi valutare quanto lo spot è distante dal pin delle opzioni.",
    callGexTitle: 'Call GEX',
    callGexTooltip:
      'Esposizione gamma totale delle opzioni call. Valori più alti indicano un posizionamento call forte, che crea resistenza al rialzo mentre i dealer si coprono vendendo durante i rally.',
    putGexTitle: 'Put GEX',
    putGexTooltip:
      'Esposizione gamma totale delle opzioni put. Valori più alti indicano un posizionamento put forte, che crea supporto al ribasso mentre i dealer si coprono comprando durante i selloff.',
    callWallTitle: 'Call Wall (Resistenza)',
    callWallSubtitle: 'Open interest call elevato',
    callWallTooltip:
      "Strike con l'open interest call più elevato. Tende ad agire da resistenza mentre i dealer vendono durante i rally verso di esso.",
    putWallTitle: 'Put Wall (Supporto)',
    putWallSubtitle: 'Open interest put elevato',
    putWallTooltip:
      "Strike con l'open interest put più elevato. Tende ad agire da supporto mentre i dealer comprano durante i selloff verso di esso.",
    netFlowTitle: 'Flusso Netto',
    netFlowSubtitle: 'contratti',
    netFlowTooltip: 'Volume call cumulativo meno volume put per la sessione corrente.',
    netPremiumTitle: 'Premio Netto',
    netPremiumTooltip: 'Premio call cumulativo meno premio put per la sessione corrente.',
    putCallRatioTitle: 'Rapporto Put/Call',
    putCallRatioTooltip: 'Volume put cumulativo diviso per il volume call cumulativo nella sessione corrente.',
    vixTitle: 'Livello {volIndex}',
    vixSubtitleFallback: 'Volatilità implicita',
    vixTooltip:
      "Indice di volatilità implicita {volIndex} — la volatilità attesa a 30 giorni dal mercato. Un {volIndex} in aumento segnala paura / domanda di protezione; in calo segnala calma.",
  },
  de: {
    priceTitle: '{symbol}-Preis',
    priceFuturesLabel: '◆ {ticker}-Futures',
    priceAwaitingContext: 'Warten auf Kontext zum vorherigen Schlusskurs',
    priceDayVol: 'Tagesvolumen: {volume}',
    priceTooltip: 'Aktueller {symbol}-Preis aus dem Echtzeit-Kursfeed.',
    netGexTitle: 'Net GEX',
    netGexTooltip:
      'Kumulierte Dealer-Gamma zum aktuellen Spotpreis. Positiv = Dealer sind netto long Gamma (Hedging dämpft Bewegungen — Pinning, Mean-Reversion, niedrigere Volatilität). Negativ = Dealer sind netto short Gamma (Hedging verstärkt Bewegungen — Trending, höhere Volatilität). Das Regime kippt am Gamma-Flip-Niveau.',
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Preis, an dem das aggregierte Netto-Gamma das Vorzeichen wechselt. Die Karte zeigt den Live-Abstand in Dollar und Prozent zum aktuellen Basiswert, damit du beurteilen kannst, ob der Spot über oder unter dem Flip liegt.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      'Geschätzter Strike, an dem die Auszahlung der Optionsinhaber bei Verfall minimiert wird. Die Karte zeigt den Live-Abstand in Dollar und Prozent zum aktuellen Basiswert, damit du einschätzen kannst, wie weit der Spot vom Options-Pin entfernt ist.',
    callGexTitle: 'Call GEX',
    callGexTooltip:
      'Gesamte Gamma-Exposure aus Call-Optionen. Höhere Werte deuten auf starke Call-Positionierung hin, die durch das Hedging der Dealer beim Verkauf in Rallyes Aufwärtswiderstand schafft.',
    putGexTitle: 'Put GEX',
    putGexTooltip:
      'Gesamte Gamma-Exposure aus Put-Optionen. Höhere Werte deuten auf starke Put-Positionierung hin, die durch das Hedging der Dealer beim Kauf in Ausverkäufen Abwärtsunterstützung schafft.',
    callWallTitle: 'Call Wall (Widerstand)',
    callWallSubtitle: 'Hohes Call-Open-Interest',
    callWallTooltip:
      'Strike mit dem höchsten Call-Open-Interest. Wirkt tendenziell als Widerstand, da Dealer beim Anstieg in Richtung dieses Niveaus verkaufen.',
    putWallTitle: 'Put Wall (Unterstützung)',
    putWallSubtitle: 'Hohes Put-Open-Interest',
    putWallTooltip:
      'Strike mit dem höchsten Put-Open-Interest. Wirkt tendenziell als Unterstützung, da Dealer beim Rückgang in Richtung dieses Niveaus kaufen.',
    netFlowTitle: 'Net Flow',
    netFlowSubtitle: 'Kontrakte',
    netFlowTooltip: 'Kumuliertes Call-Volumen minus Put-Volumen für die aktuelle Sitzung.',
    netPremiumTitle: 'Netto-Prämie',
    netPremiumTooltip: 'Kumulierte Call-Prämie minus Put-Prämie für die aktuelle Sitzung.',
    putCallRatioTitle: 'Put/Call-Verhältnis',
    putCallRatioTooltip: 'Kumuliertes Put-Volumen geteilt durch kumuliertes Call-Volumen für die aktuelle Sitzung.',
    vixTitle: '{volIndex}-Niveau',
    vixSubtitleFallback: 'Implizite Volatilität',
    vixTooltip:
      '{volIndex}-Index für implizite Volatilität — die vom Markt erwartete 30-Tage-Volatilität. Ein steigender {volIndex} signalisiert Angst / Nachfrage nach Absicherung; ein fallender signalisiert Ruhe.',
  },
  es: {
    priceTitle: 'Precio de {symbol}',
    priceFuturesLabel: '◆ futuros de {ticker}',
    priceAwaitingContext: 'Esperando contexto del cierre anterior',
    priceDayVol: 'Volumen diario: {volume}',
    priceTooltip: 'Precio actual de {symbol} del feed de cotizaciones en tiempo real.',
    netGexTitle: 'Net GEX',
    netGexTooltip:
      'Gamma acumulada de los dealers al precio spot actual. Positivo = los dealers están net long gamma (la cobertura amortigua los movimientos — pinning, reversión a la media, menor volatilidad). Negativo = los dealers están net short gamma (la cobertura amplifica los movimientos — tendencia, mayor volatilidad). El régimen cambia en el nivel de gamma flip.',
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Precio en el que la gamma neta agregada cambia de signo. La tarjeta muestra la distancia en tiempo real, en dólares y porcentaje, respecto al subyacente actual, para que puedas evaluar si el spot está por encima o por debajo del flip.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      'Strike estimado en el que el pago a los tenedores de opciones se minimiza al vencimiento. La tarjeta muestra la distancia en tiempo real, en dólares y porcentaje, respecto al subyacente actual, para que puedas evaluar cuán lejos está el spot del pin de opciones.',
    callGexTitle: 'Call GEX',
    callGexTooltip:
      'Exposición gamma total de las opciones call. Valores más altos indican un posicionamiento call fuerte, que crea resistencia al alza mientras los dealers se cubren vendiendo durante los rallies.',
    putGexTitle: 'Put GEX',
    putGexTooltip:
      'Exposición gamma total de las opciones put. Valores más altos indican un posicionamiento put fuerte, que crea soporte a la baja mientras los dealers se cubren comprando durante las caídas.',
    callWallTitle: 'Call Wall (Resistencia)',
    callWallSubtitle: 'Interés abierto de calls elevado',
    callWallTooltip:
      'Strike con el mayor interés abierto de calls. Tiende a actuar como resistencia mientras los dealers venden durante los rallies hacia él.',
    putWallTitle: 'Put Wall (Soporte)',
    putWallSubtitle: 'Interés abierto de puts elevado',
    putWallTooltip:
      'Strike con el mayor interés abierto de puts. Tiende a actuar como soporte mientras los dealers compran durante las caídas hacia él.',
    netFlowTitle: 'Flujo Neto',
    netFlowSubtitle: 'contratos',
    netFlowTooltip: 'Volumen de calls acumulado menos volumen de puts para la sesión actual.',
    netPremiumTitle: 'Prima Neta',
    netPremiumTooltip: 'Prima de calls acumulada menos prima de puts para la sesión actual.',
    putCallRatioTitle: 'Ratio Put/Call',
    putCallRatioTooltip: 'Volumen de puts acumulado dividido entre el volumen de calls acumulado en la sesión actual.',
    vixTitle: 'Nivel de {volIndex}',
    vixSubtitleFallback: 'Volatilidad implícita',
    vixTooltip:
      'Índice de volatilidad implícita {volIndex} — la volatilidad esperada a 30 días por el mercado. Un {volIndex} en aumento indica miedo / demanda de protección; en descenso indica calma.',
  },
  fr: {
    priceTitle: 'Prix {symbol}',
    priceFuturesLabel: '◆ futures {ticker}',
    priceAwaitingContext: 'En attente du contexte de clôture précédente',
    priceDayVol: 'Volume du jour : {volume}',
    priceTooltip: 'Prix actuel de {symbol} issu du flux de cotation en temps réel.',
    netGexTitle: 'Net GEX',
    netGexTooltip:
      "Gamma cumulée des dealers au prix spot actuel. Positif = les dealers sont net long gamma (le hedging atténue les mouvements — pinning, retour à la moyenne, volatilité plus faible). Négatif = les dealers sont net short gamma (le hedging amplifie les mouvements — tendance, volatilité plus élevée). Le régime bascule au niveau du gamma flip.",
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      "Prix auquel la gamma nette agrégée change de signe. La carte affiche l'écart en direct, en dollars et en pourcentage, par rapport au sous-jacent actuel, pour évaluer si le spot est au-dessus ou en dessous du flip.",
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      "Strike estimé auquel le paiement aux détenteurs d'options est minimisé à l'échéance. La carte affiche l'écart en direct, en dollars et en pourcentage, par rapport au sous-jacent actuel, pour évaluer à quel point le spot est éloigné du pin des options.",
    callGexTitle: 'Call GEX',
    callGexTooltip:
      "Exposition gamma totale des options call. Des valeurs plus élevées indiquent un positionnement call fort, ce qui crée une résistance à la hausse lorsque les dealers se couvrent en vendant lors des rallyes.",
    putGexTitle: 'Put GEX',
    putGexTooltip:
      "Exposition gamma totale des options put. Des valeurs plus élevées indiquent un positionnement put fort, ce qui crée un soutien à la baisse lorsque les dealers se couvrent en achetant lors des replis.",
    callWallTitle: 'Call Wall (Résistance)',
    callWallSubtitle: 'Fort open interest call',
    callWallTooltip:
      "Strike avec le plus fort open interest call. Tend à agir comme résistance lorsque les dealers vendent lors des rallyes vers ce niveau.",
    putWallTitle: 'Put Wall (Support)',
    putWallSubtitle: 'Fort open interest put',
    putWallTooltip:
      "Strike avec le plus fort open interest put. Tend à agir comme support lorsque les dealers achètent lors des replis vers ce niveau.",
    netFlowTitle: 'Flux Net',
    netFlowSubtitle: 'contrats',
    netFlowTooltip: 'Volume call cumulé moins volume put pour la session en cours.',
    netPremiumTitle: 'Prime Nette',
    netPremiumTooltip: 'Prime call cumulée moins prime put pour la session en cours.',
    putCallRatioTitle: 'Ratio Put/Call',
    putCallRatioTooltip: 'Volume put cumulé divisé par le volume call cumulé pour la session en cours.',
    vixTitle: 'Niveau {volIndex}',
    vixSubtitleFallback: 'Volatilité implicite',
    vixTooltip:
      "Indice de volatilité implicite {volIndex} — la volatilité attendue à 30 jours par le marché. Une hausse du {volIndex} signale la peur / la demande de protection ; une baisse signale le calme.",
  },
};
