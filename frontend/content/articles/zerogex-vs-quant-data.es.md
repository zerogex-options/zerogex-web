# ZeroGEX vs Quant Data (2026): mapas de GEX, precios y cobertura comparados

*Una comparación justa entre ZeroGEX y Quant Data (quantdata.us): para qué está pensada cada plataforma, cómo se comparan el Interval Map de Quant Data y el GEX Heatmap de ZeroGEX, cuánto cuestan las API, dónde Quant Data es la opción más sólida y dónde encaja mejor una herramienta dedicada a los niveles de los índices. Los datos sobre Quant Data proceden de su propio sitio, de su centro de ayuda y de sus fichas en las tiendas de apps, consultados el {{quantdata:checked}}.*

---

## En resumen

- **Quant Data** gira en torno al flujo de órdenes de opciones en tiempo real, con prints de dark pools y lit pools, noticias, alertas y apps para iOS y Android. Sus herramientas de exposición, incluido el Interval Map, cubren cualquier acción o índice de EE. UU. con opciones cotizadas.
- **ZeroGEX** gira en torno a una sola tarea: el posicionamiento modelado de los dealers - el gamma flip, el call wall y el put wall, y las señales construidas sobre ellos - para seis símbolos: SPX, SPY, QQQ, NDX y los futuros ES y NQ.

Si tus operaciones parten del flujo de órdenes de todo el mercado, Quant Data se acerca más a lo que necesitas. Si operas intradía el complejo de índices y quieres sus niveles en profundidad, ZeroGEX se acerca más.

## El Interval Map y el GEX Heatmap

La vista más conocida de Quant Data es el Interval Map: los strikes en vertical, la sesión en horizontal y una burbuja por strike y por intervalo, con un tamaño según la exposición, en verde si es positiva y en rojo si es negativa, y el precio del subyacente trazado por encima. Puede mostrar la exposición gamma, delta, vanna o charm, en intervalos de un minuto o más, como valores brutos o como el cambio de un intervalo al siguiente.

La vista de ZeroGEX más parecida es el GEX Heatmap, incluido en Basic: la gamma neta de los dealers por strike a lo largo de la sesión, en naranja si es positiva y en violeta si es negativa (azul en los temas claros), con las velas del precio y el gamma flip dibujados encima ([cómo leerlo](/help/platform/reading-charts)). Su vista Dots presenta las mismas cifras como lo hace el Interval Map: un punto por strike y por intervalo, con un tamaño según la gamma en ese punto, en verde si es positiva y en rojo si es negativa, para 10, 20 o 40 strikes alrededor del precio, con el precio trazado por encima. En la página Dealer Positioning, un segundo mapa de calor cruza los strikes con los días hasta el vencimiento, hasta una semana, para que puedas ver qué vencimientos aportan la gamma en cada strike.

Las diferencias van en los dos sentidos:

- **Más exposiciones y tickers en Quant Data.** ZeroGEX solo muestra mapas de gamma, en seis símbolos. Lee vanna y charm como una señal y no como un mapa, y no publica la exposición delta, a propósito: [por qué ZeroGEX no publica el DEX](/education/why-we-dont-publish-dex).
- **La línea de régimen en ZeroGEX.** El gamma flip se dibuja sobre el propio mapa de calor, a partir de un perfil de gamma calculado a lo largo de un rango de precios, de modo que el precio, los strikes y la línea de régimen quedan en una sola imagen. El método está en la página de [Metodología](/methodology).

Las dos herramientas modelan la gamma de los dealers de la misma forma básica: a partir de la cadena de opciones, contando las calls como positivas y las puts como negativas. El centro de ayuda de Quant Data describe sus cifras como una estimación, no como una visión directa del inventario de ningún dealer, y ZeroGEX dice lo mismo.

### Cómo leer un strike que "crece" durante el día

El open interest se publica una vez al día, después del cierre. En un mapa de gamma construido a partir de él, el color de un strike cambia durante la sesión porque sus opciones se revalúan a medida que se mueven el precio, el tiempo y la volatilidad implícita, no porque los dealers hayan abierto posiciones nuevas. Cerca del vencimiento, la gamma cerca del dinero aumenta a medida que se agota el tiempo, así que un strike 0DTE junto al precio puede intensificarse a lo largo del día sin ninguna posición nueva. Lee una burbuja o una banda que crece como "este strike importa más a medida que corre el reloj", y lee el flujo por separado. En ZeroGEX, eso corresponde a la página Hedging Flow, que estima la cobertura implícita en las operaciones de hoy ([cómo funciona](/education/hedging-flow-explained)).

## Precios

Precios de lista antes de promociones e impuestos, consultados el {{quantdata:checked}}. El plan de plataforma de Quant Data, que cubre su panel web y sus apps para iOS y Android, cuesta {{quantdata:platform:monthly}} al mes o {{quantdata:platform:annual}} al año, con una prueba gratuita de 7 días en cualquiera de las dos modalidades. Ambos precios son para traders no profesionales; a los profesionales registrados se les remite a un plan Professional aparte. Su API es, a su vez, otro plan aparte. Los precios de ZeroGEX son los que figuran hoy en su página de [Precios](/pricing).

