# Cómo interpretar un gamma flip
> **Nota metodológica.** ZeroGEX estima, pero no observa, el inventario de los dealers a partir de datos públicos. El modelo conserva la convención calls positivos/puts negativos (`Net GEX = Call GEX − Put GEX`) y supone dealers netos largos de calls y cortos de puts. Las calls y puts largas tienen gamma positiva; las calls y puts cortas tienen gamma negativa. El Put Wall es la mayor concentración de gamma de puts por debajo del spot y representa localmente gamma negativa modelada del dealer: puede coincidir con soporte, pero la cobertura de una put corta no crea mecánicamente un suelo. Los walls pueden migrar por spot, tiempo y volatilidad implícita aunque el open interest oficial no cambie intradía. Al acercarse el vencimiento, la gamma se concentra cerca del ATM: la gamma ATM puede aumentar, mientras la gamma claramente ITM u OTM tiende a cero. El Gamma Flip seleccionado es una transición local; el perfil puede tener varios cruces o ninguno significativo. Charm y vanna son cambios condicionales de delta, no órdenes programadas. Las puntuaciones son resultados heurísticos, no probabilidades calibradas. La gamma negativa amplifica la dirección ya iniciada; la distancia a un objetivo no implica repulsión. Que el término pin de EOD Pressure siga el movimiento reciente cuando la gamma es negativa es una heurística de ZeroGEX. Max Pain minimiza el pago intrínseco agregado y no maximiza exactamente el nocional que vence sin valor. El DEX bruto mide delta solo de opciones, no flujo futuro de cobertura; la prima y el lado agresor no prueban información, apertura ni convicción.


*La lectura práctica del gamma flip - qué es realmente este nivel, qué cambia por encima y por debajo de él, y cómo actuar intradía. El gamma flip explicado sin rodeos.*

---

## Por qué importa el gamma flip

La mayoría de los traders leen la acción del precio contra soportes y resistencias. El gamma flip es algo distinto: es un **límite de régimen**, no un objetivo. Cuando el spot está por encima del flip, la mecánica de cobertura de los dealers tiende a *amortiguar* la volatilidad. Cuando está por debajo, esa misma mecánica tiende a *amplificarla*. Los setups que funcionan en un régimen suelen ser los equivocados en el otro - y reconocer en qué régimen te encuentras es gran parte de la ventaja.

Este artículo ofrece la lectura orientada al trader. Cubriremos qué es realmente el nivel del flip, qué cambia cuando el spot lo cruza, y cómo usarlo dentro de una sesión. Si quieres profundizar en la estructura de mercado subyacente, empieza por el [pilar de Gamma Exposure](/education/gamma-exposure-explained); para la metodología de cálculo, consulta la [guía de cálculo del Gamma Flip](/guides/gamma-flip-calculation-before-vs-after).

---

## ¿Qué es un gamma flip?

El gamma flip es el nivel de precio en el que la exposición gamma agregada de los dealers cruza cero. Por encima del flip, los dealers suelen estar net long gamma; por debajo, suelen estar net short. No es un strike fijo. Es el precio en el que el perfil de gamma de los dealers cambia de signo - y a medida que la cadena se reponderar a lo largo del día, ese precio se mueve.

Algunas cosas que conviene dejar claras:

- El flip es un **nivel, no un muro.** No opone resistencia al precio como podría hacerlo un strike call o put muy cargado. Marca un punto de inflexión de comportamiento, no una barrera estructural.
- Es un **indicador de régimen, no direccional.** El spot por encima del flip no es alcista. El spot por debajo no es bajista. El régimen te informa sobre el *carácter de la volatilidad* realizada, no sobre la dirección.
- Es **dinámico.** A medida que el open interest rota, los vencimientos decaen y llega flujo nuevo al libro, el flip se desplaza. Un flip desactualizado es un flip engañoso.

Trátalo como un meteorólogo trata un frente meteorológico - saber en qué lado estás te dice qué tipo de clima esperar, no hacia dónde se dirige la tormenta.

---

## ¿Qué ocurre por encima del gamma flip?

Por encima del flip, los dealers generalmente están net long gamma. Para mantenerse delta-neutral, venden en la fortaleza y compran en la debilidad. Ese reflejo de cobertura empuja *en contra* de los movimientos direccionales en lugar de acompañarlos.

