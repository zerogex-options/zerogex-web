# Gamma / VWAP Confluence erklärt - und warum zwei Symbole sich widersprechen können

*Was der Konfluenz-Score misst, wie der Cluster aufgebaut ist, warum das Gamma-Regime dasselbe Bild von einem Fade in einen Breakout verwandelt und warum SPX, SPY und QQQ am selben Nachmittag in entgegengesetzte Richtungen zeigen können.*

---

## Die Frage, die es beantwortet

Jedes Level der Dealer-Positionierung beantwortet eine etwas andere Frage. Der [Gamma Flip](/education/how-to-read-a-gamma-flip) markiert die Regimegrenze. Die [Walls](/education/gamma-walls-explained) markieren konzentriertes, einseitiges Gamma. [Max Pain](/education/max-pain-explained) markiert einen Settlement-Magneten. [Pin Strike](/education/pin-strike-explained) markiert einen erreichbaren Same-Day-Attraktor. VWAP markiert, wo das Volumen der Session tatsächlich gehandelt wurde.

An den meisten Tagen liegen sie verstreut, und du liest sie einzeln. Gelegentlich landen mehrere im selben schmalen Preisband - und das ist eine andere Situation, denn wenn unabhängig berechnete Levels übereinstimmen, ist das aussagekräftiger als jedes einzelne von ihnen.

Gamma / VWAP Confluence misst genau das: **Stapeln sich hier wichtige Levels, und was bedeutet es, dass der Preis dort steht, wo er relativ zu ihnen steht?**

Es ist ein Score von −100 bis +100. Das Vorzeichen gibt die Richtung an, der Betrag die Konfidenz, und das Regime entscheidet, wie beides zu lesen ist.

---

## Wie der Cluster aufgebaut ist

Der Cluster beginnt immer mit zwei Mitgliedern: **dem Gamma Flip und VWAP**. Diese beiden bilden den Kern, und an ihnen ist die „Konfluenz“ verankert.

Drei weitere Levels können hinzukommen, wenn sie nah genug liegen - **Max Pain, Max Gamma (der GEX King) und die Call Wall**. Jedes wird aufgenommen, wenn es innerhalb von **0,15 % um den Mittelpunkt zwischen Flip und VWAP** liegt. Das ist ein strenger Test: Bei SPX auf 7.700 sind das etwa 11 Punkte.

Eine Karte mit `Members: 2` bedeutet also, dass nur Flip und VWAP im Spiel sind. `Members: 4` bedeutet, dass zwei der optionalen Levels ebenfalls dazugekommen sind und die Zone wirklich dicht besetzt ist.

Das **Konfluenz-Level** ist einfach der Durchschnitt der Mitglieder, die sich qualifiziert haben. Das ist der Preis, an dem das ganze Signal gemessen wird.

Jedes zusätzliche Mitglied über die beiden Kernmitglieder hinaus erhöht den Betrag des Scores um 15 %. Vier Mitglieder bedeuten einen Multiplikator von 1,30× bei gleicher Geometrie - die Art des Modells zu sagen, dass ein Stapel aus vier Levels mehr Aufmerksamkeit verdient als einer aus zwei.

---

## Qualität: Wie eng ist der Cluster?

Mitgliedschaft ist das eine, Enge das andere. Der **Cluster-Abstand** ist die Distanz zwischen Flip und VWAP in Prozent des Preises, und er bestimmt die **Cluster-Qualität**:

```
cluster_quality = 1 − (cluster_gap % ÷ 1.0%)     floored at 0.05, capped at 1.00
```

Liegen Flip und VWAP 0,1 % auseinander, ergibt das eine Qualität nahe 0,90. Ein Abstand von 0,6 % ergibt etwa 0,40. Alles über 1,0 % landet am Boden von 0,05.

Dieser Boden ist wichtig, und er ist gewollt. Statt „keine Konfluenz“ zu erklären und null zurückzugeben, behält das Modell einen Bruchteilswert bei, weil eine harte Null ein seltenes Extrem sein sollte und kein alltägliches Ergebnis. Die praktische Folge: **Wenn die Qualität am Boden oder nahe daran liegt, ist der Score winzig, selbst wenn der Preis weit vom Cluster entfernt ist.** Ein Score von −5 ist kein schwaches bärisches Signal, sondern das Modell sagt dir damit, dass die beiden Anker-Levels nicht einmal in der Nähe voneinander liegen und es keinen echten Cluster zu lesen gibt.

