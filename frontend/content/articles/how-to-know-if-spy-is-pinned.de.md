# Wie man erkennt, ob SPY gepinnt ist: Die fünf Anzeichen

*Wie man erkennt, ob SPY heute gepinnt ist — die fünf strukturellen Anzeichen dafür, dass der Preis zu einem Strike hin magnetisiert wird, und das Trading-Playbook (Extreme faden, die Mitte meiden), das ein gepinntes Tape belohnt.*

---

## Pin-Erkennung ist der sauberste Day-Trade-Filter

Die meisten Day-Trade-Verluste entstehen dadurch, dass man das falsche Playbook für das jeweilige Regime fährt. Die Version dieses Fehlers mit dem höchsten Hebel ist der Versuch, Momentum in einem gepinnten Tape zu traden. SPY komprimiert sich zu einem Strike hin, man kauft den ersten Push, er dreht, man verkauft den ersten Dip, er bounct. Tod durch Chop. Um 14:00 ET liegt man 1,5 % im Minus an einem Tag, an dem sich SPY kaum um 0,3 % bewegt hat.

Die Lösung ist Regime-Erkennung: zu wissen, wann SPY gepinnt ist, und das Playbook entsprechend zu wechseln. Ein gepinntes Tape belohnt das Faden der Extreme der Kompressionsrange; alles andere bestraft es. Sobald man den Pin in Echtzeit erkennen kann, verbessert sich die Trade-Selektion sofort.

Dieser Artikel geht die fünf strukturellen Anzeichen dafür durch, dass SPY heute gepinnt ist, das Playbook, das in diesem Regime funktioniert, und wann der Pin bricht. Für die zugehörige Erklärung zum Pinning-Mechanismus selbst siehe [Warum pinnt SPY in der Nähe eines Strikes?](/education/why-spy-pins-near-strikes); für den breiteren Regime-Kontext den [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained).

---

## Was ein Pin eigentlich ist

Ein Pin entsteht, wenn Dealer-Hedging eine strukturelle Anziehung zu einem Strike mit hohem Gamma erzeugt. Der Mechanismus:

1. Ein bestimmter Strike — meist die stärkste 0DTE-Call/Put-Konzentration — trägt großes Dealer-Gamma.
2. Das Regime ist **long-gamma**: Dealer hedgen, indem sie Stärke verkaufen und Schwäche kaufen.
3. Steigt der Spot über den Strike, verkaufen die Dealer — das zieht den Preis wieder nach unten.
4. Fällt der Spot unter den Strike, kaufen die Dealer — das zieht den Preis wieder nach oben.
5. Der Nettoeffekt ist ein Preis, der in einer engen Range *um* den Strike herum oszilliert. Der Strike wirkt wie ein Magnet.

Pins sind nicht psychologischer Natur. Sie sind das sichtbare Ergebnis von erzwungenem Hedging an einer Strike-Konzentration. Sie bilden sich am zuverlässigsten an OPEX-Tagen, zum Monatsende und gegen den Cash-Close — überall dort, wo taggleiche oder kurzlaufende Optionen das Gamma-Profil dominieren.

Der vollständige Mechanismus steht in [Warum pinnt SPY in der Nähe eines Strikes?](/education/why-spy-pins-near-strikes).

---

## Die fünf Anzeichen, dass SPY heute gepinnt ist

### Anzeichen 1: Net GEX ist deutlich positiv (Long-Gamma-Regime)

Der Pin tritt nur in einem Long-Gamma-Regime auf. Der Spot muss oberhalb des Gamma Flip liegen, und Net GEX muss substanziell sein (die Standardschwelle, die die meisten Analysten beobachten, liegt für SPY-Größenordnungen bei etwa $500M+, wobei die Größenordnung wichtiger ist als eine konkrete Zahl).

Ist Net GEX negativ oder nahe null, ist die Pin-These vom Tisch. Der Dealer-Reflex zieht nicht — er jagt dem Preis hinterher oder ist neutral. Das Pin-Playbook komplett auslassen.

### Anzeichen 2: Max Pain und der Gamma-Magnet stimmen nahe dem Spot überein

Zwei strukturelle Strikes lohnt es sich zu prüfen: **Max Pain** (der Strike, bei dem die Auszahlung der Optionsinhaber bei Verfall minimiert wird) und der **Gamma-Magnet** (der Strike mit dem größten absoluten Gamma). Zeigen beide auf dasselbe Niveau und liegt dieses Niveau innerhalb von 0,3 % vom aktuellen Spot, ist der strukturelle Sog am stärksten.

