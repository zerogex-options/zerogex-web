# Pin Strike erklärt: Der erreichbare 0DTE-Gamma-Pin
> **Aktualisierter Methodikhinweis — er hat Vorrang vor abweichenden Formulierungen weiter unten.** ZeroGEX schätzt Dealerbestände aus öffentlichen Daten; es beobachtet sie nicht. Das Modell behält die Call-positiv/Put-negativ-Konvention bei (`Net GEX = Call GEX − Put GEX`) und unterstellt Dealer netto long Calls und netto short Puts. Long Calls und Long Puts haben positives Gamma; Short Calls und Short Puts negatives Gamma. Die Put Wall ist die größte Put-Gamma-Konzentration unter Spot und lokal modelliertes negatives Dealer-Gamma: Sie kann mit Unterstützung zusammenfallen, doch das Hedging eines Short Puts erzeugt keinen mechanischen Boden. Walls können sich durch Spot, Zeit und implizite Volatilität verschieben, obwohl das offizielle Open Interest intraday unverändert bleibt. Nahe Verfall konzentriert sich Gamma am Geld; ATM-Gamma kann steigen, während deutlich ITM- oder OTM-Gamma gegen null geht. Der ausgewählte Gamma Flip ist ein lokaler Übergang; ein Profil kann mehrere oder keine aussagekräftige Kreuzung haben. Charm und Vanna sind bedingte Deltaänderungen, keine geplanten Orders. Signalwerte sind heuristische Modellergebnisse, keine kalibrierten Wahrscheinlichkeiten. Negatives Gamma verstärkt die bereits laufende Richtung; die Entfernung zu einem Ziel impliziert keine Abstoßung. Die Vorzeichenumkehr des EOD-Pressure-Pin-Terms bleibt daher eine ZeroGEX-Heuristik. Max Pain minimiert die aggregierte intrinsische Auszahlung und maximiert nicht exakt den wertlos verfallenden Nominalwert. Rohes DEX misst Optionsdelta, nicht künftigen Hedge-Flow; Prämie und Aggressorseite beweisen weder Information noch Eröffnung oder Überzeugung.


*Pin Strike ist der erreichbare 0DTE-Strike mit der stärksten modellierten positiven Dealer-Gamma-Stabilisierung in den Verfall hinein. Was er ist, wie er aufgebaut ist, warum er bewusst nicht "der größte Gamma-Strike" ist, und warum er keinen aktiven Pin ausweisen darf.*

---

## Das Problem, das Pin Strike zu lösen versucht

In den letzten Stunden einer 0DTE-Session dominiert eine Frage das Tape: *Wenn der Preis driftet, wo will er sich einpendeln?* Trader greifen zu einem Sammelsurium von Levels, um sie zu beantworten — der Call Wall, der Put Wall, Max Pain, dem größten Gamma-Strike —, und jedes beantwortet eine leicht andere Frage, keines genau die gestellte.

Pin Strike ist eine eigens für diese spezifische Frage gebaute Antwort. Er schätzt den nahegelegenen Strike mit der stärksten Kombination zweier Dinge:

1. **Stabilisierendes Dealer-Gamma *an diesem Strike*** — würde das Dealer-Hedging dort *gegen* Bewegungen wirken (den Preis zurückziehen), und
2. **Erreichbarkeit** — kann der Preis diesen Strike vor dem 0DTE-Schluss realistisch erreichen und in seiner Nähe schließen?

Beide Hälften zählen, und die zweite ist es, die Pin Strike von jedem anderen Level auf der Tafel unterscheidet. Ein Strike kann einen enormen Gamma-Fußabdruck tragen und trotzdem ein miserabler Pin-Kandidat sein, wenn der Preis keine realistische Chance hat, ihn bis zum Schlussgong zu erreichen. Pin Strike ist darauf ausgelegt, diese unerreichbaren Riesen herabzustufen und den erreichbaren Node hervorzuheben, um den herum sich der Preis tatsächlich organisieren kann.

