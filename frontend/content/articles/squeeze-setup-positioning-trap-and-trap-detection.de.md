# Squeeze Setup, Positioning Trap & Trap Detection: Drei Signale, Drei Geschichten

Wer sich schon einmal etwas länger im Signals-Tab aufgehalten hat, dem sind wahrscheinlich drei Namen aufgefallen, die klingen, als würden sie dasselbe messen: Squeeze Setup, Positioning Trap und Trap Detection. Alle drei liefern eine übersichtliche Zahl zwischen −1 und +1. Alle drei wechseln je nach Richtung das Vorzeichen. Und alle drei leuchten rund um dieselben Arten von Wendepunkten auf.

Unter der Haube beantworten sie jedoch drei sehr unterschiedliche Fragen zum Tape. Zu verstehen, welche Frage jedes Signal stellt, ist der Unterschied zwischen einem Breakout vorausschauend mitzunehmen und von ihm überrollt zu werden.

Dieser Artikel schlüsselt auf, was jedes Signal tatsächlich misst, wie man es liest und — vor allem — wann man *nicht* danach handeln sollte.

---

## Die 30-Sekunden-Version

| | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Fragt | „Ist der Markt aufgestaut?" | „Ist die Menge falsch positioniert?" | „Ist dieser Breakout gerade gescheitert?" |
| Trade-Bias | Fortsetzung (mit der Bewegung) | Mean-Reversion (gegen die Menge) | Mean-Reversion (zurück durch das gebrochene Level) |
| Zeithorizont | Mehrtägiges Setup | Intraday (5–10 Min) | Intraday → über Nacht |
| Haupt-Inputs | Flow, Momentum-Beschleunigung, Gamma-Bereitschaft | Put/Call-Ratio, Smart-Money-Ungleichgewicht | Wall-Nähe, Gamma-Regime, Wall-Migration |
| Output | [-1, +1], ausgelöst bei ±0,25 | [-1, +1], kontinuierlich | [-1, +1], ausgelöst bei ±0,25 |

Drei Signale. Drei Thesen. Dieselbe Zahlenlinie.

---

## Squeeze Setup — „Die gespannte Feder"

**Was es misst:** Ob die implizite Volatilität komprimiert ist, Gamma dicht ist und sich der Flow beginnt, sich direktional zu neigen — also ob der Markt potenzielle Energie für einen Breakout aufgebaut hat.

**Inputs:**

- Call- und Put-Flow-Deltas, per-Symbol-z-scored anhand der Flow-Volatilität
- 5-Bar- vs. 10-Bar-Momentum (um Beschleunigung zu erkennen, nicht nur Richtung)
- Net Gamma Exposure, durch eine geglättete tanh für „Gamma-Bereitschaft" geführt
- Abstand zum Gamma-Flip-Strike
- VIX-Regime (tot / normal / erhöht / Panik)

**Wie es bewertet wird:** Für jede Seite (bull und bear) multipliziert das Signal normalisierten Flow × direktionale Momentum-Stärke × Gamma-Bereitschaft × Beschleunigungsmultiplikator × Flip-Seiten-Multiplikator. Der Nettoscore ist bull minus bear, begrenzt auf [-1, +1]. Trigger lösen bei abs(score) ≥ 0,25 aus.

**Was ein Trader damit macht:** Ein positiver Squeeze Setup, der über zwei aufeinanderfolgende Sessions anhält, ist das Auslösetor für das Squeeze-Breakout-Playbook — Einstieg bei einem sauberen Ausbruch aus einer 30-Bar-Volatilitätshülle, in die Richtung, in die das Signal neigt. Negative Scores spiegeln dies auf der Abwärtsseite.

> **Kernintuition:** Squeeze Setup ist das einzige der drei Signale, das will, dass man *mit* der Bewegung handelt. Es ist ein Fortsetzungssignal.

---

## Positioning Trap — „Der überfüllte Trade"

**Was es misst:** Ob die Options-Crowd einseitig positioniert ist (stark long oder stark short) und das Tape beginnt, diesen Bias zu widerlegen — das klassische Setup für einen Short-Cover-Squeeze oder einen Long-Side-Flush.

**Inputs:**

- 5-Bar-Momentum
- Put/Call-Ratio (das Maß für die Überfüllung)
- Vorzeichenbehaftetes Smart-Money-Ungleichgewicht: (call_signed − put_signed) / (abs(call) + abs(put))
- Nähe zum Gamma-Flip
- Net-GEX-Regime (geglättet via tanh)

**Wie es bewertet wird:** Eine gewichtete Summe — 0,45 auf Überfüllung, 0,25 auf Ungleichgewichts-Skew, 0,15 auf Momentum, 0,10 auf Flip-Neigung, 0,05 auf negatives-GEX-Regime — unabhängig berechnet für die Squeeze-Seite (long Crowd im Risiko) und die Flush-Seite (short Crowd im Risiko). Beide werden zu einem einzigen Score verrechnet.

Im Gegensatz zu den anderen beiden hat Positioning Trap kein Trigger-Flag — es fließt als kontinuierliche Komponente (Gewicht 0,06) in das MSI-Composite ein und öffnet das `positioning_trap_squeeze`-Playbook bei abs(score) ≥ 0,5.

