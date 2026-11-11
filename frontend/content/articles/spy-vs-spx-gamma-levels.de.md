# SPY vs. SPX Optionen: Welche Gamma-Levels zählen?

*SPY und SPX bilden denselben Index über zwei unterschiedliche Kontrakte ab - und zwei getrennte Dealer-Gamma-Bücher. Hier erfährst du, wie sich ihre Gamma-Levels unterscheiden, wie man ein Level vom einen ins andere umrechnet, welches Buch tendenziell mehr Gewicht trägt und warum die Levels, bei denen beide übereinstimmen, am meisten zählen können.*

---

## Die kurze Antwort

Wenn du SPX handelst, lies die SPX-Gamma-Levels. Wenn du SPY handelst, lies die SPY-Gamma-Levels. Aber weil beide Kontrakte **denselben** zugrunde liegenden Index abbilden und dabei **getrennte** Pools von Open Interest tragen, kann die Beobachtung beider zusätzlichen Kontext liefern. ZeroGEX hat nicht nachgewiesen, dass Übereinstimmung eine höhere Zuverlässigkeit garantiert.

Der Rest dieses Artikels erklärt, warum sich die beiden Bücher unterscheiden, wie man ein Level zwischen ihnen umrechnet und welches mehr Gewicht verdient, wenn sie nicht übereinstimmen.

---

## Derselbe Index, zwei verschiedene Kontrakte

SPX und SPY bilden beide den S&P 500 ab. Was sich unterscheidet, ist der *Kontrakt*, der ihn umhüllt - und diese Unterschiede prägen, wie Dealer jeden von ihnen absichern.

| Merkmal | SPX | SPY |
|---|---|---|
| Was es ist | S&P 500 **Index**optionen | S&P 500 **ETF**-Optionen |
| Preisskala | Der Indexstand (z. B. 6000) | ~1/10 des Index (z. B. 600) |
| Abwicklung | Barausgleich | Physische Lieferung (Aktien) |
| Ausübungsstil | Europäisch - keine vorzeitige Zuteilung | Amerikanisch - Risiko vorzeitiger Zuteilung |
| Kontraktnominal | ~100 $ × Indexstand (≈10× SPY) | ~100 $ × ETF-Preis |
| Strike-Abstände | Weiter (üblicherweise 5 Punkte) | Feiner (1 $, teils 0,50 $) |
| Dividenden & Steuern | Keine Dividende; Section-1256-Behandlung | Zahlt Dividenden; Aktienoptions-Behandlung |
| Typische Klientel | Institutionelle, Index- & 0DTE-Desks | Privatanleger plus Institutionelle, Aktien-Hedger |

Die für Gamma wichtigste Zeile ist das **Kontraktnominal**. Ein SPX-Kontrakt kontrolliert etwa das Zehnfache des Dollar-Exposures eines SPY-Kontrakts, sodass die Dealer-Absicherung bei SPX pro Kontrakt weit mehr indexäquivalentes Delta bewegt. Das ist im Folgenden von Bedeutung.

---

## Warum SPY und SPX getrennte Gamma-Bücher haben

Die Gamma-Exposure wird aus dem Open Interest einer Optionskette berechnet - Strike für Strike, Verfall für Verfall - und erhält dann per Konvention ein Dealer-Vorzeichen. SPX und SPY sind unterschiedliche Ketten mit unterschiedlichem Open Interest, daher erzeugt jede ihr **eigenes** [Gamma-Profil](/education/gamma-exposure-explained): ihren eigenen [Gamma-Flip](/education/how-to-read-a-gamma-flip), ihre eigene [Call Wall und Put Wall](/education/gamma-walls-explained), ihr eigenes Net GEX.

Ein Hinweis zur Einordnung all dessen: Net GEX und das „Dealer-Gamma-Buch“ sind *modellierte* Schätzungen - Gamma-Beträge aus der öffentlichen Optionskette, mit Vorzeichen versehen nach der traditionellen Konvention Call-positiv / Put-negativ. Der tatsächliche Dealer-Bestand ist aus Optionskettendaten nicht direkt beobachtbar, behandle beide Bücher also als Modelle der Positionierung und nicht als Bestandsliste dessen, was Dealer tatsächlich halten.

Da sich beide Ketten auf denselben Index beziehen, zeigen diese Levels in S&P-Größen normalerweise auf dieselbe Stelle. Sie werden aber von unterschiedlichen Gruppen gebaut - SPX tendiert institutionell und index-/0DTE-lastig, SPY trägt eine schwerere Mischung aus Privatanlegern und Aktien-Hedging-Flow -, sodass die beiden Bücher Strikes unterschiedlich gewichten und an den Rändern auseinanderdriften können. Wenn sie divergieren, kann das Information statt Rauschen sein.

---

## Ein Level vom einen ins andere übersetzen

SPY handelt bei etwa einem Zehntel des S&P-500-Index, daher als erste Näherung:

> SPY-Level ≈ SPX-Level ÷ 10 - SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Zwei Vorbehalte verhindern, dass die Umrechnung exakt ist:

