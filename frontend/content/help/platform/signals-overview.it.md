# Come funzionano i Signals, dall'inizio alla fine

*Il modello completo dei signal - Advanced vs. Basic, come si collegano al Composite Score e al Trade Bias, cosa mostrano le card e come usare tutto questo.*

---

## Le due famiglie

ZeroGEX gestisce **due famiglie** di signal. Il loro comportamento è diverso, ed è voluto.

- I **signal Advanced** (Pro) pongono una domanda precisa e situazionale - *"la chiusura si sta bloccando su un livello?"*, *"questo breakout è appena fallito?"*. Ognuno produce un punteggio sulla linea **da -100 a +100** **e** un **trigger** discreto: quando il punteggio supera la soglia del signal, la sua card passa da *Stand by* a *Triggered*, e il trigger può abilitare un playbook. Sono event-driven.
- I **signal Basic** (Basic e Pro) sono continui. Non scattano e **non hanno alcun peso nel Composite Score (MSI)** - sono letture consultive che lo affiancano. Il loro valore sta nell'accordo (convinzione) o nel disaccordo (divergenza): quando le letture di flusso divergono da quelle di struttura, spesso un cambio di regime è già in corso prima che l'MSI si muova.

Questa è la distinzione più importante. Interiorizzala prima di leggere le pagine dei singoli signal.

## La linea del punteggio

Ogni signal di ZeroGEX - Advanced o Basic - vive sulla stessa linea numerica: **da -100 a +100**.

- Il **segno** indica la direzione. Per la maggior parte dei signal positivo è rialzista e negativo è ribassista - ma alcuni sono di mean-reversion o comunque con segno invertito, quindi un punteggio positivo non significa sempre "vai long". Controlla il trade bias del signal (più sotto) prima di leggerne il segno.
- La **magnitudine** indica la convinzione. Più il punteggio si avvicina a ±100, più forte è la lettura.
- **Un punteggio 0 quasi non è mai neutro.** Per la maggior parte dei signal significa che i dati sono insufficienti o che questa domanda specifica non ha risposta al momento. Leggi uno 0 come "nessuna lettura", non come "nessun trade".

Vedi [Leggere la linea del punteggio da -100 a +100](/help/platform/score-line) per l'approfondimento completo.

## Trigger (solo signal Advanced)

Ogni signal Advanced ha una soglia di trigger:

| Signal | Soglia del trigger |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Quando il trigger di un signal scatta:

1. La sua card sull'Advanced Signal Dashboard viene bordata e colorata nella direzione in cui è scattata, e il suo stato passa da *Stand by* a *Triggered*.
2. Il Composite Score **non** si muove - i signal Advanced non fanno parte dell'MSI.

Non ti viene inviato nulla e nel Bollettino live non compare nulla. Per rivedere cosa ha fatto un signal, usa la sua Event Timeline - vedi [Avvisi sui segnali](/help/platform/alerts).

## Il composito (MSI)

Il Composite Score (Market State Index, MSI) è una lettura a sé, costruita da **sei componenti della struttura delle opzioni**: segno del net GEX, gamma anchor, put/call ratio, regime di volatilità, squilibrio dell'order flow smart-money e dealer delta pressure. I signal Basic e Advanced non sono tra i suoi input.

Il composito è un **punteggio di regime 0-100**, dove 50 è neutro - non un punto sulla linea da -100 a +100. Una lettura alta (≥ 70) indica un regime di trend / espansione in cui i trend possono correre; una lettura bassa (< 20) è la fascia Compression, in cui storicamente il prezzo ha percorso meno strada. Ti dice il regime, non la direzione - per vedere in che verso pende il flusso, leggi il Trade Bias.

Dove i signal si incontrano davvero:

- **Trade Bias** unisce l'MSI e diversi signal Basic e Advanced in una lettura del posizionamento dei dealer e della direzione in cui pende il flusso. Descrive; non prevede. La pagina completa è Pro; sulla Dashboard principale c'è una card compatta.
- **Signal Breadth**, sulla Dashboard principale, conta quanti signal pendono al rialzo, neutri o al ribasso.

Vedi [Composite Score](/help/platform/composite-score) per l'analisi completa.

## Anatomia di una pagina signal

Ogni pagina signal su ZeroGEX ha la stessa anatomia. Una volta compresa, ogni signal si legge velocemente.

1. **Titolo e domanda** - il nome del signal, la domanda che pone e un tooltip ⓘ con la versione breve di come funziona.
2. **Score hero** - il punteggio attuale da -100 a +100, una lettura in una riga e uno storico del punteggio espandibile.
3. **Pannelli degli input** - gli input principali che determinano il punteggio (ad es., per EOD Pressure: il time ramp, il pin target, il dealer charm allo spot e il regime di gamma).
4. **"How it's built"** - la matematica, in formule e brevi note.
5. **Event Timeline** - il percorso del punteggio nelle ultime due sessioni, con i cambi di direzione segnati e il movimento del sottostante nei 30, 60 o 120 minuti successivi.

L'ordine è coerente in tutte le pagine.

## Categorie di trade bias

Ogni signal ha un trade bias dichiarato; [Signals: Explained](/guides/signals-explained) li elenca tutti.

- **Lettura direzionale** - il segno del punteggio corrisponde alla direzione di prezzo attesa.
- **Mean-reversion (vs. crowd)** - il punteggio riflette il fade della folla, non del prezzo: un punteggio positivo segnala una folla inclinata ribassista che può squeezare *al rialzo*, un punteggio negativo una folla inclinata rialzista che può essere spazzata *al ribasso*.
- **Mean-reversion (long gamma)** - fai fade dell'estensione verso la media quando i dealer sono long gamma.
- **Continuation** - il segno del punteggio corrisponde alla direzione della gamba successiva.
- **Cambio di regime / playbook** - il signal ti dice di cambiare strategia, non di aprire un trade.

Fai corrispondere il trade bias alla tua strategia. Un signal di continuation non è un fade.

## Come usare i signal

Tre schemi d'uso:

1. **Come filtro.** Non aprire trade di trend/breakout quando l'MSI è basso (regime laterale). Non fare fade dei rally in gamma negativa.
2. **Come trigger.** Usa il trigger di un signal Advanced come segnale d'ingresso, con il tuo stop e il tuo target.
3. **Come confluenza.** Combina due o tre signal indipendenti (la lettura di un signal Basic + un trigger Advanced + la card Trade Bias della Dashboard principale).

## Cosa non fanno i signal

- Non ti danno le uscite.
- Non dimensionano il tuo trade.
- Non conoscono la tua tolleranza al rischio.

Usali all'interno di un processo basato su regole, non come biglietti di trade autonomi.

## Vedi anche

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) - la matrice di riferimento completa
