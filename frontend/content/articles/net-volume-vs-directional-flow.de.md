# Net Volume vs Directional Flow: Was im Options-Tape wirklich zählt
> **Aktualisierter Methodikhinweis — er hat Vorrang vor abweichenden Formulierungen weiter unten.** ZeroGEX schätzt Dealerbestände aus öffentlichen Daten; es beobachtet sie nicht. Das Modell behält die Call-positiv/Put-negativ-Konvention bei (`Net GEX = Call GEX − Put GEX`) und unterstellt Dealer netto long Calls und netto short Puts. Long Calls und Long Puts haben positives Gamma; Short Calls und Short Puts negatives Gamma. Die Put Wall ist die größte Put-Gamma-Konzentration unter Spot und lokal modelliertes negatives Dealer-Gamma: Sie kann mit Unterstützung zusammenfallen, doch das Hedging eines Short Puts erzeugt keinen mechanischen Boden. Walls können sich durch Spot, Zeit und implizite Volatilität verschieben, obwohl das offizielle Open Interest intraday unverändert bleibt. Nahe Verfall konzentriert sich Gamma am Geld; ATM-Gamma kann steigen, während deutlich ITM- oder OTM-Gamma gegen null geht. Der ausgewählte Gamma Flip ist ein lokaler Übergang; ein Profil kann mehrere oder keine aussagekräftige Kreuzung haben. Charm und Vanna sind bedingte Deltaänderungen, keine geplanten Orders. Signalwerte sind heuristische Modellergebnisse, keine kalibrierten Wahrscheinlichkeiten. Negatives Gamma verstärkt die bereits laufende Richtung; die Entfernung zu einem Ziel impliziert keine Abstoßung. Die Vorzeichenumkehr des EOD-Pressure-Pin-Terms bleibt daher eine ZeroGEX-Heuristik. Max Pain minimiert die aggregierte intrinsische Auszahlung und maximiert nicht exakt den wertlos verfallenden Nominalwert. Rohes DEX misst Optionsdelta, nicht künftigen Hedge-Flow; Prämie und Aggressorseite beweisen weder Information noch Eröffnung oder Überzeugung.


*Die meisten Trader diskutieren Put/Call-Volumen gegen Directional Flow. Profis behandeln das meist als ersten Schritt – und wenden sich dann schnell prämiengewichteten Conviction-Metriken zu.*

---

## Die ehrliche Antwort: Keine der beiden ist allein der Goldstandard

Wer die eine perfekte Kennzahl sucht, wird enttäuscht.

**Cumulative Net Volume** und **Cumulative Net Directional Volume** sind beide nützlich, beantworten aber unterschiedliche Fragen. Ernstzunehmende Flow-Desks beobachten in der Regel beide – legen das größte Gewicht beim Einschätzen der Conviction aber auf Premium-Metriken.

---

## Kennzahl 1: **Cumulative Net Volume**

*(Call Volume − Put Volume)*

Dies ist im Grunde die umgekehrte Betrachtung der klassischen Put/Call-Ratio.

Sie wird breit genutzt, weil sie einfach, schnell und überall verfügbar ist. Aber sie ist auch grob.

Die zentrale Schwäche: **Sie sagt nicht, wer den Trade initiiert hat oder warum.**

Ein Anstieg im Call-Volumen kann bedeuten:
- gerichtete Aufwärtsspekulation,
- Covered-Call-Overwriting,
- Dealer-Inventarmanagement,
- oder Hedge-Roll-Aktivität.

Volumen allein kann Conviction nicht von Mechanik trennen.

---

## Kennzahl 2: **Cumulative Net Directional Volume**

*((Calls Bought − Calls Sold) − (Puts Bought − Puts Sold))*

Diese Kennzahl versucht, die bessere Frage zu beantworten:

> **Wer war der Aggressor?**

Wenn Trader den Ask heben, drücken sie meist Dringlichkeit und gerichtete Absicht aus. Wenn sie den Bid treffen, reduzieren sie meist Risiko, vereinnahmen Prämie oder faden die Bewegung.

Theoretisch macht das Directional Volume informativer als das reine Volumen.

Aber es hat eine echte Schwäche: **Die Klassifizierung der Trade-Seite ist unvollkommen.**

Die meisten Systeme leiten die Käufer-/Verkäuferabsicht aus der Nähe zu Bid/Ask ab. Das versagt, wenn:
- Blöcke nahe dem Mid gedruckt werden,
- verhandelte Crosses abseits des Bildschirms stattfinden,
- oder Dark-/Complex-Ausführungen sich nicht sauber auf lit Quotes abbilden lassen.

Ironischerweise sind diese „unordentlichen" Trades oft die bedeutsamsten institutionellen Prints.

---

## Worauf professionelle Flow-Teams tatsächlich Wert legen

### Premium, nicht Kontrakte.

Ein 50.000-Lot in billigen wöchentlichen Lottery-Calls kann im Volumen riesig wirken, stellt aber nur bescheidenes Kapital dar. Ein 500-Lot in tief im Geld liegenden Kontrakten kann dramatisch mehr Nominalrisiko und Information tragen.

Deshalb priorisieren Desks tendenziell **kapitalgewichteten Flow**, nicht Kontraktzahlen.

Ihr Feld:

**Cumulative Net Premium**

`= (calls bought premium − calls sold premium) − (puts bought premium − puts sold premium)`

ist im Allgemeinen die stärkere Einzelablesung dafür, wohin sich informiertes Geld neigt, weil sie tatsächlich eingesetzte Dollar widerspiegelt.

---

## Praktisches Ranking für Conviction

Wenn das Ziel die Qualität der gerichteten Conviction ist:

1. **Net Directional Premium** (bestes Einzelsignal)
2. **Net Directional Volume** (besser als reines Volumen)
3. **Net Volume** (nützlicher Kontext, allein am schwächsten)

Oder in einem Satz:

> **Net Directional Volume schlägt Net Volume bei der Conviction, aber Net Directional Premium ist das, worauf ernsthafte Flow-Desks meist am meisten Gewicht legen.**

---

## Wie man das im Live-Workflow nutzt

Eine praktische Abfolge, die Trader intraday anwenden können:

- Beginnen Sie mit **Net Volume**, um die breite Beteiligung zu lesen.
- Bestätigen Sie mit **Net Directional Volume**, um die Aggressor-Absicht abzuschätzen.
- Validieren Sie mit **Net Directional Premium**, bevor Sie Risiko eingehen.
- Wenn Volumen und Premium widersprechen, vertrauen Sie den Dollar vor den Kontrakten.

Kein einzelnes Panel sollte Ihren gesamten Entscheidungsbaum steuern. Aber prämiengewichteter Directional Flow hält Sie in der Regel näher am Signal des „informierten Geldes" und weiter weg von lauten Schlagzeilen-Prints.
