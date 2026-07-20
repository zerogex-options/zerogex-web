# Señal Squeeze Setup explicada: cómo leer mercados comprimidos

*El análisis práctico y en profundidad de la señal Squeeze Setup de ZeroGEX — qué mide, los cinco inputs que determinan el puntaje, cuándo se activa y cuándo permanece en silencio, y cómo usarla para identificar mercados comprimidos y listos para un movimiento direccional.*

---

## Por qué existe esta señal

La mayoría de las herramientas de options-flow te dicen que algo está sucediendo *ahora mismo*. Casi ninguna te dice que el tape ha **almacenado** silenciosamente la energía para moverse — que el flow, el momentum, la gamma y la volatilidad se están alineando antes de que el movimiento real se dispare.

Ese es el vacío que la señal Squeeze Setup está construida para llenar. No predice la dirección de forma directa. Te indica cuándo las condiciones para un movimiento direccional se han acumulado a través de múltiples inputs estructurales, de modo que cuando llega el catalizador, el movimiento ya tiene combustible detrás.

Este artículo es la lectura orientada al trader de la señal Squeeze Setup. Cubre qué pregunta, cómo se calcula el puntaje, cuándo se activa y cuándo permanece en silencio, y cómo actuar dentro de una sesión. La referencia completa de señales de ZeroGEX está en la [guía Signals: Explained](/guides/signals-explained), y la mecánica estructural que impulsa la mayoría de sus inputs se trata en el [pilar de Gamma Exposure](/education/gamma-exposure-explained).

---

## ¿Qué es la señal Squeeze Setup?

La señal Squeeze Setup plantea una pregunta:

> ¿Está el mercado comprimido — se están alineando el flow, el momentum, la gamma y la volatilidad para cargar energía que aún no se ha liberado?

Es una señal **Avanzada** dentro del stack de ZeroGEX — produce tanto un puntaje continuo en la línea numérica [-1, +1] como un disparador discreto cuando el puntaje absoluto supera **0,25**.

Fundamentalmente, Squeeze Setup es una señal de **Continuación**, no de fade. Cuando se activa, la inclinación práctica es operar *a favor* del movimiento una vez que rompe, no en contra. Eso la convierte en lo opuesto de herramientas de mean-reversion como Positioning Trap o Trap Detection. Saber en qué categoría vive una señal es la mitad del trabajo para leerla correctamente.

---

## El mecanismo: cómo se acumula la compresión

Los mercados no siempre se comprimen antes de moverse — pero cuando lo hacen, ciertas condiciones medibles tienden a agruparse:

1. **El flow ha empezado a inclinarse direccionalmente.** La prima de calls domina consistentemente a la de puts, o al revés — y la inclinación es lo suficientemente grande en relación con la volatilidad típica del flow del símbolo como para destacar.
2. **El momentum de corto plazo se está acelerando.** El momentum de 5 barras supera al de 10 barras. La pendiente se está inclinando más, no solo tendiendo.
3. **La net gamma es lo suficientemente densa como para que el hedging importe.** Un libro de dealers plano no propaga movimientos; uno cargado sí.
4. **El spot está posicionado respecto al gamma flip de una manera que abre potencial alcista.** Si el spot está justo por debajo del flip y el flow es alcista, está presente el setup estructural para un cruce del flip seguido de extensión.
5. **El régimen de volatilidad es el adecuado.** Un régimen VIX de pánico amortigua los setups (todo ya se está moviendo); un régimen VIX muerto puede producir compresiones falsas.

Squeeze Setup combina los cinco en un único puntaje continuo por lado (bull y bear), y luego los netea.

---

## Los cinco inputs principales

| Input | Qué captura |
|---|---|
| Flow z-score | Los deltas de flow de calls/puts estandarizados (z-score) según la volatilidad del flow de cada símbolo — un flow "grande" en un símbolo tranquilo se considera significativo; un flow "grande" en un símbolo ruidoso debe superar un umbral más alto |
| Momentum 5/10 barras | Dos horizontes comparados, buscando aceleración (5 barras superando a 10 barras) y no solo dirección |
| Gamma readiness | La net gamma pasada por una tanh suavizada, dando como resultado "¿está el libro suficientemente cargado como para importar?" como multiplicador continuo de 0 a 1 |
| Distancia al flip | Qué tan cerca está el spot del gamma flip, con el lado multiplicado de forma que un setup bull cerca del flip desde abajo puntúa más alto |
| Régimen VIX | Muerto / normal / elevado / pánico — se usa para amortiguar o amplificar el puntaje según el contexto |

