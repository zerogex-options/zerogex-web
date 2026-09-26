# Max Pain

*Cómo se calcula el max pain, cuándo actúa como imán y cuándo es pura coincidencia, y cómo leerlo junto al gamma profile.*

---

## Qué es el max pain

El max pain es el **strike al vencimiento** en el que el valor total en dólares de todas las opciones abiertas es mínimo - es decir, el nivel donde, en conjunto, los compradores de opciones "pierden más".

Es geometría de pagos, no una prueba de manipulación: marca dónde expira sin valor la mayor parte de la prima de opciones, y por sí solo no mide el hedging de los dealers. La vieja historia de que los market makers (los vendedores naturales de opciones a los clientes) empujan activamente el spot hacia el max pain es mucho más matizada de lo que parece - ver [Max Pain Explicado](/education/max-pain-explained).

El max pain se calcula a partir del open interest, que se liquida y se publica por sesión en lugar de actualizarse tick a tick durante el día - así que trátalo como estructura de contexto, no como un objetivo predictivo en vivo.

## Qué muestra esta página

### El banner de régimen

**Max Pain Regime** resume dónde está el spot respecto al max pain: **Pin Risk Elevated** cuando el spot está a menos de un 0,4% de él; si no, **Upside Magnet** (max pain por encima del spot) o **Downside Magnet** (max pain por debajo), con una breve lectura debajo.

### Las tarjetas del snapshot

- **Current Max Pain (All Expirations)** - el max pain de toda la cadena: todos los vencimientos listados reunidos en una sola curva de pagos, recalculada una vez al día antes de la apertura. El chip de al lado es el movimiento implícito - max pain menos spot, en puntos y en porcentaje.
- **Nearest-Expiration Max Pain** - el max pain solo del vencimiento más cercano. Como cubre un único vencimiento, puede quedar a unos puntos de la cifra de toda la cadena.
- **Underlying Price** - el último precio.

### Notional Open Interest by Strike

El notional de calls y puts en cada strike para el vencimiento que elijas en el menú **Expiration**, con el max pain y el spot marcados. El max pain es por vencimiento, así que la línea discontinua del max pain se mueve con el menú. Las barras muestran dónde está el dinero; el max pain está donde las dos acumulaciones se equilibran.

### Max Pain vs Underlying Price

El max pain como línea sobre las velas del subyacente, con su propio menú de timeframe - útil para detectar una deriva hacia (o alejándose de) el spot. Espera escalones en lugar de una deriva suave: el max pain solo se mueve cuando el open interest se reescribe en la liquidación.

## Cuándo importa el max pain

El max pain es más fiable:

- **En las últimas 24-48 horas antes de un vencimiento significativo.** Antes de eso, la cadena está demasiado activa como para que el max pain sea estable.
- **Para 0DTE en SPX.** La cadena 0DTE es lo bastante grande como para que *puedan* aparecer efectos de pin - aunque el pinning es probabilístico, no mecánico.
- **Cuando el imán gamma se alinea con el imán del max pain.** Cuando el strike de max pain es también un strike de gamma elevada (un wall), un pin es *más probable*. Cuando no se alinean, el max pain es más probablemente una coincidencia - pero ninguna de las dos lecturas está garantizada.

## Cuándo no importa

- **En mercados con tendencia activa.** Los catalizadores macro anulan el comportamiento de pin.
- **En vencimientos pequeños o weeklies ilíquidos.** No hay suficiente open interest para generar presión de pinning.
- **Lejos del vencimiento.** El tiempo hasta el vencimiento es uno de los factores principales - al principio de la vida de un contrato, la cadena está demasiado activa para que el max pain se asiente.

## Cómo leerlo junto al gamma

Dos lecturas:

1. **Max pain muy cerca de un wall** ⇒ la presión de pin hacia el cierre es más probable. El wall es el nivel estructural; el max pain aporta contexto, no una garantía.
2. **Max pain lejos de los walls y del spot** ⇒ ignora el max pain. La presión estructural está en otro lugar.

## Ver también

- [Max Pain Explicado - ¿Funciona Realmente?](/education/max-pain-explained)
- [Posicionamiento de los Dealers](/help/platform/dealer-positioning)
- [Gamma Walls Explicados](/education/gamma-walls-explained)
