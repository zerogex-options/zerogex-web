# Quotazioni Live delle Opzioni

*Consulta la catena in tempo reale. Filtro per scadenza e moneyness, ordinamento delle colonne e come la superficie di IV illumina i colori.*

---

## Cosa mostra questa pagina

La pagina Quotazioni Live delle Opzioni è la **catena di opzioni live** per il simbolo attivo. Ogni colonna si aggiorna in tempo reale durante l'orario di mercato.

## Le colonne

Per ogni strike e ogni scadenza:

- **Strike**
- **Bid / Ask / Mid**
- **Last** e **Volume**
- **Open Interest**
- **Delta, Gamma, Vega, Theta, Charm**
- **Volatilità Implicita**
- **Contributo al GEX** — il valore in dollari del gamma dei dealer a questo strike

Ogni riga è accoppiata (call a sinistra, put a destra) con lo strike nella colonna centrale. Il classico layout a catena.

## Filtri

La barra dei filtri ti permette di delimitare la catena:

- **Scadenza** — selezione multipla. Di default 0DTE se disponibile, altrimenti la più vicina.
- **Moneyness** — banda ATM (ad es. ±5% dallo spot) o catena completa.
- **Ordina** — per strike, volume, OI, IV, contributo al GEX.
- **Mostra solo** — volume diverso da zero, OI diverso da zero, sweep, block.

## I colori della superficie di IV

Le celle sono colorate in gradazione in base alla IV — colori freddi (blu) per IV bassa, colori caldi (rosso) per IV alta. La scala è per singola scadenza, quindi un ATM "caldo" in una colonna non corrisponde allo stesso livello assoluto di IV di un ATM "caldo" in un'altra. L'obiettivo è vedere la **forma** dello smile, non il livello assoluto.

## Come leggere la catena

Tre pattern:

1. **Dove si concentra l'OI?** La catena è il dato grezzo alla base del profilo GEX. Gli strike con l'OI maggiore sono di solito dove si trovano i wall.
2. **Dove si concentra il volume?** Il volume indica cosa si sta scambiando **in questo momento**, il che può divergere nettamente dall'OI durante la giornata.
3. **Dove si trova lo skew di IV?** Uno skew più ripido della IV dei put OTM rispetto alla IV dei call OTM è la lettura dello skew.

## Azioni rapide

- **Clicca su una riga** per aprire lo Strategy Builder con quella gamba già precompilata.
- **Passa il mouse su una cella** per i dettagli completi (dimensione bid/ask, orario dell'ultimo scambio, exchange).

## Nota sul piano

Le Quotazioni Live delle Opzioni sono disponibili per i piani Basic e Pro.

## Vedi anche

- [Strategy Builder](/help/platform/options-calculator)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Analisi del Flusso](/help/platform/flow-analysis)
