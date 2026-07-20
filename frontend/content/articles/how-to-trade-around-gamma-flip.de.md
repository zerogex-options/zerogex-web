# So tradet man rund um Gamma-Flip-Level

*Der Gamma-Flip ist die klarste einzelne Regimelinie in der Analyse des Dealer-Positioning. Hier erfährst du, wie man rund um ihn tradet — was sich ändert, wenn der Spot ihn überquert, welche drei Setup-Typen jedes Regime unterstützt, und den Workflow, um den Flip als Playbook-Umschalter statt als Richtungssignal zu nutzen.*

---

## Der Flip ist kein Level — er ist ein Playbook-Umschalter

Die meisten Retail-Trader, die von "Gamma-Flip" hören, behandeln ihn wie eine weitere Support-/Resistance-Linie. Am Flip kaufen; am Flip verkaufen; den Bounce traden. Diese Sichtweise verfehlt, was der Flip tatsächlich ist. Der Flip ist kein Level, das der Preis respektiert — er ist eine **Regimegrenze**, die bestimmt, welches Playbook der Dealer-Hedging-Mechanismus heute unterstützt.

Oberhalb des Flips ist der Dealer-Reflex, Stärke zu faden und Schwäche zu kaufen. Mean-Reversion-Playbooks haben strukturellen Rückenwind. Breakouts scheitern tendenziell; Pins bilden sich tendenziell; die Volatilität komprimiert sich.

Unterhalb des Flips kehrt sich derselbe Reflex um. Das Dealer-Buch verstärkt Bewegungen, statt sie zu dämpfen. Trend-Continuation-Playbooks haben den Rückenwind; Breakouts weiten sich aus; Pins brechen; die Volatilität expandiert.

Das ist nicht "Support und Resistance am Flip". Das sind zwei unterschiedliche Playbooks für denselben Chart, je nachdem, auf welcher Seite eines bestimmten Preises man sich befindet. Gut rund um den Flip zu traden bedeutet, beim Cross das Playbook zu wechseln — nicht, ein Level zu traden.

Dieser Artikel behandelt den Workflow. Für die tiefere Lektüre darüber, was der Flip ist und wie man ihn konzeptionell liest, siehe [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip); für die zugrunde liegende Mechanik den [Gamma Exposure Pillar](/education/gamma-exposure-explained).

---

## Die drei Setups, die jedes Regime unterstützt

### Oberhalb des Flips (Long-Gamma-Regime)

**Setup-Typ 1: Extreme zurück zum Magneten faden.**
Der Dealer-Reflex zieht den Preis zu Strikes mit schwerem Gamma. Verkäufe bei Pushes nahe dem Call Wall und Käufe bei Dips nahe dem Put Wall haben strukturelle Unterstützung — der Hedge-Flow ist auf deiner Seite. Positionsgröße klein halten; Gewinne am Magneten mitnehmen.

**Setup-Typ 2: Gescheiterte Breakouts faden.**
Wenn SPX über den Call Wall durchbricht, das Net GEX aber positiv ist und sich verstärkt, ist der Breakout strukturell wahrscheinlich zum Scheitern verurteilt. Der Fade — short auf den Break, Ziel: Wiedereintritt in die vorherige Range — ist der klassische Long-Gamma-Trade. Das Trap-Detection-Signal existiert genau für diese Lesart; siehe den [kombinierten Artikel zu EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection).

**Setup-Typ 3: Prämienverkauf rund um den Gamma-Magneten.**
Das Pin-Verhalten in einem positiven Gamma-Regime tendiert dazu, die realisierte Volatilität zu komprimieren. Der Verkauf von Near-the-Money-Prämie gegen den Magnet-Strike kann funktionieren — auch wenn es sich um einen Trade mit definiertem Risiko handelt, nicht um eine strukturelle Garantie. Angemessen für das Tail-Risiko dimensionieren.

### Unterhalb des Flips (Short-Gamma-Regime)

**Setup-Typ 1: Continuation-Breakouts.**
Dealer müssen in diesem Regime Stärke kaufen und Schwäche verkaufen — der Reflex weitet Bewegungen aus. Der Kauf eines sauberen Ausbruchs über Resistance (besonders bei klar negativem Net GEX) hat strukturellen Rückenwind. Das Squeeze-Setup-Signal bewertet genau diese Art von aufgestautem, sich ausweitendem Setup; siehe [Squeeze Setup Signal Explained](/education/squeeze-setup-explained).

