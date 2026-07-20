# Basic Signal Dashboard

*Las seis lecturas continuas que alimentan el composite — qué son, cómo interpretarlas y dónde profundizar.*

---

## Qué es el Basic Signal Dashboard

El Basic Signal Dashboard es la **cuadrícula de un vistazo** de las seis señales Basic. Cada tarjeta muestra el puntaje actual en la línea [-1, +1], la contribución que aporta al composite y un sparkline.

Las señales Basic son **continuas**. No disparan alertas discretas — empujan el composite hacia arriba o hacia abajo en cada actualización.

## Las seis señales

| Señal | Qué pregunta | Sesgo de trade | Peso en el composite |
| --- | --- | --- | --- |
| Tape Flow Bias | "¿Hacia dónde se inclina el tape?" | Continuación | 0.08 |
| Skew Delta | "¿Cuánto miedo está incorporado en los puts?" | Lectura direccional | 0.04 |
| Vanna/Charm Flow | "¿Forzarán la vol o el tiempo a los dealers a re-cubrirse?" | Continuación | 0.04 |
| Dealer Delta Pressure | "¿Están los dealers obligados a perseguir este movimiento?" | Lectura direccional | 0.08 |
| GEX Gradient | "¿Está el gamma concentrado en un lado?" | Lectura direccional | 0.08 |
| Positioning Trap | "¿Está la multitud mal posicionada?" | Reversión a la media (vs. la multitud) | 0.06 |

Los pesos son la proporción del composite que aporta cada señal cuando el resto del universo está en silencio.

## Lectura rápida de cada una

### Tape Flow Bias

Clasificación de agresor Lee-Ready sobre el tape de opciones. Neto entre prima de compra/venta de calls y prima de compra/venta de puts. Positivo = los agresores están pagando por el alza. Una señal fuerte aquí, en ausencia de un GEX gradient opuesto, es convicción en tiempo real.

### Skew Delta

El spread entre la IV de puts OTM menos la IV de calls OTM frente a su línea base. Lecturas negativas significan que el miedo está incorporado; lecturas positivas significan que la prima de las calls está incorporada (codicia). Útil más como termómetro de sentimiento que como señal de precisión.

### Vanna/Charm Flow

Vanna y charm agregados de los dealers. El vanna es lo que los dealers cubrirán si la vol se mueve; el charm es lo que cubrirán a medida que pasa el tiempo. Lecturas positivas significan que el flujo estructural respalda precios más altos; negativas, lo contrario. El charm se acelera hacia el cierre.

### Dealer Delta Pressure

El delta neto de los dealers a partir de la cadena de opciones (call_delta_oi + put_delta_oi). Un valor fuertemente negativo significa que los dealers están short delta y comprarán si el precio sube; un valor fuertemente positivo significa que están long y venderán si el precio sube. La señal pregunta "¿están los dealers obligados a perseguir?".

### GEX Gradient

Gamma por encima del spot frente al gamma por debajo del spot, con una verificación de concentración ATM. Indica en qué lado del spot hay más peso de gamma. Gradiente positivo ⇒ gamma concentrado por encima del spot ⇒ pin estructural alcista; negativo ⇒ pin estructural bajista.

### Positioning Trap

PCR + desequilibrio con signo del smart money + momentum de 5 barras + inclinación de flip + contexto de régimen. Pregunta si la multitud está posicionada en el sentido equivocado. **Esta es una señal de reversión a la media** — un puntaje positivo alto es una señal de "vender la subida", no de "ponerse largo".

## Cómo leer el dashboard

Tres patrones:

1. **Buscar confluencia.** Si tres o cuatro de las seis señales apuntan en la misma dirección con magnitudes no triviales, el composite lo reflejará.
2. **Buscar divergencia.** Cuando el Tape Flow Bias es fuertemente positivo pero el GEX Gradient es marcadamente negativo, los dealers desvanecerán las compras — el tape se equivoca sobre dónde está el pin estructural.
3. **Observar el Positioning Trap por separado.** Es la única señal Basic con sesgo de reversión a la media. Trate una lectura de Trap muy positiva junto con un Tape fuertemente long como una advertencia, no como una confirmación.

## Qué no aparece en el dashboard Basic

Los triggers. Ninguna de estas señales se dispara. Si busca alertas impulsadas por triggers, consulte el [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard).

## Cada tarjeta tiene una página de profundización

Haga clic en cualquier tarjeta para ir a la página de la señal individual, que muestra:

- El sparkline del puntaje en mayor resolución
- Los valores de entrada actuales (los componentes que alimentan el puntaje)
- La explicación "Cómo está construido"
- El historial reciente

## Ver también

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
