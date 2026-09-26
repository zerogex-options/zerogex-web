# Max Pain

*Wie Max Pain berechnet wird, wann er als Magnet wirkt und wann es nur Zufall ist, und wie man ihn zusammen mit dem Gamma-Profil liest.*

---

## Was Max Pain ist

Max Pain ist der **Strike bei Verfall**, an dem der gesamte Dollarwert aller offenen Optionen minimal ist - also das Niveau, an dem Optionskäufer in Summe "am meisten verlieren".

Das ist Auszahlungsgeometrie, kein Beweis für Manipulation: Er markiert, wo die meiste Optionsprämie wertlos verfällt, und misst für sich genommen kein Dealer-Hedging. Die alte Geschichte, dass Market Maker (die natürlichen Verkäufer von Optionen an Kunden) den Spot aktiv zum Max Pain drücken, ist weit differenzierter, als sie klingt - siehe [Max Pain erklärt](/education/max-pain-explained).

Max Pain wird aus dem Open Interest berechnet, das pro Handelssitzung abgerechnet und veröffentlicht wird, statt sich intraday Tick für Tick zu aktualisieren - behandle ihn also als strukturellen Kontext, nicht als live vorhersagendes Kursziel.

## Was diese Seite zeigt

### Das Regime-Banner

**Max Pain Regime** fasst zusammen, wo der Spot relativ zum Max Pain steht: **Pin Risk Elevated**, wenn der Spot weniger als 0,4 % davon entfernt ist, sonst **Upside Magnet** (Max Pain über dem Spot) oder **Downside Magnet** (Max Pain darunter), mit einer kurzen Einordnung darunter.

### Die Snapshot-Kacheln

- **Current Max Pain (All Expirations)** - Max Pain über die gesamte Kette: alle gelisteten Verfälle in einer Auszahlungskurve zusammengefasst, einmal täglich vor der Eröffnung neu berechnet. Der Chip daneben ist die implizite Bewegung - Max Pain minus Spot, in Punkten und Prozent.
- **Nearest-Expiration Max Pain** - Max Pain nur für den nächsten Verfall. Weil er einen einzelnen Verfall abdeckt, kann er einige Punkte vom Wert der gesamten Kette entfernt liegen.
- **Underlying Price** - der aktuelle Kurs.

### Notional Open Interest by Strike

Call- und Put-Notional an jedem Strike für den Verfall, den du im Menü **Expiration** wählst, mit markiertem Max Pain und Spot. Max Pain gilt pro Verfall, deshalb wandert die gestrichelte Max-Pain-Linie mit der Auswahl. Die Balken zeigen, wo das Geld liegt; Max Pain ist dort, wo sich die beiden Stapel ausgleichen.

### Max Pain vs Underlying Price

Max Pain als Linie über den Kerzen des Basiswerts, mit eigenem Timeframe-Menü - nützlich, um eine Drift zum Spot hin (oder von ihm weg) zu erkennen. Rechne mit Stufen statt einer gleichmäßigen Drift: Max Pain bewegt sich nur, wenn das Open Interest bei der Abrechnung neu geschrieben wird.

## Wann Max Pain relevant ist

Max Pain ist am zuverlässigsten:

- **In den letzten 24-48 Stunden vor einem bedeutenden Verfall.** Davor ist die Chain zu aktiv, als dass Max Pain stabil wäre.
- **Für 0DTE auf SPX.** Die 0DTE-Chain ist groß genug, dass Pin-Effekte sichtbar werden *können* - Pinning bleibt aber eine Wahrscheinlichkeit, kein Mechanismus.
- **Wenn der Gamma-Magnet mit dem Max-Pain-Magnet übereinstimmt.** Fällt der Max-Pain-Strike mit einem starken Gamma-Strike (einer Wall) zusammen, ist ein Pin *wahrscheinlicher*. Stimmen sie nicht überein, ist Max Pain eher Zufall - aber keine der beiden Lesarten ist garantiert.

## Wann nicht

- **In aktiv trendenden Märkten.** Makro-Katalysatoren setzen Pin-Verhalten außer Kraft.
- **Bei sehr kleinen Verfällen oder illiquiden Weeklys.** Zu wenig Open Interest, um Pin-Druck zu erzeugen.
- **Weit vor dem Verfall.** Die Zeit bis zum Verfall ist einer der wichtigsten Faktoren - früh in der Laufzeit eines Kontrakts ist die Chain zu aktiv, als dass sich Max Pain festsetzen könnte.

## Wie man ihn zusammen mit Gamma liest

Zwei Lesarten:

1. **Max Pain sehr nah an einer Wall** ⇒ Pin-Druck in den Schluss hinein ist wahrscheinlicher. Die Wall ist das strukturelle Niveau; Max Pain liefert Kontext, keine Garantie.
2. **Max Pain weit entfernt von den Walls und vom Spot** ⇒ Max Pain ignorieren. Der strukturelle Druck liegt woanders.

## Siehe auch

- [Max Pain erklärt - Funktioniert es wirklich?](/education/max-pain-explained)
- [Dealer-Positionierung](/help/platform/dealer-positioning)
- [Gamma Walls erklärt](/education/gamma-walls-explained)
