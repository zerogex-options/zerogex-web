# GEX Summary

*I numeri principali del GEX e i livelli che ne derivano, su un'unica schermata - più la tenuta del gamma flip tra i diversi orizzonti, e se il gamma dei dealer di oggi è insolito.*

---

## Cosa mostra questa pagina

La pagina GEX Summary è la vista **in numeri** del book di opzioni. Mentre Dealer Positioning è strutturale (profilo, wall, heatmap), questa pagina riunisce dieci numeri principali su un'unica schermata, poi mostra come il gamma flip cambia tra gli orizzonti delle opzioni e come il gamma dei dealer di oggi si confronta con il proprio storico.

Il selettore **GEX unit** nell'intestazione passa ogni valore GEX in dollari da gamma per movimento dell'1% (predefinito) a gamma per 1 punto. L'esposizione è la stessa in entrambi i casi; cambia solo l'unità.

## La riga superiore

### Prezzo

Il prezzo in tempo reale del simbolo attivo. Quando il mercato cash è chiuso e il prezzo arriva dai futures, la card lo indica e nomina il contratto - i livelli GEX restano sull'indice cash.

### Net GEX

Il gamma modellato dei dealer in dollari, secondo la convenzione tradizionale sull'open interest (call positive, put negative). Con questa convenzione, un net GEX positivo è coerente con dealer che *tendono* a comprare sulla debolezza e vendere sulla forza; negativo, con dealer che *tendono* a inseguire il prezzo. Mostrato allo spot - il valore coerente nel segno con il gamma flip, non il totale sull'intera catena.

> Il Net GEX è una **stima**: modella il gamma dei dealer con la convenzione call positive / put negative. L'inventario reale dei dealer non è direttamente osservabile dai dati pubblici della catena di opzioni.

### Gamma Flip

Il flip strutturale: il prezzo in cui il gamma aggregato modellato dei dealer cambia segno, calcolato con una ponderazione per orizzonte che attenua i wall 0DTE a scadenza ravvicinata. Sopra, l'hedging modellato *tende* a smorzare i movimenti; sotto, ad amplificarli. **Raw nearest**, subito sotto, è l'attraversamento dello zero più vicino sul profilo non ponderato - la convenzione pubblicata da molte altre dashboard. Senza la ponderazione, i wall a scadenza ravvicinata possono avvicinarlo allo spot molto più del flip strutturale.

### Max Pain

Lo strike a cui il payout ai detentori di opzioni alla scadenza è minimo. Vedi [Max Pain](/help/platform/max-pain) per capire quando conta e quando no.

### Pin Strike

Lo strike 0DTE raggiungibile con il gamma positivo modellato dei dealer più forte verso la chiusura, con la sua forza (Strong, Moderate o Weak) e la percentuale di confidenza. Vedi [Pin Strike](/help/platform/pin-strike) per come viene calcolato e cosa significa davvero "Weak".

## La riga inferiore

- **Call GEX** e **Put GEX** - l'esposizione gamma totale modellata di call e put, le due metà dietro il Net GEX.
- **Put/Call Ratio** - il volume delle put diviso per il volume delle call. Sopra 1 tende al ribasso; sotto 1, al rialzo.
- **Call Wall (Resistance)** e **Put Wall (Support)** - lo strike allo spot o sopra con il maggior call gamma e lo strike allo spot o sotto con il maggior put gamma, ciascuno sommato sulla scadenza di oggi e sulle due successive (0-2DTE), con la distanza dallo spot. Un grafico limitato ai soli 0DTE può mostrare uno strike diverso. Le etichette sono la lettura abituale, non una garanzia: che un wall tenga dipende dal segno modellato del gamma dei dealer e dal flusso circostante.

## Gamma Flip · Term Structure

Il gamma flip di oggi, calcolato separatamente per ogni orizzonte delle opzioni - da 1 a 60 giorni come impostazione predefinita, con i preset **Std**, **Short** e **Long**. Ogni punto è colorato in base al segno del gamma dei dealer allo spot. I contorni a rombo segnano il flip registrato altrettanti giorni fa, e una X rossa indica un orizzonte in cui non è stato possibile risolvere alcun attraversamento. Usalo per capire se il flip regge tra gli orizzonti o è un effetto delle scadenze ravvicinate.

## Horizon × Price Contour

La stessa domanda come superficie: il gamma modellato dei dealer lungo prezzi spot ipotetici (x) e orizzonti delle opzioni (y). Le celle blu sono long gamma (stabilizzanti), quelle rosse short gamma (destabilizzanti), e una linea nera segue l'attraversamento dello zero - il flip a ogni orizzonte. Delle guide segnano lo spot corrente e i call e put wall più pesanti.

## Gamma Pulse

*"Is current dealer gamma irregular?"* Il Net GEX allo spot e il net GEX totale della catena, ciascuno collocato rispetto agli ultimi 30 giorni e all'intero storico - **EXTREME HIGH**, **ELEVATED**, **NORMAL**, **LOW** o **EXTREME LOW** - con un trofeo quando un valore stabilisce un record. Il confronto tiene conto dell'ora della sessione, così il consueto pin di fine giornata non viene segnalato come insolito.

## Convenzioni sui segni

ZeroGEX assegna il segno a ogni greca da una prospettiva di dealer modellata - la stessa convenzione ovunque, non un inventario osservato:

- Gamma positivo ⇒ con la convenzione call positive / put negative, i dealer sono *secondo il modello* net long di call / short di put, e si coprono contro il prezzo.
- Gamma negativo ⇒ i dealer sono *secondo il modello* net short di gamma, e si coprono nella direzione del prezzo.

Quando consulti un altro provider di dati GEX, verifica sempre la convenzione dei segni. La maggior parte usa la stessa convenzione basata sulla prospettiva del dealer, ma alcuni la invertono.

## Come leggere la pagina

Due schemi:

1. **Verifica incrociata con Dealer Positioning.** Se il Net GEX è significativamente positivo ma il profilo GEX mostra la curva che scende in negativo appena sotto lo spot, ti trovi sulla linea di regime - il rischio è asimmetrico.
2. **Confronta il flip con Raw nearest.** Quando i due sono molto distanti, è il gamma a scadenza ravvicinata a tirare. La term structure del flip mostra se il livello regge tra gli orizzonti.

## Vedi anche

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Vanna e Charm spiegati per i trader di opzioni](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) spiegato](/education/gamma-exposure-explained)
