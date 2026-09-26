# Cómo leer la línea de puntuación de -100 a +100

*Cada puntuación de señal vive en la misma línea numérica. Qué significan el signo y la magnitud, cuándo un 0 es una no-respuesta y cuándo actuar.*

---

## Por qué la línea de puntuación es fija

Cada señal de ZeroGEX - Advanced o Basic - expresa su lectura en la misma escala de **-100 a +100**. (Internamente cada señal calcula un valor entre -1 y +1; la app lo muestra multiplicado por 100.) La ventaja es evidente: la confluencia entre señales se convierte en una comparación justa. Un +50 en Squeeze Setup y un +50 en EOD Pressure expresan conceptualmente niveles de confianza similares.

El costo: cada señal tiene un **sesgo de trade** distinto, así que el significado de un +50 depende de qué señal lo generó.

La única cifra principal que no está en esta línea es el Composite Score (MSI): un gauge de régimen de 0 a 100 donde 50 es neutral. Consulta [Composite Score](/help/platform/composite-score).

## Signo

Para las señales direccionales, el signo indica la dirección de precio esperada:

- **Positivo ⇒ sesgo alcista** (el sesgo de trade es a largo)
- **Negativo ⇒ sesgo bajista**

Para las señales de mean-reversion (Positioning Trap, Trap Detection), el signo indica el **sesgo direccional resuelto** - el trade va *en contra* de la multitud mal posicionada o de la ruptura fallida, así que el signo sigue apuntando en la misma dirección que las señales direccionales de arriba:

- **Positivo ⇒ sesgo alcista** - p. ej. una multitud short/bajista en riesgo de ser exprimida al alza, o una ruptura bajista fallida que comprarías
- **Negativo ⇒ sesgo bajista** - p. ej. una multitud long/alcista en riesgo de ser barrida a la baja, o una ruptura alcista fallida que venderías

Antes de leer la puntuación, ten claro qué tipo de señal estás leyendo. El tooltip ⓘ y el panel "How it's built" de cada página de señal explican qué significa su signo, y [Señales: explicadas](/guides/signals-explained) recoge el sesgo de trade de cada señal.

## Magnitud

Cuanto más cerca de ±100, mayor la convicción. Una guía práctica, basada en los umbrales y las etiquetas que usan las páginas de señales:

| Puntuación (cualquier signo) | Lectura |
| --- | --- |
| 0 - 25 | Por debajo de la línea de activación de la mayoría de las señales. Las páginas lo etiquetan como equilibrado, plano, neutral o "no edge". Sin lectura accionable por sí sola. |
| 25 - 50 | Un sesgo que se está formando. La mayoría de las tarjetas se activan en ±25; EOD Pressure y Gamma/VWAP Confluence se disparan un poco antes, en ±20. Filtro, o disparador con confluencia. |
| 50 - 70 | Lectura fuerte. Varias páginas de señales pasan a su etiqueta más fuerte en ±50 o ±60 - Positioning Trap, por ejemplo, lo llama un setup de squeeze o de flush. |
| 70 - 100 | El extremo de la escala. EOD Pressure y Volatility Expansion reservan sus etiquetas más fuertes para ±70 o más. Poco frecuente. Prestar atención. |

Cada página de señal también muestra su propia lectura en una línea de la puntuación actual. Donde la página y esta tabla difieran, quédate con la página. Range Break Imminence y Market Pressure Index no se disparan por la puntuación en absoluto - consulta Disparadores vs. puntuaciones más abajo.

## Una puntuación de 0 casi nunca es neutral

Este es el punto más malentendido sobre las puntuaciones de señales.

Una puntuación de 0 normalmente significa:

- Los datos son **insuficientes** para la pregunta que plantea esta señal.
- La pregunta no aplica en este momento (por ejemplo, EOD Pressure antes de que se abra su ventana a las 14:30 ET).
- Los inputs se **cancelan de forma limpia** - igualmente alcistas y bajistas.

Cualquiera de esos casos es una "no-lectura", no un "mercado neutral". Un mercado estructuralmente neutral suele mostrarse con puntuaciones que oscilan alrededor de ±10, no con un cero limpio.

Las señales Basic rara vez muestran un 0 verdadero: cuando a una le faltan los datos principales, el motor muestra en su lugar una pequeña inclinación derivada del régimen, dentro de ±10. Trata también una puntuación Basic de un solo dígito como "no-lectura".

Cuando veas un 0 verdadero, revisa la tarjeta y la página de la señal. Las tarjetas de EOD Pressure y 0DTE Position Imbalance muestran *Inactive* mientras su ventana está cerrada, y en muchas páginas de señales el panel "How it's built" explica qué significa un 0 para esa señal.

## Disparadores vs. puntuaciones

Las señales Advanced tienen un estado adicional además de la puntuación:

- Un **disparador** que se activa cuando la puntuación cruza un umbral - ±25 en la mayoría, ±20 en EOD Pressure y Gamma/VWAP Confluence. La tarjeta muestra *Triggered* o *Stand by*.
- Una métrica secundaria (loading 0-100 en Market Pressure Index, imminence 0-100 en Range Break Imminence) que fija el disparador en lugar de la puntuación: Market Pressure Index se dispara con loading ≥ 50 y una dirección clara, Range Break Imminence con imminence ≥ 65.

La puntuación es la **lectura**; el disparador es el **evento**. Puedes usar la puntuación como filtro sin esperar al disparador.

Las tarjetas de las señales Basic también se resaltan y se marcan como *Triggered* a partir de ±25, pero en las señales Basic eso solo destaca una lectura fuerte - no hay ninguna regla de disparo detrás.

## Cómo leer el sparkline

La pendiente importa tanto como el nivel. Cada tarjeta de los paneles lleva un sparkline; en la página de una señal, abre **Expand score history**.

- Una puntuación de +40 con tendencia **al alza** es una lectura en desarrollo - el momentum está de su lado.
- Una puntuación de +40 con tendencia **a la baja** desde +70 es una lectura que se debilita - la señal tenía razón antes, ahora menos.
- Una puntuación que invierte su signo en una ventana corta es volatilidad, no convicción. Espera a que se asiente.

## Cuándo actuar

Una regla práctica sencilla que se ha sostenido en el tiempo:

> Actúa por **confluencia**, no por puntuaciones individuales.

Un solo +70 en una señal es interesante. Un +50 en tres señales de dimensiones independientes (por ejemplo, dos señales Basic y una señal Advanced) es un trade. El composite no forma parte de ese recuento - es un gauge de régimen de 0 a 100, no una puntuación direccional de -100 a +100, así que no leas su nivel como alcista/bajista.

## Qué cambia si cambia el régimen

Al cruzar el gamma flip, la **interpretación** de algunas puntuaciones cambia:

- Gamma/VWAP Confluence: gamma larga por encima del flip ⇒ mean-revert; gamma corta por debajo del flip ⇒ continuación.
- GEX Gradient se invierte con el régimen: en gamma corta, mucha gamma por encima del spot puntúa alcista; en gamma larga, lo hace mucha gamma por debajo del spot, y la lectura se amortigua.
- Trap Detection solo se dispara cuando se modela a los dealers en gamma larga - en gamma negativa se queda en 0.
- EOD Pressure tira hacia el pin en gamma positiva; en gamma negativa, en cambio, se inclina con el movimiento reciente.

Las tarjetas de señal ya tienen esto en cuenta - pero saberlo explica por qué la misma puntuación puede significar cosas distintas en días distintos.

## Ver también

- [Cómo funcionan las señales de principio a fin](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Señales: explicadas](/guides/signals-explained)
