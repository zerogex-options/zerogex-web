# Flow-Analyse

*Prämiengewichteter und Netto-Volumen-Flow, Smart-Money-Buckets, die Lee-Ready-Aggressor-Aufteilung, und wie man echte Überzeugung im Tape erkennt.*

---

## Was diese Seite zeigt

Die Flow-Analysis-Seite ist die **Tape-Ansicht** des Optionsmarktes. Während Dealer Positioning das statische Buch zeigt, zeigt diese Seite den **Flow** — was Aggressoren gerade in Echtzeit tun.

## Die drei Flow-Perspektiven

ZeroGEX zeigt den Flow durch drei Perspektiven, weil jede auf ihre eigene Weise zählt.

### Netto-Kontraktvolumen

Zählt einfach die Kontrakte. Nützlich als Rauschbasis. Allein wenig aussagekräftig als Überzeugungssignal — tausend Kontrakte zu $0,05 und ein Kontrakt zu $500 zählen gleich viel.

### Prämiengewichteter Flow

Multipliziert das Kontraktvolumen mit der gezahlten Prämie. **Das ist das Überzeugungssignal.** Ein Trader, der $500 pro Kontrakt für einen 0DTE-OTM-Call zahlt, geht eine echte Wette ein; ein Trader, der $0,05-Lottoscheine scalpt, tut das nicht.

### Direktionaler Flow (Lee-Ready-Aggressor-Aufteilung)

Klassifiziert jeden Trade als käufer- oder verkäuferinitiiert mithilfe des Lee-Ready-Algorithmus (auf welcher Seite von Bid/Ask der Trade stattfand). Summiert käuferinitiierte minus verkäuferinitiierte Trades. Zeigt, ob die Aggressoren für Aufwärts- oder Abwärtsbewegung zahlen.

## Die Hauptkachel

Der obere Bereich der Seite zeigt den prämiengewichteten Netto-Flow über das rollierende Zeitfenster. Positiv ⇒ Aggressoren zahlen netto für Calls / verkaufen Puts; negativ ⇒ Aggressoren zahlen für Puts / verkaufen Calls.

## Die Detailpanels

Unterhalb der Hauptkachel:

- **Call-Kauf / Call-Verkauf**-Prämie
- **Put-Kauf / Put-Verkauf**-Prämie
- **Netto-Aggressor-Delta** — die Lee-Ready-Ausgabe skaliert mit dem Kontrakt-Delta

Jede wird als Serie dargestellt, damit man die Steigung sieht, nicht nur das Niveau.

## Der Smart-Money-Chip

Tags an einzelnen Trades kennzeichnen sie als Smart Money — typischerweise große Blocks, Sweeps, wiederholte aggressive Prints in dieselbe Richtung. Der Smart-Money-Flow wird als separate Subserie angezeigt. Nutze ihn als Gegenprobe zur Hauptkachel.

## Wie man sie liest

Drei Muster:

1. **Starker prämiengewichteter positiver Flow bei negativem GEX-Gradienten** ⇒ Trader zahlen für Aufwärtsbewegung, bei der Dealer strukturell short sind. Signal für Fortsetzung mit hoher Überzeugung.
2. **Starker Put-Kauf, während auch das Positioning-Trap-Signal hoch ist** ⇒ die Menge liegt falsch; ein Rückschlag ist zu erwarten.
3. **Flacher Flow nahe einem Schlüssellevel** ⇒ auf den Ausbruch warten. Flow ohne Überzeugung ist kein Trade.

## Netto-Volumen vs. direktionaler Flow

Für eine tiefere Betrachtung, warum reines Volumen in die Irre führen kann, warum direktionaler Flow zusätzliches Signal liefert und warum prämiengewichteter Flow meist die stärkste Überzeugungsmetrik ist, siehe [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow).

## Wann die Seite am nützlichsten ist

- **Direkt nach der Eröffnung** — die ersten 30 Minuten verraten viel über den Bias des Tages.
- **An jedem Schlüssellevel** — der Flow in einen Wall oder VWAP zeigt, ob das Level verteidigt oder durchbrochen wird.
- **Zum Handelsschluss** — kombiniert mit EOD Pressure schärft die Flow-Lesart den Richtungshinweis.

## Siehe auch

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow)
