# Max Pain spiegato — e funziona davvero?

*Max pain spiegato onestamente — cos'è, la teoria che viene citata per giustificarlo, le prove su se il max pain muova davvero il prezzo, e come usarlo senza sopravvalutarlo.*

---

## Perché vale la pena porsi questa domanda

Max pain è uno di quei concetti che vive in due mondi molto diversi. Nel mondo retail delle opzioni, viene citato quasi come una legge fisica — *"il prezzo viene attratto verso il max pain a scadenza."* Nel mondo istituzionale, viene trattato come una teoria popolare che a volte descrive un pinning reale ma probabilmente riceve credito per effetti che in realtà sono guidati da qualcos'altro. La verità, come al solito, sta nel mezzo — ma più vicina alla visione istituzionale che a quella retail.

Questo articolo è la lettura onesta. Definiremo il max pain, vedremo come viene calcolato, esporremo la teoria che viene citata a suo sostegno, e poi guarderemo cosa suggeriscono realmente le prove disponibili su se il max pain *muova* il prezzo o semplicemente *descriva* dove il prezzo finisce. In tutto l'articolo, l'obiettivo è darti un modello mentale utilizzabile — non uno strumento di previsione, e nemmeno una demolizione.

Per contesto, il max pain interagisce direttamente con il più ampio framework del posizionamento dei dealer. Se non l'hai ancora fatto, il [pilastro sulla Gamma Exposure](/education/gamma-exposure-explained) copre le meccaniche strutturali, e gli articoli [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip) e [Gamma Walls spiegati](/education/gamma-walls-explained) coprono i livelli con cui il max pain viene spesso confuso.

---

## Cos'è il max pain?

Il max pain è lo strike al quale il payout totale ai detentori di opzioni a scadenza sarebbe minimizzato — equivalentemente, lo strike al quale scade senza valore il maggior nozionale aggregato di opzioni.

Quando i trader chiedono "cos'è il max pain," di solito stanno ponendo una di due domande correlate: *quale strike è la struttura della catena portata a favorire a scadenza*, oppure *verso quale strike la struttura del mercato delle opzioni suggerisce che il prezzo possa gravitare*. Entrambe sono impostazioni ragionevoli. La prima è un fatto definitorio; la seconda è un'ipotesi su se quel fatto strutturale abbia un effetto comportamentale sul prezzo.

L'intuizione: a ogni strike dato, ogni call in-the-money e ogni put in-the-money rappresenta un payout dovuto al suo detentore a scadenza. Sommati lungo tutta la catena, quei payout sono una funzione di dove atterra lo spot. Esiste un prezzo — lo strike di max pain — che minimizza quel payout totale. Se il prezzo scade lì, il maggior importo in dollari di posizioni long in opzioni finisce senza valore.

La teoria popolare fa poi un salto: se chi scrive le opzioni (spesso dealer, market maker o venditori istituzionali) beneficia collettivamente del fatto che il prezzo scada al max pain, forse i flussi strutturali del mercato spingono il prezzo verso quel livello. Quel salto è la parte che vale la pena esaminare onestamente.

---

## Da dove viene il concetto

Il termine max pain deriva da un corpus di ricerca retail sulle opzioni che risale ai primi anni 2000, applicato inizialmente alle opzioni azionarie single-name intorno alle scadenze mensili. L'osservazione originale era empirica: che i prezzi di chiusura alla OPEX mensile, specialmente per singoli titoli con open interest concentrato, sembravano raggrupparsi vicino allo strike che minimizzava il payout ai detentori di opzioni.

Quel raggruppamento era reale. Il meccanismo che lo produceva — e quanto affidabilmente si generalizzi — è molto più controverso. Diversi meccanismi diversi potrebbero produrre la stessa osservazione:

1. **Il gamma-pinning dei dealer** su strike pesanti (che spesso coincide con il max pain).
2. **Manipolazione genuina** da parte di grandi venditori di opzioni, in mercati dove questo è plausibile.
3. **Bias di selezione** — osservazione concentrata sui casi in cui il pinning è avvenuto, ignorando i casi in cui non è avvenuto.
4. **Open interest concentrato su strike psicologicamente tondi** vicino ai quali il prezzo già si trovava.

