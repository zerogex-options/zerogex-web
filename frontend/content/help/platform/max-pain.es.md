# Max Pain

*Cómo se calcula el max pain, cuándo actúa como imán y cuándo es pura coincidencia, y cómo leerlo junto al gamma profile.*

---

## Qué es el max pain

El max pain es el **strike al vencimiento** en el que el valor total en dólares de todas las opciones abiertas es mínimo — es decir, el nivel donde, en conjunto, los compradores de opciones "pierden más".

El argumento clásico es que los market makers (los vendedores naturales de opciones al retail) tienen incentivo para empujar el spot hacia el max pain. El argumento más honesto es más matizado — ver [Max Pain Explicado](/education/max-pain-explained).

## Qué muestra esta página

### El panel principal

El strike de max pain actual para el próximo vencimiento relevante, con la distancia respecto al spot.

### El selector de vencimiento

El max pain se calcula por vencimiento. El selector permite elegir 0DTE, los vencimientos de esta semana, de la próxima semana y el próximo mensual.

### El gráfico

En el eje x, el strike; en el eje y, la suma del payout de las opciones in-the-money (call + put). El punto mínimo de la curva es el max pain. El gráfico también muestra:

- El spot actual.
- El call wall y el put wall del perfil GEX.
- El gamma profile específico del vencimiento, debajo.

### La migración histórica

Un pequeño panel que muestra cómo se ha movido el max pain en las últimas sesiones para el vencimiento seleccionado — útil para detectar una deriva hacia (o alejándose de) el spot.

## Cuándo importa el max pain

El max pain es más fiable:

- **En las últimas 24–48 horas antes de un vencimiento significativo.** Antes de eso, la cadena está demasiado activa como para que el max pain sea estable.
- **Para 0DTE en SPX.** La cadena 0DTE tiene tamaño suficiente para que la presión de pinning sea real.
- **Cuando el imán gamma se alinea con el imán del max pain.** Cuando el strike de max pain coincide también con un strike de gamma elevada (un wall), la presión de pinning es real. Cuando no se alinean, es en su mayoría coincidencia.

## Cuándo no importa

- **En mercados con tendencia activa.** Los catalizadores macro anulan el comportamiento de pin.
- **En vencimientos pequeños o weeklies ilíquidos.** No hay suficiente open interest para generar presión de pinning.
- **Lejos del vencimiento.** El "tiempo hasta el vencimiento" es el factor determinante.

## Cómo leerlo junto al gamma

Dos lecturas:

1. **Max pain muy cerca de un wall** ⇒ pin estructural hacia el cierre. El wall es el nivel; el max pain es el cebo.
2. **Max pain lejos de los walls y del spot** ⇒ ignora el max pain. La presión estructural está en otro lugar.

## Ver también

- [Max Pain Explicado — ¿Funciona Realmente?](/education/max-pain-explained)
- [Posicionamiento de los Dealers](/help/platform/dealer-positioning)
- [Gamma Walls Explicados](/education/gamma-walls-explained)
