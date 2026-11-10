# Max Pain erklärt - und funktioniert es wirklich?

*Max Pain ehrlich erklärt - was es ist, die Theorie, mit der es begründet wird, die Belege dafür, ob Max Pain den Preis tatsächlich bewegt, und wie man es nutzt, ohne es überzubewerten.*

---

## Warum diese Frage es wert ist, gestellt zu werden

Max Pain ist eines dieser Konzepte, das in zwei sehr unterschiedlichen Welten lebt. In der Retail-Optionswelt wird es fast wie ein Naturgesetz zitiert - *"der Preis wird zum Verfall zum Max Pain gezogen."* In der institutionellen Welt wird es als volkstümliche Theorie behandelt, die gelegentlich echtes Pinning beschreibt, aber wahrscheinlich Anerkennung für Effekte bekommt, die eigentlich von etwas anderem getrieben werden. Die Wahrheit liegt, wie so oft, dazwischen - aber näher an der institutionellen als an der Retail-Sichtweise.

Dieser Beitrag ist die ehrliche Lektüre. Wir definieren Max Pain, gehen durch, wie es berechnet wird, legen die Theorie dar, mit der es begründet wird, und schauen uns dann an, was die verfügbaren Belege tatsächlich dazu nahelegen, ob Max Pain den Preis *bewegt* oder nur *beschreibt*, wo der Preis am Ende landet. Durchgängig ist das Ziel, dir ein nutzbares mentales Modell zu vermitteln - kein Vorhersageinstrument, aber auch keine Entlarvung.

Zum Kontext: Max Pain interagiert direkt mit dem breiteren Framework zur Dealer-Positionierung. Falls noch nicht geschehen, deckt der [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained) die strukturellen Mechanismen ab, und die Beiträge [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip) und [Gamma Walls erklärt](/education/gamma-walls-explained) decken die Levels ab, mit denen Max Pain oft verwechselt wird.

---

## Was ist Max Pain?

Max Pain ist der hypothetische Settlement-Preis, der die aggregierte Auszahlung aus innerem Wert über die ausgewählte Optionskette minimiert. Das ist mathematisch nicht identisch damit, den Nominalwert der wertlos verfallenden Optionen zu maximieren.

Wenn Trader fragen "Was ist Max Pain?", stellen sie meist eine von zwei verwandten Fragen: *welchen Strike die Struktur der Chain zum Verfall begünstigt*, oder *zu welchem Strike der Preis der Struktur des Optionsmarktes zufolge gravitieren könnte*. Beide Formulierungen sind vernünftig. Die erste ist eine definitorische Tatsache; die zweite ist eine Hypothese darüber, ob diese strukturelle Tatsache einen Verhaltenseffekt auf den Preis hat.

Die Intuition: Bei jedem gegebenen Strike stellt jeder im Geld liegende Call und jeder im Geld liegende Put eine Auszahlung dar, die seinem Inhaber zum Verfall geschuldet wird. Über die gesamte Chain summiert, sind diese Auszahlungen eine Funktion davon, wo der Spot landet. Es gibt einen Preis - den Max-Pain-Strike -, der diese Gesamtauszahlung minimiert. Es ist eine Berechnung zur Minimierung der Auszahlung, keine Garantie für das Settlement und keine exakte Zählung wertloser Kontrakte.

Die volkstümliche Theorie macht dann einen Sprung: Wenn Options*schreiber* (oft Dealer, Market Maker oder institutionelle Verkäufer) gemeinsam davon profitieren, dass der Preis bei Max Pain verfällt, drücken die strukturellen Flows im Markt den Preis vielleicht dorthin. Dieser Sprung ist der Teil, den man ehrlich prüfen sollte.

---

## Woher das Konzept kommt

Der Begriff Max Pain stammt aus einem Korpus von Retail-Optionsforschung, der bis in die frühen 2000er zurückreicht und zunächst auf Single-Name-Aktienoptionen rund um monatliche Verfallstermine angewendet wurde. Die ursprüngliche Beobachtung war empirisch: dass sich Schlusskurse an der monatlichen OPEX, besonders bei Einzelaktien mit konzentriertem Open Interest, in der Nähe des Strikes zu häufen schienen, der die Auszahlung an Optionsinhaber minimierte.

Diese Häufung war real. Der Mechanismus, der sie erzeugte - und wie zuverlässig er sich verallgemeinern lässt - ist deutlich umstrittener. Mehrere unterschiedliche Mechanismen könnten dieselbe Beobachtung erzeugen:

