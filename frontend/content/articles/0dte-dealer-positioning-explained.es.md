# El posicionamiento de dealers en 0DTE explicado

*Los vencimientos del mismo día ahora dominan el flujo de SPX. Eso cambia cómo se lee la gamma de los dealers — y cómo hay que leer el tape para no quedarse atrás. El posicionamiento de dealers en 0DTE, explicado para el trader intradía práctico.*

---

## Por qué 0DTE cambia la lectura

El posicionamiento de los dealers siempre ha importado a los traders de opciones. Lo que ha cambiado en los últimos años es el **dominio del flujo 0DTE** en SPX y SPY. Los vencimientos del mismo día ahora acaparan una porción desproporcionada de la exposición gamma total, y como su gamma está concentrada cerca del spot y decae hacia el cierre, el comportamiento de cobertura de los dealers que provoca es más brusco, más reactivo y más dependiente del régimen que en cualquier estructura de cadena anterior.

Si operas SPX durante la sesión de contado y no estás leyendo el posicionamiento de los dealers a través del lente 0DTE, estás leyendo un libro obsoleto.

Este artículo es la lectura práctica de lo que realmente significan en tiempo real "posicionamiento de dealers 0DTE" y "gamma de dealers 0DTE". Cubriremos por qué el bucket 0DTE importa más que el agrupamiento a vencimientos más largos, qué cambia entre los regímenes de gamma negativa y positiva específicamente para 0DTE, y cómo leer el tape de forma distinta en cada uno. Combina esto con [Cómo leer un gamma flip](/education/how-to-read-a-gamma-flip) para la línea de régimen en sí, [Los gamma walls explicados](/education/gamma-walls-explained) para los niveles frontera, y el [pilar de Gamma Exposure](/education/gamma-exposure-explained) para el contexto estructural completo.

---

## ¿Qué es el posicionamiento de dealers en 0DTE?

El posicionamiento de dealers en 0DTE es la exposición gamma agregada que los dealers mantienen en opciones que vencen el mismo día. Mecánicamente, no es diferente de la gamma de dealers a vencimientos más largos — las calls mantenidas en corto por los dealers contribuyen positivamente a la gamma de los dealers, las puts mantenidas en corto contribuyen negativamente, y el reflejo de cobertura es el mismo: mantener el delta plano, operar el subyacente a medida que la gamma cambia.

Lo que hace diferente a 0DTE es la **densidad de gamma**. Las opciones del mismo día llevan su mayor gamma justo en el precio de mercado, y la gamma por contrato escala aproximadamente con `1/√T`. Con `T` medido en fracciones de un día, ese denominador es pequeño — y la gamma por contrato se vuelve muy grande. Un strike 0DTE cerca del spot puede superar a un strike mensual en el mismo nivel por un orden de magnitud.

La implicación práctica: el bucket 0DTE dicta de forma desproporcionada la cobertura intradía de los dealers. Incluso cuando el interés abierto total está dominado por strikes a vencimientos más largos, la exposición *ponderada por gamma* cerca del spot suele ser una historia de 0DTE.

---

## Por qué el posicionamiento de dealers importa más para 0DTE

Tres factores se combinan en 0DTE de una forma que no ocurre igual en vencimientos más largos:

1. **Concentración de gamma.** Las opciones del mismo día llevan una gamma muy alta en el precio de mercado. Las operaciones de cobertura contra esa gamma son grandes por unidad de movimiento, lo que hace que la acción del precio cerca del spot sea mecánicamente más ruidosa.
2. **Decaimiento del charm.** A medida que las opciones 0DTE se acercan al vencimiento, su delta se desplaza de forma predecible hacia 0 o 1 según la moneyness. Los dealers que gestionan un libro delta-neutral tienen que recubrirse continuamente hasta el cierre. Ese flujo forzado tiene un signo — y es directamente legible.
3. **Física del pin.** La misma concentración de gamma que hace que los dealers de 0DTE se muevan mucho por cada tick también convierte al strike 0DTE más pesado en un imán en un régimen de gamma larga. El comportamiento de pin tiende a ser más marcado en 0DTE que en setups multi-día.

