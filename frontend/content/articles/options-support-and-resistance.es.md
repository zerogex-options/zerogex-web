# Cómo identificar soporte y resistencia a partir del posicionamiento en opciones
> **Nota metodológica.** ZeroGEX estima, pero no observa, el inventario de los dealers a partir de datos públicos. El modelo conserva la convención calls positivos/puts negativos (`Net GEX = Call GEX − Put GEX`) y supone dealers netos largos de calls y cortos de puts. Las calls y puts largas tienen gamma positiva; las calls y puts cortas tienen gamma negativa. El Put Wall es la mayor concentración de gamma de puts por debajo del spot y representa localmente gamma negativa modelada del dealer: puede coincidir con soporte, pero la cobertura de una put corta no crea mecánicamente un suelo. Los walls pueden migrar por spot, tiempo y volatilidad implícita aunque el open interest oficial no cambie intradía. Al acercarse el vencimiento, la gamma se concentra cerca del ATM: la gamma ATM puede aumentar, mientras la gamma claramente ITM u OTM tiende a cero. El Gamma Flip seleccionado es una transición local; el perfil puede tener varios cruces o ninguno significativo. Charm y vanna son cambios condicionales de delta, no órdenes programadas. Las puntuaciones son resultados heurísticos, no probabilidades calibradas. La gamma negativa amplifica la dirección ya iniciada; la distancia a un objetivo no implica repulsión. Que el término pin de EOD Pressure siga el movimiento reciente cuando la gamma es negativa es una heurística de ZeroGEX. Max Pain minimiza el pago intrínseco agregado y no maximiza exactamente el nocional que vence sin valor. El DEX bruto mide delta solo de opciones, no flujo futuro de cobertura; la prima y el lado agresor no prueban información, apertura ni convicción.


*El soporte y la resistencia clásicos son sobre todo psicología - líneas trazadas, swings previos, números redondos. El soporte y la resistencia basados en opciones son mecánica - posicionamiento real que impulsa flujos de cobertura reales. Así se identifican y se leen en tiempo real.*

---

## Dos tipos de soporte y resistencia

El kit de herramientas de S/R del trader minorista se deriva sobre todo del gráfico: máximos y mínimos de swing previos, líneas de tendencia, números redondos, medias móviles. Funcionan - a veces - porque suficientes traders los observan como para volverlos autocumplidos. El mecanismo es convergencia psicológica.

El soporte y la resistencia basados en opciones son diferentes. No se derivan del historial de precios; se derivan del posicionamiento actual en opciones. El mecanismo es estructural: flujos de cobertura modelados de los dealers que tienden a activarse conforme el precio se acerca a strikes concentrados. Gran parte de esta cobertura es sistemática y no discrecional - así que, cuando el signo de la gamma modelada de los dealers es el adecuado, esos flujos pueden actuar como oferta cerca de la resistencia y como demanda cerca del soporte.

Cuando el S/R de gráfico y el S/R de opciones coinciden, el nivel es notablemente más fiable. Cuando difieren, la lectura basada en opciones suele imponerse - porque el nivel de gráfico es opinión y el nivel de opciones es flujo forzado.

Este artículo es el flujo de trabajo práctico para identificar S/R basado en opciones, leerlo en tiempo real y saber qué esperar cuando el precio lo pone a prueba. Para el marco más amplio de gamma, consulta el [pilar de Exposición Gamma](/education/gamma-exposure-explained).

---

## Los cuatro tipos de S/R basado en opciones

Las etiquetas de abajo - call wall como resistencia, put wall como soporte - describen hacia dónde se inclina la cobertura modelada en un régimen de *gamma positiva*. No son propiedades fijas del strike: el tipo de opción por sí solo no fija la dirección, y la cobertura puede pasar a acompañar un movimiento cuando cambia el signo de la gamma modelada del dealer o el flujo circundante.

### 1. Call walls (resistencia)

