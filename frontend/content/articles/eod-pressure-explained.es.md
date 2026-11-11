# Señal EOD Pressure explicada: cómo leer el cierre

*El análisis práctico en profundidad sobre la señal EOD Pressure de ZeroGEX - qué pregunta responde, por qué el cierre tiene una deriva estructural, cómo combina el score charm y pin gravity, y cómo leerla dentro de los últimos 90 minutos.*

---

## Por qué existe esta señal

Los últimos 90 minutos de la sesión de contado son estructuralmente distintos del resto de la jornada. El decaimiento de charm en las posiciones 0DTE tiende a empujar a los dealers a recubrirse de forma más activa. La pin gravity alrededor de los strikes con gamma elevada puede intensificarse. El book modelado de los dealers está más restringido que en casi cualquier otro momento de la sesión.

Esas fuerzas suelen ser direccionales y legibles - *si* sabes qué buscar. La señal EOD Pressure está diseñada para sacar a la superficie esa deriva direccional modelada en tiempo real, de modo que los traders puedan posicionarse a favor del flujo de cierre en lugar de luchar contra él.

Este artículo es la lectura orientada al trader de la señal EOD Pressure. Cubre qué mide, por qué el cierre es diferente, cómo se construye el score a partir de charm y pin gravity, y cómo leerla dentro de la ventana. Para el artículo más profundo sobre la metodología combinada que empareja EOD Pressure con Trap Detection, consulta [Trading en el cierre](/education/eod-pressure-and-trap-detection); para la mecánica subyacente, [Vanna y charm explicados](/education/vanna-and-charm-explained) explica en detalle cómo el charm impulsa los flujos de cobertura modelados.

---

## ¿Qué es la señal EOD Pressure?

La señal EOD Pressure plantea una sola pregunta:

> Dado el book modelado de los dealers y la proximidad de un strike imán, ¿hacia qué lado se inclina la cobertura modelada de cara al cierre?

Es una señal **Advanced** dentro del stack de ZeroGEX - produce tanto un score continuo en la escala de -100 a +100 como un disparo discreto cuando el score cruza **±20**. El umbral es deliberadamente más bajo que el de la mayoría de las señales Advanced (±25) porque el contexto estructural (la ventana de cierre) ya actúa como filtro - cuando EOD Pressure marca 15 o más en cualquier dirección dentro de la ventana activa, ya es direccionalmente informativo. Como todas las señales Advanced, forma parte de Pro.

Sesgo de trading: **lectura direccional**. La señal indica hacia dónde se inclina la presión - por sí sola no prescribe si conviene acompañar el movimiento o fadearlo. Eso depende del contexto de régimen.

---

## Por qué el cierre es diferente

Tres mecanismos estructurales se combinan en la ventana final de la sesión:

1. **El decaimiento de charm se acelera.** A medida que las opciones 0DTE se acercan al vencimiento, su delta tiende a derivar hacia 0 (out-of-the-money) o ±1 (in-the-money), manteniendo constantes los demás inputs. Los dealers que gestionan un book aproximadamente delta-neutral tienden a recubrirse con más frecuencia, y el ritmo modelado de esa recobertura *aumenta* a medida que se acerca el cierre.
2. **La pin gravity se intensifica.** Los strikes con gamma elevada pueden tirar del precio con más fuerza a medida que se reduce el tiempo hasta el vencimiento. En un régimen modelado de gamma larga, el magnetismo modelado hacia el strike pesado más cercano tiende a reforzarse a lo largo de la tarde.
3. **La liquidez se adelgaza.** Los flujos en bloque, el rebalanceo de fin de día y las órdenes estructurales sobre índices desplazan el perfil del flujo de continuo a intermitente. Los dealers tienen menos margen para absorber errores.

EOD Pressure combina los dos primeros factores en una lectura direccional. El tercero está implícito en la calibración del score.

---

## Los cuatro componentes principales

La señal agrega cuatro componentes - tres contribuyen a la magnitud, uno actúa como puerta rígida.

### Componente 1: Charm en spot

La medida modelada más directa del flujo de cobertura. La señal suma la exposición modelada a charm de los dealers en una banda at-the-money escalada por volatilidad, ponderada por bucket de vencimiento:

| Bucket | Peso | Por qué |
|---|---|---|
| 0DTE | 0,70 | El charm golpea con más fuerza el día del vencimiento. Contribuyente dominante. |
| Semanal | 0,20 | Relevante pero secundario. |
| Mensual | 0,10 | Contribución de fondo. |
| LEAPS | 0,00 | Demasiado lejano como para importar para el cierre de hoy. |

El agregado está normalizado de manera que ±20 millones de $ de charm de dealer por bucket saturan el sub-score en ±1,0.

### Componente 2: Pin gravity

El término pin depende del régimen de gamma modelado:

```
if net_gex >= 0:   # zero or positive gamma: pull toward the magnet
    pin_target   = max_pain  OR  max_gamma_strike
    distance_pct = (pin_target − close) / close
    pin_score    = clip(distance_pct / 0.003, [-1, +1])
else:              # negative gamma: follow the move already underway
    trailing_ret = (latest_close − earliest_close) / earliest_close
    pin_score    = clip(trailing_ret / 0.003, [-1, +1])
```

Un objetivo de pin un 0,3% por encima del spot en un régimen modelado de gamma positiva da una puntuación de pin de +1,0 - el imán está arriba y la gravedad actúa. En un régimen modelado de gamma negativa, la distancia al objetivo no aporta información direccional, así que el término la ignora y lee en su lugar el rendimiento reciente: una subida del 0,3% a lo largo de los últimos cierres también puntúa +1,0, y una caída del 0,3% puntúa -1,0. Si falta el Net GEX, o hay menos de dos cierres utilizables, el término pin es 0.

**Limitación metodológica:** ambas ramas son heurísticas de ZeroGEX con puntos de saturación elegidos a mano, no probabilidades calibradas. La rama de gamma negativa recoge la idea de que la gamma negativa amplifica la dirección ya iniciada; no predice esa dirección.

### Componente 3: Rampa temporal (la puerta)

La rampa es multiplicativa. Antes de las **14:30 ET**, es exactamente cero - toda la señal queda en cortocircuito.

| Hora (ET) | Rampa |
|---|---|
| Antes de las 14:30 | 0,00 |
| 14:30 | 0,00 |
| 14:45 | 0,20 |
| 15:00 | 0,40 |
| 15:30 | 0,80 |
| 15:45 - 16:00 | 1,00 |

Por eso EOD Pressure marca cero durante la mayor parte de la jornada de trading. La señal está estructuralmente inactiva fuera de la ventana.

### Componente 4: Amplificador de calendario

El amplificador aumenta la convicción en las fechas en las que el posicionamiento se concentra:

| Calendario | Amp |
|---|---|
| Día normal | 1,0× |
| OPEX mensual (tercer viernes) | 1,5× |
| Quad witching (tercer viernes de mar/jun/sep/dic) | 2,0× |

Este es el único punto de la señal en el que el score intermedio puede superar ±1 - el clamp final lo devuelve al rango.

---

## Cómo se calcula el score

La agregación final:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

El cálculo se hace en la escala de -1 a +1; la tarjeta y la página de la señal muestran el resultado multiplicado por 100, así que un score de 0,55 aquí aparece como 55 en pantalla.

La ponderación 60/40 es una decisión de diseño elegida a mano, no ajustada a los datos: refleja la visión de que **el charm es la medida modelada más directa del flujo de cobertura**, mientras que **la pin gravity es la atracción indirecta, dependiente del régimen**. Ambos importan en el modelo. El charm lidera.

---

## Interpretación del score

| Score | Lectura |
|---|---|
| +60 a +100 | Fuerte deriva alcista modelada hacia el cierre |
| +20 a +60 | Inclinación positiva del modelo |
| -20 a +20 | Componentes del modelo débiles o que se compensan entre sí |
| -20 a -60 | Inclinación negativa del modelo |
| -60 a -100 | Fuerte deriva bajista modelada hacia el cierre |

El disparo de **±20** es un umbral del modelo seleccionado a mano, no una probabilidad calibrada ni una tasa de acierto esperada. Hace falta una validación histórica antes de tratarlo como una ventaja de rendimiento.

---

## Cuándo se dispara la señal y cuándo permanece en silencio

El estado dominante es el **silencio**. Durante la mayor parte de la jornada de trading, EOD Pressure está en cero - y ese cero es *informativo*, no "neutro". Significa que la ventana activa aún no ha comenzado.

La señal también puede marcar cero dentro de la ventana cuando:

- No hay strikes dentro de la banda ATM escalada por volatilidad en una cadena de opciones dispersa o con poca cotización.
- Tanto `max_pain` como `max_gamma_strike` son nulos.
- El pin target está exactamente en el spot.
- Los scores de charm y pin se cancelan entre sí - algo raro, que requiere direcciones opuestas y magnitudes aproximadamente iguales.

Un 0 fuera de la ventana es normal. Un 0 dentro de la ventana es informativo - *hoy EOD Pressure no tiene nada que aportar.*

---

## Qué hace un trader con esto

Tres patrones de trabajo:

### 1. Preparación antes de la ventana

Antes de las 14:30 ET, EOD Pressure es cero por construcción. Usa el tiempo previo a la ventana para identificar cuál *será* el setup estructural: ¿dónde está la gamma máxima, dónde está el gamma flip, en qué régimen estamos, dónde está el spot respecto al pin target? Cuando la ventana se abra, la señal no te sorprenderá - confirmará o contradirá la lectura que ya has construido.

### 2. La inflexión de las 15:30

EOD Pressure cruza la rampa de 0,8× a las 15:30 ET. Si los términos de charm y pin han estado de acuerdo durante la ventana temprana de la rampa (14:45-15:30), la convicción tiende a consolidarse en torno a las 15:30. Trata esa rampa como un timing del modelo, no como una instrucción para posicionarte antes ni como prueba de que las órdenes de los dealers estén programadas.

