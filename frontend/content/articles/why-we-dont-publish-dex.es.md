# Por qué no publicamos el DEX bruto como señal de flujo principal
> **Nota metodológica actualizada — prevalece sobre cualquier formulación incompatible posterior.** ZeroGEX estima, pero no observa, el inventario de los dealers a partir de datos públicos. El modelo conserva la convención calls positivos/puts negativos (`Net GEX = Call GEX − Put GEX`) y supone dealers netos largos de calls y cortos de puts. Las calls y puts largas tienen gamma positiva; las calls y puts cortas tienen gamma negativa. El Put Wall es la mayor concentración de gamma de puts por debajo del spot y representa localmente gamma negativa modelada del dealer: puede coincidir con soporte, pero la cobertura de una put corta no crea mecánicamente un suelo. Los walls pueden migrar por spot, tiempo y volatilidad implícita aunque el open interest oficial no cambie intradía. Al acercarse el vencimiento, la gamma se concentra cerca del ATM: la gamma ATM puede aumentar, mientras la gamma claramente ITM u OTM tiende a cero. El Gamma Flip seleccionado es una transición local; el perfil puede tener varios cruces o ninguno significativo. Charm y vanna son cambios condicionales de delta, no órdenes programadas. Las puntuaciones son resultados heurísticos, no probabilidades calibradas. La gamma negativa amplifica la dirección ya iniciada; la distancia a un objetivo no implica repulsión. Por ello, la inversión del término pin de EOD Pressure sigue siendo una heurística de ZeroGEX. Max Pain minimiza el pago intrínseco agregado y no maximiza exactamente el nocional que vence sin valor. El DEX bruto mide delta solo de opciones, no flujo futuro de cobertura; la prima y el lado agresor no prueban información, apertura ni convicción.

*Qué mide el Delta Exposure calculado solo con opciones, qué omite y para qué puede seguir siendo útil.*

---

## La objeción, en sentido estricto

El DEX bruto es una estimación modelada de la **exposición de delta calculada solo con opciones**, resumida habitualmente como `Σ(delta × interés abierto × multiplicador del contrato)`. Puede describir el inventario direccional supuesto de la pata de opciones. Como excluye la cobertura compensatoria en el subyacente y mide un nivel en lugar de un cambio, ZeroGEX no lo considera una estimación fiable por sí sola del futuro flujo de cobertura de los dealers.

Esa es una afirmación más estrecha que decir que el DEX no significa nada. La propiedad real de los dealers no es observable en el interés abierto público, así que el DEX hereda además cualquier convención de posicionamiento que aplique el cálculo.

## Un nivel no es una operación futura

Un dealer puede compensar el delta de opciones con acciones, futuros u otras opciones, y puede gestionar la cartera agregada dentro de bandas de cobertura. El DEX bruto calculado solo con opciones omite esas coberturas. Más importante aún: un nivel de delta actual no dice cómo cambiará el delta a continuación. La demanda potencial de cobertura surge cuando el spot, el tiempo, la volatilidad implícita, nuevas operaciones o cambios de posición alteran el delta de la cartera.

Los contratos muy dentro del dinero pueden aportar mucho a un total de delta calculado solo con opciones, porque su delta absoluto se acerca a uno. Eso no es un error: forma parte de la estimación de inventario. Sí implica que un total bruto elevado no tiene por qué identificar los strikes con mayor sensibilidad del delta a corto plazo. La gamma, el charm y la vanna tienen perfiles distintos por strike y por vencimiento; no todos alcanzan su máximo en el dinero de forma universal.

## Usos válidos del DEX

Con sus supuestos enunciados con claridad, el DEX puede sustentar:

- estimaciones modeladas de inventario direccional calculadas solo con opciones;
- comparaciones de la estructura de la cadena a lo largo del tiempo;
- análisis de escenarios; y
- un componente dentro de un modelo de cartera más amplio.

No debería reetiquetarse como una posición observada de los dealers ni como un pronóstico de la próxima orden en el subyacente.

## Por qué ZeroGEX prefiere la revaluación por escenarios

El modelo Forced Flow de ZeroGEX compara el delta modelado de la cartera ahora con el delta modelado bajo un escenario definido de spot, tiempo y volatilidad. La diferencia es una estimación de la presión de cobertura **potencial**, condicionada al inventario supuesto y al escenario. No es prueba de que los dealers vayan a ejecutar ese importe: las carteras pueden contener posiciones compensatorias, los inputs pueden moverse a la vez, y las mesas pueden cubrirse con instrumentos o en momentos distintos.

> El DEX bruto puede describir un nivel de delta supuesto, calculado solo con opciones. ZeroGEX no usa ese nivel por sí solo como estimación del futuro flujo de cobertura de los dealers.

Para los conceptos de fondo, consulta [Por qué los market makers se ven obligados a operar en acciones](/education/why-market-makers-trade-stock) y [Delta y sus tres hijos](/education/delta-and-its-three-children).

Solo contenido educativo — nada de lo anterior es una recomendación de trading.