Ninguno de estos mecanismos es exclusivo de 0DTE — se aplican a cualquier opción de corto plazo. Simplemente resultan inusualmente ruidosos en el bucket 0DTE por lo comprimida que se ha vuelto `T`.

---

## Regímenes 0DTE de gamma negativa

Cuando los dealers están netos cortos de gamma — típicamente cuando el spot está por debajo del gamma flip — el flujo 0DTE se vuelve ruidoso rápidamente.

Lo que hace el reflejo:

- Un movimiento al alza obliga a los dealers a *comprar*, amplificando el movimiento.
- Un movimiento a la baja obliga a los dealers a *vender*, amplificando el movimiento.
- La volatilidad intradía realizada tiende a expandirse.
- Los walls se vuelven menos fiables como resistencia y soporte — pueden invertirse en objetivos de breakout.
- El comportamiento de pin cerca del strike 0DTE más pesado se debilita o se revierte.

Cómo tiende a verse el tape:

- Rangos más amplios, breakouts más rápidos.
- Movimientos de continuación más frecuentes que las reversiones.
- Las entradas de mean-reversion contra la tendencia suelen ser arrolladas.
- Las primas de opciones del mismo día tienden a expandirse intradía en lugar de comprimirse.

La inclinación práctica en un régimen 0DTE de gamma corta es **a favor del movimiento, no en contra**. Los setups de continuación de tendencia suelen tener mejores tasas de acierto; ir contra la tendencia hacia la concentración 0DTE es luchar estructuralmente contra el reflejo de los dealers.

---

## Regímenes 0DTE de gamma positiva

Cuando los dealers están netos largos de gamma — típicamente cuando el spot está por encima del gamma flip — el flujo 0DTE tiende a comprimirse.

Lo que hace el reflejo:

- Un movimiento al alza obliga a los dealers a *vender*, amortiguando el movimiento.
- Un movimiento a la baja obliga a los dealers a *comprar*, amortiguando el movimiento.
- La volatilidad intradía realizada tiende a comprimirse.
- Los walls se comportan más como resistencia y soporte genuinos.
- El comportamiento de pin cerca del strike 0DTE más pesado se fortalece hacia el cierre.

Cómo tiende a verse el tape:

- Rangos más ajustados, más chop, más breakouts fallidos.
- Comportamiento de atracción hacia el strike más pesado, especialmente después de las 14:00 ET.
- Las primas de opciones del mismo día tienden a desinflarse.
- Los setups de mean-reversion tienden a tener mejores tasas de acierto que los de continuación de tendencia.

La inclinación práctica en un régimen 0DTE de gamma larga es **contra el breakout, con el pin**. Los rallies desvanecidos hacia el call wall, las compras en caídas hacia el put wall y las estructuras de prima corta se benefician todas del reflejo amortiguador.

---

## Cómo leer el tape de forma distinta en cada régimen

Algunos hábitos que cambian entre los dos regímenes:

**En un régimen 0DTE de gamma negativa:**

- Toma más en serio los breakouts del rango reciente, especialmente cuando el Net GEX es grande y negativo.
- Trata los walls 0DTE como objetivos, no como techos.
- Sé escéptico ante los setups de "esto va a hacer pin" — el reflejo de los dealers no está tirando.
- Dimensiona para stops más amplios; la volatilidad realizada es estructuralmente más alta.

**En un régimen 0DTE de gamma positiva:**

- Por defecto, apuesta a desvanecer los movimientos hacia strikes concentrados en 0DTE.
- Trata el strike de mayor gamma como un imán, especialmente hacia el cierre.
- Sé escéptico ante los breakouts — fallan con más frecuencia.
- Stops más ajustados son más razonables; los rangos están más contenidos.

**En cualquier régimen:**

