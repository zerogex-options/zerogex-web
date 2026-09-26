# Análisis de flujo

*Flujo ponderado por prima y por volumen neto, la separación de agresores Lee-Ready, y cómo detectar la convicción real en el tape.*

---

## Qué muestra esta página

La página de Flow Analysis es la **vista del tape** del mercado de opciones. Mientras que Dealer Positioning muestra el libro estático, esta página muestra el **flujo** - lo que se negoció hoy y qué lado cruzó el spread para negociarlo.

Dos menús del encabezado se aplican a toda la página: **Session** (la sesión actual o la anterior, para ver si hoy es inusual en algo) y **Volume basis** (**Directional** o **Total Traded** - ver más abajo).

## Los tres enfoques del flujo

ZeroGEX muestra el flujo a través de tres enfoques, porque cada uno importa de forma distinta.

### Volumen neto de contratos

Simplemente cuenta contratos. Útil como referencia de ruido de fondo. Poco útil por sí solo como lectura de convicción - mil contratos de $0,05 y un contrato de $500 cuentan igual. La base **Total Traded** cuenta cada contrato que cambió de manos, así que solo puede subir.

### Flujo ponderado por prima

Multiplica el volumen de contratos por la prima pagada. **Esta es la lectura de convicción.** Un trader que paga $500 por contrato en una call OTM 0DTE está haciendo una apuesta real; un trader que hace scalping con tickets de lotería de $0,05 no.

### Flujo direccional (separación de agresores Lee-Ready)

Clasifica cada operación como iniciada por el comprador o por el vendedor usando el algoritmo Lee-Ready (de qué lado del bid/ask se ejecutó la operación); los prints demasiado cerca del punto medio para asignarlos a un lado quedan sin signo. Suma las operaciones iniciadas por el comprador menos las iniciadas por el vendedor. Indica si los agresores están pagando por el alza o por la baja. La base **Directional** asigna signo al volumen de esta forma, así que puede quedar por debajo de cero.

## El banner de régimen

**Flow Analysis Regime** etiqueta la sesión hasta el momento: **Risk-On Flow Regime** cuando la prima neta y el flujo neto se inclinan ambos hacia las calls, **Risk-Off Flow Regime** cuando ambos se inclinan hacia las puts, y **Mixed / Two-Way Flow** cuando no coinciden o ambos son pequeños. El párrafo de debajo da las cifras detrás de la etiqueta.

## El Flow Snapshot

Totales de la sesión a la última barra:

- **Call Volume** y **Put Volume** - contratos negociados, con la prima neta de cada lado debajo
- **Net Flow** - contratos netos de calls menos contratos netos de puts, cada uno con el signo del agresor
- **Net Premium** - prima neta de calls menos prima neta de puts. Positivo ⇒ los agresores están pagando por calls / vendiendo puts en términos netos; negativo ⇒ los agresores están pagando por puts / vendiendo calls.
- **Put/Call Ratio** - volumen de puts dividido por volumen de calls

## Los gráficos

- **Options Flow** - la prima neta de calls y de puts a lo largo de la sesión frente al precio del subyacente, con un área de volumen debajo según la base elegida. Se puede filtrar por strike o por vencimiento.
- **Net Directional Premium** - el total acumulado de la sesión de la prima neta, sombreado por encima y por debajo de cero.
- **Put/Call Ratio** - el ratio acumulado de la sesión en cada barra de 5 minutos.
- **Net Position (Buys vs. Sells)** - el volumen neto acumulado de calls y de puts, para distinguir compras de ventas, algo que el ratio no puede hacer.

Cada uno se representa como una serie para que puedas ver la pendiente, no solo el nivel.

## Smart money

Los prints de smart money tienen su propia página - consulta [Smart Money](/help/platform/smart-money). Úsala como verificación cruzada del flujo principal de esta página.

## Cómo interpretarla

Tres patrones:

1. **Flujo positivo ponderado por prima fuerte con un GEX Gradient positivo mientras los dealers están, según el modelo, cortos de gamma** ⇒ los traders están pagando por un alza en la que los dealers están cortos según el modelo. Lectura de continuación con alta convicción.
2. **Compra fuerte de puts con la señal Positioning Trap cargada en el lado de la multitud short (positivo)** ⇒ la multitud bajista está mal posicionada; espera un rebote brusco al alza.
3. **Flujo plano cerca de un nivel clave** ⇒ espera la ruptura. El flujo sin convicción no es una operación.

## Volumen neto vs. flujo direccional

Para una explicación más profunda de por qué el volumen bruto puede engañar, por qué el flujo direccional añade señal, y por qué el flujo ponderado por prima suele ser la métrica de convicción más sólida, consulta [Volumen neto vs flujo direccional](/education/net-volume-vs-directional-flow).

## Cuándo esta página es más útil

- **Justo después de la apertura** - los primeros 30 minutos dicen mucho sobre el sesgo del día.
- **En cualquier nivel clave** - el flujo hacia un wall o el VWAP indica si el nivel se está defendiendo o rompiendo.
- **Hacia el cierre** - combinado con EOD Pressure, la lectura del flujo afina la señal direccional.

## Ver también

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volumen neto vs flujo direccional](/education/net-volume-vs-directional-flow)
