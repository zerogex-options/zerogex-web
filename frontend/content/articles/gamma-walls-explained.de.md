# Gamma Walls erklärt: Was eine Gamma Wall ist und wie der Preis reagiert

*Gamma Walls sind die meistbeachteten Levels in der Dealer-Positionierungsanalyse. Was eine Gamma Wall ist, was jede Wall in jedem Regime tut, was dir die Lücke zwischen ihnen sagt, wie sie sich zum Same-Day-Verfall hin verhalten und wann die Lesart hält und wann sie bricht.*

---

## Was ist eine Gamma Wall?

Eine **Gamma Wall** ist ein Strike in der Optionskette, an dem sich die modellierte Dealer-Gamma-Exponierung stark konzentriert. Die Optionspositionierung ist dort ungewöhnlich dicht, sodass das Hedging, das Dealer rund um dieses Level betreiben könnten, größer ausfallen kann als an benachbarten Strikes. Es gibt zwei: die **Call Wall**, die stärkste Call-Gamma-Konzentration oberhalb des Spots, und die **Put Wall**, die stärkste Put-Gamma-Konzentration darunter. Zusammen schließen sie den Spot ein, und Trader lesen sie oft als die äußeren Ränder der Spanne, mit der die aktuelle Positionierung am ehesten vereinbar ist.

Eine Wall wird aus dem Open Interest abgeleitet, Kontrakt für Kontrakt, gewichtet nach dem Gamma, das jeder Kontrakt trägt. Sie ist kein gleitender Durchschnitt, keine Trendlinie und keine runde Zahl.

Keine der beiden Walls ist per Konstruktion Unterstützung oder Widerstand. Nichts verpflichtet irgendjemanden, an einem Strike zu handeln, und Hedging ist nur eine Quelle von Order Flow unter vielen. Was das Hedging an einer Wall tut, hängt vom *Vorzeichen* des modellierten Dealer-Gammas und vom Flow um sie herum ab, nicht davon, ob die Kontrakte dort Calls oder Puts sind. Die vertretbare Sichtweise: Eine Wall markiert, wo eine Reaktion wahrscheinlicher ist als an einem zufällig gewählten Strike, und für sich genommen sagt sie nichts über die Richtung aus.

Der Rest dieser Seite ist der praktische Teil, also die Punkte, die entscheiden, ob das Level an einem bestimmten Tag nützlich ist: was jede Wall in jedem Regime tut, was dir der Abstand zwischen ihnen sagt, wie sie sich zum Same-Day-Verfall hin verhalten, wie sie wandern und wie oft Walls tatsächlich halten oder brechen. Für den Regimekontext, der all dem zugrunde liegt, kombiniere dies mit [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip) und dem umfassenderen [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained).

---

## Was ist eine Call Wall?

Die Call Wall ist der Strike oberhalb des Spots mit der stärksten Call-Gamma-Exponierung. Nach der traditionellen Konvention werden Dealer so *modelliert*, als wären sie long in diesen Calls, sodass sie in einem positiven Gamma-Regime tendenziell in Rallyes verkaufen, die sich der Wall nähern - sie bauen dabei das positive Delta ab, das sie ansammeln, während der Preis auf sie zusteigt. Dieser Hedging-Reflex kann der Rally entgegenwirken.

In der Praxis wirkt die Call Wall oft als **Widerstand** - nicht, weil das Level magisch wäre, und nicht einfach, weil sie ein Call-Strike ist. Bei positivem Gamma stemmt sich der modellierte Hedging-Flow um sie herum tendenziell gegen die Bewegung; wechselt das Gamma-Vorzeichen, läuft dieses Hedging stattdessen mit der Bewegung.

Wissenswertes:

- Die Wall ist die *aktuell* stärkste Konzentration. Verschiebt sich das OI, verschiebt sich auch die Wall.
- In Long-Gamma-Regimen (Spot oberhalb des Gamma Flips) stemmt sich das Hedging rund um die Wall gegen eine Rally. In Short-Gamma-Regimen läuft es mit ihr, sodass das Level, falls es nachgibt, vom Widerstand zum Breakout-Beschleuniger werden kann. Das Regime ändert dieses Verhalten, nicht, wie oft die Wall bricht.
- Eine Call Wall ist eine **probabilistische** Tendenz, keine harte Obergrenze. Echter Flow kann sie durchbrechen.

---

## Was ist eine Put Wall?

