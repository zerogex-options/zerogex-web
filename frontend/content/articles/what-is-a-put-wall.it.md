# Che cos'è un Put Wall? La concentrazione di gamma sulle put, spiegata

*Il Put Wall in parole semplici - che cos'è, perché il prezzo spesso reagisce nelle sue vicinanze, perché la copertura modellata di put venduta non lo rende un pavimento meccanico, in cosa differisce dal Call Wall, che cosa significa una rottura e dove trovare il Put Wall di oggi per SPX, SPY, QQQ e NDX.*

---

## Che cos'è un Put Wall?

Un **Put Wall** è lo strike sotto il prezzo attuale in cui l'esposizione di gamma sul lato put è più concentrata nella catena delle opzioni. I trader lo osservano come il bordo inferiore del range con cui il posizionamento attuale è più coerente - lo strike in cui una discesa ha più probabilità di incontrare una reazione da copertura, liquidità e dal resto del flusso che si raccoglie attorno a uno strike carico.

Più precisamente: il Put Wall è lo strike allo spot o sotto di esso con la maggiore magnitudine di gamma put senza segno nella catena delle opzioni selezionata. ZeroGEX ordina gli strike a partire dal gamma modellato moltiplicato per l'open interest ufficiale e applica il filtro sul lato dello spot. È un riferimento strutturale, non la promessa che il prezzo rimbalzerà.

Sotto la convenzione tradizionale di ZeroGEX call-positive/put-negative, l'inventario di put a quello strike è **gamma dealer modellato localmente negativo**. Per un dealer coperto in delta e venditore di una put, una discesa del prezzo rende la posizione in opzioni più positiva in delta; mantenere la copertura richiede in genere di vendere altro sottostante. Quell'aggiustamento locale può rafforzare la discesa. Il Put Wall non è quindi un pavimento difeso meccanicamente dai dealer, né l'immagine speculare di un call wall positivo.

## Come ZeroGEX modella il posizionamento dei dealer

I dati pubblici della catena delle opzioni non rivelano l'inventario completo, lungo e corto, dei dealer. ZeroGEX assegna perciò esposizione modellata positiva alle call e negativa alle put, il che corrisponde a grandi linee a dealer netti lunghi delle call vendute dai clienti e netti corti delle put acquistate dai clienti. La convenzione è utile per confrontare la struttura della catena, ma non è un'osservazione diretta dell'inventario dei dealer; il posizionamento reale può essere diverso.

Il Net GEX modellato resta:

```text
Modeled Net GEX = Call GEX - Put GEX
```

Call lunghe e put lunghe hanno entrambe gamma positivo; call corte e put corte hanno entrambe gamma negativo. Il segno negativo delle put qui sopra deriva dalla posizione ipotizzata del dealer, non da un gamma intrinsecamente negativo delle put.

## Perché il Put Wall spesso coincide con un supporto

Un Put Wall può coincidere con un supporto osservato a causa del profilo di gamma complessivo, della liquidità, della monetizzazione delle put, del comportamento della clientela, di domanda sistematica o di altri flussi di mercato. Anche il gamma call modellato positivo altrove può superare il gamma put modellato negativo al wall, lasciando il Net GEX aggregato positivo. Ma un gamma aggregato positivo non dimostra che gli acquisti dei dealer siano concentrati sul Put Wall.

Tratta il livello come:

- una grande concentrazione di gamma put;
- un possibile riferimento di liquidità e posizionamento;
- un livello che empiricamente può comportarsi come supporto; e
- un livello la cui copertura dipende dal gamma aggregato e locale più il flusso circostante.

## Put Wall e Call Wall a confronto

I due wall si costruiscono allo stesso modo su lati opposti dello spot, ed è lì che finisce la simmetria.

| | Put Wall | Call Wall |
|---|---|---|
| Lato dello spot | Allo spot o sotto | Allo spot o sopra |
| Ordinato per | Maggiore magnitudine di gamma put (gamma modellato × open interest) | Maggiore magnitudine di gamma call (gamma modellato × open interest) |
| Segno dealer modellato | Negativo - dealer modellati corti delle put comprate dai clienti | Positivo - dealer modellati lunghi delle call vendute dai clienti |
| Lettura comune | Bordo inferiore del range di posizionamento; può coincidere con un supporto | Bordo superiore del range di posizionamento; può coincidere con resistenza o pinning |
| Copertura locale, isolata | Una discesa può richiedere altre vendite, il che può rafforzare il movimento | Un rialzo può richiedere altre vendite, il che può frenare il movimento |
| In caso di rottura | Il riferimento è fallito o migrato; in gamma negativo il movimento può accelerare | Il riferimento è fallito o migrato; spesso letto come uno spostamento del posizionamento |

