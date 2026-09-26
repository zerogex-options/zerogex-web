# Live-Optionskurse

*Verfolgen Sie einen einzelnen Optionskontrakt durch die Sitzung. Den Kontrakt auswählen, die Volumenbalken nach Bid/Mid/Ask lesen und die Kennzahlen über dem Chart verstehen.*

---

## Was diese Seite zeigt

Die Seite Live-Optionskurse verfolgt **einen Optionskontrakt** auf das aktive Symbol durch die Handelssitzung: den Preis des letzten Trades und das Volumen jeder Minute, aufgeteilt danach, wo es gehandelt wurde - am Ask, am Mid oder am Bid. Sie aktualisiert sich alle 30 Sekunden.

## Einen Kontrakt auswählen

Drei Menüs über dem Chart bestimmen den Kontrakt:

- **Expiration** - die Verfallstermine, die in dieser Sitzung gehandelt werden, heute oder später. Standardmäßig der heutige (0DTE), falls vorhanden, sonst der nächstgelegene.
- **Strike** - standardmäßig der Strike, der dem Live-Kurs am nächsten liegt.
- **Type** - **Call** oder **Put**. Standardmäßig Call.

Der Name des Kontrakts erscheint unter den Menüs - z. B. `SPY 600 C 10/02/2026` - zusammen mit den Tagen bis zum Verfall.

## Die Kennzahlen über dem Chart

Für die angezeigte Sitzung:

- **Vol** - bisher gehandelte Kontrakte.
- **OI** - Open Interest.
- **Avg** - der durchschnittliche Handelspreis, gewichtet nach Volumen.
- **Prem** - gehandelte Prämie: Vol × Avg × 100.
- **IV**, **Δ** (Delta) und **Θ** (Theta) - aus der jüngsten Notierung.

## Der Chart

- **Balken** (linke Achse) - Volumen pro Minute, gestapelt danach, wo es gehandelt wurde: **Ask Vol**, **Mid Vol** und **Bid Vol**.
- **Linie** (rechte Achse) - der Preis des letzten Trades (**Last**).

Die Zeitachse umfasst die Sitzung von 9:30 bis 16:15 Uhr ET. Bevor die heutige Sitzung beginnt, zeigt die Seite die letzte vorangegangene. Auf dem Smartphone werden die Balken zu 5-Minuten-Blöcken zusammengefasst, damit sie lesbar bleiben.

Bewegen Sie den Mauszeiger über einen Balken, um die Uhrzeit, den letzten Preis und die Anzahl der am Bid, Mid und Ask gehandelten Kontrakte zu sehen.

## So liest man ihn

Drei Muster:

1. **Wer überquert den Spread?** Ask-seitiges Volumen sind Trades, die am oder nahe dem Ask ausgeführt wurden - Käufer, die den Ask bezahlen, um ausgeführt zu werden. Bid-seitiges Volumen sind Verkäufer, die in den Bid verkaufen. Mid-Volumen sind Trades dazwischen.
2. **Bestätigt der Preis es?** Ask-seitiges Volumen bei steigender Last-Linie heißt, dass die Käufer diesen Kontrakt kontrollieren. Starkes Ask-seitiges Volumen, während der Preis nicht vorankommt, verdient einen genaueren Blick.
3. **Wie groß ist der heutige Handel im Vergleich zum OI?** Wenn Vol im Verhältnis zum OI groß ist, ist der heutige Handel groß gemessen an den bereits offenen Positionen - möglicherweise baut sich eine neue Positionierung auf.

## ES und NQ

ES und NQ haben keine eigene Optionskette - ihre Levels werden aus SPX- und NDX-Optionen abgeleitet. Diese Seite ist für sie nicht verfügbar; wechseln Sie zu SPX oder NDX.

## Hinweis zum Tarif

Live-Optionskurse sind für Basic und Pro verfügbar.

## Siehe auch

- [Strategy Builder](/help/platform/options-calculator)
- [Dealer-Positionierung](/help/platform/dealer-positioning)
- [Flow-Analyse](/help/platform/flow-analysis)
