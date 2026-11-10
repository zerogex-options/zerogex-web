# Delta y sus tres hijos

*Delta le indica a un dealer cuántas acciones mantener. Pero delta nunca se queda quieto - y sus tres grandes impulsores son el precio, el tiempo y la volatilidad. Esas tres sensibilidades son gamma, charm y vanna. La mayor parte del flujo forzado de los dealers que aparece en el tape es uno de los tres hijos de delta viniendo a cobrar.*

---

## Empezamos por el hedge ratio

Delta es el número más importante de una opción y, a la vez, el menos interesante. Es simplemente el hedge ratio: la cantidad de acciones que se comportan, en este momento, como un contrato de opción. Una call con delta 0,55 se mueve como 55 acciones; una put con delta −0,30 se mueve como 30 acciones en corto. Un dealer que no quiere exposición direccional mantiene la acción compensatoria, y el book queda plano.

Si delta fuera una constante, la historia terminaría ahí. Se cubriría una vez y nunca más se tocaría. Pero delta es una derivada - la tasa de cambio del valor de la opción respecto al spot - y las derivadas son a su vez funciones del mundo. Cambia el mundo y delta cambia. El trabajo continuo del dealer, y toda la fuente de flujo de dealer legible, consiste en perseguir delta mientras se mueve.

Así que la pregunta que realmente importa no es "qué es delta" sino "qué hace que delta se mueva". Tres impulsores hacen la mayor parte del trabajo.

---

## Las tres formas en que delta puede moverse

Entre el momento en que un dealer establece una cobertura y el momento en que la opción vence, tres variables de mercado se mueven de forma más o menos continua, y cada una arrastra a delta consigo:

1. **El precio de la acción cambia.** La sensibilidad de delta al spot es **gamma** (∂Δ/∂S).
2. **El tiempo pasa.** La sensibilidad de delta al tiempo es **charm** (∂Δ/∂t).
3. **La volatilidad implícita cambia.** La sensibilidad de delta a la vol es **vanna** (∂Δ/∂σ).

Esa es la familia esencial. Gamma, charm y vanna son las derivadas de primer orden de delta respecto a las tres variables que más se mueven bajo un book cubierto. Los traders las memorizan como greeks separadas con nombres exóticos; se entienden mejor como una sola idea - *cómo se mueve delta* - dividida en tres según *qué lo movió*.

No son literalmente lo único que desplaza a delta. Los tipos de interés, los dividendos y los costes de préstamo, los cambios en la forma de la superficie de vol y la propia rotación del book - nuevas operaciones de clientes, cierres, ejercicio y asignación, posiciones compensatorias - también empujan a delta. Pero esos factores son lentos, pequeños o discretos, mientras que el precio, el tiempo y la vol se mueven de forma continua durante toda la sesión. Por eso estos tres generan la mayor parte del flujo de cobertura constante y legible, y por eso son los hijos que vale la pena nombrar.

Este es el modelo mental más limpio del flujo de los dealers: un dealer no cubre el delta, un dealer cubre el **cambio** del delta. Y tres canales transportan la mayor parte de ese cambio. Nombra el canal y habrás nombrado el flujo.

---

## Gamma: delta se mueve porque el precio se movió

Gamma es la que todos conocen. Cuando la acción sube, los deltas de las calls suben y los deltas de las puts suben hacia cero; cuando baja, caen. Gamma es la velocidad a la que ocurre esto. Un book con gamma alta se recubre con fuerza en cada tick; un book con gamma baja apenas reacciona.

La característica definitoria del flujo de gamma es que es **reactivo**. No pasa nada hasta que el precio se mueve. El spot está quieto, gamma está en silencio. Luego el mercado se mueve un 0,5% y el dealer debe operar un bloque de acciones para volver a aplanar la posición - comprando en un rally y vendiendo en una caída si está corto de gamma, haciendo lo contrario si está largo de gamma. Este es el flujo detrás del gamma flip, el pinning y el squeeze, y se trata en profundidad en el [pilar de Gamma Exposure](/education/gamma-exposure-explained).

Gamma es el hijo más ruidoso. También es el único que necesita un movimiento del spot para hablar. Los otros dos son más inquietantes, porque fuerzan operaciones incluso cuando no está pasando absolutamente nada.

---

## Charm: delta se mueve porque el tiempo pasó

