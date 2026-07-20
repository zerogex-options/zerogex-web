# Warum wir DEX nicht veröffentlichen

*Delta Exposure — DEX, die Summe aus dem Delta jedes Kontrakts multipliziert mit seinem Open Interest — wirkt wie das natürliche Geschwister von Gamma Exposure. Wir weigern uns, es zu veröffentlichen. Es misst genau den Greek, den Dealer bereits auf null abgesichert haben, es legt sein ganzes Gewicht auf die Strikes mit den schlechtesten Daten, und es ist am lautesten genau dort, wo der erzwungene Flow am schwächsten ist. Hier ist die vollständige Argumentation gegen eine Zahl, die viele Tools Ihnen bereitwillig verkaufen.*

---

## Die Zahl, die richtig aussieht und sich falsch liest

Wenn Gamma Exposure funktioniert, sollte Delta Exposure auch funktionieren. Das ist die Intuition, und deshalb taucht „DEX" auf einem Dashboard nach dem anderen auf, direkt neben GEX, als wäre es dessen Zwilling. Man nimmt jede Option der Kette, multipliziert das Delta jedes Kontrakts mit seinem Open Interest, summiert alles auf, und erhält eine einzige Zahl, die angeblich zeigt, wie das Dealer-Buch gerichtet ist. Positives DEX, Dealer sind long; negatives DEX, Dealer sind short. Sauber, symmetrisch, gut vermarktbar.

Es ist auch nahezu bedeutungslos, und wir haben früh die Entscheidung getroffen, es niemandem zu zeigen. Nicht weil es schwer zu berechnen wäre — es ist trivial zu berechnen, was Teil des Problems ist —, sondern weil die Zahl auf drei unabhängigen, sich verstärkenden Wegen falsch ist. Jeder einzelne davon wäre bereits disqualifizierend. Zusammen machen sie DEX nicht nur uninformativ, sondern aktiv irreführend, weil es den Blick genau auf den falschen Teil der Kette lenkt.

Das ist der Artikel, den wir in dieser Reihe am liebsten schreiben wollten, denn die Disziplin, eine plausibel aussehende Kennzahl *nicht* zu veröffentlichen, ist mehr wert als die meisten Kennzahlen, die tatsächlich veröffentlicht werden.

---

## Erster Punkt: Dealer haben Delta bereits auf null abgesichert

Gamma Exposure ist bedeutsam wegen einer bestimmten Tatsache: **Gamma lässt sich nicht mit der Aktie absichern.** Die Aktie hat ein Delta von 1 und ein Gamma von exakt null. Ein Dealer, der durch den Verkauf von Optionen short Gamma ist, hat keine Möglichkeit, dies mit dem Underlying zu neutralisieren — er bleibt darauf sitzen, und genau dieses gefangene Gamma zwingt ihn, dem Preis hinterherzujagen. GEX misst eine reale, nicht neutralisierte Exposure. Deshalb bewegt es Märkte.

Delta ist in jeder Hinsicht das Gegenteil. Delta ist *genau* der Greek, den Dealer mit Aktien absichern, weil die Aktie ein reines Delta-Instrument ist. Das ist die gesamte Aufgabe. Ein Dealer verkauft einen Call mit Delta 0,40, kauft dagegen 40 Aktien, und das Netto-Delta der Position ist null. Macht man das über das gesamte Buch hinweg, ist das *Netto*-Delta des Dealers konstruktionsbedingt annähernd null. Delta-Hedging ist die Definition des Geschäfts.

Was misst also ein Σ(Δ·OI)-Aggregat tatsächlich? Es misst das Delta *nur der Optionen*, ohne den Berg an gegenläufigen Aktienpositionen zu berücksichtigen, die der Dealer dagegen hält. Es ist ein Bein einer zweibeinigen Position, dargestellt, als wäre es das Ganze. Das andere Bein — die Aktienabsicherung, die es aufhebt — bleibt für die Formel unsichtbar. DEX ist eine Zahl, die groß und dramatisch ist, gerade weil sie die Absicherung weglässt, deren gesamter Zweck es ist, sie klein zu machen.

GEX misst eine Exposure, die Dealer *nicht* loswerden können. DEX misst genau die Exposure, die sie bereits losgeworden sind. Diese Asymmetrie ist kein Detail. Sie ist das ganze Spiel, und deshalb sind die beiden Zahlen überhaupt keine Geschwister.

---

## Zweiter Punkt: Deltas Gewicht liegt dort, wo die Daten am schlechtesten sind

