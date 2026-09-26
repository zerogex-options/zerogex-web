# Acceso y claves de la API (Pro)

*Cómo leer la documentación de la API, qué desbloquea tu nivel Pro y el modelo básico de autenticación y límites de uso.*

---

## Qué te ofrece la API de ZeroGEX

Todo lo que la plataforma web te muestra se calcula desde el mismo backend que impulsa la API. Los suscriptores Pro obtienen acceso programático a:

- Resúmenes de GEX y desgloses por strike (incluido el endpoint consolidado de niveles de dealers + perfil de gamma)
- Datos de flow (prima, volumen, buckets de smart money)
- Max pain y técnicos intradía (VWAP, rango de apertura, volumen, momentum)
- Señales de trading (puntuaciones y estados de trigger)
- Historial de GEX e historial de señales

## La documentación

La referencia completa está en **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. La documentación cumple con OpenAPI 3.1 y está disponible en dos vistas:

- **Swagger UI** - interactiva; haz clic en **Authorize**, pega tu clave y prueba solicitudes desde el navegador
- **ReDoc** - solo lectura; más rápida para explorar toda la superficie de la API

Para enviar solicitudes - desde la documentación o desde cualquier otro sitio - necesitas una clave Pro. En la app, el enlace **API Specs** lleva a las cuentas Public y Basic a la página de Pricing.

## Autenticación

La autenticación utiliza **tokens bearer**. Generas tu clave tú mismo desde tu cuenta - no hay nada que esperar:

1. Inicia sesión y ve a **Cuenta → API Access** (`/account#api-access`).
2. Haz clic en **Generate API Key** y copia la clave de la revelación única - se muestra una sola vez, durante unos minutos, y después no se puede recuperar. Guárdala en un gestor de contraseñas o un almacén de secretos.
3. Envíala como `Authorization: Bearer <key>` en cada solicitud.

Las claves API personales son una función Pro; las cuentas Basic y Public se redirigen a Precios. Generar una clave nueva revoca de inmediato la anterior (tienes como máximo una clave activa), así que rotar es simplemente volver a generarla. ¿Necesitas ayuda o revocar una clave? Escribe a [support@zerogex.io](mailto:support@zerogex.io).

## Límites de uso

La API limita las solicitudes por clave, en una ventana por minuto fijada muy por encima de lo que necesitan los dashboards de producción y los bots que respetan una higiene de solicitudes normal. Las solicitudes que superan el límite devuelven `429 Too Many Requests` con un encabezado `Retry-After`.

## Formato de respuesta

Todos los endpoints devuelven JSON, en dos versiones:

- **v1** (`/api/...` y `/api/v1/levels/...`) - el payload es el propio cuerpo de la respuesta.
- **v2** (`/api/v2/...`) - el mismo payload bajo `data`, más un bloque `freshness`: cuándo se observaron los datos subyacentes, la sesión de mercado, a partir de cuándo tratar la respuesta como desactualizada, y un `freshness_status` resumido (`fresh`, `aging`, `stale`, `session_closed`, ...). Recomendada para integraciones nuevas - sustituye el `/api` inicial (o `/api/v1`) por `/api/v2` y lee el payload de `data`.

Los errores devuelven el código HTTP correspondiente con un cuerpo `{"detail": ...}`, en ambas versiones.

Los campos numéricos están tipados con precisión - los valores de gamma son dólares con signo, las puntuaciones de cada señal (`clamped_score`) son floats en [-1, +1], las marcas de tiempo están en ISO 8601 UTC.

## Patrones comunes

### Polling vs. streaming

Para la mayoría de los casos de uso, el polling con una cadencia razonable (cada pocos segundos para métricas en vivo, cada minuto para datos históricos) es suficiente. El streaming no está actualmente disponible en la API pública; la plataforma web utiliza un canal interno.

### Caching

Las respuestas se guardan en caché en el servidor durante unos cinco segundos, y los análisis detrás de la mayoría de los endpoints se recalculan aproximadamente una vez por minuto, así que un polling más frecuente devuelve casi siempre el mismo cuerpo. Los endpoints de señales llevan la marca de tiempo de la puntuación más reciente para que puedas omitir respuestas idénticas.

