# Hedging Flow explicado: leer el tape de opciones a través de la cobertura

*La mayoría de las herramientas de gamma se preguntan cómo podrían cubrirse los dealers si el precio se mueve. Hedging Flow se pregunta qué cobertura implica ya la negociación de opciones de hoy, y si la gamma en torno al precio está configurada para absorber ese empuje o para amplificarlo.*

---

## Una pregunta distinta de la del GEX

La exposición gamma es una lectura estructural. Parte del open interest que hay en los libros y pregunta: si el precio se mueve, ¿cómo podría responder la cobertura?

Hedging Flow parte, en cambio, del tape. Dadas las opciones que realmente se negociaron hoy, ¿qué cobertura en acciones implicaría esa actividad, y hacia dónde está empujando ahora mismo?

La página combina esa estimación con una lectura de cómo está cambiando la gamma de los dealers cerca del precio actual, y luego condensa ambas en un único titular, **Gamma Weather**. Nada de ello es una señal de compra o de venta. Responde a una pregunta más acotada y más útil: ¿el tape de opciones empuja a favor del precio o en su contra, y es más probable que la estructura en torno al precio amortigüe ese empuje o que lo amplifique?

---

## Qué es la cifra

ZeroGEX clasifica el volumen de opciones comparando el precio al que se negoció con la cotización de ese momento:

- el volumen que se imprime cerca del ask cuenta como **iniciado por el comprador**;
- el volumen que se imprime cerca del bid cuenta como **iniciado por el vendedor**;
- el volumen en mitad del spread, el volumen del primer minuto de la sesión y el volumen sin una cotización utilizable quedan **sin clasificar**.

Dentro de cada contrato y cada minuto, el volumen sin clasificar se reparte en la misma proporción de compra/venta que el volumen clasificado de ese minuto. Un contrato-minuto sin nada clasificado no suma nada.

Después, el modelo supone que el lado pasivo de cada operación clasificada fue un market maker que se cubre para mantenerse delta-neutral, y calcula las acciones que esa cobertura negociaría:

`(contracts bought − contracts sold) × delta × 100 × underlying price`

El delta lleva signo, positivo para las calls y negativo para las puts, así que el signo del resultado es la dirección de la cobertura implícita: **positivo significa que la cobertura compra el subyacente; negativo, que lo vende.** Los resultados se suman en barras fijas de cinco minutos de 9:30 a 16:15 ET.

Dos ejemplos rápidos, con SPY en 660 $:

- Un cliente compra 1.000 calls con delta 0,40: `1,000 × 0.40 × 100 × $660 = +$26.4M`. El market maker que se las vendió queda ahora corto de delta, así que la cobertura implícita **compra** unos 26,4 millones de dólares de SPY.
- Un cliente compra 1.000 puts con delta −0,30: `1,000 × (−0.30) × 100 × $660 = −$19.8M`. La cobertura implícita **vende** unos 19,8 millones de dólares. Si el cliente hubiera vendido esas puts, el signo pasaría a +19,8 millones de dólares.

---

## Qué no es la cifra

La palabra clave es *implica*. Una lectura de +500 millones de dólares significa que, bajo los supuestos del modelo, la actividad de opciones clasificada implica unos 500 millones de dólares de compras del subyacente. No significa que los dealers compraran 500 millones de dólares en acciones.

ZeroGEX no ve quién está a cada lado de una operación, si una operación abrió o cerró una posición, ni lo que cualquier market maker tiene o cubre realmente. El supuesto de que el lado pasivo era un market maker todavía no se ha validado con datos de market makers clasificados por la bolsa. Por eso la página incluye esta advertencia bajo su gráfico:

> Presión de cobertura estimada. Inferida a partir de operaciones de opciones clasificadas por agresor, bajo el supuesto de que el lado pasivo de cada print fue un market maker; ese supuesto no está validado. No es flujo de dealers observado.

Conviene conocer algunos límites más:

- cada pata de un spread se clasifica por separado, así que una sola operación de varias patas puede leerse como compras y ventas separadas;
- el delta se toma una vez por contrato y por minuto, no en el instante de cada operación;
- la estimación cubre los vencimientos y strikes que ZeroGEX sigue para ese símbolo, no todos los contratos listados.

---

## Las calls no son automáticamente alcistas, ni las puts automáticamente bajistas

Como el delta lleva signo, la dirección de la cobertura implícita depende tanto del tipo de opción como del lado que inició la operación:

| Actividad del cliente | Cobertura implícita |
|---|---|
| Compra calls | Compra el subyacente (+) |
| Vende calls | Vende el subyacente (−) |
| Compra puts | Vende el subyacente (−) |
| Vende puts | Compra el subyacente (+) |

Por eso las tarjetas **Call-driven** y **Put-driven** describen de dónde vino la presión, no si fue alcista o bajista. Una cifra Put-driven positiva es perfectamente posible: es el aspecto que tiene una venta intensa de puts. También lo es una cifra Call-driven negativa.

---

## Las tarjetas: por dónde ha ido el día

Tres de las cuatro tarjetas resumen la sesión hasta el momento:

- **Session pressure** es el total neto acumulado de la presión de cobertura estimada desde la apertura. Es acumulativo, no el empuje actual de cinco minutos.
- **Call-driven** es la parte de ese total que procede de las calls.
- **Put-driven** es la parte que procede de las puts.

Call-driven más Put-driven es igual a Session pressure. Cualquier diferencia en las cifras mostradas se debe al redondeo. Las tarjetas leen la barra más reciente que tuvo flujo real, así que una barra tranquila que se arrastra hacia delante no se presenta como nueva.

Separa la historia del presente. Una sesión puede acumular +2.000 millones de dólares de Session pressure mientras sus últimas barras ya se han vuelto negativas. El total dice por dónde ha ido el día. No dice hacia dónde van los próximos minutos. La cuarta tarjeta, **Last flip**, trata del presente, y se explica más abajo, en el apartado sobre los flips.

---

## El gráfico de flujo: Pressure rate y Session cumulative

El gráfico tiene dos vistas.

**Pressure rate** es la vista predeterminada. Cada barra es la presión estimada de una sola barra de cinco minutos (**Pressure this bar**), con una línea **3-bar average** encima, que cubre aproximadamente los últimos 15 minutos. La barra más reciente puede estar todavía llenándose, y cuenta en esa media mientras tanto.

**Session cumulative**, en cambio, traza los totales acumulados Call-driven y Put-driven y la línea **Net hedging pressure**.

Ambas vistas dibujan **Price** en el eje derecho, que es donde suele aparecer la información intradía útil:

| Precio | Presión | Una forma de leerlo |
|---|---|---|
| Sube | Positiva | El movimiento tiene detrás demanda de cobertura estimada |
| Sube | Negativa | El precio avanza en contra de la presión estimada |
| Baja | Positiva | Aparecen compras estimadas durante la caída |
| Baja | Negativa | El tape de opciones está reforzando el movimiento |

La relación suele ser más informativa que el tamaño de cualquier barra individual. Un impulso grande que apenas mueve el precio también dice algo: el otro lado del mercado lo está absorbiendo.

El selector de vista también cambia el gráfico de estructura de abajo, para que los dos comparen siempre lo mismo con lo mismo. En Pressure rate muestra los últimos 30 minutos de cambio estructural. En Session cumulative muestra el cambio desde la apertura.

---

## Los flips y la tarjeta Last flip

Un **flip** marca un cambio de dirección de la media de 3 barras, y es deliberadamente más difícil de activar que un cambio de signo:

- la media tiene que asentarse al otro lado de una **banda plana** en torno a cero, que se extiende en cada dirección hasta la mitad de la tasa típica de la sesión hasta ese momento. Una línea que roza el cero, lo cruza y vuelve se trata como plana, no como dos flips;
- un flip es **significativo** cuando su oscilación es al menos la oscilación típica entre barras de la sesión hasta ese momento. El resto son **leves**.

