# Las mejores herramientas GEX en 2026: plataformas de gamma exposure, comparadas con justicia
> **Nota metodológica.** ZeroGEX estima, pero no observa, el inventario de los dealers a partir de datos públicos. El modelo conserva la convención calls positivos/puts negativos (`Net GEX = Call GEX − Put GEX`) y supone dealers netos largos de calls y cortos de puts. Las calls y puts largas tienen gamma positiva; las calls y puts cortas tienen gamma negativa. El Put Wall es la mayor concentración de gamma de puts por debajo del spot y representa localmente gamma negativa modelada del dealer: puede coincidir con soporte, pero la cobertura de una put corta no crea mecánicamente un suelo. Los walls pueden migrar por spot, tiempo y volatilidad implícita aunque el open interest oficial no cambie intradía. Al acercarse el vencimiento, la gamma se concentra cerca del ATM: la gamma ATM puede aumentar, mientras la gamma claramente ITM u OTM tiende a cero. El Gamma Flip seleccionado es una transición local; el perfil puede tener varios cruces o ninguno significativo. Charm y vanna son cambios condicionales de delta, no órdenes programadas. Las puntuaciones son resultados heurísticos, no probabilidades calibradas. La gamma negativa amplifica la dirección ya iniciada; la distancia a un objetivo no implica repulsión. Por ello, la inversión del término pin de EOD Pressure sigue siendo una heurística de ZeroGEX. Max Pain minimiza el pago intrínseco agregado y no maximiza exactamente el nocional que vence sin valor. El DEX bruto mide delta solo de opciones, no flujo futuro de cobertura; la prima y el lado agresor no prueban información, apertura ni convicción.


*Una comparación equilibrada de las mejores herramientas de GEX y rastreadores de gamma exposure en 2026 — qué es lo que realmente importa en una herramienta de GEX, qué buscar entre feeds en tiempo real y retrasados, cobertura de 0DTE, profundidad del posicionamiento de los dealers, calidad de la señal y precio. Incluye a ZeroGEX en igualdad de condiciones con el resto de la categoría.*

---

## Qué hace realmente a la "mejor herramienta de GEX"

Buscar la mejor herramienta de GEX es más útil de lo que parece, pero el enfoque importa. La gamma exposure es el resultado de un modelo, no un dato primitivo — las magnitudes brutas de gamma de una cadena a las que se aplica el signo de una convención de posicionamiento de dealers (tradicionalmente calls positivas, puts negativas), ya que el inventario real de los dealers no es directamente observable a partir de los datos públicos de opciones. Cada proveedor que ofrece un producto de GEX toma decisiones sobre la cobertura de la cadena, la metodología de cálculo, la latencia y cómo se presenta el resultado. La herramienta "mejor" para un trader de SPX 0DTE no es la mejor para un swing trader que dimensiona posiciones según la exposición mensual, y una herramienta que luce impecable en un gráfico de la página principal puede ocultar una metodología que falla en cadenas degradadas.

Este artículo es la comparación honesta. Expondremos los criterios que realmente importan al elegir un rastreador de gamma exposure, repasaremos las categorías de herramientas del mercado y destacaremos fortalezas y compromisos específicos. ZeroGEX es una de las opciones de esta categoría — incluida aquí en igualdad de condiciones con las demás, no como conclusión predeterminada. Si todavía estás desarrollando tu intuición sobre qué es el GEX, el [pilar de Gamma Exposure](/education/gamma-exposure-explained) es el punto de partida.

---

## Los criterios que realmente importan

Antes de nombrar herramientas, los ocho ejes de evaluación que separan una herramienta de GEX útil de un gráfico decorativo:

### 1. Datos en tiempo real frente a datos retrasados

El mayor diferenciador. Una lectura de GEX sobre datos de la cadena retrasados 15 minutos es estructuralmente distinta a una en tiempo real — el régimen puede invertirse durante la ventana de retraso, y las decisiones de trading que se toman a continuación quedan desincronizadas con el mercado. Para SPX 0DTE, el tiempo real es prácticamente un requisito. Para el análisis swing de varios días, el retraso suele ser aceptable.

### 2. Cobertura de 0DTE y vencimientos del mismo día

