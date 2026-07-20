# SPX Net Gamma Exposure heute: So liest du das aktuelle Net GEX

*"Wie hoch ist die aktuelle Net Gamma Exposure von SPX?" Die Zahl ändert sich jede Session — aber wie man sie liest, bleibt gleich. Hier erfährst du, was das Net GEX von SPX ist, wie du eine positive von einer negativen Lesart unterscheidest, wo der Zero-Cross liegt und wie du den aktuellen Live-Wert abrufst.*

---

## Wo du die heutige SPX Net Gamma Exposure findest

Wenn du hier bist, um die aktuelle Zahl zu sehen: ZeroGEX veröffentlicht das heutige **SPX Net GEX** — inklusive Gamma Flip, Call Wall, Put Wall und Max Pain — kostenlos und mit rund 15 Minuten Verzögerung auf der [SPX-Gamma-Levels-Seite](/spx-gamma-levels). Dieselbe Auswertung gibt es auch für [SPY](/spy-gamma-levels) und [QQQ](/qqq-gamma-levels). Für den live, sekundengenau aktualisierten Wert sorgt das [Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte), das während der gesamten Session aktualisiert wird. Der Rest dieser Seite erklärt, was diese Zahl bedeutet und wie du sie nutzt.

---

## Was ist die SPX Net Gamma Exposure?

Die **Net Gamma Exposure (Net GEX)** für SPX ist die Summe der Dealer-Gamma über die gesamte Optionskette des S&P 500, verdichtet auf eine einzige vorzeichenbehaftete Dollarzahl — oft auch "Dollar Gamma" genannt. Sie schätzt, wie viel S&P-Index-Exposure Options-Dealer mechanisch kaufen oder verkaufen müssen, um abgesichert zu bleiben, während sich SPX bewegt.

- Das **Vorzeichen** verrät das Regime: positiv bedeutet, dass Dealer Bewegungen dämpfen, negativ bedeutet, dass sie sie verstärken.
- Die **Größenordnung** (z. B. +$1.5B, −$800M) zeigt, wie viel erzwungenes Hedging im Markt steckt — wie stark sich das Regime voraussichtlich auswirken wird.

Net GEX ist die zentrale Kennzahl im übergeordneten [Gamma-Exposure](/education/what-is-gex-in-trading)-Framework. Sie wird zum aktuellen Spotpreis berechnet, bewegt sich also mit SPX und mit der Neubewertung der Optionskette im Tagesverlauf.

---

## So liest du die aktuelle Net-GEX-Lesart

Zwei Fälle, entgegengesetzte Spielpläne:

- **Positives SPX Net GEX (Long-Gamma-Regime).** Dealer sind am Spot netto long Gamma. Sie verkaufen Rallyes und kaufen Dips zur Absicherung, was Volatilität *unterdrückt*. Erwarte engere Ranges, Mean Reversion, Pinning an schwer gewichtete Strikes und Rallyversuche, die nahe der Call Wall ins Stocken geraten. Eine stark positive Lesart signalisiert einen "ruhigen, seitwärts laufenden" Markt.
- **Negatives SPX Net GEX (Short-Gamma-Regime).** Dealer sind am Spot netto short Gamma. Sie kaufen Rallyes und verkaufen Dips, was Volatilität *verstärkt*. Erwarte breitere Ranges, sich fortsetzende Ausbrüche und laufende Trends. Eine stark negative Lesart signalisiert einen "schnellen, trendstarken Markt, bei dem man seine Stops respektieren sollte." Das ist [was negatives Gamma bedeutet](/education/what-is-negative-gamma) für den Markt.

Die Lesart ist keine Richtung — sie ist ein *Charakter*. Positives Net GEX sagt nicht "aufwärts," sondern "klebrig." Negatives sagt nicht "abwärts," sondern "volatil."

---

## Der Zero-Cross: Net GEX und der Gamma Flip

