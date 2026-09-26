# Cómo leer los gráficos de ZeroGEX

*Un vocabulario visual compartido - colores, escalas, comportamiento al pasar el cursor, leyendas y las notas específicas de cada gráfico para el perfil de gamma, el open interest, los heatmaps y el Gamma Chart.*

---

## El lenguaje de los colores

ZeroGEX utiliza una paleta pequeña y coherente en todos los gráficos. Una vez que la conoces, cada gráfico se lee más rápido.

- **Ámbar / naranja cálido** - color de acento; se usa para advertencias, énfasis de marca y la traza de la score-line.
- **Verde** - alcista, positivo, dirección long, ganancia.
- **Rojo** - bajista, negativo, dirección short, pérdida.
- **Azul / azul marino oscuro** - información estructural neutra; líneas de referencia, ejes, líneas base.
- **Coral / rosa** - informativo secundario; insignias de sesión como Pre-market, After hours y Futures.

El **significado** de los colores es estable en todos los gráficos. El mismo verde es "alcista" en todas partes. Las superficies que colorean el gamma de los dealers según su signo usan sus propias escalas, indicadas en la leyenda de cada gráfico: el heatmap de GEX en el tiempo va del azul (negativo) al naranja (positivo) pasando por el blanco, y las ribbons del Gamma Chart son doradas para gamma long y violetas para short.

### Los niveles clave

En el Gamma Chart y en los demás gráficos de precio que los dibujan, cuatro niveles tienen su propio color, separados del lenguaje alcista/bajista de arriba para que un nivel nunca se lea como una dirección:

- **Azul celeste** - el **gamma flip**. Es la frontera entre la zona de gamma larga y la de gamma corta, así que deliberadamente no es ni verde ni rojo.
- **Dorado** - el **max pain**.
- **Verde azulado** - el **pin strike**.
- **Violeta** - el **GEX king**, el nodo de gamma dominante.

El **call wall** y el **put wall** toman los colores direccionales. En el Gamma Chart se colorean según lo que hace el nivel - el call wall en rojo (resistencia por encima), el put wall en verde (soporte por debajo). Los gráficos que separan calls y puts, como las barras por strike de Dealer Positioning, mantienen las calls en verde y las puts en rojo. El **último precio negociado** en vivo toma el acento cálido de cada tema - siempre un color cálido, nunca el azul celeste del flip.

El gráfico Gamma Exposure by Strike de Dealer Positioning rotula sus líneas de referencia con texto (Spot, Flip, Call Wall, Put Wall) y dibuja su flip en ámbar, así que ahí guíate por la etiqueta.

## La score line

Cada score de las señales Basic y Advanced está en la misma escala de **−100 a +100** - el score de [-1, +1], multiplicado por 100 - con el cero en el centro.

- El signo codifica la dirección.
- La distancia al cero codifica la convicción.
- Las tarjetas de las señales Advanced indican a partir de dónde se activa la señal ("activates at ±N").
- En la línea de tiempo de eventos de una señal, el score es la línea ámbar, el cero es la línea horizontal tenue, y los triángulos marcan los cambios de dirección - verdes hacia alcista, rojos hacia bajista.

Para una lectura más profunda, consulta [Cómo leer la Score Line](/help/platform/score-line).

## El gráfico Gamma Exposure by Strike

Un elemento clásico de la página Dealer Positioning.

- **Eje X** - precio de strike.
- **Barras** - el gamma modelado de los dealers por strike en dólares, con el signo de la convención calls positivas / puts negativas: calls hacia arriba, puts hacia abajo, cada barra apilada por vencimiento con el más cercano más intenso.
- **Curva GEX Profile** - el perfil modelado de gamma de los dealers a lo largo de los precios, en su propio eje.
- **Donde la curva cruza el cero** - el gamma flip.
- **Barras altas de calls** - acumulaciones de gamma del lado call (candidatos a call wall).
- **Barras altas de puts** - acumulaciones de gamma del lado put (candidatos a put wall).
- **Líneas de referencia** - el spot, el flip y los call y put walls.

