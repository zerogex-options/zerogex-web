# Por qué nuestro precio de futuros puede diferir del de otra plataforma

*Por qué una cotización de ES o NQ aquí puede quedar a unos cientos de puntos del mismo ticker en otro gráfico - y por qué ambas cifras son correctas.*

---

**Respuesta corta:** puede que estemos cotizando un mes de contrato distinto al del gráfico con el que comparas. Las dos cifras son correctas. Son instrumentos distintos.

## Los futuros cotizan como contratos con fecha

ES y NQ no tienen un precio único. Cotizan como contratos separados con vencimiento en marzo, junio, septiembre y diciembre, y varios de ellos cotizan a la vez, a precios distintos.

No es una peculiaridad de nuestros datos: es cómo los lista la bolsa. Un futuro del S&P 500 que liquida en tres meses y otro que liquida la semana que viene son dos contratos distintos con dos libros de órdenes distintos, y nada obliga a que sus precios converjan hasta que vence el más cercano.

Cotizamos el contrato que lleva el volumen - el que se negocia de forma activa.

## Los contratos hacen rollover cada trimestre

Alrededor de una semana antes de que un contrato venza, el volumen de negociación migra al siguiente. Los proveedores de datos cambian sus feeds en ese punto - pero **no todos el mismo día**. Cada proveedor elige su propio disparador: un número fijo de días antes del vencimiento, un cruce de volumen o de interés abierto, o una regla de calendario fijada hace años.

Durante la semana aproximada que va del cambio de un proveedor al de otro, dos plataformas que ambas ponen "NQ" muestran contratos distintos. Ninguna está mal. Simplemente responden a preguntas ligeramente distintas sobre qué significa "NQ" hoy.

Esa es toda la causa del desajuste, y es la razón por la que no publicamos una única fecha de rollover: no existe.

## La diferencia es el carry

Un contrato que liquida dentro de tres meses vale más que uno que liquida esta semana. La diferencia es el coste de financiar la posición hasta entonces, menos los dividendos a los que renuncias por mantener futuros en lugar de las acciones.

En un rollover trimestral eso suele ser alrededor de un **1 % en NQ** y un **0,8 % en ES**. En NQ es mayor porque el Nasdaq-100 paga menos dividendo que el S&P 500, así que su carry es más alto.

En NQ eso son unos cientos de puntos - suficiente para parecer un feed roto, que es exactamente por lo que etiquetamos el contrato directamente en lugar de dejarte deducirlo.

La misma aritmética explica un escalón en un gráfico de varios días. Un rango que atraviesa un rollover contiene realmente dos contratos, así que el precio salta donde uno termina y empieza el siguiente. Ese escalón es carry, no un movimiento de mercado, y los gráficos que cruzan un rollover lo indican.

## Cómo comprobarlo

1. Pasa el cursor por la etiqueta de contrato en cualquier vista de ES o NQ, tócala o enfócala con el teclado. Nombra el contrato exacto que estamos cotizando y cuándo vence.
2. Pon tu otra plataforma en ese mismo contrato.
3. Los precios deberían cuadrar.

Si tu otro feed va con retraso - muchos feeds gratuitos van 10-15 minutos por detrás -, seguirás viendo una pequeña diferencia por el retraso en sí. Esa es de unos pocos puntos, no de unos cientos.

## Cuándo se resuelve

Una vez que el contrato antiguo vence, todas las plataformas están en el nuevo y la diferencia desaparece. Vuelve en el siguiente rollover trimestral, y se comporta igual cada vez.

## ¿Afecta esto a los niveles de dealers?

No. El gamma flip, los walls, el max pain y el resto se calculan a partir de las cadenas de opciones del SPX y del NDX y luego se proyectan sobre el eje de precios del futuro usando el carry teórico del contrato que cotizamos. En un rollover la proyección pasa al carry del nuevo contrato junto con el precio, así que los niveles siguen al contrato que estemos cotizando sin ningún ajuste de base que configurar. Como el carry refleja el valor razonable, los niveles pueden quedar ligeramente desplazados cuando los futuros cotizan por encima o por debajo de él. En [Cobertura de datos y actualización](/help/platform/data-coverage) se explica cómo se sirven ES y NQ.

## ¿Sigue sin cuadrar?

Si ambos lados están en el mismo contrato y los precios aún difieren más de lo que explica el retraso, se trata de otra cosa. Escríbenos a [support@zerogex.io](mailto:support@zerogex.io) con una captura y la hora.

## Ver también

- [Cobertura de datos y actualización](/help/platform/data-coverage)
- [Solución de problemas](/help/platform/troubleshooting)
- [Cómo leer los gráficos de ZeroGEX](/help/platform/reading-charts)
