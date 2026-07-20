# Delta und seine drei Kinder

*Delta sagt einem Dealer, wie viele Aktien er halten muss. Aber Delta steht niemals still — und es kann sich nur auf drei Arten bewegen: mit dem Preis, mit der Zeit und mit der Volatilität. Diese drei Sensitivitäten sind gamma, charm und vanna. Jeder Dollar erzwungenen Dealer-Flows ist eines von deltas drei Kindern, das seine Rechnung eintreibt.*

---

## Ausgangspunkt: die Hedge-Ratio

Delta ist die wichtigste Zahl in einer Option und zugleich die uninteressanteste. Es ist schlicht die Hedge-Ratio: die Anzahl an Aktien, die sich gerade jetzt wie ein Optionskontrakt verhält. Eine Call-Option mit delta 0,55 bewegt sich wie 55 Aktien; eine Put-Option mit delta −0,30 bewegt sich wie 30 leerverkaufte Aktien. Ein Dealer, der keine Richtungsexposition will, hält die ausgleichende Aktienposition, und das Buch bleibt flach.

Wäre delta eine Konstante, wäre die Geschichte damit zu Ende. Man würde einmal hedgen und es nie wieder anfassen. Aber delta ist eine Ableitung — die Änderungsrate des Optionswerts in Bezug auf den Spot — und Ableitungen sind selbst wieder Funktionen der Welt. Ändert sich die Welt, ändert sich delta. Die eigentliche Daueraufgabe des Dealers, und die gesamte Quelle lesbaren Dealer-Flows, besteht darin, delta zu jagen, während es sich bewegt.

Die eigentlich entscheidende Frage ist also nicht "was ist delta", sondern "was bewegt delta". Es gibt genau drei Antworten.

---

## Die drei Arten, wie sich delta bewegen kann

Zwischen dem Moment, in dem ein Dealer einen Hedge aufsetzt, und dem Moment, in dem die Option verfällt, können sich drei Dinge in der Welt ändern, und jedes davon zieht delta mit sich:

1. **Der Aktienkurs ändert sich.** Deltas Sensitivität gegenüber dem Spot ist **gamma** (∂Δ/∂S).
2. **Zeit vergeht.** Deltas Sensitivität gegenüber der Zeit ist **charm** (∂Δ/∂t).
3. **Die implizite Volatilität ändert sich.** Deltas Sensitivität gegenüber der Vol ist **vanna** (∂Δ/∂σ).

Das ist die gesamte Familie. Gamma, charm und vanna sind die drei Ableitungen erster Ordnung von delta, jeweils eine pro Variable, die sich unter einem gehedgten Buch bewegen kann. Trader lernen sie als separate Greeks mit exotischen Namen auswendig; besser versteht man sie als eine einzige Idee — *wie sich delta bewegt* — aufgeteilt in drei Teile nach *wodurch es bewegt wurde*.

Das ist das sauberste mentale Modell für Dealer-Flow: Ein Dealer hedgt nicht delta, ein Dealer hedgt die **Änderung** von delta. Und es gibt genau drei Kanäle, über die diese Änderung ankommen kann. Nenne den Kanal, und du hast den Flow benannt.

---

## Gamma: delta bewegt sich, weil sich der Preis bewegt hat

Gamma ist das, was jeder kennt. Steigt die Aktie, steigen Call-Deltas und Put-Deltas nähern sich der Null an; fällt sie, sinken sie. Gamma ist das Tempo, mit dem das geschieht. Ein Buch mit hohem gamma hedgt bei jedem Tick kräftig nach; ein Buch mit niedrigem gamma zuckt kaum.

Das entscheidende Merkmal von Gamma-Flow ist, dass er **reaktiv** ist. Nichts geschieht, bis sich der Preis bewegt. Steht der Spot still, schweigt gamma. Bewegt sich der Markt dann um 0,5 %, muss der Dealer eine Ladung Aktien handeln, um wieder flach zu werden — kaufend in eine Rally hinein und verkaufend in einen Rücksetzer hinein, wenn er short gamma ist, und umgekehrt, wenn er long gamma ist. Das ist der Flow hinter dem gamma flip, dem Pinning und dem Squeeze, ausführlich behandelt im [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained).

Gamma ist das lauteste Kind. Es ist auch das einzige, das eine Spot-Bewegung braucht, um zu sprechen. Die anderen beiden sind beunruhigender, weil sie Trades erzwingen, selbst wenn überhaupt nichts passiert.

---

## Charm: delta bewegt sich, weil Zeit vergangen ist

Charm ist deltas Sensitivität gegenüber dem Verstreichen der Zeit. Eine Out-of-the-money-Option ist heute nur deshalb etwas wert, weil noch Zeit bleibt, damit der Spot sie erreicht; während diese Zeit verrinnt, sickert ihr delta gegen Null. Das delta einer In-the-money-Option hingegen festigt sich in Richtung 1. Delta ist ungefähr die Wahrscheinlichkeit, im Geld zu verfallen, und je näher der Verfall rückt, desto mehr muss sich diese Wahrscheinlichkeit zu einem klaren Ja oder Nein auflösen. Die Drift während dieser Auflösung *ist* charm.