Wer mit den zugrundeliegenden Mechanismen noch nicht vertraut ist: Der [Gamma-Exposure-Grundlagenartikel](/education/gamma-exposure-explained) behandelt, wie Dealer-Gamma das Hedging antreibt, [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip) behandelt die Regime-Linie, und [Max Pain erklärt](/education/max-pain-explained) behandelt die Idee des Settlement-Magneten, mit der Pin Strike oft verwechselt wird. Dieser Beitrag setzt diesen Hintergrund voraus und baut darauf auf.

---

## Was ist ein Pin, mechanisch betrachtet?

Ein "Pin" ist ein selbstverstärkendes Gleichgewicht, das durch Dealer-Delta-Hedging in einer **Positive-Gamma**-Umgebung entsteht. Der Mechanismus ist es wert, präzise benannt zu werden, denn Pin Strike ist ein direkter Versuch, ihn zu messen.

Wenn Dealer rund um einen Strike netto long Gamma sind, wirkt ihr Hedge *stabilisierend*: Steigt der Preis auf den Strike zu, müssen sie den Basiswert verkaufen, fällt er auf ihn zu, müssen sie kaufen. Dieses Hedging wirkt der Bewegung von beiden Seiten entgegen — es ist eine rückstellende Kraft, die den Preis zum Node zurückzieht und die realisierte Volatilität um ihn herum dämpft. Je schwerer und konzentrierter dieses positive Gamma, desto stärker die rückstellende Kraft und desto eher tendiert der Preis dazu, in den Verfall hinein nahe dem Strike "hängenzubleiben".

Das entgegengesetzte Regime zählt genauso. Wenn Dealer rund um ein Level netto *short* Gamma sind, wirkt das Hedging *destabilisierend* — sie verkaufen in Schwäche hinein und kaufen in Stärke hinein, wodurch Bewegungen verstärkt statt gedämpft werden. Eine Short-Gamma-Umgebung kann nicht pinnen; sie bewirkt das Gegenteil. Der Rohstoff für einen Pin ist also konkret **lokal konzentriertes, netto-positives Dealer-Gamma** — nicht Gamma im Allgemeinen und nicht Gamma irgendwo anders auf der Chain.

Ein ehrlicher Vorbehalt vorweg, derselbe, der für jede Dealer-Positionierungslesart auf der Plattform gilt: Das Vorzeichen des Dealer-Gammas ist eine **modellierte Konvention**, keine direkt beobachtete Tatsache. Öffentliches Open Interest verrät nicht, ob Dealer bei einem gegebenen Kontrakt long oder short sind. ZeroGEX verwendet die Standard-Konvention im SPX-Stil — Dealer werden modelliert als long die Calls, die Kunden im Rahmen von Overwriting schreiben (positives Gamma), und short die Puts, die Kunden kaufen (negatives Gamma) — und Pin Strike übernimmt genau diese Konvention, statt eine zweite zu erfinden. Es ist ein Modell der Positionierung, und es wird durchgängig als das beschrieben, was das Hedging zu tun *tendiert*, niemals als Garantie.

---

## Die Kernidee: das Buch bewerten, *als läge der Spot am Strike*

Hier ist der konzeptionelle Schritt, der Pin Strike funktionieren lässt — und den die meisten Level-Tools auslassen.

Gamma ist keine feste Eigenschaft eines Strikes. Das Gamma eines Kontrakts hängt davon ab, wo der Spot *gerade jetzt* relativ zu diesem Strike steht — es erreicht sein Maximum, wenn die Option am Geld ist, und fällt ab, wenn sie ins Geld oder aus dem Geld wandert. Das Gamma, das ein Strike *heute, zum aktuellen Preis* zeigt, sagt dir also, wie viel dieser Strike zum Hedging **hier** beiträgt. Es sagt dir **nicht**, wie viel stabilisierende Kraft **dort** bestünde, wenn der Preis tatsächlich zu diesem Strike wanderte.

Aber "dort, wenn der Preis dorthin wanderte" ist genau die Frage, um die es bei einem Pin geht. Ein Pin ist eine hypothetische Frage: *Käme der Preis am Strike K an, würde das Buch ihn halten?*

Also beantwortet Pin Strike die hypothetische Frage direkt. Für jeden Kandidaten-Strike `K` **simuliert er das gesamte Optionsbuch, als säße der Spot bei `K`**, und bewertet das Gamma jedes Kontrakts an diesem hypothetischen Spot neu — mit demselben Black-Scholes-Gamma, das die restliche Plattform verwendet. Anschließend versieht er dieses neu bewertete Gamma mit Vorzeichen und skaliert es mit der kanonischen Konvention der Plattform zu Dealer-Dollar-Gamma:

