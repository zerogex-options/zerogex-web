# Usar el Live Bulletin

*El feed en tiempo real de eventos de señal, cambios de régimen y flujo destacado.*

---

## Qué es el Live Bulletin

El Live Bulletin es tu **línea de tiempo de la jornada de trading**. Cada vez que se dispara una señal, el régimen GEX cambia, un wall se desplaza una cantidad significativa, o aparece flujo de smart money en volumen relevante, se registra una entrada en el bulletin.

Piénsalo como la "vista de newsfeed" de todo lo que detecta ZeroGEX, clasificado por importancia y hora.

## Qué aparece en el bulletin

Hay cinco familias de elementos:

- **Signal triggers** — cuando una señal Advanced cruza su umbral de disparo.
- **Regime events** — cruce del gamma flip, transición de régimen (positivo ↔ negativo).
- **Wall events** — el call wall o el put wall se desplaza una cantidad significativa.
- **Flow notables** — picos de prima, rachas de smart money, bloques inusuales.
- **Schedule events** — apertura del mercado, apertura de la ventana de presión EOD, cierre.

## Cómo se puntúan y ordenan los elementos

Cada elemento tiene:

- Una **marca de tiempo** — cuándo ocurrió (y una etiqueta "fresh" para los elementos más recientes)
- Un **direction chip** — bullish, bearish o neutral
- Un **conviction score** — cuán fuerte fue la señal/evento

Por defecto, los elementos se ordenan cronológicamente de arriba hacia abajo. Puedes cambiar al orden por importancia usando el menú desplegable de ordenación.

## Leer un elemento

Cada fila tiene:

1. **Title** — el nombre del evento ("EOD Pressure fired", "Trap Detection bearish", "Gamma flip crossed").
2. **Subtitle** — el contexto clave (símbolo, puntuación, nivel).
3. **Time** — relativo ("4m ago") y absoluto al pasar el cursor.
4. **Action** — haz clic en "Open" para ir directamente a la página de la señal o métrica correspondiente.

En el caso de los triggers, las filas también muestran la **puntuación que disparó el evento** y el **umbral de disparo**, para que puedas ver si fue un evento límite o uno contundente.

## Filtrado

La barra de filtros te permite acotar el feed por:

- **Symbol** — SPY, SPX, QQQ (por defecto, el símbolo que tienes activo)
- **Signal family** — Advanced, Basic, Regime, Flow, Schedule
- **Direction** — bullish, bearish, neutral
- **Time window** — última hora, hoy, últimas 24h, últimos 5 días de negociación

Los filtros se combinan entre sí. Puedes apilar symbol = SPX con signal family = Advanced y direction = bearish para mostrar solo los triggers Advanced bearish en SPX.

## Cuándo el bulletin es más útil

- **Por la mañana** — desplázate hacia atrás por las últimas sesiones para ver qué se disparó durante la noche y en el pre-market.
- **Cerca de niveles clave** — cuando el precio se acerca al gamma flip, al call wall o al put wall, es de esperar que aparezcan nuevos eventos.
- **En la última hora** — la señal EOD Pressure a menudo ofrece lecturas accionables a partir de las 14:30 ET.
- **Como herramienta de journaling** — cada señal disparada queda registrada, por lo que el bulletin es el registro de auditoría de cómo transcurrió tu jornada.

## Qué no es

El Live Bulletin **no es un feed de señales de trading**. Los elementos son eventos que merecen tu atención; que se traduzcan en operaciones depende de tu estrategia. El panel Composite Score es lo más parecido a una lectura de "qué significa esto para la dirección", y aun así es un filtro, no una predicción.

## Visibilidad por nivel

- El nivel Basic ve eventos de señal Basic, eventos de régimen, eventos de wall y flow notables.
- El nivel Pro además ve los triggers de señal Advanced.

Los elementos bloqueados (para las indicaciones de actualización de nivel) muestran un chip de candado en lugar de desaparecer.

## El espejo de administración

Existe una versión del bulletin sin marca de agua para uso administrativo, empleada para capturas de pantalla y demostraciones. Se trata de una ruta exclusivamente interna.

## Ver también

- [Cómo funcionan las señales de principio a fin](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signal Alerts](/help/platform/alerts)
