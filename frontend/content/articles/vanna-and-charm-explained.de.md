# Vanna und Charm erklärt für Optionshändler

*Vanna und Charm erklärt — was diese beiden Griechen sind, warum sie für die Hedging-Flows der Dealer wichtig sind, wie Vanna in Regimen mit Volatilitätskompression ein anhaltendes Kaufinteresse erzeugt, wie Charm die vorhersehbaren Flows zum Handelsschluss antreibt, und wie sie mit dem Gamma-Regime zusammenwirken.*

---

## Warum es sich lohnt, Vanna und Charm zu verstehen

Wer sich mit Analysen zum Dealer-Positioning beschäftigt hat, kennt es: Gamma bekommt die meiste Aufmerksamkeit — aus gutem Grund. Es ist der Greek erster Ordnung, der den Großteil des strukturellen Hedging-Flows abbildet. Aber es ist nicht die einzige Kraft im Dealer-Buch. Zwei Greeks zweiter Ordnung — **Vanna** und **Charm** — treiben still und leise einen erheblichen Teil der Flows an, die sich im Tape zeigen, besonders rund um Vol-Resets, OPEX und den Handelsschluss.

Die meisten Trader, die reine Gamma-Frameworks nutzen, lesen das Regime zwar korrekt, übersehen aber die Kräfte zweiter Ordnung darin. Ein Regime mit Volatilitätskompression und anhaltendem, vanna-getriebenem Kaufdruck verhält sich anders als eines ohne diesen Effekt. Eine 0DTE-lastige Chain zum Handelsschluss verhält sich anders, weil der Charm-Zerfall ein kontinuierliches Rehedging erzwingt. Vanna und Charm in die Lesart einzubeziehen ersetzt das Gamma-Framework nicht — es schärft es.

Dieser Artikel erklärt, was jeder dieser Greeks ist, warum sie für Dealer relevant sind, wie sich die Flows im Tape zeigen und wie sie mit dem Gamma-Regime zusammenwirken. Für das zugrunde liegende strukturelle Framework beginnen Sie mit dem [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained); für die Regime-Lesart siehe [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip); und für die 0DTE-spezifischen Lesarten, bei denen der Charm-Zerfall am lautesten ist, siehe [0DTE-Dealer-Positioning erklärt](/education/0dte-dealer-positioning-explained).

---

## Was ist Vanna bei Optionen?

Vanna ist ein Greek zweiter Ordnung, der die **Sensitivität des Deltas einer Option gegenüber Änderungen der impliziten Volatilität** misst. Gleichbedeutend — und das ist die nützlichere Sichtweise für die Analyse von Dealer-Flows — misst er die Sensitivität des Optionspreises gegenüber der gemeinsamen Bewegung von Spot und Vol.

In Symbolen: Vanna ≈ ∂Δ/∂σ = ∂²V/∂σ∂S. Es handelt sich um die gemischte Ableitung des Optionswerts nach Spot und impliziter Vol.

Was das in der Praxis bedeutet: Wenn sich die implizite Volatilität bewegt, bewegt sich das Delta Ihrer Option — *auch wenn sich der Spot nicht bewegt*. Ein Rückgang der IV verringert das Delta von OTM-Calls und erhöht (betragsmäßig) das Delta von OTM-Puts. Ein Anstieg der IV bewirkt das Gegenteil. Wer ein Optionsbuch hält, dessen Delta sich bei Vol-Bewegungen verschiebt, muss diese Verschiebung absichern — und genau dort wird Vanna zu einem Flow im Tape.

### Wie Dealer Vanna erleben

Dealer führen deltaneutrale Bücher. Wenn die IV sinkt, verschiebt sich das Delta ihres Bestands, und sie müssen den Basiswert handeln, um das Buch wieder neutral zu stellen. Die Richtung dieses Trades hängt von der Zusammensetzung ihres Buches ab.

Das klassische Szenario, das in Flow-Analysen diskutiert wird:

- Dealer sind typischerweise short in Calls (Kunden sind netto long).
- Wenn die IV sinkt, sinkt das Delta von OTM-Calls.
- Ein Dealer, der short in einem OTM-Call mit Delta 0,30 war, ist nun vielleicht short im selben Call mit Delta 0,25.
- Ihr Short-Delta-Exposure ist geschrumpft — sie sind mechanisch weniger short im Basiswert.
- Um deltaneutral zu bleiben, müssen sie den Basiswert *verkaufen* — oder, falls sie den Basiswert als Hedge long gehalten hatten, einen Teil davon verkaufen.

