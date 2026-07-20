# Datenabdeckung & Aktualisierung

*Unterstützte Symbole, Verhalten während der Handelszeiten, wie oft jede Ansicht aktualisiert wird und was rund um Feiertage und verkürzte Handelstage passiert.*

---

## Abgedeckte Symbole

ZeroGEX bietet vollständige analytische Abdeckung für drei Instrumente:

- **SPY** — S&P 500 ETF
- **SPX** — S&P 500 Index (Optionen europäischen Stils)
- **QQQ** — Nasdaq 100 ETF

Dies sind die drei liquidesten und gamma-reichsten Basiswerte im US-Optionsmarkt — die Instrumente, bei denen die Hedging-Aktivität der Dealer den größten Einfluss auf den Intraday-Preis hat.

Wir planen nicht, einzelne Aktien zu unterstützen. Das Signalmodell und das Regime-Konzept sind auf das Dealer-Verhalten auf Indexebene ausgelegt.

## Handelszeiten

ZeroGEX verwendet durchgehend die US-Ostküstenzeit (Eastern Time):

- **Pre-Market** — 4:00 – 9:30 Uhr ET
- **Reguläre Sitzung** — 9:30 – 16:00 Uhr ET
- **After-Hours** — 16:00 – 20:00 Uhr ET (soweit verfügbar)

Das Sitzungs-Badge im Header zeigt an, in welchem Zeitfenster du dich befindest.

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

ZeroGEX nutzt **Optionsdaten aus dem OPRA-Feed** (das konsolidierte Tape für US-Optionen) sowie den Kursfeed des zugrunde liegenden Basiswerts. Beides sind professionelle Echtzeit-Datenquellen.

Wir geben die konkreten Anbieternamen nicht öffentlich bekannt, aber der Qualitätsstandard ist institutionell — dieselben Datenfeeds, die auch von Quant-Desks genutzt werden.

## Latenz

Die End-to-End-Latenz vom Drucken eines Trades auf dem Tape bis zum Erreichen deines Browsers liegt während der regulären Handelszeiten typischerweise unter einer Sekunde. Der Engpass sind selten die Daten — meist sind es dein Netzwerk und dein Browser. Siehe [Streaming & Performance](/help/platform/streaming-and-performance).

## Warum nur SPY / SPX / QQQ

Zwei Gründe:

1. Das Dealer-Positionierungsmodell funktioniert nur dort gut, wo der Dealer-Flow einen bedeutenden Anteil am Gesamt-Flow ausmacht. Das ist der Index-Komplex.
2. Wir setzen lieber auf drei Instrumente, die wir richtig beherrschen, statt auf zehn Instrumente, die wir nur halb beherrschen.

Einzelaktien können durch idiosynkratische Nachrichten driften, was die GEX-Lesart verrauscht. Auf dieses Spiel lassen wir uns nicht ein.

## Siehe auch

- [API-Zugang & Schlüssel (Pro)](/help/platform/api-access)
- [Streaming & Performance](/help/platform/streaming-and-performance)
