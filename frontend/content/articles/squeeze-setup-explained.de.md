# Squeeze Setup-Signal erklärt: Komprimierte Märkte lesen

*Die praxisnahe Tiefenanalyse zum ZeroGEX Squeeze Setup-Signal — was es misst, die fünf Inputs, die den Score treiben, wann es auslöst und wann es still bleibt, und wie man es nutzt, um Märkte zu identifizieren, die für eine gerichtete Bewegung aufgeladen sind.*

---

## Warum es dieses Signal gibt

Die meisten Options-Flow-Tools sagen dir, dass gerade *jetzt* etwas passiert. Fast nichts sagt dir, dass das Tape leise die Energie für eine Bewegung **gespeichert** hat — dass Flow, Momentum, Gamma und Volatilität sich aufeinander ausrichten, bevor die eigentliche Bewegung zündet.

Genau diese Lücke soll das Squeeze Setup-Signal schließen. Es sagt die Richtung nicht direkt voraus. Es zeigt dir, wann sich die Bedingungen für eine gerichtete Bewegung über mehrere strukturelle Inputs hinweg aufgebaut haben, sodass die Bewegung, wenn der Auslöser kommt, bereits Treibstoff hat.

Dieser Beitrag ist die traderorientierte Lektüre des Squeeze Setup-Signals. Er behandelt, was es abfragt, wie der Score berechnet wird, wann es auslöst und wann es still bleibt, und wie man innerhalb einer Session handelt. Die vollständige ZeroGEX-Signalreferenz findest du im [Signals: Explained-Guide](/guides/signals-explained), und die strukturelle Mechanik, die die meisten seiner Inputs antreibt, wird im [Gamma-Exposure-Pillar](/education/gamma-exposure-explained) behandelt.

---

## Was ist das Squeeze Setup-Signal?

Das Squeeze Setup-Signal stellt eine Frage:

> Ist der Markt komprimiert — richten sich Flow, Momentum, Gamma und Volatilität so aus, dass Energie geladen wird, die noch nicht freigesetzt wurde?

Es ist ein **Advanced**-Signal im ZeroGEX-Stack — es erzeugt sowohl einen kontinuierlichen Score auf der Zahlenlinie [-1, +1] als auch einen diskreten Trigger, wenn der absolute Score **0,25** überschreitet.

Entscheidend ist: Squeeze Setup ist ein **Continuation**-Signal, kein Fade-Signal. Wenn es auslöst, ist die praktische Neigung, *mit* der Bewegung zu handeln, sobald sie ausbricht, nicht dagegen. Das macht es zum Gegenteil von Mean-Reversion-Tools wie Positioning Trap oder Trap Detection. Zu wissen, in welche Kategorie ein Signal gehört, ist die halbe Miete, um es richtig zu lesen.

---

## Der Mechanismus: Wie sich Kompression aufbaut

Märkte komprimieren sich nicht immer, bevor sie sich bewegen — aber wenn sie es tun, häufen sich bestimmte messbare Bedingungen:

1. **Der Flow beginnt, sich gerichtet zu neigen.** Die Call-Prämie dominiert konsistent die Put-Prämie, oder umgekehrt — und die Neigung ist groß genug relativ zur typischen Flow-Volatilität des Symbols, um aufzufallen.
2. **Das kurzfristige Momentum beschleunigt sich.** Das 5-Bar-Momentum übertrifft das 10-Bar-Momentum. Die Steigung wird steiler, nicht nur trendend.
3. **Die Net-Gamma ist dicht genug, dass Hedging eine Rolle spielt.** Ein flaches Dealer-Buch propagiert Bewegungen nicht; ein geladenes schon.
4. **Der Spot ist relativ zum Gamma-Flip so positioniert, dass sich Aufwärtspotenzial öffnet.** Wenn der Spot knapp unter dem Flip liegt und der Flow bullisch ist, ist das strukturelle Setup für ein Überqueren des Flips mit anschließender Fortsetzung gegeben.
5. **Das Vol-Regime passt.** Ein Panik-VIX-Regime dämpft Setups (alles bewegt sich bereits); ein totes VIX-Regime kann falsche Kompressionen erzeugen.

