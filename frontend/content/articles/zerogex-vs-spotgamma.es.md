# ZeroGEX vs SpotGamma (2026): niveles gamma, precios y herramientas gratuitas comparados

*Una comparación justa entre ZeroGEX y SpotGamma: para qué está pensado cada servicio, cómo se corresponden sus niveles clave, con qué frecuencia se actualiza cada uno, cuánto cuesta cada plan, qué puedes ver gratis, dónde SpotGamma es la opción más sólida y dónde encaja mejor ZeroGEX. Los planes, precios y funciones de SpotGamma proceden de su propio sitio y de sus páginas de pago, consultados el {{spotgamma:checked}}.*

---

## En resumen

Tanto SpotGamma como ZeroGEX publican niveles clave derivados de las opciones: el call wall y el put wall, donde se concentra la gamma, y el precio en el que la gamma modelada de los dealers cruza cero. Se diferencian en lo que acompaña a esos niveles y en la frecuencia con la que se mueven.

- **SpotGamma** es tanto un servicio de análisis como una herramienta de datos. Todos los planes reciben su Founder's Note antes de la apertura y después del cierre de cada sesión bursátil, niveles clave para los principales índices de EE. UU. y niveles GEX diarios para más de 3.500 acciones, índices y ETF. Su página de inicio sitúa sus herramientas en tiempo real, como TRACE (un mapa de calor del S&P 500) y HIRO (su indicador de cobertura en tiempo real), en su plan superior.
- **ZeroGEX** cubre seis símbolos - SPX, SPY, QQQ, NDX y los futuros ES y NQ - y profundiza más en ellos: niveles recalculados aproximadamente una vez por minuto durante la sesión en ambos planes, un mapa de calor de gamma, flujo de cobertura y catorce señales construidas sobre los niveles, con un método publicado y un historial calificado.

Si quieres una nota de análisis diaria, GEX de acciones individuales para miles de valores o los niveles propietarios de SpotGamma, SpotGamma se acerca más a lo que necesitas. Si operas intradía el complejo de índices y quieres que sus niveles se muevan durante la sesión, por menos dinero, ZeroGEX se acerca más.

## Los niveles, frente a frente

| SpotGamma | ZeroGEX | Qué marca |
|---|---|---|
| Call Wall | Call Wall | El strike con la mayor concentración de gamma de calls |
| Put Wall | Put Wall | Lo mismo en el lado de las puts |
| Zero Gamma | Gamma Flip | El precio en el que la gamma modelada de los dealers cruza cero |
| Volatility Trigger | Sin equivalente | Un nivel propietario de SpotGamma |
| Risk Pivot | Sin equivalente | Un nivel propietario de SpotGamma |