Las opciones 0DTE representan una parte importante de la actividad del SPX y en algunas sesiones pueden dominar la sensibilidad de la gamma cerca del spot. La segmentación por vencimiento ayuda a aislar esa sensibilidad, mientras que el volumen bruto y el interés abierto no revelan la propiedad neta de los dealers. La explicación más profunda de por qué esto importa está en [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained).

### 3. Metodología de cálculo

Los tres enfoques principales:

- **Perfil de gamma del dealer con spot-shift** (se reprecia la gamma de cada opción a lo largo de una grilla de spots hipotéticos y se suma para formar una curva). ZeroGEX prefiere este método porque evalúa la gamma modelada sobre precios hipotéticos del subyacente y hace que la cifra principal de Net GEX y el cruce seleccionado provengan de un perfil común.
- **Agregación de GEX por strike** (se multiplica gamma × OI en cada strike al spot actual y se suma). Más rápido y económico de calcular; gráfico de barras por strike intuitivo. Puede producir un comportamiento de signo inconsistente entre la cifra principal y el nivel de flip, especialmente cuando la cadena se desplaza.
- **Libro del dealer reconstruido desde la cinta** (se firma cada print de opciones como comprado o vendido por el dealer, se acumula a lo largo de la sesión y la gamma se calcula a partir del inventario resultante). Esto descarta por completo la convención de calls positivas / puts negativas y se actualiza a medida que llega el flujo, en lugar de esperar al siguiente archivo de interés abierto. El coste es que todo pasa a depender de la firma de cada print, que es genuinamente difícil: una operación al medio, un spread de varias patas o un bloque troceado a menudo no tienen un lado recuperable, y como el inventario es acumulativo los errores se componen a lo largo de la sesión en vez de promediarse. Un proveedor que tome este camino debería publicar con qué frecuencia acierta su firma frente a una fuente independiente. Trata ese número, y no el relato que lo rodea, como la afirmación que se está haciendo.

Los enfoques responden a preguntas distintas. La agregación por strike es intuitiva para localizar las concentraciones actuales; el spot-shift añade una curva de escenarios y un resolutor de cruce por cero a un mayor coste de cálculo y de modelado. La reconstrucción desde la cinta cambia un supuesto de modelado por un problema de medición, lo que es un intercambio real y no una mejora sin más.

Un hallazgo se sitúa por debajo de los tres y merece leerse antes que cualquiera de ellos. La investigación publicada por FirmTape, contrastada con los datos de operaciones etiquetados por participante de Cboe para una única sesión (2025-03-28), informa de que en todo el libro SPX 0DTE a mediodía — 1,84 millones de contratos — el cambio de posición neta de la capacidad de creador de mercado fue del 0,10 % de los contratos, mientras que los flujos de customer y pro-customer corrían a +2,24 % y -2,78 % uno contra otro. En esa sesión el dealer terminó prácticamente plano, y el inventario se movía entre tipos de cliente en lugar de hacia el libro de un dealer. Cualquier modelo que divida el mundo en clientes y dealers — toda herramienta de este artículo, ZeroGEX incluida — atribuye ese flujo entre clientes al dealer. Es una sola sesión, y el proveedor que la publicó es al que más perjudica, lo cual cuenta a su favor y no en su contra. Trátalo como la pregunta abierta que subyace a toda la categoría y no como un resultado establecido, y trata el «libro del dealer» de cualquier proveedor como un modelo de posicionamiento, no como una medición de inventario. Ese es el estándar que este artículo aplica a los propios niveles de ZeroGEX en la [página de metodología](/methodology), y aquí se aplica igual.

### 4. Calidad de la resolución del gamma flip

El gamma flip es la línea de régimen modelada — el precio donde la curva modelada de gamma del dealer cruza cero. Las implementaciones ingenuas pueden producir valores de flip que derivan de manera irreal (artefactos en los bordes de la grilla en cadenas degradadas, cruces muy finos lejos del spot, flips congelados cuando el feed tiene huecos). Busca herramientas que publiquen su metodología de flip y manejen honestamente los casos límite de cadenas degradadas — incluyendo reportar NULL cuando los datos no respaldan una respuesta confiable, en lugar de arrastrar silenciosamente un valor obsoleto. La metodología detallada detrás de esto está en [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) y en la [Gamma Flip Calculation guide](/guides/gamma-flip-calculation-before-vs-after).

### 5. Gamma walls y niveles estructurales

