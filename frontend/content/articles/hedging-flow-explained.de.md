# Hedging Flow erklärt: Das Options-Tape durch den Hedge lesen

*Die meisten Gamma-Tools fragen, wie Dealer hedgen könnten, wenn sich der Preis bewegt. Hedging Flow fragt, welchen Hedge der heutige Optionshandel bereits impliziert und ob das Gamma rund um den Preis so aufgestellt ist, dass es diesen Druck absorbiert oder verstärkt.*

---

## Eine andere Frage als GEX

Gamma Exposure ist eine strukturelle Lesart. Sie geht vom Open Interest in den Büchern aus und fragt: Wenn sich der Preis bewegt, wie könnte das Hedging reagieren?

Hedging Flow geht stattdessen vom Tape aus. Welchen Aktien-Hedge würde die Aktivität der heute tatsächlich gehandelten Optionen implizieren, und in welche Richtung drückt er gerade?

Die Seite kombiniert diese Schätzung mit einer Lesart, wie sich das Dealer-Gamma nahe dem aktuellen Preis verändert, und verdichtet beides zu einer Headline: **Gamma Weather**. Nichts davon ist ein Kauf- oder Verkaufssignal. Es beantwortet eine engere und nützlichere Frage: Drückt das Options-Tape mit dem Preis oder gegen ihn, und wird die Struktur rund um den Preis diesen Druck eher dämpfen oder eher verstärken?

---

## Was die Zahl ist

ZeroGEX klassifiziert Optionsvolumen, indem es den Preis, zu dem gehandelt wurde, mit der Kursstellung um diesen Zeitpunkt vergleicht:

- Volumen, das nahe am Ask gedruckt wird, zählt als **käuferinitiiert**;
- Volumen, das nahe am Bid gedruckt wird, zählt als **verkäuferinitiiert**;
- Volumen in der Mitte des Spreads, Volumen in der ersten Minute der Session und Volumen ohne verwertbare Kursstellung bleiben **unklassifiziert**.

Innerhalb jedes Kontrakts und jeder Minute wird unklassifiziertes Volumen im selben Kauf-/Verkaufsverhältnis aufgeteilt wie das klassifizierte Volumen dieser Minute. Eine Kontrakt-Minute ohne klassifiziertes Volumen trägt nichts bei.

Das Modell nimmt dann an, dass die passive Seite jedes klassifizierten Trades ein Market Maker war, der hedgt, um delta-neutral zu bleiben, und berechnet die Aktien, die dieser Hedge handeln würde:

`(contracts bought − contracts sold) × delta × 100 × underlying price`

Delta ist vorzeichenbehaftet, positiv für Calls und negativ für Puts, also ist das Vorzeichen des Ergebnisses die Richtung des implizierten Hedges: **Positiv bedeutet, dass der Hedge den Basiswert kauft, negativ, dass er verkauft.** Die Ergebnisse werden in feste Fünf-Minuten-Balken von 9:30 bis 16:15 Uhr ET summiert.

Zwei kurze Beispiele, mit SPY bei 660 $:

- Ein Kunde kauft 1.000 Calls mit einem Delta von 0,40: `1,000 × 0.40 × 100 × $660 = +$26.4M`. Der Market Maker, der sie verkauft hat, ist jetzt short Delta, also **kauft** der implizierte Hedge SPY für etwa 26,4 Mio. $.
- Ein Kunde kauft 1.000 Puts mit einem Delta von −0,30: `1,000 × (−0.30) × 100 × $660 = −$19.8M`. Der implizierte Hedge **verkauft** etwa 19,8 Mio. $. Hätte der Kunde diese Puts stattdessen verkauft, dreht das Vorzeichen auf +19,8 Mio. $.

---

## Was die Zahl nicht ist

Das entscheidende Wort ist *impliziert*. Ein Wert von +500 Mio. $ bedeutet, dass die klassifizierte Optionsaktivität unter den Annahmen des Modells Käufe im Basiswert von rund 500 Mio. $ impliziert. Er bedeutet nicht, dass Dealer Aktien für 500 Mio. $ gekauft haben.

