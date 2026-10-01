# Perché il nostro prezzo dei futures può differire da quello di un'altra piattaforma

*Perché una quotazione ES o NQ qui può trovarsi a qualche centinaio di punti dallo stesso ticker su un altro grafico - e perché entrambi i numeri sono corretti.*

---

**Risposta breve:** potremmo star quotando un mese di contratto diverso da quello del grafico con cui ti stai confrontando. Entrambi i numeri sono corretti. Sono strumenti diversi.

## I futures si negoziano come contratti con una data

ES e NQ non hanno un prezzo unico. Si negoziano come contratti separati con scadenza a marzo, giugno, settembre e dicembre, e diversi di essi scambiano contemporaneamente, a prezzi differenti.

Non è una particolarità dei nostri dati: è il modo in cui la borsa li quota. Un future sull'S&P 500 che liquida fra tre mesi e uno che liquida la settimana prossima sono due contratti distinti con due book di ordini distinti, e niente costringe i loro prezzi a convergere finché il più vicino non scade.

Quotiamo il contratto che porta il volume - quello scambiato attivamente.

## I contratti fanno rollover ogni trimestre

Circa una settimana prima della scadenza di un contratto, il volume di negoziazione migra su quello successivo. I fornitori di dati spostano i loro feed in quel momento - ma **non tutti lo stesso giorno**. Ognuno sceglie il proprio criterio: un numero fisso di giorni prima della scadenza, un incrocio di volumi o di open interest, o una regola di calendario fissata anni fa.

Nella settimana circa che separa il passaggio di un fornitore da quello di un altro, due piattaforme che scrivono entrambe «NQ» mostrano contratti diversi. Nessuna delle due è guasta. Stanno semplicemente rispondendo a domande leggermente diverse su cosa significhi «NQ» oggi.

Questa è l'intera causa della discrepanza, ed è il motivo per cui non pubblichiamo una singola data di rollover: non ne esiste una.

## La differenza è il carry

Un contratto che liquida fra tre mesi vale più di uno che liquida questa settimana. La differenza è il costo di finanziare la posizione fino a quel momento, meno i dividendi a cui rinunci tenendo futures invece delle azioni.

Su un rollover trimestrale si tratta tipicamente di circa l'**1 % su NQ** e lo **0,8 % su ES**. Su NQ è maggiore perché il Nasdaq-100 paga meno dividendi dell'S&P 500, quindi il suo carry è più alto.

Su NQ sono qualche centinaio di punti - abbastanza da sembrare un feed rotto, ed è esattamente per questo che indichiamo il contratto direttamente invece di lasciartelo dedurre.

La stessa aritmetica spiega uno scalino in un grafico su più giorni. Un intervallo che attraversa un rollover contiene davvero due contratti, quindi il prezzo salta dove uno finisce e comincia il successivo. Quello scalino è carry, non un movimento di mercato, e i grafici che attraversano un rollover lo segnalano.

## Come verificarlo

1. Passa il mouse sul badge del contratto in qualsiasi vista ES o NQ, toccalo o portaci il focus da tastiera. Indica il contratto esatto che stiamo quotando e quando quel contratto scade.
2. Imposta l'altra piattaforma sullo stesso contratto.
3. I prezzi dovrebbero allinearsi.

Se l'altro feed è differito - molti feed gratuiti sono 10-15 minuti indietro -, resterà una piccola differenza dovuta al ritardo stesso. Quella è di pochi punti, non di qualche centinaio.

## Quando si risolve

Una volta scaduto il vecchio contratto, tutte le piattaforme sono sul nuovo e la differenza scompare. Torna al rollover trimestrale successivo, e si comporta allo stesso modo ogni volta.

## Questo influisce sui livelli dei dealer?

No. Il gamma flip, i walls, il max pain e il resto vengono calcolati dalle catene di opzioni SPX e NDX e poi proiettati sull'asse dei prezzi del future usando il carry teorico del contratto che quotiamo. A un rollover la proiezione passa al carry del nuovo contratto insieme al prezzo, quindi i livelli seguono sempre il contratto che stiamo quotando, senza alcun offset di base da configurare. Poiché il carry corrisponde al fair value, i livelli possono risultare leggermente spostati quando i futures scambiano sopra o sotto di esso. Per come vengono serviti ES e NQ, vedi [Copertura dati e aggiornamento](/help/platform/data-coverage).

## Ancora non torna?

Se entrambe le parti sono sullo stesso contratto e i prezzi differiscono ancora più di quanto il ritardo giustifichi, si tratta di altro. Scrivici a [support@zerogex.io](mailto:support@zerogex.io) con uno screenshot e l'orario.

## Vedi anche

- [Copertura dati e aggiornamento](/help/platform/data-coverage)
- [Risoluzione dei problemi](/help/platform/troubleshooting)
- [Come leggere i grafici di ZeroGEX](/help/platform/reading-charts)
