# Forced Flow und Zero Flow erklärt: Wo sich das Dealer-Hedging zu null saldiert

*Gamma Exposure zeigt dir, welche Form das Dealer-Hedging hat. Forced Flow versieht es mit einem Dollarbetrag und einer Deadline: wie viele Aktien die Hedger aufgrund des aktuellen Optionsbuchs kaufen oder verkaufen müssten, wenn sich Preis, Zeit oder implizite Volatilität bewegen. Das Zero-Flow-Level macht aus diesem Betrag einen Preis: den einen Spot, an dem sich das alles aufhebt.*

---

## Eine Frage, die die meisten Gamma-Tools auslassen

Net GEX und der Gamma Flip beschreiben die Form des Dealer-Hedgings. Sie sagen dir, ob sich das Hedging gegen eine Bewegung stemmen oder mit ihr laufen dürfte, und ungefähr, wie stark pro Punkt. Was sie dir nicht sagen: um wie viele Aktien es geht, in welche Richtung und bis wann, selbst wenn der Markt überhaupt nichts tut.

Der letzte Teil ist wichtiger, als es klingt. Ein Optionsbuch ändert sein Delta, wenn sich der Preis bewegt, aber auch, wenn die Uhr läuft und wenn sich die implizite Volatilität verschiebt. Ein Hedger, der delta-neutral bleiben will, muss in allen drei Fällen Aktien handeln. Bei einem Index mit einem großen Same-Day-Verfall kann es die Uhr allein bis zum Nachmittag mit den beiden anderen aufnehmen.

Forced Flow stellt genau diese Frage, und das Zero-Flow-Level beantwortet die Anschlussfrage: Bei welchem Preis würde das Buch bis zum Handelsschluss überhaupt nichts schulden?

So ordnet sich Forced Flow neben den beiden anderen Blickwinkeln ein, aus denen ZeroGEX das Dealer-Hedging betrachtet:

| | **GEX und der Gamma Flip** | **Hedging Flow** | **Forced Flow** |
|---|---|---|---|
| Liest | Das bestehende Buch | Die heutigen Trades | Das bestehende Buch |
| Beantwortet | Wie das Hedging pro Preispunkt reagiert | Welchen Hedge die heutigen Trades impliziert haben | Wie viele Aktien ein Szenario erzwingen würde und wo sich das zu null saldiert |
| Zeitrichtung | Eine Momentaufnahme | Rückwärts durch die Session | Vorwärts, bis zum Schluss um 16:00 Uhr ET |
| Einheiten | Dollar-Gamma | Aktien in Dollar | Aktien in Dollar |

Hedging Flow und Forced Flow verwenden bewusst dieselben Einheiten und dieselbe Vorzeichenkonvention, damit sich beide nebeneinander lesen lassen.

---

## Was erzwungener Flow ist

Ausgangspunkt ist die modellierte Dealer-Position: das Open Interest für jeden erfassten Verfall und Strike, wobei angenommen wird, dass die Dealer die Gegenseite der Kunden halten, also netto long die Calls und netto short die Puts. Das ist dieselbe Konvention, die hinter Net GEX und dem Gamma Flip von ZeroGEX steht. Sie ist eine Annahme, keine Beobachtung: Öffentliche Optionsdaten zeigen nicht, wer was hält, und die [Methodik-Seite](/methodology) erklärt, wo die Konvention falsch liegen kann.

Aus dieser Position berechnet Forced Flow das Gesamtdelta des Buchs zweimal: einmal jetzt und einmal unter einem Szenario (ein anderer Preis, ein späterer Zeitpunkt am Tag, eine andere implizite Volatilität oder eine beliebige Mischung). Die Differenz zeigt, wie weit der Hedge abgedriftet ist. Die Aktien, die nötig sind, um ihn wiederherzustellen, sind der erzwungene Flow:

`forced flow = −(dealer delta under the scenario − dealer delta now) × scenario price`

**Positiv bedeutet, dass der delta-neutrale Hedge Aktien kauft. Negativ bedeutet, dass er verkauft.**

Zwei Details machen daraus mehr als eine Überschlagsrechnung:

- **Es ist eine vollständige Neubewertung.** Jeder Kontrakt wird unter dem Szenario neu bepreist, statt durch Aufaddieren von Gamma, Charm und Vanna geschätzt zu werden. Die Greeks aufzuaddieren ist eine gute erste Näherung und eine schlechte endgültige Antwort, weil die drei zusammenwirken; [Delta und seine drei Kinder](/education/delta-and-its-three-children) erklärt, warum.
- **Die Greeks werden trotzdem ausgewiesen, zur Zuordnung.** Die Seite zerlegt jede Zahl in einen Gamma-Anteil (Preis), einen Charm-Anteil (Zeit) und einen Vanna-Anteil (Volatilität), damit du siehst, was sie antreibt. Wenn ein Szenario so extrem ist, dass die einfache Zerlegung nicht mehr aufgeht, ist die vollständige Neubewertung die Zahl, der du vertrauen solltest.

Open Interest wird einmal täglich veröffentlicht. Intraday ändert sich der erzwungene Flow nicht, weil neue Positionen eröffnet wurden. Er ändert sich, weil das bestehende Buch neu bewertet wird, während sich Preis, Zeit und Volatilität bewegen.

---

## Die drei Hebel

Forced Flow bewegt jeweils einen Hebel, und die Seite zeichnet jeden davon:

- **Preis.** Die *Reprice-Kurve* zeigt den erzwungenen Flow bei jedem Preis innerhalb von etwa 2 % um den Spot, falls der Basiswert die Session dort beendet. Die Zeit bis zum Schluss ist eingerechnet, die Kurve zeigt also den Preishebel zusätzlich zu dem, was die Uhr ohnehin schon schuldet.
- **Zeit, bei festem Preis.** *Charm Into the Close* lässt die Uhr bei festgehaltenem Preis von jetzt bis zur Schlussglocke um 16:00 Uhr laufen und zeigt, wie viele Aktien die Dealer unterwegs allein wegen des Zeitverfalls handeln müssen. Die Kurve wird in der letzten Stunde steiler, wenn sich die Same-Day-Optionen auflösen. [Charm: Die Uhr ist ein Trader](/education/charm-the-clock-is-a-trader) erklärt die Mechanik.
- **Volatilität, bei festem Preis und fester Zeit.** Die *Vanna Ladder* verschiebt die implizite Volatilität nach oben und unten, in Schritten von einem halben Punkt bis zu drei Punkte in jede Richtung, und zeigt die Aktien, die jede Verschiebung jetzt sofort erzwingen würde. [Vanna: Wie fallende IV das Dealer-Hedging verändern kann](/education/vanna-when-fear-fades) erklärt, warum.

---

## Was das Zero-Flow-Level ist

Die Reprice-Kurve zeigt den erzwungenen Flow bei jedem Preis, unter der Annahme, dass der Basiswert bei Handelsschluss genau dort steht. Irgendwo entlang der Kurve kreuzt sie die Null. Dieser Preis ist das **Zero-Flow-Level**: der Spot, an dem das Buch, bis zum Schluss fortgeschrieben, nichts schuldet. Dealer müssten dort nichts kaufen oder verkaufen, um gehedgt zu bleiben.

Gäbe es die Uhr nicht, wäre dieser Preis der Spot selbst: keine Bewegung, kein Re-Hedge. Der Grund, warum er woanders liegt, ist die Zeit. Bei unverändertem Preis schuldet der Zeitverfall bis zum Schluss bereits eine gewisse Menge an Aktien. Das Zero-Flow-Level ist die Preisbewegung, deren eigener Hedge genau das aufhebt.

### Ein durchgerechnetes Beispiel

Das sind runde, illustrative Zahlen, keine Live-Werte.

SPY steht bei 660,00 $, zwei Stunden vor der Schlussglocke. Die Reprice-Kurve zeigt **Flow at spot: Kauf 300 Mio. $**. Das ist es, was allein die Uhr schuldet, wenn SPY genau hier schließt.

Nahe am Spot ist das Buch long Gamma: Pro 1 $, den SPY steigt, muss der Hedge SPY für etwa 120 Mio. $ verkaufen, und pro 1 $, den SPY fällt, für etwa 120 Mio. $ kaufen.

