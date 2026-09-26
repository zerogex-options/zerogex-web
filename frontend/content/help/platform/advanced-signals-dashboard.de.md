# Advanced Signal Dashboard

*Die event-getriebenen Signale - was jedes abfragt, wann jedes auslöst und wie man sie nutzt.*

---

## Was das Advanced Signal Dashboard ist

Das Advanced Signal Dashboard (Pro) ist das **Trigger-Raster** für alle acht Advanced-Signale. Eine Leiste oben zeigt alle acht Scores. Darunter liegen drei Tabs - **Signal Grid**, **Confluence Matrix** und **Event Timelines**. Jede Karte im Raster zeigt den Score auf -100 bis +100, die Schwelle, ab der sie aktiviert, einen Status *Triggered* oder *Stand by*, eine Sparkline und ausklappbare **Context values**. EOD Pressure und 0DTE Position Imbalance zeigen *Inactive*, solange ihr Zeitfenster geschlossen ist.

Advanced-Signale sind **event-getrieben**. Jedes erzeugt einen kontinuierlichen, modellierten Score - eine abgeleitete Lesart, keine garantierte Prognose -, aber der interessante Moment ist, wenn der Score die Trigger-Schwelle des Signals überschreitet. Keines der acht ist Teil des Composite Score (MSI).

## Die acht Signale

| Signal | Fragt | Trade-Bias | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | „Wird der Schlusskurs gepinnt?" | Direktional | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | „Stapeln sich hier wichtige Level?" | Mean-Rev (long gamma) / Continuation (short gamma) | \|score\| ≥ 20 |
| Market Pressure Index | „Ist der Markt bereit für eine Bewegung?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | „Steht dieser Range kurz vor dem Bruch?" | Regime-/Playbook-Wechsel | imminence ≥ 65 |
| Squeeze Setup | „Ist der Markt zusammengepresst?" | Continuation | \|score\| ≥ 25 |
| Trap Detection | „Ist dieser Breakout gerade gescheitert?" | Mean-Reversion (vs. Preisbruch) | \|score\| ≥ 25 |
| Volatility Expansion | „Steht die Volatilität kurz vor dem Ausbruch?" | Continuation | \|score\| ≥ 25 |
| 0DTE Position Imbalance | „Neigen 0DTE-Trader in eine Richtung?" | Direktional | \|score\| ≥ 25 |

## Kurzüberblick zu jedem Signal

### EOD Pressure

Aktiv in den letzten 90 Minuten. Baut sich ab 14:30 ET auf, mit Höhepunkt gegen 15:45 ET. Basiert auf Dealer-Charm am Spot, Pin Gravity, realisierter Volatilität und Witching-Flags. Liest „der Schluss *könnte* auf X gepinnt werden" mit einer Richtung - eine modellierte Tendenz, denn Pinning ist eine Wahrscheinlichkeitsfrage.

### Gamma/VWAP Confluence

Stapelt Gamma Flip, VWAP, Max Pain, den Max-Gamma-Strike und die Call Wall. Fragt, ob diese Level bei einem Preis übereinstimmen. Bei positivem Gamma sind Confluence-Signale Fade-Signale; bei negativem Gamma sind es Continuation-Signale.

### Market Pressure Index

Die Gesamtlesart „ist der Markt geladen". Kombiniert Wall Pinch, Flip-Nähe, Regime, Vanna/Charm, den DNI, den Skew zwischen Premium- und Smart-Money-Flow, den IV-Rank und die Kompression der realisierten Volatilität. Zweidimensional: ein **Loading von 0-100** und eine **Richtung von -1 bis +1**.

### Range Break Imminence

Kompressionslesart über 20 Bars. Skew-Delta + Dealer-Delta + Trap Pressure + Kompressionsverhältnis über 10/60 Bars. Liefert sowohl einen Score als auch eine Imminence von 0-100. Löst bei imminence ≥ 65 aus - dem Beginn des Bands Break Watch (ab 80 folgt Breakout Mode), ab dem die Seite rät, die Range nicht mehr blind zu faden.

