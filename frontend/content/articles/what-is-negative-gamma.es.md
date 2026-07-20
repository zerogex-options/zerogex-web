# ¿Qué Significa Gamma Negativo? Una Explicación en Lenguaje Sencillo

*¿Qué significa gamma negativo — y por qué debería importarle a un trader de opciones? En resumen: significa que el hedging de los dealers amplifica los movimientos en lugar de amortiguarlos. Aquí está a qué se refiere realmente el término, cómo detectar un régimen de gamma negativo en tiempo real y qué cambia en tu trading cuando estás en uno.*

---

## La respuesta corta

**Gamma negativo**, en el contexto del options-flow, significa que los dealers que están al otro lado de las operaciones de opciones de los clientes tienen un libro neto short-gamma. La consecuencia práctica: cuando SPY sube, tienen que *comprar* SPY para mantenerse cubiertos, y cuando SPY baja, tienen que *vender* SPY. Sus operaciones de hedging van **en la misma dirección** que el precio — no en contra.

Ese reflejo mecánico convierte el libro de los dealers en un amplificador. Los selloffs se aceleran. Los rallies se extienden. La volatilidad intradía realizada tiende a ser más alta que la implícita. El comportamiento de pin se rompe. El mismo setup gráfico que funcionaba ayer (cuando los dealers estaban long gamma y absorbían los movimientos) se destroza hoy (cuando están short gamma y persiguiendo el movimiento).

Lo contrario — el **gamma positivo** — es la configuración predeterminada más común de SPY durante la mayoría de las sesiones tranquilas. Los dealers están long gamma, cubren el movimiento y amortiguan la volatilidad. El panorama completo se cubre en el [pilar de Gamma Exposure](/education/gamma-exposure-explained); este artículo se centra específicamente en qué significa "gamma negativo" y cómo reconocerlo.

---

## A qué se refiere realmente el "gamma negativo"

El gamma es un Greek de opciones de segundo orden que mide cómo cambia el delta de una opción a medida que se mueve el subyacente. Un número de "gamma exposure" con signo es el gamma agregado en todo el libro de los dealers, donde las calls (típicamente mantenidas en short por los dealers) contribuyen positivamente y las puts (también típicamente mantenidas en short) contribuyen negativamente.

Cuando el *neto* de esas contribuciones con signo es negativo, el libro de los dealers es short gamma en conjunto. La forma convencional en que esto aparece en las herramientas de flow: Net GEX < 0.

La suposición estándar de cliente-long-call / cliente-long-put implica que los dealers son típicamente short en ambos — pero las *magnitudes* varían con el positioning. Cuando la demanda de los clientes se inclina fuertemente hacia las puts (por ejemplo, durante regímenes de miedo), el gamma neto del libro de los dealers puede volverse negativo; cuando se inclina hacia las calls (por ejemplo, en tendencias alcistas tranquilas), el libro es long gamma.

