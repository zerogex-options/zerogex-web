# GEX Summary

*Die wichtigsten GEX-Kennzahlen und die Levels, die sich daraus ergeben, auf einem Bildschirm - dazu, wie stabil der Gamma Flip über verschiedene Horizonte ist und ob das heutige Dealer-Gamma ungewöhnlich ist.*

---

## Was diese Seite zeigt

Die Seite GEX Summary ist die **Zahlenansicht** des Optionsbuchs. Während Dealer Positioning strukturell ist (Profil, Walls, Heatmaps), bringt diese Seite zehn Kennzahlen auf einen Bildschirm und zeigt dann, wie sich der Gamma Flip über Options-Horizonte verändert und wie das heutige Dealer-Gamma im Vergleich zu seiner eigenen Historie dasteht.

Der **GEX unit**-Umschalter im Seitenkopf stellt jeden GEX-Dollarwert zwischen Gamma pro 1 % Bewegung (Standard) und pro 1 Punkt um. Das Exposure ist in beiden Fällen dasselbe; nur die Einheit ändert sich.

## Die obere Reihe

### Preis

Der Live-Preis des aktiven Symbols. Wenn der Kassamarkt geschlossen ist und der Preis aus den Futures kommt, sagt die Kachel das und nennt den Kontrakt - die GEX-Levels bleiben auf dem Kassa-Index.

### Net GEX

Das modellierte Dealer-Gamma in Dollar nach der traditionellen Open-Interest-Konvention (Calls positiv, Puts negativ). Nach dieser Konvention passt positives Net GEX dazu, dass Dealer *tendenziell* bei Schwäche kaufen und bei Stärke verkaufen; negatives dazu, dass sie *tendenziell* dem Preis hinterherlaufen. Angezeigt am Spot - der Wert, der vorzeichengleich mit dem Gamma Flip ist, nicht die Summe über die gesamte Kette.

> Net GEX ist eine **Schätzung**: Es modelliert das Dealer-Gamma nach der Konvention Calls positiv / Puts negativ. Der tatsächliche Dealer-Bestand ist aus öffentlichen Optionskettendaten nicht direkt beobachtbar.

### Gamma Flip

Der strukturelle Flip: der Preis, an dem das aggregierte modellierte Dealer-Gamma sein Vorzeichen wechselt, berechnet mit einer Horizont-Gewichtung, die kurzlaufende 0DTE-Walls abschwächt. Darüber wirkt das modellierte Hedging *tendenziell* dämpfend, darunter verstärkend. **Raw nearest** darunter ist der nächstgelegene Nulldurchgang des ungewichteten Profils - die Konvention, die viele andere Dashboards veröffentlichen. Ohne die Gewichtung können kurzlaufende Walls ihn viel näher an den Spot ziehen als den strukturellen Flip.

### Max Pain

Der Strike, bei dem die Auszahlung an die Optionsinhaber zum Verfall am kleinsten ist. Wann er zählt und wann nicht, steht unter [Max Pain](/help/platform/max-pain).

### Pin Strike

Der erreichbare 0DTE-Strike mit dem stärksten modellierten positiven Dealer-Gamma in den Schluss hinein, mit seiner Stärke (Strong, Moderate oder Weak) und dem Konfidenz-Prozentsatz. Wie er berechnet wird und was „Weak“ tatsächlich bedeutet, erklärt [Pin Strike](/help/platform/pin-strike).

## Die untere Reihe

- **Call GEX** und **Put GEX** - das gesamte modellierte Gamma-Exposure aus Calls bzw. aus Puts, die beiden Hälften hinter Net GEX.
- **Put/Call Ratio** - Put-Volumen geteilt durch Call-Volumen. Über 1 eher bearish; unter 1 eher bullish.
- **Call Wall (Resistance)** und **Put Wall (Support)** - der Strike auf oder über dem Spot mit dem größten Call-Gamma und der Strike auf oder unter dem Spot mit dem größten Put-Gamma, jeweils summiert über den heutigen Verfall und die zwei nächsten (0-2DTE), mit dem Abstand zum Spot. Ein Chart, das nur auf 0DTE beschränkt ist, kann einen anderen Strike zeigen. Die Bezeichnungen sind die übliche Lesart, keine Garantie: In unserer Studie mit 737 Wall-Tests hielten S&P-Walls in etwa zwei von drei Fällen innerhalb einer Stunde und Nasdaq-Walls in etwa der Hälfte der Fälle, und das modellierte Vorzeichen des Dealer-Gammas änderte daran nichts.

## Gamma Flip · Term Structure

Der heutige Gamma Flip, für jeden Options-Horizont separat bestimmt - standardmäßig 1 bis 60 Tage, mit den Voreinstellungen **Std**, **Short** und **Long**. Jeder Punkt ist nach dem Vorzeichen des Dealer-Gammas am Spot eingefärbt. Rauten-Umrisse markieren den Flip, der vor ebenso vielen Tagen erfasst wurde, und ein rotes X kennzeichnet einen Horizont, für den kein Nulldurchgang bestimmt werden konnte. So siehst du, ob der Flip über die Horizonte hält oder ein kurzfristiger Effekt ist.

## Horizon × Price Contour

Dieselbe Frage als Fläche: modelliertes Dealer-Gamma über hypothetische Spotpreise (x) und Options-Horizonte (y). Blaue Zellen sind long Gamma (stabilisierend), rote short Gamma (destabilisierend), und eine schwarze Linie folgt dem Nulldurchgang - dem Flip pro Horizont. Hilfslinien markieren den aktuellen Spot und die schwersten Call- und Put-Walls.

## Gamma Pulse

*„Is current dealer gamma irregular?“* Net GEX am Spot und das gesamte Net GEX der Kette, jeweils eingeordnet gegenüber den letzten 30 Tagen und der gesamten Historie - **EXTREME HIGH**, **ELEVATED**, **NORMAL**, **LOW** oder **EXTREME LOW** - mit einem Pokal, wenn ein Wert einen Rekord aufstellt. Der Vergleich berücksichtigt die Tageszeit, sodass der übliche Pin zum Handelsschluss nicht als ungewöhnlich markiert wird.

## Vorzeichenkonventionen

ZeroGEX versieht jeden Greek mit dem Vorzeichen aus einer modellierten Dealer-Perspektive - durchgängig dieselbe Konvention, kein beobachteter Bestand:

- Positives Gamma ⇒ nach der Konvention Calls positiv / Puts negativ sind die Dealer *modelliert* netto long bei Calls / short bei Puts und hedgen gegen den Preis.
- Negatives Gamma ⇒ die Dealer sind *modelliert* netto short Gamma und hedgen mit dem Preis.

Wenn du einen anderen GEX-Anbieter liest, prüfe unbedingt die Vorzeichenkonvention. Die meisten verwenden dasselbe dealerbasierte Vorzeichen, einige drehen es jedoch um.

## Die Seite richtig lesen

Zwei Muster:

1. **Gegenprüfung mit Dealer Positioning.** Wenn Net GEX deutlich positiv ist, das GEX-Profil aber zeigt, dass die Kurve knapp unter dem Spot ins Negative kippt, befindest du dich genau auf der Regimegrenze - das Risiko ist asymmetrisch.
2. **Flip und Raw nearest vergleichen.** Liegen die beiden weit auseinander, zieht kurzlaufendes Gamma. Die Flip-Term-Structure zeigt, ob das Niveau über die Horizonte hält.

## Siehe auch

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Vanna und Charm für Optionshändler erklärt](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) erklärt](/education/gamma-exposure-explained)
