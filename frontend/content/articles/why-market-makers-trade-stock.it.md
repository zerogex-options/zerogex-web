# Perché i market maker sono costretti a fare trading sull'azione

*Quando i market maker fanno trading sull'azione, spesso non è perché hanno una view direzionale. È perché il delta delle opzioni che detengono continua a cambiare — e mentre cambia, di norma devono aggiustare la copertura sul sottostante per restare quasi piatti. Quel flusso di copertura è una delle fonti di order flow strutturalmente più stimabili del mercato.*

> **In sintesi**
> Di norma i dealer non si coprono perché siano diventati rialzisti o ribassisti. Si coprono perché il rischio del loro portafoglio di opzioni è cambiato. Capire che cosa fa variare quel rischio aiuta a spiegare dove può comparire pressione di copertura sul mercato.

---

## Il lavoro del dealer è restare neutrale

Un market maker che vi vende una call di norma non sta cercando di esprimere una view ribassista. Vuole lo spread — i pochi centesimi tra bid e ask — e di norma vuole mantenere la propria esposizione direzionale vicino al neutro. Vendere la call lo lascia corto di delta, quindi compra azioni a fronte di quella posizione finché la posizione non è approssimativamente delta-neutrale. Questo è il delta-hedging, ed è una parte centrale del modello economico di un dealer di opzioni: immagazzinare l'opzione, neutralizzare la direzione, incassare l'edge.

Il problema è che "piatto" non è un punto a cui si arriva una volta sola. È un punto a cui il dealer torna di continuo, nel corso della seduta, perché il delta di un book di opzioni raramente sta fermo. Ed ecco la parte che conta per chi legge il flow: quando quel delta si muove, la copertura che ne deriva è di norma guidata dalla gestione del rischio più che da una view direzionale. Nessuna convinzione, nessuna scommessa sul mercato — il rischio del book è cambiato, quindi il dealer di norma deve aggiustare. *Quando* e *come* lo fa resta a sua discrezione. *Che* prima o poi debba operare per restare vicino alla sua copertura è la parte più stimabile.

Questa distinzione — guidato dal rischio contro discrezionale — è il motivo per cui l'hedging dei dealer è leggibile. Il flow discrezionale è un'ipotesi su cosa un trader *vuole* fare. Il flow di copertura è una stima di cosa un dealer avrà probabilmente *bisogno* di fare per restare quasi piatto. Uno dipende dall'intenzione del trader. L'altro è vincolato dalla meccanica del portafoglio.

---

## Il delta è un bersaglio mobile, non un numero

Il delta è il rapporto di copertura: quante azioni compensano un contratto di opzione. Una call con delta 0,40 si comporta, in questo momento, come 40 azioni long per contratto. Vendetene 100 e siete corti di 4.000 delta; comprate 4.000 azioni e siete piatti.

Ma 0,40 è una fotografia, non una costante. Quella stessa call avrà un delta diverso domani anche se l'azione non si muove mai, un delta diverso se la volatilità implicita scende, e un delta molto diverso se l'azione sale dell'1%. Il dealer si è coperto a 0,40. Non appena il delta deriva a 0,44, il book è corto di circa 400 delta che non aveva messo in conto, e il dealer di norma comprerà circa altre 400 azioni per riavvicinarsi a piatto.

Quindi la copertura sono in realtà due compiti, non uno. Prima il dealer neutralizza il livello *attuale* del delta del book — l'operazione unica che porta la posizione quasi a piatto. Poi arriva il compito continuo: man mano che nuove opzioni vengono scambiate e che lo spot, il tempo e la vol muovono quel delta, il dealer riequilibra per restare quasi piatto. La copertura iniziale viene stabilita quando la posizione viene aperta. Ciò che compare sul tape è il flusso infinito di re-hedging che insegue il delta mentre deriva. Capire cosa muove il delta significa capire da dove viene la pressione di copertura.

---

## Le azioni che il dealer già detiene vi dicono meno di quanto pensiate

Ecco una trappola da evitare fin da subito, perché affossa molte analisi ingenue del posizionamento dei dealer.

