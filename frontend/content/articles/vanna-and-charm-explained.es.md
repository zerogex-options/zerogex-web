# Vanna y charm explicados para traders de opciones

*Vanna y charm explicados — qué es cada una de estas griegas, por qué importan para los flujos de cobertura de los dealers, cómo vanna crea un bid persistente en regímenes de compresión de volatilidad, cómo charm impulsa los flujos predecibles hacia el cierre, y cómo interactúan con el régimen gamma.*

---

## Por qué vale la pena entender vanna y charm

Si has leído análisis sobre el posicionamiento de los dealers, sabrás que gamma acapara la mayor parte de la atención — y con razón. Es la griega de primer orden que captura la mayor parte del flujo de cobertura estructural. Pero no es la única fuerza en el libro del dealer. Dos griegas de segundo orden — **vanna** y **charm** — impulsan silenciosamente una parte significativa de los flujos que se ven en el tape, especialmente en torno a los resets de volatilidad, el OPEX y el cierre de la sesión de efectivo.

La mayoría de los traders que operan con marcos basados solo en gamma leen el régimen correctamente, pero pasan por alto las presiones de segundo orden dentro de él. Un régimen de compresión de volatilidad con compras persistentes impulsadas por vanna se comporta de forma distinta a uno sin ese efecto. Una cadena muy cargada de 0DTE hacia el cierre se comporta de forma distinta porque la decadencia de charm fuerza una recobertura continua. Añadir vanna y charm a la lectura no sustituye el marco de gamma — lo afina.

Este artículo explica qué es cada griega, por qué le importan a los dealers, cómo se manifiestan los flujos en el tape, y cómo interactúan con el régimen gamma. Para el marco estructural subyacente, empieza por el [pilar de Gamma Exposure](/education/gamma-exposure-explained); para la lectura de régimen, consulta [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip); y para las lecturas específicas de 0DTE, donde la decadencia de charm es más ruidosa, consulta [Posicionamiento de dealers en 0DTE explicado](/education/0dte-dealer-positioning-explained).

---

## ¿Qué es vanna en opciones?

Vanna es una griega de segundo orden que mide la **sensibilidad del delta de una opción a los cambios en la volatilidad implícita**. De forma equivalente — y este es el enfoque más útil para el análisis de flujos de los dealers — mide la sensibilidad del precio de una opción al movimiento conjunto de spot y vol.

En símbolos: vanna ≈ ∂Δ/∂σ = ∂²V/∂σ∂S. Es la derivada cruzada del valor de la opción respecto a spot y a la volatilidad implícita.

Lo que esto significa en términos prácticos: cuando la volatilidad implícita se mueve, el delta de tu opción se mueve *incluso si el spot no se mueve*. Una caída de la IV reduce el delta de las calls OTM y aumenta (en magnitud) el delta de las puts OTM. Una subida de la IV hace lo contrario. Cualquiera que mantenga un libro de opciones cuyo delta se desplace cuando se mueve la vol tiene que cubrir ese desplazamiento — y ahí es donde vanna se convierte en un flujo en el tape.

### Cómo experimentan vanna los dealers

Los dealers gestionan libros delta-neutrales. Cuando la IV cae, el delta de su inventario se desplaza, y tienen que negociar el subyacente para devolver el libro a la neutralidad. La dirección de ese trade depende de la composición de su libro.

El caso canónico que se discute en los análisis de flujo:

- Los dealers suelen estar cortos de calls (los clientes están netos largos).
- Cuando la IV cae, el delta de las calls OTM cae.
- Un dealer que estaba corto de una call OTM con delta 0,30 podría ahora estar corto de esa misma call con delta 0,25.
- Su exposición corta en delta se ha reducido — mecánicamente están menos cortos en el subyacente.
- Para permanecer delta-neutrales, tienen que *vender* subyacente — o, si mantenían subyacente largo como cobertura, venden parte de él.

Visto de forma aislada, eso suena bajista. El caso interesante es el inverso: en un mercado donde la IV ha estado bajando durante días o semanas (un régimen de compresión de volatilidad), los dealers están recobrando de forma continua la decadencia de vanna sobre una cadena fuertemente sesgada hacia el posicionamiento de clientes largos en calls. El agregado de esos flujos tiende a manifestarse como un bid persistente y estructural — el "vanna grind" del que los desks de flujo escriben desde hace años.

El signo exacto depende de la composición de la cadena. Un libro dominado por puts OTM cortas del dealer se comporta de forma distinta a uno dominado por calls OTM cortas del dealer. El análisis estándar asume el sesgo típico de cliente largo en calls/cliente largo en puts, que produce el resultado del vanna grind en compresión de volatilidad. En regímenes menos típicos, el signo puede invertirse.

