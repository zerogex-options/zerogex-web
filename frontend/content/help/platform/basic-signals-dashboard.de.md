# Basic Signal Dashboard

*Die sechs kontinuierlichen Messwerte, die neben dem Composite stehen - was sie sind, wie man sie liest und wo man tiefer einsteigt.*

---

## Was das Basic Signal Dashboard ist

Das Basic Signal Dashboard (Basic und Pro) ist die **Übersicht** aller sechs Basic-Signale. Eine Leiste oben zeigt alle sechs Scores auf einen Blick. Darunter liegen drei Tabs:

- **Signal Grid** - eine Karte pro Signal mit dem Score auf der Linie von -100 bis +100, einer Sparkline, einer einzeiligen Beschreibung und **Context values**, die du ausklappen kannst, um die Inputs hinter dem Score zu sehen.
- **Confluence Matrix** - wie oft jedes Signalpaar in der Richtung übereingestimmt oder sich widersprochen hat.
- **Event Timelines** - der jüngste Score-Verlauf jedes Signals, mit markierten Richtungswechseln.

Basic-Signale sind **kontinuierlich** und **beratend**. Sie lösen keine diskreten Alerts aus und haben **kein Gewicht im Composite Score (MSI)** - eine Bewegung hier bewegt den MSI nicht. Nutze sie als frühe Gegenprobe: Wenn die Flow-Lesarten von den Struktur-Lesarten abweichen, ist oft schon ein Regimewechsel im Gang, bevor der MSI reagiert.

Eine Karte, deren Score ±25 überschreitet, wird umrandet und als *Triggered* markiert; darunter zeigt sie *Stand by*. Auf diesem Dashboard hebt das eine starke Lesart hervor - es ist kein Trigger-Ereignis.

## Die sechs Signale

| Signal | Was es fragt | Trade-Bias |
| --- | --- | --- |
| Tape Flow Bias | „In welche Richtung neigt sich das Tape?" | Fortsetzung |
| Skew Delta | „Wie stark ist Angst in die Puts eingepreist?" | Direktionale Lesart |
| Vanna/Charm Flow | „Könnten Vol oder Zeit die Dealer zum Re-Hedging bewegen?" | Fortsetzung |
| Dealer Delta Pressure | „Müssen Dealer dieser Bewegung hinterherlaufen?" | Direktionale Lesart |
| GEX Gradient | „Ist Gamma auf einer Seite konzentriert?" | Direktionale Lesart |
| Positioning Trap | „Steht die Crowd falsch positioniert?" | Mean-Reversion (gegen die Crowd) |

Keines der sechs fließt in den Composite Score ein. Die einzige Überschneidung: Der MSI hat eine eigene Komponente Dealer Delta Pressure, die auf derselben Lesart des Dealer-Netto-Deltas beruht wie das Basic-Signal.

## Kurzlesart zu jedem Signal

### Tape Flow Bias

Lee-Ready-Aggressor-Klassifizierung auf dem Options-Tape. Netto aus Call-Kauf-/Verkaufsprämie und Put-Kauf-/Verkaufsprämie. Positiv = Aggressoren zahlen für die Aufwärtsseite. Ein starkes Signal hier, ohne gegenläufigen GEX Gradient, ist Echtzeit-Überzeugung.

### Skew Delta

Der Spread aus OTM-Put-IV minus OTM-Call-IV gegenüber seiner Baseline, vorzeicheninvertiert, damit der Score direktional lesbar ist: Negative Werte bedeuten, dass Angst eingepreist ist (Put-Skew teuer); positive Werte bedeuten, dass Call-Prämie eingepreist ist (Gier). Eher als Stimmungsthermometer nützlich denn als Präzisionssignal.

### Vanna/Charm Flow

Aggregiertes Dealer-Vanna und -Charm. Vanna modelliert, was Dealer *möglicherweise* hedgen, wenn sich die Vol bewegt; Charm modelliert die Delta-Drift durch das Verstreichen der Zeit (bei konstantem Spot und konstanter IV). Ein positiver Wert modelliert Hedge-Flow, der höhere Preise stützen *kann*; ein negativer das Gegenteil - Richtung und Größe hängen weiterhin von der Zusammensetzung des Buchs ab und davon, wer die Optionen hält. Charm-Druck baut sich tendenziell zum Handelsschluss hin auf.

### Dealer Delta Pressure

