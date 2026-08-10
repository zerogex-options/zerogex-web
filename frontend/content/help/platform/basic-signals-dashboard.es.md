# Basic Signal Dashboard

*Las seis lecturas continuas que alimentan el composite — qué son, cómo interpretarlas y dónde profundizar.*

---

## Qué es el Basic Signal Dashboard

El Basic Signal Dashboard es la **cuadrícula de un vistazo** de las seis señales Basic. Cada tarjeta muestra el puntaje actual en la línea [-1, +1], la contribución que aporta al composite y un sparkline.

Las señales Basic son **continuas**. No disparan alertas discretas — empujan el composite hacia arriba (hacia tendencia) o hacia abajo (hacia lateralización) en cada actualización.

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

El spread entre la IV de puts OTM menos la IV de calls OTM frente a su línea base, con el signo invertido para que el puntaje se lea de forma direccional: lecturas negativas significan que el miedo está incorporado (skew de puts caro); lecturas positivas significan que la prima de las calls está incorporada (codicia). Útil más como termómetro de sentimiento que como señal de precisión.

### Vanna/Charm Flow

Vanna y charm agregados de los dealers. El vanna modela lo que los dealers *podrían* cubrir si la vol se mueve; el charm modela la deriva de delta a medida que pasa el tiempo (manteniendo constantes el spot y la IV). Una lectura positiva modela un flujo de cobertura que *puede* respaldar precios más altos; una negativa, lo contrario — la dirección y la magnitud siguen dependiendo de la composición del libro y de quién posee las opciones. La presión del charm tiende a acumularse hacia el cierre.

### Dealer Delta Pressure

El delta neto de los dealers a partir de la cadena de opciones (call_delta_oi + put_delta_oi) — una lectura modelada aparte del gamma. Un valor fuertemente negativo modela dealers short delta, que *tenderían* a comprar más arriba para mantenerse cubiertos; un valor fuertemente positivo los modela long, tendiendo a vender más arriba. La señal pregunta "¿es probable que los dealers persigan este movimiento?".

### GEX Gradient

Gamma por encima del spot frente al gamma por debajo del spot, con una verificación de concentración ATM. Indica en qué lado del spot hay más peso de gamma modelado. Gradiente positivo ⇒ más gamma por debajo del spot ⇒ un suelo de soporte modelado (sesgo alcista, suponiendo que los dealers estén long gamma ahí); negativo ⇒ más gamma por encima del spot ⇒ sesgo que amplifica a la baja. El sesgo supone que se mantiene el signo modelado del gamma de los dealers.

### Positioning Trap

PCR + desequilibrio con signo del smart money + momentum de 5 barras + inclinación de flip + contexto de régimen. Pregunta si la multitud está posicionada en el sentido equivocado — y desvanece a la multitud, no al precio. Un puntaje **positivo** alto señala una multitud inclinada a short (muchos puts) que puede ser exprimida **al alza** — un short-cover squeeze alcista; un puntaje **negativo** alto señala una multitud inclinada a long (muchos calls) vulnerable a un flush **a la baja**. El signo debe leerse como la dirección del squeeze/flush, no como una simple indicación de "ponerse largo/corto".

## Cómo leer el dashboard

Tres patrones:

1. **Buscar confluencia.** Si tres o cuatro de las seis señales apuntan en la misma dirección con magnitudes no triviales, el composite se moverá hacia un régimen de tendencia o de lateralización en consecuencia.
2. **Buscar divergencia.** Cuando el Tape Flow Bias es fuertemente positivo pero el GEX Gradient es marcadamente negativo, los dealers desvanecerán las compras — el tape se equivoca sobre dónde está el pin estructural.
3. **Observar el Positioning Trap por separado.** Es la única señal Basic con sesgo de reversión a la media. Una lectura de Trap muy **negativa** (una multitud inclinada a long en riesgo de un flush a la baja) junto con un Tape fuertemente long es una advertencia, no una confirmación — la multitud a la que se suma el tape es justo la que el Trap marca como mal posicionada.

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
