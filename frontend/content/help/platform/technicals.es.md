# Technicals

*La instantánea técnica intradía — precio, velas, indicadores de volatilidad y cómo los niveles se superponen a los muros de GEX.*

---

## Qué muestra esta página

La página Technicals es la **lectura price-first** del símbolo activo. Es la única página que **no** parte de las cifras derivadas de opciones — parte de la acción del precio, la volatilidad y el contexto técnico estándar.

Es la página que abres cuando necesitas confirmar qué está implicando el posicionamiento de los dealers frente a lo que el precio realmente está haciendo.

## El gráfico de velas

El gráfico principal. Velas OHLC estándar con selector de timeframe (1m / 5m / 15m / 1h / 1d). Overlays:

- **VWAP** (anclado a la apertura de la sesión).
- **El gamma flip** como línea horizontal.
- **El call wall y el put wall** como líneas horizontales.
- **Max pain** como línea horizontal (donde sea relevante).

El objetivo de los overlays es permitirte leer la acción del precio a través del lente del posicionamiento de los dealers sin tener que cambiar de pestaña.

## Los indicadores de volatilidad

Tres indicadores:

- **Implied Volatility** — IV ATM actual con el rank respecto a los últimos 60 días.
- **Realized Volatility** — volatilidad realizada de ventana corta con una línea base de ventana más larga.
- **Ratio IV / RV** — cuando el ratio está significativamente por encima de 1, la vol está cara (vender prima); por debajo, la vol está barata (comprar prima).

## La franja de sesión

Una pequeña franja que muestra:

- La sesión actual (Pre-market, Open, After-hours, Closed)
- El precio de apertura de la sesión
- El máximo y el mínimo de la sesión
- La distancia del spot al VWAP
- El tiempo hasta el próximo evento importante de la sesión (apertura, almuerzo, cierre)

## Cómo leerla

Tres patrones:

1. **Precio atrapado entre el call wall y el put wall** en gamma positiva ⇒ reversión a la media dentro del rango. Los technicals confirman el rango; la página de dealers te dice el porqué.
2. **Precio que rompe por debajo del put wall** en gamma negativa con la IV en expansión ⇒ continuación de tendencia. Los technicals muestran la ruptura; la página de dealers explica la amplificación.
3. **El VWAP y el gamma flip se apilan en el mismo nivel** ⇒ pivote estructural. Las reacciones en ese nivel tienen mayor convicción que en cualquiera de los dos por separado.

## La vista de intraday-tools

La página intraday-tools es un diseño emparejado — el gráfico de velas arriba, un encabezado comprimido de posicionamiento de dealers debajo — para traders que quieren ambas vistas lado a lado.

## Ver también

- [Cómo leer el Dashboard](/help/platform/dashboard)
- [Posicionamiento de los Dealers](/help/platform/dealer-positioning)
- [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip)
