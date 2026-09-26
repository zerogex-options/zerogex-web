# Smart Money

*La schermata smart money - cosa qualifica un trade come smart money, come si legge la ripartizione tra call e put e come usare il bias intraday.*

---

## Cosa significa "smart money" qui

Smart money è un'euristica - un filtro per i print di opzioni abbastanza grandi o insoliti da essere la posizione di qualcuno e non scarti di copertura. Ogni riga è l'attività di un contratto in un minuto, e si qualifica quando supera una di queste soglie:

- **Dimensione** - 50 contratti o più.
- **Premio** - $50K o più.
- **Print più piccoli ma insoliti** - 20 contratti o più su un contratto con IV elevata (sopra il 40%) o molto fuori dal denaro (|delta| sotto 0,15).

Ogni print qualificato riporta il suo **lato aggressore** - **Buy** quando ha prevalso il premio avviato dall'acquirente, **Sell** quando ha prevalso quello avviato dal venditore, **Neutral** quando nessuno ha prevalso - e una **classe di nozionale** da $500K+ fino a meno di $50K. La pagina conserva i 50 print più grandi della sessione per nozionale.

## Cosa mostra questa pagina

### Il banner di regime

**Smart Money Regime** somma il nozionale delle call e quello delle put dei blocchi che superano i tuoi filtri: **Call Buyers in Control** quando le call sono avanti di $250K o più, **Put Buyers in Control** quando lo sono le put, e **Balanced Positioning** altrimenti. Conta il nozionale di entrambi i lati del tape - imposta **Side** su **Buy** se vuoi che legga solo gli acquirenti. Questo **non** è lo stesso del PCR (put/call ratio) principale - conta solo i blocchi filtrati.

### I filtri

- **Session** - la sessione corrente o quella precedente.
- **Min class** - il nozionale minimo mostrato, da $500K+ (predefinito) fino a meno di $50K.
- **Side** - solo print Buy, Sell o Neutral.
- **Min |Δ|** - esclude i print con delta inferiore a 0,10, 0,25 o 0,40, eliminando i biglietti della lotteria molto fuori dal denaro.
- **Expiry** - 0DTE, 1-7 DTE o 8+ DTE.

### Blocks vs. underlying price

I blocchi filtrati come barre impilate per minuto - verde per le call, rosso per le put - rispetto al prezzo del sottostante durante la sessione. Passa il mouse su una barra per vedere i contratti che la compongono; le loro righe si evidenziano nella tabella sotto.

### Block detail

Gli stessi blocchi in tabella: orario, contratto, strike, scadenza, DTE, tipo, lato, delta, contratti, nozionale e classe. Clicca un'intestazione per ordinare (una seconda intestazione diventa il criterio di spareggio, fino a tre livelli), e usa l'imbuto su Strike, Expiration o Type per filtrare su un valore.

## Come usarla

Tre pattern:

1. **Smart money che compra call con forza + MSI in regime di trend (≥ 70) + gradiente GEX di supporto** ⇒ la lettura strutturale si allinea con il flusso smart money. Direzionale ad alta convinzione.
2. **Smart money che compra put con forza al put wall** ⇒ difesa o fading. Combinato con una lettura di Positioning Trap, può essere un counter-bias tradabile.
3. **Flusso smart money neutrale, flusso principale forte** ⇒ il flusso principale è probabilmente partecipazione ampia e a bassa convinzione più che posizionamento informato; trattare con cautela.

## Cosa non è

L'etichetta smart money è un'**euristica probabilistica**. Non ogni print smart money è informato; non ogni trade informato viene segnalato. La dimensione è un indizio, non un'intenzione: un print grande può essere una scommessa in apertura, un'uscita o una gamba di uno spread la cui altra gamba è altrove nella catena, e il tape non può dirti quale. La pagina è più utile a **livello di bias** - qual è l'inclinazione cumulativa? - piuttosto che come segnale di trading su singoli print.

## ES e NQ

Smart money non è disponibile per ES e NQ. Qui non hanno una catena di opzioni propria - i loro livelli di gamma derivano dalle opzioni su SPX e NDX -, quindi passa a SPX o NDX per vedere la schermata.

## Il quadro d'insieme

Il flusso smart money è uno dei diversi input nel segnale base di Positioning Trap (che usa lo sbilanciamento smart money con segno) e nel Market Pressure Index (skew del flusso smart money). La pagina smart money è la lettura autonoma; i segnali sono le interpretazioni.

## Vedi anche

- [Analisi del flusso](/help/platform/flow-analysis)
- [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow)
- [Segnale Positioning Trap spiegato](/education/positioning-trap-explained)
