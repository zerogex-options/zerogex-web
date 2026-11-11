# Gamma Walls explicados: qué es un gamma wall y cómo reacciona el precio

*Los gamma walls son los niveles más observados en el análisis de posicionamiento de los dealers. Qué es un gamma wall, qué hace cada wall en cada régimen, qué te dice la distancia entre ellos, cómo se comportan hacia el vencimiento del mismo día y cuándo la lectura aguanta frente a cuándo se rompe.*

---

## ¿Qué es un gamma wall?

Un **gamma wall** es un strike de la cadena de opciones donde la exposición gamma modelada de los dealers está fuertemente concentrada. Ahí el posicionamiento en opciones es inusualmente denso, así que la cobertura que los dealers puedan hacer en torno a ese nivel puede ser mayor que en los strikes vecinos. Hay dos: el **call wall**, la mayor concentración de gamma de calls por encima del spot, y el **put wall**, la mayor concentración de gamma de puts por debajo. Juntos enmarcan el spot, y los traders suelen leerlos como los límites exteriores del rango con el que el posicionamiento actual es más coherente.

Un wall se obtiene del open interest, contrato por contrato, ponderado por la gamma que lleva cada contrato. No es una media móvil, una línea de tendencia ni un número redondo.

Ninguno de los dos walls es soporte o resistencia por construcción. Nada obliga a nadie a operar en un strike, y la cobertura es solo una fuente de flujo de órdenes entre muchas. Lo que hace la cobertura en un wall depende del *signo* de la gamma modelada de los dealers y del flujo que lo rodea, no de si los contratos que hay ahí son calls o puts. La forma defendible de entenderlo: un wall marca dónde una reacción es más probable que en un strike cualquiera, y por sí solo no dice nada sobre la dirección.

El resto de esta página es la parte aplicada, los aspectos que deciden si el nivel es útil en un día concreto: qué hace cada wall en cada régimen, qué te dice la distancia entre ellos, cómo se comportan hacia el vencimiento del mismo día, cómo migran y con qué frecuencia los walls realmente aguantan o se rompen. Para el contexto de régimen que subyace a todo ello, combina esta lectura con [¿Qué es un gamma flip?](/education/how-to-read-a-gamma-flip) y el [pilar más amplio de Gamma Exposure](/education/gamma-exposure-explained).

---

## ¿Qué es un call wall?

El call wall es el strike por encima del spot que concentra la mayor exposición gamma en calls. Bajo la convención tradicional, los dealers se *modelan* como largos de esas calls, así que en un régimen de gamma positiva tienden a vender en los rallies que se acercan al wall - desprendiéndose del delta positivo que acumulan mientras el precio sube hacia él. Ese reflejo de cobertura puede empujar en contra del rally.

En la práctica, el call wall suele actuar como **resistencia** - no porque el nivel sea mágico, ni simplemente porque sea un strike de calls. En condiciones de gamma positiva, el flujo de cobertura modelado a su alrededor tiende a oponerse al movimiento; si el signo de la gamma cambia, esa cobertura pasa a acompañar al movimiento.

Cosas que conviene saber:

- El wall es la concentración *actual* más pesada. A medida que el OI se desplaza, el wall se mueve.
- En regímenes de gamma larga (spot por encima del gamma flip), la cobertura en torno al wall se opone a un rally. En regímenes de gamma corta lo acompaña, así que, si el nivel cede, puede pasar de resistencia a acelerador de ruptura. El régimen cambia ese comportamiento, no la frecuencia con la que el wall se rompe.
- Un call wall es una inclinación **probabilística**, no un techo rígido. Un flujo real puede perforarlo.

---

## ¿Qué es un put wall?

El put wall es el strike por debajo del spot con la mayor exposición gamma en puts. Cuando se modela el libro neto como largo de gamma (un régimen de Net GEX positivo), la cobertura agregada de los dealers tiende a comprar la debilidad y vender la fortaleza - así que, a medida que el precio cae hacia un strike denso en puts, ese reflejo de comprar la caída puede oponerse al selloff. Ese comportamiento, sin embargo, viene del signo de la gamma *neta*, no de que el strike esté hecho de puts.

En la práctica, el put wall suele actuar como **soporte**. Al igual que con el call wall, que la cobertura a su alrededor amortigüe una caída, ancle el precio o acelere una ruptura depende del signo de la gamma modelada de los dealers y del flujo circundante - no del tipo de opción.

Cosas que conviene saber:

- El wall es dinámico. Un OI pesado que se agota hacia el vencimiento puede borrar un put wall antes del mediodía.
- En un régimen de gamma corta, el comportamiento del dealer se invierte - la cobertura deja de absorber la debilidad y, si el put wall cede, puede convertirse en un punto de deslizamiento (slippage) en la caída.
- Un put wall es una inclinación. Shocks macro, expansión de la volatilidad y reajustes de la cadena pueden anular la lectura estructural.

