# Vanna e Charm spiegati per i trader di opzioni

*Vanna e charm spiegati — cosa sono queste due greche, perché sono importanti per i flussi di hedging dei dealer, come vanna crea un bid persistente nei regimi di compressione della volatilità, come charm guida i flussi prevedibili verso la chiusura, e come interagiscono con il regime gamma.*

---

## Perché vale la pena capire vanna e charm

Se avete letto analisi sul posizionamento dei dealer, il gamma cattura la maggior parte dell'attenzione — con buone ragioni. È la greca del primo ordine che rappresenta la parte più consistente del flusso di hedging strutturale. Ma non è l'unica forza in gioco nel book dei dealer. Due greche del secondo ordine — **vanna** e **charm** — guidano silenziosamente una quota significativa dei flussi che si vedono sul tape, specialmente attorno ai reset di volatilità, all'OPEX e verso la chiusura della sessione cash.

La maggior parte dei trader che usa framework basati solo sul gamma legge correttamente il regime ma si perde le pressioni di secondo ordine al suo interno. Un regime di compressione della volatilità con un buying persistente guidato da vanna si comporta diversamente da uno senza. Una chain dominata da 0DTE verso la chiusura si comporta diversamente perché il decadimento di charm forza un ri-hedging continuo. Aggiungere vanna e charm alla lettura non sostituisce il framework gamma — lo affina.

Questo articolo spiega cosa sono queste due greche, perché interessano ai dealer, come i flussi si manifestano sul tape, e come interagiscono con il regime gamma. Per il framework strutturale di base, iniziate dal [pillar sulla Gamma Exposure](/education/gamma-exposure-explained); per la lettura del regime, vedere [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip); e per le letture specifiche sugli 0DTE, dove il decadimento di charm è più rumoroso, vedere [Posizionamento dei dealer sugli 0DTE spiegato](/education/0dte-dealer-positioning-explained).

---

## Cos'è vanna nelle opzioni?

Vanna è una greca del secondo ordine che misura la **sensibilità del delta di un'opzione ai cambiamenti della volatilità implicita**. In modo equivalente — ed è l'inquadramento più utile per l'analisi dei flussi dei dealer — misura la sensibilità del prezzo di un'opzione al movimento congiunto di spot e vol.

In simboli: vanna ≈ ∂Δ/∂σ = ∂²V/∂σ∂S. È la derivata incrociata del valore dell'opzione rispetto a spot e volatilità implicita.

Cosa significa in pratica: quando la volatilità implicita si muove, il delta della vostra opzione si muove *anche se lo spot resta fermo*. Un calo della IV riduce il delta delle call OTM e aumenta (in valore assoluto) il delta delle put OTM. Un rialzo della IV fa l'opposto. Chiunque gestisca un book di opzioni il cui delta si sposta al muoversi della vol deve coprire quello spostamento — ed è qui che vanna diventa un flusso visibile sul tape.

### Come i dealer vivono vanna

I dealer gestiscono book delta-neutral. Quando la IV scende, il delta del loro inventario si sposta, e devono negoziare il sottostante per riportare il book in neutralità. La direzione di quel trade dipende dalla composizione del loro book.

Lo schema canonico discusso nelle analisi di flusso:

- I dealer sono tipicamente short di call (i clienti sono net long).
- Quando la IV scende, il delta delle call OTM scende.
- Un dealer che era short di una call OTM con delta 0,30 potrebbe ora essere short della stessa call con delta 0,25.
- La loro esposizione short-delta si è ridotta — sono meccanicamente meno short sul sottostante.
- Per restare delta-neutral, devono *vendere* il sottostante — oppure, se detenevano sottostante long come copertura, ne vendono una parte.

Preso isolatamente, sembra ribassista. Il caso interessante è l'inverso: in un mercato dove la IV scende da giorni o settimane (un regime di compressione della volatilità), i dealer ri-coprono continuamente il decadimento di vanna su una chain fortemente sbilanciata verso posizioni di clienti long-call. L'aggregato di questi flussi tende a manifestarsi come un bid persistente e strutturale — il "vanna grind" di cui i desk di flusso scrivono da anni.

Il segno esatto dipende dalla composizione della chain. Un book dominato da put OTM short dei dealer si comporta diversamente da uno dominato da call OTM short dei dealer. L'analisi standard assume lo skew tipico di clienti long-call/long-put, che produce il risultato del vanna grind in compressione di volatilità. In regimi meno tipici, il segno può invertirsi.

---

## Cos'è charm nelle opzioni?

