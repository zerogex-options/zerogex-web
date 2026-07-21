# Warum Market Maker gezwungen sind, Aktien zu handeln

*Market Maker handeln Aktien nicht, weil sie eine Meinung haben. Sie tun es, weil sich das Delta der Optionen, die sie halten, ständig von selbst verändert — und während es sich bewegt, müssen sie in der Regel das Underlying handeln, um nahezu flach zu bleiben. Dieser Hedging-Flow gehört zu den strukturell besser schätzbaren Order Flows am Markt.*

> **Kernaussage**
> Dealer hedgen im Allgemeinen nicht, weil sie bullish oder bearish geworden sind. Sie hedgen, weil sich das Risiko ihres Optionsportfolios verändert hat. Zu verstehen, was dieses Risiko verändert, hilft zu erklären, wo im Markt Hedge-Druck entstehen kann.

---

## Der Job des Dealers ist es, neutral zu bleiben

Ein Market Maker, der Ihnen eine Call-Option verkauft, will nicht short im Markt sein. Er will den Spread — die paar Cent zwischen Bid und Ask — und er will flach nach Hause gehen. Der Verkauf der Call hat ihn short Delta zurückgelassen, also kauft er Aktien dagegen, bis die Position kein Netto-Richtungsrisiko mehr hat. Das ist Delta-Hedging, und es ist das Kern-Geschäftsmodell eines Optionsdealers: die Option lagern, die Richtung neutralisieren, den Edge einstreichen.

Das Problem ist, dass "flach" kein Ort ist, den man einmal erreicht. Es ist ein Ort, zu dem ein Dealer im Laufe der Handelssitzung immer wieder zurückkehrt, weil das Delta eines Options-Books selten still steht. Und hier kommt der Teil, der für jeden zählt, der Flow liest: Wenn sich dieses Delta bewegt, wird der resultierende Hedge in der Regel vom Risikomanagement getrieben und nicht von einer Richtungsmeinung. Keine Überzeugung, kein Markt-Call — das Risiko des Books hat sich verändert, also muss der Dealer in der Regel nachjustieren. *Wann* und *wie* er das tut, bleibt seinem Ermessen überlassen. *Dass* er letztlich handeln muss, um nahe an seinem Hedge zu bleiben, ist der Teil, der sich besser schätzen lässt.

Diese Unterscheidung — risikogetrieben versus diskretionär — ist der Grund, warum Dealer-Hedging überhaupt lesbar ist. Diskretionärer Flow ist eine Vermutung darüber, was ein Trader tun *möchte*. Hedging-Flow ist eine Schätzung dessen, was ein Dealer voraussichtlich tun *muss*, um nahezu flach zu bleiben. Das eine kommt eher einem Münzwurf gleich. Das andere eher der Arithmetik.

---

## Delta ist ein bewegliches Ziel, keine feste Zahl

Delta ist das Hedge-Verhältnis: wie viele Aktien einen Optionskontrakt ausgleichen. Eine Call-Option mit Delta 0,40 verhält sich gerade jetzt wie 40 Aktien Long pro Kontrakt. Verkaufen Sie 100 dieser Kontrakte, sind Sie 4.000 Delta short; kaufen Sie 4.000 Aktien, sind Sie flach.

Aber 0,40 ist eine Momentaufnahme, keine Konstante. Dieselbe Call-Option wird morgen ein anderes Delta haben, selbst wenn sich die Aktie nie bewegt, ein anderes Delta, wenn die implizite Volatilität sinkt, und ein ganz anderes Delta, wenn die Aktie um 1% steigt. Der Dealer hat auf 0,40 gehedgt. Sobald das Delta auf 0,44 driftet, ist das Book rund 400 Delta short, die es nicht eingeplant hatte, und der Dealer wird in der Regel etwa 400 weitere Aktien kaufen, um sich wieder Richtung flach zu bewegen.

Hedging sind also eigentlich zwei Aufgaben, nicht eine. Zuerst neutralisiert der Dealer das *aktuelle* Niveau des Book-Deltas — der einmalige Trade, der die Position nahezu flach stellt. Dann kommt die laufende Aufgabe: Während neue Optionen gehandelt werden und Spot, Zeit und Vol dieses Delta verschieben, justiert der Dealer nach, um nahezu flach zu bleiben. Den anfänglichen Hedge setzt man einmal auf. Was auf dem Tape erscheint, ist der endlose Strom von Re-Hedges, die dem Delta hinterherjagen, während es driftet. Wer versteht, was das Delta bewegt, versteht, woher der Hedging-Druck kommt.

---

## Die Aktien, die der Dealer bereits hält, sagen weniger, als Sie denken

Hier ist eine Falle, die man früh umgehen sollte, denn sie versenkt viele naive Analysen der Dealer-Positionierung.

