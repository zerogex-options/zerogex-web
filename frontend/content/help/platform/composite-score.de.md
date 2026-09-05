# Composite Score

*Die zusammengeführte Sicht auf das aktuelle Markt-**Regime** — wie sie entsteht, warum sie keine Richtungsaussage ist und wie man sie als Filter statt als Prognose nutzt.*

---

## Was der Composite Score ist

Der Composite Score — intern **MSI**, der Market State Index — ist die **Zusammenfassung des aktuellen Optionsstruktur-Regimes in einer einzigen Zahl** für das aktive Symbol. Er beantwortet eine einzige Frage: *Wird das Tape wahrscheinlich trenden oder seitwärts choppen?*

Er liegt auf einer **0–100-Skala, wobei 50 neutral ist.** Er ist **kein** Richtungs-Score — er sagt dir nicht bullisch vs. bärisch. Ein hoher MSI bedeutet, dass Trends wahrscheinlich *laufen*; ein niedriger MSI bedeutet, dass das Tape *gepinnt, choppy oder fragil* ist. Für die Richtung liest du den [Trade Bias](/help/platform/trade-bias) — das ist die vorzeichenbehaftete Aussage bullisch vs. bärisch.

> **Ein hoher MSI bedeutet nicht „bullisch". Er bedeutet, dass Trends laufen können.**
> **Ein niedriger MSI bedeutet nicht „bärisch". Er bedeutet, dass Trends wahrscheinlich nicht funktionieren.**

## Die Regime-Bänder

| Score | Regime | Bedeutung |
| --- | --- | --- |
| ≥ 70 | **Trend / Expansion** | Historisch die größte Vorwärtsbewegung der vier Bänder |
| 40 – 70 | **Kontrollierter Trend** | Überdurchschnittliche Vorwärtsbewegung |
| 20 – 40 | **Chop / Range** | Unterdurchschnittliche Vorwärtsbewegung |
| < 20 | **Kompression** | Historisch die geringste Vorwärtsbewegung der vier Bänder |

Die Bänder sind nach gemessener Vorwärtsbewegung geordnet: Auf Werte im obersten Band folgte historisch die größte Spanne, auf das unterste die geringste. Diese Reihenfolge gilt über alle getesteten Zeithorizonte, der Effekt ist jedoch moderat — er verschiebt die Wahrscheinlichkeiten, er bestimmt sie nicht.

Eine Einschränkung, die wir lieber nennen als verschweigen: Der Score ist kein reiner Regime-Wert. Zwei seiner sechs Komponenten messen die *Richtung* des Options-Flows und nicht, wie weit sich der Preis bewegt, und sie gehen vorzeichenbehaftet in den Score ein. In der Praxis kann ein stark bärisches Tape den Score in die unteren Bänder ziehen, auch wenn sich die Optionsstruktur nicht verändert hat. Wir trennen die beiden Messungen gerade; bis dahin sollte ein niedriger Score während eines scharfen Rückgangs eher als teilweise direktionales Signal gelesen werden denn als reine Spannenprognose.

## Wie er aufgebaut ist

Der MSI verschmilzt **sechs unabhängige Komponenten**, jede auf einer −1…+1-Linie bewertet und zu einem Punktbudget gewichtet, das sich auf 100 summiert:

| Komponente | Punkte | Was sie liest |
| --- | --- | --- |
| Gamma Anchor | 30 | Nähe zum Gamma Flip, lokale Gamma-Dichte, Max-Gamma-Strike — gepinnt vs. frei |
| Order Flow Imbalance | 19 | Smart-Money-Call- vs. -Put-Prämie — *der eine direktionale Input* |
| Dealer Delta Pressure | 17 | Richtung des erzwungenen Dealer-Hedges |
| Net GEX Sign | 16 | Dealer long Gamma (dämpft Bewegungen) vs. short Gamma (verstärkt) |
| Put/Call Ratio | 12 | Proxy für strukturelle Fragilität |
| Volatility Regime | 6 | Live-Vol vs. der 20er-Vol-Pivot |

Die Komponenten werden über eine sanft sättigende (tanh) Mischung auf die neutrale 50er-Baseline aufsummiert, sodass kein einzelner Input den Gauge im Alleingang festsetzen kann. **Rund zwei Drittel des Gewichts sind richtungslose Struktur** (Gamma Anchor, Net GEX Sign, Put/Call, Vol) — diese drängen Richtung *Trend* oder *Chop*, nicht nach oben oder unten. Nur Order Flow Imbalance und Dealer Delta sind wirklich direktional, weshalb ein stark einseitiges Tape den Score verschieben kann, obwohl der Gauge eine Regime-Aussage ist.

