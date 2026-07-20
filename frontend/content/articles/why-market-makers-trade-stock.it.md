# Perché i market maker sono costretti a fare trading sull'azione

*I market maker non fanno trading sull'azione perché hanno una view. Lo fanno perché il delta delle opzioni che detengono continua a muoversi da solo — e ogni volta che si muove, sono meccanicamente obbligati a scambiare il sottostante per restare piatti. Quel flusso forzato è l'order flow più prevedibile del mercato.*

---

## Il lavoro del dealer è non avere opinioni

Un market maker che vi vende una call non vuole essere corto sul mercato. Vuole lo spread — i pochi centesimi tra bid e ask — e vuole tornare a casa piatto. Vendere la call lo ha lasciato corto di delta, quindi compra azioni a fronte di quella posizione finché non ha più esposizione direzionale netta. Questo è il delta-hedging, ed è l'intero modello economico di un dealer di opzioni: immagazzinare l'opzione, neutralizzare la direzione, incassare l'edge.

Il problema è che "piatto" non è un punto a cui si arriva una volta sola. È un punto a cui bisogna tornare continuamente, tutto il giorno, ogni giorno, perché il delta di un book di opzioni si rifiuta di stare fermo. Ed ecco la parte che conta per chi legge il flow: quando quel delta si muove, il dealer non *sceglie* di scambiare il sottostante. Ci è *costretto*. Il trade non porta con sé alcuna view, nessuna convinzione, nessuna discrezionalità. Il delta si è mosso, quindi l'azione viene comprata o venduta. Punto.

Questa distinzione — forzato contro discrezionale — è il motivo per cui l'hedging dei dealer è leggibile. Il flow discrezionale è un'ipotesi su cosa farà un trader. Il flow forzato è un calcolo di cosa un dealer *deve* fare. Uno è un lancio di moneta. L'altro è aritmetica.

---

## Il delta è un bersaglio mobile, non un numero

Il delta è il rapporto di copertura: quante azioni compensano un contratto di opzione. Una call con delta 0,40 si comporta, in questo momento, come 40 azioni long per contratto. Vendetene 100 e siete corti di 4.000 delta; comprate 4.000 azioni e siete piatti.

Ma 0,40 è una fotografia, non una costante. Quella stessa call avrà un delta diverso domani anche se l'azione non si muove mai, un delta diverso se la volatilità implicita scende, e un delta molto diverso se l'azione sale dell'1%. Il dealer si è coperto a 0,40. Nel momento in cui il delta deriva a 0,44, è corto di 400 delta che non aveva messo in conto, e deve comprare altre 400 azioni per tornare piatto.

Quindi il dealer non sta mai davvero coprendo il delta. Sta coprendo la sua *variazione*. La copertura iniziale è gratuita — la si mette in atto una volta sola. Il flow, ciò che compare sul tape, è il flusso infinito di re-hedging che insegue il delta mentre si muove. Capire cosa muove il delta significa capire cosa forza il flow.

---

## Le azioni che il dealer già detiene non vi dicono nulla

Ecco una trappola da evitare fin da subito, perché affossa molte analisi ingenue del posizionamento dei dealer.

Si potrebbe pensare che il modo di misurare la pressione dei dealer sia sommare tutto il delta nel book — il delta di ogni contratto moltiplicato per il suo open interest — e chiamarlo "esposizione del dealer". Sembra corretto. È il naturale gemello della gamma exposure. Ma è anche quasi inutile, e il motivo è l'hedge azionario.

Le azioni che un dealer detiene a fronte delle proprie opzioni hanno un delta esattamente pari a 1,00 ciascuna. Quel delta azionario viene messo in atto *specificamente per annullare* il delta dell'opzione. Per costruzione, il delta netto di un dealer correttamente coperto è approssimativamente zero — il delta dell'opzione e il delta dell'azione si sommano a nulla. Questo è l'intero scopo dell'hedge. Quindi un numero che misura il *livello* di delta nel book sta misurando proprio quel greco che i dealer hanno già azzerato. Vi racconta di una posizione che, per costruzione, non ha più alcuna esposizione direzionale netta.

Ciò che non è zero — ciò che non può mai essere pre-coperto — è quanto quel delta sta per *muoversi*. L'azione ha un delta di 1 e non cambia mai. Non si può usare uno strumento a delta costante per pre-neutralizzare un delta che si sposta con lo spot, il tempo e la vol. Quel residuo, la deriva non pre-copribile del delta del book, è l'intera fonte del flow forzato. (Abbiamo scritto un intero articolo sul perché il numero del livello di delta sia una trappola e sul perché ci rifiutiamo di pubblicarlo — vedi [Perché non pubblichiamo il DEX](/education/why-we-dont-publish-dex).)

