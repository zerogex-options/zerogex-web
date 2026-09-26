# Dealer Positioning

*La superficie GEX completa - Net GEX en el spot, el gamma flip, call wall y put wall, y cómo leer la term structure.*

---

## Qué muestra esta página

La página Dealer Positioning es el **mapa estructural** del libro de opciones. Cada gráfico y cada tile responde a una única pregunta: ¿dónde están posicionados los dealers y qué se verán obligados a hacer a medida que el precio se mueve?

Es la página más importante para entender el contexto, incluso si el trade en sí se ejecuta en otro lugar.

El selector **GEX unit** del encabezado cambia todas las cifras en dólares de la página entre gamma por movimiento del 1% y por 1 punto. La exposición es la misma en ambos casos; solo cambia la unidad.

## El encabezado de régimen

La parte superior de la página resume el régimen en una línea:

- **El badge** - **+ Gamma Regime** cuando el spot está por encima del gamma flip, **- Gamma Regime** cuando está por debajo, **~ Gamma Regime** cuando el spot está a menos de un 0,25% aproximado del flip, y **? Gamma Regime** cuando en este snapshot no se pudo resolver ningún flip.
- **El gamma flip** - el nivel y cuántos puntos está el spot por encima o por debajo de él.
- **El escenario** - **Positive GEX (pinned, low vol)**, **Negative GEX (trending, high vol)**, **At the Flip (neutral, transition)** o **Flip unresolved this snapshot**.
- **Una etiqueta de postura** - **Aggressive**, **Balanced** o **Defensive** - construida a partir del signo del gamma en el spot, el IV rank y la vanna.
- **Market Context** - la misma lectura en lenguaje llano, con selector entre **Intraday** y **Swing**.

El régimen se lee únicamente a partir del spot frente al flip, no del signo del total de toda la cadena, así que el badge y el flip no pueden contradecirse.

### Gamma Flip

El nivel de precio en el que la curva modelada de gamma de los dealers cruza cero. Es la línea de régimen: por encima, el hedging modelado *tiende* a ser estabilizador; por debajo, amplificador. Como es el cruce por cero de un perfil modelado, puede desplazarse con la convención de signos, los vencimientos y la IV - interpreta un cruce como un cambio en la tendencia agregada de hedging del modelo, no como un paso garantizado de la reversión a la media a la tendencia.

## Los tiles principales

### Net GEX

El valor de dollar-gamma de todas las opciones abiertas, con el signo de la convención de posicionamiento de dealers modelada por ZeroGEX (calls +, puts −), evaluado **al precio spot actual**. Positivo ⇒ los dealers están *según el modelo* net long gamma; negativo ⇒ *según el modelo* net short.

> Es una estimación: el gamma de los dealers se modela con la convención tradicional de open interest (calls positivas, puts negativas). El inventario real de los dealers no es directamente observable a partir de los datos públicos de la cadena de opciones.

El número que ves aquí se mide en el spot, no se suma a lo largo de toda la cadena - esto es importante porque el signo en el spot marca la tendencia de hedging modelada de los dealers en este momento, independientemente de lo que haga la curva acumulada en otros precios. El badge de al lado sitúa la lectura frente a los últimos 30 días (NORMAL, ELEVATED, EXTREME HIGH, etc.).

### IV Rank

Dónde se sitúa la volatilidad implícita en una escala de 0-100%, a partir del VIX (VXN para QQQ, NDX y NQ). 0% es históricamente tranquilo; 100% es miedo extremo.

### Vanna Flow y Charm Decay

La vanna neta y el charm neto sumados en todos los strikes, mostrados como etiqueta - **+Tailwind**, **-Headwind** o **Neutral** para la vanna; **Bullish**, **Bearish** o **Neutral** para el charm. Indican si los movimientos de la volatilidad implícita y el paso del tiempo, según el modelo, añaden o restan presión direccional de delta.

El max pain y el pin strike no están en esta página - consulta [GEX Summary](/help/platform/gex-summary) y [Max Pain](/help/platform/max-pain).

## El gráfico Gamma Exposure by Strike

El gráfico principal. Strike en el eje x; el gamma modelado de los dealers por strike como barras - calls hacia arriba, puts hacia abajo - con la curva **GEX Profile** superpuesta en su propio eje. Tres cosas a leer:

1. **Dónde cruza cero la curva GEX Profile** - el gamma flip.
2. **La mayor acumulación de call gamma en el spot o por encima** - el call wall.
3. **La mayor acumulación de put gamma en el spot o por debajo** - el put wall.

