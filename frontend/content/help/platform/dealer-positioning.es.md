# Dealer Positioning

*La superficie GEX completa — Net GEX en el spot, el gamma flip, call wall y put wall, y cómo leer la term structure.*

---

## Qué muestra esta página

La página Dealer Positioning es el **mapa estructural** del libro de opciones. Cada gráfico y cada tile responde a una única pregunta: ¿dónde están posicionados los dealers y qué se verán obligados a hacer a medida que el precio se mueve?

Es la página más importante para entender el contexto, incluso si el trade en sí se ejecuta en otro lugar.

## Los tiles principales

### Net GEX en el spot

El valor de dollar-gamma de todas las opciones abiertas, con signo según la posición de los dealers, evaluado **al precio spot actual**. Positivo ⇒ los dealers están net long gamma; negativo ⇒ los dealers están net short.

El número que ves aquí se mide en el spot, no se suma a lo largo de toda la cadena — esto es importante porque el signo en el spot determina el comportamiento de los dealers en este momento, independientemente de lo que haga la curva acumulada en otros precios.

### Gamma Flip

El strike en el que la curva de gamma de los dealers cruza cero. El flip es la línea de régimen: por encima, el hedging es estabilizador; por debajo, es amplificador. El tile muestra tanto el strike absoluto como la distancia porcentual respecto al spot.

### Call Wall / Put Wall

Los strikes con el mayor call gamma y put gamma. Tienden a actuar como resistencia y soporte intradía. Que el wall funcione realmente como un "muro" es más fiable en gamma positivo.

### Max Pain

El strike en el que el payout total de los compradores de opciones se minimiza. Más relevante en las últimas 24–48 horas de un vencimiento significativo.

## El gráfico de perfil GEX

El gráfico principal. Strike en el eje x; gamma de los dealers en el eje y. Tres cosas a leer:

1. **Dónde cruza la curva el cero** — el gamma flip.
2. **La mayor acumulación de call gamma** — el call wall.
3. **La mayor acumulación de put gamma** — el put wall.

El precio spot actual se muestra como una línea de referencia vertical. El rango visible está centrado en el spot.

## El gráfico de walls

Una vista separada y de mayor formato de la estructura de walls, con el call wall, put wall, max pain y gamma flip superpuestos. Útil cuando quieres ver cómo ha migrado la estructura desde la apertura.

## El gráfico de term structure

El perfil GEX **por vencimiento**. Apila 0DTE, los vencimientos de esta semana, los de la próxima y los mensuales en una sola vista. Útil para:

- Detectar el **comportamiento de pin en 0DTE** aislado del libro más amplio.
- Detectar si un wall está concentrado en mensuales (persistente) o en semanales (transitorio).

## El heatmap de strike × DTE

Un heatmap 2D del gamma de los dealers a lo largo de strike (filas) y DTE (columnas). Las celdas más "calientes" son los strikes que importan para los vencimientos más cercanos. El heatmap migra a lo largo del día a medida que llega flujo — observar su movimiento es informativo.

## El encabezado de régimen

La parte superior de la página repite la etiqueta de régimen GEX (Positivo / Negativo / En transición) con la interpretación en una línea. Si la etiqueta de régimen y la relación spot/flip no coinciden, pasa el cursor sobre el régimen — el tooltip explica por qué (la etiqueta "En transición" aparece cuando el Net GEX en el spot está cerca de cero).

## Cómo leer el dealer positioning en tres pasos

1. **¿Dónde está el spot respecto al flip?** Por encima ⇒ estabilización estructural; por debajo ⇒ amplificación estructural.
2. **¿Dónde están los walls?** El call wall es tu fricción al alza; el put wall es tu fricción a la baja.
3. **¿Cómo migra el heatmap?** Si el call wall sube, los dealers se ven forzados a rolar más arriba — lectura estructural alcista.

## Por qué el cálculo del gamma flip de ZeroGEX es diferente

El flip se calcula a partir de un **perfil de gamma de dealers con spot desplazado** — no de una aproximación basada en el Net GEX acumulado. Para la metodología y la comparación antes/después, consulta [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Lecturas comunes

- **Spot muy por encima del flip, call wall cerca por arriba** ⇒ pin hacia el cierre, fade de las extensiones.
- **Spot por debajo del flip, put wall cerca por abajo** ⇒ sesgo de tendencia; se espera amplificación ante una ruptura.
- **Spot cerca del flip con volatilidad en aumento** ⇒ riesgo de cambio de régimen; reduce el tamaño o espera.
- **Concentración del heatmap en strikes de call 0DTE cerca del spot** ⇒ presión de pin hacia el cierre.

## Ver también

- [GEX Summary & Greeks](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
