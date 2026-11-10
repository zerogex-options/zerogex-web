# Quanto spesso si rompono davvero i gamma wall? Lo abbiamo misurato

*Tutti trattano il call wall come una resistenza e il put wall come un supporto. Quasi nessuno pubblica un numero. Abbiamo misurato 737 test di wall su SPY, SPX, QQQ e NDX - e la risposta si è rivelata dipendere da qualcosa che la maggior parte dei trader non controlla mai.*

---

## La domanda a cui nessuno risponde con un numero

Un utente di ZeroGEX ce l'ha chiesto senza giri di parole: c'era un grosso call wall, il prezzo lo aveva sfondato, e voleva sapere come valutare la probabilità che succedesse. Il suo istinto era che i wall di solito tengano. Il nostro era lo stesso. Nessuno di noi aveva una cifra.

È una lacuna strana per un livello su cui la gente fa trading ogni giorno. Così abbiamo costruito la misurazione.

Questo articolo è il risultato, comprese le parti che non hanno funzionato - che si sono rivelate la maggior parte, e che sono più utili di quelle che hanno funzionato.

---

## Come lo abbiamo misurato

Le definizioni contano più dei numeri, perché una definizione approssimativa produce una cifra sicura di sé che non significa nulla.

**Un test** è il prezzo che arriva entro 5 punti base dal wall in vigore in quel minuto. Non il wall di stamattina - i wall migrano, e il livello su cui stai operando è quello pubblicato in quel momento.

**Una rottura** è il prezzo che chiude oltre il wall, con un margine, per **dieci minuti consecutivi**. Quella è la soglia importante. I breakout falliti sforano regolarmente un livello e restano oltre per dieci o quindici minuti prima di rientrare. Una definizione che scatta al primo tick oltre il livello conta ognuno di questi come una rottura, e la probabilità che ne risulta non ha alcun significato.

**Una tenuta** è l'ora che trascorre senza quella conferma.

Altre due scelte che vale la pena dichiarare. I test arrivati alla campanella di chiusura prima di potersi risolvere sono conteggiati per il tempo in cui *abbiamo potuto* osservarli, invece di essere scartati - eliminarli sbilancerebbe il campione allontanandolo dal tape di fine sessione, che è proprio dove il gamma 0DTE è più pesante. E quaranta minuti di prezzo che macina su un wall contano come un'unica osservazione, non quaranta, perché è una sola la decisione che un trader si trova davanti.

Il campione: **737 test di wall, quattro prodotti su indici, dieci settimane (da fine giugno a inizio settembre 2026).**

---

## La risposta è una curva, non un numero

La prima cosa che hanno fatto i dati è stata rifiutarsi di darci una cifra unica.

"Se il wall si rompe" non è una domanda ben posta senza un orologio. Più a lungo osservi, più occasioni ci sono di rottura. Su SPX, gli stessi test hanno prodotto un tasso di rottura del 17,5% su un orizzonte di trenta minuti e del 30,7% su sessanta. Qualsiasi percentuale nuda e cruda è in realtà un'affermazione su una finestra temporale scelta da qualcuno.

Quindi la forma onesta è P(rottura entro *t* minuti dal test):

| entro | SPX | QQQ |
|---|---|---|
| 15 min | 7,6% | 12,3% |
| 30 min | 17,5% | 30,0% |
| 45 min | 26,8% | 40,6% |
| 60 min | **30,7%** | **50,1%** |

Leggi la riga che corrisponde al tuo periodo di detenzione. "Se si rompe" e "se si rompe prima che io debba uscire" sono domande diverse, e solo sulla seconda si può operare.

---

## È l'indice, non lo strumento

Ecco il risultato che non ci aspettavamo.

| prodotto | strike | indice | P(rottura entro 60 min) |
|---|---|---|---|
| SPY | 1 $ | S&P 500 | 31,1% |
| SPX | 5 $ | S&P 500 | 30,7% |
| QQQ | 1 $ | Nasdaq 100 | 50,1% |
| NDX | 25 $ | Nasdaq 100 | 46,8% |

**I wall dell'S&P hanno tenuto circa due volte su tre entro l'ora. Quelli del Nasdaq sono stati vicini a un lancio di moneta.**

Ora guarda le coppie. SPY e SPX sono statisticamente indistinguibili. QQQ e NDX sono indistinguibili. Ogni confronto S&P contro Nasdaq mostra una differenza, e non marginale.

Questo esclude la spiegazione che ritenevamo più probabile. Scale di strike più fitte distribuiscono l'open interest su più strike, quindi ogni singolo "wall" è una quota più piccola del book - una ragione puramente meccanica per cui i wall di QQQ potrebbero essere più deboli. Se fosse quello il fattore determinante, SPY (con strike da 1 $) si comporterebbe come QQQ. Non è così. Si comporta come SPX.

**Le probabilità di rottura di un wall sono una proprietà dell'indice sottostante, e non variano in base al mercato delle opzioni attraverso cui le osservi.** Una catena ETF con strike da 1 $ e una catena di indice con strike da 25 $ danno la stessa risposta per lo stesso sottostante.

La versione pratica: un call wall di QQQ è una struttura sensibilmente più debole di un call wall di SPX, e la differenza è di circa diciassette punti percentuali. Se applichi mentalmente un unico tasso di tenuta a tutti i prodotti, sbagli su almeno uno di essi.

Call wall e put wall, tra l'altro, si sono rotti con la stessa frequenza a ogni orizzonte e in ogni prodotto. Qualunque asimmetria esista tra loro, non sta in quanto spesso cedono.

---

## Cosa *non* ha previsto una rottura

Questa è la parte che merita la tua attenzione, perché è qui che ci sbagliavamo.

