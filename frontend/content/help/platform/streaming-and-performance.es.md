# Streaming y rendimiento

*Cómo llegan las actualizaciones en tiempo real a tu navegador, qué hacer si una página se siente desactualizada, y las soluciones más simples para una conexión lenta.*

---

## Cómo funcionan las actualizaciones en vivo

Cada página se mantiene al día por sí sola - no hay nada que recargar. El precio de la cabecera se actualiza aproximadamente cada segundo, y cada panel obtiene cifras nuevas con su propio temporizador corto, cada pocos segundos en la mayoría de los casos. Los datos empiezan a llegar en cuanto se carga la página.

Si una solicitud falla, la página sigue mostrando los últimos valores válidos y vuelve a intentarlo en el siguiente ciclo. Las páginas de Puntuación compuesta y Trade Bias muestran además un indicador en vivo, con un aviso "Reconnecting…" si dejan de llegar actualizaciones.

## Qué significa realmente "en vivo"

Las páginas buscan cifras nuevas cada pocos segundos, pero cada cifra cambia solo con la frecuencia con la que se calcula:

| Elemento | Con qué frecuencia cambia |
| --- | --- |
| Cotización de precio | Aproximadamente cada segundo |
| Posicionamiento de los dealers (GEX, walls, flip, max pain) | Se recalcula aproximadamente una vez por minuto |
| Puntuaciones de señales y Puntuación compuesta | Aproximadamente una vez por minuto; las páginas de señales consultan cada 5 segundos |
| Flujo de opciones | Barras de cinco minutos |
| Medidores de volatilidad (VIX / VXN) | Barras de cinco minutos |

Cuando la página está en una pestaña en segundo plano, el navegador puede limitar las actualizaciones. Trae la pestaña al primer plano y las actualizaciones se reanudan de inmediato.

## Cuando una página se siente desactualizada

Las causas más comunes, en orden de frecuencia:

1. **La pestaña estuvo en segundo plano durante horas.** Es posible que las actualizaciones se hayan detenido. Recarga la página.
2. **Tienes una conexión lenta.** Las solicitudes se acumulan; el dato más reciente prevalece, pero las actualizaciones se sienten lentas. Cambia de red o cierra otras pestañas pesadas.
3. **Un bloqueador de anuncios o una extensión está interfiriendo.** Algunos bloqueadores demasiado agresivos bloquean las solicitudes en segundo plano que traen datos nuevos. Prueba en una ventana privada con las extensiones desactivadas.
4. **El mercado está cerrado.** El badge de sesión lo indica. Se muestran los últimos valores calculados.

## Qué revisar primero

Cuando algo parece no funcionar, el diagnóstico en tres pasos:

1. Mira el **badge de sesión** - ¿está abierto el mercado?
2. Pasa el cursor sobre el **precio de la cabecera** - ¿su hora "as of" es reciente?
3. Recarga forzando la caché (Cmd+Shift+R o Ctrl+Shift+R).

Eso cubre la mayoría de las situaciones en las que "algo parece roto".

## Consejos de rendimiento

### Usa un navegador reciente

ZeroGEX está diseñado para las versiones actuales de Chrome, Edge, Firefox y Safari. Si algo falla en un navegador antiguo, actualízalo primero.

### Cierra otras pestañas pesadas

El panel actualiza varios gráficos en vivo. Si tienes una pestaña de YouTube reproduciendo y tres ventanas de TradingView abiertas, el navegador tiene que repartir la CPU entre todas. Cierra lo que no necesites.

### Desactiva las extensiones innecesarias

Las extensiones de privacidad y bloqueo de anuncios suelen estar bien. Los bloqueadores de scripts agresivos (NoScript con configuraciones predeterminadas restrictivas) necesitan que los dominios de ZeroGEX estén en la lista blanca.

### Cambiar de símbolo es más pesado que cambiar de marco temporal

Cambiar de símbolo vuelve a cargar los datos de todos los paneles de la página; cambiar el marco temporal de un gráfico solo vuelve a cargar ese gráfico.

## Móvil

ZeroGEX funciona en teléfonos - cada página es responsive - pero la plataforma está **diseñada para escritorio**. La densidad de los gráficos asume una pantalla más ancha de 1024px. En el móvil, los gráficos se ajustan a la pantalla y muestran menos etiquetas; todos los datos están ahí, solo que el diseño es más denso. Desliza hacia arriba o hacia abajo para desplazar la página - los gráficos solo responden al arrastre lateral.

## Cuándo escribir a soporte

Si la propia plataforma parece atascada (no tu conexión, no una pestaña desactualizada) y las recargas forzadas no lo solucionan, escribe a [support@zerogex.io](mailto:support@zerogex.io) con:

- La página en la que estabas
- La hora en que ocurrió (con zona horaria)
- Tu navegador y sistema operativo

Nuestros registros llevan marca de tiempo - eso es suficiente para rastrear el problema.

## Ver también

- [Solución de problemas](/help/platform/troubleshooting)
- [Cobertura de datos y actualización](/help/platform/data-coverage)
