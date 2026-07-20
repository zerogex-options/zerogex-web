# Was Bedeutet Negatives Gamma? Eine Verständliche Erklärung

*Was bedeutet negatives Gamma — und warum sollte das einen Optionshändler interessieren? Kurz gesagt: Es bedeutet, dass das Hedging der Dealer Bewegungen verstärkt statt sie zu dämpfen. Hier erfährst du, worauf sich der Begriff tatsächlich bezieht, wie man ein Negativ-Gamma-Regime in Echtzeit erkennt und was sich in deinem Trading ändert, wenn du dich in einem solchen befindest.*

---

## Die kurze Antwort

**Negatives Gamma** bedeutet im Kontext des Options-Flows, dass die Dealer, die auf der anderen Seite der Kundenoptionsgeschäfte stehen, ein netto-short-gamma-Buch haben. Die praktische Konsequenz: Wenn SPY steigt, müssen sie SPY *kaufen*, um gehedgt zu bleiben, und wenn SPY fällt, müssen sie SPY *verkaufen*. Ihre Hedging-Trades laufen **mit** der Richtung des Preises — nicht dagegen.

Dieser mechanische Reflex verwandelt das Dealer-Buch in einen Verstärker. Ausverkäufe beschleunigen sich. Rallyes verlängern sich. Die realisierte Intraday-Volatilität tendiert dazu, höher zu sein als die implizite. Das Pin-Verhalten bricht zusammen. Dasselbe Chartsetup, das gestern funktionierte (als die Dealer long gamma waren und Bewegungen absorbierten), wird heute zerschlagen (wenn sie short gamma sind und der Bewegung hinterherjagen).

Das Gegenteil — **positives Gamma** — ist der häufigere Standardfall bei SPY in den meisten ruhigen Sessions. Die Dealer sind long gamma, hedgen gegen die Bewegung und dämpfen die Volatilität. Das Gesamtbild wird im [Gamma-Exposure-Pillar](/education/gamma-exposure-explained) behandelt; dieser Artikel konzentriert sich speziell darauf, was "negatives Gamma" bedeutet und wie man es erkennt.

---

## Worauf sich "negatives Gamma" tatsächlich bezieht

Gamma ist ein Options-Greek zweiter Ordnung, der misst, wie sich das Delta einer Option verändert, wenn sich der Basiswert bewegt. Eine vorzeichenbehaftete "Gamma-Exposure"-Zahl ist das aggregierte Gamma über das gesamte Dealer-Buch, wobei Calls (typischerweise von den Dealern short gehalten) positiv beitragen und Puts (ebenfalls typischerweise short gehalten) negativ beitragen.

Wenn das *Netto* dieser vorzeichenbehafteten Beiträge negativ ist, ist das Dealer-Buch insgesamt short gamma. Die übliche Darstellung in Flow-Tools: Net GEX < 0.

Die Standardannahme "Kunde long call / Kunde long put" bedeutet, dass Dealer typischerweise bei beidem short sind — aber die *Größenordnungen* verschieben sich mit dem Positioning. Wenn die Kundennachfrage stark in Richtung Puts tendiert (z. B. während Angstregimen), kann das Netto-Gamma des Dealer-Buchs ins Negative kippen; wenn sie sich in Richtung Calls neigt (z. B. bei ruhigen Aufwärtstrends), ist das Buch long gamma.

Die nützlichste zusammenfassende Kennzahl überhaupt: der **Gamma-Flip** — der Preis, an dem das Dealer-Gamma-Profil die Nulllinie kreuzt. Oberhalb des Flips sind Dealer typischerweise long gamma (positiv). Unterhalb des Flips short gamma (negativ). Den Flip zu lesen bedeutet im Grunde, die Regime-Linie zu lesen. Siehe [Wie man einen Gamma-Flip liest](/education/how-to-read-a-gamma-flip).

---

## Warum negatives Gamma Bewegungen verstärkt

Die mechanische Kette:

1. Die Netto-Delta-Exposure der Dealer ist short-gamma. Wenn der Spot steigt, sinkt das Delta ihres Optionsportfolios (sie werden relativ zur Neutralität stärker short).
2. Um delta-neutral zu bleiben, müssen sie den Basiswert **kaufen**, um den Rückgang auszugleichen.
3. Diese Käufe geschehen genau in dem Moment, in dem die Kunden den Markt nach oben treiben. Das verstärkt die Dynamik.
4. Wenn der Spot fällt, passiert das Gegenteil: Das Options-Delta der Dealer steigt (sie werden relativ zur Neutralität stärker long); um zu neutralisieren, **verkaufen** sie den Basiswert. Dieser Verkauf verstärkt die Abwärtsbewegung.