### Squeeze Setup

Mehrtägiger Setup-Detektor. Flow-Z-Score, 5/10-Bar-Momentum, Gamma-Bereitschaft, Flip-Distanz, VIX-Regime. Continuation-Bias - eine abgeleitete Lesart, dass der Markt *möglicherweise* in Richtung X zusammengepresst ist, kein garantiertes nächstes Bein.

### Trap Detection

Der Detektor für gescheiterte Breakouts. Walls (aktuell + vorherig), VWAP, Flip, Net GEX und ΔGEX, Flow-Deltas. Mean-Reversion-Bias - markiert einen Bruch durch ein Schlüssellevel (eine Wall, VWAP, den Gamma Flip oder den Max-Gamma-Strike) als wahrscheinlich scheiternd, wenn die Dealer als long Gamma modelliert sind und das Gamma zunimmt; eine Wall, die mit dem Ausbruch wandert, schwächt die Lesart ab. In negativem Gamma bleibt es bei 0.

### Volatility Expansion

5-Bar-Momentum-Fenster, skaliert nach realisierter Volatilität. Net GEX + vol-normalisierter Momentum-Z-Score + realisierte Volatilität. Fragt, ob die Volatilität kurz vor der Ausweitung steht. Continuation-Lesart.

### 0DTE Position Imbalance

Lesart über das 0DTE-Fenster. Gewichtet nach Stunden bis zum Handelsschluss. Call/Put-Flow-Ungleichgewicht, Smart-Money-C/P-Verhältnis, PCR, Moneyness-Buckets. Zeigt, in welche Richtung 0DTE-Trader heute tendieren.

## Wie Trigger funktionieren

Wenn der Trigger eines Signals auslöst:

1. Seine Karte wird umrandet und in Richtung des Scores eingefärbt, und ihr Status wechselt von *Stand by* zu *Triggered*.
2. Der Composite Score ändert sich nicht - Advanced-Signale sind nicht Teil des MSI.

Es gibt keinen Alarm und keinen Protokolleintrag: Dir wird nichts zugestellt, und im Live-Bulletin landet nichts. Eine Karte bleibt *Triggered*, solange der Score jenseits ihrer Schwelle bleibt. Um zu sehen, was vorher passiert ist, öffne den Tab **Event Timelines** oder die Seite des Signals - die Timeline zeigt den Score über die letzten zwei Sessions mit markierten Richtungswechseln.

## Das Dashboard lesen

Zwei Muster:

1. **Nach aktiven Triggern suchen.** Ausgelöste Karten sind im Raster umrandet und eingefärbt. Die Karten behalten eine feste Reihenfolge, also achte auf die Farbe.
2. **Nach gestapelten Triggern suchen.** Zwei oder mehr Advanced-Signale, die in dieselbe Richtung auslösen, sind die Lesart mit der höchsten Konfluenz auf der Plattform. Der Tab **Confluence Matrix** zeigt, welche Paare tendenziell übereinstimmen. Für die strukturelle Lesart das Composite hinzuziehen.

## Jede Karte hat eine Detailseite

Klicken Sie auf eine Karte, um die individuelle Signalseite mit dem Score und seiner Historie, den Inputs, der Erklärung „How it's built" und der Event Timeline zu öffnen.

## Wichtig: Der Trade-Bias zählt

Manche Advanced-Signale sind Continuation-, manche Mean-Reversion-Signale. Trap Detection fadet einen *gescheiterten Preisbruch*, keinen Breakout: Ein **positiver** Score bedeutet, dass ein Abwärtsbruch gescheitert ist (der Fade geht nach oben - den gescheiterten Breakdown kaufen), ein **negativer** Score, dass ein Aufwärtsbruch gescheitert ist (der Fade geht nach unten) - das Spiegelbild eines Continuation-Signals wie Squeeze Setup. Prüfen Sie immer, welche Art von Signal Sie lesen - [Signals: Explained](/guides/signals-explained) listet den Trade-Bias jedes Signals auf.

## Siehe auch

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