Die Put Wall ist der Strike unterhalb des Spots mit der stärksten Put-Gamma-Exponierung. Wenn das Netto-Buch als long Gamma modelliert wird (ein Regime mit positivem Net GEX), kauft der aggregierte Dealer-Hedge tendenziell Schwäche und verkauft Stärke - fällt der Preis also auf einen dichten Put-Strike zu, kann sich dieser Buy-the-Dip-Reflex gegen den Ausverkauf stemmen. Dieses Verhalten ergibt sich allerdings aus dem Vorzeichen des *Netto*-Gammas, nicht daraus, dass der Strike aus Puts besteht.

In der Praxis wirkt die Put Wall oft als **Unterstützung**. Ob das Hedging um sie herum einen Rückgang abfedert, den Preis festhält oder einen Bruch beschleunigt, hängt wie bei der Call Wall vom Vorzeichen des modellierten Dealer-Gammas und vom umgebenden Flow ab - nicht vom Optionstyp.

Wissenswertes:

- Die Wall ist dynamisch. Schweres OI, das gegen Verfall ausläuft, kann eine Put Wall bis Mittag verschwinden lassen.
- In einem Short-Gamma-Regime kehrt sich das Dealer-Verhalten um - das Hedging hört auf, Schwäche zu absorbieren, und wenn die Put Wall nachgibt, kann sie auf dem Weg nach unten zu einem Slippage-Punkt werden.
- Eine Put Wall ist eine Tendenz. Makro-Schocks, Volatilitätsexpansion und Neuausrichtungen der Kette können die strukturelle Lesart alle außer Kraft setzen.

---

## Warum der Preis an Gamma Walls reagiert

Der Mechanismus ist Dealer-Hedging, nicht Psychologie. Am klarsten sieht man das so:

In einem **positiven Gamma**-Regime hedgen Dealer tendenziell *gegen* die Preisbewegung. Sie verkaufen, wenn der Preis steigt, und kaufen, wenn er fällt. In der Nähe einer Wall kann sich dieser Reflex verstärken, weil die Gamma-Konzentration lokal groß ist - eine kleine Bewegung in Richtung Wall kann einen relativ größeren Hedging-Trade von ihr weg erfordern. Das setzt voraus, dass das modellierte Vorzeichen des Dealer-Gammas um diesen Strike herum Bestand hat, weshalb sich dieselbe Wall anders verhalten kann, wenn sich der umgebende Flow oder das Netto-Vorzeichen verschiebt.

In einem **negativen Gamma**-Regime kehrt sich der Reflex um. Dealer hedgen tendenziell *mit* der Preisbewegung. Dieselbe Wall, die den Preis in Long-Gamma festgehalten hat, kann zu einem Breakout-Vektor werden - sobald der Preis sie überwindet, verstärkt der Hedging-Trade die Bewegung, statt sie zu dämpfen.

Eine Gamma Wall ist keine feste Eigenschaft der Kette. Sie ist ein festes *Level*, dessen Hedging-Wirkung vom **Regime um es herum** abhängt - genau das, was der Gamma Flip zeigt. Was das Regime nicht entscheidet, ist, ob die Wall hält: In unserer Messung von 737 Wall-Tests hielten S&P-Walls innerhalb einer Stunde in etwa zwei von drei Fällen und Nasdaq-Walls in etwa der Hälfte der Fälle, und zwar auf beiden Seiten des Flips ([Wie oft brechen Gamma Walls tatsächlich?](/education/how-often-do-gamma-walls-break)).

---

## Gamma Walls, der Gamma Flip und Max Pain

Die drei Levels sind unterschiedlich aufgebaut und beantworten unterschiedliche Fragen:

- Der **Gamma Flip** ist der Punkt, an dem das modellierte Dealer-Gamma sein Vorzeichen wechselt. Er legt das Regime fest, das darüber entscheidet, ob sich das Hedging rund um die Walls gegen eine Bewegung stemmt oder sie verstärkt. Siehe [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip)
- **Max Pain** ist eine Berechnung des Verfallswerts: der Strike, bei dem die Optionen, die für diesen Verfall offen sind, insgesamt den geringsten inneren Wert hätten. Er ist keine Gamma-Konzentration und kann deshalb weit von beiden Walls entfernt liegen. Siehe [Max Pain erklärt](/education/max-pain-explained).
- Die **Walls** sind die beiden dichtesten Gamma-Strikes beiderseits des Spots.

---

## Was dir der Abstand zwischen den Walls sagt

Die beiden Walls enthalten zusammen mehr Information als jede für sich allein. Die Lücke zwischen ihnen ist die Spanne, mit der die aktuelle Positionierung am ehesten vereinbar ist, und ihre Form lässt sich auf zwei Arten lesen.

