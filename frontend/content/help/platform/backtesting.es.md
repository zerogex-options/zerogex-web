# Backtesting

*Reproduce una estrategia de ZeroGEX o una regla personalizada contra datos históricos de opciones, valorada como round trips reales sobre patas de opciones - netos de slippage y comisión - con un tearsheet completo ajustado por riesgo, un cono de resultados Monte Carlo y resultados desglosados por régimen de gamma.*

---

## Qué es la página de Backtesting

La página de Backtesting te permite comprobar cómo se habría comportado una regla en el histórico y verla valorada tal como se ejecutaría un trade real - cruzando el spread bid/ask, pagando comisión y aguantando el drawdown de la posición abierta. Es una **herramienta de investigación**: úsala para poner a prueba tus ideas y descartar las que no aguanten, no para fabricar una curva que luzca bien.

## Qué puedes backtestear

- **Strategy catalog** - las mismas estrategias que usan Trading con bots y Análisis de patrones (fades en el call wall, rebotes en el put wall, rupturas del gamma flip, drift de cobertura al final de la sesión, y más), agrupadas por familia, solas o como cesta. Cada una muestra su etapa de investigación y un resumen de su evidencia. Las estrategias con un patrón del Playbook se miden reproduciendo las Action Cards que ese patrón emitió en vivo; una marcada como **Replay** vuelve a ejecutar sobre el histórico la regla de entrada de su bot. Una estrategia que todavía no se puede backtestear aparece atenuada, con el motivo.
- **Estrategias personalizadas** - un constructor de condiciones sobre la estructura de mercado por minuto (net GEX / net GEX en spot, distancia al gamma flip, distancias al call/put wall, put-call ratio, MSI y régimen MSI, convexity, …) compilado en entradas.
- **Estructuras de opciones reales** - opciones ATM individuales, verticales de riesgo definido, y straddles, strangles e iron condors neutrales.

## Los parámetros ajustables

- **Símbolo** - SPY / SPX / QQQ / NDX
- **Rango de fechas** - hasta la profundidad de histórico disponible (el formulario se abre con toda la ventana disponible)
- **Entrada** - una cesta de estrategias del catálogo, o una regla condicional personalizada con AND
- **Salida** - objetivos/stops sobre el nivel del subyacente, un overlay de take-profit / stop-loss sobre la prima de la opción, y un stop por tiempo máximo de permanencia (lo que se active primero)
- **Modelo de ejecución** - % de slippage y comisión por contrato (ambos se aplican - ver abajo)
- **Dimensionamiento** - capital, riesgo por operación, número máximo de posiciones simultáneas, y topes opcionales de net-delta / net-vega
- **Barridos de parámetros** - ejecuta una malla sobre uno o dos ejes (hasta 24 simulaciones) para comparar configuraciones lado a lado

## Los resultados

### La curva de equity

El valor de tu cuenta a lo largo de la simulación, marcado **a mercado** - las posiciones abiertas se valoran en cada barra, así que una operación en pérdida no realizada se refleja en la curva y en el drawdown máximo. El drawdown se calcula de pico a valle sobre esta curva, no solo sobre las pérdidas materializadas.

### El tearsheet de rendimiento

La batería de métricas ajustadas por riesgo que un lector serio revisa primero:

- **Sharpe, Sortino, Calmar** y **CAGR**
- **Volatilidad anualizada**, **exposición**, y la **racha máxima de pérdidas**
- **Expectancy por operación**, **payoff ratio**, **ganancia media** y **pérdida media**
- Un **edge t-stat** - ¿es el resultado promedio de la operación distinguible del ruido (|t| ≥ 2)?
- Un **benchmark**: tu rendimiento frente a simplemente comprar y mantener el subyacente durante la misma ventana, y el exceso de rendimiento.

### El cono de resultados Monte Carlo

Tu secuencia de operaciones remuestreada de mil formas distintas, porque una sola curva de equity parece un destino cuando no lo es. Obtienes la **probabilidad de terminar en beneficio**, el **riesgo de ruina** (probabilidad de un drawdown ≥50%), la **mediana y el rango p5-p95** de los rendimientos, la **mediana y el p95 del drawdown máximo**, y un **cono de equity** sombreado que muestra dónde podría plausiblemente terminar la cuenta.

### Resultados por régimen de mercado

