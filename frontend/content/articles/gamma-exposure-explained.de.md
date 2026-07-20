# Gamma Exposure (GEX) erklärt: Der vollständige Leitfaden

*Gamma Exposure von Grund auf erklärt — was GEX ist, wie das Dealer-Gamma berechnet und mit Vorzeichen versehen wird, warum sich das Regime oberhalb und unterhalb des Flips so unterschiedlich verhält, und wie man es während einer Handelssession tatsächlich einsetzt.*

---

## Warum Gamma Exposure wichtig ist

Ein Großteil des Kursverlaufs, den Trader auf einem Chart zu lesen versuchen, ist ein nachgelagerter Effekt von etwas, das eine Ebene darunter passiert: **Dealer-Hedging-Flüsse**. Market Maker stehen auf der anderen Seite jedes Optionsgeschäfts, und um delta-neutral zu bleiben, kaufen und verkaufen sie fortlaufend den Basiswert, während sich der Kurs bewegt. Ob sie Schwäche kaufen oder verkaufen — ob sie Volatilität dämpfen oder verstärken — hängt von einer strukturellen Variable ab: ihrer **Gamma Exposure**.

Gamma Exposure (GEX) ist der sauberste Weg, um abzulesen, was dieses Dealer-Buch gerade tut. Sie zeigt, ob die strukturelle Kraft im Markt in Richtung Stabilität oder Instabilität wirkt, ob Ausbrüche (Breakouts) eher weiterlaufen oder verpuffen, und ob die Strikes, die man in der Optionskette sieht, Flow absorbieren oder freisetzen. Sie sagt nicht die Richtung voraus. Sie zeigt den **Charakter des Regimes**, in dem man handelt — und genau darin liegt der größte Teil des Edge.

Dieser Artikel ist die umfassende Lektüre. Wir behandeln, was Gamma Exposure ist, wie sie aus der Optionskette aufgebaut wird, die Mechanik von positiven versus negativen Gamma-Regimen, die Rolle des Gamma-Flips und der Gamma-Walls sowie den praktischen Workflow, um all das intraday zu nutzen. Für vertiefende Beiträge zu den einzelnen Unterthemen verweist dieser Leitfaden auf [Wie man einen Gamma-Flip liest](/education/how-to-read-a-gamma-flip), [Gamma-Walls erklärt](/education/gamma-walls-explained) und [0DTE-Dealer-Positionierung erklärt](/education/0dte-dealer-positioning-explained). Zu spezifischen Greeks zweiter Ordnung siehe [Vanna und Charm für Optionshändler erklärt](/education/vanna-and-charm-explained), und zur Pinning-versus-Magnet-Diskussion siehe [Max Pain erklärt — funktioniert es wirklich?](/education/max-pain-explained).

---

## Was ist Gamma Exposure (GEX)?

Gamma Exposure ist der aggregierte Hedging-Bedarf der Dealer, der sich aus dem Open-Interest-Profil der Optionskette ableitet. Sie beantwortet eine einzige Frage: *Wenn sich der Spot geringfügig bewegt, wie aggressiv müssen die Dealer den Basiswert handeln, um ihr Buch delta-neutral zu halten?*

Drei kurze Definitionen, um den Rest dieses Artikels einzuordnen.

### Was ist Gamma?

Gamma ist eine Greek zweiter Ordnung, die die **Änderungsrate des Delta** in Bezug auf den Basiswert misst. Delta gibt an, wie empfindlich der Preis einer Option auf den Basiswert reagiert; Gamma gibt an, wie empfindlich diese Empfindlichkeit selbst ist. Wenn Delta die Geschwindigkeit ist, ist Gamma die Beschleunigung.

Gamma ist am Geld (at the money) am höchsten und nimmt in beide Richtungen vom Spot weg ab. Es nimmt auch mit der Zeit ab — langlaufende Optionen haben pro Kontrakt weniger Gamma als kurzlaufende. Das stärkste Gamma in jeder Optionskette liegt bei den kurzlaufenden At-the-money-Strikes, was einer der Gründe ist, warum 0DTE-Flow die Intraday-Struktur so vollständig neu geformt hat.

### Warum das Dealer-Gamma speziell wichtig ist