Isoliert betrachtet klingt das bärisch. Der interessante Fall ist der umgekehrte: In einem Markt, in dem die IV über Tage oder Wochen abgesackt ist (ein Regime mit Volatilitätskompression), rehedgen Dealer kontinuierlich den Vanna-Zerfall auf einer Chain, die stark in Richtung Kunden-Long-Call-Positionierung verschoben ist. Das Aggregat dieser Flows manifestiert sich tendenziell als anhaltendes, strukturelles Kaufinteresse — der "Vanna Grind", über den Flow-Desks seit Jahren schreiben.

Das genaue Vorzeichen hängt von der Zusammensetzung der Chain ab. Ein Buch, das von dealer-short OTM-Puts dominiert wird, verhält sich anders als eines, das von dealer-short OTM-Calls dominiert wird. Die Standardanalyse geht vom typischen Kunden-Long-Call/Kunden-Long-Put-Skew aus, der zum Ergebnis des Vanna-Grinds in der Volatilitätskompression führt. In weniger typischen Regimen kann sich das Vorzeichen umkehren.

---

## Was ist Charm bei Optionen?

Charm ist ein Greek zweiter Ordnung, der die **Sensitivität des Deltas einer Option gegenüber der Zeit** misst. Je näher eine Option dem Verfall kommt, desto mehr driftet ihr Delta — out-of-the-money-Optionen zerfallen Richtung 0, in-the-money-Optionen driften Richtung 1 (bei Calls) bzw. -1 (bei Puts).

In Symbolen: Charm = ∂Δ/∂t.

Die Intuition dahinter: Das Delta einer Option ist grob gesagt die vom Markt implizierte Wahrscheinlichkeit, dass sie im Geld verfällt. Mit fortschreitender Zeit muss diese Wahrscheinlichkeit gegen 0 oder gegen 1 konvergieren. Bei OTM-Optionen zerfällt diese Wahrscheinlichkeit Richtung 0, bei ITM-Optionen steigt sie Richtung 1. Je näher am Verfall, desto schneller die Drift.

### Wie Dealer Charm erleben

Wie Vanna erzwingt auch Charm ein Rehedging, ohne dass sich der Spot bewegt. Ein Dealer, der ein deltaneutrales Buch führt, sieht sein effektives Delta-Exposure allein durch den Zeitablauf driften und muss den Basiswert handeln, um flach zu bleiben.

Das direktionale Vorzeichen des charm-getriebenen Dealer-Flows hängt davon ab, welche Seite des Buches dominiert. Für ein typisches, short-call-lastiges Dealer-Buch, das bis zum Handelsschluss auf einer 0DTE-Chain gehalten wird:

- Die Deltas der OTM-Calls zerfallen Richtung 0.
- Das Short-Call-Delta-Exposure des Dealers schrumpft betragsmäßig.
- Sie müssen den Basiswert handeln, um neutral zu bleiben.
- Bei einer typischen Chain erzeugt die Nettorichtung dieses kontinuierlichen Hedgings über den Nachmittag oft eine messbare, vorzeichenstabile Drift.

Diese Drift ist es, was die Schule der "EOD-Pressure"-Flow-Analyse zu lesen versucht. Das Signal existiert, weil charm-getriebenes Hedging mechanisch erzwungen ist — es braucht keine Meinung, kein Volumen, keinen direktionalen Flow. Zeit vergeht, Deltas bewegen sich, Dealer rehedgen. Die Kontinuität dieses Flows macht ihn lesbar.

---

## Warum Vanna und Charm für das Dealer-Hedging wichtig sind

Die klarste Einordnung: Gamma ist die *reaktive* Hedging-Kraft — das, was Dealer tun, wenn sich der Preis bewegt. Vanna und Charm sind die *nicht preisgetriebenen* Hedging-Kräfte — das, was Dealer tun, wenn sich die Vol bewegt oder Zeit vergeht, selbst bei fixiertem Spot.

Eine typische Intraday-Timeline verdeutlicht den Unterschied:

- Eine Spot-Bewegung von 0,2 % erzwingt Gamma-Hedging — groß und sofort.
- Ein Rückgang der IV um 1 Vol-Punkt im Laufe des Morgens erzwingt Vanna-Hedging — pro Minute klein, aber anhaltend.
- Acht Stunden Zeitzerfall bis zum Handelsschluss erzwingen Charm-Hedging — pro Minute klein, aber kumulativ bedeutend.

