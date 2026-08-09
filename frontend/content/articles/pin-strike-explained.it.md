# Pin Strike spiegato: il pin gamma 0DTE raggiungibile
> **Nota metodologica aggiornata — prevale su eventuali formulazioni incompatibili più avanti nella pagina.** ZeroGEX stima, ma non osserva, l’inventario dei dealer dai dati pubblici. Il modello conserva la convenzione call-positive/put-negative (`Net GEX = Call GEX − Put GEX`): i dealer sono ipotizzati net long call e net short put. Call e put long hanno gamma positivo; call e put short hanno gamma negativo. Il Put Wall è la maggiore concentrazione di gamma put sotto lo spot e rappresenta localmente gamma dealer negativo: può coincidere con supporto, ma la copertura della put short non crea meccanicamente un pavimento. I wall possono migrare con spot, tempo e volatilità implicita anche quando l’open interest ufficiale non cambia intraday. Verso la scadenza il gamma si concentra vicino all’ATM: il gamma ATM può aumentare, mentre quello decisamente ITM o OTM tende a zero. Il Gamma Flip selezionato è un passaggio locale; il profilo può avere più passaggi o nessun passaggio significativo. Charm e vanna descrivono variazioni condizionali del delta, non ordini programmati. I punteggi sono output euristici, non probabilità calibrate. Il gamma negativo amplifica la direzione già in corso: la distanza da un target non implica repulsione, quindi l’inversione del termine pin di EOD Pressure resta un’euristica ZeroGEX. Max Pain minimizza il payout intrinseco aggregato, non massimizza esattamente il nozionale che scade senza valore. Il DEX grezzo misura delta delle sole opzioni, non il futuro flusso di copertura; premio e lato aggressore non provano informazione, apertura o convinzione.


*Pin Strike è lo strike 0DTE raggiungibile con la più forte stabilizzazione modellata da gamma dei dealer positiva verso la scadenza. Cos'è, come è costruito, perché deliberatamente non è "lo strike a gamma più grande" e perché gli è consentito non restituire nessun pin attivo.*

---

## Il problema che Pin Strike cerca di risolvere

Nelle ultime ore di una sessione 0DTE, una domanda domina il tape: *se il prezzo va alla deriva, dove tende ad assestarsi?* I trader ricorrono a un assortimento di livelli per rispondere — il call wall, il put wall, il max pain, lo strike a gamma più grande — e ciascuno risponde a una domanda leggermente diversa, nessuno esattamente a quella che si sta ponendo.

Pin Strike è una risposta costruita appositamente per quella domanda specifica. Stima lo strike vicino con la combinazione più forte di due elementi:

1. **Gamma dei dealer stabilizzante *a quello strike*** — la copertura dei dealer lì si opporrebbe *ai* movimenti (riportando indietro il prezzo), e
2. **Raggiungibilità** — il prezzo può realisticamente arrivare a quello strike, e chiudere vicino ad esso, prima della chiusura 0DTE?

Entrambe le metà contano, e la seconda è ciò che rende Pin Strike diverso da ogni altro livello sul tabellone. Uno strike può portare un'impronta di gamma enorme ed essere comunque un pessimo candidato al pin se il prezzo non ha alcuna possibilità realistica di raggiungerlo entro la campanella. Pin Strike è costruito per declassare quei giganti irraggiungibili e far emergere il nodo raggiungibile attorno a cui il prezzo può effettivamente organizzarsi.

Se le meccaniche sottostanti ti sono nuove, il [pilastro sulla Gamma Exposure](/education/gamma-exposure-explained) spiega come la gamma dei dealer guida la copertura, [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip) tratta la linea di regime, e [Max Pain spiegato](/education/max-pain-explained) copre l'idea del magnete a scadenza con cui Pin Strike viene spesso confuso. Questo articolo dà per assunto quel contesto e ci costruisce sopra.

---

## Cos'è un pin, meccanicamente?

Un "pin" è un equilibrio che si auto-rafforza, creato dalla copertura delta dei dealer in un intorno a **gamma positiva**. Vale la pena enunciare il meccanismo con precisione, perché Pin Strike è un tentativo diretto di misurarlo.

