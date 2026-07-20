# EOD Pressure Signal erklärt: den Schluss richtig lesen

*Der praxisnahe Deep-Dive zum ZeroGEX EOD Pressure Signal — was es misst, warum der Schluss strukturell driftet, wie sich der Score aus Charm und Pin Gravity zusammensetzt, und wie man ihn innerhalb der letzten 90 Minuten liest.*

---

## Warum es dieses Signal gibt

Die letzten 90 Minuten der Kassa-Sitzung unterscheiden sich strukturell vom Rest des Handelstags. Der Charm-Zerfall bei 0DTE-Positionen zwingt Dealer zu kontinuierlichem Hedging. Die Pin Gravity rund um Strikes mit hohem Gamma verstärkt sich. Das Dealer-Buch ist zu keinem anderen Zeitpunkt der Sitzung so eingeschränkt.

Diese Kräfte sind nicht zufällig. Sie sind gerichtet und lesbar — *wenn* man weiß, worauf man achten muss. Das EOD Pressure Signal existiert, um diese gerichtete Drift in Echtzeit sichtbar zu machen, damit Trader sich mit dem Schlussflow positionieren können, statt gegen ihn zu kämpfen.

Dieser Beitrag ist die trader-orientierte Lesart des EOD Pressure Signals. Er behandelt, was gemessen wird, warum der Schluss anders ist, wie der Score aus Charm und Pin Gravity aufgebaut wird, und wie man ihn innerhalb des Fensters liest. Für den tiefergehenden Beitrag zur kombinierten Methodik, die EOD Pressure mit Trap Detection verbindet, siehe [Trading the Close](/education/eod-pressure-and-trap-detection); für die zugrunde liegende Mechanik behandelt [Vanna and Charm Explained](/education/vanna-and-charm-explained) im Detail, wie Charm forciertes Hedging antreibt.

---

## Was ist das EOD Pressure Signal?

Das EOD Pressure Signal stellt eine einzige Frage:

> In welche Richtung drückt das forcierte Hedging den Preis Richtung Schluss, gegeben das aktuelle Dealer-Buch und die Nähe eines Magnet-Strikes?

Es ist ein **Advanced**-Signal im ZeroGEX-Stack — es liefert sowohl einen kontinuierlichen Score auf der Zahlengeraden [-1, +1] als auch einen diskreten Trigger, wenn der absolute Score **0,20** überschreitet. Die Schwelle liegt bewusst niedriger als bei anderen Advanced-Signalen, weil der strukturelle Kontext (das Schlussfenster) selbst schon ein Filter ist — wenn EOD Pressure innerhalb des aktiven Fensters 0,15+ anzeigt, ist das bereits richtungsweisend.

Trade-Bias: **gerichtete Lesart**. Das Signal zeigt an, in welche Richtung der Druck geht — es schreibt für sich genommen nicht vor, ob man mitreiten oder dagegen faden soll. Das ergibt sich aus dem Regime-Kontext.

---

## Warum der Schluss anders ist

Drei strukturelle Mechanismen verstärken sich gegenseitig im letzten Fenster der Sitzung:

1. **Der Charm-Zerfall beschleunigt sich.** Wenn sich 0DTE-Optionen dem Verfall nähern, driftet ihr Delta vorhersehbar in Richtung 0 oder 1. Dealer, die ein delta-neutrales Buch führen, müssen kontinuierlich nachhedgen, und die Geschwindigkeit dieses Nachhedgens *steigt*, je näher der Schluss rückt.
2. **Die Pin Gravity verstärkt sich.** Strikes mit hohem Gamma ziehen den Preis stärker an, je kürzer die Restlaufzeit wird. In einem Long-Gamma-Regime verstärkt sich der Magnetismus zum nächstgelegenen schweren Strike im Laufe des Nachmittags.
3. **Die Liquidität dünnt aus.** Blockflüsse, End-of-Day-Rebalancing und strukturelle Indexorders verschieben das Flow-Profil von kontinuierlich zu schubweise. Dealer haben weniger Spielraum, um Fehler abzufedern.

EOD Pressure kombiniert die ersten beiden Faktoren zu einer gerichteten Lesart. Der dritte ist implizit in der Kalibrierung des Scores enthalten.

---

## Die vier Kernkomponenten

Das Signal aggregiert vier Komponenten — drei tragen zur Magnitude bei, eine wirkt als harte Sperre.

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

Der Pin-Term bildet den regimeabhängigen Sog des Magnet-Strikes ab:

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

Ein Pin-Target 0,3 % über dem Spot ergibt in einem Positive-Gamma-Regime einen Pin-Score von +1,0 — der Magnet liegt oben, und die Gravitation wirkt. In einem Negative-Gamma-Regime erzeugt derselbe Pin über dem Spot einen *negativen* Pin-Score, weil das Dealer-Hedging jetzt Bewegungen *weg* vom Strike verstärkt.

Dieser Vorzeichenwechsel ist die zentrale Erkenntnis. Pin Gravity ist kein fixes Level. Es ist eine vorzeichenabhängige Kraft, deren Richtung vom Gamma-Regime abhängt.