Ambos umbrales se construyen solo con las barras anteriores al flip, así que cada flip se juzga con lo que se sabía en ese momento. Sin embargo, la barra más reciente todavía se está llenando, así que un flip en ella puede aparecer y desaparecer antes de que esa barra cierre.

El gráfico marca los flips con un punto sobre la línea de cero y una insignia encima, y por defecto solo muestra los flips significativos. La tarjeta **Last flip** es distinta: muestra el flip más reciente de cualquier tamaño, con la hora de inicio de su barra. Cuando el flip más reciente es leve, la tarjeta y la insignia pueden referirse a flips distintos. Desmarca **Significant flips only** para ver los leves en el gráfico. Todas las horas de la página están en hora del Este, con reloj de 24 horas.

---

## Dealer gamma structure: contra qué choca el empuje

Hedging Flow estima el empuje. **Dealer gamma structure** describe lo que lo recibe, usando la gamma modelada de los dealers de ZeroGEX y ponderando cada strike según su cercanía al precio actual. Los strikes a menos de un 1% del precio, aproximadamente, concentran la mayor parte del peso, y los que están a más de un 8% no pesan nada.

Hay algo que se aplica a todo este apartado: el open interest se publica una vez al día. Estas lecturas no se mueven porque se hayan abierto posiciones nuevas intradía. Se mueven porque el libro existente se revalúa a medida que cambian el precio, el tiempo y la volatilidad implícita.

El gráfico dibuja dos líneas:

- **Stability** mide si la gamma cercana al precio ha cambiado en una dirección que debería amortiguar el movimiento (por encima de cero, hacia el pinning) o amplificarlo (por debajo de cero, hacia la aceleración).
- **Lean** compara cómo ha cambiado la gamma por debajo del precio con cómo ha cambiado por encima. Por encima de cero es **supportive**: gamma que se acumula por debajo del precio, que se erosiona por encima, o ambas cosas. Por debajo de cero es **capping**, lo contrario.

Ambas miden cambio, no nivel. Una lectura hacia el pinning no significa que todo el libro esté largo de gamma. Significa que la estructura cercana al precio se movió en una dirección amortiguadora durante la ventana.

La etiqueta junto al título combina las dos líneas, separadas en cero: **Firming** (estabilizándose, de soporte), **Capping** (estabilizándose, acumulándose por encima), **Fragile bid** (de soporte pero adelgazándose) y **Deteriorating** (adelgazándose y haciendo de techo). Gamma Weather, más abajo, califica la misma lectura de Stability con una banda plana, así que el gráfico puede decir Firming mientras la franja de Weather dice Flat. No es una contradicción: una lectura positiva pequeña es ambas cosas.

---

## Gamma Weather: la franja superior

**Gamma Weather** es la lectura combinada de la parte superior de la página. Muestra un estado principal, cuánto tiempo lleva ese estado, un resumen de una frase y cinco chips: **Pressure now**, **Lean**, **Stability**, **Gamma trend** y **Flip cushion**. Haz clic en cualquier chip para abrir un gráfico de ese campo durante la sesión, con un rastro de los momentos en que cambió.

Weather siempre lee todos los vencimientos monitorizados, y lee la barra más reciente que tenga a la vez flujo de cobertura y una lectura de estructura.

### Pressure now

**Pressure now** convierte la última barra y su media de 15 minutos en una dirección, y la regla es más estricta de lo que sugieren las etiquetas:

- **Buying:** la última barra y la media de 15 minutos son ambas positivas, y al menos una de ellas supera los 25 millones de dólares.
- **Selling:** la imagen especular.
- **Mixed:** cualquier otro caso. Las dos no coinciden, una de ellas es exactamente cero, ambas están dentro de los 25 millones de dólares, o todavía no hay suficiente historial. Las dos primeras barras de cada sesión marcan Mixed.

