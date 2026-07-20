# Por qué no publicamos el DEX

*Delta Exposure — DEX, la suma del delta de cada contrato multiplicado por su open interest — parece el hermano natural del gamma exposure. Nosotros nos negamos a publicarlo. Mide el único greek que los dealers ya han cubierto hasta dejarlo en cero, concentra todo su peso en los strikes donde los datos son peores, y suena más fuerte precisamente donde el flujo forzado es más débil. Este es el argumento completo contra un número que muchas herramientas están encantadas de venderte.*

---

## El número que parece correcto y se lee mal

Si el gamma exposure funciona, el delta exposure también debería funcionar. Esa es la intuición, y por eso el "DEX" aparece en un dashboard tras otro, junto al GEX como si fuera su gemelo. Se toma cada opción de la cadena, se multiplica el delta de cada contrato por su open interest, se suma todo, y se obtiene un único número que supuestamente indica hacia dónde se inclina direccionalmente el libro del dealer. DEX positivo, los dealers están largos; DEX negativo, los dealers están cortos. Limpio, simétrico, fácil de vender.

También está cerca de ser irrelevante, y tomamos la decisión temprana de no mostrárselo a nadie. No porque sea difícil de calcular — es trivial de calcular, lo cual es parte del problema — sino porque el número está mal de tres maneras independientes que se acumulan entre sí. Cualquiera de ellas ya sería descalificante. Juntas, hacen que el DEX no sea simplemente poco informativo, sino activamente engañoso, porque atrae la mirada exactamente hacia la parte equivocada de la cadena.

Este es el artículo que más queríamos escribir en esta serie, porque la disciplina de *no* publicar una métrica que parece plausible vale más que la mayoría de las métricas que sí se publican.

---

## Primer golpe: los dealers ya han cubierto el delta hasta cero

El gamma exposure es significativo por un hecho específico: **el gamma no se puede cubrir con la acción.** La acción tiene un delta de 1 y un gamma exactamente igual a cero. Un dealer que está corto de gamma por haber vendido opciones no tiene forma de neutralizarlo con el subyacente — está obligado a cargar con él, y ese gamma atrapado es lo que lo obliga a perseguir el precio. El GEX mide una exposición real, no neutralizada. Por eso mueve los mercados.

El delta es el caso opuesto en todos los sentidos. El delta es *precisamente* el greek que los dealers cubren con la acción, porque la acción es un instrumento de delta puro. Ese es todo el trabajo. Un dealer vende una call con delta 0,40, compra 40 acciones contra ella, y el delta neto de la posición es cero. Hazlo en todo el libro y el delta *neto* del dealer es, por construcción, aproximadamente nulo. El delta-hedging es la definición misma del negocio.

Entonces, ¿qué mide realmente un agregado Σ(Δ·OI)? Mide el delta de las *opciones solas*, ignorando la montaña de acciones compensatorias que el dealer mantiene contra ellas. Es una pata de una posición de dos patas, presentada como si fuera el todo. La otra pata — la cobertura en acciones que la cancela — es invisible para la fórmula. El DEX es un número grande y llamativo precisamente porque omite la cobertura cuyo único propósito es hacerlo pequeño.

El GEX mide una exposición de la que los dealers *no pueden* deshacerse. El DEX mide la única exposición de la que ya se deshicieron. Esa asimetría no es un detalle. Es todo el juego, y por eso los dos números no son hermanos en absoluto.

---

## Segundo golpe: el peso del delta vive donde los datos son peores

Dejemos de lado el problema de la cobertura y concedamos, a efectos del argumento, que queremos ponderar la cadena por delta. Veamos dónde coloca esa ponderación su masa.

El delta va de 0 a 1. Está cerca de 0 para las opciones muy fuera del dinero, cruza 0,5 cerca del dinero, y se aproxima a 1 para las opciones muy dentro del dinero. Compárese con el gamma, que alcanza su pico bruscamente en el dinero y cae hacia cero en ambas alas. Ponderar la cadena por delta en lugar de por gamma hace algo específico: arrastra el centro de masa de la métrica **hacia el lado dentro del dinero** — y otorga peso real a la **cola profundamente dentro del dinero**, strikes que una métrica ponderada por gamma ignora correctamente porque su gamma es nulo.

Esa cola dentro del dinero es la peor parte de la cadena en la que apoyar una métrica:

- Son ilíquidas. Las opciones muy ITM apenas se negocian.
- Sus spreads son amplios, así que sus cotizaciones están desactualizadas y son poco fiables.
- Su open interest suele ser antiguo, resto de posiciones abiertas hace mucho tiempo, roladas, u olvidadas — y el open interest es el dato por el que multiplica el DEX.

Mientras tanto, los tres greeks que realmente impulsan el flujo forzado — gamma, charm y vanna — alcanzan todos su pico **cerca del dinero**, donde las opciones son líquidas, están cotizadas de forma ajustada, se negocian activamente, y donde el open interest refleja un posicionamiento vivo. El GEX extrae su señal de la parte más limpia de la cadena. El DEX extrae su señal de la más sucia. Difícilmente se podría diseñar una métrica más perfectamente orientada hacia el ruido.

---

## Tercer golpe: el delta no está donde está el flujo

