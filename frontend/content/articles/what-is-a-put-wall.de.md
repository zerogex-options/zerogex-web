# Was ist eine Put Wall? Put-Gamma-Konzentration erklärt
> **Aktualisierter Methodikhinweis — er hat Vorrang vor abweichenden Formulierungen weiter unten.** ZeroGEX schätzt Dealerbestände aus öffentlichen Daten; es beobachtet sie nicht. Das Modell behält die Call-positiv/Put-negativ-Konvention bei (`Net GEX = Call GEX − Put GEX`) und unterstellt Dealer netto long Calls und netto short Puts. Long Calls und Long Puts haben positives Gamma; Short Calls und Short Puts negatives Gamma. Die Put Wall ist die größte Put-Gamma-Konzentration unter Spot und lokal modelliertes negatives Dealer-Gamma: Sie kann mit Unterstützung zusammenfallen, doch das Hedging eines Short Puts erzeugt keinen mechanischen Boden. Walls können sich durch Spot, Zeit und implizite Volatilität verschieben, obwohl das offizielle Open Interest intraday unverändert bleibt. Nahe Verfall konzentriert sich Gamma am Geld; ATM-Gamma kann steigen, während deutlich ITM- oder OTM-Gamma gegen null geht. Der ausgewählte Gamma Flip ist ein lokaler Übergang; ein Profil kann mehrere oder keine aussagekräftige Kreuzung haben. Charm und Vanna sind bedingte Deltaänderungen, keine geplanten Orders. Signalwerte sind heuristische Modellergebnisse, keine kalibrierten Wahrscheinlichkeiten. Negatives Gamma verstärkt die bereits laufende Richtung; die Entfernung zu einem Ziel impliziert keine Abstoßung. Die Vorzeichenumkehr des EOD-Pressure-Pin-Terms bleibt daher eine ZeroGEX-Heuristik. Max Pain minimiert die aggregierte intrinsische Auszahlung und maximiert nicht exakt den wertlos verfallenden Nominalwert. Rohes DEX misst Optionsdelta, nicht künftigen Hedge-Flow; Prämie und Aggressorseite beweisen weder Information noch Eröffnung oder Überzeugung.

*Die Put Wall in einfachen Worten — was sie ist, warum der Preis in ihrer Nähe oft reagiert, warum der modellierte Short-Put-Hedge sie nicht zu einem mechanischen Boden macht, wie sie sich von der Call Wall unterscheidet, was ein Bruch bedeutet und wo du die heutige Put Wall für SPX, SPY, QQQ und NDX findest.*

---

## Was ist eine Put Wall?

Eine **Put Wall** ist der Strike unterhalb des aktuellen Preises, an dem die Put-seitige Gamma-Exposure in der Optionskette am stärksten konzentriert ist. Trader beobachten sie als untere Kante der Spanne, zu der das aktuelle Positioning am besten passt — der Strike, an dem ein Rückgang am ehesten auf eine Reaktion aus Hedging, Liquidität und dem übrigen Flow trifft, der sich um einen schweren Strike sammelt.

Genauer: Die Put Wall ist der Strike auf oder unter Spot mit dem größten vorzeichenlosen Put-Gamma-Betrag in der ausgewählten Optionskette. ZeroGEX rankt Strikes aus modelliertem Gamma multipliziert mit dem offiziellen Open Interest und wendet den Spot-seitigen Filter an. Sie ist eine strukturelle Referenz, kein Versprechen, dass der Preis abprallt.

Unter der traditionellen Call-positiv/Put-negativ-Konvention von ZeroGEX ist der Put-Bestand an diesem Strike **lokal negatives modelliertes Dealer-Gamma**. Für einen delta-gehedgten Dealer, der einen Put short ist, macht ein Preisrückgang die Optionsposition positiver im Delta; um den Hedge zu halten, muss er in der Regel mehr Underlying verkaufen. Diese lokale Anpassung kann den Rückgang verstärken. Die Put Wall ist damit kein mechanisch verteidigter Dealer-Boden und kein Spiegelbild einer positiven Call Wall.

## Wie ZeroGEX Dealer-Positioning modelliert

Öffentliche Optionsketten-Daten geben den vollständigen Long- und Short-Bestand der Dealer nicht preis. ZeroGEX weist Calls daher positive und Puts negative modellierte Exposure zu, was grob dem Bild entspricht, dass Dealer netto long die von Kunden verkauften Calls und netto short die von Kunden gekauften Puts sind. Die Konvention ist nützlich, um Kettenstrukturen zu vergleichen, sie ist aber keine direkte Beobachtung des Dealerbestands; das tatsächliche Positioning kann davon abweichen.

Das modellierte Net GEX bleibt:

```text
Modelliertes Net GEX = Call GEX - Put GEX
```

Long Calls und Long Puts haben jeweils positives Gamma; Short Calls und Short Puts jeweils negatives Gamma. Das negative Vorzeichen der Puts oben stammt aus der unterstellten Dealerposition, nicht aus einem inhärent negativen Gamma von Puts.

