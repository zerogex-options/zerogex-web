# Niveles, acceso y qué se desbloquea dónde

*Un mapa claro de qué páginas son públicas, Basic y Pro — y qué cambia entre niveles en cada página.*

---

## Los tres niveles

ZeroGEX tiene tres niveles de cuenta. Determinan qué datos y qué señales puedes ver.

| Nivel | Para quién | Qué obtienes |
| --- | --- | --- |
| Public | Navegación, formación | El sitio principal, contenido educativo, guías, artículos, páginas gratuitas de niveles gamma de SPX / SPY / QQQ (con 15 minutos de retraso) |
| Basic | Traders intradía activos | Dashboard, Live Bulletin, todos los Metrics, Strategy Builder, Live Options Quotes, todos los Basic Signals |
| Pro | Operadores serios | Todo lo de Basic + todos los Advanced Signals + Composite Score + Backtesting + acceso a la API |

Consulta el desglose en vivo — y una vía de prueba de 14 días — en la página [Pricing](/pricing).

## Qué está restringido y dónde

### Public (sin cuenta necesaria)

- El sitio de marketing (landing, About, Education Hub, Articles, Guides)
- Páginas gratuitas de niveles gamma de SPX, SPY y QQQ — con un retraso de unos 15 minutos
- Help Center, FAQs, Quick Starts
- Privacidad, Términos

### Nivel Basic

- **Dashboard** — métricas completas en tiempo real
- **Live Bulletin** — feed en streaming de eventos de señales
- **Todas las páginas de Metrics** — Dealer Positioning, GEX Summary & Greeks, Flow Analysis, Smart Money, Max Pain, Technicals
- **Basic Signals** — Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Strategy Builder** — pricing completo de opciones y P&L
- **Live Options Quotes** — la cadena en vivo

### Nivel Pro

- Todo lo de Basic, más:
- **Composite Score** — la lectura combinada de todas las señales
- **Todos los Advanced Signals** — Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **Backtesting** — backtests históricos de señales
- **Acceso a la API** — los mismos datos a través de `api.zerogex.io`

## Qué cambia entre niveles en la misma página

Algunas páginas existen para todos los niveles pero se comportan de forma distinta según el acceso que tengas:

- El **Dashboard** está completamente poblado para Basic y Pro. Los usuarios Public ven una vista de muestra que enlaza a la página en vivo tras iniciar sesión.
- La sección **Signals** de la barra lateral siempre está visible — cualquiera puede hacer clic en el nombre de una señal. Si no tienes acceso, el clic te lleva a la página [Pricing](/pricing) para que veas qué lo desbloquea.
- Las insignias y chips de **Live Bulletin** son sensibles al nivel: los elementos restringidos a Pro muestran un pequeño chip de candado a los usuarios Basic.

## Cómo actualizar o cambiar de nivel

Los cambios de cuenta se realizan en dos lugares:

1. **[Account](/account)** — muestra tu nivel actual, el estado de tu plan actual y el enlace al portal de facturación.
2. **[Stripe Billing Portal](/account)** — se accede desde la página Account. Cambia entre Basic y Pro, pasa de mensual a anual, cambia el método de pago, consulta facturas.

Para instrucciones paso a paso, consulta [Billing & Stripe Portal](/help/platform/billing).

## Cuando estás en periodo de prueba

Si tu cuenta está en una prueba gratuita (Basic o Pro), la página Account muestra un chip "Trial active — X days left". Cuando termina la prueba, la suscripción continúa automáticamente a la tarifa con la que te registraste. Para evitarlo, cancela en el portal de facturación antes de que expire la prueba.

## ¿Qué pasa si haces clic en algo a lo que no tienes acceso?

Se te redirige a la página [Pricing](/pricing) en lugar de bloquearte o mostrarte un error. La landing page de Pricing te muestra exactamente qué nivel desbloquea la página que intentaste abrir.

## Ver también

- [Pricing](/pricing) — el desglose en vivo de niveles y la vía de prueba
- [Account Settings](/help/platform/account)
- [Billing & Stripe Portal](/help/platform/billing)
