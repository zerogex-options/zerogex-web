# Wie Signals von Anfang bis Ende funktionieren

*Das vollständige Signal-Modell - Advanced vs. Basic, wie sie mit dem Composite Score und dem Trade Bias zusammenhängen, was die Cards zeigen und wie man das Ganze nutzt.*

---

## Die zwei Familien

ZeroGEX betreibt **zwei Familien** von Signals. Sie verhalten sich absichtlich unterschiedlich.

- **Advanced Signals** (Pro) stellen eine scharfe, situationsbezogene Frage - *"pinnt sich der Schlusskurs gerade fest?"*, *"ist dieser Breakout gerade gescheitert?"*. Jedes erzeugt einen Score auf einer Linie von **-100 bis +100** **und** einen diskreten **Trigger**: Sobald der Score den Schwellenwert des Signals überschreitet, springt seine Card von *Stand by* auf *Triggered*, und der Trigger kann ein Playbook freischalten. Sie sind event-driven.
- **Basic Signals** (Basic und Pro) sind kontinuierlich. Sie lösen nicht aus und haben **kein Gewicht im Composite Score (MSI)** - es sind beratende Lesarten, die neben ihm stehen. Ihr Wert liegt in Übereinstimmung (Überzeugung) oder Abweichung (Divergenz): Wenn die Flow-Lesarten von den Struktur-Lesarten abweichen, ist oft schon ein Regimewechsel im Gang, bevor sich der MSI bewegt.

Das ist die wichtigste Unterscheidung. Verinnerliche sie, bevor du einzelne Signal-Seiten liest.

## Die Score-Linie

Jedes ZeroGEX-Signal - Advanced oder Basic - lebt auf derselben Zahlenlinie: **-100 bis +100**.

- Das **Vorzeichen** gibt die Richtung an. Bei den meisten Signals ist positiv bullisch und negativ bärisch - manche sind aber Mean-Reversion-Signals oder anderweitig vorzeichen-invertiert, sodass ein positiver Score nicht immer "geh long" bedeutet. Prüfe den Trade-Bias des Signals (siehe unten), bevor du sein Vorzeichen liest.
- Die **Magnitude** gibt die Überzeugungsstärke an. Je näher der Score an ±100 liegt, desto stärker ist die Lesart.
- **Ein Score von 0 ist so gut wie nie neutral.** Bei den meisten Signals bedeutet er, dass die Datenlage nicht ausreicht oder diese spezifische Frage im Moment keine Antwort hat. Lies eine 0 als "keine Aussage", nicht als "kein Trade".

Siehe [Die Score-Linie von -100 bis +100 lesen](/help/platform/score-line) für die vollständige Vertiefung.

## Trigger (nur Advanced Signals)

Jedes Advanced Signal hat einen Trigger-Schwellenwert:

| Signal | Trigger-Schwellenwert |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Wenn der Trigger eines Signals auslöst:

1. Seine Card im Advanced Signal Dashboard wird umrandet und in der Richtung eingefärbt, in der sie ausgelöst hat, und ihr Status wechselt von *Stand by* zu *Triggered*.
2. Der Composite Score bewegt sich **nicht** - Advanced Signals sind nicht Teil des MSI.

Dir wird nichts zugestellt, und im Live-Bulletin erscheint nichts. Um nachzusehen, was ein Signal getan hat, nutze seine Event Timeline - siehe [Signalalarme](/help/platform/alerts).

## Der Composite (MSI)

Der Composite Score (Market State Index, MSI) ist eine eigene Lesart, gebaut aus **sechs Komponenten der Optionsstruktur**: Net-GEX-Vorzeichen, Gamma Anchor, Put/Call Ratio, Volatilitätsregime, Smart-Money-Order-Flow-Ungleichgewicht und Dealer Delta Pressure. Die Basic und Advanced Signals gehören nicht zu seinen Inputs.