**Breite.** Eine enge Wall-Spanne bedeutet, dass Gamma auf beiden Seiten nahe am Spot konzentriert ist. In einem Regime mit positivem Gamma ist das das klassische Pinning-Setup - Hedging stemmt sich in beide Richtungen gegen Bewegungen. Eine weite Spanne bedeutet, dass die nächsten dichten Strikes weit entfernt sind, sodass dazwischen weniger konzentriertes Hedging liegt und der Preis weiter laufen kann, bevor er auf welches trifft.

**Asymmetrie.** Der Spot sitzt selten in der Mitte. Wenn eine Wall deutlich näher liegt als die andere, ist die nahe Wall das Level, das tatsächlich getestet wird, und die ferne ist überwiegend Kontext. Ein Spot 0,3 % unter der Call Wall und 1,4 % über der Put Wall ist ein anderer Tag als ein Spot auf halbem Weg zwischen beiden: Der erste hat einen kurzfristigen Entscheidungspunkt, der zweite nicht.

Die Falle besteht darin, Breite oder Asymmetrie ohne das Regime zu lesen. Beide Lesarten oben setzen positives Gamma voraus. Unterhalb des Flips ist dieselbe enge Spanne kein Pin - sie ist eine kurze Distanz zwischen zwei Levels, und Hedging verstärkt eine Bewegung durch jedes der beiden. Um alle drei Lesarten - Breite, Asymmetrie und Regime - auf den heutigen Markt anzuwenden, prüfe den [aktuellen Gamma Flip, die Call Wall und die Put Wall von SPX](/spx-gamma-levels).

---

## Wie sich Gamma Walls intraday verschieben

Walls werden nicht beim Open verkündet, um dann bis zum Close zu halten. Sie wandern, und zwar aus zwei getrennten Gründen. Zwischen den Sessions ändert sich das Open Interest, wenn Positionen eröffnet und geschlossen werden, und die offiziellen Zahlen werden nach dem Clearing aktualisiert. Innerhalb einer Session verschiebt sich das Ranking der Strikes bei unverändertem Open Interest trotzdem, weil das Gamma, das jeder Kontrakt trägt, neu bewertet wird. Drei häufige Muster:

1. **Gamma-Neubewertung.** Spot, Restlaufzeit und implizite Volatilität verändern das modellierte Gamma jedes Strikes und können das Ranking ändern, selbst wenn das offizielle OI unverändert bleibt.
2. **Spot-seitige Zulässigkeit.** Ein Strike kann von einer Seite des Spots auf die andere wechseln, während ein anderer Strike mit unverändertem OI zur größten zulässigen Konzentration wird. Das offizielle OI wird in der Regel nach dem Clearing aktualisiert; eine Wall-Migration im Tagesverlauf belegt nicht, dass Kunden am neuen Strike Positionen eröffnet haben.
3. **Konzentration nahe dem Verfall.** ATM-Gamma kann stark steigen, während das Gamma deutlich ITM- oder OTM-liegender Strikes gegen null geht, was das Ranking verändert. Diese Neubewertung ist etwas anderes als das Schließen von Positionen oder eine Aktualisierung des offiziellen OI nach dem Clearing.

Eine Wall kann sich auch allein deshalb verschieben, weil sich Spot, Zeit und implizite Vol bewegen - der Strike mit der größten modellierten Exposure ändert sich, selbst wenn das Positioning gleich bleibt. Eine Gamma Wall ist der *aktuell* schwerste Strike nach modelliertem Gamma. Behandle sie als lebende Lesart, nicht als feste Linie.

---

## Gamma Walls zum Same-Day-Verfall

0DTE ist der Bereich, in dem sich Wall-Verhalten am extremsten zeigt - in beide Richtungen.

Gamma auf einer Same-Day-Chain ist nahe am Spot sehr groß und fällt von dort rasch ab, sodass die Walls eng am Preis liegen und die Konzentration an ihnen weit schwerer ist als auf einer länger laufenden Chain. Wenn das Regime es stützt, erzeugt das das stärkste Pinning, das man wahrscheinlich zu sehen bekommt - der Preis mahlt in einem engen Band zwischen zwei Walls, die nur wenige Punkte auseinanderliegen.

Dieselbe Konzentration macht diese Walls instabil. Weil 0DTE-Gamma sich mit dem Spot und mit der laufenden Uhr scharf neu bewertet, kann eine 0DTE-Wall innerhalb einer Stunde mehrfach wandern, ohne dass eine einzige neue Position eröffnet wurde. Walls können auch verschwinden: Sobald Strikes deutlich im oder aus dem Geld landen, geht ihr modelliertes Gamma gegen null, und das Ranking sortiert sich um das herum neu, was nahe am Spot übrig bleibt.

