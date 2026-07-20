# Charm: el reloj es un trader

*Charm es la velocidad a la que cambia el delta de una opción a medida que pasa el tiempo. Obliga a los dealers a operar acciones incluso cuando el mercado está completamente plano — y como el reloj es la única variable que se puede predecir con total precisión, charm es ese flujo poco común de los dealers que puedes pronosticar horas antes de que ocurra. Un pronóstico con fecha límite.*

---

## El griego que opera sobre una cinta vacía

La mayoría de los flujos necesitan que pase algo. Gamma necesita un movimiento de precio. Las noticias necesitan noticias. Charm no necesita nada. Es la sensibilidad del delta al paso del tiempo — ∂Δ/∂t — y el tiempo pasa haga o no haga algo la cinta. Un dealer puede estar frente a un mercado que no se ha movido ni un tick en noventa minutos y aun así verse obligado a vender acciones todo ese tiempo, porque los deltas de su libro se están deteriorando silenciosamente y el hedge tiene que reducirse para mantener el ritmo.

Eso es lo que hace que charm resulte extraño y, una vez que lo entiendes, obvio. El reloj es un trader. Nunca se detiene, nunca cambia de opinión, y ejecuta la misma orden en cada sesión. Las únicas preguntas son en qué dirección empuja y cuán fuerte es ese empuje.

Este artículo es el complemento mecánico de nuestra explicación más amplia [Vanna and Charm explainer](/education/vanna-and-charm-explained). Ese artículo presenta a charm como uno de los insumos de la lectura de fin de jornada; este entra en el detalle mecánico — de dónde viene el drift, por qué se acelera, y cómo puedes ponerle una cifra en dólares y una fecha límite antes de que suceda.

---

## De dónde viene el drift

El delta es, en términos generales, la probabilidad neutral al riesgo de que una opción termine dentro del dinero. Una call con delta 0,30 es la forma en que el mercado dice que hay aproximadamente un 30% de probabilidad de que expire con valor. Esa probabilidad es una estimación viva, y a medida que se acerca el vencimiento tiene que colapsar en un veredicto: o la opción termina dentro del dinero (delta → 1) o no lo hace (delta → 0). Al cierre de la campana no hay término medio.

Charm es la velocidad de ese colapso. Observa una opción ligeramente fuera del dinero a lo largo de una tarde con el spot clavado:

- Esta mañana tenía delta 0,35 — una probabilidad real de generar pago.
- Al mediodía, con menos tiempo en el reloj y el spot sin cambios, delta 0,28.
- A las 15:00, delta 0,18.
- Cerca de la campana, el delta deslizándose hacia 0.

Nada se movió. El delta de la opción cayó a la mitad de todos modos, únicamente porque se acortó la pista. Cada uno de esos pasos es un cambio en el ratio de cobertura, y cada cambio obliga al dealer que mantiene esa opción a ajustar su posición en acciones. Ese ajuste es el flujo de charm.

Las opciones dentro del dinero hacen la imagen especular, afirmándose de 0,80 hacia 1,00 a medida que su resultado se convierte en una casi certeza. El charm neto del libro es la suma en todos los strikes, ponderada por cuánto interés abierto hay allí y de qué lado está el dealer.

---

## Por qué se acelera hacia el cierre

Charm no es constante a lo largo del día. La tasa de deterioro del delta es pequeña cuando queda mucho tiempo por delante y crece a medida que se acerca el vencimiento — es máxima en la última hora y máxima de todas en los últimos minutos, para los strikes cercanos al dinero que aún tienen un veredicto pendiente. En una cadena dominada por vencimientos del mismo día, que hoy es la norma para SPX, la mayor parte del flujo de charm de la jornada se comprime en los últimos sesenta a noventa minutos.

Esta es la razón mecánica por la que el "drift hacia el cierre" es un fenómeno real y no una superstición de gráfico. No es que los traders se pongan emotivos a las 15:00. Es que las matemáticas del deterioro del delta concentran ahí la mayor parte de su fuerza, y los dealers que cubren ese deterioro no tienen opción sobre cuándo operar. El flujo se intensifica porque el griego se intensifica.

El gráfico en vivo [Charm into Close](/forced-flow) dibuja exactamente esto: mantiene el spot fijo, avanza el reloj hasta la campana, y traza las acciones acumuladas que el libro de los dealers se ve obligado a operar en cada paso. La curva parte de cero en el momento actual y se aleja de cero conforme avanza la tarde — más pronunciada al final, porque ahí es donde vive charm.

---

## Un pronóstico con fecha límite

Aquí está la propiedad que hace que charm sea singularmente útil, y es algo que no encontrarás en un análisis estándar de los griegos.

