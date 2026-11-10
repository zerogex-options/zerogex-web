# ZeroGEX vs TradeGEX (2026): niveles gamma en futuros, precios y cobertura comparados

*Una comparación justa entre ZeroGEX y TradeGEX: para qué está pensada cada plataforma, cómo se definen sus walls y su gamma flip, de dónde salen los niveles de ES y NQ de cada una, cuánto cuesta cada una, dónde TradeGEX es la opción más sólida y dónde encaja mejor ZeroGEX. Los planes, precios y funciones de TradeGEX proceden de su propio sitio y de su academia, consultados el {{tradegex:checked}}.*

---

## En resumen

Las dos plataformas toman niveles gamma del mercado de opciones y los dibujan en gráficos de futuros. Se diferencian en lo que cubren, en cómo construyen los niveles y en lo que los acompaña.

- **TradeGEX** está pensada para traders intradía de futuros. Dibuja en tiempo real barras de exposición gamma y delta, call walls y put walls, un gamma flip y su propio indicador Hedge Flow sobre los futuros ES, NQ, YM, RTY, oro y crudo y sobre siete grandes acciones tecnológicas, con apps nativas para Mac y Windows, un simulador de operaciones integrado e indicadores para TradingView, Tradovate, ATAS y NinjaTrader.
- **ZeroGEX** cubre seis símbolos - SPX, SPY, QQQ, NDX y los futuros ES y NQ - y profundiza más en ellos: walls ponderados por gamma, un gamma flip calculado a partir de un perfil de gamma a lo largo de un rango de precios, un mapa de calor de gamma a lo largo de la sesión, flujo de cobertura y catorce señales construidas sobre los niveles, con un método publicado y un historial calificado.

Si operas el Dow, el Russell, el oro, el crudo o las grandes tecnológicas, o quieres una app de escritorio con un simulador de operaciones, TradeGEX se acerca más a lo que necesitas. Si operas intradía el complejo del S&P y el Nasdaq y quieres saber cómo se construye cada nivel y con qué frecuencia han aguantado los walls, ZeroGEX se acerca más.

## Los niveles, frente a frente

Las dos plataformas publican el mismo conjunto de niveles, en su mayoría con los mismos nombres:

| TradeGEX | ZeroGEX | Qué marca |
|---|---|---|
| Call Wall | Call Wall | El strike de calls con más peso: por open interest en TradeGEX, por open interest ponderado por gamma en ZeroGEX |
| Put Wall | Put Wall | Lo mismo en el lado de las puts |
| Gamma Flip | Gamma Flip | La línea entre la gamma modelada positiva y negativa de los dealers |
| Key Gamma Strike (KGS) | GEX King | El strike con más gamma |
| Max Pain | Max Pain | El precio al vencimiento que deja a los tenedores de opciones con el menor valor total |

Las dos te permiten elegir qué vencimientos leer. El selector de vencimientos de TradeGEX ofrece 0DTE, semanal, mensual o todos los vencimientos combinados. En ZeroGEX, el filtro de vencimientos del Gamma Chart reduce la cadena a cualquier conjunto de vencimientos, 0DTE incluido, y los walls y el flip lo siguen.

### Mismos nombres, walls distintos

