# Backtesting

*Spielen Sie jedes ZeroGEX-Signal oder eine eigene Regel gegen historische Optionsdaten durch, bewertet als echte Options-Leg-Roundtrips — abzüglich Slippage und Kommission — mit einem vollständigen risikoadjustierten Tearsheet, einem Monte-Carlo-Ergebniskegel und Resultaten aufgeschlüsselt nach Gamma-Regime.*

---

## Was die Backtesting-Seite ist

Die Backtesting-Seite lässt Sie testen, wie sich eine Regel historisch geschlagen hätte, und zeigt Ihnen die Bewertung so, wie ein echter Trade tatsächlich gefüllt würde — mit Durchquerung des Bid/Ask-Spreads, Kommissionszahlung und dem Aushalten von Drawdowns bei offenen Positionen. Es handelt sich um ein **Recherchewerkzeug**: Nutzen Sie es, um Ideen unter Druck zu testen und diejenigen zu verwerfen, die nicht standhalten — nicht, um eine Kurve zu konstruieren, die gut aussieht.

## Was Sie backtesten können

- **Playbook-Muster** — jedes der eingebauten Signalmuster, die die Live-Action-Cards steuern (Gamma-Flip-Bruch, Call-Wall-Fade, Put-Wall-Bounce, EOD-Druckdrift und mehr), einzeln oder als Basket.
- **Eigene Strategien** — ein Condition-Builder auf Basis der minutengenauen Marktstruktur (Net GEX / Net GEX am Spot, Abstand zum Gamma-Flip, Abstände zu Call-/Put-Wall, Put-Call-Ratio, MSI und MSI-Regime, Convexity, …), kompiliert zu Einstiegen.
- **Echte Optionsstrukturen** — einzelne ATM-Optionen, Vertikalen mit definiertem Risiko sowie neutrale Straddles, Strangles und Iron Condors.

## Die Parameter-Regler

- **Symbol** — SPY / SPX / QQQ
- **Datumsbereich** — bis zur verfügbaren Historientiefe (im Formular angezeigt)
- **Einstieg** — ein Muster-Basket oder eine benutzerdefinierte UND-verknüpfte Bedingungsregel
- **Ausstieg** — Kursziele/Stops im Basiswert, ein Take-Profit-/Stop-Loss-Overlay auf der Optionsprämie und ein Zeitstop für die maximale Haltedauer (was zuerst greift)
- **Fill-Modell** — Slippage in % und Kommission pro Kontrakt (beides wird angewendet — siehe unten)
- **Positionsgröße** — Kapital, Risiko pro Trade, maximal gleichzeitige Positionen sowie optionale Net-Delta-/Net-Vega-Obergrenzen
- **Parameter-Sweeps** — ein Raster über ein oder zwei Achsen laufen lassen, um Einstellungen nebeneinander zu vergleichen

## Die Ausgaben

### Die Equity-Kurve

Der Wert Ihres Kontos über den gesamten Lauf, **mark to market** bewertet — offene Positionen werden bei jeder Kerze bewertet, sodass ein Trade mit unrealisiertem Verlust sich in der Kurve und im maximalen Drawdown widerspiegelt. Der Drawdown ist Peak-to-Trough auf dieser Kurve berechnet, nicht nur aus realisierten Verlusten.

### Das Performance-Tearsheet

Die risikoadjustierte Kennzahlenbatterie, die ein ernsthafter Leser zuerst prüft:

- **Sharpe, Sortino, Calmar** und **CAGR**
- **Annualisierte Volatilität**, **Exposure** und die **maximale Verlustserie**
- **Expectancy pro Trade**, **Payoff-Ratio**, durchschnittlicher und größter Gewinn/Verlust
- Ein **Edge-t-Stat** — lässt sich das durchschnittliche Trade-Ergebnis vom Rauschen unterscheiden (|t| ≥ 2)?
- Ein **Benchmark**: Ihre Rendite im Vergleich zum simplen Buy-and-Hold des Basiswerts über denselben Zeitraum, sowie die Überrendite.

### Der Monte-Carlo-Ergebniskegel