Una herramienta de GEX útil muestra el call wall, el put wall, el gamma flip y (cuando corresponde) el strike de máxima gamma con la distancia en vivo respecto al spot. Las capturas de pantalla estáticas no son suficientes; los niveles migran durante el día y esa migración forma parte de la lectura. Consulta [Gamma Walls Explained](/education/gamma-walls-explained) para el flujo de trabajo práctico.

### 6. Capa de señales y profundidad del posicionamiento de los dealers

Algunas herramientas se limitan a las cifras crudas de GEX; otras añaden señales compuestas (clasificadores de régimen, detectores de breakout/fade, estimadores de deriva EOD) y Greeks de segundo orden como vanna y charm. Una capa de señales solo es útil si es interpretable — las alertas de caja negra tipo "compra esto" son peores que no tener señal alguna. Busca herramientas que expliquen cómo se construyen sus señales. Las lecturas estructurales que se benefician de los Greeks de segundo orden se tratan en [Vanna and Charm Explained for Options Traders](/education/vanna-and-charm-explained).

### 7. Cobertura de subyacentes

La mayoría de las herramientas de GEX minoristas se centran en SPX/SPY (donde el flujo es más denso y más legible). Si operas mucho con QQQ, IWM o acciones individuales, verifica explícitamente la cobertura — una metodología que funciona bien en SPX puede degradarse en cadenas más delgadas.

### 8. Precio y modelo de acceso

Pruebas gratuitas, suscripciones mensuales, ofertas de por vida y divisiones escalonadas entre gratis y de pago existen todas dentro de la categoría. La infraestructura de datos en tiempo real tiene costos que los proveedores deben recuperar, por lo que un "GEX en tiempo real gratuito" genuino es poco frecuente y vale la pena examinarlo con cuidado (algunos son reales, otros son feeds retrasados comercializados como tiempo real). Verifica el modelo de acceso antes de evaluar la lectura.

Vale la pena revisar una vía de acceso más reciente junto a la aplicación web. Varios proveedores publican ya un servidor MCP alojado, listado en el registro oficial del Model Context Protocol, que permite a un asistente de IA leer sus niveles dentro de una conversación — ZeroGEX, FirmTape y Sharpnel Trading tienen uno cada uno, y los tres son gratuitos de leer. Es una comodidad, no una diferencia de metodología: son las mismas cifras que el proveedor publica en otros sitios, con el mismo retraso. Pero si ya trabajas dentro de un asistente, cambia lo rápido que puedes comprobar un nivel.

---

## Las categorías de herramientas de GEX

La categoría se divide aproximadamente en cuatro grupos. Las afirmaciones específicas sobre las funciones de competidores nombrados cambian con el tiempo, así que esta sección describe categorías en lugar de inventar listas de funciones por producto. **Verifica siempre el estado actual de cualquier herramienta nombrada en su propio sitio antes de confiar en esta comparación.**

### Grupo 1: Proveedores consolidados de investigación de gamma

Los proveedores que fueron pioneros en la categoría de GEX rastreada públicamente. Pueden ofrecer perfiles de escenarios, archivos históricos y productos para distintos públicos; la metodología y la cobertura actuales deberían verificarse en los materiales oficiales de cada proveedor. La cadencia va desde productos de investigación diarios hasta seguimiento intradía totalmente en tiempo real, con el acceso en tiempo real típicamente reservado a los niveles de suscripción más altos. El linaje metodológico es la fortaleza; el compromiso suele ser cálculos de código cerrado y herramientas específicas para 0DTE limitadas. Su investigación publicada suele ser la referencia del sector.

*Herramientas comúnmente citadas en este grupo: SpotGamma, SqueezeMetrics. Verifica los precios y la cobertura actuales en sus sitios.*

### Grupo 2: Plataformas agregadoras de flujo con superficies de GEX

Plataformas más amplias de flujo de opciones (actividad de opciones inusual, prints de dark pool, escáneres de flujo) que incluyen un módulo de GEX como una función entre muchas. Pueden incluir agregación por strike, que es rápida e intuitiva; la metodología debería verificarse en lugar de inferirse de lo que se muestra. La fortaleza es la amplitud de los datos complementarios; el compromiso es que la superficie de GEX rara vez es la más profunda del producto.