Man könnte meinen, der richtige Weg, den Druck der Dealer einzuschätzen, sei, das gesamte Delta im Book aufzuaddieren — das Delta jedes Kontrakts multipliziert mit seinem Open Interest — und das "Dealer-Exposure" zu nennen. Es fühlt sich richtig an. Es ist das natürliche Geschwisterkind der Gamma-Exposure. Aber es beruht auf einer versteckten Annahme, und es misst das Falsche.

Beginnen wir mit der Annahme. Das Open Interest sagt Ihnen, dass ein Kontrakt existiert; es sagt Ihnen nicht, ob ein Dealer darin long oder short ist. Dealer-Bestände werden nirgends veröffentlicht, daher muss jede "Dealer-Delta"-Zahl aus einem Modell darüber abgeleitet werden, wer wahrscheinlich was hält — eine plausible Schätzung, aber eben eine Schätzung. Nehmen wir die Schätzung nun an und sehen wir uns an, was das *Niveau* des Deltas überhaupt misst. Die Aktien, die ein Dealer gegen seine Optionen hält, haben jeweils ein Delta von genau 1,00 und werden *gezielt aufgesetzt, um* das Options-Delta zu annullieren. Konstruktionsbedingt liegt das Netto-Delta eines gut gehedgten Dealers nahe null — das Options-Delta und das Aktien-Delta gleichen sich weitgehend aus. Eine Kennzahl, die das Niveau des Options-Deltas aufsummiert, beschreibt also genau jenes Risiko, das die Dealer am härtesten glattzustellen versuchen, und ignoriert dabei die dagegen gehaltenen Aktien.

Was das Niveau übersieht, ist, wie stark sich dieses Delta gleich *bewegen wird*. Aktien haben ein Delta von 1, das sich nicht ändert, also lässt sich damit kein Delta vorneutralisieren, das sich mit Spot, Zeit und Vol verschiebt. Künftiger Hedge-Druck entsteht aus der *Veränderung* des geschätzten Portfolio-Deltas des Dealers, nicht aus dem Aufsummieren des Deltas, das heute im Book liegt. Diese Drift — der Teil des Book-Deltas, der sich nicht im Voraus hedgen lässt — ist der Ort, an dem der Hedging-Flow tatsächlich entsteht. (Wir haben einen ganzen Artikel darüber geschrieben, warum die Delta-Niveau-Zahl eine Falle ist und warum wir uns weigern, sie zu veröffentlichen — siehe [Warum wir den DEX nicht veröffentlichen](/education/why-we-dont-publish-dex).)

---

## Drei Kräfte bewegen das Delta, und der Dealer ist allen dreien ausgesetzt

Zwischen jetzt und dem Verfall dominieren drei Variablen, wie sich das Delta eines Options-Books im Intraday bewegt, und ein Dealer hat kaum Kontrolle über eine davon:

- **Spotpreis.** Wenn sich die Aktie bewegt, bewegt sich das Delta jeder Option mit ihr. Die Sensitivität des Deltas gegenüber dem Spot ist das **Gamma**. Das ist der reaktive Flow — er feuert nur, wenn sich der Preis tatsächlich bewegt, und er ist groß und unmittelbar.
- **Zeit.** Je näher der Verfall rückt, desto mehr driftet das Delta, selbst wenn der Spot festgenagelt ist: Out-of-the-Money-Optionen sickern Richtung Delta 0, In-the-Money-Optionen klettern Richtung Delta 1. Die Sensitivität des Deltas gegenüber der Zeit ist das **Charm**. Es läuft kontinuierlich, egal ob etwas passiert oder nicht.
- **Implizite Volatilität.** Wenn die vom Markt eingepreiste Angst steigt oder fällt, verschiebt sich das Delta, obwohl der Spot völlig still steht. Die Sensitivität des Deltas gegenüber der Vol ist das **Vanna**. Ein Vol-Reset kann das Delta des Books heftig bewegen, ohne einen einzigen Preis-Tick.

Preis, die Uhr und die Angst. Das sind die drei großen Hebel, und der Dealer ist allen dreien ausgesetzt. Wenn sich einer von ihnen bewegt, zieht er das Delta des Books von seinem Hedge weg und erzeugt einen Aktien-Trade, um es zurückzusetzen. Das sind nicht die *einzigen* Einflussgrößen — Zinsen, Dividenden, Verschiebungen der Volatilitätsoberfläche, Finanzierungsannahmen und frische Optionstrades, die ins Book kommen, bewegen das Delta ebenfalls —, aber intraday sind sie neben Spot, Zeit und Vol meist zweitrangig. Diesen kombinierten Output nennen wir **Forced Flow**: eine Schätzung der Aktien, die ein Dealer in der Regel kaufen oder verkaufen muss, um gehedgt zu bleiben, während sich Spot, Zeit und Vol entwickeln.