In beide Richtungen *verstärkt* das Dealer-Hedging die Bewegung. Der Reflex ist prozyklisch. Je größer die Short-Gamma-Exposure der Dealer, desto mehr Flow im Basiswert erfordert jeder Prozentpunkt Bewegung.

Zum Vergleich **positives Gamma**, bei dem sich dieselbe Flow-Kette umkehrt: Dealer verkaufen in die Stärke hinein und kaufen in die Schwäche hinein, was die Bewegung dämpft. Die strukturelle Kraft im Markt ist antizyklisch. Dieselbe Nachricht, die in einem Long-Gamma-Regime eine Intraday-Spanne von 0,5 % erzeugt, kann in einem Short-Gamma-Regime eine Spanne von 2 % erzeugen.

---

## Negatives Gamma vs. positives Gamma im Vergleich

| | Positives Gamma (long-gamma) | Negatives Gamma (short-gamma) |
|---|---|---|
| Dealer-Hedging-Reflex | Verkaufen in Stärke, kaufen in Schwäche | Kaufen in Stärke, verkaufen in Schwäche |
| Realisierte Vol vs. implizite | Tendiert **niedriger** zu sein | Tendiert **höher** zu sein |
| Ausbrüche | Verpuffen oft und schnappen zurück | Verlängern sich oft |
| Ausverkäufe | Werden oft in der Nähe von Walls absorbiert | Beschleunigen sich oft |
| Pin-Verhalten | Magnete ziehen den Preis zu stark gewichteten Strikes | Magnete lassen den Preis los; kein Pin |
| Bestes Playbook | Mean-Reversion, Fading von Extremen, Prämienverkauf | Trendfortsetzung, Momentum, Breakout |
| Schlechtestes Playbook | Ausbrüchen hinterherjagen, Momentum | Rallyes faden, Dip-Buying in die Struktur hinein |
| Typisch wenn | SPY über dem Gamma-Flip, Net GEX > 0 | SPY unter dem Gamma-Flip, Net GEX < 0 |

Dies sind allgemeine Regime-Tendenzen, keine Garantien. Katalysatoren und Schocks können sie außer Kraft setzen. Aber die Basisrate ist bedeutsam genug, dass das Fahren des falschen Playbooks für das jeweilige Regime den Großteil der Kosten ausmacht.

---

## Wie man ein Negativ-Gamma-Regime in Echtzeit erkennt

Ein kurzer Workflow:

1. **Zuerst den Gamma-Flip prüfen.** Liegt SPY unter dem Flip, befindest du dich per Definition in einem Short-Gamma-Regime.
2. **Mit Net GEX bestätigen.** Ein negativer Net-GEX-Wert liefert die Größenordnung — je negativer, desto ausgeprägter das Regime. Net GEX nahe null ist ein umkämpftes Regime; beide Reflexe sind teilweise aktiv.
3. **Das Bild der realisierten Vol gegenprüfen.** Short-Gamma-Regime zeigen sich in breiteren Intraday-Spannen, als die implizite Vol beim Tagesauftakt nahelegte. Wenn sich die realisierte Vol ausweitet, während die implizite flach bleibt, ist das die Signatur des Regimes.
4. **Das Wall-Verhalten beobachten.** In Short-Gamma-Regimen schwächen sich Walls ab oder kehren sich um. Die Call-Wall, die gestern Rallyes gedeckelt hat, kann heute zum Breakout-Ziel werden.
5. **Die Flow-Richtung zum Schluss beobachten.** Short-Gamma zum Handelsschluss erzeugt oft sich beschleunigende gerichtete Bewegungen (das EOD-Drucksignal wird zu einer Fortsetzungslesart, nicht zu einer Fade-Lesart).

---

## Was sich in deinem Trading ändert

Konkret Dinge, die man in einem Negativ-Gamma-Regime *lassen* sollte:

- **Rallyes nicht faden.** Der Dealer-Reflex verstärkt. Deine "Mean-Reversion-Short"-Position kämpft gegen den strukturellen Kauf-Flow.
- **Dips in der Struktur nicht kaufen.** Dasselbe Problem umgekehrt. Die Put-Wall, die den Markt im Long-Gamma-Regime gestützt hat, kann im Short-Gamma-Regime zum Slippage-Punkt werden.
- **Kein Pinning erwarten.** Der strukturelle Sog zu stark gewichteten Strikes ist ausgeschaltet. Die Magnet-These greift nicht.
- **Nicht für eine normale Spanne dimensionieren.** Die realisierte Vol ist strukturell höher. Positionsgröße unter der Annahme wählen, dass breitere Stops nötig sind.

Dinge, die man *anfangen* sollte zu tun:

- **Mit der Bewegung handeln.** Trendfolgende Setups haben eine höhere Trefferquote.
- **Walls als Breakout-Ziele behandeln, nicht als Widerstand.** Dasselbe Niveau, das man im Long-Gamma-Regime gefadet hätte, könnte im Short-Gamma-Regime ein Fortsetzungs-Einstieg sein.
- **Beim Einstiegs-Timing selektiver sein.** Breitere Spannen bedeuten mehr Risiko pro Trade. Das mit strengeren Setup-Kriterien ausgleichen.
- **Auf Rückkehr zu positivem Gamma achten.** Das passiert — der Flip ist dynamisch. Wenn der Spot wieder über den Gamma-Flip steigt, dreht sich das Playbook mit.

---

## Durchgerechnetes Beispiel

SPX eröffnet den Tag bei 5.780. ZeroGEX zeigt:

- **Net GEX:** −1,1 Mrd. $ (negativ — Short-Gamma-Regime)
- **Gamma-Flip:** 5.810 (Spot 30 Punkte darunter)
- **Call-Wall:** 5.820
- **Put-Wall:** 5.750

Im Laufe des Vormittags arbeitet sich SPX auf 5.800 nach oben. Der Instinkt an einem Long-Gamma-Tag wäre, Rallyes Richtung des 5.810-Flips und der 5.820-Call-Wall zu faden.

Die strukturelle Lesart sagt hier das Gegenteil. SPX befindet sich in Short-Gamma-Territorium; das Dealer-Hedging verstärkt. Der Push in Richtung 5.810 könnte sich darüber hinaus fortsetzen statt zu faden — insbesondere wenn Net GEX weiter ins Negative abrutscht. Die Call-Wall bei 5.820 wirkt in diesem Regime eher als Breakout-Ziel denn als Widerstand.

Die praktische Tendenz: den Fade auslassen. Entweder mit dem Momentum handeln oder beiseite stehen. Das Playbook gegenüber einem typischen Long-Gamma-Tag umkehren.

Stell dir nun denselben Chart mit Net GEX bei +1,2 Mrd. $ und dem Gamma-Flip bei 5.760 (Spot 40 Punkte darüber) vor. Die strukturelle Lesart kehrt sich um: 5.820 wirkt wahrscheinlich als Widerstand, der Long-Gamma-Reflex absorbiert Rallyes, das Fade-Setup ist gegeben. Derselbe Markt, gegensätzliche Lesart — abhängig von einer einzigen Regime-Variablen.

---

## Häufige Missverständnisse

- **"Negatives Gamma ist bärisch."** Das stimmt nicht. Es ist **volatilitätsverstärkend**. Der Markt kann in einem Negativ-Gamma-Regime stark rallyen — und die Rally tendiert dazu, sich weiter fortzusetzen, als sie es in Long-Gamma tun würde. Bei negativem Gamma geht es um den *Charakter der Bewegungen*, nicht um die Richtung.
- **"Positives Gamma ist bullisch."** Auch falsch. Positives Gamma ist **volatilitätsdämpfend**. Der Markt kann in einem Positiv-Gamma-Regime nach unten driften; er tendiert nur dazu, das langsam mit mean-reversion-artigen Rückprallern entlang des Wegs zu tun.
- **"Man kann Negativ-Gamma-Signale genauso handeln wie Positiv-Gamma-Signale."** Der Großteil der Retail-Verluste kommt daher. Die Signale und die strukturellen Lesarten kehren sich zwischen den Regimen um. Eine "Buy the Dip"-These, die oberhalb des Flips funktioniert, kann unterhalb davon Verluste vergrößern.
- **"Negatives Gamma ist selten."** Es passiert regelmäßig — insbesondere nach Vol-Spikes, während makroökonomischem Stress und wenn die Chain stark put-lastig ist. Das Regime in Echtzeit zu kennen, sagt dir, wann.

---

## Fazit

> Negatives Gamma bedeutet, dass Dealer die Bewegung verstärken, statt sie zu dämpfen. Dieselbe Kette, derselbe SPY, gegensätzlicher Marktcharakter — und gegensätzliche Playbooks für den Trader, der das Regime lesen kann.

Die Disziplin besteht darin, jede Session mit der Regime-Lesart zu beginnen: Wo liegt der Gamma-Flip, wo liegt der Spot, wie hoch ist der Net GEX? Diese drei Zahlen sagen dir, welches Playbook die strukturelle Kraft im Markt heute unterstützen wird. Das falsche Playbook gegen das Regime zu fahren, ist der teuerste Fehler auf der Karte.

Nur Bildungsinhalte — nichts davon ist eine Handelsempfehlung.

---

Wenn du den heutigen Net GEX, den Gamma-Flip und die Live-Regime-Lesart für SPY, SPX und QQQ sehen möchtest — die drei Zahlen, die dir sagen, ob Dealer gerade long gamma oder short gamma sind — zeigt die kostenlose Gamma-Levels-Ansicht von ZeroGEX all das an.
