# Flow-Analyse

*Prämiengewichteter und Netto-Volumen-Flow, die Lee-Ready-Aggressor-Aufteilung, und wie man echte Überzeugung im Tape erkennt.*

---

## Was diese Seite zeigt

Die Flow-Analysis-Seite ist die **Tape-Ansicht** des Optionsmarktes. Während Dealer Positioning das statische Buch zeigt, zeigt diese Seite den **Flow** - was heute gehandelt wurde und welche Seite dafür den Spread gekreuzt hat.

Zwei Menüs im Seitenkopf gelten für die ganze Seite: **Session** (die aktuelle oder die vorherige Handelssitzung, damit du siehst, ob heute überhaupt ungewöhnlich ist) und **Volume basis** (**Directional** oder **Total Traded** - siehe unten).

## Die drei Flow-Perspektiven

ZeroGEX zeigt den Flow durch drei Perspektiven, weil jede auf ihre eigene Weise zählt.

### Netto-Kontraktvolumen

Zählt einfach die Kontrakte. Nützlich als Rauschbasis. Allein wenig aussagekräftig als Überzeugungssignal - tausend Kontrakte zu $0,05 und ein Kontrakt zu $500 zählen gleich viel. Die Basis **Total Traded** zählt jeden Kontrakt, der den Besitzer gewechselt hat, und steigt deshalb nur.

### Prämiengewichteter Flow

Multipliziert das Kontraktvolumen mit der gezahlten Prämie. **Das ist das Überzeugungssignal.** Ein Trader, der $500 pro Kontrakt für einen 0DTE-OTM-Call zahlt, geht eine echte Wette ein; ein Trader, der $0,05-Lottoscheine scalpt, tut das nicht.

### Direktionaler Flow (Lee-Ready-Aggressor-Aufteilung)

Klassifiziert jeden Trade als käufer- oder verkäuferinitiiert mithilfe des Lee-Ready-Algorithmus (auf welcher Seite von Bid/Ask der Trade stattfand); Prints, die zu nah an der Mitte liegen, um sie zuzuordnen, bleiben ohne Vorzeichen. Summiert käuferinitiierte minus verkäuferinitiierte Trades. Zeigt, ob die Aggressoren für Aufwärts- oder Abwärtsbewegung zahlen. Die Basis **Directional** versieht das Volumen auf diese Weise mit Vorzeichen und kann daher unter null fallen.

## Das Regime-Banner

**Flow Analysis Regime** benennt die bisherige Sitzung: **Risk-On Flow Regime**, wenn Net Premium und Net Flow beide zu Calls neigen, **Risk-Off Flow Regime**, wenn beide zu Puts neigen, und **Mixed / Two-Way Flow**, wenn sie sich widersprechen oder beide klein sind. Der Absatz darunter nennt die Zahlen hinter dem Label.

## Der Flow Snapshot

Sitzungssummen zum letzten Balken:

- **Call Volume** und **Put Volume** - gehandelte Kontrakte, darunter die Netto-Prämie der jeweiligen Seite
- **Net Flow** - Netto-Call-Kontrakte minus Netto-Put-Kontrakte, jeweils nach Aggressor mit Vorzeichen versehen
- **Net Premium** - Netto-Call-Prämie minus Netto-Put-Prämie. Positiv ⇒ Aggressoren zahlen netto für Calls / verkaufen Puts; negativ ⇒ Aggressoren zahlen für Puts / verkaufen Calls.
- **Put/Call Ratio** - Put-Volumen geteilt durch Call-Volumen

## Die Charts

- **Options Flow** - Netto-Call-Prämie und Netto-Put-Prämie im Sitzungsverlauf gegen den Kurs des Basiswerts, darunter eine Volumenfläche auf der gewählten Basis. Filterbar nach Strike oder Verfall.
- **Net Directional Premium** - die laufende Sitzungssumme der Netto-Prämie, über und unter null schattiert.
- **Put/Call Ratio** - das kumulative Verhältnis der Sitzung an jedem 5-Minuten-Balken.
- **Net Position (Buys vs. Sells)** - laufendes Netto-Call- und Netto-Put-Volumen, damit du Kaufen von Verkaufen unterscheiden kannst, was das Verhältnis nicht kann.

Jede wird als Serie dargestellt, damit man die Steigung sieht, nicht nur das Niveau.

## Smart Money

Smart-Money-Prints haben eine eigene Seite - siehe [Smart Money](/help/platform/smart-money). Nutze sie als Gegenprobe zum Headline-Flow hier.

## Wie man sie liest

Drei Muster:

1. **Starker prämiengewichteter positiver Flow bei positivem GEX Gradient, während die Dealer modelliert short Gamma sind** ⇒ Trader zahlen für Aufwärtsbewegung, bei der die Dealer modelliert short sind. Signal für Fortsetzung mit hoher Überzeugung.
2. **Starker Put-Kauf, während das Positioning-Trap-Signal auf der Short-Seite der Menge (positiv) geladen ist** ⇒ die bärische Menge liegt falsch; ein Rückschlag nach oben ist zu erwarten.
3. **Flacher Flow nahe einem Schlüssellevel** ⇒ auf den Ausbruch warten. Flow ohne Überzeugung ist kein Trade.

## Netto-Volumen vs. direktionaler Flow

Für eine tiefere Betrachtung, warum reines Volumen in die Irre führen kann, warum direktionaler Flow zusätzliches Signal liefert und warum prämiengewichteter Flow meist die stärkste Überzeugungsmetrik ist, siehe [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow).

## Wann die Seite am nützlichsten ist

- **Direkt nach der Eröffnung** - die ersten 30 Minuten verraten viel über den Bias des Tages.
- **An jedem Schlüssellevel** - der Flow in einen Wall oder VWAP zeigt, ob das Level verteidigt oder durchbrochen wird.
- **Zum Handelsschluss** - kombiniert mit EOD Pressure schärft die Flow-Lesart den Richtungshinweis.

## Siehe auch

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow)
