# Strategy Builder

*Valora una estrategia de opciones de una o varias patas a precios en vivo. Cómo elegir una estrategia, ajustar sus patas y leer el gráfico de pérdidas y ganancias al vencimiento.*

---

## Qué es el Strategy Builder

El Strategy Builder es la **herramienta de modelado por operación**. Eliges una estrategia y ajustas sus patas, la página la valora a precios en vivo, y tú lees su ganancia o pérdida al vencimiento en un rango de precios.

Es el lugar al que acudes después de que el dashboard te dice "la estructura es alcista" y necesitas elegir el instrumento concreto.

## Construir una estrategia

1. **Elige un símbolo** (SPY, SPX, QQQ, NDX) con el selector de símbolo.
2. **Elige una estrategia** en el menú **Strategy** - más de 40 plantillas, desde calls y puts simples hasta verticales, straddles, strangles, iron condors, butterflies, ratios, backspreads, calendars, diagonales, collars y sintéticos. Cada pata arranca con un strike y un vencimiento por defecto razonables.
3. **Ajusta las patas** - cada pata de opción tiene su propio menú **Exp** y **Strike**, alimentado por la cadena en vivo.
4. **Fija Contracts** - el número de contratos; se aplica a todas las patas, y una pata con ratio conserva su ratio.

Los precios de las patas, el total, el gráfico y los breakevens se actualizan con cada cambio.

ES y NQ no tienen cadena de opciones propia, así que el Strategy Builder no está disponible para ellos - cambia a SPX o NDX.

## Cómo se valoran las patas

Cada pata de opción se valora a su **cotización en vivo**, que se refresca cada pocos segundos: una pata larga al **ask**, una pata corta al **bid** - lo que realmente pagarías o cobrarías cruzando el spread. Cada pata muestra su contrato, ese precio y qué lado usó. Las patas de acciones (en covered calls, collars, conversions y similares) son 100 acciones por contrato, tomadas al spot actual.

**Total position** lo suma todo en cada pata y contrato: si indica **debit**, es lo que cuesta abrir la estructura; si indica **credit**, es lo que cobra.

## El gráfico de P&L

**Profit / Loss at Expiration** muestra lo que vale la estructura el día del vencimiento, neto de lo que costó o cobró al abrirla:

- Precio del subyacente en el eje x - por defecto ±5% alrededor del spot. Los botones **+** y **-** acercan y alejan, **RESET** vuelve a la vista por defecto, y el selector **%** / **$** etiqueta cada línea de la cuadrícula como movimiento porcentual o en dólares desde el spot.
- P&L en dólares en el eje y, para el número de contratos que fijaste.
- Una línea discontinua en el spot actual y una línea **BE** en cada breakeven visible.

Pasa el cursor sobre la curva para ver el P&L a ese precio y su distancia al spot.

## Calendars y diagonales

Cuando las patas vencen en fechas distintas, el gráfico sigue valorando cada pata a su valor intrínseco, como si todas vencieran a la vez. Eso subestima lo que todavía vale la pata de vencimiento lejano, así que la página lo advierte - toma la curva solo como una guía aproximada.

## Lo que no hace

El Strategy Builder es una **herramienta de valoración**, no una herramienta de enrutamiento de operaciones. No se conecta a tu broker. Tomas la estructura y la ejecutas tú mismo.

Además solo muestra el payoff al vencimiento - no hay greeks ni curvas para fechas anteriores al vencimiento.

## Nota sobre niveles

El Strategy Builder está disponible para Basic y Pro.

## Ver también

- [Cotizaciones de Opciones en Vivo](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
