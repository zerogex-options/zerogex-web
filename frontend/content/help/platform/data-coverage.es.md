# Cobertura de datos y actualización

*Símbolos admitidos, comportamiento en el horario de mercado, con qué frecuencia se actualiza cada sección y qué ocurre en torno a festivos y jornadas reducidas.*

---

## Símbolos cubiertos

ZeroGEX ofrece cobertura analítica completa para cuatro subyacentes de contado:

- **SPY** - ETF del S&P 500
- **SPX** - Índice S&P 500 (opciones de estilo europeo)
- **QQQ** - ETF del Nasdaq 100
- **NDX** - Índice Nasdaq 100 (opciones de estilo europeo)

Estos son los cuatro subyacentes más líquidos y con mayor gamma del mercado de opciones de EE. UU. - los instrumentos donde la actividad de cobertura de los dealers tiene el mayor impacto en el precio intradía.

A ellos se suman dos futuros sobre índices de CME, como símbolos de pleno derecho:

- **ES** - futuro E-mini del S&P 500
- **NQ** - futuro E-mini del Nasdaq 100

ES y NQ no tienen un libro de opciones propio. ES y SPX siguen el mismo índice, así que el libro de dealers detrás de un gráfico de ES *es* el libro del SPX: los niveles del SPX (o del NDX, para NQ) se proyectan sobre el eje de precios del futuro, mientras que la serie de precios procede del feed de CME. La proyección usa el carry teórico del contrato que cotizamos (tipos de interés menos la rentabilidad por dividendo del índice, durante el tiempo que queda hasta su vencimiento), así que no hay ningún ajuste de base que configurar, y en cada rollover trimestral los niveles pasan al nuevo contrato junto con el precio. Como el carry refleja el valor razonable, los niveles pueden quedar ligeramente desplazados cuando los futuros cotizan por encima o por debajo de él, por ejemplo de noche o en torno a noticias. Las exposiciones en dólares (GEX neto, de calls y de puts) se dejan deliberadamente sin proyectar: el histograma escala sobre la exposición *relativa*, así que la forma es la misma en ambos casos. Los micros (/MES, /MNQ) son el mismo contrato a una décima parte del tamaño, por lo que se aplican los mismos niveles.

Las acciones individuales están en la hoja de ruta, empezando por los Siete Magníficos (AAPL, MSFT, NVDA, AMZN, GOOGL, META y TSLA). Hasta que cada una esté disponible, el modelo de señales y el concepto de régimen se basan en el comportamiento de los dealers a nivel de índice, y esta página irá listando cada acción a medida que se incorpore.

## Horario de mercado

ZeroGEX utiliza en todo momento la hora del Este de EE. UU. (ET):

- **Pre-market** - 4:00 - 9:30 ET
- **Sesión regular** - 9:30 - 16:00 ET
- **After-hours** - 16:00 - 20:00 ET (donde esté disponible)

El indicador de sesión en la cabecera confirma en qué franja horaria te encuentras.

**ES y NQ funcionan en cambio con la sesión electrónica de CME**, mucho más amplia: desde el domingo a las 18:00 ET de forma continua hasta el viernes a las 17:00 ET, con una pausa diaria de mantenimiento de 17:00 a 18:00 ET. Eso cubre por completo las sesiones asiática y europea, y las cotizaciones de ES/NQ son de CME en tiempo real. Durante la noche - desde las 18:00 ET hasta la apertura de las 9:30, mientras cotizan los futuros - SPX y NDX muestran su futuro en lugar del índice de contado congelado: el indicador de sesión muestra "Futures" y el precio de la cabecera muestra el futuro, con la variación medida frente a su propio precio de las 16:00 ET.

Los niveles de dealers en un gráfico de futuros siguen procediendo del libro de opciones del índice, que cotiza durante el horario estadounidense. Así que de noche estás viendo cotizar en vivo el ES/NQ frente a los niveles tal como quedaron al cierre estadounidense, actualizados a medida que se publican los datos nocturnos de la cadena (véase *Pre-market y after-hours* más abajo); no se recalculan tick a tick a las 3:00 ET. Si una cotización de futuros se queda obsoleta, el precio lleva una etiqueta que indica el retraso medido.

## Cadencia de actualización por sección

| Sección | Cadencia |
| --- | --- |
| Cotización de precio | Aproximadamente cada segundo |
| Resumen GEX, walls, flip y max pain | Se recalculan aproximadamente una vez por minuto |
| Mapa de calor GEX por strike/DTE | Se recalcula aproximadamente una vez por minuto |
| Flujo de opciones | Barras de cinco minutos |
| Puntuaciones de señales | Aproximadamente una vez por minuto |
| Puntuación compuesta | Aproximadamente una vez por minuto |
| Medidores de volatilidad (VIX / VXN) | Barras de cinco minutos |
| Boletín en vivo | Precio cada 5 segundos; los niveles son las cifras de cada minuto indicadas arriba, recogidas en unos 10 segundos; volatilidad cada ~30 segundos |
| Datos de backtesting | Datos históricos por minuto, no en vivo |

No es necesario actualizar la página. Las páginas buscan cifras nuevas cada pocos segundos (cada 5 segundos en las páginas de señales), así que un valor nuevo aparece a los pocos segundos de calcularse.

