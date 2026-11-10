# Was ist Zero Gamma? Das Zero-Gamma-Level erklärt

*Zero Gamma verständlich erklärt - was das Zero-Gamma-Level ist, wie es mit dem Gamma Flip und mit Net GEX zusammenhängt, was sich auf beiden Seiten davon tendenziell ändert und wo du das heutige Zero-Gamma-Level für SPX, SPY, QQQ und NDX siehst.*

---

## Was ist das Zero-Gamma-Level?

Das **Zero-Gamma-Level** ist der Preis, an dem die modellierte Gamma-Exponierung der Dealer die Null kreuzt. Oberhalb davon wird das Optionsbuch für die Dealer als netto *positives* Gamma modelliert, unterhalb als netto *negatives*. Es ist dasselbe Level, das die meisten Trader **Gamma Flip** nennen, und die beiden Namen werden austauschbar verwendet: „Zero Gamma“ beschreibt, was die Zahl ist (der Punkt, an dem das Netto-Dealer-Gamma null ist), und „Gamma Flip“ beschreibt, was dort passiert (das Vorzeichen kippt).

Das ist die ganze Definition, und es lohnt sich, an der schlichten Fassung festzuhalten, weil über das Level geredet wird, als wäre es eine Unterstützungs- oder Widerstandslinie. Das ist es nicht. Zero Gamma ist eine **Regimegrenze**: Es markiert, wo sich laut Modell der *Charakter* des Dealer-Hedgings ändert, nicht, wo der Preis voraussichtlich stoppt.

Daraus folgen direkt einige Konsequenzen:

- Es ist ein **Preisniveau, kein Strike.** Der Nulldurchgang liegt meist zwischen Strikes, weil er aus einer Kurve stammt - modelliertes Dealer-Gamma, ausgewertet über eine Spanne von Spot-Preisen - und nicht aus einem einzelnen Kontrakt.
- Es **bewegt sich.** Wenn sich das Open Interest ändert und bestehende Kontrakte mit Spot, Zeit und impliziter Volatilität neu bewertet werden, verändert die Kurve ihre Form, und ihr Nulldurchgang verschiebt sich. Das Zero-Gamma-Level von gestern ist eine andere Zahl als das von heute. Prüfe das [aktuelle Zero-Gamma-Level von SPX](/spx-gamma-levels) in jeder Session, statt ein altes fortzuschreiben.
- Es ist ein **Modellergebnis.** Dealerbestände sind nicht direkt beobachtbar, daher hängt das Level von einer Vorzeichenkonvention ab (ZeroGEX verwendet die traditionelle Konvention Call positiv / Put negativ) und davon, welche Verfälle und Inputs das Modell einbezieht.

## Zero Gamma vs. Gamma Flip vs. Net GEX

Drei eng verwandte Begriffe, und die Unterschiede sind wichtiger, als es aussieht:

| Begriff | Was es ist | Einheit |
|---|---|---|
| **Net GEX** | Modelliertes Netto-Dealer-Gamma über die gesamte Kette, ausgewertet beim aktuellen Spot-Preis | Vorzeichenbehaftete Dollar („Dollar-Gamma“), z. B. +1,2 Mrd. $ |
| **Zero-Gamma-Level** | Der Spot-Preis, bei dem dieses modellierte Netto-Gamma null wäre | Ein Preis, z. B. 5.815 |
| **Gamma Flip** | Dasselbe Level, benannt nach dem Vorzeichenwechsel, der dort stattfindet | Ein Preis |

Net GEX ist also ein *Messwert* und Zero Gamma ein *Level*. Sie sind zwei Ansichten derselben Kurve: Wenn der Spot über dem Zero-Gamma-Level liegt, ist Net GEX am Spot positiv; liegt der Spot darunter, ist Net GEX am Spot negativ. Wenn die beiden einmal im Widerspruch zu stehen scheinen - ein positiver Net-GEX-Wert bei einem Spot unter dem veröffentlichten Flip -, sagt dir das Modell, dass es mehr als einen Nulldurchgang gefunden hat oder dass Messwert und Level aus verschiedenen Snapshots stammen. Wie man die Dollarzahl selbst liest, erfährst du in [SPX Net GEX heute](/education/spx-net-gamma-exposure-today).

