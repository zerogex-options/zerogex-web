# Leggere la linea del punteggio [-1, +1]

*Ogni punteggio di segnale vive sulla stessa linea numerica. Cosa significano segno e ampiezza, quando uno 0 è una non-risposta, e quando è il momento di agire.*

---

## Perché la linea del punteggio è fissa

Ogni segnale ZeroGEX — Advanced o Basic — restituisce la sua lettura sulla stessa scala **[-1, +1]**. Il vantaggio è evidente: la confluenza tra segnali diversi diventa un confronto equo. Un +0.5 su Squeeze Setup e un +0.5 su EOD Pressure esprimono concettualmente livelli di confidenza simili.

Il costo: ogni segnale ha un **bias di trade** diverso, quindi il significato di un +0.5 dipende da quale segnale lo ha generato.

## Segno

Per i segnali direzionali, il segno mappa la direzione di prezzo attesa:

- **Positivo ⇒ inclinazione rialzista** (il bias di trade è long)
- **Negativo ⇒ inclinazione ribassista**

Per i segnali mean-reversion (Positioning Trap, Trap Detection in alcune configurazioni), il segno indica la **direzione del movimento da fadare**:

- **Positivo ⇒ il movimento al rialzo è fuori posizione / fallito** (fade al ribasso)
- **Negativo ⇒ il movimento al ribasso è fuori posizione / fallito** (fade al rialzo)

La scheda del segnale su ogni pagina dichiara quale interpretazione si applica. Leggi il chip del bias di trade prima di leggere il punteggio.

## Ampiezza

Più ci si avvicina a ±1, maggiore è la convinzione. Guida pratica:

| Intervallo | Lettura |
| --- | --- |
| 0.0 – 0.2 | Dentro il rumore. Nessuna lettura azionabile. |
| 0.2 – 0.4 | Inclinazione debole. Filtro, non trigger. |
| 0.4 – 0.6 | Lettura solida. Combinata con la confluenza, tradabile. |
| 0.6 – 0.8 | Lettura forte. Il segnale sta esprimendo un'affermazione reale. |
| 0.8 – 1.0 | Massima convinzione. Raro. Prestare attenzione. |

## Un punteggio di 0 non è quasi mai neutrale

Questo è il punto più frainteso riguardo ai punteggi dei segnali.

Un punteggio di 0 tipicamente significa:

- I dati sono **insufficienti** per la domanda che questo segnale pone.
- La domanda non si applica in questo momento (ad esempio, EOD Pressure durante l'apertura).
- Gli input si **cancellano in modo pulito** — ugualmente rialzisti e ribassisti.

Ognuno di questi casi è una "non-lettura", non un "mercato neutrale". Un mercato strutturalmente neutrale di solito si manifesta con punteggi che oscillano intorno a ±0.1 — non uno zero netto.

Quando vedi un vero 0, passa il mouse sulla scheda del segnale. Il tooltip spiega il perché.

## Trigger vs. punteggi

Alcuni segnali Advanced hanno uno stato aggiuntivo oltre al punteggio:

- Un **trigger** discreto (sì/no) che scatta quando il punteggio supera una soglia.
- Una metrica secondaria (loading 0–100 per Market Pressure, imminence 0–100 per Range Break) che condiziona il trigger indipendentemente dal punteggio.

Il punteggio è la **lettura**; il trigger è l'**evento**. Puoi usare il punteggio come filtro senza aspettare il trigger.

## Leggere lo sparkline

La pendenza conta quanto il livello.

- Un punteggio a +0.4 in trend **rialzista** è una lettura in sviluppo — il momentum è dalla sua parte.
- Un punteggio a +0.4 in trend **ribassista** da +0.7 è una lettura in affievolimento — il segnale aveva ragione prima, meno ora.
- Un punteggio che inverte segno in una finestra breve è volatilità, non convinzione. Aspetta che si stabilizzi.

## Quando agire

Una semplice regola pratica che ha retto alla prova dei fatti:

> Agisci sulla **confluenza**, non sui punteggi individuali.

Un singolo +0.7 su un segnale è interessante. Un +0.5 su tre segnali provenienti da dimensioni indipendenti (un segnale Basic, un segnale Advanced, il composito) è un trade.

## Cosa cambia se cambia il regime

Attraversando il gamma flip, l'**interpretazione** di alcuni punteggi cambia:

- Gamma/VWAP Confluence: long-gamma sopra il flip ⇒ mean-revert; short-gamma sotto il flip ⇒ continuazione.
- Trap Detection è più netto in gamma negativa.
- EOD Pressure pinna più forte in gamma positiva.

Le schede dei segnali tengono conto di questo — ma saperlo spiega perché lo stesso punteggio può significare cose diverse in giorni diversi.

## Vedi anche

- [Come funzionano i segnali end-to-end](/help/platform/signals-overview)
- [Punteggio composito](/help/platform/composite-score)
- [Segnali: spiegati](/guides/signals-explained)