Cualquier otro flujo de los dealers es condicional. El flujo de gamma depende de un movimiento del spot que puede llegar o no. El flujo de vanna depende de un cambio de volatilidad que no puedes programar. Pero el flujo de charm depende solo del tiempo, y el tiempo es la única variable que va a hacer exactamente lo que esperas. A las 9:35 de la mañana, manteniendo el spot en su nivel actual, puedes calcular cuántas acciones el deterioro temporal *por sí solo* obligará a comprar o vender a los dealers hacia las 16:00. Conoces el tamaño y la dirección de un flujo grande seis horas y media antes de que se complete.

Eso es un pronóstico con fecha límite. El pronóstico tiene una condición adjunta — "si el spot se mantiene cerca de aquí" — y el spot rara vez se mantiene perfectamente, así que el cierre real mezcla charm con cualquier gamma que produzca el movimiento del día. Pero el componente de charm es conocible por adelantado de una manera en que casi nada más en los mercados lo es. Es lo más parecido a una orden programada que ofrece el mercado, y está programada por el calendario, no por la decisión de nadie.

Este es precisamente el número que el [boletín Charm-into-Close](/forced-flow) muestra antes de la apertura: *el deterioro temporal por sí solo obliga a los dealers a comprar/vender \$X para las 16:00 ET si el subyacente se mantiene aquí.* Una fecha límite, una dirección y una cifra en dólares, todo calculable al amanecer.

---

## Poniéndole un número

Supongamos que es un viernes con un posicionamiento 0DTE pesado en SPY, con el spot en 560. El libro de los dealers contiene las opciones del mismo día, y a medida que el reloj corre hacia la campana cada una de ellas tiene que resolverse — terminar dentro del dinero o expirar sin valor — así que los deltas que los dealers están cubriendo oscilan con fuerza. Al reprecios todo el libro a las 16:00 con el spot fijo en 560, el flujo forzado total impulsado por el tiempo en un día 0DTE pesado alcanza el rango de los **miles de millones de dólares**. Ese es el número que traza el gráfico en vivo Charm-into-Close, y es literalmente lo que significa "los dealers deben operar antes del cierre".

Dos advertencias honestas sobre esa cifra destacada. Primero, la mayor parte corresponde a las opciones del mismo día que *se resuelven* en la campana — un efecto de pin que depende exactamente de dónde se asiente el spot, no un deterioro suave — así que es grande y sensible al spot. Segundo, el drift de charm puro, la parte que es genuinamente deterioro temporal del libro superviviente en lugar del evento de vencimiento, es solo una fracción de ello: del orden de unos pocos cientos de millones, que se acumulan de manera constante a lo largo de la tarde. El dashboard muestra ambos — el flujo completo de cierre y el drift de solo charm — porque responden a preguntas distintas, y el número más pequeño de solo charm es la lectura más limpia y menos sensible al spot.

Invierte la composición del libro y el mismo reloj obliga a comprar en lugar de vender. Charm no tiene una dirección inherente como la gravedad tiene "hacia abajo"; la dirección la determina en qué strikes los dealers están cortos y largos. Lo invariable es el *timing*: sea cual sea el signo, el flujo se concentra hacia el cierre y puedes verlo venir — calculable a las 9:35 de esa misma mañana.

---

## Cómo usarlo realmente

Una disciplina breve:

- **Lee el signo en la apertura.** La cifra de charm-into-close te dice en qué dirección está empujando el reloj hoy y aproximadamente con cuánta fuerza. Eso es contexto de régimen, no una entrada.
- **Busca la confluencia.** Cuando charm apunta en la misma dirección que el imán de gamma — hacia el que deriva el strike price pesado —, las dos fuerzas se suman y el drift hacia el cierre está en su punto más limpio. Cuando discrepan, espera oscilaciones erráticas, no drift.
- **Respeta la condición "si el spot se mantiene".** Charm es un pronóstico condicional. Un movimiento del 1% a media tarde le entrega el volante a gamma y puede inundar por completo la lectura de charm. El pronóstico es más fiable en días tranquilos y de rango acotado — que son también los días en que más importa.
- **Descuéntalo cuando la volatilidad se está expandiendo.** En un día genuinamente volátil, las reacciones de gamma dominan y el ordenado drift de charm se convierte en ruido.

El reloj es el trader más fiable del mercado. Ejecuta la misma orden cada día, te dice de antemano qué va a hacer, y nunca falla en presentarse a las 16:00. Charm es la forma en que lees su ticket de orden.

Para el concepto matriz, ver [Delta and Its Three Children](/education/delta-and-its-three-children); para el hermano impulsado por la volatilidad, ver [Vanna: When Fear Fades, Dealers Buy](/education/vanna-when-fear-fades); y para ver la curva hacia el cierre construirse en tiempo real, abre la página en vivo [Forced Flow](/forced-flow).

Solo contenido educativo — nada de lo anterior constituye una recomendación de trading.
