# Configuración de la cuenta

*Correo electrónico, contraseña, proveedores de inicio de sesión vinculados (Google/Apple), nivel y estado del plan, y cómo gestionarlos de forma segura.*

---

## Qué hace la página Account

La página [Account](/account) es el punto central para todo lo relacionado con el usuario: tu correo electrónico, tu suscripción, tus métodos de inicio de sesión, las notificaciones, el panel de referidos y la eliminación de la cuenta.

## El encabezado

Muestra tu correo electrónico y tu nivel (Public, Basic, Pro o Admin). Por debajo de Pro, un botón **Mejorar plan** junto a tu nivel te lleva a [Pricing](/pricing). Si tu correo aún no está verificado, un aviso en la parte superior de la página te lo indica.

## Correo electrónico y verificación

- La dirección de correo con la que te registraste es el identificador de tu cuenta. No se puede cambiar sin pasar por soporte.
- Las cuentas nuevas deben verificar el correo electrónico: se envía un enlace de verificación al registrarte, que caduca a las 24 horas. Hasta que lo verifiques, no puedes iniciar una prueba ni suscribirte.
- Si no recibiste el mensaje original, haz clic en **Resend** en el aviso de verificación de la parte superior de la página Account.

## Contraseña

- Configura una contraseña si te registraste con Google o Apple y quieres tener una alternativa. En Métodos de inicio de sesión, el botón **Establecer contraseña** aparece para las cuentas sin contraseña.
- Para cambiar una contraseña existente, haz clic en **Restablecer contraseña**: te enviamos por correo un enlace para crear una nueva.
- La longitud mínima es de 12 caracteres.
- Usa un gestor de contraseñas. No aplicamos reglas de complejidad: la longitud y la unicidad importan más que la variedad de caracteres.

## Proveedores de inicio de sesión vinculados

Puedes vincular **Google** y **Apple** a la misma cuenta. La sección Métodos de inicio de sesión muestra qué proveedores están conectados. Si en Apple aparece «Próximamente», el inicio de sesión con Apple aún no está activado.

- **Vincular un nuevo proveedor** - haz clic en **Conectar** junto a él, o inicia sesión una vez con el proveedor; el sistema lo vincula automáticamente a tu cuenta existente si el correo coincide.
- **Desvincular un proveedor** - haz clic en **Desconectar**. Solo es posible si tienes al menos otra forma de iniciar sesión (otro proveedor O una contraseña). La página exige esto para que no te quedes bloqueado fuera de tu cuenta.

## Nivel y suscripción

- Tu nivel actual se muestra en la parte superior de la página.
- **Gestionar suscripción**, en la sección Suscripción, abre el portal de facturación alojado por Stripe. Los cambios de plan, los métodos de pago, las facturas y la cancelación se gestionan todos allí.
- También puedes cancelar con el enlace **Cancel subscription** bajo ese botón, que te ofrece en su lugar una pausa de uno a tres meses si lo que necesitas es un descanso.
- Si un pago falla, la sección lo indica y el botón pasa a ser **Abrir el portal de facturación**, donde puedes pagar la factura pendiente con cualquier tarjeta o actualizar tu método de pago.
- En los 7 días siguientes a tu primer pago de un plan cubierto por la garantía de devolución del dinero de 7 días (Pro, o cualquier plan trimestral o anual), haz clic en **Solicitar un reembolso completo** en la página Account. El acceso termina cuando se emite el reembolso; un reembolso por cliente.

Para el proceso paso a paso, consulta [Billing & Stripe Portal](/help/platform/billing).

## Acceso a la API (Pro)

Con Pro, en la sección **API Access** creas y revocas tus claves de API personales. Las claves se revocan automáticamente si tu plan baja de Pro. Consulta [API Access & Keys (Pro)](/help/platform/api-access).

## Notificaciones

**Gestionar notificaciones** abre una página para los bots de TradeWorkz™ que sigues, donde eliges cómo te llega cada uno: en la app, por correo electrónico o por webhook.

## Redes sociales

De forma opcional, puedes añadir tu **usuario de X (antes Twitter)** en la sección de redes sociales para que el equipo de ZeroGEX pueda contactarte allí. Nunca es obligatorio: no se te pide al registrarte y puedes añadirlo, cambiarlo o eliminarlo en cualquier momento desde tu cuenta.

- Introduce el usuario con o sin la `@` inicial - de 1 a 15 caracteres, solo letras, números y guiones bajos.
- Vacía el campo y guarda para eliminar un usuario que hayas añadido previamente.

## Panel de referidos

Si el programa de referidos está en marcha, la sección **Recomienda a un amigo** muestra:

- Tu enlace de referido, con un botón **Copiar enlace**
- **Registrados** - cuántas personas se registraron con tu enlace (pasa el cursor por encima para ver sus direcciones de correo)
- **Suscritos** - cuántas de ellas contrataron un plan de pago (pasa el cursor por encima para ver quiénes)
- **Meses gratis ganados**
- **Meses acumulados** - meses gratis pendientes de aplicarse la próxima vez que te suscribas (solo aparece si tienes alguno)
- El crédito que se aplicará a tu próxima factura, cuando lo haya

Para las reglas del programa, consulta [Referrals](/help/platform/referrals).

## Cerrar sesión

Abre el menú de perfil en la cabecera y elige **Cerrar sesión** (en el móvil, **Cerrar sesión** está en el menú). Esto borra la cookie de sesión. Vuelve a iniciar sesión desde [/login](/login).

## Eliminar tu cuenta

Desplázate hasta **Delete account**, al final de la página Account, haz clic en **Delete my account**, escribe DELETE y haz clic en **Permanently delete account**. La eliminación cancela de inmediato cualquier suscripción activa, cierra tu sesión, revoca tus claves de API y detiene todos los correos que te enviamos. No se puede deshacer desde la página: para recuperar el acceso después, escribe a [support@zerogex.io](mailto:support@zerogex.io). Nuestra política de [Privacy](/privacy) explica cómo se tratan los datos de la cuenta.

## Ver también

- [Billing & Stripe Portal](/help/platform/billing)
- [Referrals](/help/platform/referrals)
- [Preferencias de correo electrónico](/help/platform/email-preferences)
