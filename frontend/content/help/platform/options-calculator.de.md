# Strategy Builder

*Bepreise eine ein- oder mehrschenklige Optionsstrategie zu Live-Kursen. Eine Strategie wählen, ihre Schenkel anpassen und das Chart für Gewinn/Verlust bei Verfall lesen.*

---

## Was der Strategy Builder ist

Der Strategy Builder ist das **Modellierungswerkzeug pro Trade**. Du wählst eine Strategie und passt ihre Schenkel an, die Seite bepreist sie zu Live-Kursen, und du liest ihren Gewinn oder Verlust bei Verfall über eine Spanne von Kursen.

Hierher gehst du, nachdem dir das Dashboard sagt "die Struktur ist bullish" und du das konkrete Instrument auswählen musst.

## Eine Strategie aufbauen

1. **Wähle ein Symbol** (SPY, SPX, QQQ, NDX) über die Symbolauswahl.
2. **Wähle eine Strategie** im Menü **Strategy** - über 40 Vorlagen, von einzelnen Calls und Puts über Verticals, Straddles, Strangles, Iron Condors, Butterflies, Ratios, Backspreads, Calendars, Diagonals und Collars bis zu synthetischen Positionen. Jeder Schenkel startet mit einem sinnvollen Standard-Strike und -Verfall.
3. **Passe die Schenkel an** - jeder Optionsschenkel hat sein eigenes Menü **Exp** und **Strike**, gefüllt aus der Live-Kette.
4. **Stelle Contracts ein** - die Anzahl der Kontrakte; sie gilt für jeden Schenkel, und ein Ratio-Schenkel behält sein Verhältnis.

Die Schenkelpreise, die Summe, das Chart und die Breakevens aktualisieren sich bei jeder Änderung.

ES und NQ haben keine eigene Optionskette, daher ist der Strategy Builder für sie nicht verfügbar - wechsle zu SPX oder NDX.

## Wie die Schenkel bepreist werden

Jeder Optionsschenkel wird zu seinem **Live-Kurs** bepreist, der alle paar Sekunden aktualisiert wird: ein Long-Schenkel zum **Ask**, ein Short-Schenkel zum **Bid** - das, was du beim Überqueren des Spreads tatsächlich zahlen oder einnehmen würdest. Jeder Schenkel zeigt seinen Kontrakt, diesen Preis und die verwendete Seite. Aktienschenkel (in Covered Calls, Collars, Conversions und Ähnlichem) sind 100 Aktien pro Kontrakt, eingegangen zum aktuellen Spot.

**Total position** summiert alles über jeden Schenkel und Kontrakt: Steht dort **debit**, kostet dich die Struktur beim Eröffnen diesen Betrag; bei **credit** nimmt sie ihn ein.

## Das P&L-Chart

**Profit / Loss at Expiration** zeigt, was die Struktur am Verfallstag wert ist, abzüglich dessen, was sie beim Eröffnen gekostet oder eingebracht hat:

- Kurs des Basiswerts auf der x-Achse - standardmäßig ±5 % um den Spot. Die Schaltflächen **+** und **-** zoomen hinein und heraus, **RESET** stellt die Standardansicht wieder her, und der Umschalter **%** / **$** beschriftet jede Gitterlinie als prozentuale oder Dollar-Bewegung vom Spot.
- Dollar-P&L auf der y-Achse, für die eingestellte Anzahl an Kontrakten.
- Eine gestrichelte Linie beim aktuellen Spot und eine **BE**-Linie bei jedem sichtbaren Breakeven.

Fahre mit der Maus über die Kurve, um den P&L bei diesem Kurs und den Abstand zum Spot zu sehen.

## Calendars und Diagonals

Wenn die Schenkel an unterschiedlichen Terminen verfallen, bewertet das Chart trotzdem jeden Schenkel mit seinem inneren Wert, als würden alle gemeinsam verfallen. Das unterschätzt, was der länger laufende Schenkel noch wert ist, deshalb weist die Seite darauf hin - lies die Kurve nur als grobe Orientierung.

## Was er nicht tut

Der Strategy Builder ist ein **Pricing-Werkzeug**, kein Order-Routing-Werkzeug. Er verbindet sich nicht mit deinem Broker. Du übernimmst die Struktur und setzt sie selbst um.

Er zeigt außerdem nur die Auszahlung bei Verfall - es gibt keine Greeks und keine Kurven für Termine vor dem Verfall.

## Hinweis zu den Tiers

Der Strategy Builder steht für Basic und Pro zur Verfügung.

## Siehe auch

- [Live-Optionskurse](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
