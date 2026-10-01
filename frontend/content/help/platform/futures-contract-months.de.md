# Warum unser Futures-Kurs von einer anderen Plattform abweichen kann

*Warum eine ES- oder NQ-Quotierung hier einige hundert Punkte vom selben Ticker in einem anderen Chart entfernt liegen kann - und warum beide Zahlen richtig sind.*

---

**Kurze Antwort:** Wir quotieren möglicherweise einen anderen Kontraktmonat als der Chart, mit dem du vergleichst. Beide Zahlen sind korrekt. Es sind unterschiedliche Instrumente.

## Futures handeln als datierte Kontrakte

ES und NQ haben keinen einzigen Preis. Sie handeln als separate Kontrakte mit Verfall im März, Juni, September und Dezember, und mehrere davon handeln gleichzeitig zu unterschiedlichen Preisen.

Das ist keine Eigenheit unserer Daten, sondern die Art, wie die Börse sie listet: Ein S&P-500-Future mit Abwicklung in drei Monaten und einer mit Abwicklung nächste Woche sind zwei verschiedene Kontrakte mit zwei verschiedenen Orderbüchern, und bis der nähere verfällt, zwingt nichts ihre Preise zusammen.

Wir quotieren den Kontrakt, der das Volumen trägt - den, der aktiv gehandelt wird.

## Kontrakte rollen jedes Quartal

Etwa eine Woche vor dem Verfall eines Kontrakts wandert das Handelsvolumen in den nächsten. Datenanbieter stellen ihre Feeds an diesem Punkt um - aber **nicht alle am selben Tag**. Jeder Anbieter wählt seinen eigenen Auslöser: eine feste Anzahl Tage vor Verfall, eine Überkreuzung von Volumen oder Open Interest, oder eine vor Jahren festgelegte Kalenderregel.

In der Woche oder so zwischen der Umstellung des einen Anbieters und der des anderen zeigen zwei Plattformen, die beide "NQ" draufschreiben, unterschiedliche Kontrakte. Keine davon ist defekt. Sie beantworten nur leicht unterschiedliche Fragen danach, was "NQ" heute bedeutet.

Genau das ist die Ursache der Abweichung, und deshalb veröffentlichen wir kein einzelnes Roll-Datum: Es gibt keines.

## Die Lücke ist Cost of Carry

Ein Kontrakt mit Abwicklung in drei Monaten ist mehr wert als einer mit Abwicklung diese Woche. Die Differenz sind die Kosten der Finanzierung der Position bis dahin, abzüglich der Dividenden, auf die du verzichtest, wenn du Futures statt der Aktien hältst.

Bei einem Quartalsroll sind das typischerweise etwa **1 % bei NQ** und **0,8 % bei ES**. Bei NQ ist es mehr, weil der Nasdaq-100 weniger Dividende zahlt als der S&P 500, sein Carry also höher ist.

Bei NQ sind das einige hundert Punkte - genug, um wie ein defekter Feed auszusehen. Genau deshalb benennen wir den Kontrakt direkt, statt es dir zu überlassen, das selbst herzuleiten.

Dieselbe Rechnung erklärt eine Stufe in einem mehrtägigen Chart. Ein Zeitraum, der über einen Roll hinweggeht, enthält tatsächlich zwei Kontrakte, der Preis springt also dort, wo der eine endet und der nächste beginnt. Diese Stufe ist Carry, keine Marktbewegung, und Charts, die einen Roll kreuzen, sagen das auch.

## So prüfst du das

1. Fahre mit der Maus über das Kontrakt-Badge in einer ES- oder NQ-Ansicht, tippe es an oder fokussiere es per Tastatur. Es benennt genau den Kontrakt, den wir quotieren, und wann dieser Kontrakt verfällt.
2. Stelle deine andere Plattform auf denselben Kontrakt.
3. Die Preise sollten übereinstimmen.

Ist dein anderer Feed verzögert - viele kostenlose Feeds laufen 10-15 Minuten hinterher -, bleibt eine kleine Lücke aus der Verzögerung selbst. Die beträgt ein paar Punkte, nicht ein paar hundert.

## Wann sich das auflöst

Sobald der alte Kontrakt verfallen ist, sind alle Plattformen auf dem neuen und die Differenz verschwindet. Sie kommt beim nächsten Quartalsroll wieder und verhält sich jedes Mal gleich.

## Betrifft das die Dealer-Level?

Nein. Der Gamma-Flip, die Walls, Max Pain und der Rest werden aus den SPX- und NDX-Optionsketten berechnet und dann mit dem theoretischen Carry des Kontrakts, den wir quotieren, auf die Futures-Preisachse projiziert. Bei einem Roll wandert die Projektion zusammen mit dem Preis auf den Carry des neuen Kontrakts, die Level folgen also immer dem Kontrakt, den wir quotieren, ohne dass du einen Basis-Offset einstellen musst. Weil Carry den fairen Wert abbildet, können die Level leicht danebenliegen, wenn die Futures über oder unter ihrem fairen Wert handeln. Wie ES und NQ ausgeliefert werden, steht unter [Datenabdeckung & Aktualisierung](/help/platform/data-coverage).

## Stimmt es noch immer nicht?

Wenn beide Seiten auf demselben Kontrakt sind und die Preise trotzdem stärker abweichen, als die Verzögerung erklärt, ist es etwas anderes. Schreib uns an [support@zerogex.io](mailto:support@zerogex.io) mit Screenshot und Zeitstempel.

## Siehe auch

- [Datenabdeckung & Aktualisierung](/help/platform/data-coverage)
- [Fehlerbehebung](/help/platform/troubleshooting)
- [So liest du ZeroGEX-Charts](/help/platform/reading-charts)
