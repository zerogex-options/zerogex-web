# Vanna: cuando el miedo se desvanece, los dealers compran

*Vanna es la tasa a la que cambia el delta de una opción cuando cambia la volatilidad implícita. Cuando el miedo que estaba puesto en precio se drena del mercado tras un evento que nunca llegó a materializarse, vanna obliga a los dealers a comprar acciones en un goteo lento y constante — ese "sube sin noticias" que aparece en el gráfico pero nunca en el volumen.*

---

## El flujo que no se ve en el tape

Existe un tipo de sesión que todo trader reconoce y pocos saben explicar: el mercado flota hacia arriba durante todo el día, vela verde tras vela verde, con un volumen que no tiene nada de especial y noticias que sencillamente no existen. Nadie parece estar comprando, y sin embargo sigue subiendo. Preguntas por ahí y solo obtienes encogimientos de hombros — "melt-up", "deriva de baja volatilidad", "gamma". El motor real suele ser vanna, y una vez que se entiende, esas sesiones dejan de parecer misteriosas.

Vanna es la sensibilidad del delta respecto a la volatilidad implícita — ∂Δ/∂σ. Es el tercero de los tres "hijos" del delta, junto con gamma (delta frente al precio) y charm (delta frente al tiempo), expuestos en [Delta y sus tres hijos](/education/delta-and-its-three-children). Como charm, obliga a los dealers a operar con el spot perfectamente quieto. A diferencia de charm, su detonante no es el reloj sino el miedo: la expectativa de movimiento futuro que el mercado tiene puesta en precio, cotizada como volatilidad implícita.

Este es el análisis mecánico en profundidad que subyace a nuestra explicación más amplia [Vanna y Charm explicados](/education/vanna-and-charm-explained). Aquel artículo ubica a vanna dentro del panorama de regímenes; este muestra exactamente por qué un dato de vol a la baja se convierte en un bid de los dealers.

---

## Por qué el delta se mueve cuando se mueve la vol

La volatilidad implícita fija la amplitud de la distribución de resultados que espera el mercado. Una IV alta significa que el mercado considera plausible un rango amplio de precios; una IV baja significa que espera que las cosas se mantengan cerca de donde están.

Piensa ahora en qué le hace esto a una call fuera del dinero. Cuando la IV es alta y la distribución es amplia, ese strike lejano tiene una probabilidad real de ser alcanzado, así que su delta está claramente por encima de cero — digamos 0,25. Deja que el miedo se drene, que la distribución se estreche, y ese mismo strike de repente parece mucho menos alcanzable. Su delta cae hacia cero — digamos 0,15. El spot nunca se movió. Lo único que cambió fue la estimación del mercado sobre cuánto *podría* moverse el spot, y eso por sí solo repreció el delta de la opción.

Ese cambio es vanna. Cada opción fuera del dinero de la cadena repreza su delta cuando se mueve la vol, y el delta de todo el libro se desplaza como resultado. El dealer estaba cubierto según los deltas de ayer; el dato de vol de hoy acaba de cambiarlos; el hedge tiene que moverse para ponerse al día.

---

## Por qué el miedo que se desvanece tiende a ser un bid

La dirección del flujo de vanna depende de cómo está compuesto el libro, pero el esquema de manual — el que produce el goteo reconocible — funciona así.

Los clientes están, en conjunto, largos de opciones. Compran calls para el alza y puts como protección, y los dealers están cortos del otro lado. Considera los momentos *después* de un susto: la vol implícita se disparó al alza antes de un dato de CPI, una reunión del FOMC, un evento de earnings. El riesgo pasa. El movimiento temido no se materializa. La vol implícita, que estaba cara, empieza a desangrarse a la baja en las horas y días siguientes.

A medida que la vol cae:

1. Los deltas de las opciones fuera del dinero en las que el dealer está corto se desplazan hacia cero.
2. La posición neta de delta corto del dealer se encoge — mecánicamente están menos cortos del mercado de lo que estaban.
3. Para restablecer el hedge, compran acciones.
4. La vol sigue desangrándose, así que el desplazamiento continúa, así que las compras siguen llegando — pequeñas, constantes, durante todo el día.