1. **Dealer-Gamma-Pinning** an schweren Strikes (was oft mit Max Pain zusammenfällt).
2. **Echte Manipulation** durch große Optionsschreiber, in Märkten, in denen das plausibel ist.
3. **Selektionsverzerrung** - die Beobachtung konzentriert sich auf die Fälle, in denen Pinning auftrat, und ignoriert die Fälle, in denen es nicht auftrat.
4. **Open Interest, das sich an psychologisch runden Strikes konzentriert**, in deren Nähe der Preis bereits lag.

Diese Mechanismen zu entwirren ist schwierig, und die empirische Literatur ist uneinheitlich. Pinning-Effekte in der Nähe wichtiger monatlicher OPEX-Termine wurden in manchen Studien beobachtet, aber die Effekte sind generell klein und verblassen oder verschwinden oft in größeren Stichproben und bei Indexprodukten.

---

## Wie wird Max Pain berechnet?

Die Berechnung ist mechanisch:

1. Für jeden Strike auf der Optionskette wird angenommen, der Spot verfalle bei diesem Strike.
2. Der gesamte innere Wert aller im Geld liegenden Calls wird berechnet (`max(0, S − K) × OI`) bei diesem hypothetischen Schluss.
3. Der gesamte innere Wert aller im Geld liegenden Puts wird berechnet (`max(0, K − S) × OI`) bei diesem hypothetischen Schluss.
4. Beide werden addiert - das ist die gesamte Auszahlung an Optionsinhaber bei diesem hypothetischen Schluss.
5. Dies wird über alle Strikes wiederholt; derjenige mit dem niedrigsten Gesamtwert ist der Max-Pain-Strike.

Die Berechnung verwendet nur **Open Interest** und **Strikes** - keine Griechen, keine implizite Volatilität, keine Annahme zum Dealer-Vorzeichen. Das macht sie günstig und einfach zu berechnen, was ein Grund dafür ist, warum sie sich verbreitet hat. Es ist auch ein Grund dafür, warum sie strukturell schwächer ist als Lesarten auf Basis des Dealer-Gammas: Sie weiß nichts darüber, wie Dealer tatsächlich hedgen.

Das Ergebnis ist ein einzelner Strike (oder manchmal ein kleiner Bereich nahezu gleicher Strikes), neu berechnet bei jeder Momentaufnahme der Chain. Max Pain ist allerdings nur so aktuell wie sein Open-Interest-Input: Das offizielle OI wird in der Regel über das Clearing berechnet und für die *nächste* Session veröffentlicht, nicht laufend intraday bestätigt. Jede Intraday-Bewegung einer Max-Pain-Zahl spiegelt daher geschätzte oder abgeleitete Positionierung wider, nicht verifiziertes neues OI - und von Session zu Session bis zum Verfall verschiebt sie sich, wenn das bestätigte OI aktualisiert wird.

---

## Die Theorie: warum Max Pain "funktionieren sollte"

Das Standardargument ist mechanistisch:

1. Optionsschreiber (Dealer, Market Maker und institutionelle Verkäufer) zahlen gemeinsam den im Geld liegenden Teil des Optionsbuchs zum Verfall aus.
2. Sie haben ein Interesse daran, diese Auszahlung zu minimieren.
3. Daher haben sie ein Interesse daran, dass der Spot bei dem Strike verfällt, der die Gesamtauszahlung minimiert - dem Max-Pain-Strike.
4. Durch ihre Hedging- oder Handelsaktivität üben sie strukturellen Druck aus, um den Spot in Richtung dieses Strikes zu drücken, besonders nahe am Verfall.

Das ist eine saubere Geschichte. Und genau hier muss die Ehrlichkeit ansetzen. Das Argument hat mehrere Schwachstellen:

- **Dealer führen delta-neutrale Bücher.** Ihr P&L wird von der Spread-Vereinnahmung dominiert, nicht von direktionalen Ergebnissen zum Verfall. Die Vorstellung "Dealer wollen den Preis bei Max Pain" setzt ein direktionales Buch voraus, das sie in der Regel nicht haben.
- **Der Hedging-Mechanismus ist nicht das Schreiber-Auszahlungs-Argument.** Wenn Dealer den Preis tatsächlich in der Nähe eines Strikes fixieren, geschieht das üblicherweise über *Gamma*-Hedging - den Reflex, der sie zwingt, Stärke zu verkaufen und Schwäche zu kaufen, wenn sie long Gamma sind - was ein anderer Mechanismus ist, manchmal auf einen anderen Strike gerichtet als Max Pain.
- **Die "Manipulations"-Version der Geschichte** - große Schreiber, die aktiv den Basiswert handeln, um einen Strike zu verteidigen - ist in manchen dünnen Single-Name-Märkten plausibel und in liquiden Indexprodukten wie SPX deutlich weniger plausibel.