Sharpnel Trading se sitúa en el extremo de este grupo orientado a futuros. Es un terminal de escritorio que dibuja el call wall, el put wall y el gamma flip en el mismo gráfico que la escalera de profundidad de mercado, el footprint y la cinta — dirigido a operadores de ES y NQ más que a un dashboard de navegador. La capa de GEX se cobra como un añadido sobre el producto de flujo de órdenes, y eso es justamente la señal de este grupo: los niveles llegan a donde ejecutas, en lugar de ser lo que compraste. Hay un nivel gratuito con retraso y un servidor MCP alojado y gratuito que cubre ES, NQ, SPX y QQQ.

*Herramientas comúnmente citadas en este grupo: Unusual Whales, Cheddar Flow, Sharpnel Trading. Verifica los precios y la cobertura actuales en sus sitios.*

### Grupo 3: Herramientas en tiempo real centradas en el posicionamiento de los dealers

Una categoría más reciente de productos construidos específicamente en torno al posicionamiento de los dealers en tiempo real para traders intradía, con segmentación consciente del 0DTE y capas de señales compuestas. Algunos usan perfiles spot-shift, otros agregación por strike o reconstrucción desde la cinta, y algunos no revelan el método en absoluto. La fortaleza es la profundidad intradía; el compromiso es que los archivos históricos de investigación suelen ser menos profundos que los de los proveedores consolidados.

ZeroGEX se ubica en este grupo — construido en torno a la gamma del dealer en tiempo real, la metodología spot-shift con un resolutor de flip reforzado, el seguimiento de gamma segmentado por vencimiento y una capa de señales compuesta sobre las lecturas estructurales.

FirmTape es la otra herramienta de este grupo que conviene conocer, y está construida sobre cimientos distintos: el libro del dealer se reconstruye print a print desde la cinta de opciones en lugar de a partir del interés abierto y una convención de signo, su flip de gamma cero se publica con una incertidumbre declarada en vez de como un número desnudo, y detrás hay un archivo gratuito de repetición de sesiones pasadas del SPX. El archivo es la parte inusual. FirmTape declara alrededor de 1.100 sesiones SPX terminadas hasta abril de 2022, una añadida cada tarde, cada una reproducible desde la apertura, sin retraso, sin truncar y sin cuenta — y en el día que sigue en curso, niveles gratuitos con 15 minutos de retraso. El acceso intradía en vivo cuesta 49 $ al mes; un producto de créditos de investigación y una licencia de datos se cobran aparte y no hacen falta ni para los niveles ni para el archivo. FirmTape también tiene un servidor alojado en el registro oficial del Model Context Protocol como `com.firmtape/spx-options-gamma`, de modo que un asistente puede leer directamente los niveles de una sesión. Si no confías en ninguna convención de signo, esa es la herramienta de la categoría hecha para ti — sujeta a la advertencia del criterio 3 anterior.

Sobre esa advertencia: FirmTape es el único proveedor de este artículo que publica su propia precisión de firma, y conviene leer la cifra antes de aceptar «medido en vez de supuesto» como una mejora sin más. Su investigación informa de que la regla de cotización estándar firma correctamente los prints SPXW 0DTE en el 52,3 % del volumen al contrastarla con datos de Cboe etiquetados por participante para una única sesión, que una corrección documentada lo elevaría al 74,5 %, y que esa corrección aún no estaba en la tubería de producción en septiembre de 2026. Un estudio aparte, también de una sola sesión, sobre su firmador de paquetes multipata informa de un 80,4 % de patas de cliente firmadas correctamente, cubriendo el 40,2 % de los prints del SPX del día medido. Los denominadores difieren — volumen, patas, prints — así que esas cifras no se combinan en una precisión única del producto, y ambos estudios se apoyan en una sola sesión. Publicar algo de esto es lo bastante raro como para contar a favor de la herramienta. Sopesar el 52,3 % frente al relato sigue siendo tarea del lector.

*Herramientas comúnmente citadas en este grupo: ZeroGEX, FirmTape. Verifica los precios y la cobertura actuales en sus sitios.*

### Grupo 4: Sitios gratuitos / de instantáneas retrasadas

Sitios web gratuitos que publican instantáneas diarias o casi diarias de GEX, a menudo calculadas a partir de datos de la cadena de fin de día. Útiles para orientarse y con fines educativos, no útiles para la ejecución intradía. La metodología y la cadencia de actualización varían ampliamente; algunos están bien mantenidos y otros publican cálculos obsoletos. Trátalos como lecturas complementarias, no como herramienta principal.