Der meistbeachtete Moment ist der **Zero-Cross** — der Punkt, an dem Net GEX die Nulllinie durchquert. Dieser Preis ist der [Gamma Flip](/education/how-to-read-a-gamma-flip): darüber sind Dealer typischerweise netto long Gamma (positiv), darunter netto short (negativ).

Wenn Trader nach "SPX net gamma exposure zero cross" suchen, meinen sie genau das — die Regimelinie. Das Beobachten von Net GEX relativ zu null und von Spot relativ zum Flip ist dieselbe Lesart aus zwei Blickwinkeln:

- Spot deutlich über dem Flip bei stark positivem Net GEX → tief im beruhigenden Regime.
- Spot nahe am Flip bei Net GEX nahe null → ein instabiler, unruhiger Markt, der in beide Richtungen kippen kann.
- Spot unter dem Flip bei negativem Net GEX → das verstärkende Regime hat die Kontrolle.

---

## Warum das SPX-0DTE-Buch die heutige Zahl bewegt

SPX wird inzwischen von taggleichen (0DTE) Verfallsterminen dominiert, was das Net GEX ungewöhnlich *lebendig* macht. Taggleiche Kontrakte tragen direkt am Geld enorme Gamma, die bis zum Handelsschluss auf null zerfällt. Die aktuelle SPX-Net-GEX-Lesart kann daher innerhalb einer einzigen Session deutlich schwanken, während sich 0DTE-Positionierung am Morgen aufbaut und im Laufe des Nachmittags abbaut.

Praktische Konsequenz: Eine Net-GEX-Zahl von vor drei Stunden kann bereits veraltet sein. Bei SPX zählt die *aktuelle* Lesart mehr als bei langsameren Büchern mit längeren Laufzeiten — genau deshalb lohnt es sich, den Live-Wert abzurufen, statt sich auf einen Morgen-Snapshot zu verlassen. Für den Kontext zur Dealer-Positionierung hinter der Intraday-Schwankung siehe [0DTE-Dealer-Positionierung erklärt](/education/0dte-dealer-positioning-explained).

---

## So nutzt du die Lesart in deiner Session

1. **Starte mit der Zahl.** Prüfe vor deinem ersten Trade, ob das SPX Net GEX positiv oder negativ ist und wie groß es ist. Das legt den Spielplan für den Tag fest.
2. **Finde den Zero-Cross.** Markiere den Gamma Flip. Wisse, ob der Spot darüber oder darunter liegt und um wie viel.
3. **Passe die Taktik an das Vorzeichen an.** Positiv → Fades, Range-Trades und Geduld nahe den Walls. Negativ → Momentum, Ausbrüche und engeres Risiko.
4. **Prüfe im Tagesverlauf erneut.** Da sich das 0DTE-Buch verändert, wirf nach dem Morgen und rund um die letzte Handelsstunde noch einmal einen Blick auf die aktuelle Lesart.

---

## Fazit

> Die SPX Net Gamma Exposure ist eine einzige vorzeichenbehaftete Zahl, die dir sagt, ob Dealer die heutige Bewegung dämpfen oder verstärken. Lies zuerst das Vorzeichen, beobachte es relativ zum Zero-Cross, und denke daran: Das 0DTE-lastige SPX-Buch hält die Zahl ständig in Bewegung — hol dir also den *aktuellen* Wert und verlasse dich nicht auf den von heute Morgen.

Nur zu Bildungszwecken — nichts davon ist eine Handelsempfehlung.

---

Willst du das live sehen? Prüfe das heutige SPX Net GEX auf der kostenlosen [SPX-Gamma-Levels-Seite](/spx-gamma-levels) (auch [SPY](/spy-gamma-levels) und [QQQ](/qqq-gamma-levels)), vertiefe dein Wissen mit [Gamma Exposure Explained](/education/gamma-exposure-explained), oder öffne das [Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte) — [starte eine kostenlose Testphase](/register) für die live, sekundengenaue Lesart.
