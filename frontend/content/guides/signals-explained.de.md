# ZeroGEX™ Leitfaden: Signale, erklärt

*Jedes ZeroGEX-Signal auf einer Seite - welche Frage es stellt, welchen Zeitrahmen es liest, wann es auslöst und was ein positiver, negativer oder Null-Score wirklich bedeutet.*

---

## So liest du diesen Leitfaden

ZeroGEX betreibt zwei Signalfamilien, und sie verhalten sich absichtlich unterschiedlich.

**Advanced-Signale** beantworten eine scharfe, situative Frage ("wird der Schlusskurs gerade gepinnt?", "ist dieser Breakout gerade gescheitert?"). Jedes erzeugt einen Score auf einer Linie von **-100 bis +100** *und* einen diskreten **Trigger**: Sobald die Trigger-Bedingung des Signals erfüllt ist - meist, weil der Score eine Schwelle überschreitet -, springt seine Karte von *Stand by* auf *Triggered*, und der Trigger wird in der Event Timeline des Signals festgehalten. Sie sind ereignisgesteuert und gehören zu Pro.

**Basic-Signale** sind kontinuierliche, beratende Lesarten. Sie haben kein Gewicht im **Composite MSI**, der aus sechs eigenen Komponenten besteht, und die Engine löst bei ihnen nie einen Trigger aus. Ihr Wert liegt in der Frühwarnung: Wenn sie dem MSI widersprechen, kündigt sich womöglich ein Regimewechsel an, bevor sich der MSI bewegt. Sie sind in Basic und Pro enthalten.

Drei Dinge lohnt es sich, vor den Tabellen zu verinnerlichen:

- Die Score-Linie reicht immer von **-100 bis +100**. Das Vorzeichen zeigt die Richtung; die Magnitude zeigt die Überzeugung.
- Ein Score von **0 bedeutet fast nie "neutraler Markt".** Bei den meisten Signalen bedeutet es, dass *die Daten unzureichend sind* oder dass *diese spezifische Frage gerade keine Antwort hat*. Lies eine 0 nicht als grünes Licht.
- Advanced-Signale **triggern**; Basic-Signale **warnen früh**. Eine Basic-Karte leuchtet bei ±25 als *Triggered* auf, aber das ist nur eine Hervorhebung auf der Karte, kein Trigger der Engine.

---

## Die 30-Sekunden-Version

Was jedes Signal fragt, welchen Bias es bevorzugt, welches Fenster es liest, welche Haupt-Inputs es antreiben und wie es sich zeigt.

### Advanced-Signale

