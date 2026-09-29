# Come leggere la Dashboard

*La pagina che apri per prima ogni mattina. Ogni striscia, grafico e scheda, spiegati.*

---

## A cosa serve la Dashboard

La Dashboard principale è la **lettura su una sola schermata** del mercato attuale. Risponde, in 30 secondi, a tre domande:

1. **Come sono posizionati i dealer?** (il regime gamma e i livelli chiave)
2. **Cosa dice il tape?** (flow e volatilità)
3. **Qual è la lettura combinata?** (Trade Bias e il Composite MSI)

Sulla Dashboard non prendi decisioni: ti orienti. Da lì passi alla pagina giusta per approfondire.

## Simple e Detailed

Il selettore **Simple / Detailed** in alto a destra stabilisce quanto mostra la pagina. **Simple** è l'impostazione predefinita e mantiene la pagina leggibile a colpo d'occhio: Lettura di Oggi, Segnali Proprietari e Volatilità, e Posizionamento e Flusso partono chiuse - fai clic sul titolo di una sezione per aprirla. **Detailed** apre tutte le sezioni. La tua scelta viene ricordata.

## L'anatomia

### 1. Key Levels

La striscia in alto. La sua intestazione mostra il simbolo, le scadenze da cui provengono i livelli e il chip **Long γ / Short γ**: long gamma significa che l'hedging dei dealer tende a smorzare i movimenti (pinning); short gamma significa che tende ad amplificarli (trend). Sotto c'è una scheda per ogni livello, ciascuna con la distanza tra il prezzo e quel livello:

- **Spot** - il prezzo in tempo reale e la sua variazione.
- **Gamma Flip** - il livello in cui il gamma modellato dei dealer cambia segno. Sopra, l'hedging smorza i movimenti; sotto, li amplifica. Più il prezzo è vicino al flip, maggiore è il rischio di un cambio di regime.
- **Pin Strike** - lo strike 0DTE vicino in cui il gamma positivo dei dealer e la probabilità che il prezzo ci arrivi si combinano con più forza, con un'etichetta Strong / Moderate / Weak. È un livello di pinning modellato, non un target di prezzo, e la scheda lo segnala quando nessuno strike soddisfa i criteri. Vedi [Pin Strike](/help/platform/pin-strike).
- **Call Wall** e **Put Wall** - gli strike con il maggior gamma call e gamma put. Spesso agiscono come resistenza e supporto: nel nostro studio su 737 test di wall, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora e quelli del Nasdaq circa la metà delle volte, da qualunque lato del gamma flip si trovasse il prezzo. Vedi [Gamma Wall spiegati](/education/gamma-walls-explained).
- **Max Pain** - lo strike che minimizza il valore totale delle opzioni in essere alla scadenza. È più rilevante nell'ultimo giorno o due prima di una scadenza significativa. Vedi [Max Pain spiegato](/education/max-pain-explained).

La striscia mostra esattamente i livelli che disegna il Gamma Chart, compreso qualsiasi filtro sulle scadenze impostato sul grafico. Per cambiare simbolo dalla striscia, su desktop passaci sopra con il mouse per far comparire le frecce, oppure su smartphone scorrila con il dito.

### 2. Lettura di Oggi

Un titolo e un breve paragrafo generati automaticamente sul regime del simbolo selezionato: long gamma (pinning, volatilità più bassa), short gamma (trend, volatilità più alta), fermo sul flip (una transizione) oppure non determinato quando il flip non si può calcolare dallo snapshot attuale. La Lettura si basa sullo stesso modello del [Bollettino live](/help/platform/live-bulletin), e facendo clic su di essa si apre il bollettino completo.

### 3. Il Gamma Chart

Lo ZeroGEX Gamma Chart è il fulcro: candele in tempo reale con la struttura del gamma dei dealer disegnata sullo stesso asse dei prezzi. Di default disegna il flip e i call e put wall (**Gamma Levels**), **Max Pain**, **Pin Strike** e **VWAP**, e ombreggia le zone di gamma lungo e corto (**Regime**) - ognuno è un interruttore sopra il grafico. Il **Gamma Rail** accanto alle candele mostra il gamma netto dei dealer per prezzo, così i wall appaiono letteralmente come barre. L'intestazione del grafico riporta il prezzo in tempo reale, la sua variazione, la sessione e il regime gamma dei dealer. Usa i controlli del grafico per cambiare il timeframe e lo stile del grafico e per filtrare quali scadenze alimentano i livelli. Vedi [Come leggere i grafici di ZeroGEX](/help/platform/reading-charts).