Weichen sie voneinander ab, gewinnt meist der Gamma-Magnet — er ist der tatsächliche Hedging-Mechanismus, während Max Pain die Payoff-Geometrie ist. Siehe [Max Pain erklärt](/education/max-pain-explained) für den Unterschied.

### Anzeichen 3: Der Spot oszilliert seit der letzten Stunde um den Magneten

Ein Live-Check: SPY im 5-Minuten-Chart gegen den Gamma-Magnet-Strike auftragen. Hat der Preis die Magnet-Linie in den letzten 60 Minuten drei- oder mehrmals gekreuzt, wobei jede Ausschlag kleiner wird, bildet sich der Pin. Die Kompressionsrange verengt sich, je stärker der Magnet nahe dem Verfall zieht.

Das Gegenteil — der Preis driftet konstant über oder unter dem Magneten, ohne zurückzukehren — spricht gegen den Pin. Der Preis befindet sich in einer Richtung, nicht in einer Range.

### Anzeichen 4: Die realisierte Volatilität hat sich unter die implizite komprimiert

Hierfür braucht man einen Vol-Check: Liegt SPYs realisierte Intraday-Vol der letzten Stunde deutlich unter der impliziten Vol des Tages, leistet der Dealer-Reflex seine Arbeit. Long-Gamma-Hedging dämpft die realisierte Vol; ein erfolgreicher Pin zeigt sich als realisiert < implizit.

Expandiert die realisierte Vol dagegen (der Preis bewegt sich mehr als erwartet), hält der Pin nicht. Das Dealer-Buch wird von anderem Flow überrannt.

### Anzeichen 5: EOD Pressure liegt innerhalb des aktiven Fensters nahe null

Nach 14:30 ET wird das EOD-Pressure-Signal aussagekräftig. Ein Wert nahe null (zwischen -0,20 und +0,20) innerhalb des aktiven Fensters ist die strukturelle Signatur eines Pins — die Charm- und Pin-Gravity-Terme heben sich gegenseitig auf, was passiert, wenn der Preis genau am Magnet-Strike sitzt.

Ein stark positiver oder negativer EOD-Pressure-Wert ist das gegenteilige Signal: Der Preis ist *entfernt* vom Magneten, und erzwungenes Hedging drückt ihn zurück zum Magneten (oder weg davon, in einem Short-Gamma-Regime). Siehe [EOD-Pressure-Signal erklärt](/education/eod-pressure-explained) für die vollständige Interpretation.

---

## Das Playbook für ein gepinntes Tape

Wenn alle (oder die meisten) der fünf Anzeichen zusammenkommen, ist das Playbook einfach und konträr:

### Tun: die Extreme der Kompressionsrange faden

Der strukturelle Sog geht zurück zum Magneten. Pushes nahe der Oberseite der Kompressionsrange zu verkaufen (und Pushes nahe der Unterseite zu kaufen) ist das einzige Setup, bei dem der Dealer-Reflex auf deiner Seite ist. Klein positionieren — Pins sind probabilistisch, nicht garantiert — aber der Read ist strukturell.

### Nicht: der Mitte der Range hinterherjagen

In der Mitte sitzt der Magnet. In der Mitte zu kaufen oder zu verkaufen bedeutet, in ein Niveau zu investieren, zu dem der Preis strukturell zurückzukehren versucht. Der Erwartungswert liegt bei annähernd null, mit negativem Carry durch Spread und Theta. Hier entstehen die meisten Verluste bei gepinnten Tapes — Nachläufer, die jeden Push kaufen und jeden Dip in der Mitte verkaufen.

### Nicht: Momentum-Setups eingehen

Momentum-Playbooks (Breakout, Vol-Expansion, Squeeze) gehen davon aus, dass sich die Bewegung fortsetzt. Ein gepinntes Tape ist die gegenteilige Annahme. Das falsche Playbook zu fahren ist der Großteil des Fehlers.

### Tun: Positionsgröße verkleinern

Die Ranges eines gepinnten Tapes sind eng. Stops sind noch enger. Die Positionsgröße sollte den kleineren Reward widerspiegeln (und den kürzeren Abstand zum Magneten für den Stop). Ein gepinntes Tape mit normaler Positionsgröße zu behandeln, führt geradewegs zu vorzeitigen Stop-Outs.

---

## Wenn der Pin bricht

Pins halten nicht ewig. Die Bedingungen, die sie brechen:

