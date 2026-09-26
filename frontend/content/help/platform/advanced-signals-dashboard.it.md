# Advanced Signal Dashboard

*I segnali event-driven - cosa chiede ciascuno, quando scatta e come usarlo.*

---

## Cos'è l'Advanced Signal Dashboard

L'Advanced Signal Dashboard (Pro) è la **griglia di trigger** per tutti e otto i segnali Advanced. Una striscia in alto mostra gli otto punteggi. Sotto ci sono tre schede - **Signal Grid**, **Confluence Matrix** ed **Event Timelines**. Ogni scheda della griglia mostra il punteggio da -100 a +100, il livello a cui si attiva, uno stato *Triggered* o *Stand by*, uno sparkline e i **Context values** espandibili. EOD Pressure e 0DTE Position Imbalance mostrano *Inactive* finché la loro finestra oraria è chiusa.

I segnali Advanced sono **event-driven**. Ognuno produce un punteggio continuo e modellato - una lettura derivata, non una previsione garantita -, ma il momento interessante è quando il punteggio attraversa la soglia di trigger del segnale. Nessuno degli otto fa parte del Composite Score (MSI).

## Gli otto segnali

| Segnale | Chiede | Bias di trading | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | "La chiusura si sta fissando (pinning)?" | Direzionale | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | "I livelli chiave si stanno sovrapponendo qui?" | Mean-rev (long gamma) / Continuation (short gamma) | \|score\| ≥ 20 |
| Market Pressure Index | "Il mercato è carico per muoversi?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | "Questo range sta per rompersi?" | Cambio di regime / playbook | imminence ≥ 65 |
| Squeeze Setup | "Il mercato è compresso a molla?" | Continuation | \|score\| ≥ 25 |
| Trap Detection | "Questo breakout è appena fallito?" | Mean-reversion (vs. rottura di prezzo) | \|score\| ≥ 25 |
| Volatility Expansion | "La volatilità sta per esplodere?" | Continuation | \|score\| ≥ 25 |
| 0DTE Position Imbalance | "I trader 0DTE stanno pendendo da un lato?" | Direzionale | \|score\| ≥ 25 |

## Lettura rapida di ciascuno

### EOD Pressure

Attivo negli ultimi 90 minuti. Sale a partire dalle 14:30 ET, con picco intorno alle 15:45 ET. Costruito su dealer charm allo spot, pin gravity, volatilità realizzata e flag di witching. Legge "la chiusura *potrebbe* fissarsi verso X" con una direzione - un'inclinazione modellata, perché il pinning è probabilistico.

### Gamma/VWAP Confluence

Sovrappone gamma flip, VWAP, max pain, strike a max gamma e call wall. Chiede se questi livelli sono allineati su un prezzo. In gamma positivo, le letture di confluenza sono fade; in gamma negativo, sono letture di continuation.

### Market Pressure Index

La lettura complessiva "il mercato è carico". Combina wall pinch, prossimità al flip, regime, vanna/charm, il DNI, lo skew tra flow premium e smart money, l'IV rank e la compressione della volatilità realizzata. Bidimensionale: un **loading da 0 a 100** e una **direzione da -1 a +1**.

### Range Break Imminence

Lettura di compressione a 20 barre. Skew delta + dealer delta + trap pressure + rapporto di compressione a 10/60 barre. Produce sia un punteggio sia un'imminence da 0 a 100. Scatta a imminence ≥ 65 - l'inizio della fascia Break Watch (da 80 in su è Breakout Mode), dove la pagina consiglia di smettere di fare fade del range alla cieca.

### Squeeze Setup

Rilevatore di setup multi-day. Z-score del flow, momentum a 5/10 barre, prontezza del gamma, distanza dal flip, regime del VIX. Bias di continuation - una lettura derivata secondo cui il mercato *potrebbe* essere compresso verso X, non una prossima gamba garantita.

### Trap Detection

Il rilevatore di breakout falliti. Wall (attuali + precedenti), VWAP, flip, net GEX e ΔGEX, delta del flow. Bias di mean-reversion - segnala come probabile fallimento una rottura di un livello chiave (un wall, il VWAP, il gamma flip o lo strike a max gamma) quando i dealer sono modellati long gamma e il gamma si sta rafforzando; un wall che migra insieme alla rottura indebolisce la lettura. In gamma negativo resta a 0.

### Volatility Expansion

Finestra di momentum a 5 barre scalata dalla volatilità realizzata. Net GEX + z-score del momentum normalizzato per la vol + volatilità realizzata. Chiede se la vol sta per espandersi. Lettura di continuation.

### 0DTE Position Imbalance

Lettura sulla finestra 0DTE. Ponderata per le ore alla chiusura. Squilibrio del flow call/put, rapporto C/P dello smart money, PCR, bucket di moneyness. Indica da che parte stanno pendendo oggi i trader 0DTE.

## Come funzionano i trigger

Quando il trigger di un segnale scatta:

1. La sua scheda viene bordata e colorata nella direzione del punteggio, e il suo stato passa da *Stand by* a *Triggered*.
2. Il Composite Score non cambia - i segnali Advanced non fanno parte dell'MSI.

Non c'è alcun avviso né voce di registro: non ti viene inviato nulla e nel Bollettino live non arriva nulla. Una scheda resta *Triggered* finché il punteggio si mantiene oltre la sua soglia. Per vedere cosa è successo prima, apri la scheda **Event Timelines** o la pagina del segnale - la timeline traccia il punteggio delle ultime due sessioni con i cambi di direzione segnati.

## Leggere il dashboard

Due pattern:

1. **Cerca i trigger attivi.** Le schede scattate sono bordate e colorate nella griglia. Le schede mantengono un ordine fisso, quindi cerca il colore.
2. **Cerca i trigger sovrapposti.** Due o più segnali Advanced che scattano nella stessa direzione rappresentano la lettura a più alta confluenza sulla piattaforma. La scheda **Confluence Matrix** mostra quali coppie tendono a concordare. Aggiungi il composite per la lettura strutturale.

## Ogni scheda ha una pagina di approfondimento

Cliccando su una scheda si accede alla pagina dedicata del singolo segnale, con il punteggio e il suo storico, gli input, la spiegazione "How it's built" e la Event Timeline.

## Importante: il bias di trading conta

Alcuni segnali Advanced sono di continuation, altri di mean-reversion. Trap Detection fa fade di una *rottura di prezzo fallita*, non di un breakout: un punteggio **positivo** significa che è fallita una rottura al ribasso (il fade è al rialzo - compra il breakdown fallito), un punteggio **negativo** che è fallita una rottura al rialzo (il fade è al ribasso) - l'immagine speculare di un segnale di continuation come Squeeze Setup. Controlla sempre che tipo di segnale stai leggendo - [Signals: Explained](/guides/signals-explained) elenca il bias di trading di ogni segnale.

## Vedi anche

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