---

## Por qué el precio reacciona en los gamma walls

El mecanismo es la cobertura de los dealers, no la psicología. La forma más clara de verlo:

En un régimen de **gamma positiva**, los dealers tienden a cubrirse *contra* el movimiento del precio. Venden cuando el precio sube y compran cuando cae. Cerca de un wall, ese reflejo puede intensificarse porque la concentración de gamma es localmente grande - un pequeño movimiento hacia el wall puede requerir una operación de cobertura relativamente más grande en sentido contrario. Esto supone que el signo de la gamma modelada de los dealers se mantiene en torno a ese strike, y por eso el mismo wall puede comportarse de forma distinta cuando cambian el flujo circundante o el signo neto.

En un régimen de **gamma negativa**, el reflejo se invierte. Los dealers tienden a cubrirse *en el mismo sentido* que el movimiento del precio. El mismo wall que anclaba el precio en gamma larga puede convertirse en un vector de ruptura - una vez que el precio lo supera, la operación de cobertura refuerza el movimiento en lugar de atenuarlo.

Un gamma wall no es una propiedad fija de la cadena. Es un *nivel* fijo cuyo efecto de cobertura depende del **régimen que lo rodea** - que es exactamente lo que indica el gamma flip. Lo que el régimen no decide es si el wall aguanta: en nuestra medición de 737 pruebas de walls, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora y los del Nasdaq, aproximadamente la mitad, tanto por encima como por debajo del flip ([¿Con qué frecuencia se rompen realmente los gamma walls?](/education/how-often-do-gamma-walls-break)).

---

## Los gamma walls, el gamma flip y el max pain

Los tres niveles se construyen de forma distinta y responden a preguntas distintas:

- El **gamma flip** es donde la gamma modelada de los dealers cambia de signo. Fija el régimen que decide si la cobertura en torno a los walls se opone a un movimiento o se suma a él. Consulta [¿Qué es un gamma flip?](/education/how-to-read-a-gamma-flip)
- El **max pain** es un cálculo del valor al vencimiento: el strike en el que las opciones abiertas en ese vencimiento tendrían el menor valor intrínseco total. No es una concentración de gamma, así que puede situarse bastante lejos de cualquiera de los dos walls. Consulta [Max Pain explicado](/education/max-pain-explained).
- Los **walls** son los dos strikes de gamma más densos a uno y otro lado del spot.

---

## Qué te dice la distancia entre los walls

Los dos walls aportan más información juntos que cualquiera de ellos por separado. La distancia entre ellos es el rango con el que el posicionamiento actual es más coherente, y su forma se puede leer de dos maneras.

**Anchura.** Un rango de walls estrecho significa que la gamma está concentrada cerca del spot por ambos lados. En un régimen de gamma positiva ese es el montaje clásico de pinning - la cobertura se opone a los movimientos en ambas direcciones. Un rango amplio significa que los strikes densos más cercanos están lejos, así que hay menos cobertura concentrada en medio y el precio puede recorrer más distancia antes de encontrar alguna.

**Asimetría.** El spot rara vez está en el medio. Cuando un wall está mucho más cerca que el otro, el wall cercano es el nivel que realmente se pone a prueba y el lejano es sobre todo contexto. Un spot situado un 0,3% por debajo del call wall y un 1,4% por encima del put wall es un día distinto de un spot a medio camino entre ambos: el primero tiene un punto de decisión a corto plazo, el segundo no.

La trampa es leer la anchura o la asimetría sin el régimen. Ambas lecturas anteriores suponen gamma positiva. Por debajo del flip, ese mismo rango estrecho no es un pin - es una distancia corta entre dos niveles, y la cobertura se sumará a un movimiento que atraviese cualquiera de los dos. Para aplicar las tres lecturas - anchura, asimetría y régimen - al mercado de hoy, consulta el [gamma flip, el call wall y el put wall actuales de SPX](/spx-gamma-levels).

---

## Cómo se desplazan los gamma walls intradía

Los walls no se anuncian en la apertura y se mantienen fijos hasta el cierre. Migran, por dos motivos distintos. Entre sesiones, el open interest cambia a medida que se abren y se cierran posiciones, y las cifras oficiales se actualizan tras la compensación. Dentro de una sesión, con ese open interest fijo, la clasificación de los strikes sigue cambiando a medida que se revalúa la gamma que lleva cada contrato. Tres patrones habituales:

1. **Revaluación de la gamma.** El spot, el tiempo hasta el vencimiento y la volatilidad implícita cambian la gamma modelada de cada strike y pueden cambiar la clasificación aunque el OI oficial no varíe.
2. **Elegibilidad según el lado del spot.** Un strike puede pasar de un lado del spot al otro, mientras otro strike con OI fijo pasa a ser la mayor concentración elegible. El OI oficial suele actualizarse tras la compensación; la migración intradía de un wall no demuestra que los clientes hayan abierto posiciones en el nuevo strike.
3. **Concentración cerca del vencimiento.** La gamma ATM puede dispararse mientras la de los strikes decididamente ITM u OTM tiende a cero, lo que cambia la clasificación. Esa revaluación es distinta del cierre de posiciones y de la actualización del OI oficial tras la compensación.

Un wall también puede desplazarse únicamente porque se mueven el spot, el tiempo y la volatilidad implícita - el strike que carga la mayor exposición modelada cambia incluso cuando el posicionamiento no lo hace. Un gamma wall es el strike con más gamma modelada *en este momento*. Trátalo como una lectura viva, no como una línea fija.

---

## Los gamma walls hacia el vencimiento del mismo día

El 0DTE es donde el comportamiento de los walls es más extremo, en ambos sentidos.

La gamma en una cadena del mismo día es muy grande cerca del spot y cae rápidamente al alejarse, así que los walls quedan pegados al precio y la concentración en ellos es mucho más pesada que en una cadena de vencimiento más largo. Cuando el régimen lo respalda, eso produce el pinning más fuerte que probablemente llegues a ver - el precio moliendo en una banda estrecha entre dos walls separados por unos pocos puntos.

Esa misma concentración hace que esos walls sean inestables. Como la gamma 0DTE se revalúa bruscamente a medida que el spot se mueve y el reloj corre, un wall 0DTE puede migrar varias veces en una hora sin que se abra una sola posición nueva. Los walls también pueden desaparecer: cuando los strikes quedan decididamente dentro o fuera del dinero, su gamma modelada tiende a cero y la clasificación se reordena en torno a lo que quede cerca del spot.

Dos consecuencias prácticas. Una lectura de un wall 0DTE tiene una vida útil mucho más corta que la misma lectura en una cadena mensual - minutos en lugar de horas. Y una vez que el precio supera un wall 0DTE en un régimen de gamma negativa, a menudo queda poca gamma densa entre ese wall y el siguiente nivel, lo que explica en parte por qué las rupturas de final de sesión en los días de vencimiento pueden recorrer tanta distancia tan rápido.

---

## Cuándo los walls aguantan y cuándo se rompen

Los walls no son predicciones, y hemos medido con qué frecuencia ceden. En 737 pruebas de walls sobre SPY, SPX, QQQ y NDX durante diez semanas de 2026, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora tras ser puestos a prueba y los del Nasdaq, aproximadamente la mitad ([¿Con qué frecuencia se rompen realmente los gamma walls?](/education/how-often-do-gamma-walls-break)). Esa tasa base del índice es la mejor estimación a priori disponible, y ninguna de las condiciones a las que los traders suelen recurrir la mejoró:

**Condiciones que evaluamos y que no predijeron una ruptura:**

- En qué lado del flip estaba el spot - gamma positiva o negativa.
- El tamaño del wall, su peso dentro del libro y su clasificación frente a su propio historial. Los walls más grandes se rompieron algo menos, pero la diferencia fue demasiado débil para distinguirla del ruido.
- El Net GEX, su trayectoria y la distancia al flip.
- Si el wall estaba migrando con el precio y si su gamma se estaba fortaleciendo o consumiendo.
- El flujo con signo en el strike del wall, si ese flujo se estaba acelerando y la volatilidad realizada.
- Cuánto tiempo llevaba en pie el wall, cuántas veces se había puesto a prueba y la hora del día.

**Lo que sí cambia el régimen:**

- En gamma positiva (por encima del flip), la cobertura modelada se opone a un movimiento hacia el wall, lo que puede frenarlo o anclar el precio cerca del strike.
- En gamma negativa (por debajo del flip), la cobertura modelada acompaña al movimiento, así que, si el wall cede, la cobertura se suma a la ruptura en lugar de atenuarla.

La mayoría de estos puntos se pueden leer en tiempo real, y ninguno te dice si este wall va a aguantar. Un catalizador macro (CPI, FOMC, NFP, un titular geopolítico) que llegue durante una prueba puede desbordar la cobertura en cualquiera de los dos regímenes. Usa la tasa base del índice como tu estimación a priori y el régimen como una descripción de lo que está haciendo la cobertura en torno al nivel, no como una probabilidad.

---

## Cómo muestra ZeroGEX el call wall y el put wall

El dashboard presenta los walls en dos lugares:

- **Las tarjetas de métricas de wall** muestran los strikes actuales del call wall y del put wall, con la distancia porcentual en vivo respecto al spot.
- **El gráfico de GEX walls** representa el perfil de gamma strike por strike con ambos walls resaltados.

![Tarjetas Call Wall y Put Wall del dashboard de ZeroGEX con distancia porcentual respecto al spot](/blog/zerogex-walls-cards.png)

