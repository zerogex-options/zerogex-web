# EOD Pressure Signal erklärt: den Schluss richtig lesen
> **Methodikhinweis.** ZeroGEX schätzt Dealerbestände aus öffentlichen Daten; es beobachtet sie nicht. Das Modell behält die Call-positiv/Put-negativ-Konvention bei (`Net GEX = Call GEX − Put GEX`) und unterstellt Dealer netto long Calls und netto short Puts. Long Calls und Long Puts haben positives Gamma; Short Calls und Short Puts negatives Gamma. Die Put Wall ist die größte Put-Gamma-Konzentration unter Spot und lokal modelliertes negatives Dealer-Gamma: Sie kann mit Unterstützung zusammenfallen, doch das Hedging eines Short Puts erzeugt keinen mechanischen Boden. Walls können sich durch Spot, Zeit und implizite Volatilität verschieben, obwohl das offizielle Open Interest intraday unverändert bleibt. Nahe Verfall konzentriert sich Gamma am Geld; ATM-Gamma kann steigen, während deutlich ITM- oder OTM-Gamma gegen null geht. Der ausgewählte Gamma Flip ist ein lokaler Übergang; ein Profil kann mehrere oder keine aussagekräftige Kreuzung haben. Charm und Vanna sind bedingte Deltaänderungen, keine geplanten Orders. Signalwerte sind heuristische Modellergebnisse, keine kalibrierten Wahrscheinlichkeiten. Negatives Gamma verstärkt die bereits laufende Richtung; die Entfernung zu einem Ziel impliziert keine Abstoßung. Dass der EOD-Pressure-Pin-Term bei negativem Gamma der jüngsten Bewegung folgt, ist eine ZeroGEX-Heuristik. Max Pain minimiert die aggregierte intrinsische Auszahlung und maximiert nicht exakt den wertlos verfallenden Nominalwert. Rohes DEX misst Optionsdelta, nicht künftigen Hedge-Flow; Prämie und Aggressorseite beweisen weder Information noch Eröffnung oder Überzeugung.


*Der praxisnahe Deep-Dive zum ZeroGEX EOD Pressure Signal - was es misst, warum der Schluss strukturell driftet, wie sich der Score aus Charm und Pin Gravity zusammensetzt, und wie man ihn innerhalb der letzten 90 Minuten liest.*

---

## Warum es dieses Signal gibt

Die letzten 90 Minuten der Kassa-Sitzung unterscheiden sich strukturell vom Rest des Handelstags. Der Charm-Zerfall bei 0DTE-Positionen zwingt Dealer zu kontinuierlichem Hedging. Die Pin Gravity rund um Strikes mit hohem Gamma verstärkt sich. Das Dealer-Buch ist zu keinem anderen Zeitpunkt der Sitzung so eingeschränkt.

Diese Kräfte sind nicht zufällig. Sie sind gerichtet und lesbar - *wenn* man weiß, worauf man achten muss. Das EOD Pressure Signal existiert, um diese gerichtete Drift in Echtzeit sichtbar zu machen, damit Trader sich mit dem Schlussflow positionieren können, statt gegen ihn zu kämpfen.

Dieser Beitrag ist die trader-orientierte Lesart des EOD Pressure Signals. Er behandelt, was gemessen wird, warum der Schluss anders ist, wie der Score aus Charm und Pin Gravity aufgebaut wird, und wie man ihn innerhalb des Fensters liest. Für den tiefergehenden Beitrag zur kombinierten Methodik, die EOD Pressure mit Trap Detection verbindet, siehe [Trading the Close](/education/eod-pressure-and-trap-detection); für die zugrunde liegende Mechanik behandelt [Vanna and Charm Explained](/education/vanna-and-charm-explained) im Detail, wie Charm forciertes Hedging antreibt.

---

## Was ist das EOD Pressure Signal?

Das EOD Pressure Signal stellt eine einzige Frage:

> In welche Richtung drückt das forcierte Hedging den Preis Richtung Schluss, gegeben das aktuelle Dealer-Buch und die Nähe eines Magnet-Strikes?

Es ist ein **Advanced**-Signal im ZeroGEX-Stack - es liefert sowohl einen kontinuierlichen Score auf der Linie von -100 bis +100 als auch einen diskreten Trigger, sobald der Score **±20** überschreitet. Die Schwelle liegt bewusst unter der der meisten Advanced-Signale (±25), weil der strukturelle Kontext (das Schlussfenster) selbst schon ein Filter ist - wenn EOD Pressure im aktiven Fenster 15 oder mehr in eine der beiden Richtungen anzeigt, ist das bereits richtungsweisend. Wie alle Advanced-Signale gehört es zu Pro.