ZeroGEX sieht nicht, wer auf welcher Seite eines Trades steht, ob ein Trade eine Position eröffnet oder geschlossen hat oder was ein Market Maker tatsächlich hält oder hedgt. Die Annahme, dass die passive Seite ein Market Maker war, wurde noch nicht anhand von Market-Maker-Daten validiert, die von der Börse klassifiziert wurden. Deshalb steht auf der Seite unter dem Chart dieser Hinweis:

> Geschätzter Hedging-Druck. Abgeleitet aus nach Aggressor klassifizierten Optionstrades unter der Annahme, dass die passive Seite jedes Prints ein Market Maker war; diese Annahme ist nicht validiert. Kein beobachteter Dealer-Flow.

Ein paar weitere Grenzen solltest du kennen:

- jedes Leg eines Spreads wird einzeln klassifiziert, sodass ein einzelner Multi-Leg-Trade als getrennte Käufe und Verkäufe erscheinen kann;
- das Delta wird einmal pro Kontrakt und Minute erfasst, nicht im Moment jedes einzelnen Trades;
- die Schätzung umfasst die Verfälle und Strikes, die ZeroGEX für dieses Symbol erfasst, nicht jeden gelisteten Kontrakt.

---

## Calls sind nicht automatisch bullisch, und Puts sind nicht automatisch bärisch

Weil Delta ein Vorzeichen hat, hängt die Richtung des implizierten Hedges sowohl vom Optionstyp ab als auch davon, welche Seite den Trade initiiert hat:

| Kundenaktivität | Implizierter Hedge |
|---|---|
| Kauft Calls | Kauft den Basiswert (+) |
| Verkauft Calls | Verkauft den Basiswert (−) |
| Kauft Puts | Verkauft den Basiswert (−) |
| Verkauft Puts | Kauft den Basiswert (+) |

Deshalb beschreiben die Karten **Call-driven** und **Put-driven**, woher der Druck kam, nicht ob er bullisch oder bärisch war. Ein positiver Put-driven-Wert ist durchaus möglich: So sieht starkes Put-Verkaufen aus. Dasselbe gilt für einen negativen Call-driven-Wert.

---

## Die Karten: wie der Tag bisher gelaufen ist

Drei der vier Karten fassen die bisherige Session zusammen:

- **Session pressure** ist die laufende Nettosumme des geschätzten Hedging-Drucks seit der Eröffnung. Sie ist kumulativ, nicht der aktuelle Fünf-Minuten-Druck.
- **Call-driven** ist der Teil dieser Summe, der von Calls kam.
- **Put-driven** ist der Teil, der von Puts kam.

Call-driven plus Put-driven ergibt Session pressure. Abweichungen in den angezeigten Zahlen sind Rundungsdifferenzen. Die Karten lesen den neuesten Balken, der echten Flow enthielt, sodass ein ruhiger, fortgeschriebener Balken nicht als neu gemeldet wird.

Halte Vergangenheit und Gegenwart auseinander. Eine Session kann +2 Mrd. $ Session pressure aufweisen, während ihre letzten Balken bereits ins Negative gedreht haben. Die Summe sagt, wie der Tag bisher gelaufen ist. Sie sagt nicht, wohin die nächsten Minuten gehen. Die vierte Karte, **Last flip**, betrifft die Gegenwart; sie wird unten bei den Flips behandelt.

---

## Das Flow-Chart: Pressure rate und Session cumulative

Das Chart hat zwei Ansichten.

**Pressure rate** ist die Standardansicht. Jeder Balken ist der geschätzte Druck eines einzelnen Fünf-Minuten-Balkens für sich (**Pressure this bar**), darüber liegt die Linie **3-bar average**, ungefähr die letzten 15 Minuten. Der neueste Balken kann sich noch füllen und zählt währenddessen in diesen Durchschnitt.

**Session cumulative** zeigt stattdessen die laufenden Summen von Call-driven und Put-driven und die Linie **Net hedging pressure**.