```
GEX_i(K) = dealer_sign_i × gamma_i_at_K × OI_i × 100 × K² × 0.01
```

Lies das aufmerksam: Der Spot in der Dollar-Gamma-Formel ist `K` selbst (sodass die `S²`-Skalierung zu `K²` wird), weil wir die Welt bepreisen, in der der Spot `K` *ist*. `dealer_sign_i` ist `+` für Calls und `−` für Puts (die modellierte Konvention von oben), `OI_i` ist das Open Interest, `100` ist der Kontraktmultiplikator, und das abschließende `× 0.01` stellt alles auf die branchenübliche Grundlage "Hedging-Dollar pro 1-%-Bewegung". Es ist die identische GEX-Konvention, die für die Walls und den Gamma Flip verwendet wird — Pin Strike führt keine konkurrierende Definition von Dealer-Gamma ein; er wertet lediglich die bestehende an einem anderen, hypothetischen Spot aus.

Das ist der springende Punkt, warum Pin Strike eine wirklich andere Metrik ist und keine umetikettierte Größter-GEX-Lesart: Er baut auf *kontrafaktischem* Gamma auf (wie das Buch bei K wäre), nicht auf *aktuellem* Gamma (wie das Buch jetzt ist).

---

## Lokales rückstellendes Gamma: Ein Pin ist eine Umgebung, keine Chain-Summe

Ein Pin ist ein *lokales* Phänomen. Es geht um das Gamma, das sich direkt um einen Strike ballt, nicht um das aggregierte Gamma der gesamten Chain und schon gar nicht um Gamma, das hunderte Punkte entfernt liegt. Für jeden Kandidaten `K` gewichtet Pin Strike daher den Beitrag jedes Kontrakts danach, wie nah der Strike dieses Kontrakts an `K` liegt — mithilfe eines Gauß-Kernels:

```
kernel(K, strike_i) = exp( −(strike_i − K)² / (2 × bandwidth²) )
```

Kontrakte, die genau bei `K` liegen, zählen voll; Kontrakte einige Strikes entfernt zählen weniger; weit entfernte Kontrakte tragen im Grunde nichts bei. Die Summe des kernel-gewichteten Dealer-GEX ergibt das **lokale Gamma** bei `K`:

```
local_gex(K) = Σ  GEX_i(K) × kernel(K, strike_i)
```

Die `bandwidth` — wie weit "in der Nähe" reicht — ist nicht fest verdrahtet, denn die Strike-Raster unterscheiden sich je nach Produkt (SPY und QQQ listen nahe am Geld Strikes im Dollar-Abstand, SPX alle fünf Punkte, NDX noch gröber). Pin Strike leitet die Bandbreite aus dem **Median-Abstand der nahegelegenen gelisteten Strikes** ab, sodass sich der Kernel automatisch an das jeweils betrachtete Produkt anpasst. Dies ist ein konfigurierbarer Parameter, keine magische Zahl.

Dann der entscheidende Schritt. Nur ein *positives* lokales Gamma kann pinnen:

```
restoring_gex(K) = max( local_gex(K), 0 )
```

Ist die Umgebung um `K` netto short Dealer-Gamma — eine destabilisierende, bewegungsverstärkende Tasche —, ist ihr rückstellender Score null. Es ist kein schwacher Pin; es ist *überhaupt kein Pin*, und es wird entsprechend bewertet. Dieses eine `max(·, 0)` kodiert die Physik: Pins bestehen aus positivem Gamma, Punkt.

---

## Erreichbarkeit: warum der größte Node nicht automatisch gewinnt

Lokales rückstellendes Gamma sagt dir, wie *stark* ein Pin wäre, wenn der Preis dorthin gelangte. Es sagt nichts darüber, ob der Preis dorthin gelangen *kann*. Die Distanz ist die fehlende Hälfte.

