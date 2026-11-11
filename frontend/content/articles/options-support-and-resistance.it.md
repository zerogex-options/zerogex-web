# Come identificare supporto e resistenza dal posizionamento sulle opzioni

*Il supporto e la resistenza classici sono soprattutto psicologia - linee disegnate, swing precedenti, numeri tondi. Il supporto e la resistenza basati sulle opzioni sono meccanica - posizionamento reale che genera flussi di hedging reali. Ecco come identificarli e come leggerli in tempo reale.*

---

## Due tipi di supporto e resistenza

Il toolkit S/R del trader retail è per lo più derivato dal grafico: swing high e low precedenti, trendline, numeri tondi, medie mobili. Funzionano - a volte - perché abbastanza trader li osservano da renderli auto-avveranti. Il meccanismo è convergenza psicologica.

Il supporto e la resistenza basati sulle opzioni sono diversi. Non derivano dallo storico dei prezzi; derivano dal posizionamento attuale sulle opzioni. Il meccanismo è strutturale: flussi di hedging modellati dei dealer che tendono a scattare man mano che il prezzo si avvicina a strike concentrati. Gran parte di questo hedging è sistematico più che discrezionale - quindi, quando il segno modellato del gamma dei dealer è allineato, quei flussi possono agire da offerta vicino alla resistenza e da domanda vicino al supporto.

Quando S/R da grafico e S/R da opzioni concordano, il livello tende a essere più affidabile. Quando divergono, la lettura basata sulle opzioni spesso ha più peso - perché il livello da grafico è opinione, mentre il livello da opzioni si fonda su un flusso di hedging guidato dal posizionamento.

