# Pin Strike explicado: el pin de gamma 0DTE alcanzable
> **Nota metodológica actualizada — prevalece sobre cualquier formulación incompatible posterior.** ZeroGEX estima, pero no observa, el inventario de los dealers a partir de datos públicos. El modelo conserva la convención calls positivos/puts negativos (`Net GEX = Call GEX − Put GEX`) y supone dealers netos largos de calls y cortos de puts. Las calls y puts largas tienen gamma positiva; las calls y puts cortas tienen gamma negativa. El Put Wall es la mayor concentración de gamma de puts por debajo del spot y representa localmente gamma negativa modelada del dealer: puede coincidir con soporte, pero la cobertura de una put corta no crea mecánicamente un suelo. Los walls pueden migrar por spot, tiempo y volatilidad implícita aunque el open interest oficial no cambie intradía. Al acercarse el vencimiento, la gamma se concentra cerca del ATM: la gamma ATM puede aumentar, mientras la gamma claramente ITM u OTM tiende a cero. El Gamma Flip seleccionado es una transición local; el perfil puede tener varios cruces o ninguno significativo. Charm y vanna son cambios condicionales de delta, no órdenes programadas. Las puntuaciones son resultados heurísticos, no probabilidades calibradas. La gamma negativa amplifica la dirección ya iniciada; la distancia a un objetivo no implica repulsión. Por ello, la inversión del término pin de EOD Pressure sigue siendo una heurística de ZeroGEX. Max Pain minimiza el pago intrínseco agregado y no maximiza exactamente el nocional que vence sin valor. El DEX bruto mide delta solo de opciones, no flujo futuro de cobertura; la prima y el lado agresor no prueban información, apertura ni convicción.


*Pin Strike es el strike 0DTE alcanzable con la mayor estabilización modelada por gamma positiva del dealer hacia el vencimiento. Qué es, cómo se construye, por qué deliberadamente no es "el strike de mayor gamma" y por qué se le permite no devolver ningún pin activo.*

---

## El problema que Pin Strike intenta resolver

Hacia las últimas horas de una sesión 0DTE, una pregunta domina el tape: *si el precio deriva, ¿dónde quiere asentarse?* Los traders echan mano de un batiburrillo de niveles para responderla — el call wall, el put wall, el max pain, el strike de mayor gamma — y cada uno responde a una pregunta ligeramente distinta, ninguno exactamente a la que se plantea.

Pin Strike es una respuesta diseñada a propósito para esa pregunta concreta. Estima el strike cercano con la combinación más fuerte de dos cosas:

1. **Gamma estabilizadora del dealer *en ese strike*** — ¿la cobertura del dealer allí se inclinaría *en contra* de los movimientos (devolviendo el precio hacia atrás)?, y
2. **Alcanzabilidad** — ¿puede el precio, de forma realista, llegar a ese strike y terminar cerca de él antes del cierre 0DTE?

Ambas mitades importan, y la segunda es la que hace que Pin Strike se diferencie de cualquier otro nivel del tablero. Un strike puede cargar con una huella de gamma enorme y aun así ser un pésimo candidato a pin si el precio no tiene ninguna posibilidad realista de alcanzarlo hacia la campana. Pin Strike está construido para relegar a esos gigantes inalcanzables y hacer aflorar el nodo alcanzable en torno al cual el precio puede realmente organizarse.

Si eres nuevo en la mecánica subyacente, el [pilar de Gamma Exposure](/education/gamma-exposure-explained) cubre cómo la gamma del dealer impulsa la cobertura, [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip) cubre la línea de régimen, y [Max Pain explicado](/education/max-pain-explained) cubre la idea del imán de liquidación con la que a menudo se confunde Pin Strike. Este artículo da por supuesto ese contexto y construye sobre él.

---

## ¿Qué es un pin, mecánicamente?

Un "pin" es un equilibrio autorreforzante creado por la cobertura delta de los dealers en un entorno de **gamma positiva**. Vale la pena enunciar el mecanismo con precisión, porque Pin Strike es un intento directo de medirlo.

