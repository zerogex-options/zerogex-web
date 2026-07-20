# GEX Summary & Greeks

*Las cifras principales de GEX junto con los agregados de delta, gamma, vanna y charm.*

---

## Qué muestra esta página

La página GEX Summary es la **agregación por greek** del libro de opciones. Mientras que Dealer Positioning es estructural (walls, flip, perfil), esta página ofrece los totales en cifras: delta, gamma, vanna, charm y vega agregados.

## Las cinco cifras principales

### Net GEX

El gamma agregado de los dealers en dólares. Positivo ⇒ los dealers compran en la debilidad y venden en la fortaleza. Negativo ⇒ los dealers persiguen el precio. Se muestra en el spot.

### Net DEX

El delta agregado de los dealers. Un valor muy negativo significa que los dealers están cortos de delta y necesitan estructuralmente comprar a precios más altos.

### Net VEX (Vanna)

La vanna agregada de los dealers — la sensibilidad del delta ante la IV. Positiva significa que una caída de la IV obliga a los dealers a vender; una subida de la IV los obliga a comprar. Este es el motor de las jornadas de "grind por compresión de volatilidad".

### Net Charm

El charm agregado de los dealers — la sensibilidad del delta ante el paso del tiempo. Positivo respalda estructuralmente el drift hacia el cierre; negativo lo presiona. El flujo impulsado por charm se intensifica en las últimas dos horas.

### Net Vega

El vega agregado de los dealers. Indica cuán expuestos están los dealers ante un movimiento significativo de la IV.

## El desglose por strike

Debajo de los totales, la página muestra las mismas cifras desglosadas por strike — las contribuciones de cada strike a gamma, delta, vanna y charm. Úsalo cuando:

- Quieras ver **qué strikes** están impulsando la cifra principal.
- Quieras confirmar que el call wall realmente está donde indica el perfil GEX.
- Quieras detectar una concentración de vanna o charm que el perfil GEX no deja evidente.

## Convenciones de signo

ZeroGEX usa de forma consistente la perspectiva del dealer:

- Gamma positivo ⇒ los dealers están netos largos en calls / cortos en puts, y cubren su posición contra el precio.
- Delta positivo ⇒ los dealers están largos en delta.
- Vanna positiva ⇒ los dealers se benefician (en términos de delta) cuando sube la volatilidad.
- Charm positivo ⇒ los dealers se benefician (en términos de delta) a medida que pasa el tiempo.

Cuando consultes a otro proveedor de datos de GEX, verifica siempre la convención de signos. La mayoría usa el mismo signo basado en la perspectiva del dealer, pero algunos lo invierten.

## Cómo leer la página

Dos patrones:

1. **Verificación cruzada con Dealer Positioning.** Si el Net GEX es significativamente positivo pero el perfil GEX muestra que la curva cruza a negativo justo por debajo del spot, estás sobre la línea de régimen — el riesgo es asimétrico.
2. **Observa vanna y charm hacia el cierre.** Ambos alcanzan su máxima influencia intradía en las últimas dos horas; la contribución del charm por strike te indica dónde se asentará el pin.

## Ver también

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Vanna y Charm explicados para traders de opciones](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) explicado](/education/gamma-exposure-explained)