Trade-Bias: **gerichtete Lesart**. Das Signal zeigt an, in welche Richtung der Druck geht - es schreibt für sich genommen nicht vor, ob man mitreiten oder dagegen faden soll. Das ergibt sich aus dem Regime-Kontext.

---

## Warum der Schluss anders ist

Drei strukturelle Mechanismen verstärken sich gegenseitig im letzten Fenster der Sitzung:

1. **Der Charm-Zerfall beschleunigt sich.** Wenn sich 0DTE-Optionen dem Verfall nähern, driftet ihr Delta vorhersehbar in Richtung 0 (aus dem Geld) oder ±1 (im Geld). Dealer, die ein delta-neutrales Buch führen, müssen kontinuierlich nachhedgen, und die Geschwindigkeit dieses Nachhedgens *steigt*, je näher der Schluss rückt.
2. **Die Pin Gravity verstärkt sich.** Strikes mit hohem Gamma ziehen den Preis stärker an, je kürzer die Restlaufzeit wird. In einem Long-Gamma-Regime verstärkt sich der Magnetismus zum nächstgelegenen schweren Strike im Laufe des Nachmittags.
3. **Die Liquidität dünnt aus.** Blockflüsse, End-of-Day-Rebalancing und strukturelle Indexorders verschieben das Flow-Profil von kontinuierlich zu schubweise. Dealer haben weniger Spielraum, um Fehler abzufedern.

EOD Pressure kombiniert die ersten beiden Faktoren zu einer gerichteten Lesart. Der dritte ist implizit in der Kalibrierung des Scores enthalten.

---

## Die vier Kernkomponenten

Das Signal aggregiert vier Komponenten - drei tragen zur Magnitude bei, eine wirkt als harte Sperre.

### Komponente 1: Charm am Spot

Das direkteste Maß für erzwungenen Hedge-Flow. Das Signal summiert das Dealer-Charm-Exposure über ein vol-skaliertes At-the-Money-Band, gewichtet nach Verfallsbucket:

| Bucket | Gewicht | Warum |
|---|---|---|
| 0DTE | 0,70 | Charm schlägt am Verfallstag am stärksten zu. Dominanter Beitrag. |
| Weekly | 0,20 | Wesentlich, aber sekundär. |
| Monthly | 0,10 | Hintergrundbeitrag. |
| LEAPS | 0,00 | Zu weit entfernt, um für den heutigen Schluss relevant zu sein. |

Das Aggregat ist so normiert, dass ±20 Mio. USD an gebucketem Dealer-Charm den Sub-Score bei ±1,0 sättigt.

### Komponente 2: Pin Gravity

Der Pin-Term hängt vom modellierten Gamma-Regime ab:

```
if net_gex >= 0:   # zero or positive gamma: pull toward the magnet
    pin_target   = max_pain  OR  max_gamma_strike
    distance_pct = (pin_target − close) / close
    pin_score    = clip(distance_pct / 0.003, [-1, +1])
else:              # negative gamma: follow the move already underway
    trailing_ret = (latest_close − earliest_close) / earliest_close
    pin_score    = clip(trailing_ret / 0.003, [-1, +1])
```

Ein Pin-Ziel 0,3 % über Spot ergibt in einem modellierten Positiv-Gamma-Regime einen Pin-Score von +1,0 - der Magnet liegt oben und die Anziehung wirkt. In einem modellierten Negativ-Gamma-Regime trägt die Zielentfernung keine Richtungsinformation, deshalb ignoriert der Term sie und liest stattdessen die jüngste Rendite: Ein Anstieg um 0,3 % über die letzten Schlusskurse ergibt ebenfalls +1,0, ein Rückgang um 0,3 % ergibt -1,0. Fehlt Net GEX oder gibt es weniger als zwei verwertbare Schlusskurse, ist der Pin-Term 0.

**Methodische Einschränkung:** Beide Zweige sind ZeroGEX-Heuristiken mit von Hand gewählten Sättigungspunkten, keine kalibrierten Wahrscheinlichkeiten. Der Negativ-Gamma-Zweig bildet die Idee ab, dass negatives Gamma eine bereits laufende Richtung verstärkt; er sagt diese Richtung nicht voraus.

### Komponente 3: Zeitrampe (die Sperre)

Die Rampe wirkt multiplikativ. Vor **14:30 ET** ist sie exakt null - das gesamte Signal wird kurzgeschlossen.

| Uhrzeit (ET) | Rampe |
|---|---|
| Vor 14:30 | 0,00 |
| 14:30 | 0,00 |
| 14:45 | 0,20 |
| 15:00 | 0,40 |
| 15:30 | 0,80 |
| 15:45 - 16:00 | 1,00 |

Deshalb zeigt EOD Pressure den größten Teil des Handelstags null an. Das Signal ist außerhalb des Fensters strukturell inaktiv.

### Komponente 4: Kalender-Verstärker

