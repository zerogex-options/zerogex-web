# Analisi del flusso

*Flusso ponderato per il premio e a volume netto, i bucket dello smart money, la scomposizione dell'aggressore secondo Lee-Ready, e come individuare la vera convinzione nel tape.*

---

## Cosa mostra questa pagina

La pagina Flow Analysis è la **vista del tape** del mercato delle opzioni. Mentre Dealer Positioning mostra il book statico, questa pagina mostra il **flusso** — cosa stanno facendo gli aggressori in tempo reale.

## Le tre lenti del flusso

ZeroGEX mostra il flusso attraverso tre lenti, perché ciascuna conta in modo diverso.

### Volume netto dei contratti

Semplicemente conta i contratti. Utile come base di rumore. Inutile come lettura di convinzione da sola — mille contratti da $0,05 e un contratto da $500 contano allo stesso modo.

### Flusso ponderato per il premio

Moltiplica il volume dei contratti per il premio pagato. **Questa è la lettura di convinzione.** Un trader che paga $500/contratto per una call OTM 0DTE sta facendo una scommessa reale; un trader che scalpa biglietti della lotteria da $0,05 no.

### Flusso direzionale (scomposizione dell'aggressore Lee-Ready)

Classifica ogni operazione come avviata dall'acquirente o dal venditore usando l'algoritmo Lee-Ready (su quale lato del bid/ask è avvenuta l'operazione). Somma le operazioni avviate dall'acquirente meno quelle avviate dal venditore. Indica se gli aggressori stanno pagando per il rialzo o per il ribasso.

## Il riquadro principale

La parte superiore della pagina mostra il flusso netto ponderato per il premio nella finestra scorrevole. Positivo ⇒ gli aggressori stanno pagando per call / vendendo put in modo netto; negativo ⇒ gli aggressori stanno pagando per put / vendendo call.

## I pannelli di dettaglio

Sotto il riquadro principale:

- Premio di **acquisto call / vendita call**
- Premio di **acquisto put / vendita put**
- **Delta netto dell'aggressore** — l'output di Lee-Ready scalato per il delta del contratto

Ognuno è rappresentato come una serie in modo da poter vedere la pendenza, non solo il livello.

## Il chip smart money

I tag sulle singole operazioni le segnalano come smart money — tipicamente blocchi di grandi dimensioni, sweep, print aggressivi ripetuti nella stessa direzione. Il flusso smart money è mostrato come una sottoserie separata. Usalo come controllo incrociato sul riquadro principale.

## Come leggerla

Tre pattern:

1. **Forte flusso positivo ponderato per il premio con un gradiente GEX negativo** ⇒ i trader stanno pagando per il rialzo su cui i dealer sono strutturalmente short. Lettura di continuazione ad alta convinzione.
2. **Forte acquisto di put con il segnale Positioning Trap anch'esso alto** ⇒ la folla è dalla parte sbagliata; aspettati un rimbalzo.
3. **Flusso piatto vicino a un livello chiave** ⇒ aspetta la rottura. Il flusso senza convinzione non è un trade.

## Volume netto vs. flusso direzionale

Per un approfondimento sul perché il volume grezzo può trarre in inganno, perché il flusso direzionale aggiunge segnale, e perché il flusso ponderato per il premio è di solito la metrica di convinzione più forte, vedi [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow).

## Quando la pagina è più utile

- **Subito dopo l'apertura** — i primi 30 minuti dicono molto sul bias della giornata.
- **A ogni livello chiave** — il flusso verso un wall o il VWAP indica se il livello viene difeso o violato.
- **Verso la chiusura** — combinato con EOD Pressure, la lettura del flusso affina il segnale direzionale.

## Vedi anche

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow)
