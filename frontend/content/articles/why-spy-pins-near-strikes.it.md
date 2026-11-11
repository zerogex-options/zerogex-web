# Perché SPY si ancora vicino a uno strike? Il pinning delle opzioni spiegato

*Perché SPY si ancora vicino a strike specifici - soprattutto il venerdì e verso la chiusura? Raramente è una coincidenza. Il pinning delle opzioni spiegato: il meccanismo modellato di hedging dei dealer che può attrarre il prezzo verso uno strike, perché tende a essere più forte in occasione dell'OPEX e a fine giornata, e come capire se è probabile che il tape di oggi si ancori.*

---

## Il pinning non è superstizione

Se fai trading regolarmente su opzioni settimanali SPY, l'hai già visto accadere: SPY deriva verso uno strike a numero tondo - 580, 583, 585 - e il venerdì pomeriggio resta lì, oscillando in un intervallo di 30 centesimi, senza volersene andare. Succede lo stesso intorno alle scadenze trimestrali e nell'OPEX mensile. Succede anche in molti mercoledì e giovedì normali, quando la catena 0DTE è particolarmente carica.

Molti trader trattano il pinning come un fenomeno basato sul "sentire" - "il mercato sa dove vuole assestarsi" - oppure lo attribuiscono a pattern grafici. Sotto c'è una storia più concreta: l'hedging modellato dei dealer sugli strike a gamma elevata può generare flussi che tendono a riportare il prezzo verso lo strike, insieme ad altri fattori come liquidità, posizionamento e meccaniche di scadenza. Una volta che riesci a vedere il meccanismo, puoi anche valutare quando è più probabile che sia operativo oggi e quando no.

Questo articolo ripercorre la meccanica reale del pinning, perché si intensifica vicino alla scadenza, i due tipi di pin che la maggior parte dei trader confonde, le condizioni strutturali che rendono la giornata odierna un "pin day", i cinque segnali che indicano che un pin è in atto in questo momento e il playbook che un tape pinnato premia. Per la discussione correlata sul max pain, vedi [Max Pain spiegato](/education/max-pain-explained).

---

## Il meccanismo di hedging dei dealer dietro il pinning

Il meccanismo è più facile da vedere una volta scritto per esteso - tenendo presente che è un modello del comportamento dei dealer, non qualcosa che puoi leggere direttamente dal tape:

1. Uno strike specifico - diciamo SPY 583 - porta una grande concentrazione di gamma. Secondo il modello di posizionamento standard, si assume che il book dei dealer sia **long** su quel gamma. (Una grande concentrazione da sola non lo dimostra - l'open interest mostra quanti contratti sono aperti, non chi è long o short - ma è l'ipotesi di lavoro quando le call dominano lo strike.)
2. Se il book dei dealer è long gamma su quello strike, l'hedging spinge *contro* i movimenti che se ne allontanano - il riflesso stabilizzante che tende ad ancorare il prezzo. (È il regime di gamma positivo che si manifesta su un singolo strike dominante.)
3. Quando SPY sale attraverso 583, il delta di copertura modellato diventa positivo, quindi per rimanere neutrali i dealer tendono a **vendere** SPY.
4. Quando SPY scende attraverso 583, il delta di copertura modellato diventa negativo, quindi per rimanere neutrali i dealer tendono a **comprare** SPY.
5. Ogni escursione lontano da 583 richiama un trade di copertura *di ritorno verso* 583. Lo strike può agire come un magnete - non perché qualcuno lo stia prendendo di mira, ma perché, secondo il modello, la matematica dell'hedging fa pendere il prezzo di nuovo da quella parte.

Questa è una lettura plausibile di ciò che accade quando vedi SPY oscillare in un range stretto: il book aggregato dei dealer che si corregge verso la neutralità a ogni movimento. Raramente è l'unica cosa in gioco - anche liquidità, comportamento dei trader e meccaniche di scadenza contribuiscono - ma spesso è una di quelle dominanti.

---

## Perché il pinning si intensifica vicino alla scadenza

Il meccanismo sopra descritto si applica a qualsiasi opzione - ma la *forza* del pin dipende dalla grandezza del gamma su quello strike. Due fattori rendono quella grandezza enorme vicino alla scadenza:

### Il gamma scala con 1/√T