Mit anderen Worten: Das *Ergebnis*, das die Max-Pain-Theorie vorhersagt (der Preis gravitiert zu einem strukturellen Strike), tritt manchmal ein, aber der *Mechanismus*, den sie anführt, ist meist nicht der tatsächliche Mechanismus.

---

## Funktioniert Max Pain wirklich?

Die ehrliche Antwort lautet: **manchmal, schwach, und meist weil etwas anderes die Arbeit übernimmt.**

Einige Formulierungen, die standhalten:

### Der sauberere Mechanismus ist Gamma-Pinning, nicht Auszahlungsminimierung

Wenn sich der Preis zum Verfall *tatsächlich* in der Nähe eines strukturellen Strikes fixiert - besonders bei der monatlichen OPEX bei Indexprodukten -, ist der plausiblere Mechanismus meist modelliertes Dealer-Gamma-Hedging in einem positiven Gamma-Regime, nicht das Schreiber-Auszahlungs-Argument hinter Max Pain. Gamma konzentriert sich an Strikes mit schwerem Open Interest, und in einem modellierten Long-Gamma-Regime kann der Dealer-Reflex den Preis durch gewöhnliche Hedging-Aktivität zu Strikes mit schwerem Gamma ziehen.

Max Pain fällt oft mit starker Gamma-Konzentration zusammen (beide sind Funktionen davon, wo das OI liegt), weshalb die beiden Lesarten häufig übereinstimmen. Aber wenn sie *voneinander abweichen*, tendiert die gamma-basierte Lesart dazu, die verlässlichere zu sein - weil sie in einem Hedging-Mechanismus verankert ist, den Dealer plausiblerweise betreiben, nicht in einem direktionalen Buch, das sie in der Regel nicht haben.

### Der Effekt, wo vorhanden, ist klein und konzentriert sich auf große OPEX-Termine

Studien zu Pinning-Effekten bei Aktienoptionen haben generell eine kleine, aber messbare Häufung von Schlusskursen in der Nähe von Strikes mit schwerem OI bei monatlichen Verfallsterminen gefunden, besonders bei Single-Name-Aktien. Bei SPX- und Indexprodukten ist der Effekt deutlich schwerer zu finden und in der Größenordnung deutlich kleiner. Selbst wo er beobachtet wurde, wird der Effekt generell in zweistelligen Basispunkten erwarteter Drift über die letzte Session gemessen - weit kleiner als die typische realisierte Tagesspanne.

### Meist wird es als Beschreibung diskutiert, nicht als Vorhersage

Selbst Trader, die Max Pain genau beobachten, nutzen es tendenziell als **Kontext**, nicht als ein Level, gegen das man tradet. Die Formulierung lautet "wenn alles andere ausgeglichen ist, erwarte einen gewissen strukturellen Zug in Richtung dieses Strikes nahe am Verfall" - nicht "Max Pain ist X, also wird der Preis dorthin gehen."

### Wo es definitiv nicht funktioniert

Ein paar Formulierungen, die man vermeiden sollte:

- **Max Pain als Intraday-Ziel.** Die Retail-Version der Theorie wird oft bis zu "der Preis bewegt sich heute auf Max Pain zu" gedehnt - es gibt keinen Mechanismus, der das auf Intraday-Horizonten bei liquiden Indexprodukten stützt.
- **Max Pain als harter Pin.** Selbst wo Pinning-Effekte existieren, sind es statistische Tendenzen im Durchschnitt, keine verlässlichen Ergebnisse für jeden einzelnen Verfallstermin.
- **Max Pain in einem tief negativen Gamma-Regime.** Wenn der modellierte Dealer-Reflex Bewegungen verstärkt, statt sie zu dämpfen, bricht jede Pinning-These, die von schweren Strikes ausgeht - Max Pain oder sonst etwas -, tendenziell zusammen. Der Strike kann eher als Breakout-Vektor wirken denn als Magnet.

---

## Max Pain versus der Gamma-Magnet