## Wie das Zero-Gamma-Level bestimmt wird

Der schnelle Weg, Zero Gamma zu finden, besteht darin, das vorzeichenbehaftete Gamma Strike für Strike vom niedrigsten Strike aufwärts aufzusummieren und zu markieren, wo die kumulierte Summe die Null kreuzt. Das ist schnell, und es liegt auch öfter falsch, als es scheint, weil es das Gamma jedes Kontrakts als fest behandelt, obwohl das Gamma tatsächlich davon abhängt, wo der Spot steht.

Der bessere Ansatz - der, auf den ZeroGEX umgestiegen ist - bewertet das ganze Buch bei jedem Kandidaten-Spot-Preis neu, berechnet das modellierte Netto-Dealer-Gamma, *als stünde der Spot dort*, und liest ab, wo dieses Profil die Null kreuzt. Der [Leitfaden zur Gamma-Flip-Berechnung](/guides/gamma-flip-calculation-before-vs-after) geht beide Methoden durch und erklärt, warum das Spot-Shift-Profil dasjenige ist, dem man vertrauen sollte.

Aus der besseren Methode ergeben sich zwei Dinge:

1. **Das Level kann fehlen.** Wenn das Profil die Null nahe am Spot nie kreuzt - tief in einem Regime, bei einer dünnen oder einseitigen Kette, bei einem Spike der impliziten Volatilität, der das modellierte Gamma auf breiter Front einbrechen lässt -, gibt es kein ehrliches Zero-Gamma-Level zu veröffentlichen, und ZeroGEX lässt das Feld leer, statt eines zu erfinden. Das Vorzeichen von Net GEX sagt dir trotzdem, in welchem Regime du dich befindest.
2. **Es kann mehr als eines geben.** Eine ungleichmäßige Kette kann zwei Kreuzungen erzeugen. ZeroGEX veröffentlicht diejenige, die nah genug am Spot liegt, um handelbar zu sein, und von echtem Open Interest gestützt wird; es ist gut zu wissen, dass weiter draußen eine zweite liegen kann.

## Was sich oberhalb und unterhalb von Zero Gamma tendenziell ändert

Das Vorzeichen des modellierten Dealer-Gammas entscheidet, ob sich das Hedging *gegen* Bewegungen stemmt oder *mit* ihnen läuft.

**Oberhalb des Zero-Gamma-Levels (positives Gamma).** Dealer werden als netto long Gamma modelliert. Um delta-neutral zu bleiben, verkaufen sie tendenziell in Stärke hinein und kaufen in Schwäche hinein, was gegen die Richtung der Bewegung drückt. Die realisierte Volatilität tendiert zur Kompression, Spannen sind tendenziell enger, und der Preis tendiert zum Handelsschluss hin zu schweren Strikes. Das Hedging stemmt sich gegen Breakouts, statt sie zu befeuern.

**Unterhalb des Zero-Gamma-Levels (negatives Gamma).** Dealer werden als netto short Gamma modelliert. Derselbe Hedging-Reflex läuft jetzt mit der Bewegung - Stärke kaufen, Schwäche verkaufen -, und die realisierte Volatilität tendiert zur Expansion. Spannen weiten sich, ein Bruch, zu dem es tatsächlich kommt, hat das Hedging im Rücken, und das Pinning, das oberhalb des Levels gehalten hat, löst sich tendenziell. [Was negatives Gamma bedeutet](/education/what-is-negative-gamma) behandelt dieses Regime ausführlich.

**Am Level selbst.** Ein Spot, der genau auf Zero Gamma sitzt, ist der am wenigsten aussagekräftige Zustand, nicht der aussagekräftigste. Positive und negative modellierte Beiträge heben sich ungefähr auf, die Netto-Hedging-Tendenz ist schwach, und eine kleine Änderung der Inputs kann das Vorzeichen kippen. Trader, die das Level nutzen, behandeln diesen Bereich als umkämpftes Gebiet, nicht als Signal.

