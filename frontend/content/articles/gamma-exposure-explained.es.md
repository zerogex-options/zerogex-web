# Gamma Exposure (GEX) explicado: la guía completa

*Gamma exposure explicado desde cero: qué es el GEX, cómo se calcula y se asigna el signo al gamma de los dealers, por qué el régimen por encima y por debajo del flip se comporta de forma tan distinta, y cómo utilizarlo realmente dentro de una sesión.*

---

## Por qué importa la gamma exposure

Gran parte de la acción del precio que los traders intentan leer en un gráfico es un efecto derivado de algo que ocurre un nivel más abajo: los **flujos de cobertura de los dealers**. Los market makers se sitúan al otro lado de cada operación con opciones y, para mantenerse delta-neutral, compran y venden continuamente el subyacente a medida que se mueve el precio. Que compren la debilidad o la vendan —que amortigüen la volatilidad o la amplifiquen— depende de una variable estructural: su **gamma exposure**.

La gamma exposure (GEX) es la forma más limpia de leer qué está haciendo ese libro de los dealers. Indica si la fuerza estructural del mercado empuja hacia la estabilidad o la inestabilidad, si es probable que los breakouts se extiendan o se agoten, y si los strikes que ves en la cadena de opciones están absorbiendo flujo o liberándolo. No indica la dirección. Indica el **carácter del régimen** en el que estás operando, y ahí reside la mayor parte de la ventaja.

Este artículo es la lectura exhaustiva. Cubriremos qué es la gamma exposure, cómo se construye a partir de la cadena de opciones, la mecánica de los regímenes de gamma positivo frente a negativo, el papel del gamma flip y de los gamma walls, y el flujo de trabajo práctico para usar todo esto en el intradía. Para lecturas más profundas orientadas al trader sobre cada subtema, esta guía enlaza a [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip), [Gamma Walls explicados](/education/gamma-walls-explained) y [Posicionamiento de dealers en 0DTE explicado](/education/0dte-dealer-positioning-explained). Para las Griegas de segundo orden específicas, consulta [Vanna y Charm explicados para traders de opciones](/education/vanna-and-charm-explained), y para la discusión sobre pinning frente a imán, consulta [Max Pain explicado: ¿funciona realmente?](/education/max-pain-explained).

---

## ¿Qué es la gamma exposure (GEX)?

La gamma exposure es el requisito agregado de cobertura de los dealers implícito en el perfil de open interest de la cadena de opciones. Es la respuesta a una sola pregunta: *si el spot se mueve un poco, ¿con qué agresividad deben operar los dealers el subyacente para mantener su libro delta-neutral?*

Tres definiciones rápidas para encuadrar el resto del artículo.

### ¿Qué es el gamma?

El gamma es una Griega de segundo orden que mide la **tasa de cambio del delta** respecto al subyacente. El delta indica cuán sensible es el precio de una opción al subyacente; el gamma indica cuán sensible es esa sensibilidad. Si el delta es la velocidad, el gamma es la aceleración.

El gamma es más alto en el dinero (at the money) y decae en ambas direcciones al alejarse del spot. También decae con el tiempo: las opciones de vencimiento lejano tienen menos gamma por contrato que las de vencimiento cercano. El gamma más fuerte en cualquier cadena se concentra en los strikes at-the-money de vencimiento corto, una de las razones por las que el flujo 0DTE ha remodelado tan completamente la estructura intradía.

### Por qué el gamma de los dealers importa específicamente

Los dealers no mantienen opciones para especular. Las guardan como inventario, cubriendo el delta lo más rápido posible. Su gamma exposure determina cómo tiene que cambiar esa cobertura a medida que se mueve el precio.

- Un dealer **corto de gamma** debe operar **en la misma dirección** del movimiento para mantenerse plano: comprando cuando el precio sube, vendiendo cuando baja. Esa cobertura amplifica el movimiento.
- Un dealer **largo de gamma** opera **en contra** del movimiento para mantenerse plano: vendiendo cuando el precio sube, comprando cuando baja. Esa cobertura amortigua el movimiento.

