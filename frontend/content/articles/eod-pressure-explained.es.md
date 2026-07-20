# Señal EOD Pressure explicada: cómo leer el cierre

*El análisis práctico en profundidad sobre la señal EOD Pressure de ZeroGEX — qué pregunta responde, por qué el cierre tiene una deriva estructural, cómo combina el score charm y pin gravity, y cómo leerla dentro de los últimos 90 minutos.*

---

## Por qué existe esta señal

Los últimos 90 minutos de la sesión de contado son estructuralmente distintos del resto de la jornada. El decaimiento de charm en las posiciones 0DTE obliga a los dealers a cubrirse de forma continua. La pin gravity alrededor de los strikes con gamma elevado se intensifica. El book del dealer está más restringido que en cualquier otro momento de la sesión.

Esas fuerzas no son aleatorias. Son direccionales y se pueden leer — *si* sabes qué buscar. La señal EOD Pressure existe para sacar a la superficie esa deriva direccional en tiempo real, de modo que los traders puedan posicionarse a favor del flujo de cierre en lugar de luchar contra él.

Este artículo es la lectura orientada al trader de la señal EOD Pressure. Cubre qué mide, por qué el cierre es diferente, cómo se construye el score a partir de charm y pin gravity, y cómo leerla dentro de la ventana. Para el artículo más profundo sobre la metodología combinada que empareja EOD Pressure con Trap Detection, consulta [Trading the Close](/education/eod-pressure-and-trap-detection); para la mecánica subyacente, [Vanna and Charm Explained](/education/vanna-and-charm-explained) explica en detalle cómo el charm impulsa la cobertura forzada.

---

## ¿Qué es la señal EOD Pressure?

La señal EOD Pressure plantea una sola pregunta:

> Dado el book actual del dealer y la proximidad de un strike imán, ¿en qué dirección empuja la cobertura forzada al precio hacia el cierre?

Es una señal **Advanced** dentro del stack de ZeroGEX — produce tanto un score continuo en la recta numérica [-1, +1] como un disparo discreto cuando el score absoluto supera **0.20**. El umbral es deliberadamente más bajo que el de otras señales Advanced porque el propio contexto estructural (la ventana de cierre) ya actúa como filtro — cuando EOD Pressure marca 0.15+ dentro de la ventana activa, ya resulta informativo a nivel direccional.

Sesgo de trading: **lectura direccional**. La señal indica hacia dónde se inclina la presión — por sí sola no prescribe si conviene acompañar el movimiento o fadearlo. Eso depende del contexto de régimen.

---

## Por qué el cierre es diferente

Tres mecanismos estructurales se combinan en la ventana final de la sesión:

1. **El decaimiento de charm se acelera.** A medida que las opciones 0DTE se acercan al vencimiento, su delta deriva de forma predecible hacia 0 o 1. Los dealers que gestionan un book delta-neutral tienen que recubrirse de forma continua, y el ritmo de esa recobertura *aumenta* a medida que se acerca el cierre.
2. **La pin gravity se intensifica.** Los strikes con gamma elevado tiran del precio con más fuerza a medida que se reduce el tiempo hasta el vencimiento. En un régimen de gamma larga, el magnetismo hacia el strike pesado más cercano se refuerza a lo largo de la tarde.
3. **La liquidez se adelgaza.** Los flujos en bloque, el rebalanceo de fin de día y las órdenes estructurales sobre índices desplazan el perfil del flujo de continuo a intermitente. Los dealers tienen menos margen para absorber errores.

EOD Pressure combina los dos primeros factores en una lectura direccional. El tercero está implícito en la calibración del score.

---

## Los cuatro componentes principales

La señal agrega cuatro componentes — tres contribuyen a la magnitud, uno actúa como puerta rígida.

### Componente 1: Charm en spot

La medida más directa del flujo de cobertura forzada. La señal suma la exposición a charm del dealer en una banda at-the-money escalada por volatilidad, ponderada por bucket de vencimiento:

| Bucket | Peso | Por qué |
|---|---|---|
| 0DTE | 0.70 | El charm golpea con más fuerza el día del vencimiento. Contribuyente dominante. |
| Weekly | 0.20 | Relevante pero secundario. |
| Monthly | 0.10 | Contribución de fondo. |
| LEAPS | 0.00 | Demasiado lejano como para importar para el cierre de hoy. |

El agregado está normalizado de manera que ±$20M de charm de dealer por bucket saturan el sub-score en ±1.0.

### Componente 2: Pin gravity

El término pin codifica la atracción del strike imán, dependiente del régimen:

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

