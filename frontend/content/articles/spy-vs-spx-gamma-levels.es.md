# Opciones SPY vs SPX: ¿Qué Niveles de Gamma Importan?

*SPY y SPX siguen el mismo índice a través de dos contratos diferentes - y dos libros de gamma de dealers separados. Aquí te explicamos en qué se diferencian sus niveles de gamma, cómo convertir un nivel de uno a otro, qué libro suele pesar más y por qué los niveles en los que ambos coinciden pueden ser los que más importan.*

---

## La respuesta corta

Si operas SPX, lee los niveles de gamma de SPX. Si operas SPY, lee los niveles de gamma de SPY. Pero como ambos contratos siguen el **mismo** índice subyacente con fondos de open interest **separados**, observar ambos puede aportar contexto adicional. ZeroGEX no ha establecido que la coincidencia garantice una mayor fiabilidad.

El resto de este artículo explica por qué los dos libros difieren, cómo convertir un nivel entre ellos y cuál merece más peso cuando están en desacuerdo.

---

## Mismo índice, dos contratos diferentes

SPX y SPY siguen ambos el S&P 500. Lo que difiere es el *contrato* que lo envuelve - y esas diferencias moldean cómo los dealers cubren cada uno.

| Característica | SPX | SPY |
|---|---|---|
| Qué es | Opciones sobre **índice** S&P 500 | Opciones sobre **ETF** S&P 500 |
| Escala de precio | El nivel del índice (p. ej. 6000) | ~1/10 del índice (p. ej. 600) |
| Liquidación | Liquidación en efectivo | Liquidación física (acciones) |
| Estilo de ejercicio | Europeo - sin asignación anticipada | Americano - riesgo de asignación anticipada |
| Nocional del contrato | ~100 $ × nivel del índice (≈10× SPY) | ~100 $ × precio del ETF |
| Espaciado de strikes | Más amplio (comúnmente 5 puntos) | Más fino (1 $, algunos 0,50 $) |
| Dividendos e impuestos | Sin dividendos; tratamiento Sección 1256 | Paga dividendos; tratamiento de opción sobre acciones |
| Perfil típico | Institucionales, mesas de índice y 0DTE | Inversores individuales más institucionales, hedgers de acciones |

La fila más importante para la gamma es el **nocional del contrato**. Un contrato SPX controla aproximadamente diez veces la exposición en dólares de un contrato SPY, por lo que la cobertura de los dealers en SPX mueve mucho más delta equivalente al índice por contrato. Esto importa más adelante.

---

## Por qué SPY y SPX tienen libros de gamma separados

La exposición gamma se calcula a partir del open interest de una cadena de opciones - strike por strike, vencimiento por vencimiento - y luego se le asigna un signo de dealer por convención. SPX y SPY son cadenas diferentes con open interest diferente, así que cada una produce su **propio** [perfil de gamma](/education/gamma-exposure-explained): su propio [gamma flip](/education/how-to-read-a-gamma-flip), su propio [call wall y put wall](/education/gamma-walls-explained), su propio net GEX.

Una nota de encuadre sobre todo esto: el net GEX y el "libro de gamma de los dealers" son estimaciones *modeladas* - magnitudes de gamma de la cadena pública, con el signo asignado según la convención tradicional call-positivo / put-negativo. El inventario real de los dealers no es directamente observable a partir de los datos de la cadena de opciones, así que trata ambos libros como modelos de posicionamiento y no como un registro de lo que los dealers mantienen realmente.

Como ambas cadenas se refieren al mismo índice, esos niveles suelen apuntar al mismo lugar en términos del S&P. Pero las construyen públicos distintos - el SPX se inclina hacia lo institucional y hacia el índice/0DTE, el SPY carga una mezcla mayor de inversores individuales y flujo de cobertura sobre acciones -, así que los dos libros pueden ponderar los strikes de forma diferente y separarse en los márgenes. Cuando divergen, eso puede ser información en lugar de ruido.

---

## Traducir un nivel de uno a otro

SPY cotiza aproximadamente a una décima parte del índice S&P 500, así que como primera aproximación:

> Nivel SPY ≈ Nivel SPX ÷ 10 - SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Dos advertencias impiden que la conversión sea exacta:

- **Desviación de tracking.** El precio de SPY refleja dividendos acumulados y pequeñas diferencias de tracking, por lo que la proporción nunca es un 10,000 exacto. Convierte para orientarte, no al centavo.
- **Granularidad de strikes.** En dólares brutos SPY lista strikes más finos (1 $, algunos 0,50 $) que el espaciado de cinco puntos de SPX - pero aplica la escala de ~10×: un dólar de SPY equivale a diez puntos de índice, así que los strikes de 1 $ de SPY son en realidad *más gruesos* que los strikes de cinco puntos de SPX en términos de índice, y sus strikes de 0,50 $ apenas los igualan. En términos de índice, SPX resuelve la gamma con al menos tanta finura como SPY; la verdadera ventaja de SPY son sus strikes en dólares redondos, que pueden atraer el pinning, y su liquidez en acciones, no una resolución más fina en términos de índice.

