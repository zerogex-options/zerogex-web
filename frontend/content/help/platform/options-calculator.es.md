# Strategy Builder

*Construye cualquier estrategia de opciones de una o varias patas. Cómo calcula el precio la calculadora, cómo se calculan las greeks y cómo leer los escenarios de P&L.*

---

## Qué es el Strategy Builder

El Strategy Builder es la **herramienta de modelado por operación**. Construyes una estrategia pata por pata, la página la valora en tiempo real, y tú lees la superficie de P&L y las greeks agregadas.

Es el lugar al que acudes después de que el dashboard te dice "la estructura es alcista" y necesitas elegir el instrumento concreto.

## Construir una estrategia

1. **Elige un símbolo** (SPY, SPX, QQQ).
2. **Añade una pata** — compra o venta, call o put, strike, vencimiento. La cadena está en vivo.
3. **Repite** para estructuras multi-pata (verticales, condors, calendars, ratios, straddles, strangles).
4. **Establece el spot para el análisis** — por defecto es el spot en vivo, pero puedes probar cualquier precio como escenario.

El precio agregado, los breakevens y las greeks se actualizan con cada cambio.

## El modelo de valoración

El Builder utiliza **Black-Scholes** con la superficie de volatilidad implícita en vivo para cada pata. La superficie de IV se extrae de nuestro pipeline de datos — la misma superficie que alimenta la cadena en la página de [Cotizaciones de Opciones en Vivo](/help/platform/option-contracts).

Para las consideraciones de ejercicio de estilo americano (relevantes para ETFs como SPY y QQQ), el modelo aproxima con una prima de ejercicio anticipado en patas deep ITM cerca del vencimiento. SPX tiene ejercicio de estilo europeo, por lo que no se aplica ningún ajuste.

## El panel de greeks

Para cada pata y para el agregado:

- **Delta** — exposición direccional
- **Gamma** — cómo se mueve el delta con el spot
- **Theta** — decaimiento temporal (por día)
- **Vega** — sensibilidad a la IV (por cambio del 1%)
- **Charm** — decaimiento del delta (por día)

Las greeks agregadas te permiten leer una estructura multi-pata de un vistazo — por ejemplo, un calendar largo es net long vega, short theta en el mes cercano, long theta en el lejano.

## La superficie de P&L

El gráfico de P&L en 2D muestra:

- Precio spot en el eje x.
- Valor de P&L en el eje y.
- Múltiples curvas: al vencimiento (el payoff), y en varias fechas entre ahora y el vencimiento.

También puedes ver los breakevens resaltados en el eje x.

## Prueba de escenarios

El panel de escenarios te permite barrer dos variables a la vez — típicamente spot e IV — y ver la cuadrícula de P&L resultante. Útil para:

- Una estructura long-vol: ¿cuánto ganas con un shock de 2 puntos de volatilidad?
- Un pin trade: ¿cuánto puedes perder si el spot se desvía un 1% del max pain?

## Lo que no hace

El Strategy Builder es una **herramienta de valoración**, no una herramienta de enrutamiento de operaciones. No se conecta a tu broker. Tomas la estructura y la ejecutas tú mismo.

## Nota sobre niveles

El Strategy Builder está disponible para Basic y Pro.

## Ver también

- [Cotizaciones de Opciones en Vivo](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
