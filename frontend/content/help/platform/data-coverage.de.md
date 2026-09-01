# Datenabdeckung & Aktualisierung

*Unterstützte Symbole, Verhalten während der Handelszeiten, wie oft jede Ansicht aktualisiert wird und was rund um Feiertage und verkürzte Handelstage passiert.*

---

## Abgedeckte Symbole

ZeroGEX bietet vollständige analytische Abdeckung für vier Basiswerte im Kassamarkt:

- **SPY** — S&P 500 ETF
- **SPX** — S&P 500 Index (Optionen europäischen Stils)
- **QQQ** — Nasdaq 100 ETF
- **NDX** — Nasdaq 100 Index (Optionen europäischen Stils)

Dies sind die vier liquidesten und gamma-reichsten Basiswerte im US-Optionsmarkt — die Instrumente, bei denen die Hedging-Aktivität der Dealer den größten Einfluss auf den Intraday-Preis hat.

Hinzu kommen zwei CME-Aktienindex-Futures als vollwertige Symbole:

- **ES** — E-mini S&P 500 Future
- **NQ** — E-mini Nasdaq 100 Future

ES und NQ haben kein eigenes Optionsbuch. ES und SPX bilden denselben Index ab, das Dealer-Buch hinter einem ES-Chart *ist* also das SPX-Buch — die SPX-Level (bzw. NDX bei NQ) werden auf die Futures-Preisachse projiziert, während die Preisreihe selbst aus dem CME-Feed stammt. Das Projektionsverhältnis wird am Tape gemessen statt aus Carry modelliert und korrigiert sich dadurch über jeden Quartalsroll selbst; einen Basis-Offset musst du nirgends einstellen. Dollar-Exposures (Netto-, Call- und Put-GEX) bleiben bewusst unprojiziert: Das Histogramm skaliert auf *relatives* Exposure, die Form ist also in beiden Fällen dieselbe. Die Micro-Kontrakte (/MES, /MNQ) sind derselbe Kontrakt in einem Zehntel der Größe — es gelten dieselben Level.

Wir planen nicht, einzelne Aktien zu unterstützen. Das Signalmodell und das Regime-Konzept sind auf das Dealer-Verhalten auf Indexebene ausgelegt.

## Handelszeiten

ZeroGEX verwendet durchgehend die US-Ostküstenzeit (Eastern Time):

- **Pre-Market** — 4:00 – 9:30 Uhr ET
- **Reguläre Sitzung** — 9:30 – 16:00 Uhr ET
- **After-Hours** — 16:00 – 20:00 Uhr ET (soweit verfügbar)

Das Sitzungs-Badge im Header zeigt an, in welchem Zeitfenster du dich befindest.

**ES und NQ laufen stattdessen in der elektronischen CME-Sitzung**, die deutlich weiter reicht: von Sonntag 18:00 Uhr ET durchgehend bis Freitag 17:00 Uhr ET, mit einer täglichen Wartungspause von 17:00 bis 18:00 Uhr ET. Damit sind die asiatische und die europäische Sitzung vollständig abgedeckt, und die ES/NQ-Kurse kommen in Echtzeit von der CME. Ist ein Kassaindex geschlossen, sein Future aber im Handel, zeigt das Sitzungs-Badge „Futures“ und die Preiskachel den Future — mit der Veränderung gegenüber dessen eigenem Schlusskurs um 16:00 Uhr ET — statt des eingefrorenen Kassaindex.

Die Dealer-Level auf einem Futures-Chart stammen weiterhin aus dem Index-Optionsbuch, das während der US-Handelszeiten bepreist wird. Über Nacht siehst du also den live handelnden ES/NQ gegen die Level, wie sie zum US-Schluss standen, aktualisiert sobald nächtliche Chain-Daten veröffentlicht werden (siehe *Pre-Market und After-Hours* weiter unten); sie werden nicht tickweise um 3:00 Uhr ET neu berechnet. Veraltet eine Futures-Quote selbst, trägt der Preis ein Badge mit der gemessenen Verzögerung.

## Aktualisierungsrhythmus nach Ansicht

| Ansicht | Rhythmus |
| --- | --- |
| Preisquote | 1 Sekunde |
| GEX-Übersicht | 5–15 Sekunden |
| GEX Strike/DTE-Heatmap | 5–15 Sekunden |
| Flow / Tape | 1 Sekunde |
| Signal-Scores | 1–5 Sekunden je nach Signal |
| Composite Score | 5 Sekunden |
| Live Bulletin | ereignisgesteuert, in Echtzeit |
| Backtesting-Daten | EOD-Snapshot |

