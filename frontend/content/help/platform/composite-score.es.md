# Composite Score

*La lectura combinada del **régimen** de mercado actual - cómo se construye, por qué no es una llamada de dirección y cómo usarlo como filtro en lugar de como pronóstico.*

---

## Qué es el Composite Score

El Composite Score - internamente **MSI**, el Market State Index - es el **resumen en un único número del régimen actual de la estructura de opciones** en el símbolo activo. Responde a una sola pregunta: *¿es probable que el tape tienda (trend) o que lateralice (chop)?*

Se ubica en una **escala de 0 a 100, donde 50 es neutral.** **No** es un puntaje direccional - no te dice alcista vs. bajista. Un MSI alto significa que es probable que las tendencias *corran*; un MSI bajo significa que el tape está *fijado o lateral*. Para la dirección, consulta [Trade Bias](/trade-bias) - esa es la lectura con signo, alcista vs. bajista.

> **Un MSI alto no significa "alcista". Significa que las tendencias pueden correr.**
> **Un MSI bajo no significa "bajista". Significa que es improbable que las tendencias funcionen.**

## Las bandas de régimen

| Puntaje | Régimen | Qué significa |
| --- | --- | --- |
| ≥ 70 | **Trend / Expansion** | El mayor recorrido posterior de las cuatro bandas, históricamente |
| 40 - 70 | **Controlled Trend** | Recorrido posterior por encima de la media |
| 20 - 40 | **Chop / Range** | Recorrido posterior por debajo de la media |
| < 20 | **Compression** | El menor recorrido posterior de las cuatro bandas, históricamente |

Las bandas están ordenadas por recorrido posterior medido: a las lecturas de la banda superior les siguió históricamente el mayor rango, y a la inferior el menor. Ese orden se mantiene en todos los horizontes que probamos, pero el efecto es moderado - desplaza las probabilidades, no las determina.

Una salvedad que preferimos declarar antes que ocultar: el puntaje no es una lectura de régimen pura. Dos de sus seis componentes miden la *dirección* del flujo de opciones en lugar de cuánto recorre el precio, y entran en el puntaje con signo. En la práctica, un tape marcadamente bajista puede arrastrar el puntaje a las bandas inferiores aunque la estructura de opciones no haya cambiado. Estamos separando ambas lecturas; hasta entonces, trata un puntaje bajo durante una caída fuerte como una señal en parte direccional, no como un pronóstico puro de rango.

## Cómo se construye

El MSI combina **seis componentes independientes**, cada uno puntuado en una línea de −1…+1 y ponderado dentro de un presupuesto de puntos que suma 100:

| Componente | Puntos | Qué lee |
| --- | --- | --- |
| Gamma Anchor | 30 | Proximidad al gamma flip, densidad de gamma local, strike de max-gamma - fijado vs. libre |
| Order Flow Imbalance | 19 | Prima call vs. put de smart-money - *direccional* |
| Dealer Delta Pressure | 17 | Dirección del hedge forzado del dealer - *direccional* |
| Net GEX Sign | 16 | Dealers long gamma (amortiguan los movimientos) vs. short gamma (los amplifican) |
| Put/Call Ratio | 12 | Proxy de fragilidad estructural |
| Volatility Regime | 6 | Vol en vivo vs. el pivote de vol en 20 |

Los componentes se suman sobre la línea base neutral de 50 mediante una combinación de saturación suave (tanh), de modo que ningún input por sí solo puede fijar el indicador. **Aproximadamente dos tercios del peso son estructura sin dirección** (Gamma Anchor, Net GEX Sign, Put/Call, Vol) - estos empujan hacia *tendencia* o *lateralización*, no hacia arriba o abajo. Solo Order Flow Imbalance y Dealer Delta son genuinamente direccionales, razón por la cual un tape fuertemente cargado hacia un lado puede mover ligeramente el puntaje aunque el indicador sea una lectura de régimen.

Para cada componente, **+1 argumenta a favor de un régimen operable / con tendencia; −1 argumenta a favor de lateralización / fijación / reversión.**

Estos seis son la receta completa: las señales Basic y Advanced no son inputs del MSI. (El componente Dealer Delta Pressure usa la misma lectura del delta neto de los dealers que la señal Basic del mismo nombre.)

## El gauge de MSI

La página del Composite Score muestra:

- El **gauge de MSI** - el puntaje en un arco de 0 a 100. Los segmentos del arco se colorean por *banda de régimen*; la aguja, el número y la etiqueta de régimen toman el color del Implied bias (más abajo).
- La **etiqueta de régimen** - Trend / Expansion, Controlled Trend, Chop / Range o Compression.
- El **Implied bias** - una dirección superpuesta, solo para el color. Combina el movimiento del subyacente en aproximadamente los últimos 30 minutos con el puntaje: por encima de 50 sugiere que el movimiento actual continúa, por debajo de 50, una reversión. Verde es alcista implícito, rojo bajista implícito, y neutral cuando el precio está plano o el puntaje ronda 50. El número en sí sigue siendo un gauge de régimen.
- El **Δ desde la apertura** y el **Δ últimos 5 min** - cuánto se ha movido el puntaje de régimen (hacia tendencia si es positivo, hacia lateralización si es negativo). Son momentum de régimen, no dirección.
- La barra **Component Contributions** - el empuje con signo de cada componente alrededor de la línea base de 50: a la derecha (verde) hacia "tendencia", a la izquierda (rojo) hacia "lateralización / reversión". Debajo, una tarjeta por componente muestra su puntaje de −1…+1, su aporte en puntos y sus puntos máximos.
- Un gráfico **Intraday Trend** del puntaje a lo largo de la sesión, con las bandas de régimen sombreadas. Pasa el cursor sobre cualquier punto para ver la hora, el puntaje, el régimen y los tres componentes principales detrás.

En ES y NQ, la página indica que el puntaje se deriva de las opciones de SPX o NDX - los futuros no tienen una cadena de opciones propia.

## Interpretar el composite

Una regla simple - léela como *cuánto confiar en una tendencia*, y toma la dirección del Trade Bias:

| Composite | Lectura |
| --- | --- |
| ≥ 70 | Régimen con tendencia - las tendencias en el sesgo predominante pueden correr; presiona con la tendencia |
| 40 - 70 | Tendencia controlada - una ventaja real pero moderada; reduce el tamaño |
| 20 - 40 | Lateral / rango - haz fade de los extremos, no persigas rupturas, favorece el riesgo definido |
| < 20 | Compression - históricamente el menor recorrido posterior de todas las bandas; no cuentes con que las rupturas avancen |

Los extremos más útiles son la parte superior y la inferior. La zona media (~40-60) es una zona de "sin régimen definido" - no fuerces un trade de tendencia a partir de ella.

## Cómo usarlo

Tres patrones:

1. **Como dial de convicción sobre la dirección.** El Trade Bias te da el lado; el MSI te dice con cuánta fuerza presionarlo. Sesgo largo + MSI 75 → presiónalo. Sesgo largo + MSI 25 → compra el dip en pequeño, haz fade de los extremos, no persigas.
2. **Como filtro de chop.** No abras trades de tendencia/ruptura cuando el MSI está bajo (< 40) - el tape está lateral o revierte a la media *independientemente de la dirección*. Un puntaje bajo no es una señal para ponerte corto.
3. **Como confirmador de régimen.** Las lecturas del MSI *tienden a* ser más fuertes y persistentes en sesiones de negative gamma, en línea con el comportamiento más direccional que esos regímenes suelen mostrar.

## Qué no es

El composite **no es una señal de trading** y **no es una llamada de dirección.** Te dice en qué *tipo* de tape estás - tendencia vs. lateralización; no te dice hacia qué lado, qué timeframe usar ni dónde colocar tu stop. Combínalo con el Trade Bias (dirección) y las señales individuales (disparadores).

## Por qué el composite puede revertirse rápido

Dos razones:

- Un cruce del gamma flip puede mover con fuerza los componentes estructurales (Gamma Anchor, Net GEX Sign), desplazando rápidamente la lectura de régimen.
- Un cambio brusco en el flujo de smart-money o en el delta de los dealers mueve los dos componentes direccionales lo suficiente como para inclinar la combinación.

El gráfico Intraday Trend hace visibles estos cambios abruptos - busca las discontinuidades.

## Hábitos de traders que han demostrado funcionar

- Lee el MSI en la apertura y a las 11:00 / 12:30 / 14:30 ET como puntos de control.
- Trata el MSI como el **dimensionamiento** de la posición, y el Trade Bias como la **dirección** de la posición.
- Trata los puntajes entre ~40 y ~60 como "sin régimen definido - espera" en lugar de como una dirección.

## Nota sobre niveles

La página del Composite Score es exclusiva del nivel Pro. Con Basic sigues viendo el MSI: la sección Señales Propietarias del Panel principal muestra el puntaje y su banda de régimen, y Mi panel tiene un widget Composite Score.

## Ver también

- [Trade Bias](/trade-bias) - la lectura con signo, direccional (Pro)
- [Cómo funcionan las señales de extremo a extremo](/help/platform/signals-overview)
- [Señales: explicadas](/guides/signals-explained)
