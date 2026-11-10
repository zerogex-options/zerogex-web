# Vanna: Wie fallende IV das Dealer-Hedging verändern kann

*Vanna ist die Rate, mit der sich das Delta einer Option verändert, wenn sich die implizite Volatilität ändert. Wenn eingepreiste Angst nach einem Ereignis, auf das die befürchtete Bewegung nie folgte, aus dem Markt abfließt, kann Vanna ein typisches Dealer-Buch dazu bringen, in einem langsamen, stetigen Rinnsal Aktien zu kaufen - der "steigt ohne News"-Grind, dessen Hedge-Prints sich vor aller Augen im Tape verstecken, während das Motiv dahinter unsichtbar bleibt.*

---

## Der Flow, den man im Tape nicht sieht

Es gibt eine Art von Handelssitzung, die jeder Trader erkennt und kaum jemand erklären kann: Der Markt treibt den ganzen Tag nach oben, grüne Kerze um grüne Kerze, bei einem Volumen, das nichts Besonderes ist, und bei Nachrichten, die schlicht nicht existieren. Niemand scheint zu kaufen, und trotzdem geht es immer weiter nach oben. Fragt man herum, bekommt man nur Achselzucken - "Melt-up", "Low-Vol-Drift", "Gamma". Der eigentliche Motor ist meist Vanna, und sobald man ihn verstanden hat, wirken solche Sitzungen nicht mehr mysteriös.

Vanna ist die Empfindlichkeit des Deltas gegenüber der impliziten Volatilität - ∂Δ/∂σ. Es ist das dritte der drei "Kinder" des Deltas, neben Gamma (Delta gegenüber dem Preis) und Charm (Delta gegenüber der Zeit), dargelegt in [Delta und seine drei Kinder](/education/delta-and-its-three-children). Wie Charm zwingt es Dealer zum Handeln, selbst wenn der Spot völlig still steht. Anders als Charm ist sein Auslöser nicht die Uhr, sondern die Angst: die vom Markt eingepreiste Erwartung künftiger Bewegung, ausgedrückt als implizite Volatilität.

Dies ist die mechanische Tiefenanalyse, die unserem umfassenderen [Vanna-und-Charm-Erklärartikel](/education/vanna-and-charm-explained) zugrunde liegt. Jener Artikel ordnet Vanna in das Regime-Gesamtbild ein; dieser hier zeigt genau, warum ein fallender Vol-Print zu einem Dealer-Bid wird.

---

## Warum sich das Delta bewegt, wenn sich die Vol bewegt

Die implizite Volatilität bestimmt die Breite der vom Markt erwarteten Verteilung möglicher Ergebnisse. Hohe IV bedeutet, dass der Markt eine breite Preisspanne für plausibel hält; niedrige IV bedeutet, dass er erwartet, dass die Dinge nahe am aktuellen Niveau bleiben.

Überleg nun, was das für einen Out-of-the-Money-Call bedeutet. Wenn die IV hoch und die Verteilung breit ist, hat dieser weit entfernte Strike eine reale Chance, erreicht zu werden, also liegt sein Delta deutlich über null - sagen wir 0,25. Lass die Angst abfließen, die Verteilung sich verengen, und derselbe Strike wirkt plötzlich viel weniger erreichbar. Sein Delta fällt Richtung null - sagen wir 0,15. Der Spot hat sich nie bewegt. Das Einzige, was sich geändert hat, ist die Einschätzung des Marktes, wie weit sich der Spot *bewegen könnte*, und allein das hat das Delta der Option neu bepreist.

Diese Verschiebung ist Vanna. Jede Out-of-the-Money-Option in der Kette bepreist ihr Delta neu, wenn sich die Vol bewegt, und das Delta des gesamten Buchs driftet infolgedessen. Der Dealer war auf die Deltas von gestern gehedgt; der heutige Vol-Print hat sie gerade verändert; der Hedge muss aufholen.

