# Was ist ein Gamma Flip? Das Gamma-Flip-Level erklärt

*Der Gamma Flip erklärt, ohne vage Floskeln - was das Level tatsächlich ist, wie es bestimmt wird, was sich oberhalb gegenüber unterhalb davon ändert und wie du es intraday liest.*

---

## Warum der Gamma Flip wichtig ist

Die meisten Trader lesen Preisbewegungen anhand von Support und Resistance. Der Gamma Flip ist etwas anderes: Er ist eine **Regimegrenze**, kein Kursziel. Wenn der Spot über dem Flip liegt, tendieren die Hedging-Mechanismen der Dealer dazu, die Volatilität zu *dämpfen*. Liegt der Spot darunter, tendieren dieselben Mechanismen dazu, sie zu *verstärken*. Setups, die in einem Regime funktionieren, sind im anderen meist die falschen - und zu erkennen, in welchem Regime man sich befindet, ist der größte Teil des Vorteils.

Dieser Beitrag liefert die Lesart aus Trader-Perspektive. Wir behandeln, was das Flip-Level tatsächlich ist, was sich ändert, wenn der Spot es durchquert, und wie man es innerhalb einer Session einsetzt. Wer die zugrundeliegende Marktstruktur tiefer verstehen möchte, beginnt am besten mit dem [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained); zur Berechnungsmethodik siehe den [Leitfaden zur Gamma-Flip-Berechnung](/guides/gamma-flip-calculation-before-vs-after).

---

## Was ist ein Gamma Flip?

Der Gamma Flip ist das Preisniveau, an dem die *modellierte* aggregierte Gamma-Exposure der Dealer die Null kreuzt. Oberhalb des Flips sind die Dealer laut Modell netto long Gamma; darunter netto short. Es ist kein fester Strike - es ist das Spot-Niveau, an dem das modellierte Gamma-Profil das Vorzeichen wechselt, und während sich die Kette im Tagesverlauf neu gewichtet, bewegt sich dieser Preis. Dasselbe Level heißt auch [Zero-Gamma-Level](/education/zero-gamma-level-explained): „Zero Gamma“ benennt den Wert, „Gamma Flip“ den Vorzeichenwechsel. Weil es aus einem Modell stammt, hängt es von der Vorzeichenkonvention und den dahinterstehenden Modellierungsentscheidungen ab (welche Verfälle, wie sie gewichtet werden, die Inputs für IV und Open Interest), und es kann gelegentlich mehrfach auftreten, fehlen oder unklar sein.

Ein paar Dinge, die es klar zu benennen gilt:

- Der Flip ist ein **Level, keine Wall.** Er leistet dem Preis nicht auf die Weise Widerstand, wie es ein stark besetzter Call- oder Put-Strike tun könnte. Er markiert einen Verhaltens-Wendepunkt, keine strukturelle Barriere.
- Er ist ein **Regimeindikator, kein Richtungsindikator.** Spot über dem Flip ist nicht bullisch. Spot darunter ist nicht bärisch. Das Regime sagt etwas über den Charakter der realisierten *Volatilität* aus, nicht über die Richtung.
- Er ist **dynamisch.** Während sich das Open Interest verschiebt, Laufzeiten verfallen und neuer Order-Flow ins Buch kommt, driftet der Flip. Ein veralteter Flip ist ein irreführender Flip.

Behandle ihn so, wie ein Meteorologe eine Wetterfront behandelt - zu wissen, auf welcher Seite du stehst, verrät dir, welches Wetter zu erwarten ist, nicht wohin der Sturm zieht.

Manche Plattformen bezeichnen diese Linie als [Zero-Gamma-Level](/education/zero-gamma-level-explained); der Artikel dazu behandelt den Namen und wie der Nulldurchgang bestimmt wird.

---

## Was passiert oberhalb des Gamma Flip?

Oberhalb des Flips werden die Dealer als netto long Gamma modelliert. Um delta-neutral zu bleiben, verkaufen sie tendenziell in Stärke hinein und kaufen in Schwäche hinein. Dieser Hedging-Reflex wirkt *gegen* Richtungsbewegungen, statt mit ihnen.

Praktische Konsequenzen, die Trader am Tape beobachten:

- **Realisierte Volatilität tendiert zur Kompression.** Das Hedging stemmt sich gegen Vorstöße in beide Richtungen, auch gegen Vorstöße in die Walls hinein.
- **Pin-Verhalten wird wahrscheinlicher.** Der Preis tendiert dazu, zu Strikes mit hoher Gamma-Konzentration zu gravitieren, besonders zum Handelsschluss hin.
- **Mean-Reversion-Setups haben das Hedging im Rücken.** Das Faden von Rallyes in eine [Call Wall](/education/gamma-walls-explained) hinein, Dip-Buying nahe einer Put Wall und Short-Premium-Strukturen stützen sich alle auf den dämpfenden Reflex.
- **Trendfolge hat das Hedging gegen sich.** Ein Ausbruch, der auf einem 5-Minuten-Chart sauber aussieht, trifft auf ein Dealer-Buch, das sich in die Gegenrichtung stemmt.

