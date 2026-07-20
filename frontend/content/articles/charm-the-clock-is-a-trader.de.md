# Charm: Die Uhr ist ein Trader

*Charm ist die Rate, mit der sich das Delta einer Option verändert, während die Zeit vergeht. Sie zwingt Dealer zum Handel mit Aktien, selbst wenn der Markt völlig regungslos ist — und weil die Uhr die einzige Variable ist, die man perfekt vorhersagen kann, ist charm der seltene Dealer-Flow, den man Stunden vor seinem Erscheinen prognostizieren kann. Eine Prognose mit Deadline.*

---

## Das Griechisch, das auf einem leeren Tape handelt

Die meisten Flows brauchen ein Ereignis. Gamma braucht eine Preisbewegung. News brauchen Nachrichten. Charm braucht nichts. Es ist die Sensitivität des Delta gegenüber dem Verstreichen der Zeit — ∂Δ/∂t — und die Zeit vergeht, ganz gleich, ob sich am Tape etwas tut. Ein Dealer kann vor einem Markt sitzen, der sich neunzig Minuten lang keinen Tick bewegt hat, und trotzdem die ganze Zeit über gezwungen sein, Aktien zu verkaufen, weil die Deltas in seinem Buch still vor sich hin verfallen und das Hedge entsprechend schrumpfen muss.

Genau das macht charm eigenartig und, sobald man es einmal durchschaut hat, offensichtlich. Die Uhr ist ein Trader. Sie hört nie auf, sie ändert nie ihre Meinung, und sie arbeitet jede einzelne Session dieselbe Order ab. Die einzigen offenen Fragen sind, in welche Richtung sie drückt und wie stark der Druck ausfällt.

Dieser Beitrag ist der mechanische Begleittext zu unserem umfassenderen [Vanna and Charm explainer](/education/vanna-and-charm-explained). Jener Artikel ordnet charm als einen Baustein in die Lesart zum Handelsschluss ein; dieser hier schaut unter die Haube — woher der Drift kommt, warum er sich beschleunigt, und wie man ihm im Voraus einen Dollarbetrag und eine Deadline zuordnen kann.

---

## Woher der Drift kommt

Delta ist, grob gesagt, die risikoneutrale Wahrscheinlichkeit, dass eine Option im Geld verfällt. Ein Call mit Delta 0,30 sagt marktseitig: Es besteht eine Wahrscheinlichkeit von rund 30 %, dass diese Option mit Wert ausläuft. Diese Wahrscheinlichkeit ist eine laufende Schätzung, und je näher der Verfall rückt, desto mehr muss sie zu einem Verdikt zusammenfallen: Entweder verfällt die Option im Geld (Delta → 1) oder eben nicht (Delta → 0). Zum Handelsschluss gibt es keinen Mittelweg mehr.

Charm ist die Geschwindigkeit dieses Kollapses. Beobachte eine leicht aus dem Geld liegende Option über einen Nachmittag hinweg, während der Spot festgenagelt bleibt:

- Heute Morgen lag das Delta bei 0,35 — eine reelle Chance auf Auszahlung.
- Zur Mittagszeit, mit weniger Zeit auf der Uhr und unverändertem Spot, Delta 0,28.
- Um 15 Uhr, Delta 0,18.
- Kurz vor Handelsschluss rutscht das Delta Richtung 0.

Nichts hat sich bewegt. Das Delta der Option ist trotzdem um die Hälfte gefallen, rein weil die verbleibende Zeit kürzer geworden ist. Jeder dieser Schritte ist eine Veränderung der Hedge-Ratio, und jede Veränderung zwingt den Dealer, der diese Option hält, seine Aktienposition anzupassen. Diese Anpassung ist der Charm-Flow.

Optionen im Geld machen das Spiegelbild davon und festigen sich von 0,80 in Richtung 1,00, während ihr Ausgang zur nahezu vollständigen Gewissheit wird. Der Netto-Charm des Buchs ist die Summe über alle Strikes, gewichtet danach, wie viel Open Interest dort liegt und auf welcher Seite der Dealer steht.

---

