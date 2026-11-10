# Hedging Flow spiegato: leggere il tape delle opzioni attraverso la copertura

*La maggior parte degli strumenti sul gamma si chiede come potrebbero coprirsi i dealer se il prezzo si muove. Hedging Flow si chiede quale copertura implichi già il trading di opzioni di oggi, e se il gamma attorno al prezzo sia predisposto ad assorbire quella spinta o ad amplificarla.*

---

## Una domanda diversa da quella del GEX

La gamma exposure è una lettura strutturale. Parte dall'open interest presente nei book e si chiede: se il prezzo si muove, come potrebbe rispondere l'hedging?

Hedging Flow parte invece dal tape. Date le opzioni effettivamente scambiate oggi, quale copertura in azioni implicherebbe quell'attività, e in che direzione sta spingendo in questo momento?

La pagina abbina questa stima a una lettura di come sta cambiando il gamma dei dealer vicino al prezzo attuale, poi condensa entrambe in un'unica sintesi, **Gamma Weather**. Niente di tutto questo è un segnale di acquisto o di vendita. Risponde a una domanda più circoscritta e più utile: il tape delle opzioni sta spingendo insieme al prezzo o contro di esso, e la struttura attorno al prezzo ha più probabilità di smorzare quella spinta o di amplificarla?

---

## Cos'è il numero

ZeroGEX classifica il volume delle opzioni confrontando il prezzo a cui è stato scambiato con la quotazione rilevata intorno a quel momento:

- il volume eseguito vicino all'ask conta come **su iniziativa del compratore**;
- il volume eseguito vicino al bid conta come **su iniziativa del venditore**;
- il volume a metà dello spread, il volume del primo minuto della sessione e il volume senza una quotazione utilizzabile restano **non classificati**.

All'interno di ogni contratto e di ogni minuto, il volume non classificato viene ripartito nella stessa proporzione acquisti/vendite del volume classificato di quel minuto. Una coppia contratto-minuto senza nulla di classificato non aggiunge nulla.

Il modello assume poi che il lato passivo di ogni trade classificato fosse un market maker che si copre per restare delta-neutrale, e calcola le azioni che quella copertura scambierebbe:

`(contracts bought − contracts sold) × delta × 100 × underlying price`

Il delta ha un segno, positivo per le call e negativo per le put, quindi il segno del risultato è la direzione della copertura implicita: **positivo significa che la copertura compra il sottostante, negativo che lo vende.** I risultati vengono sommati in barre fisse da cinque minuti dalle 9:30 alle 16:15 ET.

Due esempi rapidi, con SPY a 660 $:

- Un cliente compra 1.000 call con delta 0,40: `1,000 × 0.40 × 100 × $660 = +$26.4M`. Il market maker che gliele ha vendute ora è short delta, quindi la copertura implicita **compra** circa 26,4 milioni di $ di SPY.
- Un cliente compra 1.000 put con delta −0,30: `1,000 × (−0.30) × 100 × $660 = −$19.8M`. La copertura implicita **vende** circa 19,8 milioni di $. Se invece il cliente avesse venduto quelle put, il segno si invertirebbe: +19,8 milioni di $.

---

## Cosa non è il numero

La parola chiave è *implica*. Una lettura di +500 milioni di $ significa che l'attività classificata sulle opzioni implica, secondo le ipotesi del modello, circa 500 milioni di $ di acquisti sul sottostante. Non significa che i dealer abbiano comprato 500 milioni di $ di azioni.

ZeroGEX non vede chi c'è da ciascun lato di un trade, se un trade ha aperto o chiuso una posizione, né cosa un market maker detenga o copra davvero. L'ipotesi che il lato passivo fosse un market maker non è ancora stata validata con i dati sui market maker classificati dalle borse. Ecco perché la pagina riporta questa avvertenza sotto il grafico:

> Pressione di hedging stimata. Dedotta da trade di opzioni classificati per aggressore, nell'ipotesi che il lato passivo di ogni print fosse un market maker; tale ipotesi non è validata. Non è flusso dei dealer osservato.

Vale la pena conoscere qualche altro limite:

- ogni gamba di uno spread viene classificata a sé, quindi un singolo trade a più gambe può apparire come acquisti e vendite separati;
- il delta viene rilevato una volta per contratto per minuto, non nell'istante di ciascun trade;
- la stima copre le scadenze e gli strike che ZeroGEX monitora per quel simbolo, non ogni contratto quotato.

---

## Le call non sono automaticamente rialziste, e le put non sono automaticamente ribassiste

Poiché il delta ha un segno, la direzione della copertura implicita dipende sia dal tipo di opzione sia da quale lato ha avviato il trade:

| Attività del cliente | Copertura implicita |
|---|---|
| Compra call | Compra il sottostante (+) |
| Vende call | Vende il sottostante (−) |
| Compra put | Vende il sottostante (−) |
| Vende put | Compra il sottostante (+) |

Per questo le card **Call-driven** e **Put-driven** descrivono da dove è arrivata la pressione, non se fosse rialzista o ribassista. Un valore Put-driven positivo è del tutto possibile: è l'aspetto di una vendita massiccia di put. Lo stesso vale per un valore Call-driven negativo.

---

## Le card: com'è andata la giornata

Tre delle quattro card riassumono la sessione fino a quel momento:

- **Session pressure** è il totale netto progressivo della pressione di hedging stimata dall'apertura. È cumulativo, non la spinta attuale dei cinque minuti.
- **Call-driven** è la parte di quel totale che proviene dalle call.
- **Put-driven** è la parte che proviene dalle put.

Call-driven più Put-driven è uguale a Session pressure. Qualsiasi differenza nelle cifre mostrate è dovuta agli arrotondamenti. Le card leggono la barra più recente che ha avuto un flusso reale, quindi una barra tranquilla riportata in avanti non viene segnalata come nuova.

Tieni separati lo storico e il presente. Una sessione può avere +2 miliardi di $ di Session pressure mentre le sue barre più recenti sono già diventate negative. Il totale dice com'è andata la giornata. Non dice dove andranno i prossimi minuti. La quarta card, **Last flip**, riguarda il presente, ed è trattata più avanti, nella sezione sui flip.

---

## Il grafico del flusso: Pressure rate e Session cumulative

Il grafico ha due viste.

**Pressure rate** è la vista predefinita. Ogni barra è la pressione stimata di una singola barra da cinque minuti presa da sola (**Pressure this bar**), con sopra una linea **3-bar average**, circa gli ultimi 15 minuti. La barra più recente può essere ancora in formazione, e nel frattempo conta in quella media.

**Session cumulative** traccia invece i totali progressivi Call-driven e Put-driven e la linea **Net hedging pressure**.

Entrambe le viste tracciano **Price** sull'asse di destra, ed è lì che tende a comparire l'informazione intraday utile:

| Prezzo | Pressione | Un modo di leggerlo |
|---|---|---|
| In salita | Positiva | Il movimento ha alle spalle una domanda di copertura stimata |
| In salita | Negativa | Il prezzo avanza contro la pressione stimata |
| In discesa | Positiva | Durante il calo compaiono acquisti stimati |
| In discesa | Negativa | Il tape delle opzioni sta rafforzando il movimento |

Di solito la relazione è più informativa della dimensione di una singola barra. Anche un grosso impulso che muove a malapena il prezzo dice qualcosa: l'altro lato del mercato lo sta assorbendo.

Il selettore di vista cambia anche il grafico della struttura sottostante, così i due confrontano sempre grandezze omogenee. In Pressure rate mostra gli ultimi 30 minuti di variazione strutturale. In Session cumulative mostra la variazione dall'apertura.

---

## I flip e la card Last flip

Un **flip** segnala che la media a 3 barre ha cambiato direzione, ed è volutamente più difficile da attivare di un semplice cambio di segno:

- la media deve stabilizzarsi oltre una **banda piatta** attorno allo zero, che si estende in ciascuna direzione per metà del ritmo tipico della sessione fino a quel momento. Una linea che sfiora lo zero e torna indietro viene trattata come piatta, non come due flip;
- un flip è **significativo** quando la sua oscillazione è almeno pari all'oscillazione tipica da barra a barra della sessione fino a quel momento. Gli altri sono **leggeri**.

