# Squeeze Setup, Positioning Trap y Trap Detection: Tres Señales, Tres Historias

Si has pasado tiempo en la pestaña Signals, probablemente hayas notado tres nombres que suenan como si midieran lo mismo: Squeeze Setup, Positioning Trap y Trap Detection. Los tres arrojan un número ordenado entre −1 y +1. Los tres cambian de signo según la dirección. Y los tres se activan alrededor de los mismos tipos de pivotes.

Pero bajo el capó, están respondiendo a tres preguntas muy distintas sobre el tape. Entender qué pregunta hace cada una es la diferencia entre anticiparse a un breakout y ser arrollado por él.

Este artículo desglosa qué mide realmente cada señal, cómo interpretarla y — lo más importante — cuándo *no* operar en función de ella.

---

## La Versión de 30 Segundos

| | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Pregunta | "¿Está el mercado comprimido?" | "¿Está la multitud mal posicionada?" | "¿Acaba de fallar este breakout?" |
| Sesgo de Trading | Continuación (con el movimiento) | Reversión a la media (contra la multitud) | Reversión a la media (de vuelta a través del nivel roto) |
| Marco Temporal | Setup multi-día | Intradía (5–10 min) | Intradía → overnight |
| Inputs Principales | Flow, aceleración del momentum, disposición gamma | Ratio put/call, desequilibrio smart-money | Proximidad al wall, régimen gamma, migración de walls |
| Output | [-1, +1], activado en ±0.25 | [-1, +1], continuo | [-1, +1], activado en ±0.25 |

Tres señales. Tres tesis. La misma recta numérica.

---

## Squeeze Setup — "El Resorte Comprimido"

**Qué mide:** Si la volatilidad implícita se ha comprimido, la gamma está densa y el flow empieza a inclinarse direccionalmente — es decir, si el mercado ha acumulado energía potencial para un breakout.

**Inputs:**

- Deltas de flow de calls y puts, normalizados por z-score según la volatilidad de flow por símbolo
- Momentum de 5 barras vs. 10 barras (para detectar aceleración, no solo dirección)
- Net gamma exposure, procesado mediante una tanh suavizada para la "disposición gamma"
- Distancia al strike de gamma flip
- Régimen del VIX (muerto / normal / elevado / pánico)

**Cómo se calcula:** Para cada lado (bull y bear), la señal multiplica flow normalizado × fuerza del momentum direccional × disposición gamma × multiplicador de aceleración × multiplicador de lado-flip. La puntuación neta es bull menos bear, acotada a [-1, +1]. Los triggers se activan cuando abs(score) ≥ 0.25.

**Qué hace un trader con ella:** Un Squeeze Setup positivo que persiste durante dos sesiones consecutivas es la puerta de activación para el playbook Squeeze Breakout — entrada en una ruptura limpia de una envolvente de volatilidad de 30 barras, en la dirección hacia la que se inclina la señal. Las puntuaciones negativas reflejan esto en el lado bajista.

> **Intuición clave:** Squeeze Setup es la única de las tres que quiere que operes *a favor* del movimiento. Es una señal de continuación.

---

## Positioning Trap — "El Trade Abarrotado"

**Qué mide:** Si la multitud de opciones está posicionada de forma desequilibrada (fuertemente long o fuertemente short) y el tape está empezando a invalidar ese sesgo — el clásico setup para un short-cover squeeze o un long-side flush.

**Inputs:**

- Momentum de 5 barras
- Ratio put/call (la medida del abarrotamiento)
- Desequilibrio smart-money con signo: (call_signed − put_signed) / (abs(call) + abs(put))
- Proximidad al gamma flip
- Régimen de Net GEX (suavizado vía tanh)

**Cómo se calcula:** Una suma ponderada — 0.45 en abarrotamiento, 0.25 en el sesgo del desequilibrio, 0.15 en momentum, 0.10 en la inclinación del flip, 0.05 en el régimen de GEX negativo — calculada de forma independiente para el lado squeeze (multitud long en riesgo) y el lado flush (multitud short en riesgo). Ambos se compensan en una única puntuación.

