# ZeroGEX vs SpotGamma (2026): Gamma-Levels, Preise und kostenlose Tools im Vergleich

*Ein fairer Direktvergleich von ZeroGEX und SpotGamma: wofür jeder Dienst gebaut ist, wie sich ihre Key Levels einander zuordnen lassen, wie oft jeder von beiden aktualisiert wird, was jeder Plan kostet, was du kostenlos sehen kannst, wo SpotGamma die stärkere Wahl ist und wo ZeroGEX besser passt. Pläne, Preise und Funktionen von SpotGamma stammen von seiner eigenen Website und seinen Checkout-Seiten, geprüft am {{spotgamma:checked}}.*

---

## Die Kurzfassung

SpotGamma und ZeroGEX veröffentlichen beide aus Optionen abgeleitete Key Levels: die Call Wall und die Put Wall, an denen sich Gamma konzentriert, und den Preis, an dem das modellierte Dealer-Gamma die Nulllinie kreuzt. Sie unterscheiden sich darin, was rund um diese Levels dazukommt und wie oft sie sich bewegen.

- **SpotGamma** ist ebenso sehr ein Research-Dienst wie ein Daten-Tool. Jeder Plan erhält an jedem Handelstag vor der Eröffnung und nach dem Schluss die Founder's Note, Key Levels für die großen US-Indizes und tägliche GEX-Levels für mehr als 3.500 Aktien, Indizes und ETFs. Laut seiner Startseite liegen seine Echtzeit-Tools, etwa TRACE (eine S&P-500-Heatmap) und HIRO (sein Echtzeit-Hedging-Indikator), im höheren Plan.
- **ZeroGEX** deckt sechs Symbole ab - SPX, SPY, QQQ, NDX sowie die Futures ES und NQ - und geht bei ihnen tiefer: Levels, die in beiden Plänen über die Sitzung hinweg etwa einmal pro Minute neu berechnet werden, eine Gamma-Heatmap, Hedging-Flow und vierzehn auf den Levels aufbauende Signale, mit einer veröffentlichten Methode und einer bewerteten Bilanz.

Wenn du eine tägliche Research-Note, Einzelaktien-GEX für Tausende Titel oder die eigenen proprietären Levels von SpotGamma willst, liegt SpotGamma näher an dem, was du brauchst. Wenn du im Index-Komplex Daytrading betreibst und seine Levels für weniger Geld im Verlauf der Sitzung in Bewegung sehen willst, ist es ZeroGEX.

## Die Levels nebeneinander

| SpotGamma | ZeroGEX | Was es markiert |
|---|---|---|
| Call Wall | Call Wall | Der Strike mit der größten Konzentration von Call-Gamma |
| Put Wall | Put Wall | Dasselbe auf der Put-Seite |
| Zero Gamma | Gamma Flip | Der Preis, an dem das modellierte Dealer-Gamma die Nulllinie kreuzt |
| Volatility Trigger | Kein Gegenstück | Ein proprietäres Level von SpotGamma |
| Risk Pivot | Kein Gegenstück | Ein proprietäres Level von SpotGamma |

