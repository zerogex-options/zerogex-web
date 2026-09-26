# Basic Signal Dashboard

*Le sei letture continue che affiancano il composite - cosa sono, come leggerle e dove approfondire.*

---

## Cos'è il Basic Signal Dashboard

Il Basic Signal Dashboard (Basic e Pro) è la **vista a colpo d'occhio** di tutti e sei i segnali Basic. Una striscia in alto mostra i sei punteggi tutti insieme. Sotto ci sono tre schede:

- **Signal Grid** - una scheda per segnale con il punteggio sulla linea da -100 a +100, uno sparkline, una descrizione di una riga e i **Context values**, che puoi espandere per vedere gli input dietro al punteggio.
- **Confluence Matrix** - quanto spesso ogni coppia di segnali si è trovata d'accordo o in disaccordo sulla direzione.
- **Event Timelines** - il percorso recente del punteggio di ciascun segnale, con i cambi di direzione segnati.

I segnali Basic sono **continui** e **consultivi**. Non attivano avvisi discreti e hanno **peso zero nel Composite Score (MSI)** - un movimento qui non muove l'MSI. Usali come verifica anticipata: quando le letture di flusso divergono da quelle di struttura, spesso un cambio di regime è già in corso prima che l'MSI reagisca.

Una scheda il cui punteggio supera ±25 viene bordata e marcata *Triggered*; al di sotto mostra *Stand by*. Su questo dashboard serve a evidenziare una lettura forte, non è un evento di trigger.

## I sei segnali

| Segnale | Cosa chiede | Bias di trade |
| --- | --- | --- |
| Tape Flow Bias | "Da che parte pende il tape?" | Continuazione |
| Skew Delta | "Quanta paura è prezzata nei put?" | Lettura direzionale |
| Vanna/Charm Flow | "La volatilità o il tempo potrebbero spingere i dealer a ri-coprirsi?" | Continuazione |
| Dealer Delta Pressure | "I dealer sono costretti a inseguire questo movimento?" | Lettura direzionale |
| GEX Gradient | "Il gamma è concentrato da un lato?" | Lettura direzionale |
| Positioning Trap | "La folla è posizionata al contrario?" | Mean-reversion (contro la folla) |

Nessuno dei sei alimenta il Composite Score. L'unica sovrapposizione: l'MSI ha una propria componente Dealer Delta Pressure, costruita sulla stessa lettura del delta netto dei dealer del segnale Basic.

## Lettura rapida di ciascuno

### Tape Flow Bias

Classificazione dell'aggressore secondo Lee-Ready sul tape delle opzioni. Netto tra premio di acquisto/vendita delle call e premio di acquisto/vendita dei put. Positivo = gli aggressori stanno pagando per il rialzo. Un segnale forte qui, in assenza di un GEX gradient opposto, è convinzione in tempo reale.

### Skew Delta

Lo spread tra IV dei put OTM e IV delle call OTM rispetto al proprio baseline, con segno invertito così che il punteggio si legga in modo direzionale: negativo significa che la paura è prezzata (skew sui put ricco); positivo significa che il premio delle call è prezzato (avidità). Utile più come termometro del sentiment che come segnale di precisione.

### Vanna/Charm Flow

Vanna e charm aggregati dei dealer. Il vanna modella ciò che i dealer *potrebbero* coprire se la volatilità si muove; il charm modella la deriva del delta con il passare del tempo (a spot e IV costanti). Una lettura positiva modella un flusso di copertura che *può* sostenere prezzi più alti; una negativa il contrario - direzione e ampiezza dipendono comunque dalla composizione del book e da chi detiene le opzioni. La pressione del charm tende a crescere verso la chiusura.

### Dealer Delta Pressure

Il delta netto dei dealer ricavato dalla catena di opzioni (call_delta_oi + put_delta_oi) - una lettura modellata a sé, distinta dal gamma. Il punteggio è invertito: un punteggio fortemente **positivo** modella dealer short delta, che *tenderebbero* a comprare in un rialzo per restare coperti (inclinazione rialzista); un punteggio fortemente **negativo** li modella long delta, con tendenza a vendere nei rialzi (inclinazione ribassista). Il segnale chiede "è probabile che i dealer inseguano questo movimento?".

### GEX Gradient

Gamma sopra lo spot rispetto al gamma sotto lo spot, con un controllo di quanto se ne concentra nelle ali molto OTM (molto gamma nelle ali riduce la fiducia). Indica su quale lato dello spot si concentra più peso gamma modellato, e la lettura dipende dal regime:

- Quando i dealer sono modellati **short gamma**, più gamma sopra lo spot dà un punteggio **positivo** (i dealer inseguirebbero un rialzo) e più gamma sotto un punteggio negativo (inseguirebbero un ribasso).
- Quando sono modellati **long gamma**, la lettura si inverte e viene smorzata: più gamma sotto lo spot dà un punteggio positivo (un pavimento di sostegno), più gamma sopra un punteggio negativo (resistenza sopra).

L'inclinazione presuppone che valga il segno modellato del gamma dei dealer.

### Positioning Trap

PCR + squilibrio segnato dello smart money + momentum a 5 barre + inclinazione al flip + contesto di regime. Chiede se la folla è posizionata nel verso sbagliato - e fa fade della folla, non del prezzo. Un punteggio **positivo** elevato segnala una folla inclinata short (molte put) che può essere spinta **al rialzo** in uno squeeze - uno short-cover squeeze al rialzo; un punteggio **negativo** elevato segnala una folla inclinata long (molte call) vulnerabile a un flush **al ribasso**. Leggi il segno come direzione dello squeeze/flush, non come un semplice invito a "andare long/short".

## Come leggere il dashboard

Tre pattern:

1. **Cerca la confluenza.** Se tre o quattro dei sei segnali puntano nella stessa direzione con magnitudini non trascurabili, quella è convinzione. La scheda **Confluence Matrix** mostra quali coppie si sono trovate d'accordo.
2. **Cerca la divergenza.** Quando il Tape Flow Bias è fortemente positivo ma il GEX Gradient è nettamente negativo, il posizionamento modellato dei dealer va contro gli acquisti - il tape potrebbe sbagliarsi su dove si trova il pin strutturale. Letture di flusso che divergono da quelle di struttura sono proprio l'allarme anticipato per cui questa pagina è costruita.
3. **Guarda il Positioning Trap separatamente.** È l'unico segnale Basic con bias di mean-reversion. Una lettura di Trap fortemente **negativa** (una folla inclinata long a rischio di un flush al ribasso) insieme a un Tape fortemente long è un avvertimento, non una conferma - la folla a cui il tape si sta unendo è proprio quella che la Trap segnala come fuori posizione.

## Cosa non c'è nel dashboard Basic

Le regole di trigger. Nessuno di questi segnali si attiva - l'etichetta *Triggered* segnala solo un punteggio oltre ±25. Se cerchi segnali guidati da trigger, consulta l'[Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard), che fa parte di Pro.

## Ogni scheda ha una pagina di approfondimento

Clicca su una scheda qualsiasi (o scegli il segnale sotto Dashboard segnali base nella barra laterale) per aprire la pagina del singolo segnale, che mostra:

- Il punteggio con una lettura in una riga e uno storico del punteggio espandibile
- I valori di input correnti (le componenti che alimentano il punteggio)
- La spiegazione "How it's built"
- La Event Timeline - il percorso recente del punteggio, con i cambi di direzione segnati

## Vedi anche

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
