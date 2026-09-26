# Technicals

*El panorama intradía del precio sobre el que se asienta el libro de opciones - VWAP, el rango de apertura, los picos de volumen y la divergencia de momentum.*

---

## Qué muestra esta página

La página Technicals es la **lectura price-first** del símbolo activo. Es la única página de Metrics que lee el precio en lugar de la cadena de opciones - el VWAP, el rango de apertura, el volumen inusual y el momentum contrastado con el flujo de opciones.

Es la página que abres cuando necesitas confirmar qué está implicando el posicionamiento de los dealers frente a lo que el precio realmente está haciendo.

## VWAP Analysis

Cuatro tarjetas - **Current Price**, **VWAP**, **Deviation** (a qué distancia está el precio del VWAP, en porcentaje) y **Position** (por encima o por debajo) - y un gráfico del precio frente al VWAP a lo largo de la sesión. El canal sombreado entre ambos se ensancha a medida que el precio se aleja del VWAP: verde cuando el precio está por encima, rojo cuando está por debajo.

## Opening Range Breakout

El rango de apertura es el máximo y el mínimo de los primeros 30 minutos de la sesión regular (09:30-09:59 ET), fijado para el resto del día. Las tarjetas muestran **ORB High** y **ORB Low** con la distancia a cada uno, además del **ORB Range**; **Position Within Range** muestra dónde está el precio entre ambos, y el **ORB breakout map** representa el precio frente a las dos líneas.

## Unusual Volume Spikes

Las barras de 5 minutos que negociaron al menos una desviación estándar por encima de su propio promedio reciente - marcadas como Moderate, High o Extreme Spike -, dibujadas frente al precio del subyacente. Cada barra se colorea desde el rojo (todo volumen bajista) pasando por neutral hasta el verde (todo volumen alcista). Pasa el cursor sobre una barra para ver su volumen, su múltiplo del promedio y el reparto de la presión compradora.

## Momentum Divergence Signals

Una lista continua, de la más reciente a la más antigua, que contrasta cada movimiento de precio de 5 minutos con el flujo de opciones y el volumen alcista y bajista que hay detrás: **Bearish Divergence** (el precio sube mientras se compran puts), **Bullish Divergence** (el precio baja mientras se compran calls), **Bullish** o **Bearish Confirmation** cuando el precio y el flujo de opciones coinciden, y **Weak Rally** o **Weak Selloff** cuando el volumen va en contra del movimiento.

## Cómo leerla

Tres patrones - los walls y el flip vienen de Dealer Positioning o del Gamma Terminal:

1. **Precio atrapado entre el call wall y el put wall** en gamma positiva ⇒ *tiende a* revertir a la media dentro del rango. Los technicals confirman el rango; la página de dealers sugiere el porqué.
2. **Precio que rompe por debajo del put wall** en gamma negativa con la IV en expansión ⇒ la continuación de tendencia *se vuelve más probable*. Los technicals muestran la ruptura; la página de dealers explica la amplificación modelada.
3. **El VWAP y el gamma flip se apilan en el mismo nivel** ⇒ un pivote estructural a vigilar. Las reacciones allí *pueden* tener más convicción que en cualquiera de los dos por separado.

Para ver el flip, los walls, el max pain y el VWAP dibujados sobre las propias velas, usa el gráfico del Gamma Terminal - consulta [Cómo leer los gráficos de ZeroGEX](/help/platform/reading-charts).

## Ver también

- [Cómo leer el Dashboard](/help/platform/dashboard)
- [Posicionamiento de los Dealers](/help/platform/dealer-positioning)
- [Cómo leer los gráficos de ZeroGEX](/help/platform/reading-charts)
- [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip)
