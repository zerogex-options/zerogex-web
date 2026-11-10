# Gamma / VWAP Confluence spiegato - e perché due simboli possono essere in disaccordo

*Cosa misura il punteggio di confluenza, come viene costruito il cluster, perché il regime di gamma ribalta lo stesso quadro da fade a breakout, e perché SPX, SPY e QQQ possono puntare in direzioni opposte nello stesso pomeriggio.*

---

## La domanda a cui risponde

Ogni livello di posizionamento dei dealer risponde a una domanda leggermente diversa. Il [gamma flip](/education/how-to-read-a-gamma-flip) segna il confine di regime. I [wall](/education/gamma-walls-explained) segnano un gamma concentrato su un solo lato. Il [max pain](/education/max-pain-explained) segna un magnete a scadenza. [Pin Strike](/education/pin-strike-explained) segna un attrattore raggiungibile entro la giornata. Il VWAP segna dove è stato effettivamente scambiato il volume della sessione.

Nella maggior parte dei giorni sono sparsi, e li leggi uno alla volta. Ogni tanto diversi livelli cadono nella stessa piccola fascia di prezzo - ed è una situazione diversa, perché livelli calcolati in modo indipendente che concordano sono più informativi di ciascuno di essi preso da solo.

Gamma / VWAP Confluence misura esattamente questo: **i livelli chiave si stanno accumulando qui, e cosa significa che il prezzo si trovi dove si trova rispetto a essi?**

È un punteggio da −100 a +100. Il segno è direzionale, la magnitudine esprime la fiducia, e il regime decide come leggere entrambi.

---

## Come viene costruito il cluster

Il cluster parte sempre da due membri: **il gamma flip e il VWAP**. Questi due sono il nucleo, ed è su di loro che è ancorata la "confluenza".

Altri tre livelli possono unirsi se sono abbastanza vicini - **max pain, max gamma (il GEX King) e call wall**. Ciascuno viene ammesso se si trova entro lo **0,15% dal punto medio tra il flip e il VWAP**. È un test stringente: su SPX a 7.700 corrisponde a circa 11 punti.

Quindi una card che mostra `Members: 2` significa che sono in gioco solo il flip e il VWAP. `Members: 4` significa che si sono aggiunti anche due dei livelli opzionali, e la zona è davvero affollata.

Il **livello di confluenza** è semplicemente la media dei membri che si sono qualificati. È il prezzo rispetto al quale viene misurato l'intero segnale.

Ogni membro in più oltre ai due del nucleo aggiunge il 15% alla magnitudine del punteggio. Quattro membri significano un moltiplicatore di 1,30× sulla stessa geometria - il modo del modello per dire che un accumulo di quattro livelli merita più attenzione di uno di due.

---

## Qualità: quanto è compatto il cluster?

L'appartenenza è una cosa; la compattezza un'altra. Il **gap del cluster** è la distanza tra il flip e il VWAP, in percentuale del prezzo, e determina la **qualità del cluster**:

```
cluster_quality = 1 − (cluster_gap % ÷ 1.0%)     floored at 0.05, capped at 1.00
```

Un flip e un VWAP distanti lo 0,1% danno una qualità vicina a 0,90. Un gap dello 0,6% dà circa 0,40. Qualsiasi valore oltre l'1,0% si ferma al minimo di 0,05.

Quel minimo conta, ed è voluto. Invece di dichiarare "nessuna confluenza" e restituire zero, il modello mantiene una lettura frazionaria, perché uno zero secco dovrebbe essere un estremo raro e non un output quotidiano. La conseguenza pratica: **quando la qualità è al minimo o vicina al minimo, il punteggio è minuscolo anche se il prezzo è lontano dal cluster.** Un punteggio di −5 non è un debole segnale ribassista: è il modello che ti dice che i due livelli di ancoraggio non sono affatto vicini e che non c'è un vero cluster da leggere.

La card lo dice direttamente. Sotto un punteggio di ±20 mostra **"No confluence edge"** invece di indicare una direzione.

---

## Il regime decide cosa significa il cluster

Questa è la parte che sorprende molti, ed è l'idea più importante di tutta la pagina.

Il punteggio parte da dove si trova il prezzo rispetto al cluster:

```
distance = (price − confluence level) ÷ price
```

Quella distanza è scalata in modo che circa **±0,3% saturi la lettura** - oltre quel punto, essere più lontani non aggiunge nulla, perché il modello non cerca di misurare quanto si è spinto il prezzo, ma solo da quale lato si trova e se ha preso una direzione netta.

Poi il [regime di gamma](/education/what-is-negative-gamma) decide cosa significa:

- **Gamma negativo → continuazione.** L'hedging dei dealer amplifica i movimenti. Ci si aspetta che il prezzo uscito dal cluster prosegua. Sopra il cluster la lettura è rialzista; sotto è ribassista.
- **Gamma positivo → mean reversion, e il segno si inverte.** L'hedging dei dealer smorza i movimenti. Ora lo stesso quadro sostiene che il prezzo venga riattirato *indietro* verso il cluster. Sopra il cluster la lettura è **ribassista**, perché il movimento atteso è verso il basso, in direzione del cluster. La lettura viene anche ridotta al 70% della sua magnitudine, perché un fade è un'affermazione più debole di un breakout.

Quindi la stessa identica disposizione dei livelli - stesso cluster, stesso lato, stessa distanza - produce **punteggi opposti** nei due regimi. Non è una contraddizione. È proprio questo il punto: in un regime il mercato si allontana dal livello, nell'altro vi ritorna.