Steigt SPY also bis zum Schluss um 2,50 $, hebt preisgetriebenes Verkaufen von etwa 300 Mio. $ das zeitgetriebene Kaufen von etwa 300 Mio. $ auf. Das Zero-Flow-Level liegt ungefähr bei **662,50 $**.

Die Faustregel dahinter:

`distance to zero flow ≈ −(flow at spot) ÷ (forced flow per $1 of price)`

Das ist eine Näherung erster Ordnung. Die Seite bestimmt den Nulldurchgang exakt, indem sie das ganze Buch bei jedem Preis ihres Rasters neu bewertet, was wichtig ist, wenn die Bewegung groß ist oder das Buch viele Same-Day-Optionen enthält.

---

## Magnet oder Pivot: Die Steigung entscheidet

Ein Zero-Flow-Level ist ein einzelner Preis, aber was auf beiden Seiten davon passiert, hängt davon ab, ob die Kurve dort fällt oder steigt.

Nimm das Beispiel oben. Unterhalb von 662,50 $ überwiegt das zeitgetriebene Kaufen das preisgetriebene Verkaufen, das Buch schuldet also Nettokäufe. Oberhalb davon ist es umgekehrt: Nettoverkäufe. Das Hedging neigt sich von beiden Seiten zum Level hin. Das ist ein **Magnet**, ein stabiles Zero-Flow-Level.

Dreh das Buch nun nahe am Spot auf short Gamma: Pro 1 $, den SPY steigt, muss der Hedge 120 Mio. $ *kaufen*, und nimm an, dass die Uhr stattdessen 300 Mio. $ an Verkäufen schuldet. Dieselbe Rechnung legt das Zero-Flow-Level auf dieselben 662,50 $. Jetzt aber schuldet das Buch unterhalb davon Nettoverkäufe und oberhalb Nettokäufe. Das Hedging neigt sich auf beiden Seiten vom Level *weg*. Das ist ein **Pivot**, ein instabiles Zero-Flow-Level: eher ein Stolperdraht als ein Pin.

| Nahe am Level sind Dealer | Unterhalb des Levels | Oberhalb des Levels | Hedging neigt sich | Auf der Seite |
|---|---|---|---|---|
| Long Gamma | Nettokäufe | Nettoverkäufe | Zum Level hin | Magnet: durchgezogene blaue Linie im Field |
| Short Gamma | Nettoverkäufe | Nettokäufe | Vom Level weg | Pivot: gestrichelte bernsteinfarbene Linie im Field |

Derselbe Preis kann das eine oder das andere sein. Wer einen Pivot als Magnet liest, versteht die Neigung genau verkehrt herum, und deshalb zeichnet das Field für die ganze Session die beiden getrennt. Auf der Reprice-Kurve erkennst du es mit bloßem Auge: Eine Kurve, die von Kaufen links zu Verkaufen rechts durch die Null fällt, ist ein Magnet; eine, die durch die Null steigt, ist ein Pivot.

Als Faustregel gilt: Unterhalb des Gamma Flips ist das Zero-Flow-Level, das dem Spot am nächsten liegt, meist ein Pivot, oberhalb meist ein Magnet. Entscheidend ist die Steigung am Level selbst.

„Neigt sich zum Level hin“ und „neigt sich weg“ beschreiben das modellierte Hedging, kein Versprechen über den Preis. Ob der Preis tatsächlich reagiert, ist eine empirische Frage, und die Seite misst das, statt es vorauszusetzen (mehr dazu unten).

---

## Zero Flow ist nicht der Gamma Flip

Die Seite zeigt auf ihrer Rail vier Levels, und sie beantworten vier verschiedene Fragen:

- **Gamma Flip:** der Preis, an dem das modellierte Netto-Dealer-Gamma das Vorzeichen wechselt. Er markiert die Grenze zwischen dem Regime, in dem das Hedging Bewegungen dämpft (oberhalb), und dem, in dem es sie verstärkt (unterhalb). Siehe [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip)
- **Zero-Flow-Level:** der Preis, an dem sich der gesamte erzwungene Flow, bis zum Schluss fortgeschrieben, zu null saldiert. Es bezieht die Zeit mit ins Bild ein, was der Gamma Flip nicht tut.
- **Charm Flip:** der Preis, an dem der Zeitverfall bis zum Schluss das Vorzeichen wechselt. Auf der einen Seite erzwingt die Uhr Käufe, auf der anderen Verkäufe.
- **Vanna Flip:** der Preis, an dem der Hedge, den ein Anstieg der impliziten Volatilität um einen Punkt erzwingt, das Vorzeichen wechselt.

