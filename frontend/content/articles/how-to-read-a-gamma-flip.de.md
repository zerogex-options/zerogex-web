# So liest man einen Gamma Flip

*Die praxisnahe Lesart des Gamma Flip — was dieses Level wirklich ist, was sich oberhalb und unterhalb davon ändert, und wie man intraday darauf reagiert. Der Gamma Flip erklärt, ohne Schönrederei.*

---

## Warum der Gamma Flip wichtig ist

Die meisten Trader lesen Preisbewegungen anhand von Support und Resistance. Der Gamma Flip ist etwas anderes: Er ist eine **Regimegrenze**, kein Kursziel. Wenn der Spot über dem Flip liegt, tendieren die Hedging-Mechanismen der Dealer dazu, die Volatilität zu *dämpfen*. Liegt der Spot darunter, tendieren dieselben Mechanismen dazu, sie zu *verstärken*. Setups, die in einem Regime funktionieren, sind im anderen meist die falschen — und zu erkennen, in welchem Regime man sich befindet, ist der größte Teil des Vorteils.

Dieser Beitrag liefert die Lesart aus Trader-Perspektive. Wir behandeln, was das Flip-Level tatsächlich ist, was sich ändert, wenn der Spot es durchquert, und wie man es innerhalb einer Session einsetzt. Wer die zugrundeliegende Marktstruktur tiefer verstehen möchte, beginnt am besten mit dem [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained); zur Berechnungsmethodik siehe den [Leitfaden zur Gamma-Flip-Berechnung](/guides/gamma-flip-calculation-before-vs-after).

---

## Was ist ein Gamma Flip?

Der Gamma Flip ist das Preisniveau, an dem die aggregierte Gamma-Exposure der Dealer die Nulllinie kreuzt. Oberhalb des Flips sind Dealer typischerweise net long Gamma; darunter typischerweise net short. Es handelt sich nicht um einen fixen Strike. Es ist der Preis, an dem das Gamma-Profil der Dealer das Vorzeichen wechselt — und während sich die Optionskette im Tagesverlauf neu gewichtet, bewegt sich dieser Preis mit.

Ein paar Dinge, die es klar zu benennen gilt:

- Der Flip ist ein **Level, keine Mauer.** Er leistet dem Preis nicht auf dieselbe Weise Widerstand wie ein stark besetzter Call- oder Put-Strike. Er markiert einen Verhaltens-Wendepunkt, keine strukturelle Barriere.
- Er ist ein **Regimeindikator, kein Richtungsindikator.** Spot über dem Flip ist nicht bullisch. Spot darunter ist nicht bärisch. Das Regime sagt etwas über den Charakter der realisierten *Volatilität* aus, nicht über die Richtung.
- Er ist **dynamisch.** Während sich das Open Interest verschiebt, Laufzeiten verfallen und neuer Order-Flow ins Buch kommt, driftet der Flip. Ein veralteter Flip ist ein irreführender Flip.

Behandeln Sie ihn so, wie ein Meteorologe eine Wetterfront behandelt — zu wissen, auf welcher Seite man steht, verrät, welches Wetter zu erwarten ist, nicht wohin der Sturm zieht.

---

## Was passiert oberhalb des Gamma Flip?

Oberhalb des Flips sind Dealer in der Regel net long Gamma. Um delta-neutral zu bleiben, verkaufen sie in Stärke hinein und kaufen in Schwäche hinein. Dieser Hedging-Reflex wirkt *gegen* Richtungsbewegungen, statt sie zu verstärken.

Praktische Konsequenzen, die Trader am Tape beobachten:

- **Realisierte Volatilität tendiert zur Kompression.** Ausbrüche stocken häufiger und werden gefadet.
- **Pin-Verhalten wird wahrscheinlicher.** Der Preis tendiert dazu, zu Strikes mit hoher Gamma-Konzentration zu gravitieren, besonders zum Handelsschluss hin.
- **Mean-Reversion-Setups haben eine höhere Trefferquote.** Das Faden von Rallyes in einen [Call Wall](/education/gamma-walls-explained) hinein, Dip-Buying nahe eines Put Walls und Short-Premium-Strukturen profitieren alle vom dämpfenden Reflex.
- **Trendfolge hat eine niedrigere Trefferquote.** Ausbrüche, die auf einem 5-Minuten-Chart sauber aussehen, scheitern oft daran, sich fortzusetzen.

