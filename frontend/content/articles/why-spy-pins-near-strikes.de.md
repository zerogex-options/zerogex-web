# Warum pinnt SPY nahe an einem Strike? Options-Pinning erklärt

*Warum pinnt SPY in der Nähe bestimmter Strikes — besonders freitags und zum Handelsschluss? Das ist kein Zufall. Options-Pinning erklärt: der Dealer-Hedging-Mechanismus hinter diesem Sog, warum er am OPEX und am Ende des Handelstages am stärksten ist, und wie man erkennt, ob der heutige Handel pinnen wird.*

---

## Pinning ist keine Aberglaube

Wer regelmäßig SPY-Wochenoptionen handelt, hat es schon beobachtet: SPY driftet zu einem runden Strike — 580, 583, 585 — und am Freitagnachmittag bleibt der Kurs dort, oszilliert in einer Spanne von 30 Cent und weigert sich, diesen Bereich zu verlassen. Dasselbe passiert rund um Quartalsverfälle und am monatlichen OPEX. Und dasselbe geschieht auch an vielen ganz normalen Mittwochen und Donnerstagen, wenn die 0DTE-Kette stark besetzt ist.

Viele Retail-Trader behandeln Pinning als reines Bauchgefühl-Phänomen — "der Markt weiß, wo er sich einpendeln will" — oder schieben es auf Chartmuster. Der Mechanismus ist tatsächlich strukturell und beobachtbar: Dealer-Hedging an Strikes mit hoher Gamma-Konzentration erzeugt gerichtete Flüsse, die den Kurs immer dann zum Strike zurückziehen, wenn er sich davon entfernen will. Sobald man den Mechanismus erkennt, sieht man auch, wann er heute wahrscheinlich aktiv ist und wann nicht.

Dieser Artikel geht die tatsächliche Mechanik des Pinnings durch, erklärt, warum sie sich nahe dem Verfall verstärkt, beschreibt die beiden Pin-Typen, die die meisten Trader verwechseln, sowie die strukturellen Bedingungen, die aus dem heutigen Tag einen Pin-Tag machen. Für die trader-taugliche Checkliste "Ist SPY gerade gepinnt?" siehe [Wie man erkennt, ob SPY gepinnt ist](/education/how-to-know-if-spy-is-pinned). Zur verwandten Max-Pain-Diskussion siehe [Max Pain erklärt](/education/max-pain-explained).

---

## Der Dealer-Hedging-Mechanismus hinter dem Pinning

Der Mechanismus ist einfach, sobald man ihn ausschreibt:

1. Ein bestimmter Strike — sagen wir SPY 583 — trägt eine große Gamma-Konzentration. Kunden haben viele Calls und Puts bei 583 gekauft; Dealer sind im entsprechenden Gegenwert short.
2. Das Dealer-Buch ist an diesem Strike **long Gamma**. Das passiert, wenn Dealer per Saldo in den Optionen *short* sind, die Kunden long halten. (Standardkonvention.)
3. Steigt SPY über 583, wird das Options-Delta der Dealer positiver (sie sind net short Calls; ein steigender Spot lässt ihr Short-Call-Delta-Exposure wachsen). Um neutral zu bleiben, **verkaufen** sie SPY.
4. Fällt SPY unter 583, wird das Options-Delta der Dealer negativer (ihr Short-Put-Delta-Exposure wächst nach unten). Um neutral zu bleiben, **kaufen** sie SPY.
5. Jede Bewegung weg von 583 erzwingt einen Hedging-Trade *zurück* Richtung 583. Der Strike wirkt wie ein Magnet — nicht weil ihn jemand gezielt ansteuert, sondern weil die Hedging-Mathematik den Preis mechanisch dorthin lenkt.

Genau das passiert strukturell, wenn man SPY in einer engen Spanne oszillieren sieht. Es ist nicht "der Markt, der sich entscheidet zu pinnen"; es ist das aggregierte Dealer-Buch, das sich bei jeder Bewegung zurück zur Neutralität korrigiert.

---

## Warum sich das Pinning nahe dem Verfall verstärkt

Der oben beschriebene Mechanismus gilt für jede Option — aber die *Stärke* des Pins hängt von der Gamma-Größenordnung am jeweiligen Strike ab. Zwei Faktoren lassen diese Größenordnung nahe dem Verfall stark anwachsen:

### Gamma skaliert mit 1/√T

Das Gamma pro Optionskontrakt ist ungefähr umgekehrt proportional zur Quadratwurzel der Restlaufzeit. Das Gamma einer 0DTE-Option am Geld ist etwa 5-mal so groß wie das einer Option mit gleichem Strike und 5 Tagen Restlaufzeit, und um Größenordnungen höher als bei einer Monatsoption. Je näher der Verfall rückt, desto größer wird das Gamma pro Kontrakt — und desto größer der Hedging-Trade, den jeder Kurs-Tick erfordert.

Ein 0DTE-Strike, um den herum sich alle positioniert haben, wird im Grunde zu einem schwarzen Loch für den Spot. Dealer müssen extrem große Mengen des Basiswerts für sehr kleine Kursbewegungen bewegen. Pinning wird zum Weg des geringsten Widerstands.

