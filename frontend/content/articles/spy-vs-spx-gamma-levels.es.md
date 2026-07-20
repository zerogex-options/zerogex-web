# Opciones SPY vs SPX: ¿Qué Niveles de Gamma Importan?

*SPY y SPX siguen el mismo índice a través de dos contratos diferentes — y dos libros de gamma de dealers separados. Aquí te explicamos en qué se diferencian sus niveles de gamma, cómo convertir un nivel de uno a otro, cuál libro pesa más y por qué el nivel que más importa es aquel en el que ambos coinciden.*

---

## La respuesta corta

Si operas SPX, lee los niveles de gamma de SPX. Si operas SPY, lee los niveles de gamma de SPY. Pero como ambos contratos cubren el **mismo** índice subyacente a partir de fondos de open interest **separados**, la lectura más precisa se obtiene observando ambos — y tratando los niveles en los que coinciden como los más propensos a sostenerse.

El resto de este artículo explica por qué los dos libros difieren, cómo convertir un nivel entre ellos y cuál merece más peso cuando están en desacuerdo.

---

## Mismo índice, dos contratos diferentes

SPX y SPY siguen ambos el S&P 500. Lo que difiere es el *contrato* que lo envuelve — y esas diferencias moldean cómo los dealers cubren cada uno.

| Característica | SPX | SPY |
|---|---|---|
| Qué es | Opciones sobre **índice** S&P 500 | Opciones sobre **ETF** S&P 500 |
| Escala de precio | El nivel del índice (p. ej. 6000) | ~1/10 del índice (p. ej. 600) |
| Liquidación | Liquidación en efectivo | Liquidación física (acciones) |
| Estilo de ejercicio | Europeo — sin asignación anticipada | Americano — riesgo de asignación anticipada |
| Nocional del contrato | ~$100 × nivel del índice (≈10× SPY) | ~$100 × precio del ETF |
| Espaciado de strikes | Más amplio (comúnmente 5 puntos) | Más fino ($1, algunos $0.50) |
| Dividendos e impuestos | Sin dividendos; tratamiento Sección 1256 | Paga dividendos; tratamiento de opción sobre acciones |
| Perfil típico | Institucionales, mesas de índice y 0DTE | Retail más institucionales, hedgers de acciones |

La fila más importante para la gamma es el **nocional del contrato**. Un contrato SPX controla aproximadamente diez veces la exposición en dólares de un contrato SPY, por lo que la cobertura de los dealers en SPX mueve mucho más delta equivalente al índice por contrato. Esto importa más adelante.

---

## Por qué SPY y SPX tienen libros de gamma separados

La exposición gamma se calcula a partir del open interest de una cadena de opciones — strike por strike, vencimiento por vencimiento. SPX y SPY son cadenas diferentes con open interest diferente, así que cada una produce su **propio** [perfil de gamma](/education/gamma-exposure-explained): su propio [gamma flip](/education/how-to-read-a-gamma-flip), su propio [call wall y put wall](/education/gamma-walls-explained), su propio net GEX.

Como ambas cadenas hacen referencia al mismo índice, esos niveles usualmente apuntan al mismo lugar en términos del S&P. Pero están construidos por perfiles de participantes diferentes — SPX está sesgado hacia institucionales e índice/0DTE, SPY carga un fuerte flujo retail y de cobertura de acciones — así que los dos libros pueden ponderar los strikes de forma distinta y separarse en los márgenes. Cuando divergen, eso es información, no ruido.

---

## Traducir un nivel de uno a otro

SPY cotiza aproximadamente a una décima parte del índice S&P 500, así que como primera aproximación:

> Nivel SPY ≈ Nivel SPX ÷ 10 — SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Dos advertencias impiden que la conversión sea exacta:

- **Desviación de tracking.** El precio de SPY refleja dividendos acumulados y pequeñas diferencias de tracking, por lo que la proporción nunca es un 10.000 exacto. Convierte para orientarte, no al centavo.
- **Granularidad de strikes.** Los strikes de SPX están espaciados más ampliamente (comúnmente cinco puntos de índice) mientras que SPY lista cada dólar. Un wall de SPX cae en un número de índice redondo; el wall de SPY correspondiente puede estar en una resolución más fina — SPY a menudo muestra *dónde dentro* de un bucket de cinco puntos de SPX se concentra realmente la gamma.

