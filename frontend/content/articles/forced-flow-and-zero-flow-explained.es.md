# Forced Flow y el flujo cero explicados: dónde la cobertura neta de los dealers es cero

*La exposición gamma te dice qué forma tiene la cobertura de los dealers. Forced Flow le pone una cifra en dólares y una fecha límite: cuántas acciones obligaría el libro de opciones actual a comprar o vender a quienes lo cubren si se mueven el precio, el tiempo o la volatilidad implícita. El nivel de flujo cero convierte esa cifra en un precio: el único spot en el que todo se anula.*

---

## Una pregunta que la mayoría de las herramientas de gamma se saltan

El Net GEX y el gamma flip describen la forma de la cobertura de los dealers. Te dicen si la cobertura debería oponerse a un movimiento o acompañarlo, y aproximadamente con cuánta fuerza por punto. Lo que no te dicen es cuántas acciones están en juego, en qué dirección y para cuándo, incluso si el mercado no hace absolutamente nada.

Esa última parte importa más de lo que parece. Un libro de opciones cambia su delta cuando se mueve el precio, pero también cuando corre el reloj y cuando cambia la volatilidad implícita. Quien cubre un libro y quiere mantenerse delta-neutral tiene que operar acciones en los tres casos. En un índice con un gran vencimiento del mismo día, ya por la tarde el reloj por sí solo puede rivalizar con los otros dos.

Forced Flow plantea esa pregunta directamente, y el nivel de flujo cero responde a la siguiente: ¿a qué precio el libro no debería nada en absoluto al cierre?

Así se sitúa junto a las otras dos formas en que ZeroGEX analiza la cobertura de los dealers:

| | **GEX y el gamma flip** | **Hedging Flow** | **Forced Flow** |
|---|---|---|---|
| Lee | El libro vigente | Las operaciones de hoy | El libro vigente |
| Responde | Cómo responde la cobertura por cada punto de precio | Qué cobertura implicaron las operaciones de hoy | Cuántas acciones forzaría un escenario y dónde se compensa hasta cero |
| Dirección en el tiempo | Una instantánea | Hacia atrás a lo largo de la sesión | Hacia delante, hasta el cierre de las 16:00 ET |
| Unidades | Gamma en dólares | Dólares en acciones | Dólares en acciones |

Hedging Flow y Forced Flow comparten unidades y convención de signo a propósito, para que puedan leerse uno junto al otro.

---

## Qué es el flujo forzado

Empieza por la posición modelada de los dealers: el open interest de cada vencimiento y strike monitorizados, suponiendo que los dealers tienen la contrapartida del cliente, netos largos de las calls y netos cortos de las puts. Es la misma convención que hay detrás del Net GEX y del gamma flip de ZeroGEX. Es un supuesto, no una observación: los datos públicos de opciones no muestran quién tiene qué, y la [página de metodología](/methodology) explica dónde puede fallar la convención.

A partir de esa posición, Forced Flow calcula dos veces el delta total del libro: una vez ahora, y otra bajo un escenario (un precio distinto, más tarde en el día, una volatilidad implícita distinta o cualquier combinación). La diferencia es cuánto se ha desviado la cobertura. Las acciones necesarias para restablecerla son el flujo forzado:

`forced flow = −(dealer delta under the scenario − dealer delta now) × scenario price`

**Positivo significa que la cobertura delta-neutral compra acciones. Negativo significa que vende.**

Dos detalles hacen que esto sea algo más que un cálculo de servilleta:

- **Es una revaluación completa.** Cada contrato se valora de nuevo bajo el escenario, en lugar de estimarse sumando gamma, charm y vanna. Sumar las griegas es una buena primera aproximación y una mala respuesta final, porque las tres interactúan; [Delta y sus tres hijos](/education/delta-and-its-three-children) explica por qué.
- **Las griegas se siguen mostrando, para la atribución.** La página divide cada cifra en una parte de gamma (precio), una parte de charm (tiempo) y una parte de vanna (volatilidad), para que puedas ver qué la está impulsando. Cuando un escenario es lo bastante extremo como para que la división simple deje de cuadrar, la revaluación completa es la cifra en la que hay que confiar.

El open interest se publica una vez al día. Intradía, el flujo forzado no cambia porque se hayan abierto posiciones nuevas. Cambia porque el libro existente se revalúa a medida que se mueven el precio, el tiempo y la volatilidad.

