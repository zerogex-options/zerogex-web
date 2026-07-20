# Advanced Signal Dashboard

*Die event-getriebenen Signale — was jedes abfragt, wann jedes auslöst und wie man sie nutzt.*

---

## Was das Advanced Signal Dashboard ist

Das Advanced Signal Dashboard ist das **Trigger-Raster** für alle acht Advanced-Signale. Jede Karte zeigt den Score auf [-1, +1], den Trigger-Status (idle, hot, gerade ausgelöst) und eine Sparkline.

Advanced-Signale sind **event-getrieben**. Jedes erzeugt einen kontinuierlichen Score, aber der interessante Moment ist, wenn der Score die Trigger-Schwelle des Signals überschreitet.

## Die acht Signale

| Signal | Fragt | Trade-Bias | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | „Wird der Schlusskurs gepinnt?" | Direktional | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | „Stapeln sich hier wichtige Level?" | Mean-Rev (long gamma) / Continuation (short gamma) | abs(score) ≥ 0.20 |
| Market Pressure Index | „Ist der Markt bereit für eine Bewegung?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | „Steht dieser Range kurz vor dem Bruch?" | Regime-/Playbook-Wechsel | imminence ≥ 65 |
| Squeeze Setup | „Ist der Markt zusammengepresst?" | Continuation | abs(score) ≥ 0.25 |
| Trap Detection | „Ist dieser Breakout gerade gescheitert?" | Mean-Reversion (vs. Preisbruch) | abs(score) ≥ 0.25 |
| Volatility Expansion | „Steht die Volatilität kurz vor dem Ausbruch?" | Continuation | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | „Neigen 0DTE-Trader in eine Richtung?" | Direktional | abs(score) ≥ 0.25 |

## Kurzüberblick zu jedem Signal

### EOD Pressure

Aktiv in den letzten 90 Minuten. Baut sich ab 14:30 ET auf, mit Höhepunkt gegen 15:45 ET. Basiert auf Dealer-Charm am Spot, Pin Gravity, realisierter Volatilität und Witching-Flags. Liest „der Schluss wird auf X gepinnt" mit einer Richtung.

### Gamma/VWAP Confluence

Stapelt Gamma Flip, VWAP, Max Pain, den Max-Gamma-Strike und die Call Wall. Fragt, ob diese Level bei einem Preis übereinstimmen. Bei positivem Gamma sind Confluence-Signale Fade-Signale; bei negativem Gamma sind es Continuation-Signale.

### Market Pressure Index

Die Gesamtlesart „ist der Markt geladen". Kombiniert Wall Pinch, Flip-Nähe, Regime, Vanna/Charm, den DNI, den Skew zwischen Premium- und Smart-Money-Flow, den IV-Rank und die Kompression der realisierten Volatilität. Zweidimensional: ein **Loading von 0–100** und eine **Richtung von -1 bis +1**.

### Range Break Imminence

Kompressionslesart über 20 Bars. Skew-Delta + Dealer-Delta + Trap Pressure + Kompressionsverhältnis über 10/60 Bars. Liefert sowohl einen Score als auch eine Imminence von 0–100. Löst bei imminence ≥ 65 aus — das bedeutet, der Range ist im Verhältnis zu seiner jüngeren Historie tatsächlich eng.

### Squeeze Setup

Mehrtägiger Setup-Detektor. Flow-Z-Score, 5/10-Bar-Momentum, Gamma-Bereitschaft, Flip-Distanz, VIX-Regime. Continuation-Bias — liest „der Markt ist zusammengepresst, das nächste Bein ist X".

### Trap Detection

Der Detektor für gescheiterte Breakouts. Walls (aktuell + vorherig), VWAP, Flip, Net GEX und ΔGEX, Flow-Deltas. Mean-Reversion-Bias — löst aus, wenn ein Ausbruch über die Call Wall oder unter die Put Wall zurückschnappt.

### Volatility Expansion

5-Bar-Momentum-Fenster, skaliert nach realisierter Volatilität. Net GEX + vol-normalisierter Momentum-Z-Score + realisierte Volatilität. Fragt, ob die Volatilität kurz vor der Ausweitung steht. Continuation-Lesart.

### 0DTE Position Imbalance

Lesart über das 0DTE-Fenster. Gewichtet nach Stunden bis zum Handelsschluss. Call/Put-Flow-Ungleichgewicht, Smart-Money-C/P-Verhältnis, PCR, Moneyness-Buckets. Zeigt, in welche Richtung 0DTE-Trader heute tendieren.

## Wie Trigger funktionieren

Wenn ein Signal-Trigger auslöst:

1. Die Signalkarte im Dashboard leuchtet in Richtung des Scores auf.
2. Ein Eintrag erscheint im [Live Bulletin](/help/platform/live-bulletin) mit dem Score, der Trigger-Schwelle und einem einzeiligen Kontext.
3. Das Composite spiegelt die höhere Überzeugung wider.

Ein Signal kann über mehrere Bars im „hot"-Status bleiben. Der Bulletin-Eintrag zeigt die **erste** Trigger-Überschreitung; nachfolgende Bars im selben Hot-Status werden aggregiert.

## Das Dashboard lesen

Zwei Muster:

1. **Nach aktiven Triggern suchen.** Hot-Karten steigen im Standard-Layout nach oben.
2. **Nach gestapelten Triggern suchen.** Zwei oder mehr Advanced-Signale, die in dieselbe Richtung auslösen, sind die Lesart mit der höchsten Konfluenz auf der Plattform. Für die strukturelle Lesart das Composite hinzuziehen.

## Jede Karte hat eine Detailseite

Klicken Sie auf eine Karte, um die individuelle Signalseite mit Score-Sparkline, den Inputs, der Trigger-Historie und der „Wie es aufgebaut ist"-Erklärung zu öffnen.

## Wichtig: Der Trade-Bias zählt

Manche Advanced-Signale sind Continuation-, manche Mean-Reversion-Signale. Wenn Trap Detection positiv auslöst, bedeutet das **nicht** „long gehen" — es bedeutet „den gescheiterten Breakout nach unten faden". Prüfen Sie immer den Trade-Bias-Chip auf der Karte.

## Siehe auch

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