Stell dir eine Session vor, in der der Spot bei 772 steht und es einen kolossalen Positive-Gamma-Node bei 820 gibt. Dieser Node mag das Zehnfache des rückstellenden Gammas eines bescheidenen Nodes bei 773 haben — aber bei noch wenigen verbleibenden Stunden in der Session und der Volatilität auf ihrem aktuellen Niveau ist 820 im Grunde außer Reichweite. Ihn als den Pin zu behandeln wäre Unsinn. Der Preis wird sich nicht um ein Level herum organisieren, zu dem er vor dem Handelsschluss nicht gelangen kann.

Pin Strike multipliziert daher das rückstellende Gamma jedes Kandidaten mit einem **Erreichbarkeitsgewicht**, das sich daraus ableitet, wie weit der Strike entfernt ist — gemessen in den markteigenen Einheiten der "erwarteten Bewegung". Unter Verwendung des aktuellen Spots, einer repräsentativen impliziten Volatilität und der *tatsächlichen* verbleibenden Zeit bis zum Verfall:

```
z(K)            = ln(K / spot) / (σ × √τ)
reachability(K) = exp( −½ × z² )
```

`z` ist die Log-Distanz zum Strike, ausgedrückt in Standardabweichungen der Verteilung des Endpreises — die Anzahl der erwarteten Bewegungen, die er entfernt liegt. `reachability` ist die (nicht normierte) Gauß-Dichte bei dieser Distanz: Sie beträgt `1.0` für einen Strike direkt am Spot und fällt glatt gegen null, wenn der Strike weiter entfernt liegt, als Volatilität und Zeit den Preis plausibel tragen können. Weil die Distanz in `σ√τ`-Einheiten gemessen wird, funktioniert dieselbe Formel identisch über SPY, QQQ, SPX und NDX hinweg — ohne symbolspezifische Dollar-Konstanten.

Zwei Eingangsgrößen in dieser Formel verdienen Betonung, denn an ihnen macht sich die Erreichbarkeit bezahlt:

- **`σ` ist eine repräsentative implizite Volatilität am Geld**, entnommen aus den 0DTE-Optionen nahe am Geld selbst (dieselbe ATM-IV-Basis, die die Plattform auch anderswo verwendet). Es ist kein erfundener Standardwert — gibt es keine brauchbare ATM-IV, kann der Erreichbarkeit nicht vertraut werden, und die Metrik verzichtet darauf, einen Pin zu erzeugen, statt eine Zahl zu erfinden.
- **`τ` ist die *tatsächliche Intraday*-Zeit, die bis zum 0DTE-Settlement verbleibt**, in Jahren — Sekunden bis zum Schluss, nicht ein bequemes `1/365`. Das ist für 0DTE enorm wichtig: Um 10:00 Uhr ist ein Strike fünf Punkte entfernt sehr gut erreichbar; um 15:45 Uhr kann derselbe Strike mehrere erwartete Bewegungen entfernt sein. Die Erreichbarkeit bricht zusammen, während die Uhr abläuft — genau wie es ein echter Pin in den Verfall hinein tut.

---

## Alles zusammengesetzt: der Pin Score

Jeder Kandidaten-Strike erhält einen einzigen Score — das Produkt der beiden Hälften:

```
pin_score(K) = restoring_gex(K) × reachability(K)
```

Ein Strike gewinnt nur, indem er **sowohl** ein starker Positive-Gamma-Node **als auch** realistisch erreichbar ist. Ein riesiger Node, der unerreichbar ist, erzielt einen Score nahe null (die Erreichbarkeit erledigt ihn). Ein perfekt erreichbarer Strike ohne positives lokales Gamma erzielt einen Score von exakt null (das rückstellende Gamma erledigt ihn). Der Pin Strike ist der gelistete Strike mit dem maximalen `pin_score`.

Kandidaten werden von vornherein auf Strikes innerhalb von etwa ein paar erwarteten Bewegungen um den Spot beschränkt — die einzigen Strikes mit nennenswerter Erreichbarkeit —, sodass die Simulation günstig bleibt und den weit entfernten Rand gar nicht erst in Betracht zieht. Und es werden ausschließlich **tatsächlich gelistete Strikes** zurückgegeben, sodass der Pin Strike stets ein echter, handelbarer Kontrakt ist.

Neben dem Strike weist Pin Strike eine **Konfidenz** aus — wie dominant der Gewinner gegenüber den anderen tragfähigen Pins ist:

