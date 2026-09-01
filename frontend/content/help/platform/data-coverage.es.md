# Cobertura de datos y actualización

*Símbolos admitidos, comportamiento en el horario de mercado, con qué frecuencia se actualiza cada sección y qué ocurre en torno a festivos y jornadas reducidas.*

---

## Símbolos cubiertos

ZeroGEX ofrece cobertura analítica completa para cuatro subyacentes de contado:

- **SPY** — ETF del S&P 500
- **SPX** — Índice S&P 500 (opciones de estilo europeo)
- **QQQ** — ETF del Nasdaq 100
- **NDX** — Índice Nasdaq 100 (opciones de estilo europeo)

Estos son los cuatro subyacentes más líquidos y con mayor gamma del mercado de opciones de EE. UU. — los instrumentos donde la actividad de cobertura de los dealers tiene el mayor impacto en el precio intradía.

A ellos se suman dos futuros sobre índices de CME, como símbolos de pleno derecho:

- **ES** — futuro E-mini del S&P 500
- **NQ** — futuro E-mini del Nasdaq 100

ES y NQ no tienen un libro de opciones propio. ES y SPX siguen el mismo índice, así que el libro de dealers detrás de un gráfico de ES *es* el libro del SPX: los niveles del SPX (o del NDX, para NQ) se proyectan sobre el eje de precios del futuro, mientras que la serie de precios procede del feed de CME. La razón de proyección se mide sobre la cinta en lugar de modelarse a partir del carry, de modo que se autocorrige en cada rollover trimestral y no hay ningún ajuste de base que configurar. Las exposiciones en dólares (GEX neto, de calls y de puts) se dejan deliberadamente sin proyectar: el histograma escala sobre la exposición *relativa*, así que la forma es la misma en ambos casos. Los micros (/MES, /MNQ) son el mismo contrato a una décima parte del tamaño, por lo que se aplican los mismos niveles.

No tenemos previsto dar soporte a acciones individuales. El modelo de señales y el concepto de régimen están diseñados en torno al comportamiento de los dealers a nivel de índice.

## Horario de mercado

ZeroGEX utiliza en todo momento la hora del Este de EE. UU. (ET):

- **Pre-market** — 4:00 – 9:30 ET
- **Sesión regular** — 9:30 – 16:00 ET
- **After-hours** — 16:00 – 20:00 ET (donde esté disponible)

El indicador de sesión en la cabecera confirma en qué franja horaria te encuentras.

**ES y NQ funcionan en cambio con la sesión electrónica de CME**, mucho más amplia: desde el domingo a las 18:00 ET de forma continua hasta el viernes a las 17:00 ET, con una pausa diaria de mantenimiento de 17:00 a 18:00 ET. Eso cubre por completo las sesiones asiática y europea, y las cotizaciones de ES/NQ son de CME en tiempo real. Cuando un índice de contado está cerrado pero su futuro cotiza, el indicador de sesión muestra «Futuros» y la ficha de precio muestra el futuro — con la variación medida frente a su propio cierre de las 16:00 ET — en lugar del índice de contado congelado.

Los niveles de dealers en un gráfico de futuros siguen procediendo del libro de opciones del índice, que cotiza durante el horario estadounidense. Así que de noche estás viendo cotizar en vivo el ES/NQ frente a los niveles tal como quedaron al cierre estadounidense, actualizados a medida que se publican los datos nocturnos de la cadena (véase *Pre-market y after-hours* más abajo); no se recalculan tick a tick a las 3:00 ET. Si una cotización de futuros se queda obsoleta, el precio lleva una etiqueta que indica el retraso medido.

## Cadencia de actualización por sección

| Sección | Cadencia |
| --- | --- |
| Cotización de precio | 1 segundo |
| Resumen GEX | 5–15 segundos |
| Mapa de calor GEX por strike/DTE | 5–15 segundos |
| Flow / tape | 1 segundo |
| Puntuaciones de señales | 1–5 segundos según la señal |
| Composite Score | 5 segundos |
| Live Bulletin | basado en eventos, en tiempo real |
| Datos de backtesting | instantánea EOD (fin de jornada) |

No es necesario actualizar la página. Todo se transmite en streaming.

## Pre-market y after-hours

Durante el horario extendido:

- El panel de precio muestra la cotización del horario extendido junto con el cierre de la sesión regular anterior.
- Las puntuaciones de señales siguen actualizándose donde los datos son suficientes. Algunas señales (EOD Pressure, 0DTE Position Imbalance) se calculan intencionadamente solo durante la sesión regular.
- La superficie GEX refleja el estado del cierre de la sesión regular más las actualizaciones nocturnas de la cadena de opciones.

## Cuando el mercado está cerrado

Cuando el mercado está cerrado, la plataforma muestra los valores de cierre de la última sesión regular en todas las secciones. El indicador de sesión muestra "Closed". Las páginas de señales muestran marcas de tiempo de "último cálculo".

## Festivos

Festivos de mercado de día completo (con la excepción de la víspera de fin de año) — sin datos en vivo; la plataforma muestra la sesión anterior.

Jornadas reducidas (cierre anticipado a la 1:00 PM ET algunos viernes cercanos a festivos) — la plataforma respeta el cierre anticipado. La ventana de EOD Pressure se ajusta a una rampa desde las 11:30 AM ET en las jornadas reducidas.

## Profundidad histórica

- **Cotizaciones y flow** — varios años de barras históricas.
- **Puntuaciones de señales** — reconstruidas retroactivamente hasta el origen de cada señal.
- **Superficies GEX** — historial de instantáneas diarias; el historial intradía está limitado a la ventana reciente.

La página de Backtesting muestra el horizonte histórico disponible para la señal que selecciones.

## Fuentes de datos

ZeroGEX utiliza datos de mercado profesionales en tiempo real de opciones y subyacentes, bajo licencias comerciales. No se trata de un único tape: las **opciones sobre SPY y QQQ** se difunden por OPRA (el tape consolidado de opciones de EE. UU.), mientras que **SPX, SPXW y NDX** son opciones sobre índices, cuyos entitlements se licencian por separado a través de la bolsa de cotización y *no* circulan por el tape de OPRA. Los precios de ES y NQ provienen del feed en tiempo real de CME. El interés abierto es una cifra separada de cierre de sesión procedente del clearing, no un valor en tiempo real. Las griegas y todas las métricas de posicionamiento de dealers las calcula ZeroGEX a partir de esos insumos — ver [Metodología y validación](/methodology).

No revelamos públicamente los nombres específicos de los proveedores, pero el nivel de calidad es institucional — los mismos feeds de datos que utilizan las mesas cuantitativas.

## Latencia

La latencia de extremo a extremo desde que una operación se imprime en el tape hasta que llega a tu navegador suele ser inferior a un segundo durante el horario regular. El cuello de botella rara vez son los datos — normalmente es tu red y tu navegador. Consulta [Streaming y rendimiento](/help/platform/streaming-and-performance).

## Por qué solo el complejo de índices

Dos razones:

1. El modelo de posicionamiento de los dealers solo funciona bien donde el flow de los dealers representa una fracción significativa del flow total. Ese es el complejo de índices — SPY, SPX, QQQ, NDX y los futuros ES / NQ, que siguen esos mismos dos índices.
2. Preferimos acertar con un puñado de instrumentos antes que hacerlo a medias con diez.

Las acciones individuales pueden desviarse por noticias idiosincráticas que hacen más ruidosa la lectura del GEX. Ese no es nuestro juego.

## Ver también

- [Acceso a la API y claves (Pro)](/help/platform/api-access)
- [Streaming y rendimiento](/help/platform/streaming-and-performance)
