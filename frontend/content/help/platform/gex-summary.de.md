# GEX Summary & Greeks

*Die wichtigsten GEX-Kennzahlen sowie die aggregierten Werte für Delta, Gamma, Vanna und Charm.*

---

## Was diese Seite zeigt

Die Seite GEX Summary ist die **Aggregation pro Greek** des Optionsbuchs. Während Dealer Positioning strukturell ist (Walls, Flip, Profil), liefert diese Seite die Totale in Zahlen: aggregiertes Delta, Gamma, Vanna, Charm und Vega.

## Die fünf wichtigsten Kennzahlen

### Net GEX

Das aggregierte Dealer-Gamma in Dollar. Positiv ⇒ Dealer kaufen bei Schwäche, verkaufen bei Stärke. Negativ ⇒ Dealer jagen dem Preis hinterher. Wird auf Höhe des Spotpreises angezeigt.

### Net DEX

Das aggregierte Dealer-Delta. Stark negativ bedeutet, dass Dealer im Delta short sind und strukturell bei höheren Kursen kaufen müssen.

### Net VEX (Vanna)

Das aggregierte Dealer-Vanna — die Sensitivität des Deltas gegenüber der IV. Positiv bedeutet, dass ein Rückgang der IV die Dealer zum Verkaufen zwingt; ein Anstieg der IV zwingt sie zum Kaufen. Das ist der Motor hinter Tagen mit "Vol-Compression-Grind".

### Net Charm

Das aggregierte Dealer-Charm — die Sensitivität des Deltas gegenüber der Zeit. Positiv stützt strukturell die Drift zum Handelsschluss; negativ wirkt ihr entgegen. Charm-getriebene Flows nehmen in den letzten zwei Handelsstunden zu.

### Net Vega

Das aggregierte Dealer-Vega. Zeigt, wie stark Dealer einer signifikanten IV-Bewegung ausgesetzt sind.

## Die Aufschlüsselung nach Strike

Unterhalb der Totale zeigt die Seite dieselben Zahlen aufgeschlüsselt nach Strike — die Beiträge einzelner Strikes zu Gamma, Delta, Vanna und Charm. Nutze das, wenn:

- Du sehen willst, **welche Strikes** die Headline-Zahl treiben.
- Du bestätigen willst, dass sich der Call Wall tatsächlich dort befindet, wo es das GEX-Profil angibt.
- Du eine Vanna- oder Charm-Konzentration entdecken willst, die im GEX-Profil nicht offensichtlich ist.

## Vorzeichenkonventionen

ZeroGEX verwendet durchgängig die Dealer-Perspektive:

- Positives Gamma ⇒ Dealer sind netto long bei Calls / short bei Puts und hedgen gegen den Preis.
- Positives Delta ⇒ Dealer sind long im Delta.
- Positives Vanna ⇒ Dealer profitieren (deltaseitig), wenn die Volatilität steigt.
- Positives Charm ⇒ Dealer profitieren (deltaseitig), wenn die Zeit verstreicht.

Wenn du einen anderen GEX-Anbieter liest, prüfe unbedingt die Vorzeichenkonvention. Die meisten verwenden dasselbe dealerbasierte Vorzeichen, einige drehen es jedoch um.

## Die Seite richtig lesen

Zwei Muster:

1. **Gegenprüfung mit Dealer Positioning.** Wenn Net GEX deutlich positiv ist, das GEX-Profil aber zeigt, dass die Kurve knapp unter dem Spot ins Negative kippt, befindest du dich genau auf der Regimegrenze — das Risiko ist asymmetrisch.
2. **Vanna und Charm zum Handelsschluss beobachten.** Beide erreichen ihren intraday höchsten Einfluss in den letzten zwei Stunden; der Charm-Beitrag pro Strike zeigt an, wo sich der Pin einpendeln wird.

## Siehe auch

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Vanna und Charm für Optionshändler erklärt](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) erklärt](/education/gamma-exposure-explained)
