# Opzioni SPY vs SPX: Quali Livelli di Gamma Contano?

*SPY e SPX seguono lo stesso indice attraverso due contratti diversi — e due libri di gamma dei dealer separati. Ecco come differiscono i loro livelli di gamma, come tradurre un livello dall'uno all'altro, quale libro pesa di più e perché il livello che conta di più è quello su cui entrambi concordano.*

---

## La risposta breve

Se fai trading su SPX, leggi i livelli di gamma di SPX. Se fai trading su SPY, leggi i livelli di gamma di SPY. Ma poiché entrambi i contratti coprono lo **stesso** indice sottostante partendo da pool di open interest **separati**, la lettura più precisa si ottiene osservando entrambi — e trattando i livelli su cui coincidono come quelli più probabili a tenere.

Il resto di questo articolo spiega perché i due libri differiscono, come convertire un livello dall'uno all'altro e quale merita più peso quando sono in disaccordo.

---

## Stesso indice, due contratti diversi

SPX e SPY seguono entrambi l'S&P 500. Ciò che differisce è il *contratto* che lo avvolge — e queste differenze modellano il modo in cui i dealer coprono ciascuno di essi.

| Caratteristica | SPX | SPY |
|---|---|---|
| Cos'è | Opzioni su **indice** S&P 500 | Opzioni su **ETF** S&P 500 |
| Scala di prezzo | Il livello dell'indice (es. 6000) | ~1/10 dell'indice (es. 600) |
| Regolamento | Regolato per contanti | Regolato fisicamente (azioni) |
| Stile di esercizio | Europeo — nessuna assegnazione anticipata | Americano — rischio di assegnazione anticipata |
| Nozionale del contratto | ~$100 × livello dell'indice (≈10× SPY) | ~$100 × prezzo dell'ETF |
| Spaziatura degli strike | Più ampia (comunemente 5 punti) | Più fine ($1, alcuni $0.50) |
| Dividendi e tasse | Nessun dividendo; trattamento Section 1256 | Paga dividendi; trattamento come opzione su azioni |
| Platea tipica | Istituzionali, desk indice e 0DTE | Retail più istituzionali, hedger su azioni |

La riga più importante per la gamma è il **nozionale del contratto**. Un contratto SPX controlla circa dieci volte l'esposizione in dollari di un contratto SPY, quindi la copertura dei dealer su SPX muove molto più delta equivalente all'indice per ogni contratto. Questo aspetto conta più avanti.

---

## Perché SPY e SPX hanno libri di gamma separati

L'esposizione gamma viene calcolata a partire dall'open interest di una catena di opzioni — strike per strike, scadenza per scadenza. SPX e SPY sono catene diverse con open interest diverso, quindi ciascuna produce il proprio [profilo gamma](/education/gamma-exposure-explained): il proprio [gamma flip](/education/how-to-read-a-gamma-flip), il proprio [call wall e put wall](/education/gamma-walls-explained), il proprio net GEX.

Poiché entrambe le catene fanno riferimento allo stesso indice, questi livelli di solito puntano allo stesso punto in termini di S&P. Ma sono costruiti da platee diverse — SPX è sbilanciato verso istituzionali e indice/0DTE, SPY porta un forte flusso retail e di copertura su azioni — quindi i due libri possono pesare gli strike in modo diverso e divergere ai margini. Quando divergono, questa è informazione, non rumore.

---

## Tradurre un livello dall'uno all'altro

SPY scambia a circa un decimo dell'indice S&P 500, quindi come prima approssimazione:

> Livello SPY ≈ Livello SPX ÷ 10 — SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Due avvertenze impediscono che la mappatura sia esatta:

- **Deriva di tracciamento.** Il prezzo di SPY riflette i dividendi maturati e piccole differenze di tracciamento, quindi il rapporto non è mai un pulito 10.000. Converti per orientarti, non per il centesimo.
- **Granularità degli strike.** Gli strike di SPX sono spaziati più ampiamente (comunemente cinque punti indice) mentre SPY elenca ogni dollaro. Un wall SPX cade su un numero indice tondo; il wall SPY corrispondente può trovarsi a una risoluzione più fine — SPY spesso mostra *dove all'interno* di un bucket SPX da cinque punti si concentra effettivamente la gamma.

