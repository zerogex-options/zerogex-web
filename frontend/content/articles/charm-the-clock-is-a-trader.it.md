# Charm: l'orologio è un trader

*Charm è la velocità con cui il delta di un'opzione cambia con il passare del tempo. Costringe i dealer a negoziare azioni anche quando il mercato è completamente piatto — e siccome l'orologio è l'unica variabile che si può prevedere con perfetta precisione, charm è il raro flusso dei dealer che puoi prevedere ore prima che si materializzi. Una previsione con una scadenza.*

---

## Il greco che si muove su un tape vuoto

La maggior parte dei flussi ha bisogno che accada qualcosa. Gamma ha bisogno di un movimento di prezzo. Le news hanno bisogno di notizie. Charm non ha bisogno di nulla. È la sensibilità del delta al passare del tempo — ∂Δ/∂t — e il tempo passa indipendentemente dal fatto che il tape faccia qualcosa. Un dealer può stare davanti a un mercato che non si è mosso di un tick per novanta minuti ed essere comunque costretto a vendere azioni per tutto quel tempo, perché i delta nel suo book stanno silenziosamente decadendo e l'hedge deve ridursi per stare al passo.

Questo è ciò che rende charm strano e, una volta capito, ovvio. L'orologio è un trader. Non si ferma mai, non cambia mai idea, e lavora lo stesso ordine ogni singola sessione. Le uniche domande sono in quale direzione spinge e quanto grande sarà la spinta.

Questo articolo è il compagno meccanico della nostra spiegazione più ampia [Vanna and Charm explainer](/education/vanna-and-charm-explained). Quell'articolo inquadra charm come uno degli input nella lettura di fine giornata; questo qui va sotto il cofano — da dove viene il drift, perché accelera, e come puoi mettere una cifra in dollari e una scadenza prima che accada.

---

## Da dove viene il drift

Il delta è, grosso modo, la probabilità risk-neutral che un'opzione scada in the money. Una call con delta 0,30 è il modo in cui il mercato dice che c'è circa il 30% di probabilità che scada con valore. Quella probabilità è una stima viva, e con l'avvicinarsi della scadenza deve collassare in un verdetto: o l'opzione scade in the money (delta → 1) o non lo fa (delta → 0). Alla campanella non c'è via di mezzo.

Charm è la velocità di quel collasso. Osserva un'opzione leggermente out-of-the-money durante un pomeriggio con lo spot fermo:

- Stamattina aveva delta 0,35 — una reale possibilità di ripagare.
- All'ora di pranzo, con meno tempo sull'orologio e lo spot invariato, delta 0,28.
- Alle 15:00, delta 0,18.
- Verso la campanella, delta che scivola verso 0.

Non si è mosso nulla. Il delta dell'opzione è comunque dimezzato, puramente perché la pista si è accorciata. Ognuno di quei passi è un cambiamento nel rapporto di copertura, e ogni cambiamento costringe il dealer che detiene quell'opzione ad aggiustare la propria posizione azionaria. Quell'aggiustamento è il flusso di charm.

Le opzioni in the money fanno l'immagine speculare, consolidandosi da 0,80 verso 1,00 man mano che il loro esito diventa quasi certo. Il charm netto del book è la somma su ogni strike, ponderata per quanto open interest si trova lì e da quale lato sta il dealer.

---

## Perché accelera verso la chiusura

Charm non è costante durante la giornata. Il tasso di decadimento del delta è piccolo quando c'è ancora molto tempo a disposizione e cresce man mano che la scadenza si avvicina — è massimo nell'ultima ora e massimo in assoluto negli ultimi minuti, per gli strike vicini al prezzo che hanno ancora un verdetto in sospeso. Su una catena dominata da scadenze giornaliere, che oggi è la norma per SPX, la maggior parte del flusso di charm della giornata si comprime negli ultimi sessanta-novanta minuti.

Questa è la ragione meccanica per cui il "drift verso la chiusura" è un fenomeno reale e non una superstizione da grafico. Non è che i trader diventano emotivi alle 15:00. È che la matematica del decadimento del delta concentra lì la maggior parte della sua forza, e i dealer che coprono quel decadimento non hanno scelta su quando negoziare. Il flusso aumenta perché il greco aumenta.

Il grafico live [Charm into Close](/forced-flow) disegna esattamente questo: tiene lo spot fisso, fa avanzare l'orologio fino alla campanella, e traccia le azioni cumulative che il book dei dealer è costretto a negoziare a ogni passo. La curva parte da zero al momento attuale e si allontana da zero man mano che il pomeriggio procede — più ripida verso la fine, perché è lì che vive charm.

---

## Una previsione con una scadenza

Ecco la proprietà che rende charm unicamente utile, ed è la cosa che non troverai in una normale trattazione dei greeks.

