# Cobertura de datos y actualización

*Símbolos admitidos, comportamiento en el horario de mercado, con qué frecuencia se actualiza cada sección y qué ocurre en torno a festivos y jornadas reducidas.*

---

## Símbolos cubiertos

ZeroGEX ofrece cobertura analítica completa para tres instrumentos:

- **SPY** — ETF del S&P 500
- **SPX** — Índice S&P 500 (opciones de estilo europeo)
- **QQQ** — ETF del Nasdaq 100

Estos son los tres subyacentes más líquidos y con mayor gamma del mercado de opciones de EE. UU. — los instrumentos donde la actividad de cobertura de los dealers tiene el mayor impacto en el precio intradía.

No tenemos previsto dar soporte a acciones individuales. El modelo de señales y el concepto de régimen están diseñados en torno al comportamiento de los dealers a nivel de índice.

## Horario de mercado

ZeroGEX utiliza en todo momento la hora del Este de EE. UU. (ET):

- **Pre-market** — 4:00 – 9:30 ET
- **Sesión regular** — 9:30 – 16:00 ET
- **After-hours** — 16:00 – 20:00 ET (donde esté disponible)

El indicador de sesión en la cabecera confirma en qué franja horaria te encuentras.

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

ZeroGEX utiliza **datos de opciones del feed OPRA** (el tape consolidado de opciones de EE. UU.) junto con el feed de cotización de la acción subyacente. Ambas son fuentes de datos profesionales y en tiempo real.

No revelamos públicamente los nombres específicos de los proveedores, pero el nivel de calidad es institucional — los mismos feeds de datos que utilizan las mesas cuantitativas.

## Latencia

La latencia de extremo a extremo desde que una operación se imprime en el tape hasta que llega a tu navegador suele ser inferior a un segundo durante el horario regular. El cuello de botella rara vez son los datos — normalmente es tu red y tu navegador. Consulta [Streaming y rendimiento](/help/platform/streaming-and-performance).

## Por qué solo SPY / SPX / QQQ

Dos razones:

1. El modelo de posicionamiento de los dealers solo funciona bien donde el flow de los dealers representa una fracción significativa del flow total. Ese es el complejo de índices.
2. Preferimos acertar con tres instrumentos antes que hacerlo a medias con diez.

Las acciones individuales pueden desviarse por noticias idiosincráticas que hacen más ruidosa la lectura del GEX. Ese no es nuestro juego.

## Ver también

- [Acceso a la API y claves (Pro)](/help/platform/api-access)
- [Streaming y rendimiento](/help/platform/streaming-and-performance)
