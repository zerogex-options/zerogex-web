# Live-Optionskurse

*Durchsuchen Sie die Live-Kette. Filtern nach Verfall und Moneyness, Sortieren von Spalten und wie die IV-Oberfläche die Farben zum Leuchten bringt.*

---

## Was diese Seite zeigt

Die Seite Live-Optionskurse ist die **Live-Optionskette** für das aktive Symbol. Jede Spalte aktualisiert sich während der Handelszeiten in Echtzeit.

## Die Spalten

Für jeden Strike und jeden Verfall:

- **Strike**
- **Bid / Ask / Mid**
- **Last** und **Volume**
- **Open Interest**
- **Delta, Gamma, Vega, Theta, Charm**
- **Implizite Volatilität**
- **GEX-Beitrag** — der Dollarwert des Dealer-Gammas an diesem Strike

Jede Zeile ist gepaart (Call links, Put rechts) mit dem Strike in der mittleren Spalte. Das klassische Ketten-Layout.

## Filter

Mit der Filterleiste können Sie die Kette eingrenzen:

- **Verfall** — Mehrfachauswahl. Standardmäßig 0DTE, falls verfügbar, sonst der nächstgelegene.
- **Moneyness** — ATM-Band (z. B. ±5 % vom Spot) oder vollständige Kette.
- **Sortieren** — nach Strike, Volume, OI, IV, GEX-Beitrag.
- **Nur anzeigen** — Volume ungleich null, OI ungleich null, Sweeps, Blocks.

## Die Farben der IV-Oberfläche

Zellen werden nach IV farblich abgestuft — kühle Farben (Blau) für niedrige IV, warme Farben (Rot) für hohe IV. Die Skala gilt pro Verfall, sodass ein "heißer" ATM in einer Spalte nicht demselben absoluten IV-Wert entspricht wie ein "heißer" ATM in einer anderen. Es geht darum, die **Form** des Smiles zu erkennen, nicht das absolute Niveau.

## So liest man die Kette

Drei Muster:

1. **Wo stapelt sich das OI?** Die Kette ist der Rohdatensatz, auf dem das GEX-Profil basiert. Die Strikes mit dem größten OI sind meist dort, wo die Walls liegen.
2. **Wo befindet sich das Volume?** Das Volume zeigt, was **gerade jetzt** gehandelt wird, was untertägig stark vom OI abweichen kann.
3. **Wo liegt der IV-Skew?** Ein steilerer OTM-Put-IV im Vergleich zum OTM-Call-IV ist die Skew-Ablesung.

## Schnellaktionen

- **Klicken Sie auf eine Zeile**, um den Strategy Builder mit diesem Leg vorausgefüllt zu öffnen.
- **Bewegen Sie den Mauszeiger über eine Zelle** für alle Details (Bid/Ask-Größe, Zeitpunkt des letzten Trades, Börse).

## Hinweis zum Tarif

Live-Optionskurse sind für Basic und Pro verfügbar.

## Siehe auch

- [Strategy Builder](/help/platform/options-calculator)
- [Dealer-Positionierung](/help/platform/dealer-positioning)
- [Flow-Analyse](/help/platform/flow-analysis)
