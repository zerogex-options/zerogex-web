# Usar el Gamma Terminal

*Una guía de cada panel, control y superposición del gráfico en el Gamma Terminal: qué muestra cada uno, cómo leerlo y lo que no puede decirte.*

---

## Para qué sirve el Gamma Terminal

El [Gamma Terminal](/chart) reúne en una sola pantalla el precio y el gamma modelado de los dealers. Las velas muestran lo que está haciendo el precio. Las líneas, el sombreado y los paneles que las rodean muestran dónde, según el modelo, el hedging de los dealers de opciones es más intenso, y si ese hedging está amortiguando los movimientos o sumándose a ellos en este momento.

Cada cifra de gamma de la página es una estimación. Los datos públicos de opciones muestran cuántos contratos hay abiertos en cada strike, pero no quién los tiene, así que ZeroGEX aplica la convención estándar de que los dealers están netos largos en las calls y netos cortos en las puts. Lee los niveles como contexto para tus propias decisiones, no como una medición del libro de órdenes ni como un objetivo de precio. La página [Metodología y validación](/methodology) explica el modelo.

De arriba abajo, la página tiene:

1. **Key Levels** - las seis cifras que más importan, con su distancia al precio.
2. **About this terminal** - una breve descripción, contraída para los miembros.
3. **Beside the tape** - un selector para el panel junto al gráfico: **Gamma Ladders** o **Strike Panel**.
4. **El Gamma Chart** - velas con los niveles de gamma y las superposiciones dibujados encima, y el panel que elegiste a su derecha (debajo, en pantallas más estrechas).
5. **What you're looking at** - seis tarjetas que resumen las funciones principales.
6. **Playbook** - lo que implica el régimen actual cuando el precio se acerca a un wall.

