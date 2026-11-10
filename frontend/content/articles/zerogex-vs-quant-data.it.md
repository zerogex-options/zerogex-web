# ZeroGEX vs Quant Data (2026): mappe GEX, prezzi e copertura a confronto

*Un confronto equo, fianco a fianco, tra ZeroGEX e Quant Data (quantdata.us): per cosa è costruita ciascuna piattaforma, come si confrontano la Interval Map di Quant Data e la GEX Heatmap di ZeroGEX, quanto costano le API, dove Quant Data è la scelta migliore e dove è più adatto uno strumento dedicato ai livelli degli indici. I dettagli su Quant Data provengono dal suo sito, dal suo centro assistenza e dalle schede delle sue app, verificati in data {{quantdata:checked}}.*

---

## In breve

- **Quant Data** è costruito attorno al flusso di ordini sulle opzioni in tempo reale, con i print di dark pool e lit pool, notizie, avvisi e app per iOS e Android. I suoi strumenti di esposizione, tra cui la Interval Map, coprono qualsiasi azione o indice statunitense con opzioni quotate.
- **ZeroGEX** è costruito attorno a un solo compito: il posizionamento modellato dei dealer - il gamma flip, i call e put wall e i segnali costruiti su di essi - per sei simboli: SPX, SPY, QQQ, NDX e i futures ES e NQ.

Se i tuoi trade partono dal flusso di ordini sull'intero mercato, Quant Data è più vicino a ciò che ti serve. Se fai day trading sul complesso degli indici e ne vuoi i livelli in profondità, lo è ZeroGEX.

## La Interval Map e la GEX Heatmap

La vista più nota di Quant Data è la Interval Map: gli strike in verticale, la sessione in orizzontale e una bolla per strike per intervallo, dimensionata in base all'esposizione e colorata di verde se positiva e di rosso se negativa, con il prezzo del sottostante tracciato attraverso la mappa. Può mostrare l'esposizione gamma, delta, vanna o charm, a intervalli da un minuto in su, come valori grezzi o come variazione da un intervallo al successivo.

La vista di ZeroGEX più simile è la GEX Heatmap, inclusa in Basic: la gamma netta dei dealer per strike nel corso della sessione, in arancione se positiva e in viola se negativa (in blu con i temi chiari), con le candele del prezzo e il gamma flip tracciati sopra ([come leggerla](/help/platform/reading-charts)). La sua vista Dots dispone gli stessi numeri come fa la Interval Map: un punto per strike per intervallo, dimensionato in base alla gamma in quel punto, verde se positiva e rosso se negativa, per 10, 20 o 40 strike attorno al prezzo, con il prezzo tracciato attraverso la vista. Nella pagina Dealer Positioning, una seconda heatmap incrocia gli strike con i giorni alla scadenza, fino a una settimana, così puoi vedere quali scadenze portano la gamma su ciascuno strike.

Le differenze vanno in entrambe le direzioni:

- **Più esposizioni e più ticker su Quant Data.** ZeroGEX mappa solo la gamma, su sei simboli. Legge vanna e charm come un segnale anziché come una mappa, e non pubblica l'esposizione delta, di proposito: [perché ZeroGEX non pubblica il DEX](/education/why-we-dont-publish-dex).
- **La linea di regime su ZeroGEX.** Il gamma flip è tracciato direttamente sulla heatmap, a partire da un profilo di gamma calcolato su un intervallo di prezzi, così prezzo, strike e linea di regime stanno in un'unica immagine. Il metodo è nella pagina [Metodologia](/methodology).

Entrambi gli strumenti modellano la gamma dei dealer nello stesso modo di base: a partire dalla catena delle opzioni, contando le call come positive e le put come negative. Il centro assistenza di Quant Data descrive i suoi valori come una stima, non uno sguardo diretto nell'inventario di un dealer, e ZeroGEX dice lo stesso.

### Leggere uno strike che "cresce" durante la giornata

L'open interest viene pubblicato una volta al giorno, dopo la chiusura. Su una mappa della gamma costruita su di esso, il colore di uno strike cambia durante la sessione perché le sue opzioni vengono riprezzate al muoversi di prezzo, tempo e volatilità implicita, non perché i dealer abbiano aperto nuove posizioni. Vicino alla scadenza, la gamma vicino al denaro aumenta man mano che il tempo si esaurisce, quindi uno strike 0DTE accanto al prezzo può intensificarsi nel corso della giornata senza alcuna nuova posizione. Leggi una bolla o una banda che cresce come "questo strike conta di più man mano che il tempo scorre", e leggi il flusso separatamente. Su ZeroGEX, questo è il compito della pagina Hedging Flow, che stima la copertura implicita nelle operazioni di oggi ([come funziona](/education/hedging-flow-explained)).

## Prezzi

Prezzi di listino, prima di promozioni e imposte, verificati in data {{quantdata:checked}}. Il piano piattaforma di Quant Data, che copre la sua dashboard web e le sue app per iOS e Android, costa {{quantdata:platform:monthly}} al mese, oppure {{quantdata:platform:annual}} all'anno, con una prova gratuita di 7 giorni in entrambi i casi. Entrambi i prezzi valgono per trader non professionali; i professionisti registrati vengono indirizzati a un piano Professional separato. La sua API è a sua volta un piano separato. I prezzi di ZeroGEX sono quelli indicati oggi nella sua pagina [Prezzi](/pricing).

