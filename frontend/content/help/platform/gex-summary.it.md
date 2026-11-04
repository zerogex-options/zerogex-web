# GEX Summary

*I numeri principali del GEX e i livelli che ne derivano, su un'unica schermata - più quanto le opzioni vicine alla scadenza spostano il gamma flip, e se il gamma dei dealer di oggi è insolito.*

---

## Cosa mostra questa pagina

La pagina GEX Summary è la vista **in numeri** del book di opzioni. Mentre Dealer Positioning è strutturale (profilo, wall, heatmap), questa pagina riunisce dieci numeri principali su un'unica schermata, mappa il gamma dei dealer lungo prezzo e tempo, poi mostra quanto il gamma flip dipende dalle opzioni vicine alla scadenza e come il gamma dei dealer di oggi si confronta con il proprio storico.

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
- **Call Wall (Resistance)** e **Put Wall (Support)** - lo strike allo spot o sopra con il maggior call gamma e lo strike allo spot o sotto con il maggior put gamma, ciascuno sommato sulla scadenza di oggi e sulle due successive (0-2DTE), con la distanza dallo spot. Un grafico limitato ai soli 0DTE può mostrare uno strike diverso. Le etichette sono la lettura abituale, non una garanzia: nel nostro studio su 737 test di wall, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora e quelli del Nasdaq circa la metà delle volte, e il segno modellato del gamma dei dealer non ha cambiato questo risultato.

## Gamma Surface

Il gamma modellato dei dealer come superficie 3D: il prezzo ipotetico su un asse, il tempo sull'altro, da adesso fino al regolamento della prima scadenza selezionata. Ogni punto è il gamma che il modello attribuisce ai dealer se il prezzo si trova lì in quel momento: ogni contratto selezionato viene rivalutato a quel prezzo con quella parte della sua vita già trascorsa, a peso pieno (senza ponderazione per orizzonte) e con la volatilità implicita ferma al livello attuale. Il gamma della stessa giornata si concentra verso il regolamento, quindi la superficie sale verso la fine dell'asse del tempo attorno agli strike 0DTE più pesanti.

Il controllo **Expiry** sceglie quali scadenze valutare: **All** come impostazione predefinita, oppure qualsiasi insieme di date. Scegli da sola una scadenza successiva per vedere la sua superficie fino al proprio regolamento. Le linee alla base segnano il Call Wall, il Put Wall e il Gamma Flip per la stessa selezione - gli stessi livelli che ogni altro grafico mostra per essa - oltre allo spot, e la linea tratteggiata segue la superficie allo spot. Poiché la superficie conta ogni contratto a peso pieno, il suo attraversamento dello zero non coincide necessariamente con il Gamma Flip. Trascina per ruotare; sul telefono, tocca prima **Rotate & zoom**.

## Gamma Flip · Term Structure

Il gamma flip di oggi, ricalcolato con cinque impostazioni di orizzonte, da 12 ore a 5 giorni. L'orizzonte è una ponderazione, non un intervallo di date: ogni contratto conta in proporzione a quanta parte dell'orizzonte vive ancora (giorni alla scadenza ÷ orizzonte, al massimo 1), quindi un orizzonte più corto fa contare di più le opzioni vicine alla scadenza.

Tutti gli orizzonti usano le stesse opzioni: le tre scadenze più vicine, che arrivano a circa 2-4 giorni su SPX, SPY, QQQ e NDX (ES e NQ usano le opzioni di SPX e NDX) e a circa una settimana su NVDA. Non vengono aggiunte opzioni a scadenza più lunga, quindi non è un flip a 20 o 60 giorni, né il livello di zero gamma che otterresti da 90 giorni di open interest. Appena l'orizzonte supera l'ultima di queste scadenze, il peso di ogni contratto si riduce dello stesso fattore: il flip smette di muoversi e cala solo il Net GEX @ spot. Da lunedì a mercoledì l'ultima di solito è a meno di 3 giorni su SPX, SPY, QQQ e NDX, quindi 3d e 5d coincidono.

Ogni punto è colorato in base al segno del gamma dei dealer allo spot. I contorni a rombo segnano il flip registrato altrettanti giorni fa, e una X rossa indica un orizzonte in cui non è stato possibile risolvere alcun attraversamento. Usalo per capire quanto il flip dipende dalle opzioni vicine alla scadenza.

## Horizon × Price Contour

La stessa domanda come superficie: il gamma modellato dei dealer lungo prezzi spot ipotetici (x) e le stesse cinque impostazioni di orizzonte (y), tutte sulle stesse tre scadenze più vicine. Le celle blu sono long gamma (stabilizzanti), quelle rosse short gamma (destabilizzanti), e una linea nera segue l'attraversamento dello zero - il flip a ogni impostazione. Delle guide segnano lo spot corrente e i call e put wall più pesanti.

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
2. **Confronta il flip con Raw nearest.** Quando i due sono molto distanti, è il gamma a scadenza ravvicinata a tirare. La term structure mostra quanto si sposta il flip quando le opzioni vicine alla scadenza contano di più o di meno.

## Vedi anche

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Vanna e Charm spiegati per i trader di opzioni](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) spiegato](/education/gamma-exposure-explained)