Beide Ansichten zeichnen **Price** auf der rechten Achse, und genau dort zeigt sich tendenziell die nützliche Intraday-Information:

| Preis | Druck | Eine mögliche Lesart |
|---|---|---|
| Steigend | Positiv | Hinter der Bewegung steht geschätzte Hedge-Nachfrage |
| Steigend | Negativ | Der Preis steigt gegen den geschätzten Druck |
| Fallend | Positiv | In den Rückgang hinein zeigen sich geschätzte Käufe |
| Fallend | Negativ | Das Options-Tape verstärkt die Bewegung |

Das Verhältnis ist meist aussagekräftiger als die Größe eines einzelnen Balkens. Auch ein großer Impuls, der den Preis kaum bewegt, sagt etwas aus: Die andere Seite des Marktes nimmt ihn auf.

Der Umschalter zwischen den Ansichten ändert auch das Struktur-Chart darunter, sodass beide immer Gleiches mit Gleichem vergleichen. In Pressure rate zeigt es die strukturelle Veränderung der letzten 30 Minuten. In Session cumulative zeigt es die Veränderung seit der Eröffnung.

---

## Flips und die Karte Last flip

Ein **Flip** markiert einen Richtungswechsel des 3-Balken-Durchschnitts und ist bewusst schwerer auszulösen als ein Vorzeichenwechsel:

- der Durchschnitt muss sich jenseits eines **flachen Bands** um null etablieren, das in jede Richtung bis zur Hälfte der bisher typischen Rate der Session reicht. Eine Linie, die kurz über null und wieder zurück zuckt, gilt als flach, nicht als zwei Flips;
- ein Flip ist **signifikant**, wenn sein Ausschlag mindestens so groß ist wie der bisher typische Ausschlag der Session von Balken zu Balken. Die übrigen sind **leicht**.

Beide Schwellen werden nur aus den Balken vor dem Flip gebildet, sodass jeder Flip nach dem beurteilt wird, was zu diesem Zeitpunkt bekannt war. Der neueste Balken füllt sich allerdings noch, sodass ein Flip darauf erscheinen und wieder verschwinden kann, bevor dieser Balken schließt.

Das Chart markiert Flips mit einem Punkt auf der Nulllinie und einem Badge darüber und zeigt standardmäßig nur signifikante Flips. Die Karte **Last flip** ist anders: Sie zeigt den neuesten Flip jeder Größe, mit der Startzeit seines Balkens. Ist der neueste Flip ein leichter, können Karte und Badge unterschiedliche Flips nennen. Entferne das Häkchen bei **Significant flips only**, um auch die leichten im Chart zu sehen. Alle Zeiten auf der Seite sind Eastern Time im 24-Stunden-Format.

---

## Dealer gamma structure: worauf der Druck trifft

Hedging Flow schätzt den Druck. **Dealer gamma structure** beschreibt, worauf er trifft, auf Basis des modellierten Dealer-Gammas von ZeroGEX, wobei jeder Strike danach gewichtet wird, wie nah er am aktuellen Preis liegt. Strikes innerhalb von etwa 1 % um den Preis tragen den Großteil des Gewichts, Strikes mehr als 8 % entfernt gar keines.

Für alles in diesem Abschnitt gilt: Open Interest wird einmal täglich veröffentlicht. Diese Werte bewegen sich nicht, weil intraday neue Positionen eröffnet wurden. Sie bewegen sich, weil das bestehende Buch neu bewertet wird, während sich Preis, Zeit und implizite Volatilität ändern.

Das Chart zeichnet zwei Linien:

- **Stability** misst, ob sich das preisnahe Gamma in eine Richtung verändert hat, die Bewegungen dämpfen sollte (über null, in Richtung Pinning), oder in eine, die sie verstärken sollte (unter null, in Richtung Beschleunigung).
- **Lean** vergleicht, wie sich das Gamma unterhalb des Preises verändert hat, mit der Veränderung oberhalb des Preises. Über null heißt **Supportive**: Gamma baut sich unterhalb des Preises auf, erodiert oberhalb davon, oder beides. Unter null heißt **Capping**, das Gegenteil.