Der engste mechanische Verwandte von Max Pain ist das, was manchmal als **Gamma-Magnet** bezeichnet wird - der Strike mit der schwersten Dealer-Gamma-Konzentration nahe am Verfall. In einem modellierten positiven Gamma-Regime zieht der Gamma-Magnet den Preis nahe am Verfall oft *tatsächlich* an, über den oben beschriebenen Hedging-Mechanismus.

Der praktische Unterschied:

- **Max Pain** beantwortet: *wo wird die Auszahlung an Optionsinhaber zum Verfall minimiert?*
- **Gamma-Magnet** beantwortet: *wo ist die Dealer-Hedging-Konzentration am schwersten, und in welche Richtung zieht sie?*

Wenn die beiden Strikes nah beieinander liegen - was häufig vorkommt -, stimmen beide Lesarten überein, und der strukturelle Zug ist tendenziell im Tape sichtbar. Wenn sie auseinandergehen, neigt ZeroGEX zur Gamma-Lesart, weil sie auf einen modellierten Hedging-Mechanismus zurückgeht statt nur auf Auszahlungsgeometrie - eine Tendenz, keine Gewissheit, da das Gamma-Vorzeichen selbst aus dem Open Interest modelliert und nicht beobachtet wird.

Ein Trader, der Max Pain allein verwendet, liest den *Output* des Dealer-Buchs, ohne das Dealer-Buch selbst zu lesen. Beides zu lesen - Max Pain *und* das Gamma-Profil - ist der sauberere Workflow.

---

## Wie man Max Pain nutzt, ohne es überzubewerten

Eine pragmatische Formulierung:

1. **Behandle Max Pain als Kontext, nicht als Ziel.** Es ist ein struktureller Datenpunkt darüber, wo die Chain ausgeglichen ist; es ist keine Prognose.
2. **Prüfe es gegen den Gamma-Magneten.** Wenn der Strike mit dem schwersten Gamma und Max Pain übereinstimmen, ist die Pin-These (wo sie überhaupt existiert) schärfer. Wenn sie divergieren, greife standardmäßig auf die Gamma-Lesart zurück.
3. **Gewichte es am stärksten nahe der monatlichen OPEX, am wenigsten intraday.** Der schwache Effekt, der existiert, konzentriert sich auf die Nähe zum Verfall. Max Pain intraday an einem gewöhnlichen Dienstag zu lesen, sagt dir sehr wenig.
4. **Lies immer zuerst das Regime.** Ein modelliertes Long-Gamma-Regime ist das Umfeld, in dem eine Pinning-These - Max Pain oder sonst etwas - den klarsten Dealer-Hedging-Mechanismus hinter sich hat (Liquidität und Verfallsmechanik können so oder so trotzdem beitragen). In einem Short-Gamma-Regime wirkt dieser Mechanismus gegen den Pin, also begegne Pin-Thesen mit deutlich mehr Skepsis.
5. **Nutze es, um Trades zu *rahmen*, nicht um in sie *einzusteigen*.** Ein Long-Gamma-Regime, ein Gamma-Magnet, der mit Max Pain ein paar Punkte über dem Spot übereinstimmt, und ein OPEX-Termin könnten zusammen für das Verkaufen von Rallys in das Level hinein sprechen. Nichts davon allein ist ein Trade.

---

## Wie ZeroGEX Max Pain darstellt

Das Dashboard zeigt Max Pain neben den Dealer-Gamma-Lesarten an, sodass sie gegeneinander geprüft statt isoliert gelesen werden können:

- **Die Max-Pain-Karte** zeigt den aktuellen Max-Pain-Strike mit Live-Abstand zum Spot in Dollar und Prozent.
- **Die Gamma-Flip-Karte** zeigt, ob sich der Spot im modellierten Long-Gamma-Regime (wo Pinning-Thesen den klarsten Mechanismus haben) oder im Short-Gamma-Regime (wo dieser Mechanismus gegen sie wirkt) befindet.
- **Die Call-Wall- und Put-Wall-Karten** zeigen, wo die Dealer-Gamma-Konzentration tatsächlich sitzt.
- **Das Strike-Profil-Chart** zeigt die modellierte Dealer-Gamma-Kurve - geschätzt nach der traditionellen Call-positiv/Put-negativ-Konvention, kein beobachteter Bestand -, sodass der Gamma-Magnet direkt sichtbar ist.

![Max-Pain-Karte im ZeroGEX-Dashboard mit Live-Abstand zum Spot](/blog/zerogex-max-pain-card.png)