Dealer halten Optionen nicht zu Spekulationszwecken. Sie lagern sie als Bestand und hedgen das Delta so schnell wie möglich weg. Ihre Gamma Exposure bestimmt, wie sich dieses Hedge ändern muss, während sich der Kurs bewegt.

- Ein Dealer, der **Short Gamma** ist, muss **mit** der Bewegung handeln, um flat zu bleiben — kaufen, wenn der Kurs steigt, verkaufen, wenn er fällt. Dieses Hedging verstärkt die Bewegung.
- Ein Dealer, der **Long Gamma** ist, handelt **gegen** die Bewegung, um flat zu bleiben — verkaufen, wenn der Kurs steigt, kaufen, wenn er fällt. Dieses Hedging dämpft die Bewegung.

Die aggregierte Dealer-Gamma-Exposure über die gesamte Optionskette ist im Wesentlichen eine Schätzung, wie viel Flow im Basiswert die Market Maker bei einer bestimmten Kursbewegung durchsetzen müssen — und in welche Richtung. Genau das erfasst GEX.

### Eine Arbeitsdefinition

Gamma Exposure ist die betragsmäßige (und vorzeichenbehaftete) Höhe des Dealer-Hedging-Flows in Dollar pro Einheit Bewegung des Basiswerts, aggregiert über alle offenen Kontrakte. Wenn Trader nach "Gamma Exposure erklärt" oder "Was ist GEX" fragen, lautet die Antwort: Es ist eine Echtzeit-Schätzung, wie das Dealer-Buch auf den Kurs reagieren wird.

---

## Wie wird Gamma Exposure berechnet?

Die Berechnung hat mehrere bewegliche Teile, aber die Struktur ist einfach.

### Die Formel pro Strike

Für einen einzelnen Optionskontrakt beträgt der Beitrag zur Dealer-Gamma-Exposure (in Dollar, pro 1 % Bewegung) ungefähr:

```
contract_GEX ≈ gamma × open_interest × 100 × spot² × 0.01
```

Dabei gilt:

- `gamma` ist das Gamma der einzelnen Option aus dem Black-Scholes-Modell.
- `open_interest` ist die Anzahl der ausstehenden Kontrakte an diesem Strike.
- `100` ist der standardmäßige Kontraktmultiplikator.
- `spot²` wandelt Gamma (das selbst pro Dollar ausgedrückt ist) in eine Hedge-Flow-Größenordnung um.
- `0.01` skaliert das Ergebnis auf eine "pro 1 % Bewegung"-Interpretation um, was der branchenüblichen Konvention entspricht.

Die Dollar-Interpretation macht die Zahl nützlich: Sie beantwortet die Frage "Wie viel vom Basiswert müssen die Dealer handeln, wenn sich der Spot um 1 % bewegt?" — für einen einzelnen Strike, und dann aggregiert über die gesamte Optionskette.

### Vorzeichenbehaftete Gamma Exposure

Um aus der reinen Größenordnung ein Regime-Signal zu machen, wird jeder Kontrakt danach vorzeichenversehen, wer ihn hält. Die Standardkonvention geht davon aus:

- Kunden sind typischerweise netto long Calls und netto long Puts.
- Dealer sind daher typischerweise netto short bei beiden — verkaufte Calls tragen positives Gamma zum Dealer-Buch bei, verkaufte Puts tragen negatives bei.

In der Praxis ergibt das ein vorzeichenbehaftetes Dealer-GEX pro Strike — positiv für Calls, negativ für Puts —, das in der Summe die Netto-Exposure der Dealer über die gesamte Optionskette ergibt.

Dies ist eine Näherung. Die Positionierung der Dealer ist nicht direkt beobachtbar; sie wird aus dem Open Interest und der Standardkonvention "Kunde ist long" abgeleitet. Verschiedene Anbieter behandeln Grenzfälle unterschiedlich, und die Annahme kann bei ungewöhnlichen Flow-Bedingungen brechen. Als Schätzer des Regimes hat sie sich jedoch über Jahre gut genug bewährt, um zum Standard zu werden.

### Net GEX versus Total GEX

Aus derselben Optionskette ergeben sich zwei Aggregatzahlen:

- **Total GEX** ist die Summe des *absoluten* Beitrags an jedem Strike — eine Größenordnungsablesung, unabhängig vom Vorzeichen. Sie zeigt, wie viel Gamma insgesamt im System steckt.
- **Net GEX** ist die *vorzeichenbehaftete* Summe — Calls minus Puts. Sie zeigt, welche Seite des Dealer-Buchs dominiert und ob der aggregierte Hedging-Reflex dämpfend oder verstärkend wirkt.

Die meiste Regimearbeit nutzt Net GEX. Die Größenordnung zählt ebenfalls — ein Net GEX von +2 Mrd. $ ist ein deutlich schärferes Regime als +200 Mio. $ —, aber das Vorzeichen ist die erste Ablesung.

### Spot-Shift-Dealer-Gamma versus Aggregation pro Strike

Es gibt zwei Wege, Regimeinformationen aus der Optionskette zu extrahieren:

1. Die **Aggregation pro Strike** summiert das vorzeichenbehaftete Gamma an jedem Strike beim heutigen Spot. Sie ist schnell und intuitiv.
2. Das **Spot-Shift-Dealer-Gamma** bewertet das Gamma jeder Option bei jedem hypothetischen Spot-Preis auf einem Raster neu und summiert dann zu einer *Kurve* des Dealer-Gammas gegenüber dem Kurs. Der Nulldurchgang dieser Kurve ist der Gamma-Flip; der Wert beim heutigen Spot ist das Net GEX-at-Spot.

Der Spot-Shift-Ansatz hat einen strukturellen Vorteil: Da das Headline-Net-GEX und der Gamma-Flip aus derselben Kurve abgelesen werden, können sie sich nicht widersprechen. Ein positives Net GEX entspricht immer einem Spot oberhalb des Flips; ein negatives liegt immer darunter. Der Ansatz pro Strike kann bei einer Verschiebung der Optionskette widersprüchliche Vorzeichen produzieren, weshalb der Spot-Shift-Ansatz der Branchenstandard für ernsthafte Regimearbeit ist. Die Methodik hinter der ZeroGEX-Implementierung ist detailliert dokumentiert in [GEX und der Gamma-Flip — Wie ZeroGEX sie berechnet](/guides/gamma-flip-calculation-before-vs-after).

---

## Positive versus negative Gamma-Regime

Die wichtigste einzelne Ablesung in der Dealer-Positionierungsanalyse ist, auf welcher Seite des Gamma-Flips der Spot liegt. Die Mechaniken sind das Gegenteil voneinander — und die Trades, die in einem Regime funktionieren, sind tendenziell die falschen im anderen.

### Positives Gamma-Regime

Oberhalb des Gamma-Flips sind Dealer im Allgemeinen netto long Gamma. Um delta-neutral zu bleiben, hedgen sie gegen gerichtete Bewegungen — verkaufen, wenn der Kurs steigt, und kaufen, wenn er fällt. Dieser Reflex neigt dazu:

- die realisierte Volatilität zu komprimieren.
- den Kurs in Richtung der Strikes mit starker Gamma-Konzentration zu ziehen, besonders zum Handelsschluss hin.
- Ausbrüche schwerer aufrechtzuerhalten zu machen.
- Mean-Reversion-Setups zuverlässiger zu machen.

Der Charakter des Marktes ist **range-gebunden und absorbierend**. Pin-Verhalten ist wahrscheinlicher, besonders in der Nähe des OPEX und zum Handelsschluss hin. Short-Prämien-Strategien funktionieren tendenziell häufiger. Trendfolge-Setups haben eine niedrigere Trefferquote.

### Negatives Gamma-Regime

Unterhalb des Gamma-Flips sind Dealer im Allgemeinen netto short Gamma. Um delta-neutral zu bleiben, hedgen sie mit gerichteten Bewegungen — kaufen, wenn der Kurs steigt, und verkaufen, wenn er fällt. Dieser Reflex neigt dazu:

- die realisierte Volatilität zu erweitern.
- Ausbrüche weiter laufen zu lassen, als es zunächst den Anschein hat.
- Ausverkäufe im Verlauf zu beschleunigen.
- Mean-Reversion-Setups gefährlich zu machen.

