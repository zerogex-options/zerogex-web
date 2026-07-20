# Análisis de flujo

*Flujo ponderado por prima y por volumen neto, los buckets de smart money, la separación de agresores Lee-Ready, y cómo detectar la convicción real en el tape.*

---

## Qué muestra esta página

La página de Flow Analysis es la **vista del tape** del mercado de opciones. Mientras que Dealer Positioning muestra el libro estático, esta página muestra el **flujo** — lo que están haciendo los agresores en tiempo real.

## Los tres enfoques del flujo

ZeroGEX muestra el flujo a través de tres enfoques, porque cada uno importa de forma distinta.

### Volumen neto de contratos

Simplemente cuenta contratos. Útil como referencia de ruido de fondo. Poco útil por sí solo como lectura de convicción — mil contratos de $0,05 y un contrato de $500 cuentan igual.

### Flujo ponderado por prima

Multiplica el volumen de contratos por la prima pagada. **Esta es la lectura de convicción.** Un trader que paga $500 por contrato en una call OTM 0DTE está haciendo una apuesta real; un trader que hace scalping con tickets de lotería de $0,05 no.

### Flujo direccional (separación de agresores Lee-Ready)

Clasifica cada operación como iniciada por el comprador o por el vendedor usando el algoritmo Lee-Ready (de qué lado del bid/ask se ejecutó la operación). Suma las operaciones iniciadas por el comprador menos las iniciadas por el vendedor. Indica si los agresores están pagando por el alza o por la baja.

## El panel principal

La parte superior de la página muestra el flujo neto ponderado por prima en la ventana móvil. Positivo ⇒ los agresores están pagando por calls / vendiendo puts en términos netos; negativo ⇒ los agresores están pagando por puts / vendiendo calls.

## Los paneles de detalle

Debajo del panel principal:

- Prima de **compra de calls / venta de calls**
- Prima de **compra de puts / venta de puts**
- **Delta neto del agresor** — la salida de Lee-Ready escalada por el delta del contrato

Cada una se representa como una serie para que puedas ver la pendiente, no solo el nivel.

## El chip de smart money

Las etiquetas en operaciones individuales las marcan como smart money — típicamente bloques grandes, sweeps, prints agresivos repetidos en la misma dirección. El flujo de smart money se muestra como una subserie separada. Úsalo como verificación cruzada del panel principal.

## Cómo interpretarla

Tres patrones:

1. **Flujo positivo ponderado por prima fuerte con un gradiente de GEX negativo** ⇒ los traders están pagando por un alza en la que los dealers están estructuralmente cortos. Lectura de continuación con alta convicción.
2. **Compra fuerte de puts con la señal Positioning Trap también alta** ⇒ la multitud está mal posicionada; espera un rebote brusco.
3. **Flujo plano cerca de un nivel clave** ⇒ espera la ruptura. El flujo sin convicción no es una operación.

## Volumen neto vs. flujo direccional

Para una explicación más profunda de por qué el volumen bruto puede engañar, por qué el flujo direccional añade señal, y por qué el flujo ponderado por prima suele ser la métrica de convicción más sólida, consulta [Volumen neto vs flujo direccional](/education/net-volume-vs-directional-flow).

## Cuándo esta página es más útil

- **Justo después de la apertura** — los primeros 30 minutos dicen mucho sobre el sesgo del día.
- **En cualquier nivel clave** — el flujo hacia un wall o el VWAP indica si el nivel se está defendiendo o rompiendo.
- **Hacia el cierre** — combinado con EOD Pressure, la lectura del flujo afina la señal direccional.

## Ver también

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volumen neto vs flujo direccional](/education/net-volume-vs-directional-flow)
