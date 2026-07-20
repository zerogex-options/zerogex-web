# 0DTE-Dealer-Positionierung erklärt

*Verfallsoptionen mit Fälligkeit am selben Tag dominieren mittlerweile den SPX-Flow. Das verändert, wie man die Dealer-Gamma liest — und wie das Tape gelesen werden muss, um Schritt zu halten. 0DTE-Dealer-Positionierung, erklärt für den praktisch orientierten Intraday-Trader.*

---

## Warum 0DTE die Lesart verändert

Dealer-Positionierung war für Optionshändler schon immer relevant. Was sich in den letzten Jahren verändert hat, ist die **Dominanz des 0DTE-Flows** in SPX und SPY. Optionen mit Fälligkeit am selben Tag tragen inzwischen einen überproportionalen Anteil der gesamten Gamma-Exposure, und weil ihre Gamma nahe am Spotpreis konzentriert ist und zum Handelsschluss hin abklingt, ist das dadurch erzwungene Dealer-Hedging schärfer, reaktiver und stärker regimeabhängig als bei jeder früheren Chain-Struktur.

Wenn du SPX während der Kassasitzung handelst und die Dealer-Positionierung nicht durch die 0DTE-Linse liest, liest du ein veraltetes Buch.

Dieser Artikel ist die praktische Einordnung dessen, was "0DTE-Dealer-Positionierung" und "Dealer-Gamma 0DTE" in Echtzeit tatsächlich bedeuten. Wir behandeln, warum der 0DTE-Bucket wichtiger ist als längerfristiges Bucketing, was sich zwischen negativen und positiven Gamma-Regimen speziell für 0DTE ändert, und wie man das Tape in beiden Fällen unterschiedlich liest. Kombiniere diesen Artikel mit [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip) für die Regime-Linie selbst, [Gamma Walls erklärt](/education/gamma-walls-explained) für die Grenzniveaus und dem [Gamma-Exposure-Pillar](/education/gamma-exposure-explained) für den vollständigen strukturellen Hintergrund.

---

## Was ist 0DTE-Dealer-Positionierung?

0DTE-Dealer-Positionierung ist die aggregierte Gamma-Exposure, die Dealer bei Optionen mit Fälligkeit am selben Tag halten. Mechanisch unterscheidet sie sich nicht von längerfristiger Dealer-Gamma — Calls, die Dealer leerverkauft halten, tragen positiv zur Dealer-Gamma bei, leerverkaufte Puts tragen negativ bei, und der Hedging-Reflex ist derselbe: Delta neutral halten, den Basiswert handeln, während sich die Gamma ändert.

Was 0DTE anders macht, ist die **Gamma-Dichte**. Optionen mit Fälligkeit am selben Tag tragen ihre größte Gamma genau am Geld, und die Gamma pro Kontrakt skaliert ungefähr mit `1/√T`. Da `T` in Bruchteilen eines Tages gemessen wird, ist dieser Nenner klein — und die Gamma pro Kontrakt wird sehr groß. Ein 0DTE-Strike nahe am Spot kann einen Monats-Strike auf demselben Niveau um eine Größenordnung übertreffen.

Die praktische Konsequenz: Der 0DTE-Bucket bestimmt überproportional das Intraday-Hedging der Dealer. Selbst wenn das gesamte Open Interest von längerfristigen Strikes dominiert wird, ist die *gamma-gewichtete* Exposure nahe am Spot oft eine 0DTE-Geschichte.

---

## Warum Dealer-Positionierung bei 0DTE am wichtigsten ist

Drei Faktoren summieren sich bei 0DTE auf eine Weise, die bei längeren Laufzeiten nicht gleichermaßen auftritt:

1. **Gamma-Konzentration.** Optionen mit Fälligkeit am selben Tag tragen am Geld eine sehr hohe Gamma. Hedging-Trades gegen diese Gamma sind pro Bewegungseinheit groß, was die Kursbewegung nahe am Spot mechanisch lauter macht.
2. **Charm-Zerfall.** Wenn sich 0DTE-Optionen dem Verfall nähern, verschiebt sich ihr Delta vorhersehbar in Richtung 0 oder 1, je nach Moneyness. Dealer, die ein delta-neutrales Buch führen, müssen sich bis zum Handelsschluss kontinuierlich neu absichern. Dieser erzwungene Flow hat ein Vorzeichen — und ist direkt ablesbar.
3. **Pin-Physik.** Dieselbe Gamma-Konzentration, die 0DTE-Dealer pro Tick stark bewegt, macht auch den gewichtigsten 0DTE-Strike in einem Long-Gamma-Regime zu einem Magneten. Pin-Verhalten fällt bei 0DTE tendenziell schärfer aus als bei Mehrtages-Setups.

