# ¿Qué es un put wall? Cómo los traders de opciones usan los put walls como soporte de dealers

*El put wall es el strike donde se acumula el gamma de los dealers en el lado put — normalmente el soporte más sólido respaldado por el hedging de los dealers en el tablero. Esto es lo que realmente es un put wall, por qué el precio reacciona ahí, cómo se mueve durante la sesión y cuándo aguanta frente a cuándo se rompe.*

---

## ¿Qué es un put wall?

Un **put wall** es el strike por debajo del spot que concentra la mayor exposición de gamma de los dealers en el lado put dentro de la cadena de opciones. Es el nivel de precio donde los flujos de hedging de los dealers tienen más probabilidad de *defender el lado bajista* — por eso los traders tratan el put wall como el piso estructural del rango de posicionamiento actual de los dealers.

El significado de put wall, en una frase: no es un nivel psicológico ni una media móvil — es posicionamiento real. Open interest, contrato por contrato, ponderado por el gamma que lleva cada contrato. El strike individual donde ese gamma put es más denso por debajo del precio actual es el put wall.

El put wall tiene una imagen especular por encima del spot: el [call wall](/education/what-is-a-call-wall), el strike con el gamma call más pesado, que tiende a limitar el lado alcista. Juntos, ambos walls delinean el rango que la mecánica de hedging de los dealers suele defender. Este artículo trata específicamente sobre el put wall — qué es, por qué actúa como soporte, cómo se mueve y cuándo falla la lectura. Para el panorama estructural completo, combínalo con [Gamma Walls Explained](/education/gamma-walls-explained) y el [pilar de Gamma Exposure](/education/gamma-exposure-explained).

---

## Por qué el put wall actúa como soporte

El mecanismo es el hedging de los dealers, no el sentimiento. En un régimen de **gamma positivo** — spot por encima del [gamma flip](/education/how-to-read-a-gamma-flip) — los dealers están net long gamma, y los desks que emitieron las puts pesadas en el strike del put wall están short en esas puts. Para mantenerse delta-neutrales, tienen que **comprar** el subyacente a medida que el precio cae hacia el strike, porque una posición short put gana delta largo cuando el mercado baja.

Esa compra es el soporte. A medida que el precio se desliza hacia un strike put denso, el reflejo de hedging se intensifica: un pequeño movimiento a la baja obliga a una compra de hedging relativamente mayor de vuelta hacia arriba. El resultado es un nivel donde la venta se absorbe y las caídas tienden a ser compradas — no porque nadie crea en ese número, sino porque el hedge es mecánico.

Algunas cosas que se derivan directamente del mecanismo:

- El put wall es **soporte probabilístico**, no un piso duro. Es donde se concentra el flujo absorbente, no un rebote garantizado.
- Es más fuerte en un régimen de gamma positivo y con un gamma relativo alto en el strike.
- Es una *inclinación* que un catalizador genuino — CPI, FOMC, un pico de volatilidad — puede anular en segundos.

---

## Put wall vs. call wall

Los dos walls son simétricos pero opuestos:

|Wall|Dónde|Hedge del dealer en gamma positivo|Comportamiento típico|
|---|---|---|---|
|Put wall|Gamma put más pesado por debajo del spot|Compra a medida que el precio cae hacia él|Soporte / piso bajista|
|Call wall|Gamma call más pesado por encima del spot|Vende a medida que el precio sube hacia él|Resistencia / techo alcista|

Ninguno de los dos walls es direccional por sí solo. El put wall no es "alcista" y el call wall no es "bajista" — son niveles de concentración cuyo *efecto* depende de en qué lado del gamma flip te encuentres. Por encima del flip, ambos walls absorben los movimientos. Por debajo, ambos pueden invertirse y liberarlos.

---

## Cómo se mueve el put wall durante la sesión

El put wall es una lectura viva, no una línea que fijas en la apertura y en la que confías hasta el cierre. Migra por tres razones comunes:

1. **Reequilibrio del OI.** Volumen nuevo en un strike distinto puede desplazar la concentración de gamma put más pesada. El put wall a las 10:00 ET podría estar un strike más abajo hacia el mediodía.
2. **Migración con el precio.** Si el precio baja gradualmente hacia el put wall y los traders siguen comprando protección justo por debajo, el wall puede desplazarse hacia abajo con el movimiento. Un put wall que *sigue* al precio es una lectura de soporte más débil que uno que *aguanta* — el wall va detrás, no defendiendo.
3. **Decaimiento por vencimiento.** En cadenas con mucho 0DTE, los contratos que construyeron el wall van venciendo a lo largo de la tarde. Un put wall en el que te apoyabas a las 11:00 ET puede diluirse hacia las 14:30 ET.