---

## Las tres palancas

Forced Flow mueve una palanca cada vez, y la página dibuja cada una:

- **Precio.** La *curva de revaluación* muestra el flujo forzado en cada precio dentro de aproximadamente un 2% del spot, si el subyacente termina la sesión ahí. El tiempo hasta el cierre está incluido, así que la curva muestra la palanca del precio sumada a lo que el reloj ya debe.
- **Tiempo, con el precio fijo.** *Charm Into the Close* avanza el reloj desde ahora hasta la campana de las 16:00 con el precio fijo, y traza cuántas acciones obliga el decaimiento temporal por sí solo a operar a los dealers por el camino. La curva se vuelve más pronunciada en la última hora, a medida que se resuelven las opciones del mismo día. [Charm: el reloj es un trader](/education/charm-the-clock-is-a-trader) explica la mecánica.
- **Volatilidad, con el precio y el tiempo fijos.** La *Vanna Ladder* desplaza la volatilidad implícita hacia arriba y hacia abajo, en pasos de medio punto hasta tres puntos en cada sentido, y muestra las acciones que forzaría cada desplazamiento ahora mismo. [Vanna: cómo la caída de la IV puede cambiar la cobertura de los dealers](/education/vanna-when-fear-fades) explica por qué.

---

## Qué es el nivel de flujo cero

La curva de revaluación muestra el flujo forzado en cada precio, suponiendo que ese precio es donde está el subyacente al cierre. En algún punto de su recorrido, la curva cruza el cero. Ese precio es el **nivel de flujo cero**: el spot en el que el libro, llevado hasta el cierre, no debe nada. Ahí los dealers no tendrían que comprar ni vender nada para seguir cubiertos.

Si el reloj no existiera, ese precio sería el propio spot: sin movimiento, no hay recobertura. La razón por la que está en otro lugar es el tiempo. Con el precio quieto, el decaimiento temporal ya debe una cierta cantidad de acciones para el cierre. El nivel de flujo cero es el movimiento de precio cuya propia cobertura la anula exactamente.

### Un ejemplo práctico

Son cifras redondas e ilustrativas, no una lectura en vivo.

SPY está en 660,00 $ a dos horas de la campana. La curva de revaluación muestra **Flow at spot: compra de 300 millones de dólares**. Eso es lo que el reloj debe por sí solo si SPY termina justo aquí.

Cerca del spot, el libro está largo de gamma: por cada 1 $ que sube SPY, la cobertura tiene que vender unos 120 millones de dólares de SPY, y por cada 1 $ que baja, comprar unos 120 millones de dólares.

Así que, si SPY sube 2,50 $ hasta el cierre, las ventas impulsadas por el precio, de unos 300 millones de dólares, anulan las compras impulsadas por el tiempo, de unos 300 millones de dólares. El nivel de flujo cero está aproximadamente en **662,50 $**.

La regla práctica que hay detrás:

`distance to zero flow ≈ −(flow at spot) ÷ (forced flow per $1 of price)`

Es una aproximación de primer orden. La página calcula el cruce de forma exacta, revaluando todo el libro en cada precio de su grilla, lo que importa cuando el movimiento es grande o el libro tiene mucho peso en opciones del mismo día.

---

## Imán o pivote: decide la pendiente

Un nivel de flujo cero es un único precio, pero lo que ocurre a cada lado depende de hacia dónde se inclina la curva al atravesarlo.

Toma el ejemplo anterior. Por debajo de 662,50 $, las compras impulsadas por el tiempo superan a las ventas impulsadas por el precio, así que el libro debe compras netas. Por encima, lo contrario: ventas netas. La cobertura se inclina hacia el nivel desde ambos lados. Eso es un **imán**, un nivel de flujo cero estable.

Ahora invierte el libro a corto de gamma cerca del spot: por cada 1 $ que sube SPY, la cobertura tiene que *comprar* 120 millones de dólares, y supón que el reloj debe en cambio 300 millones de dólares de ventas. La misma aritmética sitúa el nivel de flujo cero en los mismos 662,50 $. Pero ahora, por debajo de él el libro debe ventas netas, y por encima, compras netas. La cobertura se inclina *lejos* del nivel a ambos lados. Eso es un **pivote**, un nivel de flujo cero inestable: un detonante más que un pin.

