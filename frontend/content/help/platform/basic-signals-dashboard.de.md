# Basic Signal Dashboard

*Die sechs kontinuierlichen Messwerte, die in das Composite einfließen — was sie sind, wie man sie liest und wo man tiefer einsteigt.*

---

## Was das Basic Signal Dashboard ist

Das Basic Signal Dashboard ist das **Übersichtsraster** aller sechs Basic-Signale. Jede Karte zeigt den aktuellen Score auf der [-1, +1]-Linie, den Beitrag zum Composite und eine Sparkline.

Basic-Signale sind **kontinuierlich**. Sie lösen keine diskreten Alerts aus — sie schieben das Composite bei jeder Aktualisierung nach oben (Richtung Trend) oder nach unten (Richtung Chop).

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

Der Spread aus OTM-Put-IV minus OTM-Call-IV gegenüber seiner Baseline, vorzeicheninvertiert, damit der Score direktional lesbar ist: Negative Werte bedeuten, dass Angst eingepreist ist (Put-Skew teuer); positive Werte bedeuten, dass Call-Prämie eingepreist ist (Gier). Eher als Stimmungsthermometer nützlich denn als Präzisionssignal.

### Vanna/Charm Flow

Aggregiertes Dealer-Vanna und -Charm. Vanna modelliert, was Dealer *möglicherweise* hedgen, wenn sich die Vol bewegt; Charm modelliert die Delta-Drift durch das Verstreichen der Zeit (bei konstantem Spot und konstanter IV). Ein positiver Wert modelliert Hedge-Flow, der höhere Preise stützen *kann*; ein negativer das Gegenteil — Richtung und Größe hängen weiterhin von der Zusammensetzung des Buchs ab und davon, wer die Optionen hält. Charm-Druck baut sich tendenziell zum Handelsschluss hin auf.

### Dealer Delta Pressure

Das Netto-Delta der Dealer aus der Optionskette (call_delta_oi + put_delta_oi) — eine eigene modellierte Lesart, getrennt vom Gamma. Stark negativ modelliert Dealer short Delta, die *tendenziell* höher kaufen würden, um abgesichert zu bleiben; stark positiv modelliert sie long und tendenziell höher verkaufend. Das Signal fragt: „Werden Dealer dieser Bewegung wahrscheinlich hinterherjagen?"

### GEX Gradient

Gamma oberhalb des Spot im Vergleich zu Gamma unterhalb des Spot, mit einer ATM-Konzentrationsprüfung. Zeigt, auf welcher Seite des Spot mehr modelliertes Gamma-Gewicht liegt. Positiver Gradient ⇒ mehr Gamma unterhalb des Spot ⇒ ein modellierter stützender Boden (bullische Tendenz, sofern die Dealer dort long Gamma sind); negativ ⇒ mehr Gamma oberhalb des Spot ⇒ abwärtsverstärkende Tendenz. Die Tendenz setzt voraus, dass das modellierte Vorzeichen des Dealer-Gammas gilt.

### Positioning Trap

PCR + vorzeichenbehaftetes Smart-Money-Ungleichgewicht + 5-Bar-Momentum + Flip-Neigung + Regime-Kontext. Fragt, ob die Crowd falsch positioniert ist — und es fadet die Crowd, nicht den Preis. Ein hoher **positiver** Score kennzeichnet eine short-geneigte Crowd (viele Puts), die nach oben herausgesqueezt werden kann — ein Aufwärts-Short-Cover-Squeeze; ein hoher **negativer** Score kennzeichnet eine long-geneigte Crowd (viele Calls), die für einen **Abwärts**-Flush anfällig ist. Das Vorzeichen ist als Squeeze-/Flush-Richtung zu lesen, nicht als schlichter „long/short gehen"-Hinweis.

## Das Dashboard lesen

Drei Muster:

1. **Auf Konfluenz achten.** Wenn drei oder vier der sechs Signale mit nennenswerter Stärke in dieselbe Richtung zeigen, bewegt sich das Composite entsprechend in Richtung eines Trend- oder Chop-Regimes.
2. **Auf Divergenz achten.** Wenn Tape Flow Bias stark positiv ist, der GEX Gradient aber deutlich negativ, werden Dealer gegen die Käufe faden — das Tape irrt sich darüber, wo der strukturelle Pin liegt.
3. **Positioning Trap gesondert betrachten.** Es ist das einzige Basic-Signal mit Mean-Reversion-Bias. Eine hohe **negative** Trap-Lesart (eine long-geneigte Crowd, der ein Abwärts-Flush droht) bei gleichzeitig stark long stehendem Tape ist eine Warnung, keine Bestätigung — die Crowd, der sich das Tape anschließt, ist genau die, die die Trap als falsch positioniert markiert.

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
