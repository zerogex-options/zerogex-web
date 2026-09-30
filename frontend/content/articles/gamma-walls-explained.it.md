# Gamma Wall spiegati: Call Wall, Put Wall e come reagisce il prezzo
> **Nota metodologica.** ZeroGEX stima, ma non osserva, l’inventario dei dealer dai dati pubblici. Il modello conserva la convenzione call-positive/put-negative (`Net GEX = Call GEX − Put GEX`): i dealer sono ipotizzati net long call e net short put. Call e put long hanno gamma positivo; call e put short hanno gamma negativo. Il Put Wall è la maggiore concentrazione di gamma put sotto lo spot e rappresenta localmente gamma dealer negativo: può coincidere con supporto, ma la copertura della put short non crea meccanicamente un pavimento. I wall possono migrare con spot, tempo e volatilità implicita anche quando l’open interest ufficiale non cambia intraday. Verso la scadenza il gamma si concentra vicino all’ATM: il gamma ATM può aumentare, mentre quello decisamente ITM o OTM tende a zero. Il Gamma Flip selezionato è un passaggio locale; il profilo può avere più passaggi o nessun passaggio significativo. Charm e vanna descrivono variazioni condizionali del delta, non ordini programmati. I punteggi sono output euristici, non probabilità calibrate. Il gamma negativo amplifica la direzione già in corso; la distanza da un target non implica repulsione. Che in gamma negativo il termine pin di EOD Pressure segua il movimento recente è un’euristica ZeroGEX. Max Pain minimizza il payout intrinseco aggregato, non massimizza esattamente il nozionale che scade senza valore. Il DEX grezzo misura delta delle sole opzioni, non il futuro flusso di copertura; premio e lato aggressore non provano informazione, apertura o convinzione.


*I gamma wall sono i livelli più osservati nell'analisi del posizionamento dei dealer. Ecco cosa è davvero un gamma wall, il significato di call wall e put wall, perché il prezzo reagisce in corrispondenza di questi livelli, come si spostano nel corso della giornata e quando tengono rispetto a quando si rompono.*

---

## Cos'è un gamma wall?

Un gamma wall è uno strike sulla catena di opzioni dove l'esposizione gamma dei dealer si concentra pesantemente su un lato del book. I due wall più osservati sono il **call wall** - la concentrazione più pesante di gamma sulle call sopra lo spot - e il **put wall** - la concentrazione più pesante di gamma sulle put sotto lo spot. Insieme delineano il range strutturale che le dinamiche di hedging dei dealer tendono a difendere.

I wall non sono medie mobili né livelli psicologici. Emergono da un posizionamento reale: open interest, contratto per contratto, ponderato in base al gamma che ciascun contratto porta con sé. Quando i trader chiedono il significato di call wall e put wall, ciò che stanno davvero chiedendo è: *dove si concentrano i flussi di hedging dei dealer, e come influenzano il prezzo?*

Questa pagina ha un taglio pratico. Dà per scontato che tu sappia cos'è un wall e affronta gli aspetti che decidono se il livello è utile in una determinata giornata: cosa fa ciascun wall in ciascun regime, cosa ti dice la distanza tra i due, come si comportano verso la scadenza dello stesso giorno, come migrano e quanto spesso i wall tengono o si rompono davvero. Per il contesto di regime che sta alla base di tutto questo, abbina questa lettura a [Come leggere un gamma flip](/education/how-to-read-a-gamma-flip) e al più ampio [pilastro sul Gamma Exposure](/education/gamma-exposure-explained).

---

## Cos'è un call wall?

Il call wall è lo strike sopra lo spot che porta la maggiore esposizione gamma sulle call. In un regime di gamma positivo, i dealer che detengono un inventario long-call devono vendere durante i rally che si avvicinano al wall - scaricando il delta positivo che accumulano mentre il prezzo sale verso di esso. Questo riflesso di hedging contrasta il rally.

In pratica, il call wall agisce spesso come **resistenza** nei regimi di gamma lunga - non perché il livello sia magico, ma perché il flusso di hedging che si attiva intorno ad esso è strutturale.

Cose da sapere:

- Il wall è la concentrazione *attuale* più pesante. Man mano che l'OI si sposta, il wall si muove.
- Nei regimi di gamma lunga (spot sopra il gamma flip), l'hedging intorno al wall si oppone a un rally. Nei regimi di gamma corta lo asseconda, quindi il livello, se cede, può trasformarsi da resistenza in acceleratore di breakout. Il regime cambia questo comportamento, non quanto spesso il wall si rompe.
- Un call wall è un'inclinazione **probabilistica**, non un tetto rigido. Un flusso reale può sfondarlo.

