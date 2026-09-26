# Die Score-Linie von -100 bis +100 lesen

*Jeder Signal-Score liegt auf derselben Zahlenlinie. Was Vorzeichen und Betrag bedeuten, wann eine 0 keine Antwort ist und wann es Zeit zum Handeln ist.*

---

## Warum die Score-Linie fest ist

Jedes ZeroGEX-Signal - Advanced oder Basic - gibt seine Auswertung auf derselben Skala von **-100 bis +100** aus. (Intern berechnet jedes Signal einen Wert zwischen -1 und +1; die App zeigt ihn mit 100 multipliziert an.) Der Vorteil liegt auf der Hand: Signal-übergreifende Konfluenz wird zu einem fairen Vergleich. Ein +50 bei Squeeze Setup und ein +50 bei EOD Pressure drücken konzeptionell ähnliche Aussagen über die Zuversicht aus.

Der Preis dafür: Jedes Signal hat einen anderen **Trade-Bias**, sodass die Bedeutung eines +50 davon abhängt, von welchem Signal es stammt.

Die einzige zentrale Kennzahl, die nicht auf dieser Linie liegt, ist der Composite Score (MSI): ein 0-100-Regime-Gauge, bei dem 50 neutral ist. Siehe [Composite Score](/help/platform/composite-score).

## Vorzeichen

Bei Richtungssignalen bildet das Vorzeichen die erwartete Preisrichtung ab:

- **Positiv ⇒ bullische Tendenz** (Long-Richtung ist der Trade-Bias)
- **Negativ ⇒ bearische Tendenz**

Bei Mean-Reversion-Signalen (Positioning Trap, Trap Detection) bildet das Vorzeichen die **aufgelöste direktionale Tendenz** ab - der Trade läuft *gegen* die falsch positionierte Crowd oder den gescheiterten Ausbruch, sodass das Vorzeichen in dieselbe Richtung zeigt wie bei den Richtungssignalen oben:

- **Positiv ⇒ bullische Tendenz** - z. B. eine short/bärische Crowd, die Gefahr läuft, nach oben herausgesqueezt zu werden, oder ein gescheiterter Abwärtsausbruch, den du kaufen würdest
- **Negativ ⇒ bearische Tendenz** - z. B. eine long/bullische Crowd, die Gefahr läuft, nach unten gespült zu werden, oder ein gescheiterter Aufwärtsausbruch, den du verkaufen würdest

Wisse, welche Art von Signal du liest, bevor du den Score liest. Der ⓘ-Tooltip und das Panel "How it's built" auf jeder Signal-Seite sagen, was das Vorzeichen bedeutet, und [Signale: erklärt](/guides/signals-explained) listet den Trade-Bias jedes Signals auf.

## Betrag

Je näher an ±100, desto höher die Überzeugung. Eine praktische Faustregel, basierend auf den Schwellen und Beschriftungen der Signal-Seiten:

| Score (beide Vorzeichen) | Lesart |
| --- | --- |
| 0 - 25 | Unterhalb der Aktivierungslinie der meisten Signale. Die Seiten beschriften das als ausgeglichen, flach, neutral oder "no edge". Für sich allein keine umsetzbare Aussage. |
| 25 - 50 | Eine sich aufbauende Tendenz. Die meisten Karten aktivieren bei ±25; EOD Pressure und Gamma/VWAP Confluence triggern etwas früher, bei ±20. Filter, oder Auslöser mit Konfluenz. |
| 50 - 70 | Starke Aussage. Mehrere Signal-Seiten wechseln bei ±50 oder ±60 zu ihrer stärksten Beschriftung - Positioning Trap spricht dann zum Beispiel von einem Squeeze- oder Flush-Setup. |
| 70 - 100 | Das obere Ende der Skala. EOD Pressure und Volatility Expansion heben ihre stärksten Beschriftungen für ±70 und mehr auf. Selten. Aufmerksamkeit erforderlich. |

Jede Signal-Seite zeigt außerdem eine eigene einzeilige Deutung des aktuellen Scores. Wo Seite und Tabelle voneinander abweichen, gilt die Seite. Range Break Imminence und Market Pressure Index triggern überhaupt nicht auf den Score - siehe Trigger vs. Scores weiter unten.

## Ein Score von 0 ist fast nie neutral

Das ist der am häufigsten übersehene Punkt bei Signal-Scores.

Ein Score von 0 bedeutet typischerweise:

- Die Daten sind für die Frage, die dieses Signal stellt, **nicht ausreichend**.
- Die Frage ist gerade **nicht anwendbar** (z. B. EOD Pressure, bevor sich sein Fenster um 14:30 ET öffnet).
- Die Inputs **heben sich sauber auf** - gleichermaßen bullisch und bearisch.

Jeder dieser Fälle ist eine "Nicht-Aussage", kein "neutraler Markt". Ein strukturell neutraler Markt zeigt sich in der Regel durch Scores, die um ±10 pendeln - nicht durch eine glatte Null.

Basic-Signale zeigen selten überhaupt eine echte 0: Fehlen einem Signal die Primärdaten, zeigt die Engine stattdessen eine kleine, aus dem Regime abgeleitete Neigung innerhalb von ±10. Behandle einen einstelligen Basic-Score deshalb ebenfalls als "Nicht-Aussage".

Wenn du eine echte 0 siehst, prüfe die Karte und die Signal-Seite. Die Karten von EOD Pressure und 0DTE Position Imbalance zeigen *Inactive*, solange ihr Zeitfenster geschlossen ist, und viele Signal-Seiten erklären im Panel "How it's built", was eine 0 für das jeweilige Signal bedeutet.

## Trigger vs. Scores

Advanced-Signale haben zusätzlich zum Score einen weiteren Zustand:

- Einen **Trigger**, der auslöst, wenn der Score eine Schwelle überschreitet - ±25 bei den meisten, ±20 bei EOD Pressure und Gamma/VWAP Confluence. Die Karte zeigt *Triggered* oder *Stand by*.
- Eine sekundäre Metrik (Loading 0-100 bei Market Pressure Index, Imminence 0-100 bei Range Break Imminence), die den Trigger anstelle des Scores setzt: Market Pressure Index triggert bei Loading ≥ 50 mit klarer Richtung, Range Break Imminence bei Imminence ≥ 65.

Der Score ist die **Aussage**; der Trigger ist das **Ereignis**. Du kannst den Score als Filter nutzen, ohne auf den Trigger zu warten.

Auch Basic-Signalkarten werden ab ±25 umrandet und als *Triggered* markiert, doch bei Basic-Signalen hebt das nur eine starke Aussage hervor - dahinter steht keine Trigger-Regel.

## Die Sparkline lesen

Die Steigung zählt genauso viel wie das Niveau. Jede Dashboard-Karte hat eine Sparkline; auf einer Signal-Seite öffnest du **Expand score history**.

- Ein Score von +40 mit **steigender** Tendenz ist eine sich entwickelnde Aussage - das Momentum steht auf seiner Seite.
- Ein Score von +40, der von +70 **fällt**, ist eine schwächer werdende Aussage - das Signal lag vorher richtig, jetzt weniger.
- Ein Score, der in einem kurzen Zeitfenster das Vorzeichen wechselt, ist Volatilität, keine Überzeugung. Abwarten.

## Wann man handeln sollte

Eine einfache Faustregel, die sich bewährt hat:

> Handle nach **Konfluenz**, nicht nach einzelnen Scores.

Ein einzelnes +70 bei einem Signal ist interessant. Ein +50 bei drei Signalen aus unabhängigen Dimensionen (etwa zwei Basic-Signale und ein Advanced-Signal) ist ein Trade. Der Composite gehört nicht zu dieser Zählung - er ist ein 0-100-Regime-Gauge, kein Richtungs-Score von -100 bis +100, also lies seinen Wert nicht als bullisch/bärisch.

## Was sich ändert, wenn sich das Regime ändert

Überquert man den Gamma-Flip, ändert sich die **Interpretation** mancher Scores:

- Gamma/VWAP Confluence: Long-Gamma oberhalb des Flips ⇒ Mean-Revert; Short-Gamma unterhalb des Flips ⇒ Continuation.
- GEX Gradient kippt mit dem Regime: In Short-Gamma wird starkes Gamma oberhalb des Spots bullisch gewertet; in Long-Gamma gilt das für starkes Gamma unterhalb des Spots, und die Aussage wird gedämpft.
- Trap Detection löst nur aus, wenn Dealer als long Gamma modelliert sind - in negativem Gamma bleibt es bei 0.
- EOD Pressure zieht in positivem Gamma zum Pin; in negativem Gamma folgt es stattdessen der jüngsten Bewegung.

Die Signal-Karten berücksichtigen das bereits - aber das Wissen darum erklärt, warum derselbe Score an unterschiedlichen Tagen unterschiedliche Dinge bedeuten kann.

## Siehe auch

- [Wie Signale End-to-End funktionieren](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signale: erklärt](/guides/signals-explained)
