# Tiers, Zugang & was wo freigeschaltet wird

*Eine klare Übersicht, welche Seiten öffentlich, Basic oder Pro sind - und was sich zwischen den Tiers auf jeder Seite ändert.*

---

## Die drei Tiers

ZeroGEX hat drei Konto-Tiers. Sie bestimmen, welche Daten und Signale du siehst.

| Tier | Für wen | Was du bekommst |
| --- | --- | --- |
| Public | Stöbern, Weiterbildung | Die Landing-Site, Education, Guides, Artikel, das Gamma Terminal und die kostenlosen SPX-/SPY-/QQQ-/NDX-/ES-/NQ-Gamma-Level-Seiten (etwa 15 Minuten verzögert) sowie die Belege-Seiten |
| Basic | Aktive Intraday-Trader | Haupt-Dashboard, Mein Dashboard, das Live-Gamma-Terminal, Live-Bulletin, alle Kennzahlen, Strategie-Builder, Live-Optionskurse, Premium Surface, alle Basic Signals |
| Pro | Ernsthafte Operator | Alles aus Basic + Trade Bias + Gesamtscore + alle Advanced Signals + TradeWorkz™ (Bots und Backtesting) + API-Zugang |

Die aktuelle Aufschlüsselung findest du auf der Seite [Pricing](/pricing). Basic monatlich enthält eine 7-tägige kostenlose Testphase; alle anderen Pläne sind durch eine 7-tägige Geld-zurück-Garantie abgedeckt.

## Was wo gesperrt ist

### Public (kein Konto nötig)

- Die Marketing-Site (Landing, About, Education Hub, Articles, Guides)
- Das [Gamma Terminal](/chart) - eine SPY-Ansicht, etwa 15 Minuten verzögert
- Kostenlose SPX-, SPY-, QQQ-, NDX-, ES- und NQ-Gamma-Level-Seiten - etwa 15 Minuten verzögert
- Die Belege-Seiten - die Tagesprognose und ihr Intraday-Cone, die Prognose-Bilanz, die tägliche Signal-Scorecard und das Session-Replay
- Die Integrationsseiten für Chart-Plattformen - die Skripte für TradingView und thinkorswim sind kostenlos
- Help Center, FAQs, Quick Starts
- Datenschutz, AGB

### Basic-Tier

- **Haupt-Dashboard** - vollständige Echtzeit-Metriken
- **Mein Dashboard** - dein eigenes Board aus Widgets
- **Gamma Terminal** - live, für jedes Symbol
- **Live-Bulletin** - ein teilbereiter Live-Snapshot der Dealer-Gamma-Positionierung
- **Alle Kennzahlen-Seiten** - Positioning (Dealer Positioning, GEX Summary, GEX Strike Profile, GEX Heatmap, Gamma Shift, Pair Comparison, Max Pain), Options Flow (Flow Analysis, Hedging Flow, Forced Flow, Smart Money, Market Tide) und Market Context (Volatility, Technicals, Spread Monitor)
- **Basic Signals** - Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Strategie-Builder** - vollständiges Options-Pricing und P&L
- **Live-Optionskurse** - die Live-Chain
- **Premium Surface** - Zeitwert der Optionen und Abstand zum Break-even über Strikes und Verfallstermine hinweg

### Pro-Tier

- Alles aus Basic, plus:
- **Trade Bias** - die vollständige Aufschlüsselung hinter der Trade-Bias-Karte des Dashboards
- **Gesamtscore** - die vollständige Seite zum MSI, der 0-100-Einschätzung des Marktregimes (Basic sieht den MSI selbst auf dem Haupt-Dashboard)
- **Alle Advanced Signals** - Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **TradeWorkz™** (Beta) - Bot-Trading, Backtesting und Muster-Einblicke
- **API-Zugang** - persönliche API-Schlüssel für dieselben Daten über `api.zerogex.io`, mit denen auch die sich selbst aktualisierenden Indikatoren für NinjaTrader und Sierra Chart laufen

## Was sich zwischen Tiers auf derselben Seite ändert

Einige Seiten existieren für alle Tiers, verhalten sich aber unterschiedlich je nachdem, welchen Zugang du hast:

- Das **Gamma Terminal** ist für alle offen. Besucher sehen eine SPY-Ansicht, etwa 15 Minuten verzögert; Basic und Pro sehen es live, für jedes Symbol.
- Das **Haupt-Dashboard** erfordert Basic. Ohne Anmeldung landest du beim Öffnen stattdessen auf der kostenlosen SPX-Gamma-Level-Seite. Mit Basic zeigt die Pro-Karte Regime Triggers einen Button **Unlock with Pro**.
- **Mein Dashboard** erfordert Basic. Mit Basic erscheint anstelle von Pro-Widgets eine Upgrade-Karte.
- Die **Seitenleiste** richtet sich nach deinem Plan. Angemeldet tragen Seiten oberhalb deines Plans ein Schloss-Badge (zum Beispiel 🔒 Pro), und ein Klick darauf öffnet [Pricing](/pricing). Ohne Anmeldung oder ohne Plan listet das Menü nur, was du öffnen kannst.

## So upgradest du oder wechselst den Tier

Kontoänderungen erfolgen an zwei Stellen:

1. **[Konto](/account)** - zeigt deinen aktuellen Tier, den aktuellen Plan-Status und den Link zum Billing-Portal.
2. **[Stripe Billing Portal](/account)** - erreichbar über die Kontoseite. Wechsle zwischen Basic und Pro, wechsle zwischen monatlicher, vierteljährlicher und jährlicher Abrechnung, ändere die Zahlungsmethode, sieh dir Rechnungen an.

Eine Schritt-für-Schritt-Anleitung findest du unter [Abrechnung & Stripe-Portal](/help/platform/billing).

## Wenn du dich in einer Testphase befindest

Die 7-tägige kostenlose Testphase gibt es nur für Basic monatlich (eine pro Konto). Etwa 48 Stunden vor ihrem Ende schicken wir dir eine Erinnerung per E-Mail mit dem Betrag, der abgebucht wird. Endet die Testphase, läuft das Abonnement automatisch zu dem Tarif weiter, zu dem du dich angemeldet hast. Um das zu verhindern, kündige, bevor die Testphase abläuft, über **Abonnement kündigen** auf der Kontoseite, dann wird dir nichts berechnet.

Wechselst du während der Testphase zu Pro oder zu einem vierteljährlichen oder jährlichen Plan, endet die Testphase und der neue Plan wird noch am selben Tag abgerechnet; die Seite [Pricing](/pricing) zeigt dir den genauen Betrag und bittet um Bestätigung, und diese Zahlung ist durch die 7-tägige Geld-zurück-Garantie abgedeckt.

## Was passiert, wenn du auf etwas klickst, auf das du keinen Zugriff hast?

Im Menü führt dich eine gesperrte Seite zu [Pricing](/pricing) statt zu einer Fehlermeldung. Öffnest du eine gesperrte Seite direkt - über ein Lesezeichen oder einen geteilten Link -, siehst du einen Freischalt-Bildschirm, der den Plan nennt, der sie enthält, mit einem Button, um diesen Plan zu holen. Ohne Anmeldung wirst du zuerst gebeten, dich anzumelden.

## Siehe auch

- [Pricing](/pricing) - die aktuelle Tier-Aufschlüsselung und die Planoptionen
- [Kontoeinstellungen](/help/platform/account)
- [Abrechnung & Stripe-Portal](/help/platform/billing)