Abbiamo testato diciannove candidati - quelli a cui ricorrerebbe qualsiasi trader che segue il posizionamento dei dealer:

- la dimensione in dollari del wall, la sua quota del book e il suo percentile rispetto al proprio storico
- se il gamma del wall si stava **rafforzando o veniva consumato** mentre il prezzo vi premeva contro
- se il wall stava **migrando** davanti al prezzo
- il net GEX, la sua traiettoria, la distanza dal gamma flip, il lato del flip su cui si trovava il prezzo
- l'**order flow con segno sullo strike del wall stesso**, e se quel flusso stava accelerando
- da quanto tempo il wall era presente, quante volte era già stato testato, il momento della giornata, la volatilità realizzata

Un vero predittore dovrebbe puntare nella stessa direzione in ogni prodotto. Su tutti e quattro, **lo hanno fatto due variabili - e il solo caso ne produce 2,6.**

Al livello del caso o al di sotto. Dopo tre diversi approcci statistici, non è sopravvissuto nulla.

Abbiamo anche sbagliato un risultato nullo, nella direzione opposta. All'inizio, lavorando solo su SPX, avevamo detto che la dimensione del wall non portava alcuna informazione. Sui quattro prodotti punta coerentemente nella direzione intuitiva - wall più grande, meno rotture - solo troppo debolmente per distinguerla dal rumore. SPX era per caso l'unico campione in cui l'effetto spariva, e su quello avevamo costruito un'affermazione. L'affermazione onesta è *un piccolo effetto nella direzione attesa che questi dati non riescono a distinguere dal rumore* - non un risultato nullo, e non una scoperta.

---

## Allora come dovresti usare un wall?

**Come stima a priori, non come trigger.**

L'informazione strutturale in un gamma wall è reale. Solo che non si trova dove la maggior parte delle persone la cerca. Sta nel tasso di base dell'indice a cui il wall appartiene - S&P 500 o Nasdaq-100, qualunque sia il prodotto attraverso cui lo osservi - piuttosto che nel lato del flip in cui si trova il prezzo, o in qualche proprietà leggibile del singolo wall che hai davanti.

Questo cambia la prospettiva sul trade. Se stai fadando un call wall su SPX, stai scommettendo su un livello che in questo campione ha tenuto circa due volte su tre entro l'ora. È un tasso di base significativo, ed è anche una probabilità su tre di essere travolto. Su QQQ la stessa scommessa è vicina a un lancio di moneta. Sono scommesse diverse e meritano un dimensionamento diverso.

Ciò che questo **non** autorizza è trattare un wall come un livello che terrà. Nulla in dieci settimane di dati giustifica il leggere un wall specifico e concludere che questo è diverso.

---

## Cosa questo non dice

Quattro limiti onesti.

**Dieci settimane sono dieci settimane.** Un solo regime di volatilità, una sola estate. I tassi di base possono cambiare, e continueremo a misurarli.

**Questa è la probabilità di rottura *dato che il prezzo ha raggiunto il wall*.** È volutamente una domanda diversa dal chiedersi se il prezzo ci arrivi affatto. Condizionare sul test elimina il termine della distanza - e la distanza è il fattore principale che determina se un livello viene testato in primo luogo. È del tutto possibile che la maggior parte dell'informazione prevedibile stesse in "se verrà raggiunto", e che ciò che resta dopo l'arrivo sia, all'interno di un indice, vicino al caso. Questo sarebbe di per sé una scoperta.

**Il posizionamento dei dealer è modellato, non osservato.** I gamma wall derivano dalla convenzione standard call-positive/put-negative sull'open interest. In un giorno in cui i clienti erano net *compratori* delle opzioni dal lato del wall, quel wall non è mai stato una resistenza fin dall'inizio, e nessun monitoraggio te lo avrebbe detto. È un limite di ciò che i dati pubblici possono rivelare, ed è la ragione più probabile per cui un wall si rompe "inaspettatamente".

**"Nessuna variabile ha previsto la rottura" non equivale a "il GEX non funziona".** È un'affermazione su una specifica domanda condizionale, misurata in un modo specifico, su una finestra specifica.

---

## Come leggerlo su ZeroGEX

I livelli in sé si trovano sulle pagine gratuite dei livelli gamma per [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) e [NDX](/ndx-gamma-levels) - call wall, put wall, gamma flip e Net GEX fianco a fianco. Per la lettura live mentre i wall migrano nel corso della sessione, la [dashboard 0DTE in tempo reale](/real-time-gex-0dte) è quella da tenere d'occhio.

Abbina il livello al tasso di base del prodotto su cui stai operando, e a [come leggere un gamma flip](/education/how-to-read-a-gamma-flip) - qui il regime non ha cambiato la frequenza con cui i wall si sono rotti, ma decide se l'hedging modellato si oppone a un movimento o lo rafforza una volta che un wall cede. Il [pilastro sui gamma wall](/education/gamma-walls-explained) spiega cos'è un wall e perché si comporta così, e [perché i breakout falliscono](/education/why-do-breakouts-fail) tratta il meccanismo dalla direzione opposta.

---

## Conclusione

> Un gamma wall è un tasso di base, non una previsione. I wall dell'S&P hanno tenuto circa due volte su tre entro un'ora dal test; quelli del Nasdaq erano più vicini a un lancio di moneta - e non faceva alcuna differenza osservare l'ETF o l'indice. Delle diciannove cose che abbiamo misurato sui singoli wall, nessuna ci ha detto quali si sarebbero rotti. Opera sul wall come su una stima a priori con un tasso di successo noto, con un dimensionamento adatto al prodotto su cui ti trovi, e tratta con sospetto qualsiasi affermazione secondo cui *questo* wall è diverso.

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading, e nessuna cifra qui riportata è calibrata come segnale di trading.
