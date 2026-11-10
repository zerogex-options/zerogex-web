# Gamma / VWAP Confluence explicado - y por qué dos símbolos pueden discrepar

*Qué mide el score de confluencia, cómo se construye el clúster, por qué el régimen de gamma convierte la misma imagen de un fade en un breakout, y por qué SPX, SPY y QQQ pueden apuntar en direcciones opuestas la misma tarde.*

---

## La pregunta que responde

Cada nivel de posicionamiento de los dealers responde a una pregunta ligeramente distinta. El [gamma flip](/education/how-to-read-a-gamma-flip) marca la frontera del régimen. Los [walls](/education/gamma-walls-explained) marcan gamma concentrada de un solo lado. El [max pain](/education/max-pain-explained) marca un imán de liquidación. [Pin Strike](/education/pin-strike-explained) marca un atractor del mismo día que es alcanzable. El VWAP marca dónde se negoció realmente el volumen de la sesión.

La mayoría de los días están dispersos y los lees de uno en uno. De vez en cuando, varios caen en la misma banda estrecha de precio - y esa es una situación distinta, porque que niveles calculados de forma independiente coincidan es más informativo que cualquiera de ellos por separado.

Gamma / VWAP Confluence mide exactamente eso: **¿se están apilando aquí niveles clave, y qué significa que el precio esté donde está en relación con ellos?**

Es un score de −100 a +100. El signo es direccional, la magnitud es confianza, y el régimen decide cómo leer ambos.

---

## Cómo se construye el clúster

El clúster siempre parte de dos miembros: **el gamma flip y el VWAP**. Esos dos son el núcleo, y son aquello en lo que se ancla la "confluencia".

Otros tres niveles pueden unirse si están lo bastante cerca - **el max pain, la gamma máxima (el GEX King) y el call wall**. Cada uno se admite si está a no más del **0,15% del punto medio entre el flip y el VWAP**. Es una prueba exigente: en SPX a 7.700 son unos 11 puntos.

Así que una tarjeta que muestra `Members: 2` significa que solo el flip y el VWAP están en juego. `Members: 4` significa que también se sumaron dos de los niveles opcionales, y la zona está realmente concurrida.

El **nivel de confluencia** es simplemente la media de los miembros que se hayan clasificado. Ese es el precio con el que se mide toda la señal.

Cada miembro adicional por encima de los dos del núcleo añade un 15% a la magnitud del score. Cuatro miembros suponen un multiplicador de 1,30× sobre la misma geometría - la forma que tiene el modelo de decir que una pila de cuatro niveles merece más atención que una de dos.

---

## Calidad: ¿cuán compacto es el clúster?

Pertenecer al clúster es una cosa; lo compacto que sea, otra. La **brecha del clúster** es la distancia entre el flip y el VWAP, como porcentaje del precio, y determina la **calidad del clúster**:

```
cluster_quality = 1 − (cluster_gap % ÷ 1.0%)     floored at 0.05, capped at 1.00
```

Un flip y un VWAP separados un 0,1% dan una calidad cercana a 0,90. Una brecha del 0,6% da alrededor de 0,40. Cualquier cosa por encima del 1,0% se queda en el suelo de 0,05.

Ese suelo importa, y es deliberado. En lugar de declarar "sin confluencia" y devolver cero, el modelo mantiene una lectura fraccional, porque un cero rotundo debería ser un extremo poco frecuente y no un resultado cotidiano. La consecuencia práctica: **cuando la calidad está en el suelo o cerca de él, el score es minúsculo aunque el precio esté lejos del clúster.** Un score de −5 no es una señal bajista débil; es el modelo diciéndote que los dos niveles ancla no están ni de lejos cerca el uno del otro y que no hay un clúster real que leer.

La tarjeta lo dice directamente. Por debajo de un score de ±20 muestra **"No confluence edge"** en lugar de nombrar una dirección.

---

## El régimen decide qué significa el clúster

Esta es la parte que sorprende a la gente, y es la idea más importante de esta página.

El score parte de dónde se sitúa el precio respecto al clúster:

```
distance = (price − confluence level) ÷ price
```

Esa distancia se escala de modo que aproximadamente **±0,3% satura la lectura** - más allá de eso, estar más lejos no añade nada, porque el modelo no intenta medir cuánto ha recorrido el precio, solo en qué lado está y si se ha comprometido.

Después, el [régimen de gamma](/education/what-is-negative-gamma) decide qué significa eso:

- **Gamma negativa → continuación.** La cobertura de los dealers amplifica los movimientos. Se espera que el precio que ha salido del clúster siga avanzando. Por encima del clúster la lectura es alcista; por debajo, bajista.
- **Gamma positiva → reversión a la media, y el signo se invierte.** La cobertura de los dealers amortigua los movimientos. La misma imagen sostiene ahora que el precio es atraído *de vuelta* al clúster. Por encima del clúster la lectura es **bajista**, porque el movimiento esperado es a la baja, hacia él. La lectura también se amortigua al 70% de su magnitud, porque un fade es una afirmación más débil que un breakout.