El gráfico se abre con el zoom al mínimo, mostrando todos los strikes cargados. Los botones X hacen zoom en los strikes, los botones Y amplían la escala de gamma para examinar barras pequeñas, y el botón de reinicio restablece ambos.

## El gráfico de open interest

Open Interest by Strike, también en Dealer Positioning: los contratos abiertos en cada strike, calls por encima del eje y puts por debajo, apilados por vencimiento como las barras de gamma. Alterna entre **OI** (número de contratos) y **Notional** (strike × 100 × OI); una línea punteada marca el spot. Léelo junto al gráfico de gamma - el open interest muestra dónde están los contratos, el gamma cuánto hedging implican.

## El heatmap de strike × DTE

GEX Heatmap · Strike × DTE, en la página Dealer Positioning.

- **Filas** - los strikes con más gamma en la próxima semana, el strike más alto arriba.
- **Columnas** - días al vencimiento, hasta 7DTE.
- **Color de celda** - el gamma neto de los dealers en esa combinación de strike/vencimiento: verde positivo, rojo negativo, más intenso cuanto mayor.
- **Corona** - el GEX king, el strike con el mayor gamma neto de los dealers en esos vencimientos.

Las celdas más "calientes" son los strikes que importan para los vencimientos más cercanos. Observa cómo migra el heatmap durante el día - si la celda más brillante salta de strike, el wall se está moviendo.

## El heatmap de GEX en el tiempo

GEX Heatmap Timeseries, en la página GEX Heatmap y en Dealer Positioning: los strikes en vertical, el tiempo en horizontal, cada columna el gamma neto de los dealers en ese momento - naranja positivo, azul negativo, casi blanco alrededor de cero - con las velas y el gamma flip dibujados encima. Los tramos discontinuos de la línea del flip marcan ciclos en los que el flip solo se encontró ampliando la búsqueda lejos del spot; trátalos como marginales.

## El Gamma Chart

El gráfico de precio del Gamma Terminal y el ZeroGEX Gamma Chart del Main Dashboard son el mismo gráfico: el precio del subyacente con la estructura de gamma de los dealers dibujada encima.

- **Símbolo y timeframe** - SPY, QQQ, SPX, NDX, ES o NQ, en barras de 1m, 5m, 15m, 1H o 1D.
- **Estilo de precio** - Candle, Line o Area, sobre un panel de volumen que muestra el volumen Up/Down o el neto Cumulative de la sesión.
- **Expiry** - en el gráfico en vivo, limita los niveles de gamma y el rail a los vencimientos que elijas; **All** es la cadena completa.

Las superposiciones son el toque distintivo de ZeroGEX, cada una activada con una píldora encima del gráfico:

- **Gamma Levels** - la línea del gamma flip (trazo discontinuo largo, azul celeste, etiquetada `FLIP` en el borde izquierdo) y las líneas del call wall y del put wall.
- **Gamma Rail** - el gamma de los dealers por strike, dibujado a la altura de los precios del gráfico, como silueta suavizada o como barras Net, Split o Combined. En el Gamma Terminal se sitúa en el panel junto al gráfico, donde puedes cambiarlo por dos escaleras de Net GEX alineadas por strike.
- **Max Pain** y **Pin Strike** - sus propias líneas en dorado y verde azulado; la línea del pin lleva su fuerza, como en `PIN · STRONG`.
- **VWAP** y el sombreado **Regime** - las zonas de gamma larga y gamma corta a cada lado del flip.
- Desactivadas hasta que las enciendas: **GEX King** y, en el gráfico en vivo, **Expected Range**, **Ribbons** (el gamma por strike a lo largo del tiempo, detrás del precio) y **Bar Timer**.

La línea de puntos finos en el acento cálido del tema es el **último precio negociado**, no un nivel de gamma - aparece como "Last" en la leyenda debajo del gráfico.