Charm è una greca del secondo ordine che misura la **sensibilità del delta di un'opzione al tempo**. Man mano che un'opzione si avvicina alla scadenza, il suo delta si sposta — le opzioni out-of-the-money decadono verso 0, le opzioni in-the-money si spostano verso 1 (per le call) o -1 (per le put).

In simboli: charm = ∂Δ/∂t.

L'intuizione: il delta di un'opzione è, grosso modo, la probabilità implicita dal mercato che scada in-the-money. Con il passare del tempo, quella probabilità deve convergere verso 0 o verso 1. Per le opzioni OTM quella probabilità decade verso 0; per le opzioni ITM sale verso 1. Più ci si avvicina alla scadenza, più veloce è lo spostamento.

### Come i dealer vivono charm

Come vanna, charm forza il ri-hedging senza alcun movimento dello spot. Un dealer che gestisce un book delta-neutral vede la propria esposizione delta effettiva spostarsi solo per il passare del tempo, e deve negoziare il sottostante per restare piatto.

Il segno direzionale del flusso di hedging guidato da charm dipende da quale lato del book domina. Per un tipico book dei dealer pesante di short-call tenuto fino alla chiusura su una chain 0DTE:

- I delta delle call OTM decadono verso 0.
- L'esposizione delta short-call del dealer si riduce in valore assoluto.
- Devono negoziare il sottostante per restare neutrali.
- Per una chain tipica, la direzione netta di quell'hedging continuo durante il pomeriggio produce spesso una deriva misurabile e stabile nel segno.

Quella deriva è ciò che la scuola di analisi dei flussi "EOD pressure" cerca di leggere. Il segnale esiste perché l'hedging guidato da charm è meccanicamente forzato — non richiede alcuna view, alcun volume, alcun flusso direzionale. Il tempo passa, i delta si muovono, i dealer si ri-coprono. La natura continua di quel flusso è ciò che lo rende leggibile.

---

## Perché vanna e charm contano per l'hedging dei dealer

L'inquadramento più pulito: il gamma è la forza di hedging *reattiva* — ciò che i dealer fanno quando il prezzo si muove. Vanna e charm sono le forze di hedging *non guidate dal prezzo* — ciò che i dealer fanno quando la vol si muove o il tempo passa, anche a spot fermo.

Una tipica timeline intraday illustra la differenza:

- Un movimento dello spot dello 0,2% forza l'hedging gamma — ampio e immediato.
- Un calo di 1 punto di volatilità nella IV durante la mattina forza l'hedging vanna — piccolo minuto per minuto ma persistente.
- Otto ore di decadimento temporale verso la chiusura forzano l'hedging charm — piccolo minuto per minuto ma cumulativamente significativo.

Tutte e tre avvengono contemporaneamente. In un tape tranquillo, il gamma è in gran parte silenzioso (movimenti piccoli), e vanna e charm diventano il flusso dominante. In un tape violento, il gamma domina e i flussi di secondo ordine sono rumore. La rilevanza di vanna e charm dipende dal regime di volatilità tanto quanto dal regime gamma.

---

## Flussi vanna nei regimi di compressione della volatilità

Il posto più pulito per vedere vanna sul tape è durante una compressione sostenuta della volatilità — tipicamente i giorni dopo un picco di volatilità che non ha prodotto il movimento realizzato prezzato dal mercato.

Il meccanismo:

1. La IV viene spinta al rialzo da un rischio percepito (CPI, FOMC, earnings).
2. Il rischio passa senza il movimento realizzato prezzato.
3. La IV inizia a scendere lungo tutta la chain.
4. La chain (il book dei dealer) ri-copre vanna continuamente durante il decadimento.
5. Per una chain tipica sbilanciata verso i clienti long-call, l'hedging aggregato è un bid persistente sul sottostante.

Il flusso è piccolo minuto per minuto e spesso invisibile a chi guarda le barre di volume. È più visibile sui grafici intraday come un trend rialzista lento in un tape tranquillo che non corrisponde al quadro dei volumi — le classiche sessioni "tutto sale senza volume" che seguono dati CPI privi di eventi.

Il flusso **non è direzionale nell'intento**. I dealer si coprono, non scommettono. Ma l'aggregato del ri-hedging meccanico si comporta in modo indistinguibile da un bid direzionale. Il carattere del tape risultante è il segnale rivelatore: deriva persistente a basso volume, bassa volatilità realizzata, nessun catalizzatore evidente.

Il vanna grind tende anche a *coesistere* con un regime a gamma positivo — entrambi gli effetti favoriscono le stesse condizioni di regime, e entrambi rafforzano il carattere assorbente e smorzante del tape. Questa coesistenza è parte del motivo per cui leggerli insieme è importante.

