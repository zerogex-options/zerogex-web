# Guía ZeroGEX™: Señales, Explicadas

*Todas las señales de ZeroGEX en una sola página — qué pregunta cada una, el horizonte temporal que lee, cuándo se dispara y qué significa realmente una puntuación positiva, negativa o cero.*

---

## Cómo leer esta guía

ZeroGEX opera con dos familias de señales, y por diseño se comportan de forma distinta.

Las **señales Advanced** responden a una pregunta concreta y situacional ("¿se está fijando el cierre?", "¿acaba de fallar este breakout?"). Cada una produce una puntuación en una línea numérica **[-1, +1]** *y* un **trigger** discreto: en cuanto la puntuación cruza el umbral de la señal, dispara una alerta y puede habilitar un playbook. Son señales impulsadas por eventos.

Las **señales Basic** son continuas. No "se disparan" — en su lugar alimentan el **compuesto MSI** con un peso fijo, empujando la lectura combinada hacia arriba o hacia abajo en cada actualización. Se ven como inputs para el panorama general, no como alertas independientes.

Antes de pasar a las tablas, conviene interiorizar tres cosas:

- La línea de puntuación siempre es **[-1, +1]**. El signo indica dirección; la magnitud indica convicción.
- Una puntuación de **0 casi nunca significa "mercado neutral".** Para la mayoría de las señales significa que *los datos son insuficientes* o que *esta pregunta concreta no tiene respuesta en este momento*. No interpretes un 0 como luz verde.
- Las señales Advanced **disparan**; las señales Basic **ponderan**. Por eso ves alertas estilo "BULLISH FADE" en algunas señales y nunca en otras.

---

## La versión de 30 segundos

Qué pregunta cada señal, hacia qué sesgo se inclina, la ventana que lee, los inputs principales que la impulsan y cómo se manifiesta.

### Señales Advanced

| Señal | Pregunta | Trade Bias | Timeframe | Inputs Principales | Trigger / Output |
| --- | --- | --- | --- | --- | --- |
| EOD Pressure | "¿Se está fijando el cierre?" | Lectura direccional | Últimos 90 min (aumenta 14:30–15:45 ET) | Charm del dealer en el spot, gravedad de pin, volatilidad realizada, flags de witching | Puntuación [-1, +1]; se dispara con abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | "¿Se están apilando aquí niveles clave?" | Mean-rev (long gamma) / Continuation (short gamma) | Intradía continuo | Gamma flip, VWAP, max pain, strike de max-gamma, call wall | Puntuación [-1, +1]; se dispara con abs(score) ≥ 0.20 |
| Market Pressure | "¿Está el mercado cargado para moverse, y hacia dónde romperá?" | Continuation | Prospectivo; mezcla vanna→charm ponderada por sesión | Wall pinch, proximidad al flip, régimen de net-GEX, vanna/charm del dealer, DNI, sesgo entre premium y flow de smart-money, IV rank, squeeze de vol realizada | Puntuación [-1, +1] más loading 0–100; se dispara con loading ≥ 50 Y \|direction\| ≥ 0.20 |
| Range Break Imminence | "¿Está este rango a punto de romperse?" | Cambio de régimen / playbook | Ventana de 20 barras | Skew delta, delta del dealer, trap pressure, ratio de compresión 10/60 barras | Puntuación [-1, +1] más imminence 0–100; se dispara con imminence ≥ 65 |
| Squeeze Setup | "¿Está el mercado enroscado?" | Continuation | Setup multi-día | Z-score del flow, momentum de 5/10 barras, gamma readiness, distancia al flip, régimen de VIX | Puntuación [-1, +1]; se dispara con abs(score) ≥ 0.25 |
| Trap Detection | "¿Acaba de fallar este breakout?" | Mean-reversion (vs. rotura del precio) | De intradía a overnight | Walls (actuales + previos), VWAP, flip, net GEX y ΔGEX, deltas de flow | Puntuación [-1, +1]; se dispara con abs(score) ≥ 0.25 |
| Vol Expansion | "¿Está la volatilidad a punto de estallar?" | Continuation | Ventana de momentum de 5 barras | Net GEX, z-score de momentum normalizado por vol, volatilidad realizada | Puntuación [-1, +1]; se dispara con abs(score) ≥ 0.25 |
| Zero DTE Position Imbalance | "¿Se están inclinando los traders 0DTE hacia un lado?" | Lectura direccional | Sesión 0DTE (ponderada por horas hasta el cierre) | Desequilibrio de flow call/put, ratio C/P de smart-money, PCR, buckets de moneyness | Puntuación [-1, +1]; se dispara con abs(score) ≥ 0.25 |

