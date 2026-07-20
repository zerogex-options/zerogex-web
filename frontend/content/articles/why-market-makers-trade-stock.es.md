# Por qué los market makers se ven obligados a operar en acciones

*Los market makers no operan en acciones porque tengan una opinión sobre el mercado. Lo hacen porque el delta de las opciones que mantienen sigue moviéndose por sí solo — y cada vez que se mueve, están mecánicamente obligados a operar el subyacente para mantenerse planos. Ese flujo forzado es el order flow más predecible del mercado.*

---

## El trabajo del dealer es no tener opinión

Un market maker que os vende una call no quiere quedar corto en el mercado. Quiere el spread — los pocos centavos entre el bid y el ask — y quiere irse a casa plano. Vender la call lo dejó corto de delta, así que compra acciones frente a esa posición hasta que ya no tiene exposición direccional neta. Eso es el delta-hedging, y es todo el modelo económico de un dealer de opciones: almacenar la opción, neutralizar la dirección, cobrar el edge.

El problema es que "plano" no es un lugar al que se llega una sola vez. Es un lugar al que hay que volver constantemente, todo el día, todos los días, porque el delta de un book de opciones se niega a quedarse quieto. Y aquí está la parte que importa para quien lee el flow: cuando ese delta se mueve, el dealer no *elige* operar el subyacente. Está *obligado* a hacerlo. La operación no lleva ninguna opinión, ninguna convicción, ninguna discrecionalidad. El delta se movió, así que se compran o venden acciones. Punto.

Esa distinción — forzado frente a discrecional — es la razón por la que el hedging de los dealers se puede leer. El flow discrecional es una suposición sobre lo que hará un trader. El flow forzado es un cálculo de lo que un dealer *debe* hacer. Uno es lanzar una moneda. El otro es aritmética.

---

## El delta es un blanco móvil, no un número fijo

El delta es el ratio de cobertura: cuántas acciones compensan un contrato de opción. Una call con delta 0,40 se comporta, en este momento, como 40 acciones largas por contrato. Vended 100 de esos contratos y quedáis cortos de 4.000 deltas; comprad 4.000 acciones y quedáis planos.

Pero 0,40 es una instantánea, no una constante. Esa misma call tendrá un delta distinto mañana aunque la acción nunca se mueva, un delta distinto si la volatilidad implícita baja, y un delta muy distinto si la acción sube un 1%. El dealer se cubrió a 0,40. En el momento en que el delta deriva a 0,44, queda corto de 400 deltas que no había previsto, y tiene que comprar 400 acciones más para volver a estar plano.

Así que el dealer nunca está realmente cubriendo el delta. Está cubriendo el *cambio* en el delta. La cobertura inicial es gratuita — se pone en marcha una sola vez. El flow, lo que aparece en el tape, es el flujo interminable de re-hedges que persiguen al delta mientras se mueve. Entender qué mueve el delta es entender qué fuerza el flow.

---

## Las acciones que el dealer ya tiene no os dicen nada

He aquí una trampa que conviene evitar desde el principio, porque hunde muchos análisis ingenuos del posicionamiento de los dealers.

Podríais pensar que la forma de medir la presión del dealer es sumar todo el delta del book — el delta de cada contrato multiplicado por su open interest — y llamar a eso "exposición del dealer". Se siente correcto. Es el hermano natural de la gamma exposure. También es prácticamente inútil, y la razón es la cobertura en acciones.

Las acciones que un dealer mantiene frente a sus opciones tienen un delta de exactamente 1,00 cada una. Ese delta de acciones se pone en marcha *específicamente para anular* el delta de la opción. Por construcción, el delta neto de un dealer correctamente cubierto es aproximadamente cero — el delta de la opción y el delta de la acción suman cero. Ese es todo el sentido de la cobertura. Así que un número que mide el *nivel* de delta en el book está midiendo precisamente el griego que los dealers ya han llevado a cero. Os cuenta sobre una posición que, por diseño, ya no tiene exposición direccional neta.

Lo que no es cero — lo que nunca se puede cubrir de antemano — es cuánto está a punto de *moverse* ese delta. Las acciones tienen un delta de 1 y nunca cambia. No se puede usar un instrumento de delta constante para pre-neutralizar un delta que se desplaza con el spot, el tiempo y la vol. Ese residuo, la deriva no cubrible de antemano en el delta del book, es la fuente completa del flow forzado. (Escribimos un artículo entero sobre por qué el número del nivel de delta es una trampa y por qué nos negamos a publicarlo — ved [Por qué no publicamos el DEX](/education/why-we-dont-publish-dex).)