Los miembros Basic y Pro ven el terminal en vivo. Todos los demás ven una vista previa gratuita de SPY con unos 15 minutos de retraso; consulta [Vista previa gratuita frente a la versión en vivo](/help/platform/gamma-terminal#vista-previa-gratuita-frente-a-la-version-en-vivo).

## Tus primeros cinco minutos

1. **Elige un subyacente.** Usa los botones de símbolo del gráfico, el desplegable de la primera escalera o las flechas de la franja Key Levels. Cualquiera de ellos cambia toda la página.
2. **Lee el régimen.** El recuadro **Dealer Gamma @ Spot**, arriba a la derecha del gráfico, indica **LONG Γ** o **SHORT Γ**. En long gamma, según el modelo, el hedging de los dealers contrarresta los movimientos (pinning). En short gamma, según el modelo, se suma a ellos (tendencia). El fondo teñido del gráfico dice lo mismo.
3. **Localiza las líneas clave.** La línea `FLIP` azul celeste es donde cambia el régimen. El `CALL WALL` rojo por encima del precio y el `PUT WALL` verde por debajo son los strikes con más gamma de calls y de puts. Las tarjetas de Key Levels dan la distancia exacta a cada uno.
4. **Mira junto al gráfico.** Las escaleras listan el gamma neto de los dealers en cada strike cercano al precio, alineadas con el gráfico. Los valores más grandes son los strikes con más hedging asociado.
5. **Añade lo que necesites.** Activa **Expected Range** para ver el movimiento que descuenta la volatilidad implícita, **Centroids** para ver dónde se centra hoy la negociación de opciones, o **PD/PM Levels** para el máximo, el mínimo y el cierre del día anterior.
6. Usa **Rewind** para volver a ver cómo se movieron el precio y el libro de gamma a lo largo de la sesión.

## La franja Key Levels

La franja de la parte superior muestra los seis niveles que dibuja el gráfico, para el símbolo y el filtro de vencimientos del gráfico.

- **Spot** - el precio actual y su variación respecto al cierre anterior.
- **Gamma Flip** - el precio en el que el gamma neto modelado de los dealers cambia de signo.
- **Pin Strike** - el strike cercano del mismo día (0DTE) hacia el que, según el modelo, el gamma de los dealers atrae el precio con más fuerza de cara al cierre, con una etiqueta de fuerza.
- **Call Wall** - el strike con el mayor gamma de calls en el precio o por encima de él.
- **Put Wall** - el strike con el mayor gamma de puts en el precio o por debajo de él.
- **Max Pain** - el strike en el que los tenedores de opciones cobrarían menos al vencimiento.

Cada tarjeta muestra el nivel y su distancia al precio en dólares y en porcentaje, con una flecha verde cuando el nivel está por encima del precio y una roja cuando está por debajo. Pasa el cursor por una tarjeta para ver su definición completa. El encabezado indica los vencimientos de los que salen los niveles y lleva un chip **LONG Γ** o **SHORT Γ**.

Cuando una tarjeta muestra un guion en lugar de un número, la nota de debajo explica por qué:

- **Unresolved this snapshot** - esta vez el modelo no devolvió ningún nivel, por lo general porque la cadena de opciones era fina. Pasa el cursor por el **?** ámbar para ver los detalles. Normalmente vuelve a aparecer en una actualización posterior.
- **No flip in selected expiries** - los vencimientos que elegiste nunca cambian de signo. Consulta [El filtro Expiry](/help/platform/gamma-terminal#el-filtro-expiry).
- **No active pin** - ahora mismo ningún strike cercano del mismo día cumple los requisitos para ser un pin.

Los miembros tienen aquí tres cosas más. En escritorio, pasa el cursor por la franja para ver unas flechas que recorren los símbolos; en el móvil, deslízala. Toda la página cambia con ella. La campana de las tarjetas Call Wall y Put Wall crea una [alerta](/help/platform/alerts) para cuando el precio llegue a ese wall. Y la tarjeta Pin Strike indica cuánto tiempo lleva vigente el pin actual, como en "Held since 09:41".

## Gamma Ladders y el Strike Panel

El panel junto al gráfico muestra el libro de gamma de los dealers por strike de una de dos maneras. Elige una con el selector **Gamma Ladders** / **Strike Panel** sobre el gráfico. El gráfico en sí no cambia en ningún caso, y tu elección queda guardada.

### Gamma Ladders

Dos escaleras, una al lado de la otra. Cada fila es un strike, con el más alto arriba, y su número es el **gamma neto de los dealers** en ese strike. Por defecto se expresa en dólares por movimiento del 1 %: aproximadamente el importe en acciones que los dealers tendrían que negociar en ese strike para seguir cubiertos si el precio se moviera un 1 %.

- Las **filas naranjas** son long gamma (positivo) y las **filas azul marino** son short gamma (negativo). Cuanto más intenso es el color, mayor es el número.
- La fila cuyo strike aparece en una píldora resaltada es el strike más cercano al precio. En pantallas anchas queda a la misma altura que el precio en el gráfico.
- Las etiquetas `GF`, `CW`, `PW` y `MP` marcan el Gamma Flip, el Call Wall, el Put Wall y el Max Pain en la fila más cercana. El encabezado lista sus valores, o `NA` cuando un nivel no está disponible.
- La **corona** marca el strike de mayor peso visible en esa escalera. No es el GEX King del gráfico, que es el strike de mayor peso de toda la cadena.
- El chip **LONG Γ** / **SHORT Γ** de cada encabezado compara el precio con el flip de ese símbolo.

La primera escalera es la del símbolo del gráfico. La segunda compara cualquier otro símbolo y empieza en el libro equivalente: SPY con SPX, QQQ con NDX, ES con SPX, NQ con NDX y NVDA con QQQ. [Niveles de gamma de SPY vs SPX](/education/spy-vs-spx-gamma-levels) explica por qué dos libros sobre el mismo índice se leen de forma distinta.

Los controles de la parte superior del panel:

- **Strikes: Active / All** - **Active** (la opción predeterminada) oculta los strikes sin open interest. **All** muestra todos los strikes listados cerca del precio.
- **Session Δ: On / Off** - marca cada strike con un ▲ verde donde el gamma de los dealers ha crecido desde la apertura de las 9:30 AM ET, o con un ▼ rojo donde se ha reducido. Los cambios pequeños quedan sin marcar. Solo en vivo.
- **Unit: 1% / 1pt** - muestra el gamma por movimiento del 1 % (la opción predeterminada) o por movimiento de 1 punto. La misma exposición, en otra unidad. Este ajuste se aplica en todo el sitio.

Una nota ámbar "Positioning as of 15:55 ET" significa que las últimas actualizaciones no traían posicionamiento (tras el cierre de las opciones, por ejemplo), así que la escalera muestra la más reciente que sí lo traía. Los niveles de su encabezado siguen en vivo.

### Strike Panel

El mismo libro, en forma de imagen: el gamma neto de los dealers en cada precio. En pantallas anchas se dibuja sobre la propia escala de precios del gráfico, así que cada strike queda a la altura de ese precio en las velas.

Hay cuatro vistas, que se eligen en la parte superior del panel:

- **Silhouette** (la predeterminada) - una curva suavizada. El lóbulo verde de la derecha es long gamma, el lóbulo rojo de la izquierda es short gamma, y unos puntos marcan el pico más alto de cada lado.
- **Net** - una barra por strike: verde hacia la derecha para long gamma, roja hacia la izquierda para short.
- **Split** - calls y puts por separado: una barra verde de calls a la derecha y una barra roja de puts a la izquierda.
- **Combined** - las barras de Split más una barra neta violeta.

Un eje estrecho a lo largo del borde izquierdo del panel rotula los strikes. Cuando están demasiado juntos para rotularlos todos, rotula en su lugar uno de cada 2, 5 o 10 strikes, y el strike que está bajo tu puntero siempre lleva rótulo.

En Split y Combined, cada barra se sombrea por vencimiento: más intensa junto a la línea central para el vencimiento más cercano y más tenue en la punta para el más lejano. **Labels** muestra cifras en dólares sobre las barras. Se ocultan cuando los strikes están demasiado juntos, así que acerca el zoom del eje de precios para que vuelvan a aparecer. Una línea discontinua azul celeste marca el flip.

Pasa el cursor por un strike, o tócalo en el móvil, para ver su tarjeta: el gamma de calls, de puts y neto, el open interest y la ratio put/call, su peso frente al strike de mayor peso a la vista, su distancia al precio y cualquier nivel que haya en él. "Long Γ · magnet / brake" y "Short Γ · accelerant" describen lo que, según el modelo, hace el hedging de los dealers en ese strike: contrarrestar los movimientos o sumarse a ellos.

La vista previa gratuita solo muestra la vista Silhouette.

## El encabezado del gráfico

- **Insignia de sesión** - **● LIVE** en la sesión regular, **○ PRE-MARKET** y **○ AFTER HOURS** en horario extendido, **CLOSED** cuando el mercado está cerrado, **◀ REWIND** mientras se repite la sesión y **◷ DELAYED ~15 MIN** en la vista previa gratuita. **◆ FUTURES** aparece en un índice cash fuera del horario regular, cuando el precio principal es el del contrato de futuros; las velas siguen siendo las del índice.
- **Precio y variación** - la variación es respecto al cierre de la sesión regular anterior. Fuera del horario regular, el precio principal se queda en el cierre de las 4:00 PM, y SPY, QQQ y NVDA añaden una segunda línea con el precio del horario extendido.
- **Updated** - cuándo llegó el último tick de precio.
- **Dealer Gamma @ Spot** - **LONG Γ** o **SHORT Γ**, y el gamma neto de los dealers al precio actual en dólares, como +$1.23B. Este recuadro es la lectura del régimen para toda la página. Con un filtro Expiry aplicado, muestra la cifra propia de los vencimientos seleccionados y los nombra.
- **En ES y NQ** - un chip **IMPLIED FROM SPX** (o **NDX**) y el código del contrato de futuros. Consulta [ES y NQ](/help/platform/gamma-terminal#es-y-nq).

## La barra de herramientas

- **Símbolo** - SPY, QQQ, SPX, NDX, ES, NQ y NVDA. Cambiar de símbolo restablece el zoom, sale de Rewind y devuelve el filtro Expiry a All, salvo que esté en 0DTE.
- **Timeframe** - barras de **1M**, **5M**, **15M**, **1H** o **1D**. El gráfico se abre en 5M en cada visita.
- **Estilo** - **Candle**, **Line** o **Area**. Una vela es verde si cerró igual o por encima del cierre anterior, y roja si cerró por debajo. Es hueca si cerró igual o por encima de su propia apertura.
- **VOL** - el ojo muestra u oculta el panel de volumen. Consulta [Panel de volumen](/help/platform/gamma-terminal#panel-de-volumen).
- **Píldoras de superposición** - una por superposición. Consulta [Las superposiciones](/help/platform/gamma-terminal#las-superposiciones). En el móvil, los controles de superposiciones, estilo, volumen y Expiry están dentro de **Layers**, que indica cuántas superposiciones están activadas.
- **Expiry** - qué vencimientos alimentan los niveles de gamma. Consulta [El filtro Expiry](/help/platform/gamma-terminal#el-filtro-expiry).
- **Reset** - aparece cuando has hecho zoom o te has desplazado, y vuelve a la vista en vivo.
- **Save** - descarga el gráfico como imagen PNG: las velas, las líneas, las etiquetas y los ejes, sin la barra de herramientas, la leyenda ni el panel junto al gráfico.

## Las superposiciones

Cada superposición tiene una píldora en la barra de herramientas. Haz clic en ella para activar o desactivar la superposición; el gráfico recuerda tus elecciones. La leyenda bajo el gráfico es una clave de colores, no un interruptor.

| Superposición | Qué dibuja | Activada por defecto | Dónde funciona |
|---|---|---|---|
| Gamma Levels | Las líneas del Gamma Flip, el Call Wall y el Put Wall | Sí | En todas partes |
| Regime | El sombreado de fondo de long gamma y de short gamma | Sí | En todas partes |
| Ribbons | El gamma de cada strike a lo largo del tiempo, detrás de las velas | Sí | En vivo |
| VWAP | El precio medio ponderado por volumen de la sesión | Sí | En todas partes |
| Max Pain | El strike de max pain | Sí | En todas partes |
| Pin Strike | El pin strike de hoy y su fuerza | Sí | En vivo |
| GEX King | El strike de mayor gamma de toda la cadena | No | En vivo |
| PD/PM Levels | El máximo, el mínimo y el cierre del día anterior; el máximo y el mínimo del pre-market | No | En vivo: SPY, QQQ, NVDA |
| Expected Range | El movimiento de ±1σ que descuenta la volatilidad implícita | No | En vivo, salvo NVDA |
| Centroids | Dónde se centra hoy la negociación de calls y de puts | No | En vivo, barras de 1M a 1H |
| Bar Timer | El tiempo que le queda a la vela actual | No | En vivo |

Algunas cosas se cumplen en todas las líneas de nivel:

- Cada nivel es una línea discontinua que cruza el gráfico, con su nombre en un chip en el borde izquierdo y su precio en una etiqueta en el eje derecho.
- Un nivel fuera del rango de precios en pantalla aparece como una etiqueta fijada arriba o abajo del eje, marcada con ▲ o ▼. Aleja el zoom del eje de precios para ver la línea en sí.
- El flip, los walls y el VWAP amplían el eje de precios para seguir a la vista cuando están razonablemente cerca del precio, y lo mismo hacen las líneas de PD/PM y de Centroids mientras están activadas. Max Pain, Pin Strike, GEX King y las líneas de Expected Range nunca lo hacen, así que a menudo solo aparecen como etiquetas con flecha.
- Cuando el precio está a menos de aproximadamente un 0,12 % de un nivel, la línea de ese nivel se dibuja más gruesa.

### Gamma Levels

Tres líneas:

- **Gamma Flip** (`FLIP`, azul celeste, trazo discontinuo largo) - el precio en el que el gamma neto modelado de los dealers cambia de signo.
- **Call Wall** (`CALL WALL`, rojo, trazo discontinuo corto) - el strike con la mayor exposición gamma de calls en el precio o por encima de él.
- **Put Wall** (`PUT WALL`, verde, trazo discontinuo corto) - el strike con la mayor exposición gamma de puts en el precio o por debajo de él.

Los walls se colorean según lo que hacen, no según sean de calls o de puts. El wall rojo de arriba es donde, según el modelo, las ventas de los dealers contrarrestan una subida; el wall verde de abajo es donde, según el modelo, sus compras contrarrestan una caída.

**Cómo leerlas.** Por encima del flip, el modelo sitúa a los dealers en long gamma: su hedging vende las subidas y compra las caídas, lo que amortigua los movimientos. Por debajo, los sitúa en short gamma: su hedging persigue el movimiento, lo que lo amplifica. Cuanto más cerca está el precio del flip, más cerca está el mercado de un cambio de régimen.

Los walls son el lugar donde se concentra más hedging. A menudo actúan como resistencia y soporte: en nuestro estudio de 737 pruebas de walls, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora y los del Nasdaq, aproximadamente la mitad, independientemente del lado del gamma flip en que estuviera el precio. Trata un wall como un nivel que vigilar, no como un lugar donde el precio tenga que detenerse. Consulta [¿Con qué frecuencia se rompen realmente los gamma walls?](/education/how-often-do-gamma-walls-break) y [Gamma Walls explicados](/education/gamma-walls-explained).

**Cómo se eligen los walls.** No saltan con cada tick. Un wall se vuelve a elegir en cuanto el precio lo atraviesa y, si no, cada 15 minutos. En cada nueva elección, el wall actual conserva su sitio mientras siga teniendo al menos tres cuartas partes del gamma del strike de mayor peso de su lado.

**Cuando falta la línea del flip**, un chip cerca de la parte inferior del gráfico explica por qué:

- `FLIP ↑ 7,750.00` o `FLIP ↓ 22,600.00` - el flip está por encima o por debajo de los precios en pantalla. Aleja el zoom del eje de precios con **Price −**, Mayús + rueda o arrastrando la escala de precios de la derecha.
- `FLIP UNAVAILABLE` - el modelo no encontró ningún cruce del que se fíe: uno lo bastante cerca del precio como para importar y respaldado por open interest real. Ocurre cuando el precio está muy dentro de un régimen o la cadena es fina, como en horario extendido o durante un pico de volatilidad. Normalmente se resuelve en una actualización posterior. Pasa el cursor por el **?** ámbar para ver los detalles.
- `NO FLIP IN SELECTED EXPIRIES` - consulta [El filtro Expiry](/help/platform/gamma-terminal#el-filtro-expiry).

Sin flip, el gráfico tampoco puede dibujar el sombreado Regime.

### Regime

**Qué muestra.** El fondo del gráfico se tiñe de verde en el lado long gamma del flip y de rojo en el lado short gamma. En pantallas más anchas, los tintes llevan las etiquetas `LONG Γ · PINNING` y `SHORT Γ · TRENDING`.

**Cómo leerlo.** En long gamma, según el modelo, el hedging de los dealers contrarresta los movimientos, lo que tiende a amortiguar la volatilidad y a anclar el precio. En short gamma, se suma a los movimientos, lo que tiende a amplificarlos. [¿Qué es el gamma negativo?](/education/what-is-negative-gamma) y [Cómo operar en torno al Gamma Flip](/education/how-to-trade-around-gamma-flip) profundizan en ello.

**A tener en cuenta.**

- La banda que contiene el precio siempre coincide con el recuadro **Dealer Gamma @ Spot**. Normalmente eso significa long gamma por encima del flip y short gamma por debajo, pero con un libro irregular el sombreado puede ir al revés. Guíate por el recuadro.
- Si te desplazas o haces zoom de modo que el flip queda fuera de la pantalla, toda la vista toma un solo tinte. Describe los precios en pantalla, que pueden no coincidir con donde está ahora el precio.
- Sin flip, no hay sombreado.

### Ribbons

**Qué muestra.** Cada strike es un carril que corre detrás de las velas, y cada barra deja un círculo en él. El tamaño y la opacidad del círculo muestran el gamma neto de los dealers en ese strike durante la ventana de 5 minutos de la barra, comparado con el strike de mayor peso en pantalla. Los círculos **dorados** son long gamma; los **violetas**, short gamma.

**Cómo leerlo.**

- Un carril grueso que se mantiene toda la sesión es un wall.
- El dorado es un imán y un freno: según el modelo, ahí los dealers venden en las subidas y compran en las caídas. El violeta es un acelerador: ahí los dealers persiguen los movimientos.
- Un carril se ensancha a medida que el precio se acerca a su strike y se estrecha cuando el precio se aleja. Es el gamma alcanzando su máximo at the money, no posiciones nuevas: el open interest solo se actualiza una vez al día, después del cierre. Un carril grueso justo en el precio es donde el hedging está más activo ahora.
- Un carril que cambia de color es un strike cuyos contratos de long gamma y de short gamma están casi equilibrados.

**Controles.** El control deslizante **Opacity** junto a la píldora atenúa o intensifica todos los círculos a la vez. Pasa el cursor por un carril para ver el valor exacto del strike. Los círculos por debajo del 5 % del strike de mayor peso no se dibujan, y la leyenda bajo el gráfico incluye una clave.

**A tener en cuenta.** Las ribbons solo funcionan en vivo y están activadas por defecto en el Gamma Terminal. Siguen el filtro Expiry. El historial cubre los strikes que se seguían en cada momento, así que las barras anteriores en strikes lejanos pueden aparecer vacías.

### VWAP

**Qué muestra.** El precio medio ponderado por volumen de la sesión (`VWAP`, línea discontinua): el precio medio negociado hoy, con cada precio ponderado por el volumen que se negoció en él. Se reinicia cada día de trading.

**Cómo leerlo.** Muchos traders tratan el VWAP como el valor justo del día. Un precio por encima significa que, de media, los compradores han estado pagando más; por debajo, que los vendedores han estado presionando. Cuando el VWAP coincide con un nivel de gamma, consulta [Confluencia gamma-VWAP](/education/gamma-vwap-confluence-explained).

**A tener en cuenta.** SPX y NDX no se negocian directamente, así que su VWAP aplica el patrón de volumen de SPY y de QQQ a los precios del índice. El filtro Expiry no le afecta.

### Max Pain

**Qué muestra.** El strike en el que los tenedores de opciones cobrarían menos si el subyacente liquidara ahí (`MAX PAIN`, dorado, punteado). Sin filtro Expiry, es el max pain del vencimiento más cercano: el de hoy, cuando lo hay.

**Cómo leerlo.** Es más relevante en los últimos uno o dos días antes de un vencimiento significativo. El resto del tiempo suele quedar lejos del precio, y los walls y el flip importan más. Consulta [Max Pain explicado](/education/max-pain-explained).

**A tener en cuenta.** Max Pain nunca amplía el eje de precios, así que a menudo solo aparece como una etiqueta con flecha. Con un filtro Expiry, el gráfico y la tarjeta de Key Levels lo recalculan a partir de los vencimientos que elegiste; las escaleras muestran `NA` en su lugar.

### Pin Strike

**Qué muestra.** El strike cercano del mismo día (0DTE) donde el gamma positivo de los dealers y la probabilidad de que el precio llegue hasta él antes del cierre se combinan con más fuerza (verde azulado, con la etiqueta `PIN · STRONG`, `PIN · MODERATE` o `PIN · WEAK`).

**Cómo leerlo.** La palabra de fuerza mide cuánto destaca el strike ganador frente a sus vecinos, no lo grande que es su gamma. **Weak** significa que la atracción se reparte entre varios strikes cercanos, no que el nivel carezca de importancia. Es un nivel de pinning modelado, no un objetivo de precio. [Pin Strike](/help/platform/pin-strike) explica cómo se construye.

**A tener en cuenta.** No se dibuja ninguna línea cuando no hay un pin activo. El pin es del mismo día por diseño, así que ignora el filtro Expiry. No forma parte de la vista previa gratuita.

### GEX King

**Qué muestra.** El strike con el mayor gamma neto de los dealers, long o short, de toda la cadena de opciones (`GEX KING`, violeta). Desactivado por defecto.

**Cómo leerlo.** El King es la contrapartida estructural, de movimiento lento, del Pin del mismo día: el strike con más hedging asociado, sea cual sea su vencimiento. Puede ser un strike de short gamma.

**A tener en cuenta.** Ignora el filtro Expiry, porque acotarlo lo convertiría en otra medida. La corona de las escaleras marca el strike de mayor peso en la vista de esa escalera, que no siempre es el King. No forma parte de la vista previa gratuita.

### PD/PM Levels

**Qué muestra.** Dónde ha estado el precio: el máximo, el mínimo y el cierre de la sesión regular anterior (`PDH`, `PDL`, `PDC`, gris, trazo discontinuo largo), y el máximo y el mínimo del pre-market de hoy (`PMH`, `PML`, gris, punteado). Desactivados por defecto.

**Cómo leerlo.** No son niveles de dealers. Son precios de referencia que siguen muchos traders, dibujados en gris para que nunca se lean como un nivel de gamma.

**A tener en cuenta.** Solo están disponibles en SPY, QQQ y NVDA. SPX y NDX no tienen pre-market, y ES y NQ cotizan casi las 24 horas, así que ahí los niveles no se aplican. Las cifras siempre aparecen en una fila sobre el gráfico. La píldora, o el ojo al final de esa fila, las dibuja como líneas.

### Expected Range

**Qué muestra.** Una banda sombreada entre `ER HIGH` y `ER LOW`: el movimiento que descuenta la volatilidad implícita, una desviación estándar a cada lado del precio actual. Desactivado por defecto. Una vez activado, elige **Daily**, **Weekly** o **Monthly**.

**Cómo se calcula.** Usa el VIX para SPX, SPY y ES, y el VXN para QQQ, NDX y NQ. El movimiento es precio × (VIX ÷ 100) × √(días ÷ 252), con 1, 5 o 21 días de trading. Con SPY a $600 y el VIX en 16, el movimiento diario es de unos $6,05, así que la banda va aproximadamente de $593,95 a $606,05.

**Cómo leerlo.** Con los supuestos habituales, el precio termina dentro de una banda de una desviación estándar aproximadamente el 68 % de las veces. La banda te dice cuánto, no hacia dónde. Se vuelve a centrar a medida que se mueve el precio, así que describe el rango desde aquí, no desde la apertura.

**A tener en cuenta.** Expected Range solo funciona en vivo y se oculta durante Rewind, porque la volatilidad es una lectura en vivo. No se dibuja en NVDA, cuya volatilidad propia está muy por encima de la de cualquiera de los dos índices.

### Centroids

**Qué muestra.** Dónde se centra hoy la negociación de opciones. El **centroide de calls** (verde) es el strike medio de las calls negociadas hoy, ponderado por cuántos contratos se negociaron en cada strike. El **centroide de puts** (rojo) es lo mismo para las puts. Desactivados por defecto.

- Las **líneas nítidas** cubren los últimos 15 minutos de negociación.
- Las **líneas anchas y suaves** cubren toda la sesión hasta ahora.

**Cómo leerlo.** Las calls se negocian sobre todo por encima del precio y las puts sobre todo por debajo, así que las dos líneas suelen quedar a cada lado del precio. La distancia entre ellas muestra lo dispersa que está la negociación de hoy. Cuando el centroide de calls va bajando o el de puts va subiendo, la negociación se está concentrando más cerca del precio. Las líneas de la sesión se mueven despacio porque promedian todo el día; las de 15 minutos siguen al precio y tienen más ruido. Pasa el cursor por una barra para leer ambas.

**A tener en cuenta.** Los centroides describen dónde se negoció; no predicen hacia dónde irá el precio. Cuentan todos los vencimientos que sigue ZeroGEX, así que el filtro Expiry no se aplica. Además, solo cuentan los strikes de la banda que ZeroGEX registra alrededor del precio (consulta [Cobertura de datos y actualización](/help/platform/data-coverage)), así que quedan más cerca del precio que en una herramienta que cuente todos los strikes listados. Cuando un strike entra en esa banda durante el día, su volumen anterior se cuenta de golpe, lo que puede hacer saltar la línea de 15 minutos. Los Centroids solo funcionan en vivo, en barras de 1M a 1H.

### Bar Timer

**Qué muestra.** Cuánto falta para que cierre la vela actual: una cuenta atrás bajo la etiqueta del último precio, con una barra fina que se va llenando a medida que avanza la vela. Pasa el cursor por la vela en vivo para ver el tiempo transcurrido y el restante. Desactivado por defecto.

**A tener en cuenta.** Solo aparece mientras el mercado está abierto y estás viendo la última barra.

### Panel de volumen

El panel bajo las velas, que se muestra u oculta con el ojo junto a **VOL**:

- **Up/Down** (la opción predeterminada) - el volumen en uptick (verde) apilado sobre el volumen en downtick (rojo), una columna por barra.
- **Cumulative** - un total acumulado del volumen en uptick menos el volumen en downtick de la sesión actual, que parte de cero en la apertura. Por encima de cero, los compradores han liderado el tape hoy; por debajo de cero, los vendedores.

En SPX y NDX el panel lleva la marca **PROXY (EST.)**. Un índice cash no se negocia, así que el volumen mostrado es una estimación derivada, no volumen negociado. [Volumen neto vs flujo direccional](/education/net-volume-vs-directional-flow) trata el volumen neto con más detalle.

## El filtro Expiry

El menú **Expiry** de la barra de herramientas elige qué vencimientos de opciones alimentan los niveles de gamma. **All expirations** usa toda la cadena que sigue ZeroGEX; [Cobertura de datos y actualización](/help/platform/data-coverage) la detalla. **0DTE · today's expiry** sigue el vencimiento del mismo día y pasa al siguiente cada día. También puedes marcar una o varias fechas concretas.

| Qué | ¿Sigue el filtro Expiry? |
|---|---|
| Gamma Flip, Call Wall, Put Wall | Sí |
| Max Pain | Sí en el gráfico y en Key Levels; `NA` en las escaleras |
| Sombreado Regime y Dealer Gamma @ Spot | Sí |
| Ribbons, el Strike Panel y las escaleras | Sí |
| La franja Key Levels y el Playbook | Sí |
| Pin Strike | No: siempre del mismo día |
| GEX King | No: siempre toda la cadena |
| Centroids | No: todos los vencimientos |
| VWAP, PD/PM Levels, Expected Range | No: no se construyen a partir de la cadena de opciones |

Algunas cosas que conviene saber:

- Un subconjunto de vencimientos tiene su propio flip: el precio en el que el gamma de ese subconjunto cambia de signo. Un libro del mismo día suele tener un único signo, con todos los strikes del mismo lado, así que no hay ningún cruce que dibujar y el gráfico muestra `NO FLIP IN SELECTED EXPIRIES`. Eso no se resolverá más tarde, porque no falta nada. Vuelve a poner Expiry en **All** para ver el flip de toda la cadena.
- `NO 0DTE TODAY · SHOWING ALL EXPIRIES` significa que hoy no hay vencimiento del mismo día, por ejemplo en un fin de semana o un festivo, así que los niveles usan todos los vencimientos.
- El filtro se mantiene en tu pestaña del navegador y se comparte con otros gráficos que filtran por vencimiento. Cambiar de símbolo lo devuelve a All, salvo que esté en 0DTE.

## Cómo leer la cruz del cursor

Pasa el cursor por el gráfico, o tócalo o mantenlo pulsado en el móvil, para ver una cruz y una tarjeta con:

- La hora, la apertura, el máximo, el mínimo, el cierre y el volumen de la barra, más **Net** en el modo de volumen Cumulative.
- **Strike Γ near** seguido del precio de la cruz: el gamma neto de los dealers en los strikes cercanos. Te dice cuánto hedging hay ahí. **No** es el régimen a ese precio, porque un strike de long gamma puede estar dentro de un libro de short gamma. Lee el régimen en el sombreado y en el recuadro Dealer Gamma @ Spot.
- El nivel más cercano de los dibujados en el gráfico, y a qué distancia está. Los niveles que has desactivado no se nombran.
- Con Centroids activado: los centroides de calls y de puts, primero el valor de 15 minutos y después el de la sesión.
- Con Ribbons activado: el carril más cercano a la cruz, su gamma neto y su proporción respecto al strike de mayor peso en pantalla.

## Zoom, desplazamiento y restablecimiento

Con ratón o trackpad:

- **Arrastra** el gráfico hacia los lados para moverte en el tiempo.
- **Ctrl + rueda** (**Cmd + rueda** en un Mac), o pellizca en un trackpad, para hacer zoom en el tiempo. La rueda sola desplaza la página, no el gráfico.
- **Mayús + rueda**, o la rueda sobre la escala de precios de la derecha, para hacer zoom en el eje de precios. También puedes arrastrar la escala de precios hacia arriba o hacia abajo.
- Los botones − y + de **Time** y **Price**, abajo a la derecha, hacen lo mismo por pasos.
- **»** vuelve a la última barra.

En el móvil, arrastra hacia los lados para desplazarte, pellizca para hacer zoom en el tiempo y usa los botones **Price** bajo el gráfico para hacer zoom en el precio. Toca, o mantén pulsado y desliza, para ver la cruz; vuelve a tocar para quitarla.

Una vez que haces zoom o te desplazas, la escala de precios se queda donde la dejas. **Reset**, un doble clic o un cambio de símbolo o de timeframe la devuelven al ajuste automático. En el Gamma Terminal, el ajuste automático mantiene el precio en el centro vertical, que es lo que permite que las escaleras se alineen con él.

## El modo Rewind

**Rewind**, bajo el gráfico, repite la sesión: el precio y el libro de gamma tal como estaban en cada momento.

- **Play** y **Pause**, una velocidad de **1×**, **4×**, **8×** o **16×**, y **Loop**, que está activado por defecto.
- Arrastra la **barra de reproducción** para saltar a cualquier vela.
- Los niveles, el Strike Panel, las ribbons y las dos escaleras muestran lo que se sabía en ese momento. El VWAP y el Max Pain se reconstruyen para ese instante.
- Expected Range, Bar Timer y la cifra en dólares de Dealer Gamma @ Spot se ocultan mientras usas Rewind, porque son lecturas en vivo.
- Rewind llega hasta donde alcanza el historial de gamma que guarda el gráfico, unas seis horas y media, y menos en barras de 1H y 1D. Para una sesión completa desde la apertura, sigue el enlace **full session** hasta [Daily Replay](/replay).
- **● LIVE** o **»** vuelven a la vista en vivo, igual que cambiar de símbolo o de timeframe.

## El Playbook

Debajo de las tarjetas, **Where do we expect the underlying to go?** expone lo que implica el régimen actual cuando el precio se acerca a un wall:

| | Al alza hacia el Call Wall | A la baja hacia el Put Wall |
|---|---|---|
| γ positivo (dealers long gamma) | Damped rally | Cushioned dip |
| γ negativo (dealers short gamma) | Squeeze risk | Flush risk |

Sigue al gráfico en vivo. Haz clic en una celda para leer otro escenario, y en **Follow the chart** para volver. Cada escenario indica qué vigilar, qué lo invalida y con qué frecuencia se rompen los walls.

## ES y NQ

ZeroGEX lee opciones sobre índices, no opciones sobre futuros, así que los niveles de ES y NQ salen de las cadenas de SPX y NDX, trasladados al precio de los futuros a su valor razonable (el coste de carry hasta el vencimiento del contrato). El chip **IMPLIED FROM SPX** (o **NDX**) lo indica. El precio en sí es el del propio contrato de futuros, y su código, como ESZ26, aparece en el encabezado. Cuando los futuros cotizan caros o baratos respecto a su valor razonable, los niveles pueden quedar ligeramente desplazados. [Meses de contrato de futuros](/help/platform/futures-contract-months) explica por qué los precios pueden diferir de los de otras plataformas.

## Vista previa gratuita frente a la versión en vivo

| | Vista previa gratuita | Basic y Pro |
|---|---|---|
| Datos | Unos 15 minutos de retraso; recarga para obtener un snapshot más reciente | En vivo |
| Símbolos y timeframes | SPY en barras de 5 minutos | Los siete símbolos, de 1M a 1D |
| Panel | Escaleras de SPY y SPX; solo la vista Silhouette del Strike Panel | Cualquier par; las cuatro vistas del Strike Panel; Session Δ |
| Superposiciones | Gamma Levels, Regime, VWAP, Max Pain | Todas |
| Herramientas | Zoom, cruz del cursor, Save | Además, el filtro Expiry, Rewind y las alertas de walls |

[Niveles, acceso y qué se desbloquea dónde](/help/platform/tiers-and-access) cubre el resto del sitio.

## Qué recuerda el terminal

En este navegador, el terminal guarda tus superposiciones, el estilo del gráfico, el modo de volumen, el horizonte de Expected Range, la opacidad de las ribbons, el panel elegido y la vista del Strike Panel, además de tu símbolo y los ajustes Strikes, Session Δ y Unit de las escaleras. El filtro Expiry se guarda por pestaña del navegador.

No guarda el timeframe (se abre en 5M), el símbolo de la segunda escalera, el zoom y el desplazamiento, ni Rewind.

## Lo que el Gamma Terminal no puede decirte

- **Quién tiene realmente las opciones.** El gamma de los dealers se modela a partir del open interest con una convención estándar. Los libros reales de los dealers son distintos, y las mesas se cubren de formas que los datos públicos no muestran.
- **Las posiciones nuevas durante el día.** El open interest se actualiza una vez al día, después del cierre. Durante la sesión, los niveles se mueven porque el precio, el tiempo y la volatilidad cambian el gamma de las posiciones ya abiertas.
- **Hacia dónde irá el precio.** Los walls, el pin, el max pain, el rango esperado y los centroides son contexto, no objetivos ni promesas. Los niveles de gamma son un apoyo para la toma de decisiones, no asesoramiento de inversión.

## Ver también

- [Cómo leer el Panel](/help/platform/dashboard)
- [Cómo leer los gráficos de ZeroGEX](/help/platform/reading-charts)
- [Pin Strike](/help/platform/pin-strike)
- [Gamma Exposure explicado](/education/gamma-exposure-explained)
- [Gamma Walls explicados](/education/gamma-walls-explained)
- [Cómo operar en torno al Gamma Flip](/education/how-to-trade-around-gamma-flip)
- [Cobertura de datos y actualización](/help/platform/data-coverage)