**Was ein Trader damit macht:** Die überfüllte Seite identifizieren, dann warten, bis sich das Tape dagegen wendet. Eine long positionierte Crowd wird erst gesqueezt, wenn Verkäufer auftauchen. Das Signal sagt einem, dass der Treibstoff vorhanden ist; das Tape muss den Funken liefern.

> **Kernintuition:** Positioning Trap setzt gegen die Wette der Crowd.

---

## Trap Detection — „Der gescheiterte Breakout"

**Was es misst:** Ob der Preis ein zentrales strukturelles Level — Call Wall, Put Wall, VWAP, Max-Gamma-Strike oder Gamma Flip — durchstoßen hat, die Bewegung aber nicht aufrechterhalten kann, was signalisiert, dass Dealer sie zurückdrängen werden.

**Inputs:**

- Call- und Put-Walls — sowie ihre vorherigen Positionen (um Wall-Migration zu erkennen)
- Max-Gamma-Strike, VWAP, Gamma Flip
- Net GEX und die Änderungsrate von Net GEX
- Call/Put-Flow-Deltas (auf der Suche nach Verlangsamung)
- Realisierte Volatilität (verwendet, um den Breakout-Puffer zu skalieren)

**Wie es bewertet wird:** Zunächst identifiziert das Signal das nächstgelegene gebrochene Level oberhalb und unterhalb des Schlusskurses und wendet einen vol-skalierten Puffer (~0,15 % × σ × √5) an, um einen echten Bruch zu bestätigen. Dann multipliziert es für jede Seite Breakout-Stärke × kontinuierlichen Long-Gamma-Faktor × GEX-Verstärkungsfaktor × Wall-Migrations-Malus × Magnitude × Flow-Multiplikator.

Die Wall-Migrations-Prüfung ist das, was dieses Signal unterscheidet: Hat sich die Wall *vom* Preis *weg* bewegt, ist der Breakout echt, keine Falle, und der Score wird stark bestraft.

**Was ein Trader damit macht:** Ein ausgelöster bärischer Fade (Preis ist nach oben ausgebrochen, aber Dealer sind long Gamma und der Flow verlangsamt sich) ist das Tor für das Overnight-Trap-Continuation-Playbook — ein 1DTE-Debit-Trade, positioniert gegen den falschen Breakout, gehalten bis in die nächste Session. Bullische Fades spiegeln dies auf der Abwärtsseite.

> **Kernintuition:** Trap Detection setzt gegen den Bruch eines strukturellen Levels durch den Preis.

---

## Gleiche Zahl, andere Bedeutung

Hier ist die Falle, die Trader in die Falle lockt: Alle drei Signale geben einen Score zwischen [-1, +1] aus, und ein +0,6 bei einem ist nicht derselbe Trade wie ein +0,6 bei einem anderen.

| Score-Vorzeichen | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Positiv (+) | Breakout nach oben kaufen | Gegen short Crowd setzen → Squeeze nach oben | Gescheiterten Breakdown kaufen |
| Negativ (−) | Breakout nach unten verkaufen | Gegen long Crowd setzen → Flush nach unten | Gescheiterten Breakout verkaufen |
| Null (0) | Keine aufgestaute Energie / keine Flow-Neigung | Kein Crowd-Extrem | Kein strukturelles Level scheitert gerade |

Eine 0 bedeutet nicht „neutraler Markt". Sie bedeutet, dass *diese spezifische Frage gerade keine Antwort hat*. Squeeze Setup bei 0 sagt einem nicht, dass das Positioning ausgeglichen ist — es sagt, dass nichts komprimiert ist. Trap Detection bei 0 sagt einem nicht, dass die Crowd in Ordnung ist — es sagt, dass kein Level gerade abgelehnt wird.

Drei Signale lesen dasselbe Tape durch drei verschiedene Linsen. Behandelt sie entsprechend.

---

## Wie man sie zusammen liest

Ein paar Muster, auf die man achten sollte:

**Konfluenz (hohe Überzeugung):** Squeeze Setup +0,5 und Trap Detection +0,4 → der Markt ist nach oben aufgestaut, und ein Bruch nach unten ist gerade gescheitert. Beide Signale zeigen aus unterschiedlichen Blickwinkeln auf denselben Trade.

**Sequenz (bessere Einstiege):** Positioning Trap markiert eine long Crowd bei +0,7 → abwarten. Trap Detection dreht dann ins Negative (Ausbruch nach oben scheitert) → das ist der Funke. Den Fade mit der Crowd als Treibstoff handeln.

**Widerspruch (nicht handeln):** Squeeze Setup sagt +0,6 (long gehen mit dem Ausbruch). Trap Detection sagt −0,5 (der Ausbruch nach oben scheitert). Eines der beiden liegt falsch. Auslassen.

Die Signale sind aus gutem Grund unabhängig — wenn sie übereinstimmen, hören Sie hin. Wenn sie sich widersprechen, ist der klügste Trade meist kein Trade.
