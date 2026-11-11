# 0DTE-Dealer-Positionierung erklärt

*0DTE-Optionen machen einen großen Teil der SPX-Aktivität aus und können in manchen Sitzungen die Gamma-Sensitivität nahe am Spot dominieren. Ihre Netto-Wirkung auf die Dealer bleibt modelliert und ist aus Bruttovolumen oder OI nicht beobachtbar.*

---

## Warum 0DTE die Lesart verändert

0DTE-Optionen machen einen großen Teil des SPX-Handels aus und können in manchen Sitzungen die Gamma-Sensitivität nahe am Spot dominieren. Wenn der Verfall näher rückt, kann das ATM-Gamma stark steigen, während das Gamma von Strikes, die deutlich ITM oder OTM werden, gegen null tendiert. Die tatsächliche Netto-Wirkung auf die Dealer hängt vom Kauf- und Verkaufsverhalten der Kunden ab, das Bruttovolumen und OI nicht offenlegen.

0DTE zu isolieren kann nützlichen Intraday-Kontext liefern, weil Optionen mit Fälligkeit am selben Tag sehr hohes Gamma nahe am Spot tragen können. Ihre tatsächliche Netto-Wirkung auf das Dealer-Hedging hängt vom Kauf- und Verkaufsverhalten der Kunden ab, das öffentliches Bruttovolumen und OI nicht offenlegen.

Dieser Artikel ist die praktische Einordnung dessen, was "0DTE-Dealer-Positionierung" und "Dealer-Gamma 0DTE" in Echtzeit tatsächlich bedeuten. Wir behandeln, warum der 0DTE-Bucket wichtiger ist als längerfristiges Bucketing, was sich zwischen negativen und positiven Gamma-Regimen speziell für 0DTE ändert, und wie man das Tape in beiden Fällen unterschiedlich liest. Kombiniere diesen Artikel mit [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip) für die Regime-Linie selbst, [Gamma Walls erklärt](/education/gamma-walls-explained) für die Grenzniveaus und dem [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained) für den vollständigen strukturellen Hintergrund.

---

## Was ist 0DTE-Dealer-Positionierung?

0DTE-Dealer-Positionierung ist die aggregierte Gamma-Exposure, die Dealer bei Optionen mit Fälligkeit am selben Tag halten. Mechanisch unterscheidet sie sich nicht von längerfristigem Dealer-Gamma - nach der Standardkonvention werden Dealer *modelliert* als long die Calls, die Kunden im Rahmen von Overwriting schreiben, und short die Puts, die Kunden zur Absicherung kaufen, sodass ihr Long-Call-Bestand positives Gamma beiträgt, während ihr Short-Put-Bestand negatives Gamma beiträgt (das Minuszeichen ist die modellierte Short-Position, nicht etwa, dass Puts an sich negatives Gamma hätten). Der Hedging-Reflex ist derselbe: Delta neutral halten, den Basiswert handeln, während sich das Gamma ändert.

> Dieses Dealer-Vorzeichen ist eine modellierte Konvention, kein beobachteter Bestand - die tatsächliche Positionierung ist aus öffentlichem Open Interest nicht direkt beobachtbar.

Was 0DTE anders macht, ist die **Gamma-Dichte**. Optionen mit Fälligkeit am selben Tag tragen ihr größtes Gamma genau am Geld, und das Gamma pro Kontrakt skaliert ungefähr mit `1/√T`. Da `T` in Bruchteilen eines Tages gemessen wird, ist dieser Nenner klein - und das Gamma pro Kontrakt wird sehr groß. Unter sonst gleichen Bedingungen kann ein 0DTE-Kontrakt am Geld erheblich mehr Gamma tragen als ein länger laufender Kontrakt, aber das Verhältnis hängt von Volatilität, Moneyness, Zinsen und der genauen Restlaufzeit ab.

Die praktische Konsequenz: Der 0DTE-Bucket kann überproportional zur modellierten Intraday-Sensitivität des Dealer-Hedgings beitragen. Selbst wenn das gesamte Open Interest von längerfristigen Strikes dominiert wird, ist die *gamma-gewichtete* Exposure nahe am Spot oft eine 0DTE-Geschichte.

