# Charm: l'orologio è un trader

*Charm è la sensibilità del delta al tempo, a parità degli altri input. Stima una potenziale pressione di copertura condizionale - non un ordine programmato dei dealer - quando spot, IV e inventario ipotizzato restano vicini ai valori attuali.*

---

## La greca che opera su un tape vuoto

La maggior parte dei flussi ha bisogno che accada qualcosa. Il gamma ha bisogno di un movimento di prezzo. Le news hanno bisogno di notizie. A charm non serve altro che l'orologio. È la sensibilità del delta al passare del tempo - ∂Δ/∂t, a parità di spot e vol - e il tempo passa indipendentemente dal fatto che il tape faccia qualcosa. Un dealer può stare davanti a un mercato che non si è mosso di un tick per novanta minuti e scoprire comunque che il delta modellato del suo book sta decadendo silenziosamente, spingendolo a vendere azioni per tutto il tempo per tenere la copertura allineata.

Questo è ciò che rende charm strano e, una volta capito, ovvio. L'orologio è un trader - un trader modellato. Non si ferma mai e non cambia mai idea, e a parità degli altri input punta nella stessa direzione per tutta la sessione. Le uniche domande sono in quale direzione spinge, quanto grande diventa la spinta, e se i movimenti effettivi di spot e vol della giornata la lasciano intatta.

Questo articolo è il compagno meccanico della nostra più ampia [spiegazione di Vanna e Charm](/education/vanna-and-charm-explained). Quell'articolo inquadra charm come uno degli input nella lettura di fine giornata; questo va sotto il cofano - da dove viene il drift, perché accelera, e come puoi dargli una cifra in dollari e una scadenza prima che accada.

---

## Da dove viene il drift

Il delta è strettamente legato - ma non esattamente uguale - alla probabilità risk-neutral che un'opzione scada in the money. Una call con delta 0,30 è più o meno il modo in cui il mercato dice che c'è qualcosa come il 30% di probabilità che scada con valore. Quella probabilità implicita è una stima viva, e con l'avvicinarsi della scadenza deve collassare verso un verdetto: o l'opzione scade in the money (delta → 1) o non lo fa (delta → 0), e solo il caso at-the-money sul filo del rasoio resta indeciso fino alla campanella.

Charm è la velocità di quel collasso. Osserva un'opzione leggermente out-of-the-money durante un pomeriggio con lo spot fermo:

- Stamattina aveva delta 0,35 - una reale possibilità di ripagare.
- All'ora di pranzo, con meno tempo sull'orologio e lo spot invariato, delta 0,28.
- Alle 15:00, delta 0,18.
- Verso la campanella, delta che scivola verso 0.

Non si è mosso nulla. Il delta dell'opzione è comunque dimezzato, puramente perché la pista si è accorciata. Ognuno di quei passi è un cambiamento nel rapporto di copertura, e ogni cambiamento costringe il dealer che detiene quell'opzione ad aggiustare la propria posizione azionaria. Quell'aggiustamento è il flusso di charm.

Le opzioni in the money fanno l'immagine speculare, consolidandosi da 0,80 verso 1,00 man mano che il loro esito diventa quasi certo. Il charm netto del book è modellato come la somma su ogni strike, ponderata per quanto open interest si trova lì e, secondo la convenzione di posizionamento, per il lato su cui si ipotizza che stia il dealer - l'inventario effettivo dei dealer non è direttamente osservabile dai dati pubblici sulle opzioni.

---

## Perché accelera verso la chiusura

Charm non è costante durante la giornata. Il tasso di decadimento del delta è piccolo quando c'è ancora molto tempo a disposizione e cresce man mano che la scadenza si avvicina - è massimo nell'ultima ora e massimo in assoluto negli ultimi minuti, per gli strike vicini al prezzo che hanno ancora un verdetto in sospeso. Su una catena dominata da scadenze giornaliere, che oggi è la norma per SPX, la maggior parte del flusso di charm della giornata si comprime negli ultimi sessanta-novanta minuti.

Questa è la ragione meccanica per cui il "drift verso la chiusura" è un fenomeno ricorrente e non una superstizione da grafico. Non è che i trader diventano emotivi alle 15:00. È che la matematica del decadimento del delta concentra lì la maggior parte della sua forza modellata, e i dealer che coprono quel decadimento tendono a fare la maggior parte dei loro aggiustamenti tardi - anche quelli che lavorano con bande di copertura invece di negoziare in continuo. Il flusso modellato aumenta perché la greca aumenta.

Il grafico live [Charm into Close](/forced-flow) disegna esattamente questo: tiene fissi spot e vol, fa avanzare l'orologio fino alla campanella, e traccia le azioni cumulative che, secondo il modello, il book dei dealer negozierebbe a ogni passo. La curva parte da zero al momento attuale e si allontana da zero man mano che il pomeriggio procede - più ripida verso la fine, perché è lì che vive charm.

---

## Una previsione con una scadenza

Ecco la proprietà che rende charm unicamente utile, ed è la cosa che non troverai in una normale trattazione dei greeks.

