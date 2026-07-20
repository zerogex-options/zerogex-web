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

La autenticación utiliza **tokens bearer**. La generación de claves de autoservicio desde tu página de Cuenta está en camino; hasta que se lance, las claves se emiten manualmente:

1. Envía un correo a [support@zerogex.io](mailto:support@zerogex.io) desde la dirección de tu cuenta (solo cuentas Pro).
2. Te enviamos una clave y notas de configuración.
3. Inclúyela como `Authorization: Bearer <key>` en cada solicitud.

¿Necesitas rotar o revocar una clave? Escribe a soporte y lo resolveremos rápidamente.

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

## Ver también

- [Niveles, acceso y qué desbloquea cada uno](/help/platform/tiers-and-access)
- [Cobertura y actualización de datos](/help/platform/data-coverage)
- [Documentación de la API (externa)](https://api.zerogex.io/docs)