---

## Tres cosas mueven el delta, y el dealer no controla ninguna

Entre ahora y el vencimiento, exactamente tres variables de estado mueven el delta de un book de opciones, y un dealer no puede influir en ninguna de ellas:

- **Precio spot.** Cuando la acción se mueve, el delta de cada opción se mueve con ella. La sensibilidad del delta al spot es la **gamma**. Este es el flow reactivo — solo se dispara cuando el precio realmente se mueve, y es grande e inmediato.
- **Tiempo.** A medida que se acerca el vencimiento, el delta deriva incluso con el spot inmóvil: las opciones out-of-the-money se deslizan hacia delta 0, las in-the-money suben hacia delta 1. La sensibilidad del delta al tiempo es el **charm**. Funciona de forma continua, ocurra algo o no.
- **Volatilidad implícita.** Cuando el miedo que el mercado tiene incorporado en el precio sube o baja, el delta se desplaza con el spot perfectamente quieto. La sensibilidad del delta a la vol es el **vanna**. Un reseteo de la vol puede mover con fuerza el delta del book sin un solo tick en el precio.

Precio, reloj y miedo. Esas son las tres palancas, y el dealer está atado a las tres. Cada una, cuando se mueve, arrastra el delta del book fuera de su cobertura y fuerza una operación en acciones para devolverlo a su sitio. Por eso llamamos al resultado combinado **forced flow**: es la cantidad en dólares de acciones que un dealer está mecánicamente obligado a comprar o vender a medida que evolucionan el spot, el tiempo y la vol.

---

## Cuánto vale esto en dólares

La abstracción se vuelve concreta en el momento en que le asignáis un tamaño.

Digamos que el book de dealers en SPY está posicionado de tal forma que un movimiento del 1% en el subyacente cambia el delta agregado de los dealers en aproximadamente 1 millón de acciones. La cobertura forzada es ese cambio de acciones multiplicado por el precio de la acción: con SPY en $560, eso es 1.000.000 × $560 ≈ **560 millones de dólares** de acciones que tienen que cambiar de manos solo para mantener el book cubierto — antes de que un solo trader discrecional se haya formado una opinión. En un régimen de gamma corta, el dealer compra en la fortaleza y vende en la debilidad, y esos 560 millones de dólares empujan *con* el movimiento, ampliando el rango. En un régimen de gamma larga, se opone al movimiento y lo comprime. El mismo mecanismo de forced flow, signo opuesto, tape completamente distinto.

El charm y el vanna llevan sus propias etiquetas en dólares. La sola decadencia temporal podría forzar decenas de millones de acciones hacia el cierre en un día 0DTE cargado. Una caída de dos puntos en la vol implícita tras un dato de CPI tranquilo podría forzar una cantidad similar de compras repartidas a lo largo de la tarde. Nada de esto es la opinión de nadie. Todo esto es el book persiguiendo su propio delta de vuelta a plano.

---

## Por qué el forced flow es el flow que vale la pena leer

La mayor parte del order flow es una niebla de intenciones enfrentadas. Alguien compra, alguien vende, y vosotros estáis adivinando el motivo. El flow forzado de los dealers es distinto por naturaleza: es el único flujo grande y persistente en el mercado que está completamente determinado por el posicionamiento y las tres variables anteriores. No tenéis que adivinar si va a ocurrir. Si el spot se mueve un 1%, se dispara la cobertura de gamma. Si el reloj llega a las 16:00, aparece el flow de charm. Si la vol cae dos puntos, sigue la cobertura de vanna. El flow es una consecuencia, no una decisión.

Eso es lo que el resto de esta serie desarrolla. [El delta y sus tres hijos](/education/delta-and-its-three-children) desglosa la gamma, el charm y el vanna como las tres derivadas del delta. [Charm: el reloj es un trader](/education/charm-the-clock-is-a-trader) muestra cómo la sola decadencia temporal fuerza un flow predecible hacia el cierre que se puede calcular horas antes. [Vanna: cuando el miedo se desvanece, los dealers compran](/education/vanna-when-fear-fades) explica el empuje de la compresión de vol. Y la página en vivo de [Forced Flow](/forced-flow) recalcula todo el book bajo cualquier escenario de spot/tiempo/vol para que podáis ver la operación obligada antes de que se imprima.

El dealer no tiene opinión. Precisamente por eso su flow vale más que la mayoría de las opiniones.

Contenido solo educativo — nada de lo anterior es una recomendación de trading.