### Komponente 3: Zeitrampe (die Sperre)

Die Rampe wirkt multiplikativ. Vor **14:30 ET** ist sie exakt null — das gesamte Signal wird kurzgeschlossen.

| Uhrzeit (ET) | Rampe |
|---|---|
| Vor 14:30 | 0,00 |
| 14:30 | 0,00 |
| 14:45 | 0,20 |
| 15:00 | 0,40 |
| 15:30 | 0,80 |
| 15:45 – 16:00 | 1,00 |

Deshalb zeigt EOD Pressure den größten Teil des Handelstags null an. Das Signal ist außerhalb des Fensters strukturell inaktiv.

### Komponente 4: Kalender-Verstärker

Der Verstärker erhöht die Überzeugung an Tagen, an denen sich Positionierung konzentriert:

| Kalender | Amp |
|---|---|
| Normaler Tag | 1,0× |
| Monatlicher OPEX (dritter Freitag) | 1,5× |
| Quad Witching (dritter Freitag in Mär/Jun/Sep/Dez) | 2,0× |

Das ist der einzige Punkt im Signal, an dem der Zwischen-Score ±1 überschreiten kann — die finale Begrenzung bringt ihn wieder in den zulässigen Bereich.

---

## Wie der Score berechnet wird

Die finale Aggregation:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

Die 60/40-Gewichtung spiegelt eine bewusste Haltung wider: **Charm ist das direkte Maß für erzwungenen Hedge-Flow**, während **Pin Gravity der indirekte, regimeabhängige Sog ist**. Beides zählt. Charm führt.

---

## Score-Interpretation

| Score | Lesart |
|---|---|
| +0,6 bis +1,0 | Starke Aufwärtsdrift Richtung Schluss erwartet |
| +0,2 bis +0,6 | Leichte Aufwärtsdrift — Intraday-Bias spricht für Long halten, aber nicht aggressiv aufstocken |
| -0,2 bis +0,2 | Kein Edge — entweder noch zu früh im Fenster, oder die Terme heben sich auf |
| -0,2 bis -0,6 | Leichte Abwärtsdrift |
| -0,6 bis -1,0 | Starke Abwärtsdrift Richtung Schluss erwartet |

Die Trigger-Schwelle liegt bei **0,20** — niedriger als das übliche 0,25 — weil das Fenster selbst schon die Filterung übernimmt.

---

## Wann das Signal auslöst und wann es stumm bleibt

Der dominante Zustand ist **stumm**. Den größten Teil des Handelstags ist EOD Pressure null — und diese Null ist *informativ*, nicht "neutral". Sie bedeutet, dass das aktive Fenster noch nicht begonnen hat.

Das Signal kann auch innerhalb des Fensters null anzeigen, wenn:

- Bei einer dünnen oder schlecht quotierten Options-Chain keine Strikes im vol-skalierten ATM-Band liegen.
- Sowohl `max_pain` als auch `max_gamma_strike` null sind.
- Das Pin-Target genau auf dem Spot liegt.
- Charm- und Pin-Score sich zufällig aufheben — selten, erfordert entgegengesetzte Richtungen und ungefähr gleiche Magnitude.

Eine 0 außerhalb des Fensters ist normal. Eine 0 innerhalb des Fensters ist informativ — *EOD Pressure hat heute nichts beizutragen.*

---

## Was ein Trader damit macht

Drei Workflow-Muster:

### 1. Setup vor dem Fenster

Vor 14:30 ET ist EOD Pressure per Konstruktion null. Nutze die Zeit vor dem Fenster, um zu bestimmen, wie das strukturelle Setup *sein wird*: Wo liegt das Max Gamma, wo der Gamma Flip, in welchem Regime befinden wir uns, wo steht der Spot relativ zum Pin-Target? Wenn das Fenster öffnet, wird das Signal dich nicht überraschen — es wird die Lesart bestätigen oder widerlegen, die du dir bereits erarbeitet hast.

### 2. Der 15:30-Wendepunkt

EOD Pressure überschreitet um 15:30 ET die 0,8×-Rampe. Wenn Charm- und Pin-Term während des frühen Rampenfensters (14:45–15:30) übereingestimmt haben, verdichtet sich die Überzeugung tendenziell um 15:30. Positioniere dich vorher, nicht nachher.

### 3. Quad Witching ist struktureller Kontext

Der 2,0×-Verstärker an Quad-Witching-Tagen ist groß genug, um ein unverstärktes Signal von +0,4 auf verstärkte +0,8 zu heben. Behandle diese Tage als strukturell überzeugungsstärker — und mit strukturell höherem Whipsaw-Risiko früher am Tag, bevor das Fenster öffnet.

---

## EOD Pressure zusammen mit anderen Signalen lesen

EOD Pressure ist eine **gerichtete Lesart** — sie zeigt, wohin der Druck zeigt, ohne für sich genommen mitreiten-versus-faden vorzuschreiben. Die Fade-versus-Ride-Entscheidung kommt aus dem Regime:

- **Positive-Gamma-Regime + positiver EOD-Pressure-Score:** Die Drift geht nach oben, das Dealer-Hedging dämpft — die Lesart spricht dafür, Rallys Richtung Magnet-Strike zu faden, um die Drift zum Pin mitzunehmen.
- **Negative-Gamma-Regime + positiver EOD-Pressure-Score:** Das Signal liest einen charm-getriebenen Aufwärts-Bias, aber in einem Short-Gamma-Regime verstärkt der Dealer-Reflex, statt zu dämpfen — eine Momentum-Fortsetzung ist wahrscheinlicher.

Kombiniert mit anderen Signalen:

- **EOD Pressure + Trap Detection gleiche Richtung:** Das häufigste High-Conviction-Setup. Die EOD-Drift bestätigt einen Fade auf einen gescheiterten Breakout.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) gleiche Richtung:** Zum Schluss hin komprimiert, mit bestätigender charm-getriebener Drift. Starkes Fortsetzungs-Setup.
- **EOD Pressure ≠ 0 innerhalb des Fensters ohne andere aktive Signale:** Die strukturelle Drift ist die einzige Lesart. Kleinere Positionsgröße, als gerichtete Tendenz behandeln, nicht als High-Conviction-Trade.

---

## Häufige Fehllesarten

Drei Fallen:

- **Eine Null vor dem Fenster als "heute kein Signal" interpretieren.** Das Fenster hat noch nicht geöffnet. Das Signal ist *strukturell inaktiv*, nicht informationslos.
- **Den regimeabhängigen Vorzeichenwechsel bei Pin Gravity ignorieren.** Ein schwerer Strike über dem Spot zieht in einem Long-Gamma-Regime *nach oben* und stößt in einem Short-Gamma-Regime *nach unten ab*. Dasselbe Chartlevel bedeutet in den beiden Regimen das Gegenteil.
- **Den Rohscore ohne die Rampe traden.** Ein Wert von +0,4 um 14:45 (Rampe 0,20) entspricht in Wirklichkeit einem effektiven Score von +0,08. Lies die rampenbereinigte Magnitude, nicht den rohen Eingabewert.

---

## Wie ZeroGEX das EOD Pressure Signal darstellt

Das Dashboard zeigt es an mehreren Stellen:

- **Die EOD-Pressure-Karte** zeigt den Live-Score, den Trigger-Status und die Komponenten-Aufschlüsselung (Charm- vs. Pin-Beiträge).
- **Der Composite Signal Score** integriert EOD Pressure als einen Input.
- **Der Trade Stream** markiert `eod_pressure`-gegatete Playbook-Trades, wenn sie auslösen.

*[Bild-Platzhalter: ZeroGEX EOD-Pressure-Karte mit Score, Komponenten und Rampenstatus während des aktiven Fensters — Datei ablegen unter /public/blog/zerogex-eod-pressure-card.png]*

Ein durchgerechnetes Beispiel. Der SPX steht um 15:15 ET an einem monatlichen OPEX-Freitag bei 5.825, und ZeroGEX zeigt:

- **EOD Pressure:** -0,55 (bearish ausgelöst)
- **Net GEX:** +1,2 Mrd. USD (positiv)
- **Gamma Flip:** Spot liegt bei +15 (über dem Flip)
- **Max Pain:** 5.810 (unter Spot)
- **Charm am Spot:** moderat negativ (Verkäufe bauen sich auf)
- **Kalender-Amp:** 1,5× (monatlicher OPEX)

Die strukturelle Lesart: Positive-Gamma-Regime mit einem schweren Magneten 15 Punkte unter dem Spot, charm-getriebenes Hedging zeigt nach unten, und der OPEX-Verstärker erhöht die Überzeugung. Praktische Tendenz: Die Drift Richtung 5.810 ist der wahrscheinlichere Pfad Richtung Schluss. Der Trade ist nicht EOD Pressure selbst — es ist eine Positionierung im Einklang mit der Driftrichtung, mit einer Positionsgröße, die auf die High-Conviction-OPEX-Lesart abgestimmt ist.

---

## Fazit

> EOD Pressure sagt dir, in welche Richtung das forcierte Hedging im Schlussfenster zeigt. Es sagt dir nichts über den Rest des Tages. Genau dieses Schweigen ist der Punkt.

Die Disziplin besteht darin, es als gerichtete Lesart für die letzten 90 Minuten zu nutzen, gegen das Regime abzugleichen, um zwischen Mitreiten und Faden zu entscheiden, und es gegen die anderen Advanced-Signale auf Konfluenz zu validieren. Außerhalb des Fensters solltest du woanders hinschauen.

Nur Bildungsinhalt — nichts davon ist eine Handelsempfehlung.

---

Wenn du die heutige EOD-Pressure-Lesart während des aktiven Fensters in Echtzeit sehen möchtest, zusammen mit Trap Detection und dem Regime-Kontext, zeigt dir das kostenlose ZeroGEX-Dashboard das alles.
