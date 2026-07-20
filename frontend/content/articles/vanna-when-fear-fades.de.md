# Vanna: Wenn die Angst schwindet, kaufen die Dealer

*Vanna ist die Rate, mit der sich das Delta einer Option ändert, wenn sich die implizite Volatilität ändert. Wenn eingepreiste Angst nach einem Ereignis abfließt, das nie eingetreten ist, zwingt vanna Dealer dazu, Aktien in einem langsamen, stetigen Rinnsal zu kaufen — jenes "steigt ohne Nachrichten"-Muster, das im Chart auftaucht, aber nie im Volumen.*

---

## Der Flow, den man im Tape nicht sieht

Es gibt eine Art von Handelssitzung, die jeder Trader erkennt und kaum jemand erklären kann: Der Markt treibt den ganzen Tag nach oben, grüne Kerze um grüne Kerze, bei einem Volumen, das nichts Besonderes ist, und bei Nachrichten, die schlicht nicht existieren. Niemand scheint zu kaufen, und trotzdem geht es immer weiter nach oben. Fragt man herum, bekommt man nur Achselzucken — "Melt-up", "Low-Vol-Drift", "Gamma". Der eigentliche Motor ist meist vanna, und sobald man ihn verstanden hat, wirken solche Sitzungen nicht mehr mysteriös.

Vanna ist die Empfindlichkeit des Deltas gegenüber der impliziten Volatilität — ∂Δ/∂σ. Es ist das dritte der drei "Kinder" des Deltas, neben gamma (Delta gegenüber dem Preis) und charm (Delta gegenüber der Zeit), dargelegt in [Delta und seine drei Kinder](/education/delta-and-its-three-children). Wie charm zwingt es Dealer zum Handeln, selbst wenn der Spot völlig still steht. Anders als charm ist sein Auslöser nicht die Uhr, sondern die Angst: die vom Markt eingepreiste Erwartung künftiger Bewegung, ausgedrückt als implizite Volatilität.

Dies ist die mechanische Tiefenanalyse, die unserem umfassenderen [Vanna-und-Charm-Erklärartikel](/education/vanna-and-charm-explained) zugrunde liegt. Jener Artikel ordnet vanna in das Regime-Gesamtbild ein; dieser hier zeigt genau, warum ein fallender Vol-Print zu einem Dealer-Bid wird.

---

## Warum sich das Delta bewegt, wenn sich die Vol bewegt

Die implizite Volatilität bestimmt die Breite der vom Markt erwarteten Verteilung möglicher Ergebnisse. Hohe IV bedeutet, dass der Markt eine breite Preisspanne für plausibel hält; niedrige IV bedeutet, dass er erwartet, dass die Dinge nahe am aktuellen Niveau bleiben.

Überlegen Sie nun, was das für eine Out-of-the-Money-Call bedeutet. Wenn die IV hoch und die Verteilung breit ist, hat dieser weit entfernte Strike eine reale Chance, erreicht zu werden, also liegt sein Delta deutlich über null — sagen wir 0,25. Lassen Sie die Angst abfließen, die Verteilung sich verengen, und derselbe Strike wirkt plötzlich viel weniger erreichbar. Sein Delta fällt Richtung null — sagen wir 0,15. Der Spot hat sich nie bewegt. Das Einzige, was sich geändert hat, ist die Einschätzung des Marktes, wie weit sich der Spot *bewegen könnte*, und allein das hat das Delta der Option neu bepreist.

Diese Verschiebung ist vanna. Jede Out-of-the-Money-Option in der Kette bepreist ihr Delta neu, wenn sich die Vol bewegt, und das Delta des gesamten Buchs driftet infolgedessen. Der Dealer war auf die Deltas von gestern gehedgt; der heutige Vol-Print hat sie gerade verändert; der Hedge muss aufholen.

---

## Warum schwindende Angst tendenziell ein Bid ist

Die Richtung des Vanna-Flows hängt davon ab, wie das Buch zusammengesetzt ist, aber das Lehrbuch-Setup — dasjenige, das das erkennbare Grinding erzeugt — läuft so ab.

Kunden sind in Summe long Optionen. Sie kaufen Calls für Aufwärtspotenzial und Puts zur Absicherung, und Dealer sind auf der anderen Seite short. Betrachten Sie die Momente *nach* einem Schreckmoment: Die implizite Vol wurde im Vorfeld eines CPI-Prints, eines FOMC-Meetings, eines Earnings-Termins hochgetrieben. Das Risiko zieht vorbei. Die befürchtete Bewegung bleibt aus. Die implizite Vol, die reichhaltig war, beginnt in den folgenden Stunden und Tagen abzubluten.

Während die Vol fällt:

1. Die Deltas der Out-of-the-Money-Optionen, in denen der Dealer short ist, driften Richtung null.
2. Die Netto-Short-Delta-Position des Dealers schrumpft — er ist mechanisch weniger short im Markt, als er es war.
3. Um den Hedge wiederherzustellen, kauft er Aktien.
4. Die Vol blutet weiter aus, also geht die Drift weiter, also kommt das Kaufen weiter — klein, stetig, den ganzen Tag über.