---

## Flussi charm verso la scadenza e verso la chiusura

Il posto più pulito per vedere charm sono gli ultimi 90 minuti della sessione cash in qualsiasi giornata con un flusso 0DTE significativo — che ormai è la norma per SPX.

Il meccanismo:

1. Le scadenze giornaliere dominano la chain vicino allo spot.
2. I loro delta decadono rapidamente man mano che ci si avvicina alla chiusura.
3. I dealer si ri-coprono continuamente dalla deriva.
4. Il segno direzionale dell'hedging aggregato è forzato dalla composizione della chain.
5. Il flusso tende ad *accelerare* durante il pomeriggio man mano che il tasso di charm aumenta.

Ecco perché gran parte dell'analisi sul posizionamento dei dealer si concentra specificamente sulla finestra del tardo pomeriggio. Il flusso charm è meccanicamente forzato, stabile nel segno per una data chain, e più visibile negli ultimi 60-90 minuti quando il tasso di decadimento del delta raggiunge il picco.

Uno schema comune: il flusso charm punta in una direzione, il magnete gamma si trova nella stessa direzione, e il tape realizzato si comprime verso la spinta strutturale. La lettura combinata — magnete gamma + direzione charm + rampa temporale — è ciò che produce i setup più puliti di "deriva verso la chiusura". Nessuno di questi è di per sé un segnale di trading; è un contesto di regime che dovrebbe cambiare il modo in cui si legge una sessione.

---

## Vanna e charm verso l'OPEX

L'OPEX mensile (terzo venerdì) e l'OPEX trimestrale (terzo venerdì di marzo, giugno, settembre, dicembre) concentrano entrambi gli effetti:

- **Il decadimento di charm è massimo** nell'ultima settimana prima della scadenza mensile, perché il gamma nel bucket in scadenza è massimo.
- **La sensibilità di vanna è alta** perché la chain è piena di opzioni in scadenza, con delta molto sensibili sia a spot che a vol.

Un tipico tape della settimana OPEX — per i regimi in cui si manifesta — mostra una deriva lenta verso gli strike pesanti da lunedì a mercoledì, con il flusso guidato da charm che accelera verso giovedì e venerdì. La vol tende a comprimersi durante la settimana. La lettura combinata vanna+charm produce spesso alcuni dei setup di "deriva strutturale" più puliti del calendario.

È anche qui che la tesi "vanna + charm verso l'OPEX" viene forzata oltre il suo meccanismo. Gli effetti sono reali e producono davvero flusso strutturale, ma non sono segnali. Sono condizioni di regime che *potrebbero* produrre deriva strutturale se il regime gamma la supporta. In un regime di gamma negativo profondo, le stesse condizioni della settimana OPEX possono produrre volatilità realizzata esplosiva invece che compressione.

---

## Come vanna e charm interagiscono con il regime gamma

L'inquadramento singolo più utile:

- **In un regime a gamma positivo**, i flussi vanna e charm rafforzano il carattere smorzante e favorevole al pin del tape. Il vanna grind sostiene la deriva, il decadimento di charm tira verso il magnete strutturale, e il riflesso assorbente dell'hedging long-gamma mantiene il range.
- **In un regime a gamma negativo**, i flussi vanna e charm possono amplificare il momentum direzionale invece di produrre deriva. Lo stesso decadimento di charm che fissava il prezzo in un regime long-gamma può contribuire a un selloff in short-gamma se il book dei dealer è posizionato in quel modo.

L'implicazione pratica: **leggete prima il gamma, poi leggete vanna e charm al suo interno.** Le greche del secondo ordine descrivono forze che esistono in ogni regime, ma il loro *effetto comportamentale* è filtrato dal riflesso gamma. Leggere vanna o charm senza leggere il gamma significa leggere solo metà del book.

---

## Come leggere vanna e charm durante la giornata

Un breve flusso di lavoro:

1. **Identificate prima il regime gamma.** Il gamma positivo sostiene le letture di deriva strutturale; il gamma negativo le inverte.
2. **Verificate se la vol si sta comprimendo.** Un decadimento della IV su più giorni durante la mattina è il setup che i flussi vanna tendono ad alimentare. Un picco di volatilità inverte la direzione del flusso.
3. **Osservate la finestra charm.** Gli ultimi 90 minuti sono il momento in cui charm è più rumoroso. Cercate l'accordo di segno tra la direzione di charm e il magnete gamma — entrambi che puntano nella stessa direzione è il setup più pulito.
4. **Verificate incrociando le date OPEX.** L'OPEX mensile e quello trimestrale concentrano entrambi i flussi. Trattateli come amplificatori di regime.
5. **Scontate nei giorni di picco di volatilità.** Quando la volatilità realizzata si espande, sia i flussi vanna sia quelli charm sono dominati dalle reazioni gamma. La lettura di secondo ordine diventa rumore.

