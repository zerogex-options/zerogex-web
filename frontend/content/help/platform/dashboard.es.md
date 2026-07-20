# Cómo leer el Dashboard

*La página que abres primero cada mañana. Cada panel, cada gráfico, cada señal explicada.*

---

## Para qué sirve el Dashboard

El Dashboard es la **lectura en una sola pantalla** del mercado actual. Responde, en 30 segundos, a tres preguntas:

1. **¿Cómo están posicionados los dealers?** (el régimen GEX)
2. **¿Qué dice el tape?** (flow + técnica)
3. **¿Cuál es la lectura compuesta?** (señales combinadas en una única dirección)

En el Dashboard no tomas decisiones. Te orientas. A partir de ahí, entras en la página adecuada.

## La anatomía

### 1. El encabezado de régimen

La parte superior de la página muestra la **etiqueta del régimen GEX** — Positive Gamma, Negative Gamma o Transitioning — junto con una breve lectura de lo que eso significa ahora mismo para el comportamiento del mercado. Si solo tienes tiempo para un dato hoy, es este.

### 2. El panel de precio

El panel de precio principal muestra el último precio en vivo, la variación respecto al cierre de la sesión anterior y el badge de sesión. Las cotizaciones de pre-market y after-hours se muestran con el cierre anterior como referencia; durante el horario regular, la referencia es la apertura de la misma sesión.

### 3. El panel Net GEX

El panel Net GEX es la cifra principal de exposición gamma — calculada **en spot** para que refleje el lado correcto del gamma flip. Un número positivo significa que los dealers están net long gamma; negativo, que están net short. El color y el chip de tendencia refuerzan el signo y la dirección.

### 4. El panel Gamma Flip

Distancia al flip — tanto en strike como en porcentaje del spot. El flip es el nivel en el que la curva de gamma de los dealers cruza cero. Por encima del flip, el hedging de los dealers amortigua los movimientos; por debajo, los amplifica. Cuanto más cerca estés del flip, mayor es el riesgo estructural de un cambio de régimen.

### 5. Los paneles Call Wall / Put Wall

Los strikes con el mayor gamma de calls y de puts, respectivamente. Tienden a actuar como resistencia y soporte intradía, especialmente cuando el mercado está en gamma positivo. Consulta [Gamma Walls Explained](/education/gamma-walls-explained) para la lectura estructural.

### 6. El panel Max Pain

El strike que minimiza el valor total en dólares de las opciones en circulación al vencimiento. Es más relevante dentro de las últimas 24–48 horas antes de un vencimiento significativo. Consulta [Max Pain Explained](/education/max-pain-explained).

### 7. Los paneles de Volatilidad

IV en vivo, IV rank y volatilidad realizada con sparklines. Útiles para el dimensionamiento — un Squeeze Setup con volatilidad realizada baja es un trade distinto al de una volatilidad alta.

### 8. La sección Trade Bias

Un chip de bias combinado ("Long bias", "Short bias", "Neutral") con los inputs que contribuyen debajo. Es una síntesis de lectura de arriba hacia abajo — **no** es una señal de trading.

### 9. El panel Composite Score

El composite score MSI, el estado del trigger y los pesos de las señales que contribuyen. Para el desglose completo, haz clic en [Composite Score](/help/platform/composite-score).

### 10. El snapshot de Flow

Una lectura breve del flow ponderado por prima, el bias de smart-money y el volumen neto — tres formas distintas de mirar el tape. Las páginas completas están en [Flow Analysis](/help/platform/flow-analysis) y [Smart Money](/help/platform/smart-money).

## Cómo se actualiza el dashboard

Los paneles se actualizan en vivo. La mayoría se actualiza cada segundo durante el horario regular de negociación. La superficie GEX se actualiza a un ritmo algo más lento — normalmente cada 5–15 segundos — porque el snapshot de la cadena subyacente es el cuello de botella. No hace falta recargar la página.

## Pre-market, after-hours y mercado cerrado

El Dashboard se adapta a la sesión:

- **Pre-market / After-hours** — la cotización de horario extendido se muestra junto con el cierre de la sesión regular anterior.
- **Cerrado** — se muestra el cierre más reciente de la sesión regular; las señales reflejan el último estado calculado.

Consulta el badge de sesión en la fila del precio para confirmarlo.

## Leer el Dashboard en 30 segundos

La disciplina:

1. Lee la **etiqueta de régimen**.
2. Lee **Net GEX** y la **distancia al flip**.
3. Lee **call wall y put wall** — son tus niveles.
4. Lee el **trade bias** y el **composite score**.
5. Decide qué página abrir para el trade real.

Eso es todo. Si te encuentras pasando más de 30 segundos aquí, has dejado de orientarte y has empezado a analizar — ve a la página de señales correspondiente.

## Ver también

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Using the Live Bulletin](/help/platform/live-bulletin)