Call Wall e Put Wall non sono meccanicamente simmetrici. Un Call Wall è lo strike allo spot o sopra con la maggiore magnitudine di gamma call; un Put Wall usa la magnitudine di gamma put sotto lo spot. Il tipo di opzione da solo non determina resistenza, supporto, attrazione o accelerazione. Il confronto più completo è in [Che cos'è un Call Wall?](/education/what-is-a-call-wall) e [Gamma wall spiegati](/education/gamma-walls-explained).

## Put Wall, gamma flip e max pain

Tre livelli che vengono confusi tra loro:

- Il **Put Wall** è una *concentrazione* - lo strike più denso di gamma put sotto lo spot.
- Il [gamma flip](/education/how-to-read-a-gamma-flip), o [livello di gamma zero](/education/zero-gamma-level-explained), è una *linea di regime* - il prezzo a cui il gamma netto modellato dei dealer cambia segno. Decide se la copertura vicino ai wall tende a smorzare i movimenti o ad amplificarli. Il flip si trova spesso sopra il put wall, quindi il prezzo può rompere il put wall pur essendo ancora in gamma positivo, oppure tenerlo pur essendo già in gamma negativo.
- Il [max pain](/education/max-pain-explained) è un calcolo di *valore a scadenza* - lo strike in cui il valore in scadenza per chi detiene opzioni è minimizzato. Non è una concentrazione di gamma ed è spesso lontano da entrambi i wall.

Leggere il Put Wall senza il flip è l'errore più comune di questa pagina. Il wall ti dice dove il posizionamento è denso; il flip ti dice che cosa è probabile che quel posizionamento denso faccia.

## Perché un wall può migrare durante la seduta

L'open interest ufficiale viene di norma aggiornato dopo la compensazione, non con continuità durante la seduta. I wall di ZeroGEX possono comunque migrare in seduta perché spot, tempo alla scadenza e volatilità implicita cambiano il gamma modellato di ogni strike. L'ordinamento relativo può cambiare, uno strike può passare da un lato all'altro dello spot, oppure un altro strike con open interest invariato può diventare il massimo.

Il calcolo del wall non stabilisce che volume nuovo abbia aperto nuove posizioni. Il volume non distingue l'attività di apertura da quella di chiusura, e non è open interest intraday verificato. Con l'avvicinarsi della scadenza il gamma si concentra sempre più vicino allo strike at the money: il gamma ATM può salire nettamente, mentre il gamma sugli strike che finiscono decisamente dentro o fuori dal denaro tende a zero. Quella rivalutazione è cosa diversa dalla chiusura di contratti o dall'aggiornamento dell'open interest ufficiale.

## Che cosa succede quando il Put Wall si rompe

Una rottura sotto il Put Wall è un'informazione, non un verdetto. Leggila con quattro domande:

1. **Quale regime era in vigore?** Sopra il gamma flip la copertura aggregata tende a frenare la discesa, quindi una rottura ha meno copertura alle spalle. Sotto il flip il riflesso va con il movimento e una rottura può accelerare - la copertura locale di put venduta descritta sopra è ora allineata al book complessivo.
2. **Il wall è migrato o ha fallito?** Un wall che si è riordinato su uno strike più basso al cambiare degli input non è stato "rotto"; il riferimento si è spostato. Confronta lo strike del wall prima e dopo la rottura.
3. **Il flusso lo ha travolto?** Notizie macro, ribilanciamenti di indici e grandi ordini singoli portano un flusso che sovrasta la copertura. Una rottura su un tape del genere dice poco sul wall.
4. **Il gamma flip è stato attraversato?** Una rottura può significare che il riferimento è fallito, che il flusso circostante ha dominato, che il gamma locale si è indebolito o che il wall è migrato. Solo l'attraversamento del Gamma Flip calcolato - o un effettivo cambio di segno del Net GEX modellato - sostiene l'affermazione di un cambio di regime di gamma.

Dopo una rottura, lo strike al di sotto con la magnitudine di gamma put immediatamente inferiore diventa il nuovo put wall alla rilevazione successiva. È così che il livello "scende a gradini" in una seduta in tendenza.

## Una lettura pratica

Supponiamo che l'SPX sia a 5.830, il Put Wall a 5.790, il Call Wall a 5.850 e il Net GEX modellato positivo. Il Put Wall individua la maggiore magnitudine di gamma put sotto lo spot. **Non** individua di per sé una zona di acquisto. Un trader può osservare se la liquidità assorbe le vendite a quel livello, se il profilo di gamma aggregato resta stabile, se il wall migra al cambiare degli input e se il flusso direzionale conferma o travolge il livello.

Supponiamo ora che un'ora dopo l'SPX scivoli a 5.785 e che il gamma flip, pubblicato a 5.815, sia stato attraversato. Due cose sono cambiate insieme: il riferimento del Put Wall è fallito e il regime modellato è diventato negativo. È la seconda a contare per l'operazione successiva - il riflesso di copertura che avrebbe potuto frenare la discesa è ora modellato per accompagnarla, e la concentrazione di put successiva più in basso è il nuovo riferimento, non un livello che la copertura attutirà.

## Come trovare il Put Wall di oggi

ZeroGEX pubblica il Put Wall - insieme a Call Wall, gamma flip, max pain e Net GEX - gratuitamente e con circa 15 minuti di ritardo, per [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) e [NQ](/nq-gamma-levels). Ogni pagina si aggiorna nel corso della seduta e mostra l'ora della rilevazione accanto a ogni livello. Per disegnare il livello sul tuo grafico, l'[indicatore TradingView](/tradingview-indicator) e lo [studio thinkorswim](/thinkorswim-indicator) gratuiti tracciano il Put Wall come linea orizzontale; il valore live, aggiornato sotto il minuto, è nella dashboard ZeroGEX.

Due abitudini rendono il numero utile invece che decorativo: annota l'ora della rilevazione (un Put Wall del mattino letto contro un tape del pomeriggio è un altro book) e leggilo con il gamma flip sullo stesso schermo.

## In sintesi

> Il Put Wall è una concentrazione modellata di gamma put e un riferimento strutturale utile. Può coincidere con un supporto, ma il supporto non è una conseguenza diretta della copertura modellata di put venduta del dealer a quello strike.

Guarda i wall modellati di oggi su [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) e [NDX](/ndx-gamma-levels), oppure confronta il quadro più ampio in [Gamma wall spiegati](/education/gamma-walls-explained).

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.
