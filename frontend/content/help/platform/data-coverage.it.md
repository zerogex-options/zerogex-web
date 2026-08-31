# Copertura dati e aggiornamento

*Simboli supportati, comportamento durante gli orari di mercato, frequenza di aggiornamento di ogni sezione e cosa succede in occasione di festività e giornate corte.*

---

## Simboli coperti

ZeroGEX offre una copertura analitica completa per quattro sottostanti a pronti:

- **SPY** — ETF sull'S&P 500
- **SPX** — Indice S&P 500 (opzioni di tipo europeo)
- **QQQ** — ETF sul Nasdaq 100
- **NDX** — Indice Nasdaq 100 (opzioni di tipo europeo)

Questi sono i quattro sottostanti più liquidi e più ricchi di gamma del mercato delle opzioni USA — gli strumenti in cui l'attività di copertura dei dealer ha il maggiore impatto sul prezzo intraday.

A questi si aggiungono due futures su indici del CME, come simboli a pieno titolo:

- **ES** — future E-mini S&P 500
- **NQ** — future E-mini Nasdaq 100

ES e NQ non hanno un book di opzioni proprio. ES e SPX seguono lo stesso indice, quindi il book dei dealer dietro un grafico ES *è* il book dell'SPX: i livelli SPX (o NDX, per NQ) vengono proiettati sull'asse dei prezzi del future, mentre la serie dei prezzi arriva dal feed CME. Il rapporto di proiezione è misurato sul tape anziché modellato dal carry, quindi si autocorregge a ogni rollover trimestrale e non c'è alcun offset di base da configurare. Le esposizioni in dollari (GEX netto, call e put) sono deliberatamente lasciate non proiettate: l'istogramma scala sull'esposizione *relativa*, quindi la forma è la stessa in entrambi i casi. I micro (/MES, /MNQ) sono lo stesso contratto a un decimo della dimensione, quindi valgono gli stessi livelli.

Non prevediamo di supportare azioni su singoli titoli. Il modello dei segnali e il concetto di regime sono progettati attorno al comportamento dei dealer a livello di indice.

## Orari di mercato

ZeroGEX utilizza sempre l'orario US Eastern:

- **Pre-market** — 4:00 – 9:30 ET
- **Sessione regolare** — 9:30 – 16:00 ET
- **After-hours** — 16:00 – 20:00 ET (dove disponibile)

Il badge di sessione nell'header conferma in quale finestra ti trovi.

**ES e NQ seguono invece la sessione elettronica del CME**, molto più ampia: dalla domenica alle 18:00 ET ininterrottamente fino al venerdì alle 17:00 ET, con una pausa di manutenzione giornaliera dalle 17:00 alle 18:00 ET. Questo copre per intero le sessioni asiatica ed europea, e le quotazioni ES/NQ sono CME in tempo reale. Quando un indice a pronti è chiuso ma il suo future è in contrattazione, il badge di sessione riporta «Futures» e il riquadro del prezzo mostra il future — con la variazione misurata rispetto alla sua chiusura delle 16:00 ET — anziché l'indice a pronti congelato.

I livelli dei dealer su un grafico di futures continuano a derivare dal book di opzioni dell'indice, che quota durante l'orario statunitense. Di notte stai quindi osservando ES/NQ scambiare dal vivo contro i livelli così com'erano alla chiusura USA, aggiornati man mano che vengono pubblicati i dati notturni della chain (vedi *Pre-market e after-hours* più sotto); non vengono ricalcolati tick per tick alle 3:00 ET. Se una quotazione dei futures diventa obsoleta, il prezzo riporta un badge con il ritardo misurato.

## Frequenza di aggiornamento per sezione

| Sezione | Frequenza |
| --- | --- |
| Quotazione prezzo | 1 secondo |
| Riepilogo GEX | 5–15 secondi |
| Heatmap GEX strike/DTE | 5–15 secondi |
| Flow / tape | 1 secondo |
| Punteggi dei segnali | 1–5 secondi a seconda del segnale |
| Composite Score | 5 secondi |
| Live Bulletin | basato su eventi, in tempo reale |
| Dati di backtesting | snapshot di fine giornata (EOD) |

Non è necessario aggiornare la pagina. Tutto è in streaming.

## Pre-market e after-hours

Durante gli orari estesi:

- Il riquadro del prezzo mostra la quotazione degli orari estesi insieme alla chiusura della precedente sessione regolare.
- I punteggi dei segnali continuano ad aggiornarsi dove i dati sono sufficienti. Alcuni segnali (EOD Pressure, 0DTE Position Imbalance) vengono calcolati intenzionalmente solo durante la sessione regolare.
- La superficie GEX riflette lo stato di chiusura della sessione regolare più eventuali aggiornamenti della catena durante la notte.

## Quando il mercato è chiuso

Quando il mercato è chiuso, la piattaforma mostra i valori di chiusura dell'ultima sessione regolare per tutte le sezioni. Il badge di sessione indica "Closed". Le pagine dei segnali mostrano i timestamp di "ultimo calcolo".

## Festività

Festività di mercato a giornata intera (con l'eccezione della vigilia di Capodanno) — nessun dato live; la piattaforma mostra la sessione precedente.

Giornate corte (chiusura anticipata alle 13:00 ET per alcuni venerdì vicino alle festività) — la piattaforma rispetta la chiusura anticipata. La finestra dell'EOD Pressure si adatta a una rampa dalle 11:30 ET nelle giornate corte.

## Profondità storica

- **Quotazioni e flow** — diversi anni di barre storiche.
- **Punteggi dei segnali** — ricostruiti fino all'introduzione di ciascun segnale.
- **Superfici GEX** — storico degli snapshot giornalieri; lo storico intraday è limitato alla finestra recente.

La pagina di Backtesting mostra l'orizzonte storico disponibile per il segnale selezionato.

## Fonti dati

ZeroGEX utilizza **dati opzioni del feed OPRA** (il tape consolidato per le opzioni USA) insieme al feed di quotazione dell'azione sottostante. Entrambe sono fonti dati professionali e in tempo reale.

Non divulghiamo pubblicamente i nomi specifici dei fornitori, ma lo standard qualitativo è di livello istituzionale — gli stessi feed dati utilizzati dai desk quantitativi.

## Latenza

La latenza end-to-end dalla stampa di un'operazione sul tape fino al suo arrivo nel tuo browser è tipicamente inferiore a un secondo durante gli orari regolari. Il collo di bottiglia raramente sono i dati — sono piuttosto la tua rete e il tuo browser. Vedi [Streaming e prestazioni](/help/platform/streaming-and-performance).

## Perché solo il complesso degli indici

Due motivi:

1. Il modello di posizionamento dei dealer funziona bene solo dove il flow dei dealer rappresenta una frazione significativa del flow totale. Questo è il complesso degli indici — SPY, SPX, QQQ, NDX e i futures ES / NQ, che seguono quegli stessi due indici.
2. Preferiamo fare bene una manciata di strumenti piuttosto che fare a metà dieci strumenti.

Le azioni su singoli titoli possono muoversi per notizie idiosincratiche che rendono la lettura del GEX più rumorosa. Non è il nostro campo.

## Vedi anche

- [Accesso API e chiavi (Pro)](/help/platform/api-access)
- [Streaming e prestazioni](/help/platform/streaming-and-performance)
