# ¿Qué es la gamma cero? El nivel de gamma cero explicado

*La gamma cero explicada en lenguaje llano - qué es el nivel de gamma cero, cómo se relaciona con el gamma flip y con el Net GEX, qué tiende a cambiar a cada lado de él y dónde ver el nivel de gamma cero de hoy de SPX, SPY, QQQ y NDX.*

---

## ¿Qué es el nivel de gamma cero?

El **nivel de gamma cero** es el precio en el que la exposición gamma modelada de los dealers cruza cero. Por encima, el libro de opciones se modela como de gamma neta *positiva* para los dealers; por debajo, neta *negativa*. Es el mismo nivel que la mayoría de los traders llama **gamma flip**, y los dos nombres se usan indistintamente: "gamma cero" describe qué es el número (el punto en el que la gamma neta de los dealers es igual a cero), y "gamma flip" describe lo que ocurre ahí (el signo se invierte).

Esa es toda la definición, y vale la pena quedarse con la versión sencilla, porque se habla del nivel como si fuera una línea de soporte o de resistencia. No lo es. La gamma cero es un **límite de régimen**: marca dónde, según el modelo, cambia el *carácter* de la cobertura de los dealers, no dónde se espera que se detenga el precio.

De ahí se derivan directamente algunas consecuencias:

- Es un **nivel de precio, no un strike.** El cruce por cero suele estar entre strikes, porque sale de una curva - la gamma modelada de los dealers evaluada en un rango de precios spot - y no de un contrato concreto.
- **Se mueve.** A medida que cambia el open interest y los contratos existentes se revalúan con el spot, el tiempo y la volatilidad implícita, la curva cambia de forma y su cruce por cero se desplaza. El nivel de gamma cero de ayer es un número distinto del de hoy. Consulta el [nivel de gamma cero actual de SPX](/spx-gamma-levels) en cada sesión en lugar de arrastrar uno antiguo.
- Es el **resultado de un modelo.** El inventario de los dealers no es directamente observable, así que el nivel depende de una convención de signo (ZeroGEX usa la convención tradicional call-positivo / put-negativo) y de qué vencimientos y datos de entrada incluye el modelo.

## Gamma cero frente a gamma flip frente a Net GEX

Tres términos estrechamente relacionados, y las diferencias importan más de lo que parece:

| Término | Qué es | Unidad |
|---|---|---|
| **Net GEX** | La gamma neta modelada de los dealers en toda la cadena, evaluada al precio spot actual | Dólares con signo ("gamma en dólares"), p. ej. +1.200 millones de dólares |
| **Nivel de gamma cero** | El precio spot en el que esa gamma neta modelada sería igual a cero | Un precio, p. ej. 5.815 |
| **Gamma flip** | El mismo nivel, llamado así por el cambio de signo que se produce ahí | Un precio |

Así que el Net GEX es una *lectura* y la gamma cero es un *nivel*. Son dos vistas de una misma curva: cuando el spot está por encima del nivel de gamma cero, el Net GEX en el spot es positivo; cuando el spot está por debajo, el Net GEX en el spot es negativo. Si alguna vez parece que no coinciden - una lectura positiva del Net GEX con el spot por debajo del flip publicado -, el modelo te está diciendo que encontró más de un cruce por cero, o que la lectura y el nivel proceden de instantáneas distintas. Consulta [Net GEX de SPX hoy](/education/spx-net-gamma-exposure-today) para saber cómo leer la propia cifra en dólares.

## Cómo se encuentra el nivel de gamma cero

La forma rápida de localizar la gamma cero es sumar la gamma con signo por strike, desde el strike más bajo hacia arriba, y marcar dónde cruza cero el total acumulado. Es rápida, y también se equivoca más a menudo de lo que parece, porque trata la gamma de cada contrato como fija cuando en realidad la gamma depende de dónde esté el spot.

El enfoque mejor - el que adoptó ZeroGEX - revalúa todo el libro en cada precio spot candidato, calcula la gamma neta modelada de los dealers *como si el spot estuviera ahí* y lee dónde cruza cero ese perfil. La [guía de cálculo del Gamma Flip](/guides/gamma-flip-calculation-before-vs-after) recorre ambos métodos y explica por qué el perfil con spot-shift es el que merece confianza.

Del método mejor se desprenden dos cosas:

1. **El nivel puede no existir.** Si el perfil nunca cruza cero cerca del spot - muy dentro de un régimen, una cadena poco poblada o de un solo lado, un pico de volatilidad implícita que hunde la gamma modelada de forma generalizada -, no hay un nivel de gamma cero honesto que publicar, y ZeroGEX lo deja en blanco en lugar de inventarse uno. El signo del Net GEX sigue diciéndote en qué régimen estás.
2. **Puede haber más de uno.** Una cadena irregular puede producir dos cruces. ZeroGEX publica el que está lo bastante cerca del spot como para ser operable y está respaldado por open interest real; conviene saber que puede haber un segundo más alejado.