Zwei praktische Konsequenzen. Eine 0DTE-Wall-Lesart hat eine viel kürzere Haltbarkeit als dieselbe Lesart auf einer Monats-Chain - Minuten statt Stunden. Und sobald der Preis in einem Regime mit negativem Gamma eine 0DTE-Wall überwindet, bleibt zwischen ihr und dem nächsten Level oft wenig dichtes Gamma übrig, was mit erklärt, warum Brüche spät in der Session an Verfallstagen so weit und so schnell laufen können.

---

## Wann Walls halten und wann sie brechen

Walls sind keine Vorhersagen, und wir haben gemessen, wie oft sie nachgeben. In 737 Wall-Tests bei SPY, SPX, QQQ und NDX über zehn Wochen im Jahr 2026 hielten S&P-Walls in etwa zwei von drei Fällen innerhalb einer Stunde nach dem Test und Nasdaq-Walls in etwa der Hälfte der Fälle ([Wie oft brechen Gamma Walls tatsächlich?](/education/how-often-do-gamma-walls-break)). Diese Grundrate des jeweiligen Index ist die beste verfügbare Ausgangsannahme, und keine der Bedingungen, zu denen Trader üblicherweise greifen, konnte sie verbessern:

**Von uns getestete Bedingungen ohne Vorhersagekraft für einen Bruch:**

- Auf welcher Seite des Flips der Spot lag - positives oder negatives Gamma.
- Die Größe der Wall, ihr Anteil am Buch und ihr Rang gemessen an ihrer eigenen Historie. Größere Walls brachen etwas seltener, aber der Unterschied war zu schwach, um ihn vom Rauschen zu trennen.
- Das Net GEX, seine Entwicklung und der Abstand zum Flip.
- Ob die Wall mit dem Preis wanderte und ob ihr Gamma zunahm oder aufgezehrt wurde.
- Vorzeichenbehafteter Flow am Wall-Strike, ob sich dieser Flow beschleunigte, und die realisierte Volatilität.
- Wie lange die Wall schon bestand, wie oft sie bereits getestet worden war, und die Tageszeit.

**Was das Regime stattdessen verändert:**

- Bei positivem Gamma (oberhalb des Flips) stemmt sich das modellierte Hedging gegen eine Bewegung auf die Wall zu, was sie bremsen oder den Preis nahe am Strike festhalten kann.
- Bei negativem Gamma (unterhalb des Flips) läuft das modellierte Hedging mit der Bewegung, sodass das Hedging, wenn die Wall nachgibt, den Bruch verstärkt, statt ihn zu dämpfen.

Die meisten davon lassen sich in Echtzeit ablesen, und keine davon sagt dir, ob diese Wall halten wird. Ein Makro-Katalysator (CPI, FOMC, NFP, eine geopolitische Schlagzeile), der während eines Tests eintrifft, kann das Hedging in jedem der beiden Regime überwältigen. Nutze die Grundrate des Index als Ausgangsannahme und das Regime als Beschreibung dessen, was das Hedging rund um das Level tut, nicht als Wahrscheinlichkeit.

---

## Wie ZeroGEX Call Wall und Put Wall zeigt

Das Dashboard zeigt Walls an zwei Stellen:

- **Wall-Metrik-Karten** zeigen die aktuellen Call-Wall- und Put-Wall-Strikes mit der prozentualen Live-Distanz zum Spot.
- **Das GEX-Walls-Chart** stellt das Strike-für-Strike-Gamma-Profil dar, mit beiden hervorgehobenen Walls.

![ZeroGEX-Dashboard Call-Wall- und Put-Wall-Karten mit prozentualer Distanz zum Spot](/blog/zerogex-walls-cards.png)

Ein durchgerechnetes Beispiel. Angenommen, SPX steht bei 5.830. Das Dashboard zeigt:

- **Call Wall:** 5.850 (+0,34 % vom Spot)
- **Put Wall:** 5.790 (−0,69 % vom Spot)
- **Net GEX:** +1,5 Mrd. $
- **Gamma Flip:** 5.810

