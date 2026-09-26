# Accesso API e chiavi (Pro)

*Come leggere la documentazione API, cosa sblocca il tuo livello Pro e il modello base di autenticazione e rate-limit.*

---

## Cosa ti offre l'API ZeroGEX

Tutto ciò che la piattaforma web ti mostra viene calcolato dallo stesso backend che alimenta l'API. Gli abbonati Pro ottengono accesso programmatico a:

- Riepiloghi GEX e dettagli per strike (incluso l'endpoint consolidato livelli dei dealer + profilo gamma)
- Dati di flow (premio, volume, bucket smart-money)
- Max pain e indicatori tecnici intraday (VWAP, opening range, volume, momentum)
- Segnali di trading (punteggi e stati di trigger)
- Storico GEX e cronologia dei segnali

## La documentazione

Il riferimento completo si trova su **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. La documentazione è conforme a OpenAPI 3.1 ed è disponibile in due viste:

- **Swagger UI** - interattiva; clicca su **Authorize**, incolla la tua chiave e prova le richieste direttamente dal browser
- **ReDoc** - sola lettura; più rapida per scorrere l'intera superficie API

Per inviare richieste - dalla documentazione o da qualsiasi altro posto - serve una chiave Pro. Nell'app, il link **API Specs** porta gli account Public e Basic alla pagina Pricing.

## Autenticazione

L'autenticazione utilizza **bearer token**. Generi la chiave da solo dal tuo account - non c'è nulla da aspettare:

1. Accedi e vai su **Account → API Access** (`/account#api-access`).
2. Clicca su **Generate API Key** e copia la chiave dalla visualizzazione una tantum - viene mostrata una sola volta, per pochi minuti, e poi non è più recuperabile. Conservala in un password manager o in un secret store.
3. Inviala come `Authorization: Bearer <key>` in ogni richiesta.

Le chiavi API personali sono una funzione Pro; gli account Basic e Public vengono reindirizzati a Prezzi. Generare una nuova chiave revoca immediatamente la precedente (hai al massimo una chiave attiva), quindi ruotare significa semplicemente rigenerare. Ti serve aiuto o vuoi revocare una chiave? Scrivi a [support@zerogex.io](mailto:support@zerogex.io).

## Rate limit

L'API limita le richieste per chiave, su una finestra al minuto fissata ben al di sopra di ciò che serve a dashboard di produzione e bot che rispettano una normale igiene delle richieste. Le richieste oltre il limite restituiscono `429 Too Many Requests` con un header `Retry-After`.

## Formato della risposta

Tutti gli endpoint restituiscono JSON, in due versioni:

- **v1** (`/api/...` e `/api/v1/levels/...`) - il payload è direttamente il corpo della risposta.
- **v2** (`/api/v2/...`) - lo stesso payload sotto `data`, più un blocco `freshness`: quando sono stati osservati i dati sottostanti, la sessione di mercato, da quando considerare la risposta obsoleta, e un `freshness_status` riassuntivo (`fresh`, `aging`, `stale`, `session_closed`, ...). Consigliata per le nuove integrazioni - sostituisci il `/api` iniziale (o `/api/v1`) con `/api/v2` e leggi il payload da `data`.

Gli errori restituiscono lo status HTTP corrispondente con un corpo `{"detail": ...}`, in entrambe le versioni.

I campi numerici sono tipizzati con precisione - i valori gamma sono dollari con segno, i punteggi dei singoli segnali (`clamped_score`) sono float in [-1, +1], i timestamp sono in ISO 8601 UTC.

## Pattern comuni

### Polling vs streaming

Per la maggior parte dei casi d'uso, il polling con una cadenza ragionevole (ogni pochi secondi per le metriche live, ogni minuto per lo storico) è sufficiente. Lo streaming non è attualmente esposto nell'API pubblica; la piattaforma web utilizza un canale interno.

### Caching

Le risposte restano in cache lato server per circa cinque secondi, e le analisi dietro la maggior parte degli endpoint vengono ricalcolate circa una volta al minuto, quindi un polling più fitto restituisce quasi sempre lo stesso corpo. Gli endpoint dei segnali sono contrassegnati con il timestamp del punteggio più recente, così puoi saltare le risposte identiche.

### Backfill

Gli endpoint dello storico derivato - GEX (`/api/gex/historical`), max pain e cronologia dei segnali - supportano finestre multi-giorno. I dati sulle opzioni sono l'eccezione: le quotazioni per contratto sono servite come ultima quotazione o come singola sessione intraday (`/api/option/contract`), **non** come serie storica multi-giorno - e comunque le quotazioni per contratto non fanno parte del livello standard (vedi *Cosa è riservato*). Se ti serve uno storico più lungo delle quotazioni delle opzioni, contatta il supporto con i dettagli.

## Cosa è riservato

- L'accesso API richiede un account **Pro**. Gli account Basic e Public non possono generare chiavi.
- I dati di mercato grezzi di origine - le quotazioni dei singoli contratti di opzioni (sia l'ultima quotazione sia lo storico intraday del contratto) - non fanno parte del livello API standard. L'API fornisce le analisi derivate (GEX, flow, max pain, indicatori tecnici, segnali) e il loro storico. Ti servono dati grezzi sulle opzioni per un caso d'uso specifico? Scrivi al supporto e valutiamo insieme le opzioni.

## Best practice

- Hai una sola chiave attiva, quindi tutti gli ambienti (dev, prod) la condividono. Ruotala secondo una pianificazione rigenerandola - la vecchia chiave smette subito di funzionare, quindi aggiornala ovunque la usi.
- Non inserire una chiave nel codice lato client. La piattaforma è progettata per un consumo lato server.
- Imposta uno `User-Agent` sensato - ci aiuta ad aiutarti quando una richiesta va storta.

## Integrazioni grafiche

Se vuoi soltanto i nostri livelli sul tuo grafico, potresti non dover scrivere codice. Le trovi tutte e quattro nella pagina [Integrazioni](/integrations):

- **NinjaTrader 8** - un indicatore NinjaScript incluso in Pro che interroga `GET /api/v1/levels/{symbol}` con la tua chiave Pro e disegna Gamma Flip, Call Wall, Put Wall, Max Pain e Pin Strike. Da abbonato Pro, scaricalo da una qualsiasi pagina gratuita dei livelli gamma (ad esempio [/spx-gamma-levels](/spx-gamma-levels)), importalo in NinjaTrader (**File → Utilities → Import NinjaScript…**) e incolla la tua chiave. Su un grafico ES o NQ imposta il simbolo su `ES` o `NQ`: i livelli arrivano già sull'asse di prezzo dei futures, senza alcun offset di base da applicare.
- **Sierra Chart** - uno studio ACSIL incluso in Pro che interroga lo stesso endpoint con la tua chiave e disegna gli stessi cinque livelli. Da abbonato Pro, scaricalo da [/sierra-chart-indicator](/sierra-chart-indicator) e compilalo con il compilatore integrato di Sierra Chart (**Analysis → Build Custom Studies DLL**).
- **TradingView** - uno script Pine gratuito. Solo inserimento manuale: Pine Script non può effettuare chiamate HTTP, quindi i numeri di oggi li inserisci tu.
- **thinkorswim** - uno studio thinkScript gratuito. Solo inserimento manuale: thinkScript è isolato come Pine Script, quindi ricopi lo studio ogni giorno - arriva già con i numeri del giorno.

Se la tua piattaforma non può accedere alla rete - o preferisci chiedere i livelli invece di leggerli -, collega un assistente AI al nostro [server MCP](/help/platform/mcp-server) gratuito (livelli ritardati, nessuna chiave), oppure leggi [Costruire un server MCP sull'API ZeroGEX](/help/platform/mcp-integration), che spiega come collegare l'API a un assistente.

## Vedi anche

- [Livelli, accesso e cosa sblocca ciascuno](/help/platform/tiers-and-access)
- [Copertura e aggiornamento dei dati](/help/platform/data-coverage)
- [Il server MCP di ZeroGEX (gratuito, senza chiave)](/help/platform/mcp-server)
- [Costruire un server MCP sull'API ZeroGEX](/help/platform/mcp-integration)
- [Documentazione API (esterna)](https://api.zerogex.io/docs)
