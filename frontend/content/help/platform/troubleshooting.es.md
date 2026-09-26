# Solución de problemas

*La lista breve: problemas de inicio de sesión, datos faltantes, gráficos desactualizados, problemas de pago, cachés del navegador y cuándo escribir al soporte.*

---

## No puedo iniciar sesión

**Olvidaste tu contraseña.** Usa [Olvidé mi contraseña](/forgot-password). Se envía un enlace de restablecimiento por correo; haz clic y establece una nueva. El enlace funciona una sola vez y caduca a los 30 minutos. Si el correo no llega, revisa la carpeta de spam.

**Te registraste con Google o Apple y no tienes contraseña.** Inicia sesión con el proveedor que usaste. Desde la página de Cuenta podrás luego establecer una contraseña como alternativa futura.

**Iniciaste sesión, pero tu plan no aparece.** Probablemente iniciaste sesión con un correo distinto al de tu suscripción - por ejemplo, otra cuenta de Google -, lo que crea una cuenta separada. Cierra sesión y vuelve a entrar con el correo original, o escribe a [support@zerogex.io](mailto:support@zerogex.io) - podemos buscar la cuenta.

**Un aviso de verificación de Google o Apple no desaparece.** Ese aviso lo muestra el proveedor - ZeroGEX no tiene un paso de dos factores propio. Inicia sesión de nuevo desde una ventana de incógnito. Si persiste, escribe al soporte.

## Datos faltantes o desactualizados

**El indicador de sesión dice Cerrado.** Esa es la explicación - los mercados están cerrados. Se muestran los últimos valores calculados.

**Un panel está vacío o marca cero.** Suele deberse a la ventana de sesión: EOD Pressure solo está activo desde las 2:30 PM ET hasta el cierre, y 0DTE Position Imbalance solo durante la sesión regular. Ambas páginas lo indican en pantalla mientras están inactivas.

**Los valores parecen congelados.** Pasa el cursor sobre el precio de la cabecera para ver cuándo llegó la última cotización, o mira la hora de «Última actualización» al final del Panel principal. Si tiene más de un par de minutos durante el horario regular, recarga la página forzosamente (Cmd+Shift+R / Ctrl+Shift+R). Las cifras de posicionamiento de los dealers se recalculan aproximadamente una vez por minuto, así que las pausas breves entre cambios son normales.

**El signal score muestra 0.** Eso suele significar "sin lectura", no "neutral". Consulta [Cómo leer la línea de puntuación de -100 a +100](/help/platform/score-line).

## Pagos

**La tarjeta fue rechazada.** Actualiza el método de pago en el portal de facturación de Stripe (enlazado desde tu página de [Cuenta](/account)). Los rechazos más comunes se deben a tarjetas vencidas, direcciones que no coinciden o restricciones regionales.

**La suscripción dice "vencida".** Stripe está reintentando el cobro. Actualiza el método de pago, o paga la factura pendiente con **Abrir el portal de facturación** en tu página de Cuenta, para resolverlo. Las funciones de pago siguen activas durante un breve periodo de gracia mientras se reintenta.

**La factura es más alta de lo esperado.** Abre la factura en el portal - las partidas están detalladas. Sorpresas comunes: una mejora a mitad de periodo se prorratea - recibes un crédito por la parte no utilizada del periodo actual más el cargo del nuevo plan, aplicado a tu **próxima factura** en lugar de cobrarse de inmediato. Dejar la prueba gratuita de Basic por Pro o por un periodo de facturación más largo factura el nuevo plan ese mismo día.

**La cancelación no se completó.** La cancelación entra en vigor al final del periodo de facturación. Hasta entonces, conservas el acceso de pago. El portal y tu página de Cuenta muestran la fecha de finalización prevista.

## Nivel y acceso

**Una página te lleva a Pricing o a una pantalla de desbloqueo en lugar de abrirse.** Esa página requiere un nivel que actualmente no tienes. La pantalla de desbloqueo indica el plan que la incluye, y [Pricing](/pricing) muestra el desglose completo.

**Hiciste el upgrade pero una página sigue bloqueada.** Recarga forzosamente para actualizar la sesión. Si sigue bloqueada después de eso, cierra sesión y vuelve a entrar. Si continúa bloqueada, escribe al soporte.

## Navegador

**La página está en blanco.** Probablemente una extensión del navegador está bloqueando scripts. Prueba una ventana de incógnito con las extensiones desactivadas. Si funciona ahí, identifica la extensión desactivándolas una por una.

**Los gráficos se muestran con colores inesperados.** Revisa el menú de paletas junto al icono de sol/luna de la cabecera - otra paleta cambia los colores de todos los gráficos. Si la paleta es la correcta, cambia el tema una vez (icono de sol/luna); la siguiente recarga se renderizará correctamente.

**Las cookies de inicio de sesión no persisten.** Puede que estés en un modo de privacidad estricta del navegador (Brave shields en modo agresivo, Safari con "Evitar el rastreo entre sitios", ciertos contenedores de Firefox). Añade `zerogex.io` a la lista de cookies permitidas, o inicia sesión de nuevo en cada sesión.

## Gráficos

**Un gráfico está vacío mientras otros tienen datos.** La causa más común es una restricción de nivel - el gráfico pertenece a un nivel que no tienes, y los paneles exclusivos de Pro muestran un aviso para mejorar de plan en su lugar. Otras veces: la señal subyacente está intencionalmente inactiva (su ventana no está abierta).

**Los tooltips al pasar el cursor no aparecen.** Es un dispositivo táctil. Toca el gráfico o mantén pulsado, o cambia a un escritorio.

## Móvil

**El diseño se ve apretado.** ZeroGEX está diseñado para escritorio. El diseño móvil funciona bien para monitorear; las páginas complejas con múltiples gráficos requieren más espacio horizontal.

**La página no se desplaza mientras tienes el dedo sobre un gráfico.** Desliza hacia arriba o hacia abajo - los gráficos solo capturan el arrastre lateral (para moverse en el tiempo), así que un deslizamiento vertical desplaza la página.

## Cuándo escribir al soporte

Después de haber probado los puntos relevantes anteriores. Incluye:

- La URL de la página en la que estabas.
- Una captura de pantalla si es relevante.
- Navegador, sistema operativo y aproximadamente cuándo ocurrió (con zona horaria).
- El correo de tu cuenta.

Escribe a [support@zerogex.io](mailto:support@zerogex.io). Respondemos rápido - normalmente el mismo día de trading.

## Ver también

- [Streaming y rendimiento](/help/platform/streaming-and-performance)
- [Configuración de la cuenta](/help/platform/account)
- [Facturación y portal de Stripe](/help/platform/billing)
- [Preguntas frecuentes](/help/faqs)
