# Come tradare intorno ai livelli di Gamma Flip

*Il gamma flip è una delle singole linee di regime più nette nell'analisi del posizionamento dei dealer. Ecco come tradare intorno a esso - cosa tende a cambiare quando lo spot lo attraversa, i tre tipi di setup che ogni regime supporta, e il workflow per usare il flip come cambio di playbook piuttosto che come segnale direzionale.*

---

## Il flip non è un livello - è un cambio di playbook

La maggior parte dei trader retail che sente parlare di "gamma flip" lo tratta come un'ennesima linea di supporto/resistenza. Comprare al flip; vendere al flip; tradare il rimbalzo. Questa impostazione non coglie cosa sia realmente il flip. Il flip non è un livello che il prezzo rispetta - è un **confine di regime**, una lettura modellata di quale playbook il meccanismo di hedging dei dealer stia più probabilmente supportando oggi.

Sopra il flip, il riflesso modellato del dealer è vendere sulla forza e comprare sulla debolezza. I playbook di mean-reversion hanno dalla loro parte l'hedging modellato: i movimenti tendono a essere smorzati, i pin possono formarsi e la volatilità tende a comprimersi.

Sotto il flip, il riflesso modellato cambia segno. Si assume che il book dei dealer amplifichi i movimenti invece di smorzarli, quindi i playbook di continuazione del trend hanno dalla loro parte l'hedging: una rottura che avviene davvero viene rafforzata dall'hedging, i pin si rompono, la volatilità si espande. È la tendenza del modello, non una garanzia - il comportamento effettivo dipende comunque da flusso, liquidità, volatilità e catalizzatori. E una cosa che, nella nostra misurazione, il flip non ha cambiato è la frequenza con cui i wall si sono rotti: i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora da un test, sia sopra sia sotto di esso ([Quanto spesso si rompono davvero i gamma wall?](/education/how-often-do-gamma-walls-break)).

Questo non è "supporto e resistenza al flip". Sono due playbook diversi per lo stesso grafico, a seconda di quale lato di un preciso prezzo ti trovi. Tradare bene intorno al flip significa cambiare playbook all'incrocio - non tradare un livello.

Questo articolo copre il workflow. Per l'approfondimento concettuale su cosa sia il flip e come leggerlo, vedi [Cos'è un gamma flip?](/education/how-to-read-a-gamma-flip); per la meccanica sottostante, il [pilastro sulla Gamma Exposure](/education/gamma-exposure-explained).

---

## I tre setup supportati da ciascun regime

### Sopra il flip (regime long-gamma)

**Setup tipo 1: Fadare gli estremi verso il magnete.**
Il riflesso modellato del dealer tende ad attirare il prezzo verso gli strike a gamma pesante. Vendere sui push vicino al call wall e comprare sui ritracciamenti vicino al put wall può avere un supporto strutturale quando il flusso di hedge modellato è dalla tua parte. Dimensiona la posizione in piccolo; prendi profitto al magnete.

**Setup tipo 2: Fadare i breakout falliti.**
Quando SPX buca sopra il call wall ma il Net GEX è positivo e in rafforzamento, l'hedging modellato si sta opponendo alla rottura. Questo è il meccanismo, non le probabilità: nella nostra misurazione, né il regime né la traiettoria del Net GEX hanno permesso di prevedere quali wall si sarebbero rotti. Il fade - short sulla rottura, target di rientro nel range precedente - è il trade canonico da long-gamma. Il segnale di Trap Detection esiste proprio per questa lettura; vedi l'[articolo combinato su EOD Pressure e Trap Detection](/education/eod-pressure-and-trap-detection).

**Setup tipo 3: Vendita di premio intorno al magnete gamma.**
Il comportamento da pin in un regime a gamma positivo tende a comprimere la volatilità realizzata. Vendere premio near-the-money contro lo strike magnete può funzionare - anche se è un trade a rischio definito, non un lock strutturale. Dimensiona in modo adeguato per il rischio di coda.

### Sotto il flip (regime short-gamma)