Nichts davon ist eine Garantie. Makro-Schocks, OpEx-Mechanik oder ein Flip-Cross nach unten können das Regime mitten in der Session außer Kraft setzen. Als Basistendenz neigt das Verhalten oberhalb des Flips jedoch zur Ruhe. Was das Regime nicht verändert, ist, wie oft Walls nachgeben: In unserer Messung von 737 Wall-Tests hielten S&P-Walls auf beiden Seiten des Flips in etwa zwei von drei Fällen innerhalb einer Stunde ([Wie oft brechen Gamma Walls tatsächlich?](/education/how-often-do-gamma-walls-break)).

---

## Was passiert unterhalb des Gamma Flip?

Unterhalb des Flips werden die Dealer als netto short Gamma modelliert. Um delta-neutral zu bleiben, kaufen sie nun tendenziell in Stärke hinein und verkaufen in Schwäche hinein. Dieser Hedging-Reflex wirkt *mit* Richtungsbewegungen, nicht gegen sie.

Praktische Konsequenzen:

- **Realisierte Volatilität tendiert zur Expansion.** Ein Ausbruch, zu dem es tatsächlich kommt, hat das Hedging im Rücken; Ausverkäufe können sich beschleunigen.
- **Pin-Verhalten bricht zusammen.** Strikes, die den Preis oberhalb des Flips magnetisch angezogen haben, beginnen ihn freizugeben.
- **Trendfortsetzung hat das Hedging im Rücken.** Momentum kann sich fortsetzen, statt abzuflauen.
- **Mean-Reversion wird gefährlich.** Ein fallendes Messer in einem tiefen Negativ-Gamma-Regime aufzufangen, kann Verluste verstärken, weil der Dealer-Reflex, auf den man sich verlassen würde (Kaufen in Schwäche hinein), genau der Reflex ist, der sich soeben umgekehrt hat.

Auch das ist eine probabilistische Tendenz, keine Prognose. Eine einzelne beruhigende Schlagzeile kann das Tape innerhalb desselben Regimes glätten. Aber zu wissen, dass man sich in Short-Gamma-Territorium befindet, sollte beeinflussen, welche Trades man eingeht und - noch wichtiger - welche man auslässt.

---

## Wie man den Gamma Flip intraday einsetzt

Den Gamma Flip in Echtzeit zu lesen, ist eine kurze Reihe von Gewohnheiten:

1. **Zuerst das Regime prüfen.** Vor jedem Setup wissen, ob der Spot über oder unter dem Flip liegt. Allein diese Lesart zeigt dir, ob das Hedging für oder gegen dich arbeitet. Für den S&P 500 den Spot mit dem [heutigen Gamma Flip von SPX](/spx-gamma-levels) vergleichen.
2. **Den Abstand zum Flip beobachten.** Ein Spot, der mit gesundem Abstand klar vom Flip entfernt ist, ist eine stabile Regime-Lesart. Ein Spot, der innerhalb weniger Zehntel Prozent eingeklemmt ist, kennzeichnet ein umkämpftes Regime - beide Seiten des Buchs sind teilweise aktiv, und das Verhalten ist instabil. Positionsgröße reduzieren oder aussetzen.
3. **Auf Migration achten.** Flip-Level verschieben sich, während sich das Positioning neu ausbalanciert. Ein Flip, der zusammen mit dem Preis nach oben driftet, hat eine andere Bedeutung als einer, der verankert bleibt, während sich der Preis darauf zubewegt.
4. **Den Flip mit den Walls kombinieren.** Der Flip verrät das Regime; [Call Wall und Put Wall](/education/gamma-walls-explained) verraten die strukturellen Grenzen darin. Beide zusammen lesen.
5. **0DTE-Konzentration respektieren.** Wenn Verfallstermine desselben Tages die Kette dominieren, wird der Flip besonders reaktiv. Siehe [0DTE-Dealer-Positionierung erklärt](/education/0dte-dealer-positioning-explained) für die regimespezifischen Lesarten.

Die Disziplin besteht darin, den Flip als **Filter** zu nutzen, nicht als Signal. Er sagt, welches Playbook zu fahren ist; der Einstieg muss trotzdem von anderswo kommen.

---

## Den Gamma Flip auf ZeroGEX lesen

Das ZeroGEX-Dashboard zeigt den Flip an zwei Stellen:

- **Die Gamma-Flip-Metric-Card** zeigt das aktuelle Flip-Level zusammen mit der Live-Distanz zum Spot in Dollar und Prozent.
- **Das Dealer-Gamma-Profil-Chart** stellt die Kurve über die Strikes hinweg dar, wobei der Nulldurchgang - der Flip - direkt sichtbar ist.

![Gamma-Flip-Karte im ZeroGEX-Dashboard mit dem SPX-Spot oberhalb des Flips und Live-Abstand](/blog/zerogex-gamma-flip-card.png)

Ein Beispiel aus der Praxis. Angenommen, SPX notiert bei 5.830 und das Dashboard zeigt:

- **Net GEX:** +1,2 Mrd. $
- **Gamma Flip:** 5.815
- **Distanz:** +15 / +0,26 %

Die Lesart: Der Spot befindet sich in modelliertem Long-Gamma-Territorium, komfortabel oberhalb des Flips. Der ausgewiesene Net-GEX-Wert - geschätztes Dealer-Gamma nach der traditionellen Call-positiv/Put-negativ-Konvention, kein beobachteter Bestand - ist konsistent mit dem Regime: positiv, weil es sich um den Wert derselben modellierten Gamma-Kurve handelt, ausgewertet am Spot, und in diesem Buch wird diese Kurve oberhalb des Flips positiv. (Diese Vorzeichen-Konsistenz ist strukturell in der Art verankert, wie ZeroGEX das Profil berechnet.) Praktische Tendenz: gedämpfte Volatilität, Hedging, das sich gegen Ausbrüche stemmt, und mögliches Pin-Verhalten in Richtung der stark besetzten Gamma-Strikes zum Handelsschluss hin.

![ZeroGEX-Dealer-Gamma-Profil-Chart mit markierter Gamma-Flip-Linie und dem Spot darüber](/blog/zerogex-strike-profile-flip.png)

Stell dir jetzt dasselbe Dashboard 30 Minuten später vor: SPX 5.810, Gamma Flip 5.818. Der Spot ist darunter gerutscht, und der Flip ist tatsächlich nach oben gedriftet, in Richtung des Niveaus, auf dem der Spot zuvor stand. Das Kreuzen des modellierten Flips deutet darauf hin, dass die aggregierte Hedging-Tendenz ihr Vorzeichen gewechselt hat - ein Trader, der oberhalb des Flips Rallyes gefadet hat, sollte beim Faden des nächsten Ausverkaufs deutlich vorsichtiger sein, auch wenn das realisierte Verhalten weiterhin von Flow, Liquidität, Volatilität und Katalysatoren abhängt, nicht vom Flip allein.

---

## Häufige Fehler beim Lesen des Gamma Flip

Ein paar Muster, die Trader auf dem falschen Fuß erwischen:

- **Den Flip als Support oder Resistance behandeln.** Er ist eine Regimelinie, kein Level, gegen das man tradet. Schwäche *in* den Flip hinein von oben zu kaufen, ist strukturell ein anderer Trade als sie von unten zu kaufen.
- **Die Dynamik ignorieren.** Der Flip kann sich innerhalb weniger Stunden um mehrere Punkte bewegen, während sich das Positioning verschiebt. Den Flip von gestern auf dem heutigen Tape zu lesen bedeutet, ein veraltetes Buch zu lesen.
- **Nähe mit Bestätigung verwechseln.** Ein Spot, der genau *am* Flip sitzt, ist der am wenigsten aussagekräftige Zustand, nicht der aussagekräftigste. Positive und negative modellierte Gamma-Beiträge heben sich ungefähr auf; die Netto-Hedging-Tendenz ist schwach und kann schon bei kleinen Änderungen der Inputs das Vorzeichen wechseln.
- **Den Flip lesen, ohne die Net-GEX-Größenordnung zu prüfen.** Ein Flip mit 2 Mrd. $ Dealer-Gamma darüber ist ein deutlich schärfer definiertes Regime als einer mit 200 Mio. $. Die Größenordnung zählt genauso wie das Vorzeichen.
- **Den Flip mit Max Pain verwechseln.** Max Pain ist ein Strike der Payoff-Geometrie - dort, wo die Auszahlung an die Optionsinhaber beim Verfall minimiert wird - und keine Hedging-Kraft. Der Flip ist eine modellierte Hedging-Regimelinie auf Basis des Dealer-Gammas. Die beiden widersprechen sich häufig, und sie beantworten unterschiedliche Fragen.

---

## Fazit

> Oberhalb des Flips herrscht in der Regel ein Long-Gamma-Regime, das die Volatilität dämpft. Darunter herrscht in der Regel ein Short-Gamma-Regime, das sie verstärkt. Spot am Flip ist umkämpft, nicht neutral.

Als Filter eingesetzt - nicht als Signal - kommt der Gamma Flip einer einzelnen, belastbaren Lesart, die die Analyse des Dealer-Positioning zu bieten hat, am nächsten. Er verrät nicht, in welche Richtung sich der Markt bewegt. Er verrät, welche Trades den Dealer-Reflex im Rücken haben und welche gegen ihn ankämpfen.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.

---

Wenn du den heutigen Gamma Flip sehen willst, zeigen ihn [die kostenlosen ZeroGEX-Gamma-Levels-Seiten](/spx-gamma-levels) zusammen mit Net GEX, Call Wall und Put Wall sowie dem Dealer-Gamma-Profil-Chart, rund 15 Minuten verzögert; die bezahlten Pläne zeigen ihn [im Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte). Für einen Vergleich, wie verschiedene Plattformen diese Lesart berechnen und darstellen, siehe den [Leitfaden zu den besten GEX-Tools](/education/best-gex-tools).