```
pin_confidence = max_pin_score / Σ (all positive pin_scores)
```

Eine Konfidenz nahe `1.0` bedeutet, dass ein einzelner Node die erreichbare Positive-Gamma-Landschaft überwältigend beherrscht — ein sauberer, singulärer Pin. Eine niedrige Konfidenz bedeutet, dass mehrere vergleichbare Kandidaten konkurrieren und der Preis eher zwischen ihnen hin- und herschwappt, als sich auf einen festzulegen. Der rohe Maximal-Score wird ebenfalls beibehalten, denn Konzentration allein kann in die Irre führen, wenn *jeder* Score winzig ist — ein "dominanter" Pin unter vernachlässigbaren Kandidaten ist immer noch vernachlässigbar.

---

## Warum Pin Strike nicht die anderen Levels ist

Pin Strike gehört zu einer Familie von Dealer-Positionierungs-Levels, und sein ganzer Wert liegt darin, sich von jedem von ihnen wirklich zu unterscheiden. Die Unterschiede sind nicht kosmetisch:

- **Call Wall / Put Wall** — die Strikes über und unter dem Spot mit dem größten *aktuellen* einseitigen Call-/Put-Gamma. Sie markieren die dominanten Konzentrationen von Widerstand und Unterstützung zum *heutigen* Preis. Bei Pin Strike geht es nicht um die größte einseitige Konzentration und er wird nicht zum heutigen Preis gemessen — es geht um *netto* lokale Stabilisierung, ausgewertet an jedem Kandidaten-Strike, als wäre der Preis dort. Siehe [Gamma Walls erklärt](/education/gamma-walls-explained).

- **Gamma Flip** — der hypothetische Spot, an dem das *aggregierte* Dealer-Gamma das Vorzeichen wechselt; die Grenze zwischen dem stabilisierenden und dem destabilisierenden Regime für das gesamte Buch. Der Flip ist eine Regime-Linie; Pin Strike ist ein spezifischer Magnet *innerhalb* eines stabilisierenden Regimes. (Tatsächlich wird Pin Strike, wenn der Spot unter dem Flip im Netto-Short-Gamma-Territorium liegt, oft nichts finden, woran er pinnen könnte — was die richtige Antwort ist.) Siehe [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip).

- **Max Pain** — der Settlement-Strike, der die aggregierte intrinsische Auszahlung an die Optionsinhaber minimiert. Er verwendet nur Open Interest und Strikes — keine Griechen, keine Volatilität, kein Dealer-Vorzeichen und keinen Begriff von Erreichbarkeit oder davon, *wie* Dealer hedgen. Es ist ein Level der Auszahlungsbuchhaltung. Pin Strike ist ein Level der Hedging-Mechanik. Sie widersprechen sich häufig, und wenn sie übereinstimmen, dann meist, weil schweres Gamma und schweres OI zufällig zusammenfallen. Siehe [Max Pain erklärt](/education/max-pain-explained).

- **King Node / Größter-GEX-Strike** — schlicht der Strike mit dem größten *aktuellen* Dollar-Gamma. Mit diesem wird Pin Strike am häufigsten verwechselt, und das Erreichbarkeitsgewicht ist genau das, was sie voneinander trennt. **Pin Strike wählt bewusst nicht den Strike mit dem höchsten GEX.** Der King Node ignoriert, ob der Preis ihn erreichen kann, und ignoriert, ob der Node netto-stabilisierend ist; Pin Strike ist darauf ausgelegt, einen unerreichbaren oder Short-Gamma-Riesen zugunsten eines erreichbaren Positive-Gamma-Nodes herabzustufen. Wenn die beiden zusammenfallen, dann deshalb, weil das dominante Gamma zufällig auch nahe am Spot liegt und stabilisierend ist — eine bedeutsame Bestätigung, keine Redundanz.

Die Ein-Satz-Version: **Die Walls sind Konzentration, der Flip ist eine Regimegrenze, Max Pain ist ein Auszahlungsminimum, der King Node ist rohe Größe — und Pin Strike ist erreichbare, netto-positive, lokale Stabilisierung in den Verfall hinein.**

---

