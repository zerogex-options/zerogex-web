# Cómo leer el Panel

*La página que abres primero cada mañana. Cada franja, gráfico y tarjeta, explicados.*

---

## Para qué sirve el Panel

El Panel principal es la **lectura en una sola pantalla** del mercado actual. Responde, en 30 segundos, a tres preguntas:

1. **¿Cómo están posicionados los dealers?** (el régimen gamma y los niveles clave)
2. **¿Qué dice el tape?** (flow y volatilidad)
3. **¿Cuál es la lectura combinada?** (Trade Bias y el Composite MSI)

En el Panel no tomas decisiones. Te orientas. A partir de ahí, entras en la página adecuada.

## Simple y Detailed

El selector **Simple / Detailed** de arriba a la derecha define cuánto muestra la página. **Simple** es la opción predeterminada y deja la página pensada para un vistazo rápido: Lectura de Hoy, Señales Propietarias y Volatilidad, y Posicionamiento y Flujo empiezan contraídas - haz clic en el título de una sección para abrirla. **Detailed** abre todas las secciones. Tu elección queda guardada.

## La anatomía

### 1. Key Levels

La franja de la parte superior. Su encabezado muestra el símbolo, los vencimientos de los que salen los niveles y el chip **Long γ / Short γ**: long gamma significa que el hedging de los dealers tiende a amortiguar los movimientos (pinning); short gamma significa que tiende a amplificarlos (tendencia). Debajo hay una tarjeta por nivel, cada una con la distancia entre el precio y ese nivel:

- **Spot** - el precio en vivo y su variación.
- **Gamma Flip** - el nivel en el que el gamma modelado de los dealers cambia de signo. Por encima, el hedging amortigua los movimientos; por debajo, los amplifica. Cuanto más cerca esté el precio del flip, mayor es el riesgo de un cambio de régimen.
- **Pin Strike** - el strike 0DTE cercano donde el gamma positivo de los dealers y la probabilidad de que el precio llegue hasta él se combinan con más fuerza, con una etiqueta Strong / Moderate / Weak. Es un nivel de pinning modelado, no un objetivo de precio, y la tarjeta lo indica cuando ningún strike cumple los criterios. Consulta [Pin Strike](/help/platform/pin-strike).
- **Call Wall** y **Put Wall** - los strikes con más gamma de calls y de puts. Tienden a actuar como resistencia y soporte, especialmente en gamma positivo. Consulta [Gamma Walls explicados](/education/gamma-walls-explained).
- **Max Pain** - el strike que minimiza el valor total de las opciones en circulación al vencimiento. Es más relevante en los últimos uno o dos días antes de un vencimiento significativo. Consulta [Max Pain explicado](/education/max-pain-explained).

La franja muestra exactamente los niveles que dibuja el Gamma Chart, incluido cualquier filtro de vencimientos que hayas aplicado en el gráfico. Para cambiar de símbolo desde la franja, en escritorio pasa el cursor por encima para ver las flechas, o en el móvil deslízala.

### 2. Lectura de Hoy

Un titular y un párrafo breve, generados automáticamente, sobre el régimen del símbolo seleccionado: long gamma (pinning, menor volatilidad), short gamma (tendencia, mayor volatilidad), justo en el flip (una transición) o sin resolver cuando el flip no se puede calcular con el snapshot actual. La Lectura se construye con el mismo modelo que el [Boletín en vivo](/help/platform/live-bulletin), y al hacer clic en ella se abre el boletín completo.

### 3. El Gamma Chart

El ZeroGEX Gamma Chart es la pieza central: velas en vivo con la estructura de gamma de los dealers dibujada sobre el mismo eje de precios. Por defecto dibuja el flip y los call y put walls (**Gamma Levels**), **Max Pain**, **Pin Strike** y **VWAP**, y sombrea las zonas de gamma largo y corto (**Regime**) - cada uno es un interruptor sobre el gráfico. El **Gamma Rail**, junto a las velas, muestra el gamma neto de los dealers por precio, de modo que los walls aparecen literalmente como barras. El encabezado del gráfico muestra el precio en vivo, su variación, la sesión y el régimen de gamma de los dealers. Usa los controles del gráfico para cambiar el marco temporal y el estilo del gráfico, y para filtrar qué vencimientos alimentan los niveles. Consulta [Cómo leer los gráficos de ZeroGEX](/help/platform/reading-charts).

