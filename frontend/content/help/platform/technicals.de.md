# Technicals

*Das Intraday-Kursbild, auf dem das Optionsbuch sitzt - VWAP, Opening Range, Volumenspitzen und Momentum-Divergenz, auf einem Chart mit Flip und Walls.*

---

## Was diese Seite zeigt

Die Technicals-Seite ist die **price-first**-Lesart des aktiven Symbols. Sie ist die einzige Metrics-Seite, die den Preis liest statt der Optionskette - VWAP, die Opening Range, ungewöhnliches Volumen und Momentum im Abgleich mit dem Optionsflow - und sie zeichnet all das gegen den Gamma Flip, die Walls und den Pin.

Das ist die Seite, die du öffnest, wenn du prüfen willst, was das Dealer-Positioning nahelegt im Verhältnis zu dem, was der Preis tatsächlich tut.

## Die Session-Zeile

Die Zeile ganz oben liest die Sitzung in einem Zug: **Price**, **VWAP** (und wie weit der Preis davon entfernt ist), wo der Preis in der **Opening range** steht, **Dealer gamma** (Long oder Short Gamma und auf welcher Seite des Flips der Preis liegt) und die **Walls**, jeweils mit ihrem Abstand zum Preis.

## Der Session-Chart

5-Minuten-Kerzen der Sitzung, Zeiten in ET, mit:

- **VWAP** - die gestrichelte Linie durch die Kerzen.
- **Die Opening Range** - das schattierte Band zwischen Hoch und Tief von 09:30-09:59 ET. Das hellere obere und untere Fünftel ist der Bereich, in dem der Status „near the high“ oder „near the low“ lautet.
- **Flip, Walls und Pin** - dieselben Levels wie im Key-Levels-Streifen und im Gamma Terminal. Ein Level, das zu weit von den Kursen der Sitzung entfernt ist, um es zu zeichnen, wird mit einem Pfeil am Rand der Preisachse markiert.
- **Volumen** - darunter. Balken mindestens eine Standardabweichung über ihrem eigenen jüngsten Durchschnitt sind danach eingefärbt, ob Käufe (grün) oder Verkäufe (rot) überwogen; die übrigen sind grau.
- **Nummerierte Marker** - Divergenzen und Brüche der Opening Range, in zeitlicher Reihenfolge nummeriert, passend zur Ereignisliste.

Die Buttons über dem Chart schalten jede Ebene ein oder aus, und dieser Browser merkt sich deine Wahl. Fahre über eine Kerze oder tippe sie auf dem Handy an, um Open, High, Low, Close, VWAP und Volumen zu sehen.

## Opening Range

Das Hoch und Tief der ersten 30 Minuten der regulären Sitzung (09:30-09:59 ET), für den Rest des Tages fest, jeweils mit dem Abstand zum Preis, der Größe der Range und ihrem **Status**:

- **Above the range** / **Below the range** - der letzte 5-Minuten-Schlusskurs liegt jenseits des Hochs bzw. des Tiefs.
- **Near the high** / **Near the low** - innerhalb der Range, in ihrem oberen bzw. unteren Fünftel.
- **Inside** - die mittleren drei Fünftel.

„Near“ wird an der Range selbst gemessen, skaliert also mit dem Tag statt mit dem Preis. **Where price sits** zeigt dieselben Zonen als Balken.

Das **Breakout-Log** listet, was der Preis rund um die Range getan hat: Tests des Hochs oder Tiefs (ein Docht darüber hinaus, dann ein Schlusskurs zurück in der Range), Brüche (ein Schlusskurs jenseits davon), den weitesten erreichten Punkt in Vielfachen der Range und Schlusskurse zurück in der Range, samt der Dauer des Bruchs.

## Ereignisse

Eine Liste, neueste zuerst:

- **Bearish divergence** - der Preis steigt über fünf Minuten, während der Optionsflow zu Puts tendiert. **Bullish divergence** - der Preis fällt, während er zu Calls tendiert.
- **Weak rally** / **Weak selloff** - der Preis bewegt sich, während das Auf- und Abwärtsvolumen in die andere Richtung tendiert.
- **Volume spike** - ein 5-Minuten-Balken mindestens eine Standardabweichung über seinem jüngsten Durchschnitt, mit dem Abstand dazu und ob Käufe oder Verkäufe überwogen.
- **Ereignisse der Opening Range** aus dem Breakout-Log.

Balken, bei denen Preis und Optionsflow übereinstimmen (Confirmations), sind ausgelassen, weil sie der Normalfall sind. Die 5-Minuten-Veränderung ist in den Preiseinheiten des Symbols angegeben - Punkte bei ES und NQ - und nicht in Prozent.

## So liest du sie

Drei Muster, alle auf dem einen Chart sichtbar:

1. **Preis zwischen Call Wall und Put Wall** in positivem Gamma ⇒ das Hedging stemmt sich gegen Bewegungen in Richtung einer der beiden Walls, ein Mean-Reversion-Umfeld. Die Kerzen bestätigen die Range; die Levels legen das Warum nahe.
2. **Preis bricht unter die Put Wall** in negativem Gamma bei steigender IV ⇒ eine Trendfortsetzung *wird wahrscheinlicher*. Die Kerzen zeigen den Bruch; das Regime erklärt die modellierte Verstärkung.
3. **VWAP und Gamma Flip stapeln sich auf demselben Level** ⇒ ein struktureller Pivot, den man beobachten sollte. Reaktionen dort *können* mehr Überzeugungskraft haben als an einem der beiden allein.

Für den Rest des Gamma-Bilds neben den Kerzen - die Strike-Leitern, die Ribbons und Rewind - nutze das Gamma Terminal; siehe [So liest du ZeroGEX-Charts](/help/platform/reading-charts).

## Siehe auch

- [Das Dashboard lesen](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [So liest du ZeroGEX-Charts](/help/platform/reading-charts)
- [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip)