El resultado es un solo número, pero lleva consigo la estructura conjunta de los cinco inputs.

---

## Cómo se calcula el puntaje

Para cada lado (bull y bear), la señal multiplica:

```
side_score = normalized_flow × directional_momentum_strength
           × gamma_readiness × acceleration_multiplier × flip_side_multiplier
```

El puntaje neto es `bull_score − bear_score`, acotado a [-1, +1]. El disparador se activa cuando el puntaje absoluto es ≥ **0,25**.

Dos hechos estructurales de esta fórmula importan para su lectura:

- **Cada término multiplica, no suma.** Si cualquiera de los cinco términos llega a cero, ese lado se anula. La señal tiene una postura clara sobre *cuándo* funcionan los squeezes — se niega a activarse cuando no se cumple una de las condiciones, incluso si las demás gritan.
- **Los lados bull y bear se calculan de forma independiente y luego se netean.** En los raros casos en que ambos se activan simultáneamente (setups genuinamente disputados), se cancelan parcialmente — algo apropiado, porque la lectura es ambigua.

---

## Interpretación del puntaje

| Puntaje | Lectura |
|---|---|
| +0,6 a +1,0 | Fuertemente comprimido al alza |
| +0,25 a +0,6 | Activado alcista — el playbook de ruptura al alza está operativo |
| -0,25 a +0,25 | Bajo umbral — informativo, no accionable por sí solo |
| -0,25 a -0,6 | Activado bajista — el playbook de ruptura a la baja está operativo |
| -0,6 a -1,0 | Fuertemente comprimido a la baja |

El umbral de 0,25 es deliberadamente conservador. Squeeze Setup exige un estándar alto — ¿se alinean *todos* los inputs estructurales? — y el umbral refleja eso. Una lectura de 0,20 es límite; solo 0,25+ cuenta como activado.

---

## Cuándo se activa la señal y cuándo permanece en silencio

El estado dominante es **silencio**. Squeeze Setup está diseñada para permanecer en silencio la mayor parte del tiempo. En la mayoría de los símbolos, la mayor parte de la jornada de trading, ninguna de las cinco condiciones se está acumulando — y ese silencio es informativo. Te dice que las precondiciones estructurales para una ruptura no están presentes, por lo que las rupturas que ves probablemente son ruido.

La señal se activará solo cuando:

- El flow sea lo suficientemente grande como para ser estadísticamente significativo en relación con el historial del símbolo (el componente z-score no es trivial).
- El momentum esté acelerando, no solo tendiendo.
- La gamma esté lo suficientemente cargada como para que los flujos de hedging puedan propagar movimientos.
- El spot esté posicionado respecto al flip de una manera que abra asimetría direccional.
- El régimen de volatilidad no amortigüe la señal hasta cero.

Unos pocos minutos de cada sesión, en los pocos símbolos donde todo esto se alinea — ahí es donde vive Squeeze Setup.

---

## Qué hace un trader cuando se activa

La compuerta canónica del playbook:

> Un puntaje de Squeeze Setup que se mantiene por encima del umbral durante dos sesiones consecutivas activa el playbook Squeeze Breakout — entrada en una ruptura limpia de un envolvente de volatilidad de 30 barras, en la dirección hacia la que se inclina la señal.

La persistencia de dos sesiones es un filtro deliberado. Los disparadores de una sola barra son demasiado ruidosos; la compresión estructural necesita *sostenerse*. Cuando lo hace, la señal esencialmente está diciendo: las condiciones para moverse están presentes, espera la ruptura, luego opera en la dirección del puntaje.

Algunas notas prácticas:

- **La dirección viene del signo del puntaje, no de la técnica de entrada.** La señal hace la lectura direccional; la ruptura del envolvente de volatilidad es el disparador de timing.
- **La magnitud importa.** Un puntaje de +0,55 es materialmente diferente de +0,27 — ambos activados, pero el trade de mayor convicción es el de mayor puntaje.
- **Los puntajes bajo umbral siguen informando.** Una lectura persistente de +0,20 no es accionable por sí sola, pero si todas las demás señales también se inclinan alcistas, se suma a la lectura compuesta.

---

## Leer Squeeze Setup junto con otras señales

