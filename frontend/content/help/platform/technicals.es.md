# Technicals

*El panorama intradía del precio sobre el que se asienta el libro de opciones - VWAP, el rango de apertura, los picos de volumen y la divergencia de momentum, en un solo gráfico con el flip y los walls.*

---

## Qué muestra esta página

La página Technicals es la **lectura price-first** del símbolo activo. Es la única página de Metrics que lee el precio en lugar de la cadena de opciones - el VWAP, el rango de apertura, el volumen inusual y el momentum contrastado con el flujo de opciones - y lo dibuja todo frente al gamma flip, los walls y el pin.

Es la página que abres cuando necesitas confirmar qué está implicando el posicionamiento de los dealers frente a lo que el precio realmente está haciendo.

## La lectura de la sesión

La fila superior lee la sesión de un vistazo: **Price**, **VWAP** (y a qué distancia está el precio), dónde está el precio dentro del **Opening range**, **Dealer gamma** (gamma larga o corta, y a qué lado del flip está el precio) y los **Walls**, cada uno con su distancia al precio.

## El gráfico de la sesión

Velas de 5 minutos de la sesión, horas en ET, con:

- **VWAP** - la línea discontinua que atraviesa las velas.
- **El rango de apertura** - la banda sombreada entre el máximo y el mínimo de 09:30-09:59 ET. Sus quintos superior e inferior, más claros, son donde el estado indica "near the high" o "near the low".
- **El flip, los walls y el pin** - los mismos niveles que la franja de Key Levels y el Gamma Terminal. Un nivel demasiado alejado de los precios de la sesión para dibujarlo se señala con una flecha en el borde del eje de precios.
- **Volumen** - debajo. Las barras al menos una desviación estándar por encima de su propio promedio reciente se colorean según dominaran las compras (verde) o las ventas (rojo); el resto son grises.
- **Marcadores numerados** - divergencias y rupturas del rango de apertura, numerados por orden temporal para coincidir con la lista de eventos.

Los botones sobre el gráfico activan o desactivan cada capa, y este navegador recuerda tu elección. Pasa el cursor sobre una vela, o tócala en el móvil, para ver su apertura, máximo, mínimo, cierre, VWAP y volumen.

## Rango de apertura

El máximo y el mínimo de los primeros 30 minutos de la sesión regular (09:30-09:59 ET), fijados para el resto del día, cada uno con su distancia al precio, el tamaño del rango y su **estado**:

- **Above the range** / **Below the range** - el último cierre de 5 minutos está más allá del máximo o del mínimo.
- **Near the high** / **Near the low** - dentro del rango, en su quinto superior o inferior.
- **Inside** - los tres quintos centrales.

"Near" se mide respecto al propio rango, así que se adapta al día y no al precio. **Where price sits** dibuja las mismas zonas como una barra.

El **registro de rupturas** recoge lo que hizo el precio en torno al rango: pruebas del máximo o del mínimo (una mecha que lo atraviesa y luego un cierre de vuelta dentro), rupturas (un cierre más allá), el punto más lejano alcanzado en múltiplos del rango y los cierres de vuelta dentro, con cuánto duró la ruptura.

## Eventos

Una sola lista, del más reciente al más antiguo:

- **Bearish divergence** - el precio sube en cinco minutos mientras el flujo de opciones se inclina hacia los puts. **Bullish divergence** - el precio baja mientras se inclina hacia las calls.
- **Weak rally** / **Weak selloff** - el precio se movió mientras el volumen alcista y bajista se inclinaba en sentido contrario.
- **Volume spike** - una barra de 5 minutos al menos una desviación estándar por encima de su promedio reciente, con cuánto por encima y si dominaron las compras o las ventas.
- **Eventos del rango de apertura** del registro de rupturas.

Las barras en las que el precio y el flujo de opciones coinciden (las confirmaciones) se omiten, porque son el caso habitual. La variación de 5 minutos está en las unidades de precio del símbolo - puntos en ES y NQ -, no en porcentaje.

## Cómo leerla

Tres patrones, todos visibles en el mismo gráfico:

1. **Precio entre el call wall y el put wall** en gamma positiva ⇒ el hedging se opone a los movimientos hacia cualquiera de los dos walls, un entorno de reversión a la media. Las velas confirman el rango; los niveles sugieren el porqué.
2. **Precio que rompe por debajo del put wall** en gamma negativa con la IV en expansión ⇒ la continuación de tendencia *se vuelve más probable*. Las velas muestran la ruptura; el régimen explica la amplificación modelada.
3. **El VWAP y el gamma flip se apilan en el mismo nivel** ⇒ un pivote estructural a vigilar. Las reacciones allí *pueden* tener más convicción que en cualquiera de los dos por separado.

Para el resto del panorama gamma junto a las velas - las escaleras de strikes, los ribbons y el rewind -, usa el Gamma Terminal; consulta [Cómo leer los gráficos de ZeroGEX](/help/platform/reading-charts).

## Ver también

- [Cómo leer el Panel](/help/platform/dashboard)
- [Posicionamiento de los Dealers](/help/platform/dealer-positioning)
- [Cómo leer los gráficos de ZeroGEX](/help/platform/reading-charts)
- [Cómo leer un Gamma Flip](/education/how-to-read-a-gamma-flip)
