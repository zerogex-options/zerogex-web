# Vanna: cómo la caída de la IV puede cambiar la cobertura de los dealers

*Vanna es la velocidad a la que cambia el delta de una opción cuando cambia la volatilidad implícita. Cuando el miedo descontado en el precio sale del mercado tras un evento que quedó en nada, vanna puede empujar a un libro de dealer típico a comprar acciones en un goteo lento y constante - el grind de "subida sin noticias", cuyos prints de cobertura se esconden a plena vista en el tape mientras el motivo que hay detrás sigue siendo invisible.*

---

## El flujo que no se ve en el tape

Existe un tipo de sesión que todo trader reconoce y pocos saben explicar: el mercado flota hacia arriba durante todo el día, vela verde tras vela verde, con un volumen que no tiene nada de especial y noticias que sencillamente no existen. Nadie parece estar comprando, y sin embargo sigue subiendo. Preguntas por ahí y solo obtienes encogimientos de hombros - "melt-up", "deriva de baja volatilidad", "gamma". El motor real suele ser vanna, y una vez que se entiende, esas sesiones dejan de parecer misteriosas.

Vanna es la sensibilidad del delta respecto a la volatilidad implícita - ∂Δ/∂σ. Es el tercero de los tres "hijos" del delta, junto con gamma (delta frente al precio) y charm (delta frente al tiempo), expuestos en [Delta y sus tres hijos](/education/delta-and-its-three-children). Como charm, obliga a los dealers a operar con el spot perfectamente quieto. A diferencia de charm, su detonante no es el reloj sino el miedo: la expectativa de movimiento futuro que el mercado tiene puesta en precio, cotizada como volatilidad implícita.

Este es el análisis mecánico en profundidad que subyace a nuestra explicación más amplia [Vanna y Charm explicados](/education/vanna-and-charm-explained). Aquel artículo ubica a vanna dentro del panorama de regímenes; este muestra exactamente por qué un dato de vol a la baja se convierte en un bid de los dealers.

---

## Por qué el delta se mueve cuando se mueve la vol

La volatilidad implícita fija la amplitud de la distribución de resultados que espera el mercado. Una IV alta significa que el mercado considera plausible un rango amplio de precios; una IV baja significa que espera que las cosas se mantengan cerca de donde están.

Piensa ahora en qué le hace esto a una call fuera del dinero. Cuando la IV es alta y la distribución es amplia, ese strike lejano tiene una probabilidad real de ser alcanzado, así que su delta está claramente por encima de cero - digamos 0,25. Deja que el miedo se drene, que la distribución se estreche, y ese mismo strike de repente parece mucho menos alcanzable. Su delta cae hacia cero - digamos 0,15. El spot nunca se movió. Lo único que cambió fue la estimación del mercado sobre cuánto *podría* moverse el spot, y eso por sí solo repreció el delta de la opción.

Ese cambio es vanna. Cada opción fuera del dinero de la cadena reprecia su delta cuando se mueve la vol, y el delta de todo el libro se desplaza como resultado. El dealer estaba cubierto según los deltas de ayer; el dato de vol de hoy acaba de cambiarlos; el hedge tiene que moverse para ponerse al día.

---

## Por qué el miedo que se desvanece tiende a ser un bid

La dirección del flujo de vanna depende de cómo está compuesto el libro, pero el esquema de manual - el que produce el goteo reconocible - funciona así.

Los clientes, en conjunto, tienden a hacer overwriting de calls para obtener rendimiento y a comprar puts como protección - de modo que, bajo la convención tradicional, los dealers se modelan como largos de esas calls y cortos de esas puts. Considera los momentos *después* de un susto: la vol implícita se disparó al alza antes de un dato de CPI, una reunión del FOMC, un evento de earnings. El riesgo pasa. El movimiento temido no se materializa. La vol implícita, que estaba cara, empieza a desangrarse a la baja en las horas y días siguientes.

A medida que la vol cae:

1. Los deltas de las opciones fuera del dinero en el libro del dealer se desplazan hacia cero.
2. El delta neto *largo* de opciones del dealer se encoge, de modo que el libro se inclina corto frente a su cobertura en acciones.
3. Para restablecer el hedge, compran acciones.
4. La vol sigue desangrándose, así que el desplazamiento continúa, así que las compras siguen llegando - pequeñas, constantes, durante todo el día.

Esa compra constante y mecánica es el vanna grind. No es una apuesta. Ningún dealer decidió que el mercado debía subir. La vol cayó, los deltas se desplazaron, y el hedge exigió acciones. Pero el agregado de miles de pequeñas compras de cobertura es difícil de distinguir, en el gráfico, de una demanda genuina - y por eso el tape puede ir subiendo sin ningún aumento evidente de la actividad. Esas compras son prints reales y sí suman volumen; simplemente llegan como un goteo constante en vez de una oleada de órdenes de mercado, así que elevan el precio sin un pico llamativo en las barras de volumen - y nada en el tape las señala como cobertura en lugar de convicción.

