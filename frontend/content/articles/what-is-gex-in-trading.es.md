# ¿Qué es el GEX en trading? La exposición gamma explicada de forma sencilla

*GEX — la exposición gamma — es el número que explica por qué algunos días el precio queda clavado en un rango estrecho y otros arrancan en una tendencia fuerte. Esta es la versión en lenguaje sencillo: qué mide el GEX, por qué mueve el mercado y qué significa positivo frente a negativo para tu trading.*

---

## ¿Qué es el GEX en trading?

**GEX significa gamma exposure (exposición gamma).** En trading, el GEX es una medida de cuánto tienen que comprar o vender del subyacente los dealers de opciones que hacen mercado — mecánicamente, para mantenerse cubiertos (hedged) — a medida que el precio se mueve. Es un proxy del flujo de cobertura *forzado* que subyace al mercado en cada momento.

Esa es la idea completa en una frase: el GEX estima en qué dirección, y con cuánta fuerza, tienen que operar los dealers para mantener neutros sus libros cuando el precio se mueve. Cuando ese flujo de cobertura va en contra de los movimientos, el mercado es más pegajoso y calmado. Cuando va *con* los movimientos, el mercado se vuelve más rápido y las tendencias se refuerzan.

Todo lo demás — el gamma flip, los call walls, los put walls, el pinning — es solo una lectura más detallada de esa misma fuerza. Esta es la versión sencilla. Para el tratamiento completo y en profundidad, lee la guía [Gamma Exposure (GEX) Explained: The Complete Guide](/education/gamma-exposure-explained).

---

## ¿Qué mide realmente el GEX?

Los market makers que te venden opciones no quieren una apuesta direccional — quieren la comisión, no el riesgo. Así que se cubren. La **gamma** es la griega que indica lo rápido que cambia la exposición direccional de una opción (delta) a medida que se mueve el subyacente. Como la gamma obliga a los dealers a recubrirse continuamente, la gamma *agregada* de toda la cadena de opciones te dice cuánta recobertura tiene que hacer el mercado.

El GEX condensa todo eso en un único número con signo — normalmente expresado en dólares de gamma, o "dollar gamma" — para todo un índice como el S&P 500. Una magnitud mayor significa más cobertura forzada bajo el mercado. El **signo** te dice en qué dirección empuja esa cobertura.

---

## GEX positivo frente a negativo (por qué importa)

Esta es la parte que cambia cómo operas:

- **GEX positivo (régimen de gamma larga).** Los dealers están netos largos en gamma. Para cubrirse, **venden en los rallies y compran en las caídas** — operando *en contra* del movimiento. Eso amortigua la volatilidad. Espera rangos más estrechos, reversión a la media y pinning cerca de los strikes más pesados. Los breakouts tienden a estancarse.
- **GEX negativo (régimen de gamma corta).** Los dealers están netos cortos en gamma. Ahora **compran en los rallies y venden en las caídas** — operando *a favor* del movimiento. Eso amplifica la volatilidad. Espera rangos más amplios, breakouts que se extienden y tendencias que corren. Esto es [lo que significa la gamma negativa](/education/what-is-negative-gamma) en la práctica.

Mismo índice, mismo gráfico — carácter de mercado opuesto según el signo del GEX. Saber en qué régimen te encuentras es lo más útil que te da el GEX.

---

## Niveles clave del GEX: el gamma flip, el call wall, el put wall

El GEX no es solo un número; se traduce en niveles de precio concretos que vale la pena vigilar:

- **Gamma flip** — el precio en el que la gamma total de los dealers pasa de positiva a negativa. Por encima, el mercado suele estar en el régimen calmante de gamma larga; por debajo, en el régimen amplificador de gamma corta. Es la línea que separa los regímenes. Consulta [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).
- **Call wall** — el strike con la mayor gamma de calls por encima del spot, que tiende a limitar los rallies en gamma positiva.
- **Put wall** — el strike con la mayor gamma de puts por debajo del spot, que tiende a sostener las caídas.

El call wall y el put wall dibujan el rango que los dealers defienden; el gamma flip te dice si lo defenderán o lo romperán. [Gamma Walls Explained](/education/gamma-walls-explained) cubre ambos walls en profundidad.

---

## Cómo usan el GEX los traders

No operas el GEX directamente — lo usas como un **filtro** que fija el plan de juego antes de mirar cualquier otra cosa:

1. **Revisa el régimen.** GEX positivo → favorece las operaciones de fade, la reversión a la media y los rangos. GEX negativo → favorece el momentum y los breakouts, y respeta los stops.
2. **Marca los niveles.** Anota el gamma flip, el call wall y el put wall como tu mapa estructural para la sesión.
3. **Vigila el flip.** Un movimiento que cruza el gamma flip es un cambio de plan de juego, no solo un tick de precio — todo el carácter del mercado puede cambiar.

El GEX no te dirá *qué* va a pasar a continuación. Te dice en qué *tipo* de día estás probablemente, para que dejes de aplicar un plan de reversión a la media en un día de tendencia.

---

## Dónde ver el GEX por ti mismo

No tienes que calcular la gamma de los dealers a mano. ZeroGEX publica el Net GEX de hoy, el gamma flip, el call wall y el put wall — gratis y con un retraso de unos 15 minutos — para [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) y [QQQ](/qqq-gamma-levels). Para la lectura en vivo, en tiempo sub-segundo, con el perfil de gamma completo, el mapa de calor strike por DTE y el compuesto de 13 señales, abre el [panel GEX 0DTE en tiempo real](/real-time-gex-0dte).

---

## Conclusión

> El GEX — la exposición gamma — es una lectura de la cobertura forzada de los dealers bajo el mercado. El GEX positivo amortigua los movimientos; el GEX negativo los amplifica. Acierta primero con el signo, y el resto del mercado empezará a tener sentido.

Solo contenido educativo — nada de lo anterior es una recomendación de trading.

---

¿Quieres verlo en tiempo real? Consulta la lectura de GEX de hoy en las páginas gratuitas de niveles gamma de [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) y [QQQ](/qqq-gamma-levels), luego profundiza con la [guía completa de GEX](/education/gamma-exposure-explained) o abre el [panel GEX 0DTE en tiempo real](/real-time-gex-0dte).