---

## Tre cose muovono il delta, e il dealer non ne controlla nessuna

Tra ora e la scadenza, esattamente tre variabili di stato muovono il delta di un book di opzioni, e un dealer non può influenzarne nemmeno una:

- **Prezzo spot.** Quando l'azione si muove, il delta di ogni opzione si muove con essa. La sensibilità del delta allo spot è il **gamma**. Questo è il flow reattivo — si attiva solo quando il prezzo si muove davvero, ed è ampio e immediato.
- **Tempo.** Man mano che la scadenza si avvicina, il delta deriva anche con lo spot fermo: le opzioni out-of-the-money scivolano verso delta 0, quelle in-the-money salgono verso delta 1. La sensibilità del delta al tempo è il **charm**. Funziona in continuazione, che accada qualcosa o meno.
- **Volatilità implicita.** Quando la paura prezzata dal mercato sale o scende, il delta si sposta anche con lo spot perfettamente fermo. La sensibilità del delta alla vol è il **vanna**. Un reset della vol può muovere pesantemente il delta del book senza un solo tick di prezzo.

Prezzo, orologio e paura. Queste sono le tre leve, e il dealer è legato a tutte e tre. Ognuna, quando si muove, trascina il delta del book fuori dal suo hedge e forza un trade sull'azione per riportarlo in equilibrio. Ecco perché chiamiamo l'output combinato **forced flow**: è l'ammontare in dollari di azioni che un dealer è meccanicamente obbligato a comprare o vendere man mano che spot, tempo e vol evolvono.

---

## Quanto vale in dollari

L'astrazione diventa concreta nel momento in cui le si attribuisce una dimensione.

Diciamo che il book dei dealer su SPY sia posizionato in modo tale che un movimento dell'1% nel sottostante cambi il delta aggregato dei dealer di circa 1 milione di azioni. L'hedge forzato è quel cambiamento di azioni moltiplicato per il prezzo dell'azione: a SPY $560, sono 1.000.000 × $560 ≈ **560 milioni di dollari** di azioni che devono cambiare mano solo per mantenere il book coperto — prima ancora che un solo trader discrezionale si sia fatto un'opinione. In un regime di gamma corta, il dealer compra nella forza e vende nella debolezza, e quei 560 milioni di dollari spingono *con* il movimento, ampliando il range. In un regime di gamma lunga, il dealer si oppone al movimento e lo comprime. Stesso meccanismo di forced flow, segno opposto, tape completamente diverso.

Il charm e il vanna portano le proprie etichette in dollari. Il solo decadimento temporale potrebbe forzare decine di milioni di azioni entro la chiusura in una giornata 0DTE pesante. Un calo di due punti nella vol implicita dopo un dato CPI tranquillo potrebbe forzare un ammontare simile di acquisti distribuiti nel pomeriggio. Nulla di tutto ciò è l'opinione di qualcuno. Tutto ciò è il book che insegue il proprio delta per tornare piatto.

---

## Perché il forced flow è il flow che vale la pena leggere

Gran parte dell'order flow è una nebbia di intenzioni contrapposte. Qualcuno compra, qualcuno vende, e voi state indovinando il motivo. Il forced flow dei dealer è diverso per natura: è l'unico flusso ampio e persistente nel mercato che sia interamente determinato dal posizionamento e dalle tre variabili sopra descritte. Non dovete indovinare se accadrà. Se lo spot si muove dell'1%, l'hedge di gamma si attiva. Se l'orologio arriva alle 16, il flow di charm si manifesta. Se la vol scende di due punti, segue l'hedge di vanna. Il flow è una conseguenza, non una decisione.

Questo è ciò che il resto di questa serie approfondisce. [Il delta e i suoi tre figli](/education/delta-and-its-three-children) scompone gamma, charm e vanna come le tre derivate del delta. [Charm: l'orologio è un trader](/education/charm-the-clock-is-a-trader) mostra come il solo decadimento temporale forzi un flow verso la chiusura prevedibile e calcolabile ore in anticipo. [Vanna: quando la paura svanisce, i dealer comprano](/education/vanna-when-fear-fades) spiega la spinta della compressione della vol. E la pagina live di [Forced Flow](/forced-flow) riprezza l'intero book sotto qualsiasi scenario di spot/tempo/vol, così potete vedere il trade obbligato prima ancora che venga stampato.

Il dealer non ha opinioni. Ed è esattamente per questo che il suo flow vale più della maggior parte delle opinioni.

Solo a scopo educativo — nessuno di quanto sopra è un consiglio di trading.