Mixed no es lo mismo que calma. Significa que el empuje inmediato y el de la ventana corta no coinciden lo suficiente como para señalar una dirección. El mínimo de 25 millones de dólares es el mismo para todos los símbolos, así que es un listón más bajo en SPX que en SPY o QQQ.

Junto a la dirección, el chip muestra cuán asentada está:

- **Pulse:** la primera evidencia, todavía no una condición.
- **Building:** dos de las tres últimas barras superan los 25 millones de dólares en esa dirección, y la media de 15 minutos también.
- **Persistent:** lo hacen las tres barras.
- **Reversed:** aparece en la única barra en la que un lado establecido cede, tras dos barras del otro lado. Mientras eso está pendiente, aparece un chip **Pressure reversing · 1/2**.

### Lean, Stability y Gamma trend

**Lean** es el Lean de 30 minutos del gráfico, leído por su signo: cualquier lectura de cero o superior es Supportive.

**Stability** es la Stability de 30 minutos del gráfico con una banda de 50 millones de dólares en torno a cero: **Pinning** por encima de +50 millones de dólares, **Accelerative** por debajo de −50 millones de dólares, **Flat** entre ambos valores. Como el mínimo de presión de 25 millones de dólares, la banda es la misma para todos los símbolos.

**Gamma trend** es la misma medida de Stability tomada respecto a la primera barra de la sesión en lugar de respecto a hace 30 minutos: **Building**, **Thinning** o **Flat**. Eso te da dos relojes. Un Gamma trend en Building junto a una Stability en Accelerative no es una contradicción: puede significar que la estructura mejoró antes en el día y sigue por delante de la apertura, pero ha empezado a deteriorarse recientemente.

### Flip cushion

El **Flip cushion** es la distancia entre el precio y el gamma flip modelado de ZeroGEX, en puntos, esté el precio del lado que esté. El chip muestra la distancia con su dirección, por ejemplo "4 pts · Narrowing". La línea bajo los chips añade en qué lado del flip está el precio, la banda y el cambio en los últimos 5 y 15 minutos.

Los puntos por sí solos significarían algo distinto en cada símbolo, así que la banda califica el colchón frente al rango típico de 30 minutos del subyacente: la mediana del rango entre máximo y mínimo de las ventanas de 30 minutos de los últimos cinco días naturales:

| Colchón frente al rango típico de 30 minutos | Banda |
|---|---|
| Hasta 0,25× | Crossing |
| Hasta 0,60× | Thin |
| Hasta 1,25× | Normal |
| Más de 1,25× | Secure |

La dirección marca **Narrowing**, **Widening** o **Steady** según los últimos 15 minutos. Hay dos detalles que importan:

- Narrowing significa que la distancia se redujo. No tiene por qué significar que el precio se moviera hacia una línea fija, porque el flip también se mueve.
- El colchón no tiene signo. Cuando el precio cruza el flip, el colchón se estrecha hasta cero y luego vuelve a ensancharse al otro lado. Que se ensanche justo después de un cruce no significa que las condiciones se hayan vuelto más seguras.

Cuando la banda es Thin o Crossing y, en 15 minutos, el colchón se ha cerrado en al menos una cuarta parte del margen que queda, el chip marca **Thin and closing** y aparece en la franja un aviso **Transition risk**.

### Cómo se decide el titular

El titular combina solo dos chips, Pressure now y Stability:

| Pressure now | Stability | Gamma Weather |
|---|---|---|
| Mixed | Cualquiera | Mixed |
| Buying | Pinning o Flat | Stable bid |
| Buying | Accelerative | Fragile rally |
| Selling | Pinning o Flat | Supported dip |
| Selling | Accelerative | Unstable |

Un estado nuevo tiene que aparecer en dos barras de cinco minutos seguidas antes de sustituir al titular actual, y la más reciente de las dos puede estar todavía llenándose. Mientras espera, la franja lo muestra como en formación, por ejemplo **Fragile rally forming · 1/2**. Una vez que un estado ocupa el titular, su antigüedad marca **New**, luego **Established** a los 15 minutos, **Confirmed** a los 30 y **Mature** a los 60.

