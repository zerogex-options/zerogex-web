# Live-Optionskurse

*Verfolgen Sie einen einzelnen Optionskontrakt durch die Sitzung. Den Kontrakt auswählen, die Volumenbalken nach gekauft und verkauft lesen und die Kennzahlen über dem Chart verstehen.*

---

## Was diese Seite zeigt

Die Seite Live-Optionskurse verfolgt **einen Optionskontrakt** auf das aktive Symbol durch die Handelssitzung: den Preis des letzten Trades und das Volumen jeder Minute, aufgeteilt nach Handelsseite - gekauft, verkauft oder ohne Anhaltspunkt für eine Seite. Sie aktualisiert sich alle 30 Sekunden.

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

- **Balken** (linke Achse) - Volumen pro Minute, gestapelt nach Handelsseite: **Bought** (gekauft), **No side** (ohne Seite) und **Sold** (verkauft).
- **Linie** (rechte Achse) - der Preis des letzten Trades (**Last**).

Ob ein Trade als gekauft oder verkauft zählt, entscheidet der **Tick-Test**, der den Preis jedes Trades mit dem vorherigen Trade desselben Kontrakts vergleicht, nicht mit Bid und Ask. Höher zählt als gekauft, niedriger als verkauft, und ein unveränderter Preis übernimmt die Seite der letzten Preisänderung. **No side** ist Volumen, dem der Test keine Seite zuordnen kann: ein Trade ohne früheren Trade zum Vergleich, ein unveränderter Preis, bevor eine Preisänderung eine Seite festgelegt hat, und alles in der Eröffnungsminute um 9:30 Uhr.

Die Zeitachse umfasst die Sitzung von 9:30 bis 16:15 Uhr ET. Bevor die heutige Sitzung beginnt, zeigt die Seite die letzte vorangegangene. Auf dem Smartphone werden die Balken zu 5-Minuten-Blöcken zusammengefasst, damit sie lesbar bleiben.

Bewegen Sie den Mauszeiger über einen Balken, um die Uhrzeit, den letzten Preis und die Zahl der Kontrakte zu sehen, die als verkauft, gekauft oder ohne Seite zählen.

## So liest man ihn

Drei Muster:

1. **Wer treibt den Preis?** Gekauftes Volumen sind Käufer, die mehr bezahlen, um ausgeführt zu werden: Trades, die den Preis nach oben bewegt oder nach einem Anstieg gehalten haben. Verkauftes Volumen sind Verkäufer, die weniger akzeptieren: Trades, die ihn nach unten bewegt oder nach einem Rückgang gehalten haben. Volumen ohne Seite sind Trades, denen der Test keine Seite zuordnen konnte.
2. **Wie viel Volumen steckt hinter der Bewegung?** Die Handelsseite stammt aus den eigenen Preisänderungen dieses Kontrakts, daher gehen gekauftes Volumen und eine steigende Last-Linie meist zusammen; diese Übereinstimmung ist keine zweite, unabhängige Bestätigung. Was die Balken hinzufügen, ist, wie viele Kontrakte bei jeder Bewegung gehandelt wurden: Ein Anstieg mit einer Handvoll Kontrakten sagt weniger aus als einer mit starkem gekauftem Volumen dahinter.
3. **Wie groß ist der heutige Handel im Vergleich zum OI?** Wenn Vol im Verhältnis zum OI groß ist, ist der heutige Handel groß gemessen an den bereits offenen Positionen - möglicherweise baut sich eine neue Positionierung auf.

## ES und NQ

ES und NQ haben keine eigene Optionskette - ihre Levels werden aus SPX- und NDX-Optionen abgeleitet. Diese Seite ist für sie nicht verfügbar; wechseln Sie zu SPX oder NDX.

## Hinweis zum Tarif

Live-Optionskurse sind für Basic und Pro verfügbar.

## Siehe auch

- [Strategy Builder](/help/platform/options-calculator)
- [Dealer-Positionierung](/help/platform/dealer-positioning)
- [Flow-Analyse](/help/platform/flow-analysis)
