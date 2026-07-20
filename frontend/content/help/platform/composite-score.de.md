# Composite Score

*Die zusammengeführte Sicht über alle ZeroGEX-Signale hinweg — wie sie entsteht, wie man sie liest und wie man sie als Filter statt als Prognose nutzt.*

---

## Was der Composite Score ist

Der Composite Score — intern **MSI**, der Market Score Indicator — ist die **Zusammenfassung in einer einzigen Zahl** aller ZeroGEX-Signale für das aktive Symbol. Er liegt auf derselben **[-1, +1]**-Linie wie jeder andere Signal-Score.

Positiver Composite ⇒ strukturelle bullische Tendenz. Negativer ⇒ strukturelle bärische Tendenz. Die Stärke zeigt die Überzeugung.

## Wie er aufgebaut ist

Drei fortlaufende Inputs verschmelzen zu einer Zahl:

1. **Basic-Signale** — jedes Basic-Signal trägt mit einem kleinen festen Gewicht bei (4–8 % des Composite). Auch wenn sie nicht auslösen, verschieben sie den Composite kontinuierlich im Hintergrund.
2. **Advanced-Signal-Trigger** — wenn ein Advanced-Signal-Trigger aktiv ist, trägt er mit seinem vorzeichenbehafteten Score und einem höheren Gewicht bei.
3. **Regime-Kontext** — das aktive Gamma-Regime wirkt als Multiplikator auf die direktionalen Inputs.

Die Gewichte sind so austariert, dass kein einzelnes Signal dominiert. Ein Composite-Wert nahe ±0,4–0,6 setzt typischerweise voraus, dass sich mehrere Inputs ausrichten.

## Der MSI-Gauge

Die Composite-Score-Seite zeigt:

- Den **MSI-Gauge** — Score auf der [-1, +1]-Linie, mit Farbcodierung von tiefrot bis tiefgrün.
- Den **Trigger-Status** — ob der Composite eine Aufmerksamkeitsschwelle überschritten hat.
- Das Panel der **beitragenden Signale** — jeder Input mit seinem aktuellen Beitrag zum Composite, sortiert nach Größe.
- Den **Regime-Header** — Positive Gamma, Negative Gamma oder Transitioning.
- Eine **Sparkline** des Composite über die letzte Session.

## Den Composite lesen

Eine einfache Faustregel:

| Composite | Lesart |
| --- | --- |
| ≥ +0,6 | Stark bullisch — mehrere Signale long ausgerichtet, das Regime stützt es |
| +0,3 bis +0,6 | Tendenz bullisch — der Bias ist real, aber nicht überwältigend |
| -0,3 bis +0,3 | Keine Lesart — der Composite ist wenig hilfreich, einzelne Signale betrachten |
| -0,6 bis -0,3 | Tendenz bärisch |
| ≤ -0,6 | Stark bärisch |

Der nützlichste Bereich sind die Extreme. Die Mitte ist bewusst eine „die Daten sagen dir nichts"-Zone — erzwinge daraus keine Trades.

## Wie man ihn nutzt

Drei Anwendungsmuster:

1. **Als Filter.** Gehe keine Long-Trades ein, wenn der Composite bei -0,6 liegt, es sei denn, dein Edge ist explizit konträr zum Trend.
2. **Als Konfluenz-Check.** Ein High-Confidence-Advanced-Trigger, der von einem Composite in dieselbe Richtung gestützt wird, ist eine verlässlichere Lesart als der Trigger allein.
3. **Als Regime-Bestätigung.** Composite-Lesarten sind in Negative-Gamma-Sessions tendenziell stärker und beständiger — sie decken sich mit dem zugrunde liegenden Marktverhalten.

## Was er nicht ist

Der Composite ist **kein Handelssignal**. Er zeigt, ob das strukturelle Bild in eine Richtung tendiert; er sagt dir nicht, einen Trade einzugehen, welchen Zeitrahmen du verwenden sollst oder wo dein Stop liegen soll.

## Warum der Composite schnell kippen kann

Zwei Gründe:

- Ein hoch gewichtetes Advanced-Signal kann auslösen und die Lesart dominieren.
- Der Regime-Kontext (Überschreiten des Gamma-Flip) kann den Multiplikator für alles andere verschieben.

Die Sparkline macht diese Sprünge sichtbar — achte auf die Unstetigkeiten.

## Trader-Gewohnheiten, die sich bewährt haben

- Lies den Composite bei Handelsbeginn sowie um 11:00 / 12:30 / 14:30 ET als Check-ins.
- Handle nicht gegen den Composite während des EOD-Pressure-Fensters.
- Behandle Composite-Werte zwischen -0,3 und +0,3 als „abwarten", nicht als „neutral".

## Hinweis zur Stufe

Die Composite-Score-Seite ist nur für Pro verfügbar. Der Composite-Gauge erscheint zusätzlich im Dashboard für alle kostenpflichtigen Stufen.

## Siehe auch

- [Wie Signale End-to-End funktionieren](/help/platform/signals-overview)
- [Die [-1, +1]-Score-Linie lesen](/help/platform/score-line)
- [Signale: Erklärt](/guides/signals-explained)
