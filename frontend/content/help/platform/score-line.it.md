# Leggere la linea del punteggio da -100 a +100

*Ogni punteggio di segnale vive sulla stessa linea numerica. Cosa significano segno e ampiezza, quando uno 0 è una non-risposta, e quando è il momento di agire.*

---

## Perché la linea del punteggio è fissa

Ogni segnale ZeroGEX - Advanced o Basic - restituisce la sua lettura sulla stessa scala **da -100 a +100**. (Internamente ogni segnale calcola un valore tra -1 e +1; l'app lo mostra moltiplicato per 100.) Il vantaggio è evidente: la confluenza tra segnali diversi diventa un confronto equo. Un +50 su Squeeze Setup e un +50 su EOD Pressure esprimono concettualmente livelli di confidenza simili.

Il costo: ogni segnale ha un **bias di trade** diverso, quindi il significato di un +50 dipende da quale segnale lo ha generato.

L'unico numero principale che non sta su questa linea è il Composite Score (MSI): un gauge di regime 0-100 in cui 50 è neutrale. Vedi [Punteggio composito](/help/platform/composite-score).

## Segno

Per i segnali direzionali, il segno mappa la direzione di prezzo attesa:

- **Positivo ⇒ inclinazione rialzista** (il bias di trade è long)
- **Negativo ⇒ inclinazione ribassista**

Per i segnali mean-reversion (Positioning Trap, Trap Detection), il segno indica l'**inclinazione direzionale risolta** - il trade opera *contro* la folla fuori posizione o la rottura fallita, quindi il segno punta nello stesso verso dei segnali direzionali qui sopra:

- **Positivo ⇒ inclinazione rialzista** - ad es. una folla short/ribassista a rischio di essere spinta al rialzo in uno squeeze, o una rottura al ribasso fallita che compreresti
- **Negativo ⇒ inclinazione ribassista** - ad es. una folla long/rialzista a rischio di essere spazzata al ribasso, o una rottura al rialzo fallita che venderesti

Prima di leggere il punteggio, sappi che tipo di segnale stai leggendo. Il tooltip ⓘ e il pannello "How it's built" di ogni pagina di segnale spiegano cosa significa il suo segno, e [Segnali: spiegati](/guides/signals-explained) elenca il bias di trade di ogni segnale.

## Ampiezza

Più ci si avvicina a ±100, maggiore è la convinzione. Una guida pratica, basata sulle soglie e sulle etichette usate dalle pagine dei segnali:

| Punteggio (qualsiasi segno) | Lettura |
| --- | --- |
| 0 - 25 | Sotto la linea di attivazione della maggior parte dei segnali. Le pagine lo etichettano come bilanciato, piatto, neutrale o "no edge". Nessuna lettura azionabile da sola. |
| 25 - 50 | Un'inclinazione in formazione. La maggior parte delle schede si attiva a ±25; EOD Pressure e Gamma/VWAP Confluence scattano un po' prima, a ±20. Filtro, o trigger con confluenza. |
| 50 - 70 | Lettura forte. Diverse pagine di segnali passano alla loro etichetta più forte a ±50 o ±60 - Positioning Trap, ad esempio, la chiama un setup di squeeze o di flush. |
| 70 - 100 | La parte alta della scala. EOD Pressure e Volatility Expansion riservano le loro etichette più forti a ±70 e oltre. Raro. Prestare attenzione. |

Ogni pagina di segnale mostra anche una propria lettura in una riga del punteggio attuale. Dove la pagina e questa tabella non coincidono, vale la pagina. Range Break Imminence e Market Pressure Index non scattano affatto sul punteggio - vedi Trigger vs. punteggi più sotto.

## Un punteggio di 0 non è quasi mai neutrale

Questo è il punto più frainteso riguardo ai punteggi dei segnali.

Un punteggio di 0 tipicamente significa:

- I dati sono **insufficienti** per la domanda che questo segnale pone.
- La domanda non si applica in questo momento (ad esempio, EOD Pressure prima che la sua finestra si apra alle 14:30 ET).
- Gli input si **cancellano in modo pulito** - ugualmente rialzisti e ribassisti.

Ognuno di questi casi è una "non-lettura", non un "mercato neutrale". Un mercato strutturalmente neutrale di solito si manifesta con punteggi che oscillano intorno a ±10 - non uno zero netto.

I segnali Basic mostrano raramente un vero 0: quando a uno mancano i dati principali, il motore mostra al suo posto una piccola inclinazione ricavata dal regime, entro ±10. Tratta quindi anche un punteggio Basic a una sola cifra come una "non-lettura".

Quando vedi un vero 0, controlla la scheda e la pagina del segnale. Le schede di EOD Pressure e 0DTE Position Imbalance mostrano *Inactive* finché la loro finestra è chiusa, e in molte pagine di segnali il pannello "How it's built" spiega cosa significa uno 0 per quel segnale.

## Trigger vs. punteggi

I segnali Advanced hanno uno stato aggiuntivo oltre al punteggio:

- Un **trigger** che scatta quando il punteggio supera una soglia - ±25 per la maggior parte, ±20 per EOD Pressure e Gamma/VWAP Confluence. La scheda mostra *Triggered* o *Stand by*.
- Una metrica secondaria (loading 0-100 per Market Pressure Index, imminence 0-100 per Range Break Imminence) che determina il trigger al posto del punteggio: Market Pressure Index scatta con loading ≥ 50 e una direzione chiara, Range Break Imminence con imminence ≥ 65.

Il punteggio è la **lettura**; il trigger è l'**evento**. Puoi usare il punteggio come filtro senza aspettare il trigger.

Anche le schede dei segnali Basic vengono evidenziate e marcate *Triggered* oltre ±25, ma per i segnali Basic questo sottolinea solo una lettura forte - dietro non c'è alcuna regola di trigger.

## Leggere lo sparkline

La pendenza conta quanto il livello. Ogni scheda delle dashboard ha uno sparkline; nella pagina di un segnale, apri **Expand score history**.

- Un punteggio a +40 in trend **rialzista** è una lettura in sviluppo - il momentum è dalla sua parte.
- Un punteggio a +40 in trend **ribassista** da +70 è una lettura in affievolimento - il segnale aveva ragione prima, meno ora.
- Un punteggio che inverte segno in una finestra breve è volatilità, non convinzione. Aspetta che si stabilizzi.

## Quando agire

Una semplice regola pratica che ha retto alla prova dei fatti:

> Agisci sulla **confluenza**, non sui punteggi individuali.

Un singolo +70 su un segnale è interessante. Un +50 su tre segnali provenienti da dimensioni indipendenti (ad esempio, due segnali Basic e un segnale Advanced) è un trade. Il composito non fa parte di quel conteggio - è un gauge di regime 0-100, non un punteggio direzionale da -100 a +100, quindi non leggere il suo livello come rialzo/ribasso.

## Cosa cambia se cambia il regime

Attraversando il gamma flip, l'**interpretazione** di alcuni punteggi cambia:

- Gamma/VWAP Confluence: long-gamma sopra il flip ⇒ mean-revert; short-gamma sotto il flip ⇒ continuazione.
- GEX Gradient si inverte con il regime: in short gamma, molto gamma sopra lo spot dà un punteggio rialzista; in long gamma vale lo stesso per molto gamma sotto lo spot, e la lettura viene smorzata.
- Trap Detection scatta solo quando i dealer sono modellati long gamma - in gamma negativa resta a 0.
- EOD Pressure tira verso il pin in gamma positiva; in gamma negativa segue invece il movimento recente.

Le schede dei segnali tengono conto di questo - ma saperlo spiega perché lo stesso punteggio può significare cose diverse in giorni diversi.

## Vedi anche

- [Come funzionano i segnali end-to-end](/help/platform/signals-overview)
- [Punteggio composito](/help/platform/composite-score)
- [Segnali: spiegati](/guides/signals-explained)