### 4. Trade Bias

Una única tarjeta con el estado de posicionamiento (como *Long Gamma · Bullish Flow* o *Mixed Signals*), hacia dónde se inclinan sus inputs y una puntuación de acuerdo sobre 10. Describe el posicionamiento y el flujo tal como están; **no** es una señal de trading ni un pronóstico. **Open Trade Bias** lleva al desglose completo en la página Trade Bias, que forma parte de Pro. En Basic, la tarjeta se construye sin los inputs de señales exclusivos de Pro.

Debajo de la tarjeta, **How to read these signals** (contraído) explica cómo encajan Trade Bias, el Composite MSI, las señales Basic y las señales Advanced.

### 5. Señales Propietarias y Volatilidad

- **Composite MSI** - un indicador de régimen de 0-100: 70 o más es **Trend / Expansion**, 40-70 **Controlled Trend**, 20-40 **Chop / Range** y por debajo de 20 **Compression**, la banda en la que los movimientos han recorrido menos. Un MSI alto no significa alcista - significa que las tendencias pueden correr. Lee la dirección en Trade Bias o en las señales individuales.
- **Signal Breadth** - cuántas señales tienen sesgo alcista, neutral o bajista, con la más fuerte de cada lado.
- **Regime Triggers** (Pro) - lo preparado que está el mercado para un cambio de régimen, a partir de Volatility Expansion, Range Break Imminence y Market Pressure. Lee la magnitud de cada puntuación, no su signo.
- **Monitor de Volatilidad** - dos indicadores: **Level** (VIX, o VXN para QQQ y NDX) y **Momentum** (si la volatilidad se desploma, se relaja, se mantiene estable, sube o se dispara).

### 6. Posicionamiento y Flujo

- **Call GEX** y **Put GEX** - la exposición gamma total de calls y de puts.
- **Call Wall (Resistencia)** y **Put Wall (Soporte)** - el mayor gamma de calls en el spot o por encima de él y el mayor gamma de puts en el spot o por debajo de él, con la distancia al spot. Se clasifican sobre el vencimiento de hoy y los dos siguientes (0-2DTE), así que si has filtrado el gráfico solo a 0DTE, la franja Key Levels puede mostrar otro strike.
- **Flujo Neto**, **Prima Neta** y **Ratio Put/Call** - para la sesión actual: contratos netos de calls menos contratos netos de puts, lo mismo en dólares de prima, y volumen de puts dividido entre volumen de calls. "Neto" significa iniciado por el comprador menos iniciado por el vendedor, así que un Flujo Neto positivo es un flujo inclinado hacia las calls.

Al final de la página aparecen el recordatorio de que el posicionamiento de los dealers es modelado, no observado directamente, y la hora de la última actualización.

## Cómo se actualiza el panel

Todo se actualiza en vivo, así que no hace falta recargar la página. El precio se actualiza cada segundo. Los niveles y las señales se recalculan aproximadamente una vez por minuto, y la página recoge cada nuevo cálculo en pocos segundos. Los indicadores de volatilidad se actualizan aproximadamente cada 30 segundos.

## Pre-market, after-hours y mercado cerrado

La sesión que aparece en el encabezado del Gamma Chart te indica de qué sesión es el precio. Fuera del horario regular, los niveles y las señales reflejan el cálculo más reciente.

## Leer el Panel en 30 segundos

La disciplina:

1. Lee el chip **Long γ / Short γ** y dónde se sitúa el Spot respecto al **Gamma Flip**.
2. Lee el **Call Wall** y el **Put Wall** - son tus niveles. Cerca del vencimiento, revisa también el **Pin Strike**.
3. Echa un vistazo a la tarjeta **Trade Bias**.
4. Abre la **Lectura de Hoy** si la quieres en palabras.
5. Decide qué página abrir para el trade real.

Eso es todo. Si te encuentras pasando más de 30 segundos aquí, has dejado de orientarte y has empezado a analizar - ve a la página de señales correspondiente.

¿Quieres tu propia disposición? [Mi panel](/my-dashboard) te permite montar un tablero con widgets, incluido Key Levels, y en escritorio puedes dividirlo para seguir dos símbolos uno al lado del otro.

## Ver también

- [Cómo funcionan los Signals de principio a fin](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Usar el Live Bulletin](/help/platform/live-bulletin)
- [Pin Strike](/help/platform/pin-strike)
