# Facturación y Portal de Stripe

*Cómo funciona la facturación a través de Stripe, la diferencia entre mensual y anual, el cambio de nivel, los métodos de pago y las facturas.*

---

## Cómo funciona la facturación

ZeroGEX factura a través de **Stripe**. No vemos ni almacenamos los datos de tu tarjeta de pago — Stripe se encarga de todo eso. Cada acción de facturación se realiza en el portal de facturación alojado por Stripe, al que se accede desde tu página de [Account](/account).

## Planes y periodicidades

Dos niveles — **Basic** y **Pro** — cada uno disponible en modalidad **mensual** o **anual**.

- El plan anual se ofrece con descuento respecto al mensual. La tarifa exacta está en la página de [Pricing](/pricing).
- El cambio entre periodicidades es compatible a través del portal.

## Prueba gratuita

Cuando activas un plan de pago, obtienes un periodo de prueba gratuito (la duración se muestra en la página Pricing). Al final de la prueba, la suscripción continúa automáticamente a la tarifa con la que te registraste — sin un segundo paso de confirmación.

Para evitar esa renovación automática: cancela en el portal antes de que finalice la prueba. Conservarás el acceso hasta el final de la prueba.

## Cómo gestionar tu suscripción

1. Abre [Account](/account).
2. Haz clic en "Manage subscription" — esto abre el portal de Stripe en una nueva pestaña.
3. Desde el portal puedes:
   - Cambiar de nivel (Basic ↔ Pro)
   - Cambiar de periodicidad (mensual ↔ anual)
   - Actualizar el método de pago
   - Ver y descargar facturas
   - Cancelar la suscripción

## Mejoras y reducciones de nivel

- **Mejora (Basic → Pro)** — se aplica prorrateo. El acceso al nivel se actualiza al instante; la diferencia prorrateada (un crédito por el tiempo no utilizado más el cargo del nuevo nivel) aparece en tu **próxima factura** en lugar de cobrarse de inmediato.
- **Reducción (Pro → Basic)** — el cambio entra en vigor al final del periodo de facturación actual. Conservas las funciones Pro hasta entonces.
- **Cambio de periodicidad** — de mensual a anual se aplica de inmediato (con prorrateo en tu próxima factura); de anual a mensual entra en vigor al final del periodo actual, igual que una reducción de nivel.

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

Nuestra página de [Pricing](/pricing) documenta la política de reembolsos y cancelación. En resumen: las suscripciones se facturan por adelantado y no se prorratean al cancelar, pero la prueba es incondicional — cancela antes de que termine y nunca se te cobrará.

Para excepciones, escribe a [support@zerogex.io](mailto:support@zerogex.io).

## Cambio de mensual a anual

La mayoría de los usuarios llegan a este punto alrededor del tercer mes — los números salen a tu favor. El portal gestiona el cambio: se aplica de inmediato, y el prorrateo (un crédito por la parte no utilizada del mes actual más el cargo anual) aparece en tu próxima factura. Si aún estás en tu prueba gratuita, el cambio mantiene la prueba — no se te cobrará hasta que termine, y entonces se te facturará la tarifa anual.

## Códigos promocionales y cupones

Los cupones promocionales se aplican en el momento del pago. Si hay una promoción activa, la página Pricing muestra la tarifa con el cupón aplicado; en caso contrario, la tarifa estándar.

La **tarifa de miembro fundador (founding-member)** es una vía independiente, solo por invitación — consulta la página [/founding](/founding) si tienes el código de acceso.

## Ver también

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