La gamma exposure agregada de los dealers en toda la cadena es, en esencia, una estimación de cuánto flujo sobre el subyacente tendrán que ejecutar los market makers durante un movimiento de precio determinado, y en qué dirección. Eso es lo que captura el GEX.

### Una definición operativa

La gamma exposure es la magnitud en dólares (y el signo) del flujo de cobertura de los dealers por unidad de movimiento del subyacente, agregada en todos los contratos abiertos. Cuando los traders preguntan qué significa "gamma exposure explicado" o "qué es el GEX", esa es la respuesta: es una estimación en tiempo real de cómo reaccionará el libro de los dealers ante el precio.

---

## ¿Cómo se calcula la gamma exposure?

El cálculo tiene varias piezas móviles, pero la estructura es sencilla.

### La fórmula por strike

Para un único contrato de opciones, la contribución a la gamma exposure de los dealers (en dólares, por cada 1 % de movimiento) es aproximadamente:

```
contract_GEX ≈ gamma × open_interest × 100 × spot² × 0.01
```

Donde:

- `gamma` es el gamma por opción obtenido del modelo de Black-Scholes.
- `open_interest` es el número de contratos vigentes en ese strike.
- `100` es el multiplicador estándar del contrato.
- `spot²` convierte el gamma (que en sí mismo se expresa por dólar) en una magnitud de flujo de cobertura.
- `0.01` reescala el resultado a una interpretación "por 1 % de movimiento", que es la convención del sector.

La interpretación en dólares es lo que hace útil la cifra: responde a "¿cuánto subyacente tienen que operar los dealers si el spot se mueve un 1 %?" —en un único strike, y luego agregado en toda la cadena.

### Gamma exposure con signo

Para convertir la magnitud bruta en una señal de régimen, cada contrato se asigna con signo según quién lo mantiene. La convención estándar asume que:

- Los clientes suelen estar netos largos en calls y netos largos en puts.
- Por lo tanto, los dealers suelen estar netos cortos en ambas: las calls vendidas aportan gamma positivo al libro de los dealers, las puts vendidas aportan gamma negativo.

En la práctica, esto produce un GEX de dealers con signo por strike —positivo para calls, negativo para puts— que, al sumarse, da la exposición neta del dealer en toda la cadena.

Esto es una aproximación. El posicionamiento de los dealers no es directamente observable; se infiere a partir del open interest y de la convención estándar de "cliente largo". Distintos proveedores manejan los casos límite de forma diferente, y el supuesto puede fallar en condiciones de flujo inusuales. Aun así, como estimador de régimen, se ha mantenido lo suficientemente sólido como para ser el estándar durante años.

### Net GEX frente a Total GEX

De la misma cadena surgen dos cifras agregadas:

- El **Total GEX** es la suma de la contribución *absoluta* en cada strike: una lectura de magnitud, indiferente al signo. Indica cuánto gamma hay en el sistema en general.
- El **Net GEX** es la suma *con signo*: calls menos puts. Indica qué lado del libro de los dealers domina, y si el reflejo agregado de cobertura amortigua o amplifica.

La mayor parte del análisis de régimen usa el Net GEX. La magnitud también importa —un Net GEX de +2.000 millones de dólares es un régimen mucho más marcado que uno de +200 millones—, pero el signo es la primera lectura.

### Gamma de dealers vía spot-shift frente a agregación por strike

Hay dos maneras de extraer información de régimen de la cadena:

1. La **agregación por strike** suma la gamma exposure con signo en cada strike al spot de hoy. Es rápida e intuitiva.
2. El **gamma de dealers vía spot-shift** recalcula el gamma de cada opción para cada precio spot hipotético en una cuadrícula, y luego suma para obtener una *curva* del gamma de los dealers frente al precio. El cruce por cero de esa curva es el gamma flip; el valor en el spot de hoy es el Net GEX-at-spot.

