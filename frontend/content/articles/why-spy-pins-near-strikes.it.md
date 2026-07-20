# Perché SPY si ancora vicino a uno strike? Il pinning delle opzioni spiegato

*Perché SPY si ancora vicino a strike specifici — soprattutto il venerdì e verso la chiusura? Non è una coincidenza. Il pinning delle opzioni spiegato: il meccanismo di hedging dei dealer dietro questa attrazione, perché è più forte in occasione dell'OPEX e a fine giornata, e come capire se la seduta di oggi si ancorerà.*

---

## Il pinning non è superstizione

Se fai trading regolarmente su opzioni settimanali SPY, l'hai già visto accadere: SPY deriva verso uno strike a numero tondo — 580, 583, 585 — e il venerdì pomeriggio resta lì, oscillando in un intervallo di 30 centesimi, senza volersene andare. Succede lo stesso intorno alle scadenze trimestrali e nell'OPEX mensile. Succede anche in molti mercoledì e giovedì normali, quando la catena 0DTE è particolarmente carica.

Molti trader retail trattano il pinning come un fenomeno basato sul "sentire" — "il mercato sa dove vuole regolarsi" — oppure lo attribuiscono a pattern grafici. Il meccanismo è in realtà strutturale e osservabile: l'hedging dei dealer sugli strike a gamma elevata produce flussi direzionali che riportano il prezzo verso lo strike ogni volta che tenta di allontanarsene. Una volta che riesci a vedere il meccanismo, puoi anche capire quando è probabile che sia operativo oggi e quando no.

Questo articolo ripercorre la meccanica reale del pinning, perché si intensifica vicino alla scadenza, i due tipi di pin che la maggior parte dei trader confonde, e le condizioni strutturali che rendono la giornata odierna un "pin day". Per la checklist orientata al trader su "SPY è ancorato adesso?", vedi [Come sapere se SPY è ancorato](/education/how-to-know-if-spy-is-pinned). Per la discussione correlata sul max pain, vedi [Max Pain spiegato](/education/max-pain-explained).

---

## Il meccanismo di hedging dei dealer dietro il pinning

Il meccanismo è semplice una volta scritto per esteso:

1. Uno strike specifico — diciamo SPY 583 — porta una grande concentrazione di gamma. I clienti hanno comprato molte call e put a 583; i dealer sono short sull'equivalente.
2. Il book dei dealer è **long gamma** su quello strike. Questo accade quando, sul netto, i dealer sono *short* sulle opzioni che i clienti detengono long. (Convenzione standard.)
3. Quando SPY sale attraverso 583, il delta delle opzioni dei dealer diventa più positivo (sono net short call; con lo spot in salita la loro esposizione delta da short-call cresce). Per rimanere neutrali, **vendono** SPY.
4. Quando SPY scende attraverso 583, il delta delle opzioni dei dealer diventa più negativo (la loro esposizione delta da short-put cresce al ribasso). Per rimanere neutrali, **comprano** SPY.
5. Ogni escursione lontano da 583 costringe un trade di copertura *di ritorno verso* 583. Lo strike agisce come un magnete — non perché qualcuno lo stia prendendo di mira, ma perché la matematica dell'hedging spinge meccanicamente il prezzo lì.

Questo è ciò che accade strutturalmente quando vedi SPY oscillare in un range stretto. Non è "il mercato che decide di ancorarsi"; è il book aggregato dei dealer che si corregge verso la neutralità a ogni movimento.

---

## Perché il pinning si intensifica vicino alla scadenza

Il meccanismo sopra descritto si applica a qualsiasi opzione — ma la *forza* del pin dipende dalla grandezza della gamma su quello strike. Due fattori rendono quella grandezza enorme vicino alla scadenza:

### La gamma scala con 1/√T

La gamma per contratto di opzione è approssimativamente inversamente proporzionale alla radice quadrata del tempo alla scadenza. La gamma at-the-money di un'opzione 0DTE è circa 5 volte quella di un'opzione allo stesso strike con 5 giorni alla scadenza, e ordini di grandezza superiore a quella di una mensile. Più ci si avvicina alla scadenza, maggiore è la gamma per contratto — e maggiore è il trade di copertura richiesto per ogni tick di prezzo.

Uno strike 0DTE su cui tutti sono posizionati diventa essenzialmente un buco nero per lo spot. I dealer devono muovere quantità molto grandi di sottostante per variazioni di prezzo molto piccole. Il pinning diventa la via di minor resistenza.

