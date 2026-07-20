# Trading en el cierre: cómo EOD Pressure y Trap Detection leen en tiempo real el hedging de los dealers

*Dos ZeroGEX™ Advanced Signals diseñados para los puntos de inflexión estructural de la jornada de trading — los flujos de hedging forzado que arrastran el precio hacia el cierre, y los breakouts fallidos que rebotan cuando los dealers los absorben.*

---

## Por qué existen estas dos señales

La mayoría de las herramientas intradía te dicen *dónde* está el precio. Rara vez te dicen *por qué* está a punto de moverse — o, de forma más útil, *por qué no debería moverse más*.

Los últimos 90 minutos de la sesión de contado y los momentos justo después de que se rompa un nivel clave son las dos ventanas donde la mecánica de hedging de los dealers es más observable en el tape. EOD Pressure y Trap Detection están diseñadas para activarse exactamente en esos puntos de inflexión estructural — y permanecer en silencio el resto del día.

Ese silencio es una característica, no un defecto. Ambas señales marcarán **cero** durante la mayor parte de la jornada de trading. Cuando se activan, te están diciendo algo específico sobre flujo forzado que el resto del tape no te mostrará directamente.

Este artículo está dirigido a traders que ya comprenden el gamma exposure, el hedging de los dealers y la diferencia entre un régimen positive-gamma y uno negative-gamma. Si estos términos son nuevos para ti, empieza por nuestro artículo complementario **Decoding Gamma Exposure** y vuelve luego a este.

---

# Parte 1 — EOD Pressure

## Qué mide

EOD Pressure es un **estimador de sesgo direccional para los últimos ~90 minutos de la sesión de contado**. Intenta responder una pregunta:

> Dado el libro actual de los dealers y la proximidad de un strike imán, ¿en qué dirección *empuja* el hedging forzado al precio hacia el cierre?

Dos mecanismos físicos guían la respuesta:

**Decaimiento del charm.** A medida que las opciones 0DTE y de corto plazo se acercan al vencimiento, su delta no se queda quieto — decae a un ritmo cada vez más acelerado a medida que pasa el tiempo. Los dealers que gestionan un libro delta-neutral deben reequilibrarlo continuamente para mantener esa neutralidad. El signo agregado de la exposición al charm de los dealers cerca del spot te indica hacia qué dirección apuntan hoy esos flujos de hedging.

**Gravedad del pin.** En un régimen positive-gamma, los dealers compran la debilidad y venden la fortaleza — ese reflejo mecánico atrae el precio hacia el strike de máximo dolor / máximo gamma como un imán. En un régimen negative-gamma, la misma mecánica se invierte: los dealers persiguen los movimientos, y el strike se convierte en un punto de repulsión en lugar de un atractor.

EOD Pressure combina estos dos efectos, los escala según la cercanía al cierre, y los amplifica en las fechas del calendario donde el posicionamiento importa más.

---

## Interpretación del score

El output es un score continuo en **[−1.0, +1.0]**.

| Score | Interpretación para el trader |
|-------|----------------------|
| +0.6 a +1.0 | Fuerte deriva alcista esperada hacia el cierre. El imán se sitúa por encima del spot y los dealers están obligados a comprar. |
| +0.2 a +0.6 | Deriva alcista leve. El sesgo intradía se mantiene long pero sin posicionarse agresivamente. |
| −0.2 a +0.2 | Sin ventaja. Ya sea porque es demasiado pronto en la ventana, o porque los términos charm y pin se cancelan entre sí. |
| −0.2 a −0.6 | Deriva bajista leve. Sesgo short o cerrar longs. |
| −0.6 a −1.0 | Fuerte deriva bajista esperada hacia el cierre. |

La señal se marca a sí misma como **activada** cuando el score absoluto cruza **0.2**. Todo lo que quede por debajo se registra como contexto pero no disparará patrones de playbook posteriores.

---

## Cómo se construye el score