Der Verstärker erhöht die Überzeugung an Tagen, an denen sich Positionierung konzentriert:

| Kalender | Amp |
|---|---|
| Normaler Tag | 1,0× |
| Monatlicher OPEX (dritter Freitag) | 1,5× |
| Quad Witching (dritter Freitag in Mär/Jun/Sep/Dez) | 2,0× |

Das ist der einzige Punkt im Signal, an dem der Zwischen-Score ±1 überschreiten kann - die finale Begrenzung bringt ihn wieder in den zulässigen Bereich.

---

## Wie der Score berechnet wird

Die finale Aggregation:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

Die Rechnung läuft auf -1 bis +1; Karte und Signalseite zeigen das Ergebnis mal 100, ein Score von 0,55 erscheint dort also als 55.

Die 60/40-Gewichtung spiegelt eine bewusste Haltung wider: **Charm ist das direkte Maß für erzwungenen Hedge-Flow**, während **Pin Gravity der indirekte, regimeabhängige Sog ist**. Beides zählt. Charm führt.

---

## Score-Interpretation

| Score | Lesart |
|---|---|
| +60 bis +100 | Starke Aufwärtsdrift Richtung Schluss erwartet |
| +20 bis +60 | Leichte Aufwärtsdrift - Intraday-Bias spricht für Long halten, aber nicht aggressiv aufstocken |
| -20 bis +20 | Kein Edge - entweder noch zu früh im Fenster, oder die Terme heben sich auf |
| -20 bis -60 | Leichte Abwärtsdrift |
| -60 bis -100 | Starke Abwärtsdrift Richtung Schluss erwartet |

Die Trigger-Schwelle liegt bei **±20** - niedriger als das übliche ±25 - weil das Fenster selbst schon die Filterung übernimmt.

---

## Wann das Signal auslöst und wann es stumm bleibt

Der dominante Zustand ist **stumm**. Den größten Teil des Handelstags ist EOD Pressure null - und diese Null ist *informativ*, nicht "neutral". Sie bedeutet, dass das aktive Fenster noch nicht begonnen hat.

Das Signal kann auch innerhalb des Fensters null anzeigen, wenn:

- Bei einer dünnen oder schlecht quotierten Options-Chain keine Strikes im vol-skalierten ATM-Band liegen.
- Sowohl `max_pain` als auch `max_gamma_strike` null sind.
- Das Pin-Target genau auf dem Spot liegt.
- Charm- und Pin-Score sich zufällig aufheben - selten, erfordert entgegengesetzte Richtungen und ungefähr gleiche Magnitude.

Eine 0 außerhalb des Fensters ist normal. Eine 0 innerhalb des Fensters ist informativ - *EOD Pressure hat heute nichts beizutragen.*

---

## Was ein Trader damit macht

Drei Workflow-Muster:

### 1. Setup vor dem Fenster

Vor 14:30 ET ist EOD Pressure per Konstruktion null. Nutze die Zeit vor dem Fenster, um zu bestimmen, wie das strukturelle Setup *sein wird*: Wo liegt das Max Gamma, wo der Gamma Flip, in welchem Regime befinden wir uns, wo steht der Spot relativ zum Pin-Target? Wenn das Fenster öffnet, wird das Signal dich nicht überraschen - es wird die Lesart bestätigen oder widerlegen, die du dir bereits erarbeitet hast.

### 2. Der 15:30-Wendepunkt

EOD Pressure überschreitet um 15:30 ET die 0,8×-Rampe. Wenn Charm- und Pin-Term während des frühen Rampenfensters (14:45-15:30) übereingestimmt haben, verdichtet sich die Überzeugung tendenziell um 15:30. Positioniere dich vorher, nicht nachher.

### 3. Quad Witching ist struktureller Kontext

Der 2,0×-Verstärker an Quad-Witching-Tagen ist groß genug, um ein unverstärktes Signal von +40 auf verstärkte +80 zu heben. Behandle diese Tage als strukturell überzeugungsstärker - und mit strukturell höherem Whipsaw-Risiko früher am Tag, bevor das Fenster öffnet.

---

## EOD Pressure zusammen mit anderen Signalen lesen

EOD Pressure ist eine **gerichtete Lesart** - sie zeigt, wohin der Druck zeigt, ohne für sich genommen mitreiten-versus-faden vorzuschreiben. Die Fade-versus-Ride-Entscheidung kommt aus dem Regime:

- **Positive-Gamma-Regime + positiver EOD-Pressure-Score:** Die Drift geht nach oben, das Dealer-Hedging dämpft - die Lesart spricht dafür, sich *mit* der Drift zum Magnet-Strike zu positionieren (Schwäche kaufen, statt in sie hinein zu faden) und nur Überschüsse jenseits des Magneten zu faden.
- **Negative-Gamma-Regime + positiver EOD-Pressure-Score:** Der Score verbindet eine charm-getriebene Neigung mit der jüngsten Bewegung (bei negativem Gamma folgt der Pin-Term der bereits laufenden Richtung), und der Dealer-Reflex wird als verstärkend statt dämpfend modelliert - eine Fortsetzung des Momentums ist wahrscheinlicher.

