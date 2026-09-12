# ¿Qué es un Put Wall? La concentración de gamma en puts, explicada
> **Nota metodológica actualizada — prevalece sobre cualquier formulación incompatible posterior.** ZeroGEX estima, pero no observa, el inventario de los dealers a partir de datos públicos. El modelo conserva la convención calls positivos/puts negativos (`Net GEX = Call GEX − Put GEX`) y supone dealers netos largos de calls y cortos de puts. Las calls y puts largas tienen gamma positiva; las calls y puts cortas tienen gamma negativa. El Put Wall es la mayor concentración de gamma de puts por debajo del spot y representa localmente gamma negativa modelada del dealer: puede coincidir con soporte, pero la cobertura de una put corta no crea mecánicamente un suelo. Los walls pueden migrar por spot, tiempo y volatilidad implícita aunque el open interest oficial no cambie intradía. Al acercarse el vencimiento, la gamma se concentra cerca del ATM: la gamma ATM puede aumentar, mientras la gamma claramente ITM u OTM tiende a cero. El Gamma Flip seleccionado es una transición local; el perfil puede tener varios cruces o ninguno significativo. Charm y vanna son cambios condicionales de delta, no órdenes programadas. Las puntuaciones son resultados heurísticos, no probabilidades calibradas. La gamma negativa amplifica la dirección ya iniciada; la distancia a un objetivo no implica repulsión. Por ello, la inversión del término pin de EOD Pressure sigue siendo una heurística de ZeroGEX. Max Pain minimiza el pago intrínseco agregado y no maximiza exactamente el nocional que vence sin valor. El DEX bruto mide delta solo de opciones, no flujo futuro de cobertura; la prima y el lado agresor no prueban información, apertura ni convicción.

*El Put Wall en lenguaje llano — qué es, por qué el precio suele reaccionar cerca de él, por qué la cobertura modelada de put corta no lo convierte en un suelo mecánico, en qué se diferencia del Call Wall, qué significa una rotura y dónde encontrar el Put Wall de hoy para SPX, SPY, QQQ y NDX.*

---

## ¿Qué es un Put Wall?

Un **Put Wall** es el strike por debajo del precio actual donde la exposición de gamma del lado de las puts está más concentrada en la cadena de opciones. Los traders lo observan como el borde inferior del rango con el que el posicionamiento actual es más consistente — el strike donde una caída tiene más probabilidades de encontrar una reacción de la cobertura, la liquidez y el resto del flujo que se acumula alrededor de un strike cargado.

Con más precisión: el Put Wall es el strike en el spot o por debajo de él con la mayor magnitud de gamma de puts sin signo en la cadena de opciones seleccionada. ZeroGEX ordena los strikes a partir de la gamma modelada multiplicada por el interés abierto oficial y aplica el filtro del lado del spot. Es una referencia estructural, no una promesa de que el precio vaya a rebotar.

Bajo la convención tradicional de ZeroGEX de calls positivas y puts negativas, el inventario de puts en ese strike es **gamma del dealer modelada localmente negativa**. Para un dealer con cobertura de delta que está corto de una put, una caída del precio hace que la posición en opciones tenga un delta más positivo; mantener la cobertura suele exigir vender más subyacente. Ese ajuste local puede reforzar la caída. Por tanto, el Put Wall no es un suelo defendido mecánicamente por los dealers ni la imagen especular de un Call Wall positivo.

## Cómo modela ZeroGEX el posicionamiento de los dealers

Los datos públicos de la cadena de opciones no revelan el inventario completo, largo y corto, de los dealers. Por eso ZeroGEX asigna exposición modelada positiva a las calls y negativa a las puts, lo que se corresponde a grandes rasgos con dealers netos largos de las calls que venden los clientes y netos cortos de las puts que compran los clientes. La convención es útil para comparar la estructura de la cadena, pero no es una observación directa del inventario de los dealers; el posicionamiento real puede ser distinto.

El Net GEX modelado sigue siendo:

```text
Net GEX modelado = Call GEX - Put GEX
```

Las calls largas y las puts largas tienen gamma positiva; las calls cortas y las puts cortas tienen gamma negativa. El signo negativo de las puts de arriba proviene de la posición supuesta del dealer, no de una gamma inherentemente negativa de las puts.