### L'open interest si concentra sugli strike a numero tondo

Il mercato concentra strutturalmente l'open interest sui numeri tondi — 580, 583, 585 su SPY, 5800, 5810 su SPX. Il venerdì pomeriggio, la concentrazione di gamma su uno o due di quegli strike può dominare il resto della catena messa insieme. Quel dominio a strike singolo è ciò che produce il "magnetismo" visibile che i trader percepiscono in chiusura.

Combina i due fattori — tempo residuo breve alla scadenza + OI concentrato sugli strike tondi — e i pin del venerdì pomeriggio diventano strutturalmente prevedibili. Il mercoledì e il lunedì presentano versioni più deboli dello stesso schema, man mano che il flusso 0DTE continua a crescere.

---

## Due tipi di pin — e non sono la stessa cosa

Una fonte comune di confusione: **max pain** contro il **magnete di gamma**. Entrambi vengono chiamati "il pin", ma vengono calcolati in modo diverso e possono essere in disaccordo.

### Max pain

Il max pain è lo strike al quale il payout totale dei detentori di opzioni sarebbe minimizzato alla scadenza. È un calcolo di geometria del payoff — pura matematica del valore intrinseco. Indica lo strike "strutturalmente favorevole" per chi scrive opzioni.

### Magnete di gamma

Il magnete di gamma è lo strike con la maggiore concentrazione assoluta di gamma dei dealer — lo strike dove l'hedging forzato è più intenso. È una lettura del flusso di copertura.

Quando i due strike coincidono, la tesi del pin è al suo massimo di forza. La catena è bilanciata in entrambi i sensi. Quando sono in disaccordo, di solito vince il magnete di gamma, perché è il meccanismo che effettivamente produce il flusso di copertura che tira il prezzo.

[Max Pain spiegato](/education/max-pain-explained) approfondisce questa distinzione ed è onesto su quanto spesso il solo max pain possa trarre in inganno.

---

## Quando il pin tiene

Le condizioni strutturali che rendono la giornata odierna un pin day:

- **Regime a gamma positiva.** Spot sopra il gamma flip. Net GEX chiaramente positivo. Senza questo, il meccanismo si inverte completamente.
- **Forte concentrazione di strike vicino allo spot.** Il magnete di gamma è entro lo 0,3-0,5% dal prezzo attuale. Magneti lontani dallo spot non ancorano; puntano.
- **Max pain e magnete di gamma concordano.** Entrambi indicano lo stesso livello. Amplifica la trazione strutturale.
- **Catena dominata dalla scadenza.** Le opzioni 0DTE/settimanali portano la maggior parte della gamma. Le catene dominate dal mensile ancorano in modo molto meno affidabile.
- **Calendario dei catalizzatori tranquillo.** Nessun dato macro importante o evento di banca centrale durante la seduta.
- **Volatilità realizzata in compressione.** Il tape mostra il riflesso smorzante dei dealer in funzione.

Quando la maggior parte di queste condizioni si allinea, il pin ha una probabilità strutturale a suo favore.

---

## Quando il pin si rompe

Il pin si scioglie quando:

- **Avviene l'incrocio del gamma flip.** Lo spot scende sotto il flip; il regime si inverte. Lo stesso magnete ora rilascia il prezzo.
- **Arriva un catalizzatore.** CPI, FOMC, NFP, shock su un singolo titolo. Il flusso macro sovrasta il riflesso dei dealer.
- **Il Net GEX si decade in modo significativo.** Le posizioni si esauriscono verso la scadenza. Alle 15:30 ET del venerdì la gamma si sta riducendo rapidamente.
- **L'open interest migra.** Nuovo OI che si costruisce su uno strike diverso sposta il magnete altrove durante la seduta.
- **Lo skew si sposta.** Un forte bid sulle put (paura) può ribaltare il segno del book dei dealer anche sullo stesso strike.

Un pin che regge da due ore è più duraturo di uno appena formato, ma nessun pin dura indefinitamente. Le condizioni che lo sostenevano devono continuare a reggere perché il pin resti in piedi.

---

## Leggere il pin in tempo reale

Un breve flusso di lavoro:

1. **Identifica lo strike a gamma più pesante vicino allo spot.** È il candidato magnete.
2. **Controlla il Net GEX.** Un valore positivo sostanziale è il prerequisito. Negativo o vicino a zero esclude il pin.
3. **Controlla il gamma flip.** Lo spot deve trovarsi sopra. Se il flip è esattamente allo spot, la situazione è contesa — il pin potrebbe formarsi, o no.
4. **Verifica incrociata con il max pain.** Stesso strike o entro lo 0,3% dal magnete → pin netto. Sostanzialmente diverso → tesi del pin più debole; fidati del magnete.
5. **Leggi l'orario della giornata.** Prima di mezzogiorno ET, il charm non si è ancora accumulato abbastanza da guidare il pin con forza. Dopo le 14:00 ET, la trazione si intensifica. Dopo le 15:30 ET, dominano le dinamiche della finestra di chiusura.

Una volta identificato il pin, il playbook operativo è in [Come sapere se SPY è ancorato](/education/how-to-know-if-spy-is-pinned) — versione breve: fai fade sugli estremi, salta il centro, size ridotta.

---

## Esempio pratico

SPY è a 582,95 in un venerdì pomeriggio. ZeroGEX mostra:

- **Net GEX:** +1,4 miliardi $ (positivo — regime long-gamma)
- **Gamma Flip:** 581,20 (spot ben al di sopra)
- **Strike 0DTE più pesante:** 583,00 (praticamente allo spot)
- **Max Pain:** 583,00 (concorda con il magnete di gamma)
- **Orario:** 14:15 ET (accumulo di charm in avvio)

Ogni condizione strutturale per un pin è attiva. Il magnete si trova a 583; il max pain concorda a 583; il regime è long-gamma; siamo dentro la finestra attiva di fine giornata. La probabilità che SPY oscilli entro un range di circa 30 centesimi intorno a 583 fino alla chiusura è sensibilmente elevata.

Lettura pratica: un range stretto 582,70-583,30 è il percorso atteso. Le escursioni verso i bordi sono candidati per setup di fade. Il centro del range è territorio di non-trade. Size ridotta. Attenzione alle condizioni di rottura — soprattutto in caso di shock su un singolo titolo o headline inattese.

Ora immagina la stessa configurazione ma con Net GEX a −600 milioni $ e gamma flip a 583,50 (spot sotto). La tesi del "pin" è morta. Stessa catena, stesso strike, lettura opposta — perché la variabile di regime che decide se il magnete attrae o rilascia è invertita.

---

## Fraintendimenti comuni

- **"Il pinning è psicologia."** È meccanica. I dealer coprono le posizioni indipendentemente da chi sta guardando; il flusso avviene che i trader ci credano o no.
- **"SPY si ancora sempre ai numeri tondi."** Si ancora agli strike dove si concentra il posizionamento. I numeri tondi sono comuni perché l'OI si raggruppa lì — ma il meccanismo reale è l'OI, non la rotondità.
- **"Se il max pain è X, il prezzo chiuderà a X."** Spesso sbagliato. Il max pain da solo non è il meccanismo del pin; lo è il magnete di gamma. Quando sono in disaccordo, vince il magnete di gamma.
- **"I pin sono rialzisti/ribassisti."** Nessuno dei due. Sono soppressori di volatilità. Range-bound. La direzione viene da altrove; il pin riguarda il *carattere* dell'azione di prezzo, non la direzione.
- **"Il pinning accade ogni venerdì."** Spesso, ma non sempre. Alcuni venerdì presentano catalizzatori, regimi a gamma negativa o magneti in migrazione che impediscono il pin. Leggere le condizioni conta.

---

## Da portare a casa

> SPY si ancora perché l'hedging dei dealer sugli strike a gamma elevata riporta meccanicamente il prezzo verso lo strike. La trazione è reale, osservabile e abbastanza prevedibile da poter essere usata — purché le condizioni strutturali la supportino.

La disciplina consiste nel verificare le condizioni prima di dare per scontato che oggi sia un pin day. Regime long-gamma + strike pesante allo spot + accordo con il max pain + sessione avanzata = pin netto. Anche solo uno di questi elementi che si ribalta indebolisce la lettura. Se si ribaltano tutti, la tesi muore.

Solo contenuto educativo — nessuno di quanto sopra è un consiglio di trading.

---

Se vuoi vedere lo strike a gamma più pesante di oggi, il max pain, il gamma flip e il Net GEX — i quattro numeri che decidono se SPY si ancora oggi — la vista gratuita dei gamma-levels di ZeroGEX li mostra tutti.