Charm es la sensibilidad de delta al paso del tiempo. Una opción fuera del dinero vale algo hoy solo porque todavía queda tiempo para que el spot la alcance; a medida que ese tiempo se agota, su delta se desangra hacia cero. El delta de una opción dentro del dinero, mientras tanto, se afianza hacia 1. Delta está estrechamente ligado a - aunque no equivale exactamente a - la probabilidad de vencer dentro del dinero, y a medida que se acerca el vencimiento esa probabilidad implícita tiene que resolverse hacia un sí o un no claro. La deriva mientras se resuelve *es* charm.

La parte inquietante: charm obliga a cubrir posiciones con el spot perfectamente clavado en su sitio. El reloj es un trader. Un dealer puede observar la cinta sin que pase absolutamente nada durante una hora y aun así verse obligado a vender acciones todo ese tiempo, porque los deltas del book se están decayendo en silencio y la cobertura tiene que reducirse en consecuencia. En una cadena con mucho peso de 0DTE, este flujo se concentra violentamente en la última hora, cuando la tasa de decaimiento alcanza su máximo. [Charm: el reloj es un trader](/education/charm-the-clock-is-a-trader) ofrece el tratamiento completo.

---

## Vanna: delta se mueve porque el miedo se movió

Vanna es la sensibilidad de delta a la volatilidad implícita. Subir el miedo que el mercado tiene incorporado en el precio engorda la distribución de resultados posibles, arrastrando los deltas fuera del dinero hacia el medio; bajarlo afina la distribución, empujándolos de vuelta hacia su valor intrínseco de 0 o 1. Así que un cambio en la vol reprecia el delta de cada opción sin que el spot se mueva un centavo.

Vanna mide la sensibilidad de delta a la volatilidad implícita. Bajo la convención de inventario modelada, una caída de la IV puede generar presión compradora sobre el subyacente en algunas configuraciones de la cadena, pero el signo depende de la propiedad, el tipo de opción, la moneyness, el vencimiento, el skew y el movimiento de la superficie. [Vanna: cómo la caída de la IV puede cambiar la cobertura de los dealers](/education/vanna-when-fear-fades) explica el mecanismo condicional.

---

## Por qué no se pueden simplemente sumar

Un atajo tentador: calcular el flujo de cada greek por separado y sumarlos. Flujo de gamma más flujo de charm más flujo de vanna es igual al flujo forzado total. Es una buena primera aproximación y una mala respuesta final, porque los tres hijos interactúan.

La propia gamma cambia a medida que pasa el tiempo y se desplaza la vol. El charm que se tiene con el spot de hoy no es el charm que se tiene tras un movimiento del 2%. Un escenario que combina un movimiento del spot, una tarde de decaimiento y una caída de la vol no es la suma de los tres efectos calculados de forma aislada - los términos cruzados son reales y, cerca del vencimiento, grandes. Sumar las greeks es una expansión de Taylor, y las expansiones de Taylor se desmoronan justo donde está la acción: cerca del dinero, cerca del vencimiento, donde la superficie se curva con más fuerza.

La forma honesta de calcular el flujo forzado es **repreciar por completo el book** bajo el nuevo escenario, leer el delta del dealer en ese nuevo estado y tomar la diferencia respecto al delta actual. Las greeks se vuelven entonces útiles para la *atribución* - indicar cuánto de la operación obligada correspondió a gamma, cuánto a charm y cuánto a vanna -, pero el total proviene de la repreciación, no de la suma. Esto es exactamente lo que hace la curva de repreciación en vivo de [Forced Flow](/forced-flow): mueve el spot a lo largo de una grilla, reprecia cada contrato y lee directamente la cobertura obligada. La división gamma/charm/vanna se dibuja como bandas de atribución debajo, para que se vea tanto el total como qué hijo lo está impulsando.

---

## La versión de una frase

Delta es un hedge ratio que no quiere quedarse quieto. Se mueve con el precio (gamma), con el tiempo (charm) y con la volatilidad (vanna) - las tres variables que se mueven de forma continua e impulsan la mayor parte del flujo. La mayoría de las operaciones forzadas de los dealers en el mercado son una de esas tres sensibilidades tirando del book fuera de su cobertura y exigiendo una operación en la acción para restablecerla, mientras que los tipos de interés, los dividendos y la propia rotación del book completan los márgenes.

Aprende al padre y a los tres hijos, y el flujo del dealer deja de ser un misterio y se convierte en un problema de contabilidad. Para los fundamentos de toda esta idea, consulta [Por qué los market makers se ven obligados a operar acciones](/education/why-market-makers-trade-stock).

Solo contenido educativo - nada de lo anterior es una recomendación de trading.