Squeeze Setup kombiniert alle fünf zu einem einzigen kontinuierlichen Score pro Seite (bull und bear) und verrechnet sie dann miteinander.

---

## Die fünf Haupt-Inputs

| Input | Was er erfasst |
|---|---|
| Flow-Z-Score | Call/Put-Flow-Deltas, z-standardisiert anhand der Flow-Volatilität pro Symbol — ein "großer" Flow bei einem ruhigen Symbol gilt als bedeutsam; ein "großer" Flow bei einem lauten Symbol muss eine höhere Hürde nehmen |
| 5/10-Bar-Momentum | Zwei Zeithorizonte im Vergleich, auf der Suche nach Beschleunigung (5-Bar übertrifft 10-Bar) statt nur Richtung |
| Gamma-Readiness | Net-Gamma durch eine geglättete tanh geführt, ergibt "ist das Buch geladen genug, um relevant zu sein?" als kontinuierlichen 0-1-Multiplikator |
| Flip-Distanz | Wie nah der Spot am Gamma-Flip liegt, mit der Seite als Multiplikator, sodass ein Bull-Setup nahe am Flip von unten höher bewertet wird |
| VIX-Regime | Tot / normal / erhöht / Panik — dient dazu, den Score je nach Kontext zu dämpfen oder zu verstärken |

Das Ergebnis ist eine einzige Zahl, aber sie trägt die gemeinsame Struktur aller fünf Inputs in sich.

---

## Wie der Score berechnet wird

Für jede Seite (bull und bear) multipliziert das Signal:

```
side_score = normalized_flow × directional_momentum_strength
           × gamma_readiness × acceleration_multiplier × flip_side_multiplier
```

Der Nettoscore ist `bull_score − bear_score`, begrenzt auf [-1, +1]. Der Trigger löst aus bei einem absoluten Score ≥ **0,25**.

Zwei strukturelle Fakten dieser Formel sind für die Interpretation wichtig:

- **Jeder Term multipliziert, nicht addiert.** Geht auch nur einer der fünf Terme auf null, wird die Seite null. Das Signal hat eine klare Haltung dazu, *wann* Squeezes funktionieren — es weigert sich auszulösen, wenn eine der Bedingungen nicht erfüllt ist, auch wenn die anderen laut schreien.
- **Bull- und Bear-Seiten werden unabhängig berechnet, dann verrechnet.** In seltenen Fällen, in denen beide gleichzeitig auslösen (echt umkämpfte Setups), heben sie sich teilweise auf — passend, denn die Lesart ist mehrdeutig.

---

## Interpretation des Scores

| Score | Lesart |
|---|---|
| +0,6 bis +1,0 | Stark komprimiert nach oben |
| +0,25 bis +0,6 | Bullisch ausgelöst — das Aufwärts-Breakout-Playbook ist aktiv |
| -0,25 bis +0,25 | Unter der Schwelle — informativ, allein nicht handlungsrelevant |
| -0,25 bis -0,6 | Bärisch ausgelöst — das Abwärts-Breakout-Playbook ist aktiv |
| -0,6 bis -1,0 | Stark komprimiert nach unten |

Die Schwelle von 0,25 ist bewusst konservativ gewählt. Squeeze Setup legt die Messlatte hoch — richten sich *alle* strukturellen Inputs aus? — und die Schwelle spiegelt das wider. Ein Wert von 0,20 ist ein Grenzfall; nur 0,25+ zählt als ausgelöst.

---

## Wann das Signal auslöst und wann es still bleibt

