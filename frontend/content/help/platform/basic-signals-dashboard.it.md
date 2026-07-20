# Basic Signal Dashboard

*Le sei letture continue che alimentano il composite — cosa sono, come leggerle e dove approfondire.*

---

## Cos'è il Basic Signal Dashboard

Il Basic Signal Dashboard è la **griglia a colpo d'occhio** di tutti e sei i segnali Basic. Ogni scheda mostra il punteggio corrente sulla linea [-1, +1], il contributo che sta dando al composite e uno sparkline.

I segnali Basic sono **continui**. Non attivano avvisi discreti — spingono il composite verso l'alto o verso il basso a ogni aggiornamento.

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

Lo spread tra IV dei put OTM e IV delle call OTM rispetto al proprio baseline. Letture negative significano che la paura è prezzata; letture positive significano che il premio delle call è prezzato (avidità). Utile più come termometro del sentiment che come segnale di precisione.

### Vanna/Charm Flow

Vanna e charm aggregati dei dealer. Il vanna è ciò che i dealer copriranno se la volatilità si muove; il charm è ciò che copriranno con il passare del tempo. Letture positive significano che il flusso strutturale supporta prezzi più alti; negative, il contrario. Il charm accelera verso la chiusura.

### Dealer Delta Pressure

Il delta netto dei dealer ricavato dalla catena di opzioni (call_delta_oi + put_delta_oi). Un valore fortemente negativo significa che i dealer sono short delta e compreranno se il prezzo sale; un valore fortemente positivo significa che sono long e venderanno se il prezzo sale. Il segnale chiede "i dealer sono costretti a inseguire?".

### GEX Gradient

Gamma sopra lo spot rispetto al gamma sotto lo spot, con un controllo di concentrazione ATM. Indica su quale lato dello spot si concentra più peso gamma. Gradiente positivo ⇒ gamma concentrato sopra lo spot ⇒ pin strutturale al rialzo; negativo ⇒ pin strutturale al ribasso.

### Positioning Trap

PCR + squilibrio segnato dello smart money + momentum a 5 barre + inclinazione al flip + contesto di regime. Chiede se la folla è posizionata nel verso sbagliato. **Questo è un segnale di mean-reversion** — un punteggio positivo elevato è un segnale di "vendi il rialzo", non di "vai long".

## Come leggere il dashboard

Tre pattern:

1. **Cerca la confluenza.** Se tre o quattro dei sei segnali puntano nella stessa direzione con magnitudini non trascurabili, il composite lo rifletterà.
2. **Cerca la divergenza.** Quando il Tape Flow Bias è fortemente positivo ma il GEX Gradient è nettamente negativo, i dealer faderanno gli acquisti — il tape si sbaglia su dove si trova il pin strutturale.
3. **Guarda il Positioning Trap separatamente.** È l'unico segnale Basic con bias di mean-reversion. Tratta una lettura di Trap fortemente positiva insieme a un Tape fortemente long come un avvertimento, non come una conferma.

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