**Setup-Typ 2: Nicht ins fallende Messer greifen.**
Derselbe Reflex, der Rallyes verstärkt, verstärkt auch Sell-offs. Das Auffangen von Falling-Knife-Setups in einem tiefen Short-Gamma-Regime neigt dazu, Verluste zu verstärken, weil der Dealer-Mechanismus, der im Long-Gamma-Regime den Bounce produziert hätte, hier umgekehrt ist. Die Dip-Buy-These verliert unterhalb des Flips speziell ihre strukturelle Unterstützung.

**Setup-Typ 3: Mit der Flow-Richtung traden, nicht dagegen.**
Tape Flow Bias und ähnliche Continuation-Signale haben in Short-Gamma-Regimen mehr Gewicht. Wenn der prämiengewichtete Flow in eine Richtung tendiert und das Net GEX negativ ist, weitet sich die Bewegung tendenziell eher aus, als dass sie fadet.

---

## Wie man den Flip tatsächlich intraday nutzt

Ein kurzer Workflow:

### Schritt 1: Regime bei Eröffnung prüfen

Vor jedem Setup Gamma-Flip und Net GEX abrufen. Gamma-Magnet und Walls notieren. Die Position des Spots relativ zum Flip ist die erste Lesart des Tages — und die Playbook-Erwartung sollte sich daraus ableiten.

### Schritt 2: Einen "Regimewechsel"-Trigger setzen

Kreuzt der Spot während der Session den Flip, kippt dein Standard-Playbook. Das ist nicht symbolisch — es ist der tatsächliche Mechanismus, der sich umkehrt. Ein Trader, der zwei Stunden lang oberhalb des Flips Rallyes gefadet hat, sollte damit aufhören, sobald der Spot darunter kreuzt; derselbe Trade ist jetzt strukturell nicht mehr unterstützt.

### Schritt 3: Die Distanz beobachten, nicht nur die Seite

Ein Spot, der 0,05 % oberhalb des Flips steht, ist strukturell umkämpft — beide Regime sind teilweise aktiv. Ein Spot, der 0,4 % darüber steht, ist fest im Long-Gamma. Die Distanz zum Flip ist Teil der Lesart. Die umkämpfte Zone (etwa ±0,1 % des Flips) ist das Umfeld mit dem höchsten Rauschen; Größe reduzieren oder aussetzen.

### Schritt 4: Flip-Migration beobachten

Der Flip bewegt sich intraday, während sich das Positioning neu ausbalanciert. Ein Flip, der nach oben driftet, während der Preis höher mahlt, ist eine Lesart; ein Flip, der stehen bleibt, während der Preis darüber klettert, eine andere. Die Beziehung zwischen Preis und Flip ist dynamisch — verfolge die *Veränderung* der Lücke, nicht nur die statische Distanz.

### Schritt 5: Gegenprüfung mit der Net-GEX-Größenordnung

Ein Flip mit 1,5 Mrd. USD Net GEX darüber ist ein scharfes Regime. Ein Flip mit 200 Mio. USD ist ein schwaches. Die Größenordnung zählt genauso viel wie das Vorzeichen. Je größer das Dealer-Buch, desto mehr zeigt sich der Regime-Reflex im Tape.

---

## Wenn der Flip umkämpft ist

Der gefährlichste Zustand ist, wenn der Spot *genau am* Flip steht. Die Reflexe beider Regime sind teilweise aktiv, keiner dominiert, und das Verhalten ist instabil. Die Trades, die oberhalb des Flips funktionieren, funktionieren nicht; die Trades, die unterhalb funktionieren, funktionieren ebenso wenig. Praktisch bedeutet das:

- Positionsgröße reduzieren oder aussetzen.
- Sich nicht auf ein einzelnes Regime-Playbook festlegen.
- Beobachten, auf welcher Seite des Flips sich der Preis einpendelt — die Antwort verrät, welches Playbook als Nächstes gilt.
- Besonders vorsichtig sein zum Handelsschluss hin, wenn Charm-Flows den Spot über den Flip drücken und einen Regimewechsel festschreiben können.

Ein umkämpfter Flip ist ein Signal für Regime-Unsicherheit. Die richtige Reaktion ist reduziertes Exposure, nicht ein anderer Trade.

---

## Durchgerechnetes Beispiel