Der dominante Zustand ist **Stille**. Squeeze Setup ist so konzipiert, dass es die meiste Zeit still bleibt. Bei den meisten Symbolen, an den meisten Handelstagen, häuft sich keine der fünf Bedingungen an — und diese Stille ist informativ. Sie sagt dir, dass die strukturellen Vorbedingungen für einen Breakout nicht vorhanden sind, sodass die Breakouts, die du siehst, wahrscheinlich Rauschen sind.

Das Signal löst nur aus, wenn:

- Der Flow groß genug ist, um relativ zur Historie des Symbols statistisch bedeutsam zu sein (die Z-Score-Komponente ist nicht trivial).
- Das Momentum sich beschleunigt, nicht nur trendet.
- Die Gamma geladen genug ist, dass Hedging-Flows Bewegungen propagieren können.
- Der Spot relativ zum Flip so positioniert ist, dass sich gerichtete Asymmetrie öffnet.
- Das Vol-Regime das Signal nicht auf null dämpft.

Ein paar Minuten jeder Session, bei den wenigen Symbolen, bei denen sich all das ausrichtet — dort lebt Squeeze Setup.

---

## Was ein Trader tut, wenn es auslöst

Das kanonische Playbook-Gate:

> Ein über zwei aufeinanderfolgende Sessions anhaltender Squeeze Setup-Score über der Schwelle löst das Squeeze Breakout-Playbook aus — Einstieg bei einem sauberen Durchbruch einer 30-Bar-Volatilitätshülle, in Richtung der Signalneigung.

Die Zwei-Session-Persistenz ist ein bewusster Filter. Auslöser auf einer einzelnen Bar sind zu verrauscht; die strukturelle Kompression muss *halten*. Wenn sie das tut, sagt das Signal im Wesentlichen: Die Bedingungen für eine Bewegung sind gegeben, warte auf den Durchbruch und handle dann in Richtung des Scores.

Ein paar praktische Hinweise:

- **Die Richtung ergibt sich aus dem Vorzeichen des Scores, nicht aus der Einstiegstechnik.** Das Signal liefert die gerichtete Lesart; der Durchbruch der Volatilitätshülle ist der Timing-Trigger.
- **Die Größenordnung zählt.** Ein Score von +0,55 unterscheidet sich substanziell von +0,27 — beide sind ausgelöst, aber der Trade mit der höheren Überzeugung ist der mit dem höheren Score.
- **Werte unter der Schwelle liefern trotzdem Informationen.** Ein anhaltender Wert von +0,20 ist allein nicht handlungsrelevant, aber wenn jedes andere Signal ebenfalls bullisch geneigt ist, trägt er zur Gesamtlesart bei.

---

## Squeeze Setup zusammen mit anderen Signalen lesen

Squeeze Setup ist eines von vielen Signalen — und der echte Edge liegt in der Konfluenz. Ein paar gängige Cross-Reads:

- **Squeeze Setup + Vol Expansion in derselben Richtung.** Zwei Continuation-Signale stimmen überein — die Bewegung hat sowohl *Kompression* als auch *Kapazität*. Das sauberste Setup.
- **Squeeze Setup + Trap Detection im Widerspruch.** Nach Squeeze nach oben komprimiert, aber Trap Detection sagt, dass der jüngste Aufwärtsdurchbruch scheitert. Eines der beiden liegt beim aktuellen Durchbruch falsch; meist ist die richtige Reaktion, auszusetzen und abzuwarten.
- **Squeeze Setup + Positioning Trap im Einklang.** Kompression bei einer auf derselben Seite falsch positionierten Crowd — ein Short-Cover-Squeeze, wenn die Crowd short ist, ein Flush, wenn sie long ist. Beide Signale zeigen auf denselben Trade. Der Begleitartikel zum [Positioning Trap-Signal](/education/positioning-trap-explained) behandelt diese Lesart im Detail.
- **Squeeze Setup bei 0, während jedes andere Signal aktiv ist.** Wahrscheinlich ist strukturell nichts komprimiert; die Bewegung, die du siehst, ist reaktiv, nicht geladen.

