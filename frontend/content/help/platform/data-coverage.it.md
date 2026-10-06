# Copertura dati e aggiornamento

*Simboli supportati, comportamento durante gli orari di mercato, frequenza di aggiornamento di ogni sezione e cosa succede in occasione di festività e giornate corte.*

---

## Simboli coperti

ZeroGEX offre una copertura analitica completa per quattro sottostanti a pronti:

- **SPY** - ETF sull'S&P 500
- **SPX** - Indice S&P 500 (opzioni di tipo europeo)
- **QQQ** - ETF sul Nasdaq 100
- **NDX** - Indice Nasdaq 100 (opzioni di tipo europeo)

Questi sono i quattro sottostanti più liquidi e più ricchi di gamma del mercato delle opzioni USA - gli strumenti in cui l'attività di copertura dei dealer ha il maggiore impatto sul prezzo intraday.

A questi si aggiungono due futures su indici del CME, come simboli a pieno titolo:

- **ES** - future E-mini S&P 500
- **NQ** - future E-mini Nasdaq 100

ES e NQ non hanno un book di opzioni proprio. ES e SPX seguono lo stesso indice, quindi il book dei dealer dietro un grafico ES *è* il book dell'SPX: i livelli SPX (o NDX, per NQ) vengono proiettati sull'asse dei prezzi del future, mentre la serie dei prezzi arriva dal feed CME. La proiezione usa il carry teorico del contratto che quotiamo (tassi d'interesse meno il rendimento da dividendi dell'indice, sul tempo che manca alla sua scadenza), quindi non c'è alcun offset di base da configurare, e a ogni rollover trimestrale i livelli passano al nuovo contratto insieme al prezzo. Poiché il carry corrisponde al fair value, i livelli possono risultare leggermente spostati quando i futures scambiano sopra o sotto di esso, per esempio di notte o in occasione di notizie. Le esposizioni in dollari (GEX netto, call e put) sono deliberatamente lasciate non proiettate: l'istogramma scala sull'esposizione *relativa*, quindi la forma è la stessa in entrambi i casi. I micro (/MES, /MNQ) sono lo stesso contratto a un decimo della dimensione, quindi valgono gli stessi livelli.

Le azioni su singoli titoli sono nella roadmap, a cominciare dai Magnificent Seven (AAPL, MSFT, NVDA, AMZN, GOOGL, META e TSLA). Finché un titolo non è disponibile, il modello dei segnali e il concetto di regime si basano sul comportamento dei dealer a livello di indice, e questa pagina elencherà ogni titolo man mano che viene aggiunto.

## Orari di mercato

ZeroGEX utilizza sempre l'orario US Eastern:

- **Pre-market** - 4:00 - 9:30 ET
- **Sessione regolare** - 9:30 - 16:00 ET
- **After-hours** - 16:00 - 20:00 ET (dove disponibile)

Il badge di sessione nell'header conferma in quale finestra ti trovi.

**ES e NQ seguono invece la sessione elettronica del CME**, molto più ampia: dalla domenica alle 18:00 ET ininterrottamente fino al venerdì alle 17:00 ET, con una pausa di manutenzione giornaliera dalle 17:00 alle 18:00 ET. Questo copre per intero le sessioni asiatica ed europea, e le quotazioni ES/NQ sono CME in tempo reale. Durante la notte - dalle 18:00 ET fino all'apertura delle 9:30, mentre i futures sono in contrattazione - SPX e NDX mostrano il loro future al posto dell'indice a pronti congelato: il badge di sessione riporta «Futures» e il prezzo nell'intestazione mostra il future, con la variazione misurata rispetto al suo prezzo delle 16:00 ET.

I livelli dei dealer su un grafico di futures continuano a derivare dal book di opzioni dell'indice, che quota durante l'orario statunitense. Di notte stai quindi osservando ES/NQ scambiare dal vivo contro i livelli così com'erano alla chiusura USA, aggiornati man mano che vengono pubblicati i dati notturni della chain (vedi *Pre-market e after-hours* più sotto); non vengono ricalcolati tick per tick alle 3:00 ET. Se una quotazione dei futures diventa obsoleta, il prezzo riporta un badge con il ritardo misurato.

## Frequenza di aggiornamento per sezione

| Sezione | Frequenza |
| --- | --- |
| Quotazione prezzo | Circa ogni secondo |
| Riepilogo GEX, wall, flip e max pain | Ricalcolati circa una volta al minuto |
| Heatmap GEX strike/DTE | Ricalcolata circa una volta al minuto |
| Flusso delle opzioni | Barre da cinque minuti |
| Punteggi dei segnali | Circa una volta al minuto |
| Punteggio composito | Circa una volta al minuto |
| Indicatori di volatilità (VIX / VXN) | Barre da cinque minuti |
| Bollettino live | Prezzo ogni 5 secondi; i livelli sono i valori ricalcolati ogni minuto indicati sopra, ripresi entro circa 10 secondi; volatilità ogni ~30 secondi |
| Dati di backtesting | Dati storici al minuto, non in tempo reale |

