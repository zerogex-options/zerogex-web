# Datenabdeckung & Aktualisierung

*Unterstützte Symbole, Verhalten während der Handelszeiten, wie oft jede Ansicht aktualisiert wird und was rund um Feiertage und verkürzte Handelstage passiert.*

---

## Abgedeckte Symbole

ZeroGEX bietet vollständige analytische Abdeckung für vier Basiswerte im Kassamarkt:

- **SPY** - S&P 500 ETF
- **SPX** - S&P 500 Index (Optionen europäischen Stils)
- **QQQ** - Nasdaq 100 ETF
- **NDX** - Nasdaq 100 Index (Optionen europäischen Stils)

Dies sind die vier liquidesten und gamma-reichsten Basiswerte im US-Optionsmarkt - die Instrumente, bei denen die Hedging-Aktivität der Dealer den größten Einfluss auf den Intraday-Preis hat.

Hinzu kommen zwei CME-Aktienindex-Futures als vollwertige Symbole:

- **ES** - E-mini S&P 500 Future
- **NQ** - E-mini Nasdaq 100 Future

ES und NQ haben kein eigenes Optionsbuch. ES und SPX bilden denselben Index ab, das Dealer-Buch hinter einem ES-Chart *ist* also das SPX-Buch - die SPX-Level (bzw. NDX bei NQ) werden auf die Futures-Preisachse projiziert, während die Preisreihe selbst aus dem CME-Feed stammt. Die Projektion nutzt den theoretischen Carry des Kontrakts, den wir quotieren (Zinsen abzüglich der Dividendenrendite des Index über die Restlaufzeit bis zu seinem Verfall). Einen Basis-Offset musst du also nirgends einstellen, und bei jedem Quartalsroll wandern die Level zusammen mit dem Preis auf den neuen Kontrakt. Weil Carry den fairen Wert abbildet, können die Level leicht danebenliegen, wenn die Futures über oder unter ihrem fairen Wert handeln, etwa über Nacht oder rund um Nachrichten. Dollar-Exposures (Netto-, Call- und Put-GEX) bleiben bewusst unprojiziert: Das Histogramm skaliert auf *relatives* Exposure, die Form ist also in beiden Fällen dieselbe. Die Micro-Kontrakte (/MES, /MNQ) sind derselbe Kontrakt in einem Zehntel der Größe - es gelten dieselben Level.

Wir planen nicht, einzelne Aktien zu unterstützen. Das Signalmodell und das Regime-Konzept sind auf das Dealer-Verhalten auf Indexebene ausgelegt.

## Handelszeiten

ZeroGEX verwendet durchgehend die US-Ostküstenzeit (Eastern Time):

- **Pre-Market** - 4:00 - 9:30 Uhr ET
- **Reguläre Sitzung** - 9:30 - 16:00 Uhr ET
- **After-Hours** - 16:00 - 20:00 Uhr ET (soweit verfügbar)

Das Sitzungs-Badge im Header zeigt an, in welchem Zeitfenster du dich befindest.

**ES und NQ laufen stattdessen in der elektronischen CME-Sitzung**, die deutlich weiter reicht: von Sonntag 18:00 Uhr ET durchgehend bis Freitag 17:00 Uhr ET, mit einer täglichen Wartungspause von 17:00 bis 18:00 Uhr ET. Damit sind die asiatische und die europäische Sitzung vollständig abgedeckt, und die ES/NQ-Kurse kommen in Echtzeit von der CME. Über Nacht - von 18:00 Uhr ET bis zur Eröffnung um 9:30 Uhr, solange die Futures gehandelt werden - zeigen SPX und NDX statt des eingefrorenen Kassaindex ihren Future: Das Sitzungs-Badge zeigt „Futures", und der Kurs in der Kopfzeile zeigt den Future, mit der Veränderung gegenüber dessen eigenem Kurs um 16:00 Uhr ET.

Die Dealer-Level auf einem Futures-Chart stammen weiterhin aus dem Index-Optionsbuch, das während der US-Handelszeiten bepreist wird. Über Nacht siehst du also den live handelnden ES/NQ gegen die Level, wie sie zum US-Schluss standen, aktualisiert sobald nächtliche Chain-Daten veröffentlicht werden (siehe *Pre-Market und After-Hours* weiter unten); sie werden nicht tickweise um 3:00 Uhr ET neu berechnet. Veraltet eine Futures-Quote selbst, trägt der Preis ein Badge mit der gemessenen Verzögerung.

## Aktualisierungsrhythmus nach Ansicht

| Ansicht | Rhythmus |
| --- | --- |
| Preisquote | Etwa jede Sekunde |
| GEX-Übersicht, Walls, Flip und Max Pain | Etwa einmal pro Minute neu berechnet |
| GEX Strike/DTE-Heatmap | Etwa einmal pro Minute neu berechnet |
| Options-Flow | Fünf-Minuten-Balken |
| Signal-Scores | Etwa einmal pro Minute |
| Gesamtscore | Etwa einmal pro Minute |
| Volatilitätsanzeigen (VIX / VXN) | Fünf-Minuten-Balken |
| Live-Bulletin | Kurs alle 5 Sekunden, Level alle ~10 Sekunden, Volatilität alle ~30 Sekunden |
| Backtesting-Daten | Historische Minutendaten, nicht live |

Die Seite muss nicht aktualisiert werden. Die Seiten fragen alle paar Sekunden nach neuen Zahlen (auf den Signalseiten alle 5 Sekunden), sodass ein neuer Wert wenige Sekunden nach seiner Berechnung erscheint.