Das Netto-Delta der Dealer aus der Optionskette (call_delta_oi + put_delta_oi) - eine eigene modellierte Lesart, getrennt vom Gamma. Der Score ist invertiert: Ein stark **positiver** Score modelliert Dealer short Delta, die *tendenziell* in eine Rally hinein kaufen würden, um abgesichert zu bleiben (bullische Tendenz); ein stark **negativer** Score modelliert sie long Delta, tendenziell in Rallys hinein verkaufend (bärische Tendenz). Das Signal fragt: „Werden Dealer dieser Bewegung wahrscheinlich hinterherjagen?"

### GEX Gradient

Gamma oberhalb des Spot im Vergleich zu Gamma unterhalb des Spot, mit einer Prüfung, wie viel davon in den weit aus dem Geld liegenden Wings sitzt (viel Wing-Gamma senkt die Zuversicht). Zeigt, auf welcher Seite des Spot mehr modelliertes Gamma-Gewicht liegt, und die Lesart hängt vom Regime ab:

- Sind die Dealer als **short Gamma** modelliert, ergibt mehr Gamma oberhalb des Spot einen **positiven** Score (Dealer würden einer Rally hinterherjagen) und mehr Gamma unterhalb einen negativen (sie würden einem Abverkauf hinterherjagen).
- Sind sie als **long Gamma** modelliert, kippt die Lesart und wird gedämpft: Mehr Gamma unterhalb des Spot ergibt einen positiven Score (ein stützender Boden), mehr oberhalb einen negativen (Widerstand darüber).

Die Tendenz setzt voraus, dass das modellierte Vorzeichen des Dealer-Gammas gilt.

### Positioning Trap

PCR + vorzeichenbehaftetes Smart-Money-Ungleichgewicht + 5-Bar-Momentum + Flip-Neigung + Regime-Kontext. Fragt, ob die Crowd falsch positioniert ist - und es fadet die Crowd, nicht den Preis. Ein hoher **positiver** Score kennzeichnet eine short-geneigte Crowd (viele Puts), die nach oben herausgesqueezt werden kann - ein Aufwärts-Short-Cover-Squeeze; ein hoher **negativer** Score kennzeichnet eine long-geneigte Crowd (viele Calls), die für einen **Abwärts**-Flush anfällig ist. Das Vorzeichen ist als Squeeze-/Flush-Richtung zu lesen, nicht als schlichter „long/short gehen"-Hinweis.

## Das Dashboard lesen

Drei Muster:

1. **Auf Konfluenz achten.** Wenn drei oder vier der sechs Signale mit nennenswerter Stärke in dieselbe Richtung zeigen, ist das Überzeugung. Der Tab **Confluence Matrix** zeigt, welche Paare übereingestimmt haben.
2. **Auf Divergenz achten.** Wenn Tape Flow Bias stark positiv ist, der GEX Gradient aber deutlich negativ, stemmt sich die modellierte Dealer-Positionierung gegen die Käufe - das Tape irrt sich womöglich darüber, wo der strukturelle Pin liegt. Flow-Lesarten, die von Struktur-Lesarten abweichen, sind genau die Frühwarnung, für die diese Seite gebaut ist.
3. **Positioning Trap gesondert betrachten.** Es ist das einzige Basic-Signal mit Mean-Reversion-Bias. Eine hohe **negative** Trap-Lesart (eine long-geneigte Crowd, der ein Abwärts-Flush droht) bei gleichzeitig stark long stehendem Tape ist eine Warnung, keine Bestätigung - die Crowd, der sich das Tape anschließt, ist genau die, die die Trap als falsch positioniert markiert.

## Was nicht im Basic-Dashboard enthalten ist

Trigger-Regeln. Keines dieser Signale löst aus - die Markierung *Triggered* kennzeichnet nur einen Score jenseits von ±25. Wer trigger-gesteuerte Signale sucht, findet sie im [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard), das zu Pro gehört.

## Jede Karte hat eine Detailseite

Klicken Sie auf eine beliebige Karte (oder wählen Sie das Signal in der Seitenleiste unter Basis-Signal-Dashboard), um die Einzelsignal-Seite zu öffnen, die Folgendes zeigt:

- Den Score mit einer einzeiligen Deutung und einer ausklappbaren Score-Historie
- Die aktuellen Eingabewerte (die Komponenten, die in den Score einfließen)
- Die Erklärung "How it's built"
- Die Event Timeline - den jüngsten Score-Verlauf mit markierten Richtungswechseln

## Siehe auch

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
