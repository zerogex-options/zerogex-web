# Das Dashboard lesen

*Die Seite, die du jeden Morgen als Erstes öffnest. Jede Leiste, jeder Chart und jede Karte erklärt.*

---

## Wozu das Dashboard dient

Das Haupt-Dashboard ist der **Überblick auf einem Bildschirm** über den aktuellen Markt. Es beantwortet in 30 Sekunden drei Fragen:

1. **Wie sind die Dealer positioniert?** (das Gamma-Regime und die wichtigsten Levels)
2. **Was sagt das Tape?** (Flow und Volatilität)
3. **Wie lautet die zusammengeführte Lesart?** (Trade Bias und der Composite MSI)

Auf dem Dashboard triffst du keine Entscheidungen. Du orientierst dich. Von dort aus gehst du auf die passende Seite, um tiefer einzusteigen.

## Simple und Detailed

Der Umschalter **Simple / Detailed** oben rechts legt fest, wie viel die Seite zeigt. **Simple** ist die Voreinstellung und hält die Seite auf den schnellen Blick ausgelegt: Heutige Einschätzung, Proprietäre Signale & Volatilität sowie Positionierung & Flow starten eingeklappt - klicke auf den Titel eines Bereichs, um ihn zu öffnen. **Detailed** öffnet alle Bereiche. Deine Auswahl wird gespeichert.

## Der Aufbau

### 1. Key Levels

Die Leiste ganz oben. Ihre Kopfzeile zeigt das Symbol, die Verfallstermine, aus denen die Levels stammen, und den Chip **Long γ / Short γ**: Long Gamma bedeutet, dass das Hedging der Dealer Bewegungen tendenziell dämpft (Pinning); Short Gamma bedeutet, dass es sie tendenziell verstärkt (Trend). Darunter folgt eine Karte pro Level, jeweils mit dem Abstand zwischen Preis und Level:

- **Spot** - der Live-Preis und seine Veränderung.
- **Gamma Flip** - das Level, an dem das modellierte Dealer-Gamma das Vorzeichen wechselt. Darüber dämpft das Hedging Bewegungen; darunter verstärkt es sie. Je näher der Preis am Flip liegt, desto höher das Risiko eines Regimewechsels.
- **Pin Strike** - der nahe gelegene 0DTE-Strike, an dem positives Dealer-Gamma und die Wahrscheinlichkeit, dass der Preis ihn erreicht, am stärksten zusammenkommen, mit einem Label Strong / Moderate / Weak. Das ist ein modelliertes Pinning-Level, kein Kursziel, und wenn kein Strike infrage kommt, sagt die Karte das auch. Siehe [Pin Strike](/help/platform/pin-strike).
- **Call Wall** und **Put Wall** - die Strikes mit dem meisten Call-Gamma bzw. Put-Gamma. Sie wirken tendenziell als Widerstand und Unterstützung, besonders bei positivem Gamma. Siehe [Gamma Walls erklärt](/education/gamma-walls-explained).
- **Max Pain** - der Strike, der den Gesamtwert der ausstehenden Optionen bei Verfall minimiert. Am relevantesten in den letzten ein, zwei Tagen vor einem bedeutenden Verfall. Siehe [Max Pain erklärt](/education/max-pain-explained).

Die Leiste zeigt genau die Levels, die der Gamma Chart einzeichnet, einschließlich eines Verfallsfilters, den du im Chart gesetzt hast. Um das Symbol direkt in der Leiste zu wechseln, fahre am Computer mit der Maus darüber, um Pfeile einzublenden, oder wische auf dem Smartphone darüber.

### 2. Heutige Einschätzung

Eine automatisch erstellte Schlagzeile und ein kurzer Absatz zum Regime des gewählten Symbols: Long Gamma (Pinning, geringere Volatilität), Short Gamma (Trend, höhere Volatilität), direkt am Flip (ein Übergang) oder ungeklärt, wenn sich der Flip aus dem aktuellen Snapshot nicht berechnen lässt. Die Einschätzung basiert auf demselben Modell wie das [Live-Bulletin](/help/platform/live-bulletin), und ein Klick darauf öffnet das vollständige Bulletin.

### 3. Der Gamma Chart

Der ZeroGEX Gamma Chart ist das Herzstück: Live-Kerzen und die Dealer-Gamma-Struktur, auf derselben Preisachse eingezeichnet. Das Overlay **Gamma Levels** markiert den Flip, die Call- und Put-Walls und Max Pain. Die **Gamma Rail** neben den Kerzen zeigt das Netto-Dealer-Gamma nach Preis, sodass die Walls buchstäblich als Balken erscheinen. Die Kopfzeile des Charts zeigt den Live-Preis, seine Veränderung, die Sitzung und das Dealer-Gamma-Regime. Mit den Bedienelementen des Charts änderst du Zeitrahmen und Chart-Stil und filterst, welche Verfallstermine in die Levels einfließen. Siehe [So liest du ZeroGEX-Charts](/help/platform/reading-charts).

