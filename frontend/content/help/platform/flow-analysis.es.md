# Análisis de flujo

*Lo que se negoció hoy y quién cruzó el spread para negociarlo: contratos comprados y vendidos en cada lado, la prima neta y el put/call, en un mismo reloj.*

---

## Qué muestra esta página

La página de Flow Analysis es la **vista del tape** del mercado de opciones. Mientras que Dealer Positioning muestra el libro vigente, esta página muestra el **flujo**: lo que se negoció hoy y qué lado cruzó el spread para negociarlo.

Dos controles del encabezado se aplican a toda la página: **Session** (la sesión en curso o cualquiera de la última semana, para ver si hoy es inusual en algo) y **Contracts** (todos los contratos, o los strikes y vencimientos que elijas). La barra de herramientas del gráfico fija el tamaño de las barras, **5 min** o **1 min**.

## Comprado y vendido

Cada print de opciones se clasifica según el lado que cruzó el spread, con la convención Lee-Ready:

- En el **ask** o cerca, un comprador pagó el precio: cuenta como **comprado**.
- En el **bid** o cerca, un vendedor lo golpeó: cuenta como **vendido**.
- Los prints en el **punto medio** se reparten entre ambos en proporción a los prints en el ask y en el bid de ese contrato en el mismo minuto. Los prints sin ningún indicio de lado, como la subasta de apertura de las 09:30, cuentan la mitad para cada lado.

Así, comprado más vendido es siempre todo lo que se negoció. La lectura del agresor es lo más cerca que el feed llega a la intención, pero no distingue una apertura de un cierre: una put "vendida" en el bid puede ser un vendedor nuevo o un comprador que recoge beneficios.

Las calls compradas y las puts vendidas forman el **lado alcista**; las puts compradas y las calls vendidas, el **lado bajista**. Los colores siguen esa regla en toda la página: verde es el lado alcista, rojo el bajista. Por eso el "bought" de la fila de puts es rojo.

## La lectura de la sesión

La fila superior lee la sesión de un vistazo:

- **Flow** - **Risk-on** cuando la prima neta y el flujo neto se inclinan ambos al alza, **Risk-off** cuando ambos se inclinan a la baja, y **Two-way** cuando discrepan o ambos son demasiado pequeños para valorarlos (flujo neto por debajo del 1 % de los contratos negociados y prima neta por debajo del 5 % de la prima de calls y puts).
- **Net premium** - prima neta de calls menos prima neta de puts, cada una como comprado menos vendido, con la parte de calls y la de puts debajo. Una parte de puts negativa significa que las puts se vendieron en neto.
- **Net flow** - el lado alcista menos el bajista, en contratos, y la participación del lado alcista en todo lo negociado.
- **Put/call** - volumen de puts dividido entre volumen de calls.
- **Volume** - todos los contratos negociados, y cuántos desde que abrió la barra más reciente.

## Bought vs. sold

Totales de la sesión para calls y puts, cada uno dividido en **comprado** y **vendido**, con el reparto como barra, el **neto** (comprado menos vendido) y lo que la barra más reciente ha añadido hasta ahora. La línea de abajo suma los dos lados: el alcista frente al bajista, y cuánto aventaja uno al otro, que es el flujo neto de la sesión.

Las cifras se actualizan cada pocos segundos mientras se negocia.

## El gráfico de la sesión

Un gráfico en paneles que comparten el reloj de la sesión y una cruz, con horas en ET:

- **Price** - el subyacente a lo largo de la sesión.
- **Net premium** - la prima neta acumulada, sombreada en verde por encima de cero y en rojo por debajo, con las **partes de calls y de puts** como líneas finas.
- **Contracts** - lo que se negoció en cada barra. Las barras hacia arriba son el lado alcista (calls compradas, con las puts vendidas apiladas encima en un tono más claro); las barras hacia abajo, el lado bajista (puts compradas, con las calls vendidas).
- **Put/call** - la ratio acumulada, con una línea discontinua en 1.
- Los **marcadores numerados** de la parte superior coinciden con el registro de flujo.

Los botones sobre el gráfico activan o desactivan cada panel, y este navegador recuerda tu elección. Pasa el cursor por el gráfico, o tócalo en el móvil, para ver todas las cifras de esa barra. **Full screen** le da al gráfico toda la ventana, con los paneles ajustados a ella; Escape o **Exit** lo devuelven a su sitio.

## Registro de flujo

El flujo destacado de la sesión, lo más reciente primero:

- **Net flow turned bullish / bearish** - el flujo neto acumulado cambió de lado y el nuevo lado aventaja en al menos el 0,5 % de los contratos negociados. Las pequeñas oscilaciones alrededor de cero no se listan.
- **Net premium turned bullish / bearish** - lo mismo para la prima neta, por al menos el 3 % de la prima de calls y puts.
- **Put/call rose above 1 / fell below 1** - una vez que se aleja 0,05 de 1.
- **Volume burst** - una barra de al menos 2,5 veces la mediana de las barras de la hora anterior, con el lado que la lideró. Se listan las seis mayores de la sesión.

No se señala nada en los primeros diez minutos, cuando cualquier total es tan pequeño que un solo print lo puede voltear.

## Bar by bar

Las calls y puts de cada barra, compradas y vendidas, y su flujo neto, lo más reciente primero. Durante la sesión, la fila superior es la barra que sigue abierta.

## Elegir contratos

**Contracts** abre la selección de strikes y vencimientos. Una selección acota todo lo que hay en la página, de modo que cada cifra describe los mismos contratos. La selección de vencimientos se comparte con los gráficos de gamma en la misma pestaña del navegador, y el encabezado siempre indica qué contratos está leyendo la página; la **×** de al lado vuelve a todos.

ES y NQ no tienen cadena de opciones propia: su flujo es el de SPX y NDX, así que los strikes listados son strikes del índice, no precios del futuro.

## Cómo leerlo

Tres patrones:

1. **Flujo fuerte en el lado alcista y prima neta al alza mientras los dealers están modelados cortos en gamma** ⇒ los traders pagan por un alza en la que los dealers están modelados cortos. Una lectura de continuación.
2. **Puts compradas con fuerza contra un nivel** con la señal Positioning Trap cargada del lado de la multitud corta ⇒ la multitud bajista puede estar mal posicionada; atento a un rebote.
3. **Flujo plano cerca de un nivel clave** ⇒ espera a la ruptura. Flujo sin convicción no es un trade.

## Cuándo es más útil la página

- **Justo después de la apertura** - la primera media hora dice mucho sobre la inclinación del día.
- **En cualquier nivel clave** - el flujo hacia un wall o el VWAP muestra quién presiona el nivel. En nuestro estudio de 737 pruebas de walls, el flujo con signo en el strike del wall no predijo qué walls se rompían, así que léelo como contexto, no como veredicto.
- **Hacia el cierre** - junto con EOD Pressure, la lectura del flujo afina la señal direccional.

## Volumen neto vs. flujo direccional

Para la lectura completa sobre por qué el volumen bruto puede engañar, por qué la separación de agresores añade señal y por qué la prima suele ser la medida de convicción más fuerte, consulta [Volumen neto vs flujo direccional](/education/net-volume-vs-directional-flow).

## Ver también

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volumen neto vs flujo direccional](/education/net-volume-vs-directional-flow)
