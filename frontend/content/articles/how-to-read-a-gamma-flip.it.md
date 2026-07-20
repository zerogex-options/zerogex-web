# Come leggere un gamma flip

*La lettura pratica del gamma flip — cos'è davvero questo livello, cosa cambia sopra e sotto di esso, e come agire intraday. Il gamma flip spiegato senza fronzoli.*

---

## Perché il gamma flip è importante

La maggior parte dei trader legge il price action rispetto a supporti e resistenze. Il gamma flip è qualcosa di diverso: è un **confine di regime**, non un target. Quando lo spot è sopra il flip, le dinamiche di hedging dei dealer tendono a *smorzare* la volatilità. Quando lo spot è sotto, quelle stesse dinamiche tendono ad *amplificarla*. I setup che funzionano in un regime sono di solito quelli sbagliati nell'altro — e riconoscere in quale regime ci si trova è gran parte del vantaggio.

Questo articolo offre la lettura orientata al trader. Copriremo cos'è realmente il livello del flip, cosa cambia quando lo spot lo attraversa, e come usarlo all'interno di una sessione. Se vuoi approfondire la struttura di mercato sottostante, parti dal [pilastro sulla Gamma Exposure](/education/gamma-exposure-explained); per la metodologia di calcolo, vedi la [guida al calcolo del Gamma Flip](/guides/gamma-flip-calculation-before-vs-after).

---

## Cos'è un gamma flip?

Il gamma flip è il livello di prezzo in cui l'esposizione gamma aggregata dei dealer attraversa lo zero. Sopra il flip, i dealer sono tipicamente net long gamma; sotto, sono tipicamente net short. Non è uno strike fisso. È il prezzo in cui il profilo di gamma dei dealer cambia segno — e mentre la catena si riponera nel corso della giornata, quel prezzo si muove.

Alcune cose da chiarire esplicitamente:

- Il flip è un **livello, non un muro.** Non oppone resistenza al prezzo come potrebbe fare uno strike call o put molto pesante. Segna un punto di inflessione comportamentale, non una barriera strutturale.
- È un **indicatore di regime, non direzionale.** Lo spot sopra il flip non è rialzista. Lo spot sotto non è ribassista. Il regime ti dice qualcosa sul *carattere della volatilità* realizzata, non sulla direzione.
- È **dinamico.** Man mano che l'open interest ruota, le scadenze decadono e nuovo flusso arriva sul book, il flip si sposta. Un flip obsoleto è un flip fuorviante.

Trattalo come un meteorologo tratta un fronte atmosferico — sapere da che lato ti trovi ti dice che tipo di tempo aspettarti, non dove andrà la tempesta.

---

## Cosa succede sopra il gamma flip?

Sopra il flip, i dealer sono generalmente net long gamma. Per restare delta-neutral, vendono nella forza e comprano nella debolezza. Questo riflesso di hedging spinge *contro* i movimenti direzionali anziché assecondarli.

Conseguenze pratiche che i trader osservano sul tape:

- **La volatilità realizzata tende a comprimersi.** I breakout più spesso si arrestano e vengono faded.
- **Il pin behavior diventa più probabile.** Il prezzo tende a gravitare verso gli strike con forte concentrazione di gamma, specialmente in chiusura.
- **I setup mean-reversion hanno un hit rate più alto.** Fadare i rally verso un [call wall](/education/gamma-walls-explained), comprare i dip vicino a un put wall, e le strutture short-premium beneficiano tutte del riflesso smorzante.
- **Il trend-following ha un hit rate più basso.** I breakout che sembrano puliti su un grafico a 5 minuti spesso non riescono a estendersi.

Nulla di tutto ciò è una garanzia. Shock macro, dinamiche di OpEx, o un flip-cross verso il basso possono sovrastare il regime a metà sessione. Come inclinazione di base, comunque, il comportamento sopra il flip tende alla calma.

---

## Cosa succede sotto il gamma flip?

Sotto il flip, i dealer sono generalmente net short gamma. Per restare delta-neutral, ora comprano nella forza e vendono nella debolezza. Questo riflesso di hedging spinge *con* i movimenti direzionali, non contro di essi.

Conseguenze pratiche:

- **La volatilità realizzata tende ad espandersi.** I breakout hanno più follow-through; i selloff accelerano.
- **Il pin behavior si rompe.** Gli strike che magnetizzavano il prezzo sopra il flip iniziano a rilasciarlo.
- **Il trend-continuation ha un hit rate più alto.** Il momentum tende ad estendersi piuttosto che svanire.
- **Il mean-reversion diventa pericoloso.** Prendere un coltello che cade in un regime di gamma negativa profonda tende ad amplificare le perdite, perché il riflesso del dealer su cui contavi (comprare la debolezza) è proprio quello che si è appena invertito.

Anche questa è un'inclinazione probabilistica, non una previsione. Un singolo headline tranquillo può calmare il tape all'interno dello stesso regime. Ma sapere di trovarsi in territorio short-gamma dovrebbe cambiare quali trade prendi e — soprattutto — quali trade eviti.

---

## Come agire sul gamma flip intraday

Leggere il gamma flip in tempo reale è un breve set di abitudini:

1. **Controlla prima il regime.** Prima di qualsiasi setup, sappi se lo spot è sopra o sotto il flip. Questa singola lettura filtra una quota significativa di trade sbagliati.
2. **Osserva la distanza dal flip.** Uno spot chiaramente distante dal flip con un margine sano è una lettura di regime stabile. Uno spot incastrato entro pochi decimi di punto percentuale è un regime conteso — entrambi i lati del book sono parzialmente attivi, e il comportamento è instabile. Riduci la size o resta a guardare.
3. **Osserva la migrazione.** I livelli di flip si spostano man mano che il positioning si riequilibra. Un flip che deriva verso l'alto insieme al prezzo ha un significato diverso da uno ancorato mentre il prezzo si muove verso di esso.
4. **Abbina il flip ai wall.** Il flip ti dice il regime; il [call wall e put wall](/education/gamma-walls-explained) ti dicono i confini strutturali al suo interno. Leggili insieme.
5. **Rispetta la concentrazione 0DTE.** Quando le scadenze dello stesso giorno dominano la catena, il flip diventa particolarmente reattivo. Vedi [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained) per le letture specifiche del regime.

La disciplina consiste nell'usare il flip come **filtro**, non come segnale. Ti dice quale playbook seguire; l'entry deve comunque arrivare da qualche altra parte.

---

## Leggere il gamma flip su ZeroGEX

La dashboard ZeroGEX mostra il flip in due punti:

- La **metric card Gamma Flip** mostra il livello attuale del flip insieme alla distanza live in dollari e in percentuale dallo spot.
- Il **grafico del profilo gamma dei dealer** traccia la curva attraverso gli strike, con l'incrocio dello zero — il flip — visibile direttamente.

![ZeroGEX dashboard Gamma Flip card showing SPX spot above the flip with live distance](/blog/zerogex-gamma-flip-card.png)

Un esempio pratico. Supponiamo che SPX sia scambiato a 5.830 e la dashboard mostri:

- **Net GEX:** +$1.2B
- **Gamma Flip:** 5.815
- **Distanza:** +15 / +0,26%

La lettura: lo spot è in territorio long-gamma, comodamente sopra il flip. Il valore Net GEX in evidenza è coerente con il regime — positivo, perché è il valore della stessa curva di gamma dei dealer valutata allo spot, e quella curva diventa positiva solo una volta superato il flip. (Questa coerenza di segno è strutturale al modo in cui ZeroGEX calcola il profilo.) Inclinazione pratica: volatilità smorzata, breakout con più probabilità di essere faded, pin behavior verso gli strike a forte gamma sul tavolo verso la chiusura.

![ZeroGEX dealer gamma profile chart with the gamma flip line marked and spot above it](/blog/zerogex-strike-profile-flip.png)

Ora immagina la stessa dashboard 30 minuti dopo: SPX 5.810, gamma flip 5.818. Lo spot è sceso sotto, e il flip è effettivamente derivato verso l'alto verso dove si trovava lo spot. Questo è il punto di inflessione strutturale in cui il carattere intraday cambia — e un trader che stava fadando i rally sopra il flip dovrebbe essere molto più cauto nel fadare il prossimo selloff all'interno del nuovo regime.

---

## Errori comuni nella lettura del gamma flip

Alcuni pattern che traggono in inganno i trader:

- **Trattare il flip come supporto o resistenza.** È una linea di regime, non un livello contro cui tradare. Comprare la debolezza *verso* il flip dall'alto è un trade strutturalmente diverso rispetto a comprarla dal basso.
- **Ignorare quanto sia dinamico.** Il flip può muoversi di diversi punti in poche ore man mano che il positioning si sposta. Leggere il flip di ieri sul tape di oggi significa leggere un book obsoleto.
- **Confondere la vicinanza con la conferma.** Lo spot che si trova *proprio sul* flip è lo stato meno informativo, non il più informativo. Entrambi i regimi sono parzialmente attivi e la lettura è debole.
- **Leggere il flip senza controllare la magnitudo del Net GEX.** Un flip con $2B di gamma dei dealer sopra è un regime molto più netto di uno con $200M. La magnitudo conta quanto il segno.
- **Confondere il flip con il max pain.** Il max pain è una stima di pinning a scadenza basata sul payoff dei possessori di opzioni. Il flip è una linea di regime di hedging in tempo reale basata sulla gamma dei dealer. Spesso sono in disaccordo, e rispondono a domande diverse.

---

## Conclusione

> Sopra il flip è generalmente un regime long-gamma, che smorza la volatilità. Sotto è generalmente un regime short-gamma, che la amplifica. Lo spot sul flip è conteso, non neutrale.

Usato come filtro — non come segnale — il gamma flip è la cosa più vicina a un'unica lettura solida e duratura che l'analisi del positioning dei dealer possa offrire. Non ti dirà in che direzione andrà il mercato. Ti dirà quali trade hanno il riflesso del dealer a favore e quali lo stanno contrastando.

Solo a scopo educativo — nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere la [lettura del gamma flip di oggi in tempo reale](/real-time-gex-0dte), [la dashboard gratuita ZeroGEX](/spx-gamma-levels) la mostra insieme al Net GEX, ai call e put wall, e al grafico del profilo gamma dei dealer. Per un confronto su come diverse piattaforme calcolano e presentano questa lettura, vedi [la guida ai migliori strumenti GEX](/education/best-gex-tools).
