# Basic Signal Dashboard

*Die sechs kontinuierlichen Messwerte, die in das Composite einfließen — was sie sind, wie man sie liest und wo man tiefer einsteigt.*

---

## Was das Basic Signal Dashboard ist

Das Basic Signal Dashboard ist das **Übersichtsraster** aller sechs Basic-Signale. Jede Karte zeigt den aktuellen Score auf der [-1, +1]-Linie, den Beitrag zum Composite und eine Sparkline.

Basic-Signale sind **kontinuierlich**. Sie lösen keine diskreten Alerts aus — sie schieben das Composite bei jeder Aktualisierung nach oben oder unten.

## Die sechs Signale

| Signal | Was es fragt | Trade-Bias | Composite-Gewicht |
| --- | --- | --- | --- |
| Tape Flow Bias | „In welche Richtung neigt sich das Tape?" | Fortsetzung | 0.08 |
| Skew Delta | „Wie stark ist Angst in die Puts eingepreist?" | Direktionale Lesart | 0.04 |
| Vanna/Charm Flow | „Zwingen Vol oder Zeit die Dealer zum Re-Hedging?" | Fortsetzung | 0.04 |
| Dealer Delta Pressure | „Müssen Dealer dieser Bewegung hinterherlaufen?" | Direktionale Lesart | 0.08 |
| GEX Gradient | „Ist Gamma auf einer Seite konzentriert?" | Direktionale Lesart | 0.08 |
| Positioning Trap | „Steht die Crowd falsch positioniert?" | Mean-Reversion (gegen die Crowd) | 0.06 |

Die Gewichte sind der Anteil am Composite, den jedes Signal beisteuert, wenn der Rest des Universums ruhig ist.

## Kurzlesart zu jedem Signal

### Tape Flow Bias

Lee-Ready-Aggressor-Klassifizierung auf dem Options-Tape. Netto aus Call-Kauf-/Verkaufsprämie und Put-Kauf-/Verkaufsprämie. Positiv = Aggressoren zahlen für die Aufwärtsseite. Ein starkes Signal hier, ohne gegenläufigen GEX Gradient, ist Echtzeit-Überzeugung.

### Skew Delta

Der Spread aus OTM-Put-IV minus OTM-Call-IV gegenüber seiner Baseline. Negative Werte bedeuten, dass Angst eingepreist ist; positive Werte bedeuten, dass Call-Prämie eingepreist ist (Gier). Eher als Stimmungsthermometer nützlich denn als Präzisionssignal.

### Vanna/Charm Flow

Aggregiertes Dealer-Vanna und -Charm. Vanna ist das, was Dealer hedgen, wenn sich die Vol bewegt; Charm ist das, was sie hedgen, während die Zeit verstreicht. Positive Werte bedeuten, dass struktureller Flow höhere Preise stützt; negative das Gegenteil. Charm nimmt zum Handelsschluss hin zu.

### Dealer Delta Pressure

Das Netto-Delta der Dealer aus der Optionskette (call_delta_oi + put_delta_oi). Stark negativ bedeutet, Dealer sind short Delta und werden bei steigenden Kursen kaufen; stark positiv bedeutet, sie sind long und werden bei steigenden Kursen verkaufen. Das Signal fragt: „Müssen Dealer hinterherlaufen?"

### GEX Gradient

Gamma oberhalb des Spot im Vergleich zu Gamma unterhalb des Spot, mit einer ATM-Konzentrationsprüfung. Zeigt, auf welcher Seite des Spot mehr Gamma-Gewicht liegt. Positiver Gradient ⇒ Gamma oberhalb des Spot konzentriert ⇒ struktureller Aufwärts-Pin; negativ ⇒ struktureller Abwärts-Pin.

### Positioning Trap

PCR + vorzeichenbehaftetes Smart-Money-Ungleichgewicht + 5-Bar-Momentum + Flip-Neigung + Regime-Kontext. Fragt, ob die Crowd in die falsche Richtung positioniert ist. **Dies ist ein Mean-Reversion-Signal** — ein hoher positiver Score ist ein „gegen die Stärke verkaufen"-Hinweis, kein „long gehen"-Hinweis.

## Das Dashboard lesen

Drei Muster:

1. **Auf Konfluenz achten.** Wenn drei oder vier der sechs Signale mit nennenswerter Stärke in dieselbe Richtung zeigen, wird sich das im Composite widerspiegeln.
2. **Auf Divergenz achten.** Wenn Tape Flow Bias stark positiv ist, der GEX Gradient aber deutlich negativ, werden Dealer gegen die Käufe faden — das Tape irrt sich darüber, wo der strukturelle Pin liegt.
3. **Positioning Trap gesondert betrachten.** Es ist das einzige Basic-Signal mit Mean-Reversion-Bias. Behandeln Sie eine hohe positive Trap-Lesart bei gleichzeitig stark long stehendem Tape als Warnung, nicht als Bestätigung.

## Was nicht im Basic-Dashboard enthalten ist

Trigger. Keines dieser Signale löst aus. Wer trigger-gesteuerte Alerts sucht, findet sie im [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard).

## Jede Karte hat eine Detailseite

Klicken Sie auf eine beliebige Karte, um zur Einzelsignal-Seite zu gelangen, die Folgendes zeigt:

- Die Score-Sparkline in höherer Auflösung
- Die aktuellen Eingabewerte (die Komponenten, die in den Score einfließen)
- Die Erklärung „Wie es aufgebaut ist"
- Den letzten Verlauf

## Siehe auch

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
