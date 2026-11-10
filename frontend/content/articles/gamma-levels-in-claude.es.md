# Cómo obtener los niveles gamma de SPX en Claude, ChatGPT y Cursor

*Pregúntale a un asistente de IA dónde está el gamma flip y normalmente se inventará un número. Conectarlo a una fuente en vivo lo soluciona. Aquí tienes cómo hacerlo, qué preguntarle y cómo distinguir una respuesta real de una inventada.*

---

## El problema de pedirle un nivel a un asistente

Pregúntale a Claude o a ChatGPT "¿dónde está hoy el gamma flip de SPX?" y obtendrás una respuesta. Será segura, tendrá el formato de una lectura real y, a menos que el asistente haya ido a buscarla, será inventada.

No es que el modelo sea descuidado. Un modelo de lenguaje responde a partir de lo que aprendió durante el entrenamiento, y un gamma flip es un número que cambió esta mañana y volverá a cambiar esta tarde. No hay nada en los datos de entrenamiento que pueda ser correcto. Cuando un modelo no tiene una fuente, su forma de fallar es dar una respuesta que suena plausible, y a simple vista un nivel inventado es indistinguible de uno real.

La solución no es un prompt mejor. Es darle al asistente un sitio donde mirar.

## Qué es MCP, en un párrafo

