# Il posizionamento dei dealer 0DTE spiegato

*Le scadenze giornaliere ormai dominano il flusso su SPX. Questo cambia il modo in cui si legge la gamma dei dealer — e il modo in cui bisogna leggere il tape per stare al passo. Il posizionamento dei dealer 0DTE, spiegato per il trader intraday pratico.*

---

## Perché 0DTE cambia la lettura

Il posizionamento dei dealer è sempre stato importante per i trader di opzioni. Ciò che è cambiato negli ultimi anni è la **dominanza del flusso 0DTE** su SPX e SPY. Le scadenze giornaliere ora rappresentano una quota sproporzionata dell'esposizione gamma totale, e poiché la loro gamma è concentrata vicino allo spot e decade verso la chiusura, il comportamento di hedging dei dealer che ne deriva è più brusco, più reattivo e più dipendente dal regime rispetto a qualsiasi struttura di catena precedente.

Se fai trading su SPX durante la sessione cash e non stai leggendo il posizionamento dei dealer attraverso la lente 0DTE, stai leggendo un book obsoleto.

Questo articolo è la lettura pratica di cosa significano realmente in tempo reale "posizionamento dei dealer 0DTE" e "dealer gamma 0DTE". Vedremo perché il bucket 0DTE conta più del bucketing a scadenza più lunga, cosa cambia tra i regimi a gamma negativa e positiva specificamente per 0DTE, e come leggere il tape in modo diverso in ciascuno di essi. Abbina questo articolo a [Come leggere un gamma flip](/education/how-to-read-a-gamma-flip) per la linea di regime in sé, [I gamma wall spiegati](/education/gamma-walls-explained) per i livelli di confine, e il [pillar sulla Gamma Exposure](/education/gamma-exposure-explained) per il contesto strutturale completo.

---

## Cos'è il posizionamento dei dealer 0DTE?

Il posizionamento dei dealer 0DTE è l'esposizione gamma aggregata che i dealer detengono su opzioni con scadenza lo stesso giorno. Meccanicamente, non è diverso dalla gamma dei dealer a scadenza più lunga — le call vendute allo scoperto dai dealer contribuiscono positivamente alla gamma dei dealer, le put vendute allo scoperto contribuiscono negativamente, e il riflesso di hedging è lo stesso: mantenere il delta piatto, tradare il sottostante man mano che la gamma cambia.

Ciò che rende diverso 0DTE è la **densità di gamma**. Le opzioni con scadenza giornaliera portano la loro gamma massima proprio a livello del prezzo di mercato, e la gamma per contratto scala approssimativamente con `1/√T`. Con `T` misurato in frazioni di giorno, quel denominatore è piccolo — e la gamma per contratto diventa molto grande. Uno strike 0DTE vicino allo spot può superare uno strike mensile allo stesso livello di un ordine di grandezza.

L'implicazione pratica: il bucket 0DTE detta in modo sproporzionato l'hedging intraday dei dealer. Anche quando l'open interest totale è dominato da strike a scadenza più lunga, l'esposizione *ponderata per gamma* vicino allo spot è spesso una storia 0DTE.

---

## Perché il posizionamento dei dealer conta di più per 0DTE

Tre fattori si sommano per 0DTE in un modo che non avviene allo stesso modo per le scadenze più lunghe:

1. **Concentrazione di gamma.** Le opzioni con scadenza giornaliera portano una gamma molto alta a livello del prezzo di mercato. Le operazioni di hedging contro quella gamma sono grandi per unità di movimento, il che rende meccanicamente più rumorosa l'azione di prezzo vicino allo spot.
2. **Decadimento del charm.** Man mano che le opzioni 0DTE si avvicinano alla scadenza, il loro delta si sposta in modo prevedibile verso 0 o 1 a seconda della moneyness. I dealer che gestiscono un book delta-neutrale devono ri-hedgiarsi continuamente fino alla chiusura. Quel flusso forzato ha un segno — ed è direttamente leggibile.
3. **Fisica del pin.** La stessa concentrazione di gamma che fa muovere molto i dealer 0DTE per ogni tick rende anche lo strike 0DTE più pesante una calamita in un regime a gamma lunga. Il comportamento di pinning tende a essere più marcato su 0DTE rispetto a setup multi-day.