Un ejemplo trabajado. Supongamos que el SPX está en 5.830. El dashboard muestra:

- **Call Wall:** 5.850 (+0,34% desde el spot)
- **Put Wall:** 5.790 (−0,69% desde el spot)
- **Net GEX:** +1.500 millones de $
- **Gamma Flip:** 5.810

Aquí, el Net GEX es una estimación modelada de la gamma de los dealers que usa la convención tradicional de open interest call-positivo / put-negativo; el inventario real de los dealers no es directamente observable a partir de los datos públicos de la cadena de opciones. La lectura estructural: el spot está cómodamente por encima del flip (régimen de gamma larga), el rango de walls es asimétrico - mucho más cerca del call wall que del put wall - y el Net GEX es saludable. Lo que eso te dice: el call wall es el nivel más próximo a ponerse a prueba, y un rally hacia él se encuentra con una cobertura que, según el modelo, se opone a él. Lo que no te dice es si 5.850 aguanta. En nuestra medición, los walls del SPX aguantaron aproximadamente dos de cada tres veces en el plazo de una hora, independientemente del lado del flip en que estuviera el precio. Una caída por debajo de 5.810 cambiaría el mecanismo, no esas probabilidades: la cobertura empezaría a sumarse a los movimientos en lugar de amortiguarlos.

![Gráfico de GEX walls de ZeroGEX resaltando el call wall y el put wall en el perfil de gamma strike por strike](/blog/zerogex-walls-chart.png)

Ahora imagina que el call wall migra hacia arriba hasta 5.855 mientras el precio sondea 5.848. Esa migración es un dato - el strike que estabas vigilando ya no es el más pesado, así que el nivel contra el que operas se ha movido. No es, por sí sola, una señal de que la ruptura vaya a consolidarse: en nuestra medición, que un wall estuviera migrando con el precio no predijo si acabaría rompiéndose.

---

## Conceptos erróneos comunes

Algunas trampas:

- **"Los walls son soporte/resistencia rígidos."** Son inclinaciones estructurales. Un flujo real los rompe con regularidad: en nuestra medición, los walls del S&P se rompieron en aproximadamente una de cada tres pruebas en el plazo de una hora, y los del Nasdaq, en aproximadamente la mitad.
- **"El strike con mayor open interest siempre es el wall."** Los walls se ponderan por exposición gamma, no por OI en bruto. Un strike cercano al ATM puede dominar a un strike muy OTM con el doble de open interest.
- **"Los walls son estáticos durante la sesión."** Migran. Un wall que no se ha movido en dos horas es una lectura; un wall que ha derivado con el precio tres veces es una lectura muy distinta.
- **"Los walls funcionan igual en cualquier régimen."** La cobertura no: en gamma positiva se opone a un movimiento hacia el wall, y en gamma negativa se suma a un movimiento que lo atraviesa. En nuestra medición, la frecuencia con la que se rompieron los walls no cambió con el régimen; lo que cambia es lo que hace la cobertura en torno a la ruptura.
- **"El call wall es alcista, el put wall es bajista."** Ninguno de los dos es direccional, y el tipo de opción por sí solo no determina el comportamiento. Son niveles de concentración de gamma cuyo efecto depende del signo de la gamma modelada de los dealers y del flujo circundante - es decir, de en qué lado del flip te encuentres.

---

## Conclusión

> Los gamma walls son posicionamiento real, no psicología. Delinean el rango estructural, y el gamma flip te dice si la cobertura en torno a esos walls se opone a los movimientos o se suma a ellos. Que un wall concreto aguante es una cuestión de tasa base, no de lectura: aproximadamente dos de cada tres pruebas en el plazo de una hora para los walls del S&P, y aproximadamente la mitad para los del Nasdaq.

Lee primero el régimen. Lee después el wall. Lee en tercer lugar la migración del wall. Esa secuencia te dice lo que está haciendo la cobertura de los dealers en torno al nivel - la diferencia entre hacer fade de un rally que el libro del dealer está fadeando contigo y hacer fade de un rally que ese mismo libro del dealer está a punto de perseguir. No te dice si este wall en concreto va a aguantar; para eso, la tasa base del índice es la mejor guía que hemos medido.

Solo contenido educativo - nada de lo anterior es una recomendación de trading.

---

Si quieres ver el call wall y el put wall de hoy, [los niveles gamma gratuitos de ZeroGEX](/gex-levels) muestran ambos para SPX, SPY, QQQ, NDX, ES y NQ junto al gamma flip y al Net GEX, con unos 15 minutos de retraso; los planes de pago los muestran [en el dashboard GEX 0DTE en tiempo real](/real-time-gex-0dte). Para el panorama más amplio de herramientas de gamma exposure, consulta [la guía de las mejores herramientas GEX](/education/best-gex-tools).
