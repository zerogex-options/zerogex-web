# So liest du ZeroGEX-Charts

*Ein gemeinsames visuelles Vokabular — Farben, Skalen, Hover-Verhalten, Legenden und die chartspezifischen Hinweise zu GEX-Profil, Walls und Heatmaps.*

---

## Die Farbsprache

ZeroGEX verwendet über alle Charts hinweg eine kleine, konsistente Farbpalette. Kennt man sie einmal, liest sich jeder Chart schneller.

- **Amber / warmes Orange** — Akzentfarbe; wird für Warnungen, Markenbetonung und die Score-Line-Spur verwendet.
- **Grün** — bullisch, positiv, Long-Richtung, Gewinn.
- **Rot** — bärisch, negativ, Short-Richtung, Verlust.
- **Blau / dunkles Marineblau** — neutrale strukturelle Information; Referenzlinien, Achsen, Baselines.
- **Koralle / Pink** — sekundär informativ; Smart-Money-Tags, besondere Hervorhebungen.

Die **Bedeutung** der Farben bleibt über alle Charts hinweg stabil. Dasselbe Grün steht überall für "bullisch".

### Die zentralen Level

Vier Level tragen überall dort, wo sie gezeichnet werden, ihre eigene Farbe — bewusst getrennt von der bullisch/bärisch-Sprache oben, damit ein Level nie als Richtung gelesen wird:

- **Azurblau** — der **Gamma Flip**. Er ist die Grenze zwischen Long-Gamma- und Short-Gamma-Zone und ist deshalb absichtlich weder grün noch rot.
- **Gold** — **Max Pain**.
- **Petrol** — der **Pin Strike**.
- **Violett** — der **GEX King**, der dominante Gamma-Knoten.

**Call Wall** und **Put Wall** tragen dagegen die Richtungsfarben, und der **zuletzt gehandelte Preis** trägt den Hot-Accent des jeweiligen Themes — immer eine warme Farbe, nie das Azurblau des Flips.

## Die Score-Line

Jeder Signal-Score wird auf derselben **[-1, +1]**-y-Achse mit der Nulllinie in der Mitte dargestellt. Die Hintergrundeinfärbung in der Nähe der Trigger-Schwellen erinnert daran, wo das Signal handlungsrelevant wird.

- Die Farbe der Spur codiert die Größenordnung.
- Das Vorzeichen codiert die Richtung.
- Eine horizontal gestrichelte Linie an der Trigger-Schwelle macht die Überschreitung sichtbar.

Für eine tiefere Erläuterung siehe [Die Score-Line [-1, +1] lesen](/help/platform/score-line).

## Der GEX-Profil-Chart

Ein fester Bestandteil der Dealer-Positioning-Seite.

- **X-Achse** — Strike-Preis.
- **Y-Achse** — Dealer-Gamma in Dollar, mit Vorzeichen.
- **Vertikale Linie** — aktueller Spot.
- **Wo die Kurve die Nulllinie kreuzt** — der Gamma-Flip.
- **Hohe positive Balken** — Call-Wall-Kandidaten.
- **Hohe negative Balken** — Put-Wall-Kandidaten.

Der Chart zentriert sich automatisch auf den Spot. Der Standardbereich liegt bei etwa ±5 % vom Spot — breit genug, um die strukturellen Walls zu erkennen, und eng genug, um die relevanten Strikes lesbar zu halten.

## Der Walls-Chart

Dieselben Daten wie das GEX-Profil, jedoch mit hervorgehobener Wall-Struktur: Call Wall, Put Wall, Max Pain und Gamma-Flip sind auf derselben Achse überlagert. Nutze ihn, wenn du ein einziges Bild möchtest, das die gesamte strukturelle Lesart erfasst.

## Die Strike-×-DTE-Heatmap

Eine 2D-Heatmap auf der Dealer-Positioning-Seite.

- **Zeilen** — Strike (sortiert rund um den Spot).
- **Spalten** — DTE (0DTE, 1DTE, wöchentlich, monatlich).
- **Zellenfarbe** — Dealer-Gamma bei dieser Strike-/Verfallskombination.

