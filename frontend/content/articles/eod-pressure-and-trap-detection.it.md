# Trading in chiusura: come EOD Pressure e Trap Detection leggono in tempo reale l'hedging dei dealer

*Due ZeroGEX™ Advanced Signals costruiti per i punti di inflessione strutturale della giornata di trading — i flussi di hedging forzato che trascinano il prezzo verso la chiusura, e i breakout falliti che scattano indietro quando i dealer li assorbono.*

---

## Perché esistono questi due segnali

La maggior parte degli strumenti intraday ti dice *dove* si trova il prezzo. Raramente ti dicono *perché* sta per muoversi — o, più utilmente, *perché non dovrebbe muoversi ulteriormente*.

Gli ultimi 90 minuti della sessione cash e i momenti subito dopo la rottura di un livello chiave sono le due finestre in cui le dinamiche di hedging dei dealer sono più osservabili nel tape. EOD Pressure e Trap Detection sono progettati per attivarsi esattamente in quei punti di inflessione strutturale — e restare silenziosi per il resto della giornata.

Quel silenzio è una caratteristica, non un difetto. Entrambi i segnali leggeranno **zero** per la maggior parte della giornata di trading. Quando si attivano, ti stanno dicendo qualcosa di specifico su un flusso forzato che il resto del tape non ti mostrerà direttamente.

Questo articolo è pensato per trader che già comprendono il gamma exposure, l'hedging dei dealer e la differenza tra un regime positive-gamma e uno negative-gamma. Se questi termini sono nuovi per te, inizia dal nostro articolo di approfondimento **Decoding Gamma Exposure** e poi torna qui.

---

# Parte 1 — EOD Pressure

## Cosa misura

EOD Pressure è uno **stimatore di bias direzionale per gli ultimi ~90 minuti della sessione cash**. Cerca di rispondere a una domanda:

> Dato l'attuale book dei dealer e la vicinanza di uno strike magnete, in quale direzione l'hedging forzato *spinge* il prezzo verso la chiusura?

Due meccanismi fisici guidano la risposta:

**Decadimento del charm.** Man mano che le opzioni 0DTE e a breve scadenza si avvicinano alla scadenza, il loro delta non resta fermo — decade a un ritmo crescente col passare del tempo. I dealer che gestiscono un book delta-neutral devono ribilanciare continuamente per mantenere quella neutralità. Il segno aggregato dell'esposizione al charm dei dealer vicino allo spot ti dice in quale direzione stanno puntando quei flussi di hedging oggi.

**Gravità del pin.** In un regime positive-gamma, i dealer comprano la debolezza e vendono la forza — quel riflesso meccanico tira il prezzo verso lo strike di massimo dolore/massimo gamma come una calamita. In un regime negative-gamma, la stessa dinamica si ribalta: i dealer inseguono i movimenti, e lo strike diventa un punto di repulsione invece che un attrattore.

EOD Pressure combina questi due effetti, li scala in base a quanto siamo vicini alla chiusura, e li amplifica nelle date in cui il posizionamento conta di più.

---

## Interpretazione del punteggio

L'output è un punteggio continuo in **[−1.0, +1.0]**.

| Punteggio | Interpretazione per il trader |
|-------|----------------------|
| +0.6 – +1.0 | Forte deriva rialzista attesa verso la chiusura. Il magnete si trova sopra lo spot e i dealer sono costretti a comprare. |
| +0.2 – +0.6 | Lieve deriva rialzista. Il bias intraday resta long ma senza dimensionare aggressivamente. |
| −0.2 – +0.2 | Nessun vantaggio. O siamo troppo presto nella finestra, oppure i termini charm e pin si annullano a vicenda. |
| −0.2 – −0.6 | Lieve deriva ribassista. Bias short o chiudere i long. |
| −0.6 – −1.0 | Forte deriva ribassista attesa verso la chiusura. |

Il segnale si contrassegna come **attivato** quando il punteggio assoluto supera **0.2**. Tutto ciò che sta sotto viene registrato come contesto ma non farà scattare i pattern del playbook a valle.