SPX steht bei Eröffnung bei 5.810. ZeroGEX zeigt:

- **Gamma Flip:** 5.802 (Spot ist +8 darüber)
- **Net GEX:** +1,2 Mrd. USD
- **Call Wall:** 5.820
- **Put Wall:** 5.790

Erste Lesart: Long-Gamma-Regime, gesundes Positioning, strukturelle Range 5.790–5.820. Standard-Playbook: Extreme faden (Verkauf bei Pushes Richtung 5.820, Kauf bei Dips Richtung 5.790), die Mitte auslassen.

Bis 13:00 ET ist SPX auf 5.800 abgerutscht — jetzt 2 Punkte unter dem Flip. Net GEX ist auf +300 Mio. USD gesunken, und der Flip ist auf 5.803 nach oben gedriftet. Das Regime ist umkämpft — der Spot hat den Flip gerade gekreuzt, die Größenordnung schrumpft, und der strukturelle Reflex schwächt sich ab.

Das Playbook wechselt. Das Fade-the-Rally-Setup, das um 14:30 aktiv war, ist jetzt strukturell nicht mehr unterstützt; eine Fortsetzung nach oben ist möglich, falls das Net GEX ins Negative kippt. Die Positionsgröße sollte schrumpfen; der Standard-Trade ist "kein Trade", bis sich das Regime klärt.

Um 14:30 ET ist das Net GEX auf −200 Mio. USD gekippt, und SPX ist auf 5.815 gestiegen. Das ist jetzt ein Short-Gamma-Regime — der Dealer-Reflex verstärkt, und der Call Wall bei 5.820 ist keine strukturelle Resistance mehr; er ist ein Breakout-Ziel. Der Fade-the-Breakout-Trade ist *vom Tisch*; wenn das Setup stimmt, wird die Verfolgung des Ausbruchs zum Spiel.

Derselbe Chart, drei unterschiedliche Playbooks im Verlauf der Session — vollständig getrieben von der Regimevariable.

---

## Häufige Fehler

- **Den Flip als Support oder Resistance behandeln.** Er ist eine Regimelinie, kein Level. Schwäche *hinein in* den Flip von oben zu kaufen, ist strukturell etwas anderes als sie von unten zu kaufen. Derselbe Chart-Entry hat einen entgegengesetzten Mechanismus dahinter.
- **Den Flip ignorieren, wenn der Spot weit davon entfernt ist.** Auch wenn der Spot 1 % über dem Flip liegt, ist der Flip für den Kontext weiterhin relevant — er sagt dir, in welchem Regime sich das heutige Playbook befindet. Der Flip zählt nicht nur, wenn der Preis in seiner Nähe ist.
- **Regime-Persistenz als unvermeidlich behandeln.** Long-Gamma-Regime können innerhalb einer Stunde zu Short-Gamma kippen. Der Flip ist dynamisch. Eine Regime-Lesart vom Vormittag kann bis zum Mittag überholt sein.
- **Den Flip-Cross als Bounce-Setup traden.** Der Flip-Cross ist ein *Playbook-Signal*, kein Bounce-Signal. Manchmal prallt der Preis daran ab; oft durchbricht er ihn. Nicht das Level traden — den Regimewechsel traden.

---

## Fazit

> Der Gamma-Flip ist kein Preislevel, gegen das man tradet. Er ist ein Playbook-Umschalter — die Linie, an der sich der Dealer-Hedging-Reflex umkehrt. Gut rund um ihn zu traden bedeutet, zu ändern, welche Setups man nimmt, nicht seine Entries zu ändern.

Die Disziplin besteht darin, das Regime vor jedem Setup zu prüfen und es bei jedem Flip-Cross erneut zu prüfen. Das Playbook, das strukturellen Rückenwind auf einer Seite des Flips hat, ist das Playbook, das auf der anderen Seite zermahlen wird. Die meisten Trader, die beim "Traden des Flips" Geld verlieren, verlieren in Wirklichkeit Geld, weil sie das falsche Playbook für das aktuelle Regime fahren.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.

---

Wenn du den heutigen Gamma-Flip mit der Live-Distanz zum Spot, dem Regime-Check und der Net-GEX-Größenordnung sehen willst — den drei Zahlen, die entscheiden, welches Playbook die strukturelle Kraft im Tape gerade unterstützt — die kostenlose Gamma-Levels-Ansicht von ZeroGEX zeigt sie alle.