El **call wall** es el strike por encima del spot con la mayor exposición gamma de calls. Bajo la convención tradicional, se modela a los dealers como largos en ese inventario, así que en un régimen de gamma larga tienden a vender en los rallies que se acercan al wall. Esa venta puede actuar como resistencia estructural.

Lectura práctica: en un régimen de gamma positiva, la cobertura en torno al call wall se opone a un rally; en un régimen de gamma negativa lo acompaña, así que, si el wall cede, puede convertirse en un acelerador de la ruptura (breakout). El régimen cambia ese comportamiento, no la frecuencia con la que el wall se rompe: en nuestra medición, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora, tanto por encima como por debajo del flip.

### 2. Put walls (soporte)

El **put wall** es el strike por debajo del spot con la mayor exposición gamma de puts. Cuando la gamma neta modelada es positiva, el book agregado de los dealers tiende a comprar en los selloffs que se acercan al wall. Esa compra neta puede actuar como soporte estructural - ten en cuenta que el soporte viene del signo positivo de la gamma neta, no de que el strike esté hecho de puts (bajo la convención, se modela a los dealers como cortos en esas puts).

Misma dependencia de régimen que el call wall - en gamma negativa, un put wall que cede puede convertirse en un punto de deslizamiento (slippage) en la caída.

La mecánica de los walls en ambos regímenes se explica en [Gamma Walls Explained](/education/gamma-walls-explained).

### 3. El gamma magnet (atracción hacia el pin)

El **gamma magnet** es el strike con la mayor concentración de gamma absoluta. No es direccional - atrae el precio hacia sí en un régimen de gamma larga y lo libera de sí mismo en gamma corta. Funcionalmente, actúa como soporte y resistencia a la vez: el precio por encima es arrastrado hacia abajo, hacia él; el precio por debajo es arrastrado hacia arriba.

El magnet es más fuerte cerca del vencimiento, cuando las opciones que vencen el mismo día dominan el perfil de gamma. El comportamiento de pin al cierre de la jornada suele originarse en este strike.

### 4. El gamma flip (línea de régimen)

El **gamma flip** no es S/R en el sentido tradicional - es el límite de régimen. Pero funciona como una línea de soporte/resistencia suave porque el precio tiende a pausarse o revertir brevemente al cruzarla (el reflejo del dealer cambia de signo exactamente en ese precio). Por encima del flip, el reflejo es contrarrestar (fade); por debajo, seguir la tendencia (chase).

Consulta [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) para el flujo de trabajo.

---

## ¿Por qué el SPY se da la vuelta en estos niveles?

Los giros que parecen aleatorios en un gráfico del SPY - el precio corre hasta un nivel que no era un swing previo ni un número redondo, se frena en seco y revierte - suelen ser uno de estos cuatro niveles haciendo su trabajo. En el **call wall**, los dealers modelados como largos en ese strike venden en el rally para mantenerse cubiertos, lo que añade una oferta que pone techo al movimiento. En el **put wall**, un book neto largo en gamma compra el selloff, lo que añade soporte. En el **gamma magnet**, el reflejo de cobertura modelado devuelve el precio hacia el strike. En el **gamma flip**, ese reflejo cambia de signo y el precio a menudo hace una pausa al cruzarlo. Ninguno de ellos aparece en el gráfico de precios - están en la cadena de opciones - y por eso el giro parece surgir de la nada hasta que lo relacionas con el posicionamiento. En nuestra medición, que un wall absorbiera el movimiento o fuera arrollado no dependió del régimen - los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora, tanto por encima como por debajo del flip. Lo que cambia el régimen es la cobertura en torno al nivel, así que lee primero el flip: en gamma larga, la cobertura se opone a un rally hacia el call wall; en gamma corta, se suma al movimiento una vez que ese wall cede.

---

## Por qué el S/R basado en opciones es más sólido que el S/R basado en gráficos

Tres razones:

1. **Es forzado, no elegido.** Un trader puede decidir si defiende o no una línea de tendencia. Un dealer debe cubrir su exposición gamma para mantenerse neutral - no hay opción de no participar. El flujo de cobertura ocurre independientemente de si el dealer cree en él o no.