Nichts davon ist eine Garantie. Makro-Schocks, OpEx-Mechanik oder ein Flip-Cross nach unten können das Regime mitten in der Session außer Kraft setzen. Als Basistendenz neigt das Verhalten oberhalb des Flips jedoch zur Ruhe.

---

## Was passiert unterhalb des Gamma Flip?

Unterhalb des Flips sind Dealer in der Regel net short Gamma. Um delta-neutral zu bleiben, kaufen sie nun in Stärke hinein und verkaufen in Schwäche hinein. Dieser Hedging-Reflex wirkt *mit* Richtungsbewegungen, nicht gegen sie.

Praktische Konsequenzen:

- **Realisierte Volatilität tendiert zur Expansion.** Ausbrüche haben mehr Durchzug; Ausverkäufe beschleunigen sich.
- **Pin-Verhalten bricht zusammen.** Strikes, die den Preis oberhalb des Flips magnetisch angezogen haben, beginnen ihn freizugeben.
- **Trendfortsetzung hat eine höhere Trefferquote.** Momentum tendiert dazu, sich fortzusetzen, statt abzuflauen.
- **Mean-Reversion wird gefährlich.** Ein fallendes Messer in einem tiefen Negativ-Gamma-Regime aufzufangen, tendiert dazu, Verluste zu verstärken, weil der Dealer-Reflex, auf den man sich verlassen würde (Kaufen in Schwäche hinein), genau der Reflex ist, der sich soeben umgekehrt hat.

Auch das ist eine probabilistische Tendenz, keine Prognose. Eine einzelne beruhigende Schlagzeile kann das Tape innerhalb desselben Regimes glätten. Aber zu wissen, dass man sich in Short-Gamma-Territorium befindet, sollte beeinflussen, welche Trades man eingeht und — noch wichtiger — welche man auslässt.

---

## Wie man den Gamma Flip intraday einsetzt

Den Gamma Flip in Echtzeit zu lesen, ist eine kurze Reihe von Gewohnheiten:

1. **Zuerst das Regime prüfen.** Vor jedem Setup wissen, ob der Spot über oder unter dem Flip liegt. Allein diese Lesart filtert einen erheblichen Anteil schlechter Trades heraus.
2. **Den Abstand zum Flip beobachten.** Ein Spot, der mit gesundem Abstand klar vom Flip entfernt ist, ist eine stabile Regime-Lesart. Ein Spot, der innerhalb weniger Zehntel Prozent eingeklemmt ist, kennzeichnet ein umkämpftes Regime — beide Seiten des Buchs sind teilweise aktiv, und das Verhalten ist instabil. Positionsgröße reduzieren oder aussetzen.
3. **Auf Migration achten.** Flip-Level verschieben sich, während sich das Positioning neu ausbalanciert. Ein Flip, der zusammen mit dem Preis nach oben driftet, hat eine andere Bedeutung als einer, der verankert bleibt, während sich der Preis darauf zubewegt.
4. **Den Flip mit den Walls kombinieren.** Der Flip verrät das Regime; [Call Wall und Put Wall](/education/gamma-walls-explained) verraten die strukturellen Grenzen darin. Beide zusammen lesen.
5. **0DTE-Konzentration respektieren.** Wenn Verfallstermine desselben Tages die Kette dominieren, wird der Flip besonders reaktiv. Siehe [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained) für die regimespezifischen Lesarten.

Die Disziplin besteht darin, den Flip als **Filter** zu nutzen, nicht als Signal. Er sagt, welches Playbook zu fahren ist; der Einstieg muss trotzdem von anderswo kommen.

---

## Den Gamma Flip auf ZeroGEX lesen

Das ZeroGEX-Dashboard zeigt den Flip an zwei Stellen:

- Die **Gamma-Flip-Metric-Card** zeigt das aktuelle Flip-Level zusammen mit der Live-Distanz zum Spot in Dollar und Prozent.
- Das **Dealer-Gamma-Profil-Chart** stellt die Kurve über die Strikes hinweg dar, wobei der Nulldurchgang — der Flip — direkt sichtbar ist.

![ZeroGEX dashboard Gamma Flip card showing SPX spot above the flip with live distance](/blog/zerogex-gamma-flip-card.png)

Ein Beispiel aus der Praxis. Angenommen, SPX notiert bei 5.830 und das Dashboard zeigt:

- **Net GEX:** +$1,2 Mrd.
- **Gamma Flip:** 5.815
- **Distanz:** +15 / +0,26 %