Entrambe le soglie sono costruite solo con le barre precedenti al flip, quindi ogni flip viene giudicato su ciò che era noto in quel momento. La barra più recente però è ancora in formazione, quindi un flip su di essa può comparire e scomparire prima che quella barra si chiuda.

Il grafico segna i flip con un punto sulla linea dello zero e un badge sopra di esso, e per impostazione predefinita mostra solo i flip significativi. La card **Last flip** è diversa: mostra il flip più recente di qualsiasi dimensione, con l'orario di inizio della sua barra. Quando il flip più recente è leggero, la card e il badge possono indicare flip diversi. Togli la spunta da **Significant flips only** per vedere quelli leggeri sul grafico. Tutti gli orari della pagina sono in ora Eastern, nel formato a 24 ore.

---

## Dealer gamma structure: contro cosa si scontra la spinta

Hedging Flow stima la spinta. **Dealer gamma structure** descrive ciò che la riceve, usando il gamma dei dealer modellato da ZeroGEX e ponderando ogni strike in base a quanto è vicino al prezzo attuale. Gli strike entro circa l'1% dal prezzo hanno la maggior parte del peso, e quelli a più dell'8% di distanza non ne hanno alcuno.

Una cosa vale per tutto quanto in questa sezione: l'open interest viene pubblicato una volta al giorno. Queste letture non si muovono perché sono state aperte nuove posizioni durante la giornata. Si muovono perché il book esistente viene riprezzato man mano che prezzo, tempo e volatilità implicita cambiano.

Il grafico traccia due linee:

- **Stability** misura se il gamma vicino al prezzo è cambiato in una direzione che dovrebbe smorzare il movimento (sopra lo zero, verso il pinning) o amplificarlo (sotto lo zero, verso l'accelerazione).
- **Lean** confronta come è cambiato il gamma sotto il prezzo con come è cambiato sopra il prezzo. Sopra lo zero è **supportive**: gamma che si accumula sotto il prezzo, che si erode sopra, o entrambe le cose. Sotto lo zero è **capping**, l'opposto.

Entrambe misurano una variazione, non un livello. Una lettura orientata al pinning non significa che l'intero book sia long gamma. Significa che la struttura vicino al prezzo si è mossa in una direzione smorzante nell'arco della finestra.

L'etichetta accanto al titolo combina le due linee, divise allo zero: **Firming** (si stabilizza, di supporto), **Capping** (si stabilizza, con accumulo sopra), **Fragile bid** (di supporto ma in assottigliamento) e **Deteriorating** (in assottigliamento e con effetto tetto). Gamma Weather, più sotto, classifica la stessa lettura di Stability con una banda piatta, quindi il grafico può dire Firming mentre la striscia Weather dice Flat. Non è una contraddizione: una piccola lettura positiva è entrambe le cose.

---

## Gamma Weather: la striscia in alto

**Gamma Weather** è la lettura combinata in cima alla pagina. Mostra uno stato principale, da quanto tempo quello stato persiste, un riepilogo di una frase e cinque chip: **Pressure now**, **Lean**, **Stability**, **Gamma trend** e **Flip cushion**. Fai clic su un chip qualsiasi per aprire un grafico di quel campo per la sessione, con la traccia dei momenti in cui è cambiato.

Weather legge sempre tutte le scadenze monitorate, e legge la barra più recente che abbia sia il flusso di hedging sia una lettura della struttura.

### Pressure now

**Pressure now** trasforma l'ultima barra e la sua media a 15 minuti in una direzione, e la regola è più severa di quanto suggeriscano le etichette:

- **Buying:** l'ultima barra e la media a 15 minuti sono entrambe positive, e almeno una delle due supera i 25 milioni di $.
- **Selling:** l'immagine speculare.
- **Mixed:** qualsiasi altro caso. Le due non concordano, una delle due è esattamente zero, entrambe restano entro i 25 milioni di $, oppure non c'è ancora abbastanza storico. Le prime due barre di ogni sessione indicano Mixed.

Mixed non equivale a tranquillo. Significa che la spinta immediata e quella sulla finestra breve non concordano abbastanza da indicare una direzione. La soglia di 25 milioni di $ è la stessa per ogni simbolo, quindi su SPX è un'asticella più bassa che su SPY o QQQ.

Accanto alla direzione, il chip mostra quanto è consolidata:

- **Pulse:** il primo indizio, non ancora una condizione.
- **Building:** due delle ultime tre barre superano i 25 milioni di $ in quella direzione, e lo stesso fa la media a 15 minuti.
- **Persistent:** lo fanno tutte e tre le barre.
- **Reversed:** compare sulla sola barra in cui un lato consolidato cede, dopo due barre dall'altra parte. Mentre questo è in sospeso, compare un chip **Pressure reversing · 1/2**.

### Lean, Stability e Gamma trend

**Lean** è il Lean a 30 minuti del grafico, letto in base al segno: qualsiasi lettura pari a zero o superiore è Supportive.

**Stability** è la Stability a 30 minuti del grafico con una banda di 50 milioni di $ attorno allo zero: **Pinning** sopra +50 milioni di $, **Accelerative** sotto −50 milioni di $, **Flat** nel mezzo. Come la soglia di pressione di 25 milioni di $, la banda è la stessa per ogni simbolo.

**Gamma trend** è la stessa misura di Stability presa rispetto alla prima barra della sessione invece che a 30 minuti fa: **Building**, **Thinning** o **Flat**. Questo ti dà due orologi. Gamma trend Building accanto a Stability Accelerative non è una contraddizione: può significare che la struttura è migliorata prima nel corso della giornata ed è ancora in vantaggio rispetto all'apertura, ma ha iniziato a deteriorarsi di recente.

### Flip cushion

Il **Flip cushion** è la distanza tra il prezzo e il gamma flip modellato da ZeroGEX, in punti, da qualunque lato si trovi il prezzo. Il chip mostra la distanza con la sua direzione, per esempio "4 pts · Narrowing". La riga sotto i chip aggiunge da quale lato del flip si trova il prezzo, la banda e la variazione negli ultimi 5 e 15 minuti.

I soli punti avrebbero un significato diverso su ogni simbolo, quindi la banda classifica il cuscinetto rispetto al range tipico a 30 minuti del sottostante, cioè il range mediano tra massimo e minimo delle finestre da 30 minuti negli ultimi cinque giorni di calendario:

| Cuscinetto rispetto al range tipico a 30 minuti | Banda |
|---|---|
| Fino a 0,25× | Crossing |
| Fino a 0,60× | Thin |
| Fino a 1,25× | Normal |
| Oltre 1,25× | Secure |

La direzione indica **Narrowing**, **Widening** o **Steady** negli ultimi 15 minuti. Contano due dettagli:

- Narrowing significa che la distanza si è ridotta. Non vuol dire necessariamente che il prezzo si sia mosso verso una linea fissa, perché anche il flip si muove.
- Il cuscinetto non ha segno. Quando il prezzo attraversa il flip, il cuscinetto si restringe fino a zero e poi si allarga di nuovo dall'altra parte. Un Widening subito dopo un attraversamento non significa che le condizioni siano diventate più sicure.

Quando la banda è Thin o Crossing e il cuscinetto si è ridotto, nell'arco di 15 minuti, di almeno un quarto dello spazio che resta, il chip indica **Thin and closing** e sulla striscia compare un flag **Transition risk**.

### Come viene deciso lo stato principale

Lo stato principale combina solo due chip, Pressure now e Stability:

| Pressure now | Stability | Gamma Weather |
|---|---|---|
| Mixed | Qualsiasi | Mixed |
| Buying | Pinning o Flat | Stable bid |
| Buying | Accelerative | Fragile rally |
| Selling | Pinning o Flat | Supported dip |
| Selling | Accelerative | Unstable |

Un nuovo stato deve comparire su due barre da cinque minuti consecutive prima di sostituire lo stato principale attuale, e la più recente delle due può essere ancora in formazione. Durante l'attesa, la striscia lo mostra come in formazione, per esempio **Fragile rally forming · 1/2**. Una volta che uno stato occupa la posizione principale, la sua età indica **New**, poi **Established** a 15 minuti, **Confirmed** a 30 e **Mature** a 60.

Lean, Gamma trend, il Flip cushion, Session pressure e il prezzo non decidono lo stato principale. Sono il contesto attorno a esso. Il cuscinetto, in particolare, qualifica lo stato; non è mai in competizione con esso.

I nomi non sono affermazioni sul prezzo. "Fragile rally" non richiede che il prezzo sia in rialzo: significa pressione in acquisto su una struttura diventata accelerativa. "Supported dip" non richiede un calo visibile: significa pressione in vendita su una struttura che tiene o si sta rafforzando. Leggi Weather come una descrizione di come interagiscono la spinta attuale e la struttura attuale, non come una previsione.

---

## Leggere un esempio dal vivo

![Hedging Flow di SPY alle 14:56 ET del 28 settembre 2026: Gamma Weather, le quattro card, il grafico Pressure rate e la struttura del gamma dei dealer](/blog/zerogex-hedging-flow-spy-2026-09-28-cropped.png)

Ecco SPY alle 14:56 ET del 28 settembre 2026, catturato con il pulsante snapshot della pagina. Ogni sessione passata è archiviata nelle [sessioni di Hedging Flow](/hedging-flow/sessions), con una pagina datata per ogni simbolo. Fai clic sull'immagine per vederla più grande. I livelli di prezzo qui sotto sono letti dal grafico, quindi considerali approssimativi.

**Le card.** Session pressure indica −4,76 miliardi di $: una vendita stimata di 4,76 miliardi di $ di SPY implicata dai trade di opzioni classificati della giornata. Entrambi i book hanno contribuito in misura quasi uguale, −2,50 miliardi di $ dalle call e −2,26 miliardi di $ dalle put. Secondo il modello, si tratta di clienti che vendono call e comprano put, ed entrambe le cose implicano una copertura che vende.

**Il prezzo non ha seguito il totale.** SPY ha aperto vicino a 767,75 $, ha toccato circa 768,40 $ prima delle 10:00, poi è scivolato a circa 763,95 $ entro le 10:51, e la serie più pesante di barre in vendita è arrivata proprio durante quel calo. Ha recuperato tutto entro le 12:25 e, a parte un picco fino al massimo di giornata vicino a 768,80 $ alle 13:10, ha passato il pomeriggio tra circa 766,40 $ e 767,50 $. Al momento dello snapshot si trovava a meno di un dollaro dal suo primo print. I due scatti bruschi, intorno alle 12:20 e alle 13:10, sono arrivati con le barre in acquisto più grandi della giornata, e il secondo è rientrato subito, accanto a una grossa barra in vendita. Il totale è rimasto profondamente negativo mentre il prezzo tornava completamente indietro, ed è questo il motivo per tenere separati Session pressure e Pressure rate: il primo dice dove è stato il tape, non dove deve andare il prezzo.

**Lo storico di Weather.** Il pannello a scomparsa di Pressure now colora ogni barra in base allo stato di Weather di quel momento: Mixed per tutta la prima ora, Unstable durante il calo di tarda mattinata, Supported dip mentre il prezzo costruiva una base vicino a 765 $, Stable bid durante il rally di mezzogiorno, e diversi cambi da allora.

**In questo momento.** La media a 3 barre è passata in acquisto alle 14:45, ed è ciò che mostra la card Last flip. Era il 13° flip segnato dal grafico quel giorno: un tape nervoso, secondo questa misura. La pressione in acquisto con un chip Stability su Flat ha portato lo stato principale a **Stable bid**, che durava da 10 minuti. Ma la barra delle 14:55, vecchia di circa un minuto quando è stato preso lo snapshot, stava già stampando dal lato delle vendite. Pressure now indica Mixed, **Mixed forming · 1/2** mostra il candidato, e **Pressure reversing · 1/2** mostra che il lato degli acquisti ha iniziato a cedere da una barra. L'intestazione passa a Mixed solo se la barra successiva conferma, e quella barra vecchia di un minuto può ancora cambiare prima di chiudersi.

**Struttura.** Stability è Flat: la variazione a 30 minuti del gamma vicino al prezzo resta entro 50 milioni di $ in entrambe le direzioni. Lean è Supportive. L'etichetta del grafico indica Fragile bid per le stesse due letture, perché divide allo zero e Stability si trova un soffio sotto mentre Lean si trova un soffio sopra. Gamma trend è Thinning: il gamma vicino al prezzo si è assottigliato dall'apertura. Le linee della struttura hanno fatto i loro movimenti più ampi quando li ha fatti il prezzo, con entrambe sotto −1,2 miliardi di $ al minimo delle 10:50 e Stability vicino a +1,35 miliardi di $ al massimo delle 12:25. È coerente con un book fisso che viene riprezzato mentre il prezzo lo attraversa.

**Flip cushion.** SPY si trova circa 3 punti sotto il gamma flip modellato, Secure e in lento allargamento. Sotto il flip è il lato che la nostra [guida al gamma flip](/education/how-to-read-a-gamma-flip) descrive come generalmente short gamma, dove l'hedging tende ad amplificare i movimenti, e "Secure" dice che al prezzo servirebbe più del range tipico di mezz'ora per raggiungere il flip. Non dice che le condizioni siano calme. Weather legge la variazione del book nell'ultima mezz'ora; il cuscinetto legge in quale regime si trova il prezzo. Qui puntano in direzioni diverse: uno stato principale Stable bid, nel regime amplificante.

**Mettendo tutto insieme:** una giornata di pesanti vendite di copertura stimate, più evidenti nel calo di tarda mattinata, da cui il prezzo si è poi completamente ripreso; una spinta passata in acquisto alle 14:45 e già vacillante alle 14:55; una struttura vicino al prezzo ora piatta e più sottile che all'apertura; e il prezzo comodamente sul lato amplificante del flip. È una lettura molto diversa da "−4,76 miliardi di $, quindi ribassista".

---

## Come usarlo

Hedging Flow funziona meglio come contesto per un'idea di trading, non come l'idea in sé.

Prendi un test di un put wall. Con Pressure now su Buying, Stability su Pinning e il cuscinetto in allargamento, quel test avviene in un contesto molto diverso rispetto allo stesso wall testato con pressione Selling, Stability Accelerative e un cuscinetto sottile e in chiusura. Il livello non è cambiato. Sono cambiate le condizioni intorno a esso. Lo stesso vale per il VWAP, il range di apertura, il gamma flip e i call e put wall.

La pagina si inserisce in una sequenza semplice:

1. **Dove sono i livelli?** Rispondono i livelli gamma di ZeroGEX.
2. **Verso dove spinge il tape delle opzioni in questo momento?** Hedging Flow.
3. **È probabile che la struttura attorno al prezzo assorba quella spinta o la amplifichi?** Dealer gamma structure e Gamma Weather.

Hedging Flow è inoltre diverso da Forced Flow, sebbene i due condividano unità e convenzione di segno. Hedging Flow legge i trade di oggi e dice quale pressione hanno creato. Forced Flow legge il book esistente e si chiede quale pressione creerebbe con un movimento di prezzo, tempo o volatilità.

---

## Una nota sull'interruttore 0DTE only

L'interruttore **0DTE only** limita la parte della pagina dedicata al flusso ai contratti che scadono quel giorno: le quattro card, il grafico del flusso, i suoi marcatori di flip e il badge, e il grafico all'interno del pannello a scomparsa di Pressure now. Lo stato principale e i chip di Gamma Weather e il grafico Dealer gamma structure non cambiano. Leggono sempre tutte le scadenze monitorate, perché la struttura è una proprietà dell'intero book, e ciò vale anche per la pressione dietro il chip Pressure now.

Per il riferimento pagina per pagina, vedi la [pagina di aiuto di Hedging Flow](/help/platform/hedging-flow). Per la meccanica che c'è dietro, vedi [Perché i market maker scambiano azioni](/education/why-market-makers-trade-stock), [Cos'è un gamma flip?](/education/how-to-read-a-gamma-flip) e [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.
