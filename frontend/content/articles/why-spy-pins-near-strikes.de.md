# Warum pinnt SPY nahe an einem Strike? Options-Pinning erklärt

*Warum pinnt SPY in der Nähe bestimmter Strikes - besonders freitags und zum Handelsschluss? Das ist selten Zufall. Options-Pinning erklärt: der modellierte Dealer-Hedging-Mechanismus, der den Preis zu einem Strike ziehen kann, warum er am OPEX und zum Ende des Handelstages tendenziell am stärksten ist, und wie man einschätzt, ob das heutige Tape wahrscheinlich pinnt.*

---

## Pinning ist kein Aberglaube

Wer regelmäßig SPY-Wochenoptionen handelt, hat es schon beobachtet: SPY driftet zu einem runden Strike - 580, 583, 585 - und am Freitagnachmittag bleibt der Kurs dort, oszilliert in einer Spanne von 30 Cent und weigert sich, diesen Bereich zu verlassen. Dasselbe passiert rund um Quartalsverfälle und am monatlichen OPEX. Und dasselbe geschieht auch an vielen ganz normalen Mittwochen und Donnerstagen, wenn die 0DTE-Kette stark besetzt ist.

Viele Trader behandeln Pinning als reines Bauchgefühl-Phänomen - "der Markt weiß, wo er sich einpendeln will" - oder schieben es auf Chartmuster. Darunter liegt eine konkretere Geschichte: Modelliertes Dealer-Hedging an Strikes mit hoher Gamma-Konzentration kann Flows erzeugen, die den Kurs tendenziell zum Strike zurückziehen, neben anderen Faktoren wie Liquidität, Positionierung und Verfallsmechanik. Sobald du den Mechanismus erkennst, kannst du auch einschätzen, wann er heute wahrscheinlicher wirkt und wann nicht.

Dieser Artikel geht die tatsächliche Mechanik des Pinnings durch, erklärt, warum sie sich nahe dem Verfall verstärkt, beschreibt die beiden Pin-Typen, die die meisten Trader verwechseln, die strukturellen Bedingungen, die aus dem heutigen Tag einen Pin-Tag machen, die fünf Anzeichen, dass gerade ein Pin aktiv ist, und das Playbook, das ein gepinntes Tape belohnt. Zur verwandten Max-Pain-Diskussion siehe [Max Pain erklärt](/education/max-pain-explained).

---

## Der Dealer-Hedging-Mechanismus hinter dem Pinning

Der Mechanismus ist am leichtesten zu sehen, wenn du ihn ausschreibst - behalte dabei im Hinterkopf, dass es ein Modell des Dealer-Verhaltens ist, nichts, was du direkt am Tape ablesen kannst:

1. Ein bestimmter Strike - sagen wir SPY 583 - trägt eine große Gamma-Konzentration. Im Standard-Positionierungsmodell wird angenommen, dass das Dealer-Buch dort **long** Gamma ist. (Eine große Konzentration allein beweist das nicht - Open Interest zeigt, wie viele Kontrakte offen sind, nicht, wer long oder short ist -, aber es ist die Arbeitsannahme, wenn Calls den Strike dominieren.)
2. Ist das Dealer-Buch am Strike long Gamma, stemmt sich das Hedging *gegen* Bewegungen von ihm weg - der stabilisierende Reflex, der den Preis tendenziell pinnt. (Es ist das Positive-Gamma-Regime, das sich an einem einzelnen dominanten Strike abspielt.)
3. Steigt SPY über 583, wird das modellierte Hedge-Delta positiv, sodass Dealer, um neutral zu bleiben, SPY tendenziell **verkaufen**.
4. Fällt SPY unter 583, wird das modellierte Hedge-Delta negativ, sodass Dealer, um neutral zu bleiben, SPY tendenziell **kaufen**.
5. Jede Auslenkung weg von 583 lädt zu einem Hedging-Trade *zurück Richtung* 583 ein. Der Strike kann wie ein Magnet wirken - nicht weil ihn jemand gezielt ansteuert, sondern weil die Hedging-Mathematik den Preis im Modell wieder in diese Richtung lenkt.

