# Come ottenere i livelli gamma di SPX in Claude, ChatGPT e Cursor

*Chiedi a un assistente AI dove si trova il gamma flip e di solito si inventerà un numero. Collegarlo a una fonte live risolve il problema. Ecco come farlo, cosa chiedere e come distinguere una risposta reale da una inventata.*

---

## Il problema di chiedere un livello a un assistente

Chiedi a Claude o a ChatGPT "dov'è il gamma flip di SPX oggi?" e otterrai una risposta. Sarà sicura di sé, sarà formattata come una lettura reale e, a meno che l'assistente non sia andato a recuperarla, sarà inventata.

Non si tratta di negligenza del modello. Un modello linguistico risponde in base a ciò che ha imparato durante l'addestramento, e un gamma flip è un numero che è cambiato stamattina e cambierà di nuovo oggi pomeriggio. Nei dati di addestramento non c'è nulla che possa essere giusto. Quando un modello non ha una fonte, il modo in cui sbaglia è produrre un output dall'aria plausibile, e a colpo d'occhio un livello inventato è indistinguibile da uno reale.

La soluzione non è un prompt migliore. È dare all'assistente un posto dove guardare.

## Cos'è MCP, in un paragrafo

Il [Model Context Protocol](https://modelcontextprotocol.io) è un modo standard con cui un assistente AI può interrogare una fonte di dati esterna. Chi pubblica i dati gestisce un piccolo server; tu aggiungi il suo indirizzo al tuo assistente una volta sola; da quel momento l'assistente può interrogarlo quando una domanda richiede dati live. Claude, ChatGPT e Cursor lo parlano tutti. È la differenza tra un assistente che tira a indovinare un gamma flip e uno che va a leggerlo.

## Collegare ZeroGEX

ZeroGEX pubblica un server MCP gratuito all'indirizzo `https://zerogex.io/mcp`. Fornisce gli stessi livelli con 15 minuti di ritardo delle [pagine pubbliche dei livelli gamma](/spx-gamma-levels) - gamma flip, call wall, put wall, max pain, pin strike della giornata e gamma netto dei dealer allo spot, per SPX, SPY, QQQ, NDX, ES e NQ. Nessuna chiave, nessun account, niente da installare. La lettura è gratuita.

**Claude (desktop o web).** Apri le impostazioni dei connettori, aggiungi un connettore personalizzato e incolla l'URL. Se ti chiede una chiave, lascia il campo vuoto.

**Claude Code.**

```bash
claude mcp add --transport http zerogex https://zerogex.io/mcp
```

**Cursor.** Aggiungilo a `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zerogex": {
      "url": "https://zerogex.io/mcp"
    }
  }
}
```

**Qualsiasi altro client.** Funziona qualsiasi client che accetti l'URL di un server MCP remoto. I client che consultano il registro ufficiale possono trovarlo per nome come `io.zerogex/gamma-levels`. Se il tuo supporta solo server `stdio` locali, mettici davanti un bridge come `mcp-remote`.

Le note di configurazione complete, compreso come verificare la connessione con `curl` e cosa fare quando un client non si comporta come dovrebbe, si trovano nel [centro assistenza](/help/platform/mcp-server).

## Cosa chiedergli

Lo scopo non è imparare una sintassi di comandi. Chiedi in linguaggio normale e l'assistente sceglie lo strumento:

- *"Dov'è il gamma flip di SPX in questo momento, e quanto ne dista lo spot?"*
- *"QQQ è in gamma positivo o negativo?"*
- *"Com'è il posizionamento dei dealer sugli indici oggi?"*
- *"Quanto dista SPY dal suo call wall, e cosa significherebbe una rottura al di sopra?"*
- *"C'è un pin strike della giornata su SPX?"*

Le ultime due sono quelle in cui un assistente dimostra quanto vale rispetto a una pagina di numeri. Ha il livello *e* la spiegazione, quindi può dirti che il call wall è l'1,4% sopra lo spot e che in un regime di gamma positivo l'hedging tende a opporsi a un rally verso di esso - senza che tu debba passare da una dashboard a una pagina educativa.

Due domande a cui risponde bene e a cui una pagina non può rispondere:

- *"Confronta il posizionamento di SPX e SPY - i due book concordano?"* Una sola chiamata, entrambi i book, e la divergenza messa in evidenza.
- *"Sto valutando un breakout sopra 6450. Cosa c'è tra qui e il call wall?"* Il tuo contesto, i suoi livelli.

## Distinguere una risposta reale da una inventata

Questo conta più della configurazione, perché un assistente collegato e uno non collegato sembrano identici finché non controlli.

**Una risposta reale dichiara quanto è vecchia.** Ogni risposta del server ZeroGEX si apre con il timestamp dello snapshot e la sua età, e chiede all'assistente di ripeterli. Se ricevi un gamma flip senza alcuna indicazione di quando è stato calcolato, diffida - probabilmente il numero viene dal modello, non dal server.

**Chiediglielo direttamente.** *"Da dove viene quel numero, e quanto è vecchio?"* Un assistente collegato ti dirà l'ora dello snapshot. Uno non collegato tergiverserà.

**Un livello mancante deve restare mancante.** Quando il book modellato non supporta un gamma flip, il server restituisce "unavailable" invece di un numero. Un assistente che lo trasforma in `0` o fornisce in silenzio un livello sta riempiendo un vuoto. Chiedigli da dove viene il valore.

**I disservizi sono visibili.** Se il backend è momentaneamente irraggiungibile, lo strumento restituisce un esplicito "temporarily unavailable" e dice all'assistente di non rispondere a memoria. È uno stato transitorio normale, non una configurazione guasta.

## Cosa non è

**Non è in tempo reale.** La versione gratuita ha di proposito almeno 15 minuti di ritardo. Va bene per orientarsi e per la struttura - dove sono i wall, in quale regime ti trovi, quanto dista lo spot dal flip. Non va bene per scegliere il momento di un ingresso al prezzo attuale, perché su un tape veloce il mercato può aver già superato un livello prima che lo snapshot lo mostri. Il feed in tempo reale è una funzione Pro, accessibile con [una chiave API](/help/platform/api-access).

**Non è un servizio di segnali.** Il server restituisce posizionamento, non direzione. Un gamma flip ti dice quale playbook di hedging sta seguendo il book modellato, non se comprare. Lo dice a ogni chiamata.

**I livelli sono modellati, non osservati.** Il posizionamento dei dealer è dedotto dai dati pubblici sulle opzioni secondo una convenzione di segno dichiarata - nessuno pubblica il proprio book. La [pagina della metodologia](/methodology) è il resoconto onesto di ciò che questo permette e non permette di sostenere.

**Gli assistenti sbagliano comunque.** Collegarne uno a una fonte reale elimina l'errore del numero inventato. Non elimina le letture sbagliate, l'eccesso di sicurezza o un assistente che si porta dietro una vecchia risposta in una conversazione lunga. Chiedi l'età del dato quando conta.

## Ne vale la pena?

Se tieni già aperta una dashboard, probabilmente no - sei a un'occhiata dagli stessi numeri.

Ne vale la pena se lavori già dentro un assistente: mentre scrivi un piano di trading, ragioni su un setup o fai domande successive che richiedono sia il livello sia il suo significato. Il risparmio non è la consultazione in sé, è non dover interrompere il contesto per farla.

È anche il modo più rapido per controllare un livello da telefono, su un portatile senza il tuo setup di grafici, o nel mezzo di una conversazione su tutt'altro.

## Vedi anche

- [Il server MCP di ZeroGEX](/help/platform/mcp-server) - configurazione completa e risoluzione dei problemi.
- [Livelli gamma SPX gratuiti](/spx-gamma-levels) - gli stessi dati in forma di pagina.
- [Cos'è un gamma flip?](/education/how-to-read-a-gamma-flip) - cosa significa davvero il livello.
- [Costruire un server MCP sull'API di ZeroGEX](/help/platform/mcp-integration) - per gli utenti Pro che vogliono dati in tempo reale e strumenti su misura.

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.