- **Tracking-Abweichung.** Der Preis von SPY spiegelt aufgelaufene Dividenden und kleine Tracking-Unterschiede wider, sodass das Verhältnis nie ein sauberes 10,000 ist. Rechne zur Orientierung um, nicht auf den Cent genau.
- **Strike-Granularität.** In absoluten Dollarbeträgen listet SPY feinere Strikes (1 $, teils 0,50 $) als die Fünf-Punkte-Staffelung von SPX - doch rechnet man die ~10×-Skala ein: Ein SPY-Dollar entspricht zehn Indexpunkten, sodass SPYs 1-$-Strikes in Indexpunkten umgerechnet tatsächlich *gröber* sind als SPXs Fünf-Punkte-Strikes, während seine 0,50-$-Strikes ihnen lediglich gleichkommen. In Indexpunkten gerechnet löst SPX das Gamma mindestens so fein auf wie SPY; SPYs echter Vorteil sind runde Dollar-Strikes, die Pinning anziehen können, sowie seine Aktienliquidität - nicht eine feinere Index-Auflösung.

---

## Welches Buch trägt mehr Gewicht?

Für den aggregierten Dealer-Hedging-Druck im S&P ist SPX in der Regel die primäre Karte. Drei Gründe:

1. **Nominalwert.** Etwa 10× so viel Dollar-Delta pro Kontrakt bedeutet, dass die SPX-Hedging-Flows tendenziell das Index-Level-Gamma dominieren, das den Cash-Index und /ES am stärksten beeinflusst.
2. **0DTE-Tiefe.** SPX listet an jedem Handelstag einen Verfall und ist der tiefste Index-Optionsmarkt überhaupt; das taggleiche [Dealer-Positioning](/education/0dte-dealer-positioning-explained), das die Intraday-Volatilität antreiben kann, zeigt sich tendenziell dort zuerst.
3. **Sauberere Mechanik.** Barausgleich und europäische Ausübung bedeuten kein Gerangel um vorzeitige Zuteilung, das das Buch zum Verfall hin verzerrt.

SPY verdient sich seinen Platz als **Granularitäts- und Bestätigungsschicht**: feinere Strikes, enorme Aktienliquidität und der Flow von Privatanlegern und Hedgern, der das [SPY-spezifische Pinning](/education/why-spy-pins-near-strikes) erzeugen kann. Und wenn du SPY selbst handelst, sind dessen eigene Walls die Levels, auf die dein Instrument am wahrscheinlichsten reagiert.

---

## Welche Levels zählen für deinen Trade?

Ordne die Karte dem Instrument zu, das du tatsächlich handelst:

- **SPX, /ES oder SPX 0DTE** → SPX-Gamma-Levels sind deine Karte.
- **SPY-Aktien oder SPY-Optionen** → SPY-Gamma-Levels - die eigenen Walls und der Pin deines Instruments.
- **QQQ** → QQQ-Levels (siehe unten).

Achte dann auf **Konfluenz**. Wenn ein SPX-Level mit dem umgerechneten SPY-Level übereinstimmt, behandelt ZeroGEX diese Übereinstimmung als kontextuelle Konfluenz zwischen zwei getrennten modellierten Büchern. Das ist eine hauseigene Heuristik, kein Beleg dafür, dass das gemeinsame Level eine höhere Trefferquote hat. Wenn sie nicht übereinstimmen, behalte beide als getrennte Referenzen, statt anzunehmen, dass eines der beiden Bücher den Preis kontrolliert.

> Ein Level, bei dem SPX und SPY übereinstimmen, kann mehr zählen als die größte Wall in einem der beiden Charts für sich allein.

---

## QQQ und NDX: dieselbe Logik am Nasdaq

Der Nasdaq-100 hat dieselbe Aufteilung: **QQQ** ist der ETF, **NDX** ist der Cash-Index, und jeder führt sein eigenes Gamma-Buch auf einer anderen Preisskala. Wenn du QQQ handelst, lies die [QQQ-Gamma-Levels](/qqq-gamma-levels); wenn du NDX oder /NQ handelst, ist das Index-Buch deine Referenz. Derselbe Vergleich kann für QQQ und NDX Kontext liefern, ohne zu garantieren, dass Konfluenz die Zuverlässigkeit verbessert.

---

## Beide nebeneinander auf ZeroGEX lesen

Die kostenlosen ZeroGEX-Gamma-Levels-Seiten veröffentlichen alle drei Bücher nebeneinander, sodass Übereinstimmung auf einen Blick erkennbar ist:

- [SPX-Gamma-Levels](/spx-gamma-levels) - das Index-Buch, die primäre S&P-Karte.
- [SPY-Gamma-Levels](/spy-gamma-levels) - das ETF-Buch, feinere Strikes und Pin-Details.
- [QQQ-Gamma-Levels](/qqq-gamma-levels) - die Nasdaq-100-Lesart.

Jede Seite führt mit dem Gamma-Flip, der Call Wall, der Put Wall, dem Max Pain und dem Net Dealer GEX des jeweiligen eigenen Tickers ein und zeigt dann die anderen beiden zum Abgleich. Für die Mechanik hinter den Levels beginne mit [Gamma Exposure (GEX) erklärt](/education/gamma-exposure-explained), dann [Gamma Walls erklärt](/education/gamma-walls-explained) und [Was ist ein Gamma-Flip?](/education/how-to-read-a-gamma-flip)

---

## Fazit

SPY und SPX bilden einen Index über zwei Kontrakte und zwei getrennte Dealer-Gamma-Bücher ab. Handle die Levels, die zu deinem Instrument gehören, nutze das ~10×-Verhältnis zur Umrechnung zwischen ihnen, stütze dich auf SPX als die gewichtigere Index-Level-Karte und auf SPY für das Pinning an runden Zahlen und die Aktienliquidität - und gib den Levels, bei denen beide übereinstimmen, zusätzliches Gewicht.

*Dies sind abgeleitete Analysen zu Bildungszwecken, keine Anlageberatung. Optionshandel birgt erhebliche Risiken.*