Lean, Gamma trend, el Flip cushion, Session pressure y el precio no deciden el titular. Son contexto a su alrededor. El colchón, en particular, matiza el estado; nunca compite con él.

Los nombres no son afirmaciones sobre el precio. "Fragile rally" no requiere que el precio esté subiendo: significa presión compradora sobre una estructura que se ha vuelto aceleradora. "Supported dip" no requiere una caída visible: significa presión vendedora sobre una estructura que se mantiene o se está afianzando. Lee Weather como una descripción de cómo interactúan el empuje actual y la estructura actual, no como un pronóstico.

---

## Lectura de un ejemplo real

![Hedging Flow de SPY a las 14:56 ET del 28 de septiembre de 2026: Gamma Weather, las cuatro tarjetas, el gráfico Pressure rate y la estructura de gamma de los dealers](/blog/zerogex-hedging-flow-spy-2026-09-28-cropped.png)

Este es SPY a las 14:56 ET del 28 de septiembre de 2026, tomado con el botón de instantánea de la página. Todas las sesiones pasadas se archivan en [sesiones de Hedging Flow](/hedging-flow/sessions), con una página fechada por símbolo. Haz clic en la imagen para verla más grande. Los niveles de precio que siguen se han leído en el gráfico, así que tómalos como aproximados.

**Las tarjetas.** Session pressure marca −4.760 millones de dólares: una cifra estimada de 4.760 millones de dólares de ventas de SPY implícitas en las operaciones de opciones clasificadas del día. Ambos libros contribuyeron casi por igual, −2.500 millones de dólares de las calls y −2.260 millones de dólares de las puts. Según el modelo, eso son clientes vendiendo calls y comprando puts, y ambas cosas implican una cobertura que vende.

**El precio no siguió al total.** SPY abrió cerca de 767,75 $, tocó unos 768,40 $ antes de las 10:00, luego se deslizó hasta unos 763,95 $ para las 10:51, y la racha más intensa de barras vendedoras llegó durante esa caída. Lo recuperó todo para las 12:25 y, salvo un pico hasta el máximo del día cerca de 768,80 $ a las 13:10, pasó la tarde aproximadamente entre 766,40 $ y 767,50 $. En el momento de la instantánea estaba a menos de un dólar de su primer print. Los dos repuntes bruscos, hacia las 12:20 y las 13:10, llegaron con las mayores barras compradoras del día, y el segundo se devolvió de inmediato junto a una gran barra vendedora. El total siguió siendo muy negativo mientras el precio volvía por completo, que es precisamente la razón de mantener separados Session pressure y Pressure rate: el primero indica por dónde ha ido el tape, no adónde tiene que ir el precio.

**El historial de Weather.** El panel desplegable de Pressure now colorea cada barra según el estado de Weather en ese momento: Mixed durante la primera hora, Unstable durante la caída de finales de la mañana, Supported dip mientras el precio formaba una base cerca de 765 $, Stable bid durante el rally de mediodía, y varios cambios desde entonces.

**Ahora mismo.** La media de 3 barras pasó a compra a las 14:45, que es lo que muestra la tarjeta Last flip. Fue el 13.º flip que marcó el gráfico ese día, un tape agitado según esta medida. La presión compradora con un chip de Stability en Flat dio el titular **Stable bid**, que llevaba 10 minutos. Pero la barra de las 14:55, con alrededor de un minuto de antigüedad cuando se tomó la instantánea, ya se estaba imprimiendo del lado vendedor. Pressure now marca Mixed, **Mixed forming · 1/2** muestra el candidato, y **Pressure reversing · 1/2** muestra que el lado comprador lleva una barra cediendo. La cabecera solo pasa a Mixed si la siguiente barra coincide, y esa barra de un minuto de antigüedad todavía puede cambiar antes de cerrar.