---

## Cos'è un put wall?

Il put wall è lo strike sotto lo spot con la maggiore esposizione gamma sulle put. In un regime di gamma positivo, il book netto dei dealer è long gamma, quindi compra mentre il prezzo scende verso il wall - lo speculare del riflesso del call wall, con gli acquisti concentrati dove la gamma sulle put è più densa. Questo riflesso contrasta il selloff.

In pratica, il put wall agisce spesso come **supporto** nei regimi di gamma lunga. Come per il call wall, il meccanismo è strutturale, non psicologico.

Cose da sapere:

- Il wall è dinamico. Un OI pesante che si esaurisce verso la scadenza può cancellare un put wall entro metà giornata.
- In un regime di gamma corta, il comportamento dei dealer si inverte - l'hedging smette di assorbire la debolezza e il put wall, se cede, può diventare un punto di scivolamento (slippage) durante la discesa.
- Un put wall è un'inclinazione. Shock macro, espansione della volatilità e riassetti della catena possono tutti prevalere sulla lettura strutturale.

---

## Perché il prezzo reagisce ai gamma wall

Il meccanismo è l'hedging dei dealer, non la psicologia. Il modo più chiaro per vederlo:

In un regime di **gamma positiva**, i dealer si coprono *contro* il movimento del prezzo. Vendono quando il prezzo sale e comprano quando scende. Vicino a un wall, questo riflesso si intensifica perché la concentrazione di gamma è localmente elevata - un piccolo movimento verso il wall forza un'operazione di hedging relativamente più grande in direzione opposta.

In un regime di **gamma negativa**, il riflesso si inverte. I dealer si coprono *nella stessa direzione* del movimento del prezzo. Lo stesso wall che ancorava il prezzo in gamma lunga può diventare un vettore di breakout - una volta che il prezzo lo supera, l'operazione di hedging rafforza il movimento invece di attenuarlo.

Un gamma wall non è una proprietà fissa della catena. È un *livello* fisso il cui effetto di hedging dipende dal **regime che lo circonda** - che è esattamente ciò che indica il gamma flip. Ciò che il regime non decide è se il wall tiene: nella nostra misurazione su 737 test di wall, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora e quelli del Nasdaq circa la metà delle volte, sia sopra sia sotto il flip ([Quanto spesso si rompono davvero i gamma wall?](/education/how-often-do-gamma-walls-break)).

---

## Come si spostano i gamma wall intraday

I wall non vengono annunciati all'apertura e non restano fissi fino alla chiusura. Migrano. Tre schemi comuni:

**Ampiezza.** Un range di wall stretto significa che la gamma è concentrata vicino allo spot su entrambi i lati. In un regime di gamma positiva è il classico assetto da pinning - la copertura si oppone ai movimenti in entrambe le direzioni. Un range ampio significa che gli strike densi più vicini sono lontani, quindi in mezzo c'è meno copertura concentrata e il prezzo può percorrere più strada prima di incontrarne.

**Asimmetria.** Lo spot sta raramente nel mezzo. Quando un wall è molto più vicino dell'altro, il wall vicino è il livello che viene davvero testato e quello lontano è soprattutto contesto. Uno spot che sta lo 0,3% sotto il call wall e l'1,4% sopra il put wall è una giornata diversa da uno spot a metà strada tra i due: il primo ha un punto di decisione a breve, il secondo no.

La trappola è leggere ampiezza o asimmetria senza il regime. Entrambe le letture qui sopra presuppongono gamma positiva. Sotto il flip, lo stesso range stretto non è un pin - è una distanza breve tra due livelli, e la copertura rafforzerà un movimento che attraversi l'uno o l'altro.

---

## Come i gamma wall si spostano durante la seduta

I wall non vengono annunciati in apertura per poi tenere fino alla chiusura. Migrano. Tre schemi comuni:

1. **Rivalutazione della gamma.** Spot, tempo alla scadenza e volatilità implicita cambiano la gamma modellata di ogni strike e possono cambiare l'ordinamento anche quando l'OI ufficiale resta fisso.
2. **Idoneità in base al lato dello spot.** Uno strike può passare da un lato all'altro dello spot, mentre un altro strike con OI invariato diventa la maggiore concentrazione idonea. L'OI ufficiale di norma si aggiorna dopo la compensazione; la migrazione intraday del wall non dimostra che i clienti abbiano aperto posizioni sul nuovo strike.
3. **Concentrazione vicino alla scadenza.** La gamma ATM può salire nettamente mentre quella degli strike decisamente ITM o OTM tende a zero, cambiando l'ordinamento. Questa rivalutazione è cosa diversa dalla chiusura di posizioni e dall'aggiornamento dell'OI ufficiale dopo la compensazione.

