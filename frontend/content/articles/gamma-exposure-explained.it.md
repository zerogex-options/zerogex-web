# Gamma Exposure (GEX) spiegata: la guida completa

*Gamma exposure spiegata da zero — cos'è il GEX, come viene calcolato e segnato il gamma dei dealer, perché il regime sopra e sotto il flip si comporta in modo così diverso, e come usarlo concretamente durante una sessione.*

---

## Perché la gamma exposure è importante

Gran parte del price action che i trader cercano di leggere su un grafico è un effetto a valle di qualcosa che accade un livello più sotto: i **flussi di hedging dei dealer**. I market maker si trovano dall'altro lato di ogni trade in opzioni e, per restare delta-neutral, comprano e vendono continuamente il sottostante man mano che il prezzo si muove. Se comprano la debolezza o la vendono — se smorzano la volatilità o la amplificano — dipende da una variabile strutturale: la loro **gamma exposure**.

La gamma exposure (GEX) è il modo più pulito per leggere cosa sta facendo quel book dei dealer. Ti dice se la forza strutturale nel mercato sta spingendo verso la stabilità o l'instabilità, se i breakout tendono a estendersi o a esaurirsi, e se gli strike che vedi sulla chain stanno assorbendo il flusso o rilasciandolo. Non ti dice la direzione. Ti dice il **carattere del regime** in cui stai operando — ed è lì che si trova gran parte del vantaggio.

Questo articolo è la lettura completa. Copriremo cos'è la gamma exposure, come si costruisce a partire dalla chain, le meccaniche dei regimi di gamma positivo contro negativo, il ruolo del gamma flip e dei gamma wall, e il workflow pratico per usare tutto questo intraday. Per approfondimenti dedicati a ciascun sotto-argomento, questa guida rimanda a [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip), [Gamma Wall spiegati](/education/gamma-walls-explained) e [Il posizionamento dei dealer 0DTE spiegato](/education/0dte-dealer-positioning-explained). Per le Greche di secondo ordine specifiche, vedi [Vanna e Charm spiegati per i trader di opzioni](/education/vanna-and-charm-explained), e per la discussione pin-versus-magnet, vedi [Max Pain spiegato — e funziona davvero?](/education/max-pain-explained).

---

## Cos'è la gamma exposure (GEX)?

La gamma exposure è il fabbisogno aggregato di hedging dei dealer implicito nel profilo di open interest della catena di opzioni. È la risposta a una sola domanda: *se lo spot si muove di poco, con quale aggressività devono tradare il sottostante i dealer per mantenere il loro book delta-neutral?*

Tre definizioni rapide per inquadrare il resto dell'articolo.

### Cos'è il gamma?

Il gamma è una Greca di secondo ordine che misura il **tasso di variazione del delta** rispetto al sottostante. Il delta indica quanto è sensibile il prezzo di un'opzione al sottostante; il gamma indica quanto è sensibile quella sensibilità. Se il delta è la velocità, il gamma è l'accelerazione.

Il gamma è più alto at-the-money e decade in entrambe le direzioni allontanandosi dallo spot. Decade anche nel tempo — le opzioni a lunga scadenza hanno meno gamma per contratto rispetto a quelle a breve scadenza. Il gamma più forte in qualsiasi chain si trova negli strike at-the-money a breve scadenza, uno dei motivi per cui il flusso 0DTE ha ridisegnato così completamente la struttura intraday.

### Perché il gamma dei dealer conta in modo specifico

I dealer non detengono opzioni per speculare. Le tengono in magazzino come inventario, coprendo il delta il più rapidamente possibile. La loro gamma exposure determina come deve cambiare quella copertura al muoversi del prezzo.

- Un dealer **short gamma** deve tradare **nella stessa direzione** del movimento per restare flat — comprando quando il prezzo sale, vendendo quando scende. Quell'hedging amplifica il movimento.
- Un dealer **long gamma** trada **contro** il movimento per restare flat — vendendo quando il prezzo sale, comprando quando scende. Quell'hedging smorza il movimento.

