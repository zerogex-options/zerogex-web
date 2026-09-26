# GEX Summary

*Las cifras principales de GEX y los niveles que implican, en una sola pantalla - además de cómo se sostiene el gamma flip en distintos horizontes y si el gamma de los dealers de hoy es inusual.*

---

## Qué muestra esta página

La página GEX Summary es la vista **en cifras** del libro de opciones. Mientras que Dealer Positioning es estructural (perfil, walls, heatmaps), esta página reúne diez cifras principales en una sola pantalla y después muestra cómo cambia el gamma flip entre horizontes de opciones y cómo se compara el gamma de los dealers de hoy con su propio historial.

El selector **GEX unit** del encabezado cambia todas las cifras de GEX en dólares entre gamma por movimiento del 1% (por defecto) y por 1 punto. La exposición es la misma en ambos casos; solo cambia la unidad.

## La fila superior

### Precio

El precio en vivo del símbolo activo. Cuando el mercado de contado está cerrado y el precio viene de los futuros, la tarjeta lo indica y nombra el contrato - los niveles de GEX se mantienen en el índice de contado.

### Net GEX

El gamma modelado de los dealers en dólares, con la convención tradicional de open interest (calls positivas, puts negativas). Bajo esa convención, un net GEX positivo es coherente con que los dealers *tiendan* a comprar en la debilidad y vender en la fortaleza; uno negativo, con que *tiendan* a perseguir el precio. Se muestra en el spot - el valor coherente en signo con el gamma flip, no el total de toda la cadena.

> El Net GEX es una **estimación**: modela el gamma de los dealers con la convención calls positivas / puts negativas. El inventario real de los dealers no es directamente observable a partir de los datos públicos de la cadena de opciones.

### Gamma Flip

El flip estructural: el precio en el que el gamma agregado modelado de los dealers cambia de signo, calculado con una ponderación por horizonte que resta peso a los walls 0DTE de vencimiento cercano. Por encima, el hedging modelado *tiende* a amortiguar los movimientos; por debajo, a amplificarlos. **Raw nearest**, debajo, es el cruce más cercano en el perfil sin ponderar - la convención que publican muchos otros dashboards. Sin la ponderación, los walls de vencimiento cercano pueden acercarlo mucho más al spot que el flip estructural.

### Max Pain

El strike en el que el pago a los tenedores de opciones al vencimiento es el más pequeño. Consulta [Max Pain](/help/platform/max-pain) para saber cuándo importa y cuándo no.

### Pin Strike

El strike 0DTE alcanzable con el gamma positivo modelado de los dealers más fuerte hacia el cierre, con su fuerza (Strong, Moderate o Weak) y el porcentaje de confianza. Consulta [Pin Strike](/help/platform/pin-strike) para ver cómo se calcula y qué significa realmente "Weak".

## La fila inferior

- **Call GEX** y **Put GEX** - la exposición gamma total modelada de las calls y de las puts, las dos mitades detrás del Net GEX.
- **Put/Call Ratio** - volumen de puts dividido por volumen de calls. Por encima de 1 se inclina a bajista; por debajo de 1, a alcista.
- **Call Wall (Resistance)** y **Put Wall (Support)** - el strike en el spot o por encima con el mayor call gamma y el strike en el spot o por debajo con el mayor put gamma, cada uno sumado sobre el vencimiento de hoy y los dos siguientes (0-2DTE), con la distancia al spot. Un gráfico limitado solo a 0DTE puede mostrar otro strike. Las etiquetas son la lectura habitual, no una garantía: que un wall aguante depende del signo modelado del gamma de los dealers y del flujo que lo rodea.

## Gamma Flip · Term Structure

El gamma flip de hoy, resuelto por separado para cada horizonte de opciones - de 1 a 60 días por defecto, con los presets **Std**, **Short** y **Long**. Cada punto se colorea según el signo del gamma de los dealers en el spot. Los contornos en rombo marcan el flip registrado hace ese mismo número de días, y una X roja señala un horizonte en el que no se pudo resolver ningún cruce. Úsalo para ver si el flip se sostiene entre horizontes o es un efecto de vencimiento cercano.

## Horizon × Price Contour

La misma pregunta como superficie: el gamma modelado de los dealers a lo largo de precios spot hipotéticos (x) y horizontes de opciones (y). Las celdas azules son long gamma (estabilizadoras), las rojas short gamma (desestabilizadoras), y una línea negra sigue el cruce por cero - el flip en cada horizonte. Unas guías marcan el spot actual y los call y put walls más pesados.

## Gamma Pulse

*"Is current dealer gamma irregular?"* El Net GEX en el spot y el net GEX total de la cadena, cada uno situado frente a los últimos 30 días y frente a todo el historial - **EXTREME HIGH**, **ELEVATED**, **NORMAL**, **LOW** o **EXTREME LOW** - con un trofeo cuando una lectura marca un récord. La comparación tiene en cuenta la hora del día, así que el pin habitual del final de la sesión no se marca como inusual.

## Convenciones de signo

ZeroGEX asigna el signo de cada greek desde una perspectiva de dealer modelada - la misma convención en todas partes, no inventario observado:

- Gamma positivo ⇒ bajo la convención calls positivas / puts negativas, los dealers están *según el modelo* netos largos en calls / cortos en puts, y cubren su posición contra el precio.
- Gamma negativo ⇒ los dealers están *según el modelo* netos cortos de gamma, y cubren su posición a favor del precio.

Cuando consultes a otro proveedor de datos de GEX, verifica siempre la convención de signos. La mayoría usa el mismo signo basado en la perspectiva del dealer, pero algunos lo invierten.

## Cómo leer la página

Dos patrones:

1. **Verificación cruzada con Dealer Positioning.** Si el Net GEX es significativamente positivo pero el perfil GEX muestra que la curva cruza a negativo justo por debajo del spot, estás sobre la línea de régimen - el riesgo es asimétrico.
2. **Compara el flip con Raw nearest.** Cuando los dos están muy separados, es el gamma de vencimiento cercano el que tira. La term structure del flip muestra si el nivel se sostiene entre horizontes.

## Ver también

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Vanna y Charm explicados para traders de opciones](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) explicado](/education/gamma-exposure-explained)