---

## ¿Qué es charm en opciones?

Charm es una griega de segundo orden que mide la **sensibilidad del delta de una opción al paso del tiempo**. A medida que una opción se acerca al vencimiento, su delta se desplaza — las opciones out-of-the-money decaen hacia 0, las opciones in-the-money se desplazan hacia 1 (para calls) o -1 (para puts).

En símbolos: charm = ∂Δ/∂t.

La intuición: el delta de una opción es, en términos aproximados, la probabilidad implícita en el mercado de que venza en el dinero. A medida que pasa el tiempo, esa probabilidad tiene que converger hacia 0 o hacia 1. Para las opciones OTM esa probabilidad decae hacia 0; para las ITM sube hacia 1. Cuanto más cerca del vencimiento, más rápido es el desplazamiento.

### Cómo experimentan charm los dealers

Al igual que vanna, charm fuerza la recobertura sin ningún movimiento del spot. Un dealer que gestiona un libro delta-neutral ve cómo su exposición delta efectiva se desplaza únicamente por el paso del tiempo, y tiene que negociar el subyacente para mantenerse plano.

El signo direccional del flujo de cobertura impulsado por charm depende de qué lado del libro domina. Para un libro de dealer típico, cargado de calls cortas, mantenido hasta el cierre en una cadena 0DTE:

- Los deltas de las calls OTM decaen hacia 0.
- La exposición delta corta en calls del dealer se reduce en magnitud.
- Tienen que negociar el subyacente para mantenerse neutrales.
- En una cadena típica, la dirección neta de esa cobertura continua a lo largo de la tarde a menudo produce una deriva medible y estable en su signo.

Esa deriva es lo que la escuela de análisis de flujo de "EOD pressure" trata de leer. La señal existe porque la cobertura impulsada por charm es mecánicamente forzada — no requiere ninguna opinión, ningún volumen, ningún flujo direccional. Pasa el tiempo, los deltas se mueven, los dealers se recubren. La naturaleza continua de ese flujo es lo que lo hace legible.

---

## Por qué vanna y charm importan para la cobertura de los dealers

El enfoque más claro: gamma es la fuerza de cobertura *reactiva* — lo que hacen los dealers cuando el precio se mueve. Vanna y charm son las fuerzas de cobertura *no impulsadas por el precio* — lo que hacen los dealers cuando la vol se mueve o pasa el tiempo, incluso con el spot fijo.

Una cronología intradía estándar ilustra la diferencia:

- Un movimiento del spot del 0,2 % fuerza la cobertura de gamma — grande e inmediata.
- Una caída de 1 punto de volatilidad en la IV durante la mañana fuerza la cobertura de vanna — pequeña por minuto pero persistente.
- Ocho horas de decadencia temporal hacia el cierre fuerzan la cobertura de charm — pequeña por minuto pero acumulativamente significativa.

Las tres ocurren a la vez. En un tape tranquilo, gamma está en gran medida silenciosa (movimientos pequeños), y vanna y charm se convierten en el flujo dominante. En un tape violento, gamma domina y los flujos de segundo orden son ruido. La relevancia de vanna y charm depende tanto del régimen de volatilidad como del régimen gamma.

---

## Flujos de vanna en regímenes de compresión de volatilidad

El lugar más claro para ver vanna en el tape es durante una compresión sostenida de volatilidad — típicamente los días posteriores a un repunte de volatilidad que no llegó a entregar el movimiento realizado que el mercado había descontado.

El mecanismo:

1. La IV se dispara al alza por un riesgo percibido (CPI, FOMC, resultados empresariales).
2. El riesgo pasa sin producir el movimiento realizado descontado.
3. La IV empieza a desangrarse a lo largo de toda la cadena.
4. La cadena (el libro del dealer) recubre vanna de forma continua durante esa decadencia.
5. Para una cadena típica sesgada hacia clientes largos en calls, la cobertura agregada es un bid persistente en el subyacente.

El flujo es pequeño por minuto y a menudo invisible para quien solo mira las barras de volumen. Es más visible en gráficos intradía como una tendencia alcista lenta en un tape tranquilo que no coincide con el cuadro de volumen — las clásicas sesiones de "todo sube sin volumen" que siguen a datos de CPI sin sorpresas.

El flujo **no es direccional en su intención**. Los dealers se cubren, no apuestan. Pero el agregado de esa recobertura mecánica se comporta de forma indistinguible de un bid direccional. El carácter del tape resultante es la pista reveladora: deriva persistente con volumen bajo, baja volatilidad realizada, sin catalizador evidente.

