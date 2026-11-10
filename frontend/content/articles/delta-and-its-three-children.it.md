# Delta e i suoi tre figli

*Il delta dice a un dealer quante azioni tenere in portafoglio. Ma il delta non sta mai fermo - e i suoi tre fattori principali sono il prezzo, il tempo e la volatilità. Queste tre sensibilità sono gamma, charm e vanna. La maggior parte del flusso forzato dei dealer che compare sul tape è uno dei tre figli del delta che viene a riscuotere.*

---

## Si parte dall'hedge ratio

Il delta è il numero più importante di un'opzione e, al tempo stesso, il meno interessante. È semplicemente l'hedge ratio: il numero di azioni che si comportano, in questo momento, come un contratto di opzione. Una call con delta 0,55 si muove come 55 azioni; una put con delta −0,30 si muove come 30 azioni allo scoperto. Un dealer che non vuole esposizione direzionale detiene l'azione compensativa, e il book resta piatto.

Se il delta fosse una costante, la storia finirebbe qui. Si coprirebbe la posizione una volta sola e non la si toccherebbe mai più. Ma il delta è una derivata - il tasso di variazione del valore dell'opzione rispetto allo spot - e le derivate sono a loro volta funzioni del mondo. Cambia il mondo e il delta cambia. Il lavoro continuo del dealer, e l'intera fonte di flusso dealer leggibile, consiste nell'inseguire il delta mentre si muove.

Quindi la domanda che conta davvero non è "cos'è il delta" ma "cosa fa muovere il delta". Tre fattori fanno la maggior parte del lavoro.

---

## I tre modi in cui il delta può muoversi

Tra il momento in cui un dealer imposta una copertura e il momento in cui l'opzione scade, tre input di mercato si muovono in modo più o meno continuo, e ciascuno trascina il delta con sé:

1. **Il prezzo dell'azione cambia.** La sensibilità del delta allo spot è il **gamma** (∂Δ/∂S).
2. **Il tempo passa.** La sensibilità del delta al tempo è il **charm** (∂Δ/∂t).
3. **La volatilità implicita cambia.** La sensibilità del delta alla vol è il **vanna** (∂Δ/∂σ).

Questa è la famiglia principale. Gamma, charm e vanna sono le derivate prime del delta rispetto ai tre input che si muovono di più sotto un book coperto. I trader le memorizzano come greche separate con nomi esotici; è meglio comprenderle come un'unica idea - *come si muove il delta* - divisa in tre a seconda di *cosa lo ha fatto muovere*.

Non sono letteralmente le uniche cose che spostano il delta. Anche i tassi di interesse, i dividendi e i costi di prestito titoli, i cambiamenti nella forma della superficie di volatilità e il ricambio del book stesso - nuovi trade dei clienti, chiusure, esercizio e assegnazione, posizioni di compensazione - spostano un po' il delta. Ma questi fattori sono lenti, piccoli o discontinui, mentre prezzo, tempo e vol si muovono in continuazione per tutta la sessione. Ecco perché questi tre generano la maggior parte del flusso di copertura costante e leggibile, ed ecco perché sono i figli che vale la pena nominare.

Questo è il modello mentale più pulito del flusso dei dealer: un dealer non copre il delta, copre la **variazione** del delta. E tre canali trasportano la maggior parte di quella variazione. Dai un nome al canale e avrai dato un nome al flusso.

---

## Gamma: il delta si muove perché il prezzo si è mosso

Il gamma è quello che tutti conoscono. Quando l'azione sale, i delta delle call aumentano e i delta delle put salgono verso zero; quando scende, calano. Il gamma è la velocità con cui questo accade. Un book ad alto gamma si ricopre con forza a ogni tick; un book a basso gamma reagisce a malapena.

La caratteristica distintiva del flusso da gamma è che è **reattivo**. Non succede nulla finché il prezzo non si muove. Lo spot resta fermo, il gamma tace. Poi il mercato si muove dello 0,5% e il dealer deve scambiare una quantità di azioni per riappiattire la posizione - comprando durante un rally e vendendo durante un calo se è short gamma, facendo l'opposto se è long gamma. Questo è il flusso dietro il gamma flip, il pinning e lo squeeze, ed è trattato in profondità nel [pilastro sul Gamma Exposure](/education/gamma-exposure-explained).

Il gamma è il figlio più rumoroso. È anche l'unico che ha bisogno di un movimento dello spot per parlare. Gli altri due sono più inquietanti, perché forzano operazioni anche quando non sta succedendo assolutamente nulla.

---

## Charm: il delta si muove perché il tempo è passato

