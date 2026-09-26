# Dealer Positioning

*L'intera superficie GEX - Net GEX allo spot, il gamma flip, call wall e put wall, e come leggere la term structure.*

---

## Cosa mostra questa pagina

La pagina Dealer Positioning è la **mappa strutturale** del book di opzioni. Ogni grafico e tile risponde a un'unica domanda: dove sono posizionati i dealer e cosa saranno costretti a fare al muoversi del prezzo?

È la pagina più importante per capire il contesto, anche se il trade viene poi eseguito altrove.

Il selettore **GEX unit** nell'intestazione passa ogni valore in dollari della pagina da gamma per movimento dell'1% a gamma per 1 punto. L'esposizione è la stessa in entrambi i casi; cambia solo l'unità.

## L'header di regime

La parte alta della pagina riassume il regime in una riga:

- **Il badge** - **+ Gamma Regime** quando lo spot è sopra il gamma flip, **- Gamma Regime** quando è sotto, **~ Gamma Regime** quando lo spot è entro circa lo 0,25% dal flip, e **? Gamma Regime** quando in questo snapshot non è stato possibile risolvere alcun flip.
- **Il gamma flip** - il livello, e di quanti punti lo spot si trova sopra o sotto.
- **Lo scenario** - **Positive GEX (pinned, low vol)**, **Negative GEX (trending, high vol)**, **At the Flip (neutral, transition)** oppure **Flip unresolved this snapshot**.
- **Un'etichetta di postura** - **Aggressive**, **Balanced** o **Defensive** - costruita dal segno del gamma allo spot, dall'IV rank e dalla vanna.
- **Market Context** - la stessa lettura in linguaggio semplice, con selettore tra **Intraday** e **Swing**.

Il regime si legge solo dalla posizione dello spot rispetto al flip, non dal segno del totale sull'intera catena, quindi badge e flip non possono contraddirsi.

### Gamma Flip

Il livello di prezzo in cui la curva modellata del gamma dei dealer attraversa lo zero. È la linea di regime: sopra, l'hedging modellato *tende* a essere stabilizzante; sotto, amplificante. Poiché è l'attraversamento dello zero di un profilo modellato, può spostarsi con la convenzione di segno, le scadenze e l'IV - considera un attraversamento come un cambio nella tendenza aggregata di hedging del modello, non come un passaggio garantito dalla mean reversion al trend.

## I tile principali

### Net GEX

Il valore di dollar-gamma di tutte le opzioni aperte, con il segno della convenzione di posizionamento dei dealer modellata da ZeroGEX (call +, put −), valutato **al prezzo spot corrente**. Positivo ⇒ i dealer sono *secondo il modello* net long gamma; negativo ⇒ *secondo il modello* net short.

> È una stima: il gamma dei dealer è modellato con la convenzione tradizionale sull'open interest (call positive, put negative). L'inventario reale dei dealer non è direttamente osservabile dai dati pubblici della catena di opzioni.

Il numero che vedi qui è misurato allo spot, non sommato lungo tutta la catena - questo è importante perché il segno allo spot determina la tendenza di hedging modellata dei dealer in questo momento, indipendentemente da cosa faccia la curva cumulativa ad altri prezzi. Il badge accanto colloca il valore rispetto agli ultimi 30 giorni (NORMAL, ELEVATED, EXTREME HIGH e così via).

### IV Rank

Dove si colloca la volatilità implicita su una scala da 0 a 100%, letta dal VIX (VXN per QQQ e NDX). 0% è storicamente calmo; 100% è paura estrema.

### Vanna Flow e Charm Decay

La vanna netta e il charm netto sommati su tutti gli strike, mostrati come etichetta - **+Tailwind**, **-Headwind** o **Neutral** per la vanna; **Bullish**, **Bearish** o **Neutral** per il charm. Indicano se i movimenti della volatilità implicita e il passare del tempo, secondo il modello, aggiungono o tolgono pressione direzionale di delta.

Max pain e pin strike non sono su questa pagina - vedi [GEX Summary](/help/platform/gex-summary) e [Max Pain](/help/platform/max-pain).

## Il grafico Gamma Exposure by Strike

Il grafico principale. Strike sull'asse x; il gamma modellato dei dealer per strike come barre - call verso l'alto, put verso il basso - con la curva **GEX Profile** sovrapposta sul proprio asse. Tre cose da leggere:

1. **Dove la curva GEX Profile attraversa lo zero** - il gamma flip.
2. **Il maggior accumulo di call gamma allo spot o sopra** - il call wall.
3. **Il maggior accumulo di put gamma allo spot o sotto** - il put wall.

