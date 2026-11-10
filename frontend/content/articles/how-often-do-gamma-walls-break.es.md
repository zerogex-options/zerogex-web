# ¿Con qué frecuencia se rompen realmente los gamma walls? Lo hemos medido

*Todo el mundo trata el call wall como resistencia y el put wall como soporte. Casi nadie publica una cifra. Medimos 737 pruebas de walls en SPY, SPX, QQQ y NDX - y resultó que la respuesta dependía de algo que la mayoría de los traders nunca comprueba.*

---

## La pregunta que nadie responde con una cifra

Un usuario de ZeroGEX nos lo planteó sin rodeos: había un call wall grande, el precio lo atravesó, y quería saber cómo juzgar la probabilidad de que eso ocurriera. Su intuición era que los walls suelen aguantar. La nuestra era la misma. Ninguno de los dos tenía una cifra.

Es un vacío extraño para un nivel que la gente opera todos los días. Así que construimos la medición.

Este artículo es el resultado, incluidas las partes que no funcionaron - que resultaron ser la mayoría, y que son más útiles que las que sí funcionaron.

---

## Cómo lo medimos

Las definiciones importan más que las cifras, porque una definición descuidada produce una cifra que parece segura y no significa nada.

**Una prueba** es el precio llegando a menos de 5 puntos básicos del wall vigente en ese minuto. No el wall de esta mañana - los walls migran, y el nivel que estás operando es el publicado en ese momento.

**Una ruptura** es el precio cerrando más allá del wall, con un margen, durante **diez minutos consecutivos**. Ese umbral es el importante. Los breakouts fallidos atraviesan habitualmente un nivel y se mantienen diez o quince minutos antes de deshacerse. Una definición que se activa con el primer tick al otro lado cuenta cada uno de ellos como una ruptura, y la probabilidad resultante no tiene sentido.

**Aguantar** es que transcurra la hora sin esa confirmación.

Hay otras dos decisiones que conviene explicar. Las pruebas que llegaron a la campana de cierre antes de poder resolverse se cuentan durante el tiempo que *sí* pudimos observarlas, en lugar de descartarse - eliminarlas sesgaría la muestra en contra del tape del final de la sesión, que es justo donde la gamma 0DTE pesa más. Y cuarenta minutos de forcejeo en un wall cuentan como una sola observación, no como cuarenta, porque es una sola decisión la que afronta un trader.

La muestra: **737 pruebas de walls, cuatro productos de índices, diez semanas (de finales de junio a principios de septiembre de 2026).**

---

## La respuesta es una curva, no una cifra

Lo primero que hicieron los datos fue negarse a darnos una cifra única.

"¿Se rompe el wall?" no es una pregunta bien planteada sin un reloj. Cuanto más tiempo se observa, más oportunidades hay de que se rompa. En SPX, las mismas pruebas produjeron una tasa de ruptura del 17,5% con un horizonte de treinta minutos y del 30,7% con uno de sesenta. Cualquier porcentaje sin más es en realidad una afirmación sobre una ventana de tiempo que alguien eligió.

Así que la forma honesta es P(ruptura en menos de *t* minutos desde la prueba):

| dentro de | SPX | QQQ |
|---|---|---|
| 15 min | 7,6% | 12,3% |
| 30 min | 17,5% | 30,0% |
| 45 min | 26,8% | 40,6% |
| 60 min | **30,7%** | **50,1%** |

Lee la fila que corresponde a tu periodo de tenencia. "¿Se rompe?" y "¿se rompe antes de que yo tenga que salir?" son preguntas distintas, y solo la segunda se puede operar.

---

## Es el índice, no el instrumento

Este es el resultado que no esperábamos.

| producto | strikes | índice | P(ruptura en menos de 60 min) |
|---|---|---|---|
| SPY | 1 $ | S&P 500 | 31,1% |
| SPX | 5 $ | S&P 500 | 30,7% |
| QQQ | 1 $ | Nasdaq 100 | 50,1% |
| NDX | 25 $ | Nasdaq 100 | 46,8% |

**Los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora. Los del Nasdaq estuvieron cerca de un cara o cruz.**

Fíjate ahora en los pares. SPY y SPX son estadísticamente indistinguibles. QQQ y NDX son indistinguibles. Todas las comparaciones S&P frente a Nasdaq difieren, y no por poco.

Eso descarta la explicación que nos parecía más probable. Las escaleras de strikes más finas reparten el open interest entre más strikes, así que cualquier "wall" individual es una parte menor del libro - una razón puramente mecánica por la que los walls de QQQ podrían ser más débiles. Si ese fuera el motivo, SPY (con strikes de 1 $) se comportaría como QQQ. No lo hace. Se comporta como SPX.

**Las probabilidades de ruptura de un wall son una propiedad del índice subyacente, y no varían con el mercado de opciones a través del cual las observas.** Una cadena de un ETF con strikes de 1 $ y una cadena de un índice con strikes de 25 $ dan la misma respuesta para el mismo subyacente.

La versión práctica: un call wall de QQQ es una estructura sustancialmente más débil que un call wall de SPX, y la diferencia es de aproximadamente diecisiete puntos porcentuales. Si aplicas una única tasa mental de aguante a todos los productos, te equivocas al menos en uno de ellos.

Por cierto, los call walls y los put walls se rompieron con la misma frecuencia en todos los horizontes y en todos los productos. Sea cual sea la asimetría que exista entre ellos, no está en la frecuencia con la que ceden.

---

## Lo que *no* predijo una ruptura

Esta es la parte que merece tu atención, porque es donde nos equivocamos.

