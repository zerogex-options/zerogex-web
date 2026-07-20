# Smart Money

*La pantalla de smart-money — qué califica a una operación como smart-money, cómo se calcula el ratio C/P y cómo usar el bias intradía.*

---

## Qué significa "smart money" aquí

Smart money es una heurística — una etiqueta que aplicamos a operaciones con opciones que tienen la huella estructural de una apuesta informada:

- **Tamaño** — prima y tamaño del contrato significativamente por encima del promedio para ese strike/vencimiento.
- **Agresividad** — pagado al precio de oferta o por encima (compra), o ejecutado al bid (venta), no a precios mid.
- **Repetición** — múltiples impresiones agresivas en la misma dirección en una ventana de tiempo corta.
- **Prima de convicción** — la operación paga un porcentaje no trivial del valor del contrato.

Un solo bloque por sí solo no califica. Un patrón de operaciones de convicción en un strike sí.

## Qué muestra esta página

### El ratio C/P de smart-money

El ratio entre la prima call de smart-money y la prima put de smart-money. Una lectura muy por encima de 1 significa que el flujo smart-money está estructuralmente sesgado hacia las calls; muy por debajo indica puts. Esto **no** es lo mismo que el PCR (put/call ratio) principal — filtra solo las impresiones de alta convicción.

### El tape de smart-money

Un feed en vivo de operaciones etiquetadas como smart-money — tamaño, prima, strike, vencimiento, dirección, hora. Haz clic para ver la operación en contexto.

### El bias de smart-money

Un chip de bias combinado — alcista, bajista, neutral — construido a partir del ratio C/P más el flujo neto ponderado por prima dentro del subconjunto smart-money.

### El mapa de concentración por strike

Dónde se ha concentrado el flujo smart-money por strike, codificado por color según la dirección. Útil para detectar "hacia dónde se inclina el dinero grande".

## Cómo usarla

Tres patrones:

1. **Smart-money fuertemente largo en calls + composite positivo + gradiente GEX de apoyo** ⇒ la lectura estructural se alinea con el flujo smart-money. Direccional de alta convicción.
2. **Smart-money fuertemente largo en puts en el put wall** ⇒ defensa o fading. Combinado con una lectura de Positioning Trap, esto puede ser un counter-bias operable.
3. **Flujo smart-money neutral, flujo principal fuerte** ⇒ el flujo principal está impulsado por el retail; tratar con cautela.

## Qué no es

La etiqueta smart-money es una **heurística probabilística**. No toda impresión smart-money está informada; no toda operación informada queda marcada. La página es más útil a **nivel de bias** — ¿cuál es la inclinación acumulada? — más que como señal de trading sobre impresiones individuales.

## El panorama más amplio

El flujo smart-money es uno de varios inputs de la señal básica de Positioning Trap (que usa el desequilibrio smart-money con signo) y del Market Pressure Index (skew del flujo smart-money). La página de smart-money es la lectura independiente; las señales son las interpretaciones.

## Ver también

- [Análisis de flujo](/help/platform/flow-analysis)
- [Volumen neto vs. flujo direccional](/education/net-volume-vs-directional-flow)
- [Señal Positioning Trap explicada](/education/positioning-trap-explained)