Un wall può spostarsi anche solo perché si muovono spot, tempo e volatilità implicita - lo strike che porta la maggiore esposizione modellata cambia anche quando il posizionamento resta uguale. Un gamma wall è lo strike con più gamma modellata *in questo momento*. Trattalo come una lettura viva, non come una linea fissa.

---

## I gamma wall verso la scadenza dello stesso giorno

Lo 0DTE è il terreno in cui il comportamento dei wall è più estremo, in entrambe le direzioni.

La gamma su una catena a scadenza giornaliera è molto grande vicino allo spot e cala rapidamente allontanandosi, quindi i wall stanno stretti al prezzo e la concentrazione su di essi è molto più pesante che su una catena a scadenza più lunga. Quando il regime lo sostiene, questo produce il pinning più forte che ti capiterà probabilmente di vedere - il prezzo che macina in una banda stretta tra due wall distanti solo pochi punti.

La stessa concentrazione rende quei wall instabili. Poiché la gamma 0DTE si rivaluta bruscamente al muoversi dello spot e allo scorrere dell'orologio, un wall 0DTE può migrare più volte in un'ora senza che venga aperta una sola posizione nuova. I wall possono anche sparire: quando gli strike finiscono decisamente dentro o fuori dal denaro, la loro gamma modellata tende a zero e l'ordinamento si riorganizza attorno a ciò che resta vicino allo spot.

Un gamma wall è lo strike gamma *attualmente* più pesante. Va trattato come una lettura in tempo reale, non come una linea fissa.

---

## Quando i wall tengono e quando si rompono

I wall non sono previsioni, e abbiamo misurato quanto spesso cedono. Su 737 test di wall relativi a SPY, SPX, QQQ e NDX nell'arco di dieci settimane del 2026, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora dal test e quelli del Nasdaq circa la metà delle volte ([Quanto spesso si rompono davvero i gamma wall?](/education/how-often-do-gamma-walls-break)). Questo tasso di base per indice è la migliore stima a priori disponibile, e nessuna delle condizioni a cui i trader ricorrono di solito è riuscita a migliorarla:

**Condizioni che abbiamo testato e che non hanno previsto le rotture:**

- Su quale lato del flip si trovava lo spot - gamma positiva o negativa.
- La dimensione del wall, la sua quota del book e il suo rango rispetto al proprio storico. I wall più grandi si sono rotti un po' meno spesso, ma con un effetto troppo debole per distinguerlo dal rumore.
- Il Net GEX, la sua traiettoria e la distanza dal flip.
- Se il wall stava migrando con il prezzo, e se la sua gamma si stava rafforzando o veniva consumata.
- Il flusso con segno sullo strike del wall, se quel flusso stava accelerando, e la volatilità realizzata.
- Da quanto tempo il wall era presente, quante volte era stato testato e il momento della giornata.

**Cosa cambia invece il regime:**

- In gamma positiva (sopra il flip), l'hedging modellato si oppone a un movimento verso il wall, il che può rallentarlo o ancorare il prezzo vicino allo strike.
- In gamma negativa (sotto il flip), l'hedging modellato asseconda il movimento, quindi, se il wall cede, l'hedging rafforza la rottura invece di attenuarla.

La maggior parte di questi elementi può essere letta in tempo reale, e nessuno di essi ti dice se questo wall terrà. Un catalizzatore macro (CPI, FOMC, NFP, una notizia geopolitica) che arriva durante un test può travolgere l'hedging in entrambi i regimi. Usa il tasso di base dell'indice come stima a priori e il regime come descrizione di ciò che l'hedging sta facendo intorno al livello, non come probabilità.

---

## Come ZeroGEX mostra il call wall e il put wall

La dashboard mostra i wall in due punti:

- **Le card metriche dei wall** mostrano gli strike attuali del call wall e del put wall, con la distanza percentuale in tempo reale dallo spot.
- **Il grafico GEX walls** traccia il profilo gamma strike per strike con entrambi i wall evidenziati.

![Card ZeroGEX dashboard Call Wall e Put Wall con distanza percentuale dallo spot](/blog/zerogex-walls-cards.png)

Un esempio pratico. Supponiamo che SPX sia a 5.830. La dashboard mostra:

- **Call Wall:** 5.850 (+0,34% dallo spot)
- **Put Wall:** 5.790 (−0,69% dallo spot)
- **Net GEX:** +1,5 miliardi di $
- **Gamma Flip:** 5.810

Il Net GEX qui è una stima modellata della gamma dei dealer basata sulla tradizionale convenzione call-positive/put-negative sull'open interest; l'inventario effettivo dei dealer non è direttamente osservabile dai dati pubblici della catena di opzioni. La lettura strutturale: lo spot è comodamente sopra il flip (regime di gamma lunga), il range dei wall è asimmetrico - molto più vicino al call wall che al put wall - e il Net GEX è sano. Cosa ti dice questo: il call wall è il test più vicino, e un rally verso di esso incontra un hedging che, secondo il modello, gli si oppone. Quello che non ti dice è se 5.850 terrà. Nella nostra misurazione i wall di SPX hanno tenuto circa due volte su tre entro un'ora, da qualunque lato del flip si trovasse il prezzo. Una discesa sotto 5.810 cambierebbe il meccanismo, non queste probabilità: l'hedging inizierebbe a rafforzare i movimenti invece di smorzarli.

![Grafico GEX walls di ZeroGEX che evidenzia il call wall e il put wall sul profilo gamma strike per strike](/blog/zerogex-walls-chart.png)

Ora immaginiamo che il call wall migri fino a 5.855 mentre il prezzo sonda 5.848. Quella migrazione è un dato - lo strike che stavi osservando non è più il più pesante, quindi il livello contro cui stai operando si è spostato. Di per sé non è un segnale che la rottura reggerà: nella nostra misurazione, il fatto che un wall migrasse con il prezzo non ha permesso di prevedere se si sarebbe rotto.

---

## Fraintendimenti comuni

Alcune trappole:

- **"I wall sono supporto/resistenza rigidi."** Sono inclinazioni strutturali. Un flusso reale li rompe regolarmente: nella nostra misurazione, circa un test su tre entro un'ora per i wall dell'S&P e circa la metà per quelli del Nasdaq.
- **"Lo strike con il maggiore open interest è sempre il wall."** I wall sono ponderati in base all'esposizione gamma, non all'OI grezzo. Uno strike vicino all'ATM può dominare uno strike molto OTM con il doppio dell'open interest.
- **"I wall sono statici per tutta la sessione."** Migrano. Un wall che non si è mosso in due ore rappresenta una lettura; un wall che ha derivato con il prezzo tre volte è una lettura molto diversa.
- **"I wall funzionano allo stesso modo in qualsiasi regime."** L'hedging no: in gamma positiva si oppone a un movimento verso il wall, in gamma negativa rafforza un movimento che lo attraversa. Nella nostra misurazione la frequenza con cui i wall si sono rotti non è cambiata con il regime; ciò che cambia è cosa fa l'hedging intorno alla rottura.
- **"Il call wall è rialzista, il put wall è ribassista."** Nessuno dei due è direzionale, e il tipo di opzione da solo non determina il comportamento. Sono livelli di concentrazione di gamma il cui effetto dipende dal segno modellato della gamma dei dealer e dal flusso circostante - cioè da quale lato del flip ci si trova.

---

## Conclusione

> I gamma wall sono posizionamento reale, non psicologia. Delineano il range strutturale, e il gamma flip ti dice se l'hedging intorno a quei wall si oppone ai movimenti o li rafforza. Se un dato wall tiene è una questione di tasso di base, non di lettura: circa due test su tre entro un'ora per i wall dell'S&P, circa la metà per quelli del Nasdaq.

Leggi prima il regime. Poi il wall. Infine la migrazione del wall. Questa sequenza ti dice cosa sta facendo l'hedging dei dealer intorno al livello - la differenza tra fadare un rally che il book dei dealer sta fadando insieme a te e fadare un rally che lo stesso book dei dealer sta per inseguire. Non ti dice se questo specifico wall terrà; per quello, il tasso di base dell'indice è la guida migliore che abbiamo misurato.

Solo contenuto educativo - nessuno di quanto sopra è un consiglio di trading.

---

Se vuoi vedere il call wall e il put wall di oggi, [le pagine gratuite gamma-levels di ZeroGEX](/spx-gamma-levels) li mostrano entrambi insieme al gamma flip e al profilo gamma dei dealer che li ha prodotti, con un ritardo di circa 15 minuti; i piani a pagamento li mostrano [in tempo reale](/real-time-gex-0dte). Per un quadro più ampio degli strumenti sul gamma exposure, consulta [la guida ai migliori strumenti GEX](/education/best-gex-tools).
