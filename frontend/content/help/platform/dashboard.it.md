# Come leggere la Dashboard

*La pagina che apri per prima ogni mattina. Ogni riquadro, ogni grafico, ogni indicatore spiegato.*

---

## A cosa serve la Dashboard

La Dashboard è la **lettura su una sola schermata** del mercato attuale. Risponde, in 30 secondi, a tre domande:

1. **Come sono posizionati i dealer?** (il regime GEX)
2. **Cosa dice il tape?** (flow + tecnica)
3. **Qual è la lettura composita?** (i segnali combinati in un'unica direzione)

Sulla Dashboard non prendi decisioni: ti orienti. Da lì passi alla pagina giusta per approfondire.

## L'anatomia

### 1. L'intestazione del regime

La parte superiore della pagina mostra la **etichetta del regime GEX** — Positive Gamma, Negative Gamma o Transitioning — insieme a una breve descrizione di cosa significhi in questo momento per il comportamento del mercato. Se hai tempo per una sola informazione oggi, è questa.

### 2. Il riquadro del prezzo

Il riquadro principale del prezzo mostra l'ultimo prezzo in tempo reale, la variazione rispetto alla chiusura della sessione precedente e il badge di sessione. Le quotazioni pre-market e after-hours vengono mostrate con la chiusura precedente come riferimento; durante l'orario regolare il riferimento è l'apertura della stessa sessione.

### 3. Il riquadro Net GEX

Il riquadro Net GEX è il numero principale dell'esposizione gamma — calcolato **a spot** in modo da leggere correttamente il lato del gamma flip. Un numero positivo indica che i dealer sono net long gamma; negativo, che sono net short. Il colore e il chip di trend rafforzano segno e direzione.

### 4. Il riquadro Gamma Flip

Distanza dal flip — sia come strike che come percentuale dello spot. Il flip è il livello in cui la curva gamma dei dealer attraversa lo zero. Sopra il flip, l'hedging dei dealer smorza i movimenti; sotto, li amplifica. Più sei vicino al flip, maggiore è il rischio strutturale di un cambio di regime.

### 5. I riquadri Call Wall / Put Wall

Gli strike con il maggior gamma call e gamma put rispettivamente. Tendono ad agire come resistenza e supporto intraday, specialmente quando il mercato è in gamma positivo. Vedi [Gamma Walls Explained](/education/gamma-walls-explained) per la lettura strutturale.

### 6. Il riquadro Max Pain

Lo strike che minimizza il valore totale in dollari delle opzioni in essere alla scadenza. È più rilevante nelle ultime 24–48 ore prima di una scadenza significativa. Vedi [Max Pain Explained](/education/max-pain-explained).

### 7. I riquadri Volatilità

IV live, IV rank e volatilità realizzata con sparkline. Utili per il sizing — un Squeeze Setup a bassa volatilità realizzata è un trade diverso rispetto a uno ad alta volatilità.

### 8. La sezione Trade Bias

Un chip di bias combinato ("Long bias", "Short bias", "Neutral") con gli input che contribuiscono sotto. È una sintesi di lettura dall'alto — **non** è un segnale di trading.

### 9. Il pannello Composite Score

Il punteggio composito MSI, lo stato del trigger e i pesi dei segnali che contribuiscono. Per l'analisi completa, clicca su [Composite Score](/help/platform/composite-score).

### 10. Lo snapshot Flow

Una breve lettura del flow ponderato per premio, del bias smart-money e del volume netto — tre modi diversi di guardare il tape. Le pagine complete si trovano in [Flow Analysis](/help/platform/flow-analysis) e [Smart Money](/help/platform/smart-money).

## Come si aggiorna la dashboard

I riquadri si aggiornano in tempo reale. La maggior parte si aggiorna ogni secondo durante l'orario di negoziazione regolare. La superficie GEX si aggiorna a una cadenza leggermente più lenta — tipicamente ogni 5–15 secondi — perché lo snapshot della catena sottostante è il collo di bottiglia. Non c'è bisogno di ricaricare la pagina.

## Pre-market, after-hours e mercato chiuso

La Dashboard si adatta alla sessione:

- **Pre-market / After-hours** — la quotazione extended-hours viene mostrata insieme alla chiusura della sessione regolare precedente.
- **Chiuso** — viene mostrata la chiusura più recente della sessione regolare; i segnali riflettono l'ultimo stato calcolato.

Guarda il badge di sessione nella riga del prezzo per conferma.

## Leggere la Dashboard in 30 secondi

La disciplina:

1. Leggi l'**etichetta del regime**.
2. Leggi **Net GEX** e la **distanza dal flip**.
3. Leggi **call wall e put wall** — sono i tuoi livelli.
4. Leggi il **trade bias** e il **composite score**.
5. Decidi quale pagina aprire per il trade effettivo.

Tutto qui. Se ti ritrovi a passare più di 30 secondi qui, hai smesso di orientarti e hai iniziato ad analizzare — vai alla pagina del segnale rilevante.

## Vedi anche

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Using the Live Bulletin](/help/platform/live-bulletin)
