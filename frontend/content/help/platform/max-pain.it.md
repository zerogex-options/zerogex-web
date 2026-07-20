# Max Pain

*Come viene calcolato il max pain, quando funziona da calamita e quando è pura coincidenza, e come leggerlo insieme al gamma profile.*

---

## Cos'è il max pain

Il max pain è lo **strike a scadenza** al quale il valore totale in dollari di tutte le opzioni aperte è minimo — cioè il livello dove, in aggregato, i compratori di opzioni "perdono di più".

L'argomentazione classica è che i market maker (che sono i naturali venditori di opzioni al retail) abbiano interesse a spingere lo spot verso il max pain. L'argomentazione più onesta è più sfumata — vedi [Max Pain Spiegato](/education/max-pain-explained).

## Cosa mostra questa pagina

### Il riquadro principale

Lo strike di max pain attuale per la prossima scadenza rilevante, con la distanza dallo spot.

### Il selettore di scadenza

Il max pain è calcolato per singola scadenza. Il selettore permette di scegliere 0DTE, le scadenze di questa settimana, quelle della prossima e la prossima mensile.

### Il grafico

Sull'asse x gli strike; sull'asse y la somma del payout delle opzioni in-the-money (call + put). Il punto minimo della curva è il max pain. Il grafico mostra anche:

- Lo spot attuale.
- Il call wall e il put wall dal profilo GEX.
- Il gamma profile specifico per la scadenza, sottostante.

### La migrazione storica

Un piccolo pannello che mostra come il max pain si è spostato nelle ultime sessioni per la scadenza selezionata — utile per individuare una deriva verso (o lontano da) lo spot.

## Quando il max pain conta

Il max pain è più affidabile:

- **Nelle ultime 24–48 ore prima di una scadenza significativa.** Prima di allora, la catena è troppo attiva perché il max pain sia stabile.
- **Per lo 0DTE su SPX.** La catena 0DTE ha una size sufficiente perché la pressione di pinning sia reale.
- **Quando la calamita gamma si allinea con la calamita del max pain.** Quando lo strike di max pain coincide anche con uno strike a gamma elevata (un wall), la pressione di pinning è reale. Quando non si allineano, è per lo più coincidenza.

## Quando non conta

- **Nei mercati in trend attivo.** I catalizzatori macro sovrastano il comportamento da pin.
- **Per scadenze piccole o weekly illiquide.** Non c'è abbastanza open interest da generare pressione di pinning.
- **Lontano dalla scadenza.** Il "tempo alla scadenza" è il fattore determinante.

## Come leggerlo insieme al gamma

Due letture:

1. **Max pain molto vicino a un wall** ⇒ pin strutturale verso la chiusura. Il wall è il livello; il max pain è l'esca.
2. **Max pain lontano dai wall e dallo spot** ⇒ ignora il max pain. La pressione strutturale è altrove.

## Vedi anche

- [Max Pain Spiegato — Funziona Davvero?](/education/max-pain-explained)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Gamma Walls Spiegati](/education/gamma-walls-explained)
