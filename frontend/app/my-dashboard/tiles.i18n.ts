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
      'Modeled cumulative dealer gamma at the current spot, using the traditional call-positive / put-negative convention (actual dealer inventory is not observable from public option data). Positive tends to mean the modeled dealer book is net long gamma — hedging that can dampen moves (pinning, mean-reversion, lower vol). Negative tends to mean net short gamma — hedging that can amplify moves (trending, higher vol). The modeled regime changes sign at the gamma flip.',
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Price where aggregate net gamma changes sign. The card shows the live dollar and percent distance from the current underlying so you can judge whether spot is above or below the flip.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      'Estimated strike where option-holder payout is minimized at expiry. The card shows the live dollar and percent distance from the current underlying so you can gauge how far spot is from the options pin.',
    callGexTitle: 'Call GEX',
    callGexTooltip:
      'Modeled gamma exposure from call strikes (call-positive convention). Large call concentrations can influence price through dealer hedging, but whether a level acts as resistance, a magnet, or an acceleration point depends on the modeled dealer gamma sign and surrounding flow — it is not mechanically guaranteed.',
    putGexTitle: 'Put GEX',
    putGexTooltip:
      'Modeled gamma exposure from put strikes (put-negative convention). Large put concentrations can influence price through dealer hedging, but whether a level acts as support, a magnet, or an acceleration point depends on the modeled dealer gamma sign and surrounding flow — it is not mechanically guaranteed.',
    callWallTitle: 'Call Wall (Resistance)',
    callWallSubtitle: 'Heavy call open interest',
    callWallTooltip:
      'Strike with the heaviest call open interest — a ZeroGEX level. It can act as resistance when the modeled dealer book is net long gamma there (selling into rallies toward it), but the effect depends on the modeled gamma sign and flow and is not guaranteed.',
    putWallTitle: 'Put Wall (Support)',
    putWallSubtitle: 'Heavy put open interest',
    putWallTooltip:
      'Strike with the heaviest put open interest — a ZeroGEX level. It can act as support when the surrounding modeled book is net long gamma there, but a put concentration does not by itself guarantee support; the effect depends on the modeled gamma sign and flow.',
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
      "Gamma cumulativa dei dealer modellata al prezzo spot attuale, secondo la convenzione tradizionale call-positivo / put-negativo (l'effettivo inventario dei dealer non è osservabile dai dati pubblici sulle opzioni). Positivo tende a indicare che il book modellato dei dealer è net long gamma — un hedging che può attenuare i movimenti (pinning, ritorno alla media, volatilità più bassa). Negativo tende a indicare net short gamma — un hedging che può amplificare i movimenti (trend, volatilità più alta). Il regime modellato cambia segno al livello di gamma flip.",
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Prezzo in cui la gamma netta aggregata cambia segno. La scheda mostra la distanza in tempo reale, in dollari e percentuale, dal sottostante attuale, così puoi capire se lo spot è sopra o sotto il flip.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      "Strike stimato in cui il payout dei detentori di opzioni è minimizzato a scadenza. La scheda mostra la distanza in tempo reale, in dollari e percentuale, dal sottostante attuale, così puoi valutare quanto lo spot è distante dal pin delle opzioni.",
    callGexTitle: 'Call GEX',
    callGexTooltip:
      "Esposizione gamma modellata degli strike call (convenzione call-positivo). Grandi concentrazioni di call possono influenzare il prezzo tramite l'hedging dei dealer, ma se un livello agisca da resistenza, da magnete o da punto di accelerazione dipende dal segno della gamma modellata dei dealer e dal flusso circostante — non è garantito in modo meccanico.",
    putGexTitle: 'Put GEX',
    putGexTooltip:
      "Esposizione gamma modellata degli strike put (convenzione put-negativo). Grandi concentrazioni di put possono influenzare il prezzo tramite l'hedging dei dealer, ma se un livello agisca da supporto, da magnete o da punto di accelerazione dipende dal segno della gamma modellata dei dealer e dal flusso circostante — non è garantito in modo meccanico.",
    callWallTitle: 'Call Wall (Resistenza)',
    callWallSubtitle: 'Open interest call elevato',
    callWallTooltip:
      "Strike con l'open interest call più elevato — un livello ZeroGEX. Può agire da resistenza quando il book modellato dei dealer è net long gamma a quel livello (vendendo durante i rally verso di esso), ma l'effetto dipende dal segno della gamma modellata e dal flusso e non è garantito.",
    putWallTitle: 'Put Wall (Supporto)',
    putWallSubtitle: 'Open interest put elevato',
    putWallTooltip:
      "Strike con l'open interest put più elevato — un livello ZeroGEX. Può agire da supporto quando il book modellato circostante è net long gamma a quel livello, ma una concentrazione di put non garantisce di per sé il supporto; l'effetto dipende dal segno della gamma modellata e dal flusso.",
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
      'Modellierte kumulierte Dealer-Gamma zum aktuellen Spotpreis, nach der traditionellen Konvention call-positiv / put-negativ (das tatsächliche Dealer-Inventar ist aus öffentlichen Optionsdaten nicht beobachtbar). Positiv bedeutet tendenziell, dass das modellierte Dealer-Book netto long Gamma ist — Hedging, das Bewegungen dämpfen kann (Pinning, Mean-Reversion, niedrigere Volatilität). Negativ bedeutet tendenziell netto short Gamma — Hedging, das Bewegungen verstärken kann (Trending, höhere Volatilität). Das modellierte Regime wechselt am Gamma-Flip das Vorzeichen.',
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Preis, an dem das aggregierte Netto-Gamma das Vorzeichen wechselt. Die Karte zeigt den Live-Abstand in Dollar und Prozent zum aktuellen Basiswert, damit du beurteilen kannst, ob der Spot über oder unter dem Flip liegt.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      'Geschätzter Strike, an dem die Auszahlung der Optionsinhaber bei Verfall minimiert wird. Die Karte zeigt den Live-Abstand in Dollar und Prozent zum aktuellen Basiswert, damit du einschätzen kannst, wie weit der Spot vom Options-Pin entfernt ist.',
    callGexTitle: 'Call GEX',
    callGexTooltip:
      'Modellierte Gamma-Exposure aus Call-Strikes (Konvention call-positiv). Große Call-Konzentrationen können den Preis über das Dealer-Hedging beeinflussen, aber ob ein Niveau als Widerstand, als Magnet oder als Beschleunigungspunkt wirkt, hängt vom Vorzeichen der modellierten Dealer-Gamma und vom umgebenden Flow ab — es ist nicht mechanisch garantiert.',
    putGexTitle: 'Put GEX',
    putGexTooltip:
      'Modellierte Gamma-Exposure aus Put-Strikes (Konvention put-negativ). Große Put-Konzentrationen können den Preis über das Dealer-Hedging beeinflussen, aber ob ein Niveau als Unterstützung, als Magnet oder als Beschleunigungspunkt wirkt, hängt vom Vorzeichen der modellierten Dealer-Gamma und vom umgebenden Flow ab — es ist nicht mechanisch garantiert.',
    callWallTitle: 'Call Wall (Widerstand)',
    callWallSubtitle: 'Hohes Call-Open-Interest',
    callWallTooltip:
      'Strike mit dem höchsten Call-Open-Interest — ein ZeroGEX-Niveau. Kann als Widerstand wirken, wenn das modellierte Dealer-Book dort netto long Gamma ist (Verkäufe in Anstiege zu diesem Niveau hinein), aber der Effekt hängt vom Vorzeichen der modellierten Gamma und vom Flow ab und ist nicht garantiert.',
    putWallTitle: 'Put Wall (Unterstützung)',
    putWallSubtitle: 'Hohes Put-Open-Interest',
    putWallTooltip:
      'Strike mit dem höchsten Put-Open-Interest — ein ZeroGEX-Niveau. Kann als Unterstützung wirken, wenn das umgebende modellierte Book dort netto long Gamma ist, aber eine Put-Konzentration garantiert für sich genommen keine Unterstützung; der Effekt hängt vom Vorzeichen der modellierten Gamma und vom Flow ab.',
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
      'Gamma acumulada modelada de los dealers al precio spot actual, según la convención tradicional call-positivo / put-negativo (el inventario real de los dealers no es observable a partir de los datos públicos de opciones). Positivo tiende a significar que el book modelado de los dealers está net long gamma — cobertura que puede amortiguar los movimientos (pinning, reversión a la media, menor volatilidad). Negativo tiende a significar net short gamma — cobertura que puede amplificar los movimientos (tendencia, mayor volatilidad). El régimen modelado cambia de signo en el gamma flip.',
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      'Precio en el que la gamma neta agregada cambia de signo. La tarjeta muestra la distancia en tiempo real, en dólares y porcentaje, respecto al subyacente actual, para que puedas evaluar si el spot está por encima o por debajo del flip.',
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      'Strike estimado en el que el pago a los tenedores de opciones se minimiza al vencimiento. La tarjeta muestra la distancia en tiempo real, en dólares y porcentaje, respecto al subyacente actual, para que puedas evaluar cuán lejos está el spot del pin de opciones.',
    callGexTitle: 'Call GEX',
    callGexTooltip:
      'Exposición gamma modelada de los strikes call (convención call-positivo). Grandes concentraciones de calls pueden influir en el precio a través de la cobertura de los dealers, pero que un nivel actúe como resistencia, como imán o como punto de aceleración depende del signo de la gamma modelada de los dealers y del flujo circundante — no está garantizado de forma mecánica.',
    putGexTitle: 'Put GEX',
    putGexTooltip:
      'Exposición gamma modelada de los strikes put (convención put-negativo). Grandes concentraciones de puts pueden influir en el precio a través de la cobertura de los dealers, pero que un nivel actúe como soporte, como imán o como punto de aceleración depende del signo de la gamma modelada de los dealers y del flujo circundante — no está garantizado de forma mecánica.',
    callWallTitle: 'Call Wall (Resistencia)',
    callWallSubtitle: 'Interés abierto de calls elevado',
    callWallTooltip:
      'Strike con el mayor interés abierto de calls — un nivel ZeroGEX. Puede actuar como resistencia cuando el book modelado de los dealers está net long gamma en ese nivel (vendiendo durante los rallies hacia él), pero el efecto depende del signo de la gamma modelada y del flujo y no está garantizado.',
    putWallTitle: 'Put Wall (Soporte)',
    putWallSubtitle: 'Interés abierto de puts elevado',
    putWallTooltip:
      'Strike con el mayor interés abierto de puts — un nivel ZeroGEX. Puede actuar como soporte cuando el book modelado circundante está net long gamma en ese nivel, pero una concentración de puts no garantiza por sí misma el soporte; el efecto depende del signo de la gamma modelada y del flujo.',
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
      "Gamma cumulée modélisée des dealers au prix spot actuel, selon la convention traditionnelle call-positif / put-négatif (l'inventaire réel des dealers n'est pas observable à partir des données publiques sur les options). Positif tend à signifier que le book modélisé des dealers est net long gamma — un hedging qui peut atténuer les mouvements (pinning, retour à la moyenne, volatilité plus faible). Négatif tend à signifier net short gamma — un hedging qui peut amplifier les mouvements (tendance, volatilité plus élevée). Le régime modélisé change de signe au gamma flip.",
    gammaFlipTitle: 'Gamma Flip',
    gammaFlipTooltip:
      "Prix auquel la gamma nette agrégée change de signe. La carte affiche l'écart en direct, en dollars et en pourcentage, par rapport au sous-jacent actuel, pour évaluer si le spot est au-dessus ou en dessous du flip.",
    maxPainTitle: 'Max Pain',
    maxPainTooltip:
      "Strike estimé auquel le paiement aux détenteurs d'options est minimisé à l'échéance. La carte affiche l'écart en direct, en dollars et en pourcentage, par rapport au sous-jacent actuel, pour évaluer à quel point le spot est éloigné du pin des options.",
    callGexTitle: 'Call GEX',
    callGexTooltip:
      "Exposition gamma modélisée des strikes call (convention call-positif). De fortes concentrations de call peuvent influencer le prix via le hedging des dealers, mais qu'un niveau agisse comme résistance, comme aimant ou comme point d'accélération dépend du signe de la gamma modélisée des dealers et du flux environnant — ce n'est pas mécaniquement garanti.",
    putGexTitle: 'Put GEX',
    putGexTooltip:
      "Exposition gamma modélisée des strikes put (convention put-négatif). De fortes concentrations de put peuvent influencer le prix via le hedging des dealers, mais qu'un niveau agisse comme support, comme aimant ou comme point d'accélération dépend du signe de la gamma modélisée des dealers et du flux environnant — ce n'est pas mécaniquement garanti.",
    callWallTitle: 'Call Wall (Résistance)',
    callWallSubtitle: 'Fort open interest call',
    callWallTooltip:
      "Strike avec le plus fort open interest call — un niveau ZeroGEX. Peut agir comme résistance lorsque le book modélisé des dealers y est net long gamma (vente dans les rallyes vers ce niveau), mais l'effet dépend du signe de la gamma modélisée et du flux et n'est pas garanti.",
    putWallTitle: 'Put Wall (Support)',
    putWallSubtitle: 'Fort open interest put',
    putWallTooltip:
      "Strike avec le plus fort open interest put — un niveau ZeroGEX. Peut agir comme support lorsque le book modélisé environnant y est net long gamma, mais une concentration de put ne garantit pas à elle seule le support ; l'effet dépend du signe de la gamma modélisée et du flux.",
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