Dieser stetige, mechanische Kauf ist das vanna grind. Es ist keine Wette. Kein Dealer hat entschieden, dass der Markt steigen soll. Die Vol fiel, die Deltas drifteten, und der Hedge verlangte Aktien. Doch das Aggregat aus tausenden kleinen erzwungenen Käufen ist im Chart nicht von echter Nachfrage zu unterscheiden — genau deshalb driftet das Tape nach oben, während das Volumen aussagt, dass nichts passiert. Das Kaufen ist real; es kommt nur als Limit-Order-Rinnsal statt als Market-Order-Schub, sodass es den Preis bewegt, ohne die Volumenbalken aufleuchten zu lassen.

---

## Die Vanna-Leiter

Weil der Vanna-Flow von einer Variable getrieben wird, die man direkt schocken kann, lässt er sich als Leiter darstellen: Spot und Zeit festhalten, die implizite Vol Punkt für Punkt auf und ab bewegen, und ablesen, wie viel Aktien das Dealer-Buch auf jeder Sprosse zu handeln gezwungen ist.

Das Live-Chart [Vanna Ladder](/forced-flow) tut genau das. Bei null Vol-Änderung ist der erzwungene Flow null — nichts hat sich bewegt, also ist nichts erzwungen. Bewegen Sie die Vol einen Punkt *nach unten*, und das Chart zeigt den erzwungenen Kauf, den eine Ein-Punkt-Kompression erzeugen würde; bewegen Sie sie zwei Punkte nach unten, verdoppelt sich der Kauf ungefähr. Bewegen Sie die Vol nach oben, kehrt sich das Vorzeichen um: Ein Vol-Spike zwingt Dealer zum Verkaufen, was mit ein Grund dafür ist, warum sich Angst in einem Ausverkauf selbst nährt. Die Leiter macht die Asymmetrie ablesbar — man sieht, bevor es passiert, wie viel Bid ein Zwei-Punkte-Vol-Abbau heute wert ist.

---

## Eine Zahl darauf legen

Angenommen, SPX steht am Morgen nach einem ruhigen Inflationsprint bei 5.800, die implizite Vol beginnt zurückzukommen, und das Dealer-Buch trägt den typischen customer-long Skew. Die Engine bepreist das Buch neu, mit Spot fixiert bei 5.800 und Vol zwei Punkte niedriger, und findet das Dealer-Delta höher, äquivalent zu 60 Millionen Dollar Index-Exposure. Das sind grob **60 Millionen Dollar** an erzwungenen Käufen, verteilt über die Sitzung, während die Vol tatsächlich abblutet — ein anhaltendes Bid ohne jeden Auslöser, über den irgendeine Schlagzeile berichten würde.

Kehren Sie die Vol-Bewegung um, und dieselbe Maschinerie erzwingt Verkäufe. Vanna hat, wie charm, keine eingebaute Richtung; das Vorzeichen kommt aus dem Buch und der Richtung der Vol-Bewegung. Verlässlich ist der *Charakter* des Flows: langsam, stetig, im Volumen unsichtbar und eng an den Vol-Trend gekoppelt statt an den Preis-Trend.

---

## Wie man es liest, ohne ihm hinterherzujagen

Vanna ist Kontext, kein Trigger. Eine kurze Disziplin:

- **Prüfen Sie zuerst den Vol-Trend.** Ein mehrtägiges IV-Abbluten nach einem Ereignis ist das klassische Vanna-Bid-Setup. Steigende Vol kehrt den Flow ins Verkaufen um. Kein Vol-Trend, keine Vanna-Story.
- **Bestätigen Sie das Regime.** Das vanna grind koexistiert natürlicherweise mit einem positiven Gamma-Regime — beide begünstigen dasselbe ruhige, absorbierende Tape. In einem negativen Gamma-Regime kann dieselbe Vol-Bewegung von verstärkten Preisreaktionen überwältigt werden. Lesen Sie zuerst [gamma](/education/gamma-exposure-explained), vanna innerhalb davon.
- **Erwarten Sie das Grind, keinen Pop.** Vanna-Käufe sind ein Rinnsal. Sie erzeugen Drift, keinen Schub. Wenn Sie auf eine Vanna-Kerze warten, haben Sie den Flow missverstanden — er versteckt sich in der Steigung, nicht im Spike.
- **Respektieren Sie die Volumen-Diskrepanz.** "Steigt ohne Volumen" ist in einem Vanna-Regime kein Warnsignal; es ist die Signatur. Die Abwesenheit von Volumen ist der Hinweis darauf, dass das Kaufen mechanisch ist.

Wenn der Schreckmoment, der nie eintritt, endlich vorbei ist, muss sich die Angst irgendwo auflösen. Sie löst sich durch das Dealer-Buch auf, ein Re-Hedge nach dem anderen, und es sieht aus wie ein Markt, der still beschließt, ohne Grund zu steigen. Jetzt kennen Sie den Grund.

Für das uhrgetriebene Geschwister siehe [Charm: Die Uhr ist ein Trader](/education/charm-the-clock-is-a-trader), für das Fundament siehe [Warum Market Maker gezwungen sind, Aktien zu handeln](/education/why-market-makers-trade-stock), und um die Vanna-Leiter live mit dem heutigen Buch zu sehen, öffnen Sie die Live-Seite [Forced Flow](/forced-flow).

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.