Quando i dealer sono net long gamma attorno a uno strike, la loro copertura è *stabilizzante*: man mano che il prezzo sale verso lo strike devono vendere il sottostante, e man mano che scende verso di esso devono comprare. Quella copertura si oppone al movimento da entrambi i lati — è una forza di richiamo che riporta il prezzo verso il nodo e smorza la volatilità realizzata attorno ad esso. Più quella gamma positiva è pesante e concentrata, più forte è la forza di richiamo, e più il prezzo tende a rimanere "bloccato" vicino allo strike verso la scadenza.

Il regime opposto conta altrettanto. Quando i dealer sono net *short* gamma attorno a un livello, la copertura è *destabilizzante* — vendono nella debolezza e comprano nella forza, amplificando i movimenti anziché smorzarli. Un intorno a gamma corta non può pinnare; fa il contrario. Quindi la materia prima di un pin è specificamente **gamma dei dealer netta positiva e concentrata localmente** — non la gamma in generale, e non la gamma altrove sulla catena.

Un'avvertenza onesta in apertura, la stessa che vale per ogni lettura del posizionamento dei dealer sulla piattaforma: il segno della gamma dei dealer è una **convenzione modellata**, non un fatto osservato direttamente. L'open interest pubblico non rivela se i dealer siano lunghi o corti di un dato contratto. ZeroGEX usa la convenzione standard in stile SPX — i dealer modellati lunghi delle call che i clienti vendono in overwriting (gamma positiva) e corti delle put che i clienti comprano (gamma negativa) — e Pin Strike riutilizza esattamente quella convenzione anziché inventarne una seconda. È un modello di posizionamento, ed è descritto in tutto l'articolo come ciò che la copertura *tende* a fare, mai come una garanzia.

---

## L'idea chiave: valutare il book *come se lo spot fosse allo strike*

Ecco la mossa concettuale che fa funzionare Pin Strike, e quella che la maggior parte degli strumenti sui livelli salta.

La gamma non è una proprietà fissa di uno strike. La gamma di un contratto dipende da dove si trova lo spot *in questo momento* rispetto a quello strike — raggiunge il picco quando l'opzione è at-the-money e si riduce man mano che si sposta in- o out-of-the-money. Quindi la gamma che uno strike mostra *oggi, al prezzo attuale* ti dice quanto quello strike sta contribuendo alla copertura **qui**. **Non** ti dice quanta forza stabilizzante esisterebbe **lì**, se il prezzo viaggiasse effettivamente fino a quello strike.

Ma "lì, se il prezzo ci arrivasse" è esattamente la domanda di cui tratta un pin. Un pin è un'ipotesi: *se il prezzo arrivasse allo strike K, il book lo tratterrebbe?*

Quindi Pin Strike risponde direttamente all'ipotesi. Per ogni strike candidato `K`, **simula l'intero book di opzioni come se lo spot fosse posizionato a `K`** e rivaluta la gamma di ogni contratto a quello spot ipotetico usando la stessa gamma di Black-Scholes che usa il resto della piattaforma. Poi attribuisce segno e scala quella gamma rivalutata in dollar-gamma dei dealer con la convenzione canonica della piattaforma:

```
GEX_i(K) = dealer_sign_i × gamma_i_at_K × OI_i × 100 × K² × 0.01
```

Leggila con attenzione: lo spot nella formula del dollar-gamma è `K` stesso (quindi la scala `S²` diventa `K²`), perché stiamo valutando il mondo in cui lo spot *è* `K`. `dealer_sign_i` è `+` per le call e `−` per le put (la convenzione modellata di cui sopra), `OI_i` è l'open interest, `100` è il moltiplicatore del contratto, e il `× 0.01` finale mette tutto sulla base standard di settore dei "dollari di copertura per movimento dell'1%". È la convenzione GEX identica usata per i wall e il gamma flip — Pin Strike non introduce una definizione concorrente di gamma dei dealer; si limita a valutare quella esistente a uno spot diverso e ipotetico.