Questo articolo è il workflow pratico per identificare S/R basati sulle opzioni, leggerli in tempo reale e sapere cosa aspettarsi quando il prezzo li testa. Per il framework gamma più ampio, vedi il [pillar sull'Esposizione Gamma](/education/gamma-exposure-explained).

---

## I quattro tipi di S/R basati sulle opzioni

Le etichette qui sotto - call wall come resistenza, put wall come supporto - descrivono in che direzione pende l'hedging modellato in un regime di *gamma positivo*. Non sono proprietà fisse dello strike: il tipo di opzione da solo non fissa la direzione, e l'hedging può invece assecondare un movimento quando cambia il segno del gamma dealer modellato o il flusso circostante.

### 1. Call wall (resistenza)

Il **call wall** è lo strike sopra lo spot con la maggiore esposizione gamma sulle call. Secondo la convenzione tradizionale i dealer sono modellati long su quell'inventario, quindi in un regime long-gamma tendono a vendere durante i rally che si avvicinano al wall. Questa vendita può agire da resistenza strutturale.

Lettura pratica: in un regime di gamma positivo, l'hedging intorno al call wall si oppone a un rally; in un regime di gamma negativo lo asseconda, quindi il wall, se cede, può diventare un acceleratore di breakout. Il regime cambia questo comportamento, non quanto spesso il wall si rompe: nella nostra misurazione i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora, sia sopra sia sotto il flip.

### 2. Put wall (supporto)

Il **put wall** è lo strike sotto lo spot con la maggiore esposizione gamma sulle put. Quando il gamma netto è modellato positivo, il book aggregato dei dealer tende a comprare durante i selloff che si avvicinano al wall. Quell'acquisto netto può agire da supporto strutturale - nota che il supporto deriva dal segno positivo del gamma netto, non dal fatto che lo strike sia composto da put (secondo la convenzione, i dealer sono modellati short su quelle put).

Stessa dipendenza dal regime del call wall - in gamma negativo, un put wall che cede può diventare un punto di slippage nella discesa.

La meccanica dei wall in entrambi i regimi è spiegata in [Gamma wall spiegati](/education/gamma-walls-explained).

### 3. Il gamma magnet (attrazione verso il pin)

Il **gamma magnet** è lo strike con la maggiore concentrazione gamma assoluta. Non è direzionale - in un regime long-gamma tende ad attrarre il prezzo verso di sé, e in short-gamma tende a rilasciarlo. Quando l'attrazione è attiva, può agire contemporaneamente da supporto e da resistenza: il prezzo sopra di esso può essere tirato verso il basso nella sua direzione; il prezzo sotto può essere tirato verso l'alto.

Il magnet tende a contare di più in prossimità della scadenza, quando le opzioni in scadenza lo stesso giorno dominano il profilo gamma. Il comportamento di pin a fine giornata può derivare da questo strike, anche se il pinning è probabilistico - contribuiscono anche la liquidità, il comportamento dei trader e la meccanica della scadenza, e una grande concentrazione non è di per sé la prova che lì i dealer siano long gamma.

### 4. Il gamma flip (linea di regime)

Il **gamma flip** non è S/R in senso tradizionale - è il confine di regime, un passaggio per lo zero del profilo gamma *modellato* dei dealer. Ma può funzionare come una linea di supporto/resistenza debole perché il prezzo spesso si ferma o inverte brevemente intorno a esso (il riflesso modellato dei dealer cambia segno vicino a quel prezzo). Sopra il flip, il riflesso modellato è fadare; sotto, inseguire - anche se il passaggio è una stima del modello, e il comportamento effettivo dipende comunque da flusso, liquidità e volatilità.

Vedi [Cos'è un gamma flip?](/education/how-to-read-a-gamma-flip) per il flusso di lavoro.

---

## Perché lo SPY inverte a questi livelli?

Le inversioni che sembrano casuali su un grafico dello SPY - il prezzo corre fino a un livello che non era uno swing precedente né un numero tondo, si ferma di colpo e ritraccia - di solito sono il risultato di uno di questi quattro livelli che fa il suo lavoro. Al **call wall**, i dealer modellati long sullo strike vendono durante il rally per restare coperti, aggiungendo un'offerta che mette un tetto al movimento. Al **put wall**, un book net long gamma compra durante il selloff, aggiungendo supporto. Al **gamma magnet**, il riflesso di hedging modellato riporta il prezzo verso lo strike. Al **gamma flip**, quel riflesso cambia segno e il prezzo spesso fa una pausa mentre lo attraversa. Nessuno di questi livelli è sul grafico dei prezzi - stanno sulla catena delle opzioni - ed è per questo che l'inversione sembra venuta dal nulla finché non la ricolleghi al posizionamento. Nella nostra misurazione, che un wall assorba il movimento o venga travolto non è dipeso dal regime - i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora, sia sopra sia sotto il flip. Ciò che il regime cambia è l'hedging intorno al livello, quindi leggi prima il flip: in long gamma, l'hedging si oppone a un rally verso il call wall; in short gamma, rafforza il movimento una volta che quel wall cede.

---

## Perché l'S/R basato sulle opzioni è più solido dell'S/R da grafico

Tre motivi:

1. **È sistematico, non scelto.** Un trader può decidere se difendere o meno una trendline. L'hedging gamma dei dealer è in larga parte sistematico - i desk gestiscono l'esposizione aggregata invece di agire in base a un'opinione di mercato - quindi il flusso tende a verificarsi indipendentemente dal fatto che il dealer ci creda o meno. (I desk coprono portafogli e possono usare bande di copertura, quindi è una tendenza, non un ordine garantito in modo continuo.)

2. **Scala con il posizionamento, non con l'attenzione.** Una trendline si rafforza con più occhi puntati su di essa; un wall riflette più open interest. Più grande è la concentrazione modellata, maggiore è il potenziale flusso di hedging quando il prezzo si avvicina. La relazione si fonda sul posizionamento, non sul sentiment.

3. **Viene ricalcolato.** Spot, tempo e volatilità implicita rivalutano il gamma su ogni strike, quindi un altro strike con OI fisso può diventare il wall nel corso della seduta. L'OI ufficiale di norma si aggiorna dopo la compensazione; un wall che migra non è la prova che lì siano state aperte nuove posizioni.

Detto questo, l'S/R basato sulle opzioni non è infallibile. È un'inclinazione probabilistica. Shock macro ed eventi catalizzatori lo scavalcano regolarmente, e un cambio di regime modifica ciò che fa l'hedging. Il vantaggio è che l'inclinazione è *fondata* - quando funziona, funziona per un motivo verificabile.

---

## Come identificare i livelli in tempo reale

Un workflow breve:

1. **Individua prima il gamma flip.** Ti dice in quale regime ti trovi. Il flip stesso è anche un livello debole da tenere d'occhio.
2. **Identifica il call wall e il put wall.** Ti danno il range strutturale - i confini presso i quali l'hedging dei dealer si oppone al movimento (in un regime long-gamma) o rafforza un movimento che li attraversa (in un regime short-gamma).
3. **Identifica il gamma magnet.** Spesso lo strike 0DTE più pesante. Il magnet ti dice dove il prezzo viene attratto all'interno del range dei wall.
4. **Controlla la migrazione.** Un wall che si è appena spostato è un riferimento diverso da uno stabile da ore: un wall in migrazione sta inseguendo il prezzo, quindi il livello che stai osservando si è spostato. Nella nostra misurazione, né l'età di un wall né la sua migrazione hanno permesso di prevedere se si sarebbe rotto.
5. **Confronta con l'S/R da grafico.** Dove il livello strutturale si allinea con un livello da grafico (numero tondo, swing precedente, media mobile chiave), la convergenza può rendere il livello più netto.

---

## Quando il livello strutturale tiene

Nella nostra misurazione su 737 test di wall, i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora dal test e quelli del Nasdaq circa la metà delle volte ([Quanto spesso si rompono davvero i gamma wall?](/education/how-often-do-gamma-walls-break)). Le condizioni che i trader controllano di solito non sono riuscite a migliorare quel tasso di base:

- Se lo spot era in un **regime di gamma positivo** (sopra il flip) o in uno di gamma negativo.
- Se il Net GEX era **consistente e stabile** o in calo.
- Se il wall stava **migrando** con il prezzo.
- Se il flusso sullo strike del wall stava **accelerando** o decelerando.
- Da quanto tempo il wall era presente, e quante volte era stato testato.

Quindi la stima a priori onesta per qualsiasi wall è il tasso di base del suo indice, non una checklist.

## Quando il livello strutturale si rompe

Ciò che il regime cambia è cosa fa l'hedging quando un livello cede:

- In un **regime di gamma positivo**, l'hedging si oppone al movimento, quindi una rottura ha meno hedging alle spalle.
- In un **regime di gamma negativo**, i dealer inseguono invece di fadare, quindi il loro hedging rafforza la rottura.
- Quando spot, tempo o volatilità cambiano l'ordinamento degli strike, il wall può **migrare**, e il livello che stavi osservando smette di essere lo strike più pesante.
- Un **catalizzatore** che arriva durante il test può travolgere l'hedging in entrambi i regimi.

Niente di tutto questo rende più probabile che un livello ceda anziché tenere. Leggere prima il regime ti dice con quale meccanismo stai operando, non le probabilità.

---

## Esempio pratico

SPY è a 581,50. Il grafico standard mostra resistenza intorno a 583 (swing high precedente) e supporto intorno a 580 (media mobile a 50 giorni, numero tondo). ZeroGEX mostra:

- **Call Wall:** 583,50 (vicino ma non esattamente sulla resistenza da grafico)
- **Put Wall:** 580,00 (esattamente sul supporto da grafico)
- **Gamma Flip:** 580,80 (tra lo spot attuale e il put wall)
- **Gamma magnet:** 581,00 (praticamente sullo spot)
- **Net GEX:** +1,1 miliardi di $, stabile (una stima modellata del gamma dei dealer basata sulla tradizionale convenzione call-positive/put-negative sull'open interest, non un'osservazione dell'inventario dei dealer)

La lettura strutturale composita:

- Il call wall e la resistenza da grafico concordano vicino a 583 - la zona di resistenza a maggiore confidenza è proprio dove la vedono i chartisti, ma il posizionamento modellato colloca il wall a 583,50, non al tondo 583.
- Anche il put wall e il supporto da grafico concordano vicino a 580 - lì la lettura del supporto è più solida.
- Il gamma magnet a 581,00 significa che il prezzo può subire un'attrazione strutturale verso un livello vicino a quello attuale. Finché il gamma positivo regge, l'hedging si oppone ai movimenti in entrambe le direzioni.
- Il flip a 580,80 significa che una discesa sotto 580,80 farebbe cambiare il regime modellato; se questo avviene prima e poi il put wall a 580 cede, l'hedging rafforza il movimento invece di attutirlo.

La lettura: l'hedging modellato si oppone ai movimenti verso l'uno o l'altro estremo del range 581-583,50, ma ogni wall resta una scommessa sul tasso di base - nella nostra misurazione i wall di SPY hanno tenuto circa due volte su tre entro un'ora, da qualunque lato del flip si trovasse il prezzo. La lettura strutturale aggiunge dove si trovano i livelli e cosa fa l'hedging intorno a essi; non ti dice quale dei due cederà.

---

## Errori di lettura comuni

- **"È allo swing high precedente, quindi è resistenza."** A volte. A volte il livello strutturale reale è 30 centesimi più alto o più basso - e il movimento che "ha rotto" la resistenza da grafico stava sempre per estendersi fino al wall reale.
- **"Il put wall è a 580, quindi 580 terrà."** Non in modo affidabile, in nessuno dei due regimi: nella nostra misurazione i wall dell'S&P si sono rotti in circa un test su tre entro un'ora, in long gamma come in short gamma. Ciò che il regime cambia è quello che succede dopo - in short gamma, un put wall che cede può diventare un punto di slippage.
- **"L'S/R basato sulle opzioni non funziona."** Individua un posizionamento reale, e nella nostra misurazione i wall dell'S&P hanno tenuto circa due volte su tre entro un'ora. Quello che non ti dà è un modo per capire in anticipo quale wall si romperà: regime, Net GEX, migrazione e flusso sullo strike non ci sono riusciti.

---

## Conclusione

> Il supporto e la resistenza basati sulle opzioni sono meccanica, non psicologia. Identificano i livelli dove è più probabile che l'hedging dei dealer scatti - e il regime modellato ti dice se quel flusso tende ad assorbire il movimento o ad amplificarlo.

La disciplina consiste nel leggere prima la mappa strutturale, incrociarla con i livelli da grafico per la convergenza, e verificare il regime prima di decidere cosa fare con il livello. Gran parte del "rumore" apparente nell'S/R da grafico retail è il divario tra dove i grafici dicono che si trova il livello e dove il posizionamento lo mette davvero.

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere il call wall, il put wall, il gamma flip e il gamma magnet di oggi per SPY, SPX, QQQ e NDX - i quattro livelli strutturali che guidano la maggior parte dell'S/R basato sulle opzioni - la vista gratuita sui gamma-levels di ZeroGEX te li mostra.