Las superposiciones te permiten leer la acción del precio a través de la lente del dealer positioning sin salir del gráfico. Sin un plan Basic o Pro, el Gamma Terminal muestra un snapshot con unos 15 minutos de retraso, con el símbolo y el timeframe fijos; los miembros lo ven en vivo.

### Cuando no hay línea de flip

Un nivel solo se dibuja mientras está dentro del rango de precios en pantalla, así que en un subyacente de precio alto cuyo flip está lejos del spot - NDX especialmente - la línea del flip puede quedar fuera de la escala visible. El gráfico lo dice en lugar de dejarte adivinar: un chip en el borde del área de trazado muestra `FLIP ↓ 22,600.00` con la dirección y el precio, y el eje de precios de la derecha lleva una etiqueta con flecha. Aleja el zoom del eje de precios (el botón **Price −**, Mayús+rueda, o arrastrando la escala de precios de la derecha) para traer la línea a la vista.

De vez en cuando no se puede resolver ningún flip. El resolutor solo publica un cruce por cero que esté lo bastante cerca del spot como para operarlo y respaldado por interés abierto real; cuando el spot está muy adentro de un régimen de gamma, o la cadena es fina o de un solo lado (horario extendido, un pico de volatilidad implícita), ningún cruce supera ese listón. Entonces el chip dice `FLIP UNAVAILABLE` con un `?` ámbar al lado - pasa el cursor por la marca para ver el motivo y, en ES / NQ, en qué cadena faltó el flip - y la insignia "Dealer Gamma @ Spot" muestra un simple `—`. Preferimos no dibujar nada antes que dibujar un nivel del que no nos fiamos; normalmente el flip vuelve a resolverse en un snapshot posterior.

Un flip en blanco significa algo distinto cuando el filtro **Expiry** contiene un subconjunto de la cadena. El gráfico dibuja entonces los niveles de los vencimientos que elegiste, y su flip se reconstruye solo a partir de esos strikes; pero un subconjunto suele tener un único signo (un libro 0DTE de la tarde con gamma negativa en todos los strikes nunca cruza el cero), así que no hay ningún cruce que dibujar. El chip lo dice directamente: `NO FLIP IN SELECTED EXPIRIES`. A diferencia del caso anterior, ese *no* se resolverá en un snapshot posterior, porque no falta nada. Vuelve a poner **Expiry** en **All** para ver el flip de la cadena completa: el mismo nivel que informa la página Dealer Positioning, que lee la cadena entera y por eso sigue mostrando un número mientras el gráfico está acotado.

## Comportamiento al pasar el cursor

La mayoría de los gráficos muestran un tooltip al pasar el cursor con los valores precisos en la coordenada x del cursor. El tooltip respeta el lenguaje de colores del gráfico - el color del chip de valor coincide con el de la serie.

## Leyendas

Las leyendas nombran cada serie y su color - son una clave, no un interruptor. En el Gamma Chart, las píldoras de superposición encima del gráfico son las que activan y desactivan las capas.

## Sparklines

Las tarjetas de señales en los dashboards utilizan sparklines - pequeños mini-gráficos en línea del score durante la ventana reciente. La pendiente del sparkline es más informativa que su nivel absoluto: un score en +40 con tendencia al alza es una lectura distinta de +40 con tendencia a la baja.

## Modo claro

Todos los gráficos funcionan tanto en el tema oscuro como en el claro. Las **identidades** de color se mantienen iguales; los **valores** se invierten para mantener el contraste. Verde-alcista y rojo-bajista son estables entre temas.

## Errores comunes

- **Leer el eje equivocado.** Los gráficos de score van de −100 a +100; los gráficos GEX son en dólares. No los compares entre sí.
- **Tratar un sparkline como un gráfico de trading.** Los sparklines son contexto, no señales de entrada.
- **Leer el heatmap desde lejos.** El objetivo del heatmap es la textura - acércate si las celdas son pequeñas.

## Ver también

- [Cómo leer el Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Cómo leer la Score Line](/help/platform/score-line)