Für jede Komponente gilt: **+1 spricht für ein handelbares / trendendes Regime; −1 spricht für Chop / Pinning / Reversal.**

## Der MSI-Gauge

Die Composite-Score-Seite zeigt:

- Den **MSI-Gauge** — Score auf dem 0–100-Bogen, eingefärbt nach *Regime-Band* (nicht nach bullisch/bärisch).
- Das **Regime-Label** — Trend / Expansion, Kontrollierter Trend, Chop / Range oder Kompression.
- Das Panel der **beitragenden Komponenten** — der aktuelle Schub jedes Inputs, rechts für „trendend", links für „Chop / Reversal", sortiert nach Größe.
- Das **Δ seit Eröffnung** und **Δ letzte 5 Min** — wie weit sich der Regime-Score bewegt hat (Richtung Trend, wenn positiv; Richtung Chop, wenn negativ). Das ist Regime-Momentum, keine Richtung.
- Eine **Sparkline** des Scores über die Session.

## Den Composite lesen

Eine einfache Faustregel — lies ihn als *wie sehr man einem Trend trauen kann*, und nimm die Richtung vom Trade Bias:

| Composite | Lesart |
| --- | --- |
| ≥ 70 | Trendendes Regime — Trends im vorherrschenden Bias können laufen; mit dem Trend nachlegen |
| 40 – 70 | Kontrollierter Trend — ein echter, aber moderater Edge; Größe reduzieren |
| 20 – 40 | Chop / Range — die Extreme faden, Breakouts nicht hinterherjagen, definiertes Risiko bevorzugen |
| < 20 | Fragil / hohes Reversal-Risiko — nur Mean-Reversion, mit gescheiterten Breakouts rechnen |

Am nützlichsten sind die Extreme oben und unten. Die Mitte (~40–60) ist eine „kein starkes Regime"-Zone — erzwinge daraus keinen Trend-Trade.

## Wie man ihn nutzt

Drei Anwendungsmuster:

1. **Als Überzeugungsregler für die Richtung.** Der Trade Bias gibt dir die Seite; der MSI sagt dir, wie stark du sie ausreizen sollst. Long-Bias + MSI 75 → nachlegen. Long-Bias + MSI 25 → den Dip klein kaufen, die Extreme faden, nicht hinterherjagen.
2. **Als Chop-Filter.** Gehe keine Trend-/Breakout-Trades ein, wenn der MSI niedrig ist (< 40) — das Tape ist choppy oder mean-reverting *unabhängig von der Richtung*. Ein niedriger Score ist kein Signal, short zu gehen.
3. **Als Regime-Bestätigung.** MSI-Lesarten sind in Negative-Gamma-Sessions tendenziell stärker und beständiger, im Einklang mit dem stärker direktionalen Verhalten, das diese Regime tendenziell zeigen.

## Was er nicht ist

Der Composite ist **kein Handelssignal** und **keine Richtungsaussage.** Er sagt dir, in welcher *Art* von Tape du dich befindest — Trend vs. Chop; er sagt dir nicht, in welche Richtung, welchen Zeitrahmen du verwenden sollst oder wo dein Stop liegen soll. Kombiniere ihn mit dem Trade Bias (Richtung) und den einzelnen Signalen (Trigger).

## Warum der Composite schnell kippen kann

Zwei Gründe:

- Ein Überschreiten des Gamma Flip kann die strukturellen Komponenten (Gamma Anchor, Net GEX Sign) heftig ausschlagen lassen und die Regime-Lesart schnell verschieben.
- Eine scharfe Verschiebung im Smart-Money-Flow bewegt die eine direktionale Komponente genug, um die Mischung zu verschieben.

Die Sparkline macht diese sprunghaften Änderungen sichtbar — achte auf die Unstetigkeiten.

## Trader-Gewohnheiten, die sich bewährt haben

- Lies den MSI bei Handelsbeginn sowie um 11:00 / 12:30 / 14:30 ET als deine Check-ins.
- Behandle den MSI als Positions-**Größe** und den Trade Bias als Positions-**Richtung**.
- Behandle Scores zwischen ~40 und ~60 als „kein starkes Regime — abwarten" statt als Richtung.

## Hinweis zur Stufe

Die Composite-Score-Seite ist nur für Pro verfügbar. Der MSI-Gauge erscheint zusätzlich im Dashboard für alle kostenpflichtigen Stufen.

## Siehe auch

- [Trade Bias](/help/platform/trade-bias) — die vorzeichenbehaftete, direktionale Lesart
- [Wie Signale End-to-End funktionieren](/help/platform/signals-overview)
- [Signale: erklärt](/guides/signals-explained)