- **Ein Katalysator.** CPI, FOMC, NFP, geopolitische Überraschung. Makro-Flow überwältigt den strukturellen Sog.
- **Ein Gamma-Flip-Cross.** Kreuzt der Spot unter den Gamma Flip, kehrt sich das Regime um. Derselbe Magnet, der den Preis in Long-Gamma zu sich hingezogen hat, lässt den Preis in Short-Gamma los.
- **Net-GEX-Abbau.** Da 0DTE-Positionen auslaufen (besonders nach 15:30 ET), dünnt sich das Dealer-Buch aus. Der Magnet schwächt sich ab.
- **Ein Einzeltitel- oder Sektorschock.** Wichtige Komponenten-News (NVDA, AAPL, MSFT) können den Index-Flow so weit verschieben, dass sie den Pin überschreiben.
- **Der Wall wandert.** Baut sich frisches Open Interest aggressiv an einem anderen Strike auf, wandert der Magnet — und der alte Pin wird irrelevant.

Diese Brüche im Blick zu behalten ist Teil des Workflows. Ein Pin, der seit zwei Stunden hält, ist verlässlicher als einer, der sich gerade erst gebildet hat — aber ein Pin kann sich auch schnell auflösen, wenn die stützenden Bedingungen wegfallen.

---

## Durchgerechnetes Beispiel

Es ist 13:30 ET an einem Freitag. SPY steht bei 581,10. ZeroGEX zeigt:

- **Net GEX:** +$1,3B (Long-Gamma)
- **Gamma Flip:** 579,50 (Spot deutlich darüber)
- **Gamma-Magnet:** 581,00 (praktisch am Spot)
- **Max Pain:** 581,00 (stimmt mit dem Magneten überein)
- **EOD Pressure:** +0,10 (nahe null — Pin-Signatur innerhalb des Fensters)

SPY ist in den letzten 60 Minuten viermal zwischen 580,85 und 581,30 hin- und hergependelt, wobei jede Ausschlag kleiner wurde.

Der zusammengesetzte Read: Jedes der fünf Pin-Anzeichen ist aktiv. Net GEX ist gesund positiv, Max Pain und der Magnet stimmen bei 581 überein, der Magnet sitzt am Spot, der Preis oszilliert mit sich verengender Amplitude, und EOD Pressure liegt innerhalb des aktiven Fensters nahe null. Das ist ein Lehrbuch-Pin.

Praktische Ausrichtung: Extreme faden (kleine Puts nahe 581,30, kleine Calls nahe 580,85), die Mitte komplett meiden. Positionsgröße klein halten. Auf die Bruchbedingungen achten — besonders den Net-GEX-Abbau, während sich der Close nähert.

---

## Häufige Fehllesungen

Drei Fallen:

- **"Es ist einmal bei 580,85 gebounct, also ist es gepinnt."** Ein einzelner Bounce ist kein Pin. Man braucht mehrere Oszillationen *und* die strukturellen Bedingungen (positives Net GEX, Übereinstimmung von Magnet und Spot). Ein Bounce ist nur ein Bounce.
- **"Es hat den ganzen Tag geranged, also wird es weiter rangen."** Ranges brechen. Der Pin hält wegen der *aktuellen* strukturellen Bedingungen. Baut sich Net GEX gegen den Close ab oder trifft ein Katalysator ein, bricht die Range. Die strukturellen Bedingungen aktualisieren sich schneller als das Chartmuster.
- **"Ich sollte den Breakout aus dem Pin kaufen."** Manchmal — aber der Breakout aus einem echten Pin ist statistisch weniger wahrscheinlich als die Fortsetzung des Pins, bis sich die strukturellen Bedingungen ändern. Jeden Ausbruchsversuch außerhalb der Range als Breakout-Signal zu behandeln, bringt einen wiederholt long am Top und short am Boden.

---

## Fazit

> Ein gepinntes SPY-Tape ist einer der saubersten Regime-Reads im Day-Trading — und es ist das Regime, in dem das falsche Playbook am meisten kostet. Die fünf oben genannten Anzeichen zeigen dir, dass das Regime aktiv ist; das Playbook (Extreme faden, Mitte meiden, kleine Größe) ist das, was darin funktioniert.

Die Disziplin besteht darin, den Pin zu erkennen, *bevor* man an diesem Tag mit dem Traden des Tapes beginnt — nicht erst, nachdem man dreimal in der Mitte der Range verloren hat. Der strukturelle Read ist ab der Eröffnung verfügbar; die Erkennung ist der Edge.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.

---

Wenn du den heutigen Gamma Flip, Net GEX, Gamma-Magnet und Max Pain sehen willst — die vier strukturellen Levels, die entscheiden, ob SPY heute gepinnt ist — zeigt die kostenlose ZeroGEX-Gamma-Levels-Ansicht sie alle an.
