# Advanced Signal Dashboard

*Las señales event-driven — qué pregunta cada una, cuándo se dispara y cómo usarla.*

---

## Qué es el Advanced Signal Dashboard

El Advanced Signal Dashboard es la **cuadrícula de triggers** para las ocho señales Advanced. Cada tarjeta muestra el puntaje en [-1, +1], el estado del trigger (idle, hot, recién disparado) y un sparkline.

Las señales Advanced son **event-driven**. Cada una produce un puntaje continuo, pero el momento interesante es cuando el puntaje cruza el umbral de trigger de la señal.

## Las ocho señales

| Señal | Pregunta | Sesgo de trading | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | "¿Se está fijando (pinning) el cierre?" | Direccional | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | "¿Se están apilando niveles clave aquí?" | Mean-rev (long gamma) / Continuation (short gamma) | abs(score) ≥ 0.20 |
| Market Pressure Index | "¿Está el mercado cargado para moverse?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | "¿Está este rango a punto de romperse?" | Cambio de régimen / playbook | imminence ≥ 65 |
| Squeeze Setup | "¿Está el mercado comprimido?" | Continuation | abs(score) ≥ 0.25 |
| Trap Detection | "¿Acaba de fallar este breakout?" | Mean-reversion (vs. ruptura de precio) | abs(score) ≥ 0.25 |
| Volatility Expansion | "¿Está la volatilidad a punto de expandirse?" | Continuation | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | "¿Se están inclinando los traders 0DTE hacia un lado?" | Direccional | abs(score) ≥ 0.25 |

## Lectura rápida de cada una

### EOD Pressure

Activa en los últimos 90 minutos. Sube a partir de las 14:30 ET, con pico alrededor de las 15:45 ET. Construida a partir del dealer charm en el spot, la pin gravity, la volatilidad realizada y las flags de witching. Indica "el cierre se está fijando en X" con una dirección.

### Gamma/VWAP Confluence

Apila el gamma flip, el VWAP, el max pain, el strike de máximo gamma y la call wall. Pregunta si estos niveles están alineados en un precio. En gamma positivo, las lecturas de confluencia son de fade; en gamma negativo, son lecturas de continuation.

### Market Pressure Index

La lectura integral de "el mercado está cargado". Combina el wall pinch, la proximidad al flip, el régimen, vanna/charm, el DNI, el skew entre el flujo premium y el smart money, el rango de IV y la compresión de la volatilidad realizada. Bidimensional: un **loading de 0 a 100** y una **dirección de -1 a +1**.

### Range Break Imminence

Lectura de compresión de 20 barras. Skew delta + dealer delta + trap pressure + ratio de compresión de 10/60 barras. Genera tanto un puntaje como una imminence de 0 a 100. Se dispara con imminence ≥ 65 — lo que significa que el rango es realmente estrecho en relación con su historial reciente.

### Squeeze Setup

Detector de setups multidía. Z-score del flujo, momentum de 5/10 barras, preparación del gamma, distancia al flip, régimen del VIX. Sesgo de continuation — indica "el mercado está comprimido, el próximo tramo es X".

### Trap Detection

El detector de breakouts fallidos. Walls (actual + previa), VWAP, flip, net GEX y ΔGEX, deltas de flujo. Sesgo de mean-reversion — se dispara cuando una ruptura por encima de la call wall o por debajo de la put wall retrocede bruscamente.

### Volatility Expansion

Ventana de momentum de 5 barras escalada por la volatilidad realizada. Net GEX + z-score de momentum normalizado por volatilidad + volatilidad realizada. Pregunta si la volatilidad está a punto de expandirse. Lectura de continuation.

### 0DTE Position Imbalance

Lectura sobre la ventana 0DTE. Ponderada por las horas hasta el cierre. Desequilibrio del flujo call/put, ratio C/P del smart money, PCR, buckets de moneyness. Indica hacia qué lado se inclinan hoy los traders 0DTE.

## Cómo funcionan los triggers

Cuando el trigger de una señal se cruza:

1. La tarjeta de la señal en el dashboard se ilumina en la dirección del puntaje.
2. Aparece una entrada en el [Live Bulletin](/help/platform/live-bulletin) con el puntaje, el umbral del trigger y un contexto de una línea.
3. El composite refleja la mayor convicción.

Una señal puede permanecer en estado "hot" durante varias barras. La entrada del bulletin muestra el **primer** cruce del trigger; las barras posteriores dentro del mismo estado hot se agregan.

## Cómo leer el dashboard

Dos patrones:

1. **Buscar triggers activos.** Las tarjetas hot suben a la parte superior en el diseño predeterminado.
2. **Buscar triggers apilados.** Dos o más señales Advanced disparándose en la misma dirección son la lectura de mayor confluencia en la plataforma. Añade el composite para la lectura estructural.

## Cada tarjeta tiene una página de análisis en profundidad

Haz clic en cualquier tarjeta y accederás a la página individual de la señal con el sparkline del puntaje, los inputs, el historial de triggers y la explicación "Cómo está construido".

## Importante: el sesgo de trading importa

Algunas señales Advanced son de continuation, otras de mean-reversion. Que Trap Detection se dispare en positivo **no** significa "ponerse long" — significa "hacer fade del breakout fallido a la baja". Verifica siempre el chip de sesgo de trading en la tarjeta.

## Ver también

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
