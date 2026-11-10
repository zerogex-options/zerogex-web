# ZeroGEX vs Quant Data (2026): GEX-Karten, Preise und Abdeckung im Vergleich

*Ein fairer Direktvergleich von ZeroGEX und Quant Data (quantdata.us): wofür jede Plattform gebaut ist, wie sich die Interval Map von Quant Data und die GEX Heatmap von ZeroGEX zueinander verhalten, was die APIs kosten, wo Quant Data die stärkere Wahl ist und wo ein spezialisiertes Tool für Index-Levels besser passt. Die Angaben zu Quant Data stammen von seiner eigenen Website, seinem Hilfe-Center und seinen App-Store-Einträgen, geprüft am {{quantdata:checked}}.*

---

## Die Kurzfassung

- **Quant Data** ist um Options-Order-Flow in Echtzeit herum gebaut, mit Dark- und Lit-Pool-Prints, News, Alerts sowie Apps für iOS und Android. Seine Exposure-Tools, darunter die Interval Map, decken jede US-Aktie und jeden Index mit gelisteten Optionen ab.
- **ZeroGEX** ist um eine einzige Aufgabe herum gebaut: modellierte Dealer-Positionierung - der Gamma Flip, die Call Wall und die Put Wall und die darauf aufbauenden Signale - für sechs Symbole: SPX, SPY, QQQ, NDX sowie die Futures ES und NQ.

Wenn deine Trades vom Order-Flow im gesamten Markt ausgehen, liegt Quant Data näher an dem, was du brauchst. Wenn du im Index-Komplex Daytrading betreibst und seine Levels in der Tiefe willst, ist es ZeroGEX.

## Die Interval Map und die GEX Heatmap

Die bekannteste Ansicht von Quant Data ist die Interval Map: Strikes an der Seite, die Sitzung quer, und eine Blase pro Strike und Intervall, deren Größe sich nach dem Exposure richtet, grün für positiv und rot für negativ eingefärbt, mit dem Kurs des Basiswerts mittendurch gezeichnet. Sie kann Gamma-, Delta-, Vanna- oder Charm-Exposure zeigen, in Intervallen ab einer Minute, als Rohwerte oder als Veränderung von einem Intervall zum nächsten.

Die ähnlichste Ansicht bei ZeroGEX ist die GEX Heatmap, die in Basic enthalten ist: Netto-Dealer-Gamma je Strike über die Sitzung, orange für positiv und violett für negativ (bei hellen Themes blau), mit den Kurskerzen und dem Gamma Flip darüber ([so liest du sie](/help/platform/reading-charts)). Ihre Dots-Ansicht legt dieselben Zahlen so aus, wie es die Interval Map tut: ein Punkt pro Strike und Intervall, dessen Größe sich nach dem Gamma dort richtet, grün für positiv und rot für negativ, für 10, 20 oder 40 Strikes um den Kurs, mit dem Kurs mittendurch gezeichnet. Auf der Seite Dealer Positioning stellt eine zweite Heatmap die Strikes den Tagen bis zum Verfall gegenüber, bis zu einer Woche hinaus, sodass du sehen kannst, welche Verfälle an jedem Strike das Gamma tragen.

Die Unterschiede gehen in beide Richtungen:

- **Mehr Exposures und Ticker bei Quant Data.** ZeroGEX bildet nur Gamma ab, für sechs Symbole. Vanna und Charm liest es als Signal statt als Karte, und Delta-Exposure veröffentlicht es bewusst nicht: [warum ZeroGEX kein DEX veröffentlicht](/education/why-we-dont-publish-dex).
- **Die Regimelinie bei ZeroGEX.** Der Gamma Flip ist direkt in die Heatmap gezeichnet, berechnet aus einem Gamma-Profil über eine Spanne von Preisen, sodass Kurs, Strikes und Regimelinie in einem Bild liegen. Die Methode steht auf der Seite [Methodik](/methodology).

Beide Tools modellieren das Dealer-Gamma im Grundsatz auf dieselbe Weise: aus der Optionskette, wobei Calls als positiv und Puts als negativ gezählt werden. Das Hilfe-Center von Quant Data beschreibt seine Werte als Schätzung, nicht als direkten Blick in den Bestand irgendeines Dealers, und ZeroGEX sagt dasselbe.

