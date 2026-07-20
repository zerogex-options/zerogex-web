# Warum Market Maker gezwungen sind, Aktien zu handeln

*Market Maker handeln Aktien nicht, weil sie eine Meinung haben. Sie tun es, weil sich das Delta der Optionen, die sie halten, ständig von selbst verändert — und jedes Mal, wenn es sich bewegt, sind sie mechanisch gezwungen, das Underlying zu handeln, um flach zu bleiben. Dieser erzwungene Flow ist der vorhersehbarste Order Flow am Markt.*

---

## Der Job des Dealers ist es, keine Meinung zu haben

Ein Market Maker, der Ihnen eine Call-Option verkauft, will nicht short im Markt sein. Er will den Spread — die paar Cent zwischen Bid und Ask — und er will flach nach Hause gehen. Der Verkauf der Call hat ihn short Delta zurückgelassen, also kauft er Aktien dagegen, bis die Position kein Netto-Richtungsrisiko mehr hat. Das ist Delta-Hedging, und es ist das gesamte Geschäftsmodell eines Optionsdealers: die Option lagern, die Richtung neutralisieren, den Edge einstreichen.

Das Problem ist, dass "flach" kein Ort ist, den man einmal erreicht. Es ist ein Ort, zu dem man immer wieder zurückkehren muss, den ganzen Tag, jeden Tag, weil das Delta eines Options-Books sich weigert, still zu stehen. Und hier kommt der Teil, der für jeden zählt, der Flow liest: Wenn sich dieses Delta bewegt, *entscheidet* sich der Dealer nicht, das Underlying zu handeln. Er wird dazu *gezwungen*. Der Trade trägt keine Meinung, keine Überzeugung, keinen Ermessensspielraum. Das Delta hat sich bewegt, also werden Aktien gekauft oder verkauft. Punkt.

Diese Unterscheidung — erzwungen versus diskretionär — ist der Grund, warum Dealer-Hedging überhaupt lesbar ist. Diskretionärer Flow ist eine Vermutung darüber, was ein Trader tun wird. Erzwungener Flow ist eine Berechnung dessen, was ein Dealer tun *muss*. Das eine ist ein Münzwurf. Das andere ist Arithmetik.

---

## Delta ist ein bewegliches Ziel, keine feste Zahl

Delta ist das Hedge-Verhältnis: wie viele Aktien einen Optionskontrakt ausgleichen. Eine Call-Option mit Delta 0,40 verhält sich gerade jetzt wie 40 Aktien Long pro Kontrakt. Verkaufen Sie 100 dieser Kontrakte, sind Sie 4.000 Delta short; kaufen Sie 4.000 Aktien, sind Sie flach.

Aber 0,40 ist eine Momentaufnahme, keine Konstante. Dieselbe Call-Option wird morgen ein anderes Delta haben, selbst wenn sich die Aktie nie bewegt, ein anderes Delta, wenn die implizite Volatilität sinkt, und ein ganz anderes Delta, wenn die Aktie um 1% steigt. Der Dealer hat auf 0,40 gehedgt. In dem Moment, in dem das Delta auf 0,44 driftet, ist er 400 Delta short, die er nicht eingeplant hatte, und er muss 400 weitere Aktien kaufen, um wieder flach zu werden.

Der Dealer hedgt also nie wirklich das Delta. Er hedgt die *Veränderung* des Deltas. Der anfängliche Hedge ist kostenlos — man setzt ihn einmal auf. Der Flow, das, was auf dem Tape erscheint, ist der endlose Strom von Re-Hedges, die dem Delta hinterherjagen, während es sich bewegt. Wer versteht, was das Delta bewegt, versteht, was den Flow erzwingt.

---

## Die Aktien, die der Dealer bereits hält, sagen Ihnen nichts

Hier ist eine Falle, die man früh umgehen sollte, denn sie versenkt viele naive Analysen der Dealer-Positionierung.

Man könnte meinen, der richtige Weg, den Druck der Dealer zu messen, sei, das gesamte Delta im Book aufzuaddieren — das Delta jedes Kontrakts multipliziert mit seinem Open Interest — und das "Dealer-Exposure" zu nennen. Es fühlt sich richtig an. Es ist das natürliche Geschwisterkind der Gamma-Exposure. Es ist aber auch nahezu nutzlos, und der Grund dafür ist der Aktien-Hedge.

Die Aktien, die ein Dealer gegen seine Optionen hält, haben jeweils ein Delta von genau 1,00. Dieses Aktien-Delta wird *gezielt aufgesetzt, um* das Options-Delta zu annullieren. Konstruktionsbedingt ist das Netto-Delta eines korrekt gehedgten Dealers annähernd null — das Options-Delta und das Aktien-Delta summieren sich zu nichts. Genau das ist der Sinn des Hedges. Eine Zahl, die das *Niveau* des Deltas im Book misst, misst also genau jenes Greek, das die Dealer bereits auf null gebracht haben. Sie sagt Ihnen etwas über eine Position, die konstruktionsbedingt kein Netto-Richtungsrisiko mehr enthält.

Was nicht null ist — was sich niemals vorab weghedgen lässt — ist, wie stark sich dieses Delta gleich *bewegen wird*. Aktien haben ein Delta von 1, und das ändert sich nie. Man kann kein Instrument mit konstantem Delta verwenden, um ein Delta vorzuneutralisieren, das sich mit Spot, Zeit und Vol verschiebt. Dieser Rest, die nicht vorab hedgebare Drift im Delta des Books, ist die gesamte Quelle des erzwungenen Flows. (Wir haben einen ganzen Artikel darüber geschrieben, warum die Delta-Niveau-Zahl eine Falle ist und warum wir uns weigern, sie zu veröffentlichen — siehe [Warum wir den DEX nicht veröffentlichen](/education/why-we-dont-publish-dex).)