Probamos diecinueve candidatos - los que buscaría cualquier trader que siga el posicionamiento de los dealers:

- el tamaño del wall en dólares, su peso dentro del libro y su percentil frente a su propio historial
- si la gamma del wall se estaba **fortaleciendo o consumiendo** mientras el precio presionaba sobre él
- si el wall estaba **migrando** por delante del precio
- el Net GEX, su trayectoria, la distancia al gamma flip y en qué lado del flip estaba el precio
- el **flujo de órdenes con signo en el propio strike del wall**, y si ese flujo se estaba acelerando
- cuánto tiempo llevaba en pie el wall, cuántas veces se había puesto ya a prueba, la hora del día y la volatilidad realizada

Un predictor real debería apuntar en el mismo sentido en todos los productos. En los cuatro, **dos variables lo hicieron - y el azar por sí solo produce 2,6.**

En el nivel del azar o por debajo. Tras tres enfoques estadísticos distintos, nada sobrevivió.

También nos equivocamos con un resultado nulo en la otra dirección. Al principio, trabajando solo con SPX, dijimos que el tamaño del wall no aportaba información. En los cuatro productos apunta de forma consistente en el sentido intuitivo - wall más grande, menos rupturas -, aunque con demasiada debilidad para separarlo del ruido. SPX resultó ser la única muestra en la que desaparecía, y construimos una afirmación sobre ella. Lo honesto es decir que hay *un efecto pequeño en la dirección esperada que estos datos no pueden distinguir del ruido* - ni un resultado nulo, ni un hallazgo.

---

## Entonces, ¿cómo deberías usar un wall?

**Como una estimación a priori, no como un disparador.**

La información estructural de un gamma wall es real. Solo que no está donde la mayoría la busca. Está en la tasa base del índice al que pertenece el wall - S&P 500 o Nasdaq-100, sea cual sea el producto a través del que lo observes - y no en qué lado del flip está el precio, ni en ninguna propiedad legible del wall concreto que tienes delante.

Eso replantea la operación. Si estás haciendo fade de un call wall en SPX, estás apostando por un nivel que aguantó aproximadamente dos de cada tres veces en el plazo de una hora en esta muestra. Es una tasa base significativa, y también es una probabilidad de una entre tres de que te pasen por encima. En QQQ, la misma apuesta está cerca de un cara o cruz. Son apuestas distintas y merecen tamaños distintos.

Lo que esto **no** autoriza es tratar un wall como un nivel que va a aguantar. Nada en diez semanas de datos respalda leer un wall concreto y concluir que este es diferente.

---

## Lo que esto no dice

Cuatro límites honestos.

**Diez semanas son diez semanas.** Un régimen de volatilidad, un verano. Las tasas base pueden cambiar, y seguiremos midiendo.

**Esta es la probabilidad de ruptura *dado que el precio llegó al wall*.** Es deliberadamente una pregunta distinta de si el precio llega o no hasta ahí. Condicionar a la prueba elimina el término de la distancia - y la distancia es el factor dominante para que un nivel llegue siquiera a ponerse a prueba. Es perfectamente posible que la mayor parte de la información pronosticable estuviera en "¿se alcanzará?", y que lo que queda tras la llegada sea casi aleatorio dentro de un índice. Eso sería en sí mismo un hallazgo.

**El posicionamiento de los dealers es modelado, no observado.** Los gamma walls salen de la convención estándar de open interest call-positivo / put-negativo. Un día en que los clientes fueron *compradores* netos de las opciones del lado del wall, ese wall nunca fue resistencia para empezar, y ningún grado de seguimiento te lo habría dicho. Es un límite de lo que pueden revelar los datos públicos, y es la razón más probable por la que un wall se rompe "inesperadamente".

**"Ninguna variable predijo la ruptura" no es "el GEX no funciona".** Es una afirmación sobre una pregunta condicional concreta, medida de una forma concreta, en una ventana concreta.

---

## Cómo leer esto en ZeroGEX

Los niveles en sí están en las páginas gratuitas de niveles gamma de [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) y [NDX](/ndx-gamma-levels) - call wall, put wall, gamma flip y Net GEX uno junto a otro. Para la lectura en vivo a medida que los walls migran durante la sesión, el que hay que vigilar es el [dashboard 0DTE en tiempo real](/real-time-gex-0dte).

Combina el nivel con la tasa base del producto que estás operando, y con [cómo leer un gamma flip](/education/how-to-read-a-gamma-flip) - aquí el régimen no cambió la frecuencia con la que se rompieron los walls, pero sí decide si la cobertura modelada se opone a un movimiento o se suma a él una vez que un wall cede. El [pilar de gamma walls](/education/gamma-walls-explained) explica qué es un wall y por qué se comporta como lo hace, y [por qué fallan los breakouts](/education/why-do-breakouts-fail) explica el mecanismo desde la otra dirección.

---

## Conclusión

> Un gamma wall es una tasa base, no una predicción. Los walls del S&P aguantaron aproximadamente dos de cada tres veces en la hora siguiente a ser puestos a prueba; los del Nasdaq estuvieron más cerca de un cara o cruz - y no importó si observabas el ETF o el índice. De las diecinueve cosas que medimos sobre walls individuales, ninguna nos dijo cuáles se romperían. Opera el wall como una estimación a priori con una tasa de acierto conocida, con un tamaño adecuado al producto en el que estás, y trata con recelo cualquier afirmación de que *este* wall es diferente.

Solo contenido educativo - nada de lo anterior es una recomendación de trading, y ninguna cifra de este artículo está calibrada como señal de trading.