Keiner dieser Mechanismen ist exklusiv für 0DTE — sie gelten für jede kurzlaufende Option. Sie sind im 0DTE-Bucket nur ungewöhnlich ausgeprägt, weil `T` so stark komprimiert ist.

---

## Negative-Gamma-0DTE-Regime

Wenn Dealer netto short in Gamma sind — typischerweise, wenn der Spot unter dem Gamma Flip liegt — wird der 0DTE-Flow schnell unruhig.

Was der Reflex bewirkt:

- Eine Aufwärtsbewegung zwingt Dealer zum *Kaufen*, was die Bewegung verstärkt.
- Eine Abwärtsbewegung zwingt Dealer zum *Verkaufen*, was die Bewegung verstärkt.
- Die realisierte Intraday-Volatilität tendiert zur Ausweitung.
- Walls werden als Widerstand und Unterstützung unzuverlässiger — sie können sich in Breakout-Ziele umkehren.
- Pin-Verhalten nahe dem gewichtigsten 0DTE-Strike schwächt sich ab oder kehrt sich um.

Wie das Tape typischerweise aussieht:

- Größere Ranges, schnellere Breakouts.
- Fortsetzungsbewegungen häufiger als Umkehrungen.
- Mean-Reversion-Einstiege gegen den Trend werden häufig überrollt.
- Prämien für Optionen mit Fälligkeit am selben Tag tendieren dazu, sich intraday auszuweiten statt zu komprimieren.

Die praktische Tendenz in einem Short-Gamma-0DTE-Regime ist **mit der Bewegung, nicht dagegen**. Trend-Fortsetzungs-Setups haben tendenziell höhere Trefferquoten; gegen den Trend in die 0DTE-Konzentration zu fahren bedeutet, strukturell gegen den Dealer-Reflex zu kämpfen.

---

## Positive-Gamma-0DTE-Regime

Wenn Dealer netto long in Gamma sind — typischerweise, wenn der Spot über dem Gamma Flip liegt — tendiert der 0DTE-Flow zur Kompression.

Was der Reflex bewirkt:

- Eine Aufwärtsbewegung zwingt Dealer zum *Verkaufen*, was die Bewegung dämpft.
- Eine Abwärtsbewegung zwingt Dealer zum *Kaufen*, was die Bewegung dämpft.
- Die realisierte Intraday-Volatilität tendiert zur Kompression.
- Walls verhalten sich eher wie echter Widerstand und echte Unterstützung.
- Pin-Verhalten nahe dem gewichtigsten 0DTE-Strike verstärkt sich zum Handelsschluss hin.

Wie das Tape typischerweise aussieht:

- Engere Ranges, mehr Chop, mehr fehlgeschlagene Breakouts.
- Zug-zum-gewichtigsten-Strike-Verhalten, besonders nach 14:00 ET.
- Prämien für Optionen mit Fälligkeit am selben Tag tendieren zum Nachgeben.
- Mean-Reversion-Setups haben tendenziell höhere Trefferquoten als Trend-Fortsetzung.

Die praktische Tendenz in einem Long-Gamma-0DTE-Regime ist **gegen den Breakout, mit dem Pin**. Verkaufte Rallyes in die Call Wall hinein, Dip-Käufe in die Put Wall hinein und Short-Prämien-Strukturen profitieren allesamt vom dämpfenden Reflex.

---

## Wie man das Tape in jedem Regime unterschiedlich liest

Ein paar Gewohnheiten, die sich zwischen den beiden Regimen ändern:

**In einem Negative-Gamma-0DTE-Regime:**

- Nimm Breakouts der jüngsten Range ernster, besonders wenn Net GEX groß und negativ ist.
- Behandle 0DTE-Walls als Ziele, nicht als Decken.
- Sei skeptisch gegenüber "das wird pinnen"-Setups — der Dealer-Reflex zieht nicht.
- Positioniere für weitere Stops; die realisierte Volatilität ist strukturell höher.

**In einem Positive-Gamma-0DTE-Regime:**

- Setze standardmäßig auf das Verkaufen von Bewegungen in 0DTE-konzentrierte Strikes hinein.
- Behandle den gewichtigsten Gamma-Strike als Magneten, besonders zum Handelsschluss hin.
- Sei skeptisch gegenüber Breakouts — sie scheitern häufiger.
- Engere Stops sind eher angemessen; die Ranges sind stärker begrenzt.

**In jedem Regime:**

- Prüfe, ob der Spot nahe am Gamma Flip liegt. Ein umkämpftes Regime ist das schlechteste Regime, um sich auf eines der beiden Playbooks festzulegen.
- Prüfe, ob der gewichtigste 0DTE-Strike wandert. Ein statischer schwerer Strike ist ein stärkerer Pin-Kandidat als ein wandernder.
- Verfolge Net GEX als Größenordnung, nicht nur als Vorzeichen. Ein Wechsel von −2 Mrd. USD auf +200 Mio. USD ist eine ganz andere Lesart als ein Wechsel von +2 Mrd. USD auf +200 Mio. USD.

