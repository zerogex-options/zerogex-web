# Wie man Support und Resistance aus dem Options-Positioning ableitet

*Klassische Support- und Resistance-Level sind vor allem Psychologie - gezeichnete Linien, frühere Swings, runde Zahlen. Options-basierte Support- und Resistance-Level sind Mechanik - reales Positioning, das reale Hedging-Flüsse antreibt. So identifiziert man sie und liest sie in Echtzeit.*

---

## Zwei Arten von Support und Resistance

Das S/R-Toolkit des Retail-Traders ist größtenteils chart-basiert: frühere Swing-Hochs und -Tiefs, Trendlinien, runde Zahlen, gleitende Durchschnitte. Sie funktionieren - manchmal - weil genug Trader sie beobachten, sodass sie sich selbst erfüllen. Der Mechanismus ist psychologische Konvergenz.

Options-basierte Support- und Resistance-Level sind anders. Sie leiten sich nicht aus der Kurshistorie ab, sondern aus dem aktuellen Options-Positioning. Der Mechanismus ist strukturell: modellierte Dealer-Hedging-Flüsse, die tendenziell auslösen, wenn sich der Preis konzentrierten Strikes nähert. Ein Großteil dieses Hedgings ist eher systematisch als diskretionär - wenn also das Vorzeichen des modellierten Dealer-Gammas passt, können diese Flüsse nahe dem Widerstand als Angebot und nahe dem Support als Nachfrage wirken.

Wenn Chart-S/R und Options-S/R übereinstimmen, ist das Level tendenziell zuverlässiger. Wenn sie divergieren, hat die Options-basierte Lesart oft mehr Gewicht - weil das Chart-Level Meinung ist und das Options-Level auf positionierungsgetriebenem Hedging-Flow beruht.

Dieser Artikel ist der praktische Workflow, um Options-basierte S/R zu identifizieren, in Echtzeit zu lesen und zu wissen, was zu erwarten ist, wenn der Preis sie testet. Für das größere Gamma-Framework siehe den [Gamma-Exposure-Pillar](/education/gamma-exposure-explained).

---

## Die vier Arten von Options-basierter S/R

Die Bezeichnungen unten - Call Wall als Widerstand, Put Wall als Unterstützung - beschreiben, wogegen sich das modellierte Hedging in einem *positiven Gamma*-Regime stemmt. Sie sind keine festen Eigenschaften des Strikes: Der Optionstyp allein legt die Richtung nicht fest, und das Hedging kann stattdessen mit einer Bewegung laufen, wenn sich das Vorzeichen des modellierten Dealer-Gammas oder der umgebende Flow ändert.

### 1. Call Walls (Resistance)

Die **Call Wall** ist der Strike oberhalb des Spots mit der stärksten Call-Gamma-Exposure. Nach der traditionellen Konvention werden Dealer als long in diesem Bestand modelliert, sodass sie in einem Long-Gamma-Regime tendenziell in Rallyes verkaufen, die sich der Wall nähern. Dieses Verkaufen kann als struktureller Widerstand wirken.

Praktische Lesart: In einem positiven Gamma-Regime stemmt sich das Hedging rund um die Call Wall gegen eine Rally; in einem negativen Gamma-Regime läuft es mit ihr, sodass die Wall, falls sie nachgibt, zum Breakout-Beschleuniger werden kann. Das Regime ändert dieses Verhalten, nicht, wie oft die Wall bricht: S&P-Walls hielten in unserer Messung in etwa zwei von drei Fällen innerhalb einer Stunde, und zwar auf beiden Seiten des Flips.

### 2. Put Walls (Support)

Die **Put Wall** ist der Strike unterhalb des Spots mit der stärksten Put-Gamma-Exposure. Wenn das Netto-Gamma als positiv modelliert wird, kauft das aggregierte Dealer-Buch tendenziell in Selloffs hinein, die sich der Wall nähern. Dieses Netto-Kaufen kann als struktureller Support wirken - beachte, dass der Support aus dem positiven Vorzeichen des Netto-Gammas stammt, nicht daraus, dass der Strike aus Puts besteht (nach der Konvention werden Dealer in diesen Puts als short modelliert).

Gleiche Regime-Abhängigkeit wie bei der Call Wall - bei negativem Gamma kann eine Put Wall, die nachgibt, auf dem Weg nach unten zu einem Slippage-Punkt werden.

Die Mechanik der Walls in beiden Regimen findest du in [Gamma Walls erklärt](/education/gamma-walls-explained).