Der Charakter des Marktes ist **momentumgetrieben und verstärkend**. Die Pins des vorherigen Regimes lösen sich; Strikes, die zuvor Widerstand waren, können zu Breakout-Zielen werden. Long-Prämien- und Trendfortsetzungs-Strategien funktionieren tendenziell häufiger. Ein fallendes Messer in einem tief negativen Gamma-Regime aufzufangen widerspricht genau dem Reflex, der einen Dip-Kauf funktionieren lassen würde.

### Zwei wichtige Vorbehalte

Das Regime ist eine **probabilistische Tendenz, keine Garantie**. Makroschocks, Einzeltitel-Katalysatoren in Indexkomponenten und ungewöhnliche Flow-Ereignisse können den strukturellen Zug in beide Richtungen außer Kraft setzen. Ein Spot-Regime sagt aus, *was der Dealer-Reflex ist*, nicht, was alle anderen Marktteilnehmer tun werden.

Das Regime ist auch **dynamisch**. Der Flip bewegt sich, während sich die Positionierung neu ausbalanciert, und der Spot kann ihn in einer Session mehrfach kreuzen. Das Regime zu lesen ist eine fortlaufende Aktivität, kein morgendliches Ritual.

---

## Der Gamma-Flip: die Regimegrenze

Der Gamma-Flip ist der Punkt, an dem das aggregierte Dealer-Gamma die Nulllinie kreuzt. Oberhalb sind Dealer typischerweise netto long Gamma; unterhalb netto short. Er ist die strukturelle Grenze zwischen den beiden oben beschriebenen Regimen.

Ein paar Punkte, bei denen Präzision wichtig ist:

- Der Flip ist ein **Level, keine Wand**. Er widersteht dem Kurs nicht so, wie es eine starke Strike-Konzentration könnte. Er markiert einen Verhaltenswendepunkt, keine strukturelle Barriere.
- Er ist eine **Regimelinie, kein Richtungssignal**. Spot oberhalb des Flips ist nicht bullisch; Spot unterhalb ist nicht bärisch. Er sagt etwas über den Volatilitätscharakter aus, nicht über die Richtung.
- Er ist **dynamisch**. Während das Open Interest rolliert und sich die Optionskette neu gewichtet, wandert der Flip. Ein veralteter Flip ist ein irreführender Flip.
- Er ist ein **Filter, kein Signal**. Er sagt, welches Playbook man fahren sollte; der Einstieg muss anderswoher kommen.

Für den praktischen Lese-Workflow — einschließlich dessen, was sich oberhalb versus unterhalb ändert, wie man intraday darauf reagiert, und die üblichen Fehler — siehe [Wie man einen Gamma-Flip liest](/education/how-to-read-a-gamma-flip).

---

## Gamma-Walls: wo sich die Flows konzentrieren

Wenn der Flip die Regimegrenze ist, sind die Gamma-Walls die strukturellen Grenzen innerhalb davon. Die **Call-Wall** ist der Strike oberhalb des Spots mit der stärksten Call-Gamma-Exposure; die **Put-Wall** ist der Strike unterhalb des Spots mit der stärksten Put-Gamma-Exposure. Zusammen skizzieren sie den Bereich, den das Dealer-Hedging tendenziell verteidigt.

Die Walls verhalten sich in den beiden Regimen sehr unterschiedlich:

- In einem **positiven Gamma**-Regime absorbieren die Walls. Der Dealer-Reflex um sie herum besteht darin, Bewegungen zu bremsen — Rallyes in Richtung Call-Wall zu verkaufen, Rücksetzer in Richtung Put-Wall zu kaufen.
- In einem **negativen Gamma**-Regime lösen sich die Walls. Derselbe Level, der bei Long-Gamma Widerstand leistete, kann zu einem Breakout-Ziel werden.

Auch Walls wandern. Eine Call-Wall, die nach oben wandert, während der Kurs sie testet, ist strukturell eine andere Ablesung als eine, die hält. Für den vollständigen Lese-Workflow siehe [Gamma-Walls erklärt: Call-Wall, Put-Wall und wie der Kurs reagiert](/education/gamma-walls-explained).

---

## Wie GEX die Intraday-Volatilität formt

Die realisierte Volatilität — die tatsächliche Amplitude der Kursbewegungen während der Session — wird stark vom GEX-Regime geprägt, unabhängig von der impliziten Volatilität (also dem, was der Optionsmarkt für die Zukunft einpreist).

