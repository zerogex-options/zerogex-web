# Perché non pubblichiamo il DEX

*Il Delta Exposure — DEX, la somma del delta di ogni contratto moltiplicato per il suo open interest — sembra il naturale gemello del gamma exposure. Noi ci rifiutiamo di pubblicarlo. Misura l'unico greek che i dealer hanno già coperto fino ad azzerarlo, concentra tutto il suo peso sugli strike dove i dati sono peggiori, ed è più rumoroso proprio dove il flusso forzato è più debole. Ecco il caso completo contro un numero che molti strumenti sono ben felici di venderti.*

---

## Il numero che sembra giusto e si legge male

Se il gamma exposure funziona, dovrebbe funzionare anche il delta exposure. Questa è l'intuizione, ed è il motivo per cui il "DEX" compare su una dashboard dopo l'altra, accanto al GEX come suo gemello. Prendi ogni opzione della catena, moltiplica il delta di ciascun contratto per il suo open interest, somma tutto, e ottieni un unico numero che presumibilmente ti dice come è orientato direzionalmente il book dei dealer. DEX positivo, i dealer sono long; DEX negativo, i dealer sono short. Pulito, simmetrico, vendibile.

È anche vicino all'irrilevante, e abbiamo preso presto la decisione di non mostrarlo a nessuno. Non perché sia difficile da calcolare — è banale da calcolare, ed è proprio questo il problema — ma perché il numero è sbagliato in tre modi indipendenti che si sommano tra loro. Uno solo di essi sarebbe già squalificante. Insieme, rendono il DEX non semplicemente poco informativo ma attivamente fuorviante, perché attira lo sguardo esattamente sulla parte sbagliata della catena.

Questo è l'articolo che più di tutti volevamo scrivere in questa serie, perché la disciplina del *non* pubblicare una metrica dall'aspetto plausibile vale più della maggior parte delle metriche che vengono effettivamente pubblicate.

---

## Primo colpo: i dealer hanno già coperto il delta fino ad azzerarlo

Il gamma exposure è significativo per un fatto specifico: **non puoi coprire il gamma con l'azione sottostante.** L'azione ha un delta di 1 e un gamma esattamente pari a zero. Un dealer che è short gamma per aver venduto opzioni non ha modo di neutralizzarlo con il sottostante — è costretto a portarselo dietro, ed è proprio quel gamma intrappolato a costringerlo a rincorrere il prezzo. Il GEX misura un'esposizione reale, non neutralizzata. Ecco perché muove i mercati.

Il delta è l'esatto opposto sotto ogni aspetto. Il delta è *precisamente* il greek che i dealer coprono con l'azione, perché l'azione è uno strumento a delta puro. È l'intero lavoro. Un dealer vende una call con delta 0,40, compra 40 azioni contro di essa, e il delta netto della posizione è zero. Fai lo stesso su tutto il book e il delta *netto* del dealer è, per costruzione, approssimativamente nullo. Il delta-hedging è la definizione stessa del mestiere.

Allora cosa misura davvero un aggregato Σ(Δ·OI)? Misura il delta delle *sole opzioni*, ignorando la montagna di azioni compensative che il dealer detiene contro di esse. È una gamba di una posizione a due gambe, riportata come se fosse l'intera posizione. L'altra gamba — la copertura in azioni che la annulla — è invisibile alla formula. Il DEX è un numero grande e drammatico proprio perché omette la copertura il cui unico scopo è renderlo piccolo.

Il GEX misura un'esposizione di cui i dealer *non possono* liberarsi. Il DEX misura l'unica esposizione di cui si sono già liberati. Questa asimmetria non è un dettaglio. È l'intera partita, ed è il motivo per cui i due numeri non sono affatto gemelli.

---

## Secondo colpo: il peso del delta vive dove i dati sono peggiori

Mettiamo da parte il problema della copertura e concediamo, per amor di discussione, di voler pesare la catena in base al delta. Guardiamo dove finisce quella massa di peso.

Il delta va da 0 a 1. È vicino a 0 per le opzioni molto out-of-the-money, attraversa 0,5 vicino al prezzo di mercato, e si avvicina a 1 per le opzioni molto in-the-money. Confrontalo con il gamma, che raggiunge il picco bruscamente at-the-money e scende verso zero in entrambe le ali. Pesare la catena per delta invece che per gamma fa una cosa specifica: trascina il centro di massa della metrica **verso il lato in-the-money** — e assegna un peso reale alla **coda profondamente in-the-money**, strike che una metrica pesata per gamma ignora correttamente perché il loro gamma è nullo.

Quella coda in-the-money è la parte peggiore della catena su cui appoggiare una metrica:

- Sono illiquide. Le opzioni deep-ITM praticamente non vengono scambiate.
- I loro spread sono ampi, quindi le loro quotazioni sono vecchie e inaffidabili.
- Il loro open interest è spesso datato, residuo di posizioni aperte molto tempo prima, rollate, o dimenticate — e l'open interest è l'input per cui il DEX moltiplica.

Nel frattempo, i tre greek che effettivamente guidano il flusso forzato — gamma, charm e vanna — raggiungono tutti il picco **vicino al prezzo di mercato**, dove le opzioni sono liquide, quotate strette, attivamente scambiate, e dove l'open interest riflette un posizionamento vivo. Il GEX trae il suo segnale dalla parte più pulita della catena. Il DEX trae il suo segnale dalla parte più sporca. Difficilmente si potrebbe progettare una metrica più perfettamente mirata al rumore.

---

## Terzo colpo: il delta non è dove si trova il flusso