### 3. Der Gamma Magnet (Pin-Anziehung)

Der **Gamma Magnet** ist der Strike mit der größten absoluten Gamma-Konzentration. Er ist nicht direktional - in einem Long-Gamma-Regime zieht er den Preis tendenziell zu sich hin, und im Short-Gamma-Regime lässt er ihn tendenziell von sich weg. Wenn die Anziehung aktiv ist, kann er gleichzeitig als Support und Resistance wirken: Preis darüber kann nach unten zu ihm hin gezogen werden; Preis darunter kann nach oben gezogen werden.

Der Magnet spielt tendenziell in der Nähe des Verfalls die größte Rolle, wenn Optionen mit Verfall am selben Tag das Gamma-Profil dominieren. Das Pin-Verhalten zum Handelsschluss kann von diesem Strike ausgehen, auch wenn Pinning probabilistisch ist - Liquidität, Trader-Verhalten und Verfallsmechanik tragen ebenfalls dazu bei, und eine große Konzentration ist für sich genommen kein Beweis dafür, dass Dealer dort long Gamma sind.

### 4. Der Gamma Flip (Regime-Linie)

Der **Gamma Flip** ist im klassischen Sinne kein S/R - er ist die Regime-Grenze, ein Nulldurchgang des *modellierten* Dealer-Gamma-Profils. Aber er kann wie eine weiche Support-/Resistance-Linie funktionieren, weil der Preis um ihn herum oft innehält oder kurz umkehrt (der modellierte Dealer-Reflex wechselt nahe diesem Preis das Vorzeichen). Oberhalb des Flips ist der modellierte Reflex, gegen die Bewegung zu handeln (Fade); darunter, ihr zu folgen (Chase) - allerdings ist die Kreuzung eine Modellschätzung, und das realisierte Verhalten hängt weiterhin von Flow, Liquidität und Vol ab.

Siehe [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip) für den Workflow.

---

## Warum dreht SPY an diesen Levels?

Die Umkehrungen, die auf einem SPY-Chart zufällig wirken - der Preis läuft bis zu einem Level, das weder ein früherer Swing noch eine runde Zahl war, bleibt abrupt stehen und dreht wieder ab - gehen meist auf eines dieser vier Levels zurück, das seine Arbeit tut. An der **Call Wall** verkaufen Dealer, die laut Modell an diesem Strike long sind, in die Rally hinein, um gehedgt zu bleiben, und schaffen so Angebot, das die Bewegung deckelt. An der **Put Wall** kauft ein Buch, das netto long Gamma ist, in den Selloff hinein und schafft so Support. Am **Gamma Magnet** zieht der modellierte Hedging-Reflex den Preis zurück zum Strike. Am **Gamma Flip** wechselt dieser Reflex das Vorzeichen, und der Preis hält beim Überqueren oft inne. Keines davon ist im Preischart zu sehen - sie stehen in der Optionskette - weshalb die Umkehr wie aus dem Nichts zu kommen scheint, bis du sie dem Positioning zuordnest. Ob eine Wall die Bewegung absorbiert oder überrollt wird, hing in unserer Messung nicht vom Regime ab - S&P-Walls hielten auf beiden Seiten des Flips in etwa zwei von drei Fällen innerhalb einer Stunde. Was das Regime verändert, ist das Hedging rund um das Level, also lies zuerst den Flip: Bei Long-Gamma stemmt sich das Hedging gegen eine Rally auf die Call Wall zu; bei Short-Gamma verstärkt es die Bewegung, sobald diese Wall nachgibt.

---

## Warum Options-basierte S/R robuster ist als Chart-basierte S/R

Drei Gründe:

1. **Es ist systematisch, nicht gewählt.** Ein Trader kann entscheiden, ob er eine Trendlinie verteidigt oder nicht. Das Gamma-Hedging der Dealer ist weitgehend systematisch - Desks steuern das aggregierte Exposure, statt nach einer eigenen Markteinschätzung zu handeln -, sodass der Flow tendenziell stattfindet, egal ob der Dealer daran glaubt oder nicht. (Desks hedgen Portfolios und nutzen unter Umständen Hedge-Bänder, es ist also eine Tendenz, keine kontinuierlich garantierte Order.)

2. **Es skaliert mit Positioning, nicht mit Aufmerksamkeit.** Eine Trendlinie wird stärker, je mehr Augen darauf gerichtet sind; eine Wall spiegelt mehr Open Interest wider. Je größer die modellierte Konzentration, desto größer der potenzielle Hedging-Flow, wenn sich der Preis nähert. Die Beziehung gründet auf Positioning, nicht auf Stimmung.