- Verifica si el spot está cerca del gamma flip. Un régimen disputado es el peor régimen para comprometerse con cualquiera de los dos playbooks.
- Verifica si el strike 0DTE más pesado está migrando. Un strike pesado estático es un candidato a pin más fuerte que uno que migra.
- Sigue el Net GEX como magnitud, no solo como signo. Un cambio de −2.000 millones de dólares a +200 millones de dólares es una lectura muy distinta a un cambio de +2.000 millones de dólares a +200 millones de dólares.

---

## Leer el posicionamiento de dealers en 0DTE en ZeroGEX

El dashboard muestra lecturas específicas de 0DTE en varios lugares:

- **La tarjeta de Net GEX** muestra la gamma de los dealers evaluada en el spot (con signo coherente con el flip), dándote la magnitud del régimen actual.
- **El mapa de calor de GEX por strike y DTE** desglosa la gamma por bucket de vencimiento para que puedas ver cuánto del posicionamiento de hoy está impulsado por 0DTE y dónde se encuentran los strikes del mismo día más pesados.
- **Las tarjetas de wall y flip** muestran los niveles estructurales de hoy con la distancia en vivo desde el spot.

![Mapa de calor de GEX por strike y DTE de ZeroGEX con el bucket 0DTE concentrado cerca del spot](/blog/zerogex-strike-dte-heatmap.png)

Un ejemplo desarrollado. Supongamos que SPX está en 5.825, el Net GEX marca −800 millones de dólares, el gamma flip se sitúa en 5.840, y el mapa de calor muestra un strike de put 0DTE pesado en 5.820 que ha estado migrando a la baja junto con el precio durante toda la mañana. La lectura estructural: los dealers están cortos de gamma, el spot está por debajo del flip, y el strike 0DTE más pesado está siguiendo el movimiento en lugar de contenerlo.

Inclinación práctica: este es un régimen de gamma corta, favorable a la continuación, con el strike de put migrando confirmando en lugar de resistir la caída. Un trader que entró en la sesión con un sesgo de mean-reversion debería ser mucho más cauteloso aquí, porque la estructura 0DTE está apuntando activamente en la dirección contraria. Nada de esto es una señal de trade — es contexto de régimen que debería remodelar qué entradas tomas en serio.

![Tarjetas de Net GEX y Gamma Flip de ZeroGEX mostrando una lectura intradía de gamma negativa](/blog/zerogex-net-gex-flip-card.png)

---

## Errores comunes al leer la gamma de dealers 0DTE

Una breve lista de cómo se malinterpreta el posicionamiento de dealers en 0DTE:

- **Usar la gamma de todo el OI en una cadena dominada por 0DTE.** Si la mayor parte de la gamma de hoy es 0DTE y estás leyendo la gamma agregada del OI, tu lectura está promediando un libro cercano al vencimiento con un libro de vencimiento lejano que no importa para el tape de hoy.
- **Tratar los walls como duraderos en un régimen de gamma negativa.** No lo son. Se convierten en objetivos de breakout.
- **Ignorar el régimen y operar el nivel.** El spot en el put wall es un trade distinto por encima del flip que por debajo de él.
- **Ignorar la migración.** Un strike 0DTE pesado que se ha movido dos veces en la última hora es una lectura distinta a uno que ha permanecido estático toda la mañana.
- **Tratar el comportamiento de pin en 0DTE como garantizado.** Es una inclinación, no una promesa. Los catalizadores y los shocks de flujo rompen el pin con regularidad.

---

## Conclusión

> 0DTE ha cambiado qué parte del libro de los dealers mueve realmente el tape. El posicionamiento total importa; es el *bucket 0DTE* el que domina la lectura intradía.

La disciplina es la misma que para cualquier lectura de posicionamiento de dealers — empieza por el régimen, luego lee la estructura dentro de él — pero el bucket 0DTE es donde vive ahora la mayor parte de la gamma durante la sesión de contado, e ignorarlo te deja una sesión por detrás.

Solo contenido educativo — nada de lo anterior es una recomendación de trading.

---

Si quieres ver el posicionamiento de dealers en 0DTE de hoy en tiempo real — el régimen, los strikes del mismo día más pesados, los walls en vivo y el perfil de gamma de los dealers — el dashboard gratuito de ZeroGEX muestra todo esto.
