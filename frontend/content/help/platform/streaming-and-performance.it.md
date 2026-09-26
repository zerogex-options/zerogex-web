# Streaming e prestazioni

*Come i dati in tempo reale arrivano al tuo browser, cosa fare se una pagina sembra non aggiornarsi, e le soluzioni più semplici per una connessione lenta.*

---

## Come funzionano gli aggiornamenti in tempo reale

Ogni pagina si aggiorna da sola - non c'è niente da ricaricare. Il prezzo nell'intestazione si aggiorna circa una volta al secondo, e ogni pannello recupera dati nuovi con un proprio breve intervallo, ogni pochi secondi per la maggior parte degli elementi. I dati iniziano ad arrivare non appena la pagina si carica.

Se una richiesta non va a buon fine, la pagina continua a mostrare gli ultimi valori validi e riprova al ciclo successivo. Le pagine Punteggio composito e Trade Bias mostrano inoltre un indicatore live, con l'avviso "Reconnecting…" se gli aggiornamenti smettono di arrivare.

## Cosa significa davvero "live"

Le pagine cercano nuovi dati ogni pochi secondi, ma ogni valore cambia solo con la frequenza con cui viene calcolato:

| Elemento | Con che frequenza cambia |
| --- | --- |
| Quotazione prezzo | Circa ogni secondo |
| Posizionamento dei dealer (GEX, wall, flip, max pain) | Ricalcolato circa una volta al minuto |
| Punteggi dei segnali e Punteggio composito | Circa una volta al minuto; le pagine dei segnali controllano ogni 5 secondi |
| Flusso delle opzioni | Barre da cinque minuti |
| Indicatori di volatilità (VIX / VXN) | Barre da cinque minuti |

Quando la pagina è in una scheda in background, il browser potrebbe limitare gli aggiornamenti. Riporta la scheda in primo piano e gli aggiornamenti riprendono immediatamente.

## Quando una pagina sembra non aggiornarsi

Le cause più comuni, in ordine di frequenza:

1. **La scheda è rimasta in background per ore.** Gli aggiornamenti potrebbero essersi fermati. Ricarica la pagina.
2. **Sei su una connessione lenta.** Le richieste si accumulano; l'ultimo dato ricevuto prevale, ma gli aggiornamenti risultano lenti. Cambia rete o chiudi altre schede pesanti.
3. **Un ad blocker o un'estensione sta interferendo.** Alcuni blocker troppo aggressivi bloccano le richieste in background che recuperano i dati aggiornati. Prova in una finestra privata con le estensioni disattivate.
4. **Il mercato è chiuso.** Il badge di sessione lo indica. Vengono mostrati gli ultimi valori calcolati.

## Cosa controllare per prima cosa

Quando qualcosa sembra non funzionare, la diagnostica in tre passaggi:

1. Guarda il **badge di sessione** - il mercato è aperto?
2. Passa il mouse sul **prezzo nell'intestazione** - l'orario "as of" è recente?
3. Ricarica forzatamente la pagina (Cmd+Shift+R o Ctrl+Shift+R).

Questo copre la maggior parte delle situazioni in cui "sembra tutto rotto".

## Consigli sulle prestazioni

### Usa un browser recente

ZeroGEX è pensato per le versioni attuali di Chrome, Edge, Firefox e Safari. Se qualcosa non funziona bene in un browser datato, aggiornalo prima di tutto.

### Chiudi altre schede pesanti

La dashboard aggiorna diversi grafici in tempo reale. Se hai una scheda YouTube in streaming e tre finestre di TradingView aperte, il browser deve condividere la CPU tra tutte. Chiudi ciò che non ti serve.

### Disattiva le estensioni non necessarie

Le estensioni per la privacy e il blocco degli annunci generalmente non danno problemi. I blocker di script aggressivi (NoScript con impostazioni predefinite restrittive) richiedono che i domini di ZeroGEX siano inseriti in una allowlist.

### Cambiare simbolo è più pesante che cambiare timeframe

Cambiare simbolo ricarica i dati di tutti i pannelli della pagina; cambiare il timeframe di un grafico ricarica solo quel grafico.

## Mobile

ZeroGEX funziona anche su smartphone - ogni pagina è responsive - ma la piattaforma è **pensata per il desktop**. La densità dei grafici presuppone uno schermo più largo di 1024px. Su smartphone i grafici si adattano allo schermo e mostrano meno etichette; i dati sono tutti presenti, ma il layout è più denso. Scorri verso l'alto o verso il basso per far scorrere la pagina - i grafici rispondono solo al trascinamento laterale.

## Quando scrivere al supporto

Se la piattaforma stessa sembra bloccata (non la tua connessione, non una scheda non aggiornata) e le ricariche forzate non risolvono, scrivi a [support@zerogex.io](mailto:support@zerogex.io) con:

- La pagina su cui ti trovavi
- L'orario in cui è successo (con fuso orario)
- Il tuo browser e sistema operativo

I log dal nostro lato sono marcati temporalmente - questo è sufficiente per rintracciare il problema.

## Vedi anche

- [Risoluzione dei problemi](/help/platform/troubleshooting)
- [Copertura dati e aggiornamento](/help/platform/data-coverage)