El vanna grind también tiende a *coexistir* con un régimen de gamma positivo — ambos efectos favorecen las mismas condiciones de régimen, y ambos refuerzan el carácter absorbente y amortiguador del tape. Esa coexistencia es parte de por qué importa leerlos juntos.

---

## Flujos de charm hacia el vencimiento y hacia el cierre

El lugar más claro para ver charm son los últimos 90 minutos de la sesión de efectivo en cualquier día con flujo 0DTE significativo — lo cual ahora es la norma para SPX.

El mecanismo:

1. Los vencimientos del mismo día dominan la cadena cerca del spot.
2. Sus deltas decaen rápidamente a medida que se acerca el cierre.
3. Los dealers recubren esa deriva de forma continua.
4. El signo direccional de la cobertura agregada viene forzado por la composición de la cadena.
5. El flujo tiende a *acelerarse* a lo largo de la tarde a medida que aumenta la tasa de charm.

Por eso gran parte del análisis del posicionamiento de los dealers se centra específicamente en la franja de última hora de la tarde. El flujo de charm es mecánicamente forzado, estable en su signo para una cadena dada, y más visible en los últimos 60-90 minutos, cuando la tasa de decadencia del delta alcanza su pico.

Un patrón común: el flujo de charm apunta en una dirección, el imán de gamma se sitúa en la misma dirección, y el tape realizado se comprime hacia esa atracción estructural. La lectura combinada — imán de gamma más dirección de charm más rampa temporal — es lo que produce los setups más limpios de "deriva hacia el cierre". Nada de esto es, por sí solo, una señal de trading; es contexto de régimen que debería reformar la manera en que se lee una sesión.

---

## Vanna y charm hacia el OPEX

El OPEX mensual (tercer viernes) y el OPEX trimestral (tercer viernes de marzo, junio, septiembre y diciembre) concentran ambos efectos:

- **La decadencia de charm es máxima** en la última semana antes del vencimiento mensual, porque el gamma que se encuentra en el bloque a punto de vencer es máximo.
- **La sensibilidad de vanna es alta** porque la cadena está llena de opciones a punto de vencer, con deltas que reaccionan de forma brusca tanto al spot como a la vol.

Un tape típico de semana OPEX — en los regímenes en los que se manifiesta — muestra una deriva lenta hacia los strikes con más peso de lunes a miércoles, con el flujo impulsado por charm acelerando hacia el jueves y el viernes. La vol tiende a comprimirse a lo largo de la semana. La lectura combinada de vanna más charm suele producir algunos de los setups de "deriva estructural" más limpios del calendario.

Aquí es también donde la tesis de "vanna más charm hacia el OPEX" se estira más allá de su mecanismo. Los efectos son reales y sí producen flujo estructural, pero no son señales. Son condiciones de régimen que *podrían* producir deriva estructural si el régimen gamma la respalda. En un régimen de gamma negativo profundo, las mismas condiciones de semana OPEX pueden producir volatilidad realizada explosiva en lugar de compresión.

---

## Cómo interactúan vanna y charm con el régimen gamma

El enfoque único más útil:

- **En un régimen de gamma positivo**, los flujos de vanna y charm refuerzan el carácter amortiguador y favorable al pin del tape. El vanna grind sostiene la deriva, la decadencia de charm tira hacia el imán estructural, y el reflejo absorbente de la cobertura long-gamma mantiene el rango.
- **En un régimen de gamma negativo**, los flujos de vanna y charm pueden amplificar el momentum direccional en lugar de producir deriva. La misma decadencia de charm que fijaba el precio en long-gamma puede añadirse a un selloff en short-gamma si el libro del dealer está posicionado de esa manera.

La implicación práctica: **lee primero gamma, y luego lee vanna y charm dentro de ese marco.** Las griegas de segundo orden describen fuerzas que existen en cualquier régimen, pero su *efecto de comportamiento* está filtrado por el reflejo de gamma. Leer vanna o charm sin leer gamma es leer solo la mitad del libro.

---

## Cómo leer vanna y charm en el intradía

Un flujo de trabajo breve:

1. **Identifica primero el régimen gamma.** El gamma positivo respalda las lecturas de deriva estructural; el gamma negativo las invierte.
2. **Comprueba si la vol se ha estado comprimiendo.** Una decadencia de IV a lo largo de varios días durante la mañana es el setup que suelen alimentar los flujos de vanna. Un repunte de volatilidad invierte la dirección del flujo.
3. **Observa la ventana de charm.** Los últimos 90 minutos son cuando charm es más ruidoso. Busca la coincidencia de signo entre la dirección de charm y el imán de gamma — que ambos apunten en la misma dirección es el setup más limpio.
4. **Contrasta con las fechas de OPEX.** El OPEX mensual y el trimestral concentran ambos flujos. Trátalos como amplificadores de régimen.
5. **Descuenta en los días de repunte de volatilidad.** Cuando la volatilidad realizada se expande, tanto los flujos de vanna como los de charm quedan dominados por las reacciones de gamma. La lectura de segundo orden se convierte en ruido.

