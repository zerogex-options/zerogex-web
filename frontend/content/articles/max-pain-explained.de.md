# Max Pain erklärt — und funktioniert es wirklich?

*Max pain ehrlich erklärt — was es ist, die Theorie, mit der es begründet wird, die Belege dafür, ob max pain den Preis tatsächlich bewegt, und wie man es nutzt, ohne es überzubewerten.*

---

## Warum diese Frage es wert ist, gestellt zu werden

Max pain ist eines dieser Konzepte, das in zwei sehr unterschiedlichen Welten lebt. In der Retail-Optionswelt wird es fast wie ein Naturgesetz zitiert — *"der Preis wird zum Verfall zum max pain gezogen."* In der institutionellen Welt wird es als volkstümliche Theorie behandelt, die gelegentlich echtes Pinning beschreibt, aber wahrscheinlich Anerkennung für Effekte bekommt, die eigentlich von etwas anderem getrieben werden. Die Wahrheit liegt, wie so oft, dazwischen — aber näher an der institutionellen als an der Retail-Sichtweise.

Dieser Beitrag ist die ehrliche Lektüre. Wir definieren max pain, gehen durch, wie es berechnet wird, legen die Theorie dar, mit der es begründet wird, und schauen uns dann an, was die verfügbaren Belege tatsächlich darüber aussagen, ob max pain den Preis *bewegt* oder nur *beschreibt*, wo der Preis am Ende landet. Durchgängig ist das Ziel, ein nutzbares mentales Modell zu vermitteln — kein Vorhersageinstrument, aber auch keine Entlarvung.

Zum Kontext: max pain interagiert direkt mit dem breiteren Framework zur Dealer-Positionierung. Falls noch nicht geschehen, deckt der [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained) die strukturellen Mechanismen ab, und die Beiträge [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip) und [Gamma Walls erklärt](/education/gamma-walls-explained) decken die Levels ab, mit denen max pain oft verwechselt wird.

---

## Was ist max pain?

Max pain ist der Strike, bei dem die Gesamtauszahlung an Optionsinhaber zum Verfall minimiert würde — gleichbedeutend der Strike, bei dem das größte aggregierte Nominalvolumen an Optionen wertlos verfällt.

Wenn Trader fragen "was ist max pain," stellen sie meist eine von zwei verwandten Fragen: *welcher Strike ist die Chain-Struktur so aufgebaut, dass sie ihn zum Verfall begünstigt*, oder *auf welchen Strike deutet die Struktur des Optionsmarktes hin, dass der Preis dorthin gravitieren könnte*. Beide Formulierungen sind vernünftig. Die erste ist eine definitorische Tatsache; die zweite ist eine Hypothese darüber, ob diese strukturelle Tatsache einen Verhaltenseffekt auf den Preis hat.

Die Intuition: Bei jedem gegebenen Strike stellt jeder im Geld liegende Call und jeder im Geld liegende Put eine Auszahlung dar, die seinem Inhaber zum Verfall geschuldet wird. Über die gesamte Chain summiert, sind diese Auszahlungen eine Funktion davon, wo der Spot landet. Es gibt einen Preis — den max-pain-Strike —, der diese Gesamtauszahlung minimiert. Verfällt der Preis dort, verfällt der größte Dollarbetrag an Long-Optionspositionen wertlos.

Die volkstümliche Theorie macht dann einen Sprung: Wenn Options*schreiber* (oft Dealer, Market Maker oder institutionelle Verkäufer) gemeinsam davon profitieren, dass der Preis zum max pain verfällt, drücken die strukturellen Flows im Markt den Preis vielleicht dorthin. Dieser Sprung ist der Teil, den man ehrlich prüfen sollte.

---

## Woher das Konzept kommt

Der Begriff max pain stammt aus einem Korpus von Retail-Optionsforschung, der bis in die frühen 2000er zurückreicht und zunächst auf Single-Name-Aktienoptionen rund um monatliche Verfallstermine angewendet wurde. Die ursprüngliche Beobachtung war empirisch: dass sich Schlusskurse an der monatlichen OPEX, besonders bei Einzelaktien mit konzentriertem Open Interest, in der Nähe des Strikes zu häufen schienen, der die Auszahlung an Optionsinhaber minimierte.