---

## La escalera de vanna

Como el flujo de vanna está impulsado por una variable que se puede shockear directamente, se puede representar como una escalera: mantén fijos el spot y el tiempo, mueve la vol implícita hacia arriba y hacia abajo un punto a la vez, y lee cuántas acciones se ve forzado a negociar el libro del dealer en cada peldaño.

El gráfico en vivo [Vanna Ladder](/forced-flow) hace exactamente esto. Con cero cambio de vol el flujo forzado es cero - nada se ha movido, así que nada está obligado. *Baja* la vol un punto y el gráfico muestra la compra forzada que produciría una compresión de un punto; bájala dos puntos y la compra aproximadamente se duplica. *Sube* la vol y el signo se invierte: un pico de vol tiende a empujar al mismo libro a vender, lo cual es parte de por qué el miedo puede retroalimentarse en una caída. La escalera hace legible la asimetría - puedes ver, antes de que ocurra, cuánto bid vale hoy un desangrado de vol de dos puntos.

---

## Ponerle un número

Supongamos que el SPX está en 5.800 la mañana después de un dato de inflación tranquilo, la vol implícita empieza a comprimirse, y el libro del dealer se modela con el sesgo típico de cliente largo. El motor reprecia el libro con el spot fijo en 5.800 y la vol dos puntos más baja, y encuentra el delta modelado del dealer más alto por el equivalente a 60 millones de dólares de exposición al índice. Eso es aproximadamente **60 millones de dólares** de compra de cobertura estimada, repartidos a lo largo de la sesión a medida que la vol efectivamente se desangra - un bid persistente sin ningún catalizador detrás que ningún titular reportaría.

Invierte el movimiento de la vol y el mismo mecanismo tiende a generar ventas. Vanna, como charm, no tiene una dirección incorporada; el signo viene del libro y de la dirección del movimiento de vol. Lo que tiende a ser fiable es el *carácter* del flujo: lento, constante, fácil de pasar por alto en el volumen (las operaciones de cobertura se imprimen en el tape, solo que no anuncian su motivo) y estrechamente acoplado a la tendencia de la vol más que a la tendencia del precio.

---

## Cómo leerlo sin perseguirlo

Vanna es contexto, no un disparador. Una disciplina breve:

- **Revisa primero la tendencia de la vol.** Un desangrado de IV de varios días tras un evento es el esquema clásico de bid por vanna. Una vol en ascenso invierte el flujo hacia la venta. Sin tendencia de vol, no hay historia de vanna.
- **Confirma el régimen.** El vanna grind coexiste de forma natural con un régimen de gamma positivo - ambos favorecen el mismo tape calmado y absorbente. En un régimen de gamma negativo, el mismo movimiento de vol puede verse desbordado por reacciones de precio amplificadas. Lee primero [el régimen de gamma](/education/gamma-exposure-explained), y vanna dentro de él.
- **Espera el grind, no un salto.** La compra por vanna es un goteo. Produce deriva, no impulso. Si estás esperando una vela de vanna, has malinterpretado el flujo - se esconde en la pendiente, no en el pico.
- **Respeta el desajuste de volumen.** Una subida constante con un volumen anodino no es una señal de alarma en un régimen de vanna; es la firma. No es que la compra no deje prints - sí los deja -, sino que nunca se dispara y nunca anuncia su motivo, y esa es la pista de que puede tratarse de cobertura mecánica y no de convicción.

Cuando el susto que nunca llega finalmente pasa, el miedo tiene que desmontarse en algún lugar. Se desmonta a través del libro del dealer, un re-hedge a la vez, y se ve como un mercado que decide en silencio subir sin motivo. Ahora conoces el motivo.

Para el hermano gobernado por el reloj, ver [Charm: el reloj es un trader](/education/charm-the-clock-is-a-trader); para los fundamentos, ver [Por qué los market makers están obligados a negociar acciones](/education/why-market-makers-trade-stock); y para ver la escalera de vanna moverse con el libro de hoy, abre la página en vivo [Forced Flow](/forced-flow).

Solo contenido educativo - nada de lo anterior es una recomendación de trading.


> Bajo la convención tradicional de dealer largo de calls y corto de puts, algunas configuraciones de la cadena pueden generar presión compradora modelada sobre el subyacente cuando cae la volatilidad implícita. El signo depende de la propiedad, el tipo de opción, la moneyness, el vencimiento, el skew y de cómo cambia la superficie de volatilidad; comprar no es una propiedad inherente de la vanna.