Si potrebbe pensare che il modo di valutare la pressione dei dealer sia sommare tutto il delta nel book — il delta di ogni contratto moltiplicato per il suo open interest — e chiamarlo "esposizione del dealer". Sembra corretto. È il naturale gemello della gamma exposure. Ma si appoggia su un'ipotesi nascosta, e per stimare la pressione di copertura futura spesso misura la cosa sbagliata.

Partiamo dall'ipotesi. L'open interest vi dice che un contratto esiste; non vi dice se un dealer è lungo o corto su di esso. Gli inventari dei dealer non sono divulgati pubblicamente in forma completa e in tempo reale, quindi qualsiasi cifra di "delta del dealer" va dedotta da un modello di chi probabilmente detiene cosa — una stima ragionevole, ma pur sempre una stima. Ammettiamo ora la stima e guardiamo cosa misuri davvero il *livello* di delta. Le azioni che un dealer detiene a fronte delle proprie opzioni hanno un delta esattamente pari a 1,00 ciascuna, messe in atto *specificamente per annullare* il delta dell'opzione. Per costruzione, il delta netto di un dealer ben coperto si colloca vicino allo zero — il delta dell'opzione e il delta dell'azione si compensano in larga parte. Quindi una cifra che somma il livello di delta delle opzioni descrive proprio l'esposizione che i dealer si sforzano di più di appianare, ignorando le azioni che detengono a fronte.

Ciò che il livello trascura è quanto quel delta sta per *muoversi*. L'azione ha un delta di 1 che non cambia, quindi una copertura statica in azioni non può neutralizzare le variazioni future del delta delle opzioni. La pressione di copertura futura viene dai cambiamenti del delta stimato del portafoglio del dealer, non dal sommare il delta che oggi si trova nel book. Quella deriva — la parte che una copertura statica in azioni non può assorbire del tutto in anticipo — è dove nasce gran parte del flusso di ricopertura. (Abbiamo scritto un intero articolo sul perché il numero del livello di delta sia una trappola e sul perché ci rifiutiamo di pubblicarlo — vedi [Perché non pubblichiamo il DEX](/education/why-we-dont-publish-dex).)

---

## Tre forze muovono il delta, e il dealer è esposto a tutte e tre

Tra ora e la scadenza, tre variabili dominano il modo in cui il delta di un book di opzioni si muove nell'intraday, e un dealer ha ben poco controllo su ciascuna di esse:

- **Prezzo spot.** Quando l'azione si muove, il delta di ogni opzione si muove con essa. La sensibilità del delta allo spot è il **gamma**. Questa è la componente reattiva — risponde quando il prezzo si muove, e il suo effetto può essere ampio e immediato.
- **Tempo.** Man mano che la scadenza si avvicina, il delta deriva anche con lo spot fermo: le opzioni out-of-the-money scivolano verso delta 0, quelle in-the-money salgono verso delta 1. La sensibilità del delta al tempo è il **charm**. Funziona in continuazione, che accada qualcosa o meno.
- **Volatilità implicita.** Quando la paura prezzata dal mercato sale o scende, il delta si sposta anche con lo spot perfettamente fermo. La sensibilità del delta alla vol è il **vanna**. Un reset della vol può muovere pesantemente il delta del book senza un solo tick di prezzo.

Prezzo, orologio e paura. Queste sono le tre grandi leve, e il dealer è esposto a tutte e tre. Quando una di esse si muove, trascina il delta del book fuori dal suo hedge e crea pressione per aggiustare la copertura in azioni. Non sono gli *unici* fattori — tassi d'interesse, dividendi, spostamenti della superficie di volatilità, ipotesi di finanziamento e nuovi trade di opzioni che entrano nel book muovono anch'essi il delta —, ma nell'intraday sono di norma di secondo ordine rispetto a spot, tempo e vol. L'effetto combinato è ciò che chiamiamo **Forced Flow**: una stima delle azioni che un dealer di norma dovrà comprare o vendere per restare coperto man mano che spot, tempo e vol evolvono.

---

