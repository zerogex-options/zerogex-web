# ¿Por qué SPY se ancla cerca de un strike? El pinning de opciones explicado

*¿Por qué SPY se ancla cerca de strikes específicos — sobre todo los viernes y hacia el cierre? No es coincidencia. El pinning de opciones explicado: el mecanismo de cobertura de los dealers detrás de ese tirón, por qué es más fuerte en el OPEX y a final del día, y cómo saber si la sesión de hoy va a pinear.*

---

## El pinning no es superstición

Si operas opciones semanales de SPY con regularidad, ya lo has visto suceder: SPY deriva hacia un strike de número redondo — 580, 583, 585 — y el viernes por la tarde se queda ahí, oscilando en un rango de 30 centavos, negándose a moverse. Ocurre lo mismo en torno a los vencimientos trimestrales y en el OPEX mensual. Y ocurre también en muchos miércoles y jueves normales, cuando la cadena 0DTE está muy cargada.

Muchos traders minoristas tratan el pinning como un fenómeno de "sensaciones" — "el mercado sabe dónde quiere liquidar" — o lo atribuyen a patrones de gráfico. El mecanismo es en realidad estructural y observable: la cobertura de los dealers en strikes con gran concentración de gamma produce flujos direccionales que empujan el precio de vuelta hacia el strike cada vez que intenta alejarse. Una vez que puedes ver el mecanismo, también puedes ver cuándo es probable que esté actuando hoy y cuándo no.

Este artículo recorre la mecánica real del pinning, por qué se intensifica cerca del vencimiento, los dos tipos de pin que más confunden los traders, y las condiciones estructurales que hacen que hoy sea un día de pin. Para la checklist orientada al trader sobre "¿está SPY pineado ahora mismo?", consulta [Cómo saber si SPY está pineado](/education/how-to-know-if-spy-is-pinned). Para la discusión relacionada sobre max pain, consulta [Max Pain explicado](/education/max-pain-explained).

---

## El mecanismo de cobertura de los dealers detrás del pinning

El mecanismo es sencillo una vez que se detalla:

1. Un strike concreto — digamos SPY 583 — concentra una gran cantidad de gamma. Los clientes han comprado muchas calls y puts a 583; los dealers están cortos en el equivalente.
2. El book del dealer está **long gamma** en ese strike. Eso ocurre cuando, en términos netos, los dealers están *cortos* en las opciones que los clientes mantienen largas. (Convención estándar.)
3. Cuando SPY sube por encima de 583, el delta de opciones de los dealers se vuelve más positivo (están net short en calls; con el spot subiendo, su exposición delta de calls cortas crece). Para mantenerse neutrales, **venden** SPY.
4. Cuando SPY cae por debajo de 583, el delta de opciones de los dealers se vuelve más negativo (su exposición delta de puts cortas crece a la baja). Para mantenerse neutrales, **compran** SPY.
5. Cada excursión lejos de 583 obliga a una operación de cobertura *de vuelta hacia* 583. El strike actúa como un imán — no porque nadie lo esté buscando deliberadamente, sino porque la matemática de la cobertura empuja el precio hacia ahí de forma mecánica.

Esto es lo que ocurre estructuralmente cuando ves a SPY oscilar en un rango estrecho. No es "el mercado decidiendo pinear"; es el book agregado de los dealers corrigiéndose de vuelta a la neutralidad con cada movimiento.

---

## Por qué el pinning se intensifica cerca del vencimiento

El mecanismo descrito arriba se aplica a cualquier opción — pero la *fuerza* del pin depende de la magnitud de la gamma en el strike. Dos factores hacen que esa magnitud sea enorme cerca del vencimiento:

### La gamma escala con 1/√T

La gamma por contrato de opción es aproximadamente inversamente proporcional a la raíz cuadrada del tiempo hasta el vencimiento. La gamma at-the-money de una opción 0DTE es aproximadamente 5 veces la de una opción del mismo strike a 5 días de vencimiento, y órdenes de magnitud mayor que la de una mensual. Cuanto más cerca del vencimiento, mayor es la gamma por contrato — y mayor la operación de cobertura que requiere cada tick de precio.

Un strike 0DTE en el que todo el mundo está posicionado se convierte esencialmente en un agujero negro para el spot. Los dealers deben mover cantidades muy grandes de subyacente por cambios de precio muy pequeños. El pinning se convierte en el camino de menor resistencia.