Die Walls sind gleich definiert. SpotGammas [Erklärung zur Call Wall](https://spotgamma.com/call-wall-put-wall-explained/) beschreibt die Call Wall als den Strike mit der größten Konzentration von Call-Gamma und die Put Wall als ihr Gegenstück auf der Put-Seite. ZeroGEX definiert sie fast genauso: als den Strike oberhalb des Spots mit der stärksten Call-Gamma-Exposure und den Strike unterhalb des Spots mit der stärksten Put-Gamma-Exposure. Beide behandeln eine Wall als Referenz und nicht als harte Ober- oder Untergrenze. ZeroGEX hat gemessen, wie oft Walls tatsächlich gehalten haben: In seiner Studie mit 737 Wall-Tests hielten S&P-Walls innerhalb einer Stunde nach einem Test in etwa zwei von drei Fällen und Nasdaq-Walls in etwa der Hälfte der Fälle ([die Studie](/education/how-often-do-gamma-walls-break)).

Zero Gamma und der Gamma Flip werden im Prinzip auf dieselbe Weise gebildet. SpotGammas [GEX-Leitfaden](https://spotgamma.com/gamma-exposure-gex/) beschreibt, wie das Options-Gamma über eine Spanne hypothetischer Spot-Preise neu berechnet und der Nulldurchgang bestimmt wird. ZeroGEX berechnet seinen Flip ebenfalls aus einem Gamma-Profil über eine Spanne von Preisen und lässt den Flip leer, wenn die Kette keine verlässliche Kreuzung stützt. Die Methode steht auf seiner Seite [Methodik](/methodology).

SpotGamma veröffentlicht außerdem zwei eigene Levels. Den Volatility Trigger beschreibt SpotGamma als proprietäres Level, das aus seiner geschätzten Gamma-Verteilung abgeleitet ist und nicht aus einem Nulldurchgang, und ein älterer Beitrag von SpotGamma selbst nennt ihn das letzte bedeutende Level der Unterstützung durch positives Gamma, das mehrere Punkte über Zero Gamma liegen kann. Den Risk Pivot beschreibt SpotGamma als Szenario-Level, das umreißt, wo die Marktstruktur stützender oder weniger stützend werden kann; die geprüften Seiten sagen nicht, wie er berechnet wird. Das Level von ZeroGEX, das beiden am nächsten kommt, ist der Gamma Flip. ZeroGEX ergänzt eigene Levels: GEX King, den Strike mit dem meisten Gamma, und den Pin Strike, den nahe gelegenen 0DTE-Strike, an dem positives Dealer-Gamma und die Wahrscheinlichkeit, dass der Preis ihn erreicht, am stärksten zusammenkommen.

### Wie Dealer-Positionen modelliert werden

Keiner der beiden Dienste sieht den Dealer-Bestand direkt. ZeroGEX modelliert ihn aus dem Open Interest nach der Standardkonvention, dass Dealer Calls long und Puts short halten. Das kostenlose Gamma-Chart von SpotGamma verwendet dieselbe Standardkonvention, und laut SpotGamma schätzt sein kostenpflichtiges Modell, SGOI, die Positionierung von Market Makern und Käuferseite Strike für Strike. Unterschiedliche Modelle können die Walls am selben Tag an unterschiedliche Strikes legen, rechne also damit, dass die Levels der beiden Dienste zeitweise voneinander abweichen.

### Wie oft die Levels aktualisiert werden

Die Founder's Note von SpotGamma mit den Levels für die großen US-Indizes wird an jedem Handelstag vor der Eröffnung und nach dem Schluss in jedem Plan geliefert, und die Equity-Hub-Levels für einzelne Aktien werden jeden Tag vor der Eröffnung aktualisiert. Der FAQ-Bereich auf seiner Startseite ordnet HIRO, TRACE und sein Volatility Dashboard dem Alpha-Plan zu, einige seiner anderen Seiten führen sie jedoch in jedem Plan auf; kläre also mit SpotGamma, welcher Plan enthält, was du brauchst.

ZeroGEX berechnet seine Levels über die reguläre Handelssitzung hinweg etwa einmal pro Minute neu, in beiden Plänen, und seine kostenlosen Seiten zeigen dieselben Levels mit etwa 15 Minuten Verzögerung.

## Preise

Listenpreise vor Rabattaktionen und Steuern, so wie die Checkout-Formulare von SpotGamma sie am {{spotgamma:checked}} berechnet haben. Die Preisseite von SpotGamma zeigte zudem Angebote für den ersten Monat, die seine Checkout-Formulare an diesem Tag nicht anwendeten, prüfe also auf seiner Website das aktuelle Angebot. SpotGamma verkauft außerdem einen Institutional-Plan, der hier nicht verglichen wird. Die Preise von ZeroGEX sind die, die heute auf seiner Seite [Preise](/pricing) stehen.

| Plan | Monatliche Abrechnung | Jährliche Abrechnung |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/Monat | {{zgx:basic:annual}}/Jahr (etwa {{zgx:basic:annual:mo}}/Monat) |
| ZeroGEX Pro, mit API-Zugang | {{zgx:pro:monthly}}/Monat | {{zgx:pro:annual}}/Jahr (etwa {{zgx:pro:annual:mo}}/Monat) |
| SpotGamma Essential | {{spotgamma:essential:monthly}}/Monat | {{spotgamma:essential:annual}}/Jahr (etwa {{spotgamma:essential:annual:mo}}/Monat) |
| SpotGamma Alpha | {{spotgamma:alpha:monthly}}/Monat | {{spotgamma:alpha:annual}}/Jahr (etwa {{spotgamma:alpha:annual:mo}}/Monat) |

Beide ZeroGEX-Pläne kosten weniger als jeder der beiden SpotGamma-Pläne, ob monatlich oder jährlich, und ein Jahr ZeroGEX Pro kostet genauso viel wie ein Monat SpotGamma Alpha. Für diese Preise bekommst du allerdings Unterschiedliches: Bei SpotGamma sind es Tausende Aktien, eine zweimal täglich erscheinende Research-Note, Webinare und bei Alpha die Echtzeit-Tools; bei ZeroGEX sind es sechs Symbole in der Tiefe, mit Levels, die sich in beiden Plänen über die Sitzung bewegen.

Auch Testphasen und Erstattungen unterscheiden sich. ZeroGEX Basic monatlich beginnt mit einer 7-tägigen kostenlosen Testphase, in der bis zu ihrem Ende nichts abgebucht wird, und jeder andere ZeroGEX-Plan ist durch eine 7-Tage-Geld-zurück-Garantie abgesichert. Die Preisseite von SpotGamma nennt für seine bezahlten Pläne keine kostenlose Testphase; separat bietet SpotGamma eine kostenlose Woche seines täglichen Reports Opening Setup an, ohne dass eine Karte nötig ist. Laut seinen Bedingungen sind Abonnementzahlungen nicht erstattungsfähig, sofern nicht anders angegeben.

## Was du kostenlos sehen kannst

- **SpotGamma** veröffentlicht ein kostenloses [SPX-Gamma-Exposure-Chart](https://spotgamma.com/free-tools/spx-gamma-exposure/), das laut SpotGamma täglich aktualisiert wird, dazu einen Options-Gewinnrechner und ein Implied-Earnings-Chart.
- **ZeroGEX** veröffentlicht Gamma Flip, Call Wall, Put Wall und Net GEX für alle sechs seiner Symbole, etwa 15 Minuten verzögert und über die Sitzung hinweg aktualisiert, ohne Registrierung: alle Symbole auf einer Seite unter [GEX-Levels heute](/gex-levels) und eine Seite pro Symbol, etwa [SPX-Gamma-Levels](/spx-gamma-levels). Das [Gamma Terminal](/chart) zeigt kostenlos ein verzögertes SPY-Gamma-Chart, und der [MCP-Server](/education/gamma-levels-in-claude) bringt die verzögerten Levels in KI-Assistenten wie Claude und ChatGPT.

## Wo SpotGamma die stärkere Wahl ist

- **Research und Kommentare.** Die Founder's Note an jedem Handelstag vor der Eröffnung und nach dem Schluss, in jedem Plan, dazu wöchentliche Live-Webinare, eine Discord-Community und bei Alpha tägliche Live-Trainings. ZeroGEX hat Bildungsartikel und ein Hilfe-Center, aber keine tägliche Note.
- **Breite.** Tägliche GEX-Levels für mehr als 3.500 US-Aktien, -Indizes und -ETFs im Equity Hub und bei Alpha HIRO für mehr als 3.000 Aktien. ZeroGEX deckt sechs Symbole ab.
- **Eigenes Positionierungsmodell und eigene Levels.** SGOI, seine Schätzung der Positionierung von Market Makern und Käuferseite, sowie Volatility Trigger und Risk Pivot. ZeroGEX verwendet die Standardkonvention und veröffentlicht für keines der beiden Levels ein Gegenstück.
- **Mehr Plattformen.** SpotGamma nennt Integrationen mit TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap, TrendSpider, Jigsaw, eSignal und EdgePro. ZeroGEX funktioniert mit sechs: TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap und SabrTrader.

## Wo ZeroGEX die stärkere Wahl ist

- **Preis.** Beide ZeroGEX-Pläne kosten weniger als jeder der beiden SpotGamma-Pläne, und ZeroGEX Pro enthält API-Zugang. In den Leistungsübersichten der SpotGamma-Pläne Essential und Alpha ist keine API aufgeführt.
- **Levels, die sich in beiden Plänen über die Sitzung bewegen.** Etwa einmal pro Minute, in Basic wie in Pro. Die Seiten von SpotGamma beschreiben Levels, die jeden Tag vor der Eröffnung aktualisiert werden, und laut seiner Startseite liegen seine Echtzeit-Tools in Alpha.
- **ES und NQ auf dem Futures-Preis.** ZeroGEX bildet ES-Levels aus der SPX-Kette und NQ-Levels aus der NDX-Kette und projiziert sie auf den Futures-Kontrakt, den es quotiert ([so funktioniert es](/help/platform/futures-contract-months)), kostenlos und verzögert unter [ES-Gamma-Levels](/es-gamma-levels) und [NQ-Gamma-Levels](/nq-gamma-levels). Laut der Website von SpotGamma lassen sich seine Levels in Futures-Plattformen integrieren, doch die geprüften Seiten sagen nicht, dass SpotGamma Levels auf dem Futures-Preis veröffentlicht.
- **Mehr kostenlos.** Die Levels aller sechs Symbole, verzögert und über die Sitzung hinweg aktualisiert, gegenüber dem täglichen SPX-Chart von SpotGamma.
- **Eine veröffentlichte Methode und eine bewertete Bilanz.** Die Seite [Methodik](/methodology) legt dar, wie die Levels berechnet werden, der [Track Record](/track-record) bewertet jede Prognose, die ZeroGEX veröffentlicht, Fehlprognosen eingeschlossen, und die [Wall-Studie](/education/how-often-do-gamma-walls-break) veröffentlicht, wie oft Walls tatsächlich gebrochen sind.
- **Tiefe im Index-Komplex.** Eine Gamma-Heatmap über die Sitzung, Gamma nach Verfall, Vanna- und Charm-Flow, Hedging-Flow und vierzehn auf den Levels aufbauende Signale, deren Methoden im [Leitfaden zu den Signalen](/guides/signals-explained) dargelegt sind.

## So entscheidest du

- **Du willst zu deinen Levels eine tägliche Research-Note oder Webinare und Trainings:** SpotGamma.
- **Du handelst Einzelaktien und willst GEX-Levels für Tausende Titel:** SpotGamma.
- **Du betreibst Daytrading mit SPX, SPY, QQQ, NDX, ES oder NQ und willst den Flip und die Walls im Verlauf der Sitzung in Bewegung sehen, für weniger Geld:** ZeroGEX.
- **Du suchst eine kostenlose Alternative zu SpotGamma:** Öffne [GEX-Levels heute](/gex-levels), ohne Registrierung, und vergleiche sie mit den Levels, die du jetzt nutzt.

---

Pläne, Preise und Funktionen von SpotGamma stammen von [spotgamma.com](https://spotgamma.com) und seinen Checkout-Seiten, geprüft am {{spotgamma:checked}}, und können sich jederzeit ändern, prüfe sie also dort. Die ZeroGEX-Preise auf dieser Seite werden aus der aktuellen Preisliste von ZeroGEX übernommen. ZeroGEX steht in keiner Verbindung zu SpotGamma. Nur zu Bildungszwecken, keine Handelsempfehlung.
