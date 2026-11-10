# ¿Por qué SPY se ancla cerca de un strike? El pinning de opciones explicado

*¿Por qué SPY se ancla cerca de strikes específicos - sobre todo los viernes y hacia el cierre? Rara vez es coincidencia. El pinning de opciones explicado: el mecanismo modelado de cobertura de los dealers que puede atraer el precio hacia un strike, por qué tiende a ser más fuerte en el OPEX y al final del día, y cómo leer si es probable que el tape de hoy se ancle.*

---

## El pinning no es superstición

Si operas opciones semanales de SPY con regularidad, ya lo has visto suceder: SPY deriva hacia un strike de número redondo - 580, 583, 585 - y el viernes por la tarde se queda ahí, oscilando en un rango de 30 centavos, negándose a moverse. Ocurre lo mismo en torno a los vencimientos trimestrales y en el OPEX mensual. Y ocurre también en muchos miércoles y jueves normales, cuando la cadena 0DTE está muy cargada.

Muchos traders tratan el pinning como un fenómeno de "sensaciones" - "el mercado sabe dónde quiere asentarse" - o lo atribuyen a patrones de gráfico. Debajo hay una historia más concreta: la cobertura modelada de los dealers en strikes con mucha gamma puede generar flujos que tienden a devolver el precio hacia el strike, junto con otros factores como la liquidez, el posicionamiento y la mecánica del vencimiento. Una vez que puedes ver el mecanismo, también puedes calibrar cuándo es más probable que esté actuando hoy y cuándo no.

Este artículo recorre la mecánica real del pinning, por qué se intensifica cerca del vencimiento, los dos tipos de pin que más confunden los traders, las condiciones estructurales que hacen que hoy sea un día de pin, las cinco señales de que hay un pin en marcha ahora mismo y el manual que premia un tape pinneado. Para la discusión relacionada sobre max pain, consulta [Max Pain explicado](/education/max-pain-explained).

---

## El mecanismo de cobertura de los dealers detrás del pinning

El mecanismo se ve más fácilmente una vez que lo escribes paso a paso - teniendo en cuenta que es un modelo del comportamiento de los dealers, no algo que puedas leer directamente en el tape:

1. Un strike concreto - digamos SPY 583 - concentra una gran cantidad de gamma. Según el modelo de posicionamiento estándar, se asume que el libro de los dealers está **largo** en esa gamma. (Una gran concentración no lo demuestra por sí sola - el open interest muestra cuántos contratos están abiertos, no quién está largo o corto -, pero es la hipótesis de trabajo cuando las calls dominan el strike.)
2. Si el libro de los dealers está largo en gamma en el strike, la cobertura empuja *en contra* de los movimientos que se alejan de él - el reflejo estabilizador que tiende a anclar el precio. (Es el régimen de gamma positiva manifestándose en un único strike dominante.)
3. Cuando SPY sube por encima de 583, el delta de cobertura modelado se vuelve más positivo, así que para mantenerse neutrales los dealers tienden a **vender** SPY.
4. Cuando SPY cae por debajo de 583, el delta de cobertura modelado se vuelve más negativo, así que para mantenerse neutrales los dealers tienden a **comprar** SPY.
5. Cada excursión lejos de 583 invita a una operación de cobertura *de vuelta hacia* 583. El strike puede actuar como un imán - no porque nadie lo esté buscando, sino porque, según el modelo, la matemática de la cobertura inclina el precio de vuelta hacia ahí.

Esa es una lectura plausible de lo que ocurre cuando ves a SPY oscilar en un rango estrecho: el libro agregado de los dealers corrigiéndose de vuelta hacia la neutralidad con cada movimiento. Rara vez es lo único que está pasando - la liquidez, el comportamiento de los traders y la mecánica del vencimiento también contribuyen -, pero a menudo es un factor dominante.

---

## Por qué el pinning se intensifica cerca del vencimiento

El mecanismo descrito arriba se aplica a cualquier opción - pero la *fuerza* del pin depende de la magnitud de la gamma en el strike. Dos factores hacen que esa magnitud sea enorme cerca del vencimiento:

### La gamma escala con 1/√T

La gamma por contrato de opción es aproximadamente inversamente proporcional a la raíz cuadrada del tiempo hasta el vencimiento. La gamma at-the-money de una opción 0DTE es aproximadamente 5× la de una opción del mismo strike a 5 días de vencimiento, y órdenes de magnitud mayor que la de una mensual. Cuanto más cerca del vencimiento, mayor es la gamma por contrato - y mayor la operación de cobertura que requiere cada tick de precio.