Beide messen Veränderung, nicht Niveau. Ein Wert in Richtung Pinning bedeutet nicht, dass das ganze Buch long Gamma ist. Er bedeutet, dass sich die Struktur nahe am Preis über das Zeitfenster in eine dämpfende Richtung bewegt hat.

Das Label neben der Überschrift kombiniert die beiden Linien, getrennt bei null: **Firming** (stabilisierend, stützend), **Capping** (stabilisierend, Aufbau oberhalb), **Fragile bid** (stützend, aber ausdünnend) und **Deteriorating** (ausdünnend und deckelnd). Gamma Weather, weiter unten, stuft denselben Stability-Wert mit einem flachen Band ein, sodass das Chart Firming anzeigen kann, während die Weather-Leiste Flat anzeigt. Das ist kein Widerspruch: Ein kleiner positiver Wert ist beides.

---

## Gamma Weather: die Leiste ganz oben

**Gamma Weather** ist die kombinierte Lesart oben auf der Seite. Sie zeigt einen Headline-Zustand, wie lange dieser Zustand schon anhält, eine Zusammenfassung in einem Satz und fünf Chips: **Pressure now**, **Lean**, **Stability**, **Gamma trend** und **Flip cushion**. Klick auf einen Chip, um ein Chart dieses Felds für die Session zu öffnen, mit einer Spur der Momente, in denen es sich geändert hat.

Weather liest immer alle erfassten Verfälle, und zwar den neuesten Balken, der sowohl Hedging-Flow-Daten als auch einen Strukturwert enthält.

### Pressure now

**Pressure now** macht aus dem letzten Balken und seinem 15-Minuten-Durchschnitt eine Richtung, und die Regel ist strenger, als die Labels vermuten lassen:

- **Buying:** Der letzte Balken und der 15-Minuten-Durchschnitt sind beide positiv, und mindestens einer davon ist größer als 25 Mio. $.
- **Selling:** das Spiegelbild.
- **Mixed:** alles andere. Die beiden widersprechen sich, einer davon ist genau null, beide liegen innerhalb von 25 Mio. $, oder es gibt noch nicht genug Historie. Die ersten beiden Balken jeder Session zeigen Mixed.

Mixed ist nicht dasselbe wie ruhig. Es bedeutet, dass der unmittelbare Druck und der Druck im kurzen Fenster nicht genug übereinstimmen, um eine Richtung zu benennen. Die Untergrenze von 25 Mio. $ ist für jedes Symbol gleich, bei SPX ist sie also eine niedrigere Hürde als bei SPY oder QQQ.

Neben der Richtung zeigt der Chip, wie gefestigt sie ist:

- **Pulse:** der erste Hinweis, noch kein Zustand.
- **Building:** Zwei der letzten drei Balken übertreffen 25 Mio. $ in dieser Richtung, ebenso der 15-Minuten-Durchschnitt.
- **Persistent:** Alle drei Balken tun das.
- **Reversed:** wird auf dem einen Balken angezeigt, an dem eine etablierte Seite nachgibt, nach zwei Balken auf der anderen Seite. Solange das aussteht, erscheint ein Chip **Pressure reversing · 1/2**.

### Lean, Stability und Gamma trend

**Lean** ist der 30-Minuten-Wert von Lean aus dem Chart, nach Vorzeichen gelesen: Jeder Wert von null oder darüber ist Supportive.

**Stability** ist der 30-Minuten-Wert von Stability aus dem Chart, mit einem Band von 50 Mio. $ um null: **Pinning** über +50 Mio. $, **Accelerative** unter −50 Mio. $, **Flat** dazwischen. Wie die Untergrenze von 25 Mio. $ beim Druck ist das Band für jedes Symbol gleich.

**Gamma trend** ist dieselbe Stability-Messung, aber gegenüber dem ersten Balken der Session statt gegenüber vor 30 Minuten: **Building**, **Thinning** oder **Flat**. So hast du zwei Uhren. Gamma trend Building neben Stability Accelerative ist kein Widerspruch: Es kann bedeuten, dass sich die Struktur früher am Tag verbessert hat und immer noch besser ist als zur Eröffnung, sich aber zuletzt zu verschlechtern begonnen hat.

