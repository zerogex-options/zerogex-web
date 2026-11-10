# Forced Flow e zero flow spiegati: dove l'hedging netto dei dealer si azzera

*La gamma exposure ti dice che forma ha l'hedging dei dealer. Forced Flow ci mette sopra una cifra in dollari e una scadenza: quante azioni il book di opzioni attuale obbligherebbe chi si copre a comprare o vendere se si muovono il prezzo, il tempo o la volatilità implicita. Il livello zero-flow trasforma quella cifra in un prezzo: l'unico livello di spot in cui tutto si annulla.*

---

## Una domanda che la maggior parte degli strumenti sul gamma salta

Il Net GEX e il gamma flip descrivono la forma dell'hedging dei dealer. Ti dicono se l'hedging dovrebbe opporsi a un movimento o assecondarlo, e più o meno con quanta forza per punto. Quello che non ti dicono è quante azioni sono coinvolte, in quale direzione ed entro quando, anche se il mercato non fa assolutamente nulla.

Quest'ultima parte conta più di quanto sembri. Un book di opzioni cambia il proprio delta quando il prezzo si muove, ma anche quando l'orologio corre e quando la volatilità implicita si sposta. Chi si copre e vuole restare delta-neutrale deve scambiare azioni in tutti e tre i casi. Su un indice con una grossa scadenza giornaliera, nel pomeriggio il solo orologio può arrivare a rivaleggiare con gli altri due.

Forced Flow pone direttamente quella domanda, e il livello zero-flow risponde a quella successiva: a quale prezzo il book non dovrebbe proprio nulla entro la chiusura?

Ecco come si colloca accanto agli altri due modi in cui ZeroGEX guarda all'hedging dei dealer:

| | **GEX e gamma flip** | **Hedging Flow** | **Forced Flow** |
|---|---|---|---|
| Legge | Il book esistente | I trade di oggi | Il book esistente |
| Risponde a | Come risponde l'hedging per ogni punto di prezzo | Quale copertura hanno implicato i trade di oggi | Quante azioni forzerebbe uno scenario, e dove il totale netto si azzera |
| Direzione nel tempo | Un'istantanea | All'indietro lungo la sessione | In avanti, fino alla chiusura delle 16:00 ET |
| Unità | Dollar gamma | Dollari di azioni | Dollari di azioni |

Hedging Flow e Forced Flow condividono di proposito unità e convenzione di segno, così i due si possono leggere fianco a fianco.

---

## Cos'è il flusso forzato

Si parte dalla posizione modellata dei dealer: l'open interest su ogni scadenza e ogni strike monitorati, ipotizzando che i dealer stiano dall'altra parte rispetto al cliente, net long sulle call e net short sulle put. È la stessa convenzione alla base del net GEX e del gamma flip di ZeroGEX. È un'ipotesi, non un'osservazione: i dati pubblici sulle opzioni non mostrano chi detiene cosa, e la [pagina della metodologia](/methodology) spiega dove la convenzione può sbagliare.

Da quella posizione, Forced Flow calcola due volte il delta totale del book: una volta adesso, e una volta in uno scenario (un prezzo diverso, un momento più avanti nella giornata, una volatilità implicita diversa o qualsiasi combinazione di questi). La differenza indica di quanto la copertura è andata alla deriva. Le azioni necessarie per rimetterla a posto sono il flusso forzato:

`forced flow = −(dealer delta under the scenario − dealer delta now) × scenario price`

**Positivo significa che la copertura delta-neutrale compra azioni. Negativo significa che vende.**

Due dettagli lo rendono qualcosa di più di un numero calcolato a spanne:

- **È un riprezzamento completo.** Ogni contratto viene riprezzato nello scenario, invece di essere stimato sommando gamma, charm e vanna. Sommare le greche è una buona prima approssimazione e una pessima risposta finale, perché le tre interagiscono; [Delta e i suoi tre figli](/education/delta-and-its-three-children) spiega perché.
- **Le greche vengono comunque riportate, per l'attribuzione.** La pagina scompone ogni cifra in una parte gamma (prezzo), una parte charm (tempo) e una parte vanna (volatilità), così puoi vedere cosa la sta guidando. Quando uno scenario è abbastanza estremo da far sì che la semplice scomposizione non torni più, il numero di cui fidarsi è quello del riprezzamento completo.

L'open interest viene pubblicato una volta al giorno. Nel corso della giornata, il flusso forzato non cambia perché sono state aperte nuove posizioni. Cambia perché il book esistente viene riprezzato man mano che prezzo, tempo e volatilità si muovono.