Questo è il nocciolo del perché Pin Strike è una metrica genuinamente diversa e non una lettura del GEX più grande riconfezionata: è costruita su gamma *controfattuale* (ciò che il book sarebbe a K), non su gamma *attuale* (ciò che il book è ora).

---

## Gamma di richiamo locale: un pin è un intorno, non un totale di catena

Un pin è una caratteristica *locale*. Riguarda la gamma raggruppata proprio attorno a uno strike, non la gamma aggregata dell'intera catena, e di certo non la gamma che si trova a centinaia di punti di distanza. Quindi, per ogni `K` candidato, Pin Strike pondera il contributo di ciascun contratto in base a quanto lo strike di quel contratto è vicino a `K`, usando un kernel gaussiano:

```
kernel(K, strike_i) = exp( −(strike_i − K)² / (2 × bandwidth²) )
```

I contratti che si trovano esattamente a `K` contano pienamente; i contratti a qualche strike di distanza contano meno; i contratti lontani non contribuiscono praticamente per nulla. Sommando il GEX dei dealer ponderato per il kernel si ottiene la **gamma locale** a `K`:

```
local_gex(K) = Σ  GEX_i(K) × kernel(K, strike_i)
```

Il `bandwidth` — quanto è ampio "vicino" — non è cablato nel codice, perché le griglie degli strike differiscono tra i prodotti (SPY e QQQ quotano strike a passo di un dollaro vicino all'ATM, SPX ne quota uno ogni cinque punti, NDX ancora più radi). Pin Strike ricava il bandwidth dalla **spaziatura mediana degli strike quotati vicini**, così il kernel si adatta automaticamente a qualunque prodotto stia guardando. È un parametro configurabile, non un numero magico.

Poi il passaggio decisivo. Solo una gamma locale *positiva* può pinnare:

```
restoring_gex(K) = max( local_gex(K), 0 )
```

Se l'intorno attorno a `K` è a gamma dei dealer netta corta — una tasca destabilizzante che amplifica i movimenti — il suo punteggio di richiamo è zero. Non è un pin debole; *non è affatto un pin*, ed è valutato di conseguenza. Questo singolo `max(·, 0)` è ciò che codifica la fisica: i pin sono fatti di gamma positiva, punto e basta.

---

## Raggiungibilità: perché il nodo più grande non vince automaticamente

La gamma di richiamo locale ti dice quanto *forte* sarebbe un pin se il prezzo ci arrivasse. Non dice nulla su se il prezzo *possa* arrivarci. La distanza è la metà mancante.

Considera una sessione in cui lo spot è a 772 e c'è un colossale nodo a gamma positiva a 820. Quel nodo potrebbe avere dieci volte la gamma di richiamo di un modesto nodo a 773 — ma con poche ore rimaste nella sessione e la volatilità dov'è, 820 è essenzialmente fuori portata. Trattarlo come il pin sarebbe un'assurdità. Il prezzo non si organizzerà attorno a un livello che non può raggiungere prima della chiusura.

Quindi Pin Strike moltiplica la gamma di richiamo di ciascun candidato per un **peso di raggiungibilità** ricavato da quanto è lontano lo strike, misurato nelle unità di mercato del "movimento atteso". Usando lo spot attuale, una volatilità implicita rappresentativa e il tempo *effettivo* rimasto alla scadenza:

```
z(K)            = ln(K / spot) / (σ × √τ)
reachability(K) = exp( −½ × z² )
```

`z` è la log-distanza dallo strike espressa in deviazioni standard della distribuzione del prezzo terminale — il numero di movimenti attesi a cui si trova. `reachability` è la densità gaussiana (non normalizzata) a quella distanza: è `1.0` per uno strike proprio allo spot e decade dolcemente verso zero man mano che lo strike si allontana più di quanto volatilità e tempo possano plausibilmente portare il prezzo. Poiché la distanza è misurata in unità `σ√τ`, la stessa formula funziona in modo identico su SPY, QQQ, SPX e NDX senza costanti in dollari specifiche per simbolo.

Due input in quella formula meritano enfasi, perché sono il punto in cui la raggiungibilità si guadagna il pane:

- **`σ` è una volatilità implicita at-the-money rappresentativa**, presa dalle stesse opzioni 0DTE vicine all'ATM (la stessa base ATM-IV che la piattaforma usa altrove). Non è un default inventato — se non c'è una IV ATM utilizzabile, non ci si può fidare della raggiungibilità e la metrica rinuncia a produrre un pin anziché inventare un numero.
- **`τ` è il tempo *effettivo intraday* rimasto al regolamento 0DTE**, in anni — secondi alla chiusura, non un pigro `1/365`. Questo conta enormemente per 0DTE: alle 10:00 uno strike a cinque punti di distanza è molto raggiungibile; alle 15:45 lo stesso strike può essere a diversi movimenti attesi di distanza. La raggiungibilità collassa man mano che il tempo scorre, esattamente come fa un vero pin verso la scadenza.

---

## Mettere tutto insieme: il punteggio di pin

Ogni strike candidato ottiene un singolo punteggio — il prodotto delle due metà:

```
pin_score(K) = restoring_gex(K) × reachability(K)
```

Uno strike vince solo essendo **sia** un forte nodo a gamma positiva **sia** realisticamente raggiungibile. Un nodo enorme ma irraggiungibile ottiene un punteggio prossimo allo zero (la raggiungibilità lo annulla). Uno strike perfettamente raggiungibile senza gamma locale positiva ottiene esattamente zero (la gamma di richiamo lo annulla). Il Pin Strike è lo strike quotato con il `pin_score` massimo.

I candidati sono ristretti a monte agli strike entro all'incirca un paio di movimenti attesi dallo spot — gli unici strike con raggiungibilità significativa — così la simulazione resta economica e non considera nemmeno la coda lontana. E vengono restituiti solo **strike effettivamente quotati**, così il Pin Strike è sempre un contratto reale e quotabile.

Accanto allo strike, Pin Strike riporta una **confidenza** — quanto è dominante il vincitore rispetto agli altri pin validi:

```
pin_confidence = max_pin_score / Σ (all positive pin_scores)
```

Una confidenza vicina a 1.0 significa che un nodo possiede in modo schiacciante il panorama a gamma positiva raggiungibile — un pin pulito e singolare. Una confidenza bassa significa che diversi candidati comparabili sono in competizione, e il prezzo ha più probabilità di oscillare tra loro che di agganciarsi a uno solo. Viene conservato anche il punteggio massimo grezzo, perché la sola concentrazione può ingannare quando *ogni* punteggio è minuscolo — un pin "dominante" tra candidati trascurabili è comunque trascurabile.

---

## Perché Pin Strike non è gli altri livelli

Pin Strike fa parte di una famiglia di livelli di posizionamento dei dealer, e tutto il suo valore sta nell'essere genuinamente distinto da ciascuno di essi. Le differenze non sono cosmetiche:

- **Call Wall / Put Wall** — gli strike sopra e sotto lo spot con la maggiore gamma *attuale* unilaterale di call/put. Segnano le concentrazioni dominanti di resistenza e supporto al prezzo di *oggi*. Pin Strike non riguarda la maggiore concentrazione unilaterale e non è misurato al prezzo di oggi — riguarda la stabilizzazione locale *netta* valutata a ogni strike candidato come se il prezzo fosse lì. Vedi [Gamma Walls spiegati](/education/gamma-walls-explained).

- **Gamma Flip** — lo spot ipotetico al quale la gamma dei dealer *aggregata* cambia segno; il confine tra i regimi stabilizzante e destabilizzante per l'intero book. Il flip è una linea di regime; Pin Strike è un magnete specifico *all'interno* di un regime stabilizzante. (Di fatto, se lo spot si trova sotto il flip in territorio a gamma netta corta, Pin Strike spesso non troverà nulla a cui agganciarsi — che è la risposta corretta.) Vedi [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip).

- **Max Pain** — lo strike di regolamento che minimizza il payout intrinseco aggregato dei detentori di opzioni. Usa solo l'open interest e gli strike — nessuna greca, nessuna volatilità, nessun segno del dealer, e nessuna nozione di raggiungibilità o di *come* i dealer si coprono. È un livello di contabilità dei payout. Pin Strike è un livello di meccanica di copertura. Spesso sono in disaccordo, e quando concordano è di solito perché gamma pesante e OI pesante si trovano a coincidere. Vedi [Max Pain spiegato](/education/max-pain-explained).

- **King Node / strike a GEX più grande** — semplicemente lo strike con la più grande gamma in dollari *attuale*. Questo è quello per cui Pin Strike viene più spesso scambiato, e il peso di raggiungibilità è precisamente ciò che li separa. **Pin Strike deliberatamente non seleziona lo strike a GEX più alto.** Il King Node ignora se il prezzo possa raggiungerlo e ignora se il nodo sia stabilizzante in termini netti; Pin Strike è costruito per declassare un gigante irraggiungibile o a gamma corta a favore di un nodo raggiungibile a gamma positiva. Quando i due coincidono, è perché la gamma dominante si trova anch'essa vicino allo spot ed è stabilizzante — una conferma significativa, non una ridondanza.

La versione in una riga: **i wall sono concentrazione, il flip è un confine di regime, il max pain è un minimo di payout, il King Node è dimensione grezza — e Pin Strike è stabilizzazione locale raggiungibile e netta positiva verso la scadenza.**

---

## Perché solo 0DTE, e perché l'open interest

Vale la pena rendere esplicite due scelte di perimetro.

**Pin Strike è una metrica 0DTE.** Usa solo la scadenza dello stesso giorno più vicina e non mescola weekly, monthly o gamma a scadenza più lunga. È deliberato: un pin è un fenomeno *verso la chiusura*. La gamma dello stesso giorno è ciò che si risolve oggi, la sua finestra di raggiungibilità si misura in ore, e il suo profilo di gamma `1/√τ` si acuisce drammaticamente verso la campanella — che è esattamente il regime in cui il pinning è un comportamento reale e osservabile. La gamma a scadenza più lunga è uno sfondo strutturale, non un magnete intraday, e mescolarla offuscherebbe proprio l'effetto che la metrica cerca di isolare. Pin Strike è quindi una lettura intraday, verso la scadenza — non un ampio livello strutturale sulle opzioni.

**Pin Strike usa la stessa base di open interest del motore GEX principale.** Non tenta di aggiustare il posizionamento usando il flusso intraday — nessuna inferenza apertura-contro-chiusura, nessuna riponderazione live dell'OI. Quel tipo di aggiustamento del flusso introduce un'incertezza aggiuntiva reale ed è un problema separato; integrarlo nel pin renderebbe la metrica meno affidabile, non più affidabile. Il pin che vedi è costruito sulla stessa base di posizionamento di ogni altra lettura di gamma dei dealer sulla piattaforma, il che lo mantiene coerente e interpretabile.

---

## Quando Pin Strike entra in gioco

Pin Strike è più informativo in una finestra e in un regime specifici, e meno informativo al di fuori di essi:

- **A fine sessione 0DTE, in un regime a gamma positiva.** Questo è il suo terreno di casa. Quando lo spot è sopra il gamma flip ed esiste un nodo a gamma positiva raggiungibile, il Pin Strike segna dove è concentrata la copertura stabilizzante, e il prezzo spesso torna verso la media attorno ad esso verso la chiusura. Si legge meglio come *il centro di gravità del range di pinning attuale*, delimitato dai wall.

- **Come livello di contesto, non come target.** Un Pin Strike è un magnete modellato, non una previsione che il prezzo verrà scambiato lì. Tende a descrivere dove un range si organizza, quanto strettamente e con quanta confidenza (tramite il punteggio di confidenza) — non una destinazione garantita o un segnale di timing. È contesto per una decisione, mai una decisione.

- **Va letto insieme alla confidenza e ai wall.** Un pin ad alta confidenza posizionato tra un solido call wall e put wall è un quadro di pinning coerente e ben definito. Un pin a bassa confidenza, o un pin con i wall lontani, è molto più allentato. Il numero è significativo solo quanto lo è la struttura attorno ad esso.

E, cosa cruciale, riconosce quando *nulla* di tutto ciò si applica — che è l'argomento dell'ultima sezione.

---

## Quando Pin Strike è nullo — e perché lo abbiamo scelto

Questa è la parte che distingue di più Pin Strike da un ingenuo strumento del tipo "strike pesante più vicino": **gli è consentito, ed è previsto, non restituire nessun pin attivo.** Uno strumento che stampa sempre un livello è facile da costruire e facile da fraintendere — fabbrica falsa confidenza esattamente nei giorni in cui non c'è nulla a cui agganciarsi. Pin Strike fa la cosa più difficile e più onesta: quando non c'è un pin a gamma positiva significativo, non restituisce nulla, e ti dice *perché*.

Quando non c'è un pin attivo, la metrica riporta uno dei seguenti motivi:

- **Nessuna scadenza 0DTE** — non c'è alcuna scadenza dello stesso giorno quotata per il sottostante. Senza una catena 0DTE, non c'è nulla di cui un pin intraday possa trattare.
- **Scaduto** — l'istante di regolamento 0DTE è già passato (tempo alla scadenza ≤ 0), ad esempio dopo la chiusura cash. La raggiungibilità è indefinita una volta che le opzioni sono regolate.
- **Nessuna gamma di richiamo positiva** — l'algoritmo è stato eseguito, ma nessun candidato raggiungibile ha gamma dei dealer locale netta positiva. Questo è il caso nullo significativo e non degenere: il prezzo si trova in un intorno a gamma corta dove la copertura è destabilizzante, quindi *nulla pinna*. Forzare un livello qui sarebbe attivamente fuorviante — indicherebbe uno strike che meccanicamente spinge il prezzo *lontano*, non verso di esso.
- **Dati IV insufficienti** — non c'è una volatilità implicita at-the-money utilizzabile per ancorare il calcolo della raggiungibilità, quindi non ci si può fidare delle distanze. Non viene sostituita alcuna volatilità di default arbitraria.
- **Dati sulle opzioni insufficienti** — non ci sono dati validi sulle opzioni 0DTE (nessuno spot, o nessun contratto con open interest, IV, tempo e strike utilizzabili), quindi non c'è nulla da modellare.
- **Punteggio di pin troppo debole** — una soglia di magnitudine opzionale che sopprime un pin il cui punteggio grezzo è trascurabile. È disattivata di default, quindi scatta solo quando esplicitamente configurata — la piattaforma non inventa soglie rivolte all'utente.

Altri due casi quotidiani si presentano come un pin vuoto senza un codice di motivo: i **frame di replay storico** scritti prima del rilascio di Pin Strike semplicemente non portano alcun valore (la riga è omessa, e nulla viene riempito a posteriori), e il **grafico gamma live nasconde il pin durante il riavvolgimento temporale**, perché il pin è un valore di livello riepilogativo che non viene ricostruito per il buffer di riavvolgimento al minuto.

Il principio di design alla base di tutto questo: **un onesto "nessun pin" è più utile di uno forzato.** Una sessione a gamma negativa, in trend, o con la scadenza passata genuinamente non ha alcun pin gamma, e l'output corretto in quegli stati è il silenzio — non lo strike più vicino travestito da magnete. La metrica fa emergere esattamente quale delle condizioni di cui sopra si applica, così un "—" non è mai ambiguo: è un'affermazione specifica e ispezionabile sul mercato, non un buco nei dati. Nell'interfaccia questo si presenta sempre come un trattino — mai come uno `0`, un `NaN`, o uno strike di fallback fuorviante.

---

## Come leggerlo in una frase

Pin Strike è lo strike 0DTE raggiungibile in cui rivalutare il book a quello strike produce la gamma dei dealer più fortemente concentrata localmente e netta positiva (stabilizzante) verso la scadenza — un centro di gravità modellato per un range di pinning verso la chiusura, riportato con una confidenza e, quando il mercato non offre alcun nodo di questo tipo, deliberatamente riportato come nulla del tutto.

Per vederlo in tempo reale insieme ai wall, al flip e al max pain, apri [i livelli gamma di oggi su SPX / SPY / QQQ / NDX](/spx-gamma-levels) e osserva come si comporta il Pin Strike verso l'ultima ora — e nota le sessioni in cui tace.