El [Model Context Protocol](https://modelcontextprotocol.io) es una forma estándar de que un asistente de IA consulte una fuente de datos externa. Quien publica los datos ejecuta un pequeño servidor; tú añades su dirección a tu asistente una sola vez; a partir de ahí, el asistente puede consultarlo cuando una pregunta necesita datos en vivo. Claude, ChatGPT y Cursor lo hablan todos. Es la diferencia entre un asistente que adivina un gamma flip y uno que va y lo lee.

## Cómo conectar ZeroGEX

ZeroGEX publica un servidor MCP gratuito en `https://zerogex.io/mcp`. Sirve los mismos niveles con 15 minutos de retraso que las [páginas públicas de niveles gamma](/spx-gamma-levels) - gamma flip, call wall, put wall, max pain, pin strike del mismo día y gamma neta de los dealers en el spot, para SPX, SPY, QQQ, NDX, ES y NQ. No hay clave, ni cuenta, ni nada que instalar. Leer es gratis.

**Claude (escritorio o web).** Abre la configuración de conectores, añade un conector personalizado y pega la URL. Si te pide una clave, déjala en blanco.

**Claude Code.**

```bash
claude mcp add --transport http zerogex https://zerogex.io/mcp
```

**Cursor.** Añádelo a `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zerogex": {
      "url": "https://zerogex.io/mcp"
    }
  }
}
```

**Cualquier otro cliente.** Funcionará cualquier cliente que acepte la URL de un servidor MCP remoto. Los clientes que consultan el registro oficial pueden encontrarlo por su nombre, `io.zerogex/gamma-levels`. Si el tuyo solo admite servidores `stdio` locales, pon delante un puente como `mcp-remote`.

Las notas de configuración completas, incluido cómo comprobar la conexión con `curl` y qué hacer cuando un cliente no se comporta como debe, están en [el Centro de ayuda](/help/platform/mcp-server).

## Qué preguntarle

No se trata de aprender una sintaxis de comandos. Pregunta en lenguaje corriente y el asistente elige la herramienta:

- *"¿Dónde está ahora mismo el gamma flip de SPX y a qué distancia está el spot?"*
- *"¿Está QQQ en gamma positiva o negativa?"*
- *"¿Cómo está hoy el posicionamiento de los dealers en los distintos índices?"*
- *"¿A qué distancia está SPY de su call wall y qué significaría una ruptura por encima?"*
- *"¿Hay un pin strike del mismo día en SPX?"*

Las dos últimas son donde un asistente demuestra lo que vale frente a una página de números. Tiene el nivel *y* la explicación, así que puede decirte que el call wall está un 1,4% por encima del spot y que, en un régimen de gamma positiva, la cobertura tiende a oponerse a un rally hacia él - sin que tengas que saltar entre un dashboard y una página educativa.

Dos preguntas que responde bien y que una página no puede responder:

- *"Compara el posicionamiento de SPX y SPY - ¿coinciden los dos libros?"* Una sola consulta, los dos libros y la divergencia señalada.
- *"Estoy mirando un breakout por encima de 6450. ¿Qué hay entre aquí y el call wall?"* Tu contexto, sus niveles.

## Cómo distinguir una respuesta real de una inventada

Esto importa más que la configuración, porque un asistente conectado y uno sin conectar parecen idénticos hasta que lo compruebas.

**Una respuesta real indica su antigüedad.** Cada respuesta del servidor de ZeroGEX empieza con la marca de tiempo de la instantánea y su antigüedad, e indica al asistente que la repita. Si te dan un gamma flip sin ninguna mención de cuándo se calculó, desconfía - probablemente el número salió del modelo, no del servidor.

**Pregúntaselo directamente.** *"¿De dónde ha salido ese número y qué antigüedad tiene?"* Un asistente conectado te dirá la hora de la instantánea. Uno sin conectar se andará con evasivas.

**Un nivel ausente debe seguir ausente.** Cuando el libro modelado no respalda un gamma flip, el servidor devuelve "unavailable" en lugar de un número. Un asistente que convierte eso en `0` o que aporta un nivel sin decir nada está rellenando un hueco. Pregúntale de dónde salió el valor.

**Las caídas son visibles.** Si el backend no está accesible durante un momento, la herramienta devuelve un "temporarily unavailable" explícito y le indica al asistente que no responda de memoria. Es un estado transitorio normal, no una configuración rota.

## Lo que esto no es

**No es en tiempo real.** La versión gratuita lleva al menos 15 minutos de retraso, a propósito. Eso sirve para orientarse y entender la estructura - dónde están los walls, en qué régimen estás, a qué distancia está el spot del flip. No sirve para cronometrar una entrada al precio actual, porque con un tape rápido el mercado puede haber atravesado un nivel antes de que la instantánea lo muestre. El feed en tiempo real es una función Pro que requiere [una clave de API](/help/platform/api-access).

**No es un servicio de señales.** El servidor devuelve posicionamiento, no dirección. Un gamma flip te dice qué playbook de cobertura está siguiendo el libro modelado, no si debes comprar. Lo dice en cada consulta.

**Los niveles son modelados, no observados.** El posicionamiento de los dealers se infiere a partir de datos públicos de opciones bajo una convención de signo declarada - nadie publica su libro. La [página de metodología](/methodology) explica con honestidad lo que eso permite afirmar y lo que no.

**Los asistentes siguen equivocándose.** Conectar uno a una fuente real elimina el fallo del número inventado. No elimina las malas interpretaciones, el exceso de confianza ni que un asistente arrastre una respuesta antigua a lo largo de una conversación larga. Pregunta por la antigüedad cuando importe.

## ¿Merece la pena?

Si ya tienes un dashboard abierto, probablemente no - estás a un vistazo de las mismas cifras.

Merece la pena si ya trabajas dentro de un asistente: redactando un plan de trading, razonando un setup o haciendo preguntas de seguimiento que necesitan tanto el nivel como lo que significa. El ahorro no está en la consulta, sino en no romper el contexto para hacerla.

También es la forma más rápida de comprobar un nivel desde un teléfono, en un portátil sin tu configuración de gráficos o en mitad de una conversación sobre otra cosa.

## Ver también

- [El servidor MCP de ZeroGEX](/help/platform/mcp-server) - configuración completa y solución de problemas.
- [Niveles gamma de SPX gratuitos](/spx-gamma-levels) - los mismos datos en forma de página.
- [¿Qué es un gamma flip?](/education/how-to-read-a-gamma-flip) - lo que significa realmente el nivel.
- [Cómo crear un servidor MCP sobre la API de ZeroGEX](/help/platform/mcp-integration) - para usuarios Pro que quieren datos en tiempo real y herramientas diseñadas a su medida.

Solo contenido educativo - nada de lo anterior es una recomendación de trading.