## Warum sich der Prozess zum Handelsschluss hin beschleunigt

Charm ist im Tagesverlauf nicht konstant. Die Rate des Deltaverfalls ist klein, solange noch reichlich Zeit bleibt, und wächst, je näher der Verfall rückt — sie ist in der letzten Stunde am größten und in den letzten Minuten am allergrößten, und zwar für die nahe am Geld liegenden Strikes, deren Verdikt noch offen ist. Bei einer Optionskette, die von taggleichen Verfällen dominiert wird — inzwischen der Normalfall bei SPX —, komprimiert sich der Großteil des Tages-Charm-Flows auf die letzten sechzig bis neunzig Minuten.

Das ist der mechanische Grund, warum der "Drift zum Handelsschluss" ein reales Phänomen ist und keine Chart-Aberglaube. Es liegt nicht daran, dass Trader um 15 Uhr emotional werden. Es liegt daran, dass die Mathematik des Deltaverfalls den Großteil ihrer Kraft genau dort entfaltet, und die Dealer, die dieses Verfallen absichern, haben keine Wahl, wann sie handeln. Der Flow nimmt zu, weil das Griechisch zunimmt.

Das Live-Chart [Charm into Close](/forced-flow) zeichnet genau das nach: Es hält den Spot fest, lässt die Uhr bis zum Handelsschluss vorlaufen und plottet die kumulative Aktienmenge, zu deren Handel das Dealer-Buch bei jedem Schritt gezwungen ist. Die Kurve startet bei null im aktuellen Moment und biegt sich im Lauf des Nachmittags von null weg — am steilsten am Ende, weil genau dort charm zu Hause ist.

---

## Eine Prognose mit Deadline

Hier kommt die Eigenschaft, die charm einzigartig nützlich macht — und das ist etwas, das man in keiner Standard-Abhandlung über die Griechen findet.

Jeder andere Dealer-Flow ist bedingt. Der Gamma-Flow hängt von einer Spot-Bewegung ab, die kommen kann oder auch nicht. Der Vanna-Flow hängt von einer Vol-Verschiebung ab, die sich nicht terminieren lässt. Der Charm-Flow aber hängt nur von der Zeit ab, und die Zeit ist die eine Variable, die exakt das tun wird, was man erwartet. Um 9:35 Uhr morgens kann man, bei aktuellem Spotniveau, berechnen, wie viel Aktienvolumen der reine Zeitverfall die Dealer bis 16 Uhr zu kaufen oder zu verkaufen zwingen wird. Man kennt Größe und Richtung eines großen Flows sechseinhalb Stunden, bevor er sich vollständig materialisiert.

Das ist eine Prognose mit Deadline. Die Prognose ist an eine Bedingung geknüpft — "sofern der Spot sich in dieser Nähe hält" —, und der Spot hält sich selten perfekt, sodass sich der tatsächliche Handelsschluss aus charm und dem Gamma mischt, das die Tagesbewegung erzeugt. Aber die Charm-Komponente ist im Voraus bekannt, auf eine Weise, wie es sonst fast nichts an den Märkten ist. Es ist das Nächste, was der Markt an eine geplante Order zu bieten hat, und geplant wird sie vom Kalender, nicht von irgendjemandes Entscheidung.

Genau diese Zahl liefert das [Charm-into-Close-Bulletin](/forced-flow) schon vor der Eröffnung: *Der reine Zeitverfall zwingt Dealer, bis 16 Uhr ET \$X zu kaufen/verkaufen, sofern der Basiswert sich hier hält.* Eine Deadline, eine Richtung und ein Dollarbetrag — alles bereits im Morgengrauen berechenbar.

---

## Eine Zahl darauf setzen

