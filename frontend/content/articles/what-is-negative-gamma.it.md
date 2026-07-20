# Cosa Significa Gamma Negativo? Una Spiegazione in Parole Semplici

*Cosa significa gamma negativo — e perché dovrebbe interessare a un trader di opzioni? In breve: significa che l'hedging dei dealer amplifica i movimenti invece di smorzarli. Ecco a cosa si riferisce davvero questo termine, come individuare in tempo reale un regime a gamma negativo e cosa cambia nel tuo trading quando ti trovi in una situazione del genere.*

---

## La risposta breve

**Gamma negativo**, nel contesto dell'options-flow, significa che i dealer che si trovano dall'altra parte degli scambi di opzioni dei clienti hanno un book netto short-gamma. La conseguenza pratica: quando SPY sale, i dealer devono *comprare* SPY per rimanere hedgiati, e quando SPY scende, devono *vendere* SPY. Le loro operazioni di hedging vanno **nella stessa direzione** del prezzo — non contro di essa.

Questo riflesso meccanico trasforma il book dei dealer in un amplificatore. I selloff accelerano. I rally si estendono. La volatilità intraday realizzata tende a essere più alta di quella implicita. Il comportamento di pin si rompe. Lo stesso setup grafico che funzionava ieri (quando i dealer erano long gamma e assorbivano i movimenti) viene schiacciato oggi (quando sono short gamma e rincorrono il mercato).

L'opposto — il **gamma positivo** — è la configurazione più comune per SPY nella maggior parte delle sessioni tranquille. I dealer sono long gamma, coprono il movimento e smorzano la volatilità. Il quadro completo è trattato nel [pillar sulla Gamma Exposure](/education/gamma-exposure-explained); questo articolo si concentra specificamente su cosa significhi "gamma negativo" e su come riconoscerlo.

---

## A cosa si riferisce davvero il "gamma negativo"

