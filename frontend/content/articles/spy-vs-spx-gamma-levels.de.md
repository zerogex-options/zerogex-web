# SPY vs. SPX Optionen: Welche Gamma-Levels zählen?

*SPY und SPX bilden denselben Index über zwei unterschiedliche Kontrakte ab — und zwei getrennte Dealer-Gamma-Bücher. Hier erfährst du, wie sich ihre Gamma-Levels unterscheiden, wie man ein Level vom einen ins andere umrechnet, welches Buch mehr Gewicht trägt und warum das wichtigste Level dasjenige ist, bei dem beide übereinstimmen.*

---

## Die kurze Antwort

Wenn du SPX handelst, lies die SPX-Gamma-Levels. Wenn du SPY handelst, lies die SPY-Gamma-Levels. Aber weil beide Kontrakte denselben zugrunde liegenden Index über **getrennte** Pools von Open Interest absichern, liefert die genaueste Lesart die Beobachtung beider — und die Behandlung der Levels, an denen sie übereinstimmen, als diejenigen, die am wahrscheinlichsten halten.

Der Rest dieses Artikels erklärt, warum sich die beiden Bücher unterscheiden, wie man ein Level zwischen ihnen umrechnet und welches mehr Gewicht verdient, wenn sie nicht übereinstimmen.

---

## Derselbe Index, zwei verschiedene Kontrakte

SPX und SPY bilden beide den S&P 500 ab. Was sich unterscheidet, ist der *Kontrakt*, der ihn umhüllt — und diese Unterschiede prägen, wie Dealer jeden von ihnen absichern.

| Merkmal | SPX | SPY |
|---|---|---|
| Was es ist | S&P 500 **Index**optionen | S&P 500 **ETF**-Optionen |
| Preisskala | Der Indexstand (z. B. 6000) | ~1/10 des Index (z. B. 600) |
| Abwicklung | Barausgleich | Physische Lieferung (Aktien) |
| Ausübungsstil | Europäisch — keine vorzeitige Zuteilung | Amerikanisch — Risiko vorzeitiger Zuteilung |
| Kontraktnominal | ~$100 × Indexstand (≈10× SPY) | ~$100 × ETF-Preis |
| Strike-Abstände | Weiter (üblicherweise 5 Punkte) | Feiner ($1, teils $0,50) |
| Dividenden & Steuern | Keine Dividende; Section-1256-Behandlung | Zahlt Dividenden; Aktienoptions-Behandlung |
| Typische Klientel | Institutionelle, Index- & 0DTE-Desks | Retail plus Institutionelle, Aktien-Hedger |

Die für Gamma wichtigste Zeile ist das **Kontraktnominal**. Ein SPX-Kontrakt kontrolliert etwa das Zehnfache des Dollar-Exposures eines SPY-Kontrakts, sodass die Dealer-Absicherung bei SPX pro Kontrakt weit mehr indexäquivalentes Delta bewegt. Das ist im Folgenden von Bedeutung.

---

## Warum SPY und SPX getrennte Gamma-Bücher haben

Die Gamma-Exposure wird aus dem Open Interest einer Optionskette berechnet — Strike für Strike, Verfall für Verfall. SPX und SPY sind unterschiedliche Ketten mit unterschiedlichem Open Interest, daher erzeugt jede ihr **eigenes** [Gamma-Profil](/education/gamma-exposure-explained): ihren eigenen [Gamma-Flip](/education/how-to-read-a-gamma-flip), ihre eigene [Call Wall und Put Wall](/education/gamma-walls-explained), ihr eigenes Net GEX.

Da sich beide Ketten auf denselben Index beziehen, zeigen diese Levels meist auf dieselbe Stelle in S&P-Notation. Aber sie werden von unterschiedlichen Klientel-Gruppen gebildet — SPX ist stärker institutionell und index-/0DTE-lastig, SPY trägt einen hohen Retail- und Aktien-Hedging-Flow — sodass die beiden Bücher Strikes unterschiedlich gewichten und an den Rändern auseinanderdriften können. Wenn sie divergieren, ist das Information, kein Rauschen.

---

## Ein Level vom einen ins andere übersetzen

SPY handelt bei etwa einem Zehntel des S&P-500-Index, daher als erste Näherung:

> SPY-Level ≈ SPX-Level ÷ 10 — SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Zwei Vorbehalte verhindern, dass die Umrechnung exakt ist:

- **Tracking-Abweichung.** Der Preis von SPY spiegelt aufgelaufene Dividenden und kleine Tracking-Unterschiede wider, sodass das Verhältnis nie ein sauberes 10.000 ist. Rechne zur Orientierung um, nicht auf den Cent genau.
- **Strike-Granularität.** SPX-Strikes sind weiter gestaffelt (üblicherweise fünf Indexpunkte), während SPY jeden Dollar listet. Eine SPX-Wall liegt auf einer runden Indexzahl; die entsprechende SPY-Wall kann bei feinerer Auflösung liegen — SPY zeigt oft, *wo innerhalb* eines SPX-Fünf-Punkte-Bereichs sich die Gamma tatsächlich konzentriert.

