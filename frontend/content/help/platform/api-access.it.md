# Accesso API e chiavi (Pro)

*Come leggere la documentazione API, cosa sblocca il tuo livello Pro e il modello base di autenticazione e rate-limit.*

---

## Cosa ti offre l'API ZeroGEX

Tutto ciò che la piattaforma web ti mostra viene calcolato dallo stesso backend che alimenta l'API. Gli abbonati Pro ottengono accesso programmatico a:

- Riepiloghi GEX e dettagli per strike
- Quotazioni in tempo reale
- Dati di flow (premio, volume, bucket smart-money)
- Segnali di trading (punteggi e stati di trigger)
- Barre storiche e cronologia dei segnali

## La documentazione

Il riferimento completo si trova su **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. La documentazione è conforme a OpenAPI 3.0 ed è disponibile in due viste:

- **Swagger UI** — interattiva; prova le richieste direttamente dal browser
- **ReDoc** — sola lettura; più rapida per scorrere l'intera superficie API

La documentazione richiede un account Pro. Gli utenti pubblici vengono reindirizzati alla pagina Pricing al clic.

## Autenticazione

L'autenticazione utilizza **bearer token**. Generi la chiave da solo dal tuo account — non c'è nulla da aspettare:

1. Accedi e vai su **Account → Accesso API** (`/account#api-access`).
2. Assegna alla chiave il nome della macchina o dell'integrazione a cui è destinata («desktop», «NinjaTrader»). È facoltativo, ma è ciò che ti permetterà di distinguere le tue chiavi in seguito.
3. Clicca su **Genera chiave API** e copia la chiave dalla visualizzazione una tantum — viene mostrata una sola volta, per pochi minuti, e poi non è più recuperabile. Conservala in un password manager o in un secret store.
4. Inviala come `Authorization: Bearer <key>` in ogni richiesta.

Le chiavi API personali sono una funzione Pro; gli account Basic e Public vengono reindirizzati a Prezzi. Puoi avere **fino a tre chiavi attive contemporaneamente**, così una seconda macchina riceve la propria chiave invece di subentrare a quella della prima: generare una chiave non tocca mai quelle che hai già. Ogni chiave indica quando è stata usata l'ultima volta, il modo più rapido per capire se un'integrazione si sta ancora autenticando. Revoca una singola chiave dalla stessa pagina quando dismetti una macchina; le altre continuano a funzionare. Ti serve aiuto o vuoi revocare una chiave fuori dalla procedura? Scrivi a [support@zerogex.io](mailto:support@zerogex.io).

## Rate limit

L'API applica rate limit per ogni chiave. I limiti scalano in base al livello:

- **Pro** — limiti generosi al minuto e al giorno, sufficienti per dashboard di produzione e bot che rispettano una normale igiene delle richieste.

Le richieste oltre il limite restituiscono `429 Too Many Requests` con un header `Retry-After`.

## Formato della risposta

Tutti gli endpoint restituiscono JSON. Campi standard:

- `data` — il payload
- `meta` — paginazione, timestamp, ID della richiesta
- `error` — presente nelle risposte di errore; omesso in caso di successo

I campi numerici sono tipizzati con precisione — i valori gamma sono dollari con segno, i punteggi sono float in [-1, +1], i timestamp sono in ISO 8601 UTC.

## Pattern comuni

### Polling vs streaming

Per la maggior parte dei casi d'uso, il polling con una cadenza ragionevole (ogni pochi secondi per le metriche live, ogni minuto per lo storico) è sufficiente. Lo streaming non è attualmente esposto nell'API pubblica; la piattaforma web utilizza un canale interno.

### Caching

La maggior parte degli endpoint imposta header di cache HTTP sensati — rispettali. Gli endpoint dei segnali sono contrassegnati con il timestamp del punteggio più recente, così puoi saltare le risposte identiche.

### Backfill

Gli endpoint storici supportano finestre multi-giorno. Per backfill approfonditi, pagina usando il campo `meta.cursor`.

## Cosa è riservato

- L'accesso API richiede un account **Pro**. Gli account Basic e Public non possono generare chiavi.
- Alcuni endpoint hanno flag aggiuntivi riservati ai Pro (ad esempio, dump grezzi delle chain) — la documentazione li segnala.

## Best practice

- Una chiave per macchina o ambiente (portatile, server di produzione, NinjaTrader), con il nome di ciò su cui gira: è quel nome a rendere evidente, mesi dopo, quale chiave è ormai obsoleta.
- Ruota senza interruzioni: genera la chiave sostitutiva, sposta l'integrazione, verifica che la nuova chiave mostri un «ultimo utilizzo» recente e solo allora revoca la vecchia.
- Non inserire una chiave nel codice lato client. La piattaforma è progettata per un consumo lato server.
- Imposta uno `User-Agent` sensato — ci aiuta ad aiutarti quando una richiesta va storta.

## Integrazioni grafiche

Se vuoi soltanto i nostri livelli sul tuo grafico, potresti non dover scrivere codice:

- **NinjaTrader 8** — un indicatore NinjaScript gratuito che interroga `GET /api/v1/levels/{symbol}` con la tua chiave Pro e disegna Gamma Flip, Call Wall, Put Wall, Max Pain e Pin Strike. Scaricalo da una qualsiasi pagina gratuita dei livelli gamma (ad esempio [/spx-gamma-levels](/spx-gamma-levels)), compilalo nell'Editor NinjaScript e incolla la tua chiave. Su un grafico ES o NQ imposta il simbolo su `ES` o `NQ`: i livelli arrivano già sull'asse di prezzo dei futures, senza alcun offset di base da applicare.
- **TradingView** — uno script Pine gratuito. Solo inserimento manuale: Pine Script non può effettuare chiamate HTTP, quindi i numeri di oggi li inserisci tu.

## Vedi anche

- [Livelli, accesso e cosa sblocca ciascuno](/help/platform/tiers-and-access)
- [Copertura e aggiornamento dei dati](/help/platform/data-coverage)
- [Documentazione API (esterna)](https://api.zerogex.io/docs)
