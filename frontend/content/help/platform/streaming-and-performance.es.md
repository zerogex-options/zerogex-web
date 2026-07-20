# Streaming y rendimiento

*Cómo llegan las actualizaciones en tiempo real a tu navegador, qué hacer si una página se siente desactualizada, y las soluciones más simples para una conexión lenta.*

---

## Cómo funciona el streaming

ZeroGEX envía datos en vivo a tu navegador mediante una conexión persistente — abre el panel y los datos empiezan a fluir en menos de un segundo tras cargar la página. No hay polling del lado del cliente.

La conexión se renueva automáticamente si se interrumpe. Si una renovación falla repetidamente, la interfaz muestra una etiqueta de "Reconectando…" y comienza un nuevo intento con backoff.

## Qué significa realmente "en vivo"

| Elemento | Frecuencia de actualización |
| --- | --- |
| Cotización de precio | ~1 segundo |
| Flow / tape | ~1 segundo |
| Puntuaciones de señales | 1–5 segundos según la señal |
| Superficie GEX | 5–15 segundos (cuello de botella: snapshot de la chain) |
| Composite Score | ~5 segundos |

Cuando la página está en una pestaña en segundo plano, el navegador puede limitar las actualizaciones. Trae la pestaña al primer plano y las actualizaciones se reanudan de inmediato.

## Cuando una página se siente desactualizada

Las causas más comunes, en orden de frecuencia:

1. **La pestaña estuvo en segundo plano durante horas.** Es posible que la conexión se haya interrumpido. Recarga la página.
2. **Tienes una conexión lenta.** Los mensajes de WebSocket se acumulan; el dato más reciente prevalece, pero las actualizaciones se sienten lentas. Cambia de red o cierra otras pestañas pesadas.
3. **Un bloqueador de anuncios o una extensión está interfiriendo.** Algunos bloqueadores demasiado agresivos descartan los frames de WebSocket. Prueba en una ventana privada con las extensiones desactivadas.
4. **El mercado está cerrado.** El badge de sesión lo indica. Se muestran los últimos valores calculados.

## Qué revisar primero

Cuando algo parece no funcionar, el diagnóstico en cuatro pasos:

1. Mira el **badge de sesión** — ¿está abierto el mercado?
2. Mira el **tile de precio** — ¿la marca de tiempo es reciente?
3. Mira el **indicador de conexión** en el encabezado — ¿está en verde?
4. Recarga forzando la caché (Cmd+Shift+R o Ctrl+Shift+R).

Eso cubre alrededor del 95 % de las situaciones en las que "algo parece roto".

## Consejos de rendimiento

### Usa un navegador reciente

ZeroGEX está diseñado para las versiones evergreen de Chrome, Edge, Firefox y Safari (Tech Preview). Las versiones más antiguas de navegador funcionarán técnicamente, pero no tendrán las optimizaciones de rendimiento.

### Cierra otras pestañas pesadas

El panel transmite varios gráficos en vivo. Si tienes una pestaña de YouTube reproduciendo y tres ventanas de TradingView abiertas, el navegador tiene que repartir la CPU entre todas. Cierra lo que no necesites.

### Desactiva las extensiones innecesarias

Las extensiones de privacidad y bloqueo de anuncios suelen estar bien. Los bloqueadores de scripts agresivos (NoScript con configuraciones predeterminadas restrictivas) necesitan que los dominios de ZeroGEX estén en la lista blanca.

### El modo claro es ligeramente más rápido

El tema claro se renderiza un poco más rápido que el tema oscuro en la mayoría de configuraciones, debido a cómo se componen las sombras y los tintes. Es una diferencia marginal, pero vale la pena saberlo si usas un dispositivo de baja potencia.

### Cambiar de símbolo es más pesado que cambiar de marco temporal

Cambiar de símbolo vuelve a obtener todos los datos; cambiar de marco temporal reutiliza el stream subyacente. Si te mueves rápido, prefiere el selector de marco temporal.

## Móvil

ZeroGEX funciona en teléfonos — cada página es responsive — pero la plataforma está **diseñada para escritorio**. La densidad de los gráficos asume una pantalla más ancha de 1024px. En móvil, desplázate horizontalmente sobre los gráficos; todos los datos están ahí, solo que el diseño es más denso.

## Cuándo escribir a soporte

Si la propia plataforma parece atascada (no tu conexión, no una pestaña desactualizada), revisa el indicador de conexión en la esquina inferior derecha. Si se mantiene en rojo después de varias recargas forzadas, escribe a [support@zerogex.io](mailto:support@zerogex.io) con:

- La página en la que estabas
- La hora en que ocurrió (con zona horaria)
- Tu navegador y sistema operativo

Nuestros registros llevan marca de tiempo — eso es suficiente para rastrear el problema.

## Ver también

- [Solución de problemas](/help/platform/troubleshooting)
- [Cobertura de datos y actualización](/help/platform/data-coverage)
