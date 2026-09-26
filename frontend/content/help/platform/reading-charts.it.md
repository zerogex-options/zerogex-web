# Come leggere i grafici di ZeroGEX

*Un linguaggio visivo condiviso - colori, scale, comportamento al passaggio del mouse, legende e le note specifiche per il profilo di gamma, l'open interest, le heatmap e il Gamma Chart.*

---

## Il linguaggio dei colori

ZeroGEX utilizza una tavolozza piccola e coerente in tutti i grafici. Una volta compresa, ogni grafico si legge più velocemente.

- **Ambra / arancione caldo** - colore di accento; usato per gli avvisi, l'enfasi del brand e la traccia della score-line.
- **Verde** - rialzista, positivo, direzione long, guadagno.
- **Rosso** - ribassista, negativo, direzione short, perdita.
- **Blu / blu navy scuro** - informazione strutturale neutra; linee di riferimento, assi, baseline.
- **Corallo / rosa** - informativo secondario; badge di sessione come Pre-market, After hours e Futures.

Il **significato** dei colori è stabile in tutti i grafici. Lo stesso verde è "rialzista" ovunque. Le superfici che colorano il gamma dei dealer in base al segno usano scale proprie, indicate nella legenda di ciascun grafico: la heatmap GEX nel tempo va dal blu (negativo) all'arancione (positivo) passando per il bianco, e le ribbon del Gamma Chart sono dorate per il gamma long e viola per lo short.

### I livelli chiave

Sul Gamma Chart e sugli altri grafici di prezzo che li disegnano, quattro livelli hanno un colore proprio, tenuto distinto dal linguaggio rialzista/ribassista qui sopra perché un livello non venga mai letto come una direzione:

- **Azzurro** - il **gamma flip**. È il confine tra la zona di gamma lunga e quella di gamma corta, quindi non è deliberatamente né verde né rosso.
- **Oro** - il **max pain**.
- **Verde acqua** - il **pin strike**.
- **Viola** - il **GEX king**, il nodo di gamma dominante.

**Call wall** e **put wall** prendono i colori direzionali. Sul Gamma Chart sono colorati in base a cosa fa il livello - il call wall rosso (resistenza sopra), il put wall verde (supporto sotto). I grafici che separano call e put, come le barre per strike di Dealer Positioning, mantengono le call verdi e le put rosse. L'**ultimo prezzo scambiato** in tempo reale prende l'accento caldo di ciascun tema - sempre un colore caldo, mai l'azzurro del flip.

Il grafico Gamma Exposure by Strike di Dealer Positioning etichetta le sue linee di riferimento con il testo (Spot, Flip, Call Wall, Put Wall) e disegna il flip in ambra, quindi lì fai fede all'etichetta.

## La score line

Ogni score dei segnali Basic e Advanced sta sulla stessa scala da **−100 a +100** - lo score in [-1, +1], moltiplicato per 100 - con lo zero al centro.

- Il segno codifica la direzione.
- La distanza dallo zero codifica la convinzione.
- Le card dei segnali Advanced indicano da quale livello il segnale si attiva ("activates at ±N").
- Nella timeline degli eventi di un segnale, lo score è la linea ambra, lo zero è la linea orizzontale tenue, e i triangoli segnano i cambi di direzione - verdi verso il rialzo, rossi verso il ribasso.

Per un approfondimento, vedi [Leggere la linea del punteggio da -100 a +100](/help/platform/score-line).

## Il grafico Gamma Exposure by Strike

Un elemento cardine della pagina Dealer Positioning.

- **Asse X** - prezzo di strike.
- **Barre** - il gamma modellato dei dealer per strike in dollari, con il segno della convenzione call positive / put negative: call verso l'alto, put verso il basso, ogni barra impilata per scadenza con la più vicina più marcata.
- **Curva GEX Profile** - il profilo modellato del gamma dei dealer lungo i prezzi, sul proprio asse.
- **Punto in cui la curva attraversa lo zero** - il gamma flip.
- **Barre call alte** - accumuli di gamma lato call (candidati a call wall).
- **Barre put alte** - accumuli di gamma lato put (candidati a put wall).
- **Linee di riferimento** - lo spot, il flip e i call e put wall.