El enfoque de spot-shift tiene una ventaja estructural: como el Net GEX principal y el gamma flip se leen de una única curva, no pueden contradecirse entre sí. Un Net GEX positivo siempre corresponde a un spot por encima del flip; uno negativo siempre está por debajo. El enfoque por strike puede producir signos inconsistentes cuando la cadena se desplaza, razón por la cual el enfoque de spot-shift es el estándar del sector para el análisis de régimen serio. La metodología detrás de la implementación de ZeroGEX está documentada en detalle en [GEX y el Gamma Flip: cómo los calcula ZeroGEX](/guides/gamma-flip-calculation-before-vs-after).

---

## Regímenes de gamma positivo frente a negativo

La lectura individual más importante en el análisis del posicionamiento de dealers es de qué lado del gamma flip se encuentra el spot. Las mecánicas son inversas entre sí, y las operaciones que funcionan en un régimen tienden a ser las incorrectas en el otro.

### Régimen de gamma positivo

Por encima del gamma flip, los dealers son generalmente netos largos de gamma. Para mantenerse delta-neutral, cubren los movimientos direccionales: vendiendo cuando el precio sube y comprando cuando baja. Ese reflejo tiende a:

- Comprimir la volatilidad realizada.
- Atraer el precio hacia strikes con alta concentración de gamma, especialmente hacia el cierre.
- Dificultar que los breakouts se sostengan.
- Hacer más fiables los setups de reversión a la media.

El carácter del mercado es **acotado en rango y absorbente**. El comportamiento de pinning es más probable, sobre todo cerca del OPEX y hacia el cierre del mercado en efectivo. Las estrategias de venta de prima tienden a funcionar más a menudo. Los setups de seguimiento de tendencia tienen una tasa de acierto más baja.

### Régimen de gamma negativo

Por debajo del gamma flip, los dealers son generalmente netos cortos de gamma. Para mantenerse delta-neutral, cubren con movimientos direccionales: comprando cuando el precio sube y vendiendo cuando baja. Ese reflejo tiende a:

- Ampliar la volatilidad realizada.
- Hacer que los breakouts se extiendan más de lo que parece que deberían.
- Hacer que las ventas masivas se aceleren a medida que avanzan.
- Hacer peligrosos los setups de reversión a la media.

El carácter del mercado es **impulsado por el momentum y amplificador**. Los pins del régimen anterior se liberan; los strikes que eran resistencia pueden convertirse en objetivos de breakout. Las estrategias de compra de prima y de continuación de tendencia tienden a funcionar más a menudo. Intentar atrapar un cuchillo que cae en un régimen de gamma profundamente negativo va exactamente en contra del reflejo que haría funcionar una compra en el dip.

### Dos advertencias importantes

El régimen es una **inclinación probabilística, no una garantía**. Los shocks macro, los catalizadores de acciones individuales en componentes del índice y los eventos de flujo inusuales pueden anular el tirón estructural en cualquier dirección. Un régimen de spot indica *cuál es el reflejo del dealer*, no lo que hará el resto de los participantes.

El régimen es también **dinámico**. El flip se mueve a medida que el posicionamiento se reequilibra, y el spot puede cruzarlo varias veces en una sesión. Leer el régimen es una actividad continua, no un ritual matutino.

---

## El gamma flip: la frontera del régimen

El gamma flip es el nivel en el que el gamma agregado de los dealers cruza cero. Por encima, los dealers suelen ser netos largos de gamma; por debajo, netos cortos. Es la frontera estructural entre los dos regímenes descritos anteriormente.

Algunas cosas que vale la pena precisar:

- El flip es un **nivel, no un muro**. No resiste al precio como podría hacerlo una concentración fuerte de strikes. Marca una inflexión de comportamiento, no una barrera estructural.
- Es una **línea de régimen, no una señal direccional**. Que el spot esté por encima del flip no es alcista; que esté por debajo no es bajista. Habla del carácter de la volatilidad, no de la dirección.
- Es **dinámico**. A medida que el OI rota y la cadena se reequilibra, el flip se desplaza. Un flip desactualizado es un flip engañoso.
- Es un **filtro, no una señal**. Indica qué manual de estrategia usar; la entrada tiene que venir de otro lugar.

