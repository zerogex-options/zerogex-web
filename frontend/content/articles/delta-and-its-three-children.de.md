# Delta und seine drei Kinder

*Delta sagt einem Dealer, wie viele Aktien er halten sollte. Aber Delta steht niemals still - und seine drei größten Treiber sind Preis, Zeit und Volatilität. Diese drei Sensitivitäten sind Gamma, Charm und Vanna. Der Großteil des erzwungenen Dealer-Flows, der im Tape auftaucht, ist eines von Deltas drei Kindern, das seine Rechnung eintreibt.*

---

## Ausgangspunkt: die Hedge-Ratio

Delta ist die wichtigste Zahl in einer Option und zugleich die uninteressanteste. Es ist schlicht die Hedge-Ratio: die Anzahl an Aktien, die sich gerade jetzt wie ein Optionskontrakt verhält. Eine Call-Option mit Delta 0,55 bewegt sich wie 55 Aktien; eine Put-Option mit Delta −0,30 bewegt sich wie 30 leerverkaufte Aktien. Ein Dealer, der keine Richtungsexposition will, hält die ausgleichende Aktienposition, und das Buch bleibt flach.

Wäre Delta eine Konstante, wäre die Geschichte damit zu Ende. Man würde einmal hedgen und es nie wieder anfassen. Aber Delta ist eine Ableitung - die Änderungsrate des Optionswerts in Bezug auf den Spot - und Ableitungen sind selbst wieder Funktionen der Welt. Ändert sich die Welt, ändert sich Delta. Die eigentliche Daueraufgabe des Dealers, und die gesamte Quelle lesbaren Dealer-Flows, besteht darin, Delta zu jagen, während es sich bewegt.

Die eigentlich entscheidende Frage ist also nicht "was ist Delta", sondern "was bewegt Delta". Drei Treiber leisten den Großteil der Arbeit.

---

## Die drei Arten, wie sich Delta bewegen kann

Zwischen dem Moment, in dem ein Dealer einen Hedge aufsetzt, und dem Moment, in dem die Option verfällt, bewegen sich drei Marktinputs mehr oder weniger kontinuierlich, und jeder davon zieht Delta mit sich:

1. **Der Aktienkurs ändert sich.** Deltas Sensitivität gegenüber dem Spot ist **Gamma** (∂Δ/∂S).
2. **Zeit vergeht.** Deltas Sensitivität gegenüber der Zeit ist **Charm** (∂Δ/∂t).
3. **Die implizite Volatilität ändert sich.** Deltas Sensitivität gegenüber der Vol ist **Vanna** (∂Δ/∂σ).

Das ist die Kernfamilie. Gamma, Charm und Vanna sind die Ableitungen erster Ordnung von Delta nach den drei Inputs, die sich unter einem gehedgten Buch am stärksten bewegen. Trader lernen sie als separate Greeks mit exotischen Namen auswendig; besser versteht man sie als eine einzige Idee - *wie sich Delta bewegt* - aufgeteilt in drei Teile nach *wodurch es bewegt wurde*.

Sie sind nicht buchstäblich das Einzige, was Delta verschiebt. Zinsen, Dividenden und Leihkosten, Veränderungen in der Form der Vol-Fläche und der Umschlag des Buchs selbst - neue Kundentrades, Glattstellungen, Ausübung und Zuteilung, gegenläufige Positionen - stoßen Delta ebenfalls an. Aber diese Faktoren sind entweder langsam, klein oder diskret, während sich Preis, Zeit und Vol die ganze Session über kontinuierlich bewegen. Deshalb erzeugen diese drei den Großteil des stetigen, lesbaren Hedging-Flows, und deshalb sind sie die Kinder, die es wert sind, benannt zu werden.

Das ist das sauberste mentale Modell für Dealer-Flow: Ein Dealer hedgt nicht Delta, ein Dealer hedgt die **Veränderung** des Deltas. Und drei Kanäle tragen den größten Teil dieser Veränderung. Benenne den Kanal, und du hast den Flow benannt.

---

## Gamma: Delta bewegt sich, weil sich der Preis bewegt hat

Gamma ist das, was jeder kennt. Steigt die Aktie, steigen Call-Deltas und Put-Deltas nähern sich der Null an; fällt sie, sinken sie. Gamma ist das Tempo, mit dem das geschieht. Ein Buch mit hohem Gamma hedgt bei jedem Tick kräftig nach; ein Buch mit niedrigem Gamma zuckt kaum.

Das entscheidende Merkmal von Gamma-Flow ist, dass er **reaktiv** ist. Nichts geschieht, bis sich der Preis bewegt. Steht der Spot still, schweigt Gamma. Bewegt sich der Markt dann um 0,5 %, muss der Dealer eine Ladung Aktien handeln, um wieder flach zu werden - kaufend in eine Rally hinein und verkaufend in einen Rücksetzer hinein, wenn er short Gamma ist, und umgekehrt, wenn er long Gamma ist. Das ist der Flow hinter dem Gamma Flip, dem Pinning und dem Squeeze, ausführlich behandelt im [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained).

Gamma ist das lauteste Kind. Es ist auch das einzige, das eine Spot-Bewegung braucht, um zu sprechen. Die anderen beiden sind beunruhigender, weil sie Trades erzwingen, selbst wenn überhaupt nichts passiert.

---

## Charm: Delta bewegt sich, weil Zeit vergangen ist