Este es el problema más profundo, y es el que une toda la serie. **El flujo forzado no proviene del nivel del delta. Proviene del cambio en el delta.** Un dealer no negocia acciones porque su libro tenga delta; negocia acciones porque el delta de su libro *cambió*. (Esa es toda la tesis de [Por qué los market makers están obligados a negociar acciones](/education/why-market-makers-trade-stock).)

Ahora preguntémonos qué strikes generan ese cambio. El delta se mueve más rápido donde gamma, charm y vanna son mayores — cerca del dinero, cerca del vencimiento. Apenas se mueve en las alas profundas. Una call deep-ITM con delta 0,98 tiene un gamma cercano a cero, un charm cercano a cero, y una vanna cercana a cero. Su delta se mantendrá aproximadamente en 0,98 sin importar lo que hagan el spot, el reloj o la vol en las próximas horas. Genera esencialmente **ningún flujo de cobertura.**

Y sin embargo, ese mismo contrato con delta 0,98, multiplicado por su open interest, vuelca casi todo su peso en el DEX. La métrica asigna la máxima importancia al strike que produce el mínimo flujo. Aplica esa lógica a toda la cadena y descubrirás que el DEX suena más fuerte precisamente donde el flujo forzado es más silencioso, y más silencioso — cerca del dinero, donde el delta es un mediocre 0,5 — precisamente donde el flujo forzado suena más fuerte. El DEX no está simplemente incorrelacionado con lo que les importa a los traders. Está cerca de estar *anti*-correlacionado con ello. Apunta sistemáticamente lejos de los strikes que mueven el mercado.

Tres golpes. Una métrica que mide una exposición ya cubierta y plana, la pondera hacia los datos más sucios de la cadena, y concentra su señal precisamente donde no se genera ningún flujo. No existe versión de ese número que valga la pena poner en una pantalla.

---

## Lo que publicamos en su lugar

La solución no es una mejor ponderación del delta. Es dejar de medir el *nivel* de algo y empezar a medir la *operación forzada*.

Nuestro motor [Forced Flow](/forced-flow) no suma Δ·OI. Plantea un escenario — el spot se mueve tanto, pasa tanto tiempo, la vol implícita se desplaza tanto — y **reprecia todo el libro** en ese nuevo estado. Lee el delta del dealer después del escenario, resta el delta actual del dealer, y multiplica la diferencia por el spot. El resultado es una cifra en dólares: la acción que los dealers están mecánicamente obligados a comprar o vender para permanecer cubiertos a medida que el mundo cambia.

Ese número es todo lo que el DEX no es:

- Es un **flujo**, no un nivel — mide la operación forzada, que es lo que realmente golpea el mercado.
- Está impulsado por **gamma, charm y vanna**, que viven cerca del dinero, en la parte limpia, líquida y activa de la cadena.
- Está dominado por los strikes que **generan** cobertura, no por los contratos deep-ITM muertos que no generan ninguna.
- Proviene de un **reprecio completo**, así que los términos cruzados entre spot, tiempo y vol se tratan correctamente en lugar de aproximarse hasta desaparecer.

Después dividimos ese total en bandas de atribución de gamma, charm y vanna, para que puedas ver no solo cuánto deben negociar los dealers, sino *por qué*. Ese es un número que significa algo. Σ(Δ·OI) no lo es.

---

## La advertencia honesta

No estamos afirmando que el delta sea falso ni que los dealers lo ignoren. El delta es el greek más importante en cualquier opción individual — es el ratio de cobertura, y cubrirlo es todo el trabajo del dealer. Tampoco estamos afirmando que nadie, en ningún lugar, pueda extraer algo de los datos de delta con suficiente cuidado respecto a la liquidez y la higiene del OI.

La afirmación es más acotada y, creemos, irrefutable: un **agregado Σ(Δ·OI), publicado como número destacado junto al GEX, no es una señal negociable**, y presentarlo como el gemelo simétrico del GEX implica un paralelismo que no existe. El GEX se gana su lugar porque el gamma no se puede cubrir con acciones, se concentra cerca del dinero, e impulsa flujo real. El DEX falla las tres pruebas. Ponerlos uno junto al otro no te da dos señales. Te da una señal y un número que envenena silenciosamente la lectura de al lado.

---

## Por qué la omisión es el punto

Sería fácil añadir un recuadro de DEX. No cuesta nada calcularlo, llena espacio, coincide con lo que muestran los competidores, y la mayoría de los usuarios nunca sabría que está vacío. Precisamente por eso importa dejarlo fuera. Un dashboard es un conjunto de afirmaciones sobre qué merece tu atención. Cada número en él dice "esto vale la pena mirarlo." No estamos dispuestos a hacer esa afirmación sobre una métrica que mide una exposición ya cubierta y plana, en los datos más sucios de la cadena, precisamente donde no nace ningún flujo.

Preferimos publicar un número que resista el escrutinio antes que dos números donde el segundo sea decoración. El DEX es decoración. Forced Flow es la operación.

Para conocer la mecánica detrás de la alternativa, empieza con [Por qué los market makers están obligados a negociar acciones](/education/why-market-makers-trade-stock) y [Delta y sus tres hijos](/education/delta-and-its-three-children), luego abre la página en vivo de [Forced Flow](/forced-flow) y observa cómo la curva de reprecio hace lo que el DEX solo aparenta hacer.

Contenido solo educativo — nada de lo anterior es una recomendación de trading.
