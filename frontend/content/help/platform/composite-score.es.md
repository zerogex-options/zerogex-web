# Composite Score

*La lectura combinada del **régimen** de mercado actual — cómo se construye, por qué no es una llamada de dirección y cómo usarlo como filtro en lugar de como pronóstico.*

---

## Qué es el Composite Score

El Composite Score — internamente **MSI**, el Market State Index — es el **resumen en un único número del régimen actual de la estructura de opciones** en el símbolo activo. Responde a una sola pregunta: *¿es probable que el tape tienda (trend) o que lateralice (chop)?*

Se ubica en una **escala de 0 a 100, donde 50 es neutral.** **No** es un puntaje direccional — no te dice alcista vs. bajista. Un MSI alto significa que es probable que las tendencias *corran*; un MSI bajo significa que el tape está *fijado, lateral o frágil*. Para la dirección, consulta [Trade Bias](/help/platform/trade-bias) — esa es la lectura con signo, alcista vs. bajista.

> **Un MSI alto no significa "alcista". Significa que las tendencias pueden correr.**
> **Un MSI bajo no significa "bajista". Significa que es improbable que las tendencias funcionen.**

## Las bandas de régimen

| Puntaje | Régimen | Qué significa |
| --- | --- | --- |
| ≥ 70 | **Trend / Expansion** | Régimen direccional fuerte — favorece trades en el sesgo predominante |
| 40 – 70 | **Controlled Trend** | Ventaja direccional moderada — opera con tamaño reducido |
| 20 – 40 | **Chop / Range** | Mercado en rango — haz fade de los extremos, evita trades de tendencia |
| < 20 | **High-Risk Reversal** | Solo reversión a la media — riesgo elevado de movimientos extremos, tape frágil |

Fíjate en que las bandas son sobre el *régimen*, no sobre la *dirección*. Un tape lateral marca **20–40 tanto si el mercado deriva al alza como a la baja.** Es intencional — un puntaje bajo en un mercado que sube no es una contradicción, es el indicador diciéndote que es improbable que el movimiento tienda de forma limpia.

## Cómo se construye

El MSI combina **seis componentes independientes**, cada uno puntuado en una línea de −1…+1 y ponderado dentro de un presupuesto de puntos que suma 100:

| Componente | Puntos | Qué lee |
| --- | --- | --- |
| Gamma Anchor | 30 | Proximidad al gamma flip, densidad de gamma local, strike de max-gamma — fijado vs. libre |
| Order Flow Imbalance | 19 | Prima call vs. put de smart-money — *el único input direccional* |
| Dealer Delta Pressure | 17 | Dirección del hedge forzado del dealer |
| Net GEX Sign | 16 | Dealers long gamma (amortiguan los movimientos) vs. short gamma (los amplifican) |
| Put/Call Ratio | 12 | Proxy de fragilidad estructural |
| Volatility Regime | 6 | Vol en vivo vs. el pivote de vol en 20 |

Los componentes se suman sobre la línea base neutral de 50 mediante una combinación de saturación suave (tanh), de modo que ningún input por sí solo puede fijar el indicador. **Aproximadamente dos tercios del peso son estructura sin dirección** (Gamma Anchor, Net GEX Sign, Put/Call, Vol) — estos empujan hacia *tendencia* o *lateralización*, no hacia arriba o abajo. Solo Order Flow Imbalance y Dealer Delta son genuinamente direccionales, razón por la cual un tape fuertemente cargado hacia un lado puede mover ligeramente el puntaje aunque el indicador sea una lectura de régimen.

Para cada componente, **+1 argumenta a favor de un régimen operable / con tendencia; −1 argumenta a favor de lateralización / fijación / reversión.**

## El gauge de MSI

La página del Composite Score muestra:

- El **gauge de MSI** — el puntaje en el arco de 0 a 100, coloreado por *banda de régimen* (no por alcista/bajista).
- La **etiqueta de régimen** — Trend / Expansion, Controlled Trend, Chop / Range o High-Risk Reversal.
- El panel de **componentes contribuyentes** — el empuje actual de cada input, a la derecha para "tendencia", a la izquierda para "lateralización / reversión", ordenados por magnitud.
- El **Δ desde la apertura** y el **Δ últimos 5 min** — cuánto se ha movido el puntaje de régimen (hacia tendencia si es positivo, hacia lateralización si es negativo). Son momentum de régimen, no dirección.
- Un **sparkline** del puntaje durante la sesión.

## Interpretar el composite

Una regla simple — léela como *cuánto confiar en una tendencia*, y toma la dirección del Trade Bias:

| Composite | Lectura |
| --- | --- |
| ≥ 70 | Régimen con tendencia — las tendencias en el sesgo predominante pueden correr; presiona con la tendencia |
| 40 – 70 | Tendencia controlada — una ventaja real pero moderada; reduce el tamaño |
| 20 – 40 | Lateral / rango — haz fade de los extremos, no persigas rupturas, favorece el riesgo definido |
| < 20 | Frágil / alto riesgo de reversión — solo reversión a la media, espera rupturas fallidas |

Los extremos más útiles son la parte superior y la inferior. La zona media (~40–60) es una zona de "sin régimen definido" — no fuerces un trade de tendencia a partir de ella.

## Cómo usarlo

Tres patrones:

1. **Como dial de convicción sobre la dirección.** El Trade Bias te da el lado; el MSI te dice con cuánta fuerza presionarlo. Sesgo largo + MSI 75 → presiónalo. Sesgo largo + MSI 25 → compra el dip en pequeño, haz fade de los extremos, no persigas.
2. **Como filtro de chop.** No abras trades de tendencia/ruptura cuando el MSI está bajo (< 40) — el tape está lateral o revierte a la media *independientemente de la dirección*. Un puntaje bajo no es una señal para ponerte corto.
3. **Como confirmador de régimen.** Las lecturas del MSI *tienden a* ser más fuertes y persistentes en sesiones de negative gamma, en línea con el comportamiento más direccional que esos regímenes suelen mostrar.

## Qué no es

El composite **no es una señal de trading** y **no es una llamada de dirección.** Te dice en qué *tipo* de tape estás — tendencia vs. lateralización; no te dice hacia qué lado, qué timeframe usar ni dónde colocar tu stop. Combínalo con el Trade Bias (dirección) y las señales individuales (disparadores).

## Por qué el composite puede revertirse rápido

Dos razones:

- Un cruce del gamma flip puede mover con fuerza los componentes estructurales (Gamma Anchor, Net GEX Sign), desplazando rápidamente la lectura de régimen.
- Un cambio brusco en el flujo de smart-money mueve el único componente direccional lo suficiente como para inclinar la combinación.

El sparkline hace visibles estos cambios abruptos — busca las discontinuidades.

## Hábitos de traders que han demostrado funcionar

- Lee el MSI en la apertura y a las 11:00 / 12:30 / 14:30 ET como puntos de control.
- Trata el MSI como el **dimensionamiento** de la posición, y el Trade Bias como la **dirección** de la posición.
- Trata los puntajes entre ~40 y ~60 como "sin régimen definido — espera" en lugar de como una dirección.

## Nota sobre niveles

La página del Composite Score es exclusiva del nivel Pro. El gauge del MSI también aparece en el Dashboard para todos los niveles de pago.

## Ver también

- [Trade Bias](/help/platform/trade-bias) — la lectura con signo, direccional
- [Cómo funcionan las señales de extremo a extremo](/help/platform/signals-overview)
- [Señales: explicadas](/guides/signals-explained)
