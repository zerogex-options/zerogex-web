# Cotizaciones de Opciones en Vivo

*Sigue un contrato de opciones durante toda la sesión. Cómo elegir el contrato, cómo leer las barras de volumen comprado y vendido y las cifras sobre el gráfico.*

---

## Qué muestra esta página

La página de Cotizaciones de Opciones en Vivo sigue **un contrato de opciones** del símbolo activo a lo largo de la sesión: el precio de la última operación y el volumen de cada minuto, dividido por lado - comprado, vendido o sin indicio de lado. Se actualiza cada 30 segundos.

## Elegir un contrato

Tres menús sobre el gráfico eligen el contrato:

- **Expiration** - los vencimientos que cotizan en esta sesión, de hoy en adelante. Por defecto el de hoy (0DTE) si existe; si no, el más próximo.
- **Strike** - por defecto el strike más cercano al precio en vivo.
- **Type** - **Call** o **Put**. Por defecto Call.

El nombre del contrato aparece bajo los menús - p. ej. `SPY 600 C 10/02/2026` - junto con sus días hasta el vencimiento.

## Las cifras sobre el gráfico

Para la sesión mostrada:

- **Vol** - contratos negociados hasta ahora.
- **OI** - open interest.
- **Avg** - el precio medio de las operaciones, ponderado por volumen.
- **Prem** - prima negociada: Vol × Avg × 100.
- **IV**, **Δ** (delta) y **Θ** (theta) - de la cotización más reciente.

## El gráfico

- **Barras** (eje izquierdo) - volumen por minuto, apilado por lado: **Bought** (comprado), **No side** (sin lado) y **Sold** (vendido).
- **Línea** (eje derecho) - el precio de la última operación (**Last**).

El lado sale del **tick test**, que compara el precio de cada operación con el de la operación anterior del mismo contrato, no con el bid y el ask. Un precio más alto cuenta como comprado, uno más bajo como vendido, y un precio sin cambio toma el lado del último cambio de precio. **No side** es el volumen al que el test no puede asignar un lado: una operación sin otra anterior con la que compararla, un precio sin cambio antes de que algún cambio de precio haya fijado un lado, y todo lo del minuto de apertura de las 9:30.

El eje de tiempo abarca la sesión, de 9:30 a 16:15 ET. Antes de que abra la sesión de hoy, la página muestra la más reciente. En el móvil las barras se agrupan en bloques de 5 minutos para que sigan siendo legibles.

Pasa el cursor sobre una barra para ver la hora, el último precio y cuántos de sus contratos contaron como vendidos, comprados o sin lado.

## Cómo leerlo

Tres patrones:

1. **¿Quién mueve el precio?** El volumen comprado son compradores que pagan más para conseguir la ejecución: operaciones que subieron el precio o lo mantuvieron después de una subida. El volumen vendido son vendedores que aceptan menos: operaciones que lo bajaron o lo mantuvieron después de una bajada. El volumen sin lado son operaciones a las que el test no pudo asignar un lado.
2. **¿Cuánto volumen hay detrás del movimiento?** El lado sale de los propios cambios de precio de este contrato, así que el volumen comprado y una línea Last al alza suelen ir juntos; que coincidan no es una segunda lectura independiente. Lo que añaden las barras es cuántos contratos se negociaron en cada movimiento: una subida con un puñado de contratos dice menos que una con mucho volumen comprado detrás.
3. **¿Qué peso tiene hoy frente al OI?** Cuando Vol es grande en relación con el OI, la negociación de hoy es grande frente a las posiciones ya abiertas - puede estar formándose un posicionamiento nuevo.

## ES y NQ

ES y NQ no tienen cadena de opciones propia - sus niveles se derivan de las opciones de SPX y NDX. Esta página no está disponible para ellos; cambia a SPX o NDX.

## Nota sobre el plan

Las Cotizaciones de Opciones en Vivo están disponibles para Basic y Pro.

## Ver también

- [Strategy Builder](/help/platform/options-calculator)
- [Posicionamiento de Dealers](/help/platform/dealer-positioning)
- [Análisis de Flujo](/help/platform/flow-analysis)