### El open interest se concentra en strikes redondos

El mercado concentra estructuralmente el open interest en números redondos — 580, 583, 585 en SPY, 5800, 5810 en SPX. El viernes por la tarde, la concentración de gamma en uno o dos de esos strikes puede dominar al resto de la cadena combinada. Ese dominio de un único strike es lo que produce el "magnetismo" visible que los traders sienten al cierre.

Combina ambos factores — poco tiempo hasta el vencimiento más OI concentrado en strikes redondos — y los pines del viernes por la tarde se vuelven estructuralmente predecibles. Los miércoles y lunes presentan versiones más débiles del mismo patrón, a medida que el flujo 0DTE sigue creciendo.

---

## Dos tipos de pin — y no son lo mismo

Una fuente habitual de confusión: **max pain** frente al **imán de gamma**. Ambos se llaman "el pin", pero se calculan de forma distinta y pueden no coincidir.

### Max pain

El max pain es el strike en el que el pago total a los tenedores de opciones se minimizaría al vencimiento. Es un cálculo de geometría de payoff — matemática pura de valor intrínseco. Indica el strike "estructuralmente favorable" para quienes emiten opciones.

### Imán de gamma

El imán de gamma es el strike con la mayor concentración absoluta de gamma de los dealers — el strike donde la cobertura forzada es más intensa. Es una lectura del flujo de cobertura.

Cuando ambos strikes coinciden, la tesis del pin está en su punto más fuerte. La cadena está equilibrada en ambos sentidos. Cuando difieren, suele ganar el imán de gamma, porque es el mecanismo que realmente produce el flujo de cobertura que arrastra el precio.

[Max Pain explicado](/education/max-pain-explained) profundiza en esta distinción y es honesto sobre cuán a menudo el max pain por sí solo induce a error.

---

## Cuándo se mantiene el pin

Las condiciones estructurales que hacen que hoy sea un día de pin:

- **Régimen de gamma positiva.** Spot por encima del gamma flip. Net GEX claramente positivo. Sin esto, el mecanismo se invierte por completo.
- **Fuerte concentración de strike cerca del spot.** El imán de gamma está dentro del 0,3-0,5% del precio actual. Los imanes lejanos al spot no pinean; apuntan.
- **Max pain y el imán de gamma coinciden.** Ambos señalando el mismo nivel. Refuerza el tirón estructural.
- **Cadena dominada por el vencimiento.** Las opciones 0DTE/semanales concentran la mayor parte de la gamma. Las cadenas dominadas por mensuales pinean de forma mucho menos fiable.
- **Calendario de catalizadores tranquilo.** Sin datos macro importantes ni eventos de banco central durante la sesión.
- **Volatilidad realizada comprimiéndose.** El tape muestra que el reflejo amortiguador de los dealers está funcionando.

Cuando la mayoría de estas condiciones se alinean, el pin tiene la probabilidad estructural a su favor.

---

## Cuándo se rompe el pin

El pin se deshace cuando:

- **Ocurre el cruce del gamma flip.** El spot cae por debajo del flip; el régimen se invierte. El mismo imán ahora libera el precio.
- **Aterriza un catalizador.** CPI, FOMC, NFP, shock de un valor individual. El flujo macro desborda el reflejo de los dealers.
- **El Net GEX se degrada de forma significativa.** Las posiciones se van liquidando hacia el vencimiento. A las 15:30 ET del viernes la gamma se está reduciendo rápidamente.
- **El open interest migra.** OI nuevo que se construye en otro strike arrastra el imán a otro lugar en mitad de la sesión.
- **El skew se desplaza.** Un bid fuerte en puts (miedo) puede invertir el signo del book de los dealers incluso en el mismo strike.

Un pin que lleva dos horas sosteniéndose es más duradero que uno que acaba de formarse, pero ningún pin dura indefinidamente. Las condiciones que lo sostenían tienen que seguir cumpliéndose para que el pin aguante.

---

## Leer el pin en tiempo real

Un flujo de trabajo breve:

1. **Identifica el strike con más gamma cerca del spot.** Este es el candidato a imán.
2. **Revisa el Net GEX.** Un valor positivo sustancial es el requisito previo. Negativo o cercano a cero descarta el pin.
3. **Revisa el gamma flip.** El spot debe estar por encima. Si el flip está justo en el spot, la situación está disputada — el pin podría formarse o no.
4. **Contrasta con el max pain.** Mismo strike o dentro del 0,3% del imán → pin nítido. Materialmente distinto → tesis de pin más débil; confía en el imán.
5. **Lee la hora del día.** Antes del mediodía ET, el charm no se ha acumulado lo suficiente como para impulsar el pin con fuerza. Después de las 14:00 ET, el tirón se intensifica. Después de las 15:30 ET, dominan las dinámicas de la ventana de cierre.

Una vez identificado el pin, el playbook de trading está en [Cómo saber si SPY está pineado](/education/how-to-know-if-spy-is-pinned) — versión corta: hacer fade a los extremos, evitar el centro, tamaño pequeño.

---

## Ejemplo resuelto

SPY está en 582,95 un viernes por la tarde. ZeroGEX muestra:

- **Net GEX:** +1.400 M$ (positivo — régimen long-gamma)
- **Gamma Flip:** 581,20 (spot bien por encima)
- **Strike 0DTE más pesado:** 583,00 (prácticamente en el spot)
- **Max Pain:** 583,00 (coincide con el imán de gamma)
- **Hora:** 14:15 ET (empieza la acumulación de charm)

Todas las condiciones estructurales para un pin están activas. El imán está en 583; el max pain coincide en 583; el régimen es long-gamma; estamos dentro de la ventana activa de fin de día. La probabilidad de que SPY oscile dentro de un rango de unos 30 centavos alrededor de 583 hasta el cierre está claramente elevada.

Lectura práctica: un rango ajustado de 582,70-583,30 es el recorrido esperado. Las excursiones hacia los bordes son candidatas a setups de fade. El centro del rango es territorio de no operar. Tamaño pequeño. Vigilar las condiciones de ruptura — sobre todo si aparece un shock de un valor individual o un titular inesperado.

Ahora imagina el mismo escenario pero con Net GEX en −600 M$ y el gamma flip en 583,50 (spot por debajo). La tesis del "pin" está muerta. Misma cadena, mismo strike, lectura opuesta — porque la variable de régimen que decide si el imán atrae o libera está invertida.

---

## Conceptos erróneos habituales

- **"El pinning es psicología."** Es mecánica. Los dealers cubren posiciones independientemente de quién esté mirando; el flujo ocurre crean los traders en ello o no.
- **"SPY siempre pinea en números redondos."** Pinea en los strikes donde se concentra el posicionamiento. Los números redondos son comunes porque el OI se agrupa ahí — pero el mecanismo real es el OI, no la redondez.
- **"Si el max pain es X, el precio cerrará en X."** A menudo es falso. El max pain por sí solo no es el mecanismo del pin; lo es el imán de gamma. Cuando difieren, gana el imán de gamma.
- **"Los pines son alcistas/bajistas."** Ninguna de las dos cosas. Son supresores de volatilidad. Ligados a un rango. La dirección viene de otro lado; el pin trata sobre el *carácter* de la acción del precio, no sobre la dirección.
- **"El pinning ocurre todos los viernes."** A menudo, pero no siempre. Algunos viernes tienen catalizadores, regímenes de gamma corta o imanes migrando que impiden el pin. Leer las condiciones importa.

---

## Conclusión

> SPY pinea porque la cobertura de los dealers en strikes con alta concentración de gamma arrastra mecánicamente el precio de vuelta al strike. El tirón es real, observable y lo bastante predecible como para operar con él — siempre que las condiciones estructurales lo respalden.

La disciplina consiste en verificar las condiciones antes de asumir que hoy es un día de pin. Régimen long-gamma + strike pesado en el spot + coincidencia con el max pain + sesión avanzada = pin nítido. Que cualquiera de estos factores se invierta debilita la lectura. Que se inviertan todos la anula por completo.

Contenido meramente educativo — nada de lo anterior es una recomendación de trading.

---

Si quieres ver el strike con más gamma de hoy, el max pain, el gamma flip y el Net GEX — los cuatro números que deciden si SPY pinea hoy —, la vista gratuita de gamma-levels de ZeroGEX los muestra todos.
