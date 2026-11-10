# ZeroGEX vs TradeGEX (2026): livelli gamma sui futures, prezzi e copertura a confronto

*Un confronto equo, fianco a fianco, tra ZeroGEX e TradeGEX: per cosa è costruita ciascuna piattaforma, come sono definiti i loro wall e il loro gamma flip, da dove provengono i livelli ES e NQ di ciascuna, quanto costa ciascuna, dove TradeGEX è la scelta migliore e dove è più adatto ZeroGEX. Piani, prezzi e funzionalità di TradeGEX provengono dal suo sito e dalla sua accademia, verificati in data {{tradegex:checked}}.*

---

## In breve

Entrambe le piattaforme ricavano i livelli gamma dal mercato delle opzioni e li disegnano sui grafici dei futures. Differiscono in ciò che coprono, in come costruiscono i livelli e in ciò che li accompagna.

- **TradeGEX** è costruito per i day trader sui futures. Disegna in tempo reale barre di esposizione gamma e delta, call wall e put wall, un gamma flip e il proprio indicatore Hedge Flow sui futures ES, NQ, YM, RTY, oro e greggio e su sette grandi titoli tecnologici, con app native per Mac e Windows, un simulatore di trading integrato e indicatori per TradingView, Tradovate, ATAS e NinjaTrader.
- **ZeroGEX** copre sei simboli - SPX, SPY, QQQ, NDX e i futures ES e NQ - e va più a fondo su di essi: wall ponderati per la gamma, un gamma flip calcolato da un profilo di gamma su un intervallo di prezzi, una heatmap della gamma nel corso della sessione, il flusso di hedging e quattordici segnali costruiti sui livelli, con un metodo pubblicato e un track record valutato.

Se operi sul Dow, sul Russell, sull'oro, sul greggio o sui grandi titoli tecnologici, o vuoi un'app desktop con un simulatore di trading, TradeGEX è più vicino a ciò che ti serve. Se fai day trading sul complesso S&P e Nasdaq e vuoi sapere come è costruito ogni livello e quanto spesso i wall hanno tenuto, lo è ZeroGEX.

## I livelli a confronto

Le due piattaforme pubblicano lo stesso insieme di livelli, per lo più con gli stessi nomi:

| TradeGEX | ZeroGEX | Cosa indica |
|---|---|---|
| Call Wall | Call Wall | Lo strike call più pesante: per open interest su TradeGEX, per open interest ponderato per la gamma su ZeroGEX |
| Put Wall | Put Wall | Lo stesso sul lato put |
| Gamma Flip | Gamma Flip | La linea che separa la gamma modellata dei dealer positiva da quella negativa |
| Key Gamma Strike (KGS) | GEX King | Lo strike che porta più gamma |
| Max Pain | Max Pain | Il prezzo a scadenza che lascia ai detentori di opzioni il minor valore totale |

Entrambe ti permettono di scegliere quali scadenze leggere. Il selettore delle scadenze di TradeGEX offre 0DTE, settimanali, mensili o tutte le scadenze combinate. Su ZeroGEX, il filtro delle scadenze del Gamma Chart restringe la catena a qualsiasi insieme di scadenze, 0DTE incluso, e i wall e il flip lo seguono.

### Stessi nomi, wall diversi