### Señales Basic

| Señal | Pregunta | Trade Bias | Timeframe | Inputs Principales | Peso en el Composite |
| --- | --- | --- | --- | --- | --- |
| Dealer Delta Pressure | "¿Están los dealers obligados a perseguir este movimiento?" | Lectura direccional | Intradía inmediato | Delta neto del dealer (call_delta_oi + put_delta_oi), distribución de OI por strike | Peso MSI 0.08 |
| GEX Gradient | "¿Está el gamma apilado en un lado?" | Lectura direccional | Snapshot por strike (al refrescar el GEX) | Gamma por encima del spot, gamma por debajo del spot, concentración ATM, fracción en las alas, volatilidad realizada | Peso MSI 0.08 |
| Positioning Trap | "¿Está la multitud mal posicionada?" | Mean-reversion (vs. multitud) | Intradía (5–10 min) | PCR, desequilibrio con signo de smart-money, momentum de 5 barras, inclinación al flip, régimen de net GEX | Peso MSI 0.06 |
| Skew Delta | "¿Cuánto miedo está apostado en las puts?" | Lectura direccional | Intradía (al refrescar las cotizaciones) | IV de puts OTM, IV de calls OTM, spread vs. baseline | Peso MSI 0.04 |
| Tape Flow Bias | "¿Hacia dónde se inclina el tape?" | Continuation | Ventana rodante corta (Lee-Ready) | Premium de compra/venta en calls, premium de compra/venta en puts, flow total de premium | Peso MSI 0.08 |
| Vanna/Charm Flow | "¿Forzarán la vol o el tiempo a los dealers a recubrirse?" | Continuation | Intradía (charm aumenta en las últimas 2 horas) | Vanna agregada del dealer, charm agregado del dealer, multiplicador de charm según el horario de sesión | Peso MSI 0.04 |

---

## Qué significa el signo de la puntuación

Misma línea numérica, preguntas muy distintas. Aquí está lo que significan positivo, negativo y cero para cada señal — lee con atención la **columna del cero**, es donde ocurren la mayoría de las malas interpretaciones.

### Señales Advanced

| Señal | Puntuación positiva | Puntuación negativa | Cero |
| --- | --- | --- | --- |
| EOD Pressure | Presión de pin alcista (charm en compra + gamma tirando hacia arriba) | Presión de pin bajista (charm en venta + gamma tirando hacia abajo) | Sin compresión de pin ni actividad de charm en la ventana final |
| Gamma/VWAP Confluence | Precio por encima del cluster de confluencia (fade hacia abajo bajo long gamma / aceleración hacia arriba bajo short gamma) | Precio por debajo del cluster de confluencia (espejo) | Faltan inputs centrales (flip / VWAP no disponibles) — *no* es "neutral" |
| Market Pressure | Loading alcista — los dealers están obligados a comprar ante cualquier catalizador (inclinación vanna+charm hacia arriba, flow del lado call, dealers short delta) | Loading bajista — los dealers están obligados a vender ante cualquier catalizador (espejo) | Falta un pilar (sin walls, sin flip, sin greeks, sin flow), o el resorte genuinamente no está cargado — no es "mercado neutral". Cuando está cargado con direction = 0, las fuerzas opuestas se cancelan. |
| Range Break Imminence | Rotura alcista inminente (presión estructural alcista alineada) | Rotura bajista inminente | Imminence baja — mantente en modo range-fade; sin loading de rotura |
| Squeeze Setup | Compra el breakout alcista (flow de calls + aceleración al alza) | Vende el breakout bajista (flow de puts + aceleración a la baja) | Nada está comprimido — sin energía enroscada, sin inclinación de flow |
| Trap Detection | Compra el breakdown fallido (la rotura bajista no aguanta) | Vende el breakout fallido (la rotura alcista no aguanta) | Ahora mismo no se está rechazando ningún nivel estructural |
| Vol Expansion | Momentum alcista + capacidad de expansión de vol (dealers short gamma) | Momentum bajista + capacidad de expansión de vol | Sin momentum, o GEX positivo amortiguando el movimiento |
| Zero DTE Position Imbalance | Posicionamiento 0DTE cargado hacia calls (skew de flow alcista) | Posicionamiento 0DTE cargado hacia puts (bid de protección bajista) | Flow 0DTE equilibrado — o señal inactiva fuera del RTH |