Lassen wir das Hedging-Problem einmal beiseite und nehmen wir der Argumentation halber an, wir wollten die Kette nach Delta gewichten. Schauen wir, wohin diese Gewichtung ihre Masse legt.

Delta läuft von 0 bis 1. Es liegt nahe 0 für weit aus dem Geld liegende Optionen, kreuzt 0,5 nahe am Geld und nähert sich 1 für weit im Geld liegende Optionen. Vergleicht man das mit Gamma, das scharf am Geld seinen Höchststand erreicht und in beiden Flügeln gegen null fällt. Die Kette nach Delta statt nach Gamma zu gewichten bewirkt eine bestimmte Sache: Es zieht den Schwerpunkt der Kennzahl **zur Im-Geld-Seite** — und verleiht dem **tief im Geld liegenden Bereich** echtes Gewicht, jenen Strikes, die eine gammagewichtete Kennzahl zu Recht ignoriert, weil ihr Gamma null ist.

Dieser Im-Geld-Bereich ist der schlechteste Teil der Kette, auf den man eine Kennzahl stützen kann:

- Sie sind illiquide. Tief-ITM-Optionen werden kaum gehandelt.
- Ihre Spreads sind breit, daher sind ihre Kurse veraltet und unzuverlässig.
- Ihr Open Interest ist häufig alt, Überbleibsel von Positionen, die vor langer Zeit eröffnet, gerollt oder vergessen wurden — und Open Interest ist genau der Wert, mit dem DEX multipliziert.

Die drei Greeks, die tatsächlich den erzwungenen Flow antreiben — Gamma, Charm und Vanna — erreichen dagegen alle ihren Höchststand **nahe am Geld**, wo die Optionen liquide, eng gequotet, aktiv gehandelt sind und wo Open Interest echtes, aktuelles Positioning widerspiegelt. GEX bezieht sein Signal aus dem saubersten Teil der Kette. DEX bezieht sein Signal aus dem schmutzigsten. Man könnte kaum eine Kennzahl entwerfen, die perfekter auf das Rauschen ausgerichtet ist.

---

## Dritter Punkt: Delta ist nicht dort, wo der Flow ist

Das ist das tiefste Problem, und es ist dasjenige, das die gesamte Reihe zusammenhält. **Erzwungener Flow entsteht nicht durch das Niveau des Deltas. Er entsteht durch die Veränderung des Deltas.** Ein Dealer handelt Aktien nicht, weil sein Buch Delta hat; er handelt Aktien, weil sich das Delta seines Buchs *verändert hat*. (Das ist die gesamte These von [Warum Market Maker gezwungen sind, Aktien zu handeln](/education/why-market-makers-trade-stock).)

Fragen wir nun, welche Strikes diese Veränderung erzeugen. Delta bewegt sich am schnellsten dort, wo Gamma, Charm und Vanna am größten sind — nahe am Geld, nahe am Verfall. In den tiefen Flügeln bewegt es sich kaum. Ein tief-ITM-Call mit Delta 0,98 hat ein Gamma nahe null, ein Charm nahe null und eine Vanna nahe null. Sein Delta wird in den nächsten Stunden ungefähr bei 0,98 verharren, egal was Spot, Uhr oder Vol tun. Er erzeugt praktisch **keinen Hedging-Flow.**

Und doch schüttet genau dieser Kontrakt mit Delta 0,98, multipliziert mit seinem Open Interest, fast sein gesamtes Gewicht in DEX. Die Kennzahl weist dem Strike maximale Bedeutung zu, der minimalen Flow produziert. Wendet man diese Logik auf die gesamte Kette an, stellt man fest, dass DEX genau dort am lautesten ist, wo der erzwungene Flow am leisesten ist, und am leisesten — nahe am Geld, wo Delta ein mittelmäßiges 0,5 ist — genau dort, wo der erzwungene Flow am lautesten ist. DEX ist nicht bloß unkorreliert mit dem, was Trader interessiert. Es ist nahezu *anti*-korreliert damit. Es zeigt systematisch von den Strikes weg, die den Markt bewegen.

Drei Punkte. Eine Kennzahl, die eine bereits abgesicherte, flache Exposure misst, sie zu den schmutzigsten Daten der Kette hin gewichtet und ihr Signal genau dort konzentriert, wo kein Flow entsteht. Es gibt keine Version dieser Zahl, die es wert wäre, auf einen Bildschirm gestellt zu werden.

---

## Was wir stattdessen veröffentlichen

