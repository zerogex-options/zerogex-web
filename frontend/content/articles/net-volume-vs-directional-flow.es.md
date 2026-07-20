# Net Volume vs Directional Flow: ¿qué es lo que realmente importa en el tape de opciones?

*La mayoría de los traders debate entre el put/call volume y el directional flow. Los profesionales suelen tratar eso como el primer paso, para luego pasar rápidamente a la conviction ponderada por premium.*

---

## La respuesta honesta: ninguna de las dos es un estándar de oro por sí sola

Si buscas una métrica perfecta única, te vas a decepcionar.

**Cumulative Net Volume** y **Cumulative Net Directional Volume** son ambas útiles, pero responden a preguntas distintas. Los desks de flow más serios suelen monitorear ambas, y luego dan más peso a las métricas de premium a la hora de calibrar la conviction.

---

## Métrica 1: **Cumulative Net Volume**

*(Call Volume − Put Volume)*

Esto es, en esencia, el enfoque inverso del clásico put/call ratio.

Se usa ampliamente porque es simple, rápida y está disponible en todas partes. Pero también es tosca.

La debilidad central: **no puede decirte quién inició el trade ni por qué.**

Un repunte en el call volume podría significar:
- especulación direccional al alza,
- covered call overwriting,
- gestión de inventario por parte del dealer,
- o actividad de hedge roll.

El volumen por sí solo no puede separar la conviction de la mecánica.

---

## Métrica 2: **Cumulative Net Directional Volume**

*((Calls Bought − Calls Sold) − (Puts Bought − Puts Sold))*

Esta métrica intenta responder a la pregunta más relevante:

> **¿Quién fue el agresor?**

Cuando los traders levantan el ask, normalmente están expresando urgencia e intención direccional. Cuando golpean el bid, suelen estar reduciendo riesgo, cobrando premium o haciendo fade.

En teoría, esto hace que el directional volume sea más informativo que el volumen bruto.

Pero tiene una debilidad real: **la clasificación del lado del trade es imperfecta.**

La mayoría de los sistemas infieren la intención de comprador/vendedor a partir de la proximidad al bid/ask. Eso falla cuando:
- los bloques se imprimen cerca del mid,
- ocurren cruces negociados fuera de pantalla,
- o ejecuciones dark/complejas no se mapean limpiamente a las cotizaciones lit.

Irónicamente, esos trades "desordenados" suelen ser los prints institucionales más significativos.

---

## En qué se enfocan realmente los equipos de flow profesionales

### Premium, no contratos.

Un lote de 50.000 en calls semanales baratas tipo lotería puede parecer enorme en volumen, pero representar un capital modesto. Un lote de 500 en contratos deep ITM puede conllevar un riesgo nocional e información dramáticamente mayores.

Por eso los desks tienden a priorizar el **flow ponderado por capital**, no el conteo de contratos.

Tu campo:

**Cumulative Net Premium**

`= (calls bought premium − calls sold premium) − (puts bought premium − puts sold premium)`

suele ser una lectura individual más sólida sobre hacia dónde se está inclinando el dinero informado, porque refleja los dólares realmente comprometidos.

---

## Clasificación práctica para la conviction

Si el objetivo es la calidad de la conviction direccional:

1. **Net directional premium** (la mejor señal individual)
2. **Net directional volume** (mejor que el volumen bruto)
3. **Net volume** (contexto útil, el más débil de forma aislada)

O en una línea:

> **El Net Directional Volume supera al Net Volume en términos de conviction, pero el Net Directional Premium es lo que los desks de flow más serios suelen ponderar más.**

---

## Cómo usar esto en un flujo de trabajo en vivo

Una secuencia práctica que los traders pueden aplicar intradía:

- Empieza con el **net volume** para leer la participación general.
- Confirma con el **net directional volume** para estimar la intención del agresor.
- Valida con el **net directional premium** antes de comprometer riesgo.
- Si el volumen y el premium están en desacuerdo, confía en los dólares antes que en los contratos.

Ningún panel único debería guiar todo tu árbol de decisión. Pero el directional flow ponderado por premium normalmente te mantendrá más cerca de la señal del "dinero informado" y más lejos de los prints ruidosos de titulares.