Las líneas de referencia marcan el spot, el flip y los dos walls. Cada barra se apila por vencimiento - el más cercano (0DTE) más intenso, el más lejano más tenue - para que veas cuánto gamma de un strike vence pronto. El selector de vencimientos limita las barras, la curva, los walls y el flip a los vencimientos que elijas, y la elección se aplica también a los demás gráficos que comparten el filtro de vencimientos. El gráfico se abre con el zoom al mínimo, mostrando todos los strikes cargados; los botones de zoom X e Y y las barras de desplazamiento lo acotan.

### Call Wall / Put Wall

Los strikes con el mayor gamma del lado call y del lado put. A menudo actúan como fricción intradía - pero el tipo de opción por sí solo no fija la dirección; que un wall actúe como resistencia, soporte, imán o acelerador depende del signo modelado del gamma de los dealers y del flujo que lo rodea. El comportamiento de "muro" es más marcado cuando los dealers están, según el modelo, long gamma.

## El gráfico Open Interest by Strike

Los contratos detrás del gamma: el open interest en cada strike, calls por encima del eje y puts por debajo, apilado por vencimiento de la misma forma. Alterna entre **OI** (contratos abiertos) y **Notional** (strike × 100 × OI). Una gran acumulación de open interest lejos del spot puede tener poco gamma - por eso los walls se clasifican por gamma, no por open interest.

## Los heatmaps de GEX

Dos heatmaps muestran cómo se reparte el gamma en el tiempo y entre vencimientos:

- **GEX Heatmap Timeseries** - el gamma neto de los dealers por strike a lo largo de la sesión, naranja para positivo y azul para negativo, con las velas del precio y el gamma flip dibujados encima. Es el mismo gráfico que la página independiente GEX Heatmap.
- **GEX Heatmap · Strike × DTE** - el gamma neto de los dealers para los strikes con más gamma en la próxima semana (filas, el strike más alto arriba) frente a los días al vencimiento (columnas, hasta 7DTE). Verde es positivo, rojo negativo, y cuanto más intenso, mayor. Una corona marca el **GEX King** - el strike con el mayor gamma neto de los dealers en esos vencimientos cercanos.

Útil para:

- Detectar el **comportamiento de pin en 0DTE** aislado del libro más amplio.
- Detectar si un wall está concentrado en el vencimiento más cercano (transitorio) o repartido en los posteriores (más persistente).

Los heatmaps se actualizan durante la sesión a medida que el spot, el tiempo y la IV desplazan el gamma modelado - observar su movimiento es informativo.

## El resto de la página

- **Charm & Vanna Flows** - vanna y charm agregados en toda la cadena, una estimación del charm de fin de día para la presión de hedging hacia el cierre y una lectura del riesgo de expansión de volatilidad.
- **Volatility Surface** - la volatilidad implícita por strike para vencimientos cercanos frente a vencimientos más lejanos.
- **GEX Metrics Snapshot** - la tabla strike por strike: net GEX, vanna, charm, open interest y volumen, centrada en el spot y con el flip y los walls marcados. Fíltrala por vencimiento; el selector **Strikes** oculta los strikes sin open interest.

## Cómo leer el dealer positioning en tres pasos

1. **¿Dónde está el spot respecto al flip?** Por encima ⇒ tendencia modelada a la estabilización; por debajo ⇒ tendencia modelada a la amplificación.
2. **¿Dónde están los walls?** El call wall es tu fricción al alza; el put wall es tu fricción a la baja.
3. **¿Cómo migra el heatmap?** Si el call wall sube, el strike del call wall modelado (donde el gamma del lado call alcanza su máximo) está subiendo a medida que se desplazan el spot, el gamma, el tiempo y la IV - una inclinación estructural alcista. El wall puede moverse sin nuevo open interest: sigue el punto donde culmina la exposición modelada, no un OI intradía verificado.

## Por qué el cálculo del gamma flip de ZeroGEX es diferente

El flip se calcula a partir de un **perfil de gamma de dealers con spot desplazado** - no de una aproximación basada en el Net GEX acumulado. Para la metodología y la comparación antes/después, consulta [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Lecturas comunes

- **Spot muy por encima del flip, call wall cerca por arriba** ⇒ pin hacia el cierre, fade de las extensiones.
- **Spot por debajo del flip, put wall cerca por abajo** ⇒ sesgo de tendencia; se espera amplificación ante una ruptura.
- **Spot cerca del flip con volatilidad en aumento** ⇒ riesgo de cambio de régimen; reduce el tamaño o espera.
- **Concentración del heatmap en strikes de call 0DTE cerca del spot** ⇒ presión de pin hacia el cierre.

## Ver también

- [GEX Summary](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
