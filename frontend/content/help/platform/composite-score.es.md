# Composite Score

*La lectura combinada de todas las señales de ZeroGEX — cómo se construye, cómo interpretarla y cómo usarla como filtro en lugar de como pronóstico.*

---

## Qué es el Composite Score

El Composite Score — internamente **MSI**, el Market Score Indicator — es el **resumen en un único número** de todas las señales de ZeroGEX en el símbolo activo. Se ubica en la misma línea **[-1, +1]** que cualquier otro puntaje de señal.

Composite positivo ⇒ sesgo estructural alcista. Negativo ⇒ sesgo estructural bajista. La magnitud indica el nivel de convicción.

## Cómo se construye

Tres entradas en actualización continua se combinan en un solo número:

1. **Señales Basic** — cada señal Basic aporta un peso fijo reducido (4–8 % del composite). Aun cuando no se activan, empujan el composite de forma continua en segundo plano.
2. **Disparadores de señales Advanced** — cuando un disparador de señal Advanced está activo, aporta su puntaje con signo y un peso mayor.
3. **Contexto de régimen** — el régimen de gamma activo actúa como multiplicador sobre las entradas direccionales.

Los pesos están calibrados para que ninguna señal individual domine. Una lectura del composite cercana a ±0,4–0,6 normalmente requiere que varias entradas se alineen.

## El gauge de MSI

La página del Composite Score muestra:

- El **gauge de MSI** — puntaje en la línea [-1, +1], con codificación de color desde rojo intenso hasta verde intenso.
- El **estado del disparador** — si el composite ha cruzado un umbral de atención.
- El panel de **señales contribuyentes** — cada entrada con su contribución actual al composite, ordenadas por magnitud.
- El **encabezado de régimen** — Positive Gamma, Negative Gamma o Transitioning.
- Un **sparkline** del composite durante la última sesión.

## Interpretar el composite

Una regla simple:

| Composite | Lectura |
| --- | --- |
| ≥ +0,6 | Fuertemente alcista — múltiples señales alineadas al alza, el régimen lo respalda |
| +0,3 a +0,6 | Sesgo alcista — el sesgo es real pero no abrumador |
| -0,3 a +0,3 | Sin lectura — el composite no aporta información útil, observa las señales individuales |
| -0,6 a -0,3 | Sesgo bajista |
| ≤ -0,6 | Fuertemente bajista |

El rango más útil es el de los extremos. La zona media es intencionalmente una zona de "los datos no te están diciendo nada" — no fuerces operaciones a partir de ella.

## Cómo usarlo

Tres patrones de uso:

1. **Como filtro.** No abras operaciones direccionales largas cuando el composite está en -0,6, salvo que tu ventaja sea específicamente contra-tendencia.
2. **Como verificación de confluencia.** Un disparador Advanced de alta confianza respaldado por un composite en la misma dirección ofrece una lectura de mayor confianza que el disparador por sí solo.
3. **Como confirmador de régimen.** Las lecturas del composite tienden a ser más fuertes y persistentes en sesiones de negative gamma — se alinean con el comportamiento subyacente del mercado.

## Qué no es

El composite **no es una señal de trading**. Te indica si el panorama estructural se inclina en una dirección; no te dice que entres en una operación, qué marco temporal usar ni dónde colocar tu stop.

## Por qué el composite puede revertirse rápido

Dos razones:

- Una señal Advanced de alto peso puede activarse y dominar la lectura.
- El contexto de régimen (cruce del gamma flip) puede desplazar el multiplicador sobre todo lo demás.

El sparkline hace visibles estos cambios abruptos — busca las discontinuidades.

## Hábitos de traders que han demostrado funcionar

- Lee el composite en la apertura y a las 11:00 / 12:30 / 14:30 ET como puntos de control.
- No operes en contra del composite durante la ventana de EOD Pressure.
- Trata los puntajes composite entre -0,3 y +0,3 como "espera" en lugar de "neutral".

## Nota sobre niveles

La página del Composite Score es exclusiva del nivel Pro. El gauge del composite también aparece en el Dashboard para todos los niveles de pago.

## Ver también

- [Cómo funcionan las señales de extremo a extremo](/help/platform/signals-overview)
- [Cómo leer la línea de puntaje [-1, +1]](/help/platform/score-line)
- [Señales: explicadas](/guides/signals-explained)
