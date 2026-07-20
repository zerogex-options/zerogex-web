# Cómo leer la línea de puntuación [-1, +1]

*Cada puntuación de señal vive en la misma línea numérica. Qué significan el signo y la magnitud, cuándo un 0 es una no-respuesta y cuándo actuar.*

---

## Por qué la línea de puntuación es fija

Cada señal de ZeroGEX — Advanced o Basic — expresa su lectura en la misma escala **[-1, +1]**. La ventaja es evidente: la confluencia entre señales se convierte en una comparación justa. Un +0.5 en Squeeze Setup y un +0.5 en EOD Pressure expresan conceptualmente niveles de confianza similares.

El costo: cada señal tiene un **sesgo de trade** distinto, así que el significado de un +0.5 depende de qué señal lo generó.

## Signo

Para las señales direccionales, el signo indica la dirección de precio esperada:

- **Positivo ⇒ sesgo alcista** (el sesgo de trade es a largo)
- **Negativo ⇒ sesgo bajista**

Para las señales de mean-reversion (Positioning Trap, y Trap Detection en algunas configuraciones), el signo indica la **dirección del movimiento que conviene fadear**:

- **Positivo ⇒ el movimiento al alza está fuera de lugar / ha fallado** (fade a la baja)
- **Negativo ⇒ el movimiento a la baja está fuera de lugar / ha fallado** (fade al alza)

La tarjeta de la señal en cada página indica cuál de las dos aplica. Lee el chip de sesgo de trade antes de leer la puntuación.

## Magnitud

Cuanto más cerca de ±1, mayor la convicción. Guía práctica:

| Rango | Lectura |
| --- | --- |
| 0.0 – 0.2 | Dentro del ruido. Sin lectura accionable. |
| 0.2 – 0.4 | Sesgo suave. Filtro, no disparador. |
| 0.4 – 0.6 | Lectura sólida. Combinada con confluencia, operable. |
| 0.6 – 0.8 | Lectura fuerte. La señal está haciendo una afirmación real. |
| 0.8 – 1.0 | Convicción máxima. Poco frecuente. Prestar atención. |

## Una puntuación de 0 casi nunca es neutral

Este es el punto más malentendido sobre las puntuaciones de señales.

Una puntuación de 0 normalmente significa:

- Los datos son **insuficientes** para la pregunta que plantea esta señal.
- La pregunta no aplica en este momento (por ejemplo, EOD Pressure durante la apertura).
- Los inputs se **cancelan de forma limpia** — igualmente alcistas y bajistas.

Cualquiera de esos casos es una "no-lectura", no un "mercado neutral". Un mercado estructuralmente neutral suele mostrarse con puntuaciones que oscilan alrededor de ±0.1, no con un cero limpio.

Cuando veas un 0 verdadero, pasa el cursor sobre la tarjeta de la señal. El tooltip explica el porqué.

## Disparadores vs. puntuaciones

Algunas señales Advanced tienen un estado adicional además de la puntuación:

- Un **disparador** discreto (sí/no) que se activa cuando la puntuación cruza un umbral.
- Una métrica secundaria (loading 0–100 en Market Pressure, imminence 0–100 en Range Break) que condiciona el disparador de forma independiente a la puntuación.

La puntuación es la **lectura**; el disparador es el **evento**. Puedes usar la puntuación como filtro sin esperar al disparador.

## Cómo leer el sparkline

La pendiente importa tanto como el nivel.

- Una puntuación de +0.4 con tendencia **al alza** es una lectura en desarrollo — el momentum está de su lado.
- Una puntuación de +0.4 con tendencia **a la baja** desde +0.7 es una lectura que se debilita — la señal tenía razón antes, ahora menos.
- Una puntuación que invierte su signo en una ventana corta es volatilidad, no convicción. Espera a que se asiente.

## Cuándo actuar

Una regla práctica sencilla que se ha sostenido en el tiempo:

> Actúa por **confluencia**, no por puntuaciones individuales.

Un solo +0.7 en una señal es interesante. Un +0.5 en tres señales de dimensiones independientes (una señal Basic, una señal Advanced, el composite) es un trade.

## Qué cambia si cambia el régimen

Al cruzar el gamma flip, la **interpretación** de algunas puntuaciones cambia:

- Gamma/VWAP Confluence: gamma larga por encima del flip ⇒ mean-revert; gamma corta por debajo del flip ⇒ continuación.
- Trap Detection es más nítido en gamma negativa.
- EOD Pressure pinea con más fuerza en gamma positiva.

Las tarjetas de señal ya tienen esto en cuenta — pero saberlo explica por qué la misma puntuación puede significar cosas distintas en días distintos.

## Ver también

- [Cómo funcionan las señales de principio a fin](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Señales: explicadas](/guides/signals-explained)
