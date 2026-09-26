# So liest du ZeroGEX-Charts

*Ein gemeinsames visuelles Vokabular - Farben, Skalen, Hover-Verhalten, Legenden und die chartspezifischen Hinweise zum Gamma-Profil, zum Open Interest, zu den Heatmaps und zum Gamma Chart.*

---

## Die Farbsprache

ZeroGEX verwendet über alle Charts hinweg eine kleine, konsistente Farbpalette. Kennt man sie einmal, liest sich jeder Chart schneller.

- **Amber / warmes Orange** - Akzentfarbe; wird für Warnungen, Markenbetonung und die Score-Line-Spur verwendet.
- **Grün** - bullisch, positiv, Long-Richtung, Gewinn.
- **Rot** - bärisch, negativ, Short-Richtung, Verlust.
- **Blau / dunkles Marineblau** - neutrale strukturelle Information; Referenzlinien, Achsen, Baselines.
- **Koralle / Pink** - sekundär informativ; Sitzungs-Badges wie Pre-market, After hours und Futures.

Die **Bedeutung** der Farben bleibt über alle Charts hinweg stabil. Dasselbe Grün steht überall für "bullisch". Flächen, die das Dealer-Gamma nach Vorzeichen einfärben, verwenden eigene Farbverläufe, die in der Legende des jeweiligen Charts benannt sind: Die GEX-Heatmap über die Zeit läuft von Blau (negativ) über Weiß zu Orange (positiv), und die Ribbons des Gamma Charts sind gold für long Gamma und violett für short.

### Die zentralen Level

Im Gamma Chart und in den anderen Kurscharts, die sie zeichnen, tragen vier Level ihre eigene Farbe - bewusst getrennt von der bullisch/bärisch-Sprache oben, damit ein Level nie als Richtung gelesen wird:

- **Azurblau** - der **Gamma Flip**. Er ist die Grenze zwischen Long-Gamma- und Short-Gamma-Zone und ist deshalb absichtlich weder grün noch rot.
- **Gold** - **Max Pain**.
- **Petrol** - der **Pin Strike**.
- **Violett** - der **GEX King**, der dominante Gamma-Knoten.

**Call Wall** und **Put Wall** tragen die Richtungsfarben. Im Gamma Chart sind sie danach eingefärbt, was das Level tut - die Call Wall rot (Widerstand darüber), die Put Wall grün (Unterstützung darunter). Charts, die Calls und Puts trennen, wie die Balken pro Strike auf Dealer Positioning, behalten Calls grün und Puts rot. Der live **zuletzt gehandelte Preis** trägt den Hot-Accent des jeweiligen Themes - immer eine warme Farbe, nie das Azurblau des Flips.

Das Gamma-Exposure-by-Strike-Chart auf Dealer Positioning beschriftet seine Referenzlinien im Text (Spot, Flip, Call Wall, Put Wall) und zeichnet seinen Flip in Amber - richte dich dort nach der Beschriftung.

## Die Score-Line

Jeder Score der Basic- und Advanced-Signale liegt auf derselben Skala von **−100 bis +100** - der Score von [-1, +1], mal 100 - mit der Null in der Mitte.

- Das Vorzeichen codiert die Richtung.
- Der Abstand von der Null codiert die Überzeugung.
- Die Karten der Advanced-Signale zeigen, ab wann das Signal auslöst ("activates at ±N").
- In der Ereignis-Timeline eines Signals ist der Score die amberfarbene Linie, die Null die blasse horizontale Linie, und Dreiecke markieren Richtungswechsel - grün Richtung bullisch, rot Richtung bärisch.

Für eine tiefere Erläuterung siehe [Die Score-Line lesen](/help/platform/score-line).

## Das Gamma-Exposure-by-Strike-Chart

Ein fester Bestandteil der Dealer-Positioning-Seite.

- **X-Achse** - Strike-Preis.
- **Balken** - modelliertes Dealer-Gamma pro Strike in Dollar, mit Vorzeichen nach der Konvention Calls positiv / Puts negativ: Calls nach oben, Puts nach unten, jeder Balken nach Verfall gestapelt, der nächste am kräftigsten.
- **GEX-Profile-Kurve** - das modellierte Dealer-Gamma-Profil über die Preise, auf eigener Achse.
- **Wo die Kurve die Nulllinie kreuzt** - der Gamma Flip.
- **Hohe Call-Balken** - Call-Gamma-Stapel (Call-Wall-Kandidaten).
- **Hohe Put-Balken** - Put-Gamma-Stapel (Put-Wall-Kandidaten).
- **Referenzlinien** - Spot, der Flip sowie Call Wall und Put Wall.

