# Charm: el reloj es un trader

*Charm es la sensibilidad del delta al tiempo, con el resto de variables constantes. Estima una presión de cobertura potencial y condicional - no una orden programada de los dealers - cuando el spot, la IV y el inventario supuesto se mantienen cerca de sus valores actuales.*

---

## El griego que opera sobre una cinta vacía

La mayoría de los flujos necesitan que pase algo. Gamma necesita un movimiento de precio. Las noticias necesitan noticias. Charm no necesita nada más que el reloj. Es la sensibilidad del delta al paso del tiempo - ∂Δ/∂t, con el spot y la vol constantes - y el tiempo pasa haga o no haga algo la cinta. Un dealer puede estar frente a un mercado que no se ha movido ni un tick en noventa minutos y aun así encontrarse con que el delta modelado de su libro se está deteriorando silenciosamente, lo que le empuja a vender acciones todo ese tiempo para mantener la cobertura alineada.

Eso es lo que hace que charm resulte extraño y, una vez que lo entiendes, obvio. El reloj es un trader - uno modelado. Nunca se detiene y nunca cambia de opinión, y con el resto de variables fijas apunta en la misma dirección durante toda la sesión. Las únicas preguntas son en qué dirección empuja, cuán fuerte llega a ser ese empuje y si los movimientos reales del spot y de la vol durante el día lo dejan intacto.

Este artículo es el complemento mecánico de nuestra explicación más amplia [Vanna y Charm explicados](/education/vanna-and-charm-explained). Ese artículo presenta a charm como uno de los insumos de la lectura de fin de jornada; este entra en el detalle mecánico - de dónde viene el drift, por qué se acelera, y cómo puedes ponerle una cifra en dólares y una fecha límite antes de que suceda.

---

## De dónde viene el drift

El delta está estrechamente relacionado con - pero no es exactamente - la probabilidad neutral al riesgo de que una opción termine dentro del dinero. Una call con delta 0,30 es, a grandes rasgos, la forma en que el mercado dice que hay algo así como un 30% de probabilidad de que expire con valor. Esa probabilidad implícita es una estimación viva, y a medida que se acerca el vencimiento tiene que colapsar hacia un veredicto: o la opción termina dentro del dinero (delta → 1) o no lo hace (delta → 0), y solo el caso at-the-money, en el filo de la navaja, queda sin decidir hasta la campana.

Charm es la velocidad de ese colapso. Observa una opción ligeramente fuera del dinero a lo largo de una tarde con el spot clavado:

- Esta mañana tenía delta 0,35 - una probabilidad real de generar pago.
- Al mediodía, con menos tiempo en el reloj y el spot sin cambios, delta 0,28.
- A las 15:00, delta 0,18.
- Cerca de la campana, el delta deslizándose hacia 0.

Nada se movió. El delta de la opción cayó a la mitad de todos modos, únicamente porque se acortó la pista. Cada uno de esos pasos es un cambio en el ratio de cobertura, y cada cambio obliga al dealer que mantiene esa opción a ajustar su posición en acciones. Ese ajuste es el flujo de charm.

Las opciones dentro del dinero hacen la imagen especular, afirmándose de 0,80 hacia 1,00 a medida que su resultado se convierte en una casi certeza. El charm neto del libro se modela como la suma en todos los strikes, ponderada por cuánto open interest hay allí y, según la convención de posicionamiento, de qué lado se supone que está el dealer - el inventario real de los dealers no es directamente observable a partir de los datos públicos de opciones.

---

## Por qué se acelera hacia el cierre

Charm no es constante a lo largo del día. La tasa de deterioro del delta es pequeña cuando queda mucho tiempo por delante y crece a medida que se acerca el vencimiento - es máxima en la última hora y máxima de todas en los últimos minutos, para los strikes cercanos al dinero que aún tienen un veredicto pendiente. En una cadena dominada por vencimientos del mismo día, que hoy es la norma para SPX, la mayor parte del flujo de charm de la jornada se comprime en los últimos sesenta a noventa minutos.

Esta es la razón mecánica por la que el "drift hacia el cierre" es un fenómeno recurrente y no una superstición de gráfico. No es que los traders se pongan emotivos a las 15:00. Es que las matemáticas del deterioro del delta concentran ahí la mayor parte de su fuerza modelada, y los dealers que cubren ese deterioro tienden a hacer el grueso de sus ajustes tarde - incluso los que trabajan con bandas de cobertura en lugar de operar de forma continua. El flujo modelado se intensifica porque el griego se intensifica.

El gráfico en vivo [Charm into Close](/forced-flow) dibuja exactamente esto: mantiene fijos el spot y la vol, avanza el reloj hasta la campana, y traza las acciones acumuladas que, según el modelo, el libro de los dealers opera en cada paso. La curva parte de cero en el momento actual y se aleja de cero conforme avanza la tarde - más pronunciada al final, porque ahí es donde vive charm.

---

## Un pronóstico con fecha límite

Aquí está la propiedad que hace que charm sea singularmente útil, y es algo que no encontrarás en un análisis estándar de los griegos.

