# Was ist GEX im Trading? Gamma Exposure einfach erklärt

*GEX — Gamma Exposure — ist die eine Kennzahl, die erklärt, warum sich manche Tage in einer engen Range festfahren und andere stark trenden. Dies ist die verständliche Version: was GEX misst, warum es den Markt bewegt und was positiv gegenüber negativ für dein Trading bedeutet.*

---

## Was ist GEX im Trading?

**GEX steht für Gamma Exposure.** Im Trading ist GEX ein Maß dafür, wie viel die Options-Dealer, die den Markt machen, vom Basiswert kaufen oder verkaufen müssen — rein mechanisch, um abgesichert (gehedgt) zu bleiben — während sich der Preis bewegt. Es ist ein Proxy für den *erzwungenen* Hedging-Flow, der jederzeit unter dem Markt liegt.

Das ist die gesamte Idee in einem Satz: GEX schätzt, in welche Richtung und wie stark die Dealer handeln müssen, um ihre Bücher neutral zu halten, wenn sich der Preis bewegt. Wenn dieser Hedging-Flow gegen Bewegungen läuft, ist der Markt klebriger und ruhiger. Wenn er *mit* den Bewegungen läuft, wird der Markt schneller und trendet stärker.

Alles andere — der Gamma Flip, Call Walls, Put Walls, das Pinning — ist nur eine detailliertere Lesart derselben Kraft. Das ist die einfache Version. Für die vollständige, ausführliche Behandlung lies den umfassenden Leitfaden [Gamma Exposure (GEX) Explained: The Complete Guide](/education/gamma-exposure-explained).

---

## Was misst GEX eigentlich?

Market Maker, die dir Optionen verkaufen, wollen keine Richtungswette eingehen — sie wollen die Gebühr, nicht das Risiko. Also hedgen sie. **Gamma** ist die Griechische Kennzahl, die angibt, wie schnell sich das Richtungs-Exposure einer Option (Delta) verändert, wenn sich der Basiswert bewegt. Da Gamma die Dealer zwingt, sich kontinuierlich neu abzusichern, sagt dir das *aggregierte* Gamma über die gesamte Optionskette, wie viel Re-Hedging der Markt leisten muss.

GEX fasst das in einer einzigen vorzeichenbehafteten Zahl zusammen — üblicherweise in Dollar-Gamma ausgedrückt, oder "Dollar Gamma" — für einen ganzen Index wie den S&P 500. Ein größerer Betrag bedeutet mehr erzwungenes Hedging unter dem Markt. Das **Vorzeichen** sagt dir, in welche Richtung dieses Hedging drückt.

---

## Positives vs. negatives GEX (warum es wichtig ist)

Das ist der Teil, der verändert, wie du tradest:

- **Positives GEX (Long-Gamma-Regime).** Die Dealer sind netto long Gamma. Um abzusichern, **verkaufen sie in Rallys und kaufen in Dips** — sie handeln *gegen* die Bewegung. Das dämpft die Volatilität. Erwarte engere Ranges, Mean Reversion und Pinning nahe stark gewichteter Strikes. Breakouts neigen dazu, ins Stocken zu geraten.
- **Negatives GEX (Short-Gamma-Regime).** Die Dealer sind netto short Gamma. Jetzt **kaufen sie in Rallys und verkaufen in Dips** — sie handeln *mit* der Bewegung. Das verstärkt die Volatilität. Erwarte breitere Ranges, sich ausdehnende Breakouts und Trends, die durchlaufen. Das ist [was negatives Gamma bedeutet](/education/what-is-negative-gamma) in der Praxis.

Gleicher Index, gleicher Chart — entgegengesetzter Marktcharakter je nach Vorzeichen des GEX. Zu wissen, in welchem Regime man sich befindet, ist das nützlichste, was GEX dir liefert.

---

## Wichtige GEX-Level: der Gamma Flip, die Call Wall, die Put Wall

GEX ist nicht nur eine Zahl; es bildet sich auf spezifische Preisniveaus ab, die es zu beobachten gilt:

- **Gamma Flip** — der Preis, an dem das gesamte Dealer-Gamma von positiv auf negativ wechselt. Darüber befindet sich der Markt meist im beruhigenden Long-Gamma-Regime; darunter im verstärkenden Short-Gamma-Regime. Es ist die Trennlinie zwischen den Regimen. Siehe [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).
- **Call Wall** — der Strike mit dem stärksten Call-Gamma oberhalb des Spotpreises, der dazu neigt, Rallys bei positivem Gamma zu deckeln.
- **Put Wall** — der Strike mit dem stärksten Put-Gamma unterhalb des Spotpreises, der dazu neigt, Dips zu stützen.

Die Call und Put Wall skizzieren die Range, die die Dealer verteidigen; der Gamma Flip sagt dir, ob sie diese verteidigen oder durchbrechen werden. [Gamma Walls Explained](/education/gamma-walls-explained) behandelt beide Walls im Detail.

---

## Wie Trader GEX nutzen

Man tradet GEX nicht direkt — man nutzt es als **Filter**, der das Spielbuch festlegt, bevor man sich irgendetwas anderes anschaut:

1. **Das Regime prüfen.** Positives GEX → Fades, Mean Reversion und Range-Trades bevorzugen. Negatives GEX → Momentum und Breakouts bevorzugen und Stops respektieren.
2. **Die Level markieren.** Notiere den Gamma Flip, die Call Wall und die Put Wall als strukturelle Karte für die Session.
3. **Auf den Flip achten.** Eine Bewegung über den Gamma Flip hinweg ist ein Wechsel des Spielbuchs, nicht nur ein Preis-Tick — der gesamte Charakter des Marktes kann sich ändern.

GEX sagt dir nicht, *was* als Nächstes passieren wird. Es sagt dir, in welcher *Art* von Tag du dich wahrscheinlich befindest, damit du an einem Trendtag keine Mean-Reversion-Strategie fährst.

---

## Wo du GEX selbst einsehen kannst

Du musst das Dealer-Gamma nicht von Hand berechnen. ZeroGEX veröffentlicht das heutige Net GEX, den Gamma Flip, die Call Wall und die Put Wall — kostenlos und mit etwa 15 Minuten Verzögerung — für [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) und [QQQ](/qqq-gamma-levels). Für die Live-Ansicht im Sub-Sekundenbereich mit dem vollständigen Gamma-Profil, einer Strike-nach-DTE-Heatmap und dem 13-Signal-Composite öffne das [Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte).

---

## Fazit

> GEX — Gamma Exposure — ist eine Momentaufnahme des erzwungenen Dealer-Hedgings unter dem Markt. Positives GEX dämpft Bewegungen; negatives GEX verstärkt sie. Bekomme zuerst das Vorzeichen richtig, dann beginnt der Rest des Marktgeschehens, Sinn zu ergeben.

Nur Bildungsinhalt — nichts von dem Vorstehenden ist eine Handelsempfehlung.

---

Willst du das in Echtzeit sehen? Sieh dir die heutige GEX-Lesart auf den kostenlosen Gamma-Level-Seiten von [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) und [QQQ](/qqq-gamma-levels) an, vertiefe dich dann mit dem [vollständigen GEX-Leitfaden](/education/gamma-exposure-explained) oder öffne das Live-[Echtzeit-0DTE-GEX-Dashboard](/real-time-gex-0dte).