## Por qué el Put Wall suele coincidir con un soporte

Un Put Wall puede coincidir con un soporte observado por el perfil completo de gamma, la liquidez, la monetización de puts, el comportamiento de los clientes, la demanda sistemática u otros flujos del mercado. La gamma de calls modelada positiva en otros strikes también puede superar la gamma de puts modelada negativa en el wall, dejando el Net GEX agregado en positivo. Pero una gamma agregada positiva no demuestra que la compra de los dealers esté concentrada en el Put Wall.

Trata el nivel como:

- una gran concentración de gamma de puts;
- una posible referencia de liquidez y posicionamiento;
- un nivel que empíricamente puede comportarse como soporte; y
- un nivel cuyo comportamiento depende de la gamma agregada y local más el flujo circundante.

## Put Wall frente a Call Wall

Los dos walls se construyen igual en lados opuestos del spot, y ahí termina la simetría.

| | Put Wall | Call Wall |
|---|---|---|
| Lado del spot | En el spot o por debajo | En el spot o por encima |
| Ordenado por | Mayor magnitud de gamma de puts (gamma modelada × interés abierto) | Mayor magnitud de gamma de calls (gamma modelada × interés abierto) |
| Signo modelado del dealer | Negativo — dealers modelados como cortos de las puts que compran los clientes | Positivo — dealers modelados como largos de las calls que venden los clientes |
| Lectura habitual | Borde inferior del rango de posicionamiento; puede coincidir con soporte | Borde superior del rango de posicionamiento; puede coincidir con resistencia o pinning |
| Cobertura local, aislada | Una caída puede exigir más ventas, lo que puede reforzar el movimiento | Una subida puede exigir ventas, lo que puede frenar el movimiento |
| En una rotura | La referencia falló o migró; con gamma negativa el movimiento puede acelerarse | La referencia falló o migró; suele leerse como un cambio de posicionamiento |

Los Call Wall y Put Wall no son mecánicamente simétricos. Un Call Wall es el strike en el spot o por encima con la mayor magnitud de gamma de calls; un Put Wall usa la magnitud de gamma de puts por debajo del spot. El tipo de opción por sí solo no determina resistencia, soporte, atracción ni aceleración. La comparación completa está en [¿Qué es un Call Wall?](/education/what-is-a-call-wall) y [Gamma Walls Explained](/education/gamma-walls-explained).

## Put Wall frente a gamma flip frente a max pain

Tres niveles que se confunden entre sí:

- El **Put Wall** es una *concentración* — el strike con más gamma de puts por debajo del spot.
- El [gamma flip](/education/how-to-read-a-gamma-flip), o [nivel de gamma cero](/education/zero-gamma-level-explained), es una *línea de régimen* — el precio donde la gamma neta modelada de los dealers cambia de signo. Decide si la cobertura cerca de los walls tiende a amortiguar los movimientos o a amplificarlos. El flip está con frecuencia por encima del Put Wall, así que el precio puede romper el Put Wall estando todavía en gamma positiva, o mantenerlo estando ya en gamma negativa.
- El [max pain](/education/max-pain-explained) es un cálculo de *valor al vencimiento* — el strike donde se minimiza el valor que expira para los tenedores de opciones. No es una concentración de gamma y a menudo no está cerca de ninguno de los dos walls.

Leer el Put Wall sin el flip es el error más común de esta página. El wall te dice dónde el posicionamiento es denso; el flip te dice qué es probable que haga ese posicionamiento denso.

## Por qué un wall puede migrar durante la sesión

El interés abierto oficial suele actualizarse tras la compensación, no de forma continua durante la sesión. Aun así, los walls de ZeroGEX pueden migrar durante la sesión porque el spot, el tiempo hasta el vencimiento y la volatilidad implícita cambian la gamma modelada de cada strike. La clasificación relativa puede cambiar, un strike puede cruzar de un lado del spot al otro, u otro strike con el mismo interés abierto puede pasar a ser el máximo.

