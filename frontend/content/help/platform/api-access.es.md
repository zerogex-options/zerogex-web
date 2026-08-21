# Acceso y claves de la API (Pro)

*Cómo leer la documentación de la API, qué desbloquea tu nivel Pro y el modelo básico de autenticación y límites de uso.*

---

## Qué te ofrece la API de ZeroGEX

Todo lo que la plataforma web te muestra se calcula desde el mismo backend que impulsa la API. Los suscriptores Pro obtienen acceso programático a:

- Resúmenes de GEX y desgloses por strike
- Cotizaciones en tiempo real
- Datos de flow (prima, volumen, buckets de smart money)
- Señales de trading (puntuaciones y estados de trigger)
- Barras históricas e historial de señales

## La documentación

La referencia completa está en **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. La documentación cumple con OpenAPI 3.0 y está disponible en dos vistas:

- **Swagger UI** — interactiva; prueba solicitudes desde el navegador
- **ReDoc** — solo lectura; más rápida para explorar toda la superficie de la API

La documentación requiere una cuenta Pro. Los usuarios públicos son redirigidos a la página de Pricing al hacer clic.

## Autenticación

La autenticación utiliza **tokens bearer**. Generas tu clave tú mismo desde tu cuenta — no hay nada que esperar:

1. Inicia sesión y ve a **Cuenta → Acceso API** (`/account#api-access`).
2. Haz clic en **Generar clave API** y copia la clave de la revelación única — se muestra una sola vez, durante unos minutos, y después no se puede recuperar. Guárdala en un gestor de contraseñas o un almacén de secretos.
3. Envíala como `Authorization: Bearer <key>` en cada solicitud.

Las claves API personales son una función Pro; las cuentas Basic y Public se redirigen a Precios. Generar una clave nueva revoca de inmediato la anterior (tienes como máximo una clave activa), así que rotar es simplemente volver a generarla. ¿Necesitas ayuda o revocar una clave? Escribe a [support@zerogex.io](mailto:support@zerogex.io).

## Límites de uso

La API impone límites de uso por clave. Los límites escalan según el nivel:

- **Pro** — topes generosos por minuto y por día, suficientes para dashboards de producción y bots que respetan una higiene de solicitudes normal.

Las solicitudes que superan el límite devuelven `429 Too Many Requests` con un encabezado `Retry-After`.

## Formato de respuesta

Todos los endpoints devuelven JSON. Campos estándar:

- `data` — el payload
- `meta` — paginación, marcas de tiempo, ID de solicitud
- `error` — presente en respuestas de error; omitido si hay éxito

Los campos numéricos están tipados con precisión — los valores de gamma son dólares con signo, las puntuaciones son floats en [-1, +1], las marcas de tiempo están en ISO 8601 UTC.

## Patrones comunes

### Polling vs. streaming

Para la mayoría de los casos de uso, el polling con una cadencia razonable (cada pocos segundos para métricas en vivo, cada minuto para datos históricos) es suficiente. El streaming no está actualmente disponible en la API pública; la plataforma web utiliza un canal interno.

### Caching

La mayoría de los endpoints establecen encabezados de caché HTTP sensatos — respétalos. Los endpoints de señales llevan la marca de tiempo de la puntuación más reciente para que puedas omitir respuestas idénticas.

### Backfill

Los endpoints históricos admiten ventanas de varios días. Para backfills profundos, pagina usando el campo `meta.cursor`.

## Qué está restringido

- El acceso a la API requiere una cuenta **Pro**. Las cuentas Basic y Public no pueden generar claves.
- Algunos endpoints tienen flags adicionales exclusivos de Pro (por ejemplo, volcados de cadena en bruto) — la documentación los señala.

## Buenas prácticas

- Una clave por entorno (dev, prod). Rótalas según un calendario.
- No pongas una clave en código del lado del cliente. La plataforma está diseñada para consumo desde el servidor.
- Configura un `User-Agent` adecuado — nos ayuda a ayudarte cuando una solicitud falla.

## Integraciones de gráficos

Si solo quieres nuestros niveles en tu propio gráfico, puede que no necesites programar nada:

- **NinjaTrader 8** — un indicador NinjaScript gratuito que consulta `GET /api/v1/levels/{symbol}` con tu clave Pro y dibuja el Gamma Flip, el Call Wall, el Put Wall, el Max Pain y el Pin Strike. Descárgalo desde cualquier página gratuita de niveles gamma (por ejemplo [/spx-gamma-levels](/spx-gamma-levels)), compílalo en el Editor NinjaScript y pega tu clave.
- **TradingView** — un script Pine gratuito. Solo entrada manual: Pine Script no puede hacer llamadas HTTP, así que los números de hoy los escribes tú.

## Ver también

- [Niveles, acceso y qué desbloquea cada uno](/help/platform/tiers-and-access)
- [Cobertura y actualización de datos](/help/platform/data-coverage)
- [Documentación de la API (externa)](https://api.zerogex.io/docs)