---

## Warum 0DTE-Positionierung intraday wichtig sein kann

Drei Faktoren summieren sich bei 0DTE auf eine Weise, die bei längeren Laufzeiten nicht gleichermaßen auftritt:

1. **Gamma-Konzentration.** Optionen mit Fälligkeit am selben Tag tragen am Geld ein sehr hohes Gamma. Hedging-Trades gegen dieses Gamma sind pro Bewegungseinheit groß, was die Kursbewegung nahe am Spot mechanisch lauter macht.
2. **Charm-Zerfall.** Wenn sich 0DTE-Optionen dem Verfall nähern, verschiebt sich ihr Delta in Richtung 0 (aus dem Geld) oder ±1 (im Geld - +1 bei Calls, −1 bei Puts), bei konstantem Spot und konstanter Vol. Dealer, die ein delta-neutrales Buch führen, tendieren dazu, diese Drift bis zum Handelsschluss neu abzusichern. Dieser Flow hat ein modelliertes Vorzeichen - und ist im Voraus schätzbar.
3. **Pin-Physik.** Dieselbe Gamma-Konzentration, die 0DTE-Dealer pro Tick stark bewegt, lässt auch den gewichtigsten 0DTE-Strike in einem Long-Gamma-Regime als Magneten wirken. Pin-Verhalten fällt bei 0DTE tendenziell schärfer aus als bei Mehrtages-Setups.

Keiner dieser Mechanismen ist exklusiv für 0DTE - sie gelten für jede kurzlaufende Option. Sie sind im 0DTE-Bucket nur ungewöhnlich ausgeprägt, weil `T` so stark komprimiert ist.

---

## Negative-Gamma-0DTE-Regime

Wenn Dealer netto short in Gamma sind - typischerweise, wenn der Spot unter dem Gamma Flip liegt - wird der 0DTE-Flow schnell unruhig.

Was der Reflex bewirkt:

- Eine Aufwärtsbewegung führt tendenziell dazu, dass Dealer *kaufen*, was die Bewegung verstärkt.
- Eine Abwärtsbewegung führt tendenziell dazu, dass Dealer *verkaufen*, was die Bewegung verstärkt.
- Die realisierte Intraday-Volatilität tendiert zur Ausweitung.
- Eine Wall, die nachgibt, kann sich in einen Beschleuniger umkehren, wobei das Hedging den Bruch verstärkt.
- Pin-Verhalten nahe dem gewichtigsten 0DTE-Strike schwächt sich ab oder kehrt sich um.

Wie das Tape typischerweise aussieht:

- Größere Ranges, schnellere Breakouts.
- Das Fortsetzungsrisiko kann größer sein, als ein Long-Gamma-Modell nahelegen würde.
- Mean-Reversion-Einstiege können auf verstärkenden modellierten Hedge-Flow treffen.
- Gerichtete Bewegungen und Veränderungen der impliziten Volatilität können den raschen Theta-Zerfall ausgleichen; das Prämienverhalten wird nicht allein vom Gamma-Vorzeichen bestimmt.

Die praktische Tendenz in einem Short-Gamma-0DTE-Regime ist **mit der Bewegung, nicht dagegen**. Trend-Fortsetzungs-Setups passen möglicherweise besser zum modellierten Hedge-Reflex; das ist eine bedingte Tendenz der Marktstruktur, keine belegte Aussage über Trefferquoten.

---

## Positive-Gamma-0DTE-Regime

Wenn Dealer netto long in Gamma sind - typischerweise, wenn der Spot über dem Gamma Flip liegt - tendiert der 0DTE-Flow zur Kompression.

Was der Reflex bewirkt:

- Eine Aufwärtsbewegung führt tendenziell dazu, dass Dealer *verkaufen*, was die Bewegung dämpft.
- Eine Abwärtsbewegung führt tendenziell dazu, dass Dealer *kaufen*, was die Bewegung dämpft.
- Die realisierte Intraday-Volatilität tendiert zur Kompression.
- Das Hedging rund um die Walls stemmt sich gegen Bewegungen auf sie zu.
- Pin-Verhalten nahe dem gewichtigsten 0DTE-Strike verstärkt sich zum Handelsschluss hin.

