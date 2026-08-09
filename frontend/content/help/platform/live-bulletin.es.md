# Usar el Live Bulletin

*Una instantánea en vivo y lista para compartir del posicionamiento gamma de los dealers, para el símbolo que estás siguiendo.*

---

## Qué es el Live Bulletin

El Live Bulletin es una **tarjeta en vivo de posicionamiento gamma**, para un subyacente a la vez. Elige un símbolo y trae la instantánea de posicionamiento actual directamente desde el backend y la presenta en una sola tarjeta: el régimen gamma, los niveles clave (gamma flip, call wall, put wall, max pain), el Net GEX, el ratio put/call, una banda de rango esperado (expected range) y un mapa de posicionamiento que sitúa el spot respecto a esos niveles.

Está pensada para leerse de un vistazo — y para compartirse. Puedes ajustar el titular y el resumen, y luego descargar o copiar un PNG limpio de la tarjeta para tus notas, un chat de trading o redes sociales.

## Qué contiene la tarjeta

- **Insignia de régimen gamma** — positivo (dealers largos en gamma; mercado anclado, baja volatilidad), negativo (dealers cortos en gamma; mercado en tendencia, alta volatilidad), en el flip (transición), o sin resolver cuando la cadena es demasiado fina para determinar un flip con fiabilidad.
- **Titular + resumen** — una lectura en lenguaje claro generada automáticamente a partir de los números en vivo: la postura de los dealers, dónde se sitúa el spot respecto al flip, el corredor entre los walls y qué implica el régimen para la cinta (tape). Editable — ver más abajo.
- **Spot** — el precio del subyacente y su variación en el día. Cuando un índice cash está fuera de su sesión (p. ej. el SPX durante la noche), el spot es **implícito desde los futuros** (ES/NQ) y se señala claramente como tal — nunca se muestra como una cotización cash en vivo.
- **Cuadrícula de métricas** — Gamma Flip, Net GEX, ratio Put/Call, Call Wall, Put Wall y Max Pain.
- **Expected Range** — una banda de movimiento implícito de 1σ (~68 %) para el horizonte elegido, derivada del VIX (SPX/SPY) o del VXN (QQQ/NDX), con una nota sobre dónde se sitúan los walls de los dealers respecto a esa banda.
- **Mapa de posicionamiento** — put wall, gamma flip, spot y call wall colocados en un mismo eje de precios, con la banda de rango esperado sombreada, para ver de un vistazo dónde está el precio entre los imanes.

## Controles

- **Subyacente** — SPX, SPY, QQQ o NDX.
- **Horizonte del rango esperado** — Daily, Weekly o Monthly. «Daily» es una sesión de trading de volatilidad implícita (el Expected Daily Range), no un día natural; Weekly son 5 sesiones, Monthly ~21. Si el índice de volatilidad implícita no está disponible, la banda se oculta en lugar de estimarse.
- **Titular / Resumen** — el texto generado automáticamente es un punto de partida; edita cualquiera de los dos campos y la tarjeta se actualiza en vivo. «Reset to auto» restaura el texto generado.
- **Download PNG / Copy to clipboard** — exporta la tarjeta como una imagen lista para compartir (la tarjeta lleva una marca de agua zerogex.io).

## Cómo se actualiza

La tarjeta es **en vivo**. Consulta el backend a lo largo de la sesión — el spot cada pocos segundos, el resumen y el perfil gamma cada ~10 segundos, el medidor de volatilidad cada ~30 segundos — de modo que los niveles, el régimen, la banda de rango esperado y la lectura generada automáticamente se refrescan a medida que cambian las condiciones. Los propios niveles de gamma de los dealers los recalcula el motor de analítica en un ciclo de aproximadamente un minuto durante la sesión regular, de modo que los walls, el flip y el max pain pueden moverse en intradía a medida que evolucionan el spot y el posicionamiento. Una marca de tiempo «as of» (ET) en la tarjeta te indica lo reciente que es la instantánea.

## Cuándo es más útil

- **Antes de la apertura** — una lectura rápida de dónde están los walls, el flip y el rango esperado de cara a la sesión, con el spot implícito desde los futuros mientras el índice cash sigue cerrado.
- **Cerca de niveles clave** — echa un vistazo al mapa de posicionamiento cuando el precio se acerca al flip, al call wall o al put wall.
- **Para compartir una lectura** — exporta la tarjeta cuando quieras entregar a alguien la imagen del posicionamiento gamma del día sin capturar toda la aplicación.

## Qué no es

El Live Bulletin **no es un feed de señales de trading**. Es una instantánea de posicionamiento/contexto — te muestra *dónde* se sitúa el gamma de los dealers y qué régimen implica, no *cuándo* actuar. Para las señales y los disparos, usa los dashboards Basic y Advanced Signals y las [Signal Alerts](/help/platform/alerts); para una lectura direccional, consulta el Trade Bias y el [Composite Score](/help/platform/composite-score).

## Visibilidad por nivel

El Live Bulletin es una función **Basic** — incluida en Basic y Pro. Las señales Advanced hacia las que te orienta están reservadas por separado al nivel Pro.

## El espejo de administración

Existe una versión de administración sin marca de agua de la misma tarjeta, empleada para capturas de pantalla y demostraciones. Se trata de una ruta exclusivamente interna.

## Ver también

- [Leer el Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Max Pain](/help/platform/max-pain)