Cuando los dealers están net long gamma en torno a un strike, su cobertura es *estabilizadora*: a medida que el precio sube hacia el strike deben vender el subyacente, y a medida que cae hacia él deben comprar. Esa cobertura se inclina en contra del movimiento por ambos lados — es una fuerza de restitución que devuelve el precio hacia el nodo y amortigua la volatilidad realizada a su alrededor. Cuanto más pesada y concentrada esté esa gamma positiva, más fuerte es la fuerza de restitución, y más tiende el precio a quedar "atascado" cerca del strike hacia el vencimiento.

El régimen opuesto importa igual. Cuando los dealers están net *short* gamma en torno a un nivel, la cobertura es *desestabilizadora* — venden en la debilidad y compran en la fortaleza, amplificando los movimientos en lugar de amortiguarlos. Un entorno de gamma corta no puede hacer pin; hace lo contrario. Por eso la materia prima de un pin es específicamente **gamma del dealer localmente concentrada y neta positiva** — no gamma en general, ni gamma en otro lugar de la cadena.

Una advertencia honesta de entrada, la misma que se aplica a toda lectura de posicionamiento de dealers en la plataforma: el signo de la gamma del dealer es una **convención modelada**, no un hecho directamente observado. El open interest público no revela si los dealers están largos o cortos en un contrato dado. ZeroGEX utiliza la convención estándar de estilo SPX — dealers modelados como largos en las calls que los clientes hacen overwriting (gamma positiva) y cortos en las puts que los clientes compran (gamma negativa) — y Pin Strike reutiliza esa misma convención en lugar de inventar una segunda. Es un modelo de posicionamiento, y se describe en todo momento como lo que la cobertura *tiende* a hacer, nunca como una garantía.

---

## La idea clave: valorar el libro *como si el spot estuviera en el strike*

Este es el movimiento conceptual que hace que Pin Strike funcione, y el que la mayoría de las herramientas de niveles se saltan.

La gamma no es una propiedad fija de un strike. La gamma de un contrato depende de dónde esté el spot *ahora mismo* en relación con ese strike — alcanza su máximo cuando la opción está at-the-money y decae a medida que se mueve dentro o fuera del dinero. Así que la gamma que un strike muestra *hoy, al precio actual* te dice cuánto está contribuyendo ese strike a la cobertura **aquí**. **No** te dice cuánta fuerza estabilizadora existiría **allí**, si el precio viajara realmente hasta ese strike.

Pero "allí, si el precio viajara hasta él" es exactamente la cuestión de la que trata un pin. Un pin es un hipotético: *si el precio llegara al strike K, ¿lo sostendría el libro?*

Por eso Pin Strike responde al hipotético directamente. Para cada strike candidato `K`, **simula todo el libro de opciones como si el spot estuviera situado en `K`** y revalúa la gamma de cada contrato en ese spot hipotético usando la misma gamma de Black-Scholes que utiliza el resto de la plataforma. Después le asigna signo y la escala hasta obtener la gamma en dólares del dealer con la convención canónica de la plataforma:

```
GEX_i(K) = dealer_sign_i × gamma_i_at_K × OI_i × 100 × K² × 0.01
```

Léelo con atención: el spot en la fórmula de gamma en dólares es el propio `K` (de modo que la escala `S²` se convierte en `K²`), porque estamos valorando el mundo en el que el spot *es* `K`. `dealer_sign_i` es `+` para las calls y `−` para las puts (la convención modelada anterior), `OI_i` es el open interest, `100` es el multiplicador del contrato, y el `× 0.01` final lo sitúa todo sobre la base estándar del sector de "dólares de cobertura por movimiento del 1%". Es la misma convención de GEX que se usa para los walls y el gamma flip — Pin Strike no introduce una definición competidora de gamma del dealer; simplemente evalúa la existente en un spot distinto e hipotético.

