# Alertas de señales

*Cómo aparecen los disparadores de señales dentro de la plataforma, qué se activa frente a qué permanece en silencio, y cómo usar el Live Bulletin como tu registro de alertas.*

---

## Dónde aparecen las alertas

ZeroGEX entrega las alertas **dentro de la app**, no por SMS ni notificación push. Hay tres lugares donde aparecen:

1. **Live Bulletin** — cada disparador llega aquí con el contexto completo. Este es tu registro de auditoría.
2. **La tarjeta de señal** — en el dashboard o en la página de lista de señales, un disparador ilumina la tarjeta y la tiñe en la dirección del score.
3. **El panel compuesto** — cuando un disparador tiene suficiente convicción, mueve visiblemente el compuesto.

Esto es intencional. ZeroGEX está diseñado para ser **observado, no interrumpido**. Las alertas al estilo push provocan overtrading; el registro dentro de la app te permite revisar cuando tú decidas.

## Qué se activa

Solo se activan los disparadores de señales Advanced y los eventos estructurales:

- Las ocho señales Advanced cuando se cruzan sus umbrales de disparo.
- Los cruces de gamma flip.
- Las transiciones de régimen (gamma positivo ↔ negativo en el spot).
- Las migraciones de wall superiores al 0,5% respecto al nivel anterior.
- Eventos de flow destacados (block prints, clústeres de sweep, movimientos de smart money).

Las señales Basic **no** se activan. Son inputs continuos para el compuesto.

## Cómo se registra un disparador

Cuando un disparador se cruza:

1. El score de la señal se registra en el momento del cruce.
2. Se crea la fila en el Live Bulletin con marca de tiempo, dirección, score, umbral y contexto.
3. La tarjeta de señal en cada página refleja el nuevo estado.
4. El compuesto se actualiza.

Si una señal permanece en estado de disparo durante varias barras, en el bulletin solo se registra el **primer** evento de disparo. Las barras posteriores se agregan a la entrada existente.

## Referencia de umbrales de disparo

| Señal | Umbral |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

## Por qué algunas señales no se activan

Una señal puede estar en +0.7 y **no** estar disparándose. Razones:

- El umbral de disparo de la señal usa un compuesto (Market Pressure también necesita loading ≥ 50).
- La señal está condicionada a una ventana de sesión (EOD Pressure solo está activa de 14:30 a 15:45 ET).
- La señal tiene un debounce — debe mantener el umbral durante un número mínimo de barras.

La tarjeta de señal en la página explicará el estado actual del disparador en lenguaje sencillo.

## Usar el bulletin como tu registro de alertas

El Live Bulletin es el **sistema de referencia** para los disparadores. Si fuiste a almorzar, no necesitas abrir cada página para ver qué se activó — abres el bulletin, filtras por símbolo y familia de señales, y lees los eventos del día en orden cronológico.

## Lo que vendrá

Actualmente no enviamos alertas por correo electrónico, SMS, notificación push ni webhook. Si la demanda lo justifica, esos canales podrán añadirse — escribe a [support@zerogex.io](mailto:support@zerogex.io) para votar.

## Ver también

- [Usar el Live Bulletin](/help/platform/live-bulletin)
- [Cómo funcionan las señales de extremo a extremo](/help/platform/signals-overview)
- [Preferencias de correo electrónico](/help/platform/email-preferences)