Ogni altro flusso dei dealer è condizionato. Il flusso di gamma dipende da un movimento dello spot che potrebbe arrivare o no. Il flusso di vanna dipende da uno shift della volatilità che non puoi programmare. Ma il flusso di charm dipende solo dal tempo, e il tempo è l'unica variabile che farà esattamente quello che ti aspetti. Alle 9:35 del mattino, con lo spot al suo livello attuale, puoi calcolare quante azioni il solo decadimento temporale costringerà i dealer a comprare o vendere entro le 16:00. Conosci la dimensione e la direzione di un grande flusso sei ore e mezza prima che si concluda.

Questa è una previsione con una scadenza. La previsione ha una condizione allegata — "se lo spot tiene vicino qui" — e lo spot raramente tiene perfettamente, quindi la chiusura reale mescola charm con qualsiasi gamma produca il movimento della giornata. Ma la componente di charm è conoscibile in anticipo in un modo che quasi nient'altro nei mercati è. È la cosa più vicina a un ordine programmato che il mercato offra, ed è programmata dal calendario, non dalla decisione di nessuno.

Questo è esattamente il numero che il [bollettino Charm-into-Close](/forced-flow) mostra prima dell'apertura: *il solo decadimento temporale costringe i dealer a comprare/vendere \$X entro le 16:00 ET se il sottostante tiene qui.* Una scadenza, una direzione e una cifra in dollari, tutto calcolabile all'alba.

---

## Mettere un numero sopra

Supponiamo sia un venerdì con un pesante posizionamento 0DTE su SPY, spot a 560. Il book dei dealer contiene le opzioni della giornata, e man mano che l'orologio corre verso la campanella ciascuna di esse deve risolversi — scadere in the money o scadere senza valore — quindi i delta che i dealer stanno coprendo oscillano forte. Riprezzando l'intero book alle 16:00 con lo spot fermo a 560, il flusso forzato totale guidato dal tempo in una giornata 0DTE pesante rientra nell'ordine dei **miliardi di dollari**. Questo è il numero che il grafico live Charm-into-Close traccia, ed è ciò che "i dealer devono negoziare entro la chiusura" significa letteralmente.

Due avvertenze oneste su quella cifra di apertura. Primo, la maggior parte è costituita dalle opzioni della giornata che *si risolvono* alla campanella — un effetto di pin che dipende esattamente da dove si assesta lo spot, non un decadimento liscio — quindi è grande ed è sensibile allo spot. Secondo, il puro drift di charm, la parte che è genuinamente decadimento temporale del book superstite piuttosto che l'evento di scadenza, ne è una frazione: dell'ordine di qualche centinaio di milioni, che si accumula costantemente durante il pomeriggio. La dashboard mostra entrambi — il flusso completo di chiusura e il drift di solo charm — perché rispondono a domande diverse, e il numero più piccolo di solo charm è la lettura più pulita e meno sensibile allo spot.

Capovolgi la composizione del book e lo stesso orologio forza acquisti invece che vendite. Charm non ha una direzione intrinseca nel modo in cui la gravità ha il "basso"; la direzione è determinata da quali strike i dealer sono short e long. Ciò che è invariante è il *tempismo*: qualunque sia il segno, il flusso si concentra verso la chiusura e puoi vederlo arrivare — calcolabile alle 9:35 di quella mattina.

---

## Come usarlo davvero

Una breve disciplina:

- **Leggi il segno all'apertura.** La cifra di charm-into-close ti dice in quale direzione l'orologio sta spingendo oggi e più o meno quanto forte. È contesto di regime, non un entry.
- **Cerca la confluenza.** Quando charm punta nella stessa direzione del magnete di gamma — verso cui deriva lo strike price pesante — le due forze si sommano e il drift verso la chiusura è al suo più pulito. Quando sono in disaccordo, aspettati oscillazioni casuali, non drift.
- **Rispetta la condizione "se lo spot tiene".** Charm è una previsione condizionata. Un movimento dell'1% a metà pomeriggio passa il volante a gamma e può sommergere completamente la lettura di charm. La previsione è più affidabile nei giorni tranquilli e range-bound — che sono anche i giorni in cui conta di più.
- **Sconta il segnale quando la volatilità è in espansione.** In una giornata genuinamente volatile, le reazioni di gamma dominano e l'ordinato drift di charm diventa rumore.

L'orologio è il trader più affidabile del mercato. Lavora lo stesso ordine ogni giorno, ti dice in anticipo cosa farà, e non manca mai di presentarsi alle 16:00. Charm è il modo in cui leggi il suo biglietto.

Per il concetto padre, vedi [Delta and Its Three Children](/education/delta-and-its-three-children); per il fratello guidato dalla volatilità, vedi [Vanna: When Fear Fades, Dealers Buy](/education/vanna-when-fear-fades); e per guardare la curva verso la chiusura formarsi in tempo reale, apri la pagina live [Forced Flow](/forced-flow).

Solo contenuto educativo — nessuno di quanto sopra è una raccomandazione di trading.
