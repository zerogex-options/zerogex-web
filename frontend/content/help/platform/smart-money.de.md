# Smart Money

*Der Smart-Money-Screen - was einen Trade als Smart Money qualifiziert, wie die Call/Put-Aufteilung gelesen wird und wie man den Bias intraday nutzt.*

---

## Was "Smart Money" hier bedeutet

Smart Money ist eine Heuristik - ein Screen für Options-Prints, die groß oder ungewöhnlich genug sind, um jemandes Position zu sein und nicht bloß Hedging-Kleinkram. Jede Zeile ist der Handel eines Kontrakts innerhalb einer Minute, und sie qualifiziert sich, wenn sie eine dieser Schwellen überschreitet:

- **Größe** - 50 oder mehr Kontrakte.
- **Prämie** - $50K oder mehr.
- **Ungewöhnliche kleinere Prints** - 20 oder mehr Kontrakte in einem Kontrakt mit hoher IV (über 40 %) oder in einem weit aus dem Geld liegenden (|Delta| unter 0,15).

Jeder qualifizierte Print trägt seine **Aggressor-Seite** - **Buy**, wenn käuferinitiierte Prämie überwog, **Sell**, wenn verkäuferinitiierte Prämie überwog, **Neutral**, wenn keine überwog - und eine **Notional-Klasse** von $500K+ bis unter $50K. Die Seite behält die 50 größten Prints der Sitzung nach Notional.

## Was diese Seite zeigt

### Das Regime-Banner

**Smart Money Regime** summiert das Call-Notional und das Put-Notional der Blocks, die deine Filter passieren: **Call Buyers in Control**, wenn Calls mit $250K oder mehr vorne liegen, **Put Buyers in Control**, wenn Puts vorne liegen, und sonst **Balanced Positioning**. Es zählt das Notional beider Seiten des Tapes - stelle **Side** auf **Buy**, wenn es nur Käufer lesen soll. Das ist **nicht** dasselbe wie die Headline-PCR (Put/Call Ratio) - es zählt nur die gescreenten Blocks.

### Die Filter

- **Session** - die aktuelle oder die vorherige Sitzung.
- **Min class** - das kleinste angezeigte Notional, von $500K+ (Standard) bis unter $50K.
- **Side** - nur Buy-, Sell- oder Neutral-Prints.
- **Min |Δ|** - blendet Prints unter einem Delta von 0,10, 0,25 oder 0,40 aus und entfernt so weit aus dem Geld liegende Lottoscheine.
- **Expiry** - 0DTE, 1-7 DTE oder 8+ DTE.

### Blocks vs. underlying price

Die gefilterten Blocks als gestapelte Balken pro Minute - grün für Calls, rot für Puts - gegen den Kurs des Basiswerts über die Sitzung. Fahre über einen Balken, um die Kontrakte dahinter zu sehen; ihre Zeilen leuchten in der Tabelle darunter auf.

### Block detail

Dieselben Blocks als Tabelle: Zeit, Kontrakt, Strike, Verfall, DTE, Typ, Seite, Delta, Kontrakte, Notional und Klasse. Klicke auf einen Spaltenkopf zum Sortieren (ein zweiter Spaltenkopf wird zum Tiebreaker, bis zu drei Ebenen), und nutze den Trichter bei Strike, Expiration oder Type, um auf einen Wert zu filtern.

## Wie man sie nutzt

Drei Muster:

1. **Smart Money kauft massiv Calls + MSI in einem Trend-Regime (≥ 70) + unterstützender GEX-Gradient** ⇒ die strukturelle Lesart deckt sich mit dem Smart-Money-Flow. Richtungsstark mit hoher Überzeugung.
2. **Smart Money kauft massiv Puts am Put Wall** ⇒ Verteidigung oder Fading. In Kombination mit einer Positioning-Trap-Lesart kann dies ein handelbarer Counter-Bias sein.
3. **Smart-Money-Flow neutral, Headline-Flow stark** ⇒ die Headline ist wahrscheinlich breite, wenig überzeugte Beteiligung und kein informiertes Positioning; mit Vorsicht behandeln.

## Was sie nicht ist

Der Smart-Money-Tag ist eine **probabilistische Heuristik**. Nicht jeder Smart-Money-Print ist informiert; nicht jeder informierte Trade wird markiert. Größe ist ein Indiz, keine Absicht: Ein großer Print kann eine Eröffnungswette sein, ein Ausstieg oder ein Bein eines Spreads, dessen anderes Bein woanders in der Kette liegt, und das Tape kann dir nicht sagen, was davon. Die Seite ist am nützlichsten auf **Bias-Ebene** - wie ist die kumulative Neigung? - und weniger als Handelssignal für einzelne Prints.

## ES und NQ

Smart Money ist für ES und NQ nicht verfügbar. Sie haben hier keine eigene Optionskette - ihre Gamma-Levels werden aus SPX- bzw. NDX-Optionen abgeleitet -, also wechsle zu SPX oder NDX, um den Screen zu sehen.

## Das größere Bild

Der Smart-Money-Flow ist einer von mehreren Inputs in das Basissignal des Positioning Trap (das das vorzeichenbehaftete Smart-Money-Ungleichgewicht nutzt) sowie in den Market Pressure Index (Smart-Money-Flow-Skew). Die Smart-Money-Seite ist die eigenständige Lesart; die Signale sind die Interpretationen.

## Siehe auch

- [Flow-Analyse](/help/platform/flow-analysis)
- [Nettovolumen vs. gerichteter Flow](/education/net-volume-vs-directional-flow)
- [Positioning-Trap-Signal erklärt](/education/positioning-trap-explained)