Los walls comparten nombre, pero no definición. La [guía de niveles clave](https://tradegex.pro/academy/call-wall-put-wall-gamma-flip) de TradeGEX sitúa el call wall en el strike con más open interest de calls y el put wall en el strike con más open interest de puts, y sus guías sobre el gráfico y sobre el open interest dicen lo mismo. (Su guía de las griegas, en cambio, describe los walls como los strikes dominantes de gamma de calls y de puts.) ZeroGEX pondera el open interest por gamma, que es máxima en las opciones cercanas al precio actual, donde la cobertura de los dealers es más sensible a un movimiento. Los dos métodos pueden señalar strikes distintos cuando un gran bloque de open interest está lejos del precio: en un recuento bruto cuenta entero, y ponderado por gamma cuenta poco.

Las dos también describen los walls de forma distinta. Las guías de TradeGEX describen el call wall como resistencia y el put wall como soporte. ZeroGEX trata un wall como una concentración de gamma y midió con qué frecuencia aguantaron realmente los walls: en su estudio de 737 pruebas de walls, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora tras una prueba, y los del Nasdaq, aproximadamente la mitad, y ninguno de los diecinueve aspectos que midió sobre los walls individuales indicó cuáles se romperían ([el estudio](/education/how-often-do-gamma-walls-break)).

ZeroGEX modela la gamma de los dealers a partir de la cadena de opciones en lugar de observarla, calcula su flip a partir de un perfil de gamma a lo largo de un rango de precios y deja el flip en blanco cuando la cadena no respalda un cruce confiable. El método está en su página de [Metodología](/methodology). La academia de TradeGEX da su fórmula de GEX, gamma por open interest por el multiplicador del contrato por el precio spot al cuadrado, sumada strike por strike, y describe el flip como el precio en el que ese total pasa de positivo a negativo.

### Con qué frecuencia se actualizan los niveles

El open interest oficial se publica una vez al día, después del cierre. La [guía de open interest](https://tradegex.pro/academy/open-interest-analysis) de TradeGEX dice que estima el open interest durante la sesión a partir del volumen y las operaciones, y su sitio dice que sus niveles de GEX se actualizan cada pocos segundos. ZeroGEX recalcula sus niveles aproximadamente una vez por minuto durante la sesión regular, en ambos planes, a medida que el precio, el tiempo y la volatilidad implícita se mueven frente al open interest publicado. Su estimación de la cobertura implícita en las operaciones del día es una lectura aparte, en la página [Hedging Flow](/education/hedging-flow-explained). Si haces scalping a partir de los niveles, vale la pena tener en cuenta una actualización cada pocos segundos.

### De dónde salen los niveles de ES y NQ

Para ES y NQ, ninguna de las dos plataformas lee las opciones sobre los propios futuros. Ambas construyen los niveles a partir de las opciones sobre el índice o el ETF que sigue cada futuro, y los trasladan al precio del futuro. TradeGEX te permite elegir la fuente de opciones de sus barras de GEX - un ETF como SPY, QQQ o IWM, o un índice como SPX, NDX o RUT - y su [academia](https://tradegex.pro/academy/etf-options-futures-correlation) dice que el ratio de conversión varía con los dividendos y el coste de acarreo. ZeroGEX construye los niveles de ES a partir de la cadena del SPX y los de NQ a partir de la cadena del NDX, y los proyecta sobre el contrato de futuros cuya cotización muestra usando el coste de acarreo de ese contrato ([cómo funciona](/help/platform/futures-contract-months)).

## Precios

Precios de lista antes de promociones e impuestos, consultados el {{tradegex:checked}}. TradeGEX vende un solo plan con acceso completo a la plataforma, facturado mensualmente, cada seis meses ({{tradegex:platform:sixMonths}}) o anualmente. Los precios de ZeroGEX son los que figuran hoy en su página de [Precios](/pricing).

| Plan | Facturación mensual | Facturación anual |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mes | {{zgx:basic:annual}}/año (unos {{zgx:basic:annual:mo}}/mes) |
| ZeroGEX Pro, con acceso a la API | {{zgx:pro:monthly}}/mes | {{zgx:pro:annual}}/año (unos {{zgx:pro:annual:mo}}/mes) |
| TradeGEX | {{tradegex:platform:monthly}}/mes | {{tradegex:platform:annual}}/año (unos {{tradegex:platform:annual:mo}}/mes) |

Con facturación mensual, ZeroGEX Basic cuesta menos que TradeGEX, y ZeroGEX Pro cuesta aproximadamente lo mismo. Con facturación anual, ZeroGEX Pro cuesta aproximadamente la mitad que TradeGEX - lo mismo que el plan de seis meses de TradeGEX - e incluye acceso a la API. Aun así, con esos precios se compran cosas distintas: el de TradeGEX cubre más mercados, apps de escritorio y un simulador de operaciones, y el de ZeroGEX cubre seis símbolos en profundidad.

Las pruebas y los reembolsos también difieren. ZeroGEX Basic mensual empieza con una prueba gratuita de 7 días sin ningún cargo hasta que termina, y todos los demás planes de ZeroGEX están cubiertos por una garantía de devolución de 7 días. TradeGEX ofrece una prueba gratuita de 3 días que requiere un número de móvil pero no una tarjeta y que no se convierte en un plan de pago por sí sola, y sus condiciones dicen que los reembolsos solo se conceden en circunstancias excepcionales.

## Dónde TradeGEX es la opción más sólida

- **Más mercados.** Futuros de ES, NQ, YM (Dow), RTY (Russell 2000), oro y crudo, además de NVDA, TSLA, AAPL, MSFT, AMZN, META y GOOGL. ZeroGEX cubre seis símbolos.
- **Actualización más rápida.** TradeGEX dice que sus niveles de GEX se actualizan cada pocos segundos. ZeroGEX recalcula sus niveles aproximadamente una vez por minuto.
- **Apps de escritorio y un simulador de operaciones.** Apps nativas para Mac y Windows (Windows en beta) y un simulador integrado para practicar operaciones con futuros sobre precios en vivo, con órdenes bracket y estadísticas de rendimiento. ZeroGEX funciona en el navegador y no tiene un simulador para practicar tus propias operaciones.
- **Tradovate y ATAS.** TradeGEX dibuja sus niveles en el gráfico web de Tradovate y en ATAS, además de en TradingView y NinjaTrader. ZeroGEX funciona con TradingView, thinkorswim, NinjaTrader, Sierra Chart y Bookmap.
- **Exposición delta y un oscilador multimercado.** Barras de exposición delta, el indicador Hedge Flow, un oscilador que combina ES, NQ, el VIX y el flujo de opciones, una línea del VIX en el gráfico de precio, una vista de doble gráfico y un informe semanal Commitments of Traders para ES y NQ. ZeroGEX deja fuera a propósito la exposición delta bruta: [por qué ZeroGEX no publica el DEX](/education/why-we-dont-publish-dex).

## Dónde ZeroGEX es la opción más sólida

- **Walls ponderados por gamma.** El open interest se cuenta según cuánta cobertura conlleva cerca del precio, no solo por el número de contratos, que es como describe sus walls la guía de niveles clave de TradeGEX.
- **Un método publicado y un historial calificado.** La página de [Metodología](/methodology) expone cómo se calculan los niveles, el [Track Record](/track-record) califica cada previsión que publica ZeroGEX, fallos incluidos, y el [estudio de los walls](/education/how-often-do-gamma-walls-break) publica con qué frecuencia se rompieron realmente los walls.
- **Profundidad en el complejo del S&P y el Nasdaq.** Un mapa de calor de gamma a lo largo de la sesión, gamma por vencimiento, flujo de vanna y charm, flujo de cobertura, flujo forzado y catorce señales construidas sobre los niveles, con sus métodos expuestos en la [guía de señales](/guides/signals-explained). La academia de TradeGEX dice que no tiene una línea dedicada a vanna ni a charm; esos efectos los lees en su línea del VIX, en su selector de vencimientos y en los niveles.
- **Acceso a la API y un servidor MCP.** ZeroGEX Pro incluye claves de API para los mismos datos, y el [servidor MCP](/education/gamma-levels-in-claude) gratuito lleva los niveles con retraso a asistentes de IA como Claude y ChatGPT. El plan de TradeGEX no indica ninguna API.
- **Precio con facturación anual.** ZeroGEX Pro cuesta aproximadamente la mitad del precio anual de TradeGEX, con la API incluida.
- **Una forma gratuita de comprobarlo primero.** Las páginas de [niveles gamma de ES](/es-gamma-levels) y [niveles gamma de NQ](/nq-gamma-levels), con unos 15 minutos de retraso, no requieren registro.

## Cómo decidir

- **Operas YM, RTY, oro, crudo o acciones tecnológicas individuales:** TradeGEX.
- **Quieres una app de escritorio, un simulador de operaciones integrado o tus niveles en Tradovate o ATAS:** TradeGEX.
- **Operas intradía ES, NQ, SPX, SPY, QQQ o NDX y quieres saber cómo se construye cada nivel y con qué frecuencia han aguantado los walls:** ZeroGEX.
- **Aún no lo tienes claro:** abre la página gratuita de [niveles gamma de ES](/es-gamma-levels), sin necesidad de registro, y compárala con los niveles que usas hoy.

---

Los planes, precios y funciones de TradeGEX proceden de [tradegex.pro](https://tradegex.pro) y de su academia, consultados el {{tradegex:checked}}, y pueden cambiar en cualquier momento, así que confírmalos allí. Los precios de ZeroGEX de esta página se toman de su lista de precios en vigor. ZeroGEX no tiene afiliación con TradeGEX. Solo contenido educativo, no es una recomendación de trading.