## Warum nur 0DTE, und warum Open Interest

Zwei Eingrenzungsentscheidungen sind es wert, explizit gemacht zu werden.

**Pin Strike ist eine 0DTE-Metrik.** Er verwendet nur den nächstgelegenen Verfall desselben Tages und mischt kein Wochen-, Monats- oder länger laufendes Gamma bei. Das ist Absicht: Ein Pin ist ein Phänomen *in den Handelsschluss hinein*. Das Gamma desselben Tages ist das, was sich heute auflöst, sein Erreichbarkeitsfenster wird in Stunden gemessen, und sein `1/√τ`-Gamma-Profil schärft sich dramatisch zum Schlussgong hin — was genau das Regime ist, in dem Pinning ein reales, beobachtbares Verhalten ist. Länger laufendes Gamma ist eine strukturelle Kulisse, kein Intraday-Magnet, und es beizumischen würde genau den Effekt verwischen, den die Metrik zu isolieren versucht. Pin Strike ist daher eine Intraday-Lesart in den Verfall hinein — kein breites strukturelles Optionslevel.

**Pin Strike verwendet dieselbe Open-Interest-Basis wie die zentrale GEX-Engine.** Er versucht nicht, die Positionierung anhand von Intraday-Flow anzupassen — keine Eröffnungs-versus-Schließungs-Inferenz, keine Live-Neugewichtung des OI. Diese Art der Flow-Anpassung führt echte zusätzliche Unsicherheit ein und ist ein separates Problem; sie in den Pin einzuarbeiten würde es schwerer machen, der Metrik zu vertrauen, nicht leichter. Der Pin, den du siehst, baut auf derselben Positionierungsbasis auf wie jede andere Dealer-Gamma-Lesart auf der Plattform, was ihn konsistent und interpretierbar hält.

---

## Wann Pin Strike ins Spiel kommt

Pin Strike ist in einem bestimmten Zeitfenster und Regime am aussagekräftigsten und außerhalb davon am wenigsten aussagekräftig:

- **Spät in einer 0DTE-Session, in einem Positive-Gamma-Regime.** Das ist sein Heimterrain. Wenn der Spot über dem Gamma Flip liegt und ein erreichbarer Positive-Gamma-Node existiert, markiert der Pin Strike, wo sich das stabilisierende Hedging konzentriert, und der Preis kehrt in den Handelsschluss hinein oft um ihn herum zum Mittel zurück. Am besten liest er sich als *Schwerpunkt der aktuellen Pinning-Range*, flankiert von den Walls.

- **Als Kontext-Level, nicht als Ziel.** Ein Pin Strike ist ein modellierter Magnet, keine Vorhersage, dass der Preis dort drucken wird. Er tendiert dazu, zu beschreiben, wo sich eine Range organisiert, wie eng und wie zuversichtlich (über den Konfidenz-Score) — kein garantiertes Ziel und kein Timing-Signal. Er ist Kontext für eine Entscheidung, niemals eine Entscheidung.

- **Zusammen mit der Konfidenz und den Walls lesen.** Ein Pin mit hoher Konfidenz, der zwischen einer festen Call Wall und Put Wall sitzt, ist ein kohärentes, klar definiertes Pinning-Bild. Ein Pin mit niedriger Konfidenz, oder ein Pin mit weit entfernten Walls, ist ein deutlich lockereres. Die Zahl ist nur so aussagekräftig wie die Struktur um sie herum.

Und ganz entscheidend erkennt er, wann *nichts* davon zutrifft — was das Thema des letzten Abschnitts ist.

---

## Wann Pin Strike null ist — und warum wir uns dafür entschieden haben

Das ist der Teil, der Pin Strike am stärksten von einem naiven "nächster schwerer Strike"-Tool unterscheidet: **Er darf — und soll — keinen aktiven Pin ausweisen.** Ein Tool, das immer ein Level druckt, ist leicht zu bauen und leicht falsch zu lesen — es erzeugt falsche Zuversicht an genau den Tagen, an denen es nichts gibt, woran man pinnen könnte. Pin Strike tut das Schwierigere und Ehrlichere: Wenn es keinen aussagekräftigen Positive-Gamma-Pin gibt, gibt er nichts zurück und sagt dir, *warum*.

