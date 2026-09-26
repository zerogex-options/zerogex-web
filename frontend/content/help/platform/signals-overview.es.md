# Cómo funcionan los Signals de principio a fin

*El modelo completo de signals - Advanced vs. Basic, cómo se relacionan con el Composite Score y el Trade Bias, qué muestran las tarjetas y cómo aprovecharlo todo.*

---

## Las dos familias

ZeroGEX opera con **dos familias** de signals. Se comportan de forma distinta, a propósito.

- Los **signals Advanced** (Pro) plantean una pregunta precisa y situacional - *"¿se está fijando el cierre en un nivel?"*, *"¿acaba de fallar este breakout?"*. Cada uno genera un puntaje en una línea de **-100 a +100** **y** un **trigger** discreto: cuando el puntaje cruza el umbral del signal, su tarjeta pasa de *Stand by* a *Triggered*, y el trigger puede habilitar un playbook. Son event-driven.
- Los **signals Basic** (Basic y Pro) son continuos. No se disparan y **no tienen peso en el Composite Score (MSI)** - son lecturas orientativas que lo acompañan. Su valor está en el acuerdo (convicción) o el desacuerdo (divergencia): cuando las lecturas de flujo divergen de las de estructura, a menudo ya hay un cambio de régimen en marcha antes de que se mueva el MSI.

Esa es la distinción más importante. Interiorízala antes de leer las páginas de cada signal.

## La línea del puntaje

Todo signal de ZeroGEX - Advanced o Basic - vive en la misma línea numérica: **de -100 a +100**.

- El **signo** indica la dirección. En la mayoría de los signals, positivo es alcista y negativo es bajista - pero algunos son de mean-reversion o están invertidos de signo por otra razón, así que un puntaje positivo no siempre significa "ponerse largo". Revisa el trade bias del signal (más abajo) antes de leer su signo.
- La **magnitud** indica la convicción. Cuanto más cerca esté el puntaje de ±100, más fuerte es la lectura.
- **Un puntaje de 0 casi nunca es neutral.** En la mayoría de los signals significa que los datos son insuficientes o que esta pregunta específica no tiene respuesta en este momento. Interpreta un 0 como "sin lectura", no como "sin trade".

Consulta [Cómo leer la línea de puntuación de -100 a +100](/help/platform/score-line) para el análisis completo.

## Triggers (solo signals Advanced)

Cada signal Advanced tiene un umbral de trigger:

| Signal | Umbral del trigger |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Cuando el trigger de un signal se activa:

1. Su tarjeta en el Advanced Signal Dashboard se resalta con un borde y se tiñe en la dirección en la que se disparó, y su estado cambia de *Stand by* a *Triggered*.
2. El Composite Score **no** se mueve - los signals Advanced no forman parte del MSI.

No se te envía nada y no se añade nada al Boletín en vivo. Para revisar lo que hizo un signal, usa su Event Timeline - consulta [Alertas de señales](/help/platform/alerts).

## El composite (MSI)

El Composite Score (Market State Index, MSI) es una lectura aparte, construida a partir de **seis componentes de la estructura de opciones**: signo del net GEX, gamma anchor, put/call ratio, régimen de volatilidad, desequilibrio del order flow smart-money y dealer delta pressure. Los signals Basic y Advanced no están entre sus insumos.

El composite es un **puntaje de régimen de 0 a 100**, donde 50 es neutral - no un punto en la línea de -100 a +100. Una lectura alta (≥ 70) indica un régimen de tendencia / expansión donde las tendencias pueden correr; una lectura baja (< 20) es la banda Compression, donde históricamente el precio ha recorrido menos. Te dice el régimen, no la dirección - para saber hacia qué lado, consulta Trade Bias.

Dónde sí se juntan los signals:

- **Trade Bias** combina el MSI y varios signals Basic y Advanced en una sola lectura direccional. La página completa es Pro; en el Panel principal hay una tarjeta compacta.
- **Signal Breadth**, en el Panel principal, cuenta cuántos signals se inclinan alcistas, neutrales o bajistas.

Consulta [Composite Score](/help/platform/composite-score) para el desglose completo.

## Anatomía de una página de signal

Cada página de signal en ZeroGEX tiene la misma anatomía. Una vez que la conoces, cualquier signal se lee rápido.

1. **Título y pregunta** - el nombre del signal, la pregunta que plantea y un tooltip ⓘ con la versión corta de cómo funciona.
2. **Score hero** - el puntaje actual de -100 a +100, una lectura de una línea y un historial del puntaje desplegable.
3. **Paneles de inputs** - los insumos principales que determinan el puntaje (por ejemplo, para EOD Pressure: el time ramp, el pin target, el dealer charm en el spot y el régimen de gamma).
4. **"How it's built"** - la matemática, en fórmulas y notas breves.
5. **Event Timeline** - la trayectoria del puntaje en las dos últimas sesiones, con los cambios de dirección marcados y el movimiento del subyacente en los 30, 60 o 120 minutos siguientes.

El orden es coherente en todas las páginas.

## Categorías de trade bias

Todo signal tiene un trade bias declarado; [Signals: Explained](/guides/signals-explained) los recoge todos.

- **Lectura direccional** - el signo del puntaje corresponde a la dirección de precio esperada.
- **Mean-reversion (vs. crowd)** - el puntaje refleja hacer fade de la multitud, no del precio: un puntaje positivo señala una multitud de sesgo bajista que puede ser exprimida *al alza*, un puntaje negativo una multitud de sesgo alcista que puede ser barrida *a la baja*.
- **Mean-reversion (long gamma)** - hacer fade de la extensión hacia la media cuando los dealers están long gamma.
- **Continuation** - el signo del puntaje corresponde a la dirección del siguiente tramo.
- **Cambio de régimen / playbook** - el signal indica cambiar de estrategia, no entrar en un trade.

Ajusta el trade bias a tu estrategia. Un signal de continuation no es un fade.

## Cómo usar los signals

Tres patrones:

1. **Como filtro.** No tomes trades de tendencia/ruptura cuando el MSI está bajo (régimen lateral). No hagas fade de los rallies en gamma negativo.
2. **Como trigger.** Usa el trigger de un signal Advanced como señal de entrada, con tu propio stop y objetivo.
3. **Como confluencia.** Combina dos o tres signals independientes (la lectura de un signal Basic + un trigger Advanced + la tarjeta de Trade Bias del Panel principal).

## Lo que los signals no hacen

- No te dan las salidas.
- No dimensionan tu trade.
- No conocen tu tolerancia al riesgo.

Úsalos dentro de un proceso basado en reglas, no como tickets de trade independientes.

## Ver también

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) - la matriz de referencia completa
