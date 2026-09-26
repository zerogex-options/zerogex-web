# Dealer Positioning

*Die vollständige GEX-Oberfläche - Net GEX am Spot, der Gamma Flip, Call Wall und Put Wall, sowie das Lesen der Term Structure.*

---

## Was diese Seite zeigt

Die Dealer-Positioning-Seite ist die **strukturelle Landkarte** des Optionsbuchs. Jedes Chart und jede Kachel beantwortet eine einzige Frage: Wo sind die Dealer positioniert, und was werden sie tun müssen, wenn sich der Preis bewegt?

Sie ist die wichtigste Seite, um den Kontext zu verstehen - auch wenn der eigentliche Trade anderswo ausgeführt wird.

Der **GEX unit**-Umschalter im Seitenkopf stellt jeden Dollarwert der Seite zwischen Gamma pro 1 % Bewegung und pro 1 Punkt um. Das Exposure ist in beiden Fällen dasselbe; nur die Einheit ändert sich.

## Der Regime-Header

Ganz oben auf der Seite steht das Regime in einer Zeile:

- **Das Badge** - **+ Gamma Regime**, wenn der Spot über dem Gamma Flip liegt, **- Gamma Regime**, wenn er darunter liegt, **~ Gamma Regime**, wenn der Spot weniger als etwa 0,25 % vom Flip entfernt ist, und **? Gamma Regime**, wenn in diesem Snapshot kein Flip bestimmt werden konnte.
- **Der Gamma Flip** - das Niveau und wie viele Punkte der Spot darüber oder darunter liegt.
- **Das Szenario** - **Positive GEX (pinned, low vol)**, **Negative GEX (trending, high vol)**, **At the Flip (neutral, transition)** oder **Flip unresolved this snapshot**.
- **Ein Posture-Tag** - **Aggressive**, **Balanced** oder **Defensive** - gebildet aus dem Gamma-Vorzeichen am Spot, dem IV Rank und Vanna.
- **Market Context** - dieselbe Lesart in Klartext, umschaltbar zwischen **Intraday** und **Swing**.

Das Regime ergibt sich allein aus der Lage des Spots relativ zum Flip, nicht aus dem Vorzeichen der Summe über die gesamte Kette - deshalb können Badge und Flip einander nicht widersprechen.

### Gamma Flip

Das Preisniveau, an dem die modellierte Dealer-Gamma-Kurve die Nulllinie kreuzt. Der Flip ist die Regime-Grenze: darüber wirkt das modellierte Hedging *tendenziell* stabilisierend, darunter verstärkend. Weil er der Nulldurchgang eines modellierten Profils ist, kann er sich mit der Vorzeichenkonvention, den Verfällen und der IV verschieben - werte ein Kreuzen als Änderung der aggregierten Hedging-Tendenz des Modells, nicht als garantierten Wechsel von Mean Reversion zu Trend.

## Die Haupt-Kacheln

### Net GEX

Der Dollar-Gamma-Wert aller offenen Optionen, vorzeichenbehaftet nach der modellierten Dealer-Positioning-Konvention von ZeroGEX (Calls +, Puts −), ausgewertet **zum aktuellen Spotpreis**. Positiv ⇒ Dealer sind *modelliert* netto long Gamma; negativ ⇒ *modelliert* netto short.

> Das ist eine Schätzung: Das Dealer-Gamma wird nach der traditionellen Open-Interest-Konvention (Calls positiv, Puts negativ) modelliert. Der tatsächliche Dealer-Bestand ist aus öffentlichen Optionskettendaten nicht direkt beobachtbar.

Die hier angezeigte Zahl wird am Spot gemessen, nicht über die gesamte Kette summiert - das ist wichtig, weil das Vorzeichen am Spot die modellierte Hedging-Tendenz der Dealer jetzt gerade prägt, unabhängig davon, was die kumulative Kurve bei anderen Preisen macht. Das Badge daneben ordnet den Wert gegenüber den letzten 30 Tagen ein (NORMAL, ELEVATED, EXTREME HIGH usw.).

### IV Rank

Wo die implizite Volatilität auf einer Skala von 0-100 % steht, abgeleitet aus dem VIX (VXN für QQQ, NDX und NQ). 0 % ist historisch ruhig; 100 % ist extreme Angst.

### Vanna Flow und Charm Decay

Netto-Vanna und Netto-Charm, summiert über alle Strikes und als Label angezeigt - **+Tailwind**, **-Headwind** oder **Neutral** für Vanna; **Bullish**, **Bearish** oder **Neutral** für Charm. Sie zeigen, ob Bewegungen der impliziten Vola und das Verstreichen der Zeit laut Modell gerichteten Delta-Druck hinzufügen oder abbauen.

Max Pain und der Pin Strike sind nicht auf dieser Seite - siehe [GEX Summary](/help/platform/gex-summary) und [Max Pain](/help/platform/max-pain).

## Das Gamma-Exposure-by-Strike-Chart

Das Hauptchart. Strike auf der x-Achse; modelliertes Dealer-Gamma pro Strike als Balken - Calls nach oben, Puts nach unten - mit der **GEX Profile**-Kurve auf einer eigenen Achse darübergelegt. Drei Dinge sind zu lesen:

1. **Wo die GEX-Profile-Kurve die Null kreuzt** - der Gamma Flip.
2. **Der größte Call-Gamma-Stapel auf oder über dem Spot** - die Call Wall.
3. **Der größte Put-Gamma-Stapel auf oder unter dem Spot** - die Put Wall.