Wenn sich mehrere Continuation-Signale (Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow) in dieselbe Richtung ausrichten, verstärkt sich die Überzeugung. Wenn sie gegen Mean-Reversion-Signale stehen, ist das Tape umkämpft.

---

## Häufige Fehllesarten

Drei Fallen:

- **Eine 0 als "neutral" behandeln.** Eine 0 bei Squeeze Setup bedeutet *nichts ist komprimiert* — nicht, dass der Markt ausgeglichen ist. Handle nicht danach als "ruhiges" grünes Licht.
- **Auf einen Score unter der Schwelle handeln.** Die Schwelle von 0,25 zählt. Ein Wert von 0,18 kann sich *anfühlen* wie ein Setup, ist aber nicht ausgelöst — und der Unterschied zwischen "fühlt sich komprimiert an" und "ist strukturell komprimiert" macht den Großteil des Edge aus.
- **Das Regime ignorieren.** Squeeze Setup sagt für sich genommen nichts über das Gamma-Regime aus. Ein komprimierter Markt unterhalb des Flips verhält sich anders als einer oberhalb. Prüfe immer gegen den [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)-Workflow.

---

## Wie ZeroGEX das Squeeze Setup-Signal darstellt

Das Dashboard zeigt es an mehreren Stellen:

- **Die Squeeze Setup-Karte** zeigt den Live-Score, den Trigger-Status und die Aufschlüsselung der Inputs.
- **Der Composite Signal Score** integriert Squeeze Setup als einen Input neben den anderen Advanced- und Basic-Signalen.
- **Der Trade Stream** markiert `squeeze_breakout`-gegatete Playbook-Trades, wenn sie auslösen.

*[Bildplatzhalter: ZeroGEX Squeeze Setup-Karte mit Score, Trigger-Status und Input-Beiträgen — Datei ablegen unter /public/blog/zerogex-squeeze-setup-card.png]*

Ein durchgerechnetes Beispiel. Angenommen, SPX bewegt sich in der Mittwochssession seitwärts, und ZeroGEX zeigt:

- **Squeeze Setup:** +0,42 (bullisch ausgelöst)
- **Net GEX:** +$800M
- **Gamma Flip:** Spot liegt 0,2 % darüber
- **Tape Flow Bias:** +0,6
- **Trap Detection:** 0

Die strukturelle Lesart: ein nach oben komprimiertes Setup mit bestätigender Flow-Neigung, kein gegenläufiges Signal für einen gescheiterten Breakout, und ein Long-Gamma-Regime, das die Bewegung dämpfen wird, sollte sie versuchen, sich zu weit auszudehnen. Praktische Neigung: wachsam bleiben für einen Durchbruch der Volatilitätshülle nach oben; wenn er kommt, sind die strukturellen Bedingungen für eine Fortsetzung gegeben. Nichts davon ist ein Trade — es ist die Regimelesart, die bestimmen sollte, welche Einstiege du ernst nimmst.

---

## Fazit

> Squeeze Setup sagt dir, wann der Markt die Energie für eine Bewegung *gespeichert* hat, nicht wann er sich bewegt hat. Es ist ein Vorbedingungssignal, kein Timing-Signal.

Die Disziplin besteht darin, es als Filter dafür zu nutzen, welche gerichteten Breakouts du ernst nimmst, statt es als den Trigger selbst zu verwenden. Wenn der Score ausgelöst ist, ist das Breakout-Setup real; wenn er bei null liegt, sind die Breakouts, die du siehst, Rauschen. Dieser Unterschied macht den Großteil des Edge aus.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige Squeeze Setup-Lesart in Echtzeit zusammen mit dem Gamma-Flip, den Walls und den anderen Advanced- und Basic-Signalen sehen möchtest, zeigt dir das kostenlose ZeroGEX-Dashboard das alles.