Alle drei laufen gleichzeitig ab. Bei ruhigem Tape ist Gamma weitgehend still (kleine Bewegungen), und Vanna und Charm werden zum dominierenden Flow. Bei heftigem Tape dominiert Gamma, und die Flows zweiter Ordnung sind Rauschen. Wie relevant Vanna und Charm sind, hängt ebenso vom Volatilitätsregime wie vom Gamma-Regime ab.

---

## Vanna-Flows in Regimen mit Volatilitätskompression

Am klarsten zeigt sich Vanna im Tape während anhaltender Volatilitätskompression — typischerweise in den Tagen nach einem Vol-Spike, der die vom Markt eingepreiste realisierte Bewegung nicht geliefert hat.

Der Mechanismus:

1. Die IV wird wegen eines wahrgenommenen Risikos (CPI, FOMC, Earnings) hochgekauft.
2. Das Risiko geht vorüber, ohne die eingepreiste realisierte Bewegung zu liefern.
3. Die IV beginnt, über die gesamte Chain hinweg zu bluten.
4. Die Chain (das Dealer-Buch) rehedgt Vanna kontinuierlich während dieses Zerfalls.
5. Bei einer typischen, in Richtung Kunden-Long-Call verschobenen Chain ist das aggregierte Hedging ein anhaltendes Kaufinteresse im Basiswert.

Der Flow ist pro Minute klein und für jemanden, der nur die Volumenbalken liest, oft unsichtbar. Am deutlichsten zeigt er sich auf Intraday-Charts als schleifender Aufwärtstrend in ruhigem Tape, der nicht zum Volumenbild passt — die klassischen "alles steigt bei keinem Volumen"-Sessions, die auf ereignislose CPI-Zahlen folgen.

Der Flow ist **nicht direktional in seiner Absicht**. Dealer hedgen, sie wetten nicht. Aber das Aggregat des mechanischen Rehedgings verhält sich nicht von einem direktionalen Kaufinteresse zu unterscheiden. Der Charakter des resultierenden Tapes ist der Hinweis: anhaltende Drift bei niedrigem Volumen, niedriger realisierter Vol, kein offensichtlicher Katalysator.

Der Vanna Grind tendiert auch dazu, mit einem positiven Gamma-Regime zu *koexistieren* — beide Effekte begünstigen dieselben Regimebedingungen, und beide verstärken den absorbierenden, dämpfenden Charakter des Tapes. Diese Koexistenz ist mit ein Grund, warum es wichtig ist, sie gemeinsam zu lesen.

---

## Charm-Flows Richtung Verfall und Handelsschluss

Am klarsten zeigt sich Charm in den letzten 90 Minuten der Cash-Session an jedem Tag mit signifikantem 0DTE-Flow — was mittlerweile der Standardfall für SPX ist.

Der Mechanismus:

1. Taggleiche Verfälle dominieren die Chain nahe am Spot.
2. Ihre Deltas zerfallen rasch, je näher der Handelsschluss rückt.
3. Dealer rehedgen die Drift kontinuierlich.
4. Das direktionale Vorzeichen des aggregierten Hedgings wird durch die Zusammensetzung der Chain erzwungen.
5. Der Flow tendiert dazu, im Laufe des Nachmittags zu *beschleunigen*, während die Charm-Rate zunimmt.

Deshalb konzentriert sich so viel der Dealer-Positioning-Analyse speziell auf das Zeitfenster am späten Nachmittag. Der Charm-Flow ist mechanisch erzwungen, für eine gegebene Chain vorzeichenstabil, und am deutlichsten in den letzten 60–90 Minuten sichtbar, wenn die Rate des Delta-Zerfalls ihren Höhepunkt erreicht.

Ein häufiges Muster: Der Charm-Flow zeigt in eine Richtung, der Gamma-Magnet liegt in derselben Richtung, und das realisierte Tape komprimiert sich Richtung des strukturellen Zugs. Die kombinierte Lesart — Gamma-Magnet plus Charm-Richtung plus Zeitrampe — ist es, die die saubersten "Drift zum Handelsschluss"-Setups erzeugt. Nichts davon ist für sich genommen ein Handelssignal; es ist Regimekontext, der die Art, wie eine Session gelesen wird, prägen sollte.

---

## Vanna und Charm rund um OPEX

Der monatliche OPEX (dritter Freitag) und der vierteljährliche OPEX (dritter Freitag im März, Juni, September, Dezember) bündeln beide Effekte:

- **Der Charm-Zerfall ist am größten** in der letzten Woche vor dem monatlichen Verfall, weil das Gamma im gleich verfallenden Bucket dort am größten ist.
- **Die Vanna-Sensitivität ist hoch**, weil die Chain voller Optionen ist, die kurz vor dem Verfall stehen, deren Deltas sowohl gegenüber Spot als auch gegenüber Vol sprunghaft reagieren.