Un strike 0DTE en torno al cual está posicionado todo el mundo puede comportarse como un agujero negro para el spot. Puede que los dealers necesiten mover cantidades muy grandes de subyacente por cambios de precio muy pequeños, así que el pinning puede convertirse en el camino de menor resistencia.

### El open interest se concentra en strikes redondos

El mercado concentra estructuralmente el open interest en números redondos - 580, 583, 585 en SPY, 5800, 5810 en SPX. El viernes por la tarde, la concentración de gamma en uno o dos de esos strikes puede dominar al resto de la cadena combinada. Ese dominio de un único strike es una parte importante del "magnetismo" visible que los traders sienten al cierre.

Combina ambos factores - poco tiempo hasta el vencimiento + OI concentrado en strikes redondos - y los pines del viernes por la tarde se vuelven estructuralmente más probables. Los miércoles y lunes presentan versiones más débiles del mismo patrón, a medida que el flujo 0DTE sigue creciendo.

---

## Dos tipos de pin - y no son lo mismo

Una fuente habitual de confusión: **max pain** frente al **imán de gamma**. Ambos se llaman "el pin", pero se calculan de forma distinta y pueden no coincidir.

### Max pain

El max pain es el strike en el que el pago total a los tenedores de opciones se minimizaría al vencimiento. Es un cálculo de geometría de payoff - matemática pura de valor intrínseco. Indica el strike "estructuralmente favorable" para quienes emiten opciones.

### Imán de gamma

El imán de gamma es el strike con la mayor concentración absoluta de gamma de los dealers - el strike donde la cobertura forzada es más intensa. Es una lectura del flujo de cobertura.

Cuando ambos strikes coinciden, la tesis del pin tiende a estar en su punto más nítido. Cuando difieren, ZeroGEX se apoya en el imán de gamma, porque corresponde al flujo de cobertura modelado y no solo a la geometría de payoff - pero es una inclinación, no una regla, y qué lectura importa más depende del signo modelado de la gamma de los dealers y del flujo circundante.

[Max Pain explicado](/education/max-pain-explained) profundiza en esta distinción y es honesto sobre cuán a menudo el max pain por sí solo induce a error.

---

## Cuándo se mantiene el pin

Las condiciones estructurales que hacen que hoy sea un día de pin:

- **Régimen de gamma positiva.** Spot por encima del gamma flip modelado; Net GEX claramente positivo. Sin esto, el reflejo de cobertura modelado puede invertirse, y el mismo strike puede liberar el precio en lugar de atraerlo.
- **Fuerte concentración de strike cerca del spot.** El imán de gamma está cerca del precio - ZeroGEX considera "cerca" aproximadamente un 0,3-0,5%, aunque esa banda es una heurística propia, no un estándar del sector. Los imanes lejanos al spot tienden a actuar más como objetivos que como pines activos.
- **Max pain y el imán de gamma coinciden.** Ambos señalando el mismo nivel. Refuerza el tirón estructural.
- **Cadena dominada por el vencimiento.** Las opciones 0DTE/semanales concentran la mayor parte de la gamma. Las cadenas dominadas por mensuales pinean de forma mucho menos fiable.
- **Calendario de catalizadores tranquilo.** Sin datos macro importantes ni eventos de banco central durante la sesión.
- **Volatilidad realizada comprimiéndose.** El tape muestra que el reflejo amortiguador de los dealers está funcionando.

Cuando la mayoría de estas condiciones se alinean, el pin tiene la probabilidad estructural a su favor.

---

## Cuándo se rompe el pin

El pin se deshace cuando:

- **Ocurre el cruce del gamma flip.** El spot cae por debajo del flip modelado; cruzarlo sugiere que la tendencia agregada de cobertura del modelo ha cambiado de signo, así que el mismo imán puede empezar a liberar el precio en lugar de atraerlo.
- **Aterriza un catalizador.** CPI, FOMC, NFP, shock de un valor individual. El flujo macro desborda el reflejo de los dealers.
- **El Net GEX se degrada de forma significativa.** La gamma cercana al vencimiento se está revaluando: la gamma ATM puede aumentar mientras la gamma claramente ITM u OTM tiende a cero. El agregado puede fortalecerse o debilitarse.
- **El imán migra.** El open interest confirmado generalmente se publica para la sesión siguiente, pero el imán modelado aún puede desplazarse en mitad de la sesión a medida que cambian el spot, la gamma, el tiempo y la IV - o a medida que se acumula posicionamiento intradía inferido en otro strike -, llevando el objetivo a otro lugar.
- **El skew se desplaza.** Un bid fuerte en puts (miedo) puede invertir el signo del libro de los dealers de la cadena incluso en el mismo strike.

