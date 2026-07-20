# Technicals

*Der Intraday-Technical-Snapshot — Preis, Kerzen, Volatilitätsanzeigen und wie die Levels sich mit den GEX-Wänden überlagern.*

---

## Was diese Seite zeigt

Die Technicals-Seite ist die **price-first**-Lesart des aktiven Symbols. Sie ist die einzige Seite, die **nicht** mit optionsbasierten Kennzahlen beginnt — sie startet mit Preisverlauf, Volatilität und dem klassischen technischen Kontext.

Das ist die Seite, die du öffnest, wenn du prüfen willst, was das Dealer-Positioning nahelegt im Verhältnis zu dem, was der Preis tatsächlich tut.

## Der Candle-Chart

Der Hauptchart. Standard-OHLC-Kerzen mit Timeframe-Auswahl (1m / 5m / 15m / 1h / 1d). Overlays:

- **VWAP** (verankert am Session-Open).
- **Der gamma flip** als horizontale Linie.
- **Call wall und put wall** als horizontale Linien.
- **Max pain** als horizontale Linie (wo relevant).

Der Zweck der Overlays ist es, dir zu ermöglichen, die Preisbewegung durch die Linse des Dealer-Positioning zu lesen, ohne zwischen Tabs wechseln zu müssen.

## Die Volatilitätsanzeigen

Drei Anzeigen:

- **Implied Volatility** — aktuelle ATM-IV mit dem Rang gegenüber den letzten 60 Tagen.
- **Realized Volatility** — realisierte Volatilität über ein kurzes Fenster mit einer Baseline über ein längeres Fenster.
- **IV / RV-Verhältnis** — wenn das Verhältnis deutlich über 1 liegt, ist die Vol teuer (Prämie verkaufen); darunter ist die Vol günstig (Prämie kaufen).

## Der Session-Streifen

Ein kleiner Streifen, der zeigt:

- Die aktuelle Session (Pre-market, Open, After-hours, Closed)
- Den Session-Eröffnungskurs
- Session-Hoch und -Tief
- Den Abstand vom Spot zum VWAP
- Die Zeit bis zum nächsten wichtigen Session-Ereignis (Open, Mittagspause, Close)

## So liest du sie

Drei Muster:

1. **Preis zwischen call wall und put wall gefangen** in positivem Gamma ⇒ Mean-Reversion innerhalb der Range. Die Technicals bestätigen die Range; die Dealer-Seite erklärt dir das Warum.
2. **Preis bricht unter die put wall** in negativem Gamma bei steigender IV ⇒ Trendfortsetzung. Die Technicals zeigen den Bruch; die Dealer-Seite erklärt die Verstärkung.
3. **VWAP und der gamma flip stapeln sich auf demselben Level** ⇒ struktureller Pivot. Reaktionen an diesem Level haben eine höhere Überzeugungskraft als an einem der beiden allein.

## Die Intraday-Tools-Ansicht

Die Intraday-Tools-Seite ist ein gepaartes Layout — der Candle-Chart oben, ein komprimierter Dealer-Positioning-Header darunter — für Trader, die beide Ansichten nebeneinander sehen wollen.

## Siehe auch

- [Das Dashboard lesen](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip)
