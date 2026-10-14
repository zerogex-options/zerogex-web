# Technicals

*Il quadro intraday del prezzo su cui poggia il book di opzioni - VWAP, opening range, picchi di volume e divergenza di momentum, su un solo grafico con il flip e i wall.*

---

## Cosa mostra questa pagina

La pagina Technicals è la **lettura price-first** del simbolo attivo. È l'unica pagina Metrics che legge il prezzo anziché la catena di opzioni - il VWAP, l'opening range, il volume insolito e il momentum confrontato con il flusso di opzioni - e disegna tutto rispetto al gamma flip, ai wall e al pin.

È la pagina da aprire quando devi verificare cosa il posizionamento dei dealer implica rispetto a quello che il prezzo sta effettivamente facendo.

## La lettura della sessione

La riga in alto legge la sessione in un colpo d'occhio: **Price**, **VWAP** (e quanto il prezzo ne dista), dove si trova il prezzo nell'**Opening range**, **Dealer gamma** (gamma lunga o corta, e da che lato del flip si trova il prezzo) e i **Walls**, ciascuno con la sua distanza dal prezzo.

## Il grafico della sessione

Candele da 5 minuti della sessione, orari in ET, con:

- **VWAP** - la linea tratteggiata che attraversa le candele.
- **L'opening range** - la banda ombreggiata tra il massimo e il minimo di 09:30-09:59 ET. Il quinto superiore e quello inferiore, più chiari, sono la zona in cui lo stato indica "near the high" o "near the low".
- **Il flip, i wall e il pin** - gli stessi livelli della fascia Key Levels e del Gamma Terminal. Un livello troppo lontano dai prezzi della sessione per essere disegnato è segnalato da una freccia sul bordo dell'asse dei prezzi.
- **Volume** - sotto. Le barre almeno una deviazione standard sopra la propria media recente sono colorate a seconda che abbiano prevalso gli acquisti (verde) o le vendite (rosso); le altre sono grigie.
- **Marcatori numerati** - divergenze e rotture dell'opening range, numerate in ordine di tempo per corrispondere all'elenco degli eventi.

I pulsanti sopra il grafico attivano o disattivano ogni livello, e questo browser ricorda la tua scelta. Passa il mouse su una candela, o toccala sul telefono, per vederne apertura, massimo, minimo, chiusura, VWAP e volume.

## Opening range

Il massimo e il minimo dei primi 30 minuti della sessione regolare (09:30-09:59 ET), fissi per il resto della giornata, ciascuno con la sua distanza dal prezzo, l'ampiezza del range e il suo **stato**:

- **Above the range** / **Below the range** - l'ultima chiusura a 5 minuti è oltre il massimo o il minimo.
- **Near the high** / **Near the low** - dentro il range, nel suo quinto superiore o inferiore.
- **Inside** - i tre quinti centrali.

"Near" si misura rispetto al range stesso, quindi si adatta alla giornata anziché al prezzo. **Where price sits** disegna le stesse zone come una barra.

Il **registro delle rotture** elenca cosa ha fatto il prezzo attorno al range: test del massimo o del minimo (uno stoppino oltre, poi una chiusura di nuovo dentro), rotture (una chiusura oltre), il punto più lontano raggiunto in multipli del range e le chiusure di nuovo dentro, con la durata della rottura.

## Eventi

Un unico elenco, dal più recente:

- **Bearish divergence** - il prezzo sale in cinque minuti mentre il flusso di opzioni pende verso le put. **Bullish divergence** - il prezzo scende mentre pende verso le call.
- **Weak rally** / **Weak selloff** - il prezzo si è mosso mentre il volume in rialzo e in calo pendeva dalla parte opposta.
- **Volume spike** - una barra da 5 minuti almeno una deviazione standard sopra la sua media recente, con di quanto e se hanno prevalso gli acquisti o le vendite.
- **Eventi dell'opening range** dal registro delle rotture.

Le barre in cui prezzo e flusso di opzioni concordano (le conferme) sono escluse, perché sono il caso normale. La variazione a 5 minuti è nelle unità di prezzo del simbolo - punti su ES e NQ -, non in percentuale.

## Come leggerla

Tre pattern, tutti visibili sullo stesso grafico:

1. **Prezzo tra il call wall e il put wall** in gamma positiva ⇒ l'hedging si oppone ai movimenti verso l'uno o l'altro wall, un contesto da mean reversion. Le candele confermano il range; i livelli ne suggeriscono il perché.
2. **Prezzo che rompe sotto il put wall** in gamma negativa con IV in espansione ⇒ la continuazione del trend *diventa più probabile*. Le candele mostrano la rottura; il regime spiega l'amplificazione modellata.
3. **VWAP e il gamma flip che si sovrappongono allo stesso livello** ⇒ un pivot strutturale da tenere d'occhio. Le reazioni lì *possono* avere una convinzione più alta rispetto a uno dei due preso singolarmente.

Per il resto del quadro gamma accanto alle candele - le scale degli strike, i ribbon e il rewind - usa il Gamma Terminal; vedi [Come leggere i grafici di ZeroGEX](/help/platform/reading-charts).

## Vedi anche

- [Lettura della Dashboard](/help/platform/dashboard)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Come leggere i grafici di ZeroGEX](/help/platform/reading-charts)
- [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip)