Il gamma è un Greek del secondo ordine che misura come il delta di un'opzione cambia al muoversi del sottostante. Un numero di "gamma exposure" con segno è il gamma aggregato sull'intero book dei dealer, dove le call (tipicamente detenute short dai dealer) contribuiscono positivamente e le put (anch'esse tipicamente detenute short) contribuiscono negativamente.

Quando il *netto* di questi contributi con segno è negativo, il book dei dealer è complessivamente short gamma. Il modo convenzionale in cui questo appare negli strumenti di flow: Net GEX < 0.

L'ipotesi standard cliente-long-call / cliente-long-put implica che i dealer siano tipicamente short su entrambi — ma le *magnitudini* variano con il positioning. Quando la domanda dei clienti si sbilancia pesantemente verso le put (ad esempio durante regimi di paura), il gamma netto del book dei dealer può ribaltarsi in negativo; quando si sbilancia verso le call (ad esempio in trend rialzisti calmi), il book è long gamma.

La statistica riassuntiva più utile in assoluto: il **gamma flip** — il prezzo al quale il profilo gamma dei dealer attraversa lo zero. Sopra il flip, i dealer sono tipicamente long gamma (positivo). Sotto il flip, short gamma (negativo). Leggere il flip equivale essenzialmente a leggere la linea del regime. Vedi [Come Leggere un Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Perché il gamma negativo amplifica i movimenti

La catena meccanica:

1. L'esposizione delta netta dei dealer è short-gamma. Quando lo spot sale, il delta del loro portafoglio opzioni scende (diventano più short rispetto alla neutralità).
2. Per rimanere delta-neutral, devono **comprare** il sottostante per compensare il calo.
3. Questi acquisti avvengono nello stesso momento in cui i clienti stanno facendo salire il mercato. Si sommano allo slancio.
4. Quando lo spot scende, avviene l'opposto: il delta delle opzioni dei dealer sale (diventano più long rispetto alla neutralità); per neutralizzare, **vendono** il sottostante. Queste vendite si aggiungono al ribasso.

In entrambe le direzioni, l'hedging dei dealer *rinforza* il movimento. Il riflesso è prociclico. Maggiore è l'esposizione short-gamma dei dealer, maggiore è il flusso sul sottostante richiesto per ogni punto percentuale di movimento.

Confronta questo con il **gamma positivo**, dove la stessa catena di flow si inverte: i dealer vendono nella forza e comprano nella debolezza, smorzando il movimento. La forza strutturale nel mercato è anticiclica. La stessa notizia che produce un range intraday dello 0,5% in un regime long-gamma può produrre un range del 2% in un regime short-gamma.

---

## Gamma negativo vs. gamma positivo a confronto

| | Gamma positivo (long-gamma) | Gamma negativo (short-gamma) |
|---|---|---|
| Riflesso di hedging dei dealer | Vendono nella forza, comprano nella debolezza | Comprano nella forza, vendono nella debolezza |
| Vol realizzata vs. implicita | Tende a essere **più bassa** | Tende a essere **più alta** |
| Breakout | Spesso svaniscono e tornano indietro | Spesso si estendono |
| Selloff | Spesso vengono assorbiti vicino ai wall | Spesso accelerano |
| Comportamento di pin | I magneti attirano il prezzo verso gli strike pesanti | I magneti rilasciano il prezzo; nessun pin |
| Playbook migliore | Mean-reversion, fade degli estremi, vendita di premio | Continuazione del trend, momentum, breakout |
| Playbook peggiore | Rincorrere breakout, momentum | Fadare i rally, comprare i dip nella struttura |
| Tipico quando | SPY sopra il gamma flip, Net GEX > 0 | SPY sotto il gamma flip, Net GEX < 0 |

Queste sono tendenze generali di regime, non garanzie. Catalizzatori e shock le possono ribaltare. Ma il tasso di base è abbastanza significativo che eseguire il playbook sbagliato per il regime rappresenta gran parte del costo.

---

## Come individuare in tempo reale un regime a gamma negativo

Un breve workflow:

1. **Controlla prima il gamma flip.** Se SPY è sotto il flip, sei per definizione in un regime short-gamma.
2. **Conferma con il Net GEX.** Un valore di Net GEX negativo è la lettura di magnitudine — più è negativo, più marcato è il regime. Un Net GEX vicino allo zero indica un regime conteso; entrambi i riflessi sono parzialmente attivi.
3. **Verifica incrociata con il quadro della vol realizzata.** I regimi short-gamma si manifestano con range intraday più ampi di quanto suggerito dalla vol implicita all'apertura della giornata. Se la realizzata si sta espandendo mentre l'implicita resta piatta, questa è la firma del regime.
4. **Osserva il comportamento dei wall.** Nei regimi short-gamma, i wall si indeboliscono o si invertono. Il call wall che ieri limitava i rally può diventare oggi un target di breakout.
5. **Osserva la direzione del flow in chiusura.** Lo short-gamma verso la chiusura produce spesso movimenti direzionali che accelerano (il segnale di pressione EOD diventa una lettura di continuazione, non di fade).

---

## Cosa cambia nel tuo trading

Concretamente, cose da *smettere* di fare in un regime a gamma negativo:

- **Non fadare i rally.** Il riflesso dei dealer sta amplificando. La tua "short da mean-reversion" combatte contro il flusso strutturale di acquisto.
- **Non comprare i dip nella struttura.** Stesso problema invertito. Il put wall che sosteneva il mercato in long-gamma può diventare un punto di slippage in short-gamma.
- **Non aspettarti il pinning.** La spinta strutturale verso gli strike pesanti è disattivata. La tesi del magnete non si applica.
- **Non dimensionare per un range normale.** La vol realizzata è strutturalmente più alta. Dimensiona le posizioni assumendo che servano stop più ampi.

Cose da *iniziare* a fare:

- **Fai trading nella direzione del movimento.** I setup trend-following hanno un tasso di successo più alto.
- **Tratta i wall come target di breakout, non come resistenze.** Lo stesso livello che avresti fadato in long-gamma potrebbe essere un entry di continuazione in short-gamma.
- **Sii più selettivo sul timing d'ingresso.** Range più ampi significano più rischio per trade. Compensa con criteri di setup più stretti.
- **Osserva eventuali ritorni del regime a gamma positivo.** Succedono — il flip è dinamico. Quando lo spot ritorna sopra il gamma flip, anche il playbook si ribalta di conseguenza.

---

## Esempio pratico

SPX apre la giornata a 5.780. ZeroGEX mostra:

- **Net GEX:** −1,1 miliardi di $ (negativo — regime short-gamma)
- **Gamma Flip:** 5.810 (spot 30 punti sotto)
- **Call Wall:** 5.820
- **Put Wall:** 5.750

Nel corso della mattinata, SPX sale gradualmente fino a 5.800. L'istinto in una giornata long-gamma sarebbe iniziare a fadare i rally verso il flip di 5.810 e il call wall di 5.820.

La lettura strutturale qui dice l'opposto. SPX è in territorio short-gamma; l'hedging dei dealer sta amplificando. La spinta verso 5.810 potrebbe estendersi oltre tale livello invece di svanire — soprattutto se il Net GEX continua a decadere ulteriormente in negativo. In questo regime, il call wall a 5.820 è più probabile che funga da target di breakout piuttosto che da resistenza.

L'inclinazione pratica: salta il fade. O fai trading con il momentum o resta a guardare. Ribalta il playbook rispetto a una tipica giornata long-gamma.

Ora immagina lo stesso grafico con Net GEX a +1,2 miliardi di $ e il gamma flip a 5.760 (spot 40 punti sopra). La lettura strutturale si inverte: 5.820 probabilmente funge da resistenza, il riflesso long-gamma assorbe i rally, il setup da fade è valido. Stesso mercato, lettura opposta, a seconda di una singola variabile di regime.

---

## Idee sbagliate comuni

- **"Il gamma negativo è ribassista."** Non è vero. È **amplificatore di volatilità**. Il mercato può salire con forza in un regime a gamma negativo — e il rally tende a estendersi ulteriormente rispetto a quanto farebbe in long-gamma. Il gamma negativo riguarda il *carattere dei movimenti*, non la direzione.
- **"Il gamma positivo è rialzista."** Anche questo è falso. Il gamma positivo è **smorzatore di volatilità**. Il mercato può scendere gradualmente in un regime a gamma positivo; semplicemente tende a farlo lentamente, con rimbalzi di mean-reversion lungo il percorso.
- **"Puoi tradare i segnali di gamma negativo allo stesso modo di quelli di gamma positivo."** La maggior parte delle perdite retail deriva da questo errore. I segnali e le letture strutturali si invertono tra i regimi. Una tesi "buy the dip" che funziona sopra il flip può moltiplicare le perdite sotto di esso.
- **"Il gamma negativo è raro."** Accade regolarmente — in particolare dopo i picchi di volatilità, durante lo stress macro e quando la chain è pesantemente sbilanciata verso le put. Conoscere il regime in tempo reale è ciò che ti dice quando.

---

## Conclusione

> Il gamma negativo significa che i dealer amplificano il movimento invece di smorzarlo. Stessa catena, stesso SPY, carattere del mercato opposto — e playbook opposti per il trader che sa leggere il regime.

La disciplina consiste nell'iniziare ogni sessione con la lettura del regime: dov'è il gamma flip, dov'è lo spot, qual è il Net GEX? Questi tre numeri ti dicono quale playbook la forza strutturale del mercato sosterrà oggi. Eseguire il playbook sbagliato contro il regime è l'errore più costoso del menu.

Solo contenuto educativo — nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere il Net GEX di oggi, il gamma flip e la lettura del regime in tempo reale per SPY, SPX e QQQ — i tre numeri che ti dicono se i dealer sono long gamma o short gamma in questo momento — la vista gratuita sui gamma-levels di ZeroGEX li mostra tutti.