Die Lesart: Der Spot befindet sich in Long-Gamma-Territorium, komfortabel oberhalb des Flips. Der ausgewiesene Net-GEX-Wert ist konsistent mit dem Regime — positiv, weil es sich um den Wert derselben Dealer-Gamma-Kurve handelt, ausgewertet am Spot, und diese Kurve wird erst positiv, sobald man den Flip nach oben überschritten hat. (Diese Vorzeichen-Konsistenz ist strukturell in der Art verankert, wie ZeroGEX das Profil berechnet.) Praktische Tendenz: gedämpfte Volatilität, Ausbrüche mit höherer Wahrscheinlichkeit, gefadet zu werden, Pin-Verhalten zum Handelsschluss hin in Richtung der stark besetzten Gamma-Strikes.

![ZeroGEX dealer gamma profile chart with the gamma flip line marked and spot above it](/blog/zerogex-strike-profile-flip.png)

Nun stellen Sie sich dasselbe Dashboard 30 Minuten später vor: SPX 5.810, Gamma Flip 5.818. Der Spot ist darunter gerutscht, und der Flip ist tatsächlich nach oben gedriftet, in Richtung dort, wo der Spot zuvor stand. Das ist der strukturelle Wendepunkt, an dem sich der Intraday-Charakter ändert — und ein Trader, der Rallyes oberhalb des Flips gefadet hat, sollte beim Faden des nächsten Ausverkaufs im neuen Regime deutlich vorsichtiger sein.

---

## Häufige Fehler beim Lesen des Gamma Flip

Ein paar Muster, die Trader auf dem falschen Fuß erwischen:

- **Den Flip als Support oder Resistance behandeln.** Er ist eine Regimelinie, kein Level, gegen das man tradet. Schwäche *in* den Flip hinein von oben zu kaufen, ist strukturell ein anderer Trade als sie von unten zu kaufen.
- **Die Dynamik ignorieren.** Der Flip kann sich innerhalb weniger Stunden um mehrere Punkte bewegen, während sich das Positioning verschiebt. Den Flip von gestern auf dem heutigen Tape zu lesen bedeutet, ein veraltetes Buch zu lesen.
- **Nähe mit Bestätigung verwechseln.** Ein Spot, der genau *am* Flip sitzt, ist der am wenigsten aussagekräftige Zustand, nicht der aussagekräftigste. Beide Regime sind teilweise aktiv, und die Lesart ist schwach.
- **Den Flip lesen, ohne die Net-GEX-Größenordnung zu prüfen.** Ein Flip mit 2 Mrd. Dollar Dealer-Gamma darüber ist ein deutlich schärfer definiertes Regime als einer mit 200 Mio. Dollar. Die Größenordnung zählt genauso wie das Vorzeichen.
- **Den Flip mit Max Pain verwechseln.** Max Pain ist eine Schätzung des Verfalls-Pinnings basierend auf dem Payoff der Optionsinhaber. Der Flip ist eine Echtzeit-Hedging-Regimelinie basierend auf der Dealer-Gamma. Beide widersprechen sich häufig und beantworten unterschiedliche Fragen.

---

## Fazit

> Oberhalb des Flips herrscht in der Regel ein Long-Gamma-Regime, das die Volatilität dämpft. Darunter herrscht in der Regel ein Short-Gamma-Regime, das sie verstärkt. Spot am Flip ist umkämpft, nicht neutral.

Als Filter eingesetzt — nicht als Signal — kommt der Gamma Flip einer einzelnen, belastbaren Lesart, die die Analyse des Dealer-Positioning zu bieten hat, am nächsten. Er verrät nicht, in welche Richtung sich der Markt bewegt. Er verrät, welche Trades den Dealer-Reflex im Rücken haben und welche gegen ihn ankämpfen.

Nur zu Bildungszwecken — nichts von alledem ist eine Handelsempfehlung.

---

Wer die [heutige Gamma-Flip-Lesart in Echtzeit](/real-time-gex-0dte) sehen möchte: [Das kostenlose ZeroGEX-Dashboard](/spx-gamma-levels) zeigt sie zusammen mit Net GEX, Call und Put Wall sowie dem Dealer-Gamma-Profil-Chart an. Für einen Vergleich, wie verschiedene Plattformen diese Lesart berechnen und darstellen, siehe den [Leitfaden zu den besten GEX-Tools](/education/best-gex-tools).