| Plan | Facturación mensual | Facturación anual |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mes | {{zgx:basic:annual}}/año (unos {{zgx:basic:annual:mo}}/mes) |
| ZeroGEX Pro, con acceso a la API | {{zgx:pro:monthly}}/mes | {{zgx:pro:annual}}/año (unos {{zgx:pro:annual:mo}}/mes) |
| Quant Data, no profesional | {{quantdata:platform:monthly}}/mes | {{quantdata:platform:annual}}/año (unos {{quantdata:platform:annual:mo}}/mes) |
| Plan de API de Quant Data | {{quantdata:api:monthly}}/mes | {{quantdata:api:annual}}/año (unos {{quantdata:api:annual:mo}}/mes) |

Los dos planes de ZeroGEX cuestan menos que el plan de plataforma de Quant Data, con facturación mensual o anual, y ZeroGEX Pro incluye el acceso a la API que Quant Data vende como un plan aparte. Aun así, con esos precios se compran cosas distintas: el de Quant Data cubre flujo de órdenes, prints de dark pools, noticias y mapas de exposición en más de 6.000 tickers, y el de ZeroGEX cubre seis símbolos en profundidad.

Las dos API tampoco tienen el mismo tamaño. La de Quant Data abarca más de 30 endpoints en más de 6.000 tickers, incluidos prints de dark pools y superficies de volatilidad implícita, con un año de historial y un servidor MCP alojado. La de ZeroGEX cubre los seis símbolos que sigue: niveles, GEX, flujo, señales y su historial.

ZeroGEX Basic mensual empieza con una prueba gratuita de 7 días, y todos los demás planes de ZeroGEX están cubiertos por una garantía de devolución de 7 días. El desglose completo está en la página de [Precios](/pricing).

## Dónde Quant Data es la opción más sólida

- **Amplitud.** Flujo de órdenes y mapas de exposición para cualquier acción o índice de EE. UU. con opciones cotizadas. ZeroGEX cubre seis símbolos.
- **Flujo de órdenes, prints de dark pools y noticias en un solo feed.** Ese es el núcleo de Quant Data. ZeroGEX no tiene datos de dark pools ni feed de noticias, y sus páginas de flujo solo cubren el complejo de índices.
- **Más tipos de exposición en el mapa.** Delta, vanna y charm junto a la gamma, en los intervalos que elijas.
- **Apps móviles y alertas push.** Quant Data tiene apps nativas para iOS y Android con notificaciones push. ZeroGEX funciona en el navegador, en el escritorio o en el móvil, y las activaciones de sus señales se muestran dentro de la app.
- **Una API más grande.** Más de 30 endpoints, un año de historial y datos de dark pools, para construir tus propias herramientas sobre muchos tickers.
- **Soporte a todas horas.** En los planes de Quant Data figura soporte por chat en vivo 24/7. El soporte de ZeroGEX es por correo electrónico.

## Dónde ZeroGEX es la opción más sólida

- **Profundidad en el complejo de índices.** Todo lo que construye ZeroGEX está orientado a SPX, SPY, QQQ, NDX, ES y NQ: el gamma flip, los walls, la gamma por vencimiento, el flujo de vanna y charm, el flujo de cobertura y catorce señales construidas sobre los niveles, con sus métodos expuestos en la [guía de señales](/guides/signals-explained).
- **La línea de régimen en todos los gráficos.** El gamma flip se dibuja en el GEX Heatmap y en los gráficos de precio: el nivel en el que la cobertura modelada de los dealers tiende a pasar de amortiguar los movimientos a prolongarlos.
- **Un método publicado y un historial calificado.** ZeroGEX documenta cómo calcula el gamma flip en su página de [Metodología](/methodology) y califica cada previsión que publica, fallos incluidos, en su [Track Record](/track-record).
- **Niveles en los gráficos que ya usas.** Scripts gratuitos para TradingView y thinkorswim, e indicadores para NinjaTrader, Sierra Chart y Bookmap que se actualizan solos con Pro. Consulta [Integraciones](/integrations).
- **Un precio más bajo, con la API incluida.** Los dos planes de ZeroGEX cuestan menos que el plan de plataforma de Quant Data, y el acceso a la API viene con Pro en lugar de en un plan aparte.
- **Una forma gratuita de comprobarlo primero.** La página de [niveles gamma de SPX](/spx-gamma-levels) y sus páginas hermanas no requieren registro, y tampoco el [servidor MCP](/education/gamma-levels-in-claude) que lleva los mismos niveles a los asistentes de IA.

## Cómo decidir

- **Operas acciones individuales a partir del flujo de órdenes, o quieres prints de dark pools y noticias en un solo feed:** Quant Data.
- **Quieres mapas de delta, vanna y charm para muchos tickers:** Quant Data.
- **Operas intradía SPX, SPY, QQQ, NDX, ES o NQ y quieres el flip, los walls y las señales de posicionamiento de los dealers en profundidad:** ZeroGEX.
- **Aún no lo tienes claro:** abre la página gratuita de [niveles gamma de SPX](/spx-gamma-levels), sin necesidad de registro, y compárala con lo que usas hoy.

---

Las funciones y los precios de Quant Data proceden de [quantdata.us](https://quantdata.us) y de su [centro de ayuda](https://help.quantdata.us/en/), consultados el {{quantdata:checked}}, y pueden cambiar en cualquier momento, así que confírmalos allí. Los precios de ZeroGEX de esta página se toman de su lista de precios en vigor. ZeroGEX no tiene afiliación con Quant Data. Solo contenido educativo, no es una recomendación de trading.