EOD Pressure agrega cuatro componentes. Tres contribuyen a la magnitud; uno actúa como puerta (gate).

### Componente 1: Charm en el spot

Esta es la medida más directa del flujo de hedging forzado. La señal suma la exposición al charm de los dealers a lo largo de una banda at-the-money, ponderada por bucket de vencimiento:

```
band_pct = max(0.5%, 1.5 × σ × √30)
charm_raw = Σ_buckets W_bucket × Σ_strikes_in_band dealer_charm_exposure
charm_score = clip(charm_raw / 2.0e7, [-1, +1])
```

La banda ATM está **escalada por volatilidad** — más amplia en días volátiles, con un piso de ±0.5% en días de tape muerto. La proyección de 30 barras traza aproximadamente el rango de precio esperado para el resto de la sesión.

Las ponderaciones de los buckets de vencimiento están calibradas según la física del charm:

| Bucket | Peso | Por qué |
|--------|--------|-----|
| 0DTE | 0.70 | El charm golpea con más fuerza el día del vencimiento. Contribuyente dominante. |
| Semanal | 0.20 | Relevante pero secundario. |
| Mensual | 0.10 | Contribución de fondo. |
| LEAPS | 0.00 | Demasiado lejano para importar en el cierre de hoy. |

En ±$20M de charm de dealer agrupado por buckets, el sub-score se satura en ±1.0. Por debajo de eso, la respuesta es lineal.

### Componente 2: Gravedad del pin

El término pin codifica el **tirón dependiente del régimen** del strike imán:

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

Un pin target 0.3% por encima del spot en un régimen positive-gamma da un pin score de +1.0 — el imán está arriba y la gravedad está activa.

El cambio de signo en un régimen negative-gamma es el detalle sutil pero crítico. Ese mismo pin por encima del spot en un libro short-gamma produce un pin score *negativo*, porque los dealers se ven obligados a *perseguir* los movimientos alejándose del strike en lugar de atraer el precio hacia él. La gravedad del pin no es un nivel fijo en el gráfico — es una fuerza dependiente del signo.

### Componente 3: Rampa temporal (Gate)

La rampa es una puerta multiplicativa sobre toda la señal. Antes de las **14:30 ET**, es exactamente cero — y la señal se cortocircuita antes de calcular cualquier otra cosa.

| Hora (ET) | Rampa |
|-----------|------|
| Antes de las 14:30 | 0.00 |
| 14:30 | 0.00 |
| 14:45 | 0.20 |
| 15:00 | 0.40 |
| 15:30 | 0.80 |
| 15:45 – 16:00 | 1.00 |

La rampa escala linealmente de 0 a 1 entre las 14:30 y las 15:45 ET, y luego se mantiene a plena fuerza hasta el cierre. Por eso la señal marca cero durante la mayor parte de la jornada de trading — está estructuralmente inactiva.

### Componente 4: Amplificador de calendario

El amplificador aumenta la convicción en fechas donde el posicionamiento se concentra y los libros de los dealers están inusualmente expuestos:

| Calendario | Amp |
|----------|-----|
| Día normal | 1.0× |
| OpEx mensual (tercer viernes) | 1.5× |
| Quad witching (tercer viernes de mar/jun/sep/dic) | 2.0× |

El amplificador es el único punto de la señal donde el score intermedio puede superar ±1 — el recorte final lo devuelve al rango.

---

## Uniéndolo todo

La agregación final:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

La ponderación 60/40 refleja una visión con criterio propio: **el charm es una medida directa del flujo de hedging forzado**, mientras que **la gravedad del pin es un tirón indirecto y dependiente del régimen**. Ambos importan. El charm lidera.

---

## Cuándo EOD Pressure devuelve cero

Una lectura en cero es el estado más común. La señal está *diseñada* para permanecer en silencio fuera de su ventana.

