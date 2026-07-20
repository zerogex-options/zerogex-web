# Max Pain explicado — ¿funciona realmente?

*Max pain explicado con honestidad — qué es, la teoría que se cita para justificarlo, la evidencia sobre si el max pain realmente mueve el precio, y cómo usarlo sin sobrevalorarlo.*

---

## Por qué vale la pena hacerse esta pregunta

Max pain es uno de esos conceptos que vive en dos mundos muy distintos. En el mundo retail de las opciones, se cita casi como una ley física — *"el precio es atraído hacia el max pain al vencimiento."* En el mundo institucional, se trata como una teoría popular que ocasionalmente describe un pinning real pero que probablemente recibe el mérito de efectos que en realidad están impulsados por otra cosa. La verdad, como suele ocurrir, está en un punto intermedio — pero más cerca de la visión institucional que de la retail.

Este artículo es la lectura honesta. Definiremos el max pain, repasaremos cómo se calcula, expondremos la teoría que se cita a su favor, y luego veremos qué sugiere realmente la evidencia disponible sobre si el max pain *mueve* el precio o simplemente *describe* dónde termina el precio. A lo largo del texto, el objetivo es darte un modelo mental utilizable — no una herramienta de predicción, y tampoco una desmentida.

Para contexto, el max pain interactúa directamente con el marco más amplio del posicionamiento de los dealers. Si aún no lo has hecho, el [pilar sobre Gamma Exposure](/education/gamma-exposure-explained) cubre la mecánica estructural, y los artículos [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip) y [Gamma Walls explicado](/education/gamma-walls-explained) cubren los niveles con los que a menudo se confunde el max pain.

---

## ¿Qué es el max pain?

El max pain es el strike en el que el pago total a los tenedores de opciones al vencimiento se minimizaría — de forma equivalente, el strike en el que el mayor nocional agregado de opciones vence sin valor.

Cuando los traders preguntan "qué es el max pain," normalmente están planteando una de dos preguntas relacionadas: *qué strike está estructurado el chain para favorecer al vencimiento*, o *hacia qué strike sugiere la estructura del mercado de opciones que podría gravitar el precio*. Ambos planteamientos son razonables. El primero es un hecho definitorio; el segundo es una hipótesis sobre si ese hecho estructural tiene un efecto conductual sobre el precio.

La intuición: en cualquier strike dado, cada call in-the-money y cada put in-the-money representa un pago adeudado a su tenedor al vencimiento. Sumados a lo largo del chain, esos pagos son una función de dónde termine el spot. Existe un precio — el strike de max pain — que minimiza ese pago total. Si el precio vence ahí, el mayor monto en dólares de posiciones largas en opciones termina sin valor.

La teoría popular da entonces un salto: si los *emisores* de opciones (a menudo dealers, market makers o vendedores institucionales) se benefician colectivamente de que el precio venza en el max pain, quizás los flujos estructurales del mercado empujan el precio hacia ahí. Ese salto es la parte que vale la pena examinar con honestidad.

---

## De dónde viene el concepto

El término max pain proviene de un cuerpo de investigación retail sobre opciones que se remonta a principios de la década de 2000, aplicado inicialmente a opciones de acciones individuales en torno a los vencimientos mensuales. La observación original era empírica: que los precios de cierre en la OPEX mensual, especialmente en acciones individuales con open interest concentrado, parecían agruparse cerca del strike que minimizaba el pago a los tenedores de opciones.

Esa agrupación era real. El mecanismo que la producía — y qué tan fiablemente se generaliza — es mucho más controvertido. Varios mecanismos distintos podrían producir la misma observación:

1. **Gamma-pinning de los dealers** en strikes pesados (que a menudo coincide con el max pain).
2. **Manipulación genuina** por parte de grandes emisores de opciones, en mercados donde eso resulta plausible.
3. **Sesgo de selección** — observación centrada en los casos en que ocurrió el pinning e ignorando los casos en que no ocurrió.
4. **Open interest concentrado en strikes psicológicamente redondos** cerca de los cuales el precio ya se encontraba.

Desentrañar esos mecanismos es difícil, y la literatura empírica es mixta. Se han observado efectos de pinning cerca de las fechas principales de OPEX mensual en algunos estudios, pero los efectos son generalmente pequeños, y a menudo se desvanecen o desaparecen en muestras más grandes y en productos indexados.

