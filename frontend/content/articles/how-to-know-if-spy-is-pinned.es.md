# Cómo saber si SPY está pinneado: las cinco señales

*Cómo saber si SPY está pinneado hoy — las cinco señales estructurales de que el precio está siendo imantado hacia un strike, y el playbook de trading (fadear los extremos, evitar el medio) que recompensa un tape pinneado.*

---

## Reconocer el pin es el filtro más limpio para el day-trading

La mayoría de las pérdidas en day-trading provienen de aplicar el playbook equivocado para el régimen del momento. La versión con mayor apalancamiento de este error es intentar tradear momentum en un tape pinneado. SPY se comprime hacia un strike, compras el primer impulso, revierte, vendes la primera caída, rebota. Muerte por chop. A las 14:00 ET estás perdiendo un 1,5% en un día en que SPY apenas se movió un 0,3%.

La solución es el reconocimiento de régimen: saber cuándo SPY está pinneado y cambiar de playbook en consecuencia. Un tape pinneado recompensa fadear los extremos del rango de compresión; castiga todo lo demás. Una vez que puedes reconocer el pin en tiempo real, la selección de operaciones mejora de inmediato.

Este artículo repasa las cinco señales estructurales de que SPY está pinneado hoy, el playbook que funciona en ese régimen, y cuándo se rompe el pin. Para la explicación relacionada sobre el mecanismo del pinning en sí, consulta [¿Por qué SPY se pinnea cerca de un strike?](/education/why-spy-pins-near-strikes); para el contexto más amplio del régimen, el [pilar de Gamma Exposure](/education/gamma-exposure-explained).

---

## Qué es en realidad un pin

Un pin es lo que ocurre cuando el hedging de los dealers produce una atracción estructural hacia un strike con gamma pesado. La mecánica:

1. Un strike específico — normalmente la mayor concentración de calls/puts 0DTE — acumula un gamma de dealer elevado.
2. El régimen es **long-gamma**: los dealers se cubren vendiendo fortaleza y comprando debilidad.
3. Cuando el spot sube por encima del strike, los dealers venden — tirando del precio hacia abajo.
4. Cuando el spot cae por debajo del strike, los dealers compran — tirando del precio hacia arriba.
5. El efecto neto es un precio que oscila en un rango estrecho *alrededor* del strike. El strike actúa como un imán.

Los pins no son psicológicos. Son el resultado visible del hedging forzado sobre una concentración de strike. Se forman de manera más fiable en los días de OPEX, a fin de mes, y hacia el cierre en efectivo — en cualquier lugar donde las opciones del mismo día o de vencimiento cercano dominen el perfil de gamma.

El mecanismo completo está en [¿Por qué SPY se pinnea cerca de un strike?](/education/why-spy-pins-near-strikes).

---

## Las cinco señales de que SPY está pinneado hoy

### Señal 1: El Net GEX es significativamente positivo (régimen long-gamma)

El pin solo ocurre en un régimen long-gamma. El spot debe estar por encima del gamma flip, y el Net GEX debe ser sustancial (el umbral estándar que observa la mayoría de los analistas es de aproximadamente $500M+ para la escala de SPY, aunque la magnitud importa más que cualquier número específico).

Si el Net GEX es negativo o cercano a cero, la tesis del pin queda descartada. El reflejo de los dealers no está tirando — está persiguiendo el precio o es neutral. Descarta por completo el playbook del pin.

### Señal 2: El max pain y el imán de gamma coinciden cerca del spot

Dos strikes estructurales que vale la pena revisar: el **max pain** (el strike donde el pago a los tenedores de opciones se minimiza al vencimiento) y el **imán de gamma** (el strike con el mayor gamma absoluto). Cuando ambos apuntan al mismo nivel y ese nivel está dentro del 0,3% del spot actual, la tracción estructural está en su punto más agudo.