**Setup tipo 1: Breakout di continuazione.**
In questo regime modellato i dealer tendono a comprare sulla forza e a vendere sulla debolezza - il riflesso estende i movimenti. Comprare una rottura netta sopra la resistenza (specialmente con Net GEX chiaramente negativo) può avere un vento a favore strutturale. Il segnale Squeeze Setup assegna un punteggio proprio a questo tipo di setup compresso e in estensione; vedi [Segnale Squeeze Setup spiegato](/education/squeeze-setup-explained).

**Setup tipo 2: Non prendere il coltello che cade.**
Lo stesso riflesso che amplifica i rally amplifica anche i selloff. Provare a comprare setup da "coltello che cade" in un regime short-gamma profondo tende ad amplificare le perdite, perché il meccanismo dei dealer che avrebbe prodotto il rimbalzo in regime long-gamma qui è invertito. La tesi del dip-buy perde specificamente il suo supporto strutturale sotto il flip.

**Setup tipo 3: Tradare nella direzione del flusso, non contro.**
Il Tape Flow Bias e segnali di continuazione simili hanno più peso nei regimi short-gamma. Quando il flusso pesato per premio pende in una direzione e il Net GEX è negativo, l'hedging rafforza il movimento invece di opporvisi.

---

## Come usare davvero il flip nell'intraday

Un workflow breve:

### Step 1: Controlla il regime all'apertura

Prima di qualsiasi setup, verifica il gamma flip e il Net GEX. Prendi nota del gamma magnet e dei wall. La posizione dello spot rispetto al flip è la prima lettura della giornata - e l'aspettativa di playbook dovrebbe seguirne.

### Step 2: Imposta un trigger di "cambio regime"

Se lo spot attraversa il flip durante la sessione, il tuo playbook di default si ribalta. L'attraversamento del flip modellato suggerisce che la tendenza aggregata dell'hedging secondo il modello abbia cambiato segno - quindi un trader che ha fadato i rally per due ore sopra il flip dovrebbe essere molto più cauto nel momento in cui lo spot scende sotto, perché quel trade potrebbe non avere più alle spalle il riflesso modellato. Il comportamento realizzato dipende comunque da flusso, liquidità, volatilità e catalizzatori.

### Step 3: Osserva la distanza, non solo il lato

Uno spot che siede 0,05% sopra il flip è strutturalmente conteso - i contributi modellati positivi e negativi si compensano quasi del tutto. Uno spot a 0,4% sopra è saldamente long-gamma. La distanza dal flip fa parte della lettura. La zona contesa (ZeroGEX segnala circa ±0,1% del flip) è l'ambiente a più alto rumore; riduci la size o resta fuori.

### Step 4: Osserva la migrazione del flip

Il flip si muove durante la giornata mentre il posizionamento si ribilancia. Un flip che sale mentre il prezzo macina più in alto è una lettura; un flip fermo mentre il prezzo sale sopra di esso è un'altra. La relazione tra prezzo e flip è dinamica - tieni traccia del *cambiamento* nel gap, non solo della distanza statica.

### Step 5: Verifica incrociata con la magnitudine del Net GEX

Un flip con 1,5 miliardi di dollari di Net GEX sopra è un regime netto; un flip con 200 milioni di dollari è un regime debole. (Il Net GEX è il gamma dei dealer modellato secondo la tradizionale convenzione call-positive/put-negative, non un inventario osservato.) La magnitudine conta quanto il segno - più grande è il book modellato, più il riflesso di regime tende a manifestarsi nel tape.

---

## Quando il flip è conteso

Lo stato più pericoloso è lo spot che siede *esattamente sul* flip. La tendenza netta dell'hedging modellato è debole, e piccole variazioni dello spot o degli input del modello possono cambiarne il segno. I trade che funzionano sopra il flip non funzionano; i trade che funzionano sotto non funzionano nemmeno loro. In pratica:

- Riduci la size della posizione o resta fuori.
- Non impegnarti in un unico playbook di regime.
- Osserva su quale lato del flip si assesta il prezzo - la risposta ti dice quale playbook eseguire dopo.
- Sii particolarmente cauto verso la chiusura, quando i flussi legati al charm possono spingere lo spot attraverso il flip e spostare il regime modellato.

Un flip conteso è un segnale di incertezza di regime. La risposta giusta è ridurre l'esposizione, non fare un trade diverso.

---

## Esempio pratico