Il charm è la sensibilità del delta al passare del tempo. Un'opzione fuori dal denaro vale qualcosa oggi solo perché c'è ancora tempo perché lo spot la raggiunga; man mano che quel tempo si esaurisce, il suo delta scivola verso zero. Il delta di un'opzione nel denaro, nel frattempo, si rafforza verso 1. Il delta è strettamente legato - pur non coincidendo esattamente - alla probabilità di scadere nel denaro, e con l'avvicinarsi della scadenza quella probabilità implicita deve risolversi verso un netto sì o no. La deriva mentre si risolve *è* il charm.

La parte inquietante: il charm forza la copertura anche con lo spot perfettamente fermo. L'orologio è un trader. Un dealer può osservare il tape non fare assolutamente nulla per un'ora ed essere comunque costretto a vendere azioni per tutto quel tempo, perché i delta nel book stanno decadendo silenziosamente e la copertura deve ridursi di conseguenza. Su una chain con molte 0DTE, questo flusso si concentra violentemente nell'ultima ora, quando il tasso di decadimento raggiunge il picco. [Charm: l'orologio è un trader](/education/charm-the-clock-is-a-trader) offre la trattazione completa.

---

## Vanna: il delta si muove perché la paura si è mossa

Il vanna è la sensibilità del delta alla volatilità implicita. Aumentare la paura prezzata dal mercato fa ingrassare la distribuzione degli esiti possibili, tirando verso il centro i delta fuori dal denaro; abbassarla affina la distribuzione, spingendoli di nuovo verso il loro valore intrinseco di 0 o 1. Quindi un cambiamento della vol riprezza il delta di ogni opzione senza che lo spot si muova di un centesimo.

Il vanna misura la sensibilità del delta alla volatilità implicita. Secondo la convenzione di inventario modellata, un calo della IV può creare pressione in acquisto sul sottostante in alcune configurazioni della chain, ma il segno dipende da chi detiene le opzioni, dal tipo di opzione, dalla moneyness, dalla scadenza, dallo skew e dal movimento della superficie. [Vanna: come il calo della IV può cambiare la copertura dei dealer](/education/vanna-when-fear-fades) illustra il meccanismo condizionale.

---

## Perché non si possono semplicemente sommare

Una scorciatoia allettante: calcolare il flusso di ogni greca separatamente e sommarli. Flusso da gamma più flusso da charm più flusso da vanna è uguale al flusso forzato totale. È una buona prima approssimazione e una pessima risposta finale, perché i tre figli interagiscono tra loro.

Lo stesso gamma cambia mentre il tempo passa e mentre la vol si sposta. Il charm che si ha al prezzo spot odierno non è il charm che si ha dopo un movimento del 2%. Uno scenario che combina un movimento dello spot, un pomeriggio di decadimento e un calo della vol non è la somma dei tre effetti calcolati isolatamente - i termini incrociati sono reali e, vicino alla scadenza, importanti. Sommare le greche è uno sviluppo di Taylor, e gli sviluppi di Taylor si sgretolano esattamente dove è concentrata l'azione: vicino al denaro, vicino alla scadenza, dove la superficie si curva di più.

Il modo onesto di calcolare il flusso forzato è **riprezzare completamente il book** nel nuovo scenario, leggere il delta del dealer in quel nuovo stato e calcolare la differenza rispetto al delta attuale. Le greche diventano quindi utili per l'*attribuzione* - dire quanta parte dell'operazione obbligata era gamma, quanta charm e quanta vanna - ma il totale deriva dal riprezzamento, non dalla somma. È esattamente ciò che fa la curva di riprezzamento in tempo reale [Forced Flow](/forced-flow): sposta lo spot lungo una griglia, riprezza ogni contratto e legge direttamente la copertura obbligata. La ripartizione gamma/charm/vanna è disegnata come bande di attribuzione sottostanti, così si vede sia il totale sia quale figlio lo sta guidando.

---

## La versione in una frase

Il delta è un hedge ratio che non vuole stare fermo. Si muove con il prezzo (gamma), con il tempo (charm) e con la volatilità (vanna) - i tre input che si muovono in continuazione e guidano la maggior parte del flusso. La maggior parte delle operazioni forzate dei dealer sul mercato è una di queste tre sensibilità che tira il book fuori dalla sua copertura ed esige un'operazione sull'azione per riportarlo in equilibrio, mentre tassi, dividendi e il ricambio del book stesso completano il quadro ai margini.

Impara il genitore e i tre figli, e il flusso dealer smette di essere un mistero e diventa un problema di contabilità. Per le fondamenta di tutta questa idea, vedi [Perché i market maker sono costretti a scambiare azioni](/education/why-market-makers-trade-stock).

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.