Ein Hinweis zu den GEX-Ansichten: "Aktualisierung" bedeutet, dass das Exposure **neu berechnet** wird - nicht, dass das Open Interest tickweise neu abgefragt wird. Das Open Interest börsengehandelter Optionen wird von der Clearingstelle nach der Sitzung ermittelt und für den *nächsten* Handelstag veröffentlicht - es baut sich nicht live im Tagesverlauf auf. Intraday-Veränderungen der GEX-Übersicht und der Heatmap entstehen also durch die Neubewertung des bestehenden Buchs, wenn sich Spot, Zeit und implizite Volatilität bewegen - nicht durch neu bestätigtes Open Interest. Schätzungen des Hedgings, das die heutigen Trades auslösen, sind eine eigene Lesart auf der Seite [Hedging Flow](/help/platform/hedging-flow) - *abgeleitet* aus der Trade-Klassifizierung, nicht aus bestätigtem Open Interest.

## Pre-Market und After-Hours

Während der erweiterten Handelszeiten:

- Die Kopfzeile zeigt den letzten Schlusskurs der regulären Sitzung und seine Veränderung, in einer zweiten Zeile darunter den Live-Kurs der erweiterten Handelszeit und seine Bewegung seit diesem Schluss.
- Signal-Scores werden weiterhin aktualisiert, sofern ausreichend Daten vorliegen. Manche Signale (EOD Pressure, 0DTE Position Imbalance) werden bewusst nur während der regulären Sitzung berechnet.
- Die GEX-Oberfläche spiegelt den Schlussstand der regulären Sitzung zuzüglich etwaiger nächtlicher Chain-Updates wider - einschließlich des abgerechneten Open Interest für die nächste Sitzung, sobald es veröffentlicht wird.

## Wenn der Markt geschlossen ist

Wenn der Markt geschlossen ist, zeigt die Plattform für alle Ansichten die zuletzt verfügbaren Schlusswerte der regulären Sitzung. Das Sitzungs-Badge zeigt „Closed" an.

## Feiertage

An ganztägigen Markt-Feiertagen - keine Live-Daten; die Plattform zeigt die vorherige Sitzung.

An verkürzten Handelstagen (früherer Handelsschluss um 13:00 Uhr ET rund um manche Feiertage) - die Plattform berücksichtigt den früheren Handelsschluss. EOD Pressure behält ihr übliches Fenster von 14:30 bis 16:00 Uhr ET und bleibt an einem verkürzten Handelstag daher inaktiv.

## Historische Tiefe

- **Detaillierte Intraday-Daten** - vollständige Options-Chain-Snapshots, GEX pro Strike und Flow auf Kontraktebene werden für ein rollierendes Fenster von etwa zwei bis drei Monaten aufbewahrt, nicht für Jahre.
- **Schlankere Datenreihen** - Minuten-Kursbalken und die zentrale GEX-Übersicht werden länger aufbewahrt.
- **Backtesting** - basiert auf einem separaten Options-Chain-Archiv. Der Datumsbereich auf der Backtesting-Seite zeigt genau, was für einen Test verfügbar ist.

## Datenquellen

ZeroGEX nutzt professionelle Echtzeit-Marktdaten zu Optionen und Basiswerten unter kommerziellen Lizenzen. Es lohnt sich, genau zu sein, denn es handelt sich nicht um ein einziges Tape:

- **Optionsquotes und -trades** für SPY, QQQ, SPX und NDX stammen von OPRA, dem konsolidierten Tape für börsengehandelte US-Optionen.
- **Die Indexwerte von SPX und NDX** stammen aus einem separaten Index-Feed, nicht aus dem Options-Tape.
- **Die Kurse von SPY und QQQ** stammen aus Nasdaq Basic, einem Echtzeit-Feed von Nasdaq.
- Die Kurse für **ES und NQ** stammen aus dem Echtzeit-CME-Feed.
- Das **Open Interest** ist eine separate Größe vom Ende der Sitzung aus dem Clearing und kein Echtzeitwert.

Griechen und alle Dealer-Positionierungs-Kennzahlen berechnet ZeroGEX selbst aus diesen Eingaben, statt sie fertig von einem Anbieter zu beziehen - siehe [Methodik & Validierung](/methodology). Die konkreten Anbieternamen geben wir nicht öffentlich bekannt.

## Latenz

Während der regulären Handelszeiten erreichen Kurse deinen Browser typischerweise innerhalb weniger Sekunden nach dem Druck auf dem Tape. Die Kennzahlen zur Dealer-Positionierung und die Signale folgen bewusst mit Verzögerung, weil sie in den oben genannten Zyklen neu berechnet werden statt bei jedem Trade. Wirken die Updates langsamer, siehe [Streaming & Performance](/help/platform/streaming-and-performance).

## Warum nur der Index-Komplex

Zwei Gründe:

1. Das Dealer-Positionierungsmodell funktioniert nur dort gut, wo der Dealer-Flow einen bedeutenden Anteil am Gesamt-Flow ausmacht. Das ist der Index-Komplex - SPY, SPX, QQQ, NDX und die Futures ES / NQ, die dieselben beiden Indizes abbilden.
2. Wir setzen lieber auf eine Handvoll Instrumente, die wir richtig beherrschen, statt auf zehn Instrumente, die wir nur halb beherrschen.

Einzelaktien können durch idiosynkratische Nachrichten driften, was die GEX-Lesart verrauscht. Auf dieses Spiel lassen wir uns nicht ein.

## Siehe auch

- [API-Zugang & Schlüssel (Pro)](/help/platform/api-access)
- [Streaming & Performance](/help/platform/streaming-and-performance)
