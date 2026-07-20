# Das Dashboard lesen

*Die Seite, die du jeden Morgen als Erstes öffnest. Jede Kachel, jedes Chart, jeder Hinweis erklärt.*

---

## Wozu das Dashboard dient

Das Dashboard ist der **Überblick auf einem Bildschirm** über den aktuellen Markt. Es beantwortet in 30 Sekunden drei Fragen:

1. **Wie sind die Dealer positioniert?** (das GEX-Regime)
2. **Was sagt das Tape?** (Flow + Technik)
3. **Wie lautet die Gesamteinschätzung?** (Signale, zu einer Richtung verdichtet)

Auf dem Dashboard triffst du keine Entscheidungen. Du orientierst dich. Von dort aus gehst du auf die passende Seite, um tiefer einzusteigen.

## Der Aufbau

### 1. Die Regime-Kopfzeile

Am oberen Rand der Seite steht das **GEX-Regime-Label** — Positive Gamma, Negative Gamma oder Transitioning — zusammen mit einer kurzen Einschätzung, was das gerade für das Marktverhalten bedeutet. Wenn du heute nur Zeit für eine einzige Information hast, dann für diese.

### 2. Die Preis-Kachel

Die Preis-Kachel oben zeigt den aktuellen letzten Kurs, die Veränderung gegenüber dem Schlusskurs der vorherigen Sitzung und das Sitzungs-Badge. Vorbörsliche und nachbörsliche Kurse werden mit dem vorherigen Schlusskurs als Basis angezeigt; während der regulären Handelszeit ist die Eröffnung derselben Sitzung die Basis.

### 3. Die Net-GEX-Kachel

Die Net-GEX-Kachel zeigt die zentrale Gamma-Exposure-Zahl — berechnet **am Spot**, damit sie die richtige Seite des Gamma Flip abbildet. Eine positive Zahl bedeutet, dass die Dealer netto long gamma sind; eine negative, dass sie netto short sind. Farbe und Trend-Chip unterstreichen Vorzeichen und Richtung.

### 4. Die Gamma-Flip-Kachel

Abstand zum Flip — sowohl als Strike als auch als Prozentsatz vom Spot. Der Flip ist das Niveau, an dem die Dealer-Gamma-Kurve die Nulllinie kreuzt. Oberhalb des Flips dämpft das Hedging der Dealer Bewegungen; darunter verstärkt es sie. Je näher du am Flip bist, desto höher das strukturelle Risiko eines Regimewechsels.

### 5. Die Call-Wall-/Put-Wall-Kacheln

Die Strikes mit dem größten Call-Gamma beziehungsweise Put-Gamma. Sie wirken tendenziell als intraday Widerstand und Unterstützung, besonders wenn der Markt im positiven Gamma steht. Siehe [Gamma Walls Explained](/education/gamma-walls-explained) für die strukturelle Einordnung.

### 6. Die Max-Pain-Kachel

Der Strike, der den gesamten Dollarwert der ausstehenden Optionen bei Verfall minimiert. Am relevantesten in den letzten 24–48 Stunden vor einem bedeutenden Verfall. Siehe [Max Pain Explained](/education/max-pain-explained).

### 7. Die Volatilitäts-Kacheln

Live-IV, IV-Rank und realisierte Volatilität mit Sparklines. Nützlich für die Positionsgrößenbestimmung — ein Squeeze Setup bei niedriger realisierter Volatilität ist ein anderer Trade als bei hoher.

### 8. Der Trade-Bias-Bereich

Ein zusammengeführter Bias-Chip ("Long bias", "Short bias", "Neutral") mit den zugrunde liegenden Eingangsgrößen darunter. Dies ist eine von oben gelesene Synthese — **kein** Handelssignal.

### 9. Das Composite-Score-Panel

Der MSI-Composite-Score, der Trigger-Status und die beitragenden Signalgewichte. Für die vollständige Aufschlüsselung, klicke weiter zu [Composite Score](/help/platform/composite-score).

### 10. Der Flow-Snapshot

Eine kurze Einschätzung zu premium-gewichtetem Flow, Smart-Money-Bias und Nettovolumen — drei unterschiedliche Blickwinkel auf das Tape. Die vollständigen Seiten findest du unter [Flow Analysis](/help/platform/flow-analysis) und [Smart Money](/help/platform/smart-money).

## Wie das Dashboard aktualisiert wird

Die Kacheln aktualisieren sich live. Die meisten aktualisieren sich während der regulären Handelszeit jede Sekunde. Die GEX-Oberfläche aktualisiert sich in einem etwas langsameren Takt — typischerweise alle 5–15 Sekunden —, weil der zugrunde liegende Chain-Snapshot der Flaschenhals ist. Ein Neuladen der Seite ist nicht nötig.

## Vorbörslich, nachbörslich und bei geschlossenem Markt

Das Dashboard passt sich an die jeweilige Sitzung an:

- **Vorbörslich / Nachbörslich** — der Extended-Hours-Kurs wird zusammen mit dem Schlusskurs der vorherigen regulären Sitzung angezeigt.
- **Geschlossen** — der jüngste Schlusskurs der regulären Sitzung wird angezeigt; die Signale spiegeln den zuletzt berechneten Zustand wider.

Schau dir das Sitzungs-Badge in der Preiszeile an, um das zu bestätigen.

## Das Dashboard in 30 Sekunden lesen

Die Disziplin:

1. Lies das **Regime-Label**.
2. Lies **Net GEX** und den **Abstand zum Flip**.
3. Lies **Call Wall und Put Wall** — das sind deine Levels.
4. Lies den **Trade Bias** und den **Composite Score**.
5. Entscheide, welche Seite du für den eigentlichen Trade öffnest.

Das war's. Wenn du merkst, dass du hier länger als 30 Sekunden verbringst, hast du aufgehört, dich zu orientieren, und angefangen zu analysieren — geh auf die relevante Signal-Seite.

## Siehe auch

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Using the Live Bulletin](/help/platform/live-bulletin)
