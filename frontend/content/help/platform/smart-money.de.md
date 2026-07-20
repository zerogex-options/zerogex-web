# Smart Money

*Der Smart-Money-Screen — was einen Trade als Smart-Money qualifiziert, wie das C/P-Verhältnis berechnet wird und wie man den Bias intraday nutzt.*

---

## Was "Smart Money" hier bedeutet

Smart Money ist eine Heuristik — ein Tag, den wir Optionstrades zuweisen, die den strukturellen Fingerabdruck einer informierten Wette tragen:

- **Größe** — Prämie und Kontraktgröße deutlich über dem Durchschnitt für Strike/Verfall.
- **Aggressivität** — zum Ask oder darüber bezahlt (Kauf) bzw. zum Bid getroffen (Verkauf), nicht zu Mid-Preisen.
- **Wiederholung** — mehrere aggressive Prints in derselben Richtung innerhalb eines kurzen Zeitfensters.
- **Überzeugungsprämie** — der Trade zahlt einen nicht trivialen Prozentsatz des Kontraktwerts.

Ein einzelner Block allein qualifiziert nicht. Ein Muster von Überzeugungstrades auf einem Strike schon.

## Was diese Seite zeigt

### Das Smart-Money C/P-Verhältnis

Das Verhältnis von Smart-Money-Call-Prämie zu Smart-Money-Put-Prämie. Ein Wert deutlich über 1 bedeutet, dass der Smart-Money-Flow strukturell auf Calls setzt; deutlich darunter bedeutet Puts. Das ist **nicht** dasselbe wie die Headline-PCR (Put/Call Ratio) — hier werden nur hochüberzeugte Prints gefiltert.

### Das Smart-Money-Tape

Ein Live-Feed der als Smart-Money markierten Trades — Größe, Prämie, Strike, Verfall, Richtung, Zeit. Klicken, um den Trade im Kontext zu sehen.

### Der Smart-Money-Bias

Ein kombinierter Bias-Chip — bullish, bearish, neutral — gebildet aus dem C/P-Verhältnis plus dem netto-prämiengewichteten Flow innerhalb der Smart-Money-Teilmenge.

### Die Strike-Konzentrationskarte

Wo sich der Smart-Money-Flow nach Strike konzentriert hat, farbcodiert nach Richtung. Nützlich, um zu erkennen, "wo sich das große Geld positioniert".

## Wie man sie nutzt

Drei Muster:

1. **Smart Money stark long bei Calls + Composite positiv + unterstützender GEX-Gradient** ⇒ die strukturelle Lesart deckt sich mit dem Smart-Money-Flow. Richtungsstark mit hoher Überzeugung.
2. **Smart Money stark long bei Puts am Put Wall** ⇒ Verteidigung oder Fading. In Kombination mit einer Positioning-Trap-Lesart kann dies ein handelbarer Counter-Bias sein.
3. **Smart-Money-Flow neutral, Headline-Flow stark** ⇒ die Headline ist retail-getrieben; mit Vorsicht behandeln.

## Was sie nicht ist

Der Smart-Money-Tag ist eine **probabilistische Heuristik**. Nicht jeder Smart-Money-Print ist informiert; nicht jeder informierte Trade wird markiert. Die Seite ist am nützlichsten auf **Bias-Ebene** — wie ist die kumulative Neigung? — und weniger als Handelssignal für einzelne Prints.

## Das größere Bild

Der Smart-Money-Flow ist einer von mehreren Inputs in das Basissignal des Positioning Trap (das das vorzeichenbehaftete Smart-Money-Ungleichgewicht nutzt) sowie in den Market Pressure Index (Smart-Money-Flow-Skew). Die Smart-Money-Seite ist die eigenständige Lesart; die Signale sind die Interpretationen.

## Siehe auch

- [Flow-Analyse](/help/platform/flow-analysis)
- [Nettovolumen vs. gerichteter Flow](/education/net-volume-vs-directional-flow)
- [Positioning-Trap-Signal erklärt](/education/positioning-trap-explained)
