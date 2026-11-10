# Cos'è il gamma zero? Il livello di gamma zero spiegato

*Il gamma zero spiegato in parole semplici - cos'è il livello di gamma zero, come si collega al gamma flip e al net GEX, cosa tende a cambiare da una parte e dall'altra, e dove vedere il livello di gamma zero di oggi per SPX, SPY, QQQ e NDX.*

---

## Cos'è il livello di gamma zero?

Il **livello di gamma zero** è il prezzo al quale l'esposizione gamma modellata dei dealer attraversa lo zero. Sopra di esso, il book di opzioni è modellato come gamma netto *positivo* per i dealer; sotto, netto *negativo*. È lo stesso livello che la maggior parte dei trader chiama **gamma flip**, e i due nomi si usano in modo intercambiabile: "gamma zero" descrive cos'è il numero (il punto in cui il gamma netto dei dealer è uguale a zero), e "gamma flip" descrive cosa succede lì (il segno si inverte).

Questa è tutta la definizione, e vale la pena tenersi stretta la versione semplice, perché se ne parla come se fosse una linea di supporto o resistenza. Non lo è. Il gamma zero è un **confine di regime**: segna il punto in cui, secondo il modello, cambia il *carattere* dell'hedging dei dealer, non dove ci si aspetta che il prezzo si fermi.

Ne seguono direttamente alcune conseguenze:

- È un **livello di prezzo, non uno strike.** L'attraversamento dello zero di solito cade tra due strike, perché deriva da una curva - il gamma dei dealer modellato valutato su un intervallo di prezzi spot - e non da un singolo contratto.
- **Si muove.** Man mano che l'open interest cambia e i contratti esistenti si riprezzano con spot, tempo e volatilità implicita, la curva si rimodella e il suo attraversamento dello zero si sposta. Il livello di gamma zero di ieri è un numero diverso da quello di oggi. Controlla il [livello di gamma zero attuale di SPX](/spx-gamma-levels) a ogni sessione invece di portarti dietro quello vecchio.
- È un **output del modello.** L'inventario dei dealer non è direttamente osservabile, quindi il livello dipende da una convenzione di segno (ZeroGEX usa la tradizionale convenzione call-positive / put-negative) e da quali scadenze e input include il modello.

## Gamma zero vs gamma flip vs net GEX

Tre termini strettamente collegati, e le differenze contano più di quanto sembri:

| Termine | Cos'è | Unità |
|---|---|---|
| **Net GEX** | Gamma netto modellato dei dealer su tutta la catena, valutato al prezzo spot attuale | Dollari con segno ("dollar gamma"), es. +1,2 miliardi di $ |
| **Livello di gamma zero** | Il prezzo spot al quale quel gamma netto modellato sarebbe uguale a zero | Un prezzo, es. 5.815 |
| **Gamma flip** | Lo stesso livello, chiamato così per il cambio di segno che avviene lì | Un prezzo |

Quindi il net GEX è una *lettura* e il gamma zero è un *livello*. Sono due viste di un'unica curva: quando lo spot è sopra il livello di gamma zero, il net GEX allo spot è positivo; quando lo spot è sotto, il net GEX allo spot è negativo. Se mai i due sembrano in disaccordo - una lettura di net GEX positiva con lo spot sotto il flip pubblicato - il modello ti sta dicendo che ha trovato più di un attraversamento dello zero, oppure che la lettura e il livello provengono da snapshot diversi. Vedi [SPX Net GEX oggi](/education/spx-net-gamma-exposure-today) per come leggere la cifra in dollari in sé.

## Come si trova il livello di gamma zero

Il modo rapido per individuare il gamma zero è sommare il gamma con segno per strike, partendo dallo strike più basso e salendo, e segnare dove il totale cumulativo attraversa lo zero. È rapido, ed è anche sbagliato più spesso di quanto sembri, perché tratta il gamma di ogni contratto come fisso, quando in realtà il gamma dipende da dove si trova lo spot.

L'approccio migliore - quello a cui è passato ZeroGEX - riprezza l'intero book a ogni prezzo spot candidato, calcola il gamma netto modellato dei dealer *come se lo spot fosse lì* e legge dove quel profilo attraversa lo zero. La [guida al calcolo del Gamma Flip](/guides/gamma-flip-calculation-before-vs-after) illustra entrambi i metodi e spiega perché il profilo con spot-shift è quello di cui vale la pena fidarsi.

Dal metodo migliore derivano due cose:

1. **Il livello può mancare.** Se il profilo non attraversa mai lo zero vicino allo spot - ben dentro un unico regime, una catena sottile o sbilanciata da un solo lato, un picco di volatilità implicita che fa crollare il gamma modellato su tutta la linea - non esiste un livello di gamma zero onesto da pubblicare, e ZeroGEX lo lascia vuoto invece di inventarne uno. Il segno del net GEX ti dice comunque in quale regime ti trovi.
2. **Ce ne può essere più di uno.** Una catena irregolare può produrre due attraversamenti. ZeroGEX pubblica quello abbastanza vicino allo spot da essere operabile e sostenuto da open interest reale; vale la pena sapere che un secondo potrebbe trovarsi più lontano.

