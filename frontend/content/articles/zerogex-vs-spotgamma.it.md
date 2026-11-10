# ZeroGEX vs SpotGamma (2026): livelli gamma, prezzi e strumenti gratuiti a confronto

*Un confronto equo, fianco a fianco, tra ZeroGEX e SpotGamma: per cosa è costruito ciascun servizio, come si corrispondono i loro livelli chiave, ogni quanto si aggiorna ciascuno, quanto costa ciascun piano, cosa puoi vedere gratis, dove SpotGamma è la scelta migliore e dove è più adatto ZeroGEX. Piani, prezzi e funzionalità di SpotGamma provengono dal suo sito e dalle sue pagine di checkout, verificati in data {{spotgamma:checked}}.*

---

## In breve

SpotGamma e ZeroGEX pubblicano entrambi livelli chiave derivati dalle opzioni: il call wall e il put wall, dove si concentra la gamma, e il prezzo in cui la gamma modellata dei dealer attraversa lo zero. Differiscono in ciò che accompagna quei livelli e in quanto spesso si muovono.

- **SpotGamma** è un servizio di ricerca tanto quanto uno strumento di dati. Ogni piano riceve la sua Founder's Note prima dell'apertura e dopo la chiusura di ogni seduta, i livelli chiave per i principali indici statunitensi e livelli GEX giornalieri per oltre 3.500 azioni, indici ed ETF. La sua home page colloca i suoi strumenti in tempo reale, come TRACE (una heatmap dell'S&P 500) e HIRO (il suo indicatore di hedging in tempo reale), nel suo piano superiore.
- **ZeroGEX** copre sei simboli - SPX, SPY, QQQ, NDX e i futures ES e NQ - e va più a fondo su di essi: livelli ricalcolati circa una volta al minuto nel corso della sessione su entrambi i piani, una heatmap della gamma, il flusso di hedging e quattordici segnali costruiti sui livelli, con un metodo pubblicato e un track record valutato.

Se vuoi una nota di ricerca quotidiana, il GEX sui singoli titoli per migliaia di nomi o i livelli proprietari di SpotGamma, SpotGamma è più vicino a ciò che ti serve. Se fai day trading sul complesso degli indici e ne vuoi i livelli in movimento nel corso della sessione, spendendo meno, lo è ZeroGEX.

## I livelli a confronto

| SpotGamma | ZeroGEX | Cosa indica |
|---|---|---|
| Call Wall | Call Wall | Lo strike con la maggiore concentrazione di gamma call |
| Put Wall | Put Wall | Lo stesso sul lato put |
| Zero Gamma | Gamma Flip | Il prezzo in cui la gamma modellata dei dealer attraversa lo zero |
| Volatility Trigger | Nessun equivalente | Un livello proprietario di SpotGamma |
| Risk Pivot | Nessun equivalente | Un livello proprietario di SpotGamma |

I wall hanno la stessa definizione. La [spiegazione del call wall](https://spotgamma.com/call-wall-put-wall-explained/) di SpotGamma descrive il call wall come lo strike con la maggiore concentrazione di gamma call, e il put wall come il suo corrispettivo sul lato put. ZeroGEX li definisce quasi allo stesso modo: lo strike sopra lo spot con la maggiore esposizione gamma sulle call, e lo strike sotto lo spot con la maggiore esposizione gamma sulle put. Entrambi trattano un wall come un riferimento anziché come un tetto o un pavimento rigido. ZeroGEX ha misurato quanto spesso i wall abbiano effettivamente tenuto: nel suo studio su 737 test di wall, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora da un test e quelli del Nasdaq circa la metà delle volte ([lo studio](/education/how-often-do-gamma-walls-break)).

Lo zero gamma e il gamma flip sono costruiti, in linea di principio, allo stesso modo. La [guida al GEX](https://spotgamma.com/gamma-exposure-gex/) di SpotGamma descrive il ricalcolo della gamma delle opzioni su un intervallo di prezzi spot ipotetici e l'individuazione del punto in cui attraversa lo zero. Anche ZeroGEX calcola il suo flip da un profilo di gamma su un intervallo di prezzi, e lascia il flip vuoto quando la catena non supporta un attraversamento affidabile. Il metodo è nella sua pagina [Metodologia](/methodology).

SpotGamma pubblica anche due livelli propri. Descrive il Volatility Trigger come un livello proprietario derivato dalla sua distribuzione stimata della gamma anziché da un attraversamento dello zero, e un suo post più vecchio lo definisce l'ultimo livello importante di supporto in gamma positiva, che può trovarsi diversi punti sopra lo zero gamma. Descrive il Risk Pivot come un livello di scenario che inquadra dove la struttura di mercato può diventare più o meno di supporto; le pagine consultate non dicono come venga calcolato. Il livello di ZeroGEX più vicino all'uno o all'altro è il gamma flip. ZeroGEX aggiunge livelli propri: GEX King, lo strike che porta più gamma, e il Pin Strike, lo strike 0DTE vicino in cui la gamma positiva dei dealer e la probabilità che il prezzo lo raggiunga si combinano con più forza.

### Come vengono modellate le posizioni dei dealer

Nessuno dei due servizi vede direttamente l'inventario dei dealer. ZeroGEX lo modella dall'open interest secondo la convenzione standard per cui i dealer sono long sulle call e short sulle put. Il grafico gamma gratuito di SpotGamma usa la stessa convenzione standard, e SpotGamma afferma che il suo modello a pagamento, SGOI, stima il posizionamento dei market maker e del buy side strike per strike. Modelli diversi possono collocare i wall su strike diversi nello stesso giorno, quindi aspettati che i livelli dei due servizi a volte differiscano.

### Ogni quanto si aggiornano i livelli

La Founder's Note di SpotGamma, con i suoi livelli per i principali indici statunitensi, viene consegnata prima dell'apertura e dopo la chiusura di ogni seduta su ogni piano, e i livelli del suo Equity Hub per i singoli titoli vengono aggiornati ogni giorno prima dell'apertura. Le FAQ della sua home page collocano HIRO, TRACE e la sua Volatility Dashboard nel piano Alpha, anche se alcune altre sue pagine li elencano su ogni piano, quindi verifica con SpotGamma quale piano include ciò che ti serve.

ZeroGEX ricalcola i suoi livelli circa una volta al minuto durante la sessione regolare, su entrambi i piani, e le sue pagine gratuite mostrano gli stessi livelli con circa 15 minuti di ritardo.

## Prezzi

Prezzi di listino, prima di promozioni e imposte, così come li addebitavano i moduli di checkout di SpotGamma in data {{spotgamma:checked}}. La pagina dei prezzi di SpotGamma mostrava anche offerte sul primo mese che i suoi moduli di checkout quel giorno non applicavano, quindi verifica sul suo sito l'offerta attuale. SpotGamma vende anche un piano Institutional, che qui non viene confrontato. I prezzi di ZeroGEX sono quelli indicati oggi nella sua pagina [Prezzi](/pricing).

| Piano | Fatturazione mensile | Fatturazione annuale |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mese | {{zgx:basic:annual}}/anno (circa {{zgx:basic:annual:mo}}/mese) |
| ZeroGEX Pro, con accesso API | {{zgx:pro:monthly}}/mese | {{zgx:pro:annual}}/anno (circa {{zgx:pro:annual:mo}}/mese) |
| SpotGamma Essential | {{spotgamma:essential:monthly}}/mese | {{spotgamma:essential:annual}}/anno (circa {{spotgamma:essential:annual:mo}}/mese) |
| SpotGamma Alpha | {{spotgamma:alpha:monthly}}/mese | {{spotgamma:alpha:annual}}/anno (circa {{spotgamma:alpha:annual:mo}}/mese) |

Entrambi i piani ZeroGEX costano meno di ciascuno dei due piani SpotGamma, con fatturazione mensile o annuale, e un anno di ZeroGEX Pro costa quanto un mese di SpotGamma Alpha. A quei prezzi, però, si comprano cose diverse: il prezzo di SpotGamma copre migliaia di azioni, una nota di ricerca due volte al giorno, webinar e, con Alpha, i suoi strumenti in tempo reale; quello di ZeroGEX copre sei simboli in profondità, con livelli che si muovono nel corso della sessione su entrambi i piani.

Anche prove e rimborsi differiscono. ZeroGEX Basic mensile parte con una prova gratuita di 7 giorni senza alcun addebito fino alla sua fine, e tutti gli altri piani ZeroGEX sono coperti da una garanzia soddisfatti o rimborsati di 7 giorni. La pagina dei prezzi di SpotGamma non indica alcuna prova gratuita sui suoi piani a pagamento; separatamente, offre una settimana gratuita del suo report giornaliero Opening Setup, senza bisogno di carta. I suoi termini affermano che i pagamenti degli abbonamenti non sono rimborsabili salvo diversa indicazione.

## Cosa puoi vedere gratis

- **SpotGamma** pubblica un [grafico gratuito dell'esposizione gamma di SPX](https://spotgamma.com/free-tools/spx-gamma-exposure/), che dichiara aggiornato ogni giorno, insieme a un calcolatore dei profitti delle opzioni e a un grafico degli earnings impliciti.
- **ZeroGEX** pubblica il gamma flip, il call wall, il put wall e il net GEX per tutti e sei i suoi simboli, con circa 15 minuti di ritardo e aggiornati nel corso della sessione, senza registrazione: tutti i simboli in un'unica pagina, [livelli GEX di oggi](/gex-levels), e una pagina per ciascun simbolo, come [livelli gamma SPX](/spx-gamma-levels). Il [Gamma Terminal](/chart) mostra gratis un grafico gamma di SPY in differita, e il [server MCP](/education/gamma-levels-in-claude) porta i livelli in differita negli assistenti IA come Claude e ChatGPT.

## Dove SpotGamma è la scelta migliore

- **Ricerca e commento.** La Founder's Note prima dell'apertura e dopo la chiusura di ogni seduta, su ogni piano, più webinar settimanali dal vivo, una community su Discord e, con Alpha, sessioni di formazione quotidiane dal vivo. ZeroGEX ha articoli educativi e un centro assistenza, e nessuna nota quotidiana.
- **Ampiezza.** Livelli GEX giornalieri per oltre 3.500 azioni, indici ed ETF statunitensi nel suo Equity Hub e, con Alpha, HIRO su oltre 3.000 azioni. ZeroGEX copre sei simboli.
- **Un proprio modello di posizionamento e propri livelli.** SGOI, la sua stima del posizionamento dei market maker e del buy side, e il Volatility Trigger e il Risk Pivot. ZeroGEX usa la convenzione standard e non pubblica alcun equivalente di nessuno dei due livelli.
- **Più piattaforme.** SpotGamma elenca integrazioni con TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap, TrendSpider, Jigsaw, eSignal ed EdgePro. ZeroGEX funziona con sei: TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap e SabrTrader.

## Dove ZeroGEX è la scelta migliore

- **Prezzo.** Entrambi i piani ZeroGEX costano meno di ciascuno dei due piani SpotGamma, e ZeroGEX Pro include l'accesso API. Le funzionalità elencate per i piani Essential e Alpha di SpotGamma non includono un'API.
- **Livelli che si muovono nel corso della sessione su entrambi i piani.** Circa una volta al minuto, su Basic come su Pro. Le pagine di SpotGamma descrivono livelli aggiornati ogni giorno prima dell'apertura, e la sua home page colloca i suoi strumenti in tempo reale nel piano Alpha.
- **ES e NQ sul prezzo dei futures.** ZeroGEX costruisce i livelli di ES dalla catena di SPX e quelli di NQ dalla catena di NDX e li proietta sul contratto future che quota ([come funziona](/help/platform/futures-contract-months)), gratis e in differita nelle pagine [livelli gamma ES](/es-gamma-levels) e [livelli gamma NQ](/nq-gamma-levels). Il sito di SpotGamma afferma che i suoi livelli si integrano con le piattaforme per i futures, ma le pagine consultate non dicono che pubblichi livelli sul prezzo dei futures.
- **Più contenuti gratuiti.** I livelli di tutti e sei i simboli, aggiornati in differita nel corso della sessione, rispetto al grafico SPX giornaliero di SpotGamma.
- **Un metodo pubblicato e un track record valutato.** La pagina [Metodologia](/methodology) illustra come vengono calcolati i livelli, il [Track Record](/track-record) valuta ogni previsione che ZeroGEX pubblica, comprese quelle sbagliate, e lo [studio sui wall](/education/how-often-do-gamma-walls-break) pubblica quanto spesso i wall si sono effettivamente rotti.
- **Profondità sul complesso degli indici.** Una heatmap della gamma nel corso della sessione, la gamma per scadenza, il flusso di vanna e charm, il flusso di hedging e quattordici segnali costruiti sui livelli, con i loro metodi illustrati nella [guida ai segnali](/guides/signals-explained).

## Come decidere

- **Vuoi una nota di ricerca quotidiana insieme ai tuoi livelli, oppure webinar e formazione:** SpotGamma.
- **Fai trading su singoli titoli e vuoi livelli GEX su migliaia di nomi:** SpotGamma.
- **Fai day trading su SPX, SPY, QQQ, NDX, ES o NQ e vuoi il flip e i wall in movimento nel corso della sessione, spendendo meno:** ZeroGEX.
- **Cerchi un'alternativa gratuita a SpotGamma:** apri la pagina [livelli GEX di oggi](/gex-levels), senza bisogno di registrazione, e confrontala con i livelli che usi adesso.

---

Piani, prezzi e funzionalità di SpotGamma provengono da [spotgamma.com](https://spotgamma.com) e dalle sue pagine di checkout, verificati in data {{spotgamma:checked}}, e possono cambiare in qualsiasi momento, quindi confermali lì. I prezzi di ZeroGEX in questa pagina sono letti dal suo listino prezzi in vigore. ZeroGEX non è affiliato a SpotGamma. Solo contenuto educativo, non una raccomandazione di trading.