### Flip cushion

Der **Flip cushion** ist der Abstand zwischen dem Preis und dem modellierten Gamma Flip von ZeroGEX, in Punkten, auf welcher Seite der Preis auch steht. Der Chip zeigt den Abstand mit seiner Richtung, zum Beispiel „4 pts · Narrowing“. Die Zeile unter den Chips ergänzt, auf welcher Seite des Flips der Preis steht, das Band und die Veränderung über die letzten 5 und 15 Minuten.

Punkte allein würden bei jedem Symbol etwas anderes bedeuten, deshalb stuft das Band den Cushion im Verhältnis zur typischen 30-Minuten-Spanne des Basiswerts ein, also zur Median-Spanne von Hoch bis Tief der 30-Minuten-Fenster über die letzten fünf Kalendertage:

| Cushion im Verhältnis zur typischen 30-Minuten-Spanne | Band |
|---|---|
| Bis 0,25× | Crossing |
| Bis 0,60× | Thin |
| Bis 1,25× | Normal |
| Über 1,25× | Secure |

Die Richtung zeigt **Narrowing**, **Widening** oder **Steady** über die letzten 15 Minuten. Zwei Details sind wichtig:

- Narrowing bedeutet, dass der Abstand geschrumpft ist. Das muss nicht heißen, dass sich der Preis auf eine feste Linie zubewegt hat, denn auch der Flip bewegt sich.
- Der Cushion hat kein Vorzeichen. Wenn der Preis den Flip kreuzt, schrumpft der Cushion auf null und weitet sich dann auf der anderen Seite wieder. Widening direkt nach einem Kreuzen bedeutet nicht, dass die Bedingungen sicherer geworden sind.

Wenn das Band Thin oder Crossing ist und sich der Cushion innerhalb von 15 Minuten um mindestens ein Viertel des verbleibenden Raums geschlossen hat, zeigt der Chip **Thin and closing**, und auf der Leiste erscheint eine Markierung **Transition risk**.

### Wie die Headline bestimmt wird

Die Headline kombiniert nur zwei Chips, Pressure now und Stability:

| Pressure now | Stability | Gamma Weather |
|---|---|---|
| Mixed | Beliebig | Mixed |
| Buying | Pinning oder Flat | Stable bid |
| Buying | Accelerative | Fragile rally |
| Selling | Pinning oder Flat | Supported dip |
| Selling | Accelerative | Unstable |

Ein neuer Zustand muss auf zwei Fünf-Minuten-Balken in Folge erscheinen, bevor er die aktuelle Headline ersetzt, und der neuere der beiden kann sich noch füllen. Solange er wartet, zeigt die Leiste ihn als im Entstehen an, zum Beispiel **Fragile rally forming · 1/2**. Sobald ein Zustand die Headline hält, zeigt sein Alter **New**, dann **Established** nach 15 Minuten, **Confirmed** nach 30 und **Mature** nach 60.

Lean, Gamma trend, der Flip cushion, Session pressure und der Preis entscheiden nicht über die Headline. Sie sind Kontext dazu. Insbesondere der Cushion relativiert den Zustand; er konkurriert nie mit ihm.

Die Namen sind keine Aussagen über den Preis. „Fragile rally“ setzt nicht voraus, dass der Preis steigt: Es bedeutet Kaufdruck auf eine Struktur, die beschleunigend geworden ist. „Supported dip“ setzt keinen sichtbaren Rücksetzer voraus: Es bedeutet Verkaufsdruck auf eine Struktur, die hält oder sich festigt. Lies Weather als Beschreibung, wie der aktuelle Druck und die aktuelle Struktur zusammenwirken, nicht als Prognose.

---

## Ein Live-Beispiel lesen

![SPY Hedging Flow um 14:56 Uhr ET am 28. September 2026: Gamma Weather, die vier Karten, das Pressure-rate-Chart und die Dealer-Gamma-Struktur](/blog/zerogex-hedging-flow-spy-2026-09-28-cropped.png)