| Piano | Fatturazione mensile | Fatturazione annuale |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mese | {{zgx:basic:annual}}/anno (circa {{zgx:basic:annual:mo}}/mese) |
| ZeroGEX Pro, con accesso API | {{zgx:pro:monthly}}/mese | {{zgx:pro:annual}}/anno (circa {{zgx:pro:annual:mo}}/mese) |
| Quant Data, per non professionisti | {{quantdata:platform:monthly}}/mese | {{quantdata:platform:annual}}/anno (circa {{quantdata:platform:annual:mo}}/mese) |
| Quant Data, piano API | {{quantdata:api:monthly}}/mese | {{quantdata:api:annual}}/anno (circa {{quantdata:api:annual:mo}}/mese) |

Entrambi i piani ZeroGEX costano meno del piano piattaforma di Quant Data, con fatturazione mensile o annuale, e ZeroGEX Pro include l'accesso API che Quant Data vende come piano separato. A quei prezzi, però, si comprano cose diverse: il prezzo di Quant Data copre flusso di ordini, print dei dark pool, notizie e mappe di esposizione su 6.000+ ticker, e quello di ZeroGEX copre sei simboli in profondità.

Nemmeno le due API hanno le stesse dimensioni. Quella di Quant Data copre 30+ endpoint su 6.000+ ticker, inclusi i print dei dark pool e le superfici di volatilità implicita, con un anno di storico e un server MCP ospitato. Quella di ZeroGEX copre i sei simboli che segue: livelli, GEX, flusso, segnali e il loro storico.

ZeroGEX Basic mensile parte con una prova gratuita di 7 giorni, e tutti gli altri piani ZeroGEX sono coperti da una garanzia soddisfatti o rimborsati di 7 giorni. Il dettaglio completo è nella pagina [Prezzi](/pricing).

## Dove Quant Data è la scelta migliore

- **Ampiezza.** Flusso di ordini e mappe di esposizione per qualsiasi azione o indice statunitense con opzioni quotate. ZeroGEX copre sei simboli.
- **Flusso di ordini, print dei dark pool e notizie in un unico feed.** È il nucleo di Quant Data. ZeroGEX non ha dati sui dark pool né un feed di notizie, e le sue pagine sul flusso coprono solo il complesso degli indici.
- **Più tipi di esposizione sulla mappa.** Delta, vanna e charm accanto alla gamma, a intervalli a tua scelta.
- **App mobile e avvisi push.** Quant Data ha app native per iOS e Android con notifiche push. ZeroGEX funziona nel browser, su desktop o su telefono, e i trigger dei suoi segnali compaiono all'interno dell'app.
- **Un'API più ampia.** 30+ endpoint, un anno di storico e dati sui dark pool, per costruire i tuoi strumenti su molti ticker.
- **Supporto 24 ore su 24.** I piani di Quant Data indicano un supporto via live chat 24/7. Il supporto di ZeroGEX è via email.

## Dove ZeroGEX è la scelta migliore

- **Profondità sul complesso degli indici.** Tutto ciò che ZeroGEX sviluppa è pensato per SPX, SPY, QQQ, NDX, ES e NQ: il gamma flip, i wall, la gamma per scadenza, il flusso di vanna e charm, il flusso di hedging e quattordici segnali costruiti sui livelli, con i loro metodi illustrati nella [guida ai segnali](/guides/signals-explained).
- **La linea di regime su ogni grafico.** Il gamma flip è tracciato sulla GEX Heatmap e sui grafici di prezzo: il livello in cui l'hedging modellato dei dealer tende a passare dallo smorzare i movimenti all'estenderli.
- **Un metodo pubblicato e un track record valutato.** ZeroGEX documenta come calcola il gamma flip nella sua pagina [Metodologia](/methodology) e valuta ogni previsione che pubblica, comprese quelle sbagliate, nel suo [Track Record](/track-record).
- **I livelli sui grafici che usi già.** Script gratuiti per TradingView e thinkorswim, e indicatori per NinjaTrader, Sierra Chart e Bookmap che con Pro si aggiornano da soli. Vedi [Integrazioni](/integrations).
- **Un prezzo più basso, con l'API inclusa.** Entrambi i piani ZeroGEX costano meno del piano piattaforma di Quant Data, e l'accesso API è incluso in Pro anziché in un piano separato.
- **Un modo gratuito per verificare prima.** La pagina [livelli gamma SPX](/spx-gamma-levels) e le pagine gemelle non richiedono registrazione, e nemmeno il [server MCP](/education/gamma-levels-in-claude) che porta gli stessi livelli negli assistenti IA.

## Come decidere

- **Fai trading su singoli titoli partendo dal flusso di ordini, o vuoi print dei dark pool e notizie in un unico feed:** Quant Data.
- **Vuoi mappe di delta, vanna e charm su molti ticker:** Quant Data.
- **Fai day trading su SPX, SPY, QQQ, NDX, ES o NQ e vuoi il flip, i wall e i segnali di posizionamento dei dealer in profondità:** ZeroGEX.
- **Non hai ancora deciso:** apri la pagina gratuita [livelli gamma SPX](/spx-gamma-levels), senza bisogno di registrazione, e confrontala con ciò che usi oggi.

---

Funzionalità e prezzi di Quant Data provengono da [quantdata.us](https://quantdata.us) e dal suo [centro assistenza](https://help.quantdata.us/en/), verificati in data {{quantdata:checked}}, e possono cambiare in qualsiasi momento, quindi confermali lì. I prezzi di ZeroGEX in questa pagina sono letti dal suo listino prezzi in vigore. ZeroGEX non è affiliato a Quant Data. Solo contenuto educativo, non una raccomandazione di trading.
