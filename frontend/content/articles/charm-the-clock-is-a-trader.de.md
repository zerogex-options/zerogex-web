# Charm: Die Uhr ist ein Trader

*Charm ist die Sensitivität des Deltas gegenüber der Zeit, bei konstant gehaltenen übrigen Inputs. Es schätzt bedingten potenziellen Hedge-Druck - keine geplante Dealer-Order -, wenn Spot, IV und der angenommene Bestand nahe ihren aktuellen Werten bleiben.*

---

## Der Greek, der auf einem leeren Tape handelt

Die meisten Flows brauchen ein Ereignis. Gamma braucht eine Preisbewegung. News brauchen Nachrichten. Charm braucht nichts als die Uhr. Es ist die Sensitivität des Deltas gegenüber dem Verstreichen der Zeit - ∂Δ/∂t, bei konstant gehaltenem Spot und konstanter Vol - und die Zeit vergeht, ganz gleich, ob sich am Tape etwas tut. Ein Dealer kann vor einem Markt sitzen, der sich neunzig Minuten lang keinen Tick bewegt hat, und trotzdem feststellen, dass das modellierte Delta seines Buchs still vor sich hin verfällt, was ihn die ganze Zeit über dazu drängt, Aktien zu verkaufen, um den Hedge im Gleichgewicht zu halten.

Genau das macht Charm eigenartig und, sobald du es einmal siehst, offensichtlich. Die Uhr ist ein Trader - ein modellierter. Sie hört nie auf, sie ändert nie ihre Meinung, und bei festgehaltenen übrigen Inputs zeigt sie die ganze Session über in dieselbe Richtung. Die einzigen offenen Fragen sind, in welche Richtung sie drückt, wie stark der Druck wird und ob die tatsächlichen Spot- und Vol-Bewegungen des Tages ihn intakt lassen.

Dieser Beitrag ist der mechanische Begleittext zu unserem umfassenderen [Erklärartikel zu Vanna und Charm](/education/vanna-and-charm-explained). Jener Artikel ordnet Charm als einen Baustein in die Lesart zum Handelsschluss ein; dieser hier schaut unter die Haube - woher der Drift kommt, warum er sich beschleunigt und wie du ihm einen Dollarbetrag und eine Deadline zuordnen kannst, bevor es so weit ist.

---

## Woher der Drift kommt

Delta ist eng verwandt mit - aber nicht exakt gleich - der risikoneutralen Wahrscheinlichkeit, dass eine Option im Geld endet. Ein Call mit Delta 0,30 ist grob die Art des Marktes zu sagen, dass eine Chance von etwa 30 % besteht, dass diese Option mit Wert verfällt. Diese implizite Wahrscheinlichkeit ist eine laufende Schätzung, und je näher der Verfall rückt, desto mehr muss sie zu einem Verdikt zusammenfallen: Entweder endet die Option im Geld (Delta → 1) oder nicht (Delta → 0), und nur der messerscharfe Grenzfall am Geld bleibt bis zur Schlussglocke unentschieden.

Charm ist die Geschwindigkeit dieses Kollapses. Beobachte eine leicht aus dem Geld liegende Option über einen Nachmittag hinweg, während der Spot festgenagelt bleibt:

- Heute Morgen lag das Delta bei 0,35 - eine reelle Chance auf Auszahlung.
- Zur Mittagszeit, mit weniger Zeit auf der Uhr und unverändertem Spot, Delta 0,28.
- Um 15 Uhr, Delta 0,18.
- Kurz vor Handelsschluss rutscht das Delta Richtung 0.

Nichts hat sich bewegt. Das Delta der Option ist trotzdem um die Hälfte gefallen, rein weil die verbleibende Zeit kürzer geworden ist. Jeder dieser Schritte ist eine Veränderung der Hedge-Ratio, und jede Veränderung zwingt den Dealer, der diese Option hält, seine Aktienposition anzupassen. Diese Anpassung ist der Charm-Flow.

Optionen im Geld machen das Spiegelbild davon und festigen sich von 0,80 in Richtung 1,00, während ihr Ausgang zur nahezu vollständigen Gewissheit wird. Das Netto-Charm des Buchs wird als Summe über alle Strikes modelliert, gewichtet danach, wie viel Open Interest dort liegt und, gemäß der Positionierungskonvention, auf welcher Seite der Dealer annahmegemäß steht - der tatsächliche Dealerbestand ist aus öffentlichen Optionsdaten nicht direkt beobachtbar.

