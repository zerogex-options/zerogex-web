# Advanced Signal Dashboard

*I segnali event-driven — cosa chiede ciascuno, quando scatta e come usarlo.*

---

## Cos'è l'Advanced Signal Dashboard

L'Advanced Signal Dashboard è la **griglia di trigger** per tutti e otto i segnali Advanced. Ogni scheda mostra il punteggio su [-1, +1], lo stato del trigger (idle, hot, appena scattato) e uno sparkline.

I segnali Advanced sono **event-driven**. Ognuno produce un punteggio continuo, ma il momento interessante è quando il punteggio attraversa la soglia di trigger del segnale.

## Gli otto segnali

| Segnale | Chiede | Bias di trading | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | "La chiusura si sta fissando (pinning)?" | Direzionale | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | "I livelli chiave si stanno sovrapponendo qui?" | Mean-rev (long gamma) / Continuation (short gamma) | abs(score) ≥ 0.20 |
| Market Pressure Index | "Il mercato è carico per muoversi?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | "Questo range sta per rompersi?" | Cambio di regime / playbook | imminence ≥ 65 |
| Squeeze Setup | "Il mercato è compresso a molla?" | Continuation | abs(score) ≥ 0.25 |
| Trap Detection | "Questo breakout è appena fallito?" | Mean-reversion (vs. rottura di prezzo) | abs(score) ≥ 0.25 |
| Volatility Expansion | "La volatilità sta per esplodere?" | Continuation | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | "I trader 0DTE stanno pendendo da un lato?" | Direzionale | abs(score) ≥ 0.25 |

## Lettura rapida di ciascuno

### EOD Pressure

Attivo negli ultimi 90 minuti. Sale a partire dalle 14:30 ET, con picco intorno alle 15:45 ET. Costruito su dealer charm allo spot, pin gravity, volatilità realizzata e flag di witching. Legge "la chiusura viene fissata su X" con una direzione.

### Gamma/VWAP Confluence

Sovrappone gamma flip, VWAP, max pain, strike a max gamma e call wall. Chiede se questi livelli sono allineati su un prezzo. In gamma positivo, le letture di confluenza sono fade; in gamma negativo, sono letture di continuation.

### Market Pressure Index

La lettura complessiva "il mercato è carico". Combina wall pinch, prossimità al flip, regime, vanna/charm, il DNI, lo skew tra flow premium e smart money, l'IV rank e la compressione della volatilità realizzata. Bidimensionale: un **loading da 0 a 100** e una **direzione da -1 a +1**.

### Range Break Imminence

Lettura di compressione a 20 barre. Skew delta + dealer delta + trap pressure + rapporto di compressione a 10/60 barre. Produce sia un punteggio sia un'imminence da 0 a 100. Scatta a imminence ≥ 65 — il che significa che il range è realmente stretto rispetto alla sua storia recente.

### Squeeze Setup

Rilevatore di setup multi-day. Z-score del flow, momentum a 5/10 barre, prontezza del gamma, distanza dal flip, regime del VIX. Bias di continuation — legge "il mercato è compresso a molla, la prossima gamba è X".

### Trap Detection

Il rilevatore di breakout falliti. Wall (attuali + precedenti), VWAP, flip, net GEX e ΔGEX, delta del flow. Bias di mean-reversion — scatta quando una rottura sopra il call wall o sotto il put wall torna indietro di scatto.

### Volatility Expansion

Finestra di momentum a 5 barre scalata dalla volatilità realizzata. Net GEX + z-score del momentum normalizzato per la vol + volatilità realizzata. Chiede se la vol sta per espandersi. Lettura di continuation.

### 0DTE Position Imbalance

Lettura sulla finestra 0DTE. Ponderata per le ore alla chiusura. Squilibrio del flow call/put, rapporto C/P dello smart money, PCR, bucket di moneyness. Indica da che parte stanno pendendo oggi i trader 0DTE.

## Come funzionano i trigger

Quando il trigger di un segnale scatta:

1. La scheda del segnale sul dashboard si illumina nella direzione del punteggio.
2. Una voce compare nel [Live Bulletin](/help/platform/live-bulletin) con il punteggio, la soglia di trigger e un contesto di una riga.
3. Il composite riflette la convinzione più alta.

Un segnale può rimanere in stato "hot" per più barre. La voce del bulletin mostra il **primo** attraversamento del trigger; le barre successive nello stesso stato hot vengono aggregate.

## Leggere il dashboard

Due pattern:

1. **Cerca i trigger attivi.** Le schede hot risalgono in cima nel layout predefinito.
2. **Cerca i trigger sovrapposti.** Due o più segnali Advanced che scattano nella stessa direzione rappresentano la lettura a più alta confluenza sulla piattaforma. Aggiungi il composite per la lettura strutturale.

## Ogni scheda ha una pagina di approfondimento

Cliccando su una scheda si accede alla pagina dedicata del singolo segnale, con lo sparkline del punteggio, gli input, la cronologia dei trigger e la spiegazione "Come è costruito".

## Importante: il bias di trading conta

Alcuni segnali Advanced sono di continuation, altri di mean-reversion. Trap Detection che scatta positivo **non** significa "vai long" — significa "fai fade del breakout fallito al ribasso". Controlla sempre il chip del bias di trading sulla scheda.

## Vedi anche

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