Un pin que lleva dos horas sosteniéndose es más duradero que uno que acaba de formarse, pero ningún pin dura indefinidamente. Las condiciones que lo sostenían tienen que seguir cumpliéndose para que el pin aguante.

---

## Leer el pin en tiempo real

Un flujo de trabajo breve:

1. **Identifica el strike con más gamma cerca del spot.** Este es el candidato a imán.
2. **Revisa el Net GEX.** Es una cifra modelada - gamma estimada de los dealers bajo la convención tradicional call-positivo/put-negativo sobre el open interest, no inventario observado de los dealers. Un valor positivo sustancial es la condición que respalda el pin; las lecturas negativas o cercanas a cero argumentan en contra.
3. **Revisa el gamma flip.** El spot debe estar por encima. Si el flip está justo en el spot, la situación está disputada - el pin podría formarse o no.
4. **Contrasta con el max pain.** Mismo strike o dentro de ~0,3% del imán (una heurística de ZeroGEX) → tesis de pin más nítida. Materialmente distinto → tesis más débil; ZeroGEX se apoya en el imán, ya que corresponde al flujo de cobertura modelado.
5. **Lee la hora del día.** Antes del mediodía ET, el charm no se ha acumulado lo suficiente como para impulsar el pin con fuerza. Después de las 14:00 ET, el tirón se intensifica. Después de las 15:30 ET, dominan las dinámicas de la ventana de cierre.

---

## Cómo saber si el SPY está pinneado: las cinco señales

Reconocer un pin en tiempo real se reduce a cinco señales estructurales. Cuantas más se alineen, más nítido será el pin.

**1. El Net GEX es significativamente positivo (régimen de gamma larga).** Spot por encima del gamma flip y Net GEX claramente positivo. (El Net GEX es gamma estimada de los dealers bajo la convención tradicional call-positivo/put-negativo sobre el open interest - un modelo, no inventario observado.) ZeroGEX considera "sustancial" en la escala de SPY aproximadamente 500 millones de $ o más, pero es una heurística propia - la magnitud importa más que cualquier cifra concreta. Un Net GEX negativo o próximo a cero argumenta en contra del pin.

**2. El max pain y el imán de gamma coinciden cerca del spot.** Cuando ambos apuntan al mismo nivel y este queda dentro de aproximadamente un 0,3% del spot, el tirón estructural es más marcado. Cuando divergen, ZeroGEX se apoya en el imán de gamma - se corresponde con el mecanismo de cobertura modelado, mientras que el max pain es geometría de payoff.

**3. El spot lleva una hora oscilando alrededor del imán.** Grafica el SPY contra el strike del imán de gamma en temporalidad de 5 minutos. Tres o más cruces en los últimos 60 minutos, con cada excursión más pequeña, sugiere un pin en formación. Una deriva constante alejándose del imán argumenta en contra - eso es una dirección, no un rango.

**4. La volatilidad realizada se ha comprimido por debajo de la implícita.** La cobertura en gamma larga amortigua la volatilidad realizada, así que un pin que funciona aparece como realizada por debajo de implícita. Si la realizada se expande, el pin no aguanta - el libro está siendo arrollado por otro flujo.

**5. El EOD Pressure está cerca de cero dentro de la ventana activa.** Después de las 14:30 ET, una lectura de EOD Pressure cercana a cero (aproximadamente −0,20 a +0,20) es una firma modelada de pin - los términos de charm y de gravedad del pin se cancelan en buena medida porque el precio está sobre el imán. Una lectura grande significa que el precio está *lejos* del imán. Consulta [Señal EOD Pressure explicada](/education/eod-pressure-explained).

---

## El manual para un tape pinneado

Cuando la mayoría de las cinco señales encajan, el manual es contrario y sencillo:

- **Sí: opera contra los extremos del rango de compresión.** El tirón estructural va de vuelta hacia el imán, así que vender los impulsos cerca del techo del rango y comprar las caídas cerca del suelo es el único montaje en el que el reflejo del dealer está de tu lado. Tamaño pequeño - los pines son probabilísticos, no garantizados.
- **No: persigas el medio.** En el medio está el imán; comprar o vender ahí es pelearse con el nivel al que el precio intenta estructuralmente volver. De ahí vienen la mayoría de las pérdidas en un tape pinneado.
- **No: tomes montajes de momentum.** Los manuales de ruptura, expansión de volatilidad y squeeze suponen que el movimiento se extiende - lo contrario de un tape pinneado. Ejecutar el manual equivocado es la mayor parte del error.
- **Sí: reduce el tamaño de la posición.** Los rangos pinneados son estrechos y los stops todavía más; un tamaño de día normal invita a saltar de la posición antes de tiempo.

---

## Ejemplo resuelto

SPY está en 582,95 un viernes por la tarde. ZeroGEX muestra:

- **Net GEX:** +1.400 millones de $ (positivo - régimen de gamma larga)
- **Gamma Flip:** 581,20 (spot bien por encima)
- **Strike 0DTE más pesado:** 583,00 (prácticamente en el spot)
- **Max Pain:** 583,00 (coincide con el imán de gamma)
- **Hora:** 14:15 ET (empieza la acumulación de charm)

Todas las condiciones estructurales para un pin están activas. El imán está en 583; el max pain coincide en 583; el régimen es de gamma larga; estamos dentro de la ventana activa de fin de día. La probabilidad de que SPY oscile dentro de un rango de unos 30 centavos alrededor de 583 hasta el cierre está claramente elevada.

Lectura práctica: un rango ajustado de 582,70-583,30 es el recorrido esperado. Las excursiones hacia los bordes son candidatas a setups de fade. El centro del rango es territorio de no operar. Tamaño pequeño. Vigilar las condiciones de ruptura - sobre todo si aparece un shock de un valor individual o un titular inesperado.

Ahora imagina el mismo escenario pero con el Net GEX en −600 millones de $ y el gamma flip en 583,50 (spot por debajo). La tesis del "pin" se desmorona. Misma cadena, mismo strike, lectura opuesta - porque el régimen modelado que determina si el imán tiende a atraer o a liberar ha cambiado de signo.

---

## Conceptos erróneos habituales

- **"El pinning es solo psicología."** Los incentivos de payoff al vencimiento, la cobertura de los dealers, la liquidez y el comportamiento de los traders pueden contribuir todos. Los datos públicos no pueden aislar en qué medida un mecanismo concreto causó un pin observado.
- **"SPY siempre pinea en números redondos."** Cuando se produce el pinning, a menudo coincide con un posicionamiento concentrado. Los números redondos son comunes porque el OI se agrupa ahí, pero el OI por sí solo no demuestra la causa.
- **"Si el max pain es X, el precio cerrará en X."** A menudo es falso. El max pain es geometría de payoff, no una fuerza de cobertura; el imán de gamma modelado corresponde más directamente al flujo de cobertura. Cuando difieren, ZeroGEX se apoya en el imán.
- **"Los pines son alcistas/bajistas."** Ninguna de las dos cosas. Son supresores de volatilidad. Ligados a un rango. La dirección viene de otro lado; el pin trata sobre el *carácter de la acción del precio*, no sobre la dirección.
- **"El pinning ocurre todos los viernes."** A menudo, pero no siempre. Algunos viernes tienen catalizadores, regímenes de gamma corta o imanes migrando que impiden el pin. Leer las condiciones importa.

---

## Conclusión

> SPY tiende a anclarse porque la cobertura modelada de los dealers en strikes con mucha gamma puede devolver el precio hacia el strike. El tirón modelado puede usarse como contexto cuando las condiciones estructurales lo respaldan y lo tratas como una probabilidad, no como una certeza.

La disciplina consiste en verificar las condiciones antes de asumir que hoy es un día de pin. Régimen de gamma larga + strike pesado en el spot + coincidencia con el max pain + sesión avanzada inclinan las probabilidades hacia un pin nítido. Que cualquiera de estos factores se invierta debilita la lectura; que se inviertan todos, en la práctica, la anula.

Solo contenido educativo - nada de lo anterior es una recomendación de trading.

---

Si quieres ver el strike con más gamma de hoy, el max pain, el gamma flip y el Net GEX - los cuatro números que deciden si SPY pinea hoy -, la vista gratuita de niveles gamma de ZeroGEX los muestra todos.