---

## ¿Qué libro pesa más?

Para la presión agregada de cobertura de los dealers en el S&P, SPX suele ser el mapa principal. Tres razones:

1. **Nocional.** Aproximadamente 10× el delta en dólares por contrato significa que los flujos de cobertura de SPX tienden a dominar la gamma a nivel de índice que más influye en el índice en efectivo y en /ES.
2. **Profundidad 0DTE.** SPX lista un vencimiento cada día de negociación y es el mercado de opciones sobre índice más profundo que existe; el [posicionamiento de los dealers](/education/0dte-dealer-positioning-explained) del mismo día que puede impulsar la volatilidad intradía tiende a aparecer ahí primero.
3. **Mecánica más limpia.** La liquidación en efectivo y el ejercicio europeo significan que no hay una carrera de asignación anticipada que distorsione el libro hacia el vencimiento.

SPY se gana su lugar como capa de **granularidad y confirmación**: strikes más finos, enorme liquidez en acciones, y el flujo de inversores individuales y de hedgers que puede producir el [pinning específico de SPY](/education/why-spy-pins-near-strikes). Y cuando operas SPY en sí mismo, sus propios walls son los niveles a los que es más probable que reaccione tu instrumento.

---

## ¿Qué niveles importan para tu operación?

Haz coincidir el mapa con el instrumento que realmente estás operando:

- **SPX, /ES, o SPX 0DTE** → los niveles de gamma de SPX son tu mapa.
- **Acciones SPY u opciones SPY** → niveles de gamma de SPY - los walls y el pin propios de tu instrumento.
- **QQQ** → niveles de QQQ (ver abajo).

Luego busca **confluencia**. Cuando un nivel de SPX se alinea con el nivel convertido de SPY, ZeroGEX trata esa coincidencia como una confluencia contextual entre dos libros modelados separados. Es una heurística propia, no una prueba de que el nivel compartido tenga una tasa de acierto más alta. Cuando no coinciden, conserva ambos como referencias separadas en lugar de suponer que alguno de los dos libros controla el precio.

> Un nivel en el que SPX y SPY coinciden puede importar más que el wall más grande de cualquiera de los dos gráficos por separado.

---

## QQQ y NDX: la misma lógica en el Nasdaq

El Nasdaq-100 tiene la misma división: **QQQ** es el ETF, **NDX** es el índice en efectivo, y cada uno lleva su propio libro de gamma a una escala de precio diferente. Si operas QQQ, lee los [niveles de gamma de QQQ](/qqq-gamma-levels); si operas NDX o /NQ, el libro del índice es tu referencia. La misma comparación puede aportar contexto para QQQ y NDX, sin garantizar que la confluencia mejore la fiabilidad.

---

## Leerlos lado a lado en ZeroGEX

Las páginas gratuitas de niveles de gamma de ZeroGEX publican los tres libros uno junto al otro para que la coincidencia sea obvia de un vistazo:

- [Niveles de gamma SPX](/spx-gamma-levels) - el libro del índice, el mapa principal del S&P.
- [Niveles de gamma SPY](/spy-gamma-levels) - el libro del ETF, strikes más finos y detalle de pinning.
- [Niveles de gamma QQQ](/qqq-gamma-levels) - la lectura del Nasdaq-100.

Cada página comienza con el gamma flip, call wall, put wall, max pain y net dealer GEX de su propio ticker, y luego muestra los otros dos para contrastar. Para la mecánica detrás de los niveles, empieza con [Gamma Exposure (GEX) explicado](/education/gamma-exposure-explained), luego [Gamma Walls explicados](/education/gamma-walls-explained) y [¿Qué es un gamma flip?](/education/how-to-read-a-gamma-flip)

---

## Conclusión

SPY y SPX siguen un mismo índice a través de dos contratos y dos libros de gamma de dealers separados. Opera los niveles que pertenecen a tu instrumento, usa la proporción de ~10× para convertir entre ellos, apóyate en SPX como el mapa más pesado a nivel de índice y en SPY para el pinning en números redondos y la liquidez en acciones - y da un peso adicional a los niveles en los que ambos coinciden.

*Estos son análisis derivados con fines educativos, no asesoría de inversión. Operar con opciones implica riesgos significativos.*