| Cerca del nivel, los dealers están | Por debajo del nivel | Por encima del nivel | La cobertura se inclina | En la página |
|---|---|---|---|---|
| Largos de gamma | Compras netas | Ventas netas | Hacia el nivel | Imán: línea azul continua en el Field |
| Cortos de gamma | Ventas netas | Compras netas | Lejos del nivel | Pivote: línea ámbar discontinua en el Field |

El mismo precio puede ser cualquiera de los dos. Leer un pivote como un imán invierte exactamente la inclinación, y por eso el Field de la sesión completa dibuja los dos por separado. En la curva de revaluación se distingue a simple vista: una curva que cae a través del cero, de compras a la izquierda a ventas a la derecha, es un imán; una que sube a través del cero es un pivote.

Como regla práctica, por debajo del gamma flip el nivel de flujo cero más cercano al spot suele ser un pivote, y por encima, suele ser un imán. Lo que decide es la pendiente en el propio nivel.

"Se inclina hacia" y "se inclina lejos" describen la cobertura modelada, no una promesa sobre el precio. Si el precio responde de verdad es una cuestión empírica, y la página lo mide en lugar de suponerlo (más sobre esto abajo).

---

## El flujo cero no es el gamma flip

La página traza cuatro niveles en el Forced-Flow Rail, y responden a cuatro preguntas distintas:

- **Gamma flip:** el precio en el que la gamma neta modelada de los dealers cambia de signo. Marca la frontera entre el régimen en el que la cobertura amortigua los movimientos (por encima) y aquel en el que los amplifica (por debajo). Consulta [¿Qué es un gamma flip?](/education/how-to-read-a-gamma-flip)
- **Nivel de flujo cero:** el precio en el que el flujo forzado total, llevado hasta el cierre, se compensa hasta cero. Incorpora el tiempo a la imagen, algo que el gamma flip no hace.
- **Charm flip:** el precio en el que el decaimiento temporal hacia el cierre cambia de signo. A un lado, el reloj fuerza compras; al otro, ventas.
- **Vanna flip:** el precio en el que cambia de signo la cobertura forzada por una subida de un punto en la volatilidad implícita.

El gamma flip dice qué tipo de cobertura cabe esperar. El nivel de flujo cero dice dónde, teniendo en cuenta el reloj, esa cobertura se compensa. Pueden estar cerca o lejos el uno del otro, y uno no sustituye al otro.

---

## Cómo se mueve el flujo cero a lo largo del día

El horizonte es siempre "desde ahora hasta el cierre de hoy a las 16:00 ET", así que el nivel de flujo cero es, por diseño, un objetivo móvil:

- **El reloj acorta el horizonte.** Por la mañana, el nivel incorpora una sesión completa de decaimiento. Al final del día incorpora solo lo que queda. A las 16:00 el horizonte es cero, al reloj no le queda nada que deber, y el nivel se colapsa sobre el spot. Después de la campana no aporta información hasta la siguiente sesión.
- **La revaluación cambia la forma de la curva.** A medida que se mueven el precio, la volatilidad implícita y el tiempo, el delta de cada contrato cambia, y con él la pendiente de la curva y el punto en el que cruza el cero. El open interest se mantiene fijo hasta la publicación del día siguiente.
- **El Field guarda el historial.** El Field de la sesión completa de la página reconstruye el libro tal como estaba realmente en cada momento de la sesión, para que puedas ver dónde estaban el imán y el pivote a las 10:00, a mediodía y ahora, frente al precio que realmente se imprimió. A la derecha de "now", lleva el libro actual hacia delante hasta el cierre como una proyección.

---

## Lo que estas cifras no son

**No es flujo observado.** El flujo forzado es un modelo de lo que requeriría una cobertura delta-neutral, construido sobre un supuesto acerca de quién tiene el open interest. ZeroGEX no ve el inventario de los dealers, y las mesas reales compensan posiciones entre distintos libros, se cubren con otros instrumentos y reajustan por bandas en lugar de hacerlo de forma continua. Una cifra de +300 millones de dólares significa que la cobertura del modelo compraría unos 300 millones de dólares. No significa que alguien vaya a hacerlo.

**No es un objetivo de precio.** El nivel de flujo cero es donde la cobertura modelada se compensa hasta cero. No es adonde tiene que ir el precio, y un imán no hace que el precio llegue. La cobertura es una fuente de flujo de órdenes entre muchas, y en un día con un catalizador macro o un rebalanceo de índices rara vez es la mayor.

