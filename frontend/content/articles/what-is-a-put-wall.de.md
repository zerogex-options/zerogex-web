# Was ist eine Put Wall? Wie Optionshändler Put Walls als Dealer-Support nutzen

*Die Put Wall ist der Strike, an dem sich das Put-seitige Dealer-Gamma konzentriert — meist der stabilste, durch Dealer-Hedging abgesicherte Support auf dem Board. Hier erfährst du, was eine Put Wall wirklich ist, warum der Preis dort reagiert, wie sie sich im Tagesverlauf verschiebt und wann sie hält bzw. bricht.*

---

## Was ist eine Put Wall?

Eine **Put Wall** ist der Strike unterhalb des Spot-Preises, der die stärkste Konzentration an Put-seitigem Dealer-Gamma-Exposure in der Optionskette trägt. Es ist das Preisniveau, an dem Dealer-Hedging-Flüsse am ehesten *die Abwärtsseite verteidigen* — weshalb Trader die Put Wall als den strukturellen Boden der aktuellen Dealer-Positionierungsspanne betrachten.

Die Bedeutung von Put Wall in einem Satz: Es handelt sich nicht um ein psychologisches Level oder einen gleitenden Durchschnitt — es ist reale Positionierung. Open Interest, Kontrakt für Kontrakt, gewichtet mit dem Gamma, das jeder Kontrakt trägt. Der einzelne Strike, an dem dieses Put-Gamma unterhalb des aktuellen Preises am dichtesten ist, ist die Put Wall.

Die Put Wall hat ein Spiegelbild oberhalb des Spot-Preises: die [Call Wall](/education/what-is-a-call-wall), den Strike mit dem stärksten Call-Gamma, der tendenziell den Aufwärtsbereich begrenzt. Zusammen skizzieren die beiden Walls die Spanne, die durch die Dealer-Hedging-Mechanik tendenziell verteidigt wird. Dieser Beitrag befasst sich speziell mit der Put Wall — was sie ist, warum sie als Support wirkt, wie sie sich bewegt und wann die Lesart bricht. Für das vollständige strukturelle Bild kombiniere ihn mit [Gamma Walls Explained](/education/gamma-walls-explained) und dem [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained).

---

## Warum die Put Wall als Support wirkt

Der Mechanismus ist Dealer-Hedging, nicht Sentiment. In einem **positiven Gamma**-Regime — Spot oberhalb des [Gamma Flip](/education/how-to-read-a-gamma-flip) — sind Dealer netto long Gamma, und die Desks, die die schweren Puts am Put-Wall-Strike geschrieben haben, sind in diesen Puts short. Um delta-neutral zu bleiben, müssen sie das Underlying **kaufen**, wenn der Preis sich dem Strike nähert, denn eine Short-Put-Position gewinnt an Long-Delta, wenn der Markt fällt.

Dieses Kaufen ist der Support. Nähert sich der Preis einem dichten Put-Strike, verstärkt sich der Hedging-Reflex: Eine kleine Abwärtsbewegung erzwingt einen relativ größeren Hedging-Kauf zurück nach oben. Das Ergebnis ist ein Niveau, an dem Verkaufsdruck absorbiert wird und Rücksetzer tendenziell gekauft werden — nicht weil jemand an die Zahl glaubt, sondern weil der Hedge mechanisch ist.

Einige Dinge, die sich direkt aus dem Mechanismus ergeben:

- Die Put Wall ist **probabilistischer Support**, kein harter Boden. Sie ist der Ort, an dem sich absorbierender Flow konzentriert, kein garantierter Bounce.
- Sie ist am stärksten in einem positiven Gamma-Regime und bei hohem relativem Gamma am Strike.
- Sie ist eine *Tendenz*, die ein echter Katalysator — CPI, FOMC, ein Vol-Spike — innerhalb von Sekunden außer Kraft setzen kann.

---

## Put Wall vs. Call Wall

Die beiden Walls sind symmetrisch, aber gegensätzlich:

|Wall|Wo|Dealer-Hedge bei positivem Gamma|Typisches Verhalten|
|---|---|---|---|
|Put Wall|Stärkstes Put-Gamma unterhalb des Spot|Kauft, wenn der Preis sich ihm nähert (fällt)|Support / Abwärtsboden|
|Call Wall|Stärkstes Call-Gamma oberhalb des Spot|Verkauft, wenn der Preis sich ihm nähert (steigt)|Widerstand / Aufwärtsdeckel|

Keine der beiden Walls ist für sich genommen richtungsweisend. Die Put Wall ist nicht "bullisch" und die Call Wall nicht "bearisch" — es sind Konzentrationsniveaus, deren *Wirkung* davon abhängt, auf welcher Seite des Gamma Flip man sich befindet. Oberhalb des Flip absorbieren beide Walls Bewegungen. Unterhalb können sich beide umkehren und sie freisetzen.

---

## Wie sich die Put Wall im Tagesverlauf bewegt

Die Put Wall ist eine lebendige Lesart, keine Linie, die man bei Handelseröffnung festlegt und bis zum Handelsschluss darauf vertraut. Sie wandert aus drei häufigen Gründen:

