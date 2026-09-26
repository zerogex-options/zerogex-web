# Smart Money

*La pantalla de smart money - qué califica a una operación como smart money, cómo se lee el reparto entre calls y puts, y cómo usar el bias intradía.*

---

## Qué significa "smart money" aquí

Smart money es una heurística - una pantalla para prints de opciones lo bastante grandes o inusuales como para ser la posición de alguien y no restos de cobertura. Cada fila es la negociación de un contrato dentro de un minuto, y califica cuando supera cualquiera de estos umbrales:

- **Tamaño** - 50 contratos o más.
- **Prima** - $50K o más.
- **Prints más pequeños pero inusuales** - 20 contratos o más en un contrato con IV alta (por encima del 40%) o muy fuera del dinero (|delta| por debajo de 0,15).

Cada print que califica lleva su **lado agresor** - **Buy** cuando predominó la prima iniciada por el comprador, **Sell** cuando predominó la iniciada por el vendedor, **Neutral** cuando no predominó ninguna - y una **clase de notional** desde $500K+ hasta menos de $50K. La página conserva los 50 prints más grandes de la sesión por notional.

## Qué muestra esta página

### El banner de régimen

**Smart Money Regime** suma el notional de calls y el notional de puts de los bloques que pasan tus filtros: **Call Buyers in Control** cuando las calls van por delante por $250K o más, **Put Buyers in Control** cuando van por delante las puts, y **Balanced Positioning** en caso contrario. Cuenta el notional de ambos lados del tape - pon **Side** en **Buy** si quieres que lea solo compradores. Esto **no** es lo mismo que el PCR (put/call ratio) principal - solo cuenta los bloques filtrados.

### Los filtros

- **Session** - la sesión actual o la anterior.
- **Min class** - el notional mínimo que se muestra, desde $500K+ (por defecto) hasta menos de $50K.
- **Side** - solo prints Buy, Sell o Neutral.
- **Min |Δ|** - descarta los prints con delta inferior a 0,10, 0,25 o 0,40, recortando los tickets de lotería muy fuera del dinero.
- **Expiry** - 0DTE, 1-7 DTE u 8+ DTE.

### Blocks vs. underlying price

Los bloques filtrados como barras apiladas por minuto - verde para calls, rojo para puts - frente al precio del subyacente a lo largo de la sesión. Pasa el cursor sobre una barra para ver los contratos que hay detrás; sus filas se iluminan en la tabla de abajo.

### Block detail

Los mismos bloques en una tabla: hora, contrato, strike, vencimiento, DTE, tipo, lado, delta, contratos, notional y clase. Haz clic en un encabezado para ordenar (un segundo encabezado pasa a ser el desempate, hasta tres niveles), y usa el embudo de Strike, Expiration o Type para filtrar por un valor.

## Cómo usarla

Tres patrones:

1. **Smart money comprando calls con fuerza + MSI en régimen de tendencia (≥ 70) + gradiente GEX de apoyo** ⇒ la lectura estructural se alinea con el flujo smart money. Direccional de alta convicción.
2. **Smart money comprando puts con fuerza en el put wall** ⇒ defensa o fading. Combinado con una lectura de Positioning Trap, esto puede ser un counter-bias operable.
3. **Flujo smart money neutral, flujo principal fuerte** ⇒ es probable que el flujo principal sea participación amplia y de baja convicción, y no un posicionamiento informado; tratar con cautela.

## Qué no es

La etiqueta smart money es una **heurística probabilística**. No todo print smart money está informado; no toda operación informada queda marcada. El tamaño es un indicio, no una intención: un print grande puede ser una apuesta de apertura, una salida o una pata de un spread cuya otra pata está en otro punto de la cadena, y el tape no puede decirte cuál. La página es más útil a **nivel de bias** - ¿cuál es la inclinación acumulada? - más que como señal de trading sobre prints individuales.

## ES y NQ

Smart money no está disponible para ES y NQ. Aquí no tienen una cadena de opciones propia - sus niveles de gamma se derivan de las opciones de SPX y NDX -, así que cambia a SPX o NDX para ver la pantalla.

## El panorama más amplio

El flujo smart money es uno de varios inputs de la señal básica de Positioning Trap (que usa el desequilibrio smart money con signo) y del Market Pressure Index (skew del flujo smart money). La página de smart money es la lectura independiente; las señales son las interpretaciones.

## Ver también

- [Análisis de flujo](/help/platform/flow-analysis)
- [Volumen neto vs. flujo direccional](/education/net-volume-vs-directional-flow)
- [Señal Positioning Trap explicada](/education/positioning-trap-explained)