Referenzlinien markieren den Spot, den Flip und beide Walls. Jeder Balken ist nach Verfall gestapelt - der nächste (0DTE) am kräftigsten, der fernste am blassesten -, sodass du siehst, wie viel Gamma eines Strikes bald ausläuft. Die Verfallsauswahl beschränkt Balken, Kurve, Walls und Flip auf die gewählten Verfälle, und die Auswahl gilt auch für die anderen Charts, die den Verfallsfilter teilen. Das Chart öffnet vollständig herausgezoomt über alle geladenen Strikes; die X- und Y-Zoom-Buttons und die Scrollleisten engen es ein.

### Call Wall / Put Wall

Die Strikes mit dem größten Gamma auf der Call- bzw. Put-Seite. Sie wirken oft als intraday Reibung - aber der Optionstyp allein legt die Richtung nicht fest; ob eine Wall als Widerstand, Unterstützung, Magnet oder Beschleuniger wirkt, hängt vom modellierten Vorzeichen des Dealer-Gammas und vom umgebenden Flow ab. Am meisten „Wand“ ist eine Wall, wenn die Dealer modelliert long Gamma sind.

## Das Open-Interest-by-Strike-Chart

Die Kontrakte hinter dem Gamma: das Open Interest an jedem Strike, Calls über der Achse und Puts darunter, auf die gleiche Weise nach Verfall gestapelt. Umschaltbar zwischen **OI** (offene Kontrakte) und **Notional** (Strike × 100 × OI). Ein großer Open-Interest-Stapel weit vom Spot kann trotzdem wenig Gamma tragen - deshalb werden die Walls nach Gamma bestimmt, nicht nach Open Interest.

## Die GEX-Heatmaps

Zwei Heatmaps zeigen, wie sich das Gamma über die Zeit und über die Verfälle verteilt:

- **GEX Heatmap Timeseries** - Netto-Dealer-Gamma pro Strike im Sitzungsverlauf, orange für positiv und blau für negativ, mit den Kerzen und dem Gamma Flip darüber. Es ist dasselbe Chart wie auf der eigenständigen GEX-Heatmap-Seite.
- **GEX Heatmap · Strike × DTE** - Netto-Dealer-Gamma für die Strikes mit dem meisten Gamma in der kommenden Woche (Zeilen, höchster Strike oben) gegen die Tage bis zum Verfall (Spalten, bis 7DTE). Grün ist positiv, rot negativ, und je kräftiger, desto größer. Eine Krone markiert den **GEX King** - den Strike mit dem größten Netto-Dealer-Gamma über diese kurzfristigen Verfälle.

Nützlich für:

- Das Erkennen von **0DTE-Pin-Verhalten**, isoliert vom größeren Book.
- Das Erkennen, ob eine Wall im nächsten Verfall konzentriert ist (vorübergehend) oder über spätere verteilt ist (dauerhafter).

Die Heatmaps aktualisieren sich im Sitzungsverlauf, während Spot, Zeit und IV das modellierte Gamma verschieben - ihre Bewegung zu beobachten ist aufschlussreich.

## Der Rest der Seite

- **Charm & Vanna Flows** - aggregiertes Vanna und Charm über die Kette, eine End-of-Day-Charm-Schätzung für den Hedging-Druck in den Schluss hinein und eine Einschätzung des Volatility-Expansion-Risikos.
- **Volatility Surface** - implizite Vola über die Strikes für kurzfristige gegenüber länger laufenden Verfällen.
- **GEX Metrics Snapshot** - die Tabelle Strike für Strike: Net GEX, Vanna, Charm, Open Interest und Volumen, auf den Spot zentriert, mit markiertem Flip und markierten Walls. Filtere sie nach Verfall; der **Strikes**-Umschalter blendet Strikes ohne Open Interest aus.

## Dealer Positioning in drei Schritten lesen

1. **Wo liegt der Spot relativ zum Flip?** Darüber ⇒ modellierte Stabilisierungstendenz; darunter ⇒ modellierte Verstärkungstendenz.
2. **Wo liegen die Walls?** Die Call Wall ist deine Aufwärtsreibung; die Put Wall ist deine Abwärtsreibung.
3. **Wie wandert die Heatmap?** Wandert die Call Wall nach oben, steigt der modellierte Call-Wall-Strike (wo das Call-Gamma seinen Höhepunkt hat), während sich Spot, Gamma, Zeit und IV verschieben - eine bullishe strukturelle Neigung. Die Wall kann sich ohne neues Open Interest bewegen: Sie folgt dem Höhepunkt des modellierten Exposures, nicht einem verifizierten Intraday-OI.

## Warum sich ZeroGEX' Gamma-Flip-Berechnung unterscheidet

Der Flip wird aus einem **Spot-Shift-Dealer-Gamma-Profil** berechnet - nicht aus einer Näherung über das kumulative Net GEX. Zur Methodik und zum Vorher/Nachher-Vergleich siehe [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Häufige Lesarten

- **Spot deutlich über dem Flip, Call Wall knapp darüber** ⇒ Pin in den Schluss hinein, Fade von Extensions.
- **Spot unter dem Flip, Put Wall knapp darunter** ⇒ Trend-Bias; bei einem Bruch ist Verstärkung zu erwarten.
- **Spot nahe am Flip bei steigender Vol** ⇒ Risiko eines Regimewechsels; Positionsgröße reduzieren oder abwarten.
- **Heatmap-Konzentration auf 0DTE-Call-Strikes nahe dem Spot** ⇒ Pin-Druck in den Schluss hinein.

## Siehe auch

- [GEX Summary](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
