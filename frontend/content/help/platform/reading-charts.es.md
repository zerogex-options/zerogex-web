# Cómo leer los gráficos de ZeroGEX

*Un vocabulario visual compartido — colores, escalas, comportamiento al pasar el cursor, leyendas y las notas específicas de cada gráfico para el perfil GEX, los walls y los heatmaps.*

---

## El lenguaje de los colores

ZeroGEX utiliza una paleta pequeña y coherente en todos los gráficos. Una vez que la conoces, cada gráfico se lee más rápido.

- **Ámbar / naranja cálido** — color de acento; se usa para advertencias, énfasis de marca y la traza de la score-line.
- **Verde** — alcista, positivo, dirección long, ganancia.
- **Rojo** — bajista, negativo, dirección short, pérdida.
- **Azul / azul marino oscuro** — información estructural neutra; líneas de referencia, ejes, líneas base.
- **Coral / rosa** — informativo secundario; etiquetas smart-money, resaltados especiales.

El **significado** de los colores es estable en todos los gráficos. El mismo verde es "alcista" en todas partes.

## La score line

Cada score de señal se representa en el mismo eje y **[-1, +1]** con la línea del cero en el centro. El sombreado de fondo cerca de los umbrales de disparo recuerda dónde la señal se vuelve accionable.

- El color de la traza codifica la magnitud.
- El signo codifica la dirección.
- Una línea discontinua horizontal en el umbral de disparo hace visible el cruce.

Para una lectura más profunda, consulta [Cómo leer la Score Line [-1, +1]](/help/platform/score-line).

## El gráfico de perfil GEX

Un elemento clásico de la página Dealer Positioning.

- **Eje X** — precio de strike.
- **Eje Y** — gamma del dealer en dólares, con signo.
- **Línea vertical** — spot actual.
- **Donde la curva cruza el cero** — el gamma flip.
- **Barras positivas altas** — candidatos a call wall.
- **Barras negativas altas** — candidatos a put wall.

El gráfico se autocentra en el spot. El rango predeterminado es de aproximadamente ±5 % desde el spot — lo suficientemente amplio para ver los walls estructurales, lo suficientemente estrecho para mantener legibles los strikes relevantes.

## El gráfico de walls

Los mismos datos que el perfil GEX pero con la estructura de walls resaltada: el call wall, el put wall, el max pain y el gamma flip superpuestos en el mismo eje. Úsalo cuando quieras una sola imagen que capture toda la lectura estructural.

## El heatmap de strike × DTE

Un heatmap 2D en la página Dealer Positioning.

- **Filas** — strike (ordenados alrededor del spot).
- **Columnas** — DTE (0DTE, 1DTE, semanal, mensual).
- **Color de celda** — gamma del dealer en esa combinación de strike/vencimiento.

Las celdas más "calientes" son los strikes que importan para los vencimientos más cercanos. Observa cómo migra el heatmap durante el día — si la celda más brillante salta de strike, el wall se está moviendo.

## El gráfico de velas

Velas OHLC estándar con VWAP y las superposiciones de gamma. Las superposiciones son el toque distintivo de ZeroGEX:

- La línea de **gamma flip**.
- Las líneas de **call wall** y **put wall**.
- **Max pain** (donde sea relevante).

Las superposiciones te permiten leer la acción del precio a través de la lente del dealer positioning sin salir del gráfico.

## Comportamiento al pasar el cursor

La mayoría de los gráficos muestran un tooltip al pasar el cursor con los valores precisos en la coordenada x del cursor. El tooltip respeta el lenguaje de colores del gráfico — el color del chip de valor coincide con el de la serie.

## Leyendas

Las leyendas son clicables en la mayoría de los gráficos — haz clic en una serie para ocultarla. Útil para aislar una sola señal o un solo greek.

## Sparklines

Las tarjetas de señales en los dashboards utilizan sparklines — pequeños mini-gráficos en línea del score durante la ventana reciente. La pendiente del sparkline es más informativa que su nivel absoluto: un score en +0.4 con tendencia al alza es una lectura distinta de +0.4 con tendencia a la baja.

## Modo claro

Todos los gráficos funcionan tanto en el tema oscuro como en el claro. Las **identidades** de color se mantienen iguales; los **valores** se invierten para mantener el contraste. Verde-alcista y rojo-bajista son estables entre temas.

## Errores comunes

- **Leer el eje equivocado.** Los gráficos de score son [-1, +1]; los gráficos GEX son en dólares. No los compares entre sí.
- **Tratar un sparkline como un gráfico de trading.** Los sparklines son contexto, no señales de entrada.
- **Leer el heatmap desde lejos.** El objetivo del heatmap es la textura — acércate si las celdas son pequeñas.

## Ver también

- [Cómo leer el Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Cómo leer la Score Line [-1, +1]](/help/platform/score-line)