Así que la misma disposición de niveles - mismo clúster, mismo lado, misma distancia - produce **scores opuestos** en los dos regímenes. No es una contradicción. Es justamente la idea: en un régimen el mercado huye del nivel, y en el otro vuelve a él.

---

## Por qué SPX, SPY y QQQ pueden discrepar

Esto se deduce directamente, y es la pregunta que motivó esta página.

Dos símbolos pueden producir scores de confluencia opuestos la misma tarde, funcionando ambos perfectamente, por dos razones independientes.

**Primero, pueden estar en regímenes de gamma distintos.** SPX y SPY siguen el mismo índice pero tienen libros de opciones distintos, y QQQ es un índice completamente distinto. Cada uno tiene su propia gamma neta y su propio flip. Si uno está en gamma negativa y otro en positiva, el signo se invierte en uno y no en el otro. Mismo tape, scores opuestos.

**Segundo, cada uno tiene su propio clúster en su propio lugar.** El nivel de confluencia se construye a partir del flip de ese símbolo, del VWAP de ese símbolo y de los walls de ese símbolo. No se sitúan en la misma posición relativa en todos los símbolos. El precio puede estar por encima del clúster de SPX y por debajo del de QQQ al mismo tiempo, lo que vuelve a invertir el signo.

Cualquiera de las dos razones por sí sola invierte la lectura. Que se den las dos a la vez es algo habitual.

La pauta práctica: **no uses el score de confluencia de un símbolo para operar otro.** Lee el score del instrumento que estás operando. Si quieres contrastar entre símbolos, compara directamente los regímenes y los clústeres en lugar de los scores, porque los scores ya han incorporado ambas cosas.

---

## Es una lectura en vivo, no un sesgo de sesión

El score se recalcula continuamente. No es una previsión matinal que se mantiene hasta el cierre.

Cuando el precio cruza el nivel de confluencia, el signo se invierte - y como el historial del score se colorea según el signo actual, toda la línea se vuelve a pintar. La trayectoria no ha cambiado; su color sí. Un historial que estuvo verde toda la mañana y ahora está rojo te está mostrando los mismos datos con un signo nuevo.

Esto también significa que el score solo se actualiza mientras el mercado está abierto. Una línea plana hasta la noche es el último valor guardado, no una señal que sigue en marcha.

Es razonable querer suavizar la lectura para que persista a lo largo de una sesión y capte giros mayores. Eso la estropearía. El único trabajo de la señal es decir lo que es cierto *ahora*; una versión que mantuviera su opinión a través de un cambio de régimen te estaría hablando de un mercado que ya no existe.

---

## El objetivo esperado

Cada tarjeta publica un objetivo esperado, y significa cosas distintas según el régimen:

- **Reversión a la media:** el objetivo es el propio nivel de confluencia. La afirmación es que el precio vuelve al clúster.
- **Continuación:** el objetivo se proyecta más allá del precio, al doble de la distancia que ya ha recorrido desde el clúster. La afirmación es que el movimiento se prolonga.

Dos advertencias honestas. El objetivo es geométrico - no escala con el score, así que una tarjeta de baja confianza puede seguir mostrando un objetivo lejano. Léelo junto con el score y la calidad, no por sí solo. Y en continuación es una extrapolación, no un nivel medido: nada en el libro de opciones dice que el precio se detenga ahí.

---

## Límites honestos

**El signo de los dealers es modelado, no observado.** Como en el resto de la plataforma, que los dealers estén largos o cortos de un contrato es una convención aplicada al open interest público, no un hecho leído en el tape. El régimen que provoca la inversión de signo descrita arriba hereda ese supuesto.

**El clúster es aritmética, no criterio.** El nivel de confluencia es una media simple de los miembros que se clasifican. No pondera un wall por su tamaño ni un flip por la firmeza con la que se resolvió.

**Dos miembros es el mínimo, no una recomendación.** Toda tarjeta tiene al menos el flip y el VWAP, así que `Members: 2` con una brecha amplia es el modelo informando de que no hay clúster, no encontrando uno. Comprueba la calidad antes de leer el signo.

**Es una lectura de posicionamiento, no un pronóstico.** Como todo nivel de gamma, describe lo que la cobertura *tiende* a hacer en torno a una estructura. Un catalizador la desborda, y un nivel que se ha respetado toda la mañana deja de importar en el momento en que llega algo más grande.

---

## Cómo leerlo en la práctica

1. **Comprueba primero la calidad y los miembros.** Una calidad baja significa que no hay clúster, diga lo que diga el signo. Por debajo de ±20 la tarjeta dice "No confluence edge", y lo dice en serio.
2. **Después comprueba la insignia de régimen.** Continuation y Mean Reversion son operaciones opuestas a partir de la misma imagen, y la insignia te dice cuál está planteando el modelo.
3. **Después lee el signo y el nivel.** En reversión a la media, el nivel de confluencia es el destino. En continuación, es aquello de lo que el precio se está alejando.
4. **Léelo símbolo por símbolo.** SPX, SPY y QQQ tienen cada uno su propio régimen y su propio clúster.

Puedes ver el score en vivo, la pila de niveles y el historial del score en la página de [Gamma / VWAP Confluence](/gamma-vwap-confluence).