---

## ¿Cómo se calcula el max pain?

El cálculo es mecánico:

1. Para cada strike en el chain de opciones, se asume que el spot vence en ese strike.
2. Se calcula el valor intrínseco total de todas las calls in-the-money (`max(0, S − K) × OI`) en ese cierre hipotético.
3. Se calcula el valor intrínseco total de todas las puts in-the-money (`max(0, K − S) × OI`) en ese cierre hipotético.
4. Se suman ambos — ese es el pago total a los tenedores de opciones en ese cierre hipotético.
5. Se repite para todos los strikes; el que tenga el total más bajo es el strike de max pain.

El cálculo solo utiliza **open interest** y **strikes** — sin griegas, sin volatilidad implícita, sin ninguna suposición sobre el signo del dealer. Eso lo hace barato y fácil de calcular, lo cual es parte de por qué se difundió tanto. También es parte de por qué es estructuralmente más débil que las lecturas basadas en el gamma de los dealers: no sabe nada sobre cómo se cubren realmente los dealers.

El resultado es un único strike (o a veces un pequeño rango de strikes casi iguales), recalculado en cada instantánea del chain. Como cualquier otro nivel derivado del chain, el max pain es **dinámico** — se desplaza a medida que el OI rota a lo largo del día y de una sesión a otra hasta el vencimiento.

---

## La teoría: por qué el max pain "debería" funcionar

El argumento estándar es mecanicista:

1. Los emisores de opciones (dealers, market makers y vendedores institucionales) pagan colectivamente la parte in-the-money del libro de opciones al vencimiento.
2. Tienen interés en minimizar ese pago.
3. Por lo tanto, tienen interés en que el spot venza en el strike que minimiza el pago total — el strike de max pain.
4. A través de su actividad de cobertura o trading, ejercen presión estructural para empujar el spot hacia ese strike, especialmente cerca del vencimiento.

Es una historia limpia. Y también es aquí donde debe empezar la honestidad. El argumento tiene varios puntos débiles:

- **Los dealers manejan libros delta-neutrales.** Su P&L está dominado por la captura de spread, no por resultados direccionales al vencimiento. El planteamiento de "los dealers quieren el precio en el max pain" asume un libro direccional que generalmente no tienen.
- **El mecanismo de cobertura no es el argumento del pago al emisor.** Si los dealers efectivamente fijan el precio cerca de un strike, suele ser a través de la cobertura de *gamma* — el reflejo que los obliga a vender fortaleza y comprar debilidad cuando están largos en gamma — que es un mecanismo distinto, a veces dirigido a un strike diferente al max pain.
- **La versión de "manipulación" de la historia** — grandes emisores negociando activamente el subyacente para defender un strike — es plausible en algunos mercados de acciones individuales poco líquidos y mucho menos plausible en productos indexados líquidos como SPX.

En otras palabras, el *resultado* que predice la teoría del max pain (el precio gravitando hacia un strike estructural) a veces ocurre, pero el *mecanismo* que cita generalmente no es el mecanismo real.

---

## ¿Funciona realmente el max pain?

La respuesta honesta es: **a veces, débilmente, y generalmente porque algo más está haciendo el trabajo.**

Algunos planteamientos que se sostienen:

### El mecanismo más limpio es el gamma pinning, no la minimización del pago

Cuando el precio *efectivamente* se fija cerca de un strike estructural al vencimiento — particularmente en la OPEX mensual en productos indexados — el mecanismo es casi siempre la cobertura de gamma de los dealers en un régimen de gamma positivo, no el argumento del pago al emisor detrás del max pain. El gamma se concentra en strikes con open interest pesado, y en regímenes de gamma largo el reflejo del dealer efectivamente atrae el precio hacia strikes de gamma pesado a través de la actividad normal de cobertura.

El max pain a menudo coincide con una fuerte concentración de gamma (ambos son funciones de dónde se encuentra el OI), razón por la cual las dos lecturas frecuentemente concuerdan. Pero cuando *discrepan*, la lectura basada en gamma tiende a ser la más fiable — porque está fundamentada en un mecanismo de cobertura que los dealers efectivamente utilizan, no en un libro direccional que generalmente no tienen.

### El efecto, donde está presente, es pequeño y se concentra cerca de las principales OPEX