2. **Escala con el posicionamiento, no con la atención.** Una línea de tendencia se fortalece cuantos más ojos la observan; un wall se fortalece con más open interest. Cuanto más grande sea el wall, mayor será el flujo estructural cuando el precio se acerque. La relación es mecánica.

3. **Se actualiza en tiempo real.** Las líneas de tendencia son artefactos históricos que se vuelven obsoletos a medida que el precio se mueve. Los walls se mueven con el posicionamiento - nuevo OI que se acumula por encima del call wall lo empuja más alto, y la lectura estructural se actualiza en consecuencia. El nivel que ves a las 10:30 ET es el nivel que importa ahora mismo.

Dicho esto, el S/R basado en opciones no es infalible. Es una inclinación probabilística. Los shocks macro y los eventos catalizadores lo anulan con regularidad, y un cambio de régimen cambia lo que hace la cobertura. La ventaja es que la inclinación está *fundamentada* - cuando funciona, funciona por una razón verificable.

---

## Cómo identificar los niveles en tiempo real

Un flujo de trabajo breve:

1. **Consulta primero el gamma flip.** Te dice en qué régimen estás. El flip en sí mismo también es un nivel suave que vale la pena vigilar.
2. **Identifica el call wall y el put wall.** Te dan el rango estructural - los límites en los que la cobertura de los dealers se opone al movimiento (en un régimen de gamma larga) o se suma a un movimiento que los atraviesa (en un régimen de gamma corta).
3. **Identifica el gamma magnet.** Suele ser el strike 0DTE con más peso. El magnet te indica hacia dónde se ve atraído el precio dentro del rango de los walls.
4. **Revisa la migración.** Un wall que acaba de saltar es una referencia distinta de uno que lleva horas estable: un wall que migra está persiguiendo al precio, así que el nivel que vigilas se ha movido. En nuestra medición, ni la antigüedad de un wall ni su migración predijeron si se rompería.
5. **Contrasta con el S/R de gráfico.** Donde el nivel estructural coincide con un nivel basado en gráfico (número redondo, swing previo, media móvil clave), la convergencia puede hacer que el nivel sea más nítido.

---

## Cuándo se mantiene el nivel estructural

En nuestra medición de 737 pruebas de walls, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora tras ser puestos a prueba y los del Nasdaq, aproximadamente la mitad ([¿Con qué frecuencia se rompen realmente los gamma walls?](/education/how-often-do-gamma-walls-break)). Las condiciones que los traders suelen comprobar no mejoraron esa tasa base:

- Si el spot estaba en un **régimen de gamma positiva** (por encima del flip) o en uno de gamma negativa.
- Si el Net GEX era **sustancial y estable** o estaba decayendo.
- Si el wall estaba **migrando** con el precio.
- Si el flujo en el strike del wall se estaba **acelerando** o desacelerando.
- Cuánto tiempo llevaba el wall en pie y cuántas veces se había puesto a prueba.

Así que la estimación a priori honesta para cualquier wall es la tasa base de su índice, no una lista de comprobación.

## Cuándo se rompe el nivel estructural

Lo que cambia el régimen es lo que hace la cobertura cuando un nivel cede:

- En un **régimen de gamma positiva**, la cobertura se opone al movimiento, así que una ruptura tiene menos cobertura a su favor.
- En un **régimen de gamma negativa**, los dealers persiguen al precio en lugar de contrarrestarlo, así que su cobertura se suma a la ruptura.
- A medida que el spot, el tiempo o la volatilidad cambian la clasificación de los strikes, el wall puede **migrar**, y el nivel que vigilabas deja de ser el strike más pesado.
- Un **catalizador** que llegue durante la prueba puede desbordar la cobertura en cualquiera de los dos regímenes.

Nada de esto hace que un nivel tenga más probabilidades de fallar que de mantenerse. Leer primero el régimen te dice con qué mecanismo estás operando, no las probabilidades.

