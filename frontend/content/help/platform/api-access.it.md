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

L'autenticazione utilizza **bearer token**. La generazione self-serve delle chiavi dalla tua pagina Account è in arrivo; fino al lancio, le chiavi vengono rilasciate manualmente:

1. Scrivi a [support@zerogex.io](mailto:support@zerogex.io) dall'indirizzo email del tuo account (solo account Pro).
2. Ti inviamo una chiave e le note di configurazione.
3. Includila come `Authorization: Bearer <key>` in ogni richiesta.

Hai bisogno di ruotare o revocare una chiave? Scrivi al supporto e la gestiremo rapidamente.

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

- Una chiave per ambiente (dev, prod). Ruotale secondo una pianificazione.
- Non inserire una chiave nel codice lato client. La piattaforma è progettata per un consumo lato server.
- Imposta uno `User-Agent` sensato — ci aiuta ad aiutarti quando una richiesta va storta.

## Vedi anche

- [Livelli, accesso e cosa sblocca ciascuno](/help/platform/tiers-and-access)
- [Copertura e aggiornamento dei dati](/help/platform/data-coverage)
- [Documentazione API (esterna)](https://api.zerogex.io/docs)