| Signal | Fragt | Trade Bias | Timeframe | Haupt-Inputs | Trigger / Output |
| --- | --- | --- | --- | --- | --- |
| EOD Pressure | "Wird der Schlusskurs gerade gepinnt?" | Direktionale Lesart | Letzte 90 Min (steigt 14:30-15:45 ET) | Dealer-Charm am Spot, Pin-Gravitation, realisierte Vol, Witching-Flags | Score von -100 bis +100; löst aus bei ±20 |
| Gamma/VWAP Confluence | "Stapeln sich hier gerade Schlüssellevel?" | Mean-Rev (long gamma) / Continuation (short gamma) | Kontinuierlich intraday | Gamma Flip, VWAP, Max Pain, Max-Gamma-Strike, Call Wall | Score von -100 bis +100; löst aus bei ±20 |
| Market Pressure | "Ist der Markt geladen, sich zu bewegen, und in welche Richtung wird er ausbrechen?" | Continuation | Vorausschauend; sessiongewichteter Vanna→Charm-Mix | Wall Pinch, Flip-Nähe, Net-GEX-Regime, Dealer-Vanna/Charm, DNI, Skew aus Premium- und Smart-Money-Flow, IV-Rank, Squeeze der realisierten Vol | Score von -100 bis +100 plus Loading 0-100; löst aus bei loading ≥ 50 UND \|direction\| ≥ 0.20 |
| Range Break Imminence | "Steht diese Range kurz vor dem Bruch?" | Regime-/Playbook-Wechsel | 20-Bar-Fenster | Skew Delta, Dealer Delta, Trap Pressure, Kompressionsverhältnis 10/60 Bars | Score von -100 bis +100 plus Imminence 0-100; löst aus bei imminence ≥ 65 |
| Squeeze Setup | "Ist der Markt aufgewickelt wie eine Feder?" | Continuation | Mehrtägiges Setup | Flow-Z-Score, 5/10-Bar-Momentum, Gamma Readiness, Flip-Distanz, VIX-Regime | Score von -100 bis +100; löst aus bei ±25 |
| Trap Detection | "Ist dieser Breakout gerade gescheitert?" | Mean-Reversion (vs. Kursbruch) | Intraday bis über Nacht | Walls (aktuell + vorherig), VWAP, Flip, Net GEX und ΔGEX, Flow-Deltas | Score von -100 bis +100; löst aus bei ±25 |
| Vol Expansion | "Steht die Volatilität kurz vor einem Ausbruch?" | Continuation | 5-Bar-Momentum-Fenster | Net GEX, vol-normalisierter Momentum-Z-Score, realisierte Vol | Score von -100 bis +100; löst aus bei ±25 |
| Zero DTE Position Imbalance | "Neigen 0DTE-Trader zu einer Seite?" | Direktionale Lesart | 0DTE-Session (gewichtet nach Stunden bis Schluss) | Call/Put-Flow-Ungleichgewicht, Smart-Money-C/P-Ratio, PCR, Moneyness-Buckets | Score von -100 bis +100; löst aus bei ±25 |

### Basic-Signale

| Signal | Fragt | Trade Bias | Timeframe | Haupt-Inputs | Ausgabe |
| --- | --- | --- | --- | --- | --- |
| Dealer Delta Pressure | "Müssen Dealer dieser Bewegung hinterherjagen?" | Direktionale Lesart | Unmittelbar intraday | Dealer-Nettodelta (call_delta_oi + put_delta_oi), Strike-OI-Verteilung | Score von -100 bis +100; beratend, nicht im MSI |
| GEX Gradient | "Ist das Gamma auf einer Seite gestapelt?" | Direktionale Lesart | Snapshot pro Strike (bei GEX-Refresh) | Gamma über Spot, Gamma unter Spot, ATM-Konzentration, Wing-Anteil, realisierte Vol | Score von -100 bis +100; beratend, nicht im MSI |
| Positioning Trap | "Liegt die Crowd falsch positioniert?" | Mean-Reversion (vs. Crowd) | Intraday (5-10 Min) | PCR, vorzeichenbehaftetes Smart-Money-Ungleichgewicht, 5-Bar-Momentum, Flip-Neigung, Net-GEX-Regime | Score von -100 bis +100; beratend, nicht im MSI |
| Skew Delta | "Wie stark ist Angst in Puts eingepreist?" | Direktionale Lesart | Intraday (bei Quote-Refresh) | OTM-Put-IV, OTM-Call-IV, Spread vs. Baseline | Score von -100 bis +100; beratend, nicht im MSI |
| Tape Flow Bias | "In welche Richtung neigt sich das Tape?" | Continuation | Kurzes rollierendes Fenster (Lee-Ready) | Call-Kauf-/Verkaufspremium, Put-Kauf-/Verkaufspremium, gesamter Premium-Flow | Score von -100 bis +100; beratend, nicht im MSI |
| Vanna/Charm Flow | "Werden Vol oder Zeit Dealer zum Re-Hedging zwingen?" | Continuation | Intraday (Charm steigt in den letzten 2 Std.) | Aggregierte Dealer-Vanna, aggregierter Dealer-Charm, sessionzeitabhängiger Charm-Multiplikator | Score von -100 bis +100; beratend, nicht im MSI |

---

## Was das Vorzeichen des Scores bedeutet

Gleiche Zahlenlinie, sehr unterschiedliche Fragen. Hier steht, was positiv, negativ und null für jedes Signal bedeuten - lies die **0-Spalte sorgfältig**, dort passieren die meisten Fehllesungen.