Der Composite ist ein 0-100-Regime-Score, wobei 50 neutral ist - kein Punkt auf der Linie von -100 bis +100. Ein hoher Wert (≥ 70) bedeutet ein Trend-/Expansions-Regime, in dem Trends laufen können; ein niedriger Wert (< 20) ist das Compression-Band, in dem sich der Kurs historisch am wenigsten weit bewegt hat. Er sagt dir das Regime, nicht die Richtung - für die Richtung liest du den Trade Bias.

Wo die Signals tatsächlich zusammenkommen:

- **Trade Bias** fasst den MSI und mehrere Basic und Advanced Signals zu einer einzigen Richtungsaussage zusammen. Die vollständige Seite ist Pro; eine kompakte Karte steht auf dem Haupt-Dashboard.
- **Signal Breadth** auf dem Haupt-Dashboard zählt, wie viele Signals bullisch, neutral oder bärisch tendieren.

Siehe [Composite Score](/help/platform/composite-score) für die vollständige Aufschlüsselung.

## Anatomie einer Signal-Seite

Jede Signal-Seite bei ZeroGEX hat dieselbe Anatomie. Kennt man sie einmal, lässt sich jedes Signal schnell lesen.

1. **Titel und Frage** - der Name des Signals, die Frage, die es stellt, und ein ⓘ-Tooltip mit der Kurzfassung, wie es funktioniert.
2. **Score-Hero** - der aktuelle Score auf -100 bis +100, eine einzeilige Deutung dazu und eine ausklappbare Score-Historie.
3. **Input-Panels** - die zentralen Inputs, die den Score treiben (z. B. bei EOD Pressure: Time Ramp, Pin Target, Dealer Charm am Spot und Gamma-Regime).
4. **"How it's built"** - die Mathematik dahinter, in Formeln und kurzen Anmerkungen.
5. **Event Timeline** - der Verlauf des Scores über die letzten zwei Sessions, mit markierten Richtungswechseln und der Bewegung des Basiswerts über die nächsten 30, 60 oder 120 Minuten.

Die Reihenfolge ist über alle Seiten hinweg konsistent.

## Trade-Bias-Kategorien

Jedes Signal hat einen deklarierten Trade-Bias; [Signals: Explained](/guides/signals-explained) listet sie alle auf.

- **Direktionale Lesart** - das Vorzeichen des Scores entspricht der erwarteten Preisrichtung.
- **Mean-Reversion (vs. Crowd)** - der Score spiegelt das Faden der Crowd wider, nicht des Preises: ein positiver Score kennzeichnet eine bärisch geneigte Crowd, die nach oben squeezen kann, ein negativer Score eine bullisch geneigte Crowd, die nach unten gespült werden kann.
- **Mean-Reversion (Long Gamma)** - fade die Ausdehnung Richtung Mittelwert, wenn Dealer long Gamma sind.
- **Continuation** - das Vorzeichen des Scores entspricht der Richtung des nächsten Legs.
- **Regime-/Playbook-Wechsel** - das Signal sagt dir, die Strategie zu wechseln, nicht einen Trade einzugehen.

Bringe den Trade-Bias mit deiner Strategie in Einklang. Ein Continuation-Signal ist kein Fade.

## Wie man die Signals nutzt

Drei Muster:

1. **Als Filter.** Geh keine Trend-/Breakout-Trades ein, wenn der MSI niedrig ist (choppy Regime). Fade keine Rallyes bei negativem Gamma.
2. **Als Trigger.** Nutze den Trigger eines Advanced Signals als Einstiegssignal, mit deinem eigenen Stop und Ziel.
3. **Als Konfluenz.** Kombiniere zwei oder drei unabhängige Signals (die Lesart eines Basic Signals + ein Advanced-Trigger + die Trade-Bias-Karte auf dem Haupt-Dashboard).

## Was Signals nicht leisten

- Sie geben dir keine Exits vor.
- Sie bemessen nicht die Größe deines Trades.
- Sie kennen deine Risikotoleranz nicht.

Nutze sie innerhalb eines regelbasierten Prozesses, nicht als eigenständige Trade-Tickets.

## Siehe auch

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) - die vollständige Referenzmatrix
