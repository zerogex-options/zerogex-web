# Analisi del flusso

*Flusso ponderato per il premio e a volume netto, la scomposizione dell'aggressore secondo Lee-Ready, e come individuare la vera convinzione nel tape.*

---

## Cosa mostra questa pagina

La pagina Flow Analysis è la **vista del tape** del mercato delle opzioni. Mentre Dealer Positioning mostra il book statico, questa pagina mostra il **flusso** - cosa è stato scambiato oggi e quale lato ha attraversato lo spread per scambiarlo.

Tre menu nell'intestazione valgono per tutta la pagina: **Session** (la sessione corrente o quella precedente, così vedi se oggi è davvero insolito), **Bars** (**5 min** o **1 min** - quanto finemente i grafici suddividono la sessione) e **Volume basis** (**Directional** o **Total Traded** - vedi sotto).

## Le tre lenti del flusso

ZeroGEX mostra il flusso attraverso tre lenti, perché ciascuna conta in modo diverso.

### Volume netto dei contratti

Semplicemente conta i contratti. Utile come base di rumore. Inutile come lettura di convinzione da sola - mille contratti da $0,05 e un contratto da $500 contano allo stesso modo. La base **Total Traded** conta ogni contratto passato di mano, quindi può solo salire.

### Flusso ponderato per il premio

Moltiplica il volume dei contratti per il premio pagato. **Questa è la lettura di convinzione.** Un trader che paga $500/contratto per una call OTM 0DTE sta facendo una scommessa reale; un trader che scalpa biglietti della lotteria da $0,05 no.

### Flusso direzionale (scomposizione dell'aggressore Lee-Ready)

Classifica ogni operazione come avviata dall'acquirente o dal venditore usando l'algoritmo Lee-Ready (su quale lato del bid/ask è avvenuta l'operazione); i print troppo vicini al punto medio per essere attribuiti restano senza segno. Somma le operazioni avviate dall'acquirente meno quelle avviate dal venditore. Indica se gli aggressori stanno pagando per il rialzo o per il ribasso. La base **Directional** assegna il segno al volume in questo modo, quindi può scendere sotto zero.

## Il banner di regime

**Flow Analysis Regime** etichetta la sessione fin qui: **Risk-On Flow Regime** quando premio netto e flusso netto pendono entrambi verso le call, **Risk-Off Flow Regime** quando pendono entrambi verso le put, e **Mixed / Two-Way Flow** quando non concordano o sono entrambi piccoli. Il paragrafo sotto riporta i numeri dietro l'etichetta.

## Il Flow Snapshot

I totali della sessione all'ultima barra:

- **Call Volume** e **Put Volume** - i contratti scambiati, con il premio netto di ciascun lato sotto
- **Net Flow** - i contratti netti di call meno i contratti netti di put, ciascuno con il segno dell'aggressore
- **Net Premium** - il premio netto delle call meno il premio netto delle put. Positivo ⇒ gli aggressori stanno pagando per call / vendendo put in modo netto; negativo ⇒ gli aggressori stanno pagando per put / vendendo call.
- **Put/Call Ratio** - il volume delle put diviso per il volume delle call

## I grafici

- **Options Flow** - il premio netto di call e put durante la sessione rispetto al prezzo del sottostante, con un'area di volume sotto secondo la base scelta. Filtrabile per strike o per scadenza.
- **Net Directional Premium** - il totale progressivo della sessione del premio netto, ombreggiato sopra e sotto lo zero.
- **Put/Call Ratio** - il rapporto cumulativo della sessione a ogni barra.
- **Net Position (Buys vs. Sells)** - il volume netto progressivo di call e put, per distinguere gli acquisti dalle vendite, cosa che il rapporto non può fare.

Ognuno è rappresentato come una serie in modo da poter vedere la pendenza, non solo il livello.

## Smart money

I print dello smart money hanno una pagina dedicata - vedi [Smart Money](/help/platform/smart-money). Usala come controllo incrociato sul flusso principale di questa pagina.

## Come leggerla

Tre pattern:

1. **Forte flusso positivo ponderato per il premio con un GEX Gradient positivo mentre i dealer sono, secondo il modello, short gamma** ⇒ i trader stanno pagando per un rialzo su cui i dealer sono short secondo il modello. Lettura di continuazione ad alta convinzione.
2. **Forte acquisto di put con il segnale Positioning Trap caricato sul lato della folla short (positivo)** ⇒ la folla ribassista è fuori posizione; aspettati uno scatto indietro verso l'alto.
3. **Flusso piatto vicino a un livello chiave** ⇒ aspetta la rottura. Il flusso senza convinzione non è un trade.

## Volume netto vs. flusso direzionale

Per un approfondimento sul perché il volume grezzo può trarre in inganno, perché il flusso direzionale aggiunge segnale, e perché il flusso ponderato per il premio è di solito la metrica di convinzione più forte, vedi [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow).

## Quando la pagina è più utile

- **Subito dopo l'apertura** - i primi 30 minuti dicono molto sul bias della giornata.
- **A ogni livello chiave** - il flusso verso un wall o il VWAP mostra chi sta mettendo pressione sul livello. Nel nostro studio su 737 test di wall, il flusso con segno sullo strike del wall non ha permesso di prevedere quali wall si sarebbero rotti, quindi leggilo come contesto, non come verdetto.
- **Verso la chiusura** - combinato con EOD Pressure, la lettura del flusso affina il segnale direzionale.

## Vedi anche

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow)