Squeeze Setup es una señal entre muchas — y la confluencia es donde vive la verdadera ventaja. Algunas lecturas cruzadas comunes:

- **Squeeze Setup + Vol Expansion en la misma dirección.** Dos señales de Continuación coincidiendo — el movimiento tiene tanto *compresión* como *capacidad*. El setup más limpio.
- **Squeeze Setup + Trap Detection en oposición.** Comprimido al alza según Squeeze, pero Trap Detection dice que la ruptura alcista más reciente está fallando. Una de las dos está equivocada respecto a la ruptura actual; usualmente la jugada correcta es saltarse el trade y esperar.
- **Squeeze Setup + Positioning Trap alineados.** Compresión con la masa mal posicionada del mismo lado — un squeeze de cobertura de cortos si la masa está corta, un flush si está larga. Ambas señales apuntan al mismo trade. El artículo complementario sobre la [señal Positioning Trap](/education/positioning-trap-explained) trata esta lectura en profundidad.
- **Squeeze Setup en 0 con todas las demás señales activas.** Probablemente no hay nada estructural comprimido; el movimiento que estás viendo es reactivo, no cargado.

Cuando varias señales de Continuación (Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow) se alinean en la misma dirección, la convicción se multiplica. Cuando entran en conflicto con señales de Mean-reversion, el tape está disputado.

---

## Lecturas erróneas comunes

Tres trampas:

- **Tratar un 0 como "neutral".** Un 0 en Squeeze Setup significa que *nada está comprimido* — no que el mercado esté equilibrado. No operes basándote en él como una luz verde de "calma".
- **Operar en base a un puntaje bajo umbral.** El umbral de 0,25 importa. Una lectura de 0,18 puede *sentirse* como un setup, pero no está activada — y la diferencia entre "se siente comprimido" y "está estructuralmente comprimido" es la mayor parte de la ventaja.
- **Ignorar el régimen.** Squeeze Setup por sí sola no dice nada sobre el régimen de gamma. Un mercado comprimido por debajo del flip se comporta de manera diferente a uno por encima. Verifica siempre con el flujo de trabajo [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Cómo ZeroGEX muestra la señal Squeeze Setup

El dashboard la muestra en varios lugares:

- **La tarjeta Squeeze Setup** muestra el puntaje en vivo, el estado del disparador y el desglose de inputs.
- **El Composite Signal Score** integra Squeeze Setup como un input junto con las demás señales Avanzadas y Básicas.
- **El Trade Stream** marca los trades del playbook con gate `squeeze_breakout` cuando se activan.

*[Marcador de imagen: tarjeta Squeeze Setup de ZeroGEX con puntaje, estado del disparador y contribuciones de inputs — colocar el archivo en /public/blog/zerogex-squeeze-setup-card.png]*

Un ejemplo trabajado. Supongamos que SPX se mueve lateralmente en la sesión del miércoles y ZeroGEX muestra:

- **Squeeze Setup:** +0,42 (activado alcista)
- **Net GEX:** +$800M
- **Gamma Flip:** el spot está 0,2% por encima
- **Tape Flow Bias:** +0,6
- **Trap Detection:** 0

La lectura estructural: setup comprimido al alza con inclinación de flow confirmatoria, ninguna señal contraria de ruptura fallida, y un régimen de gamma larga que amortiguará el movimiento si intenta extenderse demasiado. Inclinación práctica: mantenerse alerta ante una ruptura alcista del envolvente de volatilidad; cuando llegue, las condiciones estructurales para la continuación están presentes. Nada de esto es un trade — es la lectura del régimen que debería reconfigurar qué entradas tomas en serio.

---

## Conclusión

> Squeeze Setup te indica cuándo el mercado ha *almacenado* la energía para moverse, no cuándo ya se movió. Es una señal de precondición, no una señal de timing.

La disciplina consiste en usarla como filtro para decidir qué rupturas direccionales tomar en serio, en lugar de usarla como el disparador en sí. Cuando el puntaje está activado, el setup de ruptura es real; cuando está en cero, las rupturas que estás viendo son ruido. Esa distinción es la mayor parte de la ventaja.

Contenido solo con fines educativos — nada de lo anterior es una recomendación de trading.

---

Si quieres ver la lectura de Squeeze Setup de hoy en tiempo real junto con el gamma flip, los walls y las demás señales Avanzadas y Básicas, el dashboard gratuito de ZeroGEX muestra todo esto.