La disciplina non è inseguire direttamente il vanna grind o la deriva charm — è usarli come contesto aggiuntivo che affina la lettura del gamma.

---

## Come ZeroGEX mostra vanna e charm

La dashboard tratta vanna e charm come overlay sulla lettura strutturale, non come segnali autonomi:

- **L'esposizione charm-at-spot** è uno degli input principali del segnale avanzato EOD Pressure, che stima la deriva direzionale verso la chiusura combinando i termini di charm e pin durante la finestra attiva.
- **I flussi vanna e charm** sono mostrati su pannelli dedicati che rivelano il flusso di hedging aggregato dei dealer per ciascuna greca lungo la chain.
- **Il grafico del profilo per strike** permette di vedere dove si concentrano insieme l'esposizione gamma, vanna e charm, che di solito è dove si trovano le letture combinate più pulite.

![Pannelli di flusso vanna e charm di ZeroGEX](/blog/zerogex-vanna-charm-flows.png)

Un esempio pratico. Supponiamo che SPX sia a 5.830 un venerdì pomeriggio, e la dashboard mostri:

- **Net GEX:** +1,4 miliardi di dollari
- **Gamma Flip:** 5.810
- **Strike Gamma più pesante:** 5.825
- **Charm-at-spot:** punta moderatamente al ribasso
- **Trend del flusso vanna durante la mattina:** coerente con una compressione della volatilità
- **Punteggio EOD Pressure:** −0,4 (attivato, lieve deriva ribassista)

La lettura composita: regime long-gamma, magnete strutturale appena sotto lo spot, decadimento di charm che punta nella stessa direzione, vanna grind coerente con il calo di volatilità della mattina. Inclinazione pratica verso la chiusura: una deriva verso il basso in direzione di 5.825 è il percorso a probabilità più alta, con il magnete gamma che assorbe il movimento e il decadimento di charm che conferma la direzione. Nulla di tutto ciò è un segnale di trading — è il contesto di regime composito per la sessione dell'ultima ora.

![Pannelli del punteggio EOD Pressure e charm-at-spot di ZeroGEX durante la finestra del tardo pomeriggio](/blog/zerogex-eod-pressure-charm.png)

---

## Fraintendimenti comuni su vanna e charm

Alcune trappole:

- **"Vanna è rialzista."** Non lo è. È il riflesso dei dealer ai movimenti della IV. Il segno direzionale di quel riflesso dipende dalla composizione della chain; in una chain tipica di clienti long-call durante la compressione della volatilità, l'*aggregato* tende a essere un bid — ma questa è un'affermazione di regime, non una proprietà della greca.
- **"Charm è un segnale."** Il flusso guidato da charm è una forza strutturale, non un trade. Produce una tendenza alla deriva nell'ultima ora; non vi dice quando entrare.
- **"Vanna e charm contano solo nella settimana OPEX."** Sono più rumorosi allora, ma il decadimento di charm conta ogni giorno con un flusso 0DTE significativo — che ormai è la maggior parte dei giorni.
- **"Il vanna grind funziona sempre in compressione della volatilità."** Solo quando la composizione della chain lo supporta e il regime gamma non lo contrasta.
- **"L'hedging da charm svanisce dopo la chiusura."** È vero — ma il flusso è già avvenuto entro quel momento. Il punto è leggerlo durante la finestra attiva, non dopo.

---

## Conclusione

> Il gamma è la forza di hedging reattiva. Vanna e charm sono le forze di hedging non guidate dal prezzo — ciò che i dealer fanno quando la vol si muove o il tempo passa, anche a spot fermo.

Le greche del secondo ordine descrivono flussi reali nel book dei dealer che la lettura del primo ordine da sola non coglie. Producono il grind persistente in compressione di volatilità, la spinta strutturale verso la chiusura nelle giornate ricche di 0DTE, e la deriva della settimana OPEX verso gli strike pesanti — quando, e solo quando, il regime gamma le supporta.

Aggiungeteli alla lettura. Non guidate la lettura con essi.

Solo a scopo educativo — nulla di quanto sopra è una raccomandazione di trading.

---

Se volete vedere in tempo reale i flussi vanna e charm di oggi, insieme al regime gamma che determina se produrranno deriva o verranno sopraffatti, la dashboard gratuita di ZeroGEX mostra tutto questo.
