# GEX e il Gamma Flip — Come li calcola ZeroGEX

*Una spiegazione in linguaggio semplice del profilo di esposizione gamma dei dealer, del resolver che lo trasforma in un livello operativo, e di come la metodologia si confronta con quella di altri fornitori popolari.*

---

## Cos'è davvero il "gamma dei dealer"

I market maker (i "dealer") si trovano dalla parte opposta di ogni opzione che negozi. Quando compri una call, un dealer te la vende. Per restare direzionalmente neutrali, si coprono comprando o vendendo il sottostante. Man mano che il titolo si muove, il rapporto di copertura dell'opzione (delta) cambia, quindi il dealer deve continuare a ricomprare o rivendere.

Il **gamma** è la velocità con cui cambia questa necessità di copertura. Il **GEX** ("gamma exposure") traduce il gamma dell'intera catena di opzioni in dollari — approssimativamente, *l'importo in dollari di sottostante che i dealer devono negoziare per ogni movimento dell'1% del titolo.*

Esistono due regimi, separati da un singolo livello di prezzo chiamato **gamma flip**:

- **Sopra il flip — dealer net long gamma.** Quando il titolo sale vendono, quando scende comprano → effetto mean-reverting / di compressione della volatilità.
- **Sotto il flip — dealer net short gamma.** Quando il titolo sale comprano, quando scende vendono → effetto di amplificazione del momentum / di espansione della volatilità.

---

## Come lo calcoliamo (e perché in questo modo)

Il primitivo centrale è un'unica curva: il **profilo di gamma dei dealer a spot variabile (spot-shift)**.

1. Prendi lo snapshot odierno della catena di opzioni.
2. Immagina il titolo a ogni prezzo su una griglia che copre circa ±20% dello spot (in passi dello 0,25% dello spot — qualche centinaio di punti griglia).
3. A ogni prezzo della griglia, **ricalcola il gamma di ogni opzione** con Black-Scholes (il gamma è a sua volta funzione dello spot, quindi non si può usare il valore statico dello snapshot).
4. Moltiplica il gamma di ogni contratto per `OI × 100 × S² × 0.01` (la convenzione di settore "dollar GEX per movimento dell'1%" usata da SpotGamma / SqueezeMetrics / Cheddar Flow) e applica la convenzione di segno dei dealer (call +, put −).
5. Pesa ogni contratto con `min(1, DTE / 5 days)` — una rampa di occupazione dell'orizzonte temporale, così un muro 0DTE dello stesso giorno (che porta con sé un picco di gamma colossale in `1/√T`) non può bloccare un livello di regime multi-giornaliero.
6. Somma lungo l'intera catena → un'unica curva, *dealer dollar gamma vs. spot ipotetico.*

Da questa **stessa** curva derivano due letture:

- **Gamma Flip** = il prezzo in cui la curva incrocia lo zero (l'incrocio operativo).
- **Net GEX a spot** = il valore della curva al prezzo odierno.

Poiché entrambe derivano da un'unica curva, il numero di GEX principale e il regime spot-vs-flip *non possono mai contraddirsi* a vicenda — è un invariante strutturale del calcolo. Ecco perché l'abbiamo costruito così. La vecchia scorciatoia "cumula il gamma statico per strike" (ancora usata da diversi fornitori) poteva darti un numero di net GEX positivo mentre ti diceva che lo spot era sotto il flip — incoerente.

---

## Il resolver rinforzato del flip

Il semplice incrocio dello zero non basta da solo — ci sono tre modalità di fallimento reali da cui difendersi:

1. **Incroci ai bordi della griglia.** Il gamma decade verso ~0 agli estremi della griglia, quindi uno squilibrio minimo può invertire il segno lì → **Interior gate**: un incrocio deve trovarsi ad almeno il 10% della larghezza della griglia di distanza da entrambi i bordi.
2. **Incroci nel rumore di fondo** (artefatti da apertura mattutina / spike di IV). Quando il gamma dell'intera catena è degradato, il profilo attraversa lo zero in una regione a basso segnale → **Structural gate**: il picco locale |profile| di un candidato deve essere ≥ 2% di un riferimento robusto (il p90 di |profile| su una banda canonica di ±15%, limitata ai punti griglia vicini a uno strike con OI > 0 reale).
3. **Incroci lontani dallo spot.** Un incrocio strutturalmente valido ma a 20% sotto lo spot non è operativo su nessun orizzonte ragionevole → **Actionable-distance gate**: i candidati oltre l'8% di distanza dallo spot vengono scartati.

Se la griglia ±20% non produce alcun incrocio qualificato, il resolver **espande la griglia** a ±35%, poi ±50% (una scala adattiva). Se nessun gradino risulta idoneo, il flip viene riportato come **non risolto (NULL + WARN)** — onestamente, piuttosto che inventare un valore limite o congelare uno stantio.

---

## In cosa differisce dai siti più popolari

| Sito | Metodo | Pro | Contro |
| --- | --- | --- | --- |
|! **ZeroGEX (questo codebase)** | Profilo di gamma dei dealer a spot variabile, scala adattiva della griglia, gate di accettazione interior / structural / actionable-distance, pesatura per occupazione dell'orizzonte DTE, NULL onesto su catene degradate | La definizione pubblicata dal settore; numero principale coerente nel segno (flip e net-GEX-a-spot letti dalla stessa curva); rinforzato contro artefatti da catena degradata, vicini al bordo e lontani dallo spot; endpoint multi-orizzonte espongono i flip a 1g / 5g / 20g da un unico primitivo | Più calcolo per ciclo (ricalcola le greche della catena su una griglia, a volte su più gradini della scala); più parametri regolabili (raggruppati nei profili `default` / `strict` / `lenient` per mantenere la superficie ridotta); semplificazione a sticky-strike vol (un ri-shift completo della superficie di volatilità è fuori ambito) |
| **SpotGamma** | Profilo di gamma dei dealer a spot variabile (la definizione canonica / originale) | Riferimento di settore per la definizione; storia di ricerca pubblicata | Metodologia chiusa; anch'essa sticky-strike; il flip riportato è a un solo orizzonte |
| **SqueezeMetrics** | Profilo di gamma dei dealer a spot variabile (l'altra fonte canonica) | Il paper originale su DIX / GEX è il riferimento pubblico per questa costruzione | Prodotto retail perlopiù a cadenza giornaliera; non in tempo reale |
| **Unusual Whales** | Aggregazione GEX per strike (cumula gamma × OI per strike) | Economico da calcolare; molto veloce; grafico a barre per strike intuitivo | Non è la definizione a spot variabile — un livello "zero gamma" cumulativo per strike è un'approssimazione retail; si blocca quando il vero zero-gamma è fuori dalla banda di strike acquisita |
| **Cheddar Flow** | Aggregazione GEX per strike | Come UW — veloce e intuitivo | Stessa avvertenza — non è la definizione a spot variabile |

La differenza pratica più grande: **i fornitori che aggregano per strike ti daranno un "flip" che resta ancorato a un muro finché quel muro è nel loro snapshot, anche quando il vero livello di zero-gamma è distante di diversi punti percentuali.** Abbiamo osservato esattamente questo sintomo nei nostri dati storici prima della riscrittura — il flip persistito rimaneva piatto per ore. Ricalcolare i prezzi su una griglia più ampia lo risolve.

La seconda differenza è l'**onestà sui dati degradati**: la maggior parte dei fornitori mantiene silenziosamente l'ultimo valore noto quando il proprio feed diventa stantio. Noi persistiamo NULL ed emettiamo un avviso di salute (health warning) al suo posto, così un feed degradato è visibile invece che mascherato.