Cuando divergen, generalmente gana el imán de gamma — es el mecanismo de hedging real, mientras que el max pain es la geometría del payoff. Consulta [Max Pain explicado](/education/max-pain-explained) para conocer la diferencia.

### Señal 3: El spot ha estado oscilando alrededor del imán durante la última hora

Una lectura en vivo: grafica SPY contra el strike del imán de gamma en un timeframe de 5 minutos. Si el precio ha cruzado la línea del imán tres o más veces en los últimos 60 minutos, con cada excursión cada vez más pequeña, el pin se está formando. El rango de compresión se estrecha a medida que el imán tira con más fuerza cerca del vencimiento.

Lo contrario — el precio derivando de forma constante por encima o por debajo del imán sin regresar — es un argumento en contra del pin. El precio está en una dirección, no en un rango.

### Señal 4: La volatilidad realizada se ha comprimido por debajo de la implícita

Esta requiere una lectura de volatilidad: si la vol intradía realizada de SPY en la última hora está materialmente por debajo de la vol implícita del día, el reflejo de los dealers está haciendo su trabajo. El hedging long-gamma amortigua la vol realizada; un pin exitoso se manifiesta como realizada < implícita.

Si la realizada se está *expandiendo* (el precio se mueve más de lo esperado), el pin no se sostiene. El libro de los dealers está siendo desbordado por otro flujo.

### Señal 5: El EOD Pressure está cerca de cero dentro de la ventana activa

Después de las 14:30 ET, la señal EOD Pressure se vuelve informativa. Una lectura cercana a cero (entre -0,20 y +0,20) durante la ventana activa es la firma estructural de un pin — los términos de charm y pin-gravity se están cancelando mutuamente, lo cual ocurre cuando el precio está posado justo en el strike del imán.

Una lectura grande, positiva o negativa, del EOD Pressure es la señal opuesta: el precio está *alejado* del imán, y el hedging forzado lo está empujando de vuelta hacia el imán (o alejándolo, en un régimen short-gamma). Consulta [Señal EOD Pressure explicada](/education/eod-pressure-explained) para la lectura completa.

---

## El playbook del tape pinneado

Cuando todas (o la mayoría) de las cinco señales se alinean, el playbook es simple y contrarian:

### Hacer: fadear los extremos del rango de compresión

La tracción estructural vuelve hacia el imán. Vender impulsos cerca de la parte alta del rango de compresión (y comprar impulsos cerca de la parte baja) es el único setup donde el reflejo de los dealers está de tu lado. Tamaño pequeño — los pins son probabilísticos, no garantizados — pero la lectura es estructural.

### No hacer: perseguir el medio del rango

El medio es donde se sitúa el imán. Comprar o vender en el medio es comprar un nivel al que el precio intenta volver estructuralmente. El valor esperado es prácticamente cero, con carry negativo por el spread y el theta. De aquí provienen la mayoría de las pérdidas en tapes pinneados — los que persiguen precio comprando cada impulso y vendiendo cada caída en el medio.

### No hacer: tomar setups de momentum

Los playbooks de momentum (breakout, expansión de volatilidad, squeeze) asumen que el movimiento se extiende. Un tape pinneado es la suposición contraria. Aplicar el playbook equivocado es la mayor parte del error.

### Hacer: reducir el tamaño de la posición

Los rangos de un tape pinneado son estrechos. Los stops son aún más estrechos. El tamaño de la posición debería reflejar la recompensa menor (y la distancia menor hasta el imán para el stop). Tratar un tape pinneado con el tamaño de posición de un día normal es pedir stops prematuros.

---

## Cuándo se rompe el pin

Los pins no duran para siempre. Las condiciones que los rompen:

- **Un catalizador.** CPI, FOMC, NFP, sorpresa geopolítica. El flujo macro sobrepasa la tracción estructural.
- **Un cruce del gamma flip.** Si el spot cruza por debajo del gamma flip, el régimen se invierte. El mismo imán que estaba atrayendo el precio hacia sí en long-gamma comienza a liberar el precio en short-gamma.
- **Decaimiento del Net GEX.** A medida que las posiciones 0DTE expiran (especialmente después de las 15:30 ET), el libro de los dealers se adelgaza. El imán se debilita.
- **Un shock de un solo valor o sector.** Noticias de componentes importantes (NVDA, AAPL, MSFT) pueden desplazar el flujo del índice lo suficiente como para anular el pin.
- **El wall migra.** Si se acumula agresivamente nuevo open interest en un strike distinto, el imán se desplaza — y el pin anterior deja de ser relevante.

Vigilar estas rupturas forma parte del flujo de trabajo. Un pin que ha aguantado durante dos horas es más fiable que uno recién formado — pero un pin también puede deshacerse rápidamente cuando las condiciones dejan de sostenerlo.

---

## Ejemplo resuelto

Son las 13:30 ET de un viernes. SPY está en 581,10. ZeroGEX muestra:

- **Net GEX:** +$1,3B (long-gamma)
- **Gamma Flip:** 579,50 (spot bien por encima)
- **Imán de gamma:** 581,00 (esencialmente en el spot)
- **Max Pain:** 581,00 (coincide con el imán)
- **EOD Pressure:** +0,10 (cerca de cero — firma de pin dentro de la ventana)

SPY ha ciclado entre 580,85 y 581,30 cuatro veces en la última hora, con cada excursión cada vez más pequeña.

La lectura compuesta: las cinco señales de pin están activas. El Net GEX es saludablemente positivo, el max pain y el imán coinciden en 581, el imán se sitúa en el spot, el precio oscila con una amplitud que se estrecha, y el EOD Pressure está cerca de cero dentro de la ventana activa. Este es un pin de manual.

Inclinación práctica: fadear los extremos (puts pequeñas cerca de 581,30, calls pequeñas cerca de 580,85), evitar el medio por completo. Tamaño de posición pequeño. Vigilar las condiciones de ruptura — especialmente el decaimiento del Net GEX a medida que se acerca el cierre.

---

## Malinterpretaciones comunes

Tres trampas:

- **"Rebotó una vez en 580,85, así que está pinneado."** Un solo rebote no es un pin. Se necesitan múltiples oscilaciones *y* las condiciones estructurales (Net GEX positivo, coincidencia entre imán y spot). Un rebote es solo un rebote.
- **"Ha estado en rango todo el día, así que seguirá en rango."** Los rangos se rompen. El pin se sostiene por las condiciones estructurales *actuales*. Cuando el Net GEX decae hacia el cierre o llega un catalizador, el rango se rompe. Las condiciones estructurales se actualizan más rápido que el patrón del gráfico.
- **"Debería comprar el breakout del pin."** A veces — pero el breakout de un pin real es estadísticamente menos probable que la continuación del pin hasta que las condiciones estructurales cambien. Tratar cada incursión fuera del rango como una señal de breakout te deja largo en la parte alta y corto en la parte baja, repetidamente.

---

## Conclusión

> Un tape de SPY pinneado es una de las lecturas de régimen más limpias en el day-trading — y es el régimen en el que aplicar el playbook equivocado cuesta más caro. Las cinco señales anteriores son cómo se detecta que el régimen está activo; el playbook (fadear extremos, evitar el medio, tamaño pequeño) es lo que funciona en él.

La disciplina consiste en reconocer el pin *antes* de empezar a tradear el tape ese día, no después de haber perdido tres veces en el medio del rango. La lectura estructural está disponible desde la apertura; el reconocimiento es la ventaja.

Contenido solo educativo — nada de lo anterior es una recomendación de trading.

---

Si quieres ver el gamma flip, el Net GEX, el imán de gamma y el max pain de hoy — los cuatro niveles estructurales que determinan si SPY está pinneado hoy — la vista gratuita de gamma-levels de ZeroGEX los muestra todos.