Das Beunruhigende daran: charm erzwingt Hedging, selbst wenn der Spot perfekt stillsteht. Die Uhr ist ein Trader. Ein Dealer kann eine Stunde lang beobachten, wie das Tape absolut nichts tut, und ist trotzdem die ganze Zeit gezwungen, Aktien zu verkaufen, weil die Deltas im Buch still vor sich hin verfallen und der Hedge entsprechend schrumpfen muss. Auf einer Chain mit vielen 0DTE-Optionen konzentriert sich dieser Flow in der letzten Stunde geradezu explosionsartig, wenn die Verfallsrate ihr Maximum erreicht. [Charm: Die Uhr ist ein Trader](/education/charm-the-clock-is-a-trader) behandelt das Thema vollständig.

---

## Vanna: delta bewegt sich, weil sich die Angst bewegt hat

Vanna ist deltas Sensitivität gegenüber der impliziten Volatilität. Steigt die vom Markt eingepreiste Angst, weitet sich die Verteilung möglicher Ausgänge, was Out-of-the-money-Deltas Richtung Mitte zieht; sinkt sie, verschärft sich die Verteilung wieder, und die Deltas rutschen zurück Richtung ihres intrinsischen Werts von 0 oder 1. Eine Änderung der Vol repreist also das delta jeder Option, ohne dass sich der Spot auch nur um einen Cent bewegt.

Vanna ist das leiseste Kind und, im richtigen Regime, das hartnäckigste. Nach einem Schreck, der sich nie bewahrheitet — ein Ereignis, bei dem die implizite Vol nach oben getrieben wurde und dann über Tage hinweg wieder absinkt, sobald das Risiko vorüber ist — driftet das delta des Dealer-Buchs jede Stunde ein wenig weiter nach unten, und das Nachhedgen wird zu einem stetigen, mechanischen Kaufdruck. Das ist der Vol-Compression-Grind: Märkte, die ohne News und ohne Volumen nach oben treiben. [Vanna: Wenn die Angst verfliegt, kaufen Dealer](/education/vanna-when-fear-fades) erklärt den Mechanismus im Detail.

---

## Warum man sie nicht einfach addieren kann

Eine verlockende Abkürzung: den Flow jedes Greeks separat berechnen und aufsummieren. Gamma-Flow plus Charm-Flow plus Vanna-Flow ergibt den gesamten erzwungenen Flow. Das ist eine brauchbare erste Näherung und eine schlechte Endantwort, weil die drei Kinder interagieren.

Gamma selbst ändert sich, während Zeit vergeht und sich die Vol verschiebt. Das charm, das man beim heutigen Spot hat, ist nicht das charm, das man nach einer 2%igen Bewegung hat. Ein Szenario, das eine Spot-Bewegung, einen Nachmittag des Zerfalls und einen Vol-Rückgang kombiniert, ist nicht die Summe der drei isoliert berechneten Effekte — die Kreuzterme sind real und, nahe am Verfall, groß. Das Addieren der Greeks ist eine Taylor-Entwicklung, und Taylor-Entwicklungen brechen genau dort zusammen, wo das Geschehen stattfindet: nahe am Geld, nahe am Verfall, wo die Fläche am stärksten krümmt.

Der ehrliche Weg, erzwungenen Flow zu berechnen, besteht darin, das Buch unter dem neuen Szenario **vollständig neu zu bepreisen**, das delta des Dealers in diesem neuen Zustand abzulesen und die Differenz zum aktuellen delta zu bilden. Die Greeks sind dann nützlich zur **Attribution** — sie zeigen, wie viel des erzwungenen Trades auf gamma, charm bzw. vanna entfiel —, aber der Gesamtbetrag stammt aus der Neubepreisung, nicht aus der Summierung. Genau das leistet die Live-Reprice-Kurve [Forced Flow](/forced-flow): Sie bewegt den Spot über ein Raster, repreist jeden Kontrakt und liest den erzwungenen Hedge direkt ab. Die Aufteilung in gamma/charm/vanna wird darunter als Attributionsbänder dargestellt, sodass sowohl der Gesamtwert als auch das treibende Kind sichtbar werden.

---

## Die Ein-Satz-Version

Delta ist eine Hedge-Ratio, die nicht stillhalten will. Sie bewegt sich mit dem Preis (gamma), mit der Zeit (charm) und mit der Volatilität (vanna) — und mit nichts sonst. Jeder erzwungene Dealer-Trade am Markt ist eine dieser drei Sensitivitäten, die das Buch aus seinem Hedge zieht und einen Aktien-Trade verlangt, um es wieder auszugleichen.

Lerne den Elternteil und die drei Kinder, und Dealer-Flow hört auf, ein Mysterium zu sein, und wird zu einem Buchhaltungsproblem. Für das Fundament dieser gesamten Idee siehe [Warum Market Maker gezwungen sind, Aktien zu handeln](/education/why-market-makers-trade-stock).

Nur zu Bildungszwecken — nichts von alledem ist eine Handelsempfehlung.