- Fuera de la ventana activa (el caso dominante): la rampa temporal se cortocircuita antes de calcular cualquier otro componente.
- Ningún strike dentro de la banda ATM en una cadena dispersa o con cotizaciones escasas.
- Tanto `max_pain` como `max_gamma_strike` son nulos.
- El pin target se sitúa exactamente en el spot.
- Los scores de charm y pin se cancelan exactamente — algo raro, requiere direcciones opuestas y magnitud igual.

Si estás observando el panel a las 13:55 ET y marca cero, eso es correcto y esperado. La señal se poblará a las 14:30 ET y ascenderá por la rampa hasta el cierre.

---

# Parte 2 — Trap Detection

## Qué mide

Trap Detection identifica setups donde **el precio acaba de romper un nivel clave de posicionamiento de los dealers pero es probable que falle y revierta**.

El patrón clásico: en un régimen long-gamma con posicionamiento de dealers en fortalecimiento, los dealers absorben los breakouts. Venden la subida y compran la bajada — mecánicamente, no porque tengan una opinión de mercado. El precio se asoma por encima de la resistencia, se topa con oferta, y rebota de vuelta al rango anterior. El breakout era una trampa.

La señal busca dos setups simétricos:

> **Bear trap en un falso movimiento alcista.** El precio se asoma por encima de un nivel de resistencia — `call_wall`, `max_gamma_strike`, `vwap`, o `gamma_flip` — pero las condiciones estructurales indican que el breakout fallará. Produce un score *negativo* (`bearish_fade`).

> **Bull trap en un falso movimiento bajista.** El precio se asoma por debajo del soporte — `put_wall`, `max_gamma_strike`, `vwap`, o `gamma_flip` — pero la ruptura parece falsa. Produce un score *positivo* (`bullish_fade`).

El signo del output codifica en qué dirección hay que hacer *fade*, no en qué dirección acaba de romper el precio.

---

## Interpretación del score

| Score | Etiqueta | Interpretación para el trader |
|-------|-------|----------------------|
| +0.5 a +1.0 | `bullish_fade` | Bull-trap-fade de alta convicción. La ruptura bajista es falsa — se espera un rebote hacia arriba. |
| +0.25 a +0.5 | `bullish_fade` (activado) | Moderado. Considerar entradas long de mean-reversion. |
| 0 a +0.25 | sub-umbral | Convicción débil; no accionable por sí sola. |
| 0 | ninguno | No se está formando ninguna trampa. El estado por defecto. |
| 0 a −0.25 | sub-umbral | Convicción débil. |
| −0.25 a −0.5 | `bearish_fade` (activado) | Bear-trap-fade moderado. Hacer fade a los longs, se espera una reversión a la baja. |
| −0.5 a −1.0 | `bearish_fade` | Bear-trap-fade de alta convicción. Hacer fade a los rallies dentro del breakout. |

El umbral de activación aquí es **0.25** — deliberadamente más estricto que el 0.20 de EOD Pressure. Los setups de trap necesitan mayor convicción para activarse porque operar contra un breakout activo conlleva un mayor riesgo de cola que dejarse llevar por el flujo de fin de jornada.

---

## Cómo se construye el score

### Paso 1: Identificar el nivel roto

```
up_levels = [call_wall, max_gamma_strike, vwap, gamma_flip]
dn_levels = [put_wall, max_gamma_strike, vwap, gamma_flip]
broken_resistance = max(level for level in up_levels if level < close)
broken_support    = min(level for level in dn_levels if level > close)
```

Nótese la nomenclatura. *Broken resistance* es el nivel que el precio acaba de superar al alza — por eso ahora se sitúa por debajo del cierre. *Broken support* es el nivel por debajo del cual el precio acaba de deslizarse. Los nombres reflejan la perspectiva posterior al breakout.

### Paso 2: Buffer de breakout escalado por volatilidad

Un pequeño asomo por encima de un nivel es ruido, no un breakout. La señal usa un buffer escalado por volatilidad para filtrar:

```
σ           = realized_sigma(recent_closes, 60 bars)
buffer_pct  = max(0.1%, 0.15 × σ × √5)
```

