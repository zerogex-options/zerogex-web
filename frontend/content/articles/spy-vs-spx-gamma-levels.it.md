# Opzioni SPY vs SPX: Quali Livelli di Gamma Contano?

*SPY e SPX seguono lo stesso indice attraverso due contratti diversi - e due libri di gamma dei dealer separati. Ecco come differiscono i loro livelli di gamma, come tradurre un livello dall'uno all'altro, quale libro tende a pesare di più e perché i livelli su cui concordano possono contare di più.*

---

## La risposta breve

Se fai trading su SPX, leggi i livelli di gamma di SPX. Se fai trading su SPY, leggi i livelli di gamma di SPY. Ma poiché entrambi i contratti seguono lo **stesso** indice sottostante pur avendo pool di open interest **separati**, osservarli entrambi può fornire un contesto aggiuntivo. ZeroGEX non ha stabilito che la concordanza garantisca una maggiore affidabilità.

Il resto di questo articolo spiega perché i due libri differiscono, come convertire un livello dall'uno all'altro e quale merita più peso quando sono in disaccordo.

---

## Stesso indice, due contratti diversi

SPX e SPY seguono entrambi l'S&P 500. Ciò che differisce è il *contratto* che lo avvolge - e queste differenze modellano il modo in cui i dealer coprono ciascuno di essi.

| Caratteristica | SPX | SPY |
|---|---|---|
| Cos'è | Opzioni su **indice** S&P 500 | Opzioni su **ETF** S&P 500 |
| Scala di prezzo | Il livello dell'indice (es. 6000) | ~1/10 dell'indice (es. 600) |
| Regolamento | Regolato per contanti | Regolato fisicamente (azioni) |
| Stile di esercizio | Europeo - nessuna assegnazione anticipata | Americano - rischio di assegnazione anticipata |
| Nozionale del contratto | ~100 $ × livello dell'indice (≈10× SPY) | ~100 $ × prezzo dell'ETF |
| Spaziatura degli strike | Più ampia (comunemente 5 punti) | Più fine (1 $, alcuni 0,50 $) |
| Dividendi e tasse | Nessun dividendo; trattamento Section 1256 | Paga dividendi; trattamento come opzione su azioni |
| Platea tipica | Istituzionali, desk indice e 0DTE | Investitori individuali più istituzionali, hedger su azioni |

La riga più importante per il gamma è il **nozionale del contratto**. Un contratto SPX controlla circa dieci volte l'esposizione in dollari di un contratto SPY, quindi la copertura dei dealer su SPX muove molto più delta equivalente all'indice per ogni contratto. Questo aspetto conta più avanti.

---

## Perché SPY e SPX hanno libri di gamma separati

L'esposizione gamma viene calcolata a partire dall'open interest di una catena di opzioni - strike per strike, scadenza per scadenza - e le viene poi assegnato per convenzione un segno dei dealer. SPX e SPY sono catene diverse con open interest diverso, quindi ciascuna produce il **proprio** [profilo gamma](/education/gamma-exposure-explained): il proprio [gamma flip](/education/how-to-read-a-gamma-flip), il proprio [call wall e put wall](/education/gamma-walls-explained), il proprio net GEX.

Una nota di inquadramento su tutto questo: il net GEX e il "libro di gamma dei dealer" sono stime *modellate* - magnitudini di gamma ricavate dalla catena pubblica, a cui si assegna il segno con la tradizionale convenzione call-positive / put-negative. L'inventario effettivo dei dealer non è direttamente osservabile dai dati della catena di opzioni, quindi tratta entrambi i libri come modelli di posizionamento e non come un registro di ciò che i dealer detengono davvero.

Poiché entrambe le catene fanno riferimento allo stesso indice, quei livelli di solito puntano allo stesso punto in termini di S&P. Ma sono costruite da platee diverse - l'SPX pende verso l'istituzionale e verso indice/0DTE, lo SPY porta una quota maggiore di investitori individuali e di flusso di copertura sulle azioni - quindi i due libri possono pesare gli strike in modo diverso e divergere ai margini. Quando divergono, può essere informazione anziché rumore.

---

## Tradurre un livello dall'uno all'altro

SPY scambia a circa un decimo dell'indice S&P 500, quindi come prima approssimazione:

> Livello SPY ≈ Livello SPX ÷ 10 - SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Due avvertenze impediscono che la mappatura sia esatta:

- **Deriva di tracciamento.** Il prezzo di SPY riflette i dividendi maturati e piccole differenze di tracciamento, quindi il rapporto non è mai un pulito 10,000. Converti per orientarti, non per il centesimo.
- **Granularità degli strike.** In termini di dollari grezzi SPY elenca strike più fini (1 $, alcuni da 0,50 $) rispetto alla spaziatura da cinque punti di SPX - ma applica la scala di ~10×: un dollaro di SPY vale dieci punti indice, quindi gli strike da 1 $ di SPY sono in realtà *più grossolani* degli strike da cinque punti di SPX in termini indice, mentre i suoi strike da 0,50 $ si limitano a eguagliarli. In termini indice SPX risolve il gamma almeno con la stessa finezza di SPY; il vero vantaggio di SPY sono gli strike a dollaro tondo che possono attirare il pinning e la sua liquidità sulle azioni, non una risoluzione indice più fine.

---

## Quale libro pesa di più?

Per la pressione aggregata di copertura dei dealer sull'S&P, SPX è di solito la mappa primaria. Tre motivi:

1. **Nozionale.** Circa 10× il delta in dollari per contratto significa che i flussi di copertura di SPX tendono a dominare il gamma a livello di indice che più influenza l'indice cash e /ES.
2. **Profondità 0DTE.** SPX elenca una scadenza ogni giorno di negoziazione ed è il mercato di opzioni su indice più profondo che esista; il [posizionamento dei dealer](/education/0dte-dealer-positioning-explained) sulle scadenze del giorno stesso, che può guidare la volatilità intraday, tende a manifestarsi lì per primo.
3. **Meccanica più pulita.** Il regolamento per contanti e l'esercizio europeo significano nessuna corsa all'assegnazione anticipata che distorca il libro verso la scadenza.

SPY si guadagna il suo posto come strato di **granularità e conferma**: strike più fini, enorme liquidità sulle azioni e il flusso di investitori individuali e di hedger che può produrre il [pinning specifico di SPY](/education/why-spy-pins-near-strikes). E quando fai trading su SPY stesso, i suoi wall sono i livelli a cui è più probabile che il tuo strumento reagisca.

---

## Quali livelli contano per il tuo trade?

Abbina la mappa allo strumento su cui stai effettivamente facendo trading:

- **SPX, /ES, o SPX 0DTE** → i livelli di gamma di SPX sono la tua mappa.
- **Azioni SPY o opzioni SPY** → livelli di gamma di SPY - i wall e il pin del tuo strumento.
- **QQQ** → livelli QQQ (vedi sotto).

Poi cerca la **confluenza**. Quando un livello di SPX si allinea con il livello di SPY convertito, ZeroGEX tratta quella concordanza come una confluenza di contesto tra due libri modellati separati. È un'euristica interna, non la prova che il livello condiviso abbia un tasso di successo più alto. Quando sono in disaccordo, tieni entrambi come riferimenti separati invece di presumere che uno dei due libri controlli il prezzo.

> Un livello su cui SPX e SPY concordano può contare più del wall più grande su uno solo dei due grafici.

---

## QQQ e NDX: la stessa logica sul Nasdaq

Il Nasdaq-100 ha la stessa suddivisione: **QQQ** è l'ETF, **NDX** è l'indice cash, e ciascuno porta il proprio libro di gamma a una scala di prezzo diversa. Se fai trading su QQQ, leggi i [livelli di gamma di QQQ](/qqq-gamma-levels); se fai trading su NDX o /NQ, il libro dell'indice è il tuo riferimento. Lo stesso confronto può fornire contesto per QQQ e NDX, senza garantire che la confluenza migliori l'affidabilità.

---

## Leggerli fianco a fianco su ZeroGEX

Le pagine gratuite dei livelli di gamma di ZeroGEX pubblicano tutti e tre i libri uno accanto all'altro, così l'accordo è evidente a colpo d'occhio:

- [Livelli di gamma SPX](/spx-gamma-levels) - il libro dell'indice, la mappa primaria dell'S&P.
- [Livelli di gamma SPY](/spy-gamma-levels) - il libro dell'ETF, strike più fini e dettaglio di pinning.
- [Livelli di gamma QQQ](/qqq-gamma-levels) - la lettura del Nasdaq-100.

Ogni pagina parte dal gamma flip, call wall, put wall, max pain e net dealer GEX del proprio ticker, poi mostra gli altri due per un controllo incrociato. Per la meccanica dietro i livelli, inizia con [Gamma Exposure (GEX) spiegata](/education/gamma-exposure-explained), poi [Gamma Wall spiegati](/education/gamma-walls-explained) e [Che cos'è un gamma flip?](/education/how-to-read-a-gamma-flip)

---

## Conclusione

SPY e SPX seguono un unico indice attraverso due contratti e due libri di gamma dei dealer separati. Fai trading sui livelli che appartengono al tuo strumento, usa il rapporto di ~10× per tradurre tra loro, appoggiati a SPX come mappa più pesante a livello di indice e a SPY per il pinning su numeri tondi e la liquidità sulle azioni - e dai un peso in più ai livelli su cui i due concordano.

*Queste sono analisi derivate a scopo educativo, non consulenza di investimento. Il trading di opzioni comporta rischi significativi.*