Der Gamma Flip sagt, welche Art von Hedging zu erwarten ist. Das Zero-Flow-Level sagt, wo sich dieses Hedging angesichts der Uhr ausgleicht. Die beiden können nah beieinander oder weit auseinander liegen, und das eine ersetzt nicht das andere.

---

## Wie sich Zero Flow im Tagesverlauf bewegt

Der Horizont ist immer „von jetzt bis zum heutigen Schluss um 16:00 Uhr ET“, das Zero-Flow-Level ist also konstruktionsbedingt ein bewegliches Ziel:

- **Die Uhr verkürzt den Horizont.** Am Morgen bezieht das Level den Zeitverfall einer ganzen Session ein. Spät am Tag bezieht es nur noch das ein, was übrig ist. Um 16:00 Uhr ist der Horizont null, die Uhr schuldet nichts mehr, und das Level fällt auf den Spot zusammen. Nach der Schlussglocke trägt es bis zur nächsten Session keine Information.
- **Die Neubewertung formt die Kurve um.** Wenn sich Preis, implizite Volatilität und Zeit bewegen, ändert sich das Delta jedes Kontrakts und damit auch die Steigung der Kurve und die Stelle, an der sie die Null kreuzt. Das Open Interest bleibt bis zur Veröffentlichung am nächsten Tag unverändert.
- **Das Field bewahrt den Verlauf.** Das Field für die ganze Session auf der Seite rekonstruiert das Buch so, wie es zu jedem Zeitpunkt der Session tatsächlich stand, damit du siehst, wo Magnet und Pivot um 10:00 Uhr, mittags und jetzt lagen, verglichen mit dem Preis, der tatsächlich gedruckt wurde. Rechts von „now“ schreibt es das aktuelle Buch als Projektion bis zum Schluss fort.

---

## Was diese Zahlen nicht sind

**Kein beobachteter Flow.** Erzwungener Flow ist ein Modell dessen, was ein delta-neutraler Hedge erfordern würde, aufgebaut auf einer Annahme darüber, wer das Open Interest hält. ZeroGEX sieht keine Dealerbestände, und echte Desks verrechnen Positionen über mehrere Bücher hinweg, hedgen mit anderen Instrumenten und gleichen innerhalb von Bandbreiten statt kontinuierlich aus. Ein Wert von +300 Mio. $ bedeutet, dass der Hedge des Modells etwa 300 Mio. $ kaufen würde. Er bedeutet nicht, dass irgendjemand das tun wird.

**Kein Kursziel.** Das Zero-Flow-Level ist der Punkt, an dem sich der modellierte Hedge zu null saldiert. Es ist nicht der Ort, an den der Preis gehen muss, und ein Magnet bewirkt nicht, dass der Preis dort ankommt. Hedging ist eine Quelle von Order Flow unter vielen, und an einem Tag mit einem Makro-Katalysator oder einem Index-Rebalancing ist es selten die größte.

**Noch kein gemessener Edge.** ZeroGEX hat keine Studie über mehrere Sessions dazu veröffentlicht, wie oft der Preis nahe am Zero-Flow-Level schließt. Was die Seite tatsächlich misst, ist enger gefasst, und es wird ehrlich dargestellt:

- das Field für die ganze Session zählt innerhalb der heutigen Session, wie oft sich der Preis von einem Schritt zum nächsten auf den Magneten zu (oder vom Pivot weg) bewegt hat. Das beschreibt den heutigen Tag. Es ist keine Prognose für morgen;
- der **Track Record** unten auf der Seite bewertet die Charm-Prognose über mehrere Sessions hinweg. Er bewertet nicht das rohe Kauf-oder-Verkauf-Vorzeichen, das bei einem Indexbuch fast jeden Tag „Kauf“ anzeigt und daher nur die Grundrate wiedergeben würde. Er bewertet, ob ein morgendlicher Charm-Wert, der stärker oder schwächer ausfällt als sein eigenes jüngstes Normalniveau, in dieselbe Richtung zeigt wie die Bewegung von Mittag bis Handelsschluss. Er zeigt die Trefferquote im Vergleich zu einer naiven Baseline, mit einem Konfidenzband von 95 %, und bescheinigt einen Edge erst nach mindestens 30 bewerteten Sessions. Lies sein Urteil, bevor du dich auf die Prognose stützt. Solange er nicht **Significant at 95 %** anzeigt, betrachte sie als unbewiesen.

---

## Die Forced-Flow-Seite der Reihe nach lesen

Die Seite ist als Urteil aufgebaut, gefolgt von den Belegen dafür:

1. **The Read** fasst das Regime, den Into-Close-Flow und das Zero-Flow-Level in einem Satz zusammen, mit drei Kacheln darunter.
2. **Die Forced-Flow Rail** zeigt Gamma Flip, Charm Flip, Vanna Flip und Zero-Flow-Level im Verhältnis zum Spot.
3. **Die Reprice-Kurve** zeigt den Preishebel und wo die Kurve die Null kreuzt.
4. **Charm Into the Close** und die **Vanna Ladder** zeigen den Zeit- und den Volatilitätshebel.
5. **Das Forced-Flow Field** zeigt die ganze Session: links von „now“ die tatsächlichen Werte, rechts die Projektion, mit Magnet und Pivot als Linien hindurch und dem realisierten Preis darüber.
6. **Der Track Record** bewertet die Charm-Prognose.

Die [Hilfeseite zu Forced Flow](/help/platform/forced-flow) ist die Referenz Panel für Panel, einschließlich einiger Zahlen, die ähnlich aussehen, aber unterschiedlich berechnet werden.

---

## Wie du es nutzt

Forced Flow funktioniert am besten als Kontext rund um ein Level oder eine Idee, die du bereits hast, nicht als die Idee selbst. Einige Kombinationen lassen sich klar lesen:

- **Alles passt zusammen.** Long Gamma nahe am Spot, ein Magnet ein paar Punkte darüber und eine Uhr, die bis zum Schluss Käufe schuldet. Das modellierte Hedging neigt sich bei jedem Hebel in dieselbe Richtung. Das ist ein stimmiges Bild, und es hängt trotzdem davon ab, dass nichts Größeres aufs Tape trifft.
- **Ein Pivot nahe am Spot.** Das Level ist ein Stolperdraht, kein Ziel. Entscheidend ist, auf welcher Seite davon der Preis steht, weil der modellierte Druck die Richtung wechselt, wenn der Preis es kreuzt.
- **Die Hebel widersprechen sich.** Die Uhr schuldet Käufe, aber der Preis steht knapp unter einem Pivot, an dem der Preishebel Verkäufe erzwingt. Das Modell liefert keine eindeutige Richtung, und die ehrliche Lesart ist, dass der Hedging-Druck gemischt ist.
- **Spät an einem Verfallstag.** Bei einem schweren 0DTE-Buch kann ein Großteil des Into-Close-Werts auf die letzte Stunde entfallen, und The Read sagt, wie viel. Dann ist der Anteil der Uhr am Hedging am größten, und dann sind auch andere Flows zum Handelsschluss am größten.

Kombiniere es mit [Hedging Flow](/education/hedging-flow-explained). Forced Flow sagt, was das Buch unter einem Szenario erzwingen würde. Hedging Flow schätzt, was die heutigen Trades tatsächlich erzeugt haben. Große erzwungene Käufe bis zum Schluss, während das Tape bereits in dieselbe Richtung drückt, sind ein anderes Setup als dieselbe Zahl, wenn sich das Tape dagegen stemmt.

Für die Grundlagen siehe [Warum Market Maker Aktien handeln](/education/why-market-makers-trade-stock), [Delta und seine drei Kinder](/education/delta-and-its-three-children) und [Warum wir DEX nicht veröffentlichen](/education/why-we-dont-publish-dex). Um die heutigen Zahlen zu sehen, öffne die Live-Seite [Forced Flow](/forced-flow).

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.
