# Solución de problemas

*La lista breve: problemas de inicio de sesión, datos faltantes, gráficos desactualizados, problemas de pago, cachés del navegador y cuándo escribir al soporte.*

---

## No puedo iniciar sesión

**Olvidaste tu contraseña.** Usa [Olvidé mi contraseña](/forgot-password). Se envía un enlace de restablecimiento por correo; haz clic y establece una nueva. Si el correo no llega, revisa la carpeta de spam.

**Te registraste con Google o Apple y no tienes contraseña.** Inicia sesión con el proveedor que usaste. Desde la página de Cuenta podrás luego establecer una contraseña como alternativa futura.

**El proveedor dice "no se encontró ninguna cuenta".** Puede que te hayas registrado con un correo diferente. Prueba con el otro proveedor, o escribe a [support@zerogex.io](mailto:support@zerogex.io) — podemos buscar la cuenta.

**El aviso de dos factores o de dispositivo no desaparece.** Inicia sesión de nuevo desde una ventana de incógnito. Si persiste, el soporte puede eliminar sesiones obsoletas en tu cuenta.

## Datos faltantes o desactualizados

**El indicador de sesión dice Cerrado.** Esa es la explicación — los mercados están cerrados. Se muestran los últimos valores calculados.

**Un gráfico dice "sin datos".** Suele deberse a un problema de ventana de sesión (EOD Pressure fuera de su ventana, 0DTE en un día sin vencimiento). Pasa el cursor sobre el estado vacío — el tooltip lo explica.

**Los valores de los tiles parecen congelados.** Revisa la marca de tiempo en el tile de precio. Si tiene más de 30 segundos de antigüedad durante el horario regular, recarga la página forzosamente (Cmd+Shift+R / Ctrl+Shift+R).

**El signal score muestra 0.** Eso suele significar "sin lectura", no "neutral". Consulta [Cómo leer la Score Line [-1, +1]](/help/platform/score-line).

## Pagos

**La tarjeta fue rechazada.** Actualiza el método de pago en el portal de facturación de Stripe (enlazado desde tu página de [Cuenta](/account)). Los rechazos más comunes se deben a tarjetas vencidas, direcciones que no coinciden o restricciones regionales.

**La suscripción dice "vencida".** Stripe está reintentando el cobro. Actualiza el método de pago para resolverlo. Las funciones de pago permanecen activas durante la ventana de reintento.

**La factura es más alta de lo esperado.** Abre la factura en el portal — las partidas están detalladas. Sorpresas comunes: un cambio de plan o de periodicidad se prorratea — recibes un crédito por la parte no utilizada del periodo actual más el cargo del nuevo plan, aplicado a tu **próxima factura** en lugar de cobrarse de inmediato.

**La cancelación no se completó.** La cancelación entra en vigor al final del periodo de facturación. Hasta entonces, conservas el acceso de pago. El portal muestra la fecha de finalización prevista.

## Nivel y acceso

**Una página redirige a /pricing en lugar de abrirse.** Esa página requiere un nivel que actualmente no tienes. [Pricing](/pricing) muestra qué lo desbloquea.

**Hiciste el upgrade pero una página sigue bloqueada.** Recarga forzosamente para actualizar la sesión. Si sigue bloqueada después de eso, cierra sesión y vuelve a entrar. Si continúa bloqueada, escribe al soporte.

## Navegador

**La página está en blanco.** Probablemente una extensión del navegador está bloqueando scripts. Prueba una ventana de incógnito con las extensiones desactivadas. Si funciona ahí, identifica la extensión desactivándolas una por una.

**Los gráficos se muestran con colores extraños.** Desajuste en la caché del tema. Cambia el tema una vez (icono de sol/luna). La siguiente recarga se renderizará correctamente.

**Las cookies de inicio de sesión no persisten.** Puede que estés en un modo de privacidad estricta del navegador (Brave shields en modo agresivo, Safari con "Evitar el rastreo entre sitios", ciertos contenedores de Firefox). Añade `zerogex.io` a la lista de cookies permitidas, o inicia sesión de nuevo en cada sesión.

## Gráficos

**Un gráfico está vacío mientras otros tienen datos.** La causa más común es una restricción de nivel — el gráfico pertenece a un nivel que no tienes. Otras veces: la señal subyacente está intencionalmente inactiva (su ventana no está abierta). Pasa el cursor sobre el estado vacío para ver la explicación.

**Los tooltips al pasar el cursor no aparecen.** Es un dispositivo táctil. Usa pulsación prolongada, o cambia a un escritorio.

## Móvil

**El diseño se ve apretado.** ZeroGEX está diseñado para escritorio. El diseño móvil funciona bien para monitorear; las páginas complejas con múltiples gráficos requieren más espacio horizontal.

**El desplazamiento se bloquea al arrastrar un gráfico.** Toca fuera del área del gráfico primero, luego desplázate. Los gráficos capturan intencionalmente el arrastre horizontal para zoom/pan.

## Cuándo escribir al soporte

Después de haber probado los puntos relevantes anteriores. Incluye:

- La URL de la página en la que estabas.
- Una captura de pantalla si es relevante.
- Navegador, sistema operativo y aproximadamente cuándo ocurrió (con zona horaria).
- El correo de tu cuenta.

Escribe a [support@zerogex.io](mailto:support@zerogex.io). Respondemos rápido — normalmente el mismo día de trading.

## Ver también

- [Streaming y rendimiento](/help/platform/streaming-and-performance)
- [Configuración de la cuenta](/help/platform/account)
- [Facturación y portal de Stripe](/help/platform/billing)
- [Preguntas frecuentes](/help/faqs)