### Backfill

Los endpoints de historial derivado - GEX (`/api/gex/historical`), max pain e historial de señales - admiten ventanas de varios días. Los datos de opciones son la excepción: las cotizaciones por contrato se sirven como la última cotización o como una sola sesión intradía (`/api/option/contract`), **no** como una serie histórica de varios días - y, de todos modos, las cotizaciones por contrato no forman parte del nivel estándar (consulta *Qué está restringido*). Si necesitas un historial más largo de cotizaciones de opciones, contacta con soporte con los detalles.

## Qué está restringido

- El acceso a la API requiere una cuenta **Pro**. Las cuentas Basic y Public no pueden generar claves.
- Los datos de mercado en bruto de origen - cotizaciones de contratos de opciones individuales (tanto la última cotización como el historial intradía del contrato) - no forman parte del nivel estándar de la API. La API sirve los análisis derivados (GEX, flow, max pain, técnicos, señales) y su historial. ¿Necesitas datos de opciones en bruto para un caso de uso concreto? Escribe a soporte y vemos las opciones.

## Buenas prácticas

- Tienes una sola clave activa, así que todos tus entornos (dev, prod) la comparten. Rótala según un calendario volviéndola a generar - la clave anterior deja de funcionar de inmediato, así que actualízala en todos los sitios donde la uses.
- No pongas una clave en código del lado del cliente. La plataforma está diseñada para consumo desde el servidor.
- Configura un `User-Agent` adecuado - nos ayuda a ayudarte cuando una solicitud falla.

## Integraciones de gráficos

Si solo quieres nuestros niveles en tu propio gráfico, puede que no necesites programar nada. Las cuatro están en la página de [Integraciones](/integrations):

- **NinjaTrader 8** - un indicador NinjaScript incluido con Pro que consulta `GET /api/v1/levels/{symbol}` con tu clave Pro y dibuja el Gamma Flip, el Call Wall, el Put Wall, el Max Pain y el Pin Strike. Con tu plan Pro, descárgalo desde cualquier página gratuita de niveles gamma (por ejemplo [/spx-gamma-levels](/spx-gamma-levels)), impórtalo en NinjaTrader (**File → Utilities → Import NinjaScript…**) y pega tu clave. En un gráfico de ES o NQ, pon el símbolo en `ES` o `NQ` y los niveles llegan ya en el eje de precios de los futuros - no hay que aplicar ningún ajuste de base.
- **Sierra Chart** - un estudio ACSIL incluido con Pro que consulta el mismo endpoint con tu clave y dibuja los mismos cinco niveles. Con tu plan Pro, descárgalo desde [/sierra-chart-indicator](/sierra-chart-indicator) y compílalo con el propio compilador de Sierra Chart (**Analysis → Build Custom Studies DLL**).
- **TradingView** - un script Pine gratuito. Solo entrada manual: Pine Script no puede hacer llamadas HTTP, así que los números de hoy los escribes tú.
- **thinkorswim** - un estudio thinkScript gratuito. Solo entrada manual: thinkScript está aislado igual que Pine Script, así que vuelves a copiar el estudio cada día - viene ya con los números del día.

Si tu plataforma no puede acceder a la red - o prefieres preguntar por los niveles en lugar de leerlos -, conecta un asistente de IA a nuestro [servidor MCP](/help/platform/mcp-server) gratuito (niveles con retraso, sin clave), o consulta [Crear un servidor MCP sobre la API de ZeroGEX](/help/platform/mcp-integration), que explica cómo conectar la API a un asistente.

## Ver también

- [Niveles, acceso y qué desbloquea cada uno](/help/platform/tiers-and-access)
- [Cobertura y actualización de datos](/help/platform/data-coverage)
- [El servidor MCP de ZeroGEX (gratis, sin clave)](/help/platform/mcp-server)
- [Crear un servidor MCP sobre la API de ZeroGEX](/help/platform/mcp-integration)
- [Documentación de la API (externa)](https://api.zerogex.io/docs)