## Warum die Put Wall oft mit Unterstützung zusammenfällt

Eine Put Wall kann mit beobachteter Unterstützung zusammenfallen — wegen des vollständigen Gamma-Profils, der Liquidität, der Monetarisierung von Puts, des Kundenverhaltens, systematischer Nachfrage oder anderer Marktflüsse. Positives modelliertes Call-Gamma an anderer Stelle kann das negative modellierte Put-Gamma an der Wall zudem überwiegen, sodass das aggregierte Net GEX positiv bleibt. Aggregiert positives Gamma beweist aber nicht, dass Dealer-Käufe genau an der Put Wall konzentriert sind.

Behandle das Level als:

- eine große Put-Gamma-Konzentration;
- eine mögliche Liquiditäts- und Positioning-Referenz;
- ein Level, das sich empirisch wie Unterstützung verhalten kann; und
- ein Level, dessen Verhalten vom aggregierten und lokalen Gamma sowie vom umgebenden Flow abhängt.

## Put Wall vs. Call Wall

Die beiden Walls werden auf gegenüberliegenden Seiten des Spot auf dieselbe Weise gebildet — und dort endet die Symmetrie.

| | Put Wall | Call Wall |
|---|---|---|
| Seite des Spot | Auf oder unter | Auf oder über |
| Gerankt nach | Größtem Put-Gamma-Betrag (modelliertes Gamma × Open Interest) | Größtem Call-Gamma-Betrag (modelliertes Gamma × Open Interest) |
| Modelliertes Dealer-Vorzeichen | Negativ — Dealer modelliert short die von Kunden gekauften Puts | Positiv — Dealer modelliert long die von Kunden verkauften Calls |
| Übliche Lesart | Untere Kante der Positioning-Spanne; kann mit Unterstützung zusammenfallen | Obere Kante der Positioning-Spanne; kann mit Widerstand oder Pinning zusammenfallen |
| Lokaler Hedge, isoliert betrachtet | Ein Rückgang kann weiteres Verkaufen erfordern, was die Bewegung verstärken kann | Eine Rally kann Verkäufe erfordern, was sich gegen die Bewegung lehnen kann |
| Bei einem Bruch | Die Referenz ist gescheitert oder gewandert; bei negativem Gamma kann sich die Bewegung beschleunigen | Die Referenz ist gescheitert oder gewandert; oft als Positioning-Verschiebung gelesen |

Call und Put Wall sind nicht mechanisch symmetrisch. Eine Call Wall ist der Strike auf oder über Spot mit dem größten Call-Gamma-Betrag; eine Put Wall nutzt den Put-Gamma-Betrag unter Spot. Der Optionstyp allein entscheidet weder über Widerstand noch Unterstützung, Anziehung oder Beschleunigung. Der ausführlichere Vergleich steht in [Was ist eine Call Wall?](/education/what-is-a-call-wall) und [Gamma Walls Explained](/education/gamma-walls-explained).

## Put Wall vs. Gamma Flip vs. Max Pain

Drei Levels, die häufig miteinander verwechselt werden:

- Die **Put Wall** ist eine *Konzentration* — der dichteste Put-Gamma-Strike unter Spot.
- Der [Gamma Flip](/education/how-to-read-a-gamma-flip), auch [Zero-Gamma-Level](/education/zero-gamma-level-explained), ist eine *Regimelinie* — der Preis, an dem das modellierte Netto-Dealer-Gamma das Vorzeichen wechselt. Er entscheidet, ob Hedging nahe den Walls Bewegungen eher dämpft oder verstärkt. Der Flip liegt häufig über der Put Wall, sodass der Preis die Put Wall brechen kann, während er noch in positivem Gamma steht — oder sie halten kann, während er bereits in negativem Gamma ist.
- [Max Pain](/education/max-pain-explained) ist eine *Verfallswert*-Rechnung — der Strike, an dem der verfallende Wert für Optionsinhaber minimiert wird. Es ist keine Gamma-Konzentration und liegt oft nirgends in der Nähe einer der beiden Walls.

Die Put Wall ohne den Flip zu lesen ist der häufigste Fehler auf dieser Seite. Die Wall sagt dir, wo das Positioning dicht ist; der Flip sagt dir, was dichtes Positioning wahrscheinlich tut.

## Warum eine Wall im Tagesverlauf wandern kann

Offizielles Open Interest wird in der Regel nach dem Clearing aktualisiert, nicht fortlaufend im Tagesverlauf. ZeroGEX-Walls können dennoch während der Session wandern, weil Spot, Restlaufzeit und implizite Volatilität das modellierte Gamma jedes Strikes verändern. Das relative Ranking kann sich ändern, ein Strike kann von einer Seite des Spot auf die andere wechseln, oder ein anderer Strike mit unverändertem OI kann zum Maximum werden.

