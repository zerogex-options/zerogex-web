# Warum wir rohes DEX nicht als Schlagzeilen-Flusssignal veröffentlichen

*Was rein optionsbasiertes Delta Exposure misst, was es auslässt und wofür es dennoch nützlich sein kann.*

---

## Der enge Einwand

Rohes DEX ist eine modellierte Schätzung der **rein optionsbasierten Delta-Exposure**, üblicherweise zusammengefasst als `Σ(delta × open interest × contract multiplier)`. Es kann den angenommenen gerichteten Bestand des Optionsbeins beschreiben. Weil es die gegenläufige Absicherung im Underlying ausklammert und ein Niveau statt einer Veränderung misst, betrachtet ZeroGEX es nicht als verlässliche eigenständige Schätzung künftigen Dealer-Hedge-Flows.

Das ist eine engere Behauptung als zu sagen, DEX habe keine Bedeutung. Der tatsächliche Dealerbestand ist im öffentlichen Open Interest nicht beobachtbar, daher erbt DEX zusätzlich jede Positioning-Konvention, die die Berechnung anwendet.

## Ein Niveau ist kein künftiger Trade

Ein Dealer kann Optionsdelta mit Aktien, Futures oder anderen Optionen ausgleichen und das Gesamtportfolio innerhalb von Hedge-Bändern steuern. Rohes, rein optionsbasiertes DEX lässt diese Absicherungen weg. Wichtiger noch: Ein aktuelles Delta-Niveau sagt nichts darüber, wie sich Delta als Nächstes verändern wird. Potenzieller Hedge-Bedarf entsteht, wenn Spot, Zeit, implizite Volatilität, neue Trades oder Positionsänderungen das Portfolio-Delta verschieben.

Tief im Geld liegende Kontrakte können stark zu einer rein optionsbasierten Delta-Summe beitragen, weil ihr absolutes Delta gegen eins geht. Das ist kein Fehler: Es ist Teil der Bestandsschätzung. Es bedeutet aber, dass eine große Rohsumme nicht zwingend die Strikes mit der größten kurzfristigen Delta-Sensitivität ausweist. Gamma, Charm und Vanna haben unterschiedliche Strike- und Laufzeitprofile; sie erreichen nicht alle durchweg am Geld ihren Höchststand.

## Sinnvolle Verwendungen von DEX

Mit klar benannten Annahmen kann DEX Folgendes stützen:

- modellierte, rein optionsbasierte Schätzungen des gerichteten Bestands;
- Vergleiche der Kettenstruktur über die Zeit;
- Szenarioanalysen; und
- eine Komponente innerhalb eines breiteren Portfoliomodells.

Es sollte nicht als beobachtete Dealerposition oder als Prognose der nächsten Order im Underlying umetikettiert werden.

## Warum ZeroGEX Szenario-Neubewertung bevorzugt

Das Forced-Flow-Modell von ZeroGEX vergleicht das modellierte Portfolio-Delta jetzt mit dem modellierten Delta unter einem definierten Szenario aus Spot, Zeit und Volatilität. Die Differenz ist eine Schätzung des **potenziellen** Hedge-Drucks, bedingt auf den angenommenen Bestand und das Szenario. Sie ist kein Beweis, dass Dealer diesen Betrag ausführen werden: Portfolios können Gegenpositionen enthalten, Inputs können sich gemeinsam bewegen, und Desks können mit anderen Instrumenten oder zu anderen Zeitpunkten absichern.

> Rohes DEX kann ein angenommenes, rein optionsbasiertes Delta-Niveau beschreiben. ZeroGEX nutzt dieses Niveau allein nicht als Schätzung künftigen Dealer-Hedge-Flows.

Zu den zugrunde liegenden Konzepten siehe [Warum Market Maker Aktien handeln](/education/why-market-makers-trade-stock) und [Delta und seine drei Kinder](/education/delta-and-its-three-children).

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.