El corte característico de ZeroGEX: las mismas reglas divididas por el **contexto de dealer-gamma** (positivo/supresor frente a negativo/amplificador) y por **régimen MSI**, con win rate, P&L neto y expectancy para cada uno. Una regla que rinde en sesiones de gamma negativo y sangra en las de gamma positivo es una apuesta de régimen - aquí es donde lo ves.

### Por qué N operaciones

El panel **Why N trades?** muestra un embudo desde las cards cargadas hasta las operaciones realizadas - cargadas, dentro de tus estrategias seleccionadas, tras el cooldown, valoradas, operadas - con los motivos por los que las cards se quedaron por el camino. Si una simulación sale escasa o vacía, empieza por aquí.

### El registro de operaciones

Cada round trip con prima de entrada/salida, contratos, net Δ/vega, P&L neto, rendimiento y resultado. Exporta el registro completo a CSV - la exportación también incluye el régimen de gamma y el régimen MSI en la entrada. Una tabla **By Pattern** encima desglosa operaciones, win rate y P&L neto por estrategia.

## Guardar y compartir

- **Recent Runs** muestra tus simulaciones más recientes; haz clic en una para volver a abrir sus resultados.
- **Saved configurations** - ponle nombre a la configuración actual y guárdala. Desde la lista puedes cargarla, borrarla o copiar un enlace que abre la página de Backtesting con esa configuración ya cargada (quien lo abra necesita Pro).
- **Share result** - en una simulación completada con operaciones, crea un informe público de solo lectura: las cifras principales, la curva de equity, el rango Monte Carlo y el desglose por régimen. Cualquiera con el enlace puede abrirlo, sin necesidad de cuenta.
- **Featured strategies** cargan en el formulario, con un clic, una estrategia con evidencia medida.

## Cómo se modelan las ejecuciones

- **Consciente del slippage.** Cada pata se ejecuta cruzando el spread cotizado - compras al ask, vendes al bid - ampliado por tu configuración de slippage. Este es el coste dominante y realista en 0DTE.
- **Consciente de la comisión.** La comisión se cobra por contrato, por pata, tanto en la entrada como en la salida, y se incorpora al dimensionamiento de la posición.
- **Consciente del riesgo definido.** Las estructuras multipata están acotadas a su pérdida máxima / ganancia máxima sin arbitraje, de modo que una cotización ilíquida cerca del vencimiento no pueda registrar un resultado imposible.

Los rendimientos reportados son **netos de todo lo anterior** - las cifras que ves son después de costes, no brutas.

## Lo que el backtester **no** es

- **No es un pronosticador.** El rendimiento pasado no predice rendimientos futuros. Usa el backtester para **descartar** reglas que se ven mal, no para "encontrar" reglas que se ven bien.
- **No sustituye la disciplina fuera de muestra.** El cono Monte Carlo y el edge t-stat te dicen cuán frágil es un resultado, pero el hábito sigue importando: diseña sobre un periodo, confirma sobre otro que hayas reservado.
- **Limitado por la profundidad de datos.** Solo puedes probar la ventana que la plataforma tiene archivada. Una ventana corta es una muestra pequeña - lee el t-stat y el rango Monte Carlo en consecuencia, y apóyate en el desglose por régimen para saber de qué contexto proceden tus cifras.

## Leer los resultados con honestidad

> Juzga una regla por sus cifras **ajustadas por riesgo** y su **rango de resultados**, no por su mejor línea individual.

Un win rate alto con un payoff ratio por debajo de 1 y un cono Monte Carlo amplio no es un edge. Un win rate modesto con expectancy positiva, un t-stat superior a 2, un drawdown poco profundo y consistencia entre regímenes de gamma, sí lo es. Verifica siempre qué régimen produjo el resultado - y si sobrevive al régimen en el que estás operando hoy.

## Nota sobre el nivel

Backtesting es una función Pro y ahora mismo está en beta. Está en la barra lateral bajo **TradeWorkz™**, junto a Trading con bots y Análisis de patrones. Los enlaces de resultados compartidos son la excepción: cualquiera puede abrirlos.

## Ver también

- [Análisis de patrones](/backtesting/insights) - el rendimiento medido de cada estrategia del catálogo (Pro)
- [Composite Score](/help/platform/composite-score)
- [Cómo funcionan las señales de principio a fin](/help/platform/signals-overview)