3. **Es wird neu berechnet.** Spot, Zeit und implizite Volatilität bewerten das Gamma an jedem Strike neu, sodass intraday ein anderer Strike mit unverändertem OI zur Wall werden kann. Das offizielle OI wird in der Regel nach dem Clearing aktualisiert; eine wandernde Wall ist kein Beleg dafür, dass dort frische Positionen eröffnet wurden.

Trotzdem ist Options-basierte S/R nicht unfehlbar. Es ist eine probabilistische Tendenz. Makro-Schocks und Katalysator-Events setzen sie regelmäßig außer Kraft, und ein Regime-Wechsel verändert, was das Hedging tut. Der Vorteil ist, dass diese Tendenz *fundiert* ist - wenn sie funktioniert, funktioniert sie aus einem nachvollziehbaren Grund.

---

## Wie man die Level in Echtzeit identifiziert

Ein kurzer Workflow:

1. **Zuerst den Gamma Flip abrufen.** Er sagt dir, in welchem Regime du dich befindest. Der Flip selbst ist auch ein weiches Level, das man beobachten sollte.
2. **Call Wall und Put Wall identifizieren.** Diese geben dir die strukturelle Range - die Grenzen, gegen die sich das Dealer-Hedging stemmt (in einem Long-Gamma-Regime) oder durch die hindurch es eine Bewegung verstärkt (in einem Short-Gamma-Regime).
3. **Den Gamma Magnet identifizieren.** Oft der stärkste 0DTE-Strike. Der Magnet zeigt dir, wohin der Preis innerhalb der Wall-Range gezogen wird.
4. **Die Migration prüfen.** Eine Wall, die gerade erst gesprungen ist, ist eine andere Referenz als eine, die seit Stunden stabil ist: Eine migrierende Wall jagt dem Preis hinterher, das Level, das du beobachtest, hat sich also verschoben. In unserer Messung ließ sich weder aus dem Alter einer Wall noch aus ihrer Migration vorhersagen, ob sie brach.
5. **Mit Chart-S/R gegenchecken.** Wo sich das strukturelle Level mit einem Chart-basierten Level (runde Zahl, früherer Swing, wichtiger gleitender Durchschnitt) deckt, kann die Konvergenz das Level schärfer machen.

---

## Wann das strukturelle Level hält

In unserer Messung von 737 Wall-Tests hielten S&P-Walls in etwa zwei von drei Fällen innerhalb einer Stunde nach dem Test und Nasdaq-Walls in etwa der Hälfte der Fälle ([Wie oft brechen Gamma Walls tatsächlich?](/education/how-often-do-gamma-walls-break)). Die Bedingungen, die Trader üblicherweise prüfen, konnten diese Grundrate nicht verbessern:

- Ob der Spot in einem **positiven Gamma-Regime** (oberhalb des Flips) oder in einem negativen lag.
- Ob Net GEX **substanziell und stabil** war oder abnahm.
- Ob die Wall mit dem Preis **migrierte**.
- Ob sich der Flow am Wall-Strike **beschleunigte** oder abbremste.
- Wie lange die Wall schon bestand und wie oft sie bereits getestet worden war.

Die ehrliche Ausgangsannahme für jede Wall ist daher die Grundrate ihres Index, keine Checkliste.

## Wann das strukturelle Level bricht

Was das Regime verändert, ist, was das Hedging tut, wenn ein Level nachgibt:

- In einem **positiven Gamma-Regime** stemmt sich das Hedging gegen die Bewegung, sodass hinter einem Bruch weniger Hedging steht.
- In einem **negativen Gamma-Regime** jagen Dealer der Bewegung hinterher, statt gegenzuhalten, sodass ihr Hedging den Bruch verstärkt.
- Wenn Spot, Zeit oder Volatilität das Ranking der Strikes verändern, kann die Wall **migrieren**, und das Level, das du beobachtet hast, ist nicht mehr der stärkste Strike.
- Ein **Katalysator**, der während des Tests eintrifft, kann das Hedging in jedem der beiden Regime überwältigen.

Nichts davon macht es wahrscheinlicher, dass ein Level bricht, als dass es hält. Zuerst das Regime zu lesen, sagt dir, mit welchem Mechanismus du tradest, nicht, wie die Chancen stehen.

---

## Durchgerechnetes Beispiel

SPY steht bei 581,50. Das klassische Charting zeigt Widerstand um 583 (früheres Swing-Hoch) und Support um 580 (50-Tage-Durchschnitt, runde Zahl). ZeroGEX zeigt:

