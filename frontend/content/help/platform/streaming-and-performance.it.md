# Streaming e prestazioni

*Come i dati in tempo reale arrivano al tuo browser, cosa fare se una pagina sembra non aggiornarsi, e le soluzioni più semplici per una connessione lenta.*

---

## Come funziona lo streaming

ZeroGEX invia dati live al tuo browser tramite una connessione persistente — apri la dashboard e i dati iniziano ad arrivare entro un secondo dal caricamento della pagina. Non c'è polling lato client.

La connessione si aggiorna automaticamente se cade. Se un aggiornamento fallisce ripetutamente, l'interfaccia mostra un'etichetta "Riconnessione…" e avvia un nuovo tentativo con backoff.

## Cosa significa davvero "live"

| Elemento | Frequenza di aggiornamento |
| --- | --- |
| Quotazione prezzo | ~1 secondo |
| Flow / tape | ~1 secondo |
| Punteggi dei segnali | 1–5 secondi a seconda del segnale |
| Superficie GEX | 5–15 secondi (collo di bottiglia: snapshot della chain) |
| Composite Score | ~5 secondi |

Quando la pagina è in una scheda in background, il browser potrebbe limitare gli aggiornamenti. Riporta la scheda in primo piano e gli aggiornamenti riprendono immediatamente.

## Quando una pagina sembra non aggiornarsi

Le cause più comuni, in ordine di frequenza:

1. **La scheda è rimasta in background per ore.** La connessione potrebbe essersi interrotta. Ricarica la pagina.
2. **Sei su una connessione lenta.** I messaggi WebSocket si accumulano; l'ultimo dato ricevuto prevale, ma gli aggiornamenti risultano lenti. Cambia rete o chiudi altre schede pesanti.
3. **Un ad blocker o un'estensione sta interferendo.** Alcuni blocker troppo aggressivi scartano i frame WebSocket. Prova in una finestra privata con le estensioni disattivate.
4. **Il mercato è chiuso.** Il badge di sessione lo indica. Vengono mostrati gli ultimi valori calcolati.

## Cosa controllare per prima cosa

Quando qualcosa sembra non funzionare, la diagnostica in quattro passaggi:

1. Guarda il **badge di sessione** — il mercato è aperto?
2. Guarda il **riquadro del prezzo** — il timestamp è recente?
3. Guarda l'**indicatore di connessione** nell'intestazione — è verde?
4. Ricarica forzatamente la pagina (Cmd+Shift+R o Ctrl+Shift+R).

Questo copre circa il 95% delle situazioni in cui "sembra tutto rotto".

## Consigli sulle prestazioni

### Usa un browser recente

ZeroGEX è pensato per le versioni evergreen di Chrome, Edge, Firefox e Safari (Tech Preview). Versioni più datate di browser funzioneranno tecnicamente, ma non beneficeranno delle ottimizzazioni sulle prestazioni.

### Chiudi altre schede pesanti

La dashboard trasmette diversi grafici in tempo reale. Se hai una scheda YouTube in streaming e tre finestre di TradingView aperte, il browser deve condividere la CPU tra tutte. Chiudi ciò che non ti serve.

### Disattiva le estensioni non necessarie

Le estensioni per la privacy e il blocco degli annunci generalmente non danno problemi. I blocker di script aggressivi (NoScript con impostazioni predefinite restrittive) richiedono che i domini di ZeroGEX siano inseriti in una allowlist.

### La modalità chiara è leggermente più veloce

Il tema chiaro si renderizza leggermente più velocemente del tema scuro sulla maggior parte delle configurazioni, per via di come vengono composte ombre e tinte. È una differenza marginale — ma se usi un dispositivo poco potente, vale la pena saperlo.

### Cambiare simbolo è più pesante che cambiare timeframe

Cambiare simbolo recupera nuovamente tutti i dati; cambiare timeframe riutilizza lo stream sottostante. Se ti muovi velocemente, preferisci il selettore del timeframe.

## Mobile

ZeroGEX funziona anche su smartphone — ogni pagina è responsive — ma la piattaforma è **pensata per il desktop**. La densità dei grafici presuppone uno schermo più largo di 1024px. Su mobile, scorri orizzontalmente sui grafici; i dati sono tutti presenti, ma il layout è più denso.

## Quando scrivere al supporto

Se la piattaforma stessa sembra bloccata (non la tua connessione, non una scheda non aggiornata), controlla l'indicatore di connessione in basso a destra. Se resta rosso dopo più ricariche forzate, scrivi a [support@zerogex.io](mailto:support@zerogex.io) con:

- La pagina su cui ti trovavi
- L'orario in cui è successo (con fuso orario)
- Il tuo browser e sistema operativo

I log dal nostro lato sono marcati temporalmente — questo è sufficiente per rintracciare il problema.

## Vedi anche

- [Risoluzione dei problemi](/help/platform/troubleshooting)
- [Copertura dati e aggiornamento](/help/platform/data-coverage)