Un pin target 0.3% por encima del spot en un régimen de gamma positiva da un pin score de +1.0 — el imán está arriba y la gravedad está activa. En un régimen de gamma negativa, ese mismo pin por encima del spot produce un pin score *negativo*, porque la cobertura del dealer ahora amplifica los movimientos *alejándose* del strike.

Ese cambio de signo es la clave. La pin gravity no es un nivel fijo. Es una fuerza dependiente del signo, cuya dirección depende del régimen de gamma.

### Componente 3: Rampa temporal (la puerta)

La rampa es multiplicativa. Antes de las **14:30 ET**, es exactamente cero — toda la señal queda en cortocircuito.

| Hora (ET) | Rampa |
|---|---|
| Antes de las 14:30 | 0.00 |
| 14:30 | 0.00 |
| 14:45 | 0.20 |
| 15:00 | 0.40 |
| 15:30 | 0.80 |
| 15:45 – 16:00 | 1.00 |

Por eso EOD Pressure marca cero durante la mayor parte de la jornada de trading. La señal está estructuralmente inactiva fuera de la ventana.

### Componente 4: Amplificador de calendario

El amplificador aumenta la convicción en las fechas en las que el posicionamiento se concentra:

| Calendario | Amp |
|---|---|
| Día normal | 1.0× |
| OPEX mensual (tercer viernes) | 1.5× |
| Quad witching (tercer viernes de mar/jun/sep/dic) | 2.0× |

Este es el único punto de la señal en el que el score intermedio puede superar ±1 — el clamp final lo devuelve al rango.

---

## Cómo se calcula el score

La agregación final:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

La ponderación 60/40 refleja una postura decidida: **el charm es la medida directa del flujo de cobertura forzada**, mientras que **la pin gravity es la atracción indirecta, dependiente del régimen**. Ambos importan. El charm lidera.

---

## Interpretación del score

| Score | Lectura |
|---|---|
| +0.6 a +1.0 | Se espera una fuerte deriva alcista hacia el cierre |
| +0.2 a +0.6 | Deriva alcista leve — el sesgo intradía favorece mantener posiciones largas, pero sin aumentar el tamaño de forma agresiva |
| -0.2 a +0.2 | Sin edge — o es demasiado pronto dentro de la ventana, o los términos se cancelan entre sí |
| -0.2 a -0.6 | Deriva bajista leve |
| -0.6 a -1.0 | Se espera una fuerte deriva bajista hacia el cierre |

El umbral de disparo es **0.20** — más bajo que el habitual 0.25 — porque es la propia ventana la que hace el filtrado.

---

## Cuándo se dispara la señal y cuándo permanece en silencio

El estado dominante es el **silencio**. Durante la mayor parte de la jornada de trading, EOD Pressure está en cero — y ese cero es *informativo*, no "neutro". Significa que la ventana activa aún no ha comenzado.

La señal también puede marcar cero dentro de la ventana cuando:

- No hay strikes dentro de la banda ATM escalada por volatilidad en una cadena de opciones dispersa o con poca cotización.
- Tanto `max_pain` como `max_gamma_strike` son nulos.
- El pin target está exactamente en el spot.
- Los scores de charm y pin se cancelan entre sí — algo raro, que requiere direcciones opuestas y magnitudes aproximadamente iguales.

Un 0 fuera de la ventana es normal. Un 0 dentro de la ventana es informativo — *hoy EOD Pressure no tiene nada que aportar.*

---

## Qué hace un trader con esto

Tres patrones de trabajo:

### 1. Preparación antes de la ventana

Antes de las 14:30 ET, EOD Pressure es cero por construcción. Usa el tiempo previo a la ventana para identificar cuál *será* el setup estructural: ¿dónde está el gamma máximo, dónde está el gamma flip, en qué régimen estamos, dónde está el spot respecto al pin target? Cuando la ventana se abra, la señal no te sorprenderá — confirmará o contradirá la lectura que ya has construido.

### 2. La inflexión de las 15:30

EOD Pressure cruza la rampa de 0.8× a las 15:30 ET. Si los términos de charm y pin han estado de acuerdo durante la ventana temprana de la rampa (14:45–15:30), la convicción tiende a consolidarse en torno a las 15:30. Posiciónate antes, no después.

### 3. El quad witching es contexto estructural

El amplificador de 2.0× en los días de quad witching es lo bastante grande como para empujar una señal sin amplificar de +0.4 hasta +0.8 amplificado. Trata esos días como si tuvieran una convicción estructuralmente más alta — y un riesgo de whipsaw estructuralmente más alto en la parte temprana del día, antes de que se abra la ventana.