La disciplina no consiste en perseguir directamente el vanna grind o la deriva de charm — sino en usarlos como contexto adicional que afina la lectura de gamma.

---

## Cómo ZeroGEX muestra vanna y charm

El dashboard trata vanna y charm como capas superpuestas sobre la lectura estructural, no como señales independientes:

- **La exposición charm-at-spot** es uno de los inputs centrales de la señal avanzada EOD Pressure, que estima la deriva direccional hacia el cierre a partir de la combinación de los términos de charm y pin durante la ventana activa.
- **El flujo de vanna y charm** se muestra en paneles dedicados que reflejan el flujo agregado de cobertura de los dealers de cada griega a lo largo de la cadena.
- **El gráfico de perfil por strike** permite ver dónde se concentran juntas las exposiciones de gamma, vanna y charm, que suele ser donde ocurren las lecturas combinadas más limpias.

![Paneles de flujo de vanna y charm de ZeroGEX](/blog/zerogex-vanna-charm-flows.png)

Un ejemplo práctico. Supongamos que SPX está en 5.830 un viernes por la tarde, y el dashboard muestra:

- **Net GEX:** +1.400 millones de dólares
- **Gamma Flip:** 5.810
- **Strike con más gamma:** 5.825
- **Charm-at-spot:** apuntando moderadamente a la baja
- **Tendencia del flujo de vanna durante la mañana:** coherente con compresión de volatilidad
- **Puntuación EOD Pressure:** −0,4 (activada, deriva bajista leve)

La lectura compuesta: régimen long-gamma, imán estructural justo por debajo del spot, decadencia de charm apuntando en la misma dirección, vanna grind coherente con la caída de vol de la mañana. Sesgo práctico hacia el cierre: una deriva a la baja hacia 5.825 es el camino de mayor probabilidad, con el imán de gamma absorbiendo el movimiento y la decadencia de charm confirmando la dirección. Nada de esto es una señal de trading — es el contexto de régimen compuesto para la sesión de la última hora.

![Paneles de puntuación EOD Pressure y charm-at-spot de ZeroGEX durante la franja de última hora de la tarde](/blog/zerogex-eod-pressure-charm.png)

---

## Conceptos erróneos comunes sobre vanna y charm

Algunas trampas:

- **"Vanna es alcista."** No lo es. Es el reflejo del dealer ante los movimientos de la IV. El signo direccional de ese reflejo depende de la composición de la cadena; en una cadena típica de clientes largos en calls durante compresión de volatilidad, el *agregado* tiende a ser un bid — pero eso es una afirmación de régimen, no una propiedad de la griega.
- **"Charm es una señal."** El flujo impulsado por charm es una fuerza estructural, no un trade. Produce una tendencia a la deriva en la última hora; no te dice cuándo entrar.
- **"Vanna y charm solo importan en la semana OPEX."** Son más ruidosos entonces, pero la decadencia de charm importa todos los días con flujo 0DTE significativo — lo cual ahora ocurre la mayoría de los días.
- **"El vanna grind siempre funciona en compresión de volatilidad."** Solo cuando la composición de la cadena lo respalda y el régimen gamma no lo contradice.
- **"La cobertura de charm se desvanece después del cierre."** Así es — pero el flujo ya ha ocurrido para entonces. La cuestión es leerlo durante la ventana activa, no después.

---

## Conclusión

> Gamma es la fuerza de cobertura reactiva. Vanna y charm son las fuerzas de cobertura no impulsadas por el precio — lo que hacen los dealers cuando la vol se mueve o pasa el tiempo, incluso con el spot fijo.

Las griegas de segundo orden describen flujos reales en el libro del dealer que la lectura de primer orden por sí sola pasa por alto. Producen el grind persistente en compresión de volatilidad, la atracción estructural hacia el cierre en días cargados de 0DTE, y la deriva de semana OPEX hacia los strikes con más peso — cuando, y solo cuando, el régimen gamma las respalda.

Añádelas a la lectura. No las pongas por delante.

Contenido solo con fines educativos — nada de lo anterior es una recomendación de trading.

---

Si quieres ver los flujos de vanna y charm de hoy en tiempo real, junto con el régimen gamma que determina si producirán deriva o serán arrollados, el dashboard gratuito de ZeroGEX muestra todo esto.