Il grafico si apre con lo zoom al minimo su tutti gli strike caricati. I pulsanti X fanno zoom sugli strike, i pulsanti Y ingrandiscono la scala del gamma per esaminare le barre piccole, e il pulsante di reset ripristina entrambi.

## Il grafico dell'open interest

Open Interest by Strike, sempre su Dealer Positioning: i contratti aperti a ogni strike, call sopra l'asse e put sotto, impilati per scadenza come le barre del gamma. Alterna tra **OI** (numero di contratti) e **Notional** (strike × 100 × OI); una linea punteggiata segna lo spot. Leggilo accanto al grafico del gamma - l'open interest mostra dove sono i contratti, il gamma quanto hedging implicano.

## La heatmap strike × DTE

GEX Heatmap · Strike × DTE, nella pagina Dealer Positioning.

- **Righe** - gli strike con più gamma nella settimana successiva, lo strike più alto in cima.
- **Colonne** - giorni alla scadenza, fino a 7DTE.
- **Colore della cella** - il gamma netto dei dealer per quella combinazione strike/scadenza: verde positivo, rosso negativo, più intenso per valori maggiori.
- **Corona** - il GEX king, lo strike con il maggior gamma netto dei dealer su quelle scadenze.

Le celle più "calde" sono gli strike che contano per le scadenze più vicine. Osserva come la heatmap si sposta durante la giornata - se la cella più luminosa salta di strike, il wall si sta muovendo.

## La heatmap GEX nel tempo

GEX Heatmap Timeseries, nella pagina GEX Heatmap e su Dealer Positioning: gli strike in verticale, il tempo in orizzontale, ogni colonna il gamma netto dei dealer in quel momento - arancione positivo, blu negativo, quasi bianco intorno allo zero - con le candele e il gamma flip disegnati sopra. I tratti tratteggiati della linea del flip segnano i cicli in cui il flip è stato trovato solo allargando la ricerca lontano dallo spot; considerali marginali.

## Il Gamma Chart

Il grafico di prezzo del Gamma Terminal e lo ZeroGEX Gamma Chart del Main Dashboard sono lo stesso grafico: il prezzo del sottostante con la struttura di gamma dei dealer disegnata sopra.

- **Simbolo e timeframe** - SPY, QQQ, SPX, NDX, ES o NQ, su barre da 1m, 5m, 15m, 1H o 1D.
- **Stile del prezzo** - Candle, Line o Area, sopra un pannello del volume che mostra il volume Up/Down o il netto Cumulative della sessione.
- **Expiry** - nel grafico in tempo reale, limita i livelli di gamma e il rail alle scadenze scelte; **All** è l'intera catena.

Gli overlay sono il tocco distintivo di ZeroGEX, ciascuno attivato da una pillola nella barra degli strumenti sopra il grafico (sotto **Layers** sullo smartphone):