---

## Was das in Dollar bedeutet

Die Abstraktion wird konkret, sobald man ihr eine Größenordnung zuordnet.

Nehmen wir an, das Dealer-Book in SPY sei schätzungsweise so positioniert, dass eine 1%-Bewegung im Underlying das aggregierte Dealer-Delta um etwa 1 Million Aktien verändert. Der Hedge ist diese Aktienveränderung multipliziert mit dem Aktienkurs: bei SPY $560 sind das 1.000.000 × $560 ≈ **560 Millionen Dollar**. Unter den Annahmen des Modells entspricht das rund 560 Millionen Dollar an potenzieller Hedge-Nachfrage — Aktien, die in der Regel den Besitzer wechseln müssten, um das Book nahezu flach zu halten, bevor sich auch nur ein einziger diskretionärer Trader eine Meinung gebildet hat. In einem Short-Gamma-Regime kaufen Dealer in der Regel in die Stärke hinein und verkaufen in die Schwäche hinein, sodass dieser Flow tendenziell *mit* der Bewegung schiebt und die Range ausweitet. In einem Long-Gamma-Regime stemmt er sich gegen die Bewegung und komprimiert sie. Derselbe Mechanismus, umgekehrtes Vorzeichen, ein sehr anderes Tape.

Charm und Vanna tragen ihre eigenen Dollar-Etiketten. An einem starken 0DTE-Tag kann allein der Zeitverfall bis zum Handelsschluss zig Millionen an Aktien an Hedge-Bedarf bedeuten — wobei die Richtung davon abhängt, wie das Book schätzungsweise positioniert ist, und nicht allein von der Uhr. Ein Rückgang der impliziten Vol um zwei Punkte nach einem ruhigen CPI-Report könnte einen ähnlich großen Hedge bedeuten; ob daraus Käufe oder Verkäufe werden, hängt wiederum vom Vorzeichen des geschätzten Vanna des Books ab. Nichts davon ist ein Markt-Call. All das ist das Book, das wieder Richtung flach ausbalanciert wird.

---

## Warum Forced Flow der Flow ist, der es wert ist, gelesen zu werden

Der meiste Order Flow ist ein Nebel konkurrierender Absichten. Jemand kauft, jemand verkauft, und Sie raten die Motivation. Dealer-Hedging ist grundverschieden: Es ist ein großer, anhaltender Strom, der von der Positionierung und den drei oben genannten Variablen geprägt wird und nicht von irgendjemandes Meinung. Das macht es in der Regel besser schätzbar als diskretionären Flow. Bewegt sich der Spot um 1%, feuert der Gamma-Hedge tendenziell. Läuft die Uhr auf den Handelsschluss zu, baut sich charmgetriebenes Hedging tendenziell auf. Fällt die Vol um zwei Punkte, folgt der Vanna-Hedge — in einer Richtung, die durch die geschätzte Positionierung des Books bestimmt wird. Der Flow ist eine Konsequenz des Risikos, keine diskretionäre Entscheidung.

Genau das arbeitet der Rest dieser Serie auf. [Delta und seine drei Kinder](/education/delta-and-its-three-children) schlüsselt Gamma, Charm und Vanna als die drei Ableitungen des Deltas auf. [Charm: Die Uhr ist ein Trader](/education/charm-the-clock-is-a-trader) zeigt, wie allein der Zeitverfall einen schätzbaren Into-Close-Flow antreiben kann, den man Stunden im Voraus modellieren kann. [Vanna: Wenn die Angst verblasst, kaufen Dealer](/education/vanna-when-fear-fades) erklärt den Vol-Kompressions-Sog. Und die Live-Seite [Forced Flow](/forced-flow) berechnet das gesamte Book unter jedem beliebigen Spot-/Zeit-/Vol-Szenario neu, sodass Sie den geschätzten Hedge sehen können, bevor er gedruckt wird.

Dealer-Hedging ist nicht perfekt vorhersehbar. Bestände sind nicht öffentlich, die Positionierung muss abgeleitet werden, und das Timing und die Ausführung eines Hedges bleiben dem Ermessen des Dealers überlassen.

Doch weil es von Portfoliorisiko und nicht von diskretionärer Meinung getrieben wird, gehört es zu den strukturell besser schätzbaren Quellen potenziellen Kauf- und Verkaufsdrucks in modernen Märkten. Der Zweck von Forced Flow ist nicht, die exakte Order vorherzusagen, bevor sie gedruckt wird. Er besteht darin, abzuschätzen, wo Dealer-Hedging eine Marktbewegung verstärken, ihr entgegenwirken oder sie verschieben kann, während sich Preis, Zeit und Volatilität entwickeln.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.
