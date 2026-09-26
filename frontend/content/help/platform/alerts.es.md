# Alertas de señales

*Cómo aparecen los disparadores de señales dentro de la plataforma, qué se activa frente a qué permanece en silencio, y cómo revisar lo que se disparó.*

---

## Dónde aparecen las alertas

ZeroGEX muestra los disparadores de señales **dentro de la app**, no por correo electrónico, SMS ni notificación push. Aparecen en dos lugares:

1. **La tarjeta de señal** - en el Advanced Signal Dashboard (Pro), un disparador resalta la tarjeta con un borde, la tiñe en la dirección del score y cambia su estado de *Stand by* a *Triggered*.
2. **La Event Timeline** - en la pestaña Event Timelines del dashboard y al final de la página de cada señal: la trayectoria reciente del score, con los cambios de dirección marcados.

Los disparadores no llegan al Boletín en vivo - que es una tarjeta para compartir con el snapshot actual del gamma de los dealers - y no mueven el Composite Score.

Esto es intencional. ZeroGEX está diseñado para ser **observado, no interrumpido**. Las alertas al estilo push provocan overtrading; las vistas dentro de la app te permiten revisar cuando tú decidas.

## Qué se activa

Solo se activan las ocho señales Advanced, cada una cuando se cruza su umbral de disparo (ver la tabla más abajo).

Las señales Basic **no** se activan. Son lecturas continuas y orientativas, y no tienen peso en el Composite Score. Sus tarjetas se resaltan y se marcan como *Triggered* a partir de ±25, pero eso solo destaca una lectura fuerte.

Los cambios estructurales - el precio cruzando el gamma flip, una wall que se desplaza - tampoco son alertas. Esos se leen en el Gamma Chart y en las páginas de Métricas.

## Cómo se registra un disparador

Cuando un disparador se cruza:

1. El motor de señales marca la señal como disparada en el ciclo en que su score cruza el umbral.
2. La tarjeta en el Advanced Signal Dashboard pasa a *Triggered* y toma el color de la dirección. La página busca valores nuevos cada pocos segundos, así que no hace falta recargar.
3. El Composite Score no se ve afectado.

Una tarjeta sigue en *Triggered* mientras el score se mantenga más allá del umbral, y vuelve a *Stand by* cuando regresa por debajo. No existe una lista aparte de eventos de disparo - la Event Timeline es el registro.

## Referencia de umbrales de disparo

| Señal | Umbral |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Los scores van de -100 a +100. Consulta [Cómo leer la línea de puntuación de -100 a +100](/help/platform/score-line).

## Por qué algunas señales no se activan

Una señal puede mostrar un score considerable y no estar disparándose, o quedarse en 0 cuando esperas una lectura. Razones:

- Su disparador no depende solo del score: Market Pressure Index necesita además loading ≥ 50 y una dirección clara, y Range Break Imminence se dispara con imminence ≥ 65.
- Está condicionada a una ventana de sesión: EOD Pressure solo funciona de 14:30 a 16:00 ET y se fuerza a 0 fuera de ella, y 0DTE Position Imbalance muestra *Inactive* cuando su ventana está cerrada.

La tarjeta muestra su estado actual: *Triggered*, *Stand by* o *Inactive* con el motivo.

## Revisar lo que se disparó

No hay un registro de disparos. Para ver lo que hizo una señal mientras no estabas, abre la pestaña **Event Timelines** del Advanced Signal Dashboard, o la Event Timeline al final de la página de la señal. Traza el score de las dos últimas sesiones con los cambios de dirección marcados, junto a cuánto se movió el subyacente en los 30, 60 o 120 minutos siguientes, y puedes hacer zoom desde 30 minutos hasta el rango completo.

Para una revisión evaluada de una sesión completa, el scorecard público **Señales - un día** (bajo Comprobantes en la barra lateral) muestra qué señales cambiaron de dirección, cuántos de esos cambios pudieron evaluarse y cómo se resolvieron.

## Alertas salientes

Los disparadores de señales se muestran **solo dentro de la app** - en las tarjetas de señal y en las Event Timelines. No se envían por correo electrónico, SMS, notificación push ni webhook.

Los interruptores de canal en [Cuenta → Notificaciones](/account/notifications) pertenecen a **TradeWorkz™ Trading con bots** (Pro, beta), no a los disparadores de señales: cubren las notificaciones de entrada y salida de los bots que sigues. Dentro de la app (la campana en la página de Trading con bots) y por correo electrónico se entregan hoy; el canal de webhook guarda tu preferencia pero todavía no entrega nada, así que no construyas sobre él. Para automatizar con señales hoy, consulta la [API](/help/platform/api-access) (Pro) en lugar de esperar un push que no llegará.

La entrega saliente está en la lista, no entregada. Si cambiaría tu forma de operar, escribe a [support@zerogex.io](mailto:support@zerogex.io) indicando el canal y las señales que querrías - los detalles concretos la suben de prioridad.

## Ver también

- [Cómo funcionan las señales de extremo a extremo](/help/platform/signals-overview)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Preferencias de correo electrónico](/help/platform/email-preferences)