- **Gamma Levels** - la linea del gamma flip (tratteggio lungo, azzurra, con l'etichetta `FLIP` sul bordo sinistro) e le linee del call wall e del put wall.
- **Gamma Rail** - il gamma dei dealer per strike, disegnato all'altezza dei prezzi del grafico, come silhouette smussata o come barre Net, Split o Combined. Sul Gamma Terminal si trova nel pannello accanto al grafico, dove puoi sostituirlo con due scale di Net GEX allineate per strike.
- **Max Pain** e **Pin Strike** - linee proprie in oro e verde acqua; la linea del pin riporta la sua forza, come in `PIN · STRONG`.
- **VWAP** e l'ombreggiatura **Regime** - le zone di gamma long e gamma short ai due lati del flip.
- Spenti finché non li attivi: **GEX King** e, nel grafico in tempo reale, **Expected Range**, **Ribbons** (il gamma per strike nel tempo, dietro il prezzo) e **Bar Timer**.

La linea a puntini fini nell'accento caldo del tema è l'**ultimo prezzo scambiato**, non un livello gamma - nella legenda sotto il grafico compare come "Last".

Gli overlay ti permettono di leggere il price action attraverso la lente del dealer positioning senza uscire dal grafico. Senza un piano Basic o Pro, il Gamma Terminal mostra uno snapshot ritardato di circa 15 minuti, con simbolo e timeframe fissi; i membri lo vedono in tempo reale.

### Quando manca la linea del flip

Un livello viene disegnato solo finché rientra nell'intervallo di prezzo visibile: su un sottostante a prezzo elevato il cui flip è lontano dallo spot - NDX in particolare - la linea del flip può quindi finire fuori scala. Il grafico lo dice invece di lasciartelo indovinare: un chip sul bordo dell'area di disegno riporta `FLIP ↓ 22,600.00` con direzione e prezzo, e l'asse dei prezzi a destra porta un tag con la freccia corrispondente. Riduci lo zoom dell'asse dei prezzi (il pulsante **Price −**, Maiusc+scroll, o trascinando la scala dei prezzi a destra) per riportare la linea in vista.

Ogni tanto non è possibile risolvere alcun flip. Il resolver pubblica solo un attraversamento dello zero abbastanza vicino allo spot da essere negoziabile e sostenuto da open interest reale; quando lo spot è ben dentro un regime di gamma, o la catena è sottile o a senso unico (orario esteso, un picco di volatilità implicita), nessun attraversamento supera quella soglia. In quel caso il chip riporta `FLIP UNAVAILABLE` con un `?` ambra accanto - passa il mouse sul segno per il motivo e, su ES / NQ, per sapere su quale catena è mancato il flip - e il badge "Dealer Gamma @ Spot" mostra un semplice `—`. Preferiamo non disegnare nulla piuttosto che un livello di cui non ci fidiamo; di norma il flip torna a risolversi in uno snapshot successivo.

Un flip vuoto significa un'altra cosa quando il filtro **Expiry** contiene un sottoinsieme della catena. Il grafico disegna allora i livelli delle scadenze che hai scelto, e il loro flip viene ricostruito da quei soli strike; ma un sottoinsieme è spesso di un solo segno (un book 0DTE pomeridiano con gamma negativa su ogni strike non attraversa mai lo zero), quindi non c'è alcun attraversamento da disegnare. Il chip lo dice direttamente: `NO FLIP IN SELECTED EXPIRIES`. A differenza del caso precedente, quello *non* si risolverà in uno snapshot successivo, perché non manca nulla. Riporta **Expiry** su **All** per vedere il flip dell'intera catena - lo stesso livello riportato dalla pagina Dealer Positioning, che legge la catena completa e continua perciò a mostrare un numero mentre il grafico è ristretto.

## Comportamento al passaggio del mouse

La maggior parte dei grafici mostra un tooltip al passaggio del mouse con i valori precisi alla coordinata x del cursore. Il tooltip rispetta il linguaggio dei colori del grafico - il colore del chip del valore corrisponde alla serie.

## Legende

Le legende indicano ogni serie e il suo colore - sono una chiave di lettura, non un interruttore. Sul Gamma Chart sono le pillole degli overlay sopra il grafico ad attivare e disattivare i livelli.

## Sparkline

Le card dei segnali nelle dashboard utilizzano le sparkline - piccoli mini-grafici inline dello score nella finestra recente. La pendenza della sparkline è più informativa del suo livello assoluto: uno score a +40 in salita è una lettura diversa rispetto a +40 in discesa.

## Modalità chiara

Ogni grafico funziona sia nel tema scuro che in quello chiaro. Le **identità** dei colori restano le stesse; i **valori** si invertono per mantenere il contrasto. Verde-rialzista e rosso-ribassista sono stabili tra i temi.

## Errori comuni

- **Leggere l'asse sbagliato.** I grafici degli score vanno da −100 a +100; i grafici GEX sono in dollari. Non confrontarli tra loro.
- **Trattare una sparkline come un grafico operativo.** Le sparkline sono contesto, non segnali di ingresso.
- **Leggere la heatmap da lontano.** Il punto centrale della heatmap è la texture - ingrandisci se le celle sono piccole.

## Vedi anche

- [Come leggere la Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Leggere la linea del punteggio da -100 a +100](/help/platform/score-line)
