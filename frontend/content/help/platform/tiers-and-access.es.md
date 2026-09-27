# Niveles, acceso y qué se desbloquea dónde

*Un mapa claro de qué páginas son públicas, Basic y Pro - y qué cambia entre niveles en cada página.*

---

## Los tres niveles

ZeroGEX tiene tres niveles de cuenta. Determinan qué datos y qué señales puedes ver.

| Nivel | Para quién | Qué obtienes |
| --- | --- | --- |
| Public | Navegación, formación | El sitio principal, contenido educativo, guías, artículos, el Gamma Terminal y las páginas gratuitas de niveles gamma de SPX / SPY / QQQ / NDX / ES / NQ (con unos 15 minutos de retraso), y las páginas de Comprobantes |
| Basic | Traders intradía activos | Panel principal, Mi panel, el Gamma Terminal en vivo, Boletín en vivo, todas las Métricas, Creador de estrategias, Cotizaciones de opciones en vivo, Premium Surface, todos los Basic Signals |
| Pro | Operadores serios | Todo lo de Basic + Trade Bias + Puntuación compuesta + todos los Advanced Signals + TradeWorkz™ (bots y backtesting) + acceso a la API |

Consulta el desglose en vivo en la página [Pricing](/pricing). Basic mensual incluye una prueba gratuita de 7 días; todos los demás planes cuentan con una garantía de devolución del dinero de 7 días.

## Qué está restringido y dónde

### Public (sin cuenta necesaria)

- El sitio de marketing (landing, About, Education Hub, Articles, Guides)
- El [Gamma Terminal](/chart) - una vista de SPY con unos 15 minutos de retraso
- Páginas gratuitas de niveles gamma de SPX, SPY, QQQ, NDX, ES y NQ - con un retraso de unos 15 minutos
- Las páginas de Comprobantes - la previsión diaria y su cono intradía, el historial de previsiones, el scorecard diario de señales y la repetición de sesión
- Las páginas de Integraciones con plataformas de gráficos - los scripts de TradingView y thinkorswim son gratuitos
- Help Center, FAQs, Quick Starts
- Privacidad, Términos

### Nivel Basic

- **Panel principal** - métricas completas en tiempo real
- **Mi panel** - tu propio tablero, hecho con widgets
- **Gamma Terminal** - en vivo, en todos los símbolos
- **Boletín en vivo** - una instantánea dealer-gamma en vivo y lista para compartir
- **Todas las páginas de Métricas** - Positioning (Dealer Positioning, GEX Summary, GEX Strike Profile, GEX Heatmap, Gamma Shift, Pair Comparison, Max Pain), Options Flow (Flow Analysis, Hedging Flow, Forced Flow, Smart Money, Market Tide) y Market Context (Volatility, Technicals, Spread Monitor)
- **Basic Signals** - Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Creador de estrategias** - pricing completo de opciones y P&L
- **Cotizaciones de opciones en vivo** - la cadena en vivo
- **Premium Surface** - el valor temporal de las opciones y la distancia al punto de equilibrio por strikes y vencimientos

### Nivel Pro

- Todo lo de Basic, más:
- **Trade Bias** - el desglose completo detrás de la tarjeta Trade Bias del panel
- **Puntuación compuesta** - la página completa del MSI, la lectura de 0 a 100 del régimen de mercado (Basic ve el propio MSI en el Panel principal)
- **Todos los Advanced Signals** - Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **TradeWorkz™** (beta) - Trading con bots, Backtesting y Análisis de patrones
- **Acceso a la API** - claves de API personales para los mismos datos a través de `api.zerogex.io`, que también alimentan los indicadores de NinjaTrader y Sierra Chart que se actualizan solos

## Qué cambia entre niveles en la misma página

Algunas páginas existen para todos los niveles pero se comportan de forma distinta según el acceso que tengas:

- El **Gamma Terminal** está abierto a todos. Los visitantes ven una vista de SPY con unos 15 minutos de retraso; Basic y Pro lo ven en vivo, en todos los símbolos.
- El **Panel principal** requiere Basic. Sin iniciar sesión, al abrirlo llegas en su lugar a la página gratuita de niveles gamma de SPX. En Basic, la tarjeta Regime Triggers, exclusiva de Pro, muestra un botón **Unlock with Pro**.
- **Mi panel** requiere Basic. En Basic, los widgets exclusivos de Pro muestran una tarjeta de mejora en su lugar.
- La **barra lateral** se adapta a tu plan. Con sesión iniciada, las páginas por encima de tu plan llevan una insignia con candado (por ejemplo, 🔒 Pro), y al hacer clic en una se abre [Pricing](/pricing). Sin sesión, o sin plan, el menú solo muestra lo que puedes abrir.

## Cómo actualizar o cambiar de nivel

Los cambios de cuenta se realizan en dos lugares:

1. **[Cuenta](/account)** - muestra tu nivel actual, el estado de tu plan actual y el enlace al portal de facturación.
2. **[Stripe Billing Portal](/account)** - se accede desde la página Cuenta. Cambia entre Basic y Pro, cambia entre facturación mensual, trimestral y anual, cambia el método de pago, consulta facturas.

Para instrucciones paso a paso, consulta [Facturación y Portal de Stripe](/help/platform/billing).

## Cuando estás en periodo de prueba

La prueba gratuita de 7 días solo está disponible con Basic mensual (una por cuenta). Unas 48 horas antes de que termine, te enviamos un recordatorio por correo con el importe que se cobrará. Cuando termina la prueba, la suscripción continúa automáticamente a la tarifa con la que te registraste. Para evitarlo, cancela antes de que expire la prueba - en el portal de facturación o con **Cancel subscription** en la página Cuenta - y no se te cobrará nada.

Si durante la prueba pasas a Pro o a un plan trimestral o anual, la prueba termina y el nuevo plan se factura ese mismo día; la página [Pricing](/pricing) te muestra el importe exacto y te pide confirmación, y ese pago está cubierto por la garantía de devolución del dinero de 7 días.

## ¿Qué pasa si haces clic en algo a lo que no tienes acceso?

Desde el menú, una página bloqueada te lleva a [Pricing](/pricing) en lugar de a un error. Si abres directamente una página restringida - desde un marcador o un enlace compartido -, verás una pantalla de desbloqueo que indica el plan que la incluye, con un botón para conseguir ese plan. Sin sesión iniciada, primero se te pedirá que inicies sesión.

## Ver también

- [Pricing](/pricing) - el desglose en vivo de niveles y las opciones de plan
- [Configuración de la cuenta](/help/platform/account)
- [Facturación y Portal de Stripe](/help/platform/billing)
