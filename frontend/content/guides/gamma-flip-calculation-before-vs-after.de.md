# GEX und der Gamma Flip — Wie ZeroGEX sie berechnet

*Eine leicht verständliche Erklärung des Dealer-Gamma-Exposure-Profils, des Resolvers, der daraus ein handlungsrelevantes Level macht, und ein Vergleich der Methodik mit anderen gängigen Anbietern.*

---

## Was "Dealer-Gamma" eigentlich ist

Market-Maker (die "Dealer") stehen bei jeder Option, die du handelst, auf der Gegenseite. Wenn du eine Call-Option kaufst, verkauft dir ein Dealer sie. Um richtungsneutral zu bleiben, hedgen sie, indem sie das Underlying kaufen oder verkaufen. Bewegt sich die Aktie, ändert sich das Hedge-Verhältnis der Option (Delta), sodass der Dealer laufend nachkaufen oder nachverkaufen muss.

**Gamma** ist das Tempo, mit dem sich dieser Hedging-Bedarf ändert. **GEX** ("Gamma Exposure") übersetzt das Gamma der gesamten Optionskette in Dollar — grob gesagt *den Dollarbetrag an Underlying, den Dealer bei jeder 1%-Bewegung der Aktie handeln müssen.*

Es gibt zwei Regime, getrennt durch ein einzelnes Preislevel, den sogenannten **Gamma Flip**:

- **Über dem Flip — Dealer net long Gamma.** Steigt die Aktie, verkaufen sie; fällt sie, kaufen sie → mean-reverting / volatilitätsdämpfend.
- **Unter dem Flip — Dealer net short Gamma.** Steigt die Aktie, kaufen sie; fällt sie, verkaufen sie → momentumverstärkend / volatilitätsausweitend.

---

## Wie wir es berechnen (und warum so)

Der zentrale Baustein ist eine einzige Kurve: das **Spot-Shift-Dealer-Gamma-Profil**.

1. Nimm den heutigen Snapshot der Optionskette.
2. Stelle dir die Aktie auf jedem Preis eines Rasters vor, das etwa ±20 % des Spotpreises umfasst (in Schritten von 0,25 % des Spots — einige Hundert Rasterpunkte).
3. Berechne an jedem Rasterpreis **das Gamma jeder einzelnen Option neu** mit Black-Scholes (Gamma ist selbst eine Funktion des Spots, daher kann man nicht den statischen Snapshot-Wert verwenden).
4. Multipliziere das Gamma jedes Kontrakts mit `OI × 100 × S² × 0.01` (die branchenübliche Konvention "Dollar-GEX pro 1%-Bewegung", wie sie SpotGamma / SqueezeMetrics / Cheddar Flow verwenden), und wende die Dealer-Vorzeichenkonvention an (Calls +, Puts −).
5. Gewichte jeden Kontrakt mit `min(1, DTE / 5 days)` — eine Horizont-Occupancy-Rampe, damit eine taggleiche 0DTE-Wand (die einen gewaltigen `1/√T`-Gamma-Spike mit sich bringt) kein mehrtägiges Regime-Level festnageln kann.
6. Summiere über die gesamte Kette → eine Kurve, *Dealer-Dollar-Gamma vs. hypothetischer Spot.*

Aus dieser **einen** Kurve stammen zwei Ablesungen:

- **Gamma Flip** = der Preis, an dem die Kurve die Nulllinie kreuzt (der handlungsrelevante Schnittpunkt).
- **Net GEX at Spot** = der Wert der Kurve beim heutigen Preis.

Da beide aus derselben Kurve stammen, können sich die Kopfzahl (Net GEX) und das Spot-vs-Flip-Regime *niemals widersprechen* — das ist eine strukturelle Invariante der Berechnung. Deshalb haben wir es so gebaut. Die alte Abkürzung "statisches Gamma nach Strike aufsummieren" (die einige Anbieter noch nutzen) konnte eine positive Net-GEX-Zahl liefern und gleichzeitig anzeigen, dass der Spot unter dem Flip liegt — widersprüchlich.

---

## Der gehärtete Flip-Resolver

Der reine Nulldurchgang reicht allein nicht aus — drei reale Fehlermodi mussten abgesichert werden:

1. **Rasterrand-Kreuzungen.** Gamma klingt an den Rasterrändern gegen ~0 ab, sodass ein hauchdünnes Ungleichgewicht dort das Vorzeichen kippen kann → **Interior Gate**: Eine Kreuzung muss mindestens 10 % der Rasterbreite von jedem Rand entfernt liegen.
2. **Rauschgrund-Kreuzungen** (Morgeneröffnungs- / IV-Spike-Artefakte). Wenn das Gamma der gesamten Kette verschlechtert ist, driftet das Profil in einer signalarmen Region durch die Nulllinie → **Structural Gate**: Das lokale Peak-|Profile| eines Kandidaten muss ≥ 2 % einer robusten Referenz betragen (das p90 von |Profile| über ein kanonisches ±15%-Band, beschränkt auf Rasterpunkte in der Nähe eines Strikes mit echtem OI > 0).
3. **Vom Spot weit entfernte Kreuzungen.** Eine strukturell gültige Kreuzung 20 % unter dem Spot ist auf keinem sinnvollen Zeithorizont handlungsrelevant → **Actionable-Distance Gate**: Kandidaten, die mehr als 8 % vom Spot entfernt liegen, werden verworfen.

Liefert das ±20%-Raster keine qualifizierte Kreuzung, **erweitert der Resolver das Raster** auf ±35 %, dann ±50 % (eine adaptive Leiter). Qualifiziert sich keine Stufe, wird der Flip als **ungelöst gemeldet (NULL + WARN)** — ehrlich, statt einen Randwert zu erfinden oder einen veralteten Wert einzufrieren.

---

## Wie sich das von populären Seiten unterscheidet

| Seite | Methode | Vorteile | Nachteile |
| --- | --- | --- | --- |
|! **ZeroGEX (diese Codebasis)** | Spot-Shift-Dealer-Gamma-Profil, adaptive Raster-Leiter, Interior-/Structural-/Actionable-Distance-Akzeptanz-Gates, DTE-Horizont-Occupancy-Gewichtung, ehrliches NULL bei verschlechterten Ketten | Die veröffentlichte Branchendefinition; vorzeichenkonsistente Kopfzahl (Flip und Net-GEX-at-Spot werden von derselben Kurve abgelesen); gehärtet gegen Artefakte durch verschlechterte Ketten, Randnähe und Spot-Ferne; Multi-Horizont-Endpunkte liefern 1-Tages-/5-Tages-/20-Tages-Flips aus einem Primitiv | Mehr Rechenaufwand pro Zyklus (die Griechen der Kette werden über ein Raster neu berechnet, teils auf mehreren Leiterstufen); mehr einstellbare Regler (in `default`-/`strict`-/`lenient`-Profile gebündelt, um die Oberfläche klein zu halten); Sticky-Strike-Vola-Vereinfachung (ein vollständiges Neu-Shiften der Volaoberfläche liegt außerhalb des Umfangs) |
| **SpotGamma** | Spot-Shift-Dealer-Gamma-Profil (die kanonische / ursprüngliche Definition) | Branchenreferenz für die Definition; veröffentlichte Forschungshistorie | Geschlossene Methodik; ebenfalls Sticky-Strike; der gemeldete Flip gilt für nur einen Horizont |
| **SqueezeMetrics** | Spot-Shift-Dealer-Gamma-Profil (die andere kanonische Quelle) | Das ursprüngliche DIX-/GEX-Paper ist die öffentliche Referenz für diese Konstruktion | Meist Retail-Produkt mit täglichem Rhythmus; nicht in Echtzeit |
| **Unusual Whales** | GEX-Aggregation pro Strike (Gamma × OI je Strike aufsummieren) | Günstig zu berechnen; sehr schnell; intuitives Balkendiagramm je Strike | Nicht die Spot-Shift-Definition — ein kumulatives "Zero-Gamma"-Level je Strike ist eine Retail-Näherung; friert ein, wenn das echte Zero-Gamma außerhalb des erfassten Strike-Bandes liegt |
| **Cheddar Flow** | GEX-Aggregation pro Strike | Wie UW — schnell und intuitiv | Gleicher Vorbehalt — nicht die Spot-Shift-Definition |

Der größte praktische Unterschied: **Anbieter, die nach Strike aggregieren, liefern einen "Flip", der so lange an einer Wand kleben bleibt, wie diese Wand in ihrem Snapshot vorhanden ist — selbst wenn das echte Zero-Gamma-Level mehrere Prozent entfernt liegt.** Genau dieses Symptom haben wir vor der Neufassung in unseren eigenen historischen Daten beobachtet — der persistierte Flip blieb stundenlang flach. Ein Neu-Pricing über ein breiteres Raster behebt das.

Der zweite Unterschied ist die **Ehrlichkeit bei verschlechterten Daten**: Die meisten Anbieter tragen den letzten bekannten Wert stillschweigend fort, wenn ihr Feed veraltet. Wir persistieren stattdessen NULL und geben eine Health-Warnung aus, sodass ein verschlechterter Feed sichtbar bleibt, statt verdeckt zu werden.