Die Karte sagt das direkt. Unterhalb eines Scores von ±20 zeigt sie **„No confluence edge“** an, statt eine Richtung zu nennen.

---

## Das Regime entscheidet, was der Cluster bedeutet

Das ist der Teil, der viele überrascht, und es ist die wichtigste einzelne Idee auf dieser Seite.

Der Score geht davon aus, wo der Preis relativ zum Cluster steht:

```
distance = (price − confluence level) ÷ price
```

Diese Distanz ist so skaliert, dass ungefähr **±0,3 % den Wert sättigen** - darüber hinaus bringt ein größerer Abstand nichts mehr, weil das Modell nicht messen will, wie weit der Preis gelaufen ist, sondern nur, auf welcher Seite er steht und ob er sich festgelegt hat.

Dann entscheidet das [Gamma-Regime](/education/what-is-negative-gamma), was das bedeutet:

- **Negatives Gamma → Continuation.** Das Dealer-Hedging verstärkt Bewegungen. Vom Preis, der den Cluster verlassen hat, wird erwartet, dass er weiterläuft. Oberhalb des Clusters wird bullisch gelesen, unterhalb bärisch.
- **Positives Gamma → Mean Reversion, und das Vorzeichen kehrt sich um.** Das Dealer-Hedging dämpft Bewegungen. Dasselbe Bild spricht jetzt dafür, dass der Preis *zurück* zum Cluster gezogen wird. Oberhalb des Clusters wird **bärisch** gelesen, weil die erwartete Bewegung nach unten zu ihm hin geht. Der Wert wird außerdem auf 70 % seines Betrags gedämpft, weil ein Fade eine schwächere Aussage ist als ein Breakout.

Dieselbe Anordnung von Levels - gleicher Cluster, gleiche Seite, gleiche Distanz - erzeugt in den beiden Regimen also **entgegengesetzte Scores**. Das ist kein Widerspruch. Genau darum geht es: In dem einen Regime läuft der Markt vom Level weg, im anderen kehrt er zu ihm zurück.

---

## Warum SPX, SPY und QQQ sich widersprechen können

Das folgt direkt daraus, und es ist die Frage, die zu dieser Seite geführt hat.

Zwei Symbole können am selben Nachmittag entgegengesetzte Konfluenz-Scores liefern, obwohl beide einwandfrei funktionieren, und zwar aus zwei unabhängigen Gründen.

**Erstens können sie in unterschiedlichen Gamma-Regimen sein.** SPX und SPY bilden denselben Index ab, haben aber unterschiedliche Optionsbücher, und QQQ ist ein ganz anderer Index. Jedes hat sein eigenes Netto-Gamma und seinen eigenen Flip. Liegt eines in negativem Gamma und ein anderes in positivem, kehrt sich das Vorzeichen bei dem einen um und bei dem anderen nicht. Dasselbe Tape, entgegengesetzte Scores.

**Zweitens hat jedes seinen eigenen Cluster an seiner eigenen Stelle.** Das Konfluenz-Level wird aus dem Flip, dem VWAP und den Walls des jeweiligen Symbols gebildet. Diese liegen nicht bei allen Symbolen an derselben relativen Position. Der Preis kann im selben Moment über dem Cluster von SPX und unter dem von QQQ liegen, was das Vorzeichen erneut umdreht.

Jeder der beiden Gründe allein kehrt den Wert um. Beide zusammen sind ganz gewöhnlich.

Die praktische Empfehlung: **Nutze nicht den Konfluenz-Score eines Symbols, um ein anderes zu traden.** Lies den Score für das Instrument, das du tradest. Wenn du einen Abgleich zwischen Symbolen willst, vergleiche Regime und Cluster direkt, statt die Scores zu vergleichen, denn die Scores haben beides bereits eingerechnet.

---

## Es ist ein Live-Wert, kein Session-Bias

Der Score wird laufend neu berechnet. Er ist keine morgendliche Einschätzung, die bis zum Handelsschluss gilt.

Wenn der Preis das Konfluenz-Level kreuzt, dreht das Vorzeichen - und weil der Score-Verlauf nach dem aktuellen Vorzeichen eingefärbt wird, färbt sich die ganze Linie neu ein. Der Verlauf hat sich nicht geändert, nur seine Farbe. Ein Verlauf, der den ganzen Morgen grün war und jetzt rot ist, zeigt dir dieselben Daten unter einem neuen Vorzeichen.