---

## Perché SPX, SPY e QQQ possono essere in disaccordo

Questo deriva direttamente da quanto sopra, ed è la domanda che ha dato origine a questa pagina.

Due simboli possono produrre punteggi di confluenza opposti nello stesso pomeriggio, entrambi funzionando perfettamente, per due ragioni indipendenti.

**Primo, possono trovarsi in regimi di gamma diversi.** SPX e SPY seguono lo stesso indice ma hanno book di opzioni diversi, e QQQ è un indice del tutto diverso. Ciascuno ha il proprio gamma netto e il proprio flip. Se uno si trova in gamma negativo e un altro in positivo, il segno si inverte sull'uno e non sull'altro. Stesso tape, punteggi opposti.

**Secondo, ognuno ha il proprio cluster in una posizione propria.** Il livello di confluenza è costruito con il flip di quel simbolo, il VWAP di quel simbolo e i wall di quel simbolo. Questi non si trovano nella stessa posizione relativa da un simbolo all'altro. Il prezzo può trovarsi sopra il cluster di SPX e sotto quello di QQQ nello stesso momento, il che inverte di nuovo il segno.

Ciascuna delle due ragioni, da sola, ribalta la lettura. Che si presentino entrambe insieme è normale.

L'indicazione pratica: **non usare il punteggio di confluenza di un simbolo per fare trading su un altro.** Leggi il punteggio dello strumento su cui stai operando. Se vuoi un controllo incrociato tra simboli, confronta direttamente regimi e cluster invece di confrontare i punteggi, perché i punteggi incorporano già entrambi questi elementi.

---

## È una lettura live, non un bias di sessione

Il punteggio viene ricalcolato di continuo. Non è un'indicazione mattutina che resta valida fino alla chiusura.

Quando il prezzo attraversa il livello di confluenza, il segno si inverte - e poiché lo storico del punteggio è colorato in base al segno attuale, l'intera linea viene ridisegnata. Il percorso non è cambiato; è cambiato il suo colore. Uno storico che è stato verde per tutta la mattina e ora è rosso ti sta mostrando gli stessi dati con un nuovo segno.

Significa anche che il punteggio si aggiorna solo a mercato aperto. Una linea piatta fino a sera è l'ultimo valore memorizzato, non un segnale ancora attivo.

È un istinto ragionevole volere una lettura smussata, che persista per tutta la sessione e catturi inversioni più ampie. Questo la romperebbe. L'unico compito del segnale è dire cosa è vero *adesso*; una versione che mantenesse la propria opinione attraverso un cambio di regime ti parlerebbe di un mercato che non esiste più.

---

## Il target atteso

Ogni card pubblica un target atteso, che ha significati diversi a seconda del regime:

- **Mean reversion:** il target è il livello di confluenza stesso. La tesi è che il prezzo ritorni al cluster.
- **Continuazione:** il target è proiettato oltre il prezzo, al doppio della distanza che ha già percorso dal cluster. La tesi è che il movimento si estenda.

Due avvertenze oneste. Il target è geometrico - non varia in proporzione al punteggio, quindi anche una card a bassa fiducia può mostrare un target lontano. Leggilo insieme al punteggio e alla qualità, non da solo. E in continuazione è un'estrapolazione, non un livello misurato: nulla nel book di opzioni dice che il prezzo si fermi lì.

---

## Limiti onesti

**Il segno dei dealer è modellato, non osservato.** Come ovunque sulla piattaforma, se i dealer siano long o short su un contratto è una convenzione applicata all'open interest pubblico, non un fatto letto dal tape. Il regime che determina l'inversione di segno descritta sopra eredita questa ipotesi.

**Il cluster è aritmetica, non giudizio.** Il livello di confluenza è una semplice media dei membri qualificati. Non pondera un wall in base alla sua dimensione né un flip in base a quanto nettamente è stato individuato.

**Due membri sono il minimo, non una raccomandazione.** Ogni card ha almeno il flip e il VWAP, quindi `Members: 2` con un gap ampio è il modello che segnala un non-cluster, non che ne ha trovato uno. Controlla la qualità prima di leggere il segno.

**È una lettura del posizionamento, non una previsione.** Come ogni livello gamma, descrive cosa l'hedging *tende* a fare attorno a una struttura. Un catalizzatore lo travolge, e un livello rispettato per tutta la mattina smette di contare nel momento in cui arriva qualcosa di più grande.

---

## Leggerlo nella pratica

1. **Controlla prima qualità e membri.** Una qualità bassa significa che non c'è un cluster, qualunque cosa dica il segno. Sotto ±20 la card mostra "No confluence edge", e lo dice sul serio.
2. **Poi controlla il badge del regime.** Continuation e Mean Reversion sono trade opposti a partire dallo stesso quadro, e il badge ti dice quale dei due sta facendo il modello.
3. **Poi leggi il segno e il livello.** In mean reversion il livello di confluenza è la destinazione. In continuazione è ciò da cui il prezzo si sta allontanando.
4. **Leggilo simbolo per simbolo.** SPX, SPY e QQQ hanno ciascuno il proprio regime e il proprio cluster.

Puoi vedere il punteggio live, l'accumulo dei livelli e lo storico del punteggio sulla pagina [Gamma / VWAP Confluence](/gamma-vwap-confluence).