Das ist eine plausible Lesart dessen, was passiert, wenn du SPY in einer engen Spanne oszillieren siehst: Das aggregierte Dealer-Buch korrigiert sich bei jeder Bewegung zurück Richtung Neutralität. Es ist selten das Einzige, was vor sich geht - Liquidität, Trader-Verhalten und Verfallsmechanik tragen ebenfalls bei -, aber oft ein dominanter Faktor.

---

## Warum sich das Pinning nahe dem Verfall verstärkt

Der oben beschriebene Mechanismus gilt für jede Option - aber die *Stärke* des Pins hängt von der Gamma-Größenordnung am jeweiligen Strike ab. Zwei Faktoren lassen diese Größenordnung nahe dem Verfall stark anwachsen:

### Gamma skaliert mit 1/√T

Das Gamma pro Optionskontrakt ist ungefähr umgekehrt proportional zur Quadratwurzel der Restlaufzeit. Das Gamma einer 0DTE-Option am Geld ist etwa 5× so groß wie das einer Option mit gleichem Strike und 5 Tagen Restlaufzeit, und um Größenordnungen höher als bei einer Monatsoption. Je näher der Verfall rückt, desto größer wird das Gamma pro Kontrakt - und desto größer der Hedging-Trade, den jeder Kurs-Tick erfordert.

Ein 0DTE-Strike, um den herum sich alle positioniert haben, kann sich für den Spot wie ein schwarzes Loch verhalten. Dealer müssen unter Umständen sehr große Mengen des Basiswerts für sehr kleine Kursänderungen bewegen, sodass Pinning zum Weg des geringsten Widerstands werden kann.

### Open Interest konzentriert sich an runden Strikes

Der Markt konzentriert Open Interest strukturell bei runden Zahlen - 580, 583, 585 bei SPY, 5800, 5810 bei SPX. Am Freitagnachmittag kann die Gamma-Konzentration an einem oder zwei dieser Strikes die restliche Kette zusammengenommen dominieren. Diese Dominanz eines einzelnen Strikes ist ein großer Teil des sichtbaren "Magnetismus", den Trader zum Handelsschluss spüren.

Kombiniert man beides - kurze Restlaufzeit + konzentriertes OI an runden Strikes -, werden Freitagnachmittags-Pins strukturell wahrscheinlicher. Mittwoch und Montag zeigen schwächere Varianten desselben Musters, da der 0DTE-Flow stetig wächst.

---

## Zwei Pin-Typen - und sie sind nicht dasselbe

Eine häufige Quelle der Verwirrung: **Max Pain** vs. der **Gamma-Magnet**. Beide werden "der Pin" genannt, aber sie werden unterschiedlich berechnet und können voneinander abweichen.

### Max Pain

Max Pain ist der Strike, bei dem die Gesamtauszahlung an Optionshalter am Verfall minimiert wäre. Es ist eine Berechnung der Payoff-Geometrie - reine Mathematik des inneren Werts. Sie zeigt den Strike, der für Optionsschreiber "strukturell günstig" ist.

### Gamma-Magnet

Der Gamma-Magnet ist der Strike mit der größten absoluten Dealer-Gamma-Konzentration - der Strike, an dem das erzwungene Hedging am lautesten ist. Es ist eine Ablesung des Hedging-Flows.

Stimmen beide Strikes überein, ist die Pin-These tendenziell am schärfsten. Weichen sie voneinander ab, stützt sich ZeroGEX auf den Gamma-Magneten, weil er dem modellierten Hedging-Flow entspricht statt nur der Payoff-Geometrie - aber das ist eine Tendenz, keine Regel, und welche Lesart mehr zählt, hängt vom modellierten Vorzeichen des Dealer-Gammas und vom umgebenden Flow ab.

[Max Pain erklärt](/education/max-pain-explained) behandelt diese Unterscheidung im Detail und legt ehrlich dar, wie oft Max Pain allein in die Irre führt.

---

## Wann der Pin hält

Die strukturellen Bedingungen, die aus dem heutigen Tag einen Pin-Tag machen:

- **Positive-Gamma-Regime.** Spot über dem modellierten Gamma Flip; Net GEX deutlich positiv. Ohne das kann sich der modellierte Hedging-Reflex umkehren, und derselbe Strike kann den Preis freigeben, statt ihn anzuziehen.
- **Starke Strike-Konzentration nahe am Spot.** Der Gamma-Magnet liegt nahe am Preis - ZeroGEX behandelt grob 0,3-0,5 % als "nah", wobei diese Spanne eine Hausheuristik ist, kein Branchenstandard. Weit vom Spot entfernte Magnete wirken tendenziell eher als Ziele denn als aktive Pins.
- **Max Pain und Gamma-Magnet stimmen überein.** Beide zeigen auf dasselbe Niveau. Das verstärkt den strukturellen Sog.
- **Vom Verfall dominierte Kette.** 0DTE-/Wochenoptionen tragen den Großteil des Gammas. Von Monatsoptionen dominierte Ketten pinnen deutlich unzuverlässiger.
- **Ruhiger Katalysatorkalender.** Keine wichtigen Makrodaten oder Notenbank-Termine während der Sitzung.
- **Sich komprimierende realisierte Volatilität.** Das Tape zeigt, dass der dämpfende Dealer-Reflex funktioniert.

Wenn die meisten dieser Punkte zusammenkommen, hat der Pin strukturelle Wahrscheinlichkeit auf seiner Seite.

---

## Wann der Pin bricht

Der Pin löst sich auf, wenn:

- **Der Gamma Flip gekreuzt wird.** Der Spot fällt unter den modellierten Flip; das Kreuzen deutet darauf hin, dass die aggregierte Hedging-Tendenz des Modells das Vorzeichen gewechselt hat, sodass derselbe Magnet beginnen kann, den Preis freizugeben, statt ihn anzuziehen.
- **Ein Katalysator eintrifft.** CPI, FOMC, NFP, Einzeltitel-Schock. Der Makro-Flow überwältigt den Dealer-Reflex.
- **Net GEX spürbar abnimmt.** Das Gamma nahe am Verfall wird neu bepreist: ATM-Gamma kann steigen, während deutlich ITM- oder OTM-Gamma gegen null tendiert. Das Aggregat kann sich verstärken oder abschwächen.
- **Der Magnet wandert.** Bestätigtes Open Interest wird in der Regel für die nächste Sitzung veröffentlicht, aber der modellierte Magnet kann sich trotzdem mitten in der Sitzung verschieben, wenn sich Spot, Gamma, Zeit und IV ändern - oder wenn sich abgeleitete Intraday-Positionierung an einem anderen Strike aufbaut - und das Ziel so woandershin verlagern.
- **Der Skew verschiebt sich.** Ein starkes Put-Bid (Angst) kann das Vorzeichen des Dealer-Buchs selbst am gleichen Strike umkehren.

Ein Pin, der seit zwei Stunden hält, ist beständiger als einer, der sich gerade erst gebildet hat, aber kein Pin hält ewig. Die Bedingungen, die ihn gestützt haben, müssen weiter bestehen, damit der Pin hält.

---

## Den Pin in Echtzeit lesen

Ein kurzer Ablauf:

1. **Den Strike mit dem stärksten Gamma nahe am Spot identifizieren.** Das ist der Magnet-Kandidat.
2. **Net GEX prüfen.** Das ist eine modellierte Zahl - geschätztes Dealer-Gamma unter der traditionellen Call-positiv/Put-negativ-Konvention auf Open Interest, kein beobachteter Dealer-Bestand. Ein substanziell positiver Wert ist die Bedingung, die den Pin stützt; negative oder nahe null liegende Werte sprechen gegen ihn.
3. **Den Gamma Flip prüfen.** Der Spot muss darüber liegen. Liegt der Flip genau am Spot, ist die Lage umkämpft - der Pin könnte sich bilden, muss aber nicht.
4. **Max Pain gegenprüfen.** Gleicher Strike oder innerhalb von ~0,3 % des Magneten (eine ZeroGEX-Heuristik) → schärfere Pin-These. Deutlich abweichend → schwächere These; ZeroGEX stützt sich auf den Magneten, da er dem modellierten Hedging-Flow entspricht.
5. **Die Tageszeit lesen.** Vor 12 Uhr ET hat sich Charm noch nicht genug aufgebaut, um den Pin stark zu treiben. Nach 14:00 Uhr ET verstärkt sich der Sog. Nach 15:30 Uhr ET dominieren die Dynamiken des Schlussfensters.

