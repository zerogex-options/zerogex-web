# Facturación y Portal de Stripe

*Cómo funciona la facturación a través de Stripe, mensual vs. trimestral vs. anual, la prueba gratuita y la garantía de devolución del dinero, el cambio de nivel, los métodos de pago y las facturas.*

---

## Cómo funciona la facturación

ZeroGEX factura a través de **Stripe**. No vemos ni almacenamos los datos de tu tarjeta de pago — Stripe se encarga de todo eso. Cada acción de facturación se realiza en el portal de facturación alojado por Stripe, al que se accede desde tu página de [Account](/account).

## Planes y periodicidades

Dos niveles — **Basic** y **Pro** — cada uno disponible en modalidad **mensual**, **trimestral** (facturado cada 3 meses) o **anual**.

- Cuanto más largo es el periodo de facturación, menos pagas al mes. La página de [Pricing](/pricing) muestra cada plan como equivalente mensual para que puedas compararlos directamente, con el importe realmente facturado debajo.
- El cambio entre periodicidades es compatible a través del portal.

## Prueba gratuita (Basic mensual)

Basic mensual empieza con una **prueba gratuita de 7 días**: acceso completo desde el primer momento, tu tarjeta registrada y ningún cargo hasta que termine la prueba. Al final de la prueba, la suscripción continúa automáticamente a la tarifa con la que te registraste — sin un segundo paso de confirmación.

Para evitar esa renovación automática: cancela en el portal antes de que finalice la prueba. Conservarás el acceso hasta el final de la prueba. Una prueba gratuita por cuenta.

## Garantía de devolución del dinero de 7 días (todos los demás planes)

Pro, y todos los planes trimestrales y anuales, se facturan al suscribirte — y en lugar de una prueba están cubiertos por una **garantía de devolución del dinero de 7 días**. Si no es lo que buscas, abre [Account](/account) en los 7 días siguientes a tu primer pago y haz clic en **Request a full refund**:

- El pago se reembolsa íntegramente a la tarjeta con la que pagaste (normalmente aparece en 5–10 días hábiles).
- Tu suscripción se cancela y el acceso de pago termina en cuanto se emite el reembolso.
- La garantía está limitada a **un reembolso por cliente** — por cuenta, dirección de correo electrónico o tarjeta — y no cubre las renovaciones.

## Cómo gestionar tu suscripción

1. Abre [Account](/account).
2. Haz clic en "Manage subscription" — esto abre el portal de Stripe en una nueva pestaña.
3. Desde el portal puedes:
   - Cambiar de nivel (Basic ↔ Pro)
   - Cambiar de periodicidad (mensual ↔ trimestral ↔ anual)
   - Actualizar el método de pago
   - Ver y descargar facturas
   - Cancelar la suscripción

## Mejoras y reducciones de nivel

- **Mejora (Basic → Pro)** — se aplica prorrateo. El acceso al nivel se actualiza al instante; la diferencia prorrateada (un crédito por el tiempo no utilizado más el cargo del nuevo nivel) aparece en tu **próxima factura** en lugar de cobrarse de inmediato.
- **Reducción (Pro → Basic)** — el cambio entra en vigor al final del periodo de facturación actual. Conservas las funciones Pro hasta entonces.
- **Cambio de periodicidad** — pasar a un periodo más largo (mensual → trimestral → anual) se aplica de inmediato (con prorrateo en tu próxima factura); pasar a uno más corto entra en vigor al final del periodo actual, igual que una reducción de nivel.
- **Durante la prueba gratuita de Basic** — pasar a Pro, o a facturación trimestral o anual, termina la prueba y factura el nuevo plan ese mismo día. Desde la página de [Pricing](/pricing) verás antes el importe exacto y lo confirmarás; ese pago está cubierto por la garantía de devolución del dinero de 7 días.

## Cancelación

- La cancelación entra en vigor al **final del periodo de facturación actual**. Conservas el acceso de pago hasta entonces.
- Una vez finalizado el periodo, tu nivel vuelve a Public. Tu cuenta no se elimina; tu progreso educativo, tus datos de referidos y tu configuración guardada permanecen intactos.
- Puedes volver a suscribirte en cualquier momento.

## Métodos de pago

Stripe admite tarjetas, Apple Pay, Google Pay y (en la mayoría de las regiones) transferencias bancarias. Gestiónalos todos desde el portal.

## Facturas y recibos

Cada cargo genera una factura de Stripe. El portal enumera todas las facturas anteriores con enlaces de descarga en PDF. Los recibos también se envían automáticamente por correo electrónico.

## Pagos fallidos

Si un cargo falla, Stripe reintenta automáticamente durante varios días. Durante la ventana de reintento, tu suscripción está en estado "past due" — las funciones de pago siguen disponibles temporalmente. Si todos los reintentos fallan, la suscripción se cancela y el nivel vuelve al anterior.

Los motivos de fallo más habituales: tarjeta caducada, discrepancia en la verificación de dirección, restricciones regionales. Actualiza el método de pago en el portal para resolverlo.

## Reembolsos

Nuestra página de [Pricing](/pricing) documenta la política de reembolsos y cancelación. En resumen: la prueba de Basic mensual es incondicional — cancela antes de que termine y nunca se te cobrará — y todos los demás planes tienen la garantía de devolución del dinero de 7 días descrita arriba (un reembolso por cliente). Aparte de eso, las suscripciones se facturan por adelantado y no se prorratean al cancelar.

Para excepciones, escribe a [support@zerogex.io](mailto:support@zerogex.io).

## Cambio a un periodo de facturación más largo

La mayoría de los usuarios llegan a este punto alrededor del tercer mes — los números salen a tu favor. El portal gestiona el cambio: se aplica de inmediato, y el prorrateo (un crédito por la parte no utilizada del periodo actual más el nuevo cargo) aparece en tu próxima factura. Si aún estás en la prueba gratuita de Basic, el cambio termina la prueba y factura el nuevo plan ese mismo día (ver arriba).

## Recordatorios de renovación

Los planes trimestrales y anuales se renuevan automáticamente. Te enviamos un correo antes — 7 días antes en el trimestral, 30 días antes en el anual — con la fecha y el importe, para que puedas cancelar o cambiar en el portal antes si lo deseas.

## Códigos promocionales y cupones

Los cupones promocionales se aplican en el momento del pago. Si hay una promoción activa, la página Pricing muestra la tarifa con el cupón aplicado; en caso contrario, la tarifa estándar.

La **tarifa de miembro fundador (founding-member)** es una vía independiente, solo por invitación — consulta la página [/founding](/founding) si tienes el código de acceso.

## Ver también

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