---

## Welches Buch trägt mehr Gewicht?

Für den *wahren* Dealer-Hedging-Druck im S&P ist SPX in der Regel die primäre Karte. Drei Gründe:

1. **Nominalwert.** Etwa das 10-Fache des Dollar-Deltas pro Kontrakt bedeutet, dass die SPX-Hedging-Flows die Index-Level-Gamma dominieren, die tatsächlich den Cash-Index und /ES bewegt.
2. **0DTE-Tiefe.** SPX listet an jedem Handelstag einen Verfall und ist der tiefste Index-Optionsmarkt überhaupt; das taggleiche [Dealer-Positioning](/education/0dte-dealer-positioning-explained), das die Intraday-Volatilität antreibt, zeigt sich dort zuerst.
3. **Sauberere Mechanik.** Barausgleich und europäische Ausübung bedeuten kein Gerangel um vorzeitige Zuteilung, das das Buch zum Verfall hin verzerrt.

SPY verdient sich seinen Platz als **Granularitäts- und Bestätigungsschicht**: feinere Strikes, enorme Aktienliquidität und der Retail- und Hedger-Flow, der das [SPY-spezifische Pinning](/education/why-spy-pins-near-strikes) erzeugt. Und wenn du SPY selbst handelst, sind es dessen eigene Walls, auf die dein Instrument tatsächlich reagieren wird.

---

## Welche Levels zählen für deinen Trade?

Ordne die Karte dem Instrument zu, das du tatsächlich handelst:

- **SPX, /ES oder SPX 0DTE** → SPX-Gamma-Levels sind deine Karte.
- **SPY-Aktien oder SPY-Optionen** → SPY-Gamma-Levels — die eigenen Walls und der Pin deines Instruments.
- **QQQ** → QQQ-Levels (siehe unten).

Achte dann auf **Konfluenz**. Wenn die SPX-Call-Wall bei 6000 mit der SPY-Call-Wall bei 600 übereinstimmt, ist dieses gemeinsame Level stabiler als jedes für sich allein — zwei getrennte Dealer-Bücher, die sich auf denselben Preis stützen. Wenn sie *nicht übereinstimmen*, behandle beide als weniger belastbar und lass den Preis zeigen, welches Buch die Kontrolle hat.

> Das stärkste optionsbasierte Level ist nicht die größte Wall in einem einzelnen Chart. Es ist das Level, bei dem SPX und SPY übereinstimmen.

---

## QQQ und NDX: dieselbe Logik am Nasdaq

Der Nasdaq-100 hat dieselbe Aufteilung: **QQQ** ist der ETF, **NDX** ist der Cash-Index, und jeder führt sein eigenes Gamma-Buch auf einer anderen Preisskala. Wenn du QQQ handelst, lies die [QQQ-Gamma-Levels](/qqq-gamma-levels); wenn du NDX oder /NQ handelst, ist das Index-Buch deine Referenz. Das Konfluenz-Prinzip überträgt sich — QQQ-Walls, die mit dem NDX-Buch übereinstimmen, sind die, die es zu respektieren gilt.

---

## Beide nebeneinander auf ZeroGEX lesen

Die kostenlosen ZeroGEX-Gamma-Levels-Seiten veröffentlichen alle drei Bücher nebeneinander, sodass Übereinstimmung auf einen Blick erkennbar ist:

- [SPX-Gamma-Levels](/spx-gamma-levels) — das Index-Buch, die primäre S&P-Karte.
- [SPY-Gamma-Levels](/spy-gamma-levels) — das ETF-Buch, feinere Strikes und Pin-Details.
- [QQQ-Gamma-Levels](/qqq-gamma-levels) — die Nasdaq-100-Lesart.

Jede Seite führt mit dem Gamma-Flip, der Call Wall, der Put Wall, dem Max Pain und dem Net Dealer GEX des jeweiligen eigenen Tickers ein und zeigt dann die anderen beiden zum Abgleich. Für die Mechanik hinter den Levels beginne mit [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained), dann [Gamma Walls Explained](/education/gamma-walls-explained) und [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Fazit

SPY und SPX bilden einen Index über zwei Kontrakte und zwei getrennte Dealer-Gamma-Bücher ab. Handle die Levels, die zu deinem Instrument gehören, nutze das ~10×-Verhältnis zur Umrechnung zwischen ihnen, stütze dich auf SPX als die gewichtigere Index-Level-Karte und auf SPY für Granularität und Pinning — und schenke den Levels, bei denen beide übereinstimmen, den größten Respekt.

*Dies sind abgeleitete Analysen zu Bildungszwecken, keine Anlageberatung. Optionshandel birgt erhebliche Risiken.*
