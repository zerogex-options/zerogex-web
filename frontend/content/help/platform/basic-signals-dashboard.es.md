# Basic Signal Dashboard

*Las seis lecturas continuas que acompañan al composite - qué son, cómo interpretarlas y dónde profundizar.*

---

## Qué es el Basic Signal Dashboard

El Basic Signal Dashboard (Basic y Pro) es la **vista de un vistazo** de las seis señales Basic. Una franja en la parte superior muestra los seis puntajes a la vez. Debajo hay tres pestañas:

- **Signal Grid** - una tarjeta por señal con su puntaje en la línea de -100 a +100, un sparkline, una descripción de una línea y **Context values**, que puedes desplegar para ver los insumos detrás del puntaje.
- **Confluence Matrix** - con qué frecuencia cada par de señales ha coincidido o discrepado en dirección.
- **Event Timelines** - la trayectoria reciente del puntaje de cada señal, con los cambios de dirección marcados.

Las señales Basic son **continuas** y **orientativas**. No disparan alertas discretas y tienen **peso cero en el Composite Score (MSI)** - un movimiento aquí no mueve el MSI. Úsalas como contraste temprano: cuando las lecturas de flujo divergen de las de estructura, a menudo ya hay un cambio de régimen en marcha antes de que reaccione el MSI.

Una tarjeta cuyo puntaje supera ±25 se resalta con un borde y se marca como *Triggered*; por debajo muestra *Stand by*. En este dashboard eso destaca una lectura fuerte, no es un evento de trigger.

## Las seis señales

| Señal | Qué pregunta | Sesgo de trade |
| --- | --- | --- |
| Tape Flow Bias | "¿Hacia dónde se inclina el tape?" | Continuación |
| Skew Delta | "¿Cuánto miedo está incorporado en los puts?" | Lectura direccional |
| Vanna/Charm Flow | "¿Podrían la vol o el tiempo empujar a los dealers a re-cubrirse?" | Continuación |
| Dealer Delta Pressure | "¿Están los dealers obligados a perseguir este movimiento?" | Lectura direccional |
| GEX Gradient | "¿Está el gamma concentrado en un lado?" | Lectura direccional |
| Positioning Trap | "¿Está la multitud mal posicionada?" | Reversión a la media (vs. la multitud) |

Ninguna de las seis alimenta el Composite Score. La única coincidencia: el MSI tiene su propio componente Dealer Delta Pressure, construido sobre la misma lectura del delta neto de los dealers que la señal Basic.

## Lectura rápida de cada una

### Tape Flow Bias

Clasificación de agresor Lee-Ready sobre el tape de opciones. Neto entre prima de compra/venta de calls y prima de compra/venta de puts. Positivo = los agresores están pagando por el alza. Una señal fuerte aquí, en ausencia de un GEX gradient opuesto, es convicción en tiempo real.

### Skew Delta

El spread entre la IV de puts OTM menos la IV de calls OTM frente a su línea base, con el signo invertido para que el puntaje se lea de forma direccional: lecturas negativas significan que el miedo está incorporado (skew de puts caro); lecturas positivas significan que la prima de las calls está incorporada (codicia). Útil más como termómetro de sentimiento que como señal de precisión.

### Vanna/Charm Flow

Vanna y charm agregados de los dealers. El vanna modela lo que los dealers *podrían* cubrir si la vol se mueve; el charm modela la deriva de delta a medida que pasa el tiempo (manteniendo constantes el spot y la IV). Una lectura positiva modela un flujo de cobertura que *puede* respaldar precios más altos; una negativa, lo contrario - la dirección y la magnitud siguen dependiendo de la composición del libro y de quién posee las opciones. La presión del charm tiende a acumularse hacia el cierre.

### Dealer Delta Pressure

El delta neto de los dealers a partir de la cadena de opciones (call_delta_oi + put_delta_oi) - una lectura modelada aparte del gamma. El puntaje está invertido: un puntaje fuertemente **positivo** modela dealers short delta, que *tenderían* a comprar en un rally para mantenerse cubiertos (sesgo alcista); un puntaje fuertemente **negativo** los modela long delta, tendiendo a vender en los rallies (sesgo bajista). La señal pregunta "¿es probable que los dealers persigan este movimiento?".

### GEX Gradient

Gamma por encima del spot frente al gamma por debajo del spot, con una verificación de cuánto se concentra en las alas muy OTM (mucho gamma en las alas reduce la confianza). Indica en qué lado del spot hay más peso de gamma modelado, y la lectura depende del régimen:

- Cuando se modela a los dealers **short gamma**, más gamma por encima del spot puntúa **positivo** (los dealers perseguirían un rally) y más por debajo puntúa negativo (perseguirían una caída).
- Cuando se los modela **long gamma**, la lectura se invierte y se amortigua: más gamma por debajo del spot puntúa positivo (un suelo de soporte), más por encima puntúa negativo (resistencia arriba).

El sesgo supone que se mantiene el signo modelado del gamma de los dealers.

### Positioning Trap

PCR + desequilibrio con signo del smart money + momentum de 5 barras + inclinación de flip + contexto de régimen. Pregunta si la multitud está posicionada en el sentido equivocado - y desvanece a la multitud, no al precio. Un puntaje **positivo** alto señala una multitud inclinada a short (muchos puts) que puede ser exprimida **al alza** - un short-cover squeeze alcista; un puntaje **negativo** alto señala una multitud inclinada a long (muchos calls) vulnerable a un flush **a la baja**. El signo debe leerse como la dirección del squeeze/flush, no como una simple indicación de "ponerse largo/corto".

## Cómo leer el dashboard

Tres patrones:

1. **Buscar confluencia.** Si tres o cuatro de las seis señales apuntan en la misma dirección con magnitudes no triviales, eso es convicción. La pestaña **Confluence Matrix** muestra qué pares han estado coincidiendo.
2. **Buscar divergencia.** Cuando el Tape Flow Bias es fuertemente positivo pero el GEX Gradient es marcadamente negativo, el posicionamiento modelado de los dealers se inclina en contra de las compras - puede que el tape se equivoque sobre dónde está el pin estructural. Que las lecturas de flujo diverjan de las de estructura es justo la alerta temprana para la que está hecha esta página.
3. **Observar el Positioning Trap por separado.** Es la única señal Basic con sesgo de reversión a la media. Una lectura de Trap muy **negativa** (una multitud inclinada a long en riesgo de un flush a la baja) junto con un Tape fuertemente long es una advertencia, no una confirmación - la multitud a la que se suma el tape es justo la que el Trap marca como mal posicionada.

## Qué no aparece en el dashboard Basic

Las reglas de trigger. Ninguna de estas señales se dispara - la marca *Triggered* solo señala un puntaje más allá de ±25. Si busca señales impulsadas por triggers, consulte el [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard), que forma parte de Pro.

## Cada tarjeta tiene una página de profundización

Haga clic en cualquier tarjeta (o elija la señal bajo Panel de señales básico en la barra lateral) para abrir la página de la señal individual, que muestra:

- El puntaje con una lectura de una línea y un historial del puntaje desplegable
- Los valores de entrada actuales (los componentes que alimentan el puntaje)
- La explicación "How it's built"
- La Event Timeline - la trayectoria reciente del puntaje, con los cambios de dirección marcados

## Ver también

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