Das Chart öffnet vollständig herausgezoomt über alle geladenen Strikes. Die X-Buttons zoomen die Strikes, die Y-Buttons vergrößern die Gamma-Skala, um kleine Balken zu prüfen, und der Reset-Button stellt beides wieder her.

## Das Open-Interest-Chart

Open Interest by Strike, ebenfalls auf Dealer Positioning: offene Kontrakte an jedem Strike, Calls über der Achse und Puts darunter, wie die Gamma-Balken nach Verfall gestapelt. Umschaltbar zwischen **OI** (Anzahl Kontrakte) und **Notional** (Strike × 100 × OI); eine gepunktete Linie markiert den Spot. Lies es zusammen mit dem Gamma-Chart - das Open Interest zeigt, wo die Kontrakte liegen, das Gamma, wie viel Hedging sie auslösen.

## Die Strike-×-DTE-Heatmap

GEX Heatmap · Strike × DTE, auf der Dealer-Positioning-Seite.

- **Zeilen** - die Strikes mit dem meisten Gamma in der kommenden Woche, höchster Strike oben.
- **Spalten** - Tage bis zum Verfall, bis 7DTE.
- **Zellenfarbe** - Netto-Dealer-Gamma bei dieser Strike-/Verfallskombination: grün positiv, rot negativ, kräftiger bei größerem Wert.
- **Krone** - der GEX King, der Strike mit dem größten Netto-Dealer-Gamma über diese Verfälle.

Die heißesten Zellen sind die Strikes, die für die nächstliegenden Verfallstermine relevant sind. Beobachte, wie die Heatmap sich im Tagesverlauf verschiebt - springt die hellste Zelle zu einem anderen Strike, verschiebt sich die Wall.

## Die GEX-Heatmap über die Zeit

GEX Heatmap Timeseries, auf der GEX-Heatmap-Seite und auf Dealer Positioning: Strikes an der Seite, die Zeit quer, jede Spalte das Netto-Dealer-Gamma in diesem Moment - orange positiv, blau negativ, nahezu weiß um null - mit den Kerzen und dem Gamma Flip darüber. Gestrichelte Abschnitte der Flip-Linie markieren Zyklen, in denen der Flip nur gefunden wurde, weil die Suche weit vom Spot ausgedehnt wurde; behandle sie als Grenzfälle.

## Der Gamma Chart

Der Kurschart im Gamma Terminal und der ZeroGEX Gamma Chart auf dem Main Dashboard sind derselbe Chart: der Kurs des Basiswerts mit eingezeichneter Dealer-Gamma-Struktur.

- **Symbol und Timeframe** - SPY, QQQ, SPX, NDX, ES oder NQ, in 1m-, 5m-, 15m-, 1H- oder 1D-Balken.
- **Kursdarstellung** - Candle, Line oder Area, über einem Volumenbereich, der Up/Down-Volumen oder das Cumulative-Netto der Sitzung zeigt.
- **Expiry** - im Live-Chart beschränkt es die Gamma-Level und die Rail auf die gewählten Verfälle; **All** ist die ganze Chain.

Die Overlays sind der ZeroGEX-Twist, jedes über eine Pille über dem Chart schaltbar:

- **Gamma Levels** - die Gamma-Flip-Linie (lange Striche, azurblau, am linken Rand mit `FLIP` beschriftet) sowie die Call-Wall- und Put-Wall-Linien.
- **Gamma Rail** - Dealer-Gamma pro Strike, auf Höhe der Kurse im Chart gezeichnet, als geglättete Silhouette oder als Net-, Split- oder Combined-Balken. Im Gamma Terminal sitzt sie im Panel neben dem Chart, wo du sie gegen zwei strike-ausgerichtete Net-GEX-Leitern tauschen kannst.
- **Max Pain** und **Pin Strike** - eigene Linien in Gold und Petrol; die Pin-Linie trägt ihre Stärke, etwa `PIN · STRONG`.
- **VWAP** und **Regime**-Schattierung - die Long-Gamma- und Short-Gamma-Zonen beiderseits des Flips.
- Aus, bis du sie einschaltest: **GEX King** und im Live-Chart **Expected Range**, **Ribbons** (Gamma pro Strike über die Zeit, hinter dem Kursverlauf) und **Bar Timer**.

Die fein gepunktete Linie im Hot-Accent des Themes ist der **zuletzt gehandelte Preis**, kein Gamma-Level - in der Legende unter dem Chart steht sie als "Last".

Mit den Overlays kannst du das Preisgeschehen durch die Dealer-Positioning-Brille lesen, ohne den Chart zu verlassen. Ohne Basic- oder Pro-Plan zeigt das Gamma Terminal einen etwa 15 Minuten verzögerten Snapshot mit festem Symbol und Timeframe; Mitglieder sehen es live.