---

## Drei Dinge bewegen das Delta, und der Dealer kontrolliert keines davon

Zwischen jetzt und dem Verfall bewegen genau drei Zustandsvariablen das Delta eines Options-Books, und ein Dealer kann keine davon beeinflussen:

- **Spotpreis.** Wenn sich die Aktie bewegt, bewegt sich das Delta jeder Option mit ihr. Die Sensitivität des Deltas gegenüber dem Spot ist das **Gamma**. Das ist der reaktive Flow — er feuert nur, wenn sich der Preis tatsächlich bewegt, und er ist groß und unmittelbar.
- **Zeit.** Je näher der Verfall rückt, desto mehr driftet das Delta, selbst wenn der Spot festgenagelt ist: Out-of-the-Money-Optionen sickern Richtung Delta 0, In-the-Money-Optionen klettern Richtung Delta 1. Die Sensitivität des Deltas gegenüber der Zeit ist das **Charm**. Es läuft kontinuierlich, egal ob etwas passiert oder nicht.
- **Implizite Volatilität.** Wenn die vom Markt eingepreiste Angst steigt oder fällt, verschiebt sich das Delta, obwohl der Spot völlig still steht. Die Sensitivität des Deltas gegenüber der Vol ist das **Vanna**. Ein Vol-Reset kann das Delta des Books heftig bewegen, ohne einen einzigen Preis-Tick.

Preis, die Uhr und die Angst. Das sind die drei Hebel, und der Dealer ist an alle drei gefesselt. Jeder von ihnen zieht, wenn er sich bewegt, das Delta des Books von seinem Hedge weg und erzwingt einen Aktien-Trade, um es zurückzusetzen. Deshalb nennen wir den kombinierten Output **Forced Flow**: es ist der Dollarbetrag an Aktien, den ein Dealer mechanisch zu kaufen oder verkaufen gezwungen ist, während sich Spot, Zeit und Vol entwickeln.

---

## Was das in Dollar bedeutet

Die Abstraktion wird konkret, sobald man ihr eine Größenordnung zuordnet.

Nehmen wir an, das Dealer-Book in SPY sei so positioniert, dass eine 1%-Bewegung im Underlying das aggregierte Dealer-Delta um etwa 1 Million Aktien verändert. Der erzwungene Hedge ist diese Aktienveränderung multipliziert mit dem Aktienkurs: bei SPY $560 sind das 1.000.000 × $560 ≈ **560 Millionen Dollar** an Aktien, die den Besitzer wechseln müssen, nur um das Book gehedgt zu halten — bevor sich auch nur ein einziger diskretionärer Trader eine Meinung gebildet hat. In einem Short-Gamma-Regime kauft der Dealer in die Stärke hinein und verkauft in die Schwäche hinein, und diese 560 Millionen Dollar schieben *mit* der Bewegung, was die Range ausweitet. In einem Long-Gamma-Regime stemmt er sich gegen die Bewegung und komprimiert sie. Derselbe Forced-Flow-Mechanismus, umgekehrtes Vorzeichen, völlig anderes Tape.

Charm und Vanna tragen ihre eigenen Dollar-Etiketten. Allein der Zeitverfall kann bis zum Handelsschluss an einem starken 0DTE-Tag zig Millionen an Aktien erzwingen. Ein Rückgang der impliziten Vol um zwei Punkte nach einem ruhigen CPI-Report könnte einen ähnlichen Betrag an Käufen erzwingen, verteilt über den Nachmittag. Nichts davon ist die Meinung von irgendjemandem. All das ist das Book, das seinem eigenen Delta hinterherjagt, um wieder flach zu werden.

---

## Warum Forced Flow der Flow ist, der es wert ist, gelesen zu werden

Der meiste Order Flow ist ein Nebel konkurrierender Absichten. Jemand kauft, jemand verkauft, und Sie raten die Motivation. Erzwungener Dealer-Flow ist grundverschieden: Er ist der eine große, anhaltende Strom im Markt, der vollständig durch die Positionierung und die drei oben genannten Variablen bestimmt wird. Sie müssen nicht raten, ob er eintritt. Bewegt sich der Spot um 1%, feuert der Gamma-Hedge. Läuft die Uhr auf 16 Uhr zu, kommt der Charm-Flow. Fällt die Vol um zwei Punkte, folgt der Vanna-Hedge. Der Flow ist eine Konsequenz, keine Entscheidung.

Genau das arbeitet der Rest dieser Serie auf. [Delta und seine drei Kinder](/education/delta-and-its-three-children) schlüsselt Gamma, Charm und Vanna als die drei Ableitungen des Deltas auf. [Charm: Die Uhr ist ein Trader](/education/charm-the-clock-is-a-trader) zeigt, wie allein der Zeitverfall einen vorhersehbaren Into-Close-Flow erzwingt, den man Stunden im Voraus berechnen kann. [Vanna: Wenn die Angst verblasst, kaufen Dealer](/education/vanna-when-fear-fades) erklärt den Vol-Kompressions-Sog. Und die Live-Seite [Forced Flow](/forced-flow) berechnet das gesamte Book unter jedem beliebigen Spot-/Zeit-/Vol-Szenario neu, sodass Sie den erzwungenen Trade sehen können, bevor er gedruckt wird.

Der Dealer hat keine Meinung. Genau deshalb ist sein Flow mehr wert als die meisten Meinungen.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.