---

## Come viene costruito il punteggio

EOD Pressure aggrega quattro componenti. Tre contribuiscono alla magnitudine; uno funge da cancello (gate).

### Componente 1: Charm allo spot

Questa è la misura più diretta del flusso di hedging forzato. Il segnale somma l'esposizione al charm dei dealer su una banda at-the-money, pesata per bucket di scadenza:

```
band_pct = max(0.5%, 1.5 × σ × √30)
charm_raw = Σ_buckets W_bucket × Σ_strikes_in_band dealer_charm_exposure
charm_score = clip(charm_raw / 2.0e7, [-1, +1])
```

La banda ATM è **scalata per volatilità** — più ampia nei giorni volatili, con un floor a ±0.5% nei giorni di tape morto. La proiezione a 30 barre traccia approssimativamente il range di prezzo atteso per il resto della sessione.

I pesi dei bucket di scadenza sono calibrati sulla fisica del charm:

| Bucket | Peso | Perché |
|--------|--------|-----|
| 0DTE | 0.70 | Il charm colpisce più forte il giorno della scadenza. Contributore dominante. |
| Settimanale | 0.20 | Rilevante ma secondario. |
| Mensile | 0.10 | Contributo di fondo. |
| LEAPS | 0.00 | Troppo lontano per contare per la chiusura di oggi. |

A ±$20M di charm bucketizzato dei dealer, il sub-score si blocca a ±1.0. Sotto quella soglia, la risposta è lineare.

### Componente 2: Gravità del pin

Il termine pin codifica la **spinta dipendente dal regime** dello strike magnete:

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

Un pin target dello 0.3% sopra lo spot in un regime positive-gamma dà un pin score di +1.0 — il magnete è sopra e la gravità è attiva.

L'inversione di segno in un regime negative-gamma è il dettaglio sottile ma cruciale. Lo stesso pin sopra lo spot in un book short-gamma produce un pin score *negativo*, perché i dealer sono costretti a *inseguire* i movimenti lontano dallo strike invece di tirare il prezzo verso di esso. La gravità del pin non è un livello fisso sul grafico — è una forza dipendente dal segno.

### Componente 3: Rampa temporale (Gate)

La rampa è un cancello moltiplicativo sull'intero segnale. Prima delle **14:30 ET**, è esattamente zero — e il segnale si interrompe in cortocircuito prima di calcolare qualsiasi altra cosa.

| Orario (ET) | Rampa |
|-----------|------|
| Prima delle 14:30 | 0.00 |
| 14:30 | 0.00 |
| 14:45 | 0.20 |
| 15:00 | 0.40 |
| 15:30 | 0.80 |
| 15:45 – 16:00 | 1.00 |

La rampa scala linearmente da 0 a 1 tra le 14:30 e le 15:45 ET, poi si mantiene a piena forza fino alla chiusura. Ecco perché il segnale legge zero per gran parte della giornata di trading — è strutturalmente inattivo.

### Componente 4: Amplificatore di calendario

L'amplificatore aumenta la convinzione nelle date in cui il posizionamento si concentra e i book dei dealer sono insolitamente esposti:

| Calendario | Amp |
|----------|-----|
| Giorno normale | 1.0× |
| OpEx mensile (terzo venerdì) | 1.5× |
| Quad witching (terzo venerdì di mar/giu/set/dic) | 2.0× |

L'amplificatore è l'unico punto del segnale in cui il punteggio intermedio può superare ±1 — il clamp finale lo riporta nel range.

---

## Mettendo tutto insieme

L'aggregazione finale:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

La ponderazione 60/40 riflette una visione ben precisa: **il charm è una misura diretta del flusso di hedging forzato**, mentre **la gravità del pin è una spinta indiretta e dipendente dal regime**. Entrambi contano. Il charm guida.

---

## Quando EOD Pressure restituisce zero

Una lettura a zero è lo stato più comune. Il segnale è *progettato* per essere silenzioso fuori dalla sua finestra.