La estadística resumen más útil de todas: el **gamma flip** — el precio en el que el perfil de gamma de los dealers cruza el cero. Por encima del flip, los dealers suelen estar long gamma (positivo). Por debajo del flip, short gamma (negativo). Leer el flip es esencialmente leer la línea del régimen. Consulta [Cómo Leer un Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Por qué el gamma negativo amplifica los movimientos

La cadena mecánica:

1. La exposición delta neta de los dealers es short-gamma. Cuando el spot sube, el delta de su cartera de opciones cae (se vuelven más short respecto a la neutralidad).
2. Para mantenerse delta-neutral, deben **comprar** el subyacente para compensar la caída.
3. Esa compra ocurre en el mismo momento en que los clientes están impulsando el mercado al alza. Se suma al momentum.
4. Cuando el spot cae, ocurre lo contrario: el delta de las opciones de los dealers sube (se vuelven más long respecto a la neutralidad); para neutralizar, **venden** el subyacente. Esa venta se suma a la baja.

En ambas direcciones, el hedging de los dealers *refuerza* el movimiento. El reflejo es procíclico. Cuanto mayor es la exposición short-gamma de los dealers, más flow en el subyacente requiere cada punto porcentual de movimiento.

Compáralo con el **gamma positivo**, donde la misma cadena de flow se invierte: los dealers venden en la fortaleza y compran en la debilidad, amortiguando el movimiento. La fuerza estructural en el mercado es anticíclica. La misma noticia que produce un rango intradía del 0,5% en un régimen long-gamma puede producir un rango del 2% en un régimen short-gamma.

---

## Gamma negativo vs. gamma positivo, uno al lado del otro

| | Gamma positivo (long-gamma) | Gamma negativo (short-gamma) |
|---|---|---|
| Reflejo de hedging de los dealers | Venden en la fortaleza, compran en la debilidad | Compran en la fortaleza, venden en la debilidad |
| Vol realizada vs. implícita | Tiende a ser **más baja** | Tiende a ser **más alta** |
| Breakouts | A menudo se desvanecen y rebotan | A menudo se extienden |
| Selloffs | A menudo se absorben cerca de los walls | A menudo se aceleran |
| Comportamiento de pin | Los imanes atraen el precio hacia los strikes pesados | Los imanes sueltan el precio; sin pin |
| Mejor playbook | Mean-reversion, fade de extremos, venta de prima | Continuación de tendencia, momentum, breakout |
| Peor playbook | Perseguir breakouts, momentum | Fadear rallies, comprar dips dentro de la estructura |
| Típico cuando | SPY por encima del gamma flip, Net GEX > 0 | SPY por debajo del gamma flip, Net GEX < 0 |

Estas son tendencias generales de régimen, no garantías. Los catalizadores y shocks pueden anularlas. Pero la tasa base es lo bastante significativa como para que ejecutar el playbook equivocado para el régimen sea la mayor parte del costo.

---

## Cómo detectar un régimen de gamma negativo en tiempo real

Un flujo de trabajo breve:

1. **Revisa primero el gamma flip.** Si SPY está por debajo del flip, estás por definición en un régimen short-gamma.
2. **Confirma con el Net GEX.** Un valor de Net GEX negativo es la lectura de magnitud — cuanto más negativo, más marcado el régimen. Un Net GEX cercano a cero es un régimen disputado; ambos reflejos están parcialmente activos.
3. **Verifica cruzadamente el panorama de vol realizada.** Los regímenes short-gamma se manifiestan con rangos intradía más amplios de lo que sugería la vol implícita de la apertura del día. Si la realizada se está expandiendo mientras la implícita permanece plana, esa es la firma del régimen.
4. **Observa el comportamiento de los walls.** En regímenes short-gamma, los walls se debilitan o se invierten. El call wall que ayer limitaba los rallies puede convertirse hoy en un objetivo de breakout.
5. **Observa la dirección del flow al cierre.** El short-gamma hacia el cierre a menudo produce movimientos direccionales que se aceleran (la señal de presión EOD se convierte en una lectura de continuación, no de fade).

---

## Qué cambia en tu trading

Concretamente, cosas que hay que *dejar* de hacer en un régimen de gamma negativo:

- **No fadees los rallies.** El reflejo de los dealers está amplificando. Tu "short de mean-reversion" está luchando contra el flow estructural de compra.
- **No compres dips dentro de la estructura.** El mismo problema al revés. El put wall que sostenía el mercado en long-gamma puede convertirse en un punto de slippage en short-gamma.
- **No esperes pinning.** La tracción estructural hacia los strikes pesados está desactivada. La tesis del imán no aplica.
- **No dimensiones para un rango normal.** La vol realizada es estructuralmente más alta. Dimensiona la posición asumiendo que se necesitan stops más amplios.

Cosas que hay que *empezar* a hacer:

- **Opera a favor del movimiento.** Los setups trend-following tienen una tasa de acierto más alta.
- **Trata los walls como objetivos de breakout, no como resistencia.** El mismo nivel que habrías fadeado en long-gamma podría ser una entrada de continuación en short-gamma.
- **Sé más selectivo con el timing de entrada.** Rangos más amplios significan más riesgo por operación. Compénsalo con criterios de setup más estrictos.
- **Vigila los regresos al régimen de gamma positivo.** Ocurren — el flip es dinámico. Cuando el spot vuelve a cruzar por encima del gamma flip, el playbook se voltea con él.

---

## Ejemplo trabajado

SPX abre el día en 5.780. ZeroGEX muestra:

- **Net GEX:** −1.100 millones $ (negativo — régimen short-gamma)
- **Gamma Flip:** 5.810 (spot 30 puntos por debajo)
- **Call Wall:** 5.820
- **Put Wall:** 5.750

Durante la mañana, SPX asciende gradualmente hasta 5.800. El instinto en un día long-gamma sería empezar a fadear los rallies hacia el flip de 5.810 y el call wall de 5.820.

La lectura estructural aquí dice lo contrario. SPX está en territorio short-gamma; el hedging de los dealers está amplificando. El empuje hacia 5.810 podría extenderse más allá en lugar de desvanecerse — especialmente si el Net GEX sigue decayendo más hacia el negativo. En este régimen, el call wall de 5.820 tiene más probabilidades de actuar como objetivo de breakout que como resistencia.

La inclinación práctica: sáltate el fade. O bien operas con el momentum o te quedas al margen. Invierte el playbook respecto a un día long-gamma típico.

Ahora imagina el mismo gráfico con el Net GEX en +1.200 millones $ y el gamma flip en 5.760 (spot 40 puntos por encima). La lectura estructural se invierte: 5.820 probablemente actúa como resistencia, el reflejo long-gamma absorbe los rallies, el setup de fade está activo. La misma cinta, la lectura opuesta, dependiendo de una sola variable de régimen.

---

## Ideas erróneas comunes

- **"El gamma negativo es bajista."** No lo es. Es **amplificador de volatilidad**. El mercado puede rallar con fuerza en un régimen de gamma negativo — y el rally tiende a extenderse más de lo que lo haría en long-gamma. El gamma negativo tiene que ver con el *carácter de los movimientos*, no con la dirección.
- **"El gamma positivo es alcista."** Tampoco es cierto. El gamma positivo es **amortiguador de volatilidad**. El mercado puede irse a la baja en un régimen de gamma positivo; simplemente tiende a hacerlo lentamente, con rebotes de mean-reversion en el camino.
- **"Puedes operar las señales de gamma negativo igual que las de gamma positivo."** La mayoría de las pérdidas minoristas provienen de esto. Las señales y las lecturas estructurales se invierten entre regímenes. Una tesis de "comprar el dip" que funciona por encima del flip puede acumular pérdidas por debajo de él.
- **"El gamma negativo es raro."** Ocurre regularmente — particularmente después de picos de vol, durante el estrés macro y cuando la chain está fuertemente sesgada hacia las puts. Conocer el régimen en tiempo real es lo que te dice cuándo.

---

## Conclusión

> El gamma negativo significa que los dealers amplifican el movimiento en lugar de amortiguarlo. Misma cadena, mismo SPY, carácter opuesto de la cinta — y playbooks opuestos para el trader que sabe leer el régimen.

La disciplina consiste en empezar cada sesión con la lectura del régimen: ¿dónde está el gamma flip, dónde está el spot, cuál es el Net GEX? Esos tres números te dicen qué playbook va a respaldar hoy la fuerza estructural en el mercado. Ejecutar el playbook equivocado contra el régimen es el error más costoso del menú.

Solo contenido educativo — nada de lo anterior es una recomendación de trading.

---

Si quieres ver el Net GEX de hoy, el gamma flip y la lectura de régimen en vivo para SPY, SPX y QQQ — los tres números que te dicen si los dealers están long gamma o short gamma en este momento — la vista gratuita de gamma-levels de ZeroGEX los muestra todos.