## Qué tiende a cambiar por encima y por debajo de la gamma cero

El signo de la gamma modelada de los dealers es lo que decide si la cobertura se inclina *en contra* de los movimientos o *a favor* de ellos.

**Por encima del nivel de gamma cero (gamma positiva).** Los dealers se modelan como netos largos de gamma. Para mantenerse delta-neutral tienden a vender en la fortaleza y comprar en la debilidad, lo que empuja en contra de la dirección del movimiento. La volatilidad realizada tiende a comprimirse, los rangos tienden a ser más estrechos y el precio tiende a gravitar hacia los strikes con más peso de cara al cierre. La cobertura se opone a los breakouts en lugar de alimentarlos.

**Por debajo del nivel de gamma cero (gamma negativa).** Los dealers se modelan como netos cortos de gamma. El mismo reflejo de cobertura acompaña ahora al movimiento - comprando la fortaleza, vendiendo la debilidad - y la volatilidad realizada tiende a expandirse. Los rangos se amplían, una ruptura que sí se produce tiene la cobertura a su favor, y el pinning que se mantenía por encima del nivel tiende a soltarse. [Qué significa la gamma negativa](/education/what-is-negative-gamma) trata este régimen en profundidad.

**En el propio nivel.** Un spot situado en la gamma cero es el estado menos informativo, no el más. Las contribuciones modeladas positivas y negativas se compensan aproximadamente, la tendencia neta de la cobertura es débil, y un pequeño cambio en los datos de entrada puede invertir el signo. Los traders que usan el nivel tratan esta banda como territorio disputado y no como una señal.

Nada de esto es direccional. Por encima de la gamma cero no es alcista; por debajo no es bajista. El nivel habla de la *textura* del tape - pegajoso o resbaladizo -, no de hacia dónde se dirige el precio.

## Cómo usan los traders el nivel de gamma cero

El nivel es más útil como un **filtro** que decide qué playbook está en marcha que como un disparador:

1. **Lee primero el régimen.** Antes de un setup, comprueba si el spot está por encima o por debajo de la gamma cero, y por cuánto.
2. **Adapta la táctica al lado.** Por encima: fades, operaciones de rango, paciencia cerca del [call wall y el put wall](/education/gamma-walls-explained). Por debajo: momentum, breakouts, riesgo más ajustado.
3. **Vigila la distancia y la deriva.** Un nivel lejos del spot es una lectura de régimen estable; un nivel a unas pocas décimas de porcentaje es una lectura disputada. Un nivel que migra hacia el precio a lo largo de la sesión es una señal distinta de uno que se queda quieto mientras el precio se le acerca.
4. **Comprueba la magnitud del Net GEX.** Un nivel de gamma cero con 2.000 millones de dólares de gamma modelada por encima describe un régimen más marcado que uno con 200 millones de dólares. Signo y tamaño juntos, no solo el signo.

[¿Qué es un gamma flip?](/education/how-to-read-a-gamma-flip) convierte esto en una rutina intradía, y [Cómo operar en torno a los niveles de gamma flip](/education/how-to-trade-around-gamma-flip) explica qué cambia cuando el spot cruza.

## Errores de lectura comunes

- **Tratar la gamma cero como soporte o resistencia.** Es una línea de régimen. Comprar la debilidad hacia el nivel desde arriba y comprar la debilidad desde abajo son operaciones estructuralmente distintas.
- **Leer un nivel desactualizado.** El nivel de gamma cero puede moverse varios puntos en pocas horas. Un número de la mañana leído contra el tape de la tarde es otro libro.
- **Confundirlo con el max pain.** El [max pain](/education/max-pain-explained) es un strike de geometría de payoff - donde se minimiza el valor al vencimiento para los tenedores de opciones. La gamma cero es una línea de régimen de cobertura. Responden a preguntas distintas y con frecuencia no coinciden.
- **Esperar un rebote o una ruptura en el nivel.** Que el precio cruce la gamma cero cambia el *reflejo* modelado de la cobertura. Por sí solo, no te dice si el movimiento continúa.

## El nivel de gamma cero de hoy

ZeroGEX publica el nivel de gamma cero - con la etiqueta "gamma flip" - junto con el call wall, el put wall, el max pain y el Net GEX, gratis y con unos 15 minutos de retraso, para [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) y [NQ](/nq-gamma-levels). El valor en vivo, durante toda la sesión, se actualiza dentro del dashboard. Para saber qué observa ZeroGEX y qué modela, consulta la [metodología](/methodology).

## Conclusión

> La gamma cero es el precio en el que la gamma neta modelada de los dealers es cero - el mismo nivel que el gamma flip. Por encima, la cobertura tiende a amortiguar los movimientos; por debajo, tiende a amplificarlos. Es una línea de régimen, no un objetivo, y se mueve a lo largo del día.

Solo contenido educativo - nada de lo anterior es una recomendación de trading.
