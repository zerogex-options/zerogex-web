# Come funzionano i Signals, dall'inizio alla fine

*Il modello completo dei signal — Advanced vs. Basic, come si combinano i punteggi, cosa mostrano le card e come usare tutto questo.*

---

## Le due famiglie

ZeroGEX gestisce **due famiglie** di signal. Il loro comportamento è diverso, ed è voluto.

- I **signal Advanced** pongono una domanda precisa e situazionale — *"la chiusura si sta bloccando su un livello?"*, *"questo breakout è appena fallito?"*. Ognuno produce un punteggio sulla linea **[-1, +1]** **e** un **trigger** discreto: quando il punteggio supera la soglia del signal, scatta un alert e può abilitare un playbook. Sono event-driven.
- I **signal Basic** sono continui. Non scattano — alimentano invece il **composito MSI** con un peso fisso, spostando la lettura combinata verso l'alto o verso il basso a ogni aggiornamento. Li vedi come input al quadro d'insieme, non come alert autonomi.

Questa è la distinzione più importante. Interiorizzala prima di leggere le pagine dei singoli signal.

## La linea del punteggio

Ogni signal di ZeroGEX — Advanced o Basic — vive sulla stessa linea numerica: **[-1, +1]**.

- Il **segno** indica la direzione. Positivo è rialzista; negativo è ribassista. Alcuni signal sono di mean-reversion (quindi un punteggio positivo significa "fai fade dei rialzi"); questi riportano un chip "trade bias" ben visibile sulla pagina.
- La **magnitudine** indica la convinzione. Più il punteggio si avvicina a ±1, più forte è la lettura.
- **Un punteggio 0 quasi non è mai neutro.** Per la maggior parte dei signal significa che i dati sono insufficienti o che questa domanda specifica non ha risposta al momento. Leggi uno 0 come "nessuna lettura", non come "nessun trade".

Vedi [Come leggere la linea del punteggio [-1, +1]](/help/platform/score-line) per l'approfondimento completo.

## Trigger (solo signal Advanced)

Ogni signal Advanced ha una soglia di trigger:

| Signal | Soglia del trigger |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

Quando il trigger di un signal scatta, succedono tre cose:

1. La card del signal sulla dashboard si illumina nella direzione in cui è scattata.
2. Viene registrata una voce nel [Live Bulletin](/help/platform/live-bulletin).
3. Il punteggio composito riflette la maggiore convinzione.

## Il composito (MSI)

Il Composite Score (Market Score Indicator, MSI) è la **lettura combinata di tutti i signal**. Ogni signal Basic contribuisce con un peso fisso; i signal Advanced contribuiscono quando il loro trigger è attivo.

Il composito si colloca sulla stessa linea [-1, +1]. Una lettura del composito sopra +0.4 con più signal che contribuiscono nella stessa direzione è una lettura ad alta confluenza. Un composito che oscilla vicino allo 0 con contributi contrastanti è, intenzionalmente, "nessuna lettura".

Vedi [Composite Score](/help/platform/composite-score) per l'analisi completa.

## Anatomia di una pagina signal

Ogni pagina signal su ZeroGEX ha la stessa anatomia. Una volta compresa, ogni signal si legge velocemente.

1. **Titolo + score hero** — il punteggio, lo stato del trigger e il timeframe.
2. **Chip trade-bias** — direzionale, mean-reversion, continuation, regime-switch.
3. **Pannello sparkline** — l'andamento del punteggio nella finestra più recente.
4. **Pannello degli input** — gli input principali che determinano il punteggio (ad es., per EOD Pressure: dealer charm, pin gravity, realized vol).
5. **"Come è costruito"** — spiegazione in linguaggio semplice della matematica sottostante.
6. **Trigger recenti** — il registro dei recenti scatti.

L'ordine è coerente in tutte le pagine.

## Categorie di trade bias

Ogni signal ha un trade bias dichiarato. È visibile sulla card e sulla pagina del signal.

- **Lettura direzionale** — il segno del punteggio corrisponde alla direzione di prezzo attesa.
- **Mean-reversion (vs. crowd)** — un punteggio positivo elevato significa "fai fade dei rialzi"; opera in direzione opposta al posizionamento della folla.
- **Mean-reversion (long gamma)** — fai fade dell'estensione verso la media quando i dealer sono long gamma.
- **Continuation** — il segno del punteggio corrisponde alla direzione della gamba successiva.
- **Cambio di regime / playbook** — il signal ti dice di cambiare strategia, non di aprire un trade.

Fai corrispondere il trade bias alla tua strategia. Un signal di continuation non è un fade.

## Come usare i signal

Tre schemi d'uso:

1. **Come filtro.** Non aprire posizioni long quando il composito è a -0.6. Non fare fade dei rally in gamma negativa.
2. **Come trigger.** Usa il trigger di un signal Advanced come segnale d'ingresso, con il tuo stop e il tuo target.
3. **Come confluenza.** Combina due o tre signal indipendenti (una lettura di regime Basic + un trigger Advanced + il chip trade bias della dashboard).

## Cosa non fanno i signal

- Non ti danno le uscite.
- Non dimensionano il tuo trade.
- Non conoscono la tua tolleranza al rischio.

Usali all'interno di un processo basato su regole, non come biglietti di trade autonomi.

## Vedi anche

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) — la matrice di riferimento completa