---

## 0DTE-Dealer-Positionierung auf ZeroGEX lesen

Das Dashboard zeigt an mehreren Stellen 0DTE-spezifische Lesarten:

- **Die Net-GEX-Karte** zeigt die am Spot bewertete Dealer-Gamma (vorzeichenkonsistent mit dem Flip) und liefert dir die Größenordnung des aktuellen Regimes.
- **Die Strike-nach-DTE-GEX-Heatmap** schlüsselt die Gamma nach Verfalls-Bucket auf, sodass du sehen kannst, wie viel der heutigen Positionierung 0DTE-getrieben ist und wo die gewichtigsten Strikes mit Fälligkeit am selben Tag liegen.
- **Die Wall- und Flip-Karten** zeigen die heutigen strukturellen Niveaus mit der Live-Distanz zum Spot.

![ZeroGEX Strike-nach-DTE-GEX-Heatmap mit dem 0DTE-Bucket konzentriert nahe am Spot](/blog/zerogex-strike-dte-heatmap.png)

Ein durchgerechnetes Beispiel. Angenommen, SPX steht bei 5.825, Net GEX zeigt −800 Mio. USD, der Gamma Flip liegt bei 5.840, und die Heatmap zeigt einen gewichtigen 0DTE-Put-Strike bei 5.820, der den ganzen Morgen mit dem Preis nach unten gewandert ist. Die strukturelle Lesart: Dealer sind short in Gamma, der Spot liegt unter dem Flip, und der gewichtigste 0DTE-Strike folgt der Bewegung, statt sie zu halten.

Praktische Tendenz: Dies ist ein Short-Gamma-Regime, das Fortsetzungen begünstigt, wobei der wandernde Put-Strike die Abwärtsbewegung bestätigt statt ihr zu widerstehen. Ein Trader, der mit einem Mean-Reversion-Bias in die Sitzung gegangen ist, sollte hier deutlich vorsichtiger sein, weil die 0DTE-Struktur aktiv in die andere Richtung zeigt. Nichts davon ist ein Handelssignal — es ist Regime-Kontext, der beeinflussen sollte, welche Einstiege man ernst nimmt.

![ZeroGEX Net-GEX- und Gamma-Flip-Karten mit einer negativen Intraday-Gamma-Lesart](/blog/zerogex-net-gex-flip-card.png)

---

## Häufige Fehler beim Lesen der 0DTE-Dealer-Gamma

Eine kurze Liste, wie 0DTE-Dealer-Positionierung falsch gelesen wird:

- **Verwendung der Gesamt-OI-Gamma in einer 0DTE-dominierten Chain.** Wenn der größte Teil der heutigen Gamma 0DTE ist und du die aggregierte OI-Gamma liest, mittelst du in deiner Lesart ein fast verfallendes Buch mit einem weit entfernten Buch, das für das heutige Tape keine Rolle spielt.
- **Walls in einem Negative-Gamma-Regime als dauerhaft behandeln.** Das sind sie nicht. Sie werden zu Breakout-Zielen.
- **Das Regime ignorieren und das Niveau handeln.** Spot an der Put Wall ist über dem Flip ein anderer Trade als darunter.
- **Migration ignorieren.** Ein gewichtiger 0DTE-Strike, der sich in der letzten Stunde zweimal bewegt hat, ist eine andere Lesart als einer, der den ganzen Morgen statisch geblieben ist.
- **0DTE-Pin-Verhalten als garantiert behandeln.** Es ist eine Tendenz, kein Versprechen. Katalysatoren und Flow-Schocks brechen den Pin regelmäßig.

---

## Fazit

> 0DTE hat verändert, welcher Teil des Dealer-Buchs tatsächlich das Tape bewegt. Die Gesamtpositionierung zählt; der *0DTE-Bucket* dominiert die Intraday-Lesart.

Die Disziplin ist dieselbe wie bei jeder Dealer-Positionierungslesart — beginne mit dem Regime, lies dann die Struktur darin — aber der 0DTE-Bucket ist der Ort, an dem mittlerweile der Großteil der Gamma während der Kassasitzung liegt, und ihn zu ignorieren bringt dich eine Sitzung ins Hintertreffen.

Nur Bildungsinhalte — nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige 0DTE-Dealer-Positionierung in Echtzeit sehen willst — das Regime, die gewichtigsten Strikes mit Fälligkeit am selben Tag, die Live-Walls und das Dealer-Gamma-Profil — zeigt das kostenlose ZeroGEX-Dashboard all das an.
