# Cos'è il GEX nel trading? L'esposizione gamma spiegata in modo semplice

*GEX — l'esposizione gamma — è il numero che spiega perché alcuni giorni il prezzo resta inchiodato in un range stretto e altri partono in trend deciso. Questa è la versione in linguaggio semplice: cosa misura il GEX, perché muove il mercato e cosa significano i valori positivi e negativi per il tuo trading.*

---

## Cos'è il GEX nel trading?

**GEX sta per gamma exposure (esposizione gamma).** Nel trading, il GEX è una misura di quanto i dealer di opzioni che fanno mercato devono comprare o vendere il sottostante — meccanicamente, per restare hedgiati — man mano che il prezzo si muove. È un proxy del flusso di hedging *forzato* che sta sotto il mercato in ogni momento.

Questa è l'idea centrale in una frase: il GEX stima in quale direzione, e con quanta forza, i dealer devono operare per mantenere neutri i loro book quando il prezzo si muove. Quando questo flusso di hedging si oppone ai movimenti, il mercato è più "appiccicoso" e calmo. Quando invece va *nella stessa direzione* dei movimenti, il mercato diventa più veloce e i trend si rafforzano.

Tutto il resto — il gamma flip, i call wall, i put wall, il pinning — è solo una lettura più dettagliata della stessa forza. Questa è la versione semplice. Per il trattamento completo e approfondito, leggi la guida [Gamma Exposure (GEX) Explained: The Complete Guide](/education/gamma-exposure-explained).

---

## Cosa misura davvero il GEX?

I market maker che ti vendono opzioni non vogliono una scommessa direzionale — vogliono la commissione, non il rischio. Perciò si coprono (hedge). Il **gamma** è la Greca che indica quanto velocemente l'esposizione direzionale di un'opzione (delta) cambia man mano che il sottostante si muove. Poiché il gamma costringe i dealer a ri-hedgiare in continuazione, il gamma *aggregato* su tutta la catena di opzioni ti dice quanto ri-hedging il mercato deve fare.

Il GEX riassume tutto questo in un unico numero con segno — solitamente espresso in dollari di gamma, o "dollar gamma" — per un intero indice come lo S&P 500. Un valore assoluto più grande significa più hedging forzato sotto il mercato. Il **segno** ti dice in quale direzione spinge quell'hedging.

---

## GEX positivo vs. negativo (perché è importante)

Questa è la parte che cambia il modo in cui fai trading:

- **GEX positivo (regime long-gamma).** I dealer sono net long gamma. Per coprirsi, **vendono nei rally e comprano nei dip** — operando *contro* il movimento. Questo smorza la volatilità. Aspettati range più stretti, mean reversion e pinning vicino agli strike più pesanti. I breakout tendono a bloccarsi.
- **GEX negativo (regime short-gamma).** I dealer sono net short gamma. Ora **comprano nei rally e vendono nei dip** — operando *nella stessa direzione* del movimento. Questo amplifica la volatilità. Aspettati range più ampi, breakout che si estendono e trend che corrono. Questo è [cosa significa il gamma negativo](/education/what-is-negative-gamma) in pratica.

Stesso indice, stesso grafico — carattere del mercato opposto a seconda del segno del GEX. Sapere in quale regime ti trovi è la cosa più utile che il GEX può darti.

---

## Livelli chiave del GEX: il gamma flip, il call wall, il put wall

Il GEX non è solo un numero; corrisponde a livelli di prezzo specifici da tenere d'occhio:

- **Gamma flip** — il prezzo in cui il gamma totale dei dealer passa da positivo a negativo. Sopra questo livello, il mercato è di solito nel regime calmante long-gamma; sotto, nel regime amplificante short-gamma. È la linea di confine tra i regimi. Vedi [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).
- **Call wall** — lo strike con il maggiore gamma call sopra lo spot, che tende a limitare i rally in regime di gamma positivo.
- **Put wall** — lo strike con il maggiore gamma put sotto lo spot, che tende a sostenere i dip.

Il call wall e il put wall delineano il range che i dealer difendono; il gamma flip ti dice se lo difenderanno o lo sfonderanno. [Gamma Walls Explained](/education/gamma-walls-explained) approfondisce entrambi i wall.

---

## Come i trader usano il GEX

Non fai trading sul GEX direttamente — lo usi come un **filtro** che stabilisce la strategia prima ancora di guardare qualsiasi altra cosa:

1. **Controlla il regime.** GEX positivo → favorisci fade, mean reversion e range trading. GEX negativo → favorisci momentum e breakout, e rispetta gli stop.
2. **Segna i livelli.** Annota il gamma flip, il call wall e il put wall come mappa strutturale per la sessione.
3. **Tieni d'occhio il flip.** Un movimento attraverso il gamma flip è un cambio di strategia, non solo un tick di prezzo — l'intero carattere del mercato può cambiare.

Il GEX non ti dirà *cosa* succederà dopo. Ti dice in che *tipo* di giornata ti trovi probabilmente, così smetti di applicare una strategia di mean reversion in una giornata di trend.

---

## Dove vedere il GEX di persona

Non devi calcolare a mano il gamma dei dealer. ZeroGEX pubblica il Net GEX odierno, il gamma flip, il call wall e il put wall — gratis e con un ritardo di circa 15 minuti — per [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) e [QQQ](/qqq-gamma-levels). Per la lettura in tempo reale, sub-secondo, con il profilo gamma completo, la heatmap strike-per-DTE e il composito a 13 segnali, apri la [dashboard GEX 0DTE in tempo reale](/real-time-gex-0dte).

---

## Da ricordare

> Il GEX — l'esposizione gamma — è una lettura dell'hedging forzato dei dealer sotto il mercato. Il GEX positivo smorza i movimenti; il GEX negativo li amplifica. Capisci prima di tutto il segno giusto, e il resto del mercato inizierà ad avere senso.

Solo contenuto educativo — nulla di quanto sopra è una raccomandazione di trading.

---

Vuoi vederlo in tempo reale? Controlla la lettura GEX di oggi sulle pagine gratuite dei livelli gamma di [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) e [QQQ](/qqq-gamma-levels), poi approfondisci con la [guida completa al GEX](/education/gamma-exposure-explained) oppure apri la [dashboard GEX 0DTE in tempo reale](/real-time-gex-0dte).