### Señales Basic

| Señal | Puntuación positiva | Puntuación negativa | Cero |
| --- | --- | --- | --- |
| Dealer Delta Pressure | Dealers long delta — deben vender los rallies (bajista) | Dealers short delta — deben comprar los dips (alcista) | Book del dealer equilibrado u OI insuficiente |
| GEX Gradient | Gamma apilado por debajo del spot (amplificador bajista en short gamma; amortiguado en long gamma) | Gamma apilado por encima del spot (sesgo bajista) | Gradiente plano u OI insuficiente |
| Positioning Trap | Multitud long mal posicionada — loading de short-cover squeeze alcista | Multitud short mal posicionada — loading de flush bajista | No se detecta ningún extremo de multitud |
| Skew Delta | Skew de puts *por debajo* de la baseline — el miedo se está deshaciendo (inclinación alcista) | Skew de puts elevado — el miedo está apostado (inclinación bajista) | Skew en la baseline, o datos faltantes |
| Tape Flow Bias | Domina la compra agresiva de calls en el tape (convicción alcista) | Domina la compra agresiva de puts en el tape (convicción bajista) | Flow de premium equilibrado o volumen insuficiente |
| Vanna/Charm Flow | El hedging del dealer es un viento de cola comprador (vol-crush / decay) | El hedging del dealer es un viento en contra vendedor (vol-up / unwind) | Exposición del dealer equilibrada o filas de dealer faltantes |

---

## Un cero (casi) nunca es "neutral"

Esta es la interpretación errónea más común de todas, así que merece su propia sección.

> Una puntuación de 0 normalmente significa *datos insuficientes* o *esta pregunta concreta no tiene respuesta ahora mismo* — **no** "el mercado está equilibrado, opera libremente."

Cuando Gamma/VWAP Confluence devuelve 0 porque el gamma flip o el VWAP no están disponibles, eso es un *punto ciego*, no un tape tranquilo. Cuando EOD Pressure es 0 fuera de la ventana de cierre, la pregunta simplemente aún no aplica. Trata un 0 como "esta lente está apagada", ajusta el tamaño en consecuencia, y apóyate en las señales que *sí* están reportando.

## Los cuatro buckets de trade-bias

El "Trade Bias" de cada señal se agrupa en una de cuatro familias. Saber en qué bucket vive una señal te dice cómo actuar sobre ella incluso antes de leer la puntuación.

- **Continuation (5):** Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow — estas dicen *el movimiento tiene combustible; súbete a él*.
- **Mean-reversion (2):** Positioning Trap, Trap Detection — estas dicen *el movimiento está sobreextendido o es falso; fádealo*. Gamma/VWAP Confluence se une a este bucket cuando los dealers están long gamma.
- **Directional read (5):** EOD Pressure, Zero DTE Imbalance, Dealer Delta Pressure, GEX Gradient, Skew Delta — estas te dicen *hacia dónde apunta la presión*, sin prescribir por sí solas si montar o fadear.
- **Regime / structural (1):** Range Break Imminence — esta por sí sola cambia el playbook, alternándote entre modo range-fade y modo breakout.

Cuando varias señales del **mismo** bucket se alinean, la convicción se multiplica. Cuando las señales de Continuation y Mean-reversion discrepan, ese conflicto es en sí mismo información: el tape está disputado.

## Booleanos disparados vs. pesos del composite

Las señales Advanced y Basic no son simplemente versiones "más difíciles" y "más fáciles" entre sí — están conectadas al sistema de forma distinta.

- **Las señales Advanced disparan triggers discretos.** En cuanto la puntuación cruza el umbral (p. ej., abs(score) ≥ 0.25 para Squeeze Setup), la señal *se dispara*: activa una alerta y puede habilitar un playbook. Entre disparos es puramente informativa.
- **Las señales Basic nunca se disparan.** Son inputs continuos para el compuesto MSI, cada una con un peso fijo (de 0.04 a 0.08). Siempre están contribuyendo, nunca alertando.

Por eso solo ves alertas estilo "BULLISH FADE" en algunas señales y no en otras — las señales Basic hacen su trabajo en silencio dentro del composite todo el tiempo.