Die Lösung ist keine bessere Gewichtung des Deltas. Sie besteht darin, aufzuhören, das *Niveau* von irgendetwas zu messen, und stattdessen den *erzwungenen Trade* zu messen.

Unsere [Forced Flow](/forced-flow)-Engine summiert nicht Δ·OI. Sie stellt ein Szenario auf — Spot bewegt sich so weit, so viel Zeit vergeht, implizite Vol verschiebt sich um so viel — und **bewertet das gesamte Buch neu** in diesem neuen Zustand. Sie liest das Delta des Dealers nach dem Szenario aus, zieht das aktuelle Delta des Dealers ab und multipliziert die Differenz mit dem Spot. Das Ergebnis ist ein Dollarbetrag: die Aktie, die Dealer mechanisch gezwungen sind zu kaufen oder zu verkaufen, um abgesichert zu bleiben, während sich die Welt verändert.

Diese Zahl ist alles, was DEX nicht ist:

- Sie ist ein **Flow**, kein Niveau — sie misst den erzwungenen Trade, also das, was tatsächlich am Markt landet.
- Sie wird von **Gamma, Charm und Vanna** getrieben, die nahe am Geld leben, im sauberen, liquiden, lebendigen Teil der Kette.
- Sie wird von den Strikes dominiert, die Hedging **erzeugen**, nicht von den toten Tief-ITM-Kontrakten, die keines erzeugen.
- Sie stammt aus einer **vollständigen Neubewertung**, sodass die Kreuzterme zwischen Spot, Zeit und Vol korrekt behandelt werden, statt approximiert wegzufallen.

Anschließend teilen wir diese Gesamtsumme in Gamma-, Charm- und Vanna-Attributionsbänder auf, sodass Sie nicht nur sehen, wie viel Dealer handeln müssen, sondern auch *warum*. Das ist eine Zahl, die etwas bedeutet. Σ(Δ·OI) tut das nicht.

---

## Der ehrliche Vorbehalt

Wir behaupten nicht, dass Delta unecht ist oder dass Dealer es ignorieren. Delta ist der wichtigste Greek jeder einzelnen Option — es ist das Hedge-Verhältnis, und es abzusichern ist die gesamte Aufgabe des Dealers. Wir behaupten auch nicht, dass niemand irgendwo mit ausreichender Sorgfalt bezüglich Liquidität und OI-Hygiene irgendetwas aus Delta-Daten gewinnen kann.

Die Behauptung ist enger gefasst und, wie wir meinen, wasserdicht: Ein **Σ(Δ·OI)-Aggregat, veröffentlicht als Schlagzeilenzahl neben GEX, ist kein handelbares Signal**, und es als symmetrischen Zwilling von GEX darzustellen, suggeriert eine Parallele, die nicht existiert. GEX verdient sich seinen Platz, weil sich Gamma nicht mit Aktien absichern lässt, sich nahe am Geld konzentriert und echten Flow antreibt. DEX besteht keinen der drei Tests. Sie nebeneinander zu stellen, liefert Ihnen keine zwei Signale. Es liefert Ihnen ein Signal und eine Zahl, die die Lesart daneben still vergiftet.

---

## Warum das Weglassen der Punkt ist

Es wäre einfach, eine DEX-Kachel hinzuzufügen. Die Berechnung kostet nichts, sie füllt Platz, sie entspricht dem, was Wettbewerber zeigen, und die meisten Nutzer würden nie erfahren, dass sie hohl ist. Genau deshalb ist es wichtig, sie wegzulassen. Ein Dashboard ist eine Reihe von Behauptungen darüber, was Ihre Aufmerksamkeit verdient. Jede Zahl darauf sagt „das lohnt sich anzusehen." Wir sind nicht bereit, diese Behauptung über eine Kennzahl aufzustellen, die eine bereits abgesicherte, flache Exposure misst, in den schmutzigsten Daten der Kette, genau dort, wo kein Flow entsteht.

Wir liefern lieber eine Zahl, die einer genauen Prüfung standhält, als zwei Zahlen, bei denen die zweite reine Dekoration ist. DEX ist Dekoration. Forced Flow ist der Trade.

Für die Mechanik hinter der Alternative beginnen Sie mit [Warum Market Maker gezwungen sind, Aktien zu handeln](/education/why-market-makers-trade-stock) und [Delta und seine drei Kinder](/education/delta-and-its-three-children), öffnen Sie dann die Live-Seite [Forced Flow](/forced-flow) und beobachten Sie, wie die Reprice-Kurve das tut, was DEX nur vortäuscht.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.
