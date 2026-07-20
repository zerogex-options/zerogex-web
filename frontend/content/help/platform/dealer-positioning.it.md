# Dealer Positioning

*L'intera superficie GEX — Net GEX allo spot, il gamma flip, call wall e put wall, e come leggere la term structure.*

---

## Cosa mostra questa pagina

La pagina Dealer Positioning è la **mappa strutturale** del book di opzioni. Ogni grafico e tile risponde a un'unica domanda: dove sono posizionati i dealer e cosa saranno costretti a fare al muoversi del prezzo?

È la pagina più importante per capire il contesto, anche se il trade viene poi eseguito altrove.

## I tile principali

### Net GEX allo spot

Il valore di dollar-gamma di tutte le opzioni aperte, con segno secondo la posizione dei dealer, valutato **al prezzo spot corrente**. Positivo ⇒ i dealer sono net long gamma; negativo ⇒ i dealer sono net short.

Il numero che vedi qui è misurato allo spot, non sommato lungo tutta la catena — questo è importante perché il segno allo spot determina il comportamento dei dealer in questo momento, indipendentemente da cosa faccia la curva cumulativa ad altri prezzi.

### Gamma Flip

Lo strike in cui la curva del gamma dei dealer attraversa lo zero. Il flip è la linea di regime: sopra, l'hedging è stabilizzante; sotto, l'hedging è amplificante. Il tile mostra sia lo strike assoluto sia la distanza percentuale dallo spot.

### Call Wall / Put Wall

Gli strike con il maggior call gamma e put gamma. Tendono ad agire come resistenza e supporto intraday. Il fatto che il wall funga effettivamente da "muro" è più affidabile in gamma positiva.

### Max Pain

Lo strike a cui il payout totale dei compratori di opzioni è minimizzato. Più rilevante nelle ultime 24–48 ore di una scadenza significativa.

## Il grafico del profilo GEX

Il grafico principale. Strike sull'asse x; gamma dei dealer sull'asse y. Tre cose da leggere:

1. **Dove la curva attraversa lo zero** — il gamma flip.
2. **Il maggior accumulo di call gamma** — il call wall.
3. **Il maggior accumulo di put gamma** — il put wall.

Il prezzo spot corrente è mostrato come linea di riferimento verticale. L'intervallo visibile è centrato sullo spot.

## Il grafico dei wall

Una vista separata e in formato più ampio della struttura dei wall, con call wall, put wall, max pain e gamma flip sovrapposti. Utile quando vuoi vedere come la struttura si è spostata dall'apertura.

## Il grafico della term structure

Il profilo GEX **per scadenza**. Impila 0DTE, le scadenze di questa settimana, quelle della prossima e le mensili in un'unica vista. Utile per:

- Individuare il **comportamento di pin sugli 0DTE** isolato dal book più ampio.
- Capire se un wall è concentrato sulle mensili (persistente) o sulle settimanali (transitorio).

## La heatmap strike × DTE

Una heatmap 2D del gamma dei dealer lungo strike (righe) e DTE (colonne). Le celle più "calde" sono gli strike che contano per le scadenze più vicine. La heatmap si sposta durante la giornata man mano che arriva flusso — osservarne il movimento è informativo.

## L'header di regime

La parte più alta della pagina ripete l'etichetta di regime GEX (Positivo / Negativo / In transizione) con l'interpretazione in una riga. Se l'etichetta di regime e la relazione spot/flip non concordano, passa il mouse sull'etichetta: il tooltip spiega il perché (l'etichetta "In transizione" scatta quando il Net GEX allo spot è vicino allo zero).

## Leggere il dealer positioning in tre passi

1. **Dove si trova lo spot rispetto al flip?** Sopra ⇒ stabilizzazione strutturale; sotto ⇒ amplificazione strutturale.
2. **Dove sono i wall?** Il call wall è la tua frizione al rialzo; il put wall è la tua frizione al ribasso.
3. **Come si sposta la heatmap?** Se il call wall sale, i dealer sono costretti a ripiegare più in alto — lettura strutturale rialzista.

## Perché il calcolo del gamma flip di ZeroGEX è diverso

Il flip è calcolato a partire da un **profilo del gamma dei dealer a spot shiftato** — non da un'approssimazione basata sul Net GEX cumulativo. Per la metodologia e il confronto prima/dopo, vedi [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Letture comuni

- **Spot ben sopra il flip, call wall vicino sopra** ⇒ pin verso la chiusura, fade delle estensioni.
- **Spot sotto il flip, put wall vicino sotto** ⇒ bias trend; ci si aspetta amplificazione in caso di rottura.
- **Spot vicino al flip con volatilità in salita** ⇒ rischio di cambio di regime; ridurre la size o attendere.
- **Concentrazione della heatmap sugli strike call 0DTE vicino allo spot** ⇒ pressione di pin verso la chiusura.

## Vedi anche

- [GEX Summary & Greeks](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