Ein typisches OPEX-Wochen-Tape — für die Regime, in denen es auftritt — zeigt ein schleifendes Driften Richtung schwer gewichteter Strikes von Montag bis Mittwoch, wobei sich der charm-getriebene Flow Richtung Donnerstag und Freitag beschleunigt. Die Vol tendiert dazu, sich im Laufe der Woche zu komprimieren. Die kombinierte Vanna-plus-Charm-Lesart erzeugt oft einige der saubersten "strukturellen Drift"-Setups im Kalender.

Hier wird auch die These "Vanna plus Charm rund um OPEX" oft über ihren tatsächlichen Mechanismus hinaus überdehnt. Die Effekte sind real und erzeugen tatsächlich strukturellen Flow, sind aber keine Signale. Es sind Regimebedingungen, die *möglicherweise* strukturelle Drift erzeugen — wenn das Gamma-Regime das unterstützt. In einem tief negativen Gamma-Regime können dieselben OPEX-Wochen-Bedingungen stattdessen explosive realisierte Vol erzeugen statt Kompression.

---

## Wie Vanna und Charm mit dem Gamma-Regime zusammenwirken

Die nützlichste Grundeinordnung:

- **In einem positiven Gamma-Regime** verstärken die Vanna- und Charm-Flows den dämpfenden, pin-freundlichen Charakter des Tapes. Der Vanna Grind stützt die Drift, der Charm-Zerfall zieht Richtung des strukturellen Magneten, und der absorbierende Reflex des Long-Gamma-Hedgings hält die Range.
- **In einem negativen Gamma-Regime** können Vanna- und Charm-Flows die direktionale Dynamik verstärken, statt Drift zu erzeugen. Derselbe Charm-Zerfall, der den Preis im Long-Gamma-Regime fixiert hätte, kann in einem Short-Gamma-Regime einen Ausverkauf verstärken, wenn das Dealer-Buch entsprechend positioniert ist.

Die praktische Konsequenz: **Lesen Sie zuerst Gamma, dann lesen Sie Vanna und Charm innerhalb dieses Rahmens.** Die Greeks zweiter Ordnung beschreiben Kräfte, die in jedem Regime existieren, aber ihre *verhaltensmäßige Wirkung* wird durch den Gamma-Reflex gefiltert. Vanna oder Charm zu lesen, ohne Gamma zu lesen, heißt, nur die halbe Bilanz zu lesen.

---

## Wie man Vanna und Charm im Tagesverlauf liest

Ein kurzer Workflow:

1. **Identifizieren Sie zuerst das Gamma-Regime.** Positives Gamma unterstützt Lesarten struktureller Drift; negatives Gamma kehrt sie um.
2. **Prüfen Sie, ob die Vol komprimiert.** Ein mehrtägiger IV-Zerfall im Verlauf des Morgens ist das Setup, das Vanna-Flows tendenziell speist. Ein Vol-Spike kehrt die Flow-Richtung um.
3. **Beobachten Sie das Charm-Fenster.** Die letzten 90 Minuten sind der Moment, in dem Charm am lautesten ist. Achten Sie auf Vorzeichenübereinstimmung zwischen der Charm-Richtung und dem Gamma-Magneten — beide in dieselbe Richtung ist das sauberste Setup.
4. **Gleichen Sie mit OPEX-Terminen ab.** Der monatliche und der vierteljährliche OPEX bündeln beide Flows. Behandeln Sie sie als Regime-Verstärker.
5. **Ziehen Sie an Vol-Spike-Tagen Abschläge ab.** Wenn sich die realisierte Vol ausweitet, werden sowohl Vanna- als auch Charm-Flows von Gamma-Reaktionen dominiert. Die Lesart zweiter Ordnung wird zu Rauschen.

Die Disziplin besteht nicht darin, dem Vanna Grind oder der Charm-Drift direkt hinterherzujagen — sondern sie als zusätzlichen Kontext zu nutzen, der die Gamma-Lesart schärft.

---

## Wie ZeroGEX Vanna und Charm darstellt

Das Dashboard behandelt Vanna und Charm als Overlays auf die strukturelle Lesart, nicht als eigenständige Signale:

- **Das Charm-at-Spot-Exposure** ist einer der Kerninputs für das erweiterte EOD-Pressure-Signal, das die direktionale Drift zum Handelsschluss anhand der kombinierten Charm- und Pin-Terme im aktiven Fenster schätzt.
- **Vanna- und Charm-Flow** werden auf dedizierten Panels dargestellt, die den aggregierten Dealer-Hedging-Flow jedes einzelnen Greeks über die gesamte Chain zeigen.
- **Das Strike-Profil-Chart** zeigt, wo sich Gamma-, Vanna- und Charm-Exposure gemeinsam konzentrieren — üblicherweise dort, wo sich die saubersten kombinierten Flow-Lesarten ergeben.

![ZeroGEX Vanna- und Charm-Flow-Panels](/blog/zerogex-vanna-charm-flows.png)

Ein durchgerechnetes Beispiel: Angenommen, der SPX steht an einem Freitagnachmittag bei 5.830, und das Dashboard zeigt:

- **Net GEX:** +1,4 Mrd. USD
- **Gamma Flip:** 5.810
- **Schwerster Gamma-Strike:** 5.825
- **Charm-at-Spot:** zeigt moderat nach unten
- **Vanna-Flow-Trend im Verlauf des Morgens:** im Einklang mit Volatilitätskompression
- **EOD-Pressure-Score:** −0,4 (ausgelöst, milde bärische Drift)

Die zusammengesetzte Lesart: Long-Gamma-Regime, struktureller Magnet knapp unterhalb des Spots, Charm-Zerfall in derselben Richtung, Vanna Grind im Einklang mit dem Vol-Rückgang des Morgens. Praktische Tendenz zum Handelsschluss: Eine Drift nach unten Richtung 5.825 ist der Pfad mit der höheren Wahrscheinlichkeit, wobei der Gamma-Magnet die Bewegung absorbiert und der Charm-Zerfall die Richtung bestätigt. Nichts davon ist ein Handelssignal — es ist der zusammengesetzte Regimekontext für die letzte Handelsstunde.

![ZeroGEX EOD-Pressure-Score- und Charm-at-Spot-Panels im Zeitfenster des späten Nachmittags](/blog/zerogex-eod-pressure-charm.png)

---

## Häufige Missverständnisse zu Vanna und Charm

Ein paar Fallstricke:

- **"Vanna ist bullisch."** Ist es nicht. Es ist der Dealer-Reflex auf IV-Bewegungen. Das direktionale Vorzeichen dieses Reflexes hängt von der Zusammensetzung der Chain ab; bei einer typischen Kunden-Long-Call-Chain während Volatilitätskompression tendiert das *Aggregat* zu einem Kaufinteresse — aber das ist eine Regimeaussage, keine Eigenschaft des Greeks.
- **"Charm ist ein Signal."** Der charm-getriebene Flow ist eine strukturelle Kraft, kein Trade. Er erzeugt eine Tendenz zur Drift in der letzten Stunde; er sagt Ihnen nicht, wann Sie einsteigen sollen.
- **"Vanna und Charm zählen nur in der OPEX-Woche."** Dort sind sie am lautesten, aber der Charm-Zerfall zählt an jedem Tag mit signifikantem 0DTE-Flow — was mittlerweile die meisten Tage betrifft.
- **"Der Vanna Grind funktioniert immer bei Volatilitätskompression."** Nur wenn die Zusammensetzung der Chain das unterstützt und das Gamma-Regime nicht dagegenwirkt.
- **"Charm-Hedging verschwindet nach dem Handelsschluss."** Das stimmt — aber der Flow hat bis dahin bereits stattgefunden. Der Punkt ist, ihn während des aktiven Fensters zu lesen, nicht danach.

---

## Fazit

> Gamma ist die reaktive Hedging-Kraft. Vanna und Charm sind die nicht preisgetriebenen Hedging-Kräfte — das, was Dealer tun, wenn sich die Vol bewegt oder Zeit vergeht, selbst bei fixiertem Spot.

Die Greeks zweiter Ordnung beschreiben reale Flows im Dealer-Buch, die die Lesart erster Ordnung allein übersieht. Sie erzeugen den anhaltenden Grind bei Volatilitätskompression, den strukturellen Zug zum Handelsschluss an 0DTE-lastigen Tagen und die OPEX-Wochen-Drift Richtung schwer gewichteter Strikes — dann, und nur dann, wenn das Gamma-Regime sie unterstützt.

Beziehen Sie sie in die Lesart ein. Führen Sie die Lesart aber nicht mit ihnen an.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.

---

Wenn Sie die heutigen Vanna- und Charm-Flows in Echtzeit sehen möchten, zusammen mit dem Gamma-Regime, das darüber entscheidet, ob sie Drift erzeugen oder überrollt werden — das kostenlose ZeroGEX-Dashboard zeigt das alles.