A diferencia de las otras dos, Positioning Trap no tiene un flag de trigger — alimenta el compuesto MSI como componente continuo (peso 0.06) y habilita el playbook `positioning_trap_squeeze` cuando abs(score) ≥ 0.5.

**Qué hace un trader con ella:** Identificar el lado abarrotado, y luego esperar a que el tape gire en su contra. Una multitud long no sufre un squeeze hasta que aparecen los vendedores. La señal te dice que el combustible está ahí; el tape tiene que proporcionar la chispa.

> **Intuición clave:** Positioning Trap va en contra de la apuesta de la multitud.

---

## Trap Detection — "El Breakout Fallido"

**Qué mide:** Si el precio ha perforado un nivel estructural clave — call wall, put wall, VWAP, strike de máxima gamma o gamma flip — pero está fallando en sostener el movimiento, señalando que los dealers lo harán retroceder.

**Inputs:**

- Call wall y put wall — y sus posiciones previas (para detectar la migración de walls)
- Strike de máxima gamma, VWAP, gamma flip
- Net GEX y la tasa de cambio del Net GEX
- Deltas de flow de calls/puts (buscando desaceleración)
- Volatilidad realizada (usada para escalar el buffer de breakout)

**Cómo se calcula:** Primero, la señal identifica el nivel roto más cercano por encima y por debajo del cierre, y aplica un buffer escalado por volatilidad (~0.15% × σ × √5) para confirmar una ruptura real. Luego, para cada lado, multiplica la fuerza del breakout × factor continuo de long-gamma × factor de fortalecimiento del GEX × penalización por migración de wall × magnitud × multiplicador de flow.

La verificación de migración de wall es lo que hace diferente a esta señal: si el wall se ha movido *lejos* del precio, el breakout es real, no una trampa, y la puntuación se penaliza fuertemente.

**Qué hace un trader con ella:** Un fade bajista activado (el precio rompió al alza, pero los dealers están long gamma y el flow se está desacelerando) es la puerta para el playbook Overnight Trap Continuation — un débito 1DTE posicionado contra el falso breakout, mantenido hasta la siguiente sesión. Los fades alcistas reflejan esto en el lado bajista.

> **Intuición clave:** Trap Detection va en contra de la ruptura de un nivel estructural por parte del precio.

---

## Mismo Número, Significado Distinto

Aquí está la trampa que atrapa a los traders: las tres señales imprimen una puntuación [-1, +1], y un +0.6 en una no es el mismo trade que un +0.6 en otra.

| Signo de la Puntuación | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Positivo (+) | Comprar el breakout al alza | Ir contra la multitud short → squeeze alcista | Comprar el breakdown fallido |
| Negativo (−) | Vender el breakout a la baja | Ir contra la multitud long → flush bajista | Vender el breakout fallido |
| Cero (0) | Sin energía comprimida / sin inclinación de flow | Sin extremo de multitud | Ningún nivel estructural está fallando |

Un 0 no significa "mercado neutral". Significa que *esta pregunta específica no tiene respuesta en este momento*. Squeeze Setup en 0 no te dice que el posicionamiento esté equilibrado — te dice que nada está comprimido. Trap Detection en 0 no te dice que la multitud esté bien — te dice que ningún nivel está siendo rechazado.

Tres señales están leyendo el mismo tape a través de tres lentes distintos. Trátalas en consecuencia.

---

## Cómo Leerlas en Conjunto

Algunos patrones a buscar:

**Confluencia (alta convicción):** Squeeze Setup +0.5 y Trap Detection +0.4 → el mercado está comprimido al alza y una ruptura bajista acaba de fallar. Ambas señales apuntan al mismo trade desde ángulos diferentes.

**Secuencia (mejores entradas):** Positioning Trap marca una multitud long en +0.7 → espera. Trap Detection luego pasa a negativo (la ruptura alcista falla) → esa es la chispa. Opera el fade con la multitud como combustible.

**Contradicción (mantente al margen):** Squeeze Setup dice +0.6 (ir long con la ruptura). Trap Detection dice −0.5 (la ruptura alcista está fallando). Una de las dos está equivocada. Sáltatelo.

Las señales son independientes por una razón — cuando coinciden, escúchalas. Cuando se contradicen, el trade más inteligente suele ser no operar.