---

## Ejemplo trabajado

SPY está en 581,50. El análisis de gráfico estándar muestra resistencia alrededor de 583 (máximo de swing previo) y soporte alrededor de 580 (media móvil de 50 días, número redondo). ZeroGEX muestra:

- **Call Wall:** 583,50 (cerca de la resistencia del gráfico, pero no exactamente en ella)
- **Put Wall:** 580,00 (justo en el soporte del gráfico)
- **Gamma Flip:** 580,80 (entre el spot actual y el put wall)
- **Gamma magnet:** 581,00 (prácticamente en el spot)
- **Net GEX:** +$1.100 M, estable

La lectura estructural compuesta:

- El call wall y la resistencia del gráfico coinciden cerca de 583 - la zona de resistencia de mayor confianza está justo donde la ven los traders de gráficos, pero el posicionamiento modelado sitúa el wall en 583,50, no en el redondo 583.
- El put wall y el soporte del gráfico también coinciden cerca de 580 - una lectura de soporte más sólida ahí.
- El gamma magnet en 581,00 significa que el precio puede tener una atracción estructural hacia más o menos donde se encuentra ahora mismo. Mientras se mantenga la gamma positiva, la cobertura se opone a los movimientos en ambas direcciones.
- El flip en 580,80 significa que una caída por debajo de 580,80 cambiaría el régimen modelado; si eso ocurre primero y después el put wall en 580 cede, la cobertura se suma al movimiento en lugar de amortiguarlo.

La lectura: la cobertura modelada se opone a los movimientos hacia cualquiera de los extremos del rango 581-583,50, pero cada wall sigue siendo una apuesta a la tasa base - en nuestra medición, los walls del SPY aguantaron aproximadamente dos de cada tres veces en el plazo de una hora, independientemente del lado del flip en que estuviera el precio. La lectura estructural aporta dónde están los niveles y qué hace la cobertura en torno a ellos; no te dice cuál de ellos cederá.

---

## Malinterpretaciones comunes

- **"Está en el máximo de swing previo, así que es resistencia."** A veces. A veces el nivel estructural real está 30 centavos más arriba o más abajo - y el movimiento que "rompió" la resistencia del gráfico siempre iba a extenderse hasta el wall real.
- **"El put wall está en 580, así que 580 va a aguantar."** No de forma fiable, en ninguno de los dos regímenes: en nuestra medición, los walls del S&P se rompieron en aproximadamente una de cada tres pruebas en el plazo de una hora, tanto en gamma larga como en gamma corta. Lo que cambia el régimen es lo que viene después - en gamma corta, un put wall que cede puede convertirse en un punto de deslizamiento.
- **"El S/R basado en opciones no funciona."** Localiza posicionamiento real, y en nuestra medición los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora. Lo que no te da es una forma de saber de antemano qué wall se romperá: no lo lograron ni el régimen, ni el Net GEX, ni la migración, ni el flujo en el strike.

---

## Conclusión

> El soporte y la resistencia basados en opciones son mecánica, no psicología. Identifican los niveles donde la cobertura de los dealers realmente se disparará - y el régimen te dice si ese disparo absorbe el movimiento o lo amplifica.

La disciplina consiste en leer primero el mapa estructural, contrastarlo con los niveles basados en gráficos para buscar convergencia, y verificar el régimen antes de decidir qué hacer con el nivel. Gran parte del aparente "ruido" en el S/R de gráfico minorista es la brecha entre dónde dicen los gráficos que está el nivel y dónde lo coloca realmente el posicionamiento.

Contenido solo educativo - nada de lo anterior es una recomendación de trading.

---

Si quieres ver el call wall, el put wall, el gamma flip y el gamma magnet de hoy para SPY, SPX, QQQ y NDX - los cuatro niveles estructurales que impulsan la mayor parte del S/R basado en opciones - la vista gratuita de gamma-levels de ZeroGEX los muestra.