Hier ist SPY um 14:56 Uhr ET am 28. September 2026, aufgenommen mit dem Snapshot-Button der Seite. Jede vergangene Session ist unter [Hedging-Flow-Sessions](/hedging-flow/sessions) archiviert, eine datierte Seite pro Symbol. Klick auf das Bild, um es größer zu sehen. Die Preisniveaus unten sind aus dem Chart abgelesen, betrachte sie also als ungefähre Werte.

**Die Karten.** Session pressure zeigt −4,76 Mrd. $: geschätzte 4,76 Milliarden $ an SPY-Verkäufen, impliziert durch die klassifizierten Optionstrades des Tages. Beide Bücher trugen fast gleich viel bei, −2,50 Mrd. $ aus Calls und −2,26 Mrd. $ aus Puts. Im Modell heißt das: Kunden verkaufen Calls und kaufen Puts, und beides impliziert einen Hedge, der verkauft.

**Der Preis folgte der Summe nicht.** SPY eröffnete nahe 767,75 $, erreichte vor 10:00 Uhr etwa 768,40 $, rutschte dann bis 10:51 Uhr auf etwa 763,95 $ ab, und die stärkste Serie von Verkaufsbalken kam während dieses Rückgangs. Bis 12:25 Uhr holte SPY alles wieder auf und verbrachte den Nachmittag, abgesehen von einer Spitze zum Tageshoch nahe 768,80 $ um 13:10 Uhr, zwischen ungefähr 766,40 $ und 767,50 $. Zum Zeitpunkt des Snapshots lag SPY weniger als einen Dollar von seinem ersten Print entfernt. Die beiden scharfen Sprünge, gegen 12:20 und 13:10 Uhr, kamen mit den größten Kaufbalken des Tages, und der zweite wurde neben einem großen Verkaufsbalken sofort wieder abgegeben. Die Summe blieb tief im Negativen, während der Preis vollständig zurückkam, und genau deshalb hält man Session pressure und Pressure rate auseinander: Die erste zeigt, wo das Tape gewesen ist, nicht, wohin der Preis gehen muss.

**Der Weather-Verlauf.** Der Aufklappbereich von Pressure now färbt jeden Balken nach dem damaligen Weather-Zustand ein: Mixed in der ersten Stunde, Unstable während des Rückgangs am späten Vormittag, Supported dip, während der Preis nahe 765 $ einen Boden bildete, Stable bid während der Mittagsrally und seitdem mehrere Wechsel.

**Im Moment.** Der 3-Balken-Durchschnitt drehte um 14:45 Uhr auf Kaufen, und genau das zeigt die Karte Last flip. Es war der 13. Flip, den das Chart an diesem Tag markierte, nach diesem Maßstab ein unruhiges Tape. Kaufdruck zusammen mit einem Stability-Chip auf Flat ergab die Headline **Stable bid**, und sie hatte seit 10 Minuten Bestand. Doch der Balken von 14:55 Uhr, etwa eine Minute alt, als der Snapshot aufgenommen wurde, druckte bereits auf der Verkaufsseite. Pressure now zeigt Mixed, **Mixed forming · 1/2** zeigt den Kandidaten, und **Pressure reversing · 1/2** zeigt, dass die Kaufseite seit einem Balken nachgibt. Der Header wechselt nur dann auf Mixed, wenn der nächste Balken das bestätigt, und dieser eine Minute alte Balken kann sich noch ändern, bevor er schließt.

**Struktur.** Stability steht auf Flat: Die 30-Minuten-Veränderung des preisnahen Gammas liegt in beide Richtungen innerhalb von 50 Mio. $. Lean steht auf Supportive. Das Label des Charts zeigt für dieselben zwei Werte Fragile bid, weil es bei null trennt und Stability knapp darunter liegt, während Lean knapp darüber liegt. Gamma trend steht auf Thinning: Das preisnahe Gamma hat seit der Eröffnung abgenommen. Die Strukturlinien machten ihre größten Bewegungen, als auch der Preis es tat, beide unter −1,2 Mrd. $ am Tief um 10:50 Uhr und Stability nahe +1,35 Mrd. $ am Hoch um 12:25 Uhr. Das passt zu einem festen Buch, das neu bewertet wird, während sich der Preis hindurchbewegt.