---

## Le tre leve

Forced Flow muove una leva alla volta, e la pagina le traccia una per una:

- **Prezzo.** La *curva di riprezzamento* mostra il flusso forzato a ogni prezzo entro circa il 2% dallo spot, se il sottostante chiude la sessione lì. Il tempo che manca alla chiusura è incluso, quindi la curva mostra la leva del prezzo in aggiunta a quanto l'orologio deve già.
- **Tempo, a prezzo fermo.** *Charm Into the Close* fa avanzare l'orologio da adesso alla campanella delle 16:00 con il prezzo fisso, e traccia quante azioni il solo decadimento temporale costringe i dealer a scambiare lungo il percorso. La curva si fa più ripida nell'ultima ora, man mano che le opzioni con scadenza giornaliera si risolvono. [Charm: l'orologio è un trader](/education/charm-the-clock-is-a-trader) ne spiega la meccanica.
- **Volatilità, a prezzo e tempo fermi.** La *Vanna Ladder* sposta la volatilità implicita in su e in giù, a passi di mezzo punto fino a tre punti in entrambe le direzioni, e mostra le azioni che ogni spostamento forzerebbe in questo momento. [Vanna: come il calo della IV può cambiare la copertura dei dealer](/education/vanna-when-fear-fades) spiega perché.

---

## Cos'è il livello zero-flow

La curva di riprezzamento mostra il flusso forzato a ogni prezzo, assumendo che quello sia il prezzo a cui si trova il sottostante alla chiusura. In qualche punto lungo il percorso, la curva attraversa lo zero. Quel prezzo è il **livello zero-flow**: lo spot a cui il book, portato fino alla chiusura, non deve nulla. Lì i dealer non dovrebbero comprare né vendere nulla per restare coperti.

Se l'orologio non esistesse, quel prezzo sarebbe lo spot stesso: nessun movimento, nessuna ricopertura. Il motivo per cui si trova altrove è il tempo. Con il prezzo fermo, il decadimento temporale deve già una certa quantità di azioni entro la chiusura. Il livello zero-flow è il movimento di prezzo la cui copertura compensa esattamente quella quantità.

### Un esempio pratico

Sono numeri tondi e illustrativi, non una lettura live.

SPY è a 660,00 $ a due ore dalla campanella. La curva di riprezzamento mostra **Flow at spot: buy $300M**. È ciò che deve il solo orologio se SPY chiude esattamente qui.

Vicino allo spot, il book è long gamma: per ogni dollaro di rialzo di SPY, la copertura deve vendere circa 120 milioni di $ di SPY, e per ogni dollaro di ribasso deve comprarne per circa 120 milioni di $.

Quindi, se SPY sale di 2,50 $ entro la chiusura, circa 300 milioni di $ di vendite guidate dal prezzo annullano circa 300 milioni di $ di acquisti guidati dal tempo. Il livello zero-flow è all'incirca **662,50 $**.

La regola pratica che c'è dietro:

`distance to zero flow ≈ −(flow at spot) ÷ (forced flow per $1 of price)`

È un'approssimazione del primo ordine. La pagina calcola l'attraversamento in modo esatto, riprezzando l'intero book a ogni prezzo della sua griglia, il che conta quando il movimento è ampio o il book è carico di opzioni con scadenza giornaliera.

---

## Magnete o pivot: decide la pendenza

Un livello zero-flow è un singolo prezzo, ma ciò che accade da una parte e dall'altra dipende dal verso in cui la curva è inclinata mentre lo attraversa.

Prendi l'esempio qui sopra. Sotto 662,50 $, gli acquisti guidati dal tempo superano le vendite guidate dal prezzo, quindi il book deve acquisti netti. Sopra, il contrario: vendite nette. Da entrambi i lati, l'hedging tende verso il livello. È un **magnete**, un livello zero-flow stabile.

Ora capovolgi il book e rendilo short gamma vicino allo spot: per ogni dollaro di rialzo di SPY, la copertura deve *comprare* 120 milioni di $, e supponi invece che l'orologio debba 300 milioni di $ di vendite. Lo stesso calcolo colloca il livello zero-flow sempre a 662,50 $. Ma ora, sotto di esso il book deve vendite nette, e sopra acquisti netti. Da entrambi i lati, l'hedging tende ad *allontanarsi* dal livello. È un **pivot**, un livello zero-flow instabile: un innesco più che un pin.

| Vicino al livello, i dealer sono | Sotto il livello | Sopra il livello | L'hedging tende | Sulla pagina |
|---|---|---|---|---|
| Long gamma | Acquisti netti | Vendite nette | Verso il livello | Magnete: linea blu continua sul Field |
| Short gamma | Vendite nette | Acquisti netti | Lontano dal livello | Pivot: linea ambra tratteggiata sul Field |

Lo stesso prezzo può essere l'uno o l'altro. Leggere un pivot come un magnete significa leggere l'inclinazione esattamente al contrario, ed è per questo che il Field dell'intera sessione disegna i due separatamente. Sulla curva di riprezzamento lo si vede a occhio: una curva che scende attraverso lo zero, dagli acquisti a sinistra alle vendite a destra, è un magnete; una che sale attraverso lo zero è un pivot.

Come regola pratica, sotto il gamma flip il livello zero-flow più vicino allo spot è di solito un pivot, e sopra di solito un magnete. A decidere è la pendenza nel livello stesso.

"Tende verso" e "tende ad allontanarsi" descrivono l'hedging modellato, non una promessa sul prezzo. Se il prezzo risponda davvero è una questione empirica, e la pagina la misura invece di darla per scontata (ne parliamo più sotto).

---

## Lo zero flow non è il gamma flip

La pagina traccia quattro livelli sul suo rail, e rispondono a quattro domande diverse:

- **Gamma flip:** il prezzo in cui il gamma netto modellato dei dealer cambia segno. Segna il confine tra il regime in cui l'hedging smorza i movimenti (sopra) e quello in cui li amplifica (sotto). Vedi [Cos'è un gamma flip?](/education/how-to-read-a-gamma-flip)
- **Livello zero-flow:** il prezzo in cui il flusso forzato totale, portato fino alla chiusura, si azzera al netto. Include il tempo nel quadro, cosa che il gamma flip non fa.
- **Charm flip:** il prezzo a cui il decadimento temporale verso la chiusura cambia segno. Da un lato, l'orologio forza acquisti; dall'altro, vendite.
- **Vanna flip:** il prezzo a cui cambia segno la copertura forzata da un rialzo di un punto della volatilità implicita.

