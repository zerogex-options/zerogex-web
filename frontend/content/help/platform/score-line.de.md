# Die [-1, +1]-Score-Linie lesen

*Jeder Signal-Score liegt auf derselben Zahlenlinie. Was Vorzeichen und Betrag bedeuten, wann eine 0 keine Antwort ist und wann es Zeit zum Handeln ist.*

---

## Warum die Score-Linie fest ist

Jedes ZeroGEX-Signal — Advanced oder Basic — gibt seine Auswertung auf derselben **[-1, +1]**-Skala aus. Der Vorteil liegt auf der Hand: Signal-übergreifende Konfluenz wird zu einem fairen Vergleich. Ein +0.5 bei Squeeze Setup und ein +0.5 bei EOD Pressure drücken konzeptionell ähnliche Aussagen über die Zuversicht aus.

Der Preis dafür: Jedes Signal hat einen anderen **Trade-Bias**, sodass die Bedeutung eines +0.5 davon abhängt, von welchem Signal es stammt.

## Vorzeichen

Bei Richtungssignalen bildet das Vorzeichen die erwartete Preisrichtung ab:

- **Positiv ⇒ bullische Tendenz** (Long-Richtung ist der Trade-Bias)
- **Negativ ⇒ bearische Tendenz**

Bei Mean-Reversion-Signalen (Positioning Trap, Trap Detection) bildet das Vorzeichen die **aufgelöste direktionale Tendenz** ab — der Trade läuft *gegen* die falsch positionierte Crowd oder den gescheiterten Ausbruch, sodass das Vorzeichen in dieselbe Richtung zeigt wie bei den Richtungssignalen oben:

- **Positiv ⇒ bullische Tendenz** — z. B. eine short/bärische Crowd, die Gefahr läuft, nach oben herausgesqueezt zu werden, oder ein gescheiterter Abwärtsausbruch, den du kaufen würdest
- **Negativ ⇒ bearische Tendenz** — z. B. eine long/bullische Crowd, die Gefahr läuft, nach unten gespült zu werden, oder ein gescheiterter Aufwärtsausbruch, den du verkaufen würdest

Die Signal-Karte auf jeder Seite gibt an, welche Variante gilt. Lies den Trade-Bias-Chip, bevor du den Score liest.

## Betrag

Je näher an ±1, desto höher die Überzeugung. Praktische Faustregel:

| Bereich | Lesart |
| --- | --- |
| 0.0 – 0.2 | Innerhalb des Rauschens. Keine umsetzbare Aussage. |
| 0.2 – 0.4 | Schwache Tendenz. Filter, kein Auslöser. |
| 0.4 – 0.6 | Solide Aussage. In Kombination mit Konfluenz handelbar. |
| 0.6 – 0.8 | Starke Aussage. Das Signal macht eine echte Aussage. |
| 0.8 – 1.0 | Maximale Überzeugung. Selten. Aufmerksamkeit erforderlich. |

## Ein Score von 0 ist fast nie neutral

Das ist der am häufigsten übersehene Punkt bei Signal-Scores.

Ein Score von 0 bedeutet typischerweise:

- Die Daten sind für die Frage, die dieses Signal stellt, **nicht ausreichend**.
- Die Frage ist gerade **nicht anwendbar** (z. B. EOD Pressure während der Eröffnung).
- Die Inputs **heben sich sauber auf** — gleichermaßen bullisch und bearisch.

Jeder dieser Fälle ist eine "Nicht-Aussage", kein "neutraler Markt". Ein strukturell neutraler Markt zeigt sich in der Regel durch Scores, die um ±0.1 pendeln — nicht durch eine glatte Null.

Wenn du eine echte 0 siehst, fahre mit der Maus über die Signal-Karte. Der Tooltip erklärt den Grund.

## Trigger vs. Scores

Manche Advanced-Signale haben zusätzlich zum Score einen weiteren Zustand:

- Einen diskreten **Trigger** (ja/nein), der auslöst, wenn der Score eine Schwelle überschreitet.
- Eine sekundäre Metrik (Loading 0–100 bei Market Pressure, Imminence 0–100 bei Range Break), die den Trigger unabhängig vom Score steuert.

Der Score ist die **Aussage**; der Trigger ist das **Ereignis**. Du kannst den Score als Filter nutzen, ohne auf den Trigger zu warten.

## Die Sparkline lesen

Die Steigung zählt genauso viel wie das Niveau.

- Ein Score von +0.4 mit **steigender** Tendenz ist eine sich entwickelnde Aussage — das Momentum steht auf seiner Seite.
- Ein Score von +0.4, der von +0.7 **fällt**, ist eine schwächer werdende Aussage — das Signal lag vorher richtig, jetzt weniger.
- Ein Score, der in einem kurzen Zeitfenster das Vorzeichen wechselt, ist Volatilität, keine Überzeugung. Abwarten.

## Wann man handeln sollte

Eine einfache Faustregel, die sich bewährt hat:

> Handle nach **Konfluenz**, nicht nach einzelnen Scores.

Ein einzelnes +0.7 bei einem Signal ist interessant. Ein +0.5 bei drei Signalen aus unabhängigen Dimensionen (etwa zwei Basic-Signale und ein Advanced-Signal) ist ein Trade. Der Composite gehört nicht zu dieser ±0.5-Zählung — er ist ein 0–100-Regime-Gauge, kein [-1, +1]-Richtungs-Score, also lies seinen Wert nicht als bullisch/bärisch.

## Was sich ändert, wenn sich das Regime ändert

Überquert man den Gamma-Flip, ändert sich die **Interpretation** mancher Scores:

- Gamma/VWAP Confluence: Long-Gamma oberhalb des Flips ⇒ Mean-Revert; Short-Gamma unterhalb des Flips ⇒ Continuation.
- Trap Detection ist in negativem Gamma schärfer.
- EOD Pressure pinnt in positivem Gamma stärker.

Die Signal-Karten berücksichtigen das bereits — aber das Wissen darum erklärt, warum derselbe Score an unterschiedlichen Tagen unterschiedliche Dinge bedeuten kann.

## Siehe auch

- [Wie Signale End-to-End funktionieren](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signale: erklärt](/guides/signals-explained)