Ein durchgerechnetes Beispiel. Angenommen, SPX steht am Morgen einer monatlichen OPEX bei 5.830, und das Dashboard zeigt:

- **Max Pain:** 5.820
- **Gamma-Magnet (Strike mit schwerstem Gamma):** 5.820
- **Net GEX:** +1,6 Mrd. $
- **Gamma Flip:** 5.805

Sowohl die Max-Pain- als auch die Gamma-Konzentrations-Lesart stimmen bei 5.820 überein, das Regime ist solide long-gamma, und es ist monatliche OPEX. Die strukturelle Lesart: Die These des Zugs Richtung 5.820 ist so gut gestützt, wie es nur geht. Praktische Tendenz: Drift Richtung 5.820, Verkaufen von Rallys darüber, Kaufen von Dips bis dorthin. Immer noch eine probabilistische Tendenz - keine Garantie -, aber jede strukturelle Bedingung, die Pinning *erzeugen würde*, ist aktiv.

![ZeroGEX-Strike-Profil-Chart, das den Gamma-Magneten am selben Strike wie Max Pain zeigt](/blog/zerogex-max-pain-gamma-agreement.png)

Nun stelle dir einen anderen Morgen vor: SPX bei 5.830, Max Pain bei 5.810, aber der Strike mit dem schwersten Gamma liegt bei 5.840 und Net GEX bei −400 Mio. $. Die Lesarten stimmen nicht überein, das Regime ist short-gamma, und es ist eine gewöhnliche Session ohne Verfall. Die strukturelle Lesart: Max Pain *beschreibt* eine Auszahlungsgeometrie der Chain, zeigt aber nicht auf ein Level, das das Dealer-Buch verteidigen wird. Die ehrliche Vorgehensweise ist, Max Pain in diesem Zustand zu ignorieren und sich stattdessen auf die Regime-Lesart zu verlassen.

---

## Häufige Missverständnisse über Max Pain

Ein paar Fallen:

- **"Der Preis wird zum Verfall zum Max Pain gezogen."** Eine schwache Tendenz in manchen Single-Name-OPEX-Fällen, deutlich schwächer bei Indexprodukten, und abwesend in Short-Gamma-Regimen. Keine Regel.
- **"Max Pain ist da, wo der Chart heute schließen wird."** Fast nie als Intraday- oder Tagesziel nützlich.
- **"Große Schreiber manipulieren den Preis Richtung Max Pain."** Unplausibel bei der Größenordnung liquider Indexprodukte. Plausibel in manchen dünnen Single-Name-Märkten, aber trotzdem nicht der dominante Mechanismus für den beobachteten Effekt.
- **"Max Pain und der Gamma Flip sind dasselbe."** Sind sie nicht. Der Flip ist die Regime-Linie; Max Pain ist ein Strike der Auszahlungsgeometrie. Sie beantworten unterschiedliche Fragen.
- **"Max Pain ist ein Contrarian-Indikator."** Es ist nicht dafür gebaut, einer zu sein. Es so zu behandeln, fügt nur Rauschen hinzu.

---

## Fazit

> Max Pain ist eine echte Berechnung, die eine echte Chain-Geometrie beschreibt. Es ist kein verlässlicher Preisprädiktor.

Die klarste Formulierung ist diese: Max Pain fällt oft mit starker Gamma-Konzentration zusammen, und *das* ist der strukturelle Zug, den Trader manchmal nahe am Verfall beobachten. Wenn Max Pain und der Gamma-Magnet in einem Long-Gamma-Regime nahe der OPEX übereinstimmen, ist die Pin-These am stärksten - und selbst dann ist es eine probabilistische Tendenz. Wenn sie voneinander abweichen, ist die Gamma-Lesart die verlässlichere.

Als Kontext innerhalb eines breiteren Frameworks zur Dealer-Positionierung genutzt, ist Max Pain eine nützliche Gegenprobe. Als eigenständige Prognose genutzt, führt es tendenziell in die Irre.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.

---

Wenn du den heutigen Max Pain zusammen mit dem Gamma Flip, den Call- und Put-Walls und dem Dealer-Gamma-Profil sehen möchtest, das entscheidet, ob eine Pin-These einen Mechanismus dahinter hat, zeigen dir [die kostenlosen ZeroGEX-Gamma-Levels-Seiten](/spx-gamma-levels) all das für SPX, SPY, QQQ und NDX, rund 15 Minuten verzögert. Die bezahlten Pläne zeigen dieselbe Lesart [im Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte).
