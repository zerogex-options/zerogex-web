# Strategy Builder

*Baue jede ein- oder mehrschenklige Optionsstrategie. Wie der Rechner bepreist, wie die Greeks berechnet werden und wie man die P&L-Szenarien liest.*

---

## Was der Strategy Builder ist

Der Strategy Builder ist das **Modellierungswerkzeug pro Trade**. Du baust eine Strategie Schenkel für Schenkel auf, die Seite bepreist sie live, und du liest die P&L-Fläche und die aggregierten Greeks.

Hierher gehst du, nachdem dir das Dashboard sagt "die Struktur ist bullish" und du das konkrete Instrument auswählen musst.

## Eine Strategie aufbauen

1. **Wähle ein Symbol** (SPY, SPX, QQQ).
2. **Füge einen Schenkel hinzu** — Kauf oder Verkauf, Call oder Put, Strike, Verfall. Die Kette ist live.
3. **Wiederhole** für mehrschenklige Strukturen (Verticals, Condors, Calendars, Ratios, Straddles, Strangles).
4. **Lege den Spot für die Analyse fest** — standardmäßig der Live-Spot, aber du kannst jeden beliebigen Preis als Szenario testen.

Der Gesamtpreis, die Breakevens und die Greeks aktualisieren sich bei jeder Änderung.

## Das Pricing-Modell

Der Builder nutzt **Black-Scholes** mit der live impliziten Volatilitätsfläche für jeden Schenkel. Die IV-Fläche wird aus unserer Datenpipeline bezogen — dieselbe Fläche, die die Kette auf der Seite [Live-Optionsnotierungen](/help/platform/option-contracts) speist.

Für amerikanische Ausübungsbedingungen (relevant für ETFs wie SPY und QQQ) approximiert das Modell mit einer Vorzeitausübungsprämie bei tief im Geld liegenden Schenkeln nahe dem Verfall. SPX hat europäische Ausübung, daher wird keine Anpassung vorgenommen.

## Das Greeks-Panel

Für jeden Schenkel und für die Aggregation:

- **Delta** — Richtungsexposure
- **Gamma** — wie sich das Delta mit dem Spot bewegt
- **Theta** — Zeitwertverfall (pro Tag)
- **Vega** — IV-Sensitivität (pro 1 % Veränderung)
- **Charm** — Delta-Verfall (pro Tag)

Aggregierte Greeks lassen dich eine mehrschenklige Struktur auf einen Blick lesen — z. B. ist ein langer Calendar netto long vega, short theta im vorderen Monat, long theta im hinteren.

## Die P&L-Fläche

Das 2D-P&L-Chart zeigt:

- Spotpreis auf der x-Achse.
- P&L-Wert auf der y-Achse.
- Mehrere Kurven: bei Verfall (die Auszahlung) sowie an verschiedenen Terminen zwischen jetzt und dem Verfall.

Du siehst außerdem die Breakevens auf der x-Achse hervorgehoben.

## Szenario-Tests

Das Szenario-Panel lässt dich zwei Variablen gleichzeitig durchfahren — typischerweise Spot und IV — und das resultierende P&L-Raster betrachten. Nützlich für:

- Eine Long-Vol-Struktur: Wie viel verdienst du bei einem Volatilitätsschock von 2 Vol-Punkten?
- Einen Pin-Trade: Wie viel kannst du verlieren, wenn der Spot um 1 % vom Max Pain abweicht?

## Was er nicht tut

Der Strategy Builder ist ein **Pricing-Werkzeug**, kein Order-Routing-Werkzeug. Er verbindet sich nicht mit deinem Broker. Du übernimmst die Struktur und setzt sie selbst um.

## Hinweis zu den Tiers

Der Strategy Builder steht für Basic und Pro zur Verfügung.

## Siehe auch

- [Live-Optionsnotierungen](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