Los walls comparten definición. La [explicación del call wall](https://spotgamma.com/call-wall-put-wall-explained/) de SpotGamma describe el call wall como el strike con la mayor concentración de gamma de calls, y el put wall como su equivalente en el lado de las puts. ZeroGEX los define casi de la misma manera: el strike por encima del spot con la mayor exposición gamma en calls, y el strike por debajo del spot con la mayor exposición gamma en puts. Ambos tratan un wall como una referencia y no como un techo o un suelo rígido. ZeroGEX midió con qué frecuencia aguantaron realmente los walls: en su estudio de 737 pruebas de walls, los walls del S&P aguantaron aproximadamente dos de cada tres veces en el plazo de una hora tras una prueba, y los del Nasdaq, aproximadamente la mitad ([el estudio](/education/how-often-do-gamma-walls-break)).

El zero gamma y el gamma flip se construyen, en principio, de la misma manera. La [guía de GEX](https://spotgamma.com/gamma-exposure-gex/) de SpotGamma describe cómo recalcular la gamma de las opciones sobre un rango de precios spot hipotéticos y localizar el cruce por cero. ZeroGEX también calcula su flip a partir de un perfil de gamma a lo largo de un rango de precios, y deja el flip en blanco cuando la cadena no respalda un cruce confiable. El método está en su página de [Metodología](/methodology).

SpotGamma también publica dos niveles propios. Describe el Volatility Trigger como un nivel propietario derivado de su distribución estimada de la gamma y no de un cruce por cero, y una publicación anterior de la propia SpotGamma lo llama el último nivel importante de soporte de gamma positiva, que puede situarse varios puntos por encima del zero gamma. Describe el Risk Pivot como un nivel de escenario que enmarca dónde la estructura del mercado puede volverse más o menos favorable; las páginas consultadas no dicen cómo se calcula. El nivel de ZeroGEX más cercano a cualquiera de los dos es el gamma flip. ZeroGEX añade niveles propios: GEX King, el strike con más gamma, y el Pin Strike, el strike 0DTE cercano en el que la gamma positiva de los dealers y la probabilidad de que el precio lo alcance se combinan con más fuerza.

### Cómo se modelan las posiciones de los dealers

Ninguno de los dos servicios ve directamente el inventario de los dealers. ZeroGEX lo modela a partir del open interest según la convención estándar de que los dealers están largos en calls y cortos en puts. El gráfico gratuito de gamma de SpotGamma usa esa misma convención estándar, y SpotGamma afirma que su modelo de pago, SGOI, estima el posicionamiento de los creadores de mercado y del lado comprador strike por strike. Modelos distintos pueden situar los walls en strikes distintos el mismo día, así que cabe esperar que los niveles de los dos servicios difieran a veces.

### Con qué frecuencia se actualizan los niveles

La Founder's Note de SpotGamma, con sus niveles para los principales índices de EE. UU., se entrega antes de la apertura y después del cierre de cada sesión bursátil en todos los planes, y los niveles de su Equity Hub para acciones individuales se actualizan cada día antes de la apertura. Las preguntas frecuentes de su página de inicio sitúan HIRO, TRACE y su Volatility Dashboard en el plan Alpha, aunque algunas de sus otras páginas los indican en todos los planes, así que confirma con SpotGamma qué plan incluye lo que necesitas.

ZeroGEX recalcula sus niveles aproximadamente una vez por minuto durante la sesión regular, en ambos planes, y sus páginas gratuitas muestran esos mismos niveles con unos 15 minutos de retraso.

## Precios

Precios de lista antes de promociones e impuestos, tal como los cobraban los formularios de pago de SpotGamma el {{spotgamma:checked}}. La página de precios de SpotGamma también mostraba ofertas para el primer mes que sus formularios de pago no aplicaban ese día, así que consulta en su sitio la oferta vigente. SpotGamma también vende un plan Institutional, que no se compara aquí. Los precios de ZeroGEX son los que figuran hoy en su página de [Precios](/pricing).

| Plan | Facturación mensual | Facturación anual |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mes | {{zgx:basic:annual}}/año (unos {{zgx:basic:annual:mo}}/mes) |
| ZeroGEX Pro, con acceso a la API | {{zgx:pro:monthly}}/mes | {{zgx:pro:annual}}/año (unos {{zgx:pro:annual:mo}}/mes) |
| SpotGamma Essential | {{spotgamma:essential:monthly}}/mes | {{spotgamma:essential:annual}}/año (unos {{spotgamma:essential:annual:mo}}/mes) |
| SpotGamma Alpha | {{spotgamma:alpha:monthly}}/mes | {{spotgamma:alpha:annual}}/año (unos {{spotgamma:alpha:annual:mo}}/mes) |

Los dos planes de ZeroGEX cuestan menos que cualquiera de los planes de SpotGamma, con facturación mensual o anual, y un año de ZeroGEX Pro cuesta lo mismo que un mes de SpotGamma Alpha. Aun así, con esos precios se compran cosas distintas: el de SpotGamma cubre miles de acciones, una nota de análisis dos veces al día, webinars y, en Alpha, sus herramientas en tiempo real; el de ZeroGEX cubre seis símbolos en profundidad, con niveles que se mueven durante la sesión en ambos planes.

Las pruebas y los reembolsos también difieren. ZeroGEX Basic mensual empieza con una prueba gratuita de 7 días sin ningún cargo hasta que termina, y todos los demás planes de ZeroGEX están cubiertos por una garantía de devolución de 7 días. La página de precios de SpotGamma no indica ninguna prueba gratuita en sus planes de pago; por separado, ofrece una semana gratis de su informe diario Opening Setup, sin necesidad de tarjeta. Sus condiciones dicen que los pagos de suscripción no son reembolsables salvo que se indique lo contrario.

## Qué puedes ver gratis

- **SpotGamma** publica un [gráfico gratuito de exposición gamma del SPX](https://spotgamma.com/free-tools/spx-gamma-exposure/), que según indica se actualiza a diario, junto con una calculadora de beneficios de opciones y un gráfico de movimientos implícitos por resultados.
- **ZeroGEX** publica el gamma flip, el call wall, el put wall y el net GEX de sus seis símbolos, con unos 15 minutos de retraso y actualizados durante la sesión, sin registro: todos los símbolos en una sola página en [niveles GEX de hoy](/gex-levels), y una página por símbolo, como [niveles gamma de SPX](/spx-gamma-levels). El [Gamma Terminal](/chart) muestra gratis un gráfico de gamma de SPY con retraso, y el [servidor MCP](/education/gamma-levels-in-claude) lleva los niveles con retraso a asistentes de IA como Claude y ChatGPT.

## Dónde SpotGamma es la opción más sólida

- **Análisis y comentarios.** La Founder's Note antes de la apertura y después del cierre de cada sesión bursátil, en todos los planes, además de webinars semanales en directo, una comunidad en Discord y, en Alpha, sesiones diarias de formación en directo. ZeroGEX tiene artículos educativos y un centro de ayuda, y no tiene nota diaria.
- **Amplitud.** Niveles GEX diarios para más de 3.500 acciones, índices y ETF de EE. UU. en su Equity Hub y, en Alpha, HIRO para más de 3.000 acciones. ZeroGEX cubre seis símbolos.
- **Su propio modelo de posicionamiento y sus propios niveles.** SGOI, su estimación del posicionamiento de los creadores de mercado y del lado comprador, y el Volatility Trigger y el Risk Pivot. ZeroGEX usa la convención estándar y no publica ningún equivalente de esos dos niveles.
- **Más plataformas.** SpotGamma indica integraciones con TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap, TrendSpider, Jigsaw, eSignal y EdgePro. ZeroGEX funciona con seis: TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap y SabrTrader.

## Dónde ZeroGEX es la opción más sólida

- **Precio.** Los dos planes de ZeroGEX cuestan menos que cualquiera de los planes de SpotGamma, y ZeroGEX Pro incluye acceso a la API. Las listas de los planes Essential y Alpha de SpotGamma no incluyen una API.
- **Niveles que se mueven durante la sesión en ambos planes.** Aproximadamente una vez por minuto, tanto en Basic como en Pro. Las páginas de SpotGamma describen niveles actualizados cada día antes de la apertura, y su página de inicio sitúa sus herramientas en tiempo real en Alpha.
- **ES y NQ sobre el precio del futuro.** ZeroGEX construye los niveles de ES a partir de la cadena del SPX y los de NQ a partir de la cadena del NDX, y los proyecta sobre el contrato de futuros cuya cotización muestra ([cómo funciona](/help/platform/futures-contract-months)), gratis y con retraso en [niveles gamma de ES](/es-gamma-levels) y [niveles gamma de NQ](/nq-gamma-levels). El sitio de SpotGamma dice que sus niveles se integran con plataformas de futuros, pero las páginas consultadas no dicen que publique niveles sobre el precio del futuro.
- **Más contenido gratis.** Los niveles de los seis símbolos, actualizados durante la sesión con retraso, frente al gráfico diario del SPX de SpotGamma.
- **Un método publicado y un historial calificado.** La página de [Metodología](/methodology) expone cómo se calculan los niveles, el [Track Record](/track-record) califica cada previsión que publica ZeroGEX, fallos incluidos, y el [estudio de los walls](/education/how-often-do-gamma-walls-break) publica con qué frecuencia se rompieron realmente los walls.
- **Profundidad en el complejo de índices.** Un mapa de calor de gamma a lo largo de la sesión, gamma por vencimiento, flujo de vanna y charm, flujo de cobertura y catorce señales construidas sobre los niveles, con sus métodos expuestos en la [guía de señales](/guides/signals-explained).

## Cómo decidir

- **Quieres una nota de análisis diaria junto con tus niveles, o webinars y formación:** SpotGamma.
- **Operas acciones individuales y quieres niveles GEX para miles de valores:** SpotGamma.
- **Operas intradía SPX, SPY, QQQ, NDX, ES o NQ y quieres que el flip y los walls se muevan durante la sesión, por menos dinero:** ZeroGEX.
- **Buscas una alternativa gratuita a SpotGamma:** abre la página [niveles GEX de hoy](/gex-levels), sin necesidad de registro, y compárala con los niveles que usas ahora.

---

Los planes, precios y funciones de SpotGamma proceden de [spotgamma.com](https://spotgamma.com) y de sus páginas de pago, consultados el {{spotgamma:checked}}, y pueden cambiar en cualquier momento, así que confírmalos allí. Los precios de ZeroGEX de esta página se toman de su lista de precios en vigor. ZeroGEX no tiene afiliación con SpotGamma. Solo contenido educativo, no es una recomendación de trading.