- Fuori dalla finestra attiva (il caso dominante): la rampa temporale va in cortocircuito prima che qualsiasi altro componente venga calcolato.
- Nessuno strike dentro la banda ATM su una catena sparsa o poco quotata.
- Sia `max_pain` che `max_gamma_strike` sono nulli.
- Il pin target si trova esattamente sullo spot.
- I punteggi charm e pin si annullano esattamente — raro, richiede direzioni opposte e magnitudine uguale.

Se stai osservando il pannello alle 13:55 ET e legge zero, è corretto e atteso. Il segnale si popolerà alle 14:30 ET e salirà lungo la rampa fino alla chiusura.

---

# Parte 2 — Trap Detection

## Cosa misura

Trap Detection identifica setup in cui **il prezzo ha appena rotto oltre un livello chiave di posizionamento dei dealer ma è probabile che fallisca e inverta**.

Il pattern classico: in un regime long-gamma con posizionamento dei dealer in rafforzamento, i dealer assorbono i breakout. Vendono la salita e comprano la discesa — meccanicamente, non perché hanno una view. Il prezzo sbuca sopra la resistenza, incontra offerta, e scatta indietro nel range precedente. Il breakout era una trappola.

Il segnale cerca due setup simmetrici:

> **Bear trap su un fake al rialzo.** Il prezzo sbuca sopra un livello di resistenza — `call_wall`, `max_gamma_strike`, `vwap`, o `gamma_flip` — ma le condizioni strutturali indicano che il breakout fallirà. Produce un punteggio *negativo* (`bearish_fade`).

> **Bull trap su un fake al ribasso.** Il prezzo sbuca sotto il supporto — `put_wall`, `max_gamma_strike`, `vwap`, o `gamma_flip` — ma il breakdown sembra falso. Produce un punteggio *positivo* (`bullish_fade`).

Il segno dell'output codifica la direzione da *fadare*, non la direzione in cui il prezzo ha appena rotto.

---

## Interpretazione del punteggio

| Punteggio | Etichetta | Interpretazione per il trader |
|-------|-------|----------------------|
| +0.5 – +1.0 | `bullish_fade` | Bull-trap-fade ad alta convinzione. La rottura al ribasso è falsa — attesa uno scatto indietro verso l'alto. |
| +0.25 – +0.5 | `bullish_fade` (attivato) | Moderato. Considerare entrate long in mean-reversion. |
| 0 – +0.25 | sotto soglia | Convinzione debole; non azionabile da sola. |
| 0 | nessuno | Nessuna trappola in formazione. Lo stato di default. |
| 0 – −0.25 | sotto soglia | Convinzione debole. |
| −0.25 – −0.5 | `bearish_fade` (attivato) | Bear-trap-fade moderato. Fadare i long, attesa un'inversione al ribasso. |
| −0.5 – −1.0 | `bearish_fade` | Bear-trap-fade ad alta convinzione. Fadare i rally dentro il breakout. |

La soglia di attivazione qui è **0.25** — deliberatamente più severa dello 0.20 di EOD Pressure. I setup trap richiedono una convinzione più alta per attivarsi attivamente perché fare trading contro un breakout attivo comporta un rischio di coda più alto rispetto a seguire il flusso di fine giornata.

---

## Come viene costruito il punteggio

### Passo 1: Identificare il livello rotto

```
up_levels = [call_wall, max_gamma_strike, vwap, gamma_flip]
dn_levels = [put_wall, max_gamma_strike, vwap, gamma_flip]
broken_resistance = max(level for level in up_levels if level < close)
broken_support    = min(level for level in dn_levels if level > close)
```

Nota la denominazione. *Broken resistance* è il livello che il prezzo ha appena superato al rialzo — quindi ora si trova sotto la chiusura. *Broken support* è il livello sotto cui il prezzo è appena scivolato. I nomi riflettono la prospettiva post-breakout.

### Passo 2: Buffer di breakout scalato per volatilità

Un piccolo sbuco sopra un livello è rumore, non un breakout. Il segnale usa un buffer scalato per volatilità per filtrare:

```
σ           = realized_sigma(recent_closes, 60 bars)
buffer_pct  = max(0.1%, 0.15 × σ × √5)
```

Per SPX con una σ intraday tipica vicina agli 8 basis point al minuto, il buffer si posiziona intorno allo 0.1%. Nei giorni volatili si scala automaticamente verso l'alto. Il prezzo deve superare il livello di più del buffer prima che il segnale inizi a registrare forza.

### Passo 3: Fattori di forza continui

Un'iterazione precedente di questo segnale usava AND booleani e produceva un comportamento a scalino — precondizioni appena soddisfatte facevano scattare on/off il punteggio. Il design attuale usa **fattori continui [0, 1]** che si moltiplicano tra loro:

| Fattore | Punto di saturazione | Cosa cattura |
|--------|------------------|------------------|
| `long_gamma_factor` | Pieno a net_gex ≥ $1B | I dealer stanno strutturalmente assorbendo i movimenti? |
| `strengthening_factor` | Pieno a +2% di delta GEX | Il posizionamento dei dealer si sta *costruendo*, non smontando? |
| `breakout_strength` | Pieno a 3× buffer oltre il livello | Il prezzo ha effettivamente superato il livello in modo significativo? |
| `wall_migration` | 0.3× se il wall si è mosso >0.05% insieme al prezzo | Sconto se il livello stesso si sta muovendo — questo suggerisce un breakout reale. |

La forza direzionale su ciascun lato è il prodotto:

```
upside_strength   = breakout_strength_up   × long_gamma × strengthening × wall_up
downside_strength = breakout_strength_dn   × long_gamma × strengthening × wall_dn
```

Se uno qualsiasi di questi fattori va a zero, azzera l'intero lato. Regime negative-gamma? `long_gamma_factor = 0` — nessuna trappola. Gamma non in rafforzamento? `strengthening_factor = 0` — nessuna trappola. Il segnale ha una visione precisa su *quando* i fade funzionano e rifiuta di attivarsi fuori da quel regime.

### Passo 4: Termine di magnitudine

Un peso di base più bonus di distanza e accelerazione del gamma:

```
dist_strength = min(1, |distance_pct| / max(buffer_pct × 3, 0.3%))
gex_boost     = min(1, |net_gex_delta_pct| / 0.05)
magnitude     = 0.4 + 0.4 × dist_strength + 0.2 × gex_boost   // range: [0.4, 1.0]
```

Una trappola qualificante porta un peso minimo di 0.4 anche se si qualifica per un pelo. Breakout più ampi e un posizionamento dei dealer in accelerazione lo scalano verso 1.0.

### Passo 5: Moltiplicatore di flusso

Il termine flow separa i breakout *reali* da quelli *esausti*:

```
flow_mult = 1.1                                          if flow is decelerating
          = max(0.3, 1 − flow_delta / flow_norm)         otherwise
```

Un flusso direzionale in decelerazione dentro un breakout è esattamente la tesi della trappola — i compratori stanno facendo un passo indietro proprio mentre il prezzo supera il livello, lasciando il movimento senza supporto. Il segnale *aumenta* la convinzione del 10% in questo caso.

Al contrario, un flusso in accelerazione nella direzione del breakout significa che il movimento ha partecipanti reali dietro di sé. La tesi della trappola si indebolisce — il moltiplicatore si restringe verso 0.3.

### Passo 6: Aggregazione finale

```
bear_score = clip(magnitude × flow_mult × upside_strength,   [0, 1])
bull_score = clip(magnitude × flow_mult × downside_strength, [0, 1])
score      = clip(bull_score − bear_score, [-1, +1])
triggered  = abs(score) >= 0.25
```

Entrambi i punteggi di lato sono non negativi. La loro differenza codifica sia la direzione che la convinzione in modo continuo. Nel raro caso in cui il prezzo sia incastrato tra due livelli appena rotti, i due lati si annullano parzialmente — appropriato, perché il setup è genuinamente ambiguo.

---

## Quando Trap Detection restituisce zero

Per gran parte della giornata di trading, questo segnale legge zero. Le condizioni che lo azzerano sono esattamente le condizioni di cui dovresti essere consapevole:

- **Nessun livello viene rotto.** Il prezzo si trova tra `call_wall` e `put_wall` senza sbucare da nessuno dei due, oppure sta sbucando ma dentro il buffer scalato per volatilità. Lo stato di default di un mercato tranquillo.
- **Regime negative-gamma.** `long_gamma_factor = 0`. In un book short-gamma, i breakout corrono — non fanno fade. Il segnale rifiuta correttamente di attivarsi.
- **Gamma non in rafforzamento.** `strengthening_factor = 0`. I setup trap richiedono che il posizionamento dei dealer si stia costruendo, non smontando.
- **Livelli di riferimento mancanti.** Nessun dato per `call_wall`, `put_wall`, `max_gamma_strike`, `vwap`, o `gamma_flip` — niente da rompere.
- **Migrazione del wall sul lato attivo.** Se il call wall si muove verso l'alto insieme al prezzo, il fattore di sconto 0.3× spesso spinge il punteggio sotto la soglia di attivazione di 0.25.

Uno zero da Trap Detection è *informativo*. Ti dice che i prerequisiti per un trade di fade-the-breakout non sono presenti — quindi se stai per fare trading contro un breakout, il segnale ti sta implicitamente dicendo di cercare prove altrove.

---

# Leggere entrambi i segnali insieme

I due segnali sono progettati per essere letti congiuntamente. Coprono orizzonti temporali e regimi diversi, ma spesso si sovrappongono su setup ad alta convinzione verso la chiusura.

| EOD Pressure | Trap Detection | Cosa significa |
|--------------|----------------|---------------|
| +0.5 (rialzista) | +0.4 (`bullish_fade`) | Alta convinzione long-verso-la-chiusura. La deriva è al rialzo e l'attuale dip sembra falso. Fadare la debolezza intraday, attesa un giorno che chiude forte. |
| +0.5 (rialzista) | −0.4 (`bearish_fade`) | Misto ma tatticamente utile. EOD dice deriva al rialzo; trap dice che l'attuale breakout al rialzo è eccessivo. Attendere che il fade si completi, poi ricaricare long per la chiusura. |
| −0.5 (ribassista) | 0 | Setup ribassista più pulito. La deriva EOD è al ribasso senza un segnale di fade contrario. |
| 0 (spento) | +0.3 (`bullish_fade`) | Trade trap standalone pre-finestra. Tattico, non strategico. Size più piccola, stop più stretto. |
| 0 | 0 | Lo stato di default per gran parte della giornata di trading. Entrambi i segnali sono progettati per attivarsi solo in specifici punti di inflessione strutturale. |

---

## Costanti hardcoded da conoscere

Per i trader che eseguono i propri backtest o dimensionano trade rispetto a questi segnali, vale la pena tenere a mente alcuni numeri magici. Non sono arbitrari — ciascuno riflette una scelta di calibrazione empirica.

| Costante | Default | Dove viene usata |
|----------|---------|------------|
| Normalizzatore del charm | $20M | EOD Pressure — satura charm_score a ±1.0 |
| Saturazione del pin | 0.3% | EOD Pressure — satura pin_score a ±1.0 |
| Saturazione long-gamma | $1B net GEX | Trap Detection — `long_gamma_factor` pieno a questo livello |
| Saturazione strengthening | +2% delta GEX | Trap Detection — `strengthening_factor` pieno a questo livello |
| Saturazione GEX boost | ±5% delta GEX | Trap Detection — bonus di magnitudine pieno |
| Sensibilità migrazione wall | 0.05% | Trap Detection — trigger dello sconto wall-tracking-with-price |
| Floor del buffer di breakout | 0.1% | Trap Detection — filtro minimo del rumore |
| Inizio rampa temporale | 14:30 ET | EOD Pressure — attivazione più precoce |
| Rampa temporale piena | 15:45 ET | EOD Pressure — piena forza fino alla chiusura |