- **Call Wall:** 583,50 (nah an, aber nicht exakt am Chart-Widerstand)
- **Put Wall:** 580,00 (genau am Chart-Support)
- **Gamma Flip:** 580,80 (zwischen aktuellem Spot und der Put Wall)
- **Gamma Magnet:** 581,00 (praktisch am Spot)
- **Net GEX:** +1,1 Mrd. $, stabil (eine modellierte Schätzung des Dealer-Gammas auf Basis der traditionellen Call-positiv/Put-negativ-Konvention für das Open Interest, kein beobachteter Dealerbestand)

Die zusammengesetzte strukturelle Lesart:

- Die Call Wall und der Chart-Widerstand stimmen nahe 583 überein - die Widerstandszone mit höherer Konfidenz liegt genau dort, wo Chart-Trader sie sehen, aber das modellierte Positioning verortet die Wall bei 583,50, nicht bei der runden 583.
- Auch die Put Wall und der Chart-Support stimmen nahe 580 überein - dort eine stärkere Support-Lesart.
- Der Gamma Magnet bei 581,00 bedeutet, dass der Preis strukturell ungefähr dorthin gezogen werden kann, wo er gerade steht. Solange das positive Gamma anhält, stemmt sich das Hedging in beide Richtungen gegen Bewegungen.
- Der Flip bei 580,80 bedeutet, dass ein Fall unter 580,80 das modellierte Regime kippen würde; passiert das zuerst und gibt die Put Wall bei 580 anschließend nach, verstärkt das Hedging die Bewegung, statt sie abzufedern.

Die Lesart: Das modellierte Hedging stemmt sich gegen Bewegungen in Richtung eines der beiden Ränder der Range von 581-583,50, aber jede Wall bleibt eine Wette auf die Grundrate - SPY-Walls hielten in unserer Messung in etwa zwei von drei Fällen innerhalb einer Stunde, unabhängig davon, auf welcher Seite des Flips der Preis stand. Die strukturelle Lesart ergänzt, wo die Levels liegen und was das Hedging rund um sie tut; sie sagt dir nicht, welches davon nachgeben wird.

---

## Häufige Fehlinterpretationen

- **„Es liegt am früheren Swing-Hoch, also ist es Widerstand."** Manchmal. Manchmal liegt das tatsächliche strukturelle Level 30 Cent höher oder niedriger - und die Bewegung, die den Chart-Widerstand „durchbrach", war schon immer dazu bestimmt, sich bis zur echten Wall auszudehnen.
- **„Die Put Wall liegt bei 580, also wird 580 halten."** In keinem der beiden Regime verlässlich: S&P-Walls brachen in unserer Messung bei etwa jedem dritten Test innerhalb einer Stunde, ob bei Long- oder Short-Gamma. Was das Regime verändert, ist, was danach kommt - bei Short-Gamma kann eine Put Wall, die nachgibt, zu einem Slippage-Punkt werden.
- **„Options-basierte S/R funktioniert nicht."** Sie verortet reales Positioning, und S&P-Walls hielten in unserer Messung in etwa zwei von drei Fällen innerhalb einer Stunde. Was sie dir nicht gibt, ist eine Möglichkeit, im Voraus zu erkennen, welche Wall brechen wird: Regime, Net GEX, Migration und Flow am Strike gaben das nicht her.

---

## Fazit

> Options-basierte Support- und Resistance-Level sind Mechanik, keine Psychologie. Sie identifizieren die Level, an denen Dealer-Hedging am ehesten auslöst - und das modellierte Regime sagt dir, ob dieser Flow die Bewegung tendenziell absorbiert oder verstärkt.

Die Disziplin besteht darin, zuerst die strukturelle Landkarte zu lesen, sie mit Chart-basierten Levels auf Konvergenz zu prüfen und das Regime zu verifizieren, bevor man entscheidet, was mit dem Level zu tun ist. Ein Großteil des scheinbaren „Rauschens" in der Retail-Chart-S/R ist die Lücke zwischen dem, wo Charts sagen, dass das Level liegt, und dem, wo das Positioning es tatsächlich hinsetzt.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige Call Wall und Put Wall, den Gamma Flip und den Gamma Magnet für SPY, SPX, QQQ und NDX sehen willst - die vier strukturellen Level, die die meiste Options-basierte S/R antreiben - zeigt sie dir die kostenlose Gamma-Levels-Ansicht von ZeroGEX.