Kombiniert mit anderen Signalen:

- **EOD Pressure + Trap Detection gleiche Richtung:** Das häufigste High-Conviction-Setup. Die EOD-Drift bestätigt einen Fade auf einen gescheiterten Breakout.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) gleiche Richtung:** Zum Schluss hin komprimiert, mit bestätigender charm-getriebener Drift. Starkes Fortsetzungs-Setup.
- **EOD Pressure ≠ 0 innerhalb des Fensters ohne andere aktive Signale:** Die strukturelle Drift ist die einzige Lesart. Kleinere Positionsgröße, als gerichtete Tendenz behandeln, nicht als High-Conviction-Trade.

---

## Häufige Fehllesarten

Drei Fallen:

- **Eine Null vor dem Fenster als "heute kein Signal" interpretieren.** Das Fenster hat noch nicht geöffnet. Das Signal ist *strukturell inaktiv*, nicht informationslos.
- **Den Regimewechsel bei Pin Gravity ignorieren.** Die Anziehung zum Ziel bei positivem Gamma ist eine Modellheuristik. Bei negativem Gamma betrachtet der Pin-Term das Ziel gar nicht mehr und folgt stattdessen der jüngsten Bewegung - ebenfalls eine Hausheuristik, keine mechanische Gewissheit.
- **Den Rohscore ohne die Rampe traden.** Ein Wert von +40 um 14:45 (Rampe 0,20) entspricht in Wirklichkeit einem effektiven Score von +8. Lies die rampenbereinigte Magnitude, nicht den rohen Eingabewert.

---

## Wie ZeroGEX das EOD Pressure Signal darstellt

Das Dashboard zeigt es an mehreren Stellen:

- **Die EOD-Pressure-Karte** zeigt den Live-Score, den Trigger-Status und die Komponenten-Aufschlüsselung (Charm- vs. Pin-Beiträge).
- **Die Event Timeline** auf der Seite des Signals protokolliert jeden Trigger.
- **Signal Breadth** im Bereich Proprietäre Signale des Dashboards zählt es als eine der Richtungsstimmen. (Es ist kein Input des Composite MSI, der aus seinen eigenen sechs Komponenten besteht.)

*[Bild-Platzhalter: ZeroGEX EOD-Pressure-Karte mit Score, Komponenten und Rampenstatus während des aktiven Fensters - Datei ablegen unter /public/blog/zerogex-eod-pressure-card.png]*

Ein durchgerechnetes Beispiel. Der SPX steht um 15:15 ET an einem monatlichen OPEX-Freitag bei 5.825, und ZeroGEX zeigt:

- **EOD Pressure:** -55 (bearish ausgelöst)
- **Net GEX:** +1,2 Mrd. USD (positiv)
- **Gamma Flip:** Spot liegt bei +15 (über dem Flip)
- **Max Pain:** 5.810 (unter Spot)
- **Charm am Spot:** moderat negativ (Verkäufe bauen sich auf)
- **Kalender-Amp:** 1,5× (monatlicher OPEX)

Die strukturelle Lesart: Positive-Gamma-Regime mit einem schweren Magneten 15 Punkte unter dem Spot, charm-getriebenes Hedging zeigt nach unten, und der OPEX-Verstärker erhöht die Überzeugung. Praktische Tendenz: Die Drift Richtung 5.810 ist der wahrscheinlichere Pfad Richtung Schluss. Der Trade ist nicht EOD Pressure selbst - es ist eine Positionierung im Einklang mit der Driftrichtung, mit einer Positionsgröße, die auf die High-Conviction-OPEX-Lesart abgestimmt ist.

---

## Fazit

> EOD Pressure sagt dir, in welche Richtung das forcierte Hedging im Schlussfenster zeigt. Es sagt dir nichts über den Rest des Tages. Genau dieses Schweigen ist der Punkt.

Die Disziplin besteht darin, es als gerichtete Lesart für die letzten 90 Minuten zu nutzen, gegen das Regime abzugleichen, um zwischen Mitreiten und Faden zu entscheiden, und es gegen die anderen Advanced-Signale auf Konfluenz zu validieren. Außerhalb des Fensters solltest du woanders hinschauen.

Nur Bildungsinhalt - nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige EOD-Pressure-Lesart während des aktiven Fensters in Echtzeit sehen möchtest, zusammen mit Trap Detection und dem Regime-Kontext, zeigt dir ZeroGEX Pro das alles im Advanced Signal Dashboard.