Nichts davon ist eine Richtungsaussage. Oberhalb von Zero Gamma ist nicht bullisch; unterhalb ist nicht bärisch. Das Level sagt etwas über die *Textur* des Tapes aus - klebrig oder rutschig -, nicht darüber, wohin der Preis läuft.

## Wie Trader das Zero-Gamma-Level nutzen

Am nützlichsten ist das Level als **Filter**, der entscheidet, welches Playbook gerade läuft, nicht als Auslöser:

1. **Lies zuerst das Regime.** Prüfe vor einem Setup, ob der Spot über oder unter Zero Gamma liegt und um wie viel.
2. **Passe die Taktik an die Seite an.** Oberhalb: Fades, Range-Trades, Geduld nahe [Call Wall und Put Wall](/education/gamma-walls-explained). Unterhalb: Momentum, Breakouts, engeres Risiko.
3. **Beobachte den Abstand und die Drift.** Ein Level weit vom Spot entfernt ist eine stabile Regime-Lesart; ein Level nur wenige Zehntelprozent entfernt eine umkämpfte. Ein Level, das im Laufe der Session auf den Preis zuwandert, ist ein anderes Signal als eines, das stehen bleibt, während sich der Preis ihm nähert.
4. **Prüfe die Größenordnung von Net GEX.** Ein Zero-Gamma-Level mit 2 Mrd. $ modelliertem Gamma darüber beschreibt ein schärferes Regime als eines mit 200 Mio. $. Vorzeichen und Größe zusammen, nicht das Vorzeichen allein.

[Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip) macht daraus eine Intraday-Routine, und [So tradet man rund um Gamma-Flip-Level](/education/how-to-trade-around-gamma-flip) behandelt, was sich ändert, wenn der Spot das Level kreuzt.

## Häufige Fehldeutungen

- **Zero Gamma als Unterstützung oder Widerstand behandeln.** Es ist eine Regimelinie. Schwäche von oben in das Level hinein zu kaufen und Schwäche von unten zu kaufen, sind strukturell unterschiedliche Trades.
- **Ein veraltetes Level lesen.** Das Zero-Gamma-Level kann sich in wenigen Stunden um mehrere Punkte bewegen. Eine Zahl vom Morgen, gelesen gegen das Tape am Nachmittag, gehört zu einem anderen Buch.
- **Es mit Max Pain verwechseln.** [Max Pain](/education/max-pain-explained) ist ein Strike der Payoff-Geometrie - dort, wo der Verfallswert für die Optionsinhaber minimiert wird. Zero Gamma ist eine Linie des Hedging-Regimes. Sie beantworten unterschiedliche Fragen und widersprechen sich häufig.
- **Am Level einen Abpraller oder einen Bruch erwarten.** Kreuzt der Preis Zero Gamma, ändert sich der modellierte *Reflex* des Hedgings. Das allein sagt dir nicht, ob sich die Bewegung fortsetzt.

## Das heutige Zero-Gamma-Level

ZeroGEX veröffentlicht das Zero-Gamma-Level - beschriftet als „Gamma Flip“ - zusammen mit Call Wall, Put Wall, Max Pain und Net GEX, kostenlos und um etwa 15 Minuten verzögert, für [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) und [NQ](/nq-gamma-levels). Der Live-Wert über die gesamte Session aktualisiert sich im Dashboard. Was ZeroGEX beobachtet und was es modelliert, erfährst du in der [Methodik](/methodology).

## Fazit

> Zero Gamma ist der Preis, an dem das modellierte Netto-Dealer-Gamma null ist - dasselbe Level wie der Gamma Flip. Oberhalb davon dämpft das Hedging Bewegungen tendenziell; unterhalb verstärkt es sie tendenziell. Es ist eine Regimelinie, kein Ziel, und es bewegt sich im Laufe des Tages.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.
