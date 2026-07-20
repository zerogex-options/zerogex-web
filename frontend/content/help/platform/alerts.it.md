# Avvisi sui segnali

*Come i trigger dei segnali emergono all'interno della piattaforma, cosa scatta rispetto a cosa resta silenzioso, e come usare il Live Bulletin come registro dei tuoi avvisi.*

---

## Dove compaiono gli avvisi

ZeroGEX fornisce gli avvisi **in-app**, non via SMS o notifica push. Ci sono tre punti in cui emergono:

1. **Live Bulletin** — ogni trigger arriva qui con il contesto completo. Questo è il tuo registro di controllo.
2. **La scheda del segnale** — nella dashboard o nella pagina elenco segnali, un trigger illumina la scheda e la colora nella direzione dello score.
3. **Il pannello composito** — quando un trigger ha una convinzione sufficientemente alta, sposta visibilmente il composito.

Questo è intenzionale. ZeroGEX è progettato per essere **osservato, non interrotto**. Gli avvisi in stile push causano overtrading; il registro in-app ti permette di scorrere quando decidi tu.

## Cosa scatta

Scattano solo i trigger dei segnali Advanced e gli eventi strutturali:

- Gli otto segnali Advanced quando vengono superate le rispettive soglie di trigger.
- Gli incroci di gamma flip.
- Le transizioni di regime (gamma positivo ↔ negativo allo spot).
- Le migrazioni di wall superiori allo 0,5% rispetto al livello precedente.
- Gli eventi di flow rilevanti (block print, cluster di sweep, movimenti di smart money).

I segnali Basic **non** scattano. Sono input continui per il composito.

## Come atterra un trigger

Quando un trigger scatta:

1. Lo score del segnale viene registrato al momento dell'incrocio.
2. Viene creata la riga nel Live Bulletin con timestamp, direzione, score, soglia e contesto.
3. La scheda del segnale su ogni pagina riflette il nuovo stato.
4. Il composito si aggiorna.

Se un segnale rimane in stato di trigger per più barre, nel bulletin viene registrato solo il **primo** evento di trigger. Le barre successive vengono aggregate nella voce esistente.

## Riferimento soglie di trigger

| Segnale | Soglia |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

## Perché alcuni segnali non scattano

Un segnale può trovarsi a +0.7 e **non** essere in stato di trigger. I motivi:

- La soglia di trigger del segnale utilizza un composito (Market Pressure richiede anche loading ≥ 50).
- Il segnale è vincolato a una finestra di sessione (EOD Pressure è attivo solo dalle 14:30 alle 15:45 ET).
- Il segnale ha un debounce — deve mantenere la soglia per un numero minimo di barre.

La scheda del segnale sulla pagina spiegherà lo stato attuale del trigger in linguaggio semplice.

## Usare il bulletin come registro dei tuoi avvisi

Il Live Bulletin è il **sistema di registrazione** ufficiale per i trigger. Se sei andato a pranzo, non devi aprire ogni pagina per vedere cosa è scattato — apri il bulletin, filtra per simbolo e famiglia di segnali, e leggi gli eventi della giornata in ordine cronologico.

## Cosa arriverà

Al momento non inviamo avvisi via email, SMS, notifica push o webhook. Se la domanda lo giustifica, questi canali potranno essere aggiunti — scrivi a [support@zerogex.io](mailto:support@zerogex.io) per votare.

## Vedi anche

- [Usare il Live Bulletin](/help/platform/live-bulletin)
- [Come funzionano i segnali end-to-end](/help/platform/signals-overview)
- [Preferenze email](/help/platform/email-preferences)