Los estudios sobre efectos de pinning en opciones de acciones han encontrado generalmente una agrupación pequeña pero medible de los precios de cierre cerca de strikes con OI pesado en los vencimientos mensuales, particularmente en acciones individuales. En SPX y productos indexados, el efecto es mucho más difícil de encontrar y de magnitud mucho menor. Incluso donde se ha observado, el efecto generalmente se mide en decenas de puntos básicos de deriva esperada durante la última sesión — mucho más pequeño que el rango típico realizado en el día.

### La mayoría de las veces se discute como una descripción, no como una predicción

Incluso los traders que observan de cerca el max pain tienden a usarlo como **contexto**, no como un nivel contra el cual operar. El planteamiento es "si todo lo demás está equilibrado, espera cierta atracción estructural hacia este strike cerca del vencimiento" — no "el max pain es X, por lo tanto el precio irá ahí."

### Dónde definitivamente no funciona

Algunos planteamientos que se deben evitar:

- **El max pain como objetivo intradía.** La versión retail de la teoría a menudo se estira hasta "el precio se dirige hoy hacia el max pain" — no existe un mecanismo que respalde eso en horizontes intradía en productos indexados líquidos.
- **El max pain como un pin rígido.** Incluso donde existen efectos de pinning, son tendencias estadísticas en promedios, no resultados fiables por cada vencimiento individual.
- **El max pain en un régimen de gamma profundamente negativo.** Cuando el reflejo del dealer amplifica los movimientos en lugar de amortiguarlos, cualquier tesis de pinning basada en strikes pesados — max pain o de otro tipo — se invierte. El strike se convierte en un vector de ruptura, no en un imán.

---

## Max pain frente al gamma magnet

El pariente mecánico más cercano al max pain es lo que a veces se llama el **gamma magnet** — el strike con la mayor concentración de gamma de los dealers cerca del vencimiento. En un régimen de gamma positivo, el gamma magnet a menudo *sí* atrae el precio cerca del vencimiento, a través del mecanismo de cobertura descrito anteriormente.

La diferencia práctica:

- **Max pain** responde: *¿dónde se minimiza el pago a los tenedores de opciones al vencimiento?*
- **Gamma magnet** responde: *¿dónde es más pesada la concentración de cobertura de los dealers, y en qué dirección tira?*

Cuando los dos strikes están cerca — lo cual ocurre a menudo —, ambas lecturas concuerdan, y la atracción estructural tiende a ser visible en el tape. Cuando divergen, la lectura de gamma generalmente gana, porque el reflejo de gamma es el mecanismo de cobertura real que produce el pin.

Un trader que usa el max pain por sí solo está leyendo el *resultado* del libro de los dealers sin leer el libro de los dealers en sí. Leer ambos — max pain *y* el perfil de gamma — es el flujo de trabajo más limpio.

---

## Cómo usar el max pain sin sobrevalorarlo

Un planteamiento pragmático:

1. **Trata el max pain como contexto, no como un objetivo.** Es un dato estructural sobre dónde está equilibrado el chain; no es un pronóstico.
2. **Contrástalo con el gamma magnet.** Si el strike de mayor gamma y el max pain concuerdan, la tesis del pin (donde existe) es más nítida. Si discrepan, prioriza la lectura de gamma por defecto.
3. **Dale más peso cerca de la OPEX mensual, menos intradía.** El efecto débil que existe se concentra cerca del vencimiento. Leer el max pain intradía en un martes cualquiera te dice muy poco.
4. **Lee siempre primero el régimen.** Un régimen de gamma largo es el único régimen en el que cualquier tesis de pinning — max pain o de otro tipo — tiene un mecanismo estructural detrás. En regímenes de gamma corto, descarta por completo la tesis del pin.
5. **Úsalo para *enmarcar* operaciones, no para *entrar* en ellas.** Un régimen de gamma largo, un gamma magnet que concuerda con el max pain unos puntos por encima del spot, y una fecha de OPEX podrían en conjunto justificar vender los rallies hacia el nivel. Ninguno de esos elementos por sí solo es una operación.

---

## Cómo muestra ZeroGEX el max pain

El dashboard muestra el max pain junto a las lecturas de gamma de los dealers para que puedan contrastarse en lugar de leerse de forma aislada:

- **La tarjeta Max Pain** muestra el strike de max pain actual con distancia en vivo en dólares y porcentaje respecto al spot.
- **La tarjeta Gamma Flip** muestra si el spot está en el régimen de gamma largo (donde las tesis de pinning tienen un mecanismo) o en el régimen de gamma corto (donde no lo tienen).
- **Las tarjetas Call Wall y Put Wall** muestran dónde se sitúa realmente la concentración de gamma de los dealers.
- **El gráfico de perfil por strike** muestra la curva de gamma de los dealers para que el gamma magnet sea visible directamente.

![Tarjeta Max Pain del dashboard de ZeroGEX con distancia en vivo respecto al spot](/blog/zerogex-max-pain-card.png)

Un ejemplo práctico. Supongamos que SPX está en 5.830 la mañana de una OPEX mensual, y el dashboard muestra:

- **Max Pain:** 5.820
- **Gamma Magnet (strike de mayor gamma):** 5.820
- **Net GEX:** +1.600 millones de dólares
- **Gamma Flip:** 5.805

Tanto la lectura de max pain como la de concentración de gamma concuerdan en 5.820, el régimen es sólidamente gamma largo, y es OPEX mensual. La lectura estructural: la tesis de atracción hacia 5.820 está tan respaldada como puede estarlo. Inclinación práctica: deriva hacia 5.820, vendiendo los rallies por encima de ese nivel, comprando las caídas hasta ahí. Sigue siendo una inclinación probabilística — no una garantía —, pero cada condición estructural que *produciría* pinning está activa.

![Gráfico de perfil por strike de ZeroGEX mostrando el gamma magnet en el mismo strike que el max pain](/blog/zerogex-max-pain-gamma-agreement.png)

Ahora imagina una mañana distinta: SPX en 5.830, max pain en 5.810, pero el strike de mayor gamma es 5.840 y el Net GEX es de −400 millones de dólares. Las lecturas discrepan, el régimen es de gamma corto, y es una sesión regular sin vencimiento. La lectura estructural: el max pain está *describiendo* una geometría de payoff del chain, no señalando un nivel que el libro de los dealers vaya a defender. La decisión honesta es ignorar el max pain en este estado y apoyarse en la lectura del régimen en su lugar.

---

## Conceptos erróneos comunes sobre el max pain

Algunas trampas:

- **"El precio es atraído hacia el max pain al vencimiento."** Una tendencia débil en algunos casos de OPEX de acciones individuales, mucho más débil en productos indexados, y ausente en regímenes de gamma corto. No es una regla.
- **"El max pain es donde cerrará el gráfico hoy."** Casi nunca es útil como objetivo intradía o diario.
- **"Los grandes emisores manipulan el precio hacia el max pain."** Implausible a la escala de los productos indexados líquidos. Plausible en algunos mercados de acciones individuales poco líquidos, pero aun así no es el mecanismo dominante del efecto observado.
- **"Max pain y el gamma flip son lo mismo."** No lo son. El flip es la línea de régimen; el max pain es un strike de geometría de payoff. Responden preguntas diferentes.
- **"El max pain es un indicador contrarian."** No está construido para serlo. Tratarlo como tal añade ruido.

---

## Conclusión

> El max pain es un cálculo real que describe una geometría real del chain. No es un predictor fiable del precio.

El planteamiento más claro es este: el max pain a menudo coincide con una fuerte concentración de gamma, y *esa* es la atracción estructural que los traders a veces observan cerca del vencimiento. Cuando el max pain y el gamma magnet concuerdan en un régimen de gamma largo cerca de la OPEX, la tesis del pin está en su punto más fuerte — e incluso entonces, es una inclinación probabilística. Cuando discrepan, la lectura de gamma es la más fiable.

Usado como contexto dentro de un marco más amplio de posicionamiento de los dealers, el max pain es una verificación cruzada útil. Usado como pronóstico por sí solo, tiende a inducir a error.

Solo contenido educativo — nada de lo anterior es una recomendación de trading.

---

Si quieres ver la lectura de max pain de hoy en tiempo real, junto con el gamma flip, las call y put walls, y el perfil de gamma de los dealers que decide si una tesis de pin tiene un mecanismo detrás, el dashboard gratuito de ZeroGEX muestra todo esto.