Para el flujo de trabajo de lectura práctico —incluyendo qué cambia por encima frente a por debajo, cómo actuar sobre ello en el intradía, y los errores comunes— consulta [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Gamma walls: dónde se concentran los flujos

Si el flip es la frontera del régimen, los gamma walls son las fronteras estructurales dentro de ella. El **call wall** es el strike por encima del spot que concentra la mayor gamma exposure en calls; el **put wall** es el strike por debajo del spot con la mayor gamma exposure en puts. Juntos delinean el rango que la cobertura de los dealers tiende a defender.

Los walls se comportan de forma muy distinta en los dos regímenes:

- En un régimen de **gamma positivo**, los walls absorben. El reflejo de los dealers en torno a ellos es contrarrestar los movimientos: vendiendo los rallies hacia el call wall, comprando las caídas hacia el put wall.
- En un régimen de **gamma negativo**, los walls se liberan. El mismo nivel que resistía el precio en gamma largo puede convertirse en un objetivo de breakout.

Los walls también migran. Un call wall que se desplaza hacia arriba a medida que el precio lo pone a prueba es una lectura estructuralmente distinta a uno que se mantiene firme. Para el flujo de trabajo de lectura completo, consulta [Gamma Walls explicados: Call Wall, Put Wall y cómo reacciona el precio](/education/gamma-walls-explained).

---

## Cómo el GEX moldea la volatilidad intradía

La volatilidad realizada —la amplitud real de los movimientos de precio durante la sesión— está fuertemente moldeada por el régimen de GEX, de forma independiente de la volatilidad implícita (que es lo que el mercado de opciones está descontando para el futuro).

La relación es estructural:

- Un régimen de gamma positivo profundo tiende a producir **volatilidad realizada más baja que la implícita**. El reflejo amortiguador es lo bastante grande como para suprimir movimientos que el mercado esperaba. Esto suele favorecer las estrategias de venta de prima.
- Un régimen de gamma negativo profundo tiende a producir **volatilidad realizada más alta que la implícita**. El reflejo amplificador expande los rangos más allá de lo que el mercado había descontado. Esto tiende a favorecer las estrategias de compra de prima y de momentum.

La magnitud importa tanto como el signo. Un cambio de +2.000 millones de dólares de Net GEX a +200 millones es un estado muy distinto a un cambio de −2.000 millones a +200 millones, aunque ambos lleguen a una cifra similar. El primero es un régimen de gamma largo que se está *agotando*; el segundo es uno que se está *construyendo*. La trayectoria forma parte de la lectura.

Un error común es usar el GEX como señal direccional: "el Net GEX sube, así que el mercado está subiendo". Eso no es lo que indica. El GEX habla del **carácter del movimiento**, no de su dirección. Un régimen de gamma positivo puede descender con la misma facilidad con la que puede ascender, pero tenderá a hacerlo de forma gradual en lugar de romper.

---

## Cómo usar el GEX en el intradía

Un flujo de trabajo práctico:

### Paso 1: Identifica el régimen

Antes que nada, comprueba si el spot está por encima o por debajo del gamma flip y cuál es la magnitud del Net GEX. Esa única lectura filtra una gran parte de las operaciones malas: contrarrestar movimientos cuando deberías acompañarlos, o hacer breakouts cuando deberías contrarrestarlos.

### Paso 2: Lee los walls dentro del régimen

Localiza el call wall y el put wall activos. En un régimen de gamma positivo, son tus fronteras absorbentes: el rango estructural. En un régimen de gamma negativo, son más débiles como resistencia y pueden convertirse en objetivos de breakout.

### Paso 3: Vigila la migración

Los niveles no son estáticos. Un wall que migra con el precio (persiguiendo el movimiento) es una lectura distinta a uno que se mantiene firme. Un flip que se desplaza hacia arriba junto con el precio tiene implicaciones distintas a uno que se queda fijo mientras el spot se aleja. Sigue el *cambio*, no solo el valor.

### Paso 4: Ten en cuenta la concentración 0DTE

Cuando las opciones que vencen el mismo día dominan la cadena —cada vez más la norma para el SPX durante la sesión en efectivo—, el bucket 0DTE impulsa de forma desproporcionada el comportamiento intradía de los dealers. El gamma relevante es el de los strikes que seguirán vivos al cierre. El tratamiento más profundo está en [Posicionamiento de dealers en 0DTE explicado](/education/0dte-dealer-positioning-explained).

### Paso 5: Incorpora las Griegas de segundo orden cuando sea relevante

El gamma no es todo el cuadro. La vanna (cobertura impulsada por la vol) crea un bid persistente en regímenes de compresión de volatilidad; el charm (cobertura impulsada por el tiempo) impulsa los flujos predecibles hacia el cierre que aparecen en las lecturas de presión de fin de día. El artículo complementario [Vanna y Charm explicados para traders de opciones](/education/vanna-and-charm-explained) cubre ambos.

---

## Vanna y charm: la historia de segundo orden

El GEX es la lectura principal, pero no es todo el libro de los dealers. Dos Griegas de segundo orden moldean de forma sustancial los flujos de cobertura de los dealers, además del gamma:

- **Vanna** es la sensibilidad del delta a la volatilidad implícita. Cuando la IV se mueve, los deltas de las opciones de los dealers se mueven aunque el spot no lo haga, y tienen que cubrir eso. En un régimen de compresión de volatilidad, los flujos de vanna procedentes de las calls cortas de los dealers a menudo se manifiestan como un bid persistente y sostenido en el subyacente.
- **Charm** es la sensibilidad del delta al tiempo. A medida que las opciones se acercan al vencimiento, su delta se desplaza de forma predecible —las opciones fuera del dinero decaen hacia 0, las que están dentro del dinero hacia 1—, y los dealers deben recubrir continuamente esa deriva. El lugar más limpio para ver el charm en el mercado son los últimos 90 minutos de la sesión en efectivo.

Ambos efectos son mayores cuando el gamma también es grande, es decir, cuando las opciones 0DTE y de vencimiento corto dominan la cadena. Léelos junto con el GEX, no de forma aislada.

---

## Ideas equivocadas comunes sobre el GEX

Algunas trampas:

- **"Gamma positivo es alcista."** No lo es. Es **estabilizador**. El mercado puede caer en un régimen de gamma positivo; simplemente tiende a hacerlo despacio.
- **"El Net GEX es un indicador direccional."** No lo es. El signo indica el régimen; la dirección viene de otro lugar.
- **"Los niveles de GEX son fijos."** No lo son. El flip, los walls y el propio Net GEX se mueven a medida que la cadena se reposiciona.
- **"Los walls son soporte y resistencia duros."** Son inclinaciones estructurales cuyo efecto en el comportamiento depende del régimen. Se rompen con regularidad.
- **"El GEX es una señal."** Se parece más a un filtro. Una lectura de régimen limpia afina cualquier otra herramienta que uses; por sí sola no indica cuándo entrar.

---

## Lo que el GEX no es (limitaciones)

El GEX es un estimador de los requisitos de cobertura de los dealers, construido a partir del open interest bajo un supuesto estándar sobre quién mantiene qué. Eso lo hace útil, pero no es un cuadro completo:

- **El OI es una instantánea, no un inventario en tiempo real.** El posicionamiento de los dealers cambia dentro del día de formas que el OI no captura.
- **La convención de cliente-largo-en-calls/cliente-largo-en-puts puede fallar.** Durante condiciones de flujo inusuales, el supuesto sobre el signo del dealer puede atribuir mal la exposición.
- **Los eventos macro anulan la estructura.** Una sorpresa en el CPI o un comunicado de la FOMC puede desbordar el reflejo de los dealers.
- **Los catalizadores de acciones individuales pueden mover el GEX del índice de forma indirecta.** Los resultados empresariales, las fusiones y adquisiciones, y las noticias de componentes pueden remodelar el flujo del SPX de formas que se reflejan en el GEX con retraso.
- **Los supuestos sticky-strike frente a sticky-delta** importan para las implementaciones de spot-shift; distintos proveedores los manejan de forma diferente.

El enfoque correcto es que el GEX es la lectura individual más limpia de la fuerza estructural impulsada por los dealers en el mercado, no la única fuerza, no una previsión, y no un sustituto de la gestión de riesgo.

---

## Cómo presenta ZeroGEX la gamma exposure

El panel centraliza las lecturas en vivo:

- La **tarjeta de Net GEX** muestra el valor del gamma de dealers en el spot (consistente en signo con el flip, calculado a partir de una única curva).
- La **tarjeta de Gamma Flip** muestra el nivel actual del flip con la distancia en vivo respecto al spot.
- Las **tarjetas de Call Wall y Put Wall** trazan las fronteras estructurales en vivo.
- El **gráfico de perfil por strike** traza el perfil de gamma de los dealers a través de los strikes: la curva de la que se derivan tanto el Net GEX como el flip.
- El **mapa de calor por strike y DTE** desglosa el gamma por franja de vencimiento, poniendo de relieve la concentración 0DTE que domina cada vez más la lectura intradía.

![Visión general del panel de ZeroGEX con las tarjetas de Net GEX, Gamma Flip, Call Wall y Put Wall](/blog/zerogex-dashboard-overview.png)

Un ejemplo trabajado. Supongamos que el SPX está en 5.830 y el panel muestra:

- **Net GEX:** +1.500 millones de dólares
- **Gamma Flip:** 5.810
- **Call Wall:** 5.850
- **Put Wall:** 5.790

La lectura compuesta: el spot está cómodamente en territorio de gamma largo (20 puntos por encima del flip), el Net GEX es una cifra positiva sustancial que indica una magnitud real en el libro de los dealers, y el rango de walls es asimétrico, con el call wall más cerca que el put wall. La inclinación práctica: régimen de volatilidad amortiguada, mercado favorable a la reversión a la media, breakouts con más probabilidad de agotarse que de extenderse, y comportamiento de pinning hacia la fuerte concentración de gamma como posibilidad hacia el cierre. Nada de esto es una señal de operación: es el trasfondo estructural frente al cual debería calibrarse cualquier otra herramienta que uses.

![Gráfico de perfil por strike de ZeroGEX con la curva de gamma de los dealers, la línea del flip y los walls resaltados](/blog/zerogex-strike-profile-overview.png)

Imagina ahora el mismo panel 90 minutos después: el Net GEX ha decaído a +300 millones de dólares y el gamma flip se ha desplazado hacia arriba hasta 5.825 mientras el spot ha bajado a 5.818. El régimen está ahora en disputa: el spot está técnicamente por debajo del flip, pero solo por unos pocos puntos, y la magnitud se ha adelgazado. Ese es exactamente el estado estructural en el que ambos regímenes están parcialmente activos, el comportamiento se vuelve inestable, y la disciplina correcta suele ser esperar una lectura más limpia antes de comprometerse.

---

## Conclusión

> La gamma exposure no es una predicción. Es una lectura de régimen: la fuerza estructural en el libro de los dealers que moldea cómo se comporta el mercado, pero que por sí sola no dicta la dirección.

La disciplina consiste en partir del régimen, leer la estructura dentro de él, observar cómo migran ambos a lo largo de la sesión, y dejar que el GEX filtre qué manual de estrategia tiene sentido en lugar de tratarlo como una señal en sí misma. Gran parte de la ventaja en el análisis del posicionamiento de dealers está en *no tomar* las operaciones que van en contra del reflejo de los dealers.

Contenido únicamente educativo: nada de lo anterior es una recomendación de trading.

---

Si quieres ver hoy la [lectura completa de la gamma exposure en tiempo real](/real-time-gex-0dte) —Net GEX, el gamma flip, los call y put walls, y el perfil de gamma de los dealers—, [el panel gratuito de ZeroGEX](/spx-gamma-levels) lo muestra todo. Para una comparación directa de cómo se sitúa ZeroGEX frente a otras plataformas de gamma exposure, consulta [la guía de las mejores herramientas de GEX](/education/best-gex-tools).