## Quanto vale in dollari

L'astrazione diventa concreta nel momento in cui le si attribuisce una dimensione.

Diciamo che si stima che il book dei dealer su SPY sia posizionato in modo tale che un movimento dell'1% nel sottostante cambi il delta aggregato dei dealer di circa 1 milione di azioni. L'hedge è quel cambiamento di azioni moltiplicato per il prezzo dell'azione: a SPY $560, sono 1.000.000 × $560 ≈ **560 milioni di dollari**. Secondo le ipotesi del modello, ciò rappresenta circa 560 milioni di dollari di domanda di copertura potenziale — azioni che di norma dovrebbero cambiare mano per mantenere il book quasi piatto, prima ancora che un solo trader discrezionale si sia fatto un'opinione. In un regime di gamma corta, i dealer di norma comprano nella forza e vendono nella debolezza, così quel flusso tende a spingere *con* il movimento, ampliando il range. In un regime di gamma lunga, il dealer si oppone al movimento e lo comprime. Stesso meccanismo, segno opposto, un tape molto diverso.

Il charm e il vanna portano le proprie etichette in dollari. In una giornata 0DTE pesante, il solo decadimento temporale potrebbe implicare decine di milioni di azioni da coprire entro la chiusura — anche se la direzione dipende da come si stima che il book sia posizionato, e non solo dall'orologio. Un calo di due punti nella vol implicita dopo un dato CPI tranquillo potrebbe implicare una copertura di dimensioni simili; se questa si traduca in acquisti o in vendite dipende, di nuovo, dal segno del vanna stimato del book. Nulla di tutto ciò è una scommessa sul mercato. Tutto ciò è il book che viene riequilibrato per tornare verso piatto.

---

## Perché il Forced Flow è il flow che vale la pena leggere

Gran parte dell'order flow è una nebbia di intenzioni contrapposte. Qualcuno compra, qualcuno vende, e voi state indovinando il motivo. L'hedging dei dealer è diverso per natura: è un flusso persistente, plasmato dal posizionamento e dalle tre variabili sopra descritte più che dall'opinione di chiunque. Questo lo rende di norma più stimabile del flow discrezionale. Se lo spot si muove dell'1%, l'hedging legato al gamma tende a rispondere. Man mano che l'orologio si avvicina alla chiusura, l'hedging guidato dal charm tende ad accumularsi. Se la vol scende di due punti, può seguire una pressione di copertura legata al vanna — in una direzione fissata dal posizionamento stimato del book. La necessità di gestire il rischio è meccanica, anche se i tempi e l'esecuzione restano discrezionali.

Questo è ciò che il resto di questa serie approfondisce. [Il delta e i suoi tre figli](/education/delta-and-its-three-children) scompone gamma, charm e vanna come le tre derivate del delta. [Charm: l'orologio è un trader](/education/charm-the-clock-is-a-trader) mostra come il solo decadimento temporale possa alimentare un flow verso la chiusura stimabile e modellabile ore in anticipo. [Vanna: quando la paura svanisce, i dealer comprano](/education/vanna-when-fear-fades) spiega la spinta della compressione della vol. E la pagina live di [Forced Flow](/forced-flow) riprezza l'intero book sotto qualsiasi scenario di spot/tempo/vol, così potete vedere la pressione di copertura stimata prima che possa raggiungere il tape.

L'hedging dei dealer non è perfettamente prevedibile. Gli inventari non sono pubblici, il posizionamento va dedotto, e i tempi e l'esecuzione di qualsiasi copertura restano a discrezione del dealer.

Ma poiché è guidato dal rischio di portafoglio e non da un'opinione discrezionale, è una delle fonti di potenziale pressione in acquisto e in vendita strutturalmente più stimabili dei mercati moderni. Lo scopo di Forced Flow non è prevedere l'ordine esatto prima che venga stampato. È stimare dove l'hedging dei dealer può rafforzare, contrastare o spostare il movimento del mercato man mano che prezzo, tempo e volatilità evolvono.

Solo a scopo educativo — nessuno di quanto sopra è un consiglio di trading.
