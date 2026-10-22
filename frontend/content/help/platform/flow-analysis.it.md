# Analisi del flusso

*Cosa è stato scambiato oggi e chi ha attraversato lo spread per scambiarlo: contratti acquistati e venduti su ciascun lato, premio netto e put/call, su un unico orologio.*

---

## Cosa mostra questa pagina

La pagina Flow Analysis è la **vista del tape** del mercato delle opzioni. Mentre Dealer Positioning mostra il book in essere, questa pagina mostra il **flusso**: cosa è stato scambiato oggi e quale lato ha attraversato lo spread per scambiarlo.

Due controlli nell'intestazione valgono per tutta la pagina: **Session** (la sessione in corso o una qualsiasi dell'ultima settimana, così vedi se oggi è davvero insolito) e **Contracts** (tutti i contratti, oppure gli strike e le scadenze che scegli). La barra degli strumenti del grafico imposta la dimensione delle barre, **5 min** o **1 min**.

## Acquistato e venduto

Ogni print di opzioni viene classificato in base al lato che ha attraversato lo spread, secondo la convenzione di Lee-Ready:

- All'**ask** o vicino, un compratore ha pagato il prezzo: conta come **acquistato**.
- Al **bid** o vicino, un venditore l'ha colpito: conta come **venduto**.
- I print al **punto medio** vengono ripartiti tra i due in proporzione ai print all'ask e al bid di quel contratto nello stesso minuto. I print senza alcun indizio di lato, come l'asta di apertura delle 09:30, contano per metà da ciascuna parte.

Acquistato più venduto, quindi, è sempre tutto ciò che è stato scambiato. La lettura dell'aggressore è quanto di più vicino all'intenzione il feed possa offrire, ma non distingue un'apertura da una chiusura: una put "venduta" al bid può essere un nuovo venditore o un compratore che incassa i profitti.

Le call acquistate e le put vendute formano il **lato rialzista**; le put acquistate e le call vendute, il **lato ribassista**. I colori seguono questa regola in tutta la pagina: il verde è il lato rialzista, il rosso quello ribassista. Per questo il "bought" nella riga delle put è rosso.

## La lettura della sessione

La riga in alto legge la sessione in un colpo d'occhio:

- **Flow** - **Risk-on** quando premio netto e flusso netto pendono entrambi al rialzo, **Risk-off** quando pendono entrambi al ribasso, e **Two-way** quando divergono o sono entrambi troppo piccoli per essere valutati (flusso netto sotto l'1% dei contratti scambiati e premio netto sotto il 5% del premio di call e put).
- **Net premium** - premio netto delle call meno premio netto delle put, ciascuno contato come acquistato meno venduto, con la parte delle call e quella delle put sotto. Una parte delle put negativa significa che le put sono state vendute al netto.
- **Net flow** - il lato rialzista meno quello ribassista, in contratti, e la quota del lato rialzista su tutto lo scambiato.
- **Put/call** - volume delle put diviso volume delle call.
- **Volume** - tutti i contratti scambiati, e quanti dall'apertura della barra più recente.

## Bought vs. sold

I totali della sessione per call e put, ciascuno diviso in **acquistato** e **venduto**, con la ripartizione come barra, il **netto** (acquistato meno venduto) e ciò che la barra più recente ha aggiunto finora. La riga sotto somma i due lati: il lato rialzista contro quello ribassista, e di quanto uno è in vantaggio, che è il flusso netto della sessione.

I numeri si aggiornano ogni pochi secondi durante le contrattazioni.

## Il grafico della sessione

Un solo grafico, in pannelli che condividono l'orologio della sessione e un mirino, orari in ET:

- **Price** - il sottostante nel corso della sessione.
- **Strikes** - dietro la linea del prezzo, una corsia per strike e un punto per barra: verde dove su quello strike, in quella barra, era avanti il lato rialzista, rosso dove era avanti il lato ribassista. I punti hanno tre dimensioni, piccola, media e grande, in base al flusso netto lì, cioè il lato rialzista meno quello ribassista. Uno strike dove nessun lato era avanti di almeno un decimo di quanto scambiato lì non ha un punto. **All dots**, **Medium+** e **Large** fissano il punto più piccolo mostrato, così puoi tenere solo gli strike su cui si è spinto di più. Accanto all'etichetta del pannello del prezzo, **Bought vs sold** e **Calls vs puts** scelgono cosa leggono i punti: il lato rialzista e quello ribassista, come sopra, oppure call contro put, verde dove sullo strike sono state scambiate più call che put e rosso dove più put, chiunque abbia comprato o venduto. Le call si scambiano soprattutto sopra il prezzo e le put sotto, quindi questa lettura tende al verde sopra il prezzo e al rosso sotto. Passa su un punto, o toccalo, per vedere le call e le put acquistate e vendute su quello strike. Le corsie seguono la tua scelta di contratti e compaiono con entrambe le dimensioni di barra.
- **Flip and walls** - il gamma flip e i wall delle call e delle put come linee tratteggiate: gli stessi livelli della barra Key Levels e dei grafici gamma. Mostrano dove si trovano i livelli adesso, quindi compaiono solo nella sessione in corso. Il flusso sullo strike di un wall è contesto, non un verdetto sul wall: nel nostro studio su 737 test di wall, non ha previsto quali wall si sarebbero rotti.
- **Net premium** - il premio netto cumulato, ombreggiato in verde sopra lo zero e in rosso sotto, con le **parti di call e put** come linee sottili.
- **Contracts** - ciò che è stato scambiato in ogni barra. Le barre verso l'alto sono il lato rialzista (call acquistate, con le put vendute impilate sopra in un tono più chiaro); le barre verso il basso, il lato ribassista (put acquistate, con le call vendute).
- **Put/call** - il rapporto cumulato, con una linea tratteggiata a 1.
- I **marcatori numerati** in alto corrispondono al registro del flusso.

I pulsanti sopra il grafico attivano o disattivano ogni pannello, e questo browser ricorda la tua scelta. Passa sul grafico, o toccalo sul telefono, per vedere tutti i numeri di quella barra. **Full screen** dà al grafico l'intera finestra, con i pannelli dimensionati di conseguenza; Esc o **Exit** lo riportano al suo posto.

Per ingrandire una parte della sessione, come sul Gamma Chart:

- **Ctrl + scroll** (**Cmd + scroll** su Mac), o pizzica sul trackpad, per fare zoom sul tempo. La rotellina da sola scorre la pagina, non il grafico.
- **Maiusc + scroll**, o scorri sopra la scala dei prezzi a sinistra, per fare zoom sul prezzo.
- I pulsanti − e + di **Time** e **Price** in basso a sinistra fanno lo stesso a scatti.
- **Trascina** un grafico ingrandito lateralmente per muoverti nel tempo, o in alto e in basso una volta ingrandito il prezzo.

Con lo zoom, la scala di ogni pannello si adatta a ciò che è sullo schermo, così le corsie degli strike si allargano insieme alle barre. In una sessione in corso un grafico ingrandito segue la barra più recente finché non lo trascini indietro. **Reset** torna all'intera sessione. Su smartphone, pizzica o usa i pulsanti **Time** per fare zoom, e trascina lateralmente per spostarti.

## Registro del flusso

Il flusso notevole della sessione, dal più recente:

- **Net flow turned bullish / bearish** - il flusso netto cumulato ha cambiato lato e il nuovo lato è avanti di almeno lo 0,5% dei contratti scambiati. Le piccole oscillazioni intorno allo zero non vengono elencate.
- **Net premium turned bullish / bearish** - lo stesso per il premio netto, di almeno il 3% del premio di call e put.
- **Put/call rose above 1 / fell below 1** - quando si allontana da 1 di almeno 0,05.
- **Volume burst** - una barra pari ad almeno 2,5 volte la mediana delle barre dell'ora precedente, con il lato che l'ha guidata. Vengono elencate le sei più grandi della sessione.

Nei primi dieci minuti non viene segnalato nulla, perché ogni totale è abbastanza piccolo da ribaltarsi con un solo print.

## Bar by bar

Call e put di ogni barra, acquistate e vendute, e il suo flusso netto, dalla più recente. Le barre in cui non è stato scambiato nulla vengono omesse. Durante la sessione, la riga in alto è la barra ancora in corso.

## Scegliere i contratti

**Contracts** apre la scelta di strike e scadenze. Una scelta restringe tutto ciò che c'è nella pagina, così ogni numero descrive gli stessi contratti. La scelta delle scadenze è condivisa con i grafici gamma nella stessa scheda del browser, e l'intestazione dice sempre quali contratti la pagina sta leggendo; la **×** accanto torna a tutti.

ES e NQ non hanno una catena di opzioni propria: il loro flusso è quello di SPX e NDX, quindi gli strike elencati sono strike dell'indice, non prezzi del future.

## Come leggerlo

Tre schemi:

1. **Forte flusso sul lato rialzista e premio netto in salita mentre i dealer sono modellati short gamma** ⇒ i trader pagano per un rialzo su cui i dealer sono modellati short. Una lettura di continuazione.
2. **Put acquistate con forza contro un livello** con il segnale Positioning Trap caricato sul lato della folla short ⇒ la folla ribassista potrebbe essere fuori posizione; attento a un rimbalzo.
3. **Flusso piatto vicino a un livello chiave** ⇒ aspetta la rottura. Il flusso senza convinzione non è un trade.

## Quando la pagina è più utile

- **Subito dopo l'apertura** - la prima mezz'ora dice molto sull'orientamento della giornata.
- **A ogni livello chiave** - il flusso verso un wall o il VWAP mostra chi sta mettendo pressione sul livello. Nel nostro studio su 737 test di wall, il flusso con segno sullo strike del wall non ha permesso di prevedere quali wall si sarebbero rotti, quindi leggilo come contesto, non come verdetto.
- **Verso la chiusura** - insieme a EOD Pressure, la lettura del flusso affina il segnale direzionale.

## Volume netto vs. flusso direzionale

Per un approfondimento sul perché il volume grezzo può trarre in inganno, perché la scomposizione dell'aggressore aggiunge segnale, e perché il premio è di solito la misura di convinzione più forte, vedi [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow).

## Vedi anche

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow)