Consecuencias prácticas que los traders observan en el tape:

- **La volatilidad realizada tiende a comprimirse.** La cobertura se opone a los empujes en cualquier dirección, incluidos los empujes hacia los walls.
- **El pin behavior se vuelve más probable.** El precio tiende a gravitar hacia strikes con fuerte concentración de gamma, especialmente hacia el cierre.
- **Los setups de mean-reversion tienen la cobertura a su favor.** Fadear rallies hacia un [call wall](/education/gamma-walls-explained), comprar dips cerca de un put wall y las estructuras de short-premium se apoyan todas en el reflejo amortiguador.
- **El trend-following tiene la cobertura en contra.** Un breakout que se ve limpio en un gráfico de 5 minutos se topa con un libro de los dealers que se inclina en sentido contrario.

Nada de esto es una garantía. Shocks macro, la mecánica de OpEx, o un flip-cross a la baja pueden anular el régimen a mitad de sesión. Como inclinación base, sin embargo, el comportamiento por encima del flip tiende hacia la calma. Lo que el régimen no cambia es la frecuencia con la que ceden los walls: en nuestra medición de 737 pruebas de walls, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora a ambos lados del flip ([¿Con qué frecuencia se rompen realmente los gamma walls?](/education/how-often-do-gamma-walls-break)).

---

## ¿Qué ocurre por debajo del gamma flip?

Por debajo del flip, los dealers generalmente están net short gamma. Para mantenerse delta-neutral, ahora compran en la fortaleza y venden en la debilidad. Ese reflejo de cobertura empuja *a favor* de los movimientos direccionales, no en su contra.

Consecuencias prácticas:

- **La volatilidad realizada tiende a expandirse.** Una ruptura que sí llega a producirse tiene la cobertura a su favor; los selloffs pueden acelerarse.
- **El pin behavior se rompe.** Los strikes que magnetizaban el precio por encima del flip empiezan a liberarlo.
- **La continuación de tendencia tiene la cobertura a su favor.** El momentum puede extenderse en lugar de desvanecerse.
- **El mean-reversion se vuelve peligroso.** Atrapar un cuchillo cayendo en un régimen de gamma negativa profunda puede agravar las pérdidas, porque el reflejo del dealer con el que contarías (comprar la debilidad) es precisamente el reflejo que acaba de invertirse.

Esto también es una inclinación probabilística, no un pronóstico. Un solo titular tranquilo puede calmar el tape dentro del mismo régimen. Pero saber que estás en territorio short-gamma debería cambiar qué trades tomas y - lo que es más importante - cuáles evitas.

---

## Cómo actuar sobre el gamma flip intradía

Leer el gamma flip en tiempo real es un breve conjunto de hábitos:

1. **Revisa primero el régimen.** Antes de cualquier setup, ten claro si el spot está por encima o por debajo del flip. Esa sola lectura te dice si la cobertura está a tu favor o en tu contra.
2. **Observa la distancia al flip.** Un spot claramente alejado del flip con un margen saludable es una lectura de régimen estable. Un spot encajonado dentro de unas pocas décimas de porcentaje es un régimen disputado - ambos lados del libro están parcialmente activos, y el comportamiento es inestable. Reduce el tamaño o quédate al margen.
3. **Vigila la migración.** Los niveles de flip se desplazan a medida que el posicionamiento se reequilibra. Un flip que deriva hacia arriba junto con el precio tiene un significado distinto al de uno anclado mientras el precio se mueve hacia él.
4. **Combina el flip con los walls.** El flip te indica el régimen; el [call wall y put wall](/education/gamma-walls-explained) te indican los límites estructurales dentro de él. Léelos juntos.
5. **Respeta la concentración 0DTE.** Cuando los vencimientos del mismo día dominan la cadena, el flip se vuelve especialmente reactivo. Consulta [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained) para las lecturas específicas de régimen.

La disciplina consiste en usar el flip como **filtro**, no como señal. Te dice qué playbook seguir; la entrada todavía tiene que venir de otra parte.

---

## Cómo leer el gamma flip en ZeroGEX

El dashboard de ZeroGEX muestra el flip en dos lugares:

- La **tarjeta de métrica Gamma Flip** muestra el nivel actual del flip junto con la distancia en vivo en dólares y porcentaje respecto al spot.
- El **gráfico de perfil de gamma de los dealers** traza la curva a través de los strikes, con el cruce por cero - el flip - visible directamente.

![ZeroGEX dashboard Gamma Flip card showing SPX spot above the flip with live distance](/blog/zerogex-gamma-flip-card.png)

Un ejemplo práctico. Supongamos que el SPX cotiza en 5.830 y el dashboard muestra:

- **Net GEX:** +$1.2B
- **Gamma Flip:** 5.815
- **Distancia:** +15 / +0,26%

La lectura: el spot está en territorio long-gamma modelado, cómodamente por encima del flip. La cifra principal de Net GEX - gamma estimada de los dealers según la convención tradicional call-positivo / put-negativo, no un inventario observado - es coherente con el régimen: positiva, porque es el valor de esa misma curva de gamma modelada evaluada en el spot, y en este libro esa curva se vuelve positiva por encima del flip. (Esa coherencia de signo es estructural a la forma en que ZeroGEX calcula el perfil.) Inclinación práctica: volatilidad amortiguada, cobertura que se opone a los breakouts, pin behavior hacia los strikes de fuerte gamma sobre la mesa de cara al cierre.

![ZeroGEX dealer gamma profile chart with the gamma flip line marked and spot above it](/blog/zerogex-strike-profile-flip.png)

Ahora imagina el mismo dashboard 30 minutos después: SPX 5.810, gamma flip 5.818. El spot ha cruzado por debajo, y el flip en realidad ha derivado hacia arriba, hacia donde estaba el spot. Ese es el punto de inflexión estructural en el que cambia el carácter intradía - y un trader que estaba fadeando rallies por encima del flip debería ser mucho más cauteloso al fadear el siguiente selloff dentro del nuevo régimen.

---

## Errores comunes al leer el gamma flip

Algunos patrones que suelen atrapar a los traders:

- **Tratar el flip como soporte o resistencia.** Es una línea de régimen, no un nivel contra el que operar. Comprar la debilidad *hacia* el flip desde arriba es un trade estructuralmente distinto a comprarla desde abajo.
- **Ignorar lo dinámico que es.** El flip puede moverse varios puntos en pocas horas a medida que el posicionamiento cambia. Leer el flip de ayer en el tape de hoy es leer un libro desactualizado.
- **Confundir la proximidad con la confirmación.** Un spot situado *justo en* el flip es el estado menos informativo, no el más informativo. Ambos regímenes están parcialmente activos y la lectura es débil.
- **Leer el flip sin comprobar la magnitud del Net GEX.** Un flip con $2B de gamma de dealers por encima es un régimen mucho más marcado que uno con $200M. La magnitud importa tanto como el signo.
- **Confundir el flip con el max pain.** El max pain es una estimación de pinning al vencimiento basada en el payoff de los tenedores de opciones. El flip es una línea de régimen de cobertura en tiempo real basada en la gamma de los dealers. A menudo difieren, y responden a preguntas distintas.

---

## Conclusión

> Por encima del flip suele darse un régimen long-gamma que amortigua la volatilidad. Por debajo suele darse un régimen short-gamma que la amplifica. El spot en el flip es disputado, no neutral.

Usado como filtro - no como señal - el gamma flip es lo más parecido a una lectura única y duradera que ofrece el análisis del posicionamiento de los dealers. No te dirá hacia dónde va el mercado. Te dirá qué trades tienen el reflejo del dealer a favor y cuáles están luchando contra él.

Contenido solo con fines educativos - nada de lo anterior es una recomendación de trading.

---

Si quieres ver la lectura del gamma flip de hoy, [las páginas gratuitas de gamma-levels de ZeroGEX](/spx-gamma-levels) la muestran junto con el Net GEX, los call y put walls, y el gráfico de perfil de gamma de los dealers, con unos 15 minutos de retraso; los planes de pago la muestran [en tiempo real](/real-time-gex-0dte). Para una comparación de cómo distintas plataformas calculan y presentan esta lectura, consulta [la guía de las mejores herramientas GEX](/education/best-gex-tools).