---

## Warum schwindende Angst tendenziell ein Bid ist

Die Richtung des Vanna-Flows hängt davon ab, wie das Buch zusammengesetzt ist, aber das Lehrbuch-Setup - dasjenige, das das erkennbare Grinding erzeugt - läuft so ab.

Kunden schreiben in Summe tendenziell Calls für Rendite (Overwriting) und kaufen Puts zur Absicherung - daher werden Dealer unter der traditionellen Konvention als long in diesen Calls und short in diesen Puts modelliert. Betrachte die Momente *nach* einem Schreckmoment: Die implizite Vol wurde im Vorfeld eines CPI-Prints, eines FOMC-Meetings, eines Earnings-Termins hochgetrieben. Das Risiko zieht vorbei. Die befürchtete Bewegung bleibt aus. Die implizite Vol, die teuer war, beginnt in den folgenden Stunden und Tagen abzubluten.

Während die Vol fällt:

1. Die Deltas der Out-of-the-Money-Optionen im Buch des Dealers driften Richtung null.
2. Das Netto-*Long*-Options-Delta des Dealers schrumpft, sodass das Buch gegenüber seinem Aktien-Hedge short kippt.
3. Um den Hedge wiederherzustellen, kauft er Aktien.
4. Die Vol blutet weiter aus, also geht die Drift weiter, also kommt das Kaufen weiter - klein, stetig, den ganzen Tag über.

Dieser stetige, mechanische Kauf ist der Vanna Grind. Er ist keine Wette. Kein Dealer hat entschieden, dass der Markt steigen soll. Die Vol fiel, die Deltas drifteten, und der Hedge verlangte Aktien. Doch das Aggregat aus Tausenden kleinen Hedge-Käufen ist im Chart nur schwer von echter Nachfrage zu unterscheiden - deshalb kann das Tape ohne erkennbaren Aktivitätsschub nach oben driften. Diese Käufe sind echte Prints und tragen durchaus zum Volumen bei; sie kommen nur als stetiges Rinnsal statt als Market-Order-Schub, sodass sie den Preis anheben, ohne einen dramatischen Ausschlag in den Volumenbalken zu erzeugen - und nichts im Tape kennzeichnet sie als Hedging statt als Überzeugung.

---

## Die Vanna-Leiter

Weil der Vanna-Flow von einer Variable getrieben wird, die man direkt schocken kann, lässt er sich als Leiter darstellen: Spot und Zeit festhalten, die implizite Vol Punkt für Punkt auf und ab bewegen, und ablesen, wie viel Aktien das Dealer-Buch auf jeder Sprosse zu handeln gezwungen ist.

Das Live-Chart [Vanna Ladder](/forced-flow) tut genau das. Bei null Vol-Änderung ist der erzwungene Flow null - nichts hat sich bewegt, also ist nichts erzwungen. Bewege die Vol einen Punkt *nach unten*, und das Chart zeigt den erzwungenen Kauf, den eine Ein-Punkt-Kompression erzeugen würde; bewege sie zwei Punkte nach unten, und der Kauf verdoppelt sich ungefähr. Bewege die Vol *nach oben*, und das Vorzeichen kehrt sich um: Ein Vol-Spike bringt dasselbe Buch tendenziell zum Verkaufen, was mit ein Grund dafür ist, warum sich Angst in einem Ausverkauf selbst nähren kann. Die Leiter macht die Asymmetrie ablesbar - du siehst, bevor es passiert, wie viel Bid ein Zwei-Punkte-Vol-Abbau heute wert ist.

---

## Eine Zahl darauf legen

