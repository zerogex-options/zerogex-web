# Perché non pubblichiamo il DEX grezzo come segnale di flusso principale
> **Nota metodologica.** ZeroGEX stima, ma non osserva, l’inventario dei dealer dai dati pubblici. Il modello conserva la convenzione call-positive/put-negative (`Net GEX = Call GEX − Put GEX`): i dealer sono ipotizzati net long call e net short put. Call e put long hanno gamma positivo; call e put short hanno gamma negativo. Il Put Wall è la maggiore concentrazione di gamma put sotto lo spot e rappresenta localmente gamma dealer negativo: può coincidere con supporto, ma la copertura della put short non crea meccanicamente un pavimento. I wall possono migrare con spot, tempo e volatilità implicita anche quando l’open interest ufficiale non cambia intraday. Verso la scadenza il gamma si concentra vicino all’ATM: il gamma ATM può aumentare, mentre quello decisamente ITM o OTM tende a zero. Il Gamma Flip selezionato è un passaggio locale; il profilo può avere più passaggi o nessun passaggio significativo. Charm e vanna descrivono variazioni condizionali del delta, non ordini programmati. I punteggi sono output euristici, non probabilità calibrate. Il gamma negativo amplifica la direzione già in corso: la distanza da un target non implica repulsione, quindi l’inversione del termine pin di EOD Pressure resta un’euristica ZeroGEX. Max Pain minimizza il payout intrinseco aggregato, non massimizza esattamente il nozionale che scade senza valore. Il DEX grezzo misura delta delle sole opzioni, non il futuro flusso di copertura; premio e lato aggressore non provano informazione, apertura o convinzione.

*Che cosa misura il Delta Exposure calcolato sulle sole opzioni, che cosa omette e a che cosa può comunque servire.*

---

## L'obiezione, in senso stretto

Il DEX grezzo è una stima modellata dell'**esposizione in delta delle sole opzioni**, di solito riassunta come `Σ(delta × open interest × moltiplicatore del contratto)`. Può descrivere l'inventario direzionale ipotizzato della gamba in opzioni. Poiché esclude la copertura compensativa sul sottostante e misura un livello anziché una variazione, ZeroGEX non lo considera una stima affidabile in sé del futuro flusso di copertura dei dealer.

È un'affermazione più stretta rispetto a dire che il DEX non significa nulla. La proprietà effettiva dei dealer non è osservabile nell'open interest pubblico, quindi il DEX eredita anche qualsiasi convenzione di posizionamento applicata dal calcolo.

## Un livello non è un'operazione futura

Un dealer può compensare il delta delle opzioni con azioni, futures o altre opzioni, e può gestire il portafoglio aggregato all'interno di bande di copertura. Il DEX grezzo calcolato sulle sole opzioni omette quelle coperture. Ancora più importante: un livello di delta attuale non dice come il delta cambierà in seguito. Una domanda potenziale di copertura nasce quando spot, tempo, volatilità implicita, nuove operazioni o variazioni di posizione modificano il delta di portafoglio.

I contratti molto dentro il denaro possono contribuire pesantemente a un totale di delta calcolato sulle sole opzioni, perché il loro delta assoluto tende a uno. Non è un errore: fa parte della stima dell'inventario. Significa però che un totale grezzo elevato non identifica necessariamente gli strike con la maggiore sensibilità del delta nel breve termine. Gamma, charm e vanna hanno profili diversi per strike e per scadenza; non raggiungono tutti universalmente il massimo at the money.

## Usi legittimi del DEX

Con le sue assunzioni dichiarate chiaramente, il DEX può sostenere:

- stime modellate di inventario direzionale sulle sole opzioni;
- confronti della struttura della catena nel tempo;
- analisi di scenario; e
- una componente all'interno di un modello di portafoglio più ampio.

Non andrebbe rietichettato come posizione osservata dei dealer né come previsione del prossimo ordine sul sottostante.

## Perché ZeroGEX preferisce la rivalutazione per scenari

Il modello Forced Flow di ZeroGEX confronta il delta modellato di portafoglio adesso con il delta modellato sotto uno scenario definito di spot, tempo e volatilità. La differenza è una stima della pressione di copertura **potenziale**, condizionata all'inventario ipotizzato e allo scenario. Non è una prova che i dealer eseguiranno quell'importo: i portafogli possono contenere compensazioni, gli input possono muoversi insieme e i desk possono coprirsi con strumenti o tempistiche diverse.

> Il DEX grezzo può descrivere un livello di delta ipotizzato, sulle sole opzioni. ZeroGEX non usa quel livello da solo come stima del futuro flusso di copertura dei dealer.

Per i concetti di fondo, vedi [Perché i market maker sono costretti a fare trading sull'azione](/education/why-market-makers-trade-stock) e [Delta e i suoi tre figli](/education/delta-and-its-three-children).

Solo contenuto educativo — nulla di quanto sopra è una raccomandazione di trading.