Esta es la clave de por qué Pin Strike es una métrica genuinamente distinta y no una lectura del mayor GEX reempaquetada: se construye sobre gamma *contrafactual* (lo que el libro sería en K), no gamma *actual* (lo que el libro es ahora).

---

## Gamma de restitución local: un pin es un entorno, no un total de la cadena

Un pin es una característica *local*. Tiene que ver con la gamma agrupada justo alrededor de un strike, no con la gamma agregada de toda la cadena, y desde luego no con gamma situada a cientos de puntos de distancia. Así que para cada `K` candidato, Pin Strike pondera la contribución de cada contrato según lo cerca que esté el strike de ese contrato de `K`, usando un kernel gaussiano:

```
kernel(K, strike_i) = exp( −(strike_i − K)² / (2 × bandwidth²) )
```

Los contratos situados justo en `K` cuentan por completo; los contratos a unos pocos strikes de distancia cuentan menos; los contratos lejanos no aportan prácticamente nada. Sumar el GEX del dealer ponderado por el kernel da la **gamma local** en `K`:

```
local_gex(K) = Σ  GEX_i(K) × kernel(K, strike_i)
```

El `bandwidth` — cuán ancho es lo "cercano" — no está codificado de forma rígida, porque las rejillas de strikes difieren entre productos (SPY y QQQ cotizan strikes con separación de un dólar cerca del dinero, SPX cotiza cada cinco puntos, y NDX aún más grueso). Pin Strike deriva el ancho de banda a partir del **espaciado mediano de los strikes cotizados cercanos**, de modo que el kernel se escala automáticamente a cualquier producto que esté observando. Es un parámetro configurable, no un número mágico.

Luego, el paso decisivo. Solo una gamma local *positiva* puede hacer pin:

```
restoring_gex(K) = max( local_gex(K), 0 )
```

Si el entorno alrededor de `K` es de gamma del dealer neta corta — una zona desestabilizadora que amplifica los movimientos — su puntuación de restitución es cero. No es un pin débil; *no es un pin en absoluto*, y se puntúa en consecuencia. Este único `max(·, 0)` es lo que codifica la física: los pines están hechos de gamma positiva, y punto.

---

## Alcanzabilidad: por qué el nodo más grande no gana automáticamente

La gamma de restitución local te dice cuán *fuerte* sería un pin si el precio llegara ahí. No dice nada sobre si el precio *puede* llegar ahí. La distancia es la mitad que falta.

Considera una sesión en la que el spot está en 772 y hay un colosal nodo de gamma positiva en 820. Ese nodo podría tener diez veces la gamma de restitución de un nodo modesto en 773 — pero con unas pocas horas restantes en la sesión y la volatilidad donde está, 820 está esencialmente fuera de alcance. Tratarlo como el pin sería un disparate. El precio no va a organizarse en torno a un nivel al que no puede viajar antes del cierre.

Por eso Pin Strike multiplica la gamma de restitución de cada candidato por un **peso de alcanzabilidad** derivado de lo lejos que está el strike, medido en las propias unidades de "movimiento esperado" del mercado. Usando el spot actual, una volatilidad implícita representativa y el tiempo *real* restante hasta el vencimiento:

```
z(K)            = ln(K / spot) / (σ × √τ)
reachability(K) = exp( −½ × z² )
```

`z` es la distancia logarítmica al strike expresada en desviaciones estándar de la distribución del precio terminal — el número de movimientos esperados a los que se sitúa. `reachability` es la densidad gaussiana (sin normalizar) a esa distancia: es `1.0` para un strike justo en el spot y decae suavemente hacia cero a medida que el strike se aleja más de lo que la volatilidad y el tiempo pueden llevar plausiblemente al precio. Como la distancia se mide en unidades de `σ√τ`, la misma fórmula funciona de forma idéntica en SPY, QQQ, SPX y NDX sin constantes en dólares específicas por símbolo.

Dos entradas de esa fórmula merecen énfasis, porque son donde la alcanzabilidad demuestra su valía:

- **`σ` es una volatilidad implícita at-the-money representativa**, tomada de las propias opciones 0DTE cercanas al dinero (la misma base de IV ATM que la plataforma usa en otros lugares). No es un valor por defecto inventado — si no hay una IV ATM utilizable, no se puede confiar en la alcanzabilidad y la métrica se niega a producir un pin en lugar de inventar un número.
- **`τ` es el tiempo *intradía real* restante hasta la liquidación 0DTE**, en años — segundos hasta el cierre, no un perezoso `1/365`. Esto importa enormemente para 0DTE: a las 10:00 a.m. un strike a cinco puntos de distancia es muy alcanzable; a las 3:45 p.m. el mismo strike puede estar a varios movimientos esperados de distancia. La alcanzabilidad se desploma a medida que se agota el reloj, exactamente como lo hace un pin real hacia el vencimiento.

---

## Juntándolo todo: la puntuación de pin

Cada strike candidato recibe una única puntuación — el producto de las dos mitades:

```
pin_score(K) = restoring_gex(K) × reachability(K)
```

Un strike gana solo siendo **a la vez** un nodo de gamma positiva fuerte **y** alcanzable de forma realista. Un nodo enorme pero inalcanzable puntúa cerca de cero (la alcanzabilidad lo mata). Un strike perfectamente alcanzable pero sin gamma local positiva puntúa exactamente cero (la gamma de restitución lo mata). El Pin Strike es el strike cotizado con el `pin_score` máximo.

Los candidatos se restringen de antemano a strikes situados dentro de aproximadamente un par de movimientos esperados del spot — los únicos strikes con alcanzabilidad significativa — de modo que la simulación se mantiene barata y ni siquiera considera la cola lejana. Y solo se devuelven **strikes efectivamente cotizados**, de modo que el Pin Strike es siempre un contrato real y cotizable.

Junto al strike, Pin Strike informa de una **confianza** — cuán dominante es el ganador sobre los demás pines viables:

```
pin_confidence = max_pin_score / Σ (all positive pin_scores)
```

Una confianza cercana a 1.0 significa que un nodo posee de forma abrumadora el paisaje de gamma positiva alcanzable — un pin limpio y singular. Una confianza baja significa que varios candidatos comparables están compitiendo, y es más probable que el precio oscile entre ellos a que se fije en uno. La puntuación máxima bruta también se conserva, porque la concentración por sí sola puede inducir a error cuando *todas* las puntuaciones son diminutas — un pin "dominante" entre candidatos insignificantes sigue siendo insignificante.

---

## Por qué Pin Strike no es los demás niveles

Pin Strike pertenece a una familia de niveles de posicionamiento de dealers, y todo su valor reside en ser genuinamente distinto de cada uno de ellos. Las diferencias no son cosméticas:

- **Call Wall / Put Wall** — los strikes por encima y por debajo del spot con la mayor gamma *actual* de calls/puts de un solo lado. Marcan las concentraciones dominantes de resistencia y soporte al precio de *hoy*. Pin Strike no trata de la mayor concentración de un solo lado ni se mide al precio de hoy — trata de la estabilización local *neta* evaluada en cada strike candidato como si el precio estuviera ahí. Consulta [Gamma Walls explicado](/education/gamma-walls-explained).

- **Gamma Flip** — el spot hipotético en el que la gamma *agregada* del dealer cambia de signo; la frontera entre los regímenes estabilizador y desestabilizador para todo el libro. El flip es una línea de régimen; Pin Strike es un imán específico *dentro* de un régimen estabilizador. (De hecho, si el spot se sitúa por debajo del flip, en territorio de gamma neta corta, Pin Strike a menudo no encontrará nada a lo que hacer pin — que es la respuesta correcta.) Consulta [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip).

- **Max Pain** — el strike de liquidación que minimiza el pago intrínseco agregado a los tenedores de opciones. Usa solo el open interest y los strikes — sin griegas, sin volatilidad, sin signo de dealer, y sin noción de alcanzabilidad ni de *cómo* se cubren los dealers. Es un nivel de contabilidad de pagos. Pin Strike es un nivel de mecánica de cobertura. Con frecuencia discrepan, y cuando coinciden suele ser porque una gamma pesada y un OI pesado resultan coincidir. Consulta [Max Pain explicado](/education/max-pain-explained).