1. **OI-Neugewichtung.** Frisches Volumen an einem anderen Strike kann die stärkste Put-Gamma-Konzentration verschieben. Die Put Wall um 10:00 ET kann bis Mittag einen Strike tiefer liegen.
2. **Migration mit dem Preis.** Wenn der Preis sich langsam der Put Wall nähert und Trader weiterhin knapp darunter Absicherung kaufen, kann die Wall mit der Bewegung nach unten driften. Eine Put Wall, die den Preis *verfolgt*, ist eine schwächere Support-Lesart als eine, die *hält* — die Wall läuft hinterher, statt zu verteidigen.
3. **Verfallsverfall.** In 0DTE-lastigen Ketten laufen die Kontrakte, die die Wall aufgebaut haben, im Laufe des Nachmittags aus. Eine Put Wall, auf die man sich um 11:00 ET gestützt hat, kann bis 14:30 ET ausdünnen.

Die Wall in Bewegung zu lesen macht den größten Teil des Edge aus. Eine Put Wall, die sich zwei Stunden lang nicht bewegt hat, ist ein ganz anderes Signal als eine, die dreimal mit dem Preis nach unten gerutscht ist.

---

## Wann die Put Wall hält bzw. bricht

Die Put Wall ist eine Tendenz, die häufiger funktioniert, wenn die Struktur sie stützt. Eine kurze Checkliste:

**Wahrscheinlicher hält sie:**

- Der Spot befindet sich in einem positiven Gamma-Regime (oberhalb des Flip).
- Der Strike trägt großes relatives Gamma und das Net GEX ist deutlich positiv.
- Die Wall migriert *nicht* mit dem Preis nach unten.
- Der Verkaufsdruck auf das Niveau nimmt ab.

**Wahrscheinlicher bricht sie:**

- Der Spot befindet sich in einem **negativen Gamma**-Regime (unterhalb des Flip). Hier kehrt sich der Dealer-Reflex um — statt den Rücksetzer zu kaufen, kann das Hedging den Ausverkauf *verstärken*, und die Put Wall wird zu einem Slippage-Punkt statt zu einem Boden.
- Das Net GEX ist klein oder schrumpft schnell.
- Die Wall läuft dem Preis nach unten hinterher.
- Ein makroökonomischer Katalysator trifft ein, während das Niveau getestet wird.
- Der gerichtete Verkaufsdruck am Strike *beschleunigt* sich.

Das Wichtigste davon ist das Regime. Eine Put Wall bei positivem Gamma ist ein Boden, den Dealer verteidigen. Derselbe Strike bei negativem Gamma ist eine Falltür — sobald der Preis ihn durchbricht, verstärken die Hedging-Flüsse die Abwärtsbewegung, statt sie abzufedern.

---

## Ein durchgerechnetes Beispiel

Angenommen, SPX handelt bei 5.830 und das Dealer-Book zeigt:

- **Put Wall:** 5.790 (−0,69 % vom Spot)
- **Call Wall:** 5.850 (+0,34 % vom Spot)
- **Gamma Flip:** 5.810
- **Net GEX:** +1,5 Mrd. $

Der Spot liegt komfortabel oberhalb des Flip, es handelt sich also um eine Long-Gamma-Session, und die Put Wall bei 5.790 ist die stabilere Kante der Spanne. Die praktische Tendenz: Rücksetzer in Richtung 5.790 sind die Zone mit höherer *Kauf*-Wahrscheinlichkeit, und ein sauberer Bruch von 5.790 wäre ein echtes Signal — es bedeutet wahrscheinlich entweder einen Flip-Übergang unter 5.810 in negatives Gamma oder einen Katalysator, der stark genug ist, um den Hedge zu überwältigen. Unterhalb des Flip hört genau diese 5.790 auf, Support zu sein, und kann den nächsten Abwärtsschub beschleunigen.

Ändere eine Variable — sagen wir, die Put Wall wandert von 5.790 auf 5.782, während der Preis 5.795 testet — und die Lesart ändert sich mit. Die Wall läuft dem Preis jetzt nach unten hinterher, die Support-Tendenz schwächt sich ab, und ein Bruch wird glaubwürdiger, als es zehn Minuten zuvor aussah.

---

## Wie man die heutige Put Wall findet

Du musst das Dealer-Gamma nicht von Hand berechnen. ZeroGEX veröffentlicht die aktuelle Put Wall — zusammen mit Call Wall, Gamma Flip, Max Pain und Net GEX — für die drei meistgehandelten Indexprodukte, kostenlos und mit etwa 15 Minuten Verzögerung: sieh dir die heutige Put Wall für [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) und [QQQ](/qqq-gamma-levels) an. Für die Live-Version im Sub-Sekundenbereich mit dem vollständigen Gamma-Profil und der Strike-nach-DTE-Heatmap zeichnet das [Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte) die Put Wall nach, während sie sich im Sitzungsverlauf verschiebt.

---

## Fazit

> Die Put Wall ist reale Positionierung, keine Psychologie — der Strike, an dem Dealer-Hedging am ehesten die Abwärtsseite verteidigt. Aber sie ist nur ein Boden, solange der Spot im positiven Gamma liegt. Lies zuerst das Regime, dann die Wall, und drittens die Migration der Wall.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.

---

Möchtest du das in Echtzeit sehen? Sieh dir die heutigen **SPX-/SPY-/QQQ-Put-Walls** auf ZeroGEX an — die kostenlosen Gamma-Levels-Seiten für [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) und [QQQ](/qqq-gamma-levels) zeichnen die Put Wall neben der [Call Wall](/education/what-is-a-call-wall), dem Gamma Flip und dem Net GEX. Für die Levels, die als Support und Widerstand am wichtigsten sind, siehe [optionsbasierte Support- und Widerstandsniveaus](/education/options-support-and-resistance), und für die Live-Lesart öffne das [Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte).