Para SPX con una σ intradía típica cercana a los 8 puntos básicos por minuto, el buffer se sitúa alrededor del 0.1%. En días volátiles se escala automáticamente hacia arriba. El precio necesita superar el nivel en más que el buffer antes de que la señal siquiera empiece a registrar fuerza.

### Paso 3: Factores de fuerza continuos

Una iteración anterior de esta señal usaba operadores AND booleanos y producía un comportamiento de todo-o-nada — precondiciones apenas cumplidas hacían que el score se activara y desactivara bruscamente. El diseño actual usa **factores continuos [0, 1]** que se multiplican entre sí:

| Factor | Punto de saturación | Qué captura |
|--------|------------------|------------------|
| `long_gamma_factor` | Pleno con net_gex ≥ $1B | ¿Están los dealers absorbiendo movimientos estructuralmente? |
| `strengthening_factor` | Pleno con +2% de delta GEX | ¿Se está *construyendo* el posicionamiento de los dealers, en lugar de deshacerse? |
| `breakout_strength` | Pleno a 3× el buffer más allá del nivel | ¿Superó el precio el nivel de forma realmente significativa? |
| `wall_migration` | 0.3× si el wall se movió >0.05% junto con el precio | Descuento si el propio nivel se está moviendo — eso sugiere un breakout real. |

La fuerza direccional en cada lado es el producto:

```
upside_strength   = breakout_strength_up   × long_gamma × strengthening × wall_up
downside_strength = breakout_strength_dn   × long_gamma × strengthening × wall_dn
```

Si cualquiera de estos factores llega a cero, anula todo ese lado. ¿Régimen negative-gamma? `long_gamma_factor = 0` — no hay trampa. ¿Gamma no se fortalece? `strengthening_factor = 0` — no hay trampa. La señal tiene una postura clara sobre *cuándo* funcionan los fades y se niega a activarse fuera de ese régimen.

### Paso 4: Término de magnitud

Un peso base más bonificaciones por distancia y por aceleración del gamma:

```
dist_strength = min(1, |distance_pct| / max(buffer_pct × 3, 0.3%))
gex_boost     = min(1, |net_gex_delta_pct| / 0.05)
magnitude     = 0.4 + 0.4 × dist_strength + 0.2 × gex_boost   // range: [0.4, 1.0]
```

Una trampa que cualifica lleva un peso mínimo de 0.4 incluso si apenas cualifica. Breakouts más grandes y un posicionamiento de dealers en aceleración lo escalan hacia 1.0.

### Paso 5: Multiplicador de flujo

El término de flujo separa los breakouts *reales* de los *agotados*:

```
flow_mult = 1.1                                          if flow is decelerating
          = max(0.3, 1 − flow_delta / flow_norm)         otherwise
```

Un flujo direccional desacelerándose dentro de un breakout es exactamente la tesis de la trampa — los compradores están dando un paso atrás justo cuando el precio supera el nivel, dejando el movimiento sin respaldo. La señal *aumenta* la convicción en un 10% en ese caso.

Por el contrario, un flujo que acelera en la dirección del breakout significa que el movimiento tiene participantes reales detrás. La tesis de la trampa se debilita — el multiplicador se reduce hacia 0.3.

### Paso 6: Agregación final

```
bear_score = clip(magnitude × flow_mult × upside_strength,   [0, 1])
bull_score = clip(magnitude × flow_mult × downside_strength, [0, 1])
score      = clip(bull_score − bear_score, [-1, +1])
triggered  = abs(score) >= 0.25
```

Ambos scores de lado son no negativos. Su diferencia codifica de forma continua tanto la dirección como la convicción. En el raro caso en que el precio quede encajado entre dos niveles rotos recientemente, los dos lados se cancelan parcialmente — algo apropiado, porque el setup es genuinamente ambiguo.

---

## Cuándo Trap Detection devuelve cero

Durante la mayor parte de la jornada de trading, esta señal marca cero. Las condiciones que la ponen en cero son exactamente las condiciones de las que deberías ser consciente:

- **No se está rompiendo ningún nivel.** El precio se encuentra entre `call_wall` y `put_wall` sin asomarse a ninguno de los dos, o se asoma pero dentro del buffer escalado por volatilidad. El estado por defecto de un mercado tranquilo.
- **Régimen negative-gamma.** `long_gamma_factor = 0`. En un libro short-gamma, los breakouts corren — no hacen fade. La señal se niega correctamente a activarse.
- **Gamma no se está fortaleciendo.** `strengthening_factor = 0`. Los setups de trap necesitan que el posicionamiento de los dealers se esté construyendo, no deshaciendo.
- **Faltan niveles de referencia.** No hay datos de `call_wall`, `put_wall`, `max_gamma_strike`, `vwap`, o `gamma_flip` — nada que romper.
- **Migración del wall en el lado activo.** Si el call wall se mueve al alza junto con el precio, el factor de descuento de 0.3× a menudo empuja el score por debajo del umbral de activación de 0.25.

Un cero de Trap Detection es *informativo*. Te indica que los prerrequisitos para una operación de fade-the-breakout no están dados — así que si estás a punto de operar contra un breakout, la señal te está diciendo implícitamente que busques evidencia en otro lugar.

---

# Leyendo ambas señales juntas

Las dos señales están diseñadas para leerse conjuntamente. Cubren horizontes temporales y regímenes distintos, pero a menudo se superponen en setups de alta convicción hacia el cierre.

| EOD Pressure | Trap Detection | Qué significa |
|--------------|----------------|---------------|
| +0.5 (alcista) | +0.4 (`bullish_fade`) | Alta convicción de long hacia el cierre. La deriva es alcista y el dip actual parece falso. Hacer fade a la debilidad intradía, esperar un día que cierre fuerte. |
| +0.5 (alcista) | −0.4 (`bearish_fade`) | Mixto pero tácticamente útil. EOD dice deriva al alza; trap dice que el breakout alcista actual está sobreextendido. Esperar a que el fade se complete, luego recargar longs para el cierre. |
| −0.5 (bajista) | 0 | El setup bajista más limpio. La deriva de EOD es bajista sin señal de fade contraria. |
| 0 (apagado) | +0.3 (`bullish_fade`) | Operación de trap independiente, previa a la ventana. Táctica, no estratégica. Tamaño más pequeño, stop más ajustado. |
| 0 | 0 | El estado por defecto durante la mayor parte de la jornada de trading. Ambas señales están diseñadas para activarse solo en puntos de inflexión estructural específicos. |

---

## Constantes fijas que conviene conocer

Para los traders que ejecutan sus propios backtests o dimensionan operaciones frente a estas señales, vale la pena tener presentes algunos números mágicos. No son arbitrarios — cada uno refleja una decisión de calibración empírica.

| Constante | Por defecto | Dónde se usa |
|----------|---------|------------|
| Normalizador de charm | $20M | EOD Pressure — satura charm_score en ±1.0 |
| Saturación del pin | 0.3% | EOD Pressure — satura pin_score en ±1.0 |
| Saturación long-gamma | $1B net GEX | Trap Detection — `long_gamma_factor` pleno a este nivel |
| Saturación de fortalecimiento | +2% de delta GEX | Trap Detection — `strengthening_factor` pleno a este nivel |
| Saturación del GEX boost | ±5% de delta GEX | Trap Detection — bonificación de magnitud plena |
| Sensibilidad de migración del wall | 0.05% | Trap Detection — disparador del descuento por wall-tracking-with-price |
| Piso del buffer de breakout | 0.1% | Trap Detection — filtro mínimo de ruido |
| Inicio de la rampa temporal | 14:30 ET | EOD Pressure — activación más temprana |
| Rampa temporal plena | 15:45 ET | EOD Pressure — plena fuerza hasta el cierre |