El cálculo del wall no establece que volumen nuevo haya abierto posiciones nuevas. El volumen no distingue actividad de apertura de la de cierre, y no es interés abierto intradía verificado. A medida que se acerca el vencimiento, la gamma se concentra cada vez más cerca del strike at the money: la gamma ATM puede dispararse, mientras que la gamma en strikes que quedan decididamente dentro o fuera del dinero tiende a cero. Esa revaluación es distinta del cierre de contratos o de la actualización del interés abierto oficial.

## Qué ocurre cuando el Put Wall se rompe

Una rotura por debajo del Put Wall es información, no un veredicto. Léela con cuatro preguntas:

1. **¿Qué régimen estaba vigente?** Por encima del gamma flip, la cobertura agregada tiende a frenar la caída, y una rotura se detiene más a menudo en la siguiente concentración de puts. Por debajo del flip, el reflejo va con el movimiento y una rotura puede acelerarse — la cobertura local de put corta descrita arriba está ahora alineada con el libro general.
2. **¿El wall migró o falló?** Un wall que se reordenó a un strike más bajo al cambiar los inputs no fue "roto"; la referencia se movió. Compara el strike del wall antes y después de la rotura.
3. **¿El flujo lo arrolló?** Los titulares macro, los rebalanceos de índices y las órdenes grandes aportan un flujo que empequeñece la cobertura. Una rotura en ese tipo de tape dice poco sobre el wall.
4. **¿Se cruzó el gamma flip?** Una rotura puede significar que la referencia falló, que el flujo circundante dominó, que la gamma local se debilitó o que el wall migró. Solo un cruce del Gamma Flip calculado — o un cambio real de signo del Net GEX modelado — sostiene la afirmación de un cambio de régimen de gamma.

Tras una rotura, el siguiente strike con más gamma de puts por debajo se convierte en el nuevo Put Wall en la siguiente instantánea. Así es como el nivel "baja escalones" en una sesión con tendencia.

## Una lectura práctica

Supón que el SPX está en 5.830, el Put Wall en 5.790, el Call Wall en 5.850 y el Net GEX modelado es positivo. El Put Wall identifica la mayor magnitud de gamma de puts por debajo del spot. **No** identifica por sí mismo una zona de compra. Un trader puede observar si la liquidez absorbe las ventas ahí, si el perfil de gamma agregado se mantiene estable, si el wall migra al cambiar los inputs y si el flujo direccional confirma o arrolla el nivel.

Supón ahora que el SPX cae a 5.785 una hora después y que el gamma flip, publicado en 5.815, ha sido cruzado. Dos cosas cambiaron a la vez: la referencia del Put Wall falló y el régimen modelado pasó a negativo. Lo segundo es lo que importa para la siguiente operación — el reflejo de cobertura que podría haber frenado la caída ahora está modelado para acompañarla, y la siguiente concentración de puts por debajo es la nueva referencia, no un objetivo de rebote.

## Cómo encontrar el Put Wall de hoy

ZeroGEX publica el Put Wall — junto al Call Wall, el gamma flip, el max pain y el Net GEX — gratis y con unos 15 minutos de retraso, para [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) y [NQ](/nq-gamma-levels). Cada página se refresca a lo largo de la sesión y muestra la hora de la instantánea junto a cada nivel. Para dibujar el nivel en tu propio gráfico, el [indicador de TradingView](/tradingview-indicator) y el [estudio de thinkorswim](/thinkorswim-indicator) gratuitos trazan el Put Wall como una línea horizontal; el valor en vivo, actualizado por debajo del minuto, está dentro del dashboard de ZeroGEX.

Dos hábitos hacen que el número sea útil en vez de decorativo: fíjate en la hora de la instantánea (un Put Wall de la mañana leído contra un tape de la tarde es otro libro) y léelo con el gamma flip en la misma pantalla.

## Conclusión

> El Put Wall es una concentración modelada de gamma de puts y una referencia estructural útil. Puede coincidir con un soporte, pero el soporte no es una consecuencia directa de la cobertura modelada de put corta del dealer en ese strike.

Consulta los walls modelados de hoy en [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) y [NDX](/ndx-gamma-levels), o compara el marco más amplio en [Gamma Walls Explained](/education/gamma-walls-explained).

Solo contenido educativo — nada de lo anterior es una recomendación de trading.
