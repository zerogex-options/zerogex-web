# Technicals

*Das Intraday-Kursbild, auf dem das Optionsbuch sitzt - VWAP, Opening Range, Volumenspitzen und Momentum-Divergenz.*

---

## Was diese Seite zeigt

Die Technicals-Seite ist die **price-first**-Lesart des aktiven Symbols. Sie ist die einzige Metrics-Seite, die den Preis liest statt der Optionskette - VWAP, die Opening Range, ungewöhnliches Volumen und Momentum im Abgleich mit dem Optionsflow.

Das ist die Seite, die du öffnest, wenn du prüfen willst, was das Dealer-Positioning nahelegt im Verhältnis zu dem, was der Preis tatsächlich tut.

## VWAP Analysis

Vier Kacheln - **Current Price**, **VWAP**, **Deviation** (wie weit der Preis prozentual vom VWAP entfernt ist) und **Position** (darüber oder darunter) - und ein Chart des Preises gegen den VWAP im Sitzungsverlauf. Der schattierte Kanal zwischen beiden wird breiter, je weiter sich der Preis vom VWAP entfernt: grün, wenn der Preis darüber liegt, rot, wenn darunter.

## Opening Range Breakout

Die Opening Range ist das Hoch und Tief der ersten 30 Minuten der regulären Sitzung (09:30-09:59 ET), für den Rest des Tages fest. Die Kacheln zeigen **ORB High** und **ORB Low** mit dem jeweiligen Abstand sowie die **ORB Range**; **Position Within Range** zeigt, wo der Preis dazwischen steht, und die **ORB breakout map** stellt den Preis gegen beide Linien dar.

## Unusual Volume Spikes

Die 5-Minuten-Balken, deren Volumen mindestens eine Standardabweichung über ihrem eigenen jüngsten Durchschnitt lag - markiert als Moderate, High oder Extreme Spike -, dargestellt gegen den Kurs des Basiswerts. Jeder Balken ist von Rot (nur Abwärtsvolumen) über neutral bis Grün (nur Aufwärtsvolumen) eingefärbt. Fahre über einen Balken, um sein Volumen, das Vielfache des Durchschnitts und die Aufteilung des Kaufdrucks zu sehen.

## Momentum Divergence Signals

Eine laufende Liste, neueste zuerst, die jede 5-Minuten-Kursbewegung mit dem Optionsflow und dem Auf- und Abwärtsvolumen dahinter abgleicht: **Bearish Divergence** (Preis steigt, während Puts gekauft werden), **Bullish Divergence** (Preis fällt, während Calls gekauft werden), **Bullish** oder **Bearish Confirmation**, wenn Preis und Optionsflow übereinstimmen, und **Weak Rally** oder **Weak Selloff**, wenn das Volumen gegen die Bewegung läuft.

## So liest du sie

Drei Muster - die Walls und der Flip kommen von Dealer Positioning oder vom Gamma Terminal:

1. **Preis zwischen Call Wall und Put Wall gefangen** in positivem Gamma ⇒ *Tendenz* zu Mean Reversion innerhalb der Range. Die Technicals bestätigen die Range; die Dealer-Seite legt das Warum nahe.
2. **Preis bricht unter die Put Wall** in negativem Gamma bei steigender IV ⇒ eine Trendfortsetzung *wird wahrscheinlicher*. Die Technicals zeigen den Bruch; die Dealer-Seite erklärt die modellierte Verstärkung.
3. **VWAP und Gamma Flip stapeln sich auf demselben Level** ⇒ ein struktureller Pivot, den man beobachten sollte. Reaktionen dort *können* mehr Überzeugungskraft haben als an einem der beiden allein.

Wenn du Flip, Walls, Max Pain und VWAP direkt auf den Kerzen sehen willst, nutze das Gamma-Terminal-Chart - siehe [So liest du ZeroGEX-Charts](/help/platform/reading-charts).

## Siehe auch

- [Das Dashboard lesen](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [So liest du ZeroGEX-Charts](/help/platform/reading-charts)
- [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip)