### Open Interest konzentriert sich an runden Strikes

Der Markt konzentriert Open Interest strukturell bei runden Zahlen — 580, 583, 585 bei SPY, 5800, 5810 bei SPX. Am Freitagnachmittag kann die Gamma-Konzentration an einem oder zwei dieser Strikes die restliche Kette zusammengenommen dominieren. Diese Dominanz eines einzelnen Strikes erzeugt den sichtbaren "Magnetismus", den Trader zum Handelsschluss spüren.

Kombiniert man beides — kurze Restlaufzeit plus konzentriertes OI an runden Strikes —, werden Freitagnachmittags-Pins strukturell vorhersehbar. Mittwoch und Montag zeigen schwächere Varianten desselben Musters, da der 0DTE-Flow stetig wächst.

---

## Zwei Pin-Typen — und sie sind nicht dasselbe

Eine häufige Quelle der Verwirrung: **Max Pain** vs. der **Gamma-Magnet**. Beide werden "der Pin" genannt, aber sie werden unterschiedlich berechnet und können voneinander abweichen.

### Max Pain

Max Pain ist der Strike, bei dem die Gesamtauszahlung an Optionshalter am Verfall minimiert wäre. Es ist eine Berechnung der Payoff-Geometrie — reine Mathematik des inneren Werts. Sie zeigt den Strike, der für Optionsschreiber "strukturell günstig" ist.

### Gamma-Magnet

Der Gamma-Magnet ist der Strike mit der größten absoluten Dealer-Gamma-Konzentration — der Strike, an dem das erzwungene Hedging am lautesten ist. Es ist eine Ablesung des Hedging-Flows.

Stimmen beide Strikes überein, ist die Pin-These am schärfsten. Die Kette ist in beide Richtungen ausgeglichen. Weichen sie voneinander ab, gewinnt meist der Gamma-Magnet, weil er der Mechanismus ist, der den preistreibenden Hedging-Flow tatsächlich erzeugt.

[Max Pain erklärt](/education/max-pain-explained) behandelt diese Unterscheidung im Detail und legt ehrlich dar, wie oft Max Pain allein in die Irre führt.

---

## Wann der Pin hält

Die strukturellen Bedingungen, die aus dem heutigen Tag einen Pin-Tag machen:

- **Positives-Gamma-Regime.** Spot über dem Gamma-Flip. Net GEX deutlich positiv. Ohne das kehrt sich der Mechanismus vollständig um.
- **Starke Strike-Konzentration nahe am Spot.** Der Gamma-Magnet liegt innerhalb von 0,3-0,5 % des aktuellen Kurses. Weit vom Spot entfernte Magnete pinnen nicht; sie zielen.
- **Max Pain und Gamma-Magnet stimmen überein.** Beide zeigen auf dasselbe Niveau. Das verstärkt den strukturellen Sog.
- **Vom Verfall dominierte Kette.** 0DTE-/Wochenoptionen tragen den Großteil des Gammas. Von Monatsoptionen dominierte Ketten pinnen deutlich unzuverlässiger.
- **Ruhiger Katalysatorkalender.** Keine wichtigen Makrodaten oder Notenbank-Termine während der Sitzung.
- **Sich komprimierende realisierte Volatilität.** Das Tape zeigt, dass der dämpfende Dealer-Reflex funktioniert.

Wenn die meisten dieser Punkte zusammenkommen, hat der Pin strukturelle Wahrscheinlichkeit auf seiner Seite.

---

## Wann der Pin bricht

Der Pin löst sich auf, wenn:

- **Der Gamma-Flip-Cross eintritt.** Der Spot fällt unter den Flip; das Regime kehrt sich um. Derselbe Magnet gibt den Preis nun frei.
- **Ein Katalysator eintrifft.** CPI, FOMC, NFP, Einzeltitel-Schock. Der Makro-Flow überwältigt den Dealer-Reflex.
- **Net GEX spürbar abnimmt.** Positionen laufen zum Verfall hin aus. Um 15:30 ET am Freitag schrumpft das Gamma schnell.
- **Open Interest wandert.** Frisches OI, das sich an einem anderen Strike aufbaut, zieht den Magneten mitten in der Sitzung woanders hin.
- **Der Skew verschiebt sich.** Ein starkes Put-Bid (Angst) kann das Vorzeichen des Dealer-Buchs selbst am gleichen Strike umkehren.

Ein Pin, der seit zwei Stunden hält, ist beständiger als einer, der sich gerade erst gebildet hat, aber kein Pin hält ewig. Die Bedingungen, die ihn gestützt haben, müssen weiter bestehen, damit der Pin hält.

---

## Den Pin in Echtzeit lesen

Ein kurzer Ablauf:

1. **Den Strike mit dem stärksten Gamma nahe am Spot identifizieren.** Das ist der Magnet-Kandidat.
2. **Net GEX prüfen.** Ein substanziell positiver Wert ist die Voraussetzung. Negativ oder nahe null schließt den Pin aus.
3. **Den Gamma-Flip prüfen.** Der Spot muss darüber liegen. Liegt der Flip genau am Spot, ist die Lage umkämpft — der Pin könnte sich bilden, muss aber nicht.
4. **Max Pain gegenprüfen.** Gleicher Strike oder innerhalb von 0,3 % des Magneten → scharfer Pin. Deutlich abweichend → schwächere Pin-These; dem Magneten vertrauen.
5. **Die Tageszeit lesen.** Vor 12 Uhr ET hat sich Charm noch nicht genug aufgebaut, um den Pin stark zu treiben. Nach 14:00 ET verstärkt sich der Sog. Nach 15:30 ET dominieren die Dynamiken des Schlussfensters.

Sobald der Pin identifiziert ist, findet sich das Trading-Playbook in [Wie man erkennt, ob SPY gepinnt ist](/education/how-to-know-if-spy-is-pinned) — Kurzfassung: Extreme fade-n, die Mitte auslassen, klein positionieren.

---

## Durchgerechnetes Beispiel

SPY notiert an einem Freitagnachmittag bei 582,95. ZeroGEX zeigt:

- **Net GEX:** +1,4 Mrd. $ (positiv — Long-Gamma-Regime)
- **Gamma Flip:** 581,20 (Spot deutlich darüber)
- **Stärkster 0DTE-Strike:** 583,00 (praktisch am Spot)
- **Max Pain:** 583,00 (stimmt mit dem Gamma-Magneten überein)
- **Uhrzeit:** 14:15 ET (Charm-Aufbau beginnt)

Jede strukturelle Bedingung für einen Pin ist erfüllt. Der Magnet liegt bei 583; Max Pain stimmt bei 583 überein; das Regime ist long-gamma; wir befinden uns im aktiven EOD-Fenster. Die Wahrscheinlichkeit, dass SPY bis zum Handelsschluss innerhalb einer Spanne von rund 30 Cent um 583 oszilliert, ist spürbar erhöht.

Praktische Einschätzung: eine enge Spanne von 582,70-583,30 ist der erwartete Verlauf. Ausschläge an die Ränder sind Fade-Setup-Kandidaten. Die Mitte der Spanne ist No-Trade-Territorium. Klein positionieren. Auf die Bruchbedingungen achten — besonders bei einem Einzeltitel-Schock oder einer unerwarteten Schlagzeile.

Nun stelle man sich dasselbe Setup vor, aber mit Net GEX bei −600 Mio. $ und dem Gamma-Flip bei 583,50 (Spot darunter). Die "Pin"-These ist tot. Gleiche Kette, gleicher Strike, entgegengesetzte Lesart — weil die Regime-Variable, die entscheidet, ob der Magnet anzieht oder freigibt, invertiert ist.

---

## Verbreitete Missverständnisse

- **"Pinning ist Psychologie."** Es ist Mechanik. Dealer hedgen unabhängig davon, wer zusieht; der Flow passiert, egal ob Trader daran glauben oder nicht.
- **"SPY pinnt immer an runden Zahlen."** Es pinnt an Strikes, an denen sich Positionierung konzentriert. Runde Zahlen sind häufig, weil sich OI dort ballt — aber der eigentliche Mechanismus ist das OI, nicht die Rundheit der Zahl.
- **"Wenn Max Pain X ist, schließt der Preis bei X."** Oft falsch. Max Pain allein ist nicht der Pin-Mechanismus; das ist der Gamma-Magnet. Weichen sie voneinander ab, gewinnt der Gamma-Magnet.
- **"Pins sind bullisch/bärisch."** Keins von beidem. Sie wirken volatilitätsdämpfend. Range-gebunden. Die Richtung kommt von anderswo; beim Pin geht es um den *Charakter* der Preisbewegung, nicht um die Richtung.
- **"Pinning passiert jeden Freitag."** Oft, aber nicht immer. Manche Freitage haben Katalysatoren, Short-Gamma-Regime oder wandernde Magnete, die den Pin verhindern. Das Lesen der Bedingungen ist entscheidend.

---

## Fazit

> SPY pinnt, weil Dealer-Hedging an Strikes mit hoher Gamma-Konzentration den Preis mechanisch zum Strike zurückzieht. Der Sog ist real, beobachtbar und vorhersehbar genug, um genutzt zu werden — solange die strukturellen Bedingungen ihn stützen.

Die Disziplin besteht darin, die Bedingungen zu prüfen, bevor man annimmt, heute sei ein Pin-Tag. Long-Gamma-Regime + starker Strike am Spot + Max-Pain-Übereinstimmung + späte Sitzungsphase = scharfer Pin. Kippt auch nur einer dieser Faktoren, schwächt das die Lesart. Kippen sie alle, ist die These hinfällig.

Nur redaktioneller Bildungsinhalt — nichts davon ist eine Handelsempfehlung.

---

Wer den heutigen stärksten Gamma-Strike, Max Pain, Gamma-Flip und Net GEX sehen möchte — die vier Zahlen, die entscheiden, ob SPY heute pinnt —, findet sie alle in der kostenlosen Gamma-Levels-Ansicht von ZeroGEX.
