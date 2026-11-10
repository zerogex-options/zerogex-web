# ZeroGEX vs TradeGEX (2026): Gamma-Levels für Futures, Preise und Abdeckung im Vergleich

*Ein fairer Direktvergleich von ZeroGEX und TradeGEX: wofür jede Plattform gebaut ist, wie ihre Walls und ihr Gamma Flip definiert sind, woher die ES- und NQ-Levels der beiden jeweils stammen, was jede kostet, wo TradeGEX die stärkere Wahl ist und wo ZeroGEX besser passt. Pläne, Preise und Funktionen von TradeGEX stammen von seiner eigenen Website und Academy, geprüft am {{tradegex:checked}}.*

---

## Die Kurzfassung

Beide Plattformen beziehen Gamma-Levels aus dem Optionsmarkt und zeichnen sie in Futures-Charts. Sie unterscheiden sich darin, was sie abdecken, wie sie die Levels bilden und was rund um sie dazukommt.

- **TradeGEX** ist für Futures-Daytrader gebaut. Es zeichnet Echtzeit-Balken für Gamma- und Delta-Exposure, Call Wall und Put Wall, einen Gamma Flip und seinen eigenen Hedge-Flow-Indikator für die Futures ES, NQ, YM, RTY, Gold und Rohöl sowie für sieben große Tech-Aktien, mit nativen Apps für Mac und Windows, einem eingebauten Trade-Simulator und Indikatoren für TradingView, Tradovate, ATAS und NinjaTrader.
- **ZeroGEX** deckt sechs Symbole ab - SPX, SPY, QQQ, NDX sowie die Futures ES und NQ - und geht bei ihnen tiefer: nach Gamma gewichtete Walls, ein Gamma Flip, berechnet aus einem Gamma-Profil über eine Spanne von Preisen, eine Gamma-Heatmap über die Sitzung, Hedging-Flow und vierzehn auf den Levels aufbauende Signale, mit einer veröffentlichten Methode und einer bewerteten Bilanz.

Wenn du den Dow, den Russell, Gold, Rohöl oder die großen Tech-Aktien handelst oder eine Desktop-App mit Trade-Simulator willst, liegt TradeGEX näher an dem, was du brauchst. Wenn du im S&P- und Nasdaq-Komplex Daytrading betreibst und wissen willst, wie jedes Level gebildet wird und wie oft Walls gehalten haben, ist es ZeroGEX.

## Die Levels nebeneinander

Die beiden Plattformen veröffentlichen dieselben Levels, größtenteils unter denselben Namen:

| TradeGEX | ZeroGEX | Was es markiert |
|---|---|---|
| Call Wall | Call Wall | Der schwerste Call-Strike: bei TradeGEX nach Open Interest, bei ZeroGEX nach gammagewichtetem Open Interest |
| Put Wall | Put Wall | Dasselbe auf der Put-Seite |
| Gamma Flip | Gamma Flip | Die Linie zwischen positivem und negativem modelliertem Dealer-Gamma |
| Key Gamma Strike (KGS) | GEX King | Der Strike mit dem meisten Gamma |
| Max Pain | Max Pain | Der Kurs bei Verfall, der den Optionsinhabern den geringsten Gesamtwert lässt |

Bei beiden kannst du wählen, welche Verfälle du liest. Die Verfallsauswahl von TradeGEX bietet 0DTE, wöchentliche oder monatliche Verfälle oder alle Verfälle zusammen. Bei ZeroGEX schränkt der Verfallsfilter im Gamma Chart die Kette auf eine beliebige Auswahl von Verfällen ein, 0DTE eingeschlossen, und die Walls und der Flip folgen ihm.

### Gleiche Namen, unterschiedliche Walls