Der Zusammenhang ist strukturell:

- Ein tief positives Gamma-Regime tendiert dazu, **niedrigere realisierte Vola als implizite** zu erzeugen. Der dämpfende Reflex ist groß genug, um Bewegungen zu unterdrücken, die der Markt erwartet hatte. Das begünstigt häufig Prämien-Verkaufsstrategien.
- Ein tief negatives Gamma-Regime tendiert dazu, **höhere realisierte Vola als implizite** zu erzeugen. Der verstärkende Reflex weitet Ranges über das hinaus, was der Markt eingepreist hatte. Das begünstigt tendenziell Long-Prämien- und Momentum-Strategien.

Die Größenordnung zählt genauso wie das Vorzeichen. Ein Wechsel von +2 Mrd. $ Net GEX auf +200 Mio. $ ist ein sehr anderer Zustand als ein Wechsel von −2 Mrd. $ auf +200 Mio. $, obwohl beide bei einer ähnlichen Zahl ankommen. Der erste Fall ist ein *abklingendes* Long-Gamma-Regime; der zweite ein *aufbauendes*. Die Trajektorie ist Teil der Ablesung.

Ein häufiger Fehler besteht darin, GEX als Richtungssignal zu verwenden — "Net GEX steigt, also steigt der Markt". Das ist nicht das, was es aussagt. GEX sagt etwas über den **Charakter der Bewegung** aus, nicht über deren Richtung. Ein positives Gamma-Regime kann genauso leicht nach unten wie nach oben driften, aber es wird tendenziell driften statt ausbrechen.

---

## Wie man GEX intraday einsetzt

Ein praktischer Workflow:

### Schritt 1: Das Regime identifizieren

Bevor irgendetwas anderes geschieht, prüfe, ob der Spot oberhalb oder unterhalb des Gamma-Flips liegt und wie groß das Net GEX ist. Allein diese Ablesung filtert einen großen Anteil schlechter Trades heraus — Gegenbewegungen handeln, wenn man mit der Bewegung mitlaufen sollte, oder Ausbrüche handeln, wenn man ihnen entgegenwirken sollte.

### Schritt 2: Die Walls innerhalb des Regimes lesen

Finde die aktive Call-Wall und Put-Wall. In einem positiven Gamma-Regime sind das die absorbierenden Grenzen — der strukturelle Range. In einem negativen Gamma-Regime sind sie als Widerstand schwächer und können zu Breakout-Zielen werden.

### Schritt 3: Migration beobachten

Levels sind nicht statisch. Eine Wall, die mit dem Kurs wandert (die Bewegung jagt), ist eine andere Ablesung als eine, die hält. Ein Flip, der zusammen mit dem Kurs nach oben driftet, hat andere Implikationen als einer, der stehen bleibt, während sich der Spot entfernt. Verfolge die *Veränderung*, nicht nur den Wert.

### Schritt 4: Die 0DTE-Konzentration berücksichtigen

Wenn taggleiche Optionen die Optionskette dominieren — was für SPX während der Cash-Session zunehmend der Normalfall ist — treibt der 0DTE-Bucket das Intraday-Verhalten der Dealer überproportional an. Relevant ist das Gamma an den Strikes, die zum Handelsschluss noch aktiv sind. Die vertiefte Behandlung findet sich in [0DTE-Dealer-Positionierung erklärt](/education/0dte-dealer-positioning-explained).

### Schritt 5: Greeks zweiter Ordnung einbeziehen, wo relevant

Gamma ist nicht das gesamte Bild. Vanna (vola-getriebenes Hedging) erzeugt in Vol-Kompressionsregimen ein anhaltendes Bid; Charm (zeitgetriebenes Hedging) treibt die vorhersehbaren Flows zum Handelsschluss hin an, die in EOD-Druckablesungen auftauchen. Der Begleitartikel [Vanna und Charm für Optionshändler erklärt](/education/vanna-and-charm-explained) behandelt beide.

---

## Vanna und Charm: die Geschichte zweiter Ordnung

