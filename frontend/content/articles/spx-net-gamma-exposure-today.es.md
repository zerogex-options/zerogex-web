# Net Gamma Exposure de SPX hoy: cómo leer el Net GEX actual

*"¿Cuál es la net gamma exposure actual de SPX?" El número cambia cada sesión — pero la forma de leerlo no. Esto es lo que es el net GEX de SPX, cómo distinguir una lectura positiva de una negativa, dónde está el zero-cross y cómo consultar el valor en vivo de hoy.*

---

## Dónde ver la net gamma exposure de SPX hoy

Si estás aquí por el número actual, empieza por aquí: ZeroGEX publica el **net GEX de SPX** de hoy — con el gamma flip, call wall, put wall y max pain — gratis y con un retraso de unos 15 minutos en la [página de niveles gamma de SPX](/spx-gamma-levels). La misma lectura está disponible para [SPY](/spy-gamma-levels) y [QQQ](/qqq-gamma-levels). Para el valor en vivo, actualizado al segundo, el [dashboard GEX 0DTE en tiempo real](/real-time-gex-0dte) se actualiza durante toda la sesión. El resto de esta página explica qué significa ese número y cómo usarlo.

---

## ¿Qué es la net gamma exposure de SPX?

La **net gamma exposure (net GEX)** de SPX es la suma de la gamma de los dealers en toda la cadena de opciones del S&P 500, condensada en una única cifra en dólares con signo — a menudo llamada "dollar gamma." Estima cuánta exposición al índice S&P deben comprar o vender los dealers de opciones, mecánicamente, para mantenerse cubiertos a medida que SPX se mueve.

- El **signo** indica el régimen: positivo significa que los dealers amortiguan los movimientos, negativo significa que los amplifican.
- La **magnitud** (p. ej., +$1.5B, −$800M) indica cuánto hedging forzado hay en el mercado — con qué intensidad es probable que se manifieste el régimen.

El net GEX es la cifra principal dentro del marco más amplio de la [gamma exposure](/education/what-is-gex-in-trading). Se calcula al precio spot actual, por lo que se mueve a medida que SPX se mueve y la cadena de opciones se reprecia a lo largo del día.

---

## Cómo leer la lectura actual del net GEX

Dos casos, playbooks opuestos:

- **Net GEX de SPX positivo (régimen long-gamma).** Los dealers están net long gamma en el spot. Venden en los rallies y compran en las caídas para cubrirse, lo que *suprime* la volatilidad. Espera rangos más ajustados, mean reversion, pinning hacia strikes con mucho peso e intentos de rally que se estancan cerca del call wall. Una lectura muy positiva es una señal de mercado "tranquilo y lateral."
- **Net GEX de SPX negativo (régimen short-gamma).** Los dealers están net short gamma en el spot. Compran en los rallies y venden en las caídas, lo que *amplifica* la volatilidad. Espera rangos más amplios, breakouts que se extienden y tendencias que corren. Una lectura muy negativa es una señal de mercado "rápido, en tendencia, respeta tus stops." Esto es [lo que significa la gamma negativa](/education/what-is-negative-gamma) para el mercado.

La lectura no es una dirección — es un *carácter*. Un net GEX positivo no dice "arriba," dice "pegajoso." Uno negativo no dice "abajo," dice "volátil."

---

## El zero-cross: net GEX y el gamma flip

El momento más observado es el **zero-cross** — donde el net GEX cruza el cero. Ese precio es el [gamma flip](/education/how-to-read-a-gamma-flip): por encima, los dealers suelen estar net long gamma (positivo); por debajo, net short (negativo).

Cuando los traders buscan "SPX net gamma exposure zero cross," se refieren precisamente a esto — la línea del régimen. Observar el net GEX respecto al cero, y el spot respecto al flip, es la misma lectura desde dos ángulos:

- Spot bien por encima del flip con net GEX fuertemente positivo → de lleno en el régimen calmante.
- Spot cerca del flip con net GEX próximo a cero → un mercado inestable y errático que puede inclinarse hacia cualquier lado.
- Spot por debajo del flip con net GEX negativo → el régimen amplificador tiene el control.

---

## Por qué el libro 0DTE de SPX hace que el número de hoy se mueva

SPX está ahora dominado por vencimientos del mismo día (0DTE), lo que hace que el net GEX sea inusualmente *vivo*. Los contratos del mismo día llevan una gamma enorme justo at-the-money, y esa gamma decae hasta cero al cierre. Por eso la lectura actual del net GEX de SPX puede oscilar de forma significativa dentro de una sola sesión, a medida que el posicionamiento 0DTE se construye por la mañana y se disipa hacia la tarde.

Implicación práctica: un número de net GEX de hace tres horas puede estar ya desactualizado. Para SPX en particular, la lectura *actual* importa más que en libros más lentos y de vencimientos más lejanos — precisamente por eso vale la pena consultar el valor en vivo en lugar de confiar en una instantánea de la mañana. Para el contexto sobre el posicionamiento de los dealers detrás de la oscilación intradía, consulta [posicionamiento de dealers 0DTE explicado](/education/0dte-dealer-positioning-explained).

---

## Cómo usar la lectura en tu sesión

1. **Empieza por el número.** Antes de tu primera operación, comprueba si el net GEX de SPX es positivo o negativo, y qué tan grande es. Eso define el playbook del día.
2. **Localiza el zero-cross.** Marca el gamma flip. Ten claro si el spot está por encima o por debajo y por cuánto.
3. **Ajusta las tácticas al signo.** Positivo → fades, operativa de rango y paciencia cerca de los walls. Negativo → momentum, breakouts y riesgo más ajustado.
4. **Revisa de nuevo intradía.** Como el libro 0DTE cambia, échale otro vistazo a la lectura actual después de la mañana y en torno a la última hora.

---

## Conclusión

> La net gamma exposure de SPX es un único número con signo que te dice si los dealers están amortiguando o amplificando el movimiento de hoy. Lee primero el signo, obsérvalo respecto al zero-cross, y recuerda que el libro de SPX, dominado por 0DTE, mantiene el número en constante movimiento — así que consulta el valor *actual*, no confíes en el de esta mañana.

Solo contenido educativo — nada de lo anterior es una recomendación de trading.

---

¿Quieres verlo en tiempo real? Consulta el net GEX de SPX de hoy en la [página de niveles gamma de SPX](/spx-gamma-levels) gratuita (también [SPY](/spy-gamma-levels) y [QQQ](/qqq-gamma-levels)), profundiza con [Gamma Exposure Explained](/education/gamma-exposure-explained), o abre el [dashboard GEX 0DTE en tiempo real](/real-time-gex-0dte) — [inicia una prueba gratuita](/register) para la lectura en vivo, actualizada al segundo.