Diese Häufung war real. Der Mechanismus, der sie erzeugte — und wie zuverlässig er sich verallgemeinern lässt — ist deutlich umstrittener. Mehrere unterschiedliche Mechanismen könnten dieselbe Beobachtung erzeugen:

1. **Dealer-Gamma-Pinning** an schweren Strikes (was oft mit max pain zusammenfällt).
2. **Echte Manipulation** durch große Optionsschreiber, in Märkten, in denen das plausibel ist.
3. **Selektionsverzerrung** — die Beobachtung konzentriert sich auf die Fälle, in denen Pinning auftrat, und ignoriert die Fälle, in denen es nicht auftrat.
4. **Open Interest, das sich an psychologisch runden Strikes konzentriert**, in deren Nähe der Preis bereits lag.

Diese Mechanismen zu entwirren ist schwierig, und die empirische Literatur ist uneinheitlich. Pinning-Effekte in der Nähe wichtiger monatlicher OPEX-Termine wurden in manchen Studien beobachtet, aber die Effekte sind generell klein und verblassen oder verschwinden oft in größeren Stichproben und bei Indexprodukten.

---

## Wie wird max pain berechnet?

Die Berechnung ist mechanisch:

1. Für jeden Strike auf der Optionskette wird angenommen, der Spot verfalle bei diesem Strike.
2. Der gesamte innere Wert aller im Geld liegenden Calls wird berechnet (`max(0, S − K) × OI`) bei diesem hypothetischen Schluss.
3. Der gesamte innere Wert aller im Geld liegenden Puts wird berechnet (`max(0, K − S) × OI`) bei diesem hypothetischen Schluss.
4. Beide werden addiert — das ist die gesamte Auszahlung an Optionsinhaber bei diesem hypothetischen Schluss.
5. Dies wird über alle Strikes wiederholt; derjenige mit dem niedrigsten Gesamtwert ist der max-pain-Strike.

Die Berechnung verwendet nur **Open Interest** und **Strikes** — keine Griechen, keine implizite Volatilität, keine Annahme zum Dealer-Vorzeichen. Das macht sie günstig und einfach zu berechnen, was ein Grund dafür ist, warum sie sich verbreitet hat. Es ist auch ein Grund dafür, warum sie strukturell schwächer ist als Lesarten auf Basis des Dealer-Gammas: Sie weiß nichts darüber, wie Dealer tatsächlich hedgen.

Das Ergebnis ist ein einzelner Strike (oder manchmal ein kleiner Bereich nahezu gleicher Strikes), neu berechnet bei jeder Momentaufnahme der Chain. Wie jedes andere aus der Chain abgeleitete Level ist max pain **dynamisch** — es verschiebt sich, während das OI im Laufe des Tages und von Session zu Session bis zum Verfall rotiert.

---

## Die Theorie: warum max pain "funktionieren sollte"

Das Standardargument ist mechanistisch:

1. Optionsschreiber (Dealer, Market Maker und institutionelle Verkäufer) zahlen gemeinsam den im Geld liegenden Teil des Optionsbuchs zum Verfall aus.
2. Sie haben ein Interesse daran, diese Auszahlung zu minimieren.
3. Daher haben sie ein Interesse daran, dass der Spot bei dem Strike verfällt, der die Gesamtauszahlung minimiert — dem max-pain-Strike.
4. Durch ihre Hedging- oder Handelsaktivität üben sie strukturellen Druck aus, um den Spot in Richtung dieses Strikes zu drücken, besonders nahe am Verfall.

Das ist eine saubere Geschichte. Und genau hier muss die Ehrlichkeit ansetzen. Das Argument hat mehrere Schwachstellen:

- **Dealer führen delta-neutrale Bücher.** Ihr P&L wird von der Spread-Vereinnahmung dominiert, nicht von direktionalen Ergebnissen zum Verfall. Die Vorstellung "Dealer wollen den Preis bei max pain" setzt ein direktionales Buch voraus, das sie in der Regel nicht haben.
- **Der Hedging-Mechanismus ist nicht das Schreiber-Auszahlungs-Argument.** Wenn Dealer den Preis tatsächlich in der Nähe eines Strikes fixieren, geschieht das üblicherweise über **Gamma**-Hedging — den Reflex, der sie zwingt, Stärke zu verkaufen und Schwäche zu kaufen, wenn sie long Gamma sind — was ein anderer Mechanismus ist, manchmal auf einen anderen Strike gerichtet als max pain.
- **Die "Manipulations"-Version der Geschichte** — große Schreiber, die aktiv den Basiswert handeln, um einen Strike zu verteidigen — ist in manchen dünnen Single-Name-Märkten plausibel und in liquiden Indexprodukten wie SPX deutlich weniger plausibel.

Mit anderen Worten: Das *Ergebnis*, das die max-pain-Theorie vorhersagt (der Preis gravitiert zu einem strukturellen Strike), tritt manchmal ein, aber der *Mechanismus*, den sie anführt, ist meist nicht der tatsächliche Mechanismus.

---

## Funktioniert max pain wirklich?

Die ehrliche Antwort lautet: **manchmal, schwach, und meist weil etwas anderes die Arbeit übernimmt.**

Einige Formulierungen, die standhalten:

### Der sauberere Mechanismus ist Gamma-Pinning, nicht Auszahlungsminimierung

Wenn sich der Preis zum Verfall *tatsächlich* in der Nähe eines strukturellen Strikes fixiert — besonders bei der monatlichen OPEX bei Indexprodukten — ist der Mechanismus fast immer Dealer-Gamma-Hedging in einem positiven Gamma-Regime, nicht das Schreiber-Auszahlungs-Argument hinter max pain. Gamma konzentriert sich an Strikes mit schwerem Open Interest, und in Long-Gamma-Regimen zieht der Dealer-Reflex den Preis durch normale Hedging-Aktivität tatsächlich zu Strikes mit schwerem Gamma.

Max pain fällt oft mit starker Gamma-Konzentration zusammen (beide sind Funktionen davon, wo das OI liegt), weshalb die beiden Lesarten häufig übereinstimmen. Aber wenn sie *voneinander abweichen*, tendiert die gamma-basierte Lesart dazu, die verlässlichere zu sein — weil sie in einem Hedging-Mechanismus verankert ist, den Dealer tatsächlich betreiben, nicht in einem direktionalen Buch, das sie in der Regel nicht haben.

### Der Effekt, wo vorhanden, ist klein und konzentriert sich auf große OPEX-Termine

Studien zu Pinning-Effekten bei Aktienoptionen haben generell eine kleine, aber messbare Häufung von Schlusskursen in der Nähe von Strikes mit schwerem OI bei monatlichen Verfallsterminen gefunden, besonders bei Single-Name-Aktien. Bei SPX- und Indexprodukten ist der Effekt deutlich schwerer zu finden und in der Größenordnung deutlich kleiner. Selbst wo er beobachtet wurde, wird der Effekt generell in zweistelligen Basispunkten erwarteter Drift über die letzte Session gemessen — weit kleiner als die typische realisierte Tagesspanne.

### Meist wird es als Beschreibung diskutiert, nicht als Vorhersage

Selbst Trader, die max pain genau beobachten, nutzen es tendenziell als **Kontext**, nicht als ein Level, gegen das man tradet. Die Formulierung lautet "wenn alles andere ausgeglichen ist, erwarte einen gewissen strukturellen Zug in Richtung dieses Strikes nahe am Verfall" — nicht "max pain ist X, also wird der Preis dorthin gehen."

### Wo es definitiv nicht funktioniert

Ein paar Formulierungen, die man vermeiden sollte:

- **Max pain als Intraday-Ziel.** Die Retail-Version der Theorie wird oft bis zu "der Preis bewegt sich heute auf max pain zu" gedehnt — es gibt keinen Mechanismus, der das auf Intraday-Horizonten bei liquiden Indexprodukten stützt.
- **Max pain als harter Pin.** Selbst wo Pinning-Effekte existieren, sind es statistische Tendenzen im Durchschnitt, keine verlässlichen Ergebnisse für jeden einzelnen Verfallstermin.
- **Max pain in einem tief negativen Gamma-Regime.** Wenn der Dealer-Reflex Bewegungen verstärkt, statt sie zu dämpfen, kehrt sich jede Pinning-These, die von schweren Strikes ausgeht — max pain oder sonst etwas — um. Der Strike wird zum Breakout-Vektor, nicht zum Magneten.