Die Wall-Berechnung belegt nicht, dass frisches Volumen neue Positionen eröffnet hat. Volumen kann eröffnende nicht von schließenden Aktivitäten unterscheiden, und es ist kein verifiziertes Intraday-Open-Interest. Mit näher rückendem Verfall konzentriert sich Gamma zunehmend nahe dem At-the-Money-Strike: ATM-Gamma kann stark steigen, während Gamma an Strikes, die deutlich im oder aus dem Geld landen, gegen null geht. Diese Neubewertung ist etwas anderes als das Schließen von Kontrakten oder eine Aktualisierung des offiziellen OI.

## Was passiert, wenn die Put Wall bricht

Ein Bruch unter die Put Wall ist eine Information, kein Urteil. Lies ihn anhand von vier Fragen:

1. **Welches Regime war in Kraft?** Oberhalb des Gamma Flip lehnt sich das aggregierte Hedging tendenziell gegen den Rückgang, und ein Bruch bleibt häufiger an der nächsten Put-Konzentration stehen. Unterhalb des Flip läuft der Reflex mit der Bewegung, und ein Bruch kann sich beschleunigen — der oben beschriebene lokale Short-Put-Hedge zeigt nun in dieselbe Richtung wie das Gesamtbuch.
2. **Ist die Wall gewandert oder gescheitert?** Eine Wall, die sich bei veränderten Inputs auf einen tieferen Strike umsortiert hat, wurde nicht „gebrochen"; die Referenz ist umgezogen. Vergleiche den Strike der Wall vor und nach dem Bruch.
3. **Hat Flow sie überrollt?** Makro-Schlagzeilen, Index-Rebalancings und große Einzelorders liefern Flow, der Hedging in den Schatten stellt. Ein Bruch auf einer solchen Tape sagt wenig über die Wall aus.
4. **Wurde der Gamma Flip gekreuzt?** Ein Bruch kann bedeuten, dass die Referenz gescheitert ist, dass umgebender Flow dominiert hat, dass lokales Gamma schwächer wurde oder dass die Wall gewandert ist. Nur eine Kreuzung des berechneten Gamma Flip — oder ein tatsächlicher Vorzeichenwechsel im modellierten Net GEX — stützt die Behauptung eines Gamma-Regimewechsels.

Nach einem Bruch wird der nächstgrößere Put-Gamma-Strike darunter im nächsten Snapshot zur neuen Put Wall. So „steigt" das Level in einer trendigen Session stufenweise herab.

## Eine praktische Lesart

Angenommen, SPX steht bei 5.830, die Put Wall liegt bei 5.790, die Call Wall bei 5.850, und das modellierte Net GEX ist positiv. Die Put Wall weist den größten Put-Gamma-Betrag unter Spot aus. Sie identifiziert damit **nicht** von sich aus eine Kaufzone. Ein Trader kann beobachten, ob Liquidität dort Verkäufe aufnimmt, ob das aggregierte Gamma-Profil stabil bleibt, ob die Wall bei veränderten Inputs wandert und ob gerichteter Flow das Level bestätigt oder überrollt.

Nehmen wir nun an, SPX rutscht eine Stunde später auf 5.785, und der bei 5.815 veröffentlichte Gamma Flip wurde gekreuzt. Zwei Dinge haben sich gleichzeitig geändert: Die Put-Wall-Referenz ist gescheitert, und das modellierte Regime ist negativ geworden. Das Zweite ist das, was für den nächsten Trade zählt — der Hedging-Reflex, der sich vielleicht gegen den Rückgang gelehnt hätte, ist nun modelliert mit ihm ausgerichtet, und die nächste Put-Konzentration darunter ist die neue Referenz, kein Abprallziel.

## Wie man die heutige Put Wall findet

ZeroGEX veröffentlicht die Put Wall — zusammen mit Call Wall, Gamma Flip, Max Pain und Net GEX — kostenlos und rund 15 Minuten verzögert für [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) und [NQ](/nq-gamma-levels). Jede Seite aktualisiert sich im Lauf der Session und zeigt neben jedem Level die Snapshot-Zeit. Um das Level in deinen eigenen Chart zu zeichnen, plotten der kostenlose [TradingView-Indikator](/tradingview-indicator) und die [thinkorswim-Studie](/thinkorswim-indicator) die Put Wall als horizontale Linie; der Live-Wert im Sekundenbereich aktualisiert sich im ZeroGEX-Dashboard.

Zwei Gewohnheiten machen die Zahl nützlich statt dekorativ: Achte auf die Snapshot-Zeit (eine morgendliche Put Wall, gelesen gegen eine Nachmittags-Tape, ist ein anderes Buch), und lies sie mit dem Gamma Flip auf demselben Bildschirm.

## Fazit

> Die Put Wall ist eine modellierte Put-Gamma-Konzentration und eine nützliche strukturelle Referenz. Sie kann mit Unterstützung zusammenfallen, aber Unterstützung ist keine direkte Folge des modellierten Dealer-Short-Put-Hedges an diesem Strike.

Sieh dir die heutigen modellierten Walls für [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) und [NDX](/ndx-gamma-levels) an, oder vergleiche den breiteren Rahmen in [Gamma Walls Explained](/education/gamma-walls-explained).

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.