### Einen Strike lesen, der sich im Tagesverlauf „aufbaut“

Open Interest wird einmal täglich veröffentlicht, nach dem Handelsschluss. Auf einer daraus gebauten Gamma-Karte ändert sich die Farbe eines Strikes während der Sitzung, weil seine Optionen neu bewertet werden, wenn sich Kurs, Zeit und implizite Volatilität bewegen, und nicht, weil Dealer neue Positionen eröffnet haben. Nahe am Verfall steigt das Gamma am Geld, während die Zeit abläuft, sodass ein 0DTE-Strike direkt am Kurs im Tagesverlauf kräftiger werden kann, ganz ohne neue Positionen. Lies eine wachsende Blase oder ein wachsendes Band als „dieser Strike wird wichtiger, je weiter die Uhr läuft“, und lies den Flow separat. Bei ZeroGEX ist das die Seite Hedging Flow, die den Hedge schätzt, den die heutigen Trades implizieren ([so funktioniert es](/education/hedging-flow-explained)).

## Preise

Listenpreise vor Rabattaktionen und Steuern, geprüft am {{quantdata:checked}}. Der Plattform-Plan von Quant Data, der das Web-Dashboard und die Apps für iOS und Android umfasst, kostet {{quantdata:platform:monthly}} im Monat oder {{quantdata:platform:annual}} im Jahr, jeweils mit einer 7-tägigen kostenlosen Testphase. Beide Preise gelten für nicht professionelle Trader; registrierte Profis werden an einen separaten Professional-Plan verwiesen. Die API ist wiederum ein eigener Plan. Die Preise von ZeroGEX sind die, die heute auf seiner Seite [Preise](/pricing) stehen.

| Plan | Monatliche Abrechnung | Jährliche Abrechnung |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/Monat | {{zgx:basic:annual}}/Jahr (etwa {{zgx:basic:annual:mo}}/Monat) |
| ZeroGEX Pro, mit API-Zugang | {{zgx:pro:monthly}}/Monat | {{zgx:pro:annual}}/Jahr (etwa {{zgx:pro:annual:mo}}/Monat) |
| Quant Data, nicht professionell | {{quantdata:platform:monthly}}/Monat | {{quantdata:platform:annual}}/Jahr (etwa {{quantdata:platform:annual:mo}}/Monat) |
| Quant Data, API-Plan | {{quantdata:api:monthly}}/Monat | {{quantdata:api:annual}}/Jahr (etwa {{quantdata:api:annual:mo}}/Monat) |

Beide ZeroGEX-Pläne kosten weniger als der Plattform-Plan von Quant Data, ob monatlich oder jährlich, und ZeroGEX Pro enthält den API-Zugang, den Quant Data als separaten Plan verkauft. Für diese Preise bekommst du allerdings Unterschiedliches: Bei Quant Data sind es Order-Flow, Dark-Pool-Prints, News und Exposure-Karten für 6.000+ Ticker, bei ZeroGEX sechs Symbole in der Tiefe.

Auch die beiden APIs sind nicht gleich groß. Die von Quant Data umfasst 30+ Endpunkte für 6.000+ Ticker, darunter Dark-Pool-Prints und Oberflächen der impliziten Volatilität, mit einem Jahr Historie und einem gehosteten MCP-Server. Die von ZeroGEX deckt die sechs Symbole ab, die es verfolgt: Levels, GEX, Flow, Signale und deren Historie.

ZeroGEX Basic monatlich beginnt mit einer 7-tägigen kostenlosen Testphase, und jeder andere ZeroGEX-Plan ist durch eine 7-Tage-Geld-zurück-Garantie abgesichert. Die vollständige Aufstellung findest du auf der Seite [Preise](/pricing).

## Wo Quant Data die stärkere Wahl ist

