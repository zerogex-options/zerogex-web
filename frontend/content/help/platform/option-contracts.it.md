# Quotazioni Live delle Opzioni

*Segui un singolo contratto di opzioni per tutta la sessione. Come scegliere il contratto, leggere le barre di volume acquistato e venduto e i dati sopra il grafico.*

---

## Cosa mostra questa pagina

La pagina Quotazioni Live delle Opzioni segue **un contratto di opzioni** sul simbolo attivo per tutta la sessione: il prezzo dell'ultimo scambio e il volume di ogni minuto, suddiviso per lato - acquistato, venduto o senza indizio di lato. Si aggiorna ogni 30 secondi.

## Scegliere un contratto

Tre menu sopra il grafico scelgono il contratto:

- **Expiration** - le scadenze negoziate in questa sessione, da oggi in poi. Di default quella di oggi (0DTE) se c'è, altrimenti la più vicina.
- **Strike** - di default lo strike più vicino al prezzo live.
- **Type** - **Call** o **Put**. Di default Call.

Il nome del contratto compare sotto i menu - ad es. `SPY 600 C 10/02/2026` - insieme ai giorni alla scadenza.

## I dati sopra il grafico

Per la sessione mostrata:

- **Vol** - contratti scambiati finora.
- **OI** - open interest.
- **Avg** - il prezzo medio degli scambi, ponderato per volume.
- **Prem** - premio scambiato: Vol × Avg × 100.
- **IV**, **Δ** (delta) e **Θ** (theta) - dall'ultima quotazione.

## Il grafico

- **Barre** (asse sinistro) - volume al minuto, impilato per lato: **Bought** (acquistato), **No side** (senza lato) e **Sold** (venduto).
- **Linea** (asse destro) - il prezzo dell'ultimo scambio (**Last**).

Il lato viene dal **tick test**, che confronta il prezzo di ogni scambio con quello dello scambio precedente sullo stesso contratto, non con il bid e l'ask. Un prezzo più alto conta come acquistato, uno più basso come venduto, e un prezzo invariato prende il lato dell'ultima variazione di prezzo. **No side** è il volume a cui il test non può assegnare un lato: uno scambio senza uno precedente con cui confrontarlo, un prezzo invariato prima che una variazione di prezzo abbia fissato un lato, e tutto ciò che viene scambiato nel minuto di apertura delle 9:30.

L'asse del tempo copre la sessione, dalle 9:30 alle 16:15 ET. Prima che apra la sessione di oggi, la pagina mostra la più recente. Sullo smartphone le barre sono raggruppate in blocchi da 5 minuti per restare leggibili.

Passa il mouse su una barra per vedere l'orario, l'ultimo prezzo e quanti dei suoi contratti contano come venduti, acquistati o senza lato.

## Come leggerlo

Tre pattern:

1. **Chi spinge il prezzo?** Il volume acquistato sono compratori che pagano di più pur di essere eseguiti: scambi che hanno fatto salire il prezzo o lo hanno mantenuto dopo un rialzo. Il volume venduto sono venditori che accettano meno: scambi che lo hanno fatto scendere o lo hanno mantenuto dopo un ribasso. Il volume senza lato sono scambi a cui il test non ha potuto assegnare un lato.
2. **Quanto volume c'è dietro il movimento?** Il lato viene dalle variazioni di prezzo di questo stesso contratto, quindi volume acquistato e linea Last in salita di solito vanno insieme; che concordino non è una seconda lettura indipendente. Quello che le barre aggiungono è quanti contratti sono stati scambiati a ogni movimento: un rialzo su una manciata di contratti dice meno di uno sostenuto da un forte volume acquistato.
3. **Quanto pesa oggi rispetto all'OI?** Quando Vol è grande rispetto all'OI, gli scambi di oggi sono consistenti rispetto alle posizioni già aperte - potrebbe formarsi un nuovo posizionamento.

## ES e NQ

ES e NQ non hanno una catena di opzioni propria - i loro livelli derivano dalle opzioni su SPX e NDX. Questa pagina non è disponibile per loro; passa a SPX o NDX.

## Nota sul piano

Le Quotazioni Live delle Opzioni sono disponibili per i piani Basic e Pro.

## Vedi anche

- [Strategy Builder](/help/platform/options-calculator)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Analisi del Flusso](/help/platform/flow-analysis)