Nessuno di questi meccanismi è esclusivo di 0DTE — si applicano a qualsiasi opzione a breve scadenza. Sono semplicemente insolitamente rumorosi nel bucket 0DTE per quanto è diventato compresso `T`.

---

## Regimi 0DTE a gamma negativa

Quando i dealer sono netti corti di gamma — tipicamente quando lo spot è sotto il gamma flip — il flusso 0DTE diventa rumoroso rapidamente.

Cosa fa il riflesso:

- Un movimento al rialzo costringe i dealer a *comprare*, amplificando il movimento.
- Un movimento al ribasso costringe i dealer a *vendere*, amplificando il movimento.
- La volatilità realizzata intraday tende a espandersi.
- I wall diventano meno affidabili come resistenza e supporto — possono invertirsi in target di breakout.
- Il comportamento di pin vicino allo strike 0DTE più pesante si indebolisce o si inverte.

Che aspetto tende ad avere il tape:

- Range più ampi, breakout più rapidi.
- Movimenti di continuazione più frequenti delle inversioni.
- Gli ingressi in mean-reversion contro il trend vengono spesso travolti.
- I premi delle opzioni giornaliere tendono a espandersi intraday piuttosto che comprimersi.

L'inclinazione pratica in un regime 0DTE a gamma corta è **con il movimento, non contro di esso**. I setup di trend-continuation tendono ad avere tassi di successo migliori; contrastare il trend dentro la concentrazione 0DTE significa combattere strutturalmente contro il riflesso dei dealer.

---

## Regimi 0DTE a gamma positiva

Quando i dealer sono netti lunghi di gamma — tipicamente quando lo spot è sopra il gamma flip — il flusso 0DTE tende a comprimersi.

Cosa fa il riflesso:

- Un movimento al rialzo costringe i dealer a *vendere*, smorzando il movimento.
- Un movimento al ribasso costringe i dealer a *comprare*, smorzando il movimento.
- La volatilità realizzata intraday tende a comprimersi.
- I wall si comportano più come vera resistenza e vero supporto.
- Il comportamento di pin vicino allo strike 0DTE più pesante si rafforza verso la chiusura.

Che aspetto tende ad avere il tape:

- Range più stretti, più chop, più breakout falliti.
- Comportamento di attrazione verso lo strike più pesante, soprattutto dopo le 14:00 ET.
- I premi delle opzioni giornaliere tendono a sgonfiarsi.
- I setup di mean-reversion tendono ad avere tassi di successo migliori rispetto al trend-continuation.

L'inclinazione pratica in un regime 0DTE a gamma lunga è **contro il breakout, con il pin**. I rally sfumati verso il call wall, gli acquisti sul dip verso il put wall e le strutture short-premium beneficiano tutti del riflesso smorzante.

---

## Come leggere il tape in modo diverso in ciascun regime

Alcune abitudini che cambiano tra i due regimi:

**In un regime 0DTE a gamma negativa:**

- Prendi più sul serio i breakout del range recente, soprattutto quando il Net GEX è ampio e negativo.
- Tratta i wall 0DTE come target, non come soffitti.
- Sii scettico sui setup "questo pinnerà" — il riflesso dei dealer non sta tirando.
- Dimensiona per stop più larghi; la volatilità realizzata è strutturalmente più alta.

**In un regime 0DTE a gamma positiva:**

- Punta di default a sfumare i movimenti verso gli strike concentrati 0DTE.
- Tratta lo strike a gamma più pesante come una calamita, soprattutto verso la chiusura.
- Sii scettico sui breakout — falliscono più spesso.
- Stop più stretti sono più ragionevoli; i range sono più contenuti.

**In qualsiasi regime:**

