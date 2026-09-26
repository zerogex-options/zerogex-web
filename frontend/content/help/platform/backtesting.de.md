# Backtesting

*Spielen Sie eine ZeroGEX-Strategie oder eine eigene Regel gegen historische Optionsdaten durch, bewertet als echte Options-Leg-Roundtrips - abzüglich Slippage und Kommission - mit einem vollständigen risikoadjustierten Tearsheet, einem Monte-Carlo-Ergebniskegel und Resultaten aufgeschlüsselt nach Gamma-Regime.*

---

## Was die Backtesting-Seite ist

Die Backtesting-Seite lässt Sie testen, wie sich eine Regel historisch geschlagen hätte, und zeigt Ihnen die Bewertung so, wie ein echter Trade tatsächlich gefüllt würde - mit Durchquerung des Bid/Ask-Spreads, Kommissionszahlung und dem Aushalten von Drawdowns bei offenen Positionen. Es handelt sich um ein **Recherchewerkzeug**: Nutzen Sie es, um Ideen unter Druck zu testen und diejenigen zu verwerfen, die nicht standhalten - nicht, um eine Kurve zu konstruieren, die gut aussieht.

## Was Sie backtesten können

- **Strategy catalog** - dieselben Strategien, die auch Bot-Trading und Muster-Einblicke verwenden (Call-Wall-Fades, Put-Wall-Bounces, Gamma-Flip-Brüche, Hedging-Drift zum Handelsende und mehr), nach Familien gruppiert, einzeln oder als Basket. Jede zeigt ihr Forschungsstadium und eine Zusammenfassung ihrer Evidenz. Strategien mit einem Playbook-Muster werden gemessen, indem die Action Cards nachgespielt werden, die dieses Muster live ausgegeben hat; eine mit **Replay** markierte Strategie lässt stattdessen die Einstiegsregel ihres Bots über die Historie laufen. Eine Strategie, die sich noch nicht backtesten lässt, ist ausgegraut, mit Angabe des Grunds.
- **Eigene Strategien** - ein Condition-Builder auf Basis der minutengenauen Marktstruktur (Net GEX / Net GEX am Spot, Abstand zum Gamma-Flip, Abstände zu Call-/Put-Wall, Put-Call-Ratio, MSI und MSI-Regime, Convexity, …), kompiliert zu Einstiegen.
- **Echte Optionsstrukturen** - einzelne ATM-Optionen, Vertikalen mit definiertem Risiko sowie neutrale Straddles, Strangles und Iron Condors.

## Die Parameter-Regler

- **Symbol** - SPY / SPX / QQQ / NDX
- **Datumsbereich** - bis zur verfügbaren Historientiefe (das Formular öffnet mit dem gesamten verfügbaren Zeitraum)
- **Einstieg** - ein Basket aus Katalog-Strategien oder eine benutzerdefinierte UND-verknüpfte Bedingungsregel
- **Ausstieg** - Kursziele/Stops im Basiswert, ein Take-Profit-/Stop-Loss-Overlay auf der Optionsprämie und ein Zeitstop für die maximale Haltedauer (was zuerst greift)
- **Fill-Modell** - Slippage in % und Kommission pro Kontrakt (beides wird angewendet - siehe unten)
- **Positionsgröße** - Kapital, Risiko pro Trade, maximal gleichzeitige Positionen sowie optionale Net-Delta-/Net-Vega-Obergrenzen
- **Parameter-Sweeps** - ein Raster über ein oder zwei Achsen laufen lassen (bis zu 24 Läufe), um Einstellungen nebeneinander zu vergleichen

## Die Ausgaben

### Die Equity-Kurve

Der Wert Ihres Kontos über den gesamten Lauf, **mark to market** bewertet - offene Positionen werden bei jeder Kerze bewertet, sodass ein Trade mit unrealisiertem Verlust sich in der Kurve und im maximalen Drawdown widerspiegelt. Der Drawdown ist Peak-to-Trough auf dieser Kurve berechnet, nicht nur aus realisierten Verlusten.

### Das Performance-Tearsheet

Die risikoadjustierte Kennzahlenbatterie, die ein ernsthafter Leser zuerst prüft:

- **Sharpe, Sortino, Calmar** und **CAGR**
- **Annualisierte Volatilität**, **Exposure** und die **maximale Verlustserie**
- **Expectancy pro Trade**, **Payoff-Ratio**, **durchschnittlicher Gewinn** und **durchschnittlicher Verlust**
- Ein **Edge-t-Stat** - lässt sich das durchschnittliche Trade-Ergebnis vom Rauschen unterscheiden (|t| ≥ 2)?
- Ein **Benchmark**: Ihre Rendite im Vergleich zum simplen Buy-and-Hold des Basiswerts über denselben Zeitraum, sowie die Überrendite.

### Der Monte-Carlo-Ergebniskegel

Ihre Trade-Sequenz, auf tausend verschiedene Arten neu gezogen - denn eine einzelne Equity-Linie wirkt wie Schicksal, obwohl sie es nicht ist. Sie erhalten die **Wahrscheinlichkeit eines profitablen Abschlusses**, das **Ruinrisiko** (Wahrscheinlichkeit eines Drawdowns von ≥50 %), den **Median und die p5-p95-Bandbreite** der Renditen, den **Median und das p95 des maximalen Drawdowns** sowie einen schattierten **Equity-Kegel**, der zeigt, wo das Konto plausibel landen könnte.

### Ergebnisse nach Marktregime

