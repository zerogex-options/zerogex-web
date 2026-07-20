# Cotizaciones de Opciones en Vivo

*Explora la cadena en vivo. Filtrado por vencimiento y moneyness, ordenación de columnas, y cómo la superficie de IV ilumina los colores.*

---

## Qué muestra esta página

La página de Cotizaciones de Opciones en Vivo es la **cadena de opciones en vivo** para el símbolo activo. Cada columna se actualiza en tiempo real durante el horario de mercado.

## Las columnas

Para cada strike y cada vencimiento:

- **Strike**
- **Bid / Ask / Mid**
- **Last** y **Volume**
- **Open Interest**
- **Delta, Gamma, Vega, Theta, Charm**
- **Volatilidad Implícita**
- **Contribución al GEX** — el valor en dólares del gamma de los dealers en ese strike

Cada fila está emparejada (call a la izquierda, put a la derecha) con el strike en la columna central. El clásico diseño de cadena.

## Filtros

La barra de filtros te permite acotar la cadena:

- **Vencimiento** — selección múltiple. Por defecto 0DTE si está disponible, de lo contrario el más próximo.
- **Moneyness** — banda ATM (p. ej., ±5% respecto al spot) o cadena completa.
- **Ordenar** — por strike, volume, OI, IV, contribución al GEX.
- **Mostrar solo** — volume distinto de cero, OI distinto de cero, sweeps, blocks.

## Los colores de la superficie de IV

Las celdas se colorean en gradiente según la IV — colores fríos (azul) para IV baja, colores cálidos (rojo) para IV alta. La escala es por vencimiento, así que un ATM "caliente" en una columna no corresponde al mismo nivel absoluto de IV que un ATM "caliente" en otra. La idea es ver la **forma** de la sonrisa (smile), no el nivel absoluto.

## Cómo leer la cadena

Tres patrones:

1. **¿Dónde se acumula el OI?** La cadena es el dato crudo que subyace al perfil de GEX. Los strikes con mayor OI suelen ser donde están los walls.
2. **¿Dónde está el volume?** El volume indica lo que se está negociando **en este momento**, lo cual puede divergir marcadamente del OI durante el día.
3. **¿Dónde está el skew de IV?** Un skew de IV de puts OTM más pronunciado frente a la IV de calls OTM es la lectura del skew.

## Acciones rápidas

- **Haz clic en una fila** para abrir el Strategy Builder con esa pata (leg) precargada.
- **Pasa el cursor sobre una celda** para ver todos los detalles (tamaño de bid/ask, hora de la última operación, exchange).

## Nota sobre el plan

Las Cotizaciones de Opciones en Vivo están disponibles para Basic y Pro.

## Ver también

- [Strategy Builder](/help/platform/options-calculator)
- [Posicionamiento de Dealers](/help/platform/dealer-positioning)
- [Análisis de Flujo](/help/platform/flow-analysis)
