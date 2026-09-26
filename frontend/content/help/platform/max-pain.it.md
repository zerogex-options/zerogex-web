# Max Pain

*Come viene calcolato il max pain, quando funziona da calamita e quando è pura coincidenza, e come leggerlo insieme al gamma profile.*

---

## Cos'è il max pain

Il max pain è lo **strike a scadenza** al quale il valore totale in dollari di tutte le opzioni aperte è minimo - cioè il livello dove, in aggregato, i compratori di opzioni "perdono di più".

È geometria dei payoff, non una prova di manipolazione: indica dove la maggior parte del premio delle opzioni scade senza valore, e da solo non misura l'hedging dei dealer. La vecchia storia secondo cui i market maker (i venditori naturali di opzioni ai clienti) spingerebbero attivamente lo spot verso il max pain è molto più sfumata di quanto sembri - vedi [Max Pain Spiegato](/education/max-pain-explained).

Il max pain è calcolato dall'open interest, che viene regolato e pubblicato per sessione anziché aggiornarsi tick per tick durante la giornata - trattalo quindi come struttura di contesto, non come un target predittivo in tempo reale.

## Cosa mostra questa pagina

### Il banner di regime

**Max Pain Regime** riassume dove si trova lo spot rispetto al max pain: **Pin Risk Elevated** quando lo spot è entro lo 0,4% da esso, altrimenti **Upside Magnet** (max pain sopra lo spot) o **Downside Magnet** (max pain sotto), con una breve lettura sotto.

### Le card dello snapshot

- **Current Max Pain (All Expirations)** - il max pain dell'intera catena: tutte le scadenze quotate riunite in un'unica curva di payout, ricalcolata una volta al giorno prima dell'apertura. Il chip accanto è il movimento implicito - max pain meno spot, in punti e in percentuale.
- **Nearest-Expiration Max Pain** - il max pain della sola scadenza più vicina. Poiché copre una singola scadenza, può trovarsi a qualche punto di distanza dal valore dell'intera catena.
- **Underlying Price** - l'ultimo prezzo.

### Notional Open Interest by Strike

Il nozionale di call e put a ogni strike per la scadenza scelta nel menu **Expiration**, con max pain e spot evidenziati. Il max pain è per singola scadenza, quindi la linea tratteggiata del max pain si sposta con il menu. Le barre mostrano dove sono i soldi; il max pain è il punto in cui i due accumuli si bilanciano.

### Max Pain vs Underlying Price

Il max pain come linea sopra le candele del sottostante, con un proprio menu del timeframe - utile per individuare una deriva verso (o lontano da) lo spot. Aspettati gradini più che una deriva continua: il max pain si muove solo quando l'open interest viene riscritto al regolamento.

## Quando il max pain conta

Il max pain è più affidabile:

- **Nelle ultime 24-48 ore prima di una scadenza significativa.** Prima di allora, la catena è troppo attiva perché il max pain sia stabile.
- **Per lo 0DTE su SPX.** La catena 0DTE è abbastanza grande perché gli effetti di pin *possano* emergere - anche se il pinning è probabilistico, non meccanico.
- **Quando la calamita gamma si allinea con la calamita del max pain.** Quando lo strike di max pain è anche uno strike a gamma elevata (un wall), un pin è *più probabile*. Quando non si allineano, il max pain è più probabilmente una coincidenza - ma nessuna delle due letture è garantita.

## Quando non conta

- **Nei mercati in trend attivo.** I catalizzatori macro sovrastano il comportamento da pin.
- **Per scadenze piccole o weekly illiquide.** Non c'è abbastanza open interest da generare pressione di pinning.
- **Lontano dalla scadenza.** Il tempo alla scadenza è uno dei fattori principali - all'inizio della vita di un contratto la catena è troppo attiva perché il max pain si assesti.

## Come leggerlo insieme al gamma

Due letture:

1. **Max pain molto vicino a un wall** ⇒ la pressione di pin verso la chiusura è più probabile. Il wall è il livello strutturale; il max pain aggiunge contesto, non una garanzia.
2. **Max pain lontano dai wall e dallo spot** ⇒ ignora il max pain. La pressione strutturale è altrove.

## Vedi anche

- [Max Pain Spiegato - Funziona Davvero?](/education/max-pain-explained)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Gamma Walls Spiegati](/education/gamma-walls-explained)