Districare questi meccanismi è difficile, e la letteratura empirica è mista. Effetti di pinning vicino alle principali date di OPEX mensile sono stati osservati in alcuni studi, ma gli effetti sono generalmente piccoli, e spesso svaniscono o scompaiono in campioni più ampi e nei prodotti indicizzati.

---

## Come si calcola il max pain?

Il calcolo è meccanico:

1. Per ogni strike sulla catena di opzioni, si assume che lo spot scada a quello strike.
2. Si calcola il valore intrinseco totale di tutte le call in-the-money (`max(0, S − K) × OI`) a quella chiusura ipotetica.
3. Si calcola il valore intrinseco totale di tutte le put in-the-money (`max(0, K − S) × OI`) a quella chiusura ipotetica.
4. Si sommano i due — quello è il payout totale ai detentori di opzioni a quella chiusura ipotetica.
5. Si ripete su tutti gli strike; quello con il totale più basso è lo strike di max pain.

Il calcolo utilizza solo **open interest** e **strike** — nessuna greca, nessuna volatilità implicita, nessuna assunzione sul segno del dealer. Questo lo rende economico e facile da calcolare, il che spiega in parte la sua diffusione. È anche in parte il motivo per cui è strutturalmente più debole delle letture basate sul gamma dei dealer: non sa nulla su come i dealer effettivamente si coprono.

L'output è un singolo strike (o a volte un piccolo intervallo di strike quasi uguali), ricalcolato a ogni istantanea della catena. Come ogni altro livello derivato dalla catena, il max pain è **dinamico** — si sposta man mano che l'OI ruota durante la giornata e da una sessione all'altra fino alla scadenza.

---

## La teoria: perché il max pain "dovrebbe" funzionare

L'argomento standard è meccanicistico:

1. Chi scrive opzioni (dealer, market maker e venditori istituzionali) paga collettivamente la parte in-the-money del book di opzioni a scadenza.
2. Ha interesse a minimizzare quel payout.
3. Quindi ha interesse a che lo spot scada allo strike che minimizza il payout totale — lo strike di max pain.
4. Attraverso la propria attività di copertura o trading, esercita una pressione strutturale per spingere lo spot verso quello strike, specialmente vicino alla scadenza.

Questa è una storia pulita. Ed è anche qui che deve iniziare l'onestà. L'argomento ha diversi punti deboli:

- **I dealer gestiscono book delta-neutrali.** Il loro P&L è dominato dalla cattura dello spread, non da esiti direzionali a scadenza. L'impostazione "i dealer vogliono il prezzo al max pain" assume un book direzionale che generalmente non hanno.
- **Il meccanismo di copertura non è l'argomento del payout ai venditori.** Se i dealer effettivamente fissano il prezzo vicino a uno strike, è di solito tramite il hedging *gamma* — il riflesso che li costringe a vendere forza e comprare debolezza quando sono long gamma — che è un meccanismo diverso, a volte puntato su uno strike diverso dal max pain.
- **La versione "manipolazione" della storia** — grandi venditori che tradano attivamente il sottostante per difendere uno strike — è plausibile in alcuni mercati single-name poco liquidi e molto meno plausibile in prodotti indicizzati liquidi come SPX.

In altre parole, l'*esito* che la teoria del max pain predice (il prezzo che gravita verso uno strike strutturale) a volte si verifica, ma il *meccanismo* che cita di solito non è il meccanismo effettivo.

---

## Il max pain funziona davvero?

La risposta onesta è: **a volte, debolmente, e di solito perché è qualcos'altro a fare il lavoro.**

Alcune impostazioni che reggono:

### Il meccanismo più pulito è il gamma pinning, non la minimizzazione del payout

Quando il prezzo *effettivamente* si fissa vicino a uno strike strutturale a scadenza — in particolare alla OPEX mensile nei prodotti indicizzati — il meccanismo è quasi sempre l'hedging gamma dei dealer in un regime di gamma positivo, non l'argomento del payout ai venditori dietro il max pain. Il gamma si concentra sugli strike con open interest pesante, e nei regimi long-gamma il riflesso del dealer attrae genuinamente il prezzo verso gli strike a gamma pesante attraverso la normale attività di copertura.