- **Breite.** Order-Flow und Exposure-Karten für jede US-Aktie und jeden Index mit gelisteten Optionen. ZeroGEX deckt sechs Symbole ab.
- **Order-Flow, Dark-Pool-Prints und News in einem Feed.** Das ist der Kern von Quant Data. ZeroGEX hat keine Dark-Pool-Daten und keinen News-Feed, und seine Flow-Seiten decken nur den Index-Komplex ab.
- **Mehr Exposure-Arten auf der Karte.** Delta, Vanna und Charm neben Gamma, in Intervallen deiner Wahl.
- **Mobil-Apps und Push-Alerts.** Quant Data hat native Apps für iOS und Android mit Push-Benachrichtigungen. ZeroGEX läuft im Browser, auf dem Desktop oder dem Smartphone, und seine Signal-Trigger erscheinen in der App.
- **Eine größere API.** 30+ Endpunkte, ein Jahr Historie und Dark-Pool-Daten, um eigene Tools für viele Ticker zu bauen.
- **Support rund um die Uhr.** Die Pläne von Quant Data führen 24/7-Live-Chat-Support auf. Der Support von ZeroGEX läuft per E-Mail.

## Wo ZeroGEX die stärkere Wahl ist

- **Tiefe im Index-Komplex.** Alles, was ZeroGEX baut, zielt auf SPX, SPY, QQQ, NDX, ES und NQ: der Gamma Flip, die Walls, Gamma nach Verfall, Vanna- und Charm-Flow, Hedging-Flow und vierzehn auf den Levels aufbauende Signale, deren Methoden im [Leitfaden zu den Signalen](/guides/signals-explained) dargelegt sind.
- **Die Regimelinie in jedem Chart.** Der Gamma Flip ist in die GEX Heatmap und die Kurscharts gezeichnet: das Level, an dem das modellierte Dealer-Hedging tendenziell aufhört, Bewegungen zu dämpfen, und beginnt, sie zu verlängern.
- **Eine veröffentlichte Methode und eine bewertete Bilanz.** ZeroGEX dokumentiert auf seiner Seite [Methodik](/methodology), wie es den Gamma Flip berechnet, und bewertet jede Prognose, die es veröffentlicht, Fehlprognosen eingeschlossen, auf seiner Seite [Track Record](/track-record).
- **Levels dort, wo du ohnehin chartest.** Kostenlose Skripte für TradingView und thinkorswim sowie Indikatoren für NinjaTrader, Sierra Chart und Bookmap, die sich mit Pro selbst aktualisieren. Siehe [Integrationen](/integrations).
- **Ein niedrigerer Preis, API inklusive.** Beide ZeroGEX-Pläne kosten weniger als der Plattform-Plan von Quant Data, und API-Zugang ist in Pro enthalten statt in einem separaten Plan.
- **Eine kostenlose Möglichkeit, vorher zu prüfen.** Die Seite [SPX-Gamma-Levels](/spx-gamma-levels) und ihre Schwesterseiten brauchen keine Registrierung, und der [MCP-Server](/education/gamma-levels-in-claude), der dieselben Levels in KI-Assistenten bringt, auch nicht.

## So entscheidest du

- **Du handelst Einzelaktien auf Basis von Order-Flow oder willst Dark-Pool-Prints und News in einem Feed:** Quant Data.
- **Du willst Delta-, Vanna- und Charm-Karten für viele Ticker:** Quant Data.
- **Du betreibst Daytrading mit SPX, SPY, QQQ, NDX, ES oder NQ und willst den Flip, die Walls und Signale zur Dealer-Positionierung in der Tiefe:** ZeroGEX.
- **Du bist noch unsicher:** Öffne die kostenlose Seite [SPX-Gamma-Levels](/spx-gamma-levels), ohne Registrierung, und vergleiche sie mit dem, was du heute nutzt.

---

Funktionen und Preise von Quant Data stammen von [quantdata.us](https://quantdata.us) und seinem [Hilfe-Center](https://help.quantdata.us/en/), geprüft am {{quantdata:checked}}, und können sich jederzeit ändern, prüfe sie also dort. Die ZeroGEX-Preise auf dieser Seite werden aus der aktuellen Preisliste von ZeroGEX übernommen. ZeroGEX steht in keiner Verbindung zu Quant Data. Nur zu Bildungszwecken, keine Handelsempfehlung.