Todos estos valores son configurables mediante variables de entorno en el backend, pero los valores por defecto reflejan lo que ha funcionado en productos de índice de clase SPX/SPY con cadenas 0DTE profundas y activas. Los subyacentes menos líquidos pueden necesitar umbrales más bajos.

---

## Notas prácticas de trading

Algunos patrones se repiten con suficiente frecuencia como para merecer una mención directa:

**La inflexión de las 15:30.** EOD Pressure cruza la rampa 0.8× a las 15:30 ET. Si los términos charm y pin han estado en concordancia durante la ventana temprana de la rampa, la convicción tiende a consolidarse alrededor de esa hora. Posicionarse antes, no después.

**El quad witching no es contexto opcional.** El amplificador 2.0× en los días de quad witching es lo bastante grande como para empujar una señal sin amplificar de +0.4 hasta +0.8. Trata esos días como si tuvieran una convicción estructuralmente más alta — y un riesgo de whipsaw estructuralmente más alto en las horas previas a que se abra la ventana.

**Trap Detection sin confirmación de long-gamma debería ignorarse.** Que `long_gamma_factor` anule todo el lado es el guardarraíl individual más importante de la señal. Si el régimen general es short-gamma — incluso si el score resulta no ser cero en un caso límite de datos faltantes — la tesis de la trampa no se sostiene. Verifica el régimen.

**La desaceleración del flujo es la señal más limpia de trap-fade.** Cuando el flujo direccional se está *agotando* dentro del breakout, el multiplicador de flujo aumenta la convicción en un 10%. Ese es el momento en que funcionan la mayoría de las operaciones de trap-fade. Un flujo que acelera dentro del breakout significa participantes reales — la tesis de la trampa está equivocada aunque el resto de las condiciones cuadren.

---

## Conclusión final

> **EOD Pressure y Trap Detection permanecen en silencio la mayor parte del día. Ese es precisamente el punto.**

No están diseñadas para darte una lectura continua. Están diseñadas para reconocer los dos momentos estructurales en los que la mecánica de hedging de los dealers domina el tape — la ventana de cierre y el momento del breakout fallido — y cuantificar el sesgo direccional que cada uno produce.

Para un trader técnico serio, el uso correcto no es "observar el score". Es:

- **Conocer el régimen antes de que las señales importen.** Long-gamma o short-gamma. Fortaleciéndose o deshaciéndose.
- **Confiar en el silencio.** Una lectura en cero fuera de la ventana o fuera del régimen es información, no ausencia de información.
- **Confirmar en la inflexión.** Cuando ambas señales se activan en la misma dirección dentro de la ventana EOD, la lectura estructural es genuinamente fuerte. Cuando discrepan, esa propia discrepancia es un dato.

El hedging de los dealers no es todo el mercado. Pero durante los últimos 90 minutos de la sesión de contado — y durante las breves ventanas en las que el precio pone a prueba los niveles de posicionamiento de los dealers — es la fuerza dominante en el tape. Estas dos señales son la lente.

---

## Próximos pasos

Si quieres llevar el framework más lejos, las extensiones naturales son:

- Superponer EOD Pressure sobre la desviación del VWAP intradía para detectar conflictos entre deriva y mean-reversion.
- Contrastar el factor `wall_migration` de Trap Detection con la evolución de tu propio mapa de calor de gamma — cuando el wall se está moviendo, la tesis de la trampa es frágil.
- Rastrear la relación entre el signo del charm en el spot y el desequilibrio de flujo 0DTE — deberían coincidir generalmente, y las divergencias son diagnósticas.
- En días de OpEx y quad witching, estudiar el setup previo a la ventana: ¿dónde se sitúa el charm a las 13:00 ET, y cómo evoluciona hasta la activación de las 14:30?

El objetivo no es mecanizar la operación — es desarrollar una intuición sobre *en qué tipo de régimen de mercado te encuentras*, y luego dejar que estas dos señales confirmen o contradigan tus lecturas en los momentos en que el flujo de los dealers es lo bastante fuerte como para escucharse.