Esa compra constante y mecánica es el vanna grind. No es una apuesta. Ningún dealer decidió que el mercado debía subir. La vol cayó, los deltas se desplazaron, y el hedge exigió acciones. Pero el agregado de miles de pequeñas compras forzadas es indistinguible, en el gráfico, de una demanda genuina — que es exactamente por qué el tape va subiendo mientras el volumen dice que no está pasando nada. La compra es real; simplemente llega como un goteo de órdenes límite en vez de una oleada de órdenes de mercado, así que mueve el precio sin encender las barras de volumen.

---

## La escalera de vanna

Como el flujo de vanna está impulsado por una variable que se puede shockear directamente, se puede representar como una escalera: mantén fijos el spot y el tiempo, mueve la vol implícita hacia arriba y hacia abajo un punto a la vez, y lee cuántas acciones se ve forzado a negociar el libro del dealer en cada peldaño.

El gráfico en vivo [Vanna Ladder](/forced-flow) hace exactamente esto. Con cero cambio de vol el flujo forzado es cero — nada se ha movido, así que nada está obligado. Baja la vol un punto y el gráfico muestra la compra forzada que produciría una compresión de un punto; bájala dos puntos y la compra aproximadamente se duplica. Sube la vol y el signo se invierte: un pico de vol obliga a los dealers a vender, lo cual es parte de por qué el miedo se retroalimenta en una caída. La escalera hace legible la asimetría — puedes ver, antes de que ocurra, cuánto bid vale hoy un desangrado de vol de dos puntos.

---

## Ponerle un número

Supongamos que el SPX está en 5.800 la mañana después de un dato de inflación tranquilo, la vol implícita empieza a comprimirse, y el libro del dealer lleva el sesgo típico de cliente largo. El motor repreza el libro con el spot fijo en 5.800 y la vol dos puntos más baja, y encuentra el delta del dealer más alto por el equivalente a 60 millones de dólares de exposición al índice. Eso es aproximadamente **60 millones de dólares** de compra forzada, repartidos a lo largo de la sesión a medida que la vol efectivamente se desangra — un bid persistente sin ningún catalizador detrás que ningún titular reportaría.

Invierte el movimiento de la vol y el mismo mecanismo fuerza ventas. Vanna, como charm, no tiene una dirección incorporada; el signo viene del libro y de la dirección del movimiento de vol. Lo que sí es fiable es el *carácter* del flujo: lento, constante, invisible en el volumen y estrechamente acoplado a la tendencia de la vol más que a la tendencia del precio.

---

## Cómo leerlo sin perseguirlo

Vanna es contexto, no un disparador. Una disciplina breve:

- **Revisa primero la tendencia de la vol.** Un desangrado de IV de varios días tras un evento es el esquema clásico de bid por vanna. Una vol en ascenso invierte el flujo hacia la venta. Sin tendencia de vol, no hay historia de vanna.
- **Confirma el régimen.** El vanna grind coexiste de forma natural con un régimen de gamma positivo — ambos favorecen el mismo tape calmado y absorbente. En un régimen de gamma negativo, el mismo movimiento de vol puede verse desbordado por reacciones de precio amplificadas. Lee primero [gamma](/education/gamma-exposure-explained), y vanna dentro de ese marco.
- **Espera el grind, no un salto.** La compra por vanna es un goteo. Produce deriva, no impulso. Si estás esperando una vela de vanna, has malinterpretado el flujo — se esconde en la pendiente, no en el pico.
- **Respeta el desajuste de volumen.** "Sube sin volumen" no es una señal de alarma en un régimen de vanna; es la firma. La ausencia de volumen es la pista de que la compra es mecánica.

Cuando el susto que nunca llega finalmente pasa, el miedo tiene que desmontarse en algún lugar. Se desmonta a través del libro del dealer, un re-hedge a la vez, y se ve como un mercado que decide en silencio subir sin motivo. Ahora conoces el motivo.

Para el hermano gobernado por el reloj, ver [Charm: el reloj es un trader](/education/charm-the-clock-is-a-trader); para los fundamentos, ver [Por qué los market makers están obligados a negociar acciones](/education/why-market-makers-trade-stock); y para ver la escalera de vanna moverse con el libro de hoy, abre la página en vivo [Forced Flow](/forced-flow).

Contenido solo con fines educativos — nada de lo anterior es una recomendación de trading.