**Flip cushion.** SPY liegt etwa 3 Punkte unter dem modellierten Gamma Flip, Secure und langsam wachsend. Unterhalb des Flips liegt die Seite, die unser [Leitfaden zum Gamma Flip](/education/how-to-read-a-gamma-flip) als in der Regel short Gamma beschreibt, wo das Hedging Bewegungen tendenziell verstärkt, und „Secure“ besagt, dass der Preis mehr als die Spanne einer typischen halben Stunde bräuchte, um den Flip zu erreichen. Es besagt nicht, dass die Bedingungen ruhig sind. Weather liest die Veränderung des Buchs in der letzten halben Stunde; der Cushion liest, in welchem Regime sich der Preis befindet. Hier zeigen sie in verschiedene Richtungen: eine Headline Stable bid, im verstärkenden Regime.

**Zusammengenommen:** ein Tag mit starken geschätzten Hedge-Verkäufen, am deutlichsten im Rückgang am späten Vormittag, von dem sich der Preis inzwischen vollständig erholt hat, ein Druck, der um 14:45 Uhr auf Kaufen drehte und um 14:55 Uhr bereits wankte, eine preisnahe Struktur, die jetzt flach und dünner als zur Eröffnung ist, und ein Preis, der komfortabel auf der verstärkenden Seite des Flips liegt. Das ist eine ganz andere Lesart als „−4,76 Mrd. $, also bärisch“.

---

## Wie du es nutzt

Hedging Flow funktioniert am besten als Kontext für eine Trade-Idee, nicht als die Idee selbst.

Nimm einen Test einer Put Wall. Steht Pressure now auf Buying, Stability auf Pinning und weitet sich der Cushion, findet dieser Test in einem ganz anderen Umfeld statt als bei derselben Wall, getestet mit Selling-Druck, Stability auf Accelerative und einem Cushion, der dünn ist und sich schließt. Das Level hat sich nicht verändert. Die Bedingungen darum herum schon. Dasselbe gilt für VWAP, die Opening Range, den Gamma Flip sowie die Call und Put Walls.

Die Seite fügt sich in eine einfache Abfolge ein:

1. **Wo liegen die Levels?** Die Gamma-Levels von ZeroGEX beantworten das.
2. **Wohin drückt das Options-Tape gerade?** Hedging Flow.
3. **Wird die Struktur rund um den Preis diesen Druck eher absorbieren oder verstärken?** Dealer gamma structure und Gamma Weather.

Hedging Flow unterscheidet sich außerdem von Forced Flow, auch wenn beide dieselben Einheiten und dieselbe Vorzeichenkonvention verwenden. Hedging Flow liest die heutigen Trades und sagt, welchen Druck sie erzeugt haben. Forced Flow liest das bestehende Buch und fragt, welchen Druck es bei einer Bewegung von Preis, Zeit oder Volatilität erzeugen würde.

---

## Ein Hinweis zum Schalter 0DTE only

Der Schalter **0DTE only** beschränkt den Flow-Teil der Seite auf Kontrakte, die an diesem Tag verfallen: die vier Karten, das Flow-Chart, seine Flip-Markierungen und das Badge sowie das Chart im Aufklappbereich von Pressure now. Die Headline und die Chips von Gamma Weather und das Chart Dealer gamma structure ändern sich nicht. Sie lesen immer alle erfassten Verfälle, weil Struktur eine Eigenschaft des ganzen Buchs ist, und das gilt auch für den Druck hinter dem Chip Pressure now.

Für die Referenz Seite für Seite siehe die [Hilfeseite zu Hedging Flow](/help/platform/hedging-flow). Für die Mechanik dahinter siehe [Warum Market Maker Aktien handeln](/education/why-market-makers-trade-stock), [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip) und [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.