---

## Max pain versus der Gamma-Magnet

Der engste mechanische Verwandte von max pain ist das, was manchmal als **Gamma-Magnet** bezeichnet wird — der Strike mit der schwersten Dealer-Gamma-Konzentration nahe am Verfall. In einem positiven Gamma-Regime zieht der Gamma-Magnet den Preis nahe am Verfall oft tatsächlich an, über den oben beschriebenen Hedging-Mechanismus.

Der praktische Unterschied:

- **Max pain** beantwortet: *wo wird die Auszahlung an Optionsinhaber zum Verfall minimiert?*
- **Gamma-Magnet** beantwortet: *wo ist die Dealer-Hedging-Konzentration am schwersten, und in welche Richtung zieht sie?*

Wenn die beiden Strikes nah beieinander liegen — was häufig vorkommt —, stimmen beide Lesarten überein, und der strukturelle Zug ist tendenziell im Tape sichtbar. Wenn sie auseinandergehen, gewinnt meist die Gamma-Lesart, weil der Gamma-Reflex der tatsächliche Hedging-Mechanismus ist, der den Pin erzeugt.

Ein Trader, der max pain allein verwendet, liest den *Output* des Dealer-Buchs, ohne das Dealer-Buch selbst zu lesen. Beides zu lesen — max pain *und* das Gamma-Profil — ist der sauberere Workflow.

---

## Wie man max pain nutzt, ohne es überzubewerten

Eine pragmatische Formulierung:

1. **Behandle max pain als Kontext, nicht als Ziel.** Es ist ein struktureller Datenpunkt darüber, wo die Chain ausgeglichen ist; es ist keine Prognose.
2. **Prüfe es gegen den Gamma-Magneten.** Wenn der Strike mit dem schwersten Gamma und max pain übereinstimmen, ist die Pin-These (wo sie überhaupt existiert) schärfer. Wenn sie divergieren, greife standardmäßig auf die Gamma-Lesart zurück.
3. **Gewichte es am stärksten nahe der monatlichen OPEX, am wenigsten intraday.** Der schwache Effekt, der existiert, konzentriert sich auf die Nähe zum Verfall. Max pain intraday an einem gewöhnlichen Dienstag zu lesen, sagt dir sehr wenig.
4. **Lies immer zuerst das Regime.** Ein Long-Gamma-Regime ist das einzige Regime, in dem irgendeine Pinning-These — max pain oder sonst etwas — einen strukturellen Mechanismus dahinter hat. In Short-Gamma-Regimen verwirf die Pin-These vollständig.
5. **Nutze es, um Trades zu *rahmen*, nicht um in sie *einzusteigen*.** Ein Long-Gamma-Regime, ein Gamma-Magnet, der mit max pain ein paar Punkte über dem Spot übereinstimmt, und ein OPEX-Termin könnten zusammen für das Verkaufen von Rallys in das Level hinein sprechen. Nichts davon allein ist ein Trade.

---

## Wie ZeroGEX max pain darstellt

Das Dashboard zeigt max pain neben den Dealer-Gamma-Lesarten an, sodass sie gegeneinander geprüft statt isoliert gelesen werden können:

- **Die Max-Pain-Karte** zeigt den aktuellen max-pain-Strike mit lebendem Dollar- und Prozentabstand vom Spot.
- **Die Gamma-Flip-Karte** zeigt, ob sich der Spot im Long-Gamma-Regime (wo Pinning-Thesen einen Mechanismus haben) oder im Short-Gamma-Regime (wo sie das nicht haben) befindet.
- **Die Call-Wall- und Put-Wall-Karten** zeigen, wo die Dealer-Gamma-Konzentration tatsächlich sitzt.
- **Das Strike-Profil-Chart** zeigt die Dealer-Gamma-Kurve, sodass der Gamma-Magnet direkt sichtbar ist.

![ZeroGEX-Dashboard Max-Pain-Karte mit lebendem Abstand vom Spot](/blog/zerogex-max-pain-card.png)