Wie das Tape typischerweise aussieht:

- Engere Ranges und mehr Chop, wobei sich das Hedging gegen Breakouts stemmt.
- Zug-zum-gewichtigsten-Strike-Verhalten, besonders nach 14:00 Uhr ET.
- Der rasche Theta-Zerfall kann auf Prämien für Optionen mit Fälligkeit am selben Tag lasten, aber Bewegungen von Spot und impliziter Volatilität können ihn überlagern.
- Mean-Reversion-Setups passen möglicherweise besser zum modellierten Hedge-Reflex als Trend-Fortsetzungs-Setups.

Die praktische Tendenz in einem Long-Gamma-0DTE-Regime ist **gegen den Breakout, mit dem Pin**. Verkaufte Rallyes in die Call Wall hinein, Dip-Käufe in die Put Wall hinein und Short-Prämien-Strukturen stützen sich allesamt auf den dämpfenden Reflex.

---

## Wie man das Tape in jedem Regime unterschiedlich liest

Ein paar Gewohnheiten, die sich zwischen den beiden Regimen ändern:

**In einem Negative-Gamma-0DTE-Regime:**

- Gib Breakouts der jüngsten Range mehr Spielraum, besonders wenn Net GEX groß und negativ ist: Wenn ein Level nachgibt, verstärkt das Hedging die Bewegung.
- Behandle 0DTE-Walls nicht als Decken: Wenn eine nachgibt, verstärkt das Hedging die Bewegung, statt sich gegen sie zu stemmen.
- Sei skeptisch gegenüber "das wird pinnen"-Setups - der Dealer-Reflex zieht nicht.
- Wenn unabhängige Volatilitätsmaße eine Sitzung mit breiterer Range bestätigen, dimensioniere das Risiko entsprechend; das modellierte Gamma-Vorzeichen allein gibt keinen Stop vor.

**In einem Positive-Gamma-0DTE-Regime:**

- Rechne damit, dass Bewegungen in 0DTE-konzentrierte Strikes hinein auf Hedging treffen, das sich gegen sie stemmt.
- Behandle den gewichtigsten Gamma-Strike als Magneten, besonders zum Handelsschluss hin.
- Sei skeptisch gegenüber Breakouts - das Hedging stemmt sich gegen sie, und gescheiterte Breakouts können zehn oder fünfzehn Minuten brauchen, bis sie sich auflösen.
- Engere Stops sind eher angemessen; die Ranges sind stärker begrenzt.

**In jedem Regime:**

- Prüfe, ob der Spot nahe am Gamma Flip liegt. Ein umkämpftes Regime ist das schlechteste Regime, um sich auf eines der beiden Playbooks festzulegen.
- Prüfe, ob der gewichtigste 0DTE-Strike wandert. Ein statischer schwerer Strike ist ein stärkerer Pin-Kandidat als ein wandernder.
- Verfolge Net GEX als Größenordnung, nicht nur als Vorzeichen. Ein Wechsel von −2 Mrd. $ auf +200 Mio. $ ist eine ganz andere Lesart als ein Wechsel von +2 Mrd. $ auf +200 Mio. $.

---

## 0DTE-Dealer-Positionierung auf ZeroGEX lesen

Das Dashboard zeigt an mehreren Stellen 0DTE-spezifische Lesarten:

- **Die Net-GEX-Karte** zeigt das am Spot bewertete Dealer-Gamma (vorzeichenkonsistent mit dem Flip) und liefert dir die Größenordnung des aktuellen Regimes.
- **Die Strike-nach-DTE-GEX-Heatmap** schlüsselt das Gamma nach Verfalls-Bucket auf, sodass du sehen kannst, wie viel der heutigen Positionierung 0DTE-getrieben ist und wo die gewichtigsten Strikes mit Fälligkeit am selben Tag liegen.
- **Die Wall- und Flip-Karten** zeigen die heutigen strukturellen Niveaus mit der Live-Distanz zum Spot.

