# Tiers, Zugang & was wo freigeschaltet wird

*Eine klare Übersicht, welche Seiten öffentlich, Basic oder Pro sind — und was sich zwischen den Tiers auf jeder Seite ändert.*

---

## Die drei Tiers

ZeroGEX hat drei Konto-Tiers. Sie bestimmen, welche Daten und Signale du siehst.

| Tier | Für wen | Was du bekommst |
| --- | --- | --- |
| Public | Stöbern, Weiterbildung | Die Landing-Site, Education, Guides, Artikel, kostenlose SPX-/SPY-/QQQ-Gamma-Level-Seiten (15 Minuten verzögert) |
| Basic | Aktive Intraday-Trader | Dashboard, Live Bulletin, alle Metrics, Strategy Builder, Live Options Quotes, alle Basic Signals |
| Pro | Ernsthafte Operator | Alles aus Basic + alle Advanced Signals + Composite Score + Backtesting + API-Zugang |

Die aktuelle Aufschlüsselung — und ein 14-tägiger Testzugang — findest du auf der Seite [Pricing](/pricing).

## Was wo gesperrt ist

### Public (kein Konto nötig)

- Die Marketing-Site (Landing, About, Education Hub, Articles, Guides)
- Kostenlose SPX-, SPY- und QQQ-Gamma-Level-Seiten — etwa 15 Minuten verzögert
- Help Center, FAQs, Quick Starts
- Datenschutz, AGB

### Basic-Tier

- **Dashboard** — vollständige Echtzeit-Metriken
- **Live Bulletin** — Streaming-Feed der Signalereignisse
- **Alle Metrics-Seiten** — Dealer Positioning, GEX Summary & Greeks, Flow Analysis, Smart Money, Max Pain, Technicals
- **Basic Signals** — Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Strategy Builder** — vollständiges Options-Pricing und P&L
- **Live Options Quotes** — die Live-Chain

### Pro-Tier

- Alles aus Basic, plus:
- **Composite Score** — die kombinierte Einschätzung über alle Signale hinweg
- **Alle Advanced Signals** — Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **Backtesting** — historische Signal-Backtests
- **API-Zugang** — dieselben Daten über `api.zerogex.io`

## Was sich zwischen Tiers auf derselben Seite ändert

Einige Seiten existieren für alle Tiers, verhalten sich aber unterschiedlich je nachdem, welchen Zugang du hast:

- Das **Dashboard** ist für Basic und Pro vollständig befüllt. Public-Nutzer sehen eine Teaser-Ansicht, die nach der Anmeldung zur Live-Seite verlinkt.
- Der Bereich **Signals** in der Seitenleiste ist immer sichtbar — jeder kann auf einen Signalnamen klicken. Ohne Zugang führt der Klick zur Seite [Pricing](/pricing), damit du siehst, was ihn freischaltet.
- Badges und Chips im **Live Bulletin** sind tier-abhängig: Elemente, die nur für Pro freigeschaltet sind, zeigen Basic-Nutzern einen kleinen Lock-Chip.

## So upgradest du oder wechselst den Tier

Kontoänderungen erfolgen an zwei Stellen:

1. **[Account](/account)** — zeigt deinen aktuellen Tier, den aktuellen Plan-Status und den Link zum Billing-Portal.
2. **[Stripe Billing Portal](/account)** — erreichbar über die Account-Seite. Wechsle zwischen Basic und Pro, wechsle von monatlich zu jährlich, ändere die Zahlungsmethode, sieh dir Rechnungen an.

Eine Schritt-für-Schritt-Anleitung findest du unter [Billing & Stripe Portal](/help/platform/billing).

## Wenn du dich in einer Testphase befindest

Befindet sich dein Konto in einer kostenlosen Testphase (Basic oder Pro), zeigt die Account-Seite einen Chip „Trial active — X days left". Endet die Testphase, läuft das Abonnement automatisch zu dem Tarif weiter, zu dem du dich angemeldet hast. Um das zu verhindern, kündige im Billing-Portal, bevor die Testphase abläuft.

## Was passiert, wenn du auf etwas klickst, auf das du keinen Zugriff hast?

Du wirst zur Seite [Pricing](/pricing) weitergeleitet, statt blockiert oder mit einer Fehlermeldung konfrontiert zu werden. Die Landing-Page bei Pricing zeigt dir genau, welcher Tier die Seite freischaltet, die du öffnen wolltest.

## Siehe auch

- [Pricing](/pricing) — die aktuelle Tier-Aufschlüsselung und der Testzugang
- [Account Settings](/help/platform/account)
- [Billing & Stripe Portal](/help/platform/billing)