Una nota sobre las secciones de GEX: "actualizar" significa que la exposición se **recalcula**, no que el interés abierto se vuelva a consultar tick a tick. El interés abierto de las opciones cotizadas lo contabiliza la cámara de compensación después de la sesión y se publica para el *siguiente* día de negociación - no se va formando en vivo durante el día. Por eso los cambios intradía del resumen GEX y del mapa de calor proceden de revalorar el libro existente a medida que se mueven el spot, el tiempo y la volatilidad implícita - no de nuevo interés abierto confirmado. Las estimaciones de la cobertura que generan las operaciones del día son una lectura aparte en la página [Hedging Flow](/help/platform/hedging-flow), *inferida* a partir de la clasificación de las operaciones y no de interés abierto confirmado.

## Pre-market y after-hours

Durante el horario extendido:

- La cabecera muestra el último cierre de la sesión regular y su variación, y en una segunda línea el precio en vivo del horario extendido y su movimiento desde ese cierre.
- Las puntuaciones de señales siguen actualizándose donde los datos son suficientes. Algunas señales (EOD Pressure, 0DTE Position Imbalance) se calculan intencionadamente solo durante la sesión regular.
- La superficie GEX refleja el estado del cierre de la sesión regular más las actualizaciones nocturnas de la cadena de opciones - incluido el interés abierto compensado de la siguiente sesión, en cuanto se publica.

## Cuando el mercado está cerrado

Cuando el mercado está cerrado, la plataforma muestra los valores de cierre de la última sesión regular en todas las secciones. El indicador de sesión muestra "Closed".

## Festivos

Festivos de mercado de día completo - sin datos en vivo; la plataforma muestra la sesión anterior.

Jornadas reducidas (cierre anticipado a la 1:00 PM ET en torno a algunos festivos) - la plataforma respeta el cierre anticipado. EOD Pressure mantiene su ventana habitual de 2:30 a 4:00 PM ET, así que permanece inactiva en una jornada reducida.

## Profundidad histórica

- **Resumen GEX** - call wall, put wall, gamma flip, GEX neto y max pain, una instantánea por minuto. Este historial no se recorta, así que crece una sesión cada día de mercado. Empieza el **29 de junio de 2026** para SPY, QQQ y SPX, y el **24 de julio de 2026** para NDX. ES y NQ se obtienen de los libros del SPX y del NDX, así que ES empieza con SPX y NQ con NDX.
- **Barras de precio por minuto** - se conservan del mismo modo, sin límite móvil.
- **Datos intradía detallados** - las instantáneas completas de la cadena de opciones, el GEX por strike y el flujo por contrato se conservan durante una ventana móvil de unos 60 días. Para fechas anteriores a esa ventana, los walls y el GEX neto son los valores registrados con cada instantánea del resumen, y el desglose del GEX entre calls y puts no está disponible.
- **Backtesting** - los precios de las opciones para las operaciones de una prueba proceden de un archivo aparte, que empieza el **20 de abril de 2026** para SPY y SPX, el **24 de abril de 2026** para QQQ y el **31 de julio de 2026** para NDX. Una prueba que use los niveles GEX solo llega hasta donde llega el resumen GEX. El rango de fechas de la página de Backtesting muestra exactamente lo que está disponible para una prueba.

## Fuentes de datos

ZeroGEX utiliza datos de mercado en tiempo real de opciones y subyacentes. Conviene ser preciso sobre lo que eso significa, porque no se trata de un único tape:

- **Las cotizaciones y operaciones de opciones** de SPY, QQQ, SPX y NDX se basan en OPRA, el tape consolidado de las opciones cotizadas en EE. UU.
- **Los valores de los índices SPX y NDX** proceden de un feed de índices independiente, no del tape de opciones.
- **Los precios de SPY y QQQ** proceden de un feed de acciones en tiempo real.
- Los precios de **ES y NQ** provienen del feed en tiempo real de CME.
- El **interés abierto** es una cifra separada de cierre de sesión procedente del clearing, no un valor en tiempo real.

Las griegas y todas las métricas de posicionamiento de dealers las calcula ZeroGEX a partir de esos insumos, en lugar de recibirlas ya hechas de un proveedor - ver [Metodología y validación](/methodology). No revelamos públicamente los nombres específicos de los proveedores.

## Latencia

Durante el horario regular, los precios suelen llegar a tu navegador pocos segundos después de imprimirse en el tape. Las cifras de posicionamiento de los dealers y las señales llegan con cierto retraso por diseño, porque se recalculan en los ciclos indicados arriba y no con cada operación. Si las actualizaciones parecen más lentas, consulta [Streaming y rendimiento](/help/platform/streaming-and-performance).

## Por qué primero el complejo de índices

Dos razones:

1. El modelo de posicionamiento de los dealers solo funciona bien donde el flow de los dealers representa una fracción significativa del flow total. Ese es el complejo de índices - SPY, SPX, QQQ, NDX y los futuros ES / NQ, que siguen esos mismos dos índices.
2. Preferimos acertar con un puñado de instrumentos antes que hacerlo a medias con diez.

Las acciones individuales pueden desviarse por noticias idiosincráticas, sobre todo en torno a los resultados trimestrales, lo que hace más ruidosa la lectura del GEX. Por eso se incorporan de pocas en pocas, empezando por los Siete Magníficos, donde el mercado de opciones es más profundo, en lugar de todas a la vez.

## Ver también

- [Acceso a la API y claves (Pro)](/help/platform/api-access)
- [Streaming y rendimiento](/help/platform/streaming-and-performance)
