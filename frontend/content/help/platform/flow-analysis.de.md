# Flow-Analyse

*Was heute gehandelt wurde und wer dafür den Spread gekreuzt hat: gekaufte und verkaufte Kontrakte auf jeder Seite, Net Premium und Put/Call, auf einer gemeinsamen Zeitachse.*

---

## Was diese Seite zeigt

Die Flow-Analysis-Seite ist die **Tape-Ansicht** des Optionsmarktes. Während Dealer Positioning das stehende Buch zeigt, zeigt diese Seite den **Flow**: was heute gehandelt wurde und welche Seite dafür den Spread gekreuzt hat.

Zwei Bedienelemente im Seitenkopf gelten für die ganze Seite: **Session** (die laufende Sitzung oder eine der letzten Woche, damit du siehst, ob heute überhaupt ungewöhnlich ist) und **Contracts** (alle Kontrakte oder die Strikes und Verfallstermine, die du auswählst). Die Werkzeugleiste des Charts stellt die Balkengröße ein, **5 min** oder **1 min**.

## Gekauft und verkauft

Jeder Options-Print wird nach der Seite eingeordnet, die den Spread gekreuzt hat, nach der Lee-Ready-Konvention:

- Am oder nahe am **Ask** hat ein Käufer den Preis bezahlt: Das zählt als **gekauft**.
- Am oder nahe am **Bid** hat ein Verkäufer zugeschlagen: Das zählt als **verkauft**.
- Prints in der **Mitte** werden im Verhältnis der Ask- und Bid-Prints desselben Kontrakts in derselben Minute auf beide Seiten verteilt. Prints ganz ohne Anhaltspunkt für eine Seite, etwa die Eröffnungsauktion um 09:30, zählen zur Hälfte in jede Richtung.

Gekauft plus verkauft ergibt also immer alle gehandelten Kontrakte. Die Aggressor-Lesart kommt der Absicht so nah, wie es der Datenfeed erlaubt, kann aber eine Eröffnung nicht von einer Schließung unterscheiden: Ein am Bid „verkaufter“ Put kann ein neuer Verkäufer sein oder ein Käufer, der Gewinne mitnimmt.

Gekaufte Calls und verkaufte Puts bilden die **bullische Seite**, gekaufte Puts und verkaufte Calls die **bärische Seite**. Die Farben folgen dem überall auf der Seite: Grün ist die bullische Seite, Rot die bärische. Deshalb ist das „bought“ in der Put-Zeile rot.

## Die Session-Zeile

Die Zeile ganz oben liest die Sitzung in einem Zug:

- **Flow** - **Risk-on**, wenn Net Premium und Net Flow beide bullisch ausfallen, **Risk-off**, wenn beide bärisch ausfallen, und **Two-way**, wenn sie sich widersprechen oder beide zu klein sind, um sie zu werten (Net Flow unter 1 % der gehandelten Kontrakte und Net Premium unter 5 % der Call- und Put-Prämie).
- **Net premium** - Netto-Call-Prämie minus Netto-Put-Prämie, jeweils gekauft minus verkauft, mit dem Call- und dem Put-Anteil darunter. Ein negativer Put-Anteil heißt, dass Puts netto verkauft wurden.
- **Net flow** - die bullische minus die bärische Seite in Kontrakten, und der Anteil der bullischen Seite an allem Gehandelten.
- **Put/call** - Put-Volumen geteilt durch Call-Volumen.
- **Volume** - alle gehandelten Kontrakte und wie viele seit Beginn des jüngsten Balkens dazugekommen sind.

## Bought vs. sold

Sitzungssummen für Calls und Puts, jeweils aufgeteilt in **gekauft** und **verkauft**, mit der Aufteilung als Balken, dem **Net** (gekauft minus verkauft) und dem, was der jüngste Balken bisher hinzugefügt hat. Die Zeile darunter rechnet beide Seiten zusammen: die bullische gegen die bärische Seite und wie weit eine vorn liegt, was dem Net Flow der Sitzung entspricht.

Die Zahlen aktualisieren sich während des Handels alle paar Sekunden.

## Der Session-Chart

Ein Chart in Feldern, die sich die Zeitachse der Sitzung und ein Fadenkreuz teilen, Zeiten in ET:

- **Price** - der Basiswert im Verlauf der Sitzung.
- **Strikes** - hinter der Preislinie eine Spur pro Strike und ein Punkt pro 5-Minuten-Balken: grün, wo an diesem Strike in diesem Balken die bullische Seite vorn lag, rot, wo die bärische Seite vorn lag, grau, wo keine Seite um mindestens ein Zehntel des dort Gehandelten vorn lag. Je größer der Punkt, desto mehr Kontrakte wurden an diesem Strike gehandelt. Fahre über einen Punkt oder tippe ihn an, um die gekauften und verkauften Calls und Puts dieses Strikes zu sehen. Die Spuren folgen deiner Kontraktauswahl und erscheinen auf 5-Minuten-Balken.
- **Flip and walls** - der Gamma-Flip sowie die Call- und die Put-Wall als gestrichelte Linien: dieselben Levels wie in der Key-Levels-Leiste und auf den Gamma-Charts. Sie zeigen, wo die Levels jetzt stehen, und erscheinen deshalb nur in der laufenden Sitzung. Flow am Strike einer Wall ist Kontext, kein Urteil über die Wall: In unserer Studie mit 737 Wall-Tests hat er nicht vorhergesagt, welche Walls brechen.
- **Net premium** - die laufende Net Premium, über null grün und unter null rot hinterlegt, mit dem **Call- und dem Put-Anteil** als dünne Linien.
- **Contracts** - was in jedem Balken gehandelt wurde. Balken nach oben sind die bullische Seite (gekaufte Calls, darüber heller die verkauften Puts), Balken nach unten die bärische Seite (gekaufte Puts, darunter die verkauften Calls).
- **Put/call** - die laufende Ratio, mit einer gestrichelten Linie bei 1.
- **Nummerierte Marker** am oberen Rand passen zum Flow-Log.

Die Buttons über dem Chart schalten jedes Feld ein oder aus, und dieser Browser merkt sich deine Wahl. Fahre über den Chart oder tippe ihn auf dem Handy an, um alle Zahlen zu diesem Balken zu sehen. **Full screen** gibt dem Chart das ganze Fenster, mit passend skalierten Feldern; Escape oder **Exit** holt ihn zurück.

## Flow-Log

Der bemerkenswerte Flow der Sitzung, neueste Einträge zuerst:

- **Net flow turned bullish / bearish** - der laufende Net Flow hat die Seite gewechselt, und die neue Seite liegt mit mindestens 0,5 % der gehandelten Kontrakte vorn. Kleines Pendeln um null wird nicht gelistet.
- **Net premium turned bullish / bearish** - dasselbe für die Net Premium, mit mindestens 3 % der Call- und Put-Prämie.
- **Put/call rose above 1 / fell below 1** - sobald die Ratio 0,05 über oder unter 1 liegt.
- **Volume burst** - ein Balken mit mindestens dem 2,5-Fachen des Medians der Balken der vorangegangenen Stunde, mit der Seite, die ihn angeführt hat. Gelistet werden die sechs größten der Sitzung.

In den ersten zehn Minuten wird nichts gemeldet, weil dann jede Summe klein genug ist, um von einem einzigen Print zu kippen.

## Bar by bar

Calls und Puts jedes Balkens, gekauft und verkauft, und sein Net Flow, neueste zuerst. Balken, in denen nichts gehandelt wurde, entfallen. Während der Sitzung ist die oberste Zeile der Balken, der noch läuft.

## Kontrakte auswählen

**Contracts** öffnet die Auswahl der Strikes und Verfallstermine. Eine Auswahl grenzt alles auf der Seite ein, sodass jede Zahl dieselben Kontrakte beschreibt. Die Auswahl der Verfallstermine wird mit den Gamma-Charts im selben Browser-Tab geteilt, und der Seitenkopf zeigt immer, welche Kontrakte die Seite gerade liest; das **×** daneben kehrt zu allen zurück.

ES und NQ haben keine eigene Optionskette: Ihr Flow ist SPX- bzw. NDX-Flow, die aufgeführten Strikes sind also Index-Strikes, keine Futures-Preise.

## So liest du ihn

Drei Muster:

1. **Starker Flow auf der bullischen Seite und steigende Net Premium, während Dealer modelliert Short Gamma sind** ⇒ Trader bezahlen für Aufwärtspotenzial, bei dem die Dealer modelliert short sind. Eine Lesart für Fortsetzung.
2. **Kräftig gekaufte Puts in ein Level hinein**, während das Positioning-Trap-Signal auf der Seite der Short-Masse geladen ist ⇒ die bärische Masse liegt womöglich falsch; achte auf einen Rückschlag nach oben.
3. **Flacher Flow nahe einem wichtigen Level** ⇒ warte auf den Ausbruch. Flow ohne Überzeugung ist kein Trade.

## Wann die Seite am nützlichsten ist

- **Direkt nach der Eröffnung** - die erste halbe Stunde sagt viel über die Neigung des Tages.
- **An jedem wichtigen Level** - der Flow in eine Wall oder den VWAP hinein zeigt, wer auf das Level drückt. In unserer Studie mit 737 Wall-Tests hat der vorzeichenbehaftete Flow am Wall-Strike nicht vorhergesagt, welche Walls brechen; lies ihn also als Kontext, nicht als Urteil.
- **Zum Handelsschluss** - zusammen mit EOD Pressure schärft die Flow-Lesart das Richtungssignal.

## Netto-Volumen vs. direktionaler Flow

Warum reines Volumen in die Irre führen kann, warum die Aggressor-Aufteilung Signal hinzufügt und warum die Prämie meist das stärkere Maß für Überzeugung ist, liest du ausführlich unter [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow).

## Siehe auch

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow)
