# Net Volume vs Directional Flow: Was zählt im Options-Tape wirklich?

*Die meisten Trader diskutieren Put/Call-Volumen gegen Directional Flow. Profis behandeln das meist als ersten Schritt - und wenden sich dann schnell prämiengewichteten Conviction-Metriken zu.*

---

## Die ehrliche Antwort: Keine der beiden ist allein der Goldstandard

Wer die eine perfekte Kennzahl sucht, wird enttäuscht.

**Cumulative Net Volume** und **Cumulative Net Directional Volume** sind beide nützlich, beantworten aber unterschiedliche Fragen. Ernstzunehmende Flow-Desks beobachten in der Regel beide - legen das größte Gewicht beim Einschätzen der Conviction aber auf Premium-Metriken.

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

Wenn Trader den Ask heben, drücken sie oft Dringlichkeit oder gerichtete Absicht aus. Wenn sie den Bid treffen, reduzieren sie oft Risiko, vereinnahmen Prämie oder faden die Bewegung. Die Seite allein verrät aber noch nicht die *Motivation* - ein Dealer, der ein bestehendes Buch hedgt, kann den Ask genauso heben wie ein Spekulant, und dieser Hedge-Trade erscheint genauso im Tape.

Theoretisch macht das Directional Volume informativer als das reine Volumen.

Aber es hat eine echte Schwäche: **Die Klassifizierung der Trade-Seite ist unvollkommen.**

Die meisten Systeme leiten die Käufer-/Verkäuferabsicht aus der Nähe zu Bid/Ask ab. Das versagt, wenn:
- Blöcke nahe dem Mid gedruckt werden,
- verhandelte Crosses abseits des Bildschirms stattfinden,
- oder Dark-/Complex-Ausführungen sich nicht sauber auf lit Quotes abbilden lassen.

Ironischerweise sind diese „unordentlichen“ Trades oft die bedeutsamsten institutionellen Prints.

---

## Worauf professionelle Flow-Teams tatsächlich Wert legen

### Premium, nicht Kontrakte.

Ein 50.000-Lot in billigen wöchentlichen Lottery-Calls kann im Volumen riesig wirken, stellt aber nur bescheidenes Kapital dar. Ein 500-Lot in tief im Geld liegenden Kontrakten kann dramatisch mehr Nominalrisiko und Information tragen.

Deshalb priorisieren Desks tendenziell **kapitalgewichteten Flow**, nicht Kontraktzahlen.

Dein Feld:

**Cumulative Net Premium**

`= (calls bought premium − calls sold premium) − (puts bought premium − puts sold premium)`

misst die tatsächlich umgesetzten Dollar und kann Kontext über die Kontraktzahl hinaus liefern. Die Kennzahl belegt nicht, ob ein Trade informiert, gerichtet, eröffnend oder spekulativ ist.

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

- Beginne mit **Net Volume**, um die breite Beteiligung zu lesen.
- Bestätige mit **Net Directional Volume**, um die Aggressor-Absicht abzuschätzen.
- Validiere mit **Net Directional Premium**, bevor du Risiko eingehst.
- Wenn Volumen und Premium sich widersprechen, vertrau den Dollar vor den Kontrakten.

Kein einzelnes Panel sollte deinen gesamten Entscheidungsbaum steuern. Aber ZeroGEX nutzt die prämiengewichtete Aggressor-Klassifizierung als einen Input im Workflow, nicht als universelles Ranking von Flow-Kennzahlen. Die Aggressor-Seite schätzt, wer über den Spread gegangen ist; sie verrät nicht, ob eröffnet oder glattgestellt wurde, und auch nicht die vollständige Strategie, den endgültigen Eigentümer oder einen Informationsvorsprung.