- Controlla se lo spot è vicino al gamma flip. Un regime conteso è il peggior regime a cui impegnarsi con uno dei due playbook.
- Controlla se lo strike 0DTE più pesante sta migrando. Uno strike pesante statico è un candidato al pin più forte di uno che sta migrando.
- Traccia il Net GEX come magnitudine, non solo come segno. Un flip da −2 miliardi di dollari a +200 milioni di dollari è una lettura molto diversa da un flip da +2 miliardi di dollari a +200 milioni di dollari.

---

## Leggere il posizionamento dei dealer 0DTE su ZeroGEX

La dashboard mostra letture specifiche per 0DTE in diversi punti:

- **La card Net GEX** mostra la gamma dei dealer valutata allo spot (coerente in segno con il flip), dandoti la magnitudine del regime attuale.
- **La heatmap GEX per strike e DTE** scompone la gamma per bucket di scadenza così puoi vedere quanto del posizionamento odierno è guidato da 0DTE e dove si trovano gli strike giornalieri più pesanti.
- **Le card di wall e flip** mostrano i livelli strutturali odierni con la distanza live dallo spot.

![Heatmap GEX per strike e DTE di ZeroGEX con il bucket 0DTE concentrato vicino allo spot](/blog/zerogex-strike-dte-heatmap.png)

Un esempio pratico. Supponi che SPX sia a 5.825, il Net GEX segni −800 milioni di dollari, il gamma flip si trovi a 5.840, e la heatmap mostri uno strike put 0DTE pesante a 5.820 che sta migrando verso il basso insieme al prezzo per tutta la mattina. La lettura strutturale: i dealer sono corti di gamma, lo spot è sotto il flip, e lo strike 0DTE più pesante sta seguendo il movimento anziché contenerlo.

Inclinazione pratica: questo è un regime a gamma corta, favorevole alla continuazione, con lo strike put in migrazione che conferma piuttosto che resistere al ribasso. Un trader entrato in sessione con un bias di mean-reversion dovrebbe essere molto più cauto qui, perché la struttura 0DTE sta puntando attivamente nella direzione opposta. Nulla di tutto ciò è un segnale di trade — è contesto di regime che dovrebbe rimodellare quali ingressi prendi sul serio.

![Card Net GEX e Gamma Flip di ZeroGEX che mostrano una lettura intraday a gamma negativa](/blog/zerogex-net-gex-flip-card.png)

---

## Errori comuni nel leggere la gamma dei dealer 0DTE

Un breve elenco di come il posizionamento dei dealer 0DTE viene letto male:

- **Usare la gamma su tutto l'OI in una catena dominata da 0DTE.** Se la maggior parte della gamma odierna è 0DTE e stai leggendo la gamma aggregata sull'OI, la tua lettura sta mediando un book vicino alla scadenza con un book a scadenza lontana che non conta per il tape di oggi.
- **Trattare i wall come duraturi in un regime a gamma negativa.** Non lo sono. Diventano target di breakout.
- **Ignorare il regime e tradare il livello.** Lo spot al put wall è un trade sopra il flip e un trade molto diverso sotto di esso.
- **Ignorare la migrazione.** Uno strike 0DTE pesante che si è spostato due volte nell'ultima ora è una lettura diversa rispetto a uno rimasto statico per tutta la mattina.
- **Trattare il comportamento di pin 0DTE come garantito.** È un'inclinazione, non una promessa. Catalizzatori e shock di flusso rompono regolarmente il pin.

---

## Conclusione

> 0DTE ha cambiato quale parte del book dei dealer muove effettivamente il tape. Il posizionamento totale conta; è il *bucket 0DTE* a dominare la lettura intraday.

La disciplina è la stessa di qualsiasi lettura del posizionamento dei dealer — parti dal regime, poi leggi la struttura al suo interno — ma il bucket 0DTE è dove vive ormai la maggior parte della gamma durante la sessione cash, e ignorarlo ti mette una sessione indietro.

Solo contenuto educativo — nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere in tempo reale il posizionamento dei dealer 0DTE di oggi — il regime, gli strike giornalieri più pesanti, i wall live e il profilo di gamma dei dealer — la dashboard gratuita di ZeroGEX mostra tutto questo.