Ogni altro flusso dei dealer è condizionato. Il flusso di gamma dipende da un movimento dello spot che potrebbe arrivare o no. Il flusso di vanna dipende da uno shift della volatilità che non puoi programmare. La *componente* charm dipende solo dal tempo, e il tempo è l'unico input che farà esattamente quello che ti aspetti. Alle 9:35 del mattino, tenendo spot e vol ai livelli attuali, puoi stimare quante azioni il decadimento temporale *da solo* porterebbe i dealer a comprare o vendere entro la chiusura. Ottieni una dimensione e una direzione modellate per un grande flusso ore prima che si concretizzi - a condizione che il resto del mondo resti fermo, cosa che non accade mai del tutto.

Questa è una previsione con una scadenza. La previsione ha una condizione allegata - "se spot e vol restano vicini a questi livelli" - e raramente ci restano perfettamente, quindi la chiusura reale mescola charm con qualsiasi gamma e vanna producano i movimenti della giornata. Ma la componente charm è stimabile in anticipo in un modo in cui quasi nient'altro nei mercati lo è. È la cosa più vicina a un flusso prevedibile e guidato dal calendario che il mercato offra - una pressione modellata fissata dall'orologio, non un ordine programmato che qualcuno sia obbligato a eseguire.

Questo è essenzialmente il numero che il [bollettino Charm-into-Close](/forced-flow) mostra prima dell'apertura: *secondo il modello, il solo decadimento temporale porta i dealer a comprare/vendere \$X verso la chiusura se il sottostante tiene qui.* Una scadenza, una direzione e una cifra in dollari, tutto stimabile all'alba.

---

## Mettere un numero sopra

Supponiamo sia un venerdì con un pesante posizionamento 0DTE su SPY, spot a 560. Il book dei dealer contiene le opzioni della giornata, e man mano che l'orologio corre verso la campanella ciascuna di esse deve risolversi - scadere in the money o scadere senza valore - quindi i delta che i dealer stanno coprendo oscillano forte. Riprezzando l'intero book alla chiusura con lo spot fermo a 560, il flusso totale modellato guidato dal tempo in una giornata 0DTE pesante può arrivare nell'ordine del **miliardo di dollari**. Questo è il numero che il grafico live Charm-into-Close traccia, ed è ciò che in pratica significa "quanto il modello stima che i dealer negozino entro la chiusura".

Due avvertenze oneste su quella cifra principale. Primo, la maggior parte è costituita dalle opzioni della giornata che *si risolvono* alla campanella - un effetto di pin che dipende esattamente da dove si assesta lo spot, non un decadimento liscio - quindi è grande ed è sensibile allo spot. Secondo, il puro drift di charm, la parte che è genuinamente decadimento temporale del book superstite piuttosto che l'evento di scadenza, ne è una frazione: dell'ordine di qualche centinaio di milioni, che si accumula costantemente durante il pomeriggio. La dashboard mostra entrambi - il flusso completo di chiusura e il drift di solo charm - perché rispondono a domande diverse, e il numero più piccolo di solo charm è la lettura più pulita e meno sensibile allo spot.

Capovolgi la composizione del book e lo stesso orologio punta invece verso gli acquisti. Charm non ha una direzione intrinseca nel modo in cui la gravità ha il "basso"; la direzione è determinata dagli strike su cui i dealer sono modellati short e long. Ciò che tende a restare valido è il *tempismo*: qualunque sia il segno, il flusso modellato si concentra verso la chiusura, e quella concentrazione è stimabile alle 9:35 di quella mattina.

---

## Come usarlo davvero

Una breve disciplina:

- **Leggi il segno all'apertura.** La cifra di charm-into-close ti dice in quale direzione l'orologio sta spingendo oggi e più o meno quanto forte. È contesto di regime, non un entry.
- **Cerca la confluenza.** Quando charm punta nella stessa direzione del magnete gamma - lo strike pesante verso cui sta derivando il prezzo - le due forze si sommano e il drift verso la chiusura è nella sua forma più pulita. Quando sono in disaccordo, aspettati oscillazioni senza direzione, non drift.
- **Rispetta la condizione "se lo spot tiene".** Charm è una previsione condizionata. Un movimento dell'1% a metà pomeriggio passa il volante al gamma e può sommergere completamente la lettura di charm. La stima basata sul solo tempo è più facile da isolare nei giorni tranquilli, ma ZeroGEX non ha presentato questa osservazione come un risultato di performance calibrato.
- **Dagli meno peso quando la volatilità è in espansione.** In una giornata genuinamente volatile, le reazioni di gamma dominano e l'ordinato drift di charm diventa rumore.

Charm tiene costanti spot e IV per definizione. I portafogli reali contengono compensazioni tra strike e scadenze; i dealer possono usare bande di copertura, futures o altre opzioni, e nuovi trade possono cambiare l'inventario. La stima rappresenta quindi una potenziale pressione di copertura dovuta al solo tempo, non la prova di quando o quanto i dealer negozieranno.

Per il concetto padre, vedi [Delta e i suoi tre figli](/education/delta-and-its-three-children); per il fratello guidato dalla volatilità, vedi [Vanna: come il calo della IV può cambiare la copertura dei dealer](/education/vanna-when-fear-fades); e per guardare la curva verso la chiusura formarsi in tempo reale, apri la pagina live [Forced Flow](/forced-flow).

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.