GEX ist die Schlagzeilen-Ablesung, aber nicht das gesamte Dealer-Buch. Zwei Greeks zweiter Ordnung prägen die Dealer-Hedging-Flows zusätzlich zum Gamma maßgeblich:

- **Vanna** ist die Empfindlichkeit des Deltas gegenüber der impliziten Volatilität. Wenn sich die IV bewegt, bewegen sich die Options-Deltas der Dealer, auch wenn sich der Spot nicht bewegt — und sie müssen das hedgen. In einem Vol-Kompressionsregime manifestieren sich Vanna-Flows aus Dealer-Short-Calls oft als anhaltendes, allmählich steigendes Bid im Basiswert.
- **Charm** ist die Empfindlichkeit des Deltas gegenüber der Zeit. Während Optionen sich dem Verfall nähern, driftet ihr Delta vorhersehbar — Out-of-the-money-Optionen verfallen Richtung 0, In-the-money-Optionen Richtung 1 —, und Dealer müssen diese Drift kontinuierlich neu hedgen. Der klarste Ort, um Charm im Markt zu beobachten, sind die letzten 90 Minuten der Cash-Session.

Beide Effekte sind am größten, wenn auch das Gamma groß ist — also wenn 0DTE- und kurzlaufende Optionen die Optionskette dominieren. Lies sie gemeinsam mit GEX, nicht isoliert.

---

## Häufige Missverständnisse über GEX

Ein paar Fallstricke:

- **"Positives Gamma ist bullisch."** Das stimmt nicht. Es ist **stabilisierend**. Der Markt kann in einem positiven Gamma-Regime durchaus nach unten driften; er tendiert nur dazu, dies langsam zu tun.
- **"Net GEX ist ein Richtungsindikator."** Das ist es nicht. Das Vorzeichen zeigt das Regime; die Richtung kommt von anderswo.
- **"GEX-Levels sind fixiert."** Sind sie nicht. Der Flip, die Walls und das Net GEX selbst bewegen sich alle, während sich die Optionskette neu positioniert.
- **"Walls sind harter Support und Widerstand."** Sie sind strukturelle Tendenzen, deren Verhaltenswirkung vom Regime abhängt. Sie werden regelmäßig durchbrochen.
- **"GEX ist ein Signal."** Es ist eher ein Filter. Eine saubere Regime-Ablesung schärft jedes andere Werkzeug, das man nutzt; sie sagt einem aber für sich allein nicht, wann man einsteigen soll.

---

## Was GEX nicht ist (Grenzen)

GEX ist ein Schätzer des Dealer-Hedging-Bedarfs, der aus dem Open Interest unter einer Standardannahme darüber, wer was hält, konstruiert wird. Das macht ihn nützlich, aber er liefert kein vollständiges Bild:

- **Open Interest ist eine Momentaufnahme, kein Echtzeit-Inventar.** Die Positionierung der Dealer verändert sich innerhalb des Tages auf eine Weise, die das Open Interest nicht erfasst.
- **Die Konvention "Kunde long Call/Kunde long Put" kann brechen.** Bei ungewöhnlichen Flow-Bedingungen kann die Annahme über das Dealer-Vorzeichen die Exposure falsch zuordnen.
- **Makroereignisse setzen die Struktur außer Kraft.** Eine CPI-Überraschung oder eine FOMC-Erklärung kann den Dealer-Reflex überschwemmen.
- **Einzeltitel-Katalysatoren können das Index-GEX indirekt bewegen.** Gewinnausweise, M&A und Nachrichten zu Indexkomponenten können den SPX-Flow auf Weisen umformen, die sich im GEX mit Verzögerung zeigen.
- **Sticky-Strike- versus Sticky-Delta**-Annahmen sind für Spot-Shift-Implementierungen relevant; verschiedene Anbieter handhaben dies unterschiedlich.

Die richtige Einordnung ist, dass GEX die sauberste einzelne Ablesung der dealer-getriebenen strukturellen Kraft im Markt ist — nicht die einzige Kraft, keine Prognose und kein Ersatz für Risikomanagement.

---

## Wie ZeroGEX die Gamma Exposure sichtbar macht

Das Dashboard zentralisiert die Live-Ablesungen:

- Die **Net-GEX-Karte** zeigt den Dealer-Gamma-at-Spot-Wert (vorzeichenkonsistent mit dem Flip, berechnet aus einer einzigen Kurve).
- Die **Gamma-Flip-Karte** zeigt das aktuelle Flip-Level mit Live-Abstand zum Spot.
- Die **Call-Wall- und Put-Wall-Karten** zeichnen die live strukturellen Grenzen.
- Das **Strike-Profil-Chart** zeichnet das Dealer-Gamma-Profil über die Strikes hinweg — die Kurve, aus der sowohl das Net GEX als auch der Flip abgeleitet werden.
- Die **Strike-nach-DTE-Heatmap** schlüsselt das Gamma nach Verfalls-Bucket auf und macht die 0DTE-Konzentration sichtbar, die die Intraday-Ablesung zunehmend dominiert.

![Übersicht des ZeroGEX-Dashboards mit den Karten Net GEX, Gamma Flip, Call Wall und Put Wall](/blog/zerogex-dashboard-overview.png)

Ein durchgerechnetes Beispiel. Angenommen, SPX steht bei 5.830 und das Dashboard zeigt:

- **Net GEX:** +1,5 Mrd. $
- **Gamma Flip:** 5.810
- **Call Wall:** 5.850
- **Put Wall:** 5.790

Die Gesamtablesung: Der Spot befindet sich komfortabel im Long-Gamma-Territorium (20 Punkte oberhalb des Flips), das Net GEX ist eine deutlich positive Zahl, die auf eine reale Größenordnung im Dealer-Buch hinweist, und der Wall-Bereich ist asymmetrisch, wobei die Call-Wall näher liegt als die Put-Wall. Die praktische Tendenz: gedämpftes Vola-Regime, mean-reversion-freundlicher Markt, Ausbrüche verpuffen eher, als dass sie sich fortsetzen, und Pin-Verhalten in Richtung der starken Gamma-Konzentration ist zum Handelsschluss hin denkbar. Nichts davon ist ein Trade-Signal — es ist der strukturelle Hintergrund, an dem jedes andere Werkzeug, das man nutzt, kalibriert werden sollte.

![ZeroGEX-Strike-Profil-Chart mit hervorgehobener Dealer-Gamma-Kurve, Flip-Linie und Walls](/blog/zerogex-strike-profile-overview.png)

Stell dir nun dasselbe Dashboard 90 Minuten später vor: Das Net GEX ist auf +300 Mio. $ abgeklungen, und der Gamma-Flip ist auf 5.825 nach oben gewandert, während der Spot auf 5.818 zurückgefallen ist. Das Regime ist jetzt umstritten — der Spot liegt technisch unterhalb des Flips, aber nur um wenige Punkte, und die Größenordnung hat sich ausgedünnt. Genau das ist der strukturelle Zustand, in dem beide Regime teilweise aktiv sind, das Verhalten instabil wird, und die richtige Disziplin normalerweise darin besteht, auf eine klarere Ablesung zu warten, bevor man sich festlegt.

---

## Fazit

> Gamma Exposure ist keine Vorhersage. Sie ist eine Regime-Ablesung — die strukturelle Kraft im Dealer-Buch, die prägt, wie sich der Markt verhält, aber für sich genommen nicht die Richtung diktiert.

Die Disziplin besteht darin, mit dem Regime zu beginnen, die Struktur darin zu lesen, zu beobachten, wie sich beide im Verlauf der Session bewegen, und GEX filtern zu lassen, welches Playbook sinnvoll ist, statt es als eigenständiges Signal zu behandeln. Ein Großteil des Edge in der Dealer-Positionierungsanalyse liegt darin, die Trades *nicht einzugehen*, die dem Dealer-Reflex entgegenwirken.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.

---

Wenn du die [vollständige Gamma-Exposure-Ablesung von heute in Echtzeit](/real-time-gex-0dte) sehen möchtest — Net GEX, den Gamma-Flip, die Call- und Put-Walls und das Dealer-Gamma-Profil — bietet dir [das kostenlose ZeroGEX-Dashboard](/spx-gamma-levels) all das. Für einen direkten Vergleich, wie ZeroGEX im Vergleich zu anderen Gamma-Exposure-Plattformen abschneidet, siehe [den Leitfaden zu den besten GEX-Tools](/education/best-gex-tools).