SPX è a 5.810 all'apertura. ZeroGEX mostra:

- **Gamma Flip:** 5.802 (spot è +8 sopra)
- **Net GEX:** +1,2 miliardi di dollari
- **Call Wall:** 5.820
- **Put Wall:** 5.790

Lettura iniziale: regime long-gamma, posizionamento sano, range strutturale 5.790-5.820. Playbook di default: fadare gli estremi (vendere sui push verso 5.820, comprare i ritracciamenti verso 5.790), evitare la parte centrale.

Alle 13:00 ET, SPX è scivolato a 5.806 e il flip è salito a 5.803 - i due sono quasi convergiti. Il Net GEX si è ridotto a +300 milioni di dollari. Il regime è conteso - lo spot è appena sopra il flip, la magnitudine si sta riducendo, e il riflesso strutturale si sta indebolendo.

Il playbook cambia. Il setup di fade-the-rally che era attivo all'apertura ha perso gran parte del sostegno dell'hedging, e una continuazione al rialzo avrebbe l'hedging dalla sua parte se il Net GEX diventasse negativo. La size della posizione dovrebbe ridursi; il trade di default è nessun trade finché il regime non si risolve.

Alle 14:30 ET, il Net GEX è passato a −200 milioni di dollari e SPX è salito a 5.815. Questo è ora un regime short-gamma modellato - si assume che il riflesso del dealer amplifichi - quindi, se il call wall a 5.820 cede, l'hedging rafforza la rottura invece di opporvisi. Nella nostra misurazione il regime non ha cambiato la frequenza con cui i wall si sono rotti, quindi non è meno probabile che 5.820 tenga rispetto all'apertura; ciò che è cambiato è il costo dell'errore. Ora, con un fade fallito, il prezzo può spingersi più lontano, quindi il trade fade-the-breakout perde il suo cuscinetto e, se il setup è corretto, l'inseguimento ha l'hedging dalla sua parte.

Stesso grafico, tre playbook diversi nell'arco della sessione - guidati in gran parte dalla variabile di regime modellata.

---

## Errori comuni

- **Trattare il flip come supporto o resistenza.** È una linea di regime, non un livello. Comprare la debolezza *verso* il flip dall'alto è strutturalmente diverso dal comprarla dal basso. Lo stesso entry sul grafico ha un meccanismo opposto dietro.
- **Ignorare il flip quando lo spot ne è lontano.** Anche se lo spot è 1% sopra il flip, il flip conta ancora per il contesto - ti dice in quale regime si trova il playbook di oggi. Il flip non conta solo quando il prezzo gli è vicino.
- **Trattare la persistenza del regime come inevitabile.** I regimi long-gamma possono ribaltarsi in short-gamma in un'ora. Il flip è dinamico. Una lettura di regime di stamattina può essere superata entro pranzo.
- **Tradare l'incrocio del flip come un setup da rimbalzo.** L'incrocio del flip è un *segnale di playbook*, non un segnale di rimbalzo. A volte il prezzo rimbalza su di esso; spesso lo buca. Non tradare il livello - trada il cambio di regime.

---

## Conclusione

> Il gamma flip non è un livello di prezzo contro cui tradare. È un cambio di playbook - la linea dove il riflesso di hedging dei dealer si inverte. Tradare bene intorno a esso significa cambiare quali setup prendi, non cambiare i tuoi entry.

La disciplina consiste nel controllare il regime prima di ogni setup e ricontrollarlo a ogni incrocio del flip. Il playbook che ha vento a favore strutturale su un lato del flip è il playbook che viene schiacciato sull'altro. La maggior parte dei trader che perdono soldi "tradando il flip" in realtà perde soldi eseguendo il playbook sbagliato per il regime.

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere il gamma flip di oggi con la sua distanza dallo spot, il check del regime e la magnitudine del Net GEX - i tre numeri che decidono quale playbook la forza strutturale nel tape sta supportando in questo momento - [la vista gratuita dei livelli gamma di ZeroGEX](/spx-gamma-levels) li mostra tutti, con un ritardo di circa 15 minuti; i piani a pagamento li mostrano [sulla dashboard GEX 0DTE in tempo reale](/real-time-gex-0dte).