### Advanced-Signale

| Signal | Positiver Score | Negativer Score | Null |
| --- | --- | --- | --- |
| EOD Pressure | Bullischer Pin-Druck (Charm-Bid + Gamma zieht nach oben) | Bärischer Pin-Druck (Charm-Offer + Gamma zieht nach unten) | Keine Pin-Kompression oder Charm-Aktivität im finalen Fenster |
| Gamma/VWAP Confluence | Preis über dem Confluence-Cluster (Fade nach unten unter long gamma / Beschleunigung nach oben unter short gamma) | Preis unter dem Confluence-Cluster (Spiegelbild) | Kern-Inputs fehlen (Flip / VWAP nicht verfügbar) - *nicht* "neutral" |
| Market Pressure | Bullisches Loading - Dealer sind gezwungen, bei jedem Katalysator zu kaufen (Vanna+Charm-Neigung nach oben, Call-seitiger Flow, Dealer short delta) | Bärisches Loading - Dealer sind gezwungen, bei jedem Katalysator zu verkaufen (Spiegelbild) | Entweder fehlt ein Pfeiler (keine Walls, kein Flip, keine Greeks, kein Flow), oder die Feder ist tatsächlich nicht gespannt - kein "neutraler Markt". Bei Loading mit direction = 0 heben sich gegensätzliche Kräfte gegenseitig auf. |
| Range Break Imminence | Bullischer Bruch unmittelbar bevorstehend (aufwärtsgerichteter struktureller Druck ausgerichtet) | Bärischer Bruch unmittelbar bevorstehend | Niedrige Imminence - im Range-Fade-Modus bleiben; kein Bruch-Loading |
| Squeeze Setup | Kaufe den Aufwärts-Breakout (Call-Flow + Aufwärtsbeschleunigung) | Verkaufe den Abwärts-Breakout (Put-Flow + Abwärtsbeschleunigung) | Nichts ist komprimiert - keine gestaute Energie, keine Flow-Neigung |
| Trap Detection | Kaufe den gescheiterten Breakdown (Abwärtsbruch hält nicht) | Verkaufe den gescheiterten Breakout (Aufwärtsbruch hält nicht) | Aktuell wird kein strukturelles Level zurückgewiesen |
| Vol Expansion | Bullisches Momentum + Kapazität für Vol-Expansion (Dealer short gamma) | Bärisches Momentum + Vol-Expansionskapazität | Kein Momentum, oder positives GEX dämpft die Bewegung |
| Zero DTE Position Imbalance | Call-lastiges 0DTE-Positioning (Aufwärts-Flow-Skew) | Put-lastiges 0DTE-Positioning (Abwärts-Absicherungs-Bid) | Ausgewogener 0DTE-Flow - oder Signal ruht außerhalb der RTH |

### Basic-Signale

| Signal | Positiver Score | Negativer Score | Null |
| --- | --- | --- | --- |
| Dealer Delta Pressure | Dealer modelliert short delta - sie kaufen tendenziell in eine Rallye hinein, um abgesichert zu bleiben (bullische Neigung) | Dealer modelliert long delta - sie verkaufen tendenziell in Rallyes hinein (bärische Neigung) | Ausgewogenes Dealer-Buch oder unzureichendes OI |
| GEX Gradient | Bullische Neigung. In Short Gamma: mehr Gamma über dem Spot (Dealer würden einer Rallye hinterherjagen). In Long Gamma: mehr Gamma unter dem Spot (ein stützender Boden) | Bärische Neigung. In Short Gamma: mehr Gamma unter dem Spot (Dealer würden einem Ausverkauf hinterherjagen). In Long Gamma: mehr Gamma über dem Spot (Widerstand darüber) | Flacher Gradient oder unzureichendes OI |
| Positioning Trap | Short-Crowd falsch positioniert - Aufwärts-Short-Cover-Squeeze-Loading | Long-Crowd falsch positioniert - Abwärts-Flush-Loading | Kein Crowd-Extrem erkannt |
| Skew Delta | Put-Skew *unter* Baseline - Angst löst sich auf (bullische Neigung) | Put-Skew erhöht - Angst ist eingepreist (bärische Neigung) | Skew auf Baseline, oder Daten fehlen |
| Tape Flow Bias | Aggressives Call-Kaufen dominiert das Tape (bullische Überzeugung) | Aggressives Put-Kaufen dominiert das Tape (bärische Überzeugung) | Ausgewogener Premium-Flow oder unzureichendes Volumen |
| Vanna/Charm Flow | Dealer-Hedging ist ein kaufender Rückenwind (Vol-Crush / Decay) | Dealer-Hedging ist ein verkaufender Gegenwind (Vol-Up / Unwind) | Ausgewogenes Dealer-Exposure oder fehlende Dealer-Zeilen |