Wenn es keinen aktiven Pin gibt, meldet die Metrik einen der folgenden Gründe:

- **Kein 0DTE-Verfall** — für den Basiswert ist kein Verfall am selben Tag gelistet. Ohne 0DTE-Chain gibt es nichts, worum es bei einem Intraday-Pin gehen könnte.
- **Verfallen** — der 0DTE-Settlement-Zeitpunkt ist bereits vergangen (Zeit bis zum Verfall ≤ 0), z. B. nach dem Kassaschluss. Erreichbarkeit ist undefiniert, sobald die Optionen abgerechnet sind.
- **Kein positives rückstellendes Gamma** — der Algorithmus lief, aber kein erreichbarer Kandidat hat netto-positives lokales Dealer-Gamma. Das ist der aussagekräftige, nicht-degenerierte Nullfall: Der Preis sitzt in einer Short-Gamma-Umgebung, in der das Hedging destabilisierend wirkt, also *pinnt nichts*. Hier ein Level zu erzwingen wäre aktiv irreführend — es würde auf einen Strike zeigen, der den Preis mechanisch *wegdrückt*, nicht auf ihn zu.
- **Unzureichende IV-Daten** — es gibt keine brauchbare implizite Volatilität am Geld, um die Erreichbarkeitsberechnung zu verankern, sodass den Distanzen nicht vertraut werden kann. Es wird keine willkürliche Standard-Vol eingesetzt.
- **Unzureichende Optionsdaten** — es gibt keine gültigen 0DTE-Optionsdaten (kein Spot, oder keine Kontrakte mit brauchbarem Open Interest, IV, Zeit und Strike), sodass es nichts zu modellieren gibt.
- **Pin Score zu schwach** — eine optionale Größenordnungs-Untergrenze, die einen Pin unterdrückt, dessen roher Score vernachlässigbar ist. Sie ist standardmäßig aus, greift also nur, wenn sie explizit konfiguriert ist — die Plattform erfindet keine nutzerseitigen Schwellenwerte.

Zwei weitere alltägliche Fälle erscheinen als leerer Pin ohne Grund-Code: **historische Replay-Frames**, die geschrieben wurden, bevor Pin Strike ausgeliefert wurde, tragen schlicht keinen Wert (die Zeile wird weggelassen, und nichts wird nachgefüllt), und das **Live-Gamma-Chart blendet den Pin während des Zeit-Rücklaufs aus**, weil der Pin ein Wert auf Zusammenfassungsebene ist, der für den minütlichen Rücklauf-Puffer nicht rekonstruiert wird.

Das Designprinzip, das all dem zugrunde liegt: **Ein ehrliches "kein Pin" ist nützlicher als ein erzwungenes.** Eine Session mit negativem Gamma, mit Trend oder mit bereits erfolgtem Verfall hat schlicht keinen Gamma-Pin, und die korrekte Ausgabe in diesen Zuständen ist Schweigen — nicht der nächste Strike, als Magnet verkleidet. Die Metrik legt genau offen, welche der obigen Bedingungen zutrifft, sodass ein "—" nie mehrdeutig ist: Es ist eine konkrete, überprüfbare Aussage über den Markt, keine Lücke in den Daten. In der Oberfläche wird dies stets als Gedankenstrich dargestellt — niemals als `0`, `NaN` oder als irreführender Ausweich-Strike.

---

## Wie man ihn in einem Satz liest

Pin Strike ist der erreichbare 0DTE-Strike, bei dem das Neubewerten des Buchs an diesem Strike das stärkste lokal konzentrierte, netto-positive (stabilisierende) Dealer-Gamma in den Verfall hinein erzeugt — ein modellierter Schwerpunkt für eine Pinning-Range in den Handelsschluss hinein, ausgewiesen mit einer Konfidenz und, wenn der Markt keinen solchen Node bietet, bewusst als gar nichts ausgewiesen.

Um ihn live neben den Walls, dem Flip und Max Pain zu sehen, rufe die [heutigen SPX-/SPY-/QQQ-/NDX-Gamma-Levels](/spx-gamma-levels) auf und beobachte, wie sich der Pin Strike in die letzte Stunde hinein verhält — und achte auf die Sessions, in denen er verstummt.
