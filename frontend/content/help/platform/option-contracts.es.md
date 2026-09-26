# Cotizaciones de Opciones en Vivo

*Sigue un contrato de opciones durante toda la sesión. Cómo elegir el contrato, cómo leer las barras de volumen en bid/mid/ask y las cifras sobre el gráfico.*

---

## Qué muestra esta página

La página de Cotizaciones de Opciones en Vivo sigue **un contrato de opciones** del símbolo activo a lo largo de la sesión: el precio de la última operación y el volumen de cada minuto, dividido según dónde se negoció - en el ask, en el mid o en el bid. Se actualiza cada 30 segundos.

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

- **Barras** (eje izquierdo) - volumen por minuto, apilado según dónde se negoció: **Ask Vol**, **Mid Vol** y **Bid Vol**.
- **Línea** (eje derecho) - el precio de la última operación (**Last**).

El eje de tiempo abarca la sesión, de 9:30 a 16:15 ET. Antes de que abra la sesión de hoy, la página muestra la más reciente. En el móvil las barras se agrupan en bloques de 5 minutos para que sigan siendo legibles.

Pasa el cursor sobre una barra para ver la hora, el último precio y cuántos contratos se negociaron en el bid, el mid y el ask.

## Cómo leerlo

Tres patrones:

1. **¿Quién cruza el spread?** El volumen del lado ask son operaciones ejecutadas en el ask o cerca de él - compradores que pagan el ask para conseguir la ejecución. El volumen del lado bid son vendedores que venden al bid. El volumen mid son las operaciones intermedias.
2. **¿Lo confirma el precio?** Volumen del lado ask con la línea Last subiendo indica que los compradores controlan este contrato. Mucho volumen del lado ask mientras el precio no avanza merece una mirada más atenta.
3. **¿Qué peso tiene hoy frente al OI?** Cuando Vol es grande en relación con el OI, la negociación de hoy es grande frente a las posiciones ya abiertas - puede estar formándose un posicionamiento nuevo.

## ES y NQ

ES y NQ no tienen cadena de opciones propia - sus niveles se derivan de las opciones de SPX y NDX. Esta página no está disponible para ellos; cambia a SPX o NDX.

## Nota sobre el plan

Las Cotizaciones de Opciones en Vivo están disponibles para Basic y Pro.

## Ver también

- [Strategy Builder](/help/platform/options-calculator)
- [Posicionamiento de Dealers](/help/platform/dealer-positioning)
- [Análisis de Flujo](/help/platform/flow-analysis)
