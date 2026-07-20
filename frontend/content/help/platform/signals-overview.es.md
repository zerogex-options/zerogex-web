# Cómo funcionan los Signals de principio a fin

*El modelo completo de signals — Advanced vs. Basic, cómo se combinan los puntajes, qué muestran las tarjetas y cómo aprovecharlo todo.*

---

## Las dos familias

ZeroGEX opera con **dos familias** de signals. Se comportan de forma distinta, a propósito.

- Los **signals Advanced** plantean una pregunta precisa y situacional — *"¿se está fijando el cierre en un nivel?"*, *"¿acaba de fallar este breakout?"*. Cada uno genera un puntaje en una línea **[-1, +1]** **y** un **trigger** discreto: cuando el puntaje cruza el umbral del signal, dispara una alerta y puede habilitar un playbook. Son event-driven.
- Los **signals Basic** son continuos. No se disparan; en su lugar, alimentan el **composite MSI** con un peso fijo, empujando la lectura combinada hacia arriba o hacia abajo en cada actualización. Se ven como insumos del panorama general, no como alertas independientes.

Esa es la distinción más importante. Interiorízala antes de leer las páginas de cada signal.

## La línea del puntaje

Todo signal de ZeroGEX — Advanced o Basic — vive en la misma línea numérica: **[-1, +1]**.

- El **signo** indica la dirección. Positivo es alcista; negativo es bajista. Algunos signals son de mean-reversion (así que un puntaje positivo significa "hacer fade de la subida"); esos llevan un chip de "trade bias" bien visible en la página.
- La **magnitud** indica la convicción. Cuanto más cerca esté el puntaje de ±1, más fuerte es la lectura.
- **Un puntaje de 0 casi nunca es neutral.** En la mayoría de los signals significa que los datos son insuficientes o que esta pregunta específica no tiene respuesta en este momento. Interpreta un 0 como "sin lectura", no como "sin trade".

Consulta [Cómo leer la línea de puntaje [-1, +1]](/help/platform/score-line) para el análisis completo.

## Triggers (solo signals Advanced)

Cada signal Advanced tiene un umbral de trigger:

| Signal | Umbral del trigger |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

Cuando el trigger de un signal se activa, ocurren tres cosas:

1. La tarjeta del signal en el dashboard se ilumina en la dirección en la que se disparó.
2. Se registra una entrada en el [Live Bulletin](/help/platform/live-bulletin).
3. El puntaje composite refleja la mayor convicción.

## El composite (MSI)

El Composite Score (Market Score Indicator, MSI) es la **lectura combinada de todos los signals**. Cada signal Basic aporta un peso fijo; los signals Advanced aportan cuando su trigger está activo.

El composite se ubica en la misma línea [-1, +1]. Una lectura del composite por encima de +0.4 con varios signals aportando en la misma dirección es una lectura de alta confluencia. Un composite que oscila cerca de 0 con aportes mixtos es, intencionalmente, "sin lectura".

Consulta [Composite Score](/help/platform/composite-score) para el desglose completo.

## Anatomía de una página de signal

Cada página de signal en ZeroGEX tiene la misma anatomía. Una vez que la conoces, cualquier signal se lee rápido.

1. **Título + score hero** — el puntaje, el estado del trigger y el timeframe.
2. **Chip de trade-bias** — direccional, mean-reversion, continuation, regime-switch.
3. **Panel de sparkline** — el puntaje a lo largo de la ventana más reciente.
4. **Panel de inputs** — los insumos principales que determinan el puntaje (por ejemplo, para EOD Pressure: dealer charm, pin gravity, realized vol).
5. **"Cómo está construido"** — explicación en lenguaje sencillo de la matemática subyacente.
6. **Triggers recientes** — el registro de auditoría de los disparos recientes.

El orden es coherente en todas las páginas.

## Categorías de trade bias

Todo signal tiene un trade bias declarado. Aparece en la tarjeta y en la página del signal.

- **Lectura direccional** — el signo del puntaje corresponde a la dirección de precio esperada.
- **Mean-reversion (vs. crowd)** — un puntaje positivo alto significa "hacer fade de la subida"; opera en contra del posicionamiento de la mayoría.
- **Mean-reversion (long gamma)** — hacer fade de la extensión hacia la media cuando los dealers están long gamma.
- **Continuation** — el signo del puntaje corresponde a la dirección del siguiente tramo.
- **Cambio de régimen / playbook** — el signal indica cambiar de estrategia, no entrar en un trade.

Ajusta el trade bias a tu estrategia. Un signal de continuation no es un fade.

## Cómo usar los signals

Tres patrones:

1. **Como filtro.** No tomes trades en largo cuando el composite está en -0.6. No hagas fade de los rallies en gamma negativo.
2. **Como trigger.** Usa el trigger de un signal Advanced como señal de entrada, con tu propio stop y objetivo.
3. **Como confluencia.** Combina dos o tres signals independientes (una lectura de régimen Basic + un trigger Advanced + el chip de trade bias del dashboard).

## Lo que los signals no hacen

- No te dan las salidas.
- No dimensionan tu trade.
- No conocen tu tolerancia al riesgo.

Úsalos dentro de un proceso basado en reglas, no como tickets de trade independientes.

## Ver también

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) — la matriz de referencia completa