Angenommen, es ist ein Freitag mit starker 0DTE-Positionierung in SPY, Spot bei 560. Das Dealer-Buch enthält die taggleichen Optionen, und während die Uhr Richtung Handelsschluss läuft, muss sich jede einzelne davon auflösen — im Geld verfallen oder wertlos verfallen —, sodass die Deltas, die die Dealer absichern, heftig schwanken. Wird das gesamte Buch um 16 Uhr mit einem konstant gehaltenen Spot von 560 neu bepreist, bewegt sich der gesamte zeitgetriebene Zwangs-Flow an einem stark von 0DTE geprägten Tag im **Milliardenbereich**. Genau diese Zahl plottet das Live-Chart Charm-into-Close, und das ist es, was "die Dealer müssen bis zum Handelsschluss handeln" wörtlich bedeutet.

Zwei ehrliche Vorbehalte zu dieser Schlagzeilenzahl. Erstens: Der Großteil davon entfällt auf die taggleichen Optionen, die zum Handelsschluss *auflösen* — ein Pin-Effekt, der genau davon abhängt, wo der Spot sich einpendelt, kein gleichmäßiger Verfall — daher ist der Betrag groß und stark spot-sensitiv. Zweitens: Der reine Charm-Drift, also der Teil, der tatsächlich Zeitverfall des überlebenden Buchs ist und nicht das Verfallsereignis selbst, macht nur einen Bruchteil davon aus: in der Größenordnung von wenigen hundert Millionen, die sich über den Nachmittag hinweg stetig aufbauen. Das Dashboard zeigt beides — den vollständigen Close-Flow und den reinen Charm-Drift —, weil sie unterschiedliche Fragen beantworten, und die kleinere reine Charm-Zahl ist die sauberere, weniger spot-sensitive Lesart.

Kehrt man die Zusammensetzung des Buchs um, erzwingt dieselbe Uhr stattdessen Käufe. Charm hat keine eingebaute Richtung, so wie die Schwerkraft "unten" hat; die Richtung wird davon bestimmt, in welchen Strikes die Dealer short oder long sind. Invariant ist das *Timing*: Unabhängig vom Vorzeichen konzentriert sich der Flow zum Handelsschluss hin, und man kann ihn kommen sehen — berechenbar bereits um 9:35 Uhr an jenem Morgen.

---

## Wie man es tatsächlich einsetzt

Eine kurze Disziplin:

- **Lies das Vorzeichen bei der Eröffnung.** Die Charm-into-Close-Zahl sagt dir, in welche Richtung die Uhr an diesem Tag drückt und ungefähr, wie stark. Das ist Regime-Kontext, kein Einstiegssignal.
- **Achte auf Konfluenz.** Zeigt charm in dieselbe Richtung wie der Gamma-Magnet — der schwere Strike-Preis, zu dem hin die Bewegung driftet —, verstärken sich die beiden Kräfte, und der Drift zum Handelsschluss ist an seinem saubersten. Widersprechen sie sich, ist eher mit Chop als mit Drift zu rechnen.
- **Respektiere die Bedingung "sofern der Spot sich hält".** Charm ist eine bedingte Prognose. Eine Bewegung von 1 % am Nachmittag übergibt das Steuer an gamma und kann die Charm-Lesart komplett überschwemmen. Die Prognose ist an ruhigen, range-gebundenen Tagen am zuverlässigsten — genau den Tagen, an denen sie auch am meisten zählt.
- **Diskontiere sie, wenn die Vol expandiert.** An einem wirklich volatilen Tag dominieren die Gamma-Reaktionen, und der eigentlich ordentliche Charm-Drift wird zu Rauschen.

Die Uhr ist der verlässlichste Trader am Markt. Sie arbeitet jeden Tag dieselbe Order ab, sie sagt dir im Voraus, was sie tun wird, und sie versäumt es nie, um 16 Uhr aufzutauchen. Charm ist die Art und Weise, wie man ihre Order-Ticket liest.

Zum übergeordneten Konzept siehe [Delta and Its Three Children](/education/delta-and-its-three-children); für das vol-getriebene Geschwisterkonzept siehe [Vanna: When Fear Fades, Dealers Buy](/education/vanna-when-fear-fades); und um zuzusehen, wie sich die Into-Close-Kurve in Echtzeit aufbaut, öffne die Live-Seite [Forced Flow](/forced-flow).

Nur zu Bildungszwecken — nichts von dem oben Genannten stellt eine Handelsempfehlung dar.
