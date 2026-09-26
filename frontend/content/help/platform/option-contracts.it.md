# Quotazioni Live delle Opzioni

*Segui un singolo contratto di opzioni per tutta la sessione. Come scegliere il contratto, leggere le barre di volume a bid/mid/ask e i dati sopra il grafico.*

---

## Cosa mostra questa pagina

La pagina Quotazioni Live delle Opzioni segue **un contratto di opzioni** sul simbolo attivo per tutta la sessione: il prezzo dell'ultimo scambio e il volume di ogni minuto, suddiviso in base a dove è stato scambiato - all'ask, al mid o al bid. Si aggiorna ogni 30 secondi.

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

- **Barre** (asse sinistro) - volume al minuto, impilato in base a dove è stato scambiato: **Ask Vol**, **Mid Vol** e **Bid Vol**.
- **Linea** (asse destro) - il prezzo dell'ultimo scambio (**Last**).

L'asse del tempo copre la sessione, dalle 9:30 alle 16:15 ET. Prima che apra la sessione di oggi, la pagina mostra la più recente. Sullo smartphone le barre sono raggruppate in blocchi da 5 minuti per restare leggibili.

Passa il mouse su una barra per vedere l'orario, l'ultimo prezzo e quanti contratti sono stati scambiati al bid, al mid e all'ask.

## Come leggerlo

Tre pattern:

1. **Chi attraversa lo spread?** Il volume lato ask sono scambi eseguiti all'ask o vicino a esso - compratori che pagano l'ask pur di essere eseguiti. Il volume lato bid sono venditori che vendono al bid. Il volume mid sono gli scambi a metà strada.
2. **Il prezzo conferma?** Volume lato ask con la linea Last in salita significa che i compratori controllano questo contratto. Un forte volume lato ask mentre il prezzo non si muove merita un'occhiata più attenta.
3. **Quanto pesa oggi rispetto all'OI?** Quando Vol è grande rispetto all'OI, gli scambi di oggi sono consistenti rispetto alle posizioni già aperte - potrebbe formarsi un nuovo posizionamento.

## ES e NQ

ES e NQ non hanno una catena di opzioni propria - i loro livelli derivano dalle opzioni su SPX e NDX. Questa pagina non è disponibile per loro; passa a SPX o NDX.

## Nota sul piano

Le Quotazioni Live delle Opzioni sono disponibili per i piani Basic e Pro.

## Vedi anche

- [Strategy Builder](/help/platform/options-calculator)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Analisi del Flusso](/help/platform/flow-analysis)