---

## Warum sich der Prozess zum Handelsschluss hin beschleunigt

Charm ist im Tagesverlauf nicht konstant. Die Rate des Deltaverfalls ist klein, solange noch reichlich Zeit bleibt, und wächst, je näher der Verfall rückt - sie ist in der letzten Stunde am größten und in den letzten Minuten am allergrößten, und zwar für die nahe am Geld liegenden Strikes, deren Verdikt noch offen ist. Bei einer Optionskette, die von taggleichen Verfällen dominiert wird - inzwischen der Normalfall bei SPX -, komprimiert sich der Großteil des Tages-Charm-Flows auf die letzten sechzig bis neunzig Minuten.

Das ist der mechanische Grund, warum der "Drift zum Handelsschluss" ein wiederkehrendes Phänomen ist und kein Chart-Aberglaube. Es liegt nicht daran, dass Trader um 15 Uhr emotional werden. Es liegt daran, dass die Mathematik des Deltaverfalls den Großteil ihrer modellierten Kraft genau dort entfaltet, und die Dealer, die diesen Verfall absichern, nehmen den Großteil ihrer Anpassungen tendenziell spät vor - selbst jene, die mit Hedge-Bändern arbeiten, statt kontinuierlich zu handeln. Der modellierte Flow nimmt zu, weil der Greek zunimmt.

Das Live-Chart [Charm into Close](/forced-flow) zeichnet genau das nach: Es hält Spot und Vol fest, lässt die Uhr bis zum Handelsschluss vorlaufen und plottet die kumulative Aktienmenge, die das Dealer-Buch laut Modell bei jedem Schritt handelt. Die Kurve startet bei null im aktuellen Moment und biegt sich im Lauf des Nachmittags von null weg - am steilsten am Ende, weil genau dort Charm zu Hause ist.

---

## Eine Prognose mit Deadline

Hier kommt die Eigenschaft, die Charm einzigartig nützlich macht - und das ist etwas, das du in keiner Standard-Abhandlung über die Greeks findest.

Jeder andere Dealer-Flow ist bedingt. Der Gamma-Flow hängt von einer Spot-Bewegung ab, die kommen kann oder auch nicht. Der Vanna-Flow hängt von einer Vol-Verschiebung ab, die du nicht terminieren kannst. Die Charm-*Komponente* hängt nur von der Zeit ab, und die Zeit ist der eine Input, der exakt das tun wird, was du erwartest. Um 9:35 Uhr morgens kannst du, bei Spot und Vol auf ihrem aktuellen Niveau, schätzen, wie viele Aktien der Zeitverfall *allein* die Dealer bis zum Handelsschluss kaufen oder verkaufen ließe. Du erhältst eine modellierte Größe und Richtung für einen großen Flow Stunden, bevor er sich abspielt - unter der Bedingung, dass der Rest der Welt stillhält, was er nie ganz tut.

Das ist eine Prognose mit Deadline. Die Prognose ist an eine Bedingung geknüpft - "sofern Spot und Vol sich in dieser Nähe halten" -, und sie halten sich selten perfekt, sodass der tatsächliche Handelsschluss Charm mit dem mischt, was die Bewegungen des Tages an Gamma und Vanna erzeugen. Aber die Charm-Komponente lässt sich im Voraus schätzen, wie sonst fast nichts an den Märkten. Sie ist das Nächste an einem vorhersehbaren, kalendergetriebenen Flow, was der Markt zu bieten hat - ein modellierter Druck, den die Uhr vorgibt, keine geplante Order, zu deren Ausführung irgendjemand verpflichtet wäre.

Das ist im Wesentlichen die Zahl, die das [Charm-into-Close-Bulletin](/forced-flow) schon vor der Eröffnung ausweist: *Laut Modell lässt der Zeitverfall allein die Dealer bis zum Handelsschluss \$X kaufen/verkaufen, sofern der Basiswert sich hier hält.* Eine Deadline, eine Richtung und ein Dollarbetrag - alles bereits im Morgengrauen schätzbar.

---

## Eine Zahl darauf setzen