![ZeroGEX Strike-nach-DTE-GEX-Heatmap mit dem 0DTE-Bucket konzentriert nahe am Spot](/blog/zerogex-strike-dte-heatmap.png)

Ein durchgerechnetes Beispiel. Angenommen, SPX steht bei 5.825, Net GEX zeigt −800 Mio. $, der Gamma Flip liegt bei 5.840, und die Heatmap zeigt einen gewichtigen 0DTE-Put-Strike bei 5.820, der den ganzen Morgen mit dem Preis nach unten gewandert ist. Die strukturelle Lesart: Dealer sind short in Gamma, der Spot liegt unter dem Flip, und der gewichtigste 0DTE-Strike folgt der Bewegung, statt sie zu halten.

Praktische Tendenz: Dies ist ein Short-Gamma-Regime, das Fortsetzungen begünstigt, und der gewichtigste Put-Strike wandert mit dem Preis, sodass sich das Level, auf das sich ein Fade stützen würde, ständig verschiebt. Ein Trader, der mit einem Mean-Reversion-Bias in die Sitzung gegangen ist, sollte hier deutlich vorsichtiger sein, weil das Hedging mit der Bewegung läuft, statt sich gegen sie zu stemmen. Nichts davon ist ein Handelssignal - es ist Regime-Kontext, der beeinflussen sollte, welche Einstiege man ernst nimmt.

![ZeroGEX Net-GEX- und Gamma-Flip-Karten mit einer negativen Intraday-Gamma-Lesart](/blog/zerogex-net-gex-flip-card.png)

---

## Häufige Fehler beim Lesen des 0DTE-Dealer-Gammas

Eine kurze Liste, wie 0DTE-Dealer-Positionierung falsch gelesen wird:

- **Verwendung des Gesamt-OI-Gammas in einer 0DTE-dominierten Chain.** Wenn der größte Teil des heutigen Gammas 0DTE ist und du das aggregierte OI-Gamma liest, mittelst du in deiner Lesart ein fast verfallendes Buch mit einem weit entfernten Buch, das für das heutige Tape keine Rolle spielt.
- **Einen Wall-Fade in beiden Regimen gleich dimensionieren.** Walls brachen in unserer Messung in beiden Regimen etwa gleich oft, aber bei negativem Gamma verstärkt das Hedging den Bruch, wenn eine Wall nachgibt, sodass ein gescheiterter Fade viel weiter laufen kann.
- **Das Regime ignorieren und das Niveau handeln.** Spot an der Put Wall ist über dem Flip ein Trade und darunter ein ganz anderer.
- **Migration ignorieren.** Ein gewichtiger 0DTE-Strike, der sich in der letzten Stunde zweimal bewegt hat, ist eine andere Lesart als einer, der den ganzen Morgen statisch geblieben ist.
- **0DTE-Pin-Verhalten als garantiert behandeln.** Es ist eine Tendenz, kein Versprechen. Katalysatoren und Flow-Schocks brechen den Pin regelmäßig.

---

## Fazit

> 0DTE hat verändert, welcher Teil des modellierten Dealer-Buchs intraday ins Gewicht fallen kann. Die Gesamtpositionierung zählt, und der *0DTE-Bucket* kann in manchen Sitzungen die Sensitivität nahe am Spot dominieren.

Die Disziplin ist dieselbe wie bei jeder Dealer-Positionierungslesart - beginne mit dem Regime, lies dann die Struktur darin -, aber der 0DTE-Bucket kann während der Kassasitzung einen großen Teil der Sensitivität nahe am Spot tragen, deshalb sollte er geprüft und nicht einfach als dominant vorausgesetzt werden.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige Dealer-Positionierung sehen willst - das Regime, die Call- und Put-Walls und das Dealer-Gamma-Profil -, zeigen dir [die kostenlosen ZeroGEX-Gamma-Levels-Seiten](/spx-gamma-levels) das für SPX, SPY, QQQ und NDX, rund 15 Minuten verzögert. Die bezahlten Pläne zeigen dieselbe Lesart [im Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte), und der Expirations-Filter auf der Seite Dealer Positioning isoliert die gewichtigsten Strikes mit Fälligkeit am selben Tag.
