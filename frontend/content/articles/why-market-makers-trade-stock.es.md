# Por qué los market makers se ven obligados a operar en acciones

*Los market makers no operan en acciones porque tengan una opinión sobre el mercado. Lo hacen porque el delta de las opciones que mantienen sigue moviéndose por sí solo — y a medida que se mueve, por lo general necesitan operar el subyacente para mantenerse casi planos. Ese flujo de cobertura es una de las fuentes de order flow más estructuralmente estimables del mercado.*

> **Idea clave**
> Los dealers, por lo general, no cubren porque se hayan puesto alcistas o bajistas. Cubren porque el riesgo de su cartera de opciones cambió. Entender qué cambia ese riesgo ayuda a explicar dónde puede aparecer presión de cobertura en el mercado.

---

## El trabajo del dealer es mantenerse neutral

Un market maker que os vende una call no quiere quedar corto en el mercado. Quiere el spread — los pocos centavos entre el bid y el ask — y quiere irse a casa plano. Vender la call lo dejó corto de delta, así que compra acciones frente a esa posición hasta que ya no tiene exposición direccional neta. Eso es el delta-hedging, y es el modelo económico central de un dealer de opciones: almacenar la opción, neutralizar la dirección, cobrar el edge.

El problema es que "plano" no es un lugar al que se llega una sola vez. Es un lugar al que el dealer vuelve una y otra vez a lo largo de la sesión, porque el delta de un book de opciones rara vez se queda quieto. Y aquí está la parte que importa para quien lee el flow: cuando ese delta se mueve, la cobertura resultante suele estar guiada por la gestión de riesgo y no por una view direccional. Ninguna convicción, ningún pronóstico de mercado — el riesgo del book cambió, así que el dealer por lo general necesita ajustar. *Cuándo* y *cómo* lo hace queda a su discreción. *Que* acabará necesitando operar para mantenerse cerca de su cobertura es la parte más estimable.

Esa distinción — guiado por el riesgo frente a discrecional — es la razón por la que el hedging de los dealers se puede leer. El flow discrecional es una suposición sobre lo que un trader *quiere* hacer. El flow de cobertura es una estimación de lo que un dealer probablemente *necesitará* hacer para mantenerse casi plano. Uno se parece más a lanzar una moneda. El otro se parece más a la aritmética.

---

## El delta es un blanco móvil, no un número fijo

El delta es el ratio de cobertura: cuántas acciones compensan un contrato de opción. Una call con delta 0,40 se comporta, en este momento, como 40 acciones largas por contrato. Vended 100 de esos contratos y quedáis cortos de 4.000 deltas; comprad 4.000 acciones y quedáis planos.

Pero 0,40 es una instantánea, no una constante. Esa misma call tendrá un delta distinto mañana aunque la acción nunca se mueva, un delta distinto si la volatilidad implícita baja, y un delta muy distinto si la acción sube un 1%. El dealer se cubrió a 0,40. En cuanto el delta deriva a 0,44, el book queda corto de unos 400 deltas que no había previsto, y el dealer por lo general comprará unas 400 acciones más para acercarse de nuevo a plano.

Así que la cobertura son en realidad dos tareas, no una. Primero el dealer neutraliza el nivel *actual* del delta del book — la operación única que deja la posición casi plana. Luego viene la tarea continua: a medida que se operan nuevas opciones y que el spot, el tiempo y la vol mueven ese delta, el dealer reajusta para mantenerse casi plano. La cobertura inicial se pone en marcha una sola vez. Lo que aparece en el tape es el flujo interminable de re-hedges que persiguen al delta mientras deriva. Entender qué mueve el delta es entender de dónde viene la presión de cobertura.

---

## Las acciones que el dealer ya tiene os dicen menos de lo que creéis

He aquí una trampa que conviene evitar desde el principio, porque hunde muchos análisis ingenuos del posicionamiento de los dealers.

Podríais pensar que la forma de evaluar la presión del dealer es sumar todo el delta del book — el delta de cada contrato multiplicado por su open interest — y llamar a eso "exposición del dealer". Se siente correcto. Es el hermano natural de la gamma exposure. Pero se apoya en un supuesto oculto, y mide lo que no es.

Empecemos por el supuesto. El open interest os dice que un contrato existe; no os dice si un dealer está largo o corto en él. Los inventarios de los dealers no se publican en ningún sitio, así que cualquier cifra de "delta del dealer" tiene que inferirse a partir de un modelo de quién sostiene qué con mayor probabilidad — una estimación razonable, pero una estimación. Aceptemos ahora la estimación y veamos qué mide siquiera el *nivel* de delta. Las acciones que un dealer mantiene frente a sus opciones tienen un delta de exactamente 1,00 cada una, puestas en marcha *específicamente para anular* el delta de la opción. Por construcción, el delta neto de un dealer bien cubierto se sitúa cerca de cero — el delta de la opción y el delta de la acción se compensan en gran medida. Así que una cifra que suma el nivel de delta de las opciones describe precisamente la exposición que los dealers más se esfuerzan en aplanar, ignorando las acciones que mantienen frente a ella.

Lo que el nivel pasa por alto es cuánto está a punto de *moverse* ese delta. Las acciones tienen un delta de 1 que no cambia, así que no se puede usar para pre-neutralizar un delta que se desplaza con el spot, el tiempo y la vol. La presión de cobertura futura viene del *cambio* en el delta estimado de la cartera del dealer, no de sumar el delta que hoy está en el book. Esa deriva — la parte del delta del book que no se puede cubrir de antemano — es donde realmente nace el flow de cobertura. (Escribimos un artículo entero sobre por qué el número del nivel de delta es una trampa y por qué nos negamos a publicarlo — ved [Por qué no publicamos el DEX](/education/why-we-dont-publish-dex).)