Angenommen, SPX steht am Morgen nach einem ruhigen Inflationsprint bei 5.800, die implizite Vol beginnt zurückzukommen, und das Dealer-Buch wird mit dem typischen customer-long Skew modelliert. Die Engine bepreist das Buch neu, mit Spot fixiert bei 5.800 und Vol zwei Punkte niedriger, und findet ein modelliertes Dealer-Delta, das um das Äquivalent von 60 Mio. $ Index-Exposure höher liegt. Das sind grob **60 Mio. $** an geschätzten Hedge-Käufen, verteilt über die Sitzung, während die Vol tatsächlich abblutet - ein anhaltendes Bid ohne einen Auslöser dahinter, über den irgendeine Schlagzeile berichten würde.

Kehr die Vol-Bewegung um, und dieselbe Maschinerie treibt tendenziell Verkäufe an. Vanna hat, wie Charm, keine eingebaute Richtung; das Vorzeichen kommt aus dem Buch und der Richtung der Vol-Bewegung. Was tendenziell verlässlich ist, ist der *Charakter* des Flows: langsam, stetig, im Volumen leicht zu übersehen (die Hedge-Trades erscheinen als Prints, sie verraten nur ihr Motiv nicht) und eng an den Vol-Trend gekoppelt statt an den Preis-Trend.

---

## Wie man es liest, ohne ihm hinterherzujagen

Vanna ist Kontext, kein Trigger. Eine kurze Disziplin:

- **Prüfe zuerst den Vol-Trend.** Ein mehrtägiges IV-Abbluten nach einem Ereignis ist das klassische Vanna-Bid-Setup. Steigende Vol kehrt den Flow ins Verkaufen um. Kein Vol-Trend, keine Vanna-Story.
- **Bestätige das Regime.** Der Vanna Grind koexistiert natürlicherweise mit einem positiven Gamma-Regime - beide begünstigen dasselbe ruhige, absorbierende Tape. In einem negativen Gamma-Regime kann dieselbe Vol-Bewegung von verstärkten Preisreaktionen überwältigt werden. Lies zuerst [das Gamma-Regime](/education/gamma-exposure-explained), Vanna innerhalb davon.
- **Erwarte den Grind, keinen Pop.** Vanna-Käufe sind ein Rinnsal. Sie erzeugen Drift, keinen Schub. Wenn du auf eine Vanna-Kerze wartest, hast du den Flow missverstanden - er versteckt sich in der Steigung, nicht im Spike.
- **Respektiere die Volumen-Diskrepanz.** Ein stetiger Anstieg bei unauffälligem Volumen ist in einem Vanna-Regime kein Warnsignal; er ist die Signatur. Es ist nicht so, dass das Kaufen keine Prints hinterlässt - das tut es -, sondern dass es nie ausschlägt und nie sein Motiv verrät, und genau das ist der Hinweis darauf, dass es sich um mechanisches Hedging statt um Überzeugung handeln könnte.

Wenn der Schreckmoment, der nie eintritt, endlich vorbei ist, muss sich die Angst irgendwo auflösen. Sie löst sich durch das Dealer-Buch auf, ein Re-Hedge nach dem anderen, und es sieht aus wie ein Markt, der still beschließt, ohne Grund zu steigen. Jetzt kennst du den Grund.

Für das uhrgetriebene Geschwister siehe [Charm: Die Uhr ist ein Trader](/education/charm-the-clock-is-a-trader), für das Fundament siehe [Warum Market Maker gezwungen sind, Aktien zu handeln](/education/why-market-makers-trade-stock), und um zu sehen, wie sich die Vanna-Leiter mit dem heutigen Buch bewegt, öffne die Live-Seite [Forced Flow](/forced-flow).

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.


> Unter der traditionellen Konvention Dealer-long-Call/Dealer-short-Put können einige Kettenkonfigurationen bei fallender IV modellierten Kaufdruck im Underlying erzeugen. Das Vorzeichen hängt von Besitz, Optionstyp, Moneyness, Verfall, Skew und davon ab, wie sich die Volatilitätsoberfläche verändert; Kaufen ist keine inhärente Eigenschaft von Vanna.