Il max pain spesso coincide con una forte concentrazione di gamma (entrambi sono funzioni di dove si trova l'OI), motivo per cui le due letture spesso concordano. Ma quando *divergono*, la lettura basata sul gamma tende a essere quella più affidabile — perché è ancorata a un meccanismo di copertura che i dealer effettivamente utilizzano, non a un book direzionale che generalmente non hanno.

### L'effetto, dove presente, è piccolo e concentrato vicino alle principali OPEX

Gli studi sugli effetti di pinning nelle opzioni azionarie hanno generalmente trovato un raggruppamento piccolo ma misurabile dei prezzi di chiusura vicino agli strike a OI pesante nelle scadenze mensili, in particolare nelle azioni single-name. Nei prodotti SPX e indicizzati, l'effetto è molto più difficile da trovare e di magnitudine molto più piccola. Anche dove è stato osservato, l'effetto viene generalmente misurato in decine di punti base di drift atteso durante l'ultima sessione — molto più piccolo del tipico range realizzato giornaliero.

### Viene discusso più spesso come descrizione, non come previsione

Anche i trader che seguono da vicino il max pain tendono a usarlo come **contesto**, non come un livello contro cui tradare. L'impostazione è "se tutto il resto è bilanciato, aspettati una certa attrazione strutturale verso questo strike vicino alla scadenza" — non "il max pain è X, quindi il prezzo andrà lì."

### Dove decisamente non funziona

Alcune impostazioni da evitare:

- **Il max pain come target intraday.** La versione retail della teoria viene spesso allungata fino a "il prezzo sta andando verso il max pain oggi" — non esiste un meccanismo che supporti questo su orizzonti intraday nei prodotti indicizzati liquidi.
- **Il max pain come pin rigido.** Anche dove esistono effetti di pinning, sono tendenze statistiche nelle medie, non esiti affidabili per ogni singola scadenza.
- **Il max pain in un regime di gamma fortemente negativo.** Quando il riflesso del dealer amplifica i movimenti invece di smorzarli, qualsiasi tesi di pinning basata su strike pesanti — max pain o altro — si inverte. Lo strike diventa un vettore di breakout, non un magnete.

---

## Max pain contro il gamma magnet

Il cugino meccanico più vicino al max pain è quello che a volte viene chiamato il **gamma magnet** — lo strike con la maggiore concentrazione di gamma dei dealer vicino alla scadenza. In un regime di gamma positivo, il gamma magnet spesso *attrae* effettivamente il prezzo vicino alla scadenza, tramite il meccanismo di copertura descritto sopra.

La differenza pratica:

- **Max pain** risponde: *dove viene minimizzato il payout ai detentori di opzioni a scadenza?*
- **Gamma magnet** risponde: *dove è più pesante la concentrazione di copertura dei dealer, e in che direzione tira?*

Quando i due strike sono vicini — cosa che accade spesso — entrambe le letture concordano, e l'attrazione strutturale tende a essere visibile nel tape. Quando divergono, la lettura del gamma di solito vince, perché il riflesso gamma è il meccanismo di copertura effettivo che produce il pin.

Un trader che usa il max pain da solo sta leggendo l'*output* del book dei dealer senza leggere il book dei dealer stesso. Leggere entrambi — max pain *e* il profilo gamma — è il workflow più pulito.

---

## Come usare il max pain senza sopravvalutarlo

Un'impostazione pragmatica:

1. **Tratta il max pain come contesto, non come un target.** È un dato strutturale su dove la catena è bilanciata; non è una previsione.
2. **Verificalo incrociandolo con il gamma magnet.** Se lo strike a gamma più pesante e il max pain concordano, la tesi del pin (dove esiste) è più netta. Se non concordano, dai priorità alla lettura del gamma.
3. **Dagli più peso vicino alla OPEX mensile, meno intraday.** L'effetto debole che esiste è concentrato vicino alla scadenza. Leggere il max pain intraday in un martedì qualunque ti dice molto poco.
4. **Leggi sempre prima il regime.** Un regime long-gamma è l'unico regime in cui qualsiasi tesi di pinning — max pain o altro — ha un meccanismo strutturale dietro. Nei regimi short-gamma, scarta del tutto la tesi del pin.
5. **Usalo per *inquadrare* i trade, non per *entrarci*.** Un regime long-gamma, un gamma magnet che concorda con il max pain a qualche punto sopra lo spot, e una data di OPEX potrebbero tutti insieme argomentare a favore del vendere sui rally verso il livello. Nessuno di questi elementi da solo è un trade.

---

## Come ZeroGEX mostra il max pain

La dashboard mostra il max pain accanto alle letture del gamma dei dealer così da poterle verificare incrociandole invece di leggerle isolatamente:

- **La card Max Pain** mostra lo strike di max pain corrente con distanza in dollari e in percentuale in tempo reale dallo spot.
- **La card Gamma Flip** mostra se lo spot è nel regime long-gamma (dove le tesi di pinning hanno un meccanismo) o nel regime short-gamma (dove non ce l'hanno).
- **Le card Call Wall e Put Wall** mostrano dove si trova effettivamente la concentrazione di gamma dei dealer.
- **Il grafico del profilo per strike** mostra la curva del gamma dei dealer così il gamma magnet è direttamente visibile.

![Card Max Pain della dashboard ZeroGEX con distanza in tempo reale dallo spot](/blog/zerogex-max-pain-card.png)

Un esempio pratico. Supponiamo che SPX sia a 5.830 la mattina di una OPEX mensile, e la dashboard mostri:

- **Max Pain:** 5.820
- **Gamma Magnet (strike a gamma più pesante):** 5.820
- **Net GEX:** +1,6 miliardi di dollari
- **Gamma Flip:** 5.805

Sia la lettura del max pain sia quella della concentrazione di gamma concordano a 5.820, il regime è solidamente long-gamma, ed è OPEX mensile. La lettura strutturale: la tesi dell'attrazione verso 5.820 è supportata quanto più è possibile che sia. Inclinazione pratica: drift verso 5.820, vendere sui rally sopra quel livello, comprare i ribassi fino a lì. Resta un'inclinazione probabilistica — non una garanzia — ma ogni condizione strutturale che *produrrebbe* pinning è attiva.

![Grafico del profilo per strike di ZeroGEX che mostra il gamma magnet allo stesso strike del max pain](/blog/zerogex-max-pain-gamma-agreement.png)

Ora immagina una mattina diversa: SPX a 5.830, max pain a 5.810, ma lo strike a gamma più pesante è 5.840 e il Net GEX è −400 milioni di dollari. Le letture non concordano, il regime è short-gamma, ed è una sessione normale senza scadenza. La lettura strutturale: il max pain sta *descrivendo* una geometria di payoff della catena, non indicando un livello che il book dei dealer difenderà. La mossa onesta è ignorare il max pain in questo stato e affidarsi invece alla lettura del regime.

---

## Fraintendimenti comuni sul max pain

Alcune trappole:

- **"Il prezzo viene attratto verso il max pain a scadenza."** Una tendenza debole in alcuni casi di OPEX single-name, molto più debole nei prodotti indicizzati, e assente nei regimi short-gamma. Non è una regola.
- **"Il max pain è dove chiuderà il grafico oggi."** Quasi mai utile come target intraday o giornaliero.
- **"I grandi venditori manipolano il prezzo verso il max pain."** Implausibile alla scala dei prodotti indicizzati liquidi. Plausibile in alcuni mercati single-name poco liquidi, ma comunque non il meccanismo dominante per l'effetto osservato.
- **"Max pain e gamma flip sono la stessa cosa."** Non lo sono. Il flip è la linea di regime; il max pain è uno strike di geometria di payoff. Rispondono a domande diverse.
- **"Il max pain è un indicatore contrarian."** Non è costruito per esserlo. Trattarlo come tale aggiunge solo rumore.

---

## Conclusione

> Il max pain è un calcolo reale che descrive una geometria di catena reale. Non è un predittore affidabile del prezzo.

L'impostazione più pulita è questa: il max pain spesso coincide con una forte concentrazione di gamma, ed è *quella* l'attrazione strutturale che a volte i trader osservano vicino alla scadenza. Quando il max pain e il gamma magnet concordano in un regime long-gamma vicino alla OPEX, la tesi del pin è al suo massimo — e anche allora, è un'inclinazione probabilistica. Quando non concordano, la lettura del gamma è quella più affidabile.

Usato come contesto all'interno di un framework più ampio sul posizionamento dei dealer, il max pain è una verifica incrociata utile. Usato come previsione a sé stante, tende a fuorviare.

Solo contenuto educativo — nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere la lettura del max pain di oggi in tempo reale, insieme al gamma flip, alle call e put wall, e al profilo gamma dei dealer che decide se una tesi di pin ha un meccanismo dietro, la dashboard gratuita di ZeroGEX mostra tutto questo.
