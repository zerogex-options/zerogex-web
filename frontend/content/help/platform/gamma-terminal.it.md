# Usare il Gamma Terminal

*Una guida a ogni pannello, controllo e overlay del grafico del Gamma Terminal: cosa mostra ciascuno, come leggerlo e cosa non può dirti.*

---

## A cosa serve il Gamma Terminal

Il [Gamma Terminal](/chart) mette il prezzo e il gamma modellato dei dealer su un'unica schermata. Le candele mostrano cosa sta facendo il prezzo. Le linee, le ombreggiature e i pannelli intorno mostrano dove, secondo il modello, l'hedging dei dealer di opzioni è più consistente, e se in questo momento quell'hedging sta smorzando i movimenti o li sta rafforzando.

Ogni valore di gamma sulla pagina è una stima. I dati pubblici sulle opzioni mostrano quanti contratti sono aperti a ogni strike, ma non chi li detiene, quindi ZeroGEX applica la convenzione standard secondo cui i dealer sono net long sulle call e net short sulle put. Leggi i livelli come contesto per le tue decisioni, non come un book di ordini misurato o un target di prezzo. La pagina [Metodologia e validazione](/methodology) spiega il modello.

Dall'alto in basso, la pagina contiene:

1. **Key Levels** - i sei numeri che contano di più, con la loro distanza dal prezzo.
2. **About this terminal** - una breve descrizione, che per i membri parte chiusa.
3. **Beside the tape** - un selettore per il pannello accanto al grafico: **Gamma Ladders** o **Strike Panel**.
4. **Il Gamma Chart** - le candele con i livelli di gamma e gli overlay disegnati sopra, e alla sua destra il pannello che hai scelto (sotto, sugli schermi più stretti).
5. **What you're looking at** - sei schede che riassumono le funzioni principali.
6. **Playbook** - cosa implica il regime attuale quando il prezzo si avvicina a un wall.

I membri Basic e Pro vedono il terminal in tempo reale. Tutti gli altri vedono un'anteprima gratuita di SPY in ritardo di circa 15 minuti; vedi [Anteprima gratuita e versione in tempo reale](/help/platform/gamma-terminal#anteprima-gratuita-e-versione-in-tempo-reale).

## I tuoi primi cinque minuti

1. **Scegli un sottostante.** Usa i pulsanti dei simboli sul grafico, il menu a tendina del primo ladder o le frecce della striscia Key Levels. Ognuno cambia l'intera pagina.
2. **Leggi il regime.** Il riquadro **Dealer Gamma @ Spot** in alto a destra del grafico indica **LONG Γ** o **SHORT Γ**. In long gamma, secondo il modello l'hedging dei dealer si oppone ai movimenti (pinning). In short gamma, secondo il modello li rafforza (trend). Lo sfondo colorato del grafico dice la stessa cosa.
3. **Trova le linee chiave.** La linea azzurra `FLIP` è dove cambia il regime. Il `CALL WALL` rosso sopra il prezzo e il `PUT WALL` verde sotto sono gli strike con il maggior gamma call e il maggior gamma put. Le schede Key Levels riportano la distanza esatta da ciascuno.
4. **Guarda accanto al grafico.** I ladder elencano il gamma netto dei dealer a ogni strike vicino al prezzo, allineati al grafico. I valori più grandi sono gli strike a cui è legato più hedging.
5. **Aggiungi ciò che ti serve.** Attiva **Expected Range** per il movimento che la volatilità implicita sta prezzando, **Centroids** per vedere dove sono centrati gli scambi di opzioni di oggi, o **PD/PM Levels** per il massimo, il minimo e la chiusura del giorno precedente.
6. Usa **Rewind** per rivedere come si sono mossi il prezzo e il book di gamma durante la sessione.

## La striscia Key Levels

La striscia in alto mostra i sei livelli che disegna il grafico, per il simbolo e il filtro delle scadenze del grafico.

- **Spot** - il prezzo attuale e la sua variazione rispetto alla chiusura precedente.
- **Gamma Flip** - il prezzo in cui il gamma netto modellato dei dealer cambia segno.
- **Pin Strike** - lo strike vicino in scadenza oggi (0DTE) verso cui, secondo il modello, il gamma dei dealer attira il prezzo con più forza in vista della chiusura, con un'etichetta di forza.
- **Call Wall** - lo strike pari o superiore al prezzo con il maggior gamma call.
- **Put Wall** - lo strike pari o inferiore al prezzo con il maggior gamma put.
- **Max Pain** - lo strike in cui i detentori di opzioni incasserebbero di meno alla scadenza.

Ogni scheda mostra il livello e la sua distanza dal prezzo in dollari e in percentuale, con una freccia verde quando il livello è sopra il prezzo e una rossa quando è sotto. Passa il mouse su una scheda per la definizione completa. L'intestazione indica le scadenze da cui provengono i livelli e porta un chip **LONG Γ** o **SHORT Γ**.

Quando una scheda mostra un trattino al posto di un numero, la nota sotto spiega perché:

- **Unresolved this snapshot** - questa volta il modello non ha restituito alcun livello, di solito perché la catena di opzioni era sottile. Passa il mouse sul **?** ambra per i dettagli. Di norma il livello ricompare con un aggiornamento successivo.
- **No flip in selected expiries** - le scadenze che hai scelto non cambiano mai segno. Vedi [Il filtro Expiry](/help/platform/gamma-terminal#il-filtro-expiry).
- **No active pin** - in questo momento nessuno strike vicino in scadenza oggi soddisfa i criteri di un pin.

I membri trovano qui tre cose in più. Su desktop, passa il mouse sulla striscia per far comparire le frecce con cui passare da un simbolo all'altro; su smartphone, scorrila con il dito. Tutta la pagina cambia di conseguenza. La campanella sulle schede Call Wall e Put Wall imposta un [avviso](/help/platform/alerts) per quando il prezzo raggiunge quel wall. E la scheda Pin Strike indica da quanto tempo tiene il pin attuale, come in "Held since 09:41".

## Gamma Ladders e lo Strike Panel

Il pannello accanto al grafico mostra il book del gamma dei dealer strike per strike, in uno di due modi. Scegline uno con il selettore **Gamma Ladders** / **Strike Panel** sopra il grafico. Il grafico in sé resta lo stesso in entrambi i casi, e la tua scelta viene ricordata.

### Gamma Ladders

Due ladder affiancati. Ogni riga è uno strike, il più alto in cima, e il suo numero è il **gamma netto dei dealer** su quello strike. Per impostazione predefinita è in dollari per movimento dell'1%: più o meno quante azioni i dealer dovrebbero scambiare su quello strike per restare coperti se il prezzo si muovesse dell'1%.

- Le **righe arancioni** sono long gamma (positivo) e le **righe blu navy** sono short gamma (negativo). Più il colore è intenso, più grande è il numero.
- La riga con lo strike in una pillola evidenziata è lo strike più vicino al prezzo. Sugli schermi larghi si trova all'altezza del prezzo sul grafico.
- I tag `GF`, `CW`, `PW` e `MP` segnano Gamma Flip, Call Wall, Put Wall e Max Pain sulla riga più vicina. L'intestazione ne riporta i valori, oppure `NA` quando un livello non è disponibile.
- La **corona** segna lo strike più pesante visibile in quel ladder. Non è il GEX King del grafico, che è lo strike più pesante dell'intera catena.
- Il chip **LONG Γ** / **SHORT Γ** in ogni intestazione confronta il prezzo con il flip di quel simbolo.

Il primo ladder mostra il simbolo del grafico. Il secondo serve a confrontare qualsiasi altro simbolo e parte dal book abbinato: SPY con SPX, QQQ con NDX, ES con SPX, NQ con NDX e NVDA con QQQ. [Livelli di gamma SPY vs SPX](/education/spy-vs-spx-gamma-levels) spiega perché due book sullo stesso indice si leggono in modo diverso.

I controlli in cima al pannello:

- **Strikes: Active / All** - **Active** (l'impostazione predefinita) nasconde gli strike senza open interest. **All** mostra tutti gli strike quotati vicino al prezzo.
- **Session Δ: On / Off** - segna con un ▲ verde ogni strike in cui il gamma dei dealer è cresciuto dall'apertura delle 9:30 ET, o con un ▼ rosso quelli in cui si è ridotto. Le variazioni piccole non vengono segnate. Solo in tempo reale.
- **Unit: 1% / 1pt** - mostra il gamma per movimento dell'1% (l'impostazione predefinita) o per movimento di 1 punto. Stessa esposizione, unità diversa. L'impostazione vale per tutto il sito.

Una nota ambra "Positioning as of 15:55 ET" significa che gli ultimi aggiornamenti non contenevano dati di posizionamento (per esempio dopo la chiusura delle opzioni), quindi il ladder mostra il più recente che li conteneva. I livelli nella sua intestazione restano in tempo reale.

### Strike Panel

Lo stesso book in forma di immagine: il gamma netto dei dealer a ogni prezzo. Sugli schermi larghi è disegnato sulla scala dei prezzi del grafico stesso, così ogni strike si trova all'altezza di quel prezzo sulle candele.

Ci sono quattro viste, da scegliere in cima al pannello:

- **Silhouette** (l'impostazione predefinita) - una curva smussata. Il lobo verde a destra è long gamma, il lobo rosso a sinistra è short gamma, e dei punti segnano il picco maggiore su ciascun lato.
- **Net** - una barra per strike: verde verso destra per il long gamma, rossa verso sinistra per lo short.
- **Split** - call e put separate: una barra call verde verso destra e una barra put rossa verso sinistra.
- **Combined** - le barre di Split più una barra netta viola.

Un asse sottile lungo il bordo sinistro del pannello etichetta gli strike. Quando sono troppo vicini per etichettarli tutti, ne etichetta invece uno ogni 2, 5 o 10, e lo strike sotto il puntatore è sempre etichettato.

In Split e Combined, ogni barra è sfumata per scadenza: più marcata vicino alla linea centrale per la scadenza più vicina e più tenue in punta per la più lontana. **Labels** mostra i valori in dollari sulle barre. Si nascondono quando gli strike sono troppo ravvicinati, quindi aumenta lo zoom dell'asse dei prezzi per farli ricomparire. Una linea azzurra tratteggiata segna il flip.

Passa il mouse su uno strike, o toccalo su smartphone, per aprirne la scheda: gamma call, put e netto, open interest e rapporto put/call, il suo peso rispetto allo strike più pesante in vista, la sua distanza dal prezzo ed eventuali livelli su quello strike. "Long Γ · magnet / brake" e "Short Γ · accelerant" descrivono cosa fa, secondo il modello, l'hedging dei dealer su quello strike: si oppone ai movimenti o li rafforza.

L'anteprima gratuita mostra solo la vista Silhouette.

## L'intestazione del grafico

- **Badge di sessione** - **● LIVE** nella sessione regolare, **○ PRE-MARKET** e **○ AFTER HOURS** negli orari estesi, **CLOSED** quando il mercato è chiuso, **◀ REWIND** durante la riproduzione e **◷ DELAYED ~15 MIN** nell'anteprima gratuita. **◆ FUTURES** compare su un indice cash fuori dall'orario regolare, quando il prezzo nell'intestazione è quello del contratto future; le candele restano sull'indice.
- **Prezzo e variazione** - la variazione è rispetto alla chiusura della sessione regolare precedente. Fuori dall'orario regolare, il prezzo nell'intestazione resta sulla chiusura delle 16:00, e SPY, QQQ e NVDA aggiungono una seconda riga con il prezzo degli orari estesi.
- **Updated** - quando è arrivato l'ultimo tick di prezzo.
- **Dealer Gamma @ Spot** - **LONG Γ** o **SHORT Γ**, e il gamma netto dei dealer al prezzo attuale in dollari, per esempio +$1.23B. Questo riquadro è la lettura del regime per tutta la pagina. Con un filtro Expiry impostato, mostra il valore delle sole scadenze selezionate e indica quali sono.
- **Su ES e NQ** - un chip **IMPLIED FROM SPX** (o **NDX**) e il codice del contratto future. Vedi [ES e NQ](/help/platform/gamma-terminal#es-e-nq).

## La barra degli strumenti

- **Simbolo** - SPY, QQQ, SPX, NDX, ES, NQ e NVDA. Cambiare simbolo azzera lo zoom, interrompe il Rewind e riporta il filtro Expiry su All, a meno che non sia su 0DTE.
- **Timeframe** - barre da **1M**, **5M**, **15M**, **1H** o **1D**. A ogni visita il grafico si apre su 5M.
- **Stile** - **Candle**, **Line** o **Area**. Una candela è verde quando ha chiuso pari o sopra la chiusura precedente e rossa quando ha chiuso sotto. È vuota quando ha chiuso pari o sopra la propria apertura.
- **VOL** - l'icona dell'occhio mostra o nasconde il pannello del volume. Vedi [Il pannello del volume](/help/platform/gamma-terminal#il-pannello-del-volume).
- **Pillole degli overlay** - una per overlay. Vedi [Gli overlay](/help/platform/gamma-terminal#gli-overlay). Su smartphone, i controlli di overlay, stile, volume ed Expiry si trovano sotto **Layers**, che conta quanti overlay sono attivi.
- **Expiry** - quali scadenze alimentano i livelli di gamma. Vedi [Il filtro Expiry](/help/platform/gamma-terminal#il-filtro-expiry).
- **Reset** - compare dopo uno zoom o uno spostamento, e riporta alla vista in tempo reale.
- **Save** - scarica il grafico come immagine PNG: candele, linee, tag e assi, senza la barra degli strumenti, la legenda o il pannello accanto al grafico.

## Gli overlay

Ogni overlay ha una pillola nella barra degli strumenti. Fai clic sulla pillola per attivare o disattivare l'overlay; il grafico ricorda le tue scelte. La legenda sotto il grafico è una chiave dei colori, non un interruttore.

| Overlay | Cosa disegna | Attivo di default | Dove funziona |
|---|---|---|---|
| Gamma Levels | Le linee di Gamma Flip, Call Wall e Put Wall | Sì | Ovunque |
| Regime | L'ombreggiatura di sfondo per long gamma e short gamma | Sì | Ovunque |
| Ribbons | Il gamma di ogni strike nel tempo, dietro le candele | Sì | In tempo reale |
| VWAP | Il prezzo medio ponderato per i volumi della sessione | Sì | Ovunque |
| Max Pain | Lo strike di max pain | Sì | Ovunque |
| Pin Strike | Il pin strike di oggi e la sua forza | Sì | In tempo reale |
| GEX King | Lo strike con più gamma dell'intera catena | No | In tempo reale |
| PD/PM Levels | Massimo, minimo e chiusura del giorno precedente; massimo e minimo del pre-market | No | In tempo reale: SPY, QQQ, NVDA |
| Expected Range | Il movimento a ±1σ che la volatilità implicita sta prezzando | No | In tempo reale, tranne NVDA |
| Centroids | Dove sono centrati gli scambi di call e put di oggi | No | In tempo reale, barre da 1M a 1H |
| Bar Timer | Il tempo rimanente della candela corrente | No | In tempo reale |

Alcune cose valgono per ogni linea di livello:

- Ogni livello è una linea tratteggiata che attraversa il grafico, con il nome in un chip sul bordo sinistro e il prezzo in un tag sull'asse destro.
- Un livello fuori dall'intervallo di prezzo visibile compare come un tag fissato in cima o in fondo all'asse, contrassegnato da ▲ o ▼. Riduci lo zoom dell'asse dei prezzi per vedere la linea vera e propria.
- Il flip, i wall e il VWAP allargano l'asse dei prezzi per restare in vista quando sono ragionevolmente vicini al prezzo, e lo stesso fanno le linee PD/PM e dei centroidi quando sono attive. Max Pain, Pin Strike, GEX King e le linee dell'Expected Range non lo fanno mai, quindi spesso compaiono solo come tag con freccia.
- Quando il prezzo è entro circa lo 0,12% da un livello, la linea di quel livello viene disegnata più marcata.

### Gamma Levels

Tre linee:

- **Gamma Flip** (`FLIP`, azzurra, tratteggio lungo) - il prezzo in cui il gamma netto modellato dei dealer cambia segno.
- **Call Wall** (`CALL WALL`, rossa, tratteggio corto) - lo strike pari o superiore al prezzo con la maggiore esposizione gamma lato call.
- **Put Wall** (`PUT WALL`, verde, tratteggio corto) - lo strike pari o inferiore al prezzo con la maggiore esposizione gamma lato put.

I wall sono colorati in base a cosa fanno, non in base a call e put. Il wall rosso sopra è dove, secondo il modello, le vendite dei dealer si oppongono a un rialzo; il wall verde sotto è dove, secondo il modello, gli acquisti dei dealer si oppongono a un ribasso.

**Come leggerle.** Sopra il flip, secondo il modello i dealer sono long gamma: il loro hedging vende sui rialzi e compra sui ribassi, e così smorza i movimenti. Sotto il flip, secondo il modello sono short gamma: il loro hedging insegue il movimento, e così lo amplifica. Più il prezzo è vicino al flip, più il mercato è vicino a un cambio di regime.

I wall sono i punti in cui si concentra più hedging. Spesso agiscono come resistenza e supporto: nel nostro studio su 737 test di wall, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora e quelli del Nasdaq circa la metà delle volte, da qualunque lato del gamma flip si trovasse il prezzo. Considera un wall un punto da tenere d'occhio, non un punto in cui il prezzo deve fermarsi. Vedi [Quanto spesso si rompono davvero i gamma wall?](/education/how-often-do-gamma-walls-break) e [Gamma Wall spiegati](/education/gamma-walls-explained).

**Come vengono scelti i wall.** Non saltano a ogni tick. Un wall viene scelto di nuovo nel minuto stesso in cui il prezzo lo sfonda, e altrimenti ogni 15 minuti. A ogni nuova scelta il wall attuale mantiene il suo posto finché porta ancora almeno tre quarti del gamma dello strike più pesante dal suo lato.

**Quando manca la linea del flip**, un chip vicino al fondo del grafico spiega perché:

- `FLIP ↑ 7,750.00` o `FLIP ↓ 22,600.00` - il flip è sopra o sotto i prezzi visibili. Riduci lo zoom dell'asse dei prezzi con **Price −**, con Maiusc + scroll o trascinando la scala dei prezzi a destra.
- `FLIP UNAVAILABLE` - il modello non ha trovato nessun attraversamento di cui si fidi: uno abbastanza vicino al prezzo da contare e sostenuto da open interest reale. Succede quando il prezzo è ben dentro un regime o la catena è sottile, per esempio negli orari estesi o durante un picco di volatilità. Di solito si risolve con un aggiornamento successivo. Passa il mouse sul **?** ambra per i dettagli.
- `NO FLIP IN SELECTED EXPIRIES` - vedi [Il filtro Expiry](/help/platform/gamma-terminal#il-filtro-expiry).

Senza un flip, il grafico non può disegnare nemmeno l'ombreggiatura Regime.

### Regime

**Cosa mostra.** Lo sfondo del grafico è colorato di verde sul lato long gamma del flip e di rosso sul lato short gamma. Sugli schermi più larghi le tinte sono etichettate `LONG Γ · PINNING` e `SHORT Γ · TRENDING`.

**Come leggerlo.** In long gamma, secondo il modello l'hedging dei dealer si oppone ai movimenti, il che tende a smorzare la volatilità e ad ancorare il prezzo. In short gamma, rafforza i movimenti, il che tende ad amplificarli. [Cosa significa il gamma negativo?](/education/what-is-negative-gamma) e [Come tradare intorno al Gamma Flip](/education/how-to-trade-around-gamma-flip) approfondiscono il tema.

**Da tenere presente.**

- La fascia che contiene il prezzo concorda sempre con il riquadro **Dealer Gamma @ Spot**. Di solito significa long gamma sopra il flip e short gamma sotto, ma con un book disomogeneo l'ombreggiatura può essere invertita. Fai fede al riquadro.
- Se sposti il grafico o fai zoom in modo che il flip esca dallo schermo, l'intera vista prende una sola tinta. La tinta descrive i prezzi visibili, che potrebbero non essere quelli in cui si trova ora il prezzo.
- Niente flip, niente ombreggiatura.

### Ribbons

**Cosa mostra.** Ogni strike è una corsia che scorre dietro le candele, e ogni barra vi lascia una sfera. Dimensione e opacità della sfera mostrano il gamma netto dei dealer su quello strike nella finestra di 5 minuti della barra, rispetto allo strike più pesante sullo schermo. Le sfere **dorate** sono long gamma; quelle **viola** sono short gamma.

**Come leggerlo.**

- Una corsia spessa che persiste per tutta la sessione è un wall.
- Il dorato è una calamita e un freno: lì, secondo il modello, i dealer vendono sulla forza e comprano sulla debolezza. Il viola è un acceleratore: lì i dealer inseguono i movimenti.
- Una corsia si gonfia quando il prezzo si avvicina al suo strike e si assottiglia quando se ne allontana. È il gamma che raggiunge il picco at the money, non nuove posizioni: l'open interest si aggiorna solo una volta al giorno, dopo la chiusura. Una corsia spessa proprio sul prezzo indica dove l'hedging è più attivo in questo momento.
- Una corsia che cambia colore è uno strike i cui contratti long gamma e short gamma sono quasi in equilibrio.

**Controlli.** Il cursore **Opacity** accanto alla pillola attenua o intensifica tutte le sfere insieme. Passa il mouse su una corsia per il valore esatto dello strike. Le sfere sotto il 5% dello strike più pesante non vengono disegnate, e la legenda sotto il grafico ne riporta la chiave.

**Da tenere presente.** L'overlay Ribbons è disponibile solo in tempo reale, ed è attivo di default sul Gamma Terminal. Segue il filtro Expiry. Lo storico copre gli strike monitorati in quel momento, quindi le barre più vecchie sugli strike lontani possono essere vuote.

### VWAP

**Cosa mostra.** Il prezzo medio ponderato per i volumi della sessione (`VWAP`, linea tratteggiata): il prezzo medio scambiato oggi, con ogni prezzo pesato in base a quanto volume vi è stato scambiato. Riparte da zero a ogni giornata di contrattazione.

**Come leggerlo.** Molti trader considerano il VWAP il fair value della giornata. Un prezzo sopra il VWAP significa che in media i compratori sono stati disposti a pagare di più; sotto, che i venditori hanno messo pressione. Per i casi in cui il VWAP si allinea a un livello di gamma, vedi [Confluenza Gamma-VWAP](/education/gamma-vwap-confluence-explained).

**Da tenere presente.** SPX e NDX non si scambiano direttamente, quindi il loro VWAP applica ai prezzi dell'indice il profilo di volume di SPY e di QQQ. Il filtro Expiry non lo influenza.

### Max Pain

**Cosa mostra.** Lo strike in cui i detentori di opzioni incasserebbero di meno se il sottostante chiudesse lì alla scadenza (`MAX PAIN`, in oro, a puntini). Senza un filtro Expiry, è il max pain della scadenza più vicina: quella di oggi, quando c'è.

**Come leggerlo.** È più rilevante nell'ultimo giorno o due prima di una scadenza significativa. Per il resto del tempo spesso si trova lontano dal prezzo, e contano di più i wall e il flip. Vedi [Max Pain spiegato](/education/max-pain-explained).

**Da tenere presente.** Max Pain non allarga mai l'asse dei prezzi, quindi spesso compare solo come tag con freccia. Con un filtro Expiry, il grafico e la scheda Key Levels lo ricalcolano dalle scadenze che hai scelto; i ladder mostrano invece `NA`.

### Pin Strike

**Cosa mostra.** Lo strike vicino in scadenza oggi (0DTE) in cui il gamma positivo dei dealer e la probabilità che il prezzo lo raggiunga prima della chiusura si combinano con più forza (verde acqua, con l'etichetta `PIN · STRONG`, `PIN · MODERATE` o `PIN · WEAK`).

**Come leggerlo.** Il termine che indica la forza misura quanto lo strike vincente si distingue dai vicini, non quanto è grande il suo gamma. **Weak** significa che l'attrazione è distribuita su diversi strike vicini, non che il livello sia poco importante. È un livello di pinning modellato, non un target di prezzo. [Pin Strike](/help/platform/pin-strike) spiega come viene costruito.

**Da tenere presente.** Quando non c'è un pin attivo non viene disegnata alcuna linea. Il pin riguarda per costruzione la scadenza del giorno, quindi ignora il filtro Expiry. Non fa parte dell'anteprima gratuita.

### GEX King

**Cosa mostra.** Lo strike con il maggior gamma netto dei dealer, long o short, sull'intera catena di opzioni (`GEX KING`, viola). Disattivato di default.

**Come leggerlo.** Il King è la controparte strutturale e lenta del Pin del giorno: lo strike a cui è legato più hedging, qualunque sia la sua scadenza. Può essere uno strike short gamma.

**Da tenere presente.** Ignora il filtro Expiry, perché restringerlo lo trasformerebbe in una misura diversa. La corona sui ladder segna lo strike più pesante nella vista di quel ladder, che non sempre è il King. Non fa parte dell'anteprima gratuita.

### PD/PM Levels

**Cosa mostra.** Dove è stato il prezzo: massimo, minimo e chiusura della sessione regolare precedente (`PDH`, `PDL`, `PDC`, in grigio, tratteggio lungo) e massimo e minimo del pre-market di oggi (`PMH`, `PML`, in grigio, a puntini). Disattivato di default.

**Come leggerlo.** Non sono livelli dei dealer. Sono prezzi di riferimento che molti trader osservano, disegnati in grigio perché non vengano mai scambiati per un livello di gamma.

**Da tenere presente.** Sono disponibili solo su SPY, QQQ e NVDA. SPX e NDX non hanno pre-market, e ES e NQ si scambiano quasi 24 ore su 24, quindi lì questi livelli non si applicano. I valori sono sempre elencati in una riga sopra il grafico. La pillola, o l'occhio alla fine di quella riga, li disegna come linee.

### Expected Range

**Cosa mostra.** Una banda ombreggiata tra `ER HIGH` e `ER LOW`: il movimento che la volatilità implicita sta prezzando, una deviazione standard da ciascun lato del prezzo attuale. Disattivato di default. Una volta attivato, scegli **Daily**, **Weekly** o **Monthly**.

**Come si calcola.** Usa il VIX per SPX, SPY ed ES, e il VXN per QQQ, NDX e NQ. Il movimento è prezzo × (VIX ÷ 100) × √(giorni ÷ 252), con 1, 5 o 21 giorni di contrattazione. Con SPY a $600 e il VIX a 16, il movimento giornaliero è di circa $6,05, quindi la banda va da circa $593,95 a $606,05.

**Come leggerlo.** Con le ipotesi consuete, il prezzo chiude dentro una banda di una deviazione standard circa il 68% delle volte. La banda ti dice quanto lontano, non in quale direzione. Si ricentra man mano che il prezzo si muove, quindi descrive il range a partire da qui, non dall'apertura.

**Da tenere presente.** Expected Range è disponibile solo in tempo reale ed è nascosto durante il Rewind, perché la volatilità è una lettura in tempo reale. Non viene disegnato su NVDA, la cui volatilità è ben superiore a quella di entrambi gli indici.

### Centroids

**Cosa mostra.** Dove sono centrati gli scambi di opzioni di oggi. Il **centroide call** (verde) è lo strike medio delle call scambiate oggi, ponderato per il numero di contratti scambiati a ogni strike. Il **centroide put** (rosso) è l'equivalente per le put. Disattivato di default.

- Le **linee nitide** coprono gli ultimi 15 minuti di scambi.
- Le **linee larghe e sfumate** coprono l'intera sessione fin qui.

**Come leggerlo.** Le call si scambiano soprattutto sopra il prezzo e le put soprattutto sotto, quindi le due linee di solito stanno ai due lati del prezzo. La distanza tra loro mostra quanto è ampia la distribuzione degli scambi di oggi. Quando il centroide call scende o il centroide put sale, gli scambi si stanno concentrando più vicino al prezzo. Le linee della sessione si muovono lentamente perché fanno la media dell'intera giornata; le linee a 15 minuti seguono il prezzo e sono più rumorose. Passa il mouse su una barra per leggerle entrambe.

**Da tenere presente.** I centroidi descrivono dove sono avvenuti gli scambi; non prevedono dove andrà il prezzo. Contano tutte le scadenze che ZeroGEX monitora, quindi il filtro Expiry non si applica. Contano inoltre solo gli strike nella fascia che ZeroGEX registra intorno al prezzo (vedi [Copertura dati e aggiornamento](/help/platform/data-coverage)), quindi si trovano più vicini al prezzo rispetto a uno strumento che conta ogni strike quotato. Quando uno strike entra in quella fascia durante la giornata, il suo volume precedente viene conteggiato tutto in una volta, il che può far saltare la linea a 15 minuti. I centroidi sono disponibili solo in tempo reale, su barre da 1M a 1H.

### Bar Timer

**Cosa mostra.** Quanto manca alla chiusura della candela corrente: un conto alla rovescia sotto il tag dell'ultimo prezzo, con una barra sottile che si riempie man mano che la candela avanza. Passa il mouse sulla candela in corso per il tempo trascorso e quello rimanente. Disattivato di default.

**Da tenere presente.** Compare solo quando il mercato è aperto e stai guardando l'ultima barra.

### Il pannello del volume

Il pannello sotto le candele, che mostri o nascondi con l'occhio accanto a **VOL**:

- **Up/Down** (l'impostazione predefinita) - il volume in uptick (verde) impilato sopra il volume in downtick (rosso), una colonna per barra.
- **Cumulative** - il totale progressivo del volume in uptick meno quello in downtick nella sessione corrente, a partire da zero all'apertura. Sopra lo zero, oggi hanno guidato il tape i compratori; sotto lo zero, i venditori.

Su SPX e NDX il pannello porta l'etichetta **PROXY (EST.)**. Un indice cash non viene scambiato, quindi il volume mostrato è una stima derivata, non volume effettivamente scambiato. [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow) approfondisce il volume netto.

## Il filtro Expiry

Il menu **Expiry** nella barra degli strumenti sceglie quali scadenze di opzioni alimentano i livelli di gamma. **All expirations** usa l'intera catena che ZeroGEX monitora; [Copertura dati e aggiornamento](/help/platform/data-coverage) la descrive. **0DTE · today's expiry** segue la scadenza del giorno e ogni giorno passa a quella successiva. Puoi anche spuntare una o più date specifiche.

| Cosa | Segue il filtro Expiry? |
|---|---|
| Gamma Flip, Call Wall, Put Wall | Sì |
| Max Pain | Sì sul grafico e su Key Levels; `NA` sui ladder |
| Ombreggiatura Regime e Dealer Gamma @ Spot | Sì |
| Ribbons, lo Strike Panel e i ladder | Sì |
| La striscia Key Levels e il Playbook | Sì |
| Pin Strike | No: sempre la scadenza del giorno |
| GEX King | No: sempre l'intera catena |
| Centroids | No: tutte le scadenze |
| VWAP, PD/PM Levels, Expected Range | No: non derivano dalla catena di opzioni |

Alcune cose da sapere:

- Un sottoinsieme di scadenze ha un proprio flip: il prezzo in cui il gamma di quel sottoinsieme cambia segno. Un book della scadenza del giorno è spesso di un solo segno, con ogni strike dallo stesso lato, quindi non c'è alcun attraversamento da disegnare e il grafico mostra `NO FLIP IN SELECTED EXPIRIES`. Non si risolverà più tardi, perché non manca nulla. Riporta Expiry su **All** per vedere il flip dell'intera catena.
- `NO 0DTE TODAY · SHOWING ALL EXPIRIES` significa che oggi non c'è una scadenza del giorno, per esempio nel fine settimana o in un giorno festivo, quindi i livelli usano tutte le scadenze.
- Il filtro viene mantenuto per la tua scheda del browser e condiviso con gli altri grafici che filtrano per scadenza. Cambiare simbolo lo riporta su All, a meno che non sia su 0DTE.

## Leggere il mirino

Passa il mouse sul grafico, oppure toccalo o tienilo premuto su smartphone, per far comparire un mirino e una scheda con:

- Orario, apertura, massimo, minimo, chiusura e volume della barra, più **Net** in modalità volume Cumulative.
- **Strike Γ near**, seguito dal prezzo del mirino: il gamma netto dei dealer sugli strike vicini. Ti dice quanto hedging c'è lì. **Non** è il regime a quel prezzo, perché uno strike long gamma può trovarsi dentro un book short gamma. Leggi il regime dall'ombreggiatura e dal riquadro Dealer Gamma @ Spot.
- Il livello più vicino tra quelli disegnati sul grafico, e quanto dista. I livelli che hai disattivato non vengono indicati.
- Con Centroids attivo: i centroidi call e put, prima il valore a 15 minuti e poi quello della sessione.
- Con Ribbons attivo: la corsia più vicina al mirino, il suo gamma netto e la sua quota rispetto allo strike più pesante sullo schermo.

## Zoom, spostamento e reset

Con mouse o trackpad:

- **Trascina** il grafico lateralmente per muoverti nel tempo.
- **Ctrl + scroll** (**Cmd + scroll** su Mac), o pizzica sul trackpad, per fare zoom sul tempo. La rotellina da sola scorre la pagina, non il grafico.
- **Maiusc + scroll**, o scorri sopra la scala dei prezzi a destra, per fare zoom sull'asse dei prezzi. Puoi anche trascinare la scala dei prezzi verso l'alto o verso il basso.
- I pulsanti − e + di **Time** e **Price** in basso a destra fanno lo stesso a scatti.
- **»** torna all'ultima barra.

Su smartphone, trascina lateralmente per spostarti, pizzica per fare zoom sul tempo e usa i pulsanti **Price** sotto il grafico per fare zoom sul prezzo. Tocca, oppure tieni premuto e fai scorrere il dito, per il mirino; tocca di nuovo per toglierlo.

Dopo uno zoom o uno spostamento, la scala dei prezzi resta dove l'hai messa. **Reset**, un doppio clic, o un nuovo simbolo o timeframe la riportano all'adattamento automatico. Sul Gamma Terminal, l'adattamento automatico tiene il prezzo al centro in verticale, ed è questo che permette ai ladder di allinearsi a esso.

## Rewind

**Rewind**, sotto il grafico, riproduce la sessione: il prezzo e il book di gamma com'erano in ogni momento.

- **Play** e **Pause**, una velocità di **1×**, **4×**, **8×** o **16×**, e **Loop**, attivo di default.
- Trascina la **barra di avanzamento** per saltare a qualsiasi candela.
- I livelli, lo Strike Panel, le ribbon ed entrambi i ladder mostrano ciò che si sapeva in quel momento. VWAP e Max Pain vengono ricostruiti per quel momento.
- Expected Range, Bar Timer e il valore in dollari di Dealer Gamma @ Spot sono nascosti durante il Rewind, perché sono letture in tempo reale.
- Il Rewind arriva indietro fin dove arriva lo storico di gamma conservato dal grafico, circa sei ore e mezza, e meno sulle barre 1H e 1D. Per una sessione completa dall'apertura, segui il link **full session**, che porta a [Daily Replay](/replay).
- **● LIVE** o **»** riportano al tempo reale, e lo stesso fa cambiare simbolo o timeframe.

## Il Playbook

Sotto le schede, **Where do we expect the underlying to go?** illustra cosa implica il regime attuale quando il prezzo si avvicina a un wall:

| | Al rialzo verso il Call Wall | Al ribasso verso il Put Wall |
|---|---|---|
| Positive γ (dealer long gamma) | Damped rally | Cushioned dip |
| Negative γ (dealer short gamma) | Squeeze risk | Flush risk |

Segue il grafico in tempo reale. Fai clic su una cella per leggere un altro scenario, e su **Follow the chart** per tornare indietro. Ogni scenario elenca cosa osservare, cosa lo invalida e quanto spesso i wall si rompono.

## ES e NQ

ZeroGEX legge le opzioni sugli indici, non le opzioni sui futures, quindi i livelli di ES e NQ derivano dalle catene di SPX e NDX, proiettati sul prezzo del future al fair value (il costo di carry fino alla scadenza del contratto). Il chip **IMPLIED FROM SPX** (o **NDX**) lo segnala. Il prezzo, invece, è quello del contratto future stesso, e il suo codice, per esempio ESZ26, compare nell'intestazione. Quando i futures scambiano sopra o sotto il fair value, i livelli possono risultare leggermente spostati. [Mesi di contratto dei futures](/help/platform/futures-contract-months) spiega perché i prezzi possono differire da quelli di altre piattaforme.

## Anteprima gratuita e versione in tempo reale

| | Anteprima gratuita | Basic e Pro |
|---|---|---|
| Dati | In ritardo di circa 15 minuti; ricarica per uno snapshot più recente | In tempo reale |
| Simboli e timeframe | SPY su barre da 5 minuti | Tutti e sette i simboli, da 1M a 1D |
| Pannello | Ladder di SPY e SPX; Strike Panel solo in vista Silhouette | Qualsiasi coppia; tutte e quattro le viste dello Strike Panel; Session Δ |
| Overlay | Gamma Levels, Regime, VWAP, Max Pain | Tutti |
| Strumenti | Zoom, mirino, Save | In più il filtro Expiry, il Rewind e gli avvisi sui wall |

[Livelli, accesso e cosa si sblocca dove](/help/platform/tiers-and-access) copre il resto del sito.

## Cosa ricorda il terminal

Su questo browser, il terminal salva i tuoi overlay, lo stile del grafico, la modalità del volume, l'orizzonte dell'Expected Range, l'opacità delle ribbon, la scelta del pannello e la vista dello Strike Panel, insieme al simbolo e alle impostazioni Strikes, Session Δ e Unit dei ladder. Il filtro Expiry viene mantenuto per singola scheda del browser.

Non salva il timeframe (si apre su 5M), il simbolo del secondo ladder, zoom e spostamento, né il Rewind.

## Cosa il Gamma Terminal non può dirti

- **Chi detiene davvero le opzioni.** Il gamma dei dealer è modellato dall'open interest con una convenzione standard. I book reali dei dealer differiscono, e i desk fanno hedging in modi che i dati pubblici non mostrano.
- **Le nuove posizioni aperte durante la giornata.** L'open interest si aggiorna una volta al giorno, dopo la chiusura. Durante la sessione, i livelli si muovono perché prezzo, tempo e volatilità cambiano il gamma delle posizioni già aperte.
- **Dove andrà il prezzo.** I wall, il pin, il max pain, l'expected range e i centroidi sono contesto, non target né promesse. I livelli di gamma sono un supporto alle decisioni, non una consulenza di investimento.

## Vedi anche

- [Come leggere la Dashboard](/help/platform/dashboard)
- [Come leggere i grafici di ZeroGEX](/help/platform/reading-charts)
- [Pin Strike](/help/platform/pin-strike)
- [Gamma Exposure spiegata](/education/gamma-exposure-explained)
- [Gamma Wall spiegati](/education/gamma-walls-explained)
- [Come tradare intorno al Gamma Flip](/education/how-to-trade-around-gamma-flip)
- [Copertura dati e aggiornamento](/help/platform/data-coverage)
