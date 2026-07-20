# Copertura dati e aggiornamento

*Simboli supportati, comportamento durante gli orari di mercato, frequenza di aggiornamento di ogni sezione e cosa succede in occasione di festività e giornate corte.*

---

## Simboli coperti

ZeroGEX offre una copertura analitica completa per tre strumenti:

- **SPY** — ETF sull'S&P 500
- **SPX** — Indice S&P 500 (opzioni di tipo europeo)
- **QQQ** — ETF sul Nasdaq 100

Questi sono i tre sottostanti più liquidi e più ricchi di gamma del mercato delle opzioni USA — gli strumenti in cui l'attività di copertura dei dealer ha il maggiore impatto sul prezzo intraday.

Non prevediamo di supportare azioni su singoli titoli. Il modello dei segnali e il concetto di regime sono progettati attorno al comportamento dei dealer a livello di indice.

## Orari di mercato

ZeroGEX utilizza sempre l'orario US Eastern:

- **Pre-market** — 4:00 – 9:30 ET
- **Sessione regolare** — 9:30 – 16:00 ET
- **After-hours** — 16:00 – 20:00 ET (dove disponibile)

Il badge di sessione nell'header conferma in quale finestra ti trovi.

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

## Perché solo SPY / SPX / QQQ

Due motivi:

1. Il modello di posizionamento dei dealer funziona bene solo dove il flow dei dealer rappresenta una frazione significativa del flow totale. Questo è il complesso degli indici.
2. Preferiamo fare bene tre strumenti piuttosto che fare a metà dieci strumenti.

Le azioni su singoli titoli possono muoversi per notizie idiosincratiche che rendono la lettura del GEX più rumorosa. Non è il nostro campo.

## Vedi anche

- [Accesso API e chiavi (Pro)](/help/platform/api-access)
- [Streaming e prestazioni](/help/platform/streaming-and-performance)
