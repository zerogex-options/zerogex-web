# Advanced Signal Dashboard

*Las señales event-driven - qué pregunta cada una, cuándo se dispara y cómo usarla.*

---

## Qué es el Advanced Signal Dashboard

El Advanced Signal Dashboard (Pro) es la **cuadrícula de triggers** para las ocho señales Advanced. Una franja en la parte superior muestra los ocho puntajes. Debajo hay tres pestañas - **Signal Grid**, **Confluence Matrix** y **Event Timelines**. Cada tarjeta de la cuadrícula muestra el puntaje de -100 a +100, el nivel en el que se activa, un estado *Triggered* o *Stand by*, un sparkline y unos **Context values** desplegables. EOD Pressure y 0DTE Position Imbalance muestran *Inactive* mientras su ventana horaria está cerrada.

Las señales Advanced son **event-driven**. Cada una produce un puntaje continuo y modelado - una lectura derivada, no un pronóstico garantizado -, pero el momento interesante es cuando el puntaje cruza el umbral de trigger de la señal. Ninguna de las ocho forma parte del Composite Score (MSI).

## Las ocho señales

| Señal | Pregunta | Sesgo de trading | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | "¿Se está fijando (pinning) el cierre?" | Direccional | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | "¿Se están apilando niveles clave aquí?" | Mean-rev (long gamma) / Continuation (short gamma) | \|score\| ≥ 20 |
| Market Pressure Index | "¿Está el mercado cargado para moverse?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | "¿Está este rango a punto de romperse?" | Cambio de régimen / playbook | imminence ≥ 65 |
| Squeeze Setup | "¿Está el mercado comprimido?" | Continuation | \|score\| ≥ 25 |
| Trap Detection | "¿Acaba de fallar este breakout?" | Mean-reversion (vs. ruptura de precio) | \|score\| ≥ 25 |
| Volatility Expansion | "¿Está la volatilidad a punto de expandirse?" | Continuation | \|score\| ≥ 25 |
| 0DTE Position Imbalance | "¿Se están inclinando los traders 0DTE hacia un lado?" | Direccional | \|score\| ≥ 25 |

## Lectura rápida de cada una

### EOD Pressure

Activa en los últimos 90 minutos. Sube a partir de las 14:30 ET, con pico alrededor de las 15:45 ET. Construida a partir del dealer charm en el spot, la pin gravity, la volatilidad realizada y las flags de witching. Indica "el cierre *podría* fijarse hacia X" con una dirección - un sesgo modelado, porque el pinning es probabilístico.

### Gamma/VWAP Confluence

Apila el gamma flip, el VWAP, el max pain, el strike de máximo gamma y la call wall. Pregunta si estos niveles están alineados en un precio. En gamma positivo, las lecturas de confluencia son de fade; en gamma negativo, son lecturas de continuation.

### Market Pressure Index

La lectura integral de "el mercado está cargado". Combina el wall pinch, la proximidad al flip, el régimen, vanna/charm, el DNI, el skew entre el flujo premium y el smart money, el rango de IV y la compresión de la volatilidad realizada. Bidimensional: un **loading de 0 a 100** y una **dirección de -1 a +1**.

### Range Break Imminence

Lectura de compresión de 20 barras. Skew delta + dealer delta + trap pressure + ratio de compresión de 10/60 barras. Genera tanto un puntaje como una imminence de 0 a 100. Se dispara con imminence ≥ 65 - el inicio de la banda Break Watch (de 80 en adelante es Breakout Mode), donde la página indica dejar de hacer fade del rango a ciegas.

### Squeeze Setup

Detector de setups multidía. Z-score del flujo, momentum de 5/10 barras, preparación del gamma, distancia al flip, régimen del VIX. Sesgo de continuation - una lectura derivada de que el mercado *podría* estar comprimido hacia X, no un próximo tramo garantizado.

### Trap Detection

El detector de breakouts fallidos. Walls (actual + previa), VWAP, flip, net GEX y ΔGEX, deltas de flujo. Sesgo de mean-reversion - marca como probable fallo una ruptura de un nivel clave (una wall, el VWAP, el gamma flip o el strike de máximo gamma) cuando se modela a los dealers long gamma y el gamma se está fortaleciendo; una wall que migra junto con la ruptura debilita la lectura. En gamma negativo se queda en 0.

### Volatility Expansion

Ventana de momentum de 5 barras escalada por la volatilidad realizada. Net GEX + z-score de momentum normalizado por volatilidad + volatilidad realizada. Pregunta si la volatilidad está a punto de expandirse. Lectura de continuation.

### 0DTE Position Imbalance

Lectura sobre la ventana 0DTE. Ponderada por las horas hasta el cierre. Desequilibrio del flujo call/put, ratio C/P del smart money, PCR, buckets de moneyness. Indica hacia qué lado se inclinan hoy los traders 0DTE.

## Cómo funcionan los triggers

Cuando el trigger de una señal se cruza:

1. Su tarjeta se resalta con un borde y se tiñe en la dirección del puntaje, y su estado cambia de *Stand by* a *Triggered*.
2. El Composite Score no cambia - las señales Advanced no forman parte del MSI.

No hay alerta ni entrada de registro: no se te envía nada y nada llega al Boletín en vivo. Una tarjeta sigue en *Triggered* mientras el puntaje se mantenga más allá de su umbral. Para ver lo que ocurrió antes, abre la pestaña **Event Timelines** o la página de la propia señal - la timeline traza el puntaje de las dos últimas sesiones con los cambios de dirección marcados.

## Cómo leer el dashboard

Dos patrones:

1. **Buscar triggers activos.** Las tarjetas disparadas aparecen resaltadas y teñidas en la cuadrícula. Las tarjetas mantienen un orden fijo, así que busca el color.
2. **Buscar triggers apilados.** Dos o más señales Advanced disparándose en la misma dirección son la lectura de mayor confluencia en la plataforma. La pestaña **Confluence Matrix** muestra qué pares tienden a coincidir. Añade el composite para la lectura estructural.

## Cada tarjeta tiene una página de análisis en profundidad

Haz clic en cualquier tarjeta y accederás a la página individual de la señal con el puntaje y su historial, los inputs, la explicación "How it's built" y la Event Timeline.

## Importante: el sesgo de trading importa

Algunas señales Advanced son de continuation, otras de mean-reversion. Trap Detection hace fade de una *ruptura de precio fallida*, no de un breakout: un puntaje **positivo** significa que falló una ruptura a la baja (el fade es al alza - compra la ruptura bajista fallida), un puntaje **negativo** significa que falló una ruptura al alza (el fade es a la baja) - la imagen especular de una señal de continuation como Squeeze Setup. Verifica siempre qué tipo de señal estás leyendo - [Signals: Explained](/guides/signals-explained) recoge el sesgo de trading de cada señal.

## Ver también

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