### Wenn keine Flip-Linie zu sehen ist

Ein Level wird nur gezeichnet, solange es im aktuell sichtbaren Preisbereich liegt. Bei einem hochpreisigen Basiswert, dessen Flip weit vom Spot entfernt liegt - NDX besonders -, kann die Flip-Linie deshalb außerhalb der sichtbaren Skala liegen. Der Chart sagt das ausdrücklich, statt dich raten zu lassen: ein Chip am Rand der Zeichenfläche zeigt `FLIP ↓ 22,600.00` mit Richtung und Preis, und die rechte Preisachse trägt ein passendes Pfeil-Tag. Zoome die Preisachse heraus (Schaltfläche **Price −**, Umschalt+Scrollen oder Ziehen an der rechten Preisskala), um die Linie selbst ins Bild zu holen.

Gelegentlich lässt sich gar kein Flip bestimmen. Der Resolver veröffentlicht nur einen Nulldurchgang, der nah genug am Spot liegt, um handelbar zu sein, und durch echtes Open Interest gedeckt ist; liegt der Spot tief in einem Gamma-Regime oder ist die Chain dünn oder einseitig (nachbörslich, bei einem Sprung der impliziten Volatilität), schafft kein Durchgang diese Hürde. Dann steht auf dem Chip `FLIP UNAVAILABLE` mit einem bernsteinfarbenen `?` daneben - fahre mit der Maus über das Zeichen, um den Grund zu sehen, und bei ES / NQ, in welcher Chain der Flip fehlte -, und das Badge "Dealer Gamma @ Spot" zeigt ein schlichtes `—`. Wir zeichnen lieber nichts als ein Level, dem wir nicht trauen; in der Regel löst sich der Flip bei einem späteren Snapshot wieder auf.

Ein leerer Flip bedeutet etwas anderes, wenn der Filter **Expiry** nur einen Teil der Chain enthält. Der Chart zeichnet dann die Level der von dir gewählten Verfallstermine, und ihr Flip wird allein aus diesen Strikes neu gebildet - eine Teilmenge hat aber oft nur ein Vorzeichen (ein 0DTE-Buch am Nachmittag mit negativem Gamma auf jedem Strike kreuzt die Null nie), es gibt also keinen Durchgang zu zeichnen. Der Chip sagt das direkt: `NO FLIP IN SELECTED EXPIRIES`. Anders als im Fall davor löst sich dieser bei einem späteren Snapshot *nicht* auf, denn es fehlt nichts. Stelle **Expiry** zurück auf **All**, um den Flip der ganzen Chain zu sehen - dasselbe Level, das die Seite Dealer Positioning meldet, die die vollständige Chain liest und deshalb weiter eine Zahl zeigt, während der Chart eingegrenzt ist.

## Hover-Verhalten

Die meisten Charts zeigen beim Hovern einen Tooltip mit den präzisen Werten an der x-Koordinate des Cursors. Der Tooltip folgt der Farbsprache des Charts - die Farbe des Wert-Chips entspricht der jeweiligen Serie.

## Legenden

Legenden benennen jede Serie und ihre Farbe - sie sind ein Schlüssel, kein Schalter. Im Gamma Chart schalten die Overlay-Pillen über dem Chart die Ebenen ein und aus.

## Sparklines

Die Signal-Cards auf den Dashboards verwenden Sparklines - kleine inline eingebettete Mini-Charts des Scores über das letzte Zeitfenster. Die Steigung der Sparkline ist aussagekräftiger als ihr absolutes Niveau: Ein Score von +40 mit Aufwärtstrend ist eine andere Lesart als +40 mit Abwärtstrend.

## Light Mode

Jeder Chart funktioniert sowohl im Dark- als auch im Light-Theme. Die **Farbidentitäten** bleiben gleich; die **Werte** kehren sich um, um den Kontrast zu erhalten. Grün-bullisch und Rot-bärisch bleiben themenübergreifend stabil.

## Häufige Fehler

- **Die falsche Achse lesen.** Score-Charts laufen von −100 bis +100; GEX-Charts sind in Dollar. Nicht miteinander vergleichen.
- **Eine Sparkline als Trade-Chart behandeln.** Sparklines sind Kontext, keine Einstiegssignale.
- **Die Heatmap aus der Ferne lesen.** Der eigentliche Sinn der Heatmap liegt in der Textur - zoome hinein, wenn die Zellen zu klein sind.

## Siehe auch

- [Das Dashboard lesen](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Die Score-Line lesen](/help/platform/score-line)