Non è necessario aggiornare la pagina. Le pagine cercano nuovi dati ogni pochi secondi (ogni 5 secondi sulle pagine dei segnali), quindi un nuovo valore compare pochi secondi dopo essere stato calcolato.

Una nota sulle sezioni GEX: "aggiornamento" significa che l'esposizione viene **ricalcolata**, non che l'open interest venga interrogato di nuovo tick per tick. L'open interest delle opzioni quotate viene conteggiato dalla camera di compensazione dopo la sessione e pubblicato per la giornata di contrattazione *successiva* - non si forma dal vivo durante la giornata. Le variazioni intraday del riepilogo GEX e della heatmap derivano quindi dalla rivalutazione del book esistente man mano che si muovono spot, tempo e volatilità implicita - non da nuovo open interest confermato. Le stime della copertura generata dalle operazioni della giornata sono una lettura separata, nella pagina [Hedging Flow](/help/platform/hedging-flow), *dedotta* dalla classificazione delle operazioni anziché da open interest confermato.

## Pre-market e after-hours

Durante gli orari estesi:

- L'intestazione mostra l'ultima chiusura della sessione regolare e la sua variazione, con su una seconda riga il prezzo live degli orari estesi e il suo movimento da quella chiusura.
- I punteggi dei segnali continuano ad aggiornarsi dove i dati sono sufficienti. Alcuni segnali (EOD Pressure, 0DTE Position Imbalance) vengono calcolati intenzionalmente solo durante la sessione regolare.
- La superficie GEX riflette lo stato di chiusura della sessione regolare più eventuali aggiornamenti della catena durante la notte - incluso l'open interest compensato per la sessione successiva, non appena viene pubblicato.

## Quando il mercato è chiuso

Quando il mercato è chiuso, la piattaforma mostra i valori di chiusura dell'ultima sessione regolare per tutte le sezioni. Il badge di sessione indica "Closed".

## Festività

Festività di mercato a giornata intera - nessun dato live; la piattaforma mostra la sessione precedente.

Giornate corte (chiusura anticipata alle 13:00 ET in prossimità di alcune festività) - la piattaforma rispetta la chiusura anticipata. L'EOD Pressure mantiene la sua consueta finestra dalle 14:30 alle 16:00 ET, quindi resta inattiva in una giornata corta.

## Profondità storica

- **Dati intraday dettagliati** - gli snapshot completi della catena di opzioni, il GEX per strike e il flow a livello di contratto vengono conservati per una finestra mobile di circa due-tre mesi, non per anni.
- **Serie più leggere** - le barre di prezzo al minuto e il riepilogo GEX principale vengono conservati più a lungo.
- **Backtesting** - si basa su un archivio separato della catena di opzioni. L'intervallo di date della pagina Backtesting mostra esattamente cosa è disponibile per un test.

## Fonti dati

ZeroGEX utilizza dati di mercato in tempo reale su opzioni e sottostanti. Vale la pena essere precisi su cosa significa, perché non si tratta di un unico tape:

- **Le quotazioni e le operazioni sulle opzioni** su SPY, QQQ, SPX e NDX si basano su OPRA, il tape consolidato delle opzioni quotate negli USA.
- **I valori degli indici SPX e NDX** provengono da un feed di indici separato, non dal tape delle opzioni.
- **I prezzi di SPY e QQQ** provengono da un feed azionario in tempo reale.
- I prezzi di **ES e NQ** provengono dal feed CME in tempo reale.
- L'**open interest** è un dato separato di fine sessione proveniente dal clearing, non un valore in tempo reale.

Le greche e ogni metrica di posizionamento dei dealer sono calcolate da ZeroGEX a partire da questi input, anziché fornite già pronte da un fornitore - vedi [Metodologia e validazione](/methodology). Non divulghiamo pubblicamente i nomi specifici dei fornitori.

## Latenza

Durante gli orari regolari, i prezzi arrivano tipicamente nel tuo browser pochi secondi dopo la stampa sul tape. I dati di posizionamento dei dealer e i segnali seguono con un ritardo voluto, perché vengono ricalcolati secondo i cicli indicati sopra anziché a ogni operazione. Se gli aggiornamenti sembrano più lenti, vedi [Streaming e prestazioni](/help/platform/streaming-and-performance).

## Perché prima il complesso degli indici

Due motivi:

1. Il modello di posizionamento dei dealer funziona bene solo dove il flow dei dealer rappresenta una frazione significativa del flow totale. Questo è il complesso degli indici - SPY, SPX, QQQ, NDX e i futures ES / NQ, che seguono quegli stessi due indici.
2. Preferiamo fare bene una manciata di strumenti piuttosto che fare a metà dieci strumenti.

Le azioni su singoli titoli possono muoversi per notizie idiosincratiche, soprattutto intorno alle trimestrali, che rendono la lettura del GEX più rumorosa. Per questo vengono aggiunte poche alla volta, a cominciare dai Magnificent Seven, dove il mercato delle opzioni è più profondo, anziché tutte insieme.

## Vedi anche

- [Accesso API e chiavi (Pro)](/help/platform/api-access)
- [Streaming e prestazioni](/help/platform/streaming-and-performance)