Il gamma flip dice che tipo di hedging aspettarsi. Il livello zero-flow dice dove, tenuto conto dell'orologio, quell'hedging si compensa al netto. Possono trovarsi vicini o lontani, e l'uno non sostituisce l'altro.

---

## Come si muove lo zero flow durante la giornata

L'orizzonte è sempre "da adesso alla chiusura di oggi delle 16:00 ET", quindi il livello zero-flow è per costruzione un bersaglio mobile:

- **L'orologio accorcia l'orizzonte.** Al mattino, il livello incorpora un'intera sessione di decadimento. A fine giornata incorpora solo ciò che resta. Alle 16:00 l'orizzonte è zero, l'orologio non ha più nulla da dovere e il livello collassa sullo spot. Dopo la campanella non porta alcuna informazione fino alla sessione successiva.
- **Il riprezzamento rimodella la curva.** Man mano che prezzo, volatilità implicita e tempo si muovono, il delta di ogni contratto cambia, e con esso la pendenza della curva e il punto in cui attraversa lo zero. L'open interest resta fisso fino alla pubblicazione del giorno successivo.
- **Il Field conserva lo storico.** Il Field dell'intera sessione, sulla pagina, ricostruisce il book com'era effettivamente in ogni momento della sessione, così puoi vedere dove si trovavano il magnete e il pivot alle 10:00, a mezzogiorno e adesso, rispetto al prezzo effettivamente stampato. A destra di "now", porta il book attuale in avanti fino alla chiusura come proiezione.

---

## Cosa questi numeri non sono

**Non è flusso osservato.** Il flusso forzato è un modello di ciò che richiederebbe una copertura delta-neutrale, costruito su un'ipotesi riguardo a chi detiene l'open interest. ZeroGEX non vede l'inventario dei dealer, e i desk reali compensano le posizioni tra più book, si coprono con altri strumenti e ribilanciano per bande anziché in modo continuo. Una cifra di +300 milioni di $ significa che la copertura del modello comprerebbe circa 300 milioni di $. Non significa che qualcuno lo farà.

**Non è un target di prezzo.** Il livello zero-flow è il punto in cui la copertura modellata si azzera al netto. Non è dove il prezzo deve andare, e un magnete non fa arrivare il prezzo. L'hedging è una fonte di order flow tra le tante, e in una giornata con un catalizzatore macro o un ribilanciamento di un indice raramente è la più grande.