---

## Quale libro pesa di più?

Per la *vera* pressione di copertura dei dealer sull'S&P, SPX è di solito la mappa primaria. Tre motivi:

1. **Nozionale.** Circa 10 volte il delta in dollari per contratto significa che i flussi di copertura di SPX dominano la gamma a livello di indice che effettivamente muove l'indice cash e /ES.
2. **Profondità 0DTE.** SPX elenca una scadenza ogni giorno di negoziazione ed è il mercato di opzioni su indice più profondo che esista; il [posizionamento dei dealer](/education/0dte-dealer-positioning-explained) infragiornaliero che guida la volatilità intraday si manifesta lì per primo.
3. **Meccanica più pulita.** Il regolamento per contanti e l'esercizio europeo significano nessuna corsa all'assegnazione anticipata che distorca il libro verso la scadenza.

SPY si guadagna il suo posto come strato di **granularità e conferma**: strike più fini, enorme liquidità sulle azioni e il flusso retail e di hedger che produce il [pinning specifico di SPY](/education/why-spy-pins-near-strikes). E quando fai trading su SPY stesso, sono i suoi propri wall a cui il tuo strumento reagirà effettivamente.

---

## Quali livelli contano per il tuo trade?

Abbina la mappa allo strumento su cui stai effettivamente facendo trading:

- **SPX, /ES, o SPX 0DTE** → i livelli di gamma di SPX sono la tua mappa.
- **Azioni SPY o opzioni SPY** → livelli di gamma di SPY — i wall e il pin del tuo strumento.
- **QQQ** → livelli QQQ (vedi sotto).

Poi cerca la **confluenza**. Quando il call wall di SPX a 6000 si allinea con il call wall di SPY a 600, quel livello condiviso è più solido di ciascuno singolarmente — due libri dealer separati che si appoggiano sullo stesso prezzo. Quando sono in *disaccordo*, considera entrambi più deboli e lascia che sia il prezzo a dirti quale libro ha il controllo.

> Il livello più solido basato sulle opzioni non è il wall più grande su un unico grafico. È il livello su cui SPX e SPY concordano.

---

## QQQ e NDX: la stessa logica sul Nasdaq

Il Nasdaq-100 ha la stessa suddivisione: **QQQ** è l'ETF, **NDX** è l'indice cash, e ciascuno porta il proprio libro di gamma a una scala di prezzo diversa. Se fai trading su QQQ, leggi i [livelli di gamma di QQQ](/qqq-gamma-levels); se fai trading su NDX o /NQ, il libro dell'indice è il tuo riferimento. L'idea della confluenza si applica anche qui — i wall di QQQ che concordano con il libro NDX sono quelli da rispettare.

---

## Leggerli fianco a fianco su ZeroGEX

Le pagine gratuite dei livelli di gamma di ZeroGEX pubblicano tutti e tre i libri uno accanto all'altro, così l'accordo è evidente a colpo d'occhio:

- [Livelli di gamma SPX](/spx-gamma-levels) — il libro dell'indice, la mappa primaria dell'S&P.
- [Livelli di gamma SPY](/spy-gamma-levels) — il libro dell'ETF, strike più fini e dettaglio di pinning.
- [Livelli di gamma QQQ](/qqq-gamma-levels) — la lettura del Nasdaq-100.

Ogni pagina parte dal gamma flip, call wall, put wall, max pain e net dealer GEX del proprio ticker, poi mostra gli altri due per un controllo incrociato. Per la meccanica dietro i livelli, inizia con [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained), poi [Gamma Walls Explained](/education/gamma-walls-explained) e [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Conclusione

SPY e SPX seguono un unico indice attraverso due contratti e due libri di gamma dei dealer separati. Fai trading sui livelli che appartengono al tuo strumento, usa il rapporto di ~10× per tradurre tra loro, appoggiati a SPX come mappa più pesante a livello di indice e a SPY per granularità e pinning — e dai il massimo rispetto ai livelli su cui i due concordano.

*Queste sono analisi derivate a scopo educativo, non consulenza di investimento. Il trading di opzioni comporta rischi significativi.*