Das Net GEX ist hier eine modellierte Schätzung des Dealer-Gammas auf Basis der traditionellen Call-positiv/Put-negativ-Konvention für das Open Interest; der tatsächliche Dealerbestand ist aus öffentlichen Optionsketten-Daten nicht direkt beobachtbar. Die strukturelle Lesart: Der Spot liegt komfortabel oberhalb des Flips (Long-Gamma-Regime), die Wall-Spanne ist asymmetrisch - deutlich näher an der Call Wall als an der Put Wall - und das Net GEX ist gesund. Was dir das sagt: Die Call Wall ist der nähere Test, und eine Rally auf sie zu trifft auf Hedging, das sich laut Modell gegen sie stemmt. Was es dir nicht sagt, ist, ob 5.850 hält. SPX-Walls hielten in unserer Messung in etwa zwei von drei Fällen innerhalb einer Stunde, unabhängig davon, auf welcher Seite des Flips der Preis stand. Ein Rückgang unter 5.810 würde den Mechanismus ändern, nicht diese Quote: Das Hedging würde beginnen, Bewegungen zu verstärken, statt sie zu dämpfen.

![ZeroGEX-GEX-Walls-Chart mit Hervorhebung von Call Wall und Put Wall im Strike-für-Strike-Gamma-Profil](/blog/zerogex-walls-chart.png)

Stell dir nun vor, die Call Wall migriert nach oben auf 5.855, während der Preis 5.848 austestet. Diese Migration ist ein Datenpunkt - der Strike, den du beobachtet hast, ist nicht mehr der schwerste, das Level, gegen das du tradest, hat sich also verschoben. Für sich genommen ist sie kein Zeichen dafür, dass der Breakout Bestand haben wird: In unserer Messung ließ sich daran, ob eine Wall mit dem Preis wanderte, nicht vorhersagen, ob sie brach.

---

## Häufige Missverständnisse

Ein paar Fallen:

- **"Walls sind harter Support/Widerstand."** Sie sind strukturelle Tendenzen. Echter Flow durchbricht sie regelmäßig: In unserer Messung brachen S&P-Walls bei etwa jedem dritten Test innerhalb einer Stunde, Nasdaq-Walls bei etwa der Hälfte.
- **"Der Strike mit dem größten Open Interest ist immer die Wall."** Walls werden nach Gamma-Exponierung gewichtet, nicht nach rohem OI. Ein Strike nahe am ATM kann einen weit-OTM-Strike mit doppeltem Open Interest dominieren.
- **"Walls sind für die Sitzung statisch."** Sie migrieren. Eine Wall, die sich in zwei Stunden nicht bewegt hat, ist eine Lesart; eine Wall, die dreimal mit dem Preis gewandert ist, ist eine ganz andere.
- **"Walls funktionieren in jedem Regime gleich."** Für das Hedging gilt das nicht: Bei positivem Gamma stemmt es sich gegen eine Bewegung auf die Wall zu, bei negativem Gamma verstärkt es eine Bewegung durch sie hindurch. Wie oft Walls brachen, änderte sich in unserer Messung nicht mit dem Regime; was sich ändert, ist, was das Hedging rund um den Bruch tut.
- **"Die Call Wall ist bullisch, die Put Wall bärisch."** Keine von beiden ist gerichtet, und der Optionstyp allein legt das Verhalten nicht fest. Es sind Gamma-Konzentrationslevels, deren Wirkung vom Vorzeichen des modellierten Dealer-Gammas und vom umgebenden Flow abhängt - also davon, auf welcher Seite des Flips du dich befindest.

---

## Fazit

> Gamma Walls sind reale Positionierung, keine Psychologie. Sie skizzieren die strukturelle Spanne, und der Gamma Flip sagt dir, ob sich das Hedging rund um diese Walls gegen Bewegungen stemmt oder sie verstärkt. Ob eine bestimmte Wall hält, ist eine Frage der Grundrate, nicht der Lesart: S&P-Walls halten innerhalb einer Stunde bei etwa zwei von drei Tests, Nasdaq-Walls bei etwa der Hälfte.

Lies zuerst das Regime. Lies dann die Wall. Lies drittens die Wall-Migration. Diese Reihenfolge sagt dir, was das Dealer-Hedging rund um das Level tut - den Unterschied zwischen dem Faden einer Rally, die das Dealer-Buch mit dir gemeinsam fadet, und dem Faden einer Rally, die dasselbe Dealer-Buch gleich jagen wird. Sie sagt dir nicht, ob diese bestimmte Wall halten wird; dafür ist die Grundrate des Index der beste Anhaltspunkt, den wir gemessen haben.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige Call Wall und Put Wall sehen möchtest, zeigen [die kostenlosen ZeroGEX-Gamma-Levels](/gex-levels) beide für SPX, SPY, QQQ, NDX, ES und NQ zusammen mit dem Gamma Flip und dem Net GEX, rund 15 Minuten verzögert; die bezahlten Pläne zeigen sie [im Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte). Für den breiteren Überblick über Gamma-Exposure-Tools siehe [den Leitfaden zu den besten GEX-Tools](/education/best-gex-tools).