- **King Node / strike de mayor GEX** — simplemente el strike con la mayor gamma en dólares *actual*. Este es aquel con el que más a menudo se confunde Pin Strike, y el peso de alcanzabilidad es precisamente lo que los separa. **Pin Strike deliberadamente no selecciona el strike de mayor GEX.** El King Node ignora si el precio puede alcanzarlo e ignora si el nodo es netamente estabilizador; Pin Strike está construido para relegar a un gigante inalcanzable o de gamma corta en favor de un nodo alcanzable de gamma positiva. Cuando ambos coinciden, es porque la gamma dominante además resulta estar cerca del spot y ser estabilizadora — una confirmación significativa, no una redundancia.

La versión de una línea: **los walls son concentración, el flip es una frontera de régimen, el max pain es un mínimo de pagos, el King Node es tamaño bruto — y Pin Strike es estabilización local, neta positiva y alcanzable hacia el vencimiento.**

---

## Por qué solo 0DTE, y por qué open interest

Merece la pena explicitar dos decisiones de alcance.

**Pin Strike es una métrica 0DTE.** Usa solo el vencimiento del mismo día más cercano y no mezcla gamma de semanales, mensuales ni de vencimientos más largos. Es deliberado: un pin es un fenómeno *hacia el cierre*. La gamma del mismo día es la que se resuelve hoy, su ventana de alcanzabilidad se mide en horas, y su perfil de gamma `1/√τ` se agudiza drásticamente hacia la campana — que es exactamente el régimen en el que el pinning es un comportamiento real y observable. La gamma de vencimientos más largos es un telón de fondo estructural, no un imán intradía, y mezclarla difuminaría el mismísimo efecto que la métrica intenta aislar. Por tanto, Pin Strike es una lectura intradía y hacia el vencimiento — no un nivel estructural amplio de opciones.

**Pin Strike usa la misma base de open interest que el motor central de GEX.** No intenta ajustar el posicionamiento usando el flujo intradía — sin inferencia de apertura frente a cierre, sin reponderación en vivo del OI. Ese tipo de ajuste por flujo introduce una incertidumbre adicional real y es un problema aparte; incorporarlo al pin haría más difícil confiar en la métrica, no más fácil. El pin que ves se construye sobre la misma base de posicionamiento que cualquier otra lectura de gamma del dealer en la plataforma, lo que lo mantiene consistente e interpretable.

---

## Cuándo entra en juego Pin Strike

Pin Strike es más informativo en una ventana y un régimen específicos, y menos informativo fuera de ellos:

- **Al final de una sesión 0DTE, en un régimen de gamma positiva.** Este es su terreno. Cuando el spot está por encima del gamma flip y existe un nodo de gamma positiva alcanzable, el Pin Strike marca dónde se concentra la cobertura estabilizadora, y el precio a menudo revierte a la media a su alrededor hacia el cierre. Se lee mejor como *el centro de gravedad del rango de pinning actual*, enmarcado por los walls.

- **Como un nivel de contexto, no un objetivo.** Un Pin Strike es un imán modelado, no una predicción de que el precio vaya a cotizar ahí. Tiende a describir dónde se organiza un rango, con cuánta firmeza y con cuánta confianza (mediante la puntuación de confianza) — no un destino garantizado ni una señal de timing. Es contexto para una decisión, nunca una decisión.

- **Léelo junto con la confianza y los walls.** Un pin de alta confianza situado entre un call wall firme y un put wall firme es una imagen de pinning coherente y bien definida. Un pin de baja confianza, o un pin con los walls lejanos, es una imagen mucho más difusa. El número solo es tan significativo como la estructura que lo rodea.

Y, algo crucial, reconoce cuándo *nada* de eso se aplica — que es el tema de la última sección.

---

## Cuándo Pin Strike es nulo — y por qué lo elegimos así