Leer el wall en movimiento es la mayor parte de la ventaja. Un put wall que no se ha movido en dos horas es una señal muy distinta a uno que ha bajado junto con el precio tres veces.

---

## Cuándo el put wall aguanta frente a cuándo se rompe

El put wall es una inclinación que funciona con más frecuencia cuando la estructura la respalda. Una breve lista de verificación:

**Más probable que aguante:**

- El spot está en un régimen de gamma positivo (por encima del flip).
- El strike lleva un gamma relativo grande y el Net GEX es significativamente positivo.
- El wall *no* está migrando hacia abajo con el precio.
- La venta hacia el nivel se está desacelerando.

**Más probable que se rompa:**

- El spot está en un régimen de **gamma negativo** (por debajo del flip). Aquí el reflejo del dealer se invierte — en lugar de comprar la caída, el hedging puede *sumarse* a la venta masiva, y el put wall se convierte en un punto de slippage en lugar de un piso.
- El Net GEX es pequeño o se está contrayendo rápidamente.
- El wall va detrás del precio a la baja.
- Un catalizador macro golpea mientras se está probando el nivel.
- La venta direccional se está *acelerando* hacia el strike.

El más importante de estos factores es el régimen. Un put wall en gamma positivo es un piso que los dealers defienden. El mismo strike en gamma negativo es una trampilla — una vez que el precio lo atraviesa, los flujos de hedging refuerzan el movimiento a la baja en lugar de suavizarlo.

---

## Un ejemplo resuelto

Supongamos que SPX cotiza a 5.830 y el book de dealers muestra:

- **Put Wall:** 5.790 (−0,69% desde el spot)
- **Call Wall:** 5.850 (+0,34% desde el spot)
- **Gamma Flip:** 5.810
- **Net GEX:** +1.500 millones de $

El spot está cómodamente por encima del flip, así que se trata de una sesión de gamma largo y el put wall en 5.790 es el borde más sólido del rango. La inclinación práctica: las caídas hacia 5.790 son la zona de *compra* de mayor probabilidad, y una ruptura limpia de 5.790 sería una señal real — probablemente significa un cruce del flip por debajo de 5.810 hacia gamma negativo, o un catalizador lo bastante fuerte como para superar el hedge. Por debajo del flip, ese mismo 5.790 deja de ser soporte y puede acelerar el siguiente tramo bajista.

Cambia una variable — digamos que el put wall migra de 5.790 a 5.782 mientras el precio sondea 5.795 — y la lectura cambia con él. El wall ahora va detrás del precio a la baja, la inclinación de soporte se debilita, y una ruptura se vuelve más creíble de lo que parecía diez minutos antes.

---

## Cómo encontrar el put wall de hoy

No tienes que calcular el gamma de los dealers a mano. ZeroGEX publica el put wall actual — junto con el call wall, el gamma flip, el max pain y el Net GEX — para los tres productos de índice más negociados, de forma gratuita y con un retraso de unos 15 minutos: consulta el put wall de hoy en [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) y [QQQ](/qqq-gamma-levels). Para la versión en vivo, de menos de un segundo, con el perfil de gamma completo y el mapa de calor strike por DTE, el [dashboard GEX 0DTE en tiempo real](/real-time-gex-0dte) traza el put wall a medida que migra a lo largo de la sesión.

---

## Conclusión

> El put wall es posicionamiento real, no psicología — el strike donde el hedging de los dealers tiene más probabilidad de defender el lado bajista. Pero solo es un piso mientras el spot esté en gamma positivo. Lee primero el régimen, luego el wall, y en tercer lugar la migración del wall.

Solo contenido educativo — nada de lo anterior es una recomendación de trading.

---

¿Quieres verlo en tiempo real? Consulta hoy los **put walls de SPX / SPY / QQQ** en ZeroGEX — las páginas gratuitas de niveles gamma de [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) y [QQQ](/qqq-gamma-levels) trazan el put wall junto al [call wall](/education/what-is-a-call-wall), el gamma flip y el Net GEX. Para los niveles que más importan como soporte y resistencia, consulta [soporte y resistencia basados en opciones](/education/options-support-and-resistance), y para la lectura en vivo, abre el [dashboard GEX 0DTE en tiempo real](/real-time-gex-0dte).