### 4. Trade Bias

Una singola scheda con lo stato di posizionamento (per esempio *Long Gamma · Bullish Flow* o *Mixed Signals*), la direzione verso cui pendono i suoi input e un punteggio di accordo su 10. Descrive posizionamento e flusso così come sono; **non** è un segnale di trading né una previsione. **Open Trade Bias** porta all'analisi completa nella pagina Trade Bias, che fa parte di Pro. Con Basic, la scheda viene costruita senza gli input dei segnali riservati a Pro.

Sotto la scheda, **How to read these signals** (chiuso) spiega come si combinano Trade Bias, il Composite MSI, i segnali Basic e i segnali Advanced.

### 5. Segnali Proprietari e Volatilità

- **Composite MSI** - un indicatore di regime 0-100: da 70 in su è **Trend / Expansion**, 40-70 **Controlled Trend**, 20-40 **Chop / Range** e sotto 20 **Compression**, la fascia in cui i movimenti hanno percorso meno strada. Un MSI alto non significa rialzista - significa che i trend possono correre. Leggi la direzione in Trade Bias o nei singoli segnali.
- **Signal Breadth** - quanti segnali sono orientati al rialzo, neutrali o al ribasso, con il più forte per ciascun lato.
- **Regime Triggers** (Pro) - quanto il mercato è pronto a un cambio di regime, in base a Volatility Expansion, Range Break Imminence e Market Pressure. Leggi l'ampiezza di ogni punteggio, non il suo segno.
- **Monitor Volatilità** - due indicatori: **Level** (VIX, oppure VXN per QQQ e NDX) e **Momentum** (se la volatilità sta crollando, calando, è stabile, sta salendo o sta esplodendo).

### 6. Posizionamento e Flusso

- **Call GEX** e **Put GEX** - l'esposizione gamma totale delle call e delle put.
- **Call Wall (Resistenza)** e **Put Wall (Supporto)** - il gamma call più alto in corrispondenza dello spot o al di sopra e il gamma put più alto in corrispondenza dello spot o al di sotto, con la distanza dallo spot. Sono classificati sulla scadenza di oggi e sulle due successive (0-2DTE), quindi se hai filtrato il grafico solo sullo 0DTE, la striscia Key Levels può mostrare uno strike diverso.
- **Flusso Netto**, **Premio Netto** e **Rapporto Put/Call** - per la sessione corrente: contratti call netti meno contratti put netti, lo stesso in dollari di premio, e volume put diviso per volume call. "Netto" significa avviato dal compratore meno avviato dal venditore, quindi un Flusso Netto positivo è un flusso orientato alle call.

In fondo alla pagina ci sono il promemoria che il posizionamento dei dealer è modellato, non osservato direttamente, e l'ora dell'ultimo aggiornamento.

## Come si aggiorna la dashboard

Tutto si aggiorna in tempo reale, quindi non c'è bisogno di ricaricare la pagina. Il prezzo si aggiorna ogni secondo. I livelli e i segnali vengono ricalcolati circa una volta al minuto, e la pagina recepisce ogni nuovo calcolo entro pochi secondi. Gli indicatori di volatilità si aggiornano circa ogni 30 secondi.

## Pre-market, after-hours e mercato chiuso

La sessione mostrata nell'intestazione del Gamma Chart ti dice a quale sessione si riferisce il prezzo. Fuori dall'orario regolare, i livelli e i segnali riflettono il calcolo più recente.

## Leggere la Dashboard in 30 secondi

La disciplina:

1. Leggi il chip **Long γ / Short γ** e dove si trova lo Spot rispetto al **Gamma Flip**.
2. Leggi **Call Wall** e **Put Wall** - sono i tuoi livelli. Vicino alla scadenza, controlla anche il **Pin Strike**.
3. Dai un'occhiata alla scheda **Trade Bias**.
4. Apri la **Lettura di Oggi** se la vuoi a parole.
5. Decidi quale pagina aprire per il trade effettivo.

Tutto qui. Se ti ritrovi a passare più di 30 secondi qui, hai smesso di orientarti e hai iniziato ad analizzare - vai alla pagina del segnale rilevante.

Vuoi un layout tutto tuo? [La mia dashboard](/my-dashboard) ti permette di costruire una bacheca con i widget, incluso Key Levels, e su desktop puoi dividerla per seguire due simboli affiancati.

## Vedi anche

- [Come funzionano i Signals, dall'inizio alla fine](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Usare il Live Bulletin](/help/platform/live-bulletin)
- [Pin Strike](/help/platform/pin-strike)