Der ZeroGEX-Schnitt: dieselben Regeln aufgeschlüsselt nach **Dealer-Gamma-Umfeld** (positiv/dämpfend vs. negativ/verstärkend) und nach **MSI-Regime**, mit Win-Rate, Netto-P&L und Expectancy für jedes. Eine Regel, die in negativen Gamma-Sessions Gewinne erzielt und in positiven Verluste einfährt, ist eine Regime-Wette - genau hier wird das sichtbar.

### Warum N Trades?

Das Panel **Why N trades?** zeigt einen Trichter von den geladenen Cards bis zu den ausgeführten Trades - geladen, in Ihren ausgewählten Strategien, nach dem Cooldown, bepreist, gehandelt - samt den Gründen, aus denen Cards unterwegs herausgefallen sind. Kommt ein Lauf dünn oder leer zurück, fangen Sie hier an.

### Das Trade-Journal

Jeder Roundtrip mit Ein-/Ausstiegsprämie, Kontrakten, Net Δ/Vega, Netto-P&L, Rendite und Ergebnis. Exportieren Sie das vollständige Journal als CSV - der Export enthält zusätzlich das Gamma- und das MSI-Regime beim Einstieg. Eine Tabelle **By Pattern** darüber schlüsselt Trades, Win-Rate und Netto-P&L nach Strategie auf.

## Speichern und Teilen

- **Recent Runs** listet Ihre letzten Läufe auf; klicken Sie auf einen, um seine Ergebnisse wieder zu öffnen.
- **Saved configurations** - benennen und speichern Sie das aktuelle Setup. Aus der Liste heraus können Sie es laden, löschen oder einen Link kopieren, der die Backtesting-Seite mit diesem Setup öffnet (wer ihn öffnet, braucht Pro).
- **Share result** - erstellt für einen abgeschlossenen Lauf mit Trades einen öffentlichen, schreibgeschützten Bericht: die wichtigsten Kennzahlen, die Equity-Kurve, die Monte-Carlo-Bandbreite und die Regime-Aufschlüsselung. Jeder mit dem Link kann ihn öffnen, ganz ohne Konto.
- **Featured strategies** laden eine Strategie mit gemessener Evidenz mit einem Klick ins Formular.

## Wie Fills modelliert werden

- **Slippage-bewusst.** Jedes Leg wird über den gequoteten Spread hinweg gefüllt - Sie kaufen zum Ask, verkaufen zum Bid - erweitert um Ihre Slippage-Einstellung. Das ist bei 0DTE der dominierende, realistische Kostenfaktor.
- **Kommissions-bewusst.** Kommission wird pro Kontrakt, pro Leg, sowohl bei Einstieg als auch bei Ausstieg berechnet und fließt in die Positionsgrößenbestimmung ein.
- **Risiko-definitions-bewusst.** Mehrbeinige Strukturen sind auf ihren No-Arbitrage-Maximalverlust/-gewinn begrenzt, sodass eine illiquide, kurz vor Verfall stehende Quotierung kein unmögliches Ergebnis verbuchen kann.

Die ausgewiesenen Renditen sind **abzüglich all dessen** - die angezeigten Zahlen gelten nach Kosten, nicht brutto.

## Was der Backtester **nicht** ist

- **Kein Prognoseinstrument.** Vergangene Performance sagt keine zukünftigen Renditen voraus. Nutzen Sie den Backtester, um Regeln zu **verwerfen**, die schlecht aussehen - nicht, um Regeln zu "finden", die gut aussehen.
- **Kein Ersatz für Out-of-Sample-Disziplin.** Der Monte-Carlo-Kegel und der Edge-t-Stat zeigen, wie fragil ein Ergebnis ist, aber die Gewohnheit bleibt entscheidend: Entwerfen Sie auf einem Zeitraum, bestätigen Sie auf einem anderen, zurückgehaltenen.
- **Begrenzt durch Datentiefe.** Sie können nur das Fenster testen, das die Plattform archiviert hat. Ein kurzes Fenster ist eine kleine Stichprobe - lesen Sie den t-Stat und die Monte-Carlo-Bandbreite entsprechend, und stützen Sie sich auf die Regime-Aufschlüsselung, um zu wissen, aus welchem Umfeld Ihre Zahlen stammen.

## Ergebnisse ehrlich lesen

> Beurteilen Sie eine Regel nach ihren **risikoadjustierten** Kennzahlen und ihrer **Ergebnisbandbreite**, nicht nach ihrer besten einzelnen Linie.

Eine hohe Win-Rate mit einer Payoff-Ratio unter 1 und einem breiten Monte-Carlo-Kegel ist kein Edge. Eine moderate Win-Rate mit positiver Expectancy, einem t-Stat über 2, einem flachen Drawdown und Konsistenz über die Gamma-Regime hinweg schon. Prüfen Sie immer, welches Regime das Ergebnis hervorgebracht hat - und ob es in dem Regime standhält, in dem Sie heute traden.

## Hinweis zur Stufe

Backtesting ist eine Pro-Funktion und befindet sich derzeit in der Beta. Sie finden es in der Seitenleiste unter **TradeWorkz™**, neben Bot-Trading und Muster-Einblicke. Geteilte Ergebnis-Links sind die Ausnahme: Jeder kann sie öffnen.

## Siehe auch

- [Muster-Einblicke](/backtesting/insights) - gemessene Performance jeder Strategie im Katalog (Pro)
- [Composite Score](/help/platform/composite-score)
- [Wie Signale von Anfang bis Ende funktionieren](/help/platform/signals-overview)