---

## Eine Null ist (fast) nie "neutral"

Das ist der mit Abstand häufigste Fehler beim Lesen, deshalb bekommt er einen eigenen Abschnitt.

> Ein Score von 0 bedeutet meist *Daten unzureichend* oder *diese spezifische Frage hat gerade keine Antwort* - **nicht** "der Markt ist ausgeglichen, handle frei drauflos."

Wenn Gamma/VWAP Confluence eine 0 zurückgibt, weil der Gamma Flip oder VWAP nicht verfügbar ist, ist das ein *blinder Fleck*, kein ruhiges Tape. Wenn EOD Pressure außerhalb des Schlussfensters bei 0 liegt, gilt die Frage schlicht noch nicht. Behandle eine 0 als "diese Linse ist dunkel", positioniere dich entsprechend und stütze dich auf die Signale, die *tatsächlich* etwas melden.

## Die vier Trade-Bias-Buckets

Der "Trade Bias" jedes Signals rollt in eine von vier Familien hoch. Zu wissen, in welchem Bucket ein Signal lebt, sagt dir, wie du handeln solltest, noch bevor du den Score liest.

- **Continuation (5):** Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow - diese sagen *die Bewegung hat Treibstoff; reite sie*.
- **Mean-Reversion (2):** Positioning Trap, Trap Detection - diese sagen *die Bewegung ist überzogen oder falsch; fade sie*. Gamma/VWAP Confluence gehört zu diesem Bucket, wenn Dealer long gamma sind.
- **Directional Read (5):** EOD Pressure, Zero DTE Imbalance, Dealer Delta Pressure, GEX Gradient, Skew Delta - diese sagen dir, *in welche Richtung der Druck zeigt*, ohne von sich aus Reiten vs. Faden vorzuschreiben.
- **Regime / Structural (1):** Range Break Imminence - dieses eine wechselt das Playbook selbst und schaltet dich zwischen Range-Fade- und Breakout-Modus um.

Wenn mehrere Signale aus demselben Bucket sich ausrichten, verstärkt sich die Überzeugung. Wenn sich Continuation- und Mean-Reversion-Signale widersprechen, ist dieser Konflikt selbst Information: Das Tape ist umkämpft.

## Trigger vs. beratende Lesarten

Advanced- und Basic-Signale sind nicht einfach "schwierigere" und "einfachere" Versionen voneinander - sie sind unterschiedlich ins System verdrahtet.

- **Advanced-Signale lösen diskrete Trigger aus.** Die meisten triggern, wenn der Score ±25 überschreitet (±20 bei EOD Pressure und Gamma/VWAP Confluence); Range Break Imminence und Market Pressure triggern stattdessen auf Imminence und Loading. Die Karte springt auf *Triggered*, und der Trigger landet in der Event Timeline des Signals. Zwischen den Triggern ist der Score informativ.
- **Basic-Signale triggern in der Engine nie.** Sie sind kontinuierliche, beratende Lesarten ohne Gewicht im Composite MSI. Achte auf Divergenzen: Wenn Flow-Lesarten sich gegen die Struktur wenden, ist das die Frühwarnung, für die sie da sind.

Trigger erscheinen in der App - auf den Advanced-Karten und in ihren Event Timelines -, nicht per E-Mail, SMS oder Push.