**Todavía no es una ventaja medida.** ZeroGEX no ha publicado un estudio de varias sesiones sobre con qué frecuencia el precio cierra cerca del nivel de flujo cero. Lo que la página sí mide es más acotado, y se muestra con honestidad:

- el Field de la sesión completa cuenta, dentro de la sesión de hoy, con qué frecuencia el precio se movió hacia el imán (o se alejó del pivote) de un paso al siguiente. Eso describe el día de hoy. No es un pronóstico para mañana;
- el **Track Record**, al final de la página, puntúa el pronóstico de charm a lo largo de las sesiones. No puntúa el signo bruto de compra o venta, que en el libro de un índice marca "compra" casi todos los días y, por tanto, solo volvería a reproducir la tasa base. Puntúa si una lectura matinal de charm más fuerte o más débil que su propia normalidad reciente se inclina en el mismo sentido que el movimiento de mediodía al cierre. Muestra la tasa de acierto frente a una referencia ingenua, con una banda de confianza del 95%, y solo certifica una ventaja tras al menos 30 sesiones puntuadas. Lee su veredicto antes de apoyarte en el pronóstico. Hasta que diga **Significant at 95%**, trátalo como no demostrado.

---

## Cómo leer la página de Forced Flow en orden

La página está organizada como un veredicto seguido de sus pruebas:

1. **The Read** reúne en una sola frase el régimen, el flujo hacia el cierre y el nivel de flujo cero, con tres recuadros debajo.
2. **El Forced-Flow Rail** sitúa el gamma flip, el charm flip, el vanna flip y el nivel de flujo cero frente al spot.
3. **La curva de revaluación** muestra la palanca del precio y dónde cruza la curva el cero.
4. **Charm Into the Close** y la **Vanna Ladder** muestran las palancas del tiempo y de la volatilidad.
5. **El Forced-Flow Field** muestra toda la sesión: lo real a la izquierda de "now", lo proyectado a la derecha, con el imán y el pivote trazados a lo largo de ella y el precio realizado encima.
6. **El Track Record** puntúa el pronóstico de charm.

La [página de ayuda de Forced Flow](/help/platform/forced-flow) es la referencia panel por panel, incluidas algunas cifras que se parecen pero se calculan de forma distinta.

---

## Cómo usarlo

Forced Flow funciona mejor como contexto en torno a un nivel o una idea que ya tienes, no como la idea en sí. Algunas combinaciones se leen con claridad:

- **Todo se alinea.** Gamma larga cerca del spot, un imán unos puntos por encima y el reloj debiendo compras hacia el cierre. La cobertura modelada se inclina en el mismo sentido en todas las palancas. Es una imagen coherente, y aun así depende de que no llegue al tape nada más grande.
- **Un pivote cerca del spot.** El nivel es un detonante, no un objetivo. Lo que importa es en qué lado está el precio, porque el empuje modelado cambia de dirección cuando el precio lo cruza.
- **Las palancas no coinciden.** El reloj debe compras, pero el precio está justo por debajo de un pivote donde la palanca del precio fuerza ventas. El modelo no da una dirección única, y la lectura honesta es que la presión de cobertura es mixta.
- **Al final de un día de vencimiento.** En un libro con mucho 0DTE, buena parte de la cifra hacia el cierre puede concentrarse en la última hora, y The Read dice cuánto. Es entonces cuando la parte de la cobertura que corresponde al reloj es mayor, y también cuando son mayores los demás flujos de cierre.

Combínalo con [Hedging Flow](/education/hedging-flow-explained). Forced Flow dice lo que el libro forzaría bajo un escenario. Hedging Flow estima lo que realmente crearon las operaciones de hoy. Una gran compra forzada hacia el cierre con el tape ya empujando en el mismo sentido es un setup distinto de la misma cifra con el tape inclinándose en contra.

Para los fundamentos, consulta [Por qué los market makers operan en acciones](/education/why-market-makers-trade-stock), [Delta y sus tres hijos](/education/delta-and-its-three-children) y [Por qué no publicamos el DEX](/education/why-we-dont-publish-dex). Para ver las cifras de hoy, abre la página en vivo de [Forced Flow](/forced-flow).

Solo contenido educativo - nada de lo anterior es una recomendación de trading.