Angenommen, es ist ein Freitag mit starker 0DTE-Positionierung in SPY, Spot bei 560. Das Dealer-Buch enthält die taggleichen Optionen, und während die Uhr Richtung Handelsschluss läuft, muss sich jede einzelne davon auflösen - im Geld verfallen oder wertlos verfallen -, sodass die Deltas, die die Dealer absichern, heftig schwanken. Wird das gesamte Buch zum Handelsschluss mit einem konstant gehaltenen Spot von 560 neu bepreist, kann der gesamte modellierte zeitgetriebene Flow an einem stark von 0DTE geprägten Tag bis in den **Milliardenbereich** reichen. Genau diese Zahl plottet das Live-Chart Charm-into-Close, und das ist es, was "wie viel die Dealer laut Modell bis zum Handelsschluss handeln" in der Praxis bedeutet.

Zwei ehrliche Vorbehalte zu dieser Schlagzeilenzahl. Erstens: Der Großteil davon entfällt auf die taggleichen Optionen, die sich zum Handelsschluss *auflösen* - ein Pin-Effekt, der genau davon abhängt, wo der Spot sich einpendelt, kein gleichmäßiger Verfall - daher ist der Betrag groß und spot-sensitiv. Zweitens: Der reine Charm-Drift, also der Teil, der tatsächlich Zeitverfall des überlebenden Buchs ist und nicht das Verfallsereignis selbst, macht nur einen Bruchteil davon aus: in der Größenordnung von wenigen hundert Millionen, die sich über den Nachmittag hinweg stetig aufbauen. Das Dashboard zeigt beides - den vollständigen Close-Flow und den reinen Charm-Drift -, weil sie unterschiedliche Fragen beantworten, und die kleinere reine Charm-Zahl ist die sauberere, weniger spot-sensitive Lesart.

Kehr die Zusammensetzung des Buchs um, und dieselbe Uhr zeigt stattdessen auf Käufe. Charm hat keine eingebaute Richtung, so wie die Schwerkraft "unten" hat; die Richtung wird davon bestimmt, in welchen Strikes die Dealer als short und als long modelliert werden. Was tendenziell Bestand hat, ist das *Timing*: Unabhängig vom Vorzeichen konzentriert sich der modellierte Flow auf den Handelsschluss, und diese Konzentration lässt sich bereits um 9:35 Uhr an jenem Morgen schätzen.

---

## Wie man es tatsächlich einsetzt

Eine kurze Disziplin:

- **Lies das Vorzeichen bei der Eröffnung.** Die Charm-into-Close-Zahl sagt dir, in welche Richtung die Uhr an diesem Tag drückt und ungefähr, wie stark. Das ist Regime-Kontext, kein Einstiegssignal.
- **Achte auf Konfluenz.** Zeigt Charm in dieselbe Richtung wie der Gamma-Magnet - der schwere Strike-Preis, zu dem hin die Bewegung driftet -, verstärken sich die beiden Kräfte, und der Drift zum Handelsschluss ist an seinem saubersten. Widersprechen sie sich, ist mit Chop statt mit Drift zu rechnen.
- **Respektiere die Bedingung "sofern der Spot sich hält".** Charm ist eine bedingte Prognose. Eine Bewegung von 1 % mitten am Nachmittag übergibt das Steuer an Gamma und kann die Charm-Lesart komplett überschwemmen. Die rein zeitbasierte Schätzung lässt sich an ruhigen Tagen leichter isolieren, aber ZeroGEX hat diese Beobachtung nicht als kalibriertes Performance-Ergebnis präsentiert.
- **Diskontiere sie, wenn die Vol expandiert.** An einem wirklich volatilen Tag dominieren die Gamma-Reaktionen, und der eigentlich ordentliche Charm-Drift wird zu Rauschen.

Charm hält Spot und IV per Definition konstant. Reale Portfolios enthalten Gegenpositionen über Strikes und Verfälle hinweg; Dealer können Hedge-Bänder, Futures oder andere Optionen nutzen, und neue Trades können den Bestand verändern. Die Schätzung steht daher für potenziellen, rein zeitgetriebenen Hedge-Druck und ist kein Beweis dafür, wann oder wie viel Dealer handeln werden.

Zum übergeordneten Konzept siehe [Delta und seine drei Kinder](/education/delta-and-its-three-children); für das vol-getriebene Geschwisterkonzept siehe [Vanna: Wie fallende IV das Dealer-Hedging verändern kann](/education/vanna-when-fear-fades); und um zuzusehen, wie sich die Into-Close-Kurve in Echtzeit aufbaut, öffne die Live-Seite [Forced Flow](/forced-flow).

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.
