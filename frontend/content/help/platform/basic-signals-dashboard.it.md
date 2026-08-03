# Basic Signal Dashboard

*Le sei letture continue che alimentano il composite — cosa sono, come leggerle e dove approfondire.*

---

## Cos'è il Basic Signal Dashboard

Il Basic Signal Dashboard è la **griglia a colpo d'occhio** di tutti e sei i segnali Basic. Ogni scheda mostra il punteggio corrente sulla linea [-1, +1], il contributo che sta dando al composite e uno sparkline.

I segnali Basic sono **continui**. Non attivano avvisi discreti — spingono il composite più in alto (verso il trend) o più in basso (verso il chop) a ogni aggiornamento.

## I sei segnali

| Segnale | Cosa chiede | Bias di trade | Peso nel composite |
| --- | --- | --- | --- |
| Tape Flow Bias | "Da che parte pende il tape?" | Continuazione | 0.08 |
| Skew Delta | "Quanta paura è prezzata nei put?" | Lettura direzionale | 0.04 |
| Vanna/Charm Flow | "La volatilità o il tempo costringeranno i dealer a ri-coprirsi?" | Continuazione | 0.04 |
| Dealer Delta Pressure | "I dealer sono costretti a inseguire questo movimento?" | Lettura direzionale | 0.08 |
| GEX Gradient | "Il gamma è concentrato da un lato?" | Lettura direzionale | 0.08 |
| Positioning Trap | "La folla è posizionata al contrario?" | Mean-reversion (contro la folla) | 0.06 |

I pesi rappresentano la quota del composite a cui contribuisce ciascun segnale quando il resto dell'universo è silenzioso.

## Lettura rapida di ciascuno

### Tape Flow Bias

Classificazione dell'aggressore secondo Lee-Ready sul tape delle opzioni. Netto tra premio di acquisto/vendita delle call e premio di acquisto/vendita dei put. Positivo = gli aggressori stanno pagando per il rialzo. Un segnale forte qui, in assenza di un GEX gradient opposto, è convinzione in tempo reale.

### Skew Delta

Lo spread tra IV dei put OTM e IV delle call OTM rispetto al proprio baseline, con segno invertito così che il punteggio si legga in modo direzionale: negativo significa che la paura è prezzata (skew sui put ricco); positivo significa che il premio delle call è prezzato (avidità). Utile più come termometro del sentiment che come segnale di precisione.

### Vanna/Charm Flow

Vanna e charm aggregati dei dealer. Il vanna modella ciò che i dealer *potrebbero* coprire se la volatilità si muove; il charm modella la deriva del delta con il passare del tempo (a spot e IV costanti). Una lettura positiva modella un flusso di copertura che *può* sostenere prezzi più alti; una negativa il contrario — direzione e ampiezza dipendono comunque dalla composizione del book e da chi detiene le opzioni. La pressione del charm tende a crescere verso la chiusura.

### Dealer Delta Pressure

Il delta netto dei dealer ricavato dalla catena di opzioni (call_delta_oi + put_delta_oi) — una lettura modellata a sé, distinta dal gamma. Un valore fortemente negativo modella dealer short delta, che *tenderebbero* a comprare più in alto per restare coperti; un valore fortemente positivo li modella long, con tendenza a vendere più in alto. Il segnale chiede "è probabile che i dealer inseguano questo movimento?".

### GEX Gradient

Gamma sopra lo spot rispetto al gamma sotto lo spot, con un controllo di concentrazione ATM. Indica su quale lato dello spot si concentra più peso gamma modellato. Gradiente positivo ⇒ più gamma sotto lo spot ⇒ un pavimento di sostegno modellato (inclinazione rialzista, ammesso che lì i dealer siano long gamma); negativo ⇒ più gamma sopra lo spot ⇒ inclinazione che amplifica al ribasso. L'inclinazione presuppone che valga il segno modellato del gamma dei dealer.

### Positioning Trap

PCR + squilibrio segnato dello smart money + momentum a 5 barre + inclinazione al flip + contesto di regime. Chiede se la folla è posizionata nel verso sbagliato — e fa fade della folla, non del prezzo. Un punteggio **positivo** elevato segnala una folla inclinata short (molte put) che può essere spinta **al rialzo** in uno squeeze — uno short-cover squeeze al rialzo; un punteggio **negativo** elevato segnala una folla inclinata long (molte call) vulnerabile a un flush **al ribasso**. Leggi il segno come direzione dello squeeze/flush, non come un semplice invito a "andare long/short".

## Come leggere il dashboard

Tre pattern:

1. **Cerca la confluenza.** Se tre o quattro dei sei segnali puntano nella stessa direzione con magnitudini non trascurabili, il composite si sposterà di conseguenza verso un regime di trend o di chop.
2. **Cerca la divergenza.** Quando il Tape Flow Bias è fortemente positivo ma il GEX Gradient è nettamente negativo, i dealer faderanno gli acquisti — il tape si sbaglia su dove si trova il pin strutturale.
3. **Guarda il Positioning Trap separatamente.** È l'unico segnale Basic con bias di mean-reversion. Una lettura di Trap fortemente **negativa** (una folla inclinata long a rischio di un flush al ribasso) insieme a un Tape fortemente long è un avvertimento, non una conferma — la folla a cui il tape si sta unendo è proprio quella che la Trap segnala come fuori posizione.

## Cosa non c'è nel dashboard Basic

I trigger. Nessuno di questi segnali si attiva. Se cerchi avvisi guidati da trigger, consulta l'[Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard).

## Ogni scheda ha una pagina di approfondimento

Clicca su una scheda qualsiasi e accedi alla pagina del singolo segnale, che mostra:

- Lo sparkline del punteggio a risoluzione più alta
- I valori di input correnti (le componenti che alimentano il punteggio)
- La spiegazione "Come è costruito"
- La cronologia recente

## Vedi anche

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