La gamma exposure aggregata dei dealer sull'intera chain è, in sostanza, una stima di quanto flusso sul sottostante i market maker dovranno far passare durante un dato movimento di prezzo, e in quale direzione. Questo è ciò che il GEX cattura.

### Una definizione operativa

La gamma exposure è la magnitudine in dollari (e il segno) del flusso di hedging dei dealer per unità di movimento del sottostante, aggregata su tutti i contratti aperti. Quando i trader chiedono "gamma exposure spiegata" o "cos'è il GEX", la risposta è questa: è una stima in tempo reale di come reagirà il book dei dealer al prezzo.

---

## Come si calcola la gamma exposure?

Il calcolo ha diversi elementi mobili, ma la struttura è semplice.

### La formula per singolo strike

Per un singolo contratto di opzioni, il contributo alla gamma exposure dei dealer (in dollari, per un movimento dell'1%) è approssimativamente:

```
contract_GEX ≈ gamma × open_interest × 100 × spot² × 0.01
```

Dove:

- `gamma` è il gamma per singola opzione derivato dal modello di Black-Scholes.
- `open_interest` è il numero di contratti in essere a quello strike.
- `100` è il moltiplicatore standard del contratto.
- `spot²` converte il gamma (che di per sé è espresso per dollaro) in una magnitudine di flusso di hedging.
- `0.01` riscala il risultato in un'interpretazione "per movimento dell'1%", che è la convenzione del settore.

L'interpretazione in dollari è ciò che rende utile il numero: risponde a "quanto sottostante devono tradare i dealer se lo spot si muove dell'1%?" — a un singolo strike, e poi aggregato su tutta la chain.

### Gamma exposure con segno

Per trasformare la magnitudine grezza in un segnale di regime, ogni contratto viene segnato in base a chi lo detiene. La convenzione standard assume che:

- I clienti siano tipicamente net long sulle call e net long sulle put.
- I dealer siano quindi tipicamente net short su entrambe — le call vendute contribuiscono gamma positivo al book dei dealer, le put vendute contribuiscono gamma negativo.

In pratica, ciò produce un GEX dei dealer con segno per ogni strike — positivo per le call, negativo per le put — che, sommato, dà l'esposizione netta del dealer sull'intera chain.

Questa è un'approssimazione. Il posizionamento dei dealer non è direttamente osservabile; viene dedotto dall'open interest e dalla convenzione standard sui clienti long. Fornitori diversi gestiscono i casi limite in modo diverso, e l'ipotesi può fallire in condizioni di flusso insolite. Come stimatore di regime, tuttavia, ha retto abbastanza bene da diventare lo standard per anni.

### Net GEX contro total GEX

Dalla stessa chain derivano due numeri aggregati:

- Il **Total GEX** è la somma del contributo *assoluto* a ogni strike — una lettura di magnitudine, indifferente al segno. Indica quanto gamma è presente nel sistema nel complesso.
- Il **Net GEX** è la somma *con segno* — call meno put. Indica quale lato del book dei dealer domina, e se il riflesso aggregato di hedging sta smorzando o amplificando.

La maggior parte dell'analisi di regime usa il Net GEX. Anche la magnitudine conta — un Net GEX di +$2 miliardi è un regime molto più marcato di +$200 milioni — ma il segno è la prima lettura.

### Gamma dei dealer via spot-shift contro aggregazione per strike

Ci sono due modi per estrarre informazioni di regime dalla chain:

1. L'**aggregazione per strike** somma la gamma exposure con segno a ogni strike, allo spot odierno. È veloce e intuitiva.
2. Il **gamma dei dealer via spot-shift** riprezza il gamma di ogni opzione a ogni prezzo spot ipotetico su una griglia, e poi somma per ottenere una *curva* del gamma dei dealer rispetto al prezzo. Lo zero-crossing di quella curva è il gamma flip; il valore allo spot odierno è il Net GEX-at-spot.

L'approccio spot-shift ha un vantaggio strutturale: poiché il Net GEX principale e il gamma flip vengono letti dalla stessa curva, non possono contraddirsi a vicenda. Un Net GEX positivo corrisponde sempre a uno spot sopra il flip; uno negativo si trova sempre sotto. L'approccio per strike può produrre segni incoerenti quando la chain si sposta, motivo per cui l'approccio spot-shift è lo standard del settore per l'analisi di regime seria. La metodologia dietro l'implementazione di ZeroGEX è documentata in dettaglio in [GEX e il Gamma Flip — come li calcola ZeroGEX](/guides/gamma-flip-calculation-before-vs-after).

---

## Regimi di gamma positivo contro negativo

La lettura singola più importante nell'analisi del posizionamento dei dealer è capire su quale lato del gamma flip si trovi lo spot. Le meccaniche sono l'una l'inverso dell'altra — e i trade che funzionano in un regime tendono a essere quelli sbagliati nell'altro.

### Regime di gamma positivo

Sopra il gamma flip, i dealer sono generalmente net long gamma. Per restare delta-neutral, coprono i movimenti direzionali — vendendo quando il prezzo sale e comprando quando scende. Questo riflesso tende a:

- Comprimere la volatilità realizzata.
- Tirare il prezzo verso gli strike con forte concentrazione di gamma, specialmente verso la chiusura.
- Rendere più difficile sostenere i breakout.
- Rendere più affidabili i setup di mean-reversion.

Il carattere del mercato è **range-bound e assorbente**. Il comportamento di pinning è più probabile, specialmente vicino all'OPEX e verso la chiusura del mercato cash. Le strategie short-premium tendono a funzionare più spesso. I setup trend-following hanno un tasso di successo più basso.

### Regime di gamma negativo

Sotto il gamma flip, i dealer sono generalmente net short gamma. Per restare delta-neutral, coprono con movimenti direzionali — comprando quando il prezzo sale e vendendo quando scende. Questo riflesso tende a:

- Espandere la volatilità realizzata.
- Far estendere i breakout più di quanto sembrerebbe dovuto.
- Far accelerare i selloff man mano che procedono.
- Rendere pericolosi i setup di mean-reversion.

Il carattere del mercato è **guidato dal momentum e amplificante**. I pin del regime precedente si rilasciano; gli strike che erano resistenza possono diventare target di breakout. Le strategie long-premium e di trend-continuation tendono a funzionare più spesso. Cercare di prendere un coltello che cade in un regime di gamma profondamente negativo va contro esattamente il riflesso che renderebbe efficace un dip-buy.

### Due avvertenze importanti

Il regime è un'**inclinazione probabilistica, non una garanzia**. Shock macro, catalizzatori su singoli titoli componenti l'indice, ed eventi di flusso insoliti possono sovrastare la spinta strutturale in entrambe le direzioni. Un regime spot ti dice *qual è il riflesso del dealer*, non cosa faranno tutti gli altri partecipanti.

Il regime è anche **dinamico**. Il flip si sposta man mano che il posizionamento si ribilancia, e lo spot può attraversarlo più volte in una sessione. Leggere il regime è un'attività continua, non un rituale mattutino.

---

## Il gamma flip: il confine di regime

Il gamma flip è il livello in cui il gamma aggregato dei dealer incrocia lo zero. Sopra di esso, i dealer sono tipicamente net long gamma; sotto, net short. È il confine strutturale tra i due regimi descritti sopra.

Alcune cose su cui vale la pena essere precisi:

- Il flip è un **livello, non un muro**. Non resiste al prezzo come potrebbe fare una forte concentrazione di strike. Segna un'inflessione comportamentale, non una barriera strutturale.
- È una **linea di regime, non un segnale direzionale**. Lo spot sopra il flip non è rialzista; lo spot sotto non è ribassista. Ti dice qualcosa sul carattere della volatilità, non sulla direzione.
- È **dinamico**. Man mano che l'OI ruota e la chain si riponderá, il flip si sposta. Un flip datato è un flip fuorviante.
- È un **filtro, non un segnale**. Ti dice quale playbook eseguire; l'ingresso deve venire da altrove.

Per il workflow di lettura pratico — incluso cosa cambia sopra rispetto a sotto, come agire intraday e gli errori comuni — vedi [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Gamma wall: dove si concentrano i flussi

Se il flip è il confine di regime, i gamma wall sono i confini strutturali al suo interno. Il **call wall** è lo strike sopra lo spot con la maggiore gamma exposure sulle call; il **put wall** è lo strike sotto lo spot con la maggiore gamma exposure sulle put. Insieme delineano il range che l'hedging dei dealer tende a difendere.

I wall si comportano in modo molto diverso nei due regimi:

- In un regime di **gamma positivo**, i wall assorbono. Il riflesso dei dealer intorno a essi è di contrastare i movimenti — vendendo i rally verso il call wall, comprando i cali verso il put wall.
- In un regime di **gamma negativo**, i wall rilasciano. Lo stesso livello che resisteva al prezzo in gamma positivo può diventare un target di breakout.

Anche i wall migrano. Un call wall che si sposta verso l'alto man mano che il prezzo lo testa è una lettura strutturalmente diversa rispetto a uno che tiene. Per il workflow di lettura completo, vedi [Gamma Wall spiegati: Call Wall, Put Wall e come reagisce il prezzo](/education/gamma-walls-explained).

---

## Come il GEX modella la volatilità intraday

La volatilità realizzata — l'ampiezza effettiva dei movimenti di prezzo durante la sessione — è fortemente modellata dal regime di GEX, separatamente dalla volatilità implicita (che è ciò che il mercato delle opzioni sta prezzando per il futuro).

La relazione è strutturale:

- Un regime di gamma positivo profondo tende a produrre **volatilità realizzata inferiore rispetto all'implicita**. Il riflesso smorzante è abbastanza forte da sopprimere movimenti che il mercato si aspettava. Questo spesso favorisce le strategie di vendita di premio.
- Un regime di gamma negativo profondo tende a produrre **volatilità realizzata superiore rispetto all'implicita**. Il riflesso amplificante espande i range oltre quanto prezzato dal mercato. Questo tende a favorire le strategie long-premium e momentum.

La magnitudine conta quanto il segno. Un passaggio da +$2 miliardi di Net GEX a +$200 milioni è uno stato molto diverso rispetto a un passaggio da −$2 miliardi a +$200 milioni, anche se entrambi arrivano a un numero simile. Il primo è un regime long-gamma che si sta *esaurendo*; il secondo è uno che si sta *costruendo*. La traiettoria fa parte della lettura.

Un errore comune è usare il GEX come segnale direzionale — "il Net GEX sale, quindi il mercato sta salendo". Non è ciò che indica. Il GEX ti dice qualcosa sul **carattere del movimento**, non sulla sua direzione. Un regime di gamma positivo può scendere con la stessa facilità con cui può salire, ma tenderà a farlo in modo graduale piuttosto che con una rottura.

---

## Come usare il GEX intraday

Un workflow pratico:

### Fase 1: Identifica il regime

Prima di tutto, verifica se lo spot è sopra o sotto il gamma flip e qual è la magnitudine del Net GEX. Questa singola lettura filtra una grossa quota di trade sbagliati — contrastare il movimento quando dovresti seguirlo, breakout quando dovresti contrastarli.

### Fase 2: Leggi i wall all'interno del regime

Individua il call wall e il put wall attivi. In un regime di gamma positivo, questi sono i tuoi confini assorbenti — il range strutturale. In un regime di gamma negativo, sono più deboli come resistenza e possono trasformarsi in target di breakout.

### Fase 3: Osserva la migrazione

I livelli non sono statici. Un wall che migra insieme al prezzo (inseguendo il movimento) è una lettura diversa rispetto a uno che tiene. Un flip che deriva verso l'alto insieme al prezzo ha implicazioni diverse rispetto a uno che rimane fermo mentre lo spot si allontana. Traccia il *cambiamento*, non solo il valore.

### Fase 4: Tieni conto della concentrazione 0DTE

Quando le opzioni con scadenza giornaliera dominano la chain — sempre più la norma per SPX durante la sessione cash — il segmento 0DTE guida in modo sproporzionato il comportamento intraday dei dealer. Il gamma rilevante è quello degli strike che saranno vivi alla chiusura. L'approfondimento è in [Il posizionamento dei dealer 0DTE spiegato](/education/0dte-dealer-positioning-explained).

### Fase 5: Integra le Greche di secondo ordine dove rilevante

Il gamma non è l'intero quadro. Vanna (hedging guidato dalla vol) crea un bid persistente nei regimi di compressione della volatilità; charm (hedging guidato dal tempo) genera i flussi prevedibili verso la chiusura che emergono nelle letture di pressione di fine giornata. L'articolo di approfondimento su [Vanna e Charm spiegati per i trader di opzioni](/education/vanna-and-charm-explained) copre entrambi.

---

## Vanna e charm: la storia del secondo ordine

Il GEX è la lettura principale, ma non è l'intero book dei dealer. Due Greche di secondo ordine modellano in modo sostanziale i flussi di hedging dei dealer, oltre al gamma:

- **Vanna** è la sensibilità del delta alla volatilità implicita. Quando la IV si muove, i delta delle opzioni dei dealer si muovono anche se lo spot non lo fa — e i dealer devono coprire quel movimento. In un regime di compressione della volatilità, i flussi di vanna derivanti dalle call short dei dealer spesso si manifestano come un bid persistente e graduale sul sottostante.
- **Charm** è la sensibilità del delta al tempo. Man mano che le opzioni si avvicinano alla scadenza, il loro delta deriva in modo prevedibile — le opzioni out-of-the-money decadono verso 0, quelle in-the-money verso 1 — e i dealer devono continuamente ri-coprire quella deriva. Il punto più pulito per osservare il charm nel mercato sono gli ultimi 90 minuti della sessione cash.

Entrambi gli effetti sono massimi quando anche il gamma è alto — ovvero quando le opzioni 0DTE e a breve scadenza dominano la chain. Leggili insieme al GEX, non isolatamente.

---

## Fraintendimenti comuni sul GEX

Alcune trappole:

- **"Gamma positivo è rialzista."** Non lo è. È **stabilizzante**. Il mercato può scendere anche in un regime di gamma positivo; tende semplicemente a farlo lentamente.
- **"Il Net GEX è un indicatore direzionale."** Non lo è. Il segno ti dice il regime; la direzione viene da altrove.
- **"I livelli di GEX sono fissi."** Non lo sono. Il flip, i wall e lo stesso Net GEX si muovono tutti man mano che la chain si riposiziona.
- **"I wall sono supporto e resistenza rigidi."** Sono inclinazioni strutturali il cui effetto comportamentale dipende dal regime. Vengono violati regolarmente.
- **"Il GEX è un segnale."** È più vicino a un filtro. Una lettura di regime pulita affina ogni altro strumento che usi; da sola non ti dice quando entrare.

---

## Cosa NON è il GEX (limiti)

Il GEX è uno stimatore del fabbisogno di hedging dei dealer costruito a partire dall'open interest sotto un'ipotesi standard su chi detiene cosa. Questo lo rende utile, ma non è un quadro completo:

- **L'OI è una fotografia, non un inventario in tempo reale.** Il posizionamento dei dealer cambia durante la giornata in modi che l'OI non cattura.
- **La convenzione cliente-long-call/cliente-long-put può rompersi.** Durante condizioni di flusso insolite, l'ipotesi sul segno dei dealer può attribuire male l'esposizione.
- **Gli eventi macro sovrastano la struttura.** Una sorpresa sul CPI o un comunicato del FOMC possono travolgere il riflesso dei dealer.
- **I catalizzatori su singoli titoli possono muovere il GEX dell'indice indirettamente.** Utili, M&A e notizie sui componenti possono ridisegnare il flusso su SPX in modi che emergono nel GEX con un ritardo.
- **Le ipotesi sticky-strike contro sticky-delta** contano per le implementazioni spot-shift; fornitori diversi le gestiscono in modo diverso.

L'inquadratura corretta è che il GEX è la lettura singola più pulita della forza strutturale guidata dai dealer nel mercato — non l'unica forza, non una previsione, e non un sostituto della gestione del rischio.

---

## Come ZeroGEX presenta la gamma exposure

La dashboard centralizza le letture in tempo reale:

- La **card Net GEX** mostra il valore del gamma dei dealer allo spot (coerente per segno con il flip, calcolato da un'unica curva).
- La **card Gamma Flip** mostra il livello attuale del flip con la distanza in tempo reale dallo spot.
- Le **card Call Wall e Put Wall** tracciano i confini strutturali in tempo reale.
- Il **grafico del profilo per strike** traccia il profilo del gamma dei dealer attraverso gli strike — la curva da cui derivano sia il Net GEX sia il flip.
- La **heatmap strike-per-DTE** scompone il gamma per fascia di scadenza, mettendo in evidenza la concentrazione 0DTE che domina sempre più la lettura intraday.

![Panoramica della dashboard ZeroGEX con le card Net GEX, Gamma Flip, Call Wall e Put Wall](/blog/zerogex-dashboard-overview.png)

Un esempio pratico. Supponiamo che SPX sia a 5.830 e la dashboard mostri:

- **Net GEX:** +$1,5 miliardi
- **Gamma Flip:** 5.810
- **Call Wall:** 5.850
- **Put Wall:** 5.790

La lettura composita: lo spot è comodamente in territorio long-gamma ($20 sopra il flip), il Net GEX è un numero positivo consistente che indica una magnitudine reale nel book dei dealer, e il range dei wall è asimmetrico con il call wall più vicino rispetto al put wall. L'inclinazione pratica: regime di volatilità smorzata, mercato favorevole alla mean-reversion, breakout più propensi a esaurirsi che a estendersi, e comportamento di pinning verso la forte concentrazione di gamma possibile verso la chiusura. Niente di tutto questo è un segnale di trade — è lo sfondo strutturale rispetto al quale dovrebbe essere calibrato ogni altro strumento che usi.

![Grafico del profilo per strike di ZeroGEX con la curva del gamma dei dealer, la linea del flip e i wall evidenziati](/blog/zerogex-strike-profile-overview.png)

Ora immagina la stessa dashboard 90 minuti dopo: il Net GEX è decaduto a +$300 milioni e il gamma flip è derivato verso l'alto a 5.825 mentre lo spot è scivolato a 5.818. Il regime è ora contestato — lo spot è tecnicamente sotto il flip, ma solo di pochi punti, e la magnitudine si è assottigliata. Questo è esattamente lo stato strutturale in cui entrambi i regimi sono parzialmente attivi, il comportamento diventa instabile, e la disciplina corretta è di solito aspettare una lettura più pulita prima di impegnarsi.

---

## Conclusione

> La gamma exposure non è una previsione. È una lettura di regime — la forza strutturale nel book dei dealer che modella il comportamento del mercato, ma che da sola non ne detta la direzione.

La disciplina consiste nel partire dal regime, leggere la struttura al suo interno, osservare come entrambi migrano nel corso della sessione, e lasciare che il GEX filtri quale playbook ha senso invece di trattarlo come un segnale a sé stante. Gran parte del vantaggio nell'analisi del posizionamento dei dealer sta nel *non prendere* i trade che vanno contro il riflesso dei dealer.

Solo a scopo educativo — nessuno di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere la [lettura completa della gamma exposure di oggi in tempo reale](/real-time-gex-0dte) — Net GEX, gamma flip, call e put wall, e il profilo del gamma dei dealer — [la dashboard gratuita di ZeroGEX](/spx-gamma-levels) mette tutto a disposizione. Per un confronto diretto tra ZeroGEX e altre piattaforme di gamma exposure, vedi [la guida ai migliori strumenti GEX](/education/best-gex-tools).