Esta es la parte que más distingue a Pin Strike de una herramienta ingenua de "strike pesado más cercano": **se le permite, y se espera, que no devuelva ningún pin activo.** Una herramienta que siempre imprime un nivel es fácil de construir y fácil de malinterpretar — fabrica falsa confianza precisamente los días en que no hay nada a lo que hacer pin. Pin Strike hace lo más difícil y más honesto: cuando no hay un pin de gamma positiva significativo, no devuelve nada, y te dice *por qué*.

Cuando no hay pin activo, la métrica informa de una de las siguientes razones:

- **Sin vencimiento 0DTE** — no hay ningún vencimiento del mismo día cotizado para el subyacente. Sin una cadena 0DTE, no hay nada sobre lo que pueda tratar un pin intradía.
- **Vencido** — el instante de liquidación 0DTE ya ha pasado (tiempo hasta el vencimiento ≤ 0), p. ej. tras el cierre de contado. La alcanzabilidad no está definida una vez que las opciones han liquidado.
- **Sin gamma de restitución positiva** — el algoritmo se ejecutó, pero ningún candidato alcanzable tiene gamma del dealer local neta positiva. Este es el nulo significativo y no degenerado: el precio está en un entorno de gamma corta donde la cobertura es desestabilizadora, así que *nada hace pin*. Forzar un nivel aquí sería activamente engañoso — señalaría un strike que mecánicamente empuja el precio a *alejarse*, no a acercarse.
- **Datos de IV insuficientes** — no hay una volatilidad implícita at-the-money utilizable para anclar el cálculo de alcanzabilidad, de modo que no se puede confiar en las distancias. No se sustituye por ninguna volatilidad por defecto arbitraria.
- **Datos de opciones insuficientes** — no hay datos válidos de opciones 0DTE (no hay spot, o no hay contratos con open interest, IV, tiempo y strike utilizables), de modo que no hay nada que modelar.
- **Puntuación de pin demasiado débil** — un suelo de magnitud opcional que suprime un pin cuya puntuación bruta es insignificante. Está desactivado por defecto, así que solo se dispara cuando se configura explícitamente — la plataforma no inventa umbrales de cara al usuario.

Dos casos más, cotidianos, aparecen como un pin vacío sin código de razón: **los fotogramas de reproducción histórica** escritos antes de que Pin Strike se lanzara simplemente no llevan valor (la línea se omite, y no se rellena nada retroactivamente), y el **gráfico de gamma en vivo oculta el pin durante el rebobinado temporal**, porque el pin es un valor de nivel de resumen que no se reconstruye para el búfer de rebobinado por minuto.

El principio de diseño que subyace a todo esto: **un "sin pin" honesto es más útil que uno forzado.** Una sesión de gamma negativa, en tendencia o con el vencimiento ya pasado genuinamente no tiene ningún pin de gamma, y la salida correcta en esos estados es el silencio — no el strike más cercano disfrazado de imán. La métrica hace aflorar exactamente cuál de las condiciones anteriores se aplica, de modo que un "—" nunca es ambiguo: es una afirmación específica e inspeccionable sobre el mercado, no un hueco en los datos. En la interfaz esto siempre se muestra como un guion — nunca un `0`, un `NaN`, o un strike de reserva engañoso.

---

## Cómo leerlo en una frase

Pin Strike es el strike 0DTE alcanzable en el que revaluar el libro en ese strike produce la gamma del dealer localmente concentrada, neta positiva (estabilizadora) más fuerte hacia el vencimiento — un centro de gravedad modelado para un rango de pinning hacia el cierre, informado con una confianza y, cuando el mercado no ofrece tal nodo, deliberadamente informado como nada en absoluto.

Para verlo en vivo junto con los walls, el flip y el max pain, abre [los niveles de gamma de SPX / SPY / QQQ / NDX de hoy](/spx-gamma-levels) y observa cómo se comporta el Pin Strike hacia la hora final — y fíjate en las sesiones en las que se queda en silencio.