Questo è il problema più profondo, ed è quello che lega insieme tutta la serie. **Il flusso forzato non deriva dal livello del delta. Deriva dalla variazione del delta.** Un dealer non scambia azioni perché il suo book ha delta; scambia azioni perché il delta del suo book *è cambiato*. (Questa è l'intera tesi di [Perché i market maker sono costretti a scambiare azioni](/education/why-market-makers-trade-stock).)

Ora chiediamoci quali strike generano quella variazione. Il delta si muove più velocemente dove gamma, charm e vanna sono maggiori — vicino al prezzo di mercato, vicino alla scadenza. Si muove appena nelle ali profonde. Una call deep-ITM con delta 0,98 ha un gamma prossimo a zero, un charm prossimo a zero, e una vanna prossima a zero. Il suo delta resterà grosso modo a 0,98 indipendentemente da cosa faranno spot, tempo o volatilità nelle prossime ore. Genera essenzialmente **nessun flusso di copertura.**

Eppure proprio quel contratto con delta 0,98, moltiplicato per il suo open interest, riversa quasi tutto il suo peso nel DEX. La metrica assegna la massima importanza allo strike che produce il minimo flusso. Applica questa logica a tutta la catena e scoprirai che il DEX è più rumoroso proprio dove il flusso forzato è più silenzioso, e più silenzioso — vicino al prezzo di mercato, dove il delta è un mediocre 0,5 — proprio dove il flusso forzato è più rumoroso. Il DEX non è semplicemente non correlato a ciò che interessa ai trader. È vicino a essere *anti*-correlato con esso. Punta sistematicamente lontano dagli strike che muovono il mercato.

Tre colpi. Una metrica che misura un'esposizione già coperta e piatta, la pesa verso i dati più sporchi della catena, e concentra il suo segnale esattamente dove non si genera alcun flusso. Non esiste una versione di quel numero che valga la pena mettere su uno schermo.

---

## Cosa pubblichiamo al suo posto

La soluzione non è una pesatura migliore del delta. È smettere di misurare il *livello* di qualcosa e iniziare a misurare la *transazione forzata*.

Il nostro motore [Forced Flow](/forced-flow) non somma Δ·OI. Imposta uno scenario — lo spot si muove di tanto, passa questo tempo, la volatilità implicita si sposta di questa quantità — e **riprezza l'intero book** in quel nuovo stato. Legge il delta del dealer dopo lo scenario, sottrae il delta attuale del dealer, e moltiplica la differenza per lo spot. Il risultato è una cifra in dollari: l'azione che i dealer sono meccanicamente costretti a comprare o vendere per rimanere coperti mentre il mondo cambia.

Quel numero è tutto ciò che il DEX non è:

- È un **flusso**, non un livello — misura la transazione forzata, che è ciò che effettivamente colpisce il mercato.
- È guidato da **gamma, charm e vanna**, che vivono vicino al prezzo di mercato, nella parte pulita, liquida e viva della catena.
- È dominato dagli strike che **generano** copertura, non dai contratti deep-ITM morti che non ne generano nessuna.
- Deriva da un **reprice completo**, quindi i termini incrociati tra spot, tempo e volatilità sono gestiti correttamente invece di essere approssimati via.

Poi suddividiamo quel totale in fasce di attribuzione per gamma, charm e vanna, così puoi vedere non solo quanto i dealer devono scambiare ma *perché*. Questo è un numero che significa qualcosa. Σ(Δ·OI) no.

---

## L'avvertenza onesta

Non stiamo affermando che il delta sia falso o che i dealer lo ignorino. Il delta è il greek più importante in qualsiasi singola opzione — è il rapporto di copertura, e coprirlo è l'intero mestiere del dealer. Né stiamo affermando che nessuno, da nessuna parte, possa estrarre nulla dai dati sul delta con sufficiente cura riguardo a liquidità e igiene dell'open interest.

L'affermazione è più circoscritta e, riteniamo, inattaccabile: un **aggregato Σ(Δ·OI), pubblicato come numero in evidenza accanto al GEX, non è un segnale scambiabile**, e presentarlo come il gemello simmetrico del GEX implica un parallelismo che non esiste. Il GEX si guadagna il suo posto perché il gamma non può essere coperto con l'azione, si concentra vicino al prezzo di mercato, e guida un flusso reale. Il DEX fallisce tutti e tre i test. Metterli fianco a fianco non ti dà due segnali. Ti dà un segnale e un numero che silenziosamente avvelena la lettura accanto ad esso.

---

## Perché l'omissione è il punto

Sarebbe facile aggiungere un riquadro DEX. Non costa nulla da calcolare, riempie spazio, corrisponde a quello che mostrano i concorrenti, e la maggior parte degli utenti non saprebbe mai che è vuoto. Proprio per questo lasciarlo fuori conta. Una dashboard è un insieme di affermazioni su cosa merita la tua attenzione. Ogni numero su di essa dice "questo vale la pena guardarlo." Non siamo disposti a fare questa affermazione su una metrica che misura un'esposizione già coperta e piatta, nei dati più sporchi della catena, esattamente dove non nasce alcun flusso.

Preferiamo pubblicare un numero che regge al controllo piuttosto che due numeri dove il secondo è decorazione. Il DEX è decorazione. Forced Flow è la transazione.

Per il meccanismo dietro l'alternativa, inizia con [Perché i market maker sono costretti a scambiare azioni](/education/why-market-makers-trade-stock) e [Il Delta e i suoi tre figli](/education/delta-and-its-three-children), poi apri la pagina live [Forced Flow](/forced-flow) e osserva la curva di reprice fare ciò che il DEX finge soltanto di fare.

Solo contenuto educativo — nulla di quanto sopra costituisce una raccomandazione di trading.