Die Seite muss nicht aktualisiert werden. Alles wird gestreamt.

## Pre-Market und After-Hours

Während der erweiterten Handelszeiten:

- Die Preiskachel zeigt die Quote der erweiterten Handelszeit zusammen mit dem vorherigen Schlusskurs der regulären Sitzung.
- Signal-Scores werden weiterhin aktualisiert, sofern ausreichend Daten vorliegen. Manche Signale (EOD Pressure, 0DTE Position Imbalance) werden bewusst nur während der regulären Sitzung berechnet.
- Die GEX-Oberfläche spiegelt den Schlussstand der regulären Sitzung zuzüglich etwaiger nächtlicher Chain-Updates wider.

## Wenn der Markt geschlossen ist

Wenn der Markt geschlossen ist, zeigt die Plattform für alle Ansichten die zuletzt verfügbaren Schlusswerte der regulären Sitzung. Das Sitzungs-Badge zeigt „Closed" an. Auf den Signal-Seiten werden „zuletzt berechnet"-Zeitstempel angezeigt.

## Feiertage

An ganztägigen Markt-Feiertagen (mit Ausnahme des Silvestervorabends) — keine Live-Daten; die Plattform zeigt die vorherige Sitzung.

An verkürzten Handelstagen (früherer Handelsschluss um 13:00 Uhr ET an manchen Freitagen rund um Feiertage) — die Plattform berücksichtigt den früheren Handelsschluss. Das EOD-Pressure-Fenster passt sich an diesen Tagen einer Rampe ab 11:30 Uhr ET an.

## Historische Tiefe

- **Quotes & Flow** — mehrere Jahre historischer Kursverläufe.
- **Signal-Scores** — zurückgerechnet bis zur Einführung jedes einzelnen Signals.
- **GEX-Oberflächen** — Historie täglicher Snapshots; die Intraday-Historie ist auf das jüngste Zeitfenster begrenzt.

Die Backtesting-Seite zeigt den historischen Zeithorizont für das jeweils ausgewählte Signal.

## Datenquellen

ZeroGEX nutzt professionelle Echtzeit-Marktdaten zu Optionen und Basiswerten unter kommerziellen Lizenzen. Dabei handelt es sich nicht um ein einziges Tape: **SPY- und QQQ-Optionen** werden über OPRA verbreitet (das konsolidierte Tape für US-Optionen), während **SPX, SPXW und NDX** Indexoptionen sind, deren Entitlements separat über die jeweilige Listing-Börse lizenziert werden und die *nicht* auf dem OPRA-Tape laufen. Die Kurse für ES und NQ stammen aus dem Echtzeit-CME-Feed. Das Open Interest ist eine separate Größe vom Ende der Sitzung aus dem Clearing und kein Echtzeitwert. Griechen und alle Dealer-Positionierungs-Kennzahlen berechnet ZeroGEX selbst aus diesen Eingaben — siehe [Methodik & Validierung](/methodology).

Wir geben die konkreten Anbieternamen nicht öffentlich bekannt, aber der Qualitätsstandard ist institutionell — dieselben Datenfeeds, die auch von Quant-Desks genutzt werden.

## Latenz

Die End-to-End-Latenz vom Drucken eines Trades auf dem Tape bis zum Erreichen deines Browsers liegt während der regulären Handelszeiten typischerweise unter einer Sekunde. Der Engpass sind selten die Daten — meist sind es dein Netzwerk und dein Browser. Siehe [Streaming & Performance](/help/platform/streaming-and-performance).

## Warum nur der Index-Komplex

Zwei Gründe:

1. Das Dealer-Positionierungsmodell funktioniert nur dort gut, wo der Dealer-Flow einen bedeutenden Anteil am Gesamt-Flow ausmacht. Das ist der Index-Komplex — SPY, SPX, QQQ, NDX und die Futures ES / NQ, die dieselben beiden Indizes abbilden.
2. Wir setzen lieber auf eine Handvoll Instrumente, die wir richtig beherrschen, statt auf zehn Instrumente, die wir nur halb beherrschen.

Einzelaktien können durch idiosynkratische Nachrichten driften, was die GEX-Lesart verrauscht. Auf dieses Spiel lassen wir uns nicht ein.

## Siehe auch

- [API-Zugang & Schlüssel (Pro)](/help/platform/api-access)
- [Streaming & Performance](/help/platform/streaming-and-performance)