Il gamma per contratto di opzione è approssimativamente inversamente proporzionale alla radice quadrata del tempo alla scadenza. Il gamma at-the-money di un'opzione 0DTE è circa 5× quello di un'opzione allo stesso strike con 5 giorni alla scadenza, e di ordini di grandezza superiore a quello di una mensile. Più ci si avvicina alla scadenza, maggiore è il gamma per contratto - e maggiore è il trade di copertura richiesto per ogni tick di prezzo.

Uno strike 0DTE attorno a cui tutti sono posizionati può comportarsi come un buco nero per lo spot. I dealer potrebbero dover muovere quantità molto grandi di sottostante per variazioni di prezzo molto piccole, quindi il pinning può diventare la via di minor resistenza.

### L'open interest si concentra sugli strike a numero tondo

Il mercato concentra strutturalmente l'open interest sui numeri tondi - 580, 583, 585 su SPY, 5800, 5810 su SPX. Il venerdì pomeriggio, la concentrazione di gamma su uno o due di quegli strike può dominare il resto della catena messa insieme. Quel dominio a strike singolo è una parte importante del "magnetismo" visibile che i trader percepiscono in chiusura.

Combina i due fattori - tempo residuo breve alla scadenza + OI concentrato sugli strike tondi - e i pin del venerdì pomeriggio diventano strutturalmente più probabili. Il mercoledì e il lunedì presentano versioni più deboli dello stesso schema, man mano che il flusso 0DTE continua a crescere.

---

## Due tipi di pin - e non sono la stessa cosa

Una fonte comune di confusione: **max pain** contro il **magnete di gamma**. Entrambi vengono chiamati "il pin", ma vengono calcolati in modo diverso e possono essere in disaccordo.

### Max pain

Il max pain è lo strike al quale il payout totale dei detentori di opzioni sarebbe minimizzato alla scadenza. È un calcolo di geometria del payoff - pura matematica del valore intrinseco. Indica lo strike "strutturalmente favorevole" per chi scrive opzioni.

### Magnete di gamma

Il magnete di gamma è lo strike con la maggiore concentrazione assoluta di gamma dei dealer - lo strike dove l'hedging forzato è più intenso. È una lettura del flusso di copertura.

Quando i due strike coincidono, la tesi del pin tende a essere al suo massimo di forza. Quando sono in disaccordo, ZeroGEX si appoggia al magnete di gamma, perché corrisponde al flusso di copertura modellato anziché alla sola geometria del payoff - ma è un'inclinazione, non una regola, e quale lettura conti di più dipende dal segno modellato del gamma dei dealer e dal flusso circostante.

[Max Pain spiegato](/education/max-pain-explained) approfondisce questa distinzione ed è onesto su quanto spesso il solo max pain tragga in inganno.

---

## Quando il pin tiene

Le condizioni strutturali che rendono la giornata odierna un pin day:

- **Regime a gamma positivo.** Spot sopra il gamma flip modellato; Net GEX chiaramente positivo. Senza questo, il riflesso di hedging modellato può invertirsi, e lo stesso strike può rilasciare il prezzo invece di attrarlo.
- **Forte concentrazione di strike vicino allo spot.** Il magnete di gamma si trova vicino al prezzo - ZeroGEX considera "vicino" circa lo 0,3-0,5%, anche se quella banda è un'euristica interna, non uno standard di settore. I magneti lontani dallo spot tendono ad agire più come target che come pin attivi.
- **Max pain e magnete di gamma concordano.** Entrambi indicano lo stesso livello. Amplifica la trazione strutturale.
- **Catena dominata dalla scadenza.** Le opzioni 0DTE/settimanali portano la maggior parte del gamma. Le catene dominate dal mensile ancorano in modo molto meno affidabile.
- **Calendario dei catalizzatori tranquillo.** Nessun dato macro importante o evento di banca centrale durante la seduta.
- **Volatilità realizzata in compressione.** Il tape mostra il riflesso smorzante dei dealer in funzione.

Quando la maggior parte di queste condizioni si allinea, il pin ha una probabilità strutturale a suo favore.

---

## Quando il pin si rompe

Il pin si scioglie quando:

- **Avviene l'incrocio del gamma flip.** Lo spot scende sotto il flip modellato; attraversarlo suggerisce che la tendenza aggregata di hedging del modello abbia cambiato segno, quindi lo stesso magnete può iniziare a rilasciare il prezzo invece di attrarlo.
- **Arriva un catalizzatore.** CPI, FOMC, NFP, shock su un singolo titolo. Il flusso macro sovrasta il riflesso dei dealer.
- **Il Net GEX decade in modo significativo.** Il gamma vicino alla scadenza si sta rivalutando: il gamma ATM può aumentare, mentre quello decisamente ITM o OTM tende a zero. L'aggregato può rafforzarsi o indebolirsi.
- **Il magnete migra.** L'open interest confermato viene generalmente pubblicato per la sessione successiva, ma il magnete modellato può comunque spostarsi durante la seduta al variare di spot, gamma, tempo e IV - o man mano che un posizionamento intraday dedotto si costruisce su uno strike diverso - spostando il target altrove.
- **Lo skew si sposta.** Un forte bid sulle put (paura) può ribaltare il segno del book dei dealer anche sullo stesso strike.

Un pin che regge da due ore è più duraturo di uno appena formato, ma nessun pin dura indefinitamente. Le condizioni che lo sostenevano devono continuare a reggere perché il pin resti in piedi.

---

## Leggere il pin in tempo reale

Un breve flusso di lavoro:

1. **Identifica lo strike a gamma più pesante vicino allo spot.** È il candidato magnete.
2. **Controlla il Net GEX.** È un dato modellato - gamma dei dealer stimato secondo la convenzione tradizionale call-positive/put-negative sull'open interest, non inventario osservato dei dealer. Un valore positivo sostanziale è la condizione che sostiene il pin; letture negative o vicine a zero depongono contro.
3. **Controlla il gamma flip.** Lo spot deve trovarsi sopra. Se il flip è esattamente allo spot, la situazione è contesa - il pin potrebbe formarsi, o no.
4. **Verifica incrociata con il max pain.** Stesso strike o entro ~0,3% dal magnete (un'euristica ZeroGEX) → tesi del pin più netta. Sostanzialmente diverso → tesi più debole; ZeroGEX si appoggia al magnete, perché corrisponde al flusso di copertura modellato.
5. **Leggi l'orario della giornata.** Prima di mezzogiorno ET, il charm non si è ancora accumulato abbastanza da guidare il pin con forza. Dopo le 14:00 ET, la trazione si intensifica. Dopo le 15:30 ET, dominano le dinamiche della finestra di chiusura.

---

## Come capire se lo SPY è pinnato: i cinque segnali

Riconoscere un pin in tempo reale si riduce a cinque segnali strutturali. Più se ne allineano, più netto è il pin.

**1. Il Net GEX è significativamente positivo (regime long-gamma).** Spot sopra il gamma flip e Net GEX chiaramente positivo. (Il Net GEX è gamma dei dealer stimato secondo la convenzione tradizionale call-positive/put-negative sull'open interest - un modello, non inventario osservato.) ZeroGEX considera "sostanziale" su scala SPY circa 500 milioni di $ o più, ma è un'euristica interna - la magnitudine conta più di qualsiasi cifra specifica. Un Net GEX negativo o vicino a zero depone contro il pin.

**2. Max pain e magnete di gamma concordano vicino allo spot.** Quando entrambi indicano lo stesso livello e questo si trova entro circa lo 0,3% dallo spot, la trazione strutturale è al massimo. Quando divergono, ZeroGEX si appoggia al magnete di gamma - corrisponde al meccanismo di copertura modellato, mentre il max pain è geometria dei payoff.

**3. Lo spot oscilla attorno al magnete da un'ora.** Grafica lo SPY contro lo strike del magnete di gamma sul timeframe a 5 minuti. Tre o più attraversamenti negli ultimi 60 minuti, con ogni escursione più piccola, suggerisce un pin in formazione. Una deriva costante che si allontana dal magnete depone contro - quella è una direzione, non un range.

**4. La volatilità realizzata si è compressa sotto l'implicita.** La copertura in gamma lungo smorza la volatilità realizzata, quindi un pin che funziona si vede come realizzata sotto l'implicita. Se la realizzata si espande, il pin non tiene - il book viene travolto da altro flusso.

**5. L'EOD Pressure è vicino a zero nella finestra attiva.** Dopo le 14:30 ET, una lettura di EOD Pressure vicina a zero (circa −0,20/+0,20) è una firma modellata di pin - i termini di charm e di gravità del pin si annullano in buona parte perché il prezzo sta sul magnete. Una lettura ampia significa che il prezzo è *lontano* dal magnete. Vedi [Segnale EOD Pressure spiegato](/education/eod-pressure-explained).

---

## Il playbook per un tape pinnato

Quando la maggior parte dei cinque segnali si allinea, il playbook è contrarian e semplice:

- **Sì: opera contro gli estremi del range di compressione.** La trazione strutturale riporta verso il magnete, quindi vendere gli allunghi vicino al massimo del range e comprare i ribassi vicino al minimo è l'unico assetto in cui il riflesso del dealer è dalla tua parte. Size piccola - i pin sono probabilistici, non garantiti.
- **No: inseguire il centro.** Al centro sta il magnete; comprare o vendere lì significa combattere il livello verso cui il prezzo tenta strutturalmente di tornare. È da qui che arriva la maggior parte delle perdite su un tape pinnato.
- **No: prendere assetti di momentum.** I playbook di breakout, espansione di volatilità e squeeze presuppongono che il movimento si estenda - l'opposto di un tape pinnato. Eseguire il playbook sbagliato è gran parte dell'errore.
- **Sì: riduci la size della posizione.** I range pinnati sono stretti e gli stop ancora di più; una size da giornata normale invita a essere stoppati prematuramente.

---

## Esempio pratico

SPY è a 582,95 in un venerdì pomeriggio. ZeroGEX mostra:

- **Net GEX:** +1,4 miliardi di $ (positivo - regime long-gamma)
- **Gamma Flip:** 581,20 (spot ben al di sopra)
- **Strike 0DTE più pesante:** 583,00 (praticamente allo spot)
- **Max Pain:** 583,00 (concorda con il magnete di gamma)
- **Orario:** 14:15 ET (accumulo di charm in avvio)

Ogni condizione strutturale per un pin è attiva. Il magnete si trova a 583; il max pain concorda a 583; il regime è long-gamma; siamo dentro la finestra attiva di fine giornata. La probabilità che SPY oscilli entro un range di circa 30 centesimi intorno a 583 fino alla chiusura è sensibilmente elevata.

Inclinazione pratica: un range stretto 582,70-583,30 è il percorso atteso. Le escursioni verso i bordi sono candidati per setup di fade. Il centro del range è territorio di non-trade. Size ridotta. Attenzione alle condizioni di rottura - soprattutto in caso di shock su un singolo titolo o headline inattese.

Ora immagina la stessa configurazione ma con Net GEX a −600 milioni di $ e gamma flip a 583,50 (spot sotto). La tesi del "pin" crolla. Stessa catena, stesso strike, lettura opposta - perché il regime modellato che determina se il magnete tende ad attrarre o a rilasciare ha cambiato segno.

---

## Fraintendimenti comuni

- **"Il pinning è solo psicologia."** Incentivi di payoff alla scadenza, hedging dei dealer, liquidità e comportamento dei trader possono tutti contribuire. I dati pubblici non possono isolare quanto un particolare meccanismo abbia causato un pin osservato.
- **"SPY si ancora sempre ai numeri tondi."** Quando il pinning si verifica, spesso coincide con un posizionamento concentrato. I numeri tondi sono comuni perché l'OI si raggruppa lì, ma l'OI da solo non dimostra la causa.
- **"Se il max pain è X, il prezzo chiuderà a X."** Spesso sbagliato. Il max pain è geometria del payoff, non una forza di hedging; il magnete di gamma modellato corrisponde più direttamente al flusso di copertura. Quando sono in disaccordo, ZeroGEX si appoggia al magnete.
- **"I pin sono rialzisti/ribassisti."** Nessuno dei due. Sono soppressori di volatilità. Range-bound. La direzione viene da altrove; il pin riguarda il *carattere dell'azione di prezzo*, non la direzione.
- **"Il pinning accade ogni venerdì."** Spesso, ma non sempre. Alcuni venerdì presentano catalizzatori, regimi short-gamma o magneti in migrazione che impediscono il pin. Leggere le condizioni conta.

---

## Da portare a casa

> SPY tende ad ancorarsi perché l'hedging modellato dei dealer sugli strike a gamma elevata può riportare il prezzo verso lo strike. La trazione modellata può essere usata come contesto quando le condizioni strutturali la supportano e la tratti come una probabilità, non come una certezza.

La disciplina consiste nel verificare le condizioni prima di dare per scontato che oggi sia un pin day. Regime long-gamma + strike pesante allo spot + accordo con il max pain + sessione avanzata fanno pendere le probabilità verso un pin netto. Il ribaltamento di uno qualsiasi di questi elementi indebolisce la lettura; il ribaltamento di tutti di fatto la annulla.

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere lo strike a gamma più pesante di oggi, il max pain, il gamma flip e il Net GEX - i quattro numeri che decidono se SPY si ancora oggi - la vista gratuita dei gamma-levels di ZeroGEX li mostra tutti.