---

## Leer EOD Pressure junto con otras señales

EOD Pressure es una **lectura direccional** — indica hacia dónde apunta la presión sin prescribir por sí sola si conviene acompañar o fadear. La decisión de fadear versus acompañar viene del régimen:

- **Régimen de gamma positiva + score de EOD Pressure positivo:** la deriva es alcista, la cobertura del dealer está amortiguando, la lectura favorece fadear los rallies hacia el strike imán para capturar la deriva hacia el pin.
- **Régimen de gamma negativa + score de EOD Pressure positivo:** la señal está leyendo un sesgo alcista impulsado por charm, pero en un régimen de gamma corta el reflejo del dealer amplifica en lugar de absorber — la continuación del momentum es más probable.

Combinado con otras señales:

- **EOD Pressure + Trap Detection en la misma dirección:** el setup de alta convicción más común. La deriva de EOD confirma un fade de ruptura fallida.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) en la misma dirección:** comprimido hacia el cierre con una deriva impulsada por charm que lo confirma. Setup de continuación robusto.
- **EOD Pressure ≠ 0 dentro de la ventana sin otras señales activas:** la deriva estructural es la única lectura disponible. Tamaño menor, tratarlo como una inclinación direccional en lugar de un trade de alta convicción.

---

## Errores de lectura comunes

Tres trampas:

- **Tratar un cero previo a la ventana como "hoy no hay señal".** La ventana aún no se ha abierto. La señal está *estructuralmente inactiva*, no carente de información.
- **Ignorar el cambio de signo por régimen en la pin gravity.** Un strike pesado por encima del spot atrae *hacia arriba* en un régimen de gamma larga y *repele hacia abajo* en un régimen de gamma corta. El mismo nivel del gráfico significa cosas opuestas en ambos regímenes.
- **Operar el score en bruto sin considerar la rampa.** Una lectura de +0.4 a las 14:45 (rampa 0.20) es en realidad un score efectivo de +0.08. Lee la magnitud ajustada por la rampa, no el score de entrada en bruto.

---

## Cómo muestra ZeroGEX la señal EOD Pressure

El dashboard la muestra en varios lugares:

- **La tarjeta de EOD Pressure** muestra el score en vivo, el estado del disparo y el desglose por componentes (contribuciones de charm frente a pin).
- **El Composite Signal Score** integra EOD Pressure como uno de sus inputs.
- **El Trade Stream** marca los trades del playbook filtrados por `eod_pressure` cuando se disparan.

*[Marcador de imagen: tarjeta de EOD Pressure de ZeroGEX con score, componentes y estado de la rampa durante la ventana activa — colocar el archivo en /public/blog/zerogex-eod-pressure-card.png]*

Un ejemplo práctico. El SPX está en 5,825 a las 15:15 ET en un viernes de OPEX mensual y ZeroGEX muestra:

- **EOD Pressure:** -0.55 (disparado bajista)
- **Net GEX:** +$1.2B (positivo)
- **Gamma Flip:** el spot está en +15 (por encima del flip)
- **Max Pain:** 5,810 (por debajo del spot)
- **Charm en spot:** moderadamente negativo (ventas acumulándose)
- **Amp de calendario:** 1.5× (OPEX mensual)

La lectura estructural: régimen de gamma positiva con un imán pesado 15 puntos por debajo del spot, la cobertura impulsada por charm apunta a la baja, y el amplificador de OPEX está potenciando la convicción. Inclinación práctica: la deriva hacia 5,810 es el camino de mayor probabilidad hacia el cierre. El trade no es EOD Pressure en sí mismo — es un posicionamiento coherente con la dirección de la deriva, con un tamaño calibrado según la lectura de alta convicción del OPEX.

---

## Conclusión

> EOD Pressure te dice hacia dónde apunta la cobertura forzada en la ventana de cierre. No te dice nada sobre el resto de la jornada. Ese silencio es precisamente el punto.

La disciplina consiste en usarlo como lectura direccional para los últimos 90 minutos, contrastarlo con el régimen para decidir entre acompañar o fadear, y validarlo frente a las demás señales Advanced en busca de confluencia. Fuera de la ventana, hay que mirar en otro lado.

Solo contenido educativo — nada de lo anterior constituye una recomendación de trading.

---

Si quieres ver la lectura de EOD Pressure de hoy en tiempo real durante la ventana activa, junto con Trap Detection y el contexto de régimen, el dashboard gratuito de ZeroGEX lo muestra todo.