---

## ¿Qué libro pesa más?

Para la presión de cobertura *real* de los dealers en el S&P, SPX suele ser el mapa principal. Tres razones:

1. **Nocional.** Aproximadamente 10 veces el delta en dólares por contrato significa que los flujos de cobertura de SPX dominan la gamma a nivel de índice que realmente mueve el índice en efectivo y /ES.
2. **Profundidad 0DTE.** SPX lista un vencimiento cada día de negociación y es el mercado de opciones sobre índice más profundo que existe; el [posicionamiento de los dealers](/education/0dte-dealer-positioning-explained) del mismo día que impulsa la volatilidad intradía aparece ahí primero.
3. **Mecánica más limpia.** La liquidación en efectivo y el ejercicio europeo significan que no hay una carrera de asignación anticipada que distorsione el libro hacia el vencimiento.

SPY se gana su lugar como capa de **granularidad y confirmación**: strikes más finos, enorme liquidez en acciones, y el flujo retail y de hedgers que produce el [pinning específico de SPY](/education/why-spy-pins-near-strikes). Y cuando operas SPY en sí mismo, son sus propios walls a los que tu instrumento realmente va a reaccionar.

---

## ¿Qué niveles importan para tu operación?

Haz coincidir el mapa con el instrumento que realmente estás operando:

- **SPX, /ES, o SPX 0DTE** → los niveles de gamma de SPX son tu mapa.
- **Acciones SPY u opciones SPY** → niveles de gamma de SPY — los walls y el pin propios de tu instrumento.
- **QQQ** → niveles de QQQ (ver abajo).

Luego busca **confluencia**. Cuando el call wall de SPX en 6000 se alinea con el call wall de SPY en 600, ese nivel compartido es más sólido que cualquiera de los dos por separado — dos libros de dealers separados apoyándose en el mismo precio. Cuando *no coinciden*, trata a ambos como más débiles y deja que el precio te diga qué libro tiene el control.

> El nivel basado en opciones más fuerte no es el wall más grande en un solo gráfico. Es el nivel en el que SPX y SPY coinciden.

---

## QQQ y NDX: la misma lógica en el Nasdaq

El Nasdaq-100 tiene la misma división: **QQQ** es el ETF, **NDX** es el índice en efectivo, y cada uno lleva su propio libro de gamma a una escala de precio diferente. Si operas QQQ, lee los [niveles de gamma de QQQ](/qqq-gamma-levels); si operas NDX o /NQ, el libro del índice es tu referencia. La idea de confluencia se traslada — los walls de QQQ que coinciden con el libro NDX son los que vale la pena respetar.

---

## Leerlos lado a lado en ZeroGEX

Las páginas gratuitas de niveles de gamma de ZeroGEX publican los tres libros uno junto al otro para que la coincidencia sea obvia de un vistazo:

- [Niveles de gamma SPX](/spx-gamma-levels) — el libro del índice, el mapa principal del S&P.
- [Niveles de gamma SPY](/spy-gamma-levels) — el libro del ETF, strikes más finos y detalle de pinning.
- [Niveles de gamma QQQ](/qqq-gamma-levels) — la lectura del Nasdaq-100.

Cada página comienza con el gamma flip, call wall, put wall, max pain y net dealer GEX de su propio ticker, y luego muestra los otros dos para contrastar. Para la mecánica detrás de los niveles, empieza con [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained), luego [Gamma Walls Explained](/education/gamma-walls-explained) y [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Conclusión

SPY y SPX siguen un mismo índice a través de dos contratos y dos libros de gamma de dealers separados. Opera los niveles que pertenecen a tu instrumento, usa la proporción de ~10× para convertir entre ellos, apóyate en SPX como el mapa más pesado a nivel de índice y en SPY para granularidad y pinning — y da el mayor respeto a los niveles en los que ambos coinciden.

*Estos son análisis derivados con fines educativos, no asesoría de inversión. Operar con opciones implica riesgos significativos.*
