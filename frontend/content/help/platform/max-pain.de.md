# Max Pain

*Wie Max Pain berechnet wird, wann er als Magnet wirkt und wann es nur Zufall ist, und wie man ihn zusammen mit dem Gamma-Profil liest.*

---

## Was Max Pain ist

Max Pain ist der **Strike bei Verfall**, an dem der gesamte Dollarwert aller offenen Optionen minimal ist — also das Niveau, an dem Optionskäufer in Summe "am meisten verlieren".

Das klassische Argument lautet, dass Market Maker (die natürlichen Verkäufer von Optionen an Privatanleger) ein Interesse daran haben, den Spot in Richtung Max Pain zu drücken. Das ehrlichere Argument ist differenzierter — siehe [Max Pain erklärt](/education/max-pain-explained).

## Was diese Seite zeigt

### Die Haupt-Kachel

Der aktuelle Max-Pain-Strike für den nächsten wichtigen Verfall, mit dem Abstand zum Spot.

### Der Verfallsauswahl

Max Pain wird pro Verfall berechnet. Über die Auswahl lassen sich 0DTE, die Verfälle dieser Woche, der nächsten Woche und der nächste Monatsverfall wählen.

### Das Chart

Auf der x-Achse der Strike, auf der y-Achse die Summe der Auszahlung der im Geld liegenden Optionen (Call + Put). Der Tiefpunkt der Kurve ist der Max Pain. Das Chart zeigt außerdem:

- Den aktuellen Spot.
- Die Call Wall und die Put Wall aus dem GEX-Profil.
- Das verfallsspezifische Gamma-Profil darunter.

### Die historische Migration

Ein kleines Panel, das zeigt, wie sich der Max Pain über die letzten Handelssitzungen für den gewählten Verfall bewegt hat — nützlich, um eine Drift zum Spot hin (oder von ihm weg) zu erkennen.

## Wann Max Pain relevant ist

Max Pain ist am zuverlässigsten:

- **In den letzten 24–48 Stunden vor einem bedeutenden Verfall.** Davor ist die Chain zu aktiv, als dass Max Pain stabil wäre.
- **Für 0DTE auf SPX.** Die 0DTE-Chain hat genug Größe, damit der Pin-Druck real ist.
- **Wenn der Gamma-Magnet mit dem Max-Pain-Magnet übereinstimmt.** Fällt der Max-Pain-Strike mit einem starken Gamma-Strike (einer Wall) zusammen, ist der Pin-Druck real. Stimmen sie nicht überein, ist es meist Zufall.

## Wann nicht

- **In aktiv trendenden Märkten.** Makro-Katalysatoren setzen Pin-Verhalten außer Kraft.
- **Bei sehr kleinen Verfällen oder illiquiden Weeklys.** Zu wenig Open Interest, um Pin-Druck zu erzeugen.
- **Weit vor dem Verfall.** Die "Zeit bis zum Verfall" ist der entscheidende Faktor.

## Wie man ihn zusammen mit Gamma liest

Zwei Lesarten:

1. **Max Pain sehr nah an einer Wall** ⇒ struktureller Pin zum Handelsschluss. Die Wall ist das Niveau; Max Pain ist der Köder.
2. **Max Pain weit entfernt von den Walls und vom Spot** ⇒ Max Pain ignorieren. Der strukturelle Druck liegt woanders.

## Siehe auch

- [Max Pain erklärt — Funktioniert es wirklich?](/education/max-pain-explained)
- [Dealer-Positionierung](/help/platform/dealer-positioning)
- [Gamma Walls erklärt](/education/gamma-walls-explained)
