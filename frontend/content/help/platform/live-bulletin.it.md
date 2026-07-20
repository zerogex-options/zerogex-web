# Usare il Live Bulletin

*Il flusso in tempo reale di eventi di segnale, cambi di regime e flussi rilevanti.*

---

## Cos'è il Live Bulletin

Il Live Bulletin è la tua **timeline della giornata di trading**. Ogni volta che un segnale scatta, il regime GEX cambia, un wall si sposta in modo significativo, o un flusso di smart money si presenta in dimensioni rilevanti, viene registrata una voce nel bulletin.

Pensalo come la "vista newsfeed" di tutto ciò che ZeroGEX rileva, classificato per importanza e orario.

## Cosa arriva nel bulletin

Ci sono cinque famiglie di elementi:

- **Signal triggers** — quando un segnale Advanced supera la sua soglia di attivazione.
- **Regime events** — attraversamento del gamma flip, transizione di regime (positivo ↔ negativo).
- **Wall events** — call wall o put wall che migra di una quantità significativa.
- **Flow notables** — picchi di premio, run di smart money, blocchi insoliti.
- **Schedule events** — apertura del mercato, apertura della finestra di pressione EOD, chiusura.

## Come vengono valutati e ordinati gli elementi

Ogni elemento ha:

- Un **timestamp** — quando si è verificato (e un badge "fresh" per gli elementi più recenti)
- Un **direction chip** — bullish, bearish o neutral
- Un **conviction score** — quanto è forte stato il segnale/evento

Gli elementi sono ordinati per tempo dall'alto verso il basso per impostazione predefinita. Puoi passare all'ordinamento per importanza usando il menu a tendina di ordinamento.

## Leggere un elemento

Ogni riga ha:

1. **Title** — il nome dell'evento ("EOD Pressure fired", "Trap Detection bearish", "Gamma flip crossed").
2. **Subtitle** — il contesto chiave (simbolo, punteggio, livello).
3. **Time** — relativo ("4m ago") e assoluto al passaggio del mouse.
4. **Action** — clicca su "Open" per andare direttamente alla pagina del segnale o della metrica pertinente.

Per i trigger, le righe mostrano anche il **punteggio che ha attivato l'evento** e la **soglia di attivazione**, così puoi vedere se si è trattato di un evento borderline o di uno forte.

## Filtri

La barra dei filtri ti permette di delimitare il feed per:

- **Symbol** — SPY, SPX, QQQ (di default il simbolo che hai attualmente attivo)
- **Signal family** — Advanced, Basic, Regime, Flow, Schedule
- **Direction** — bullish, bearish, neutral
- **Time window** — ultima ora, oggi, ultime 24h, ultimi 5 giorni di negoziazione

I filtri si combinano tra loro. Puoi sovrapporre symbol = SPX con signal family = Advanced e direction = bearish per far emergere solo i trigger Advanced bearish su SPX.

## Quando il bulletin è più utile

- **Al mattino** — scorri indietro sulle ultime sessioni per vedere cosa è scattato durante la notte e nel pre-market.
- **Attorno ai livelli principali** — quando il prezzo si avvicina al gamma flip, al call wall o al put wall, aspettati che arrivino nuovi eventi.
- **Nell'ultima ora** — il segnale EOD Pressure spesso fornisce letture azionabili a partire dalle 14:30 ET.
- **Come strumento di journaling** — ogni segnale attivato viene registrato, quindi il bulletin è il registro di controllo di come si è svolta la tua giornata.

## Cosa non è

Il Live Bulletin **non è un feed di segnali di trading**. Gli elementi sono eventi che meritano la tua attenzione; se si traducano in operazioni dipende dalla tua strategia. Il pannello Composite Score è la cosa più vicina a una lettura di "cosa significa questo per la direzione", e anche quello è un filtro, non una previsione.

## Visibilità per livello

- Il livello Basic vede gli eventi di segnale Basic, gli eventi di regime, gli eventi wall e i flow notables.
- Il livello Pro vede in aggiunta i trigger di segnale Advanced.

Gli elementi bloccati (per i prompt di upgrade del livello) mostrano un chip di blocco invece di scomparire.

## Lo specchio admin

Esiste una versione admin del bulletin senza watermark, usata per screenshot e demo. Si tratta di un percorso solo interno.

## Vedi anche

- [Come funzionano i segnali end-to-end](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signal Alerts](/help/platform/alerts)