Die Walls teilen die Namen, aber nicht die Definitionen. Der [Leitfaden zu den Key Levels](https://tradegex.pro/academy/call-wall-put-wall-gamma-flip) von TradeGEX setzt die Call Wall auf den Strike mit dem meisten Call-Open-Interest und die Put Wall auf den Strike mit dem meisten Put-Open-Interest, und seine Leitfäden zum Chart und zum Open Interest sagen dasselbe. (Sein Leitfaden zu den Greeks beschreibt die Walls stattdessen als die dominanten Call- und Put-Gamma-Strikes.) ZeroGEX gewichtet das Open Interest nach Gamma, das bei Optionen nahe dem aktuellen Kurs am höchsten ist, wo das Dealer-Hedging am empfindlichsten auf eine Bewegung reagiert. Die beiden Methoden können auf unterschiedliche Strikes zeigen, wenn ein großer Block Open Interest weit vom Kurs entfernt liegt: In einer reinen Zählung zählt er voll, nach Gamma gewichtet zählt er wenig.

Die beiden beschreiben die Walls auch unterschiedlich. Die Leitfäden von TradeGEX beschreiben die Call Wall als Widerstand und die Put Wall als Unterstützung. ZeroGEX behandelt eine Wall als Konzentration von Gamma und hat gemessen, wie oft Walls tatsächlich gehalten haben: In seiner Studie mit 737 Wall-Tests hielten S&P-Walls innerhalb einer Stunde nach einem Test in etwa zwei von drei Fällen und Nasdaq-Walls in etwa der Hälfte der Fälle, und keines der neunzehn Merkmale, die es an einzelnen Walls gemessen hat, zeigte an, welche brechen würden ([die Studie](/education/how-often-do-gamma-walls-break)).

ZeroGEX modelliert das Dealer-Gamma aus der Optionskette, statt es zu beobachten, berechnet seinen Flip aus einem Gamma-Profil über eine Spanne von Preisen und lässt den Flip leer, wenn die Kette keine verlässliche Kreuzung stützt. Die Methode steht auf seiner Seite [Methodik](/methodology). In seiner Academy nennt TradeGEX seine GEX-Formel - Gamma mal Open Interest mal Kontraktmultiplikator mal Spot-Preis zum Quadrat, Strike für Strike summiert - und beschreibt den Flip als den Preis, an dem diese Summe von positiv zu negativ wechselt.

### Wie oft die Levels aktualisiert werden

Das offizielle Open Interest wird einmal täglich veröffentlicht, nach dem Handelsschluss. Laut seinem [Leitfaden zum Open Interest](https://tradegex.pro/academy/open-interest-analysis) schätzt TradeGEX das Open Interest während der Sitzung aus Volumen und Trades, und laut seiner Website aktualisieren sich seine GEX-Levels alle paar Sekunden. ZeroGEX berechnet seine Levels über die reguläre Handelssitzung hinweg etwa einmal pro Minute neu, in beiden Plänen, auf Basis des veröffentlichten Open Interest, während sich Kurs, Zeit und implizite Volatilität bewegen. Seine Schätzung des Hedgings, das die Trades des Tages implizieren, ist eine separate Lesart, auf der Seite [Hedging Flow](/education/hedging-flow-explained). Wenn du an den Levels scalpst, ist eine Aktualisierung alle paar Sekunden eine Überlegung wert.

### Woher die ES- und NQ-Levels stammen

Für ES und NQ liest keine der beiden Plattformen die Optionen auf die Futures selbst. Beide bilden die Levels aus den Optionen auf den Index oder ETF, den der jeweilige Future abbildet, und übertragen sie auf den Futures-Preis. Bei TradeGEX kannst du die Optionsquelle hinter den GEX-Balken wählen - einen ETF wie SPY, QQQ oder IWM oder einen Index wie SPX, NDX oder RUT - und seine [Academy](https://tradegex.pro/academy/etf-options-futures-correlation) sagt, dass das Umrechnungsverhältnis mit Dividenden und Cost of Carry variiert. ZeroGEX bildet ES-Levels aus der SPX-Kette und NQ-Levels aus der NDX-Kette und projiziert sie auf den Futures-Kontrakt, den es quotiert, wobei es den Cost of Carry dieses Kontrakts verwendet ([so funktioniert es](/help/platform/futures-contract-months)).

## Preise

Listenpreise vor Rabattaktionen und Steuern, geprüft am {{tradegex:checked}}. TradeGEX verkauft einen Plan mit vollem Plattformzugang, monatlich, alle sechs Monate ({{tradegex:platform:sixMonths}}) oder jährlich abgerechnet. Die Preise von ZeroGEX sind die, die heute auf seiner Seite [Preise](/pricing) stehen.

| Plan | Monatliche Abrechnung | Jährliche Abrechnung |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/Monat | {{zgx:basic:annual}}/Jahr (etwa {{zgx:basic:annual:mo}}/Monat) |
| ZeroGEX Pro, mit API-Zugang | {{zgx:pro:monthly}}/Monat | {{zgx:pro:annual}}/Jahr (etwa {{zgx:pro:annual:mo}}/Monat) |
| TradeGEX | {{tradegex:platform:monthly}}/Monat | {{tradegex:platform:annual}}/Jahr (etwa {{tradegex:platform:annual:mo}}/Monat) |

Bei monatlicher Abrechnung kostet ZeroGEX Basic weniger als TradeGEX, und ZeroGEX Pro kostet etwa gleich viel. Bei jährlicher Abrechnung kostet ZeroGEX Pro etwa halb so viel wie TradeGEX - genauso viel wie der Sechsmonatsplan von TradeGEX - und enthält API-Zugang. Für diese Preise bekommst du allerdings Unterschiedliches: Bei TradeGEX sind es mehr Märkte, Desktop-Apps und ein Trade-Simulator, bei ZeroGEX sechs Symbole in der Tiefe.

Auch Testphasen und Erstattungen unterscheiden sich. ZeroGEX Basic monatlich beginnt mit einer 7-tägigen kostenlosen Testphase, in der bis zu ihrem Ende nichts abgebucht wird, und jeder andere ZeroGEX-Plan ist durch eine 7-Tage-Geld-zurück-Garantie abgesichert. TradeGEX bietet eine 3-tägige kostenlose Testphase, die eine Handynummer, aber keine Karte erfordert und nicht von selbst in einen bezahlten Plan übergeht, und laut seinen Bedingungen werden Erstattungen nur unter außergewöhnlichen Umständen gewährt.

## Wo TradeGEX die stärkere Wahl ist

- **Mehr Märkte.** Die Futures ES, NQ, YM (Dow), RTY (Russell 2000), Gold und Rohöl, dazu NVDA, TSLA, AAPL, MSFT, AMZN, META und GOOGL. ZeroGEX deckt sechs Symbole ab.
- **Schnellere Aktualisierung.** Laut TradeGEX aktualisieren sich seine GEX-Levels alle paar Sekunden. ZeroGEX berechnet seine Levels etwa einmal pro Minute neu.
- **Desktop-Apps und ein Trade-Simulator.** Native Apps für Mac und Windows (Windows in der Beta) und ein eingebauter Simulator, um Futures-Trades zu Live-Kursen zu üben, mit Bracket-Orders und Performance-Statistiken. ZeroGEX läuft im Browser und hat keinen Simulator, um eigene Trades zu üben.
- **Tradovate und ATAS.** TradeGEX zeichnet seine Levels in das Web-Chart von Tradovate und in ATAS, außerdem in TradingView und NinjaTrader. ZeroGEX funktioniert mit TradingView, thinkorswim, NinjaTrader, Sierra Chart und Bookmap.
- **Delta-Exposure und ein marktübergreifender Oszillator.** Balken für Delta-Exposure, der Hedge-Flow-Indikator, ein Oszillator, der ES, NQ, den VIX und Options-Flow kombiniert, eine VIX-Linie im Kurschart, eine Dual-Chart-Ansicht und ein wöchentlicher Commitments-of-Traders-Report für ES und NQ. ZeroGEX lässt rohe Delta-Exposure bewusst weg: [warum ZeroGEX kein DEX veröffentlicht](/education/why-we-dont-publish-dex).

## Wo ZeroGEX die stärkere Wahl ist

- **Nach Gamma gewichtete Walls.** Open Interest, gezählt danach, wie viel Hedging es nahe am Kurs trägt, und nicht allein nach der Zahl der Kontrakte, wie es der Leitfaden zu den Key Levels von TradeGEX für seine Walls beschreibt.
- **Eine veröffentlichte Methode und eine bewertete Bilanz.** Die Seite [Methodik](/methodology) legt dar, wie die Levels berechnet werden, der [Track Record](/track-record) bewertet jede Prognose, die ZeroGEX veröffentlicht, Fehlprognosen eingeschlossen, und die [Wall-Studie](/education/how-often-do-gamma-walls-break) veröffentlicht, wie oft Walls tatsächlich gebrochen sind.
- **Tiefe im S&P- und Nasdaq-Komplex.** Eine Gamma-Heatmap über die Sitzung, Gamma nach Verfall, Vanna- und Charm-Flow, Hedging-Flow, Forced Flow und vierzehn auf den Levels aufbauende Signale, deren Methoden im [Leitfaden zu den Signalen](/guides/signals-explained) dargelegt sind. Laut seiner Academy hat TradeGEX keine einzelne Vanna- oder Charm-Linie; diese Effekte liest du an seiner VIX-Linie, seiner Verfallsauswahl und den Levels ab.
- **API-Zugang und ein MCP-Server.** ZeroGEX Pro enthält API-Schlüssel für dieselben Daten, und der kostenlose [MCP-Server](/education/gamma-levels-in-claude) bringt die verzögerten Levels in KI-Assistenten wie Claude und ChatGPT. Der Plan von TradeGEX führt keine API auf.
- **Preis bei jährlicher Abrechnung.** ZeroGEX Pro kostet etwa die Hälfte des Jahrespreises von TradeGEX, API inklusive.
- **Eine kostenlose Möglichkeit, vorher zu prüfen.** Die Seiten [ES-Gamma-Levels](/es-gamma-levels) und [NQ-Gamma-Levels](/nq-gamma-levels), etwa 15 Minuten verzögert, brauchen keine Registrierung.

## So entscheidest du

- **Du handelst YM, RTY, Gold, Rohöl oder einzelne Tech-Aktien:** TradeGEX.
- **Du willst eine Desktop-App, einen eingebauten Trade-Simulator oder deine Levels in Tradovate oder ATAS:** TradeGEX.
- **Du betreibst Daytrading mit ES, NQ, SPX, SPY, QQQ oder NDX und willst wissen, wie jedes Level gebildet wird und wie oft Walls gehalten haben:** ZeroGEX.
- **Du bist noch unsicher:** Öffne die kostenlose Seite [ES-Gamma-Levels](/es-gamma-levels), ohne Registrierung, und vergleiche sie mit den Levels, die du heute nutzt.

---

Pläne, Preise und Funktionen von TradeGEX stammen von [tradegex.pro](https://tradegex.pro) und seiner Academy, geprüft am {{tradegex:checked}}, und können sich jederzeit ändern, prüfe sie also dort. Die ZeroGEX-Preise auf dieser Seite werden aus der aktuellen Preisliste von ZeroGEX übernommen. ZeroGEX steht in keiner Verbindung zu TradeGEX. Nur zu Bildungszwecken, keine Handelsempfehlung.