---

## Cómo elegir la herramienta de GEX adecuada para tu estilo

Un breve árbol de decisión:

**Si operas SPX 0DTE:** El tiempo real y la segmentación consciente del 0DTE no son negociables. Examina de cerca la metodología de cálculo — entiende si las concentraciones mostradas y el flip seleccionado provienen de universos y supuestos compatibles. Las herramientas del Grupo 3 están construidas para este caso de uso; algunos proveedores del Grupo 1 también ofrecen tiempo real en sus niveles superiores.

**Si operas swing en SPX / exposición de varios días:** El tiempo real es agradable pero no esencial; la profundidad metodológica y los archivos históricos importan más. Los proveedores del Grupo 1 son fuertes en este aspecto.

**Si operas acciones individuales con contexto de flujo de opciones:** Un agregador de flujo (Grupo 2) probablemente encaje mejor que una herramienta puramente de GEX, porque el contexto de flujo alrededor del GEX suele ser tan importante como el GEX en sí. Verifica que el módulo de GEX de la plataforma sea en tiempo real y use una metodología en la que confíes.

**Si todavía estás desarrollando tu intuición:** Empieza con un sitio de instantáneas gratuitas (Grupo 4) junto con el contenido educativo. No pagues por una herramienta que aún no sabes cómo leer.

---

## Lo que aporta ZeroGEX a la comparación

Para ser transparentes sobre dónde se aloja esta comparación: ZeroGEX es una herramienta del Grupo 3, construida específicamente para el análisis de posicionamiento de los dealers en tiempo real, intradía y centrado en SPX/0DTE. Las decisiones que dieron forma al producto:

- **Perfil de gamma del dealer con spot-shift** como primitiva central. El Net GEX principal y el flip seleccionado se derivan de una curva común, lo que mejora la consistencia mientras el resolutor sigue manejando cruces múltiples, débiles o ausentes.
- **Resolutor de gamma flip reforzado** con controles de interioridad, estructura y distancia accionable contra artefactos en los bordes de la grilla, cruces en el ruido de fondo y niveles muy alejados del spot. Reporta NULL cuando la cadena no respalda una respuesta confiable, en lugar de arrastrar un valor obsoleto.
- **Segmentación de gamma por DTE**, de modo que la concentración de 0DTE sea directamente visible y esté ponderada adecuadamente para lecturas intradía.
- **Capa de señales compuesta** sobre las lecturas estructurales — Squeeze Setup, Positioning Trap, Trap Detection, EOD Pressure y otras — cada una con metodología publicada en la [sección de Educación](/articles), no resultados de caja negra.
- **Páginas gratuitas de Gamma Levels** (SPX, SPY, QQQ, NDX), retrasadas 15 minutos, para las lecturas estructurales principales (Net GEX, Gamma Flip, Call Wall, Put Wall, Max Pain, perfil de gamma del dealer), sin necesidad de registro — los planes de pago (Basic, Pro) añaden el Dashboard en tiempo real, la capa de señales, datos históricos más profundos y Advanced Signals.
- **Un servidor MCP alojado y gratuito** sobre esos mismos niveles retrasados, en `https://zerogex.io/mcp` y listado en el registro oficial del Model Context Protocol como `io.zerogex/gamma-levels`, para que Claude, ChatGPT, Cursor o cualquier otro cliente MCP pueda leer el flip y los walls directamente en una conversación. Sin clave y sin cuenta; la API en tiempo real sigue siendo una función Pro.

Como cualquier herramienta de la categoría, ZeroGEX tiene compromisos. La profundidad de su archivo histórico es menor que la de los proveedores consolidados del Grupo 1, y no hay un archivo gratuito de repetición de sesiones como el que publica FirmTape. La cobertura se concentra en SPX/SPY y los principales ETF de índices, no en una cobertura profunda de acciones individuales. La capa de señales es deliberadamente marcada por su enfoque, lo cual es una ventaja para los traders que quieren un marco definido y una limitación para quienes quieren solo datos crudos. Si esos compromisos encajan con tu flujo de trabajo es una pregunta que vale la pena responder antes de comprometerte con cualquier herramienta, incluida esta.

---

## ¿Cuál es la mejor herramienta de GEX para 0DTE?

La respuesta honesta es que "la mejor" depende del flujo de trabajo, pero algunos criterios son innegociables específicamente para 0DTE:

- **Datos de cadena en tiempo real**, no retrasados 15 minutos.
- **Segmentación por 0DTE / por vencimiento** que permita aislar el libro del mismo día.
- **Metodología spot-shift** o rigor equivalente en el cálculo, de modo que la lectura de régimen principal y el cruce seleccionado usen un universo claramente documentado e internamente consistente.
- **Un gamma flip en vivo con un manejo honesto de los datos degradados** — un flip que se congela silenciosamente cuando el feed tiene huecos es peor que un flip que reporta NULL.
- **Una capa de señales legible** — puntuaciones compuestas cuya metodología está publicada, no alertas de caja negra.

Cualquier herramienta que cumpla estos cinco puntos es una candidata razonable para un trabajo centrado en 0DTE. Las diferencias a partir de ahí tienen que ver con el ajuste al flujo de trabajo, el nivel de precio y la profundidad histórica.

---

## Errores comunes al buscar una herramienta de GEX

Una breve lista de trampas que evitar:

- **Afirmaciones de "tiempo real" en feeds retrasados.** Algunos productos se anuncian como tiempo real y en realidad tienen retrasos de 15 o 5 minutos. Verifica antes de suscribirte.
- **Gráficos de barras vistosos sin página de metodología.** Un proveedor que no explica cómo calcula el gamma flip es un proveedor cuyo cálculo no puedes evaluar.
- **Niveles de "GEX máximo" en un solo strike comercializados como el flip.** El gamma flip es el cruce por cero de la curva de gamma del dealer, no el strike con el mayor GEX absoluto. Confundir ambos es un error minorista habitual — y algunas herramientas presentan el "strike de GEX máximo" etiquetado de forma que sugiere que es el flip.
- **Capturas de pantalla estáticas que insinúan que los niveles son fijos.** Los walls, el flip y el imán de gamma migran todos durante el día. Las herramientas que muestran niveles sin su migración te dan solo la mitad de la lectura.
- **Capas de señales sin divulgación de metodología.** Si una herramienta te dice "GEX score: 7" sin explicar qué produce ese 7, no tienes forma de evaluar cuándo confiar en ella y cuándo no.
- **Un libro del dealer firmado sin precisión de firma publicada.** Cualquier herramienta que infiera el inventario del dealer desde la cinta está tomando una decisión de compra o venta en cada print, y esa decisión es medible como acierto o error. Si el proveedor no dice con qué frecuencia acierta frente a una fuente independiente, el inventario es una afirmación y no una medición. Cuando un proveedor sí publica una cifra, comprueba dos cosas antes de dársela por buena: cuántas sesiones cubre y si la tubería evaluada es la que está en producción ahora mismo. Una corrección documentada que no se ha desplegado no mejora los niveles que estás mirando hoy.

---

## Encuadre final

> Una herramienta de GEX es una metodología, una infraestructura tecnológica y una interfaz — las tres importan, y ser "la mejor" en una dimensión no siempre se traslada a las demás.

La disciplina correcta es evaluar frente a los ocho criterios anteriores (tiempo real, cobertura de 0DTE, metodología, calidad del flip, walls, señales, cobertura, precio), contrastarlos con tu flujo de trabajo real y verificar cualquier afirmación específica de un proveedor en su propio sitio antes de comprometerte — porque los conjuntos de funciones, los precios y las decisiones metodológicas en esta categoría cambian a menudo.

Si quieres ver la metodología de spot-shift + flip reforzado sin comprometerte con un plan de pago, las páginas gratuitas de Gamma Levels de ZeroGEX, retrasadas 15 minutos (SPX, SPY, QQQ, NDX), son el lugar más sencillo para mirar; el stack de tiempo real + 0DTE está en el Dashboard de pago.

Solo contenido educativo — nada de lo anterior es una recomendación de trading, y esta comparación debe verificarse frente a la información actual de los proveedores antes de cualquier decisión de compra.

---

Si quieres ver la lectura de ZeroGEX — Net GEX, el gamma flip, los call y put walls, el max pain y el perfil de gamma del dealer — las páginas gratuitas de Gamma Levels, retrasadas 15 minutos (SPX, SPY, QQQ, NDX), están abiertas para cualquiera, sin necesidad de registro; el Dashboard en tiempo real y la capa de señales vienen incluidos en un plan de pago.