Le linee di riferimento segnano lo spot, il flip ed entrambi i wall. Ogni barra è impilata per scadenza - la più vicina (0DTE) più marcata, la più lontana più tenue - così vedi quanta parte del gamma di uno strike scade a breve. Il selettore delle scadenze limita barre, curva, wall e flip alle scadenze scelte, e la scelta vale anche per gli altri grafici che condividono il filtro delle scadenze. Il grafico si apre con lo zoom al minimo su tutti gli strike caricati; i pulsanti di zoom X e Y e le barre di scorrimento lo restringono.

### Call Wall / Put Wall

Gli strike con il maggior gamma lato call e lato put. Spesso agiscono come frizione intraday - ma il tipo di opzione da solo non fissa la direzione; che un wall si comporti da resistenza, supporto, magnete o acceleratore dipende dal segno modellato del gamma dei dealer e dal flusso circostante. Il comportamento da "muro" è più netto quando i dealer sono, secondo il modello, long gamma.

## Il grafico Open Interest by Strike

I contratti dietro il gamma: l'open interest a ogni strike, call sopra l'asse e put sotto, impilato per scadenza allo stesso modo. Alterna tra **OI** (contratti aperti) e **Notional** (strike × 100 × OI). Un grande accumulo di open interest lontano dallo spot può comunque portare poco gamma - per questo i wall sono classificati in base al gamma, non all'open interest.

## Le heatmap GEX

Due heatmap mostrano come il gamma si distribuisce nel tempo e tra le scadenze:

- **GEX Heatmap Timeseries** - il gamma netto dei dealer per strike durante la sessione, arancione per il positivo e blu per il negativo, con le candele del prezzo e il gamma flip disegnati sopra. È lo stesso grafico della pagina autonoma GEX Heatmap.
- **GEX Heatmap · Strike × DTE** - il gamma netto dei dealer per gli strike con più gamma nella settimana successiva (righe, lo strike più alto in cima) rispetto ai giorni alla scadenza (colonne, fino a 7DTE). Il verde è positivo, il rosso negativo, e più intenso significa più grande. Una corona segna il **GEX King** - lo strike con il maggior gamma netto dei dealer su quelle scadenze vicine.

Utile per:

- Individuare il **comportamento di pin sugli 0DTE** isolato dal book più ampio.
- Capire se un wall è concentrato sulla scadenza più vicina (transitorio) o distribuito su quelle successive (più persistente).

Le heatmap si aggiornano durante la sessione man mano che spot, tempo e IV spostano il gamma modellato - osservarne il movimento è informativo.

## Il resto della pagina

- **Charm & Vanna Flows** - vanna e charm aggregati sulla catena, una stima del charm di fine giornata per la pressione di hedging verso la chiusura e una lettura del rischio di espansione della volatilità.
- **Volatility Surface** - la volatilità implicita per strike per le scadenze vicine rispetto a quelle più lontane.
- **GEX Metrics Snapshot** - la tabella strike per strike: net GEX, vanna, charm, open interest e volume, centrata sullo spot con il flip e i wall evidenziati. Filtrala per scadenza; il selettore **Strikes** nasconde gli strike senza open interest.

## Leggere il dealer positioning in tre passi

1. **Dove si trova lo spot rispetto al flip?** Sopra ⇒ tendenza modellata alla stabilizzazione; sotto ⇒ tendenza modellata all'amplificazione.
2. **Dove sono i wall?** Il call wall è la tua frizione al rialzo; il put wall è la tua frizione al ribasso.
3. **Come si sposta la heatmap?** Se il call wall sale, lo strike del call wall modellato (dove il gamma lato call raggiunge il picco) si alza man mano che spot, gamma, tempo e IV cambiano - un'inclinazione strutturale rialzista. Il wall può muoversi senza nuovo open interest: segue il punto in cui culmina l'esposizione modellata, non un OI intraday verificato.

## Perché il calcolo del gamma flip di ZeroGEX è diverso

Il flip è calcolato a partire da un **profilo del gamma dei dealer a spot shiftato** - non da un'approssimazione basata sul Net GEX cumulativo. Per la metodologia e il confronto prima/dopo, vedi [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Letture comuni

- **Spot ben sopra il flip, call wall vicino sopra** ⇒ pin verso la chiusura, fade delle estensioni.
- **Spot sotto il flip, put wall vicino sotto** ⇒ bias trend; ci si aspetta amplificazione in caso di rottura.
- **Spot vicino al flip con volatilità in salita** ⇒ rischio di cambio di regime; ridurre la size o attendere.
- **Concentrazione della heatmap sugli strike call 0DTE vicino allo spot** ⇒ pressione di pin verso la chiusura.

## Vedi anche

- [GEX Summary](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