**Estructura.** Stability está en Flat: el cambio de 30 minutos en la gamma cercana al precio está dentro de 50 millones de dólares en cualquier dirección. Lean está en Supportive. La etiqueta del gráfico dice Fragile bid para esas mismas dos lecturas, porque separa en cero y Stability está apenas por debajo, mientras que Lean está apenas por encima. Gamma trend está en Thinning: la gamma cercana al precio se ha adelgazado desde la apertura. Las líneas de estructura hicieron sus mayores movimientos cuando los hizo el precio, con ambas por debajo de −1.200 millones de dólares en el mínimo de las 10:50 y Stability cerca de +1.350 millones de dólares en el máximo de las 12:25. Eso encaja con un libro fijo que se revalúa a medida que el precio lo atraviesa.

**Flip cushion.** SPY está unos 3 puntos por debajo del gamma flip modelado, en Secure y ensanchándose despacio. Por debajo del flip está el lado que nuestra [guía del gamma flip](/education/how-to-read-a-gamma-flip) describe como generalmente de gamma corta, donde la cobertura tiende a amplificar los movimientos, y "Secure" dice que el precio necesitaría más que el rango de una media hora típica para alcanzar el flip. No dice que las condiciones estén tranquilas. Weather lee el cambio del libro en la última media hora; el colchón lee en qué régimen está el precio. Aquí apuntan en direcciones distintas: un titular Stable bid, en el régimen que amplifica.

**En conjunto:** un día de fuertes ventas de cobertura estimadas, más visibles en la caída de finales de la mañana, de las que el precio se ha recuperado por completo desde entonces; un empuje que pasó a compra a las 14:45 y ya flaqueaba a las 14:55; una estructura cercana al precio que ahora está plana y más delgada que en la apertura; y el precio cómodamente en el lado del flip que amplifica. Es una lectura muy distinta de "−4.760 millones de dólares, así que bajista".

---

## Cómo usarlo

Hedging Flow funciona mejor como contexto para una idea de trading, no como la idea en sí.

Toma una prueba de un put wall. Con Pressure now en Buying, Stability en Pinning y el colchón ensanchándose, esa prueba ocurre en un entorno muy distinto al del mismo wall puesto a prueba con presión Selling, Stability en Accelerative y un colchón estrecho y cerrándose. El nivel no cambió. Las condiciones a su alrededor, sí. Lo mismo vale para el VWAP, el rango de apertura, el gamma flip y los call y put walls.

La página encaja en una secuencia sencilla:

1. **¿Dónde están los niveles?** Los niveles gamma de ZeroGEX responden a eso.
2. **¿Hacia dónde está empujando ahora mismo el tape de opciones?** Hedging Flow.
3. **¿Es probable que la estructura en torno al precio absorba ese empuje o lo amplifique?** Dealer gamma structure y Gamma Weather.

Hedging Flow también es distinto de Forced Flow, aunque los dos comparten unidades y convención de signo. Hedging Flow lee las operaciones de hoy y dice qué presión crearon. Forced Flow lee el libro vigente y se pregunta qué presión crearía ante un movimiento del precio, del tiempo o de la volatilidad.

---

## Una nota sobre el interruptor 0DTE only

El interruptor **0DTE only** limita la parte de flujo de la página a los contratos que vencen ese día: las cuatro tarjetas, el gráfico de flujo, sus marcadores e insignia de flips, y el gráfico dentro del panel desplegable de Pressure now. El titular y los chips de Gamma Weather y el gráfico de Dealer gamma structure no cambian. Siempre leen todos los vencimientos monitorizados, porque la estructura es una propiedad de todo el libro, y eso incluye la presión que hay detrás del chip Pressure now.

Para la referencia página por página, consulta la [página de ayuda de Hedging Flow](/help/platform/hedging-flow). Para la mecánica que hay detrás, consulta [Por qué los market makers operan en acciones](/education/why-market-makers-trade-stock), [¿Qué es un gamma flip?](/education/how-to-read-a-gamma-flip) y [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

Solo contenido educativo - nada de lo anterior es una recomendación de trading.