Tutti questi valori sono configurabili tramite variabili d'ambiente sul backend, ma i default riflettono ciò che ha funzionato su prodotti indice di classe SPX/SPY con catene 0DTE profonde e attive. Sottostanti meno liquidi potrebbero necessitare di soglie più basse.

---

## Note pratiche di trading

Alcuni pattern ricorrono abbastanza spesso da meritare una menzione diretta:

**L'inflessione delle 15:30.** EOD Pressure supera la rampa 0.8× alle 15:30 ET. Se i termini charm e pin sono stati concordi durante la finestra di rampa iniziale, la convinzione tende a consolidarsi intorno a quell'orario. Posizionarsi prima, non dopo.

**Il quad witching non è un contesto opzionale.** L'amplificatore 2.0× nei giorni di quad witching è abbastanza grande da spingere un segnale non amplificato di +0.4 fino a +0.8. Trattare quei giorni come aventi una convinzione strutturalmente più alta — e un rischio di whipsaw strutturalmente più alto prima nella giornata, prima che la finestra si apra.

**Trap Detection senza conferma long-gamma dovrebbe essere ignorato.** L'azzeramento dell'intero lato da parte di `long_gamma_factor` è il singolo guardrail più importante del segnale. Se il regime più ampio è short-gamma — anche se il punteggio risulta non-zero per un edge-case di dati mancanti — la tesi della trappola non regge. Verificare il regime.

**La decelerazione del flusso è il segnale di trap-fade più pulito.** Quando il flusso direzionale sta *prosciugandosi* dentro il breakout, il moltiplicatore di flusso aumenta la convinzione del 10%. Quello è il momento in cui la maggior parte dei trade trap-fade funzionano. Un flusso in accelerazione dentro il breakout significa partecipanti reali — la tesi della trappola è sbagliata anche se le altre condizioni sono allineate.

---

## Conclusione finale

> **EOD Pressure e Trap Detection sono silenziosi per gran parte della giornata. Questo è il punto.**

Non sono progettati per darti una lettura continua. Sono progettati per riconoscere i due momenti strutturali in cui le dinamiche di hedging dei dealer dominano il tape — la finestra di chiusura e il momento di breakout fallito — e quantificare il bias direzionale che ciascuno produce.

Per un trader tecnico serio, l'uso corretto non è "osservare il punteggio". È:

- **Conoscere il regime prima che i segnali contino.** Long-gamma o short-gamma. In rafforzamento o in smontaggio.
- **Fidarsi del silenzio.** Una lettura a zero fuori dalla finestra o fuori dal regime è informazione, non assenza di informazione.
- **Confermare all'inflessione.** Quando entrambi i segnali si attivano nella stessa direzione dentro la finestra EOD, la lettura strutturale è genuinamente forte. Quando sono in disaccordo, il disaccordo stesso è un dato.

L'hedging dei dealer non è tutto il mercato. Ma per gli ultimi 90 minuti della sessione cash — e per le brevi finestre in cui il prezzo testa i livelli di posizionamento dei dealer — è la forza dominante nel tape. Questi due segnali sono la lente.

---

## Prossimi passi

Se vuoi spingere oltre il framework, le estensioni naturali sono:

- Sovrapporre EOD Pressure alla deviazione VWAP intraday per individuare conflitti tra deriva e mean-reversion.
- Verificare incrociando il fattore `wall_migration` di Trap Detection con l'evoluzione della tua heatmap gamma — quando il wall si sta muovendo, la tesi della trappola è fragile.
- Tracciare la relazione tra il segno del charm allo spot e lo squilibrio del flusso 0DTE — dovrebbero generalmente concordare, e le divergenze sono diagnostiche.
- Nei giorni di OpEx e quad witching, studiare il setup pre-finestra: dove si trova il charm alle 13:00 ET, e come evolve fino all'attivazione delle 14:30?

L'obiettivo non è meccanizzare il trade — è sviluppare un'intuizione su *in quale tipo di regime di mercato ti trovi*, e poi lasciare che questi due segnali confermino o contraddicano le tue letture nei momenti in cui il flusso dei dealer è abbastanza forte da essere udibile.