---

## Woran du erkennst, ob SPY gepinnt ist: die fünf Anzeichen

Einen Pin in Echtzeit zu erkennen, läuft auf fünf strukturelle Anzeichen hinaus. Je mehr davon zusammenpassen, desto schärfer der Pin.

**1. Das Net GEX ist deutlich positiv (Long-Gamma-Regime).** Spot über dem Gamma Flip und Net GEX klar positiv. (Net GEX ist geschätztes Dealer-Gamma unter der traditionellen Call-positiv/Put-negativ-Konvention auf Open Interest - ein Modell, kein beobachteter Bestand.) ZeroGEX behandelt auf SPY-Größenordnung grob 500 Mio. $+ als „substanziell“, aber das ist eine Hausheuristik - die Größenordnung zählt mehr als irgendeine konkrete Zahl. Negatives oder nahe null liegendes Net GEX spricht gegen den Pin.

**2. Max Pain und der Gamma-Magnet stimmen nahe am Spot überein.** Wenn beide auf dasselbe Level zeigen und dieses innerhalb von etwa 0,3 % des Spot liegt, ist der strukturelle Zug am schärfsten. Wenn sie auseinandergehen, stützt sich ZeroGEX auf den Gamma-Magneten - er bildet den modellierten Hedging-Mechanismus ab, während Max Pain Auszahlungsgeometrie ist.

**3. Der Spot pendelt seit einer Stunde um den Magneten.** Trage SPY gegen den Gamma-Magnet-Strike im 5-Minuten-Chart ab. Drei oder mehr Kreuzungen in den letzten 60 Minuten, jede Auslenkung kleiner, deutet auf einen sich bildenden Pin hin. Ein stetiges Wegdriften vom Magneten spricht dagegen - das ist eine Richtung, keine Spanne.

**4. Die realisierte Volatilität ist unter die implizite gefallen.** Long-Gamma-Hedging dämpft die realisierte Vol, daher zeigt sich ein funktionierender Pin als realisierte unter impliziter Vol. Wenn die realisierte expandiert, hält der Pin nicht - das Buch wird von anderem Flow überrollt.

**5. EOD Pressure liegt im aktiven Fenster nahe null.** Nach 14:30 Uhr ET ist ein EOD-Pressure-Wert nahe null (grob −0,20 bis +0,20) eine modellierte Pin-Signatur - die Charm- und Pin-Gravitations-Terme heben sich weitgehend auf, weil der Preis am Magneten sitzt. Ein großer Wert bedeutet, dass der Preis *weg* vom Magneten ist. Siehe [EOD Pressure Signal erklärt](/education/eod-pressure-explained).

---

## Das Playbook für ein gepinntes Tape

Wenn die meisten der fünf Anzeichen zusammenpassen, ist das Playbook konträr und einfach:

- **Tu es: fade die Extreme der Kompressionsspanne.** Der strukturelle Zug geht zurück zum Magneten, daher ist das Verkaufen von Schüben nahe dem oberen Rand und das Kaufen von Dips nahe dem unteren Rand das eine Setup, bei dem der Dealer-Reflex auf deiner Seite ist. Klein positionieren - Pins sind probabilistisch, nicht garantiert.
- **Tu es nicht: der Mitte hinterherjagen.** In der Mitte sitzt der Magnet; dort zu kaufen oder zu verkaufen kämpft gegen das Level, zu dem der Preis strukturell zurückkehren will. Von hier stammen die meisten Verluste bei gepinntem Tape.
- **Tu es nicht: Momentum-Setups nehmen.** Breakout-, Vol-Expansions- und Squeeze-Playbooks setzen voraus, dass die Bewegung sich fortsetzt - das Gegenteil eines gepinnten Tapes. Das falsche Playbook zu fahren ist der größte Teil des Fehlers.
- **Tu es: die Positionsgröße verkleinern.** Gepinnte Spannen sind eng und Stops noch enger; eine Normaltagsgröße lädt zu vorzeitigen Ausstoppungen ein.

---

## Durchgerechnetes Beispiel

SPY notiert an einem Freitagnachmittag bei 582,95. ZeroGEX zeigt:

- **Net GEX:** +1,4 Mrd. $ (positiv - Long-Gamma-Regime)
- **Gamma Flip:** 581,20 (Spot deutlich darüber)
- **Stärkster 0DTE-Strike:** 583,00 (praktisch am Spot)
- **Max Pain:** 583,00 (stimmt mit dem Gamma-Magneten überein)
- **Uhrzeit:** 14:15 Uhr ET (Charm-Aufbau beginnt)

Jede strukturelle Bedingung für einen Pin ist erfüllt. Der Magnet liegt bei 583; Max Pain stimmt bei 583 überein; das Regime ist long-gamma; wir befinden uns im aktiven EOD-Fenster. Die Wahrscheinlichkeit, dass SPY bis zum Handelsschluss innerhalb einer Spanne von rund 30 Cent um 583 oszilliert, ist spürbar erhöht.

Praktische Einschätzung: eine enge Spanne von 582,70-583,30 ist der erwartete Verlauf. Ausschläge an die Ränder sind Fade-Setup-Kandidaten. Die Mitte der Spanne ist No-Trade-Territorium. Klein positionieren. Auf die Bruchbedingungen achten - besonders bei einem Einzeltitel-Schock oder einer unerwarteten Schlagzeile.

Nun stell dir dasselbe Setup vor, aber mit Net GEX bei −600 Mio. $ und dem Gamma Flip bei 583,50 (Spot darunter). Die "Pin"-These fällt in sich zusammen. Gleiche Kette, gleicher Strike, entgegengesetzte Lesart - weil das modellierte Regime, das bestimmt, ob der Magnet tendenziell anzieht oder freigibt, das Vorzeichen gewechselt hat.

---

## Verbreitete Missverständnisse

- **"Pinning ist nur Psychologie."** Auszahlungsanreize rund um den Verfall, Dealer-Hedging, Liquidität und Trader-Verhalten können alle dazu beitragen. Öffentliche Daten können nicht isolieren, in welchem Maß ein bestimmter Mechanismus einen beobachteten Pin verursacht hat.
- **"SPY pinnt immer an runden Zahlen."** Wenn Pinning auftritt, fällt es oft mit konzentrierter Positionierung zusammen. Runde Zahlen sind häufig, weil sich OI dort ballt, aber OI allein beweist nicht die Ursache.
- **"Wenn Max Pain X ist, schließt der Preis bei X."** Oft falsch. Max Pain ist Payoff-Geometrie, keine Hedging-Kraft; der modellierte Gamma-Magnet entspricht dem Hedging-Flow direkter. Weichen sie voneinander ab, stützt sich ZeroGEX auf den Magneten.
- **"Pins sind bullisch/bärisch."** Keins von beidem. Sie wirken volatilitätsdämpfend. Range-gebunden. Die Richtung kommt von anderswo; beim Pin geht es um *den Charakter der Preisbewegung*, nicht um die Richtung.
- **"Pinning passiert jeden Freitag."** Oft, aber nicht immer. Manche Freitage haben Katalysatoren, Short-Gamma-Regime oder wandernde Magnete, die den Pin verhindern. Das Lesen der Bedingungen ist entscheidend.

---

## Fazit

> SPY pinnt tendenziell, weil modelliertes Dealer-Hedging an Strikes mit hoher Gamma-Konzentration den Preis zum Strike zurückziehen kann. Den modellierten Sog kannst du als Kontext nutzen, wenn die strukturellen Bedingungen ihn stützen und du ihn als Wahrscheinlichkeit behandelst, nicht als Gewissheit.

Die Disziplin besteht darin, die Bedingungen zu prüfen, bevor man annimmt, heute sei ein Pin-Tag. Long-Gamma-Regime + starker Strike am Spot + Max-Pain-Übereinstimmung + späte Sitzungsphase verschieben die Chancen in Richtung eines scharfen Pins. Kippt einer dieser Faktoren, schwächt das die Lesart; kippen alle, ist sie praktisch erledigt.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.

---

Wer den heutigen stärksten Gamma-Strike, Max Pain, Gamma Flip und Net GEX sehen möchte - die vier Zahlen, die entscheiden, ob SPY heute pinnt -, findet sie alle in der kostenlosen Gamma-Levels-Ansicht von ZeroGEX.