I wall condividono i nomi ma non le definizioni. La [guida ai livelli chiave](https://tradegex.pro/academy/call-wall-put-wall-gamma-flip) di TradeGEX colloca il call wall sullo strike con più open interest in call e il put wall sullo strike con più open interest in put, e le sue guide sui grafici e sull'open interest dicono lo stesso. (La sua guida sulle greche descrive invece i wall come gli strike dominanti per gamma call e gamma put.) ZeroGEX pondera l'open interest per la gamma, che è massima per le opzioni vicine al prezzo attuale, dove l'hedging dei dealer è più sensibile a un movimento. I due metodi possono indicare strike diversi quando un grande blocco di open interest si trova lontano dal prezzo: in un conteggio grezzo conta per intero, e ponderato per la gamma conta poco.

Le due piattaforme descrivono i wall anche in modo diverso. Le guide di TradeGEX descrivono il call wall come resistenza e il put wall come supporto. ZeroGEX tratta un wall come una concentrazione di gamma e ha misurato quanto spesso i wall abbiano effettivamente tenuto: nel suo studio su 737 test di wall, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora da un test e quelli del Nasdaq circa la metà delle volte, e nessuno dei diciannove aspetti dei singoli wall che ha misurato indicava quali si sarebbero rotti ([lo studio](/education/how-often-do-gamma-walls-break)).

ZeroGEX modella la gamma dei dealer a partire dalla catena delle opzioni anziché osservarla, calcola il suo flip da un profilo di gamma su un intervallo di prezzi e lascia il flip vuoto quando la catena non supporta un attraversamento affidabile. Il metodo è nella sua pagina [Metodologia](/methodology). L'accademia di TradeGEX riporta la sua formula del GEX, gamma per open interest per moltiplicatore del contratto per prezzo spot al quadrato, sommata strike per strike, e descrive il flip come il prezzo in cui quel totale passa da positivo a negativo.

### Ogni quanto si aggiornano i livelli

L'open interest ufficiale viene pubblicato una volta al giorno, dopo la chiusura. La [guida all'open interest](https://tradegex.pro/academy/open-interest-analysis) di TradeGEX afferma che stima l'open interest nel corso della sessione a partire da volumi e operazioni, e il suo sito indica che i suoi livelli GEX si aggiornano ogni pochi secondi. ZeroGEX ricalcola i suoi livelli circa una volta al minuto durante la sessione regolare, su entrambi i piani, man mano che prezzo, tempo e volatilità implicita si muovono rispetto all'open interest pubblicato. La sua stima dell'hedging implicito nelle operazioni della giornata è una lettura separata, nella pagina [Hedging Flow](/education/hedging-flow-explained). Se fai scalping sui livelli, un aggiornamento ogni pochi secondi è un elemento da valutare.

### Da dove vengono i livelli ES e NQ

Per ES e NQ, nessuna delle due piattaforme legge le opzioni sui futures stessi. Entrambe costruiscono i livelli dalle opzioni sull'indice o sull'ETF che ciascun future segue, e li riportano sul prezzo del future. TradeGEX ti permette di scegliere la fonte delle opzioni alla base delle sue barre GEX - un ETF come SPY, QQQ o IWM, oppure un indice come SPX, NDX o RUT - e la sua [accademia](https://tradegex.pro/academy/etf-options-futures-correlation) afferma che il rapporto di conversione varia con i dividendi e il cost of carry. ZeroGEX costruisce i livelli di ES dalla catena di SPX e quelli di NQ dalla catena di NDX, e li proietta sul contratto future che quota usando il cost of carry di quel contratto ([come funziona](/help/platform/futures-contract-months)).

## Prezzi

Prezzi di listino, prima di promozioni e imposte, verificati in data {{tradegex:checked}}. TradeGEX vende un unico piano con accesso completo alla piattaforma, con fatturazione mensile, ogni sei mesi ({{tradegex:platform:sixMonths}}) o annuale. I prezzi di ZeroGEX sono quelli indicati oggi nella sua pagina [Prezzi](/pricing).

| Piano | Fatturazione mensile | Fatturazione annuale |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mese | {{zgx:basic:annual}}/anno (circa {{zgx:basic:annual:mo}}/mese) |
| ZeroGEX Pro, con accesso API | {{zgx:pro:monthly}}/mese | {{zgx:pro:annual}}/anno (circa {{zgx:pro:annual:mo}}/mese) |
| TradeGEX | {{tradegex:platform:monthly}}/mese | {{tradegex:platform:annual}}/anno (circa {{tradegex:platform:annual:mo}}/mese) |

Su base mensile, ZeroGEX Basic costa meno di TradeGEX, e ZeroGEX Pro costa all'incirca lo stesso. Con la fatturazione annuale, ZeroGEX Pro costa circa la metà di TradeGEX - lo stesso prezzo del piano semestrale di TradeGEX - e include l'accesso API. A quei prezzi, però, si comprano cose diverse: il prezzo di TradeGEX copre più mercati, app desktop e un simulatore di trading, e quello di ZeroGEX copre sei simboli in profondità.

Anche prove e rimborsi differiscono. ZeroGEX Basic mensile parte con una prova gratuita di 7 giorni senza alcun addebito fino alla sua fine, e tutti gli altri piani ZeroGEX sono coperti da una garanzia soddisfatti o rimborsati di 7 giorni. TradeGEX offre una prova gratuita di 3 giorni che richiede un numero di cellulare ma nessuna carta e che non si trasforma da sola in un piano a pagamento, e i suoi termini affermano che i rimborsi vengono concessi solo in circostanze eccezionali.

## Dove TradeGEX è la scelta migliore

- **Più mercati.** Futures ES, NQ, YM (Dow), RTY (Russell 2000), oro e greggio, più NVDA, TSLA, AAPL, MSFT, AMZN, META e GOOGL. ZeroGEX copre sei simboli.
- **Aggiornamento più rapido.** TradeGEX afferma che i suoi livelli GEX si aggiornano ogni pochi secondi. ZeroGEX ricalcola i suoi livelli circa una volta al minuto.
- **App desktop e un simulatore di trading.** App native per Mac e Windows (Windows in beta) e un simulatore integrato per esercitarsi con operazioni sui futures su prezzi in tempo reale, con ordini bracket e statistiche di performance. ZeroGEX funziona nel browser e non ha un simulatore per esercitarti con le tue operazioni.
- **Tradovate e ATAS.** TradeGEX disegna i suoi livelli sul grafico web di Tradovate e in ATAS, oltre che su TradingView e NinjaTrader. ZeroGEX funziona con TradingView, thinkorswim, NinjaTrader, Sierra Chart e Bookmap.
- **Esposizione delta e un oscillatore multi-mercato.** Barre di esposizione delta, l'indicatore Hedge Flow, un oscillatore che combina ES, NQ, il VIX e il flusso di opzioni, una linea del VIX sul grafico del prezzo, una vista a doppio grafico e un report settimanale Commitments of Traders per ES e NQ. ZeroGEX esclude di proposito l'esposizione delta grezza: [perché ZeroGEX non pubblica il DEX](/education/why-we-dont-publish-dex).

## Dove ZeroGEX è la scelta migliore

- **Wall ponderati per la gamma.** L'open interest conteggiato in base a quanto hedging comporta vicino al prezzo, non solo in base al numero di contratti, che è il criterio con cui la guida ai livelli chiave di TradeGEX descrive i suoi wall.
- **Un metodo pubblicato e un track record valutato.** La pagina [Metodologia](/methodology) illustra come vengono calcolati i livelli, il [Track Record](/track-record) valuta ogni previsione che ZeroGEX pubblica, comprese quelle sbagliate, e lo [studio sui wall](/education/how-often-do-gamma-walls-break) pubblica quanto spesso i wall si sono effettivamente rotti.
- **Profondità sul complesso S&P e Nasdaq.** Una heatmap della gamma nel corso della sessione, la gamma per scadenza, il flusso di vanna e charm, il flusso di hedging, il flusso forzato e quattordici segnali costruiti sui livelli, con i loro metodi illustrati nella [guida ai segnali](/guides/signals-explained). L'accademia di TradeGEX afferma che non ha un'unica linea di vanna o charm; quegli effetti si leggono dalla sua linea del VIX, dal suo selettore delle scadenze e dai livelli.
- **Accesso API e un server MCP.** ZeroGEX Pro include chiavi API per gli stessi dati, e il [server MCP](/education/gamma-levels-in-claude) gratuito porta i livelli in differita negli assistenti IA come Claude e ChatGPT. Il piano di TradeGEX non elenca alcuna API.
- **Prezzo con fatturazione annuale.** ZeroGEX Pro costa circa la metà del prezzo annuale di TradeGEX, con l'API inclusa.
- **Un modo gratuito per verificare prima.** Le pagine [livelli gamma ES](/es-gamma-levels) e [livelli gamma NQ](/nq-gamma-levels), con circa 15 minuti di ritardo, non richiedono registrazione.

## Come decidere

- **Fai trading su YM, RTY, oro, greggio o singoli titoli tecnologici:** TradeGEX.
- **Vuoi un'app desktop, un simulatore di trading integrato o i tuoi livelli su Tradovate o ATAS:** TradeGEX.
- **Fai day trading su ES, NQ, SPX, SPY, QQQ o NDX e vuoi sapere come è costruito ogni livello e quanto spesso i wall hanno tenuto:** ZeroGEX.
- **Non hai ancora deciso:** apri la pagina gratuita [livelli gamma ES](/es-gamma-levels), senza bisogno di registrazione, e confrontala con i livelli che usi oggi.

---

Piani, prezzi e funzionalità di TradeGEX provengono da [tradegex.pro](https://tradegex.pro) e dalla sua accademia, verificati in data {{tradegex:checked}}, e possono cambiare in qualsiasi momento, quindi confermali lì. I prezzi di ZeroGEX in questa pagina sono letti dal suo listino prezzi in vigore. ZeroGEX non è affiliato a TradeGEX. Solo contenuto educativo, non una raccomandazione di trading.