### 3. El quad witching es contexto estructural

El amplificador de 2,0× en los días de quad witching es lo bastante grande como para empujar una señal sin amplificar de +40 hasta +80 amplificado. Trata esos días como si tuvieran una convicción estructuralmente más alta - y un riesgo de whipsaw estructuralmente más alto en la parte temprana del día, antes de que se abra la ventana.

---

## Leer EOD Pressure junto con otras señales

EOD Pressure es una **lectura direccional** - indica hacia dónde apunta la presión sin prescribir por sí sola si conviene acompañar o fadear. La decisión de fadear versus acompañar viene del régimen:

- **Régimen modelado de gamma positiva + score de EOD Pressure positivo:** la deriva modelada es alcista, se modela que la cobertura de los dealers amortigua, la lectura favorece posicionarse *a favor* de la deriva hacia el strike imán - comprando la debilidad en lugar de fadearla - y fadear solo los sobreimpulsos más allá del imán.
- **Régimen modelado de gamma negativa + score de EOD Pressure positivo:** el score combina un sesgo impulsado por el charm con el movimiento reciente (en gamma negativa, el término pin sigue la dirección ya iniciada), y se modela que el reflejo de los dealers amplifica en lugar de absorber - la continuación del momentum es más probable.

Combinado con otras señales:

- **EOD Pressure + Trap Detection en la misma dirección:** el setup de alta convicción más común. La deriva de EOD confirma un fade de ruptura fallida.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) en la misma dirección:** comprimido hacia el cierre con una deriva impulsada por charm que lo confirma. Setup de continuación robusto.
- **EOD Pressure ≠ 0 dentro de la ventana sin otras señales activas:** la deriva estructural es la única lectura disponible. Tamaño menor, tratarlo como una inclinación direccional en lugar de un trade de alta convicción.

---

## Errores de lectura comunes

Tres trampas:

- **Tratar un cero previo a la ventana como "hoy no hay señal".** La ventana aún no se ha abierto. La señal está *estructuralmente inactiva*, no carente de información.
- **Ignorar el cambio de régimen en la pin gravity.** La atracción hacia el objetivo en gamma positiva es una heurística del modelo. En gamma negativa, el término pin deja de mirar el objetivo y sigue en su lugar el movimiento reciente - también una heurística propia, no una certeza mecánica.
- **Operar el score en bruto sin considerar la rampa.** Una lectura de +40 a las 14:45 (rampa 0,20) es en realidad un score efectivo de +8. Lee la magnitud ajustada por la rampa, no el score de entrada en bruto.

---

## Cómo muestra ZeroGEX la señal EOD Pressure

El dashboard la muestra en varios lugares:

- **La tarjeta de EOD Pressure** muestra el score en vivo, el estado del disparo y el desglose por componentes (contribuciones de charm frente a pin).
- **El Event Timeline** en la página de la señal muestra la trayectoria reciente del score, con los cambios de dirección marcados.
- **Signal Breadth** en el panel Señales Propietarias del dashboard lo cuenta como uno de los votos direccionales. (No es un input del Composite MSI, que se construye a partir de sus propios seis componentes.)

Un ejemplo práctico. El SPX está en 5.825 a las 15:15 ET en un viernes de OPEX mensual y ZeroGEX muestra:

- **EOD Pressure:** -55 (disparado bajista)
- **Net GEX:** +1.200 millones de $ (positivo)
- **Gamma Flip:** el spot está en +15 (por encima del flip)
- **Max Pain:** 5.810 (por debajo del spot)
- **Charm en spot:** moderadamente negativo (ventas acumulándose)
- **Amp de calendario:** 1,5× (OPEX mensual)

La lectura estructural: régimen modelado de gamma positiva con un imán pesado 15 puntos por debajo del spot, la cobertura modelada impulsada por charm apunta a la baja, y el amplificador de OPEX está potenciando el score. Inclinación práctica: según la lectura del modelo, la deriva hacia 5.810 es el camino que el modelo favorece de cara al cierre. El trade no es EOD Pressure en sí mismo - es un posicionamiento coherente con la dirección de la deriva, con un tamaño calibrado según la lectura modelada del OPEX.

---

## Conclusión

> EOD Pressure está diseñada para estimar hacia qué lado se inclina la cobertura modelada en la ventana de cierre. No te dice nada sobre el resto de la jornada. Ese silencio es precisamente el punto.

La disciplina consiste en usarlo como lectura direccional para los últimos 90 minutos, contrastarlo con el régimen para decidir entre acompañar o fadear, y validarlo frente a las demás señales Advanced en busca de confluencia. Fuera de la ventana, hay que mirar en otro lado.

Solo contenido educativo - nada de lo anterior es una recomendación de trading.

---

Si quieres ver la lectura de EOD Pressure de hoy en tiempo real durante la ventana activa, junto con Trap Detection y el contexto de régimen, ZeroGEX Pro lo muestra todo en el Panel de señales avanzado.