**Non è un edge misurato, per ora.** ZeroGEX non ha pubblicato uno studio su più sessioni riguardo a quanto spesso il prezzo chiuda vicino al livello zero-flow. Ciò che la pagina misura è più circoscritto, ed è mostrato con onestà:

- il Field dell'intera sessione conta, all'interno della sessione di oggi, quanto spesso il prezzo si è mosso verso il magnete (o lontano dal pivot) da un passo al successivo. Questo descrive oggi. Non è una previsione per domani;
- il **Track Record** in fondo alla pagina valuta la previsione del charm su più sessioni. Non valuta il segno grezzo di acquisto o vendita, che per il book di un indice indica "buy" quasi ogni giorno e quindi non farebbe che ristampare il tasso di base. Valuta se una lettura mattutina del charm più forte o più debole della propria normalità recente tende nella stessa direzione del movimento da mezzogiorno alla chiusura. Mostra il tasso di successo rispetto a una baseline ingenua, con una banda di confidenza del 95%, e certifica un edge solo dopo almeno 30 sessioni valutate. Leggi il suo verdetto prima di appoggiarti alla previsione. Finché non indica **Significant at 95%**, considerala non dimostrata.

---

## Leggere la pagina Forced Flow nell'ordine

La pagina è organizzata come un verdetto seguito dalle sue prove:

1. **The Read** riassume in una frase il regime, il flusso verso la chiusura e il livello zero-flow, con tre riquadri sotto.
2. **Il Forced-Flow Rail** traccia gamma flip, charm flip, vanna flip e livello zero-flow rispetto allo spot.
3. **La curva di riprezzamento** mostra la leva del prezzo e il punto in cui la curva attraversa lo zero.
4. **Charm Into the Close** e la **Vanna Ladder** mostrano le leve del tempo e della volatilità.
5. **Il Forced-Flow Field** mostra l'intera sessione: il dato reale a sinistra di "now", la proiezione a destra, con il magnete e il pivot tracciati al suo interno e il prezzo realizzato sovrapposto.
6. **Il Track Record** valuta la previsione del charm.

La [pagina di aiuto di Forced Flow](/help/platform/forced-flow) è il riferimento pannello per pannello, compresi alcuni numeri che sembrano simili ma sono calcolati in modo diverso.

---

## Come usarlo

Forced Flow funziona meglio come contesto attorno a un livello o a un'idea che hai già, non come l'idea in sé. Alcune combinazioni si leggono in modo chiaro:

- **Tutto è allineato.** Long gamma vicino allo spot, un magnete qualche punto più sopra e l'orologio che deve acquisti verso la chiusura. L'hedging modellato tende nella stessa direzione su ogni leva. È un quadro coerente, e dipende comunque dal fatto che nulla di più grande arrivi sul tape.
- **Un pivot vicino allo spot.** Il livello è un innesco, non un target. Conta da quale lato si trova il prezzo, perché la spinta modellata cambia direzione quando il prezzo lo attraversa.
- **Le leve sono in disaccordo.** L'orologio deve acquisti, ma il prezzo si trova appena sotto un pivot dove la leva del prezzo forza vendite. Il modello non dà una direzione univoca, e la lettura onesta è che la pressione di hedging è mista.
- **Nella parte finale di un giorno di scadenza.** Su un book 0DTE pesante, buona parte della cifra verso la chiusura può concentrarsi nell'ultima ora, e The Read dice quanto. È il momento in cui la quota dell'hedging dovuta all'orologio è massima, e anche quello in cui gli altri flussi di chiusura sono massimi.

Abbinalo a [Hedging Flow](/education/hedging-flow-explained). Forced Flow dice cosa forzerebbe il book in uno scenario. Hedging Flow stima cosa hanno effettivamente creato i trade di oggi. Grandi acquisti forzati verso la chiusura con il tape che spinge già nella stessa direzione sono un setup diverso dalla stessa cifra con il tape che va in senso contrario.

Per le basi, vedi [Perché i market maker scambiano azioni](/education/why-market-makers-trade-stock), [Delta e i suoi tre figli](/education/delta-and-its-three-children) e [Perché non pubblichiamo il DEX](/education/why-we-dont-publish-dex). Per vedere i numeri di oggi, apri la pagina live di [Forced Flow](/forced-flow).

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.