Charm ist Deltas Sensitivität gegenüber dem Verstreichen der Zeit. Eine Out-of-the-money-Option ist heute nur deshalb etwas wert, weil noch Zeit bleibt, damit der Spot sie erreicht; während diese Zeit verrinnt, sickert ihr Delta gegen null. Das Delta einer In-the-money-Option hingegen festigt sich in Richtung 1. Delta ist eng verwandt mit - wenn auch nicht exakt gleich - der Wahrscheinlichkeit, im Geld zu enden, und je näher der Verfall rückt, desto mehr muss sich diese implizite Wahrscheinlichkeit zu einem klaren Ja oder Nein auflösen. Die Drift während dieser Auflösung *ist* Charm.

Das Beunruhigende daran: Charm erzwingt Hedging, selbst wenn der Spot perfekt stillsteht. Die Uhr ist ein Trader. Ein Dealer kann eine Stunde lang beobachten, wie das Tape absolut nichts tut, und ist trotzdem die ganze Zeit gezwungen, Aktien zu verkaufen, weil die Deltas im Buch still vor sich hin verfallen und der Hedge entsprechend schrumpfen muss. Auf einer Chain mit vielen 0DTE-Optionen konzentriert sich dieser Flow in der letzten Stunde geradezu explosionsartig, wenn die Verfallsrate ihr Maximum erreicht. [Charm: Die Uhr ist ein Trader](/education/charm-the-clock-is-a-trader) behandelt das Thema vollständig.

---

## Vanna: Delta bewegt sich, weil sich die Angst bewegt hat

Vanna ist Deltas Sensitivität gegenüber der impliziten Volatilität. Steigt die vom Markt eingepreiste Angst, weitet sich die Verteilung möglicher Ausgänge, was Out-of-the-money-Deltas Richtung Mitte zieht; sinkt sie, verschärft sich die Verteilung wieder, und die Deltas rutschen zurück Richtung ihres intrinsischen Werts von 0 oder 1. Eine Änderung der Vol repreist also das Delta jeder Option, ohne dass sich der Spot auch nur um einen Cent bewegt.

Vanna misst Deltas Sensitivität gegenüber der impliziten Volatilität. Unter der modellierten Bestandskonvention kann fallende IV in manchen Konfigurationen der Optionskette Kaufdruck im Underlying erzeugen, aber das Vorzeichen hängt von den Eigentumsverhältnissen, dem Optionstyp, der Moneyness, dem Verfall, dem Skew und der Bewegung der Vol-Fläche ab. [Vanna: Wie fallende IV das Dealer-Hedging verändern kann](/education/vanna-when-fear-fades) geht den bedingten Mechanismus Schritt für Schritt durch.

---

## Warum man sie nicht einfach addieren kann

Eine verlockende Abkürzung: den Flow jedes Greeks separat berechnen und aufsummieren. Gamma-Flow plus Charm-Flow plus Vanna-Flow ergibt den gesamten erzwungenen Flow. Das ist eine brauchbare erste Näherung und eine schlechte Endantwort, weil die drei Kinder interagieren.

Gamma selbst ändert sich, während Zeit vergeht und sich die Vol verschiebt. Das Charm, das du beim heutigen Spot hast, ist nicht das Charm, das du nach einer 2%igen Bewegung hast. Ein Szenario, das eine Spot-Bewegung, einen Nachmittag des Zerfalls und einen Vol-Rückgang kombiniert, ist nicht die Summe der drei isoliert berechneten Effekte - die Kreuzterme sind real und, nahe am Verfall, groß. Das Addieren der Greeks ist eine Taylor-Entwicklung, und Taylor-Entwicklungen brechen genau dort zusammen, wo das Geschehen stattfindet: nahe am Geld, nahe am Verfall, wo sich die Fläche am stärksten krümmt.

Der ehrliche Weg, erzwungenen Flow zu berechnen, besteht darin, das Buch unter dem neuen Szenario **vollständig neu zu bepreisen**, das Delta des Dealers in diesem neuen Zustand abzulesen und die Differenz zum aktuellen Delta zu bilden. Die Greeks sind dann nützlich zur *Attribution* - sie zeigen, wie viel des erzwungenen Trades auf Gamma, Charm bzw. Vanna entfiel -, aber der Gesamtbetrag stammt aus der Neubepreisung, nicht aus der Summierung. Genau das leistet die Live-Reprice-Kurve [Forced Flow](/forced-flow): Sie bewegt den Spot über ein Raster, repreist jeden Kontrakt und liest den erzwungenen Hedge direkt ab. Die Aufteilung in Gamma/Charm/Vanna wird darunter als Attributionsbänder dargestellt, sodass sowohl der Gesamtwert als auch das treibende Kind sichtbar werden.

---

## Die Ein-Satz-Version

Delta ist eine Hedge-Ratio, die nicht stillhalten will. Sie bewegt sich mit dem Preis (Gamma), mit der Zeit (Charm) und mit der Volatilität (Vanna) - den drei Inputs, die sich kontinuierlich bewegen und den Großteil des Flows antreiben. Die meisten erzwungenen Dealer-Trades am Markt sind eine dieser drei Sensitivitäten, die das Buch aus seinem Hedge zieht und einen Aktien-Trade verlangt, um es wieder auszugleichen, während Zinsen, Dividenden und der eigene Umschlag des Buchs die Ränder ausfüllen.

Lerne den Elternteil und die drei Kinder, und Dealer-Flow hört auf, ein Mysterium zu sein, und wird zu einem Buchhaltungsproblem. Für das Fundament dieser gesamten Idee siehe [Warum Market Maker gezwungen sind, Aktien zu handeln](/education/why-market-makers-trade-stock).

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.
