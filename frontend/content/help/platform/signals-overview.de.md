# Wie Signals von Anfang bis Ende funktionieren

*Das vollständige Signal-Modell — Advanced vs. Basic, wie sich die Scores kombinieren, was die Cards zeigen und wie man das Ganze nutzt.*

---

## Die zwei Familien

ZeroGEX betreibt **zwei Familien** von Signals. Sie verhalten sich absichtlich unterschiedlich.

- **Advanced Signals** stellen eine scharfe, situationsbezogene Frage — *"pinnt sich der Schlusskurs gerade fest?"*, *"ist dieser Breakout gerade gescheitert?"*. Jedes erzeugt einen Score auf einer **[-1, +1]**-Linie **und** einen diskreten **Trigger**: Sobald der Score den Schwellenwert des Signals überschreitet, löst es einen Alert aus und kann ein Playbook freischalten. Sie sind event-driven.
- **Basic Signals** sind kontinuierlich. Sie lösen nicht aus — stattdessen fließen sie mit fester Gewichtung in den **MSI-Composite** ein und verschieben die kombinierte Lesart bei jedem Refresh nach oben oder unten. Man sieht sie als Input für das große Ganze, nicht als eigenständige Alerts.

Das ist die wichtigste Unterscheidung. Verinnerliche sie, bevor du einzelne Signal-Seiten liest.

## Die Score-Linie

Jedes ZeroGEX-Signal — Advanced oder Basic — lebt auf derselben Zahlenlinie: **[-1, +1]**.

- Das **Vorzeichen** gibt die Richtung an. Positiv ist bullisch, negativ ist bärisch. Manche Signals sind Mean-Reversion-Signals (ein positiver Score bedeutet dann "gegen die Aufwärtsbewegung faden"); diese tragen auf der Seite einen klaren "Trade-Bias"-Chip.
- Die **Magnitude** gibt die Überzeugungsstärke an. Je näher der Score an ±1 liegt, desto stärker ist die Lesart.
- **Ein Score von 0 ist so gut wie nie neutral.** Bei den meisten Signals bedeutet er, dass die Datenlage nicht ausreicht oder diese spezifische Frage im Moment keine Antwort hat. Lies eine 0 als "keine Aussage", nicht als "kein Trade".

Siehe [Die [-1, +1]-Score-Linie lesen](/help/platform/score-line) für die vollständige Vertiefung.

## Trigger (nur Advanced Signals)

Jedes Advanced Signal hat einen Trigger-Schwellenwert:

| Signal | Trigger-Schwellenwert |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

Wenn ein Signal-Trigger auslöst, passieren drei Dinge:

1. Die Signal-Card auf dem Dashboard leuchtet in der Richtung auf, in der sie ausgelöst hat.
2. Ein Eintrag erscheint im [Live Bulletin](/help/platform/live-bulletin).
3. Der Composite Score spiegelt die höhere Überzeugung wider.

## Der Composite (MSI)

Der Composite Score (Market Score Indicator, MSI) ist die **kombinierte Lesart über alle Signals hinweg**. Jedes Basic Signal trägt mit einer festen Gewichtung bei; Advanced Signals tragen bei, wenn ihr Trigger aktiv ist.

Der Composite liegt auf derselben [-1, +1]-Linie. Ein Composite-Wert über +0.4, bei dem mehrere Signals in dieselbe Richtung beitragen, ist eine Lesart mit hoher Konfluenz. Ein Composite, der nahe 0 schwankt, mit gemischten Beiträgen, ist bewusst "keine Aussage".

Siehe [Composite Score](/help/platform/composite-score) für die vollständige Aufschlüsselung.

## Anatomie einer Signal-Seite

Jede Signal-Seite bei ZeroGEX hat dieselbe Anatomie. Kennt man sie einmal, lässt sich jedes Signal schnell lesen.

1. **Titel + Score-Hero** — der Score, der Trigger-Status und der Zeitrahmen.
2. **Trade-Bias-Chip** — direktional, Mean-Reversion, Continuation, Regime-Switch.
3. **Sparkline-Panel** — der Score über das jüngste Zeitfenster.
4. **Input-Panel** — die zentralen Inputs, die den Score treiben (z. B. bei EOD Pressure: Dealer Charm, Pin Gravity, Realized Vol).
5. **"Wie es aufgebaut ist"** — allgemeinverständliche Erklärung der Mathematik dahinter.
6. **Letzte Trigger** — das Protokoll der jüngsten Auslösungen.

Die Reihenfolge ist über alle Seiten hinweg konsistent.

## Trade-Bias-Kategorien

Jedes Signal hat einen deklarierten Trade-Bias. Er steht auf der Card und auf der Signal-Seite.

- **Direktionale Lesart** — das Vorzeichen des Scores entspricht der erwarteten Preisrichtung.
- **Mean-Reversion (vs. Crowd)** — ein hoher positiver Score bedeutet "gegen die Aufwärtsbewegung faden"; handelt entgegen dem Positioning der Crowd.
- **Mean-Reversion (Long Gamma)** — fade die Ausdehnung Richtung Mittelwert, wenn Dealer long Gamma sind.
- **Continuation** — das Vorzeichen des Scores entspricht der Richtung des nächsten Legs.
- **Regime-/Playbook-Wechsel** — das Signal sagt dir, die Strategie zu wechseln, nicht einen Trade einzugehen.

Bringe den Trade-Bias mit deiner Strategie in Einklang. Ein Continuation-Signal ist kein Fade.

## Wie man die Signals nutzt

Drei Muster:

1. **Als Filter.** Geh keine Long-Trades ein, wenn der Composite bei -0.6 steht. Fade keine Rallyes bei negativem Gamma.
2. **Als Trigger.** Nutze den Trigger eines Advanced Signals als Einstiegssignal, mit deinem eigenen Stop und Ziel.
3. **Als Konfluenz.** Kombiniere zwei oder drei unabhängige Signals (eine Basic-Regime-Lesart + ein Advanced-Trigger + der Trade-Bias-Chip des Dashboards).

## Was Signals nicht leisten

- Sie geben dir keine Exits vor.
- Sie bemessen nicht die Größe deines Trades.
- Sie kennen deine Risikotoleranz nicht.

Nutze sie innerhalb eines regelbasierten Prozesses, nicht als eigenständige Trade-Tickets.

## Siehe auch

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) — die vollständige Referenzmatrix
