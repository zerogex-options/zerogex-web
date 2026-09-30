# Technicals

*Il quadro intraday del prezzo su cui poggia il book di opzioni - VWAP, opening range, picchi di volume e divergenza di momentum.*

---

## Cosa mostra questa pagina

La pagina Technicals è la **lettura price-first** del simbolo attivo. È l'unica pagina Metrics che legge il prezzo anziché la catena di opzioni - il VWAP, l'opening range, il volume insolito e il momentum confrontato con il flusso di opzioni.

È la pagina da aprire quando devi verificare cosa il posizionamento dei dealer implica rispetto a quello che il prezzo sta effettivamente facendo.

## VWAP Analysis

Quattro card - **Current Price**, **VWAP**, **Deviation** (quanto il prezzo dista dal VWAP, in percentuale) e **Position** (sopra o sotto) - e un grafico del prezzo rispetto al VWAP durante la sessione. Il canale ombreggiato tra i due si allarga man mano che il prezzo si allontana dal VWAP: verde quando il prezzo è sopra, rosso quando è sotto.

## Opening Range Breakout

L'opening range è il massimo e il minimo dei primi 30 minuti della sessione regolare (09:30-09:59 ET), fisso per il resto della giornata. Le card mostrano **ORB High** e **ORB Low** con la distanza da ciascuno, più l'**ORB Range**; **Position Within Range** mostra dove si trova il prezzo tra i due, e l'**ORB breakout map** traccia il prezzo rispetto a entrambe le linee.

## Unusual Volume Spikes

Le barre da 5 minuti che hanno scambiato almeno una deviazione standard sopra la propria media recente - etichettate Moderate, High o Extreme Spike -, disegnate rispetto al prezzo del sottostante. Ogni barra è colorata dal rosso (tutto volume in calo) al verde (tutto volume in rialzo) passando per il neutro. Passa il mouse su una barra per vederne il volume, il multiplo della media e la ripartizione della pressione in acquisto.

## Momentum Divergence Signals

Un elenco continuo, dal più recente, che confronta ogni movimento di prezzo di 5 minuti con il flusso di opzioni e con il volume in rialzo e in calo che lo accompagna: **Bearish Divergence** (il prezzo sale mentre si comprano put), **Bullish Divergence** (il prezzo scende mentre si comprano call), **Bullish** o **Bearish Confirmation** quando prezzo e flusso di opzioni concordano, e **Weak Rally** o **Weak Selloff** quando il volume va contro il movimento.

## Come leggerla

Tre pattern - i wall e il flip vengono da Dealer Positioning o dal Gamma Terminal:

1. **Prezzo tra il call wall e il put wall** in gamma positiva ⇒ l'hedging si oppone ai movimenti verso l'uno o l'altro wall, un contesto da mean reversion. I technicals confermano il range; la pagina dealer ne suggerisce il perché.
2. **Prezzo che rompe sotto il put wall** in gamma negativa con IV in espansione ⇒ la continuazione del trend *diventa più probabile*. I technicals mostrano la rottura; la pagina dealer spiega l'amplificazione modellata.
3. **VWAP e il gamma flip che si sovrappongono allo stesso livello** ⇒ un pivot strutturale da tenere d'occhio. Le reazioni lì *possono* avere una convinzione più alta rispetto a uno dei due preso singolarmente.

Per vedere flip, wall, max pain e VWAP disegnati direttamente sulle candele, usa il grafico del Gamma Terminal - vedi [Come leggere i grafici di ZeroGEX](/help/platform/reading-charts).

## Vedi anche

- [Lettura della Dashboard](/help/platform/dashboard)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Come leggere i grafici di ZeroGEX](/help/platform/reading-charts)
- [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip)
