# GEX y el Gamma Flip — Cómo los calcula ZeroGEX

*Una explicación en lenguaje sencillo del perfil de exposición gamma de los dealers, del resolver que lo convierte en un nivel accionable, y de cómo se compara la metodología con la de otros proveedores populares.*

---

## Qué es realmente el "gamma de los dealers"

Los creadores de mercado (los "dealers") están en el lado opuesto de cada opción que negocias. Cuando compras una call, un dealer te la vende. Para mantenerse neutrales direccionalmente, se cubren comprando o vendiendo el subyacente. A medida que el precio de la acción se mueve, el ratio de cobertura de la opción (delta) cambia, por lo que el dealer tiene que seguir recomprando o revendiendo.

El **gamma** es la velocidad a la que cambia esa necesidad de cobertura. El **GEX** ("gamma exposure") traduce el gamma de toda la cadena de opciones a dólares — aproximadamente, *la cantidad en dólares de subyacente que los dealers necesitan negociar por cada movimiento del 1% en la acción.*

Existen dos regímenes, separados por un único nivel de precio llamado el **gamma flip**:

- **Por encima del flip — dealers net long gamma.** Cuando la acción sube, venden; cuando baja, compran → efecto mean-reverting / que suprime la volatilidad.
- **Por debajo del flip — dealers net short gamma.** Cuando la acción sube, compran; cuando baja, venden → efecto que amplifica el momentum / que expande la volatilidad.

---

## Cómo lo calculamos (y por qué de esta manera)

El elemento central es una única curva: el **perfil de gamma de los dealers con desplazamiento del spot (spot-shift)**.

1. Toma la instantánea de hoy de la cadena de opciones.
2. Imagina la acción en cada precio de una cuadrícula que abarca aproximadamente ±20% del spot (en pasos del 0,25% del spot — unos cuantos cientos de puntos de cuadrícula).
3. En cada precio de la cuadrícula, **vuelve a calcular el gamma de cada opción** con Black-Scholes (el gamma en sí mismo es función del spot, así que no se puede usar el valor estático de la instantánea).
4. Multiplica el gamma de cada contrato por `OI × 100 × S² × 0.01` (la convención de la industria "dollar GEX por movimiento del 1%" que usan SpotGamma / SqueezeMetrics / Cheddar Flow) y aplica la convención de signo de los dealers (calls +, puts −).
5. Pondera cada contrato con `min(1, DTE / 5 days)` — una rampa de ocupación de horizonte para que un muro 0DTE del mismo día (que conlleva un pico de gamma colosal en `1/√T`) no pueda fijar un nivel de régimen de varios días.
6. Suma a lo largo de toda la cadena → una curva, *dealer dollar gamma frente al spot hipotético.*

De esa **misma** curva salen dos lecturas:

- **Gamma Flip** = el precio donde la curva cruza el cero (el cruce accionable).
- **Net GEX en spot** = el valor de la curva al precio de hoy.

Como ambas provienen de una única curva, el número principal de GEX y el régimen spot-vs-flip *nunca pueden contradecirse* entre sí — es un invariante estructural del cálculo. Por eso lo construimos así. El viejo atajo de "acumular el gamma estático por strike" (que todavía usan varios proveedores) podía darte un número de net GEX positivo mientras te decía que el spot estaba por debajo del flip — incoherente.

---

## El resolver de flip reforzado

El simple cruce por cero no basta por sí solo — había que defenderse de tres modos de fallo reales:

1. **Cruces en el borde de la cuadrícula.** El gamma decae hacia ~0 en los extremos de la cuadrícula, así que un desequilibrio mínimo puede invertir el signo ahí → **Interior gate**: un cruce debe situarse a ≥10% del ancho de la cuadrícula de distancia de cualquiera de los bordes.
2. **Cruces en el suelo de ruido** (artefactos de apertura matutina / picos de IV). Cuando el gamma de toda la cadena está degradado, el perfil deriva a través del cero en una región de bajo señal → **Structural gate**: el pico local |profile| de un candidato debe ser ≥ 2% de una referencia robusta (el p90 de |profile| sobre una banda canónica de ±15%, restringida a puntos de cuadrícula cercanos a un strike con OI > 0 real).
3. **Cruces lejos del spot.** Un cruce estructuralmente válido pero un 20% por debajo del spot no es accionable en ningún horizonte razonable → **Actionable-distance gate**: los candidatos a más del 8% del spot son rechazados.

Si la cuadrícula de ±20% no arroja ningún cruce cualificado, el resolver **expande la cuadrícula** a ±35%, y luego a ±50% (una escalera adaptativa). Si ningún peldaño cualifica, el flip se reporta como **no resuelto (NULL + WARN)** — con honestidad, en lugar de fabricar un valor límite o congelar uno obsoleto.

---

## En qué se diferencia de los sitios populares

| Sitio | Método | Ventajas | Desventajas |
| --- | --- | --- | --- |
|! **ZeroGEX (este codebase)** | Perfil de gamma de los dealers con spot-shift, escalera adaptativa de cuadrícula, gates de aceptación interior / estructural / de distancia accionable, ponderación de ocupación de horizonte DTE, NULL honesto en cadenas degradadas | La definición publicada de la industria; número principal consistente en signo (flip y net-GEX-en-spot se leen de una misma curva); reforzado contra artefactos de cadena degradada, cercanos al borde y lejanos al spot; los endpoints multi-horizonte exponen flips de 1d / 5d / 20d a partir de un único primitivo | Más cómputo por ciclo (recalcula las griegas de la cadena a través de una cuadrícula, a veces en varios peldaños de la escalera); más parámetros ajustables (agrupados en perfiles `default` / `strict` / `lenient` para mantener reducida la superficie); simplificación de volatilidad sticky-strike (un re-desplazamiento completo de la superficie de volatilidad queda fuera de alcance) |
| **SpotGamma** | Perfil de gamma de los dealers con spot-shift (la definición canónica / original) | Referencia de la industria para la definición; linaje de investigación publicado | Metodología cerrada; también sticky-strike; el flip reportado es de un único horizonte |
| **SqueezeMetrics** | Perfil de gamma de los dealers con spot-shift (la otra fuente canónica) | El paper original de DIX / GEX es la referencia pública de esta construcción | Producto retail mayormente de cadencia diaria; no en tiempo real |
| **Unusual Whales** | Agregación de GEX por strike (acumula gamma × OI por strike) | Barato de calcular; muy rápido; gráfico de barras por strike intuitivo | No es la definición spot-shift — un nivel "zero gamma" acumulativo por strike es una aproximación retail; se congela cuando el verdadero zero-gamma está fuera de la banda de strikes ingerida |
| **Cheddar Flow** | Agregación de GEX por strike | Igual que UW — rápido e intuitivo | Misma advertencia — no es la definición spot-shift |

La mayor diferencia práctica: **los proveedores que agregan por strike te darán un "flip" que se queda pegado a un muro mientras ese muro esté en su instantánea, incluso cuando el verdadero nivel de zero-gamma esté varios puntos porcentuales de distancia.** Vimos exactamente ese síntoma en nuestros propios datos históricos antes de la reescritura — el flip persistido se quedaba plano durante horas. Recalcular precios en una cuadrícula más amplia lo soluciona.

La segunda diferencia es la **honestidad sobre datos degradados**: la mayoría de los proveedores mantiene silenciosamente el último valor conocido cuando su feed se vuelve obsoleto. Nosotros persistimos NULL y emitimos una advertencia de salud (health warning) en su lugar, para que un feed degradado sea visible en vez de estar oculto.
