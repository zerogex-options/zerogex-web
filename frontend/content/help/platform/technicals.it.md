# Technicals

*Lo snapshot tecnico intraday — prezzo, candele, indicatori di volatilità e come i livelli si sovrappongono ai muri GEX.*

---

## Cosa mostra questa pagina

La pagina Technicals è la **lettura price-first** del simbolo attivo. È l'unica pagina che **non** parte dai numeri derivati dalle opzioni — parte dall'azione del prezzo, dalla volatilità e dal contesto tecnico standard.

È la pagina da aprire quando devi verificare cosa il posizionamento dei dealer implica rispetto a quello che il prezzo sta effettivamente facendo.

## Il grafico a candele

Il grafico principale. Candele OHLC standard con selettore del timeframe (1m / 5m / 15m / 1h / 1d). Overlay:

- **VWAP** (ancorato all'apertura della sessione).
- **Il gamma flip** come linea orizzontale.
- **Il call wall e il put wall** come linee orizzontali.
- **Max pain** come linea orizzontale (dove rilevante).

Lo scopo degli overlay è permetterti di leggere l'azione del prezzo attraverso la lente del posizionamento dei dealer senza dover cambiare scheda.

## Gli indicatori di volatilità

Tre indicatori:

- **Implied Volatility** — IV ATM attuale con il rank rispetto agli ultimi 60 giorni.
- **Realized Volatility** — volatilità realizzata su finestra breve con un baseline su finestra più lunga.
- **Rapporto IV / RV** — quando il rapporto è significativamente sopra 1, la vol è cara (vendere premio); sotto, la vol è economica (comprare premio).

## La striscia di sessione

Una piccola striscia che mostra:

- La sessione corrente (Pre-market, Open, After-hours, Closed)
- Il prezzo di apertura della sessione
- Il massimo e il minimo di sessione
- La distanza dallo spot al VWAP
- Il tempo al prossimo evento di sessione rilevante (apertura, pausa pranzo, chiusura)

## Come leggerla

Tre pattern:

1. **Prezzo bloccato tra il call wall e il put wall** in gamma positiva ⇒ mean-revert all'interno del range. I technicals confermano il range; la pagina dealer ti dice il perché.
2. **Prezzo che rompe sotto il put wall** in gamma negativa con IV in espansione ⇒ continuazione del trend. I technicals mostrano la rottura; la pagina dealer spiega l'amplificazione.
3. **VWAP e il gamma flip che si sovrappongono allo stesso livello** ⇒ pivot strutturale. Le reazioni a quel livello hanno una convinzione più alta rispetto a uno dei due presi singolarmente.

## La vista intraday-tools

La pagina intraday-tools è un layout abbinato — il grafico a candele sopra, un header compresso di posizionamento dealer sotto — per i trader che vogliono entrambe le viste affiancate.

## Vedi anche

- [Lettura della Dashboard](/help/platform/dashboard)
- [Posizionamento dei Dealer](/help/platform/dealer-positioning)
- [Come leggere un Gamma Flip](/education/how-to-read-a-gamma-flip)