Die heißesten Zellen sind die Strikes, die für die nächstliegenden Verfallstermine relevant sind. Beobachte, wie die Heatmap sich im Tagesverlauf verschiebt — springt die hellste Zelle zu einem anderen Strike, verschiebt sich der Wall.

## Der Candle-Chart

Standard-OHLC-Candles mit VWAP und den Gamma-Overlays. Die Overlays sind der ZeroGEX-Twist:

- Die **Gamma-Flip**-Linie — lange Striche, azurblau, am linken Rand mit `FLIP` beschriftet.
- Die **Call-Wall**- und **Put-Wall**-Linien.
- **Max Pain** (wo relevant).

Die fein gepunktete Linie im Hot-Accent des Themes ist der **zuletzt gehandelte Preis**, kein Gamma-Level — in der Legende unter dem Chart steht sie als "Last".

Mit den Overlays kannst du das Preisgeschehen durch die Dealer-Positioning-Brille lesen, ohne den Chart zu verlassen.

### Wenn keine Flip-Linie zu sehen ist

Ein Level wird nur gezeichnet, solange es im aktuell sichtbaren Preisbereich liegt. Bei einem hochpreisigen Basiswert, dessen Flip weit vom Spot entfernt liegt — NDX besonders —, kann die Flip-Linie deshalb außerhalb der sichtbaren Skala liegen. Der Chart sagt das ausdrücklich, statt dich raten zu lassen: ein Chip am Rand der Zeichenfläche zeigt `FLIP ↓ 22,600.00` mit Richtung und Preis, und die rechte Preisachse trägt ein passendes Pfeil-Tag. Zoome die Preisachse heraus (Schaltfläche **Price −**, Umschalt+Scrollen oder Ziehen an der rechten Preisskala), um die Linie selbst ins Bild zu holen.

Gelegentlich lässt sich gar kein Flip bestimmen — das abgetastete Gamma-Profil hat durchgehend ein Vorzeichen, oder die Chain ist zu dünn, um den Nulldurchgang zu setzen. Dann steht auf dem Chip `FLIP UNAVAILABLE`, und das Badge "Dealer Gamma @ Spot" zeigt ein schlichtes `—`. Wir zeichnen lieber nichts als ein Level, dem wir nicht trauen.

## Hover-Verhalten

Die meisten Charts zeigen beim Hovern einen Tooltip mit den präzisen Werten an der x-Koordinate des Cursors. Der Tooltip folgt der Farbsprache des Charts — die Farbe des Wert-Chips entspricht der jeweiligen Serie.

## Legenden

Legenden sind in den meisten Charts klickbar — klicke auf eine Serie, um sie auszublenden. Nützlich, um ein einzelnes Signal oder einen einzelnen Greek zu isolieren.

## Sparklines

Die Signal-Cards auf den Dashboards verwenden Sparklines — kleine inline eingebettete Mini-Charts des Scores über das letzte Zeitfenster. Die Steigung der Sparkline ist aussagekräftiger als ihr absolutes Niveau: Ein Score von +0,4 mit Aufwärtstrend ist eine andere Lesart als +0,4 mit Abwärtstrend.

## Light Mode

Jeder Chart funktioniert sowohl im Dark- als auch im Light-Theme. Die **Farbidentitäten** bleiben gleich; die **Werte** kehren sich um, um den Kontrast zu erhalten. Grün-bullisch und Rot-bärisch bleiben themenübergreifend stabil.

## Häufige Fehler

- **Die falsche Achse lesen.** Score-Charts sind [-1, +1]; GEX-Charts sind in Dollar. Nicht miteinander vergleichen.
- **Eine Sparkline als Trade-Chart behandeln.** Sparklines sind Kontext, keine Einstiegssignale.
- **Die Heatmap aus der Ferne lesen.** Der eigentliche Sinn der Heatmap liegt in der Textur — zoome hinein, wenn die Zellen zu klein sind.

## Siehe auch

- [Das Dashboard lesen](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Die Score-Line [-1, +1] lesen](/help/platform/score-line)