Ihre Trade-Sequenz, auf tausend verschiedene Arten neu gezogen — denn eine einzelne Equity-Linie wirkt wie Schicksal, obwohl sie es nicht ist. Sie erhalten die **Wahrscheinlichkeit eines profitablen Abschlusses**, das **Ruinrisiko** (Wahrscheinlichkeit eines Drawdowns von ≥50 %), die **p5/p50/p95**-Bandbreite der Renditen und maximalen Drawdowns sowie einen schattierten **Equity-Kegel**, der zeigt, wo das Konto plausibel landen könnte.

### Ergebnisse nach Marktregime

Der ZeroGEX-Schnitt: dieselben Regeln aufgeschlüsselt nach **Dealer-Gamma-Umfeld** (positiv/dämpfend vs. negativ/verstärkend) und nach **MSI-Regime**, mit Win-Rate, Netto-P&L und Expectancy für jedes. Eine Regel, die in negativen Gamma-Sessions Gewinne erzielt und in positiven Verluste einfährt, ist eine Regime-Wette — genau hier wird das sichtbar.

### Das Trade-Journal

Jeder Roundtrip mit Ein-/Ausstiegsprämie, Kontrakten, Net Δ/Vega, dem Regime beim Einstieg, Netto-P&L und Ergebnis. Exportieren Sie das vollständige Journal als CSV.

## Wie Fills modelliert werden

- **Slippage-bewusst.** Jedes Leg wird über den gequoteten Spread hinweg gefüllt — Sie kaufen zum Ask, verkaufen zum Bid — erweitert um Ihre Slippage-Einstellung. Das ist bei 0DTE der dominierende, realistische Kostenfaktor.
- **Kommissions-bewusst.** Kommission wird pro Kontrakt, pro Leg, sowohl bei Einstieg als auch bei Ausstieg berechnet und fließt in die Positionsgrößenbestimmung ein.
- **Risiko-definitions-bewusst.** Mehrbeinige Strukturen sind auf ihren No-Arbitrage-Maximalverlust/-gewinn begrenzt, sodass eine illiquide, kurz vor Verfall stehende Quotierung kein unmögliches Ergebnis verbuchen kann.

Die ausgewiesenen Renditen sind **abzüglich all dessen** — die angezeigten Zahlen gelten nach Kosten, nicht brutto.

## Was der Backtester **nicht** ist

- **Kein Prognoseinstrument.** Vergangene Performance sagt keine zukünftigen Renditen voraus. Nutzen Sie den Backtester, um Regeln zu **verwerfen**, die schlecht aussehen — nicht, um Regeln zu "finden", die gut aussehen.
- **Kein Ersatz für Out-of-Sample-Disziplin.** Der Monte-Carlo-Kegel und der Edge-t-Stat zeigen, wie fragil ein Ergebnis ist, aber die Gewohnheit bleibt entscheidend: Entwerfen Sie auf einem Zeitraum, bestätigen Sie auf einem anderen, zurückgehaltenen.
- **Begrenzt durch Datentiefe.** Sie können nur das Fenster testen, das die Plattform archiviert hat. Ein kurzes Fenster ist eine kleine Stichprobe — lesen Sie den t-Stat und die Monte-Carlo-Bandbreite entsprechend, und stützen Sie sich auf die Regime-Aufschlüsselung, um zu wissen, aus welchem Umfeld Ihre Zahlen stammen.

## Ergebnisse ehrlich lesen

> Beurteilen Sie eine Regel nach ihren **risikoadjustierten** Kennzahlen und ihrer **Ergebnisbandbreite**, nicht nach ihrer besten einzelnen Linie.

Eine hohe Win-Rate mit einer Payoff-Ratio unter 1 und einem breiten Monte-Carlo-Kegel ist kein Edge. Eine moderate Win-Rate mit positiver Expectancy, einem t-Stat über 2, einem flachen Drawdown und Konsistenz über die Gamma-Regime hinweg schon. Prüfen Sie immer, welches Regime das Ergebnis hervorgebracht hat — und ob es in dem Regime standhält, in dem Sie heute traden.

## Hinweis zur Stufe

Backtesting ist eine Pro-Funktion.

## Siehe auch

- [Composite Score](/help/platform/composite-score)
- [Wie Signale von Anfang bis Ende funktionieren](/help/platform/signals-overview)