Cualquier otro flujo de los dealers es contingente. El flujo de gamma depende de un movimiento del spot que puede llegar o no. El flujo de vanna depende de un cambio de volatilidad que no puedes programar. El *componente* de charm depende solo del tiempo, y el tiempo es la única variable que va a hacer exactamente lo que esperas. A las 9:35 de la mañana, manteniendo el spot y la vol en sus niveles actuales, puedes estimar cuántas acciones el deterioro temporal *por sí solo* haría comprar o vender a los dealers antes del cierre. Obtienes un tamaño y una dirección modelados para un flujo grande horas antes de que se desarrolle - condicionado a que el resto del mundo se quede quieto, cosa que nunca ocurre del todo.

Eso es un pronóstico con fecha límite. El pronóstico tiene una condición adjunta - "si el spot y la vol se mantienen cerca de aquí" - y rara vez se mantienen perfectamente, así que el cierre real mezcla charm con cualquier gamma y vanna que produzcan los movimientos del día. Pero el componente de charm es estimable por adelantado de una manera en que casi nada más en los mercados lo es. Es lo más parecido a un flujo predecible y marcado por el calendario que ofrece el mercado - una presión modelada fijada por el reloj, no una orden programada que alguien esté obligado a ejecutar.

Este es esencialmente el número que el [boletín Charm-into-Close](/forced-flow) muestra antes de la apertura: *según el modelo, el deterioro temporal por sí solo llevaría a los dealers a comprar/vender \$X hacia el cierre si el subyacente se mantiene aquí.* Una fecha límite, una dirección y una cifra en dólares, todo estimable al amanecer.

---

## Poniéndole un número

Supongamos que es un viernes con un posicionamiento 0DTE pesado en SPY, con el spot en 560. El libro de los dealers contiene las opciones del mismo día, y a medida que el reloj corre hacia la campana cada una de ellas tiene que resolverse - terminar dentro del dinero o expirar sin valor - así que los deltas que los dealers están cubriendo oscilan con fuerza. Reprecia todo el libro al cierre con el spot fijo en 560 y el flujo total modelado impulsado por el tiempo en un día 0DTE pesado puede llegar al orden de los **mil millones de dólares**. Ese es el número que traza el gráfico en vivo Charm-into-Close, y es lo que significa en la práctica "cuánto se modela que operen los dealers antes del cierre".

Dos advertencias honestas sobre esa cifra destacada. Primero, la mayor parte corresponde a las opciones del mismo día que *se resuelven* en la campana - un efecto de pin que depende exactamente de dónde se asiente el spot, no un deterioro suave - así que es grande y sensible al spot. Segundo, el drift de charm puro, la parte que es genuinamente deterioro temporal del libro superviviente en lugar del evento de vencimiento, es solo una fracción de ello: del orden de unos pocos cientos de millones, que se acumulan de manera constante a lo largo de la tarde. El dashboard muestra ambos - el flujo completo de cierre y el drift de solo charm - porque responden a preguntas distintas, y el número más pequeño de solo charm es la lectura más limpia y menos sensible al spot.

Invierte la composición del libro y el mismo reloj apunta a comprar en su lugar. Charm no tiene una dirección inherente como la gravedad tiene "hacia abajo"; la dirección la determina en qué strikes se modela a los dealers cortos y largos. Lo que tiende a mantenerse es el *timing*: sea cual sea el signo, el flujo modelado se concentra hacia el cierre, y esa concentración es estimable a las 9:35 de esa misma mañana.

---

## Cómo usarlo realmente

Una disciplina breve:

- **Lee el signo en la apertura.** La cifra de charm-into-close te dice en qué dirección está empujando el reloj hoy y aproximadamente con cuánta fuerza. Eso es contexto de régimen, no una entrada.
- **Busca la confluencia.** Cuando charm apunta en la misma dirección que el imán de gamma - el strike pesado hacia el que deriva el precio -, las dos fuerzas se suman y el drift hacia el cierre está en su punto más limpio. Cuando discrepan, espera oscilaciones erráticas, no drift.
- **Respeta la condición "si el spot se mantiene".** Charm es un pronóstico condicional. Un movimiento del 1% a media tarde le entrega el volante a gamma y puede ahogar por completo la lectura de charm. La estimación basada solo en el tiempo es más fácil de aislar en días tranquilos, pero ZeroGEX no ha presentado esa observación como un resultado de rendimiento calibrado.
- **Descuéntalo cuando la volatilidad se está expandiendo.** En un día genuinamente volátil, las reacciones de gamma dominan y el ordenado drift de charm se convierte en ruido.

Charm mantiene constantes el spot y la IV por definición. Las carteras reales contienen compensaciones entre strikes y vencimientos; los dealers pueden usar bandas de cobertura, futuros u otras opciones, y las nuevas operaciones pueden cambiar el inventario. Por tanto, la estimación representa una presión de cobertura potencial debida solo al tiempo, no una prueba de cuándo ni de cuánto operarán los dealers.

Para el concepto matriz, consulta [Delta y sus tres hijos](/education/delta-and-its-three-children); para el hermano impulsado por la volatilidad, consulta [Vanna: cómo la caída de la IV puede cambiar la cobertura de los dealers](/education/vanna-when-fear-fades); y para ver la curva hacia el cierre construirse en tiempo real, abre la página en vivo [Forced Flow](/forced-flow).

Solo contenido educativo - nada de lo anterior es una recomendación de trading.