### 4. Trade Bias

Eine einzelne Karte mit dem Regime, dem Bias (etwa *Buy Dips*, *Sell Rips*, *Range-Bound* oder *Neutral*) und einem Konfidenzwert auf einer Skala bis 10. Dies ist eine von oben gelesene Synthese, **kein** Handelssignal. **Open Trade Bias** führt zur vollständigen Aufschlüsselung und zum Playbook auf der Seite Trade Bias, die zu Pro gehört. Bei Basic wird die Karte ohne die Signal-Eingangsgrößen gebildet, die Pro vorbehalten sind.

Unter der Karte erklärt **How to read these signals** (eingeklappt), wie Trade Bias, der Composite MSI, die Basic-Signale und die Advanced-Signale zusammenhängen.

### 5. Proprietäre Signale & Volatilität

- **Composite MSI** - eine Regime-Anzeige von 0-100: 70 und mehr ist **Trend / Expansion**, 40-70 **Controlled Trend**, 20-40 **Chop / Range** und unter 20 **Compression**, das Band, in dem Kursbewegungen am wenigsten weit gelaufen sind. Ein hoher MSI bedeutet nicht bullish - er bedeutet, dass Trends laufen können. Die Richtung liest du an Trade Bias oder an den einzelnen Signalen ab.
- **Signal Breadth** - wie viele Signale bullish, neutral oder bearish tendieren, mit dem jeweils stärksten auf jeder Seite.
- **Regime Triggers** (Pro) - wie bereit der Markt für einen Regimewechsel ist, abgeleitet aus Volatility Expansion, Range Break Imminence und Market Pressure. Lies die Größe jedes Scores, nicht sein Vorzeichen.
- **Volatilitäts-Monitor** - zwei Anzeigen: **Level** (VIX bzw. VXN für QQQ und NDX) und **Momentum** (ob die Volatilität einbricht, nachlässt, stabil ist, steigt oder sprunghaft ansteigt).

### 6. Positionierung & Flow

- **Call GEX** und **Put GEX** - die gesamte Gamma-Exposition aus Calls bzw. aus Puts.
- **Call Wall (Widerstand)** und **Put Wall (Unterstützung)** - das größte Call-Gamma auf oder über dem Spot und das größte Put-Gamma auf oder unter dem Spot, jeweils mit dem Abstand zum Spot. Sie werden über den heutigen Verfallstermin und die zwei folgenden (0-2DTE) ermittelt; hast du den Chart nur auf 0DTE gefiltert, kann die Leiste Key Levels deshalb einen anderen Strike zeigen.
- **Netto-Flow**, **Netto-Prämie** und **Put/Call-Verhältnis** - für die aktuelle Sitzung: Call-Volumen minus Put-Volumen, Call-Prämie minus Put-Prämie und Put-Volumen geteilt durch Call-Volumen.

Ganz unten auf der Seite stehen der Hinweis, dass die Dealer-Positionierung modelliert und nicht direkt beobachtet wird, und die Uhrzeit der letzten Aktualisierung.

## Wie das Dashboard aktualisiert wird

Alles aktualisiert sich live, ein Neuladen der Seite ist also nicht nötig. Der Preis aktualisiert sich jede Sekunde. Levels und Signale werden etwa einmal pro Minute neu berechnet, und die Seite übernimmt jede neue Berechnung innerhalb weniger Sekunden. Die Volatilitätsanzeigen aktualisieren sich etwa alle 30 Sekunden.

## Vorbörslich, nachbörslich und bei geschlossenem Markt

Die Sitzung, die in der Kopfzeile des Gamma Charts angezeigt wird, sagt dir, aus welcher Sitzung der Preis stammt. Außerhalb der regulären Handelszeit spiegeln Levels und Signale die jüngste Berechnung wider.

## Das Dashboard in 30 Sekunden lesen

Die Disziplin:

1. Lies den Chip **Long γ / Short γ** und wo Spot im Verhältnis zum **Gamma Flip** steht.
2. Lies **Call Wall** und **Put Wall** - das sind deine Levels. Prüfe nahe am Verfall auch den **Pin Strike**.
3. Wirf einen Blick auf die Karte **Trade Bias**.
4. Öffne die **Heutige Einschätzung**, wenn du sie in Worten willst.
5. Entscheide, welche Seite du für den eigentlichen Trade öffnest.

Das war's. Wenn du merkst, dass du hier länger als 30 Sekunden verbringst, hast du aufgehört, dich zu orientieren, und angefangen zu analysieren - geh auf die relevante Signal-Seite.

Du willst dein eigenes Layout? Mit [Mein Dashboard](/my-dashboard) stellst du dir ein Board aus Widgets zusammen, darunter Key Levels, und am Computer kannst du es teilen, um zwei Symbole nebeneinander zu verfolgen.

## Siehe auch

- [Wie Signals von Anfang bis Ende funktionieren](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Das Live Bulletin nutzen](/help/platform/live-bulletin)
- [Pin Strike](/help/platform/pin-strike)