---

## Tres fuerzas mueven el delta, y el dealer está expuesto a las tres

Entre ahora y el vencimiento, tres variables dominan cómo se mueve el delta de un book de opciones intradía, y un dealer apenas tiene control sobre ninguna de ellas:

- **Precio spot.** Cuando la acción se mueve, el delta de cada opción se mueve con ella. La sensibilidad del delta al spot es la **gamma**. Este es el flow reactivo — solo se dispara cuando el precio realmente se mueve, y es grande e inmediato.
- **Tiempo.** A medida que se acerca el vencimiento, el delta deriva incluso con el spot inmóvil: las opciones out-of-the-money se deslizan hacia delta 0, las in-the-money suben hacia delta 1. La sensibilidad del delta al tiempo es el **charm**. Funciona de forma continua, ocurra algo o no.
- **Volatilidad implícita.** Cuando el miedo que el mercado tiene incorporado en el precio sube o baja, el delta se desplaza con el spot perfectamente quieto. La sensibilidad del delta a la vol es el **vanna**. Un reseteo de la vol puede mover con fuerza el delta del book sin un solo tick en el precio.

Precio, reloj y miedo. Esas son las tres grandes palancas, y el dealer está expuesto a las tres. Cuando cualquiera de ellas se mueve, arrastra el delta del book fuera de su cobertura y genera una operación en acciones para devolverlo a su sitio. Estas no son las *únicas* variables — los tipos de interés, los dividendos, los cambios en la superficie de volatilidad, los supuestos de financiación y las nuevas operaciones de opciones que entran en el book también empujan el delta —, pero intradía suelen ser de segundo orden frente al spot, el tiempo y la vol. A ese resultado combinado lo llamamos **forced flow**: una estimación de las acciones que un dealer por lo general necesitará comprar o vender para mantenerse cubierto a medida que evolucionan el spot, el tiempo y la vol.

---

## Cuánto vale esto en dólares

La abstracción se vuelve concreta en el momento en que le asignáis un tamaño.

Digamos que se estima que el book de dealers en SPY está posicionado de tal forma que un movimiento del 1% en el subyacente cambia el delta agregado de los dealers en aproximadamente 1 millón de acciones. La cobertura es ese cambio de acciones multiplicado por el precio de la acción: con SPY en $560, eso es 1.000.000 × $560 ≈ **560 millones de dólares**. Bajo los supuestos del modelo, eso representa unos 560 millones de dólares de demanda de cobertura potencial — acciones que por lo general tendrían que cambiar de manos para mantener el book casi plano, antes de que un solo trader discrecional se haya formado una opinión. En un régimen de gamma corta, los dealers por lo general compran en la fortaleza y venden en la debilidad, de modo que ese flujo tiende a empujar *con* el movimiento, ampliando el rango. En un régimen de gamma larga, se opone al movimiento y lo comprime. El mismo mecanismo, signo opuesto, un tape muy distinto.

El charm y el vanna llevan sus propias etiquetas en dólares. En un día 0DTE cargado, la sola decadencia temporal podría implicar decenas de millones de acciones a cubrir hacia el cierre — aunque la dirección depende de cómo se estima que está posicionado el book, y no solo del reloj. Una caída de dos puntos en la vol implícita tras un dato de CPI tranquilo podría implicar una cobertura de tamaño similar; que se convierta en compras o en ventas depende, de nuevo, del signo del vanna estimado del book. Nada de esto es un pronóstico de mercado. Todo esto es el book reajustándose de vuelta hacia plano.

---

## Por qué el forced flow es el flow que vale la pena leer

La mayor parte del order flow es una niebla de intenciones enfrentadas. Alguien compra, alguien vende, y vosotros estáis adivinando el motivo. El hedging de los dealers es distinto por naturaleza: es un flujo grande y persistente que está moldeado por el posicionamiento y las tres variables anteriores más que por la opinión de nadie. Eso lo hace, por lo general, más estimable que el flow discrecional. Si el spot se mueve un 1%, la cobertura de gamma tiende a dispararse. A medida que el reloj se acerca al cierre, el hedging guiado por el charm tiende a acumularse. Si la vol cae dos puntos, sigue la cobertura de vanna — en una dirección fijada por el posicionamiento estimado del book. El flow es una consecuencia del riesgo, no una decisión discrecional.

Eso es lo que el resto de esta serie desarrolla. [El delta y sus tres hijos](/education/delta-and-its-three-children) desglosa la gamma, el charm y el vanna como las tres derivadas del delta. [Charm: el reloj es un trader](/education/charm-the-clock-is-a-trader) muestra cómo la sola decadencia temporal puede impulsar un flow estimable hacia el cierre que se puede modelar horas antes. [Vanna: cuando el miedo se desvanece, los dealers compran](/education/vanna-when-fear-fades) explica el empuje de la compresión de vol. Y la página en vivo de [Forced Flow](/forced-flow) recalcula todo el book bajo cualquier escenario de spot/tiempo/vol para que podáis ver la cobertura estimada antes de que se imprima.

El hedging de los dealers no es perfectamente predecible. Los inventarios no son públicos, el posicionamiento hay que inferirlo, y el momento y la ejecución de cualquier cobertura quedan a discreción del dealer.

Pero como está guiado por el riesgo de cartera y no por una opinión discrecional, es una de las fuentes de presión potencial de compra y venta más estructuralmente estimables de los mercados modernos. El propósito de Forced Flow no es predecir la orden exacta antes de que se imprima. Es estimar dónde el hedging de los dealers puede reforzar, resistir o desplazar el movimiento del mercado a medida que evolucionan el precio, el tiempo y la volatilidad.

Contenido solo educativo — nada de lo anterior es una recomendación de trading.