Das bedeutet auch, dass sich der Score nur aktualisiert, solange der Markt geöffnet ist. Eine flache Linie bis in den Abend ist der zuletzt gespeicherte Wert, kein Signal, das noch läuft.

Es ist ein nachvollziehbarer Impuls, den Wert geglättet haben zu wollen, damit er über eine Session hinweg bestehen bleibt und größere Umkehrungen erfasst. Das würde ihn kaputt machen. Die einzige Aufgabe des Signals ist es, zu sagen, was *jetzt* gilt; eine Version, die ihre Meinung über einen Regimewechsel hinweg beibehielte, würde dir etwas über einen Markt erzählen, den es nicht mehr gibt.

---

## Das erwartete Ziel

Jede Karte veröffentlicht ein erwartetes Ziel, und es bedeutet je nach Regime etwas anderes:

- **Mean Reversion:** Das Ziel ist das Konfluenz-Level selbst. Die Aussage ist, dass der Preis zum Cluster zurückkehrt.
- **Continuation:** Das Ziel wird über den Preis hinaus projiziert, auf das Doppelte der Strecke, die er sich bereits vom Cluster entfernt hat. Die Aussage ist, dass sich die Bewegung fortsetzt.

Zwei ehrliche Vorbehalte. Das Ziel ist geometrisch - es skaliert nicht mit dem Score, sodass auch eine Karte mit niedriger Konfidenz ein weit entferntes Ziel ausweisen kann. Lies es zusammen mit dem Score und der Qualität, nicht für sich allein. Und bei Continuation ist es eine Extrapolation, kein gemessenes Level: Nichts im Optionsbuch sagt, dass der Preis dort stoppt.

---

## Ehrliche Grenzen

**Das Dealer-Vorzeichen ist modelliert, nicht beobachtet.** Wie überall sonst auf der Plattform ist die Frage, ob Dealer in einem Kontrakt long oder short sind, eine Konvention, die auf öffentliches Open Interest angewendet wird, keine Tatsache, die man vom Tape abliest. Das Regime, das die oben beschriebene Vorzeichenumkehr bestimmt, erbt diese Annahme.

**Der Cluster ist Arithmetik, kein Urteil.** Das Konfluenz-Level ist ein schlichter Durchschnitt der qualifizierten Mitglieder. Es gewichtet weder eine Wall nach ihrer Größe noch einen Flip danach, wie eindeutig er aufgelöst wurde.

**Zwei Mitglieder sind die Untergrenze, keine Empfehlung.** Jede Karte enthält mindestens Flip und VWAP, also bedeutet `Members: 2` mit großem Abstand, dass das Modell einen Nicht-Cluster meldet, nicht dass es einen gefunden hat. Prüfe die Qualität, bevor du das Vorzeichen liest.

**Es ist eine Positionierungs-Lesart, keine Prognose.** Wie jedes Gamma-Level beschreibt es, was das Hedging rund um eine Struktur *tendenziell* tut. Ein Katalysator überrollt es, und ein Level, das den ganzen Morgen respektiert wurde, verliert seine Bedeutung in dem Moment, in dem etwas Größeres eintrifft.

---

## So liest du es in der Praxis

1. **Prüfe zuerst Qualität und Mitglieder.** Niedrige Qualität bedeutet, dass es keinen Cluster gibt, was auch immer das Vorzeichen sagt. Unter ±20 zeigt die Karte „No confluence edge“, und das ist auch so gemeint.
2. **Prüfe dann das Regime-Badge.** Continuation und Mean Reversion sind entgegengesetzte Trades aus demselben Bild, und das Badge sagt dir, für welchen sich das Modell entscheidet.
3. **Lies dann Vorzeichen und Level.** Bei Mean Reversion ist das Konfluenz-Level das Ziel. Bei Continuation ist es das, was der Preis gerade verlässt.
4. **Lies es pro Symbol.** SPX, SPY und QQQ haben jeweils ihr eigenes Regime und ihren eigenen Cluster.

Den Live-Score, den Level-Stapel und den Score-Verlauf siehst du auf der Seite [Gamma / VWAP Confluence](/gamma-vwap-confluence).
