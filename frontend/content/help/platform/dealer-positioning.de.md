# Dealer Positioning

*Die vollständige GEX-Oberfläche — Net GEX am Spot, der Gamma Flip, Call Wall und Put Wall, sowie das Lesen der Term Structure.*

---

## Was diese Seite zeigt

Die Dealer-Positioning-Seite ist die **strukturelle Landkarte** des Optionsbuchs. Jedes Chart und jede Kachel beantwortet eine einzige Frage: Wo sind die Dealer positioniert, und was werden sie tun müssen, wenn sich der Preis bewegt?

Sie ist die wichtigste Seite, um den Kontext zu verstehen — auch wenn der eigentliche Trade anderswo ausgeführt wird.

## Die Haupt-Kacheln

### Net GEX am Spot

Der Dollar-Gamma-Wert aller offenen Optionen, vorzeichenbehaftet nach Dealer-Position, ausgewertet **zum aktuellen Spotpreis**. Positiv ⇒ Dealer sind netto long Gamma; negativ ⇒ Dealer sind netto short.

Die hier angezeigte Zahl wird am Spot gemessen, nicht über die gesamte Kette summiert — das ist wichtig, weil das Vorzeichen am Spot das Dealer-Verhalten jetzt gerade bestimmt, unabhängig davon, was die kumulative Kurve bei anderen Preisen macht.

### Gamma Flip

Der Strike, an dem die Dealer-Gamma-Kurve die Nulllinie kreuzt. Der Flip ist die Regime-Grenze: darüber wirkt Hedging stabilisierend, darunter verstärkend. Die Kachel zeigt sowohl den absoluten Strike als auch den prozentualen Abstand zum Spot.

### Call Wall / Put Wall

Die Strikes mit dem größten Call Gamma bzw. Put Gamma. Sie fungieren tendenziell als intraday Widerstand bzw. Unterstützung. Dass die Wall wirklich als „Wand" wirkt, ist bei positivem Gamma zuverlässiger.

### Max Pain

Der Strike, bei dem die Gesamtauszahlung an Optionskäufer minimal ist. Am relevantesten in den letzten 24–48 Stunden vor einem bedeutenden Verfall.

## Das GEX-Profil-Chart

Das Hauptchart. Strike auf der x-Achse; Dealer-Gamma auf der y-Achse. Drei Dinge sind zu lesen:

1. **Wo die Kurve die Null kreuzt** — der Gamma Flip.
2. **Der größte Call-Gamma-Stapel** — die Call Wall.
3. **Der größte Put-Gamma-Stapel** — die Put Wall.

Der aktuelle Spotpreis wird als vertikale Referenzlinie angezeigt. Der sichtbare Bereich ist auf den Spot zentriert.

## Das Walls-Chart

Eine separate, größer formatierte Ansicht der Wall-Struktur mit überlagertem Call Wall, Put Wall, Max Pain und Gamma Flip. Nützlich, wenn du sehen willst, wie sich die Struktur seit der Eröffnung verschoben hat.

## Das Term-Structure-Chart

Das GEX-Profil **pro Verfall**. Stapelt 0DTE, die Verfälle dieser Woche, der nächsten Woche und der Monatsverfälle in einer Ansicht. Nützlich für:

- Das Erkennen von **0DTE-Pin-Verhalten**, isoliert vom größeren Book.
- Das Erkennen, ob eine Wall in Monatsverfällen konzentriert ist (dauerhaft) oder in Wochenverfällen (vorübergehend).

## Die Strike-×-DTE-Heatmap

Eine 2D-Heatmap des Dealer-Gammas über Strike (Zeilen) und DTE (Spalten). Die heißesten Zellen sind die Strikes, die für die nächstliegenden Verfälle am wichtigsten sind. Die Heatmap wandert im Tagesverlauf, wenn Flow hereinkommt — ihre Bewegung zu beobachten ist aufschlussreich.

## Der Regime-Header

Ganz oben auf der Seite wird das GEX-Regime-Label (Positiv / Negativ / Im Übergang) mit der einzeiligen Interpretation wiederholt. Wenn das Regime-Label und die Spot/Flip-Beziehung nicht übereinstimmen, fahre mit der Maus über das Regime — der Tooltip erklärt warum (das Label „Im Übergang" erscheint, wenn das Net GEX am Spot nahe null liegt).

## Dealer Positioning in drei Schritten lesen

1. **Wo liegt der Spot relativ zum Flip?** Darüber ⇒ strukturelle Stabilisierung; darunter ⇒ strukturelle Verstärkung.
2. **Wo liegen die Walls?** Die Call Wall ist deine Aufwärtsreibung; die Put Wall ist deine Abwärtsreibung.
3. **Wie wandert die Heatmap?** Wandert die Call Wall nach oben, werden die Dealer gezwungen, höher zu rollen — bullishe strukturelle Lesart.

## Warum sich ZeroGEX' Gamma-Flip-Berechnung unterscheidet

Der Flip wird aus einem **Spot-Shift-Dealer-Gamma-Profil** berechnet — nicht aus einer Näherung über das kumulative Net GEX. Zur Methodik und zum Vorher/Nachher-Vergleich siehe [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Häufige Lesarten

- **Spot deutlich über dem Flip, Call Wall knapp darüber** ⇒ Pin in den Schluss hinein, Fade von Extensions.
- **Spot unter dem Flip, Put Wall knapp darunter** ⇒ Trend-Bias; bei einem Bruch ist Verstärkung zu erwarten.
- **Spot nahe am Flip bei steigender Vol** ⇒ Risiko eines Regimewechsels; Positionsgröße reduzieren oder abwarten.
- **Heatmap-Konzentration auf 0DTE-Call-Strikes nahe dem Spot** ⇒ Pin-Druck in den Schluss hinein.

## Siehe auch

- [GEX Summary & Greeks](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