## Cosa tende a cambiare sopra e sotto il gamma zero

È il segno del gamma modellato dei dealer a decidere se l'hedging tende ad andare *contro* i movimenti o *insieme* a essi.

**Sopra il livello di gamma zero (gamma positivo).** I dealer sono modellati net long gamma. Per restare delta-neutrali tendono a vendere nella forza e comprare nella debolezza, il che spinge contro la direzione del movimento. La volatilità realizzata tende a comprimersi, i range tendono a essere più stretti e il prezzo tende a gravitare verso gli strike pesanti in chiusura. L'hedging si oppone ai breakout invece di alimentarli.

**Sotto il livello di gamma zero (gamma negativo).** I dealer sono modellati net short gamma. Lo stesso riflesso di hedging ora asseconda il movimento - compra la forza, vende la debolezza - e la volatilità realizzata tende ad espandersi. I range si allargano, una rottura che avviene davvero ha l'hedging alle spalle, e il pinning che teneva sopra il livello tende ad allentarsi. [Cosa significa il gamma negativo](/education/what-is-negative-gamma) tratta questo regime in modo approfondito.

**Sul livello stesso.** Lo spot che si trova sul gamma zero è lo stato meno informativo, non il più informativo. I contributi modellati positivi e negativi si compensano più o meno, la tendenza netta dell'hedging è debole, e una piccola variazione degli input può invertire il segno. I trader che usano il livello trattano questa fascia come territorio conteso piuttosto che come un segnale.

Niente di tutto questo è direzionale. Sopra il gamma zero non è rialzista; sotto non è ribassista. Il livello parla della *consistenza* del tape - appiccicoso o scivoloso - non di dove è diretto il prezzo.

## Come i trader usano il livello di gamma zero

Il livello è più utile come **filtro** che decide quale playbook è in uso, piuttosto che come trigger:

1. **Leggi prima il regime.** Prima di un setup, controlla se lo spot è sopra o sotto il gamma zero, e di quanto.
2. **Adatta la tattica al lato.** Sopra: fade, trade di range, pazienza vicino al [call wall e al put wall](/education/gamma-walls-explained). Sotto: momentum, breakout, rischio più contenuto.
3. **Osserva la distanza e la deriva.** Un livello lontano dallo spot è una lettura di regime stabile; un livello a pochi decimi di punto percentuale è una lettura contesa. Un livello che migra verso il prezzo nel corso della sessione è un indizio diverso da uno che resta fermo mentre il prezzo vi si avvicina.
4. **Controlla la magnitudine del net GEX.** Un livello di gamma zero con 2 miliardi di $ di gamma modellato sopra di esso descrive un regime più netto di uno con 200 milioni di $. Segno e dimensione insieme, non il segno da solo.

[Cos'è un gamma flip?](/education/how-to-read-a-gamma-flip) trasforma questi passi in una routine intraday, e [Come tradare intorno ai livelli di Gamma Flip](/education/how-to-trade-around-gamma-flip) spiega cosa cambia quando lo spot lo attraversa.

## Errori di lettura comuni

- **Trattare il gamma zero come supporto o resistenza.** È una linea di regime. Comprare la debolezza verso il livello dall'alto e comprare la debolezza dal basso sono trade strutturalmente diversi.
- **Leggere un livello obsoleto.** Il livello di gamma zero può muoversi di diversi punti in poche ore. Un numero del mattino letto su un tape del pomeriggio è un book diverso.
- **Confonderlo con il max pain.** Il [max pain](/education/max-pain-explained) è uno strike basato sulla geometria del payoff - quello in cui il valore a scadenza per chi detiene le opzioni è minimo. Il gamma zero è una linea di regime di hedging. Rispondono a domande diverse e spesso non concordano.
- **Aspettarsi un rimbalzo o una rottura sul livello.** Il prezzo che attraversa il gamma zero cambia il *riflesso* modellato dell'hedging. Di per sé non ti dice se il movimento prosegue.

## Il livello di gamma zero di oggi

ZeroGEX pubblica il livello di gamma zero - etichettato "gamma flip" - insieme a call wall, put wall, max pain e net GEX, gratis e con circa 15 minuti di ritardo, per [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) e [NQ](/nq-gamma-levels). Il valore live, per tutta la sessione, si aggiorna all'interno della dashboard. Per ciò che ZeroGEX osserva rispetto a ciò che modella, vedi la [metodologia](/methodology).

## Conclusione

> Il gamma zero è il prezzo in cui il gamma netto modellato dei dealer è zero - lo stesso livello del gamma flip. Sopra di esso, l'hedging tende a smorzare i movimenti; sotto, l'hedging tende ad amplificarli. È una linea di regime, non un target, e si muove nel corso della giornata.

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.