Ein durchgerechnetes Beispiel. Angenommen, SPX steht am Morgen einer monatlichen OPEX bei 5.830, und das Dashboard zeigt:

- **Max Pain:** 5.820
- **Gamma-Magnet (Strike mit schwerstem Gamma):** 5.820
- **Net GEX:** +1,6 Mrd. USD
- **Gamma Flip:** 5.805

Sowohl die max-pain- als auch die Gamma-Konzentrations-Lesart stimmen bei 5.820 überein, das Regime ist solide long-gamma, und es ist monatliche OPEX. Die strukturelle Lesart: Die These des Zugs Richtung 5.820 ist so gut gestützt, wie es nur geht. Praktische Tendenz: Drift Richtung 5.820, Verkaufen von Rallys darüber, Kaufen von Dips bis dorthin. Immer noch eine probabilistische Tendenz — keine Garantie —, aber jede strukturelle Bedingung, die Pinning *erzeugen würde*, ist aktiv.

![ZeroGEX-Strike-Profil-Chart, das den Gamma-Magneten am selben Strike wie max pain zeigt](/blog/zerogex-max-pain-gamma-agreement.png)

Nun stelle dir einen anderen Morgen vor: SPX bei 5.830, max pain bei 5.810, aber der Strike mit dem schwersten Gamma liegt bei 5.840 und Net GEX bei −400 Mio. USD. Die Lesarten stimmen nicht überein, das Regime ist short-gamma, und es ist eine gewöhnliche Session ohne Verfall. Die strukturelle Lesart: Max pain *beschreibt* eine Auszahlungsgeometrie der Chain, zeigt aber nicht auf ein Level, das das Dealer-Buch verteidigen wird. Die ehrliche Vorgehensweise ist, max pain in diesem Zustand zu ignorieren und sich stattdessen auf die Regime-Lesart zu verlassen.

---

## Häufige Missverständnisse über max pain

Ein paar Fallen:

- **"Der Preis wird zum Verfall zum max pain gezogen."** Eine schwache Tendenz in manchen Single-Name-OPEX-Fällen, deutlich schwächer bei Indexprodukten, und abwesend in Short-Gamma-Regimen. Keine Regel.
- **"Max pain ist da, wo der Chart heute schließen wird."** Fast nie als Intraday- oder Tagesziel nützlich.
- **"Große Schreiber manipulieren den Preis Richtung max pain."** Unplausibel bei der Größenordnung liquider Indexprodukte. Plausibel in manchen dünnen Single-Name-Märkten, aber trotzdem nicht der dominante Mechanismus für den beobachteten Effekt.
- **"Max pain und der Gamma-Flip sind dasselbe."** Sind sie nicht. Der Flip ist die Regime-Linie; max pain ist ein Strike der Auszahlungsgeometrie. Sie beantworten unterschiedliche Fragen.
- **"Max pain ist ein Contrarian-Indikator."** Es ist nicht dafür gebaut, einer zu sein. Es so zu behandeln, fügt nur Rauschen hinzu.

---

## Fazit

> Max pain ist eine echte Berechnung, die eine echte Chain-Geometrie beschreibt. Es ist kein verlässlicher Preisprädiktor.

Die klarste Formulierung ist diese: Max pain fällt oft mit starker Gamma-Konzentration zusammen, und *das* ist der strukturelle Zug, den Trader manchmal nahe am Verfall beobachten. Wenn max pain und der Gamma-Magnet in einem Long-Gamma-Regime nahe der OPEX übereinstimmen, ist die Pin-These am stärksten — und selbst dann ist es eine probabilistische Tendenz. Wenn sie voneinander abweichen, ist die Gamma-Lesart die verlässlichere.

Als Kontext innerhalb eines breiteren Frameworks zur Dealer-Positionierung genutzt, ist max pain eine nützliche Gegenprobe. Als eigenständige Prognose genutzt, führt es tendenziell in die Irre.

Nur Bildungsinhalt — nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige max-pain-Lesart in Echtzeit sehen möchtest, zusammen mit dem Gamma Flip, den Call- und Put-Walls und dem Dealer-Gamma-Profil, das entscheidet, ob eine Pin-These einen Mechanismus dahinter hat, zeigt das kostenlose ZeroGEX-Dashboard all das.
