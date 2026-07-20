# Segnale EOD Pressure spiegato: leggere la chiusura

*L'approfondimento pratico sul segnale ZeroGEX EOD Pressure — cosa chiede, perché la chiusura ha una deriva strutturale, come il punteggio combina charm e pin gravity, e come leggerlo negli ultimi 90 minuti.*

---

## Perché questo segnale esiste

Gli ultimi 90 minuti della sessione cash sono strutturalmente diversi dal resto della giornata. Il decadimento del charm sulle posizioni 0DTE costringe i dealer a coprirsi in continuazione. La pin gravity attorno agli strike con gamma elevato si intensifica. Il book dei dealer è più vincolato che in qualsiasi altro momento della sessione.

Queste forze non sono casuali. Sono direzionali e leggibili — *se* sai cosa cercare. Il segnale EOD Pressure esiste per portare in superficie quella deriva direzionale in tempo reale, così i trader possono posizionarsi assecondando il flusso di chiusura invece di contrastarlo.

Questo articolo è la lettura orientata al trader del segnale EOD Pressure. Copre cosa misura, perché la chiusura è diversa, come viene costruito il punteggio a partire da charm e pin gravity, e come leggerlo all'interno della finestra. Per l'approfondimento sulla metodologia combinata che abbina EOD Pressure a Trap Detection, vedi [Trading the Close](/education/eod-pressure-and-trap-detection); per la meccanica sottostante, [Vanna and Charm Explained](/education/vanna-and-charm-explained) descrive nel dettaglio come il charm guida l'hedging forzato.

---

## Che cos'è il segnale EOD Pressure?

Il segnale EOD Pressure pone una sola domanda:

> Dato l'attuale book dei dealer e la vicinanza di uno strike magnete, in quale direzione l'hedging forzato spinge il prezzo verso la chiusura?

È un segnale **Advanced** nello stack ZeroGEX — produce sia un punteggio continuo sulla retta numerica [-1, +1] sia un trigger discreto quando il punteggio assoluto supera **0.20**. La soglia è deliberatamente più bassa rispetto ad altri segnali Advanced perché il contesto strutturale (la finestra di chiusura) è di per sé un filtro — quando EOD Pressure legge 0.15+ all'interno della finestra attiva, è già informativo dal punto di vista direzionale.

Bias di trading: **lettura direzionale**. Il segnale indica da che parte si sta inclinando la pressione — non prescrive di per sé se cavalcare o fadare il movimento. Questo dipende dal contesto di regime.

---

## Perché la chiusura è diversa

Tre meccanismi strutturali si sommano nella finestra finale della sessione:

1. **Il decadimento del charm accelera.** Man mano che le opzioni 0DTE si avvicinano alla scadenza, il loro delta si sposta in modo prevedibile verso 0 o 1. I dealer che gestiscono un book delta-neutrale devono ricoprirsi continuamente, e il ritmo di quella ricopertura *aumenta* man mano che si avvicina la chiusura.
2. **La pin gravity si intensifica.** Gli strike con gamma elevato attraggono il prezzo con più forza man mano che il tempo alla scadenza si riduce. In un regime di long gamma, il magnetismo verso lo strike pesante più vicino si rafforza nel corso del pomeriggio.
3. **La liquidità si assottiglia.** I flussi a blocchi, il ribilanciamento di fine giornata e gli ordini strutturali sugli indici spostano il profilo del flusso da continuo a intermittente. I dealer hanno meno margine per assorbire errori.

EOD Pressure combina i primi due elementi in una lettura direzionale. Il terzo è implicito nella calibrazione del punteggio.

---

## Le quattro componenti principali

Il segnale aggrega quattro componenti — tre contribuiscono alla magnitudine, una funge da gate rigido.

### Componente 1: Charm a spot

La misura più diretta del flusso di hedging forzato. Il segnale somma l'esposizione al charm dei dealer su una banda at-the-money scalata per volatilità, ponderata per bucket di scadenza:

| Bucket | Peso | Perché |
|---|---|---|
| 0DTE | 0.70 | Il charm colpisce più duramente nel giorno di scadenza. Contributo dominante. |
| Weekly | 0.20 | Rilevante ma secondario. |
| Monthly | 0.10 | Contributo di sfondo. |
| LEAPS | 0.00 | Troppo lontano per contare ai fini della chiusura odierna. |

L'aggregato è normalizzato in modo che ±$20M di charm dealer suddiviso per bucket saturi il sub-punteggio a ±1.0.

### Componente 2: Pin gravity

Il termine pin codifica l'attrazione, dipendente dal regime, dello strike magnete:

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

Uno strike pin dello 0.3% sopra lo spot in un regime a gamma positiva dà un pin score di +1.0 — il magnete è sopra e la gravità è attiva. In un regime a gamma negativa, lo stesso pin sopra lo spot produce un pin score *negativo*, perché l'hedging dei dealer ora amplifica i movimenti *in allontanamento* dallo strike.

Quel ribaltamento di segno è l'intuizione chiave. La pin gravity non è un livello fisso. È una forza il cui segno dipende dalla direzione del regime gamma.

### Componente 3: Rampa temporale (il gate)

La rampa è moltiplicativa. Prima delle **14:30 ET**, è esattamente zero — l'intero segnale va in cortocircuito.

| Orario (ET) | Rampa |
|---|---|
| Prima delle 14:30 | 0.00 |
| 14:30 | 0.00 |
| 14:45 | 0.20 |
| 15:00 | 0.40 |
| 15:30 | 0.80 |
| 15:45 – 16:00 | 1.00 |

Ecco perché EOD Pressure legge zero per la maggior parte della giornata di trading. Il segnale è strutturalmente inattivo fuori dalla finestra.

### Componente 4: Amplificatore di calendario

L'amplificatore aumenta la convinzione nelle date in cui il posizionamento si concentra:

| Calendario | Amp |
|---|---|
| Giorno normale | 1.0× |
| OPEX mensile (terzo venerdì) | 1.5× |
| Quad witching (terzo venerdì di mar/giu/set/dic) | 2.0× |

Questo è l'unico punto del segnale in cui il punteggio intermedio può superare ±1 — il clamp finale lo riporta nell'intervallo.

---

## Come viene calcolato il punteggio

L'aggregazione finale:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

La ponderazione 60/40 riflette una visione decisa: **il charm è la misura diretta del flusso di hedging forzato**, mentre **la pin gravity è l'attrazione indiretta, dipendente dal regime**. Entrambi contano. Il charm guida.

---

## Interpretazione del punteggio

| Punteggio | Lettura |
|---|---|
| +0.6 a +1.0 | Forte deriva al rialzo attesa verso la chiusura |
| +0.2 a +0.6 | Lieve deriva al rialzo — il bias intraday favorisce mantenere le posizioni long, ma senza aumentare le size in modo aggressivo |
| -0.2 a +0.2 | Nessun edge — o siamo troppo presto nella finestra, o i termini si annullano |
| -0.2 a -0.6 | Lieve deriva al ribasso |
| -0.6 a -1.0 | Forte deriva al ribasso attesa verso la chiusura |

La soglia di trigger è **0.20** — più bassa del tipico 0.25 — perché è la finestra stessa a fare il filtraggio.

---

## Quando il segnale scatta e quando resta silenzioso

Lo stato dominante è il **silenzio**. Per la maggior parte della giornata di trading, EOD Pressure è zero — e quello zero è *informativo*, non "neutro". Significa che la finestra attiva non è ancora iniziata.

Il segnale può leggere zero anche all'interno della finestra quando:

- Nessuno strike si trova all'interno della banda ATM scalata per volatilità su una catena sparsa o poco quotata.
- Sia `max_pain` che `max_gamma_strike` sono null.
- Il pin target si trova esattamente sullo spot.
- Charm score e pin score capitano ad annullarsi a vicenda — raro, richiede direzioni opposte e magnitudine grosso modo uguale.

Uno 0 fuori dalla finestra è normale. Uno 0 dentro la finestra è informativo — *oggi EOD Pressure non ha nulla da aggiungere.*

---

## Cosa ne fa un trader

Tre pattern operativi:

### 1. Preparazione prima della finestra

Prima delle 14:30 ET, EOD Pressure è zero per costruzione. Usa il tempo pre-finestra per individuare quale *sarà* il setup strutturale: dov'è il gamma massimo, dov'è il gamma flip, in che regime siamo, dov'è lo spot rispetto al pin target? Quando la finestra si apre, il segnale non ti sorprenderà — confermerà o smentirà la lettura che hai già costruito.

### 2. L'inflessione delle 15:30

EOD Pressure attraversa la rampa allo 0.8× alle 15:30 ET. Se i termini charm e pin sono stati concordi durante la prima parte della rampa (14:45–15:30), la convinzione tende a consolidarsi intorno alle 15:30. Preposizionati prima, non dopo.

### 3. Il quad witching è contesto strutturale

L'amplificatore 2.0× nei giorni di quad witching è abbastanza grande da spingere un segnale non amplificato di +0.4 fino a +0.8 amplificato. Considera quei giorni come dotati di una convinzione strutturalmente più alta — e di un rischio di whipsaw strutturalmente più alto nella parte iniziale della giornata, prima che la finestra si apra.

---

## Leggere EOD Pressure insieme ad altri segnali

EOD Pressure è una **lettura direzionale** — indica da che parte punta la pressione senza prescrivere di per sé se cavalcare o fadare il movimento. La decisione tra fade e ride arriva dal regime:

- **Regime a gamma positiva + punteggio EOD Pressure positivo:** la deriva è al rialzo, l'hedging dei dealer sta smorzando i movimenti, la lettura favorisce il fade dei rally verso lo strike magnete per intercettare la deriva verso il pin.
- **Regime a gamma negativa + punteggio EOD Pressure positivo:** il segnale sta leggendo un bias rialzista guidato dal charm, ma in un regime a gamma corta il riflesso dei dealer amplifica invece di assorbire — la continuazione del momentum è più probabile.

Combinato con altri segnali:

- **EOD Pressure + Trap Detection nella stessa direzione:** il setup ad alta convinzione più comune. La deriva EOD conferma un fade da breakout fallito.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) nella stessa direzione:** compresso verso la chiusura con deriva guidata dal charm a confermare. Setup di continuazione robusto.
- **EOD Pressure ≠ 0 dentro la finestra senza altri segnali attivi:** la deriva strutturale è l'unica lettura disponibile. Size più piccola, va trattata come un'inclinazione direzionale piuttosto che come un trade ad alta convinzione.

---

## Fraintendimenti comuni

Tre trappole:

- **Trattare uno zero pre-finestra come "nessun segnale oggi".** La finestra non si è ancora aperta. Il segnale è *strutturalmente inattivo*, non privo di informazione.
- **Ignorare il ribaltamento di segno legato al regime nella pin gravity.** Uno strike pesante sopra lo spot attrae *verso l'alto* in un regime long gamma e *respinge verso il basso* in un regime short gamma. Lo stesso livello sul grafico significa cose opposte nei due regimi.
- **Fare trading sul punteggio grezzo senza considerare la rampa.** Una lettura di +0.4 alle 14:45 (rampa 0.20) è in realtà un punteggio effettivo di +0.08. Leggi la magnitudine corretta per la rampa, non il punteggio grezzo in input.

---

## Come ZeroGEX mostra il segnale EOD Pressure

La dashboard lo mostra in diversi punti:

- **La card EOD Pressure** mostra il punteggio live, lo stato del trigger e la scomposizione per componente (contributi charm vs. pin).
- **Il Composite Signal Score** integra EOD Pressure come uno degli input.
- **Il Trade Stream** segnala i trade da playbook filtrati da `eod_pressure` quando scattano.

*[Segnaposto immagine: card ZeroGEX EOD Pressure con punteggio, componenti e stato della rampa durante la finestra attiva — inserire il file in /public/blog/zerogex-eod-pressure-card.png]*

Un esempio pratico. SPX è a 5.825 alle 15:15 ET in un venerdì di OPEX mensile e ZeroGEX mostra:

- **EOD Pressure:** -0.55 (trigger ribassista)
- **Net GEX:** +$1.2B (positivo)
- **Gamma Flip:** lo spot è a +15 (sopra il flip)
- **Max Pain:** 5.810 (sotto lo spot)
- **Charm a spot:** moderatamente negativo (vendite in accumulo)
- **Amp di calendario:** 1.5× (OPEX mensile)

La lettura strutturale: regime a gamma positiva con un magnete pesante 15 punti sotto lo spot, l'hedging guidato dal charm punta verso il basso, e l'amplificatore OPEX sta rafforzando la convinzione. Inclinazione operativa: la deriva verso 5.810 è il percorso a maggiore probabilità verso la chiusura. Il trade non è EOD Pressure in sé — è un posizionamento coerente con la direzione della deriva, con size calibrata sulla lettura OPEX ad alta convinzione.

---

## Da portare a casa

> EOD Pressure ti dice in quale direzione punta l'hedging forzato nella finestra di chiusura. Non ti dice nulla sul resto della giornata. Quel silenzio è il punto.

La disciplina consiste nell'usarlo come lettura direzionale per gli ultimi 90 minuti, verificarlo incrociandolo con il regime per decidere se cavalcare o fadare, e convalidarlo rispetto agli altri segnali Advanced per cercarne la confluenza. Fuori dalla finestra, cerca altrove.

Solo contenuto educativo — nulla di quanto sopra costituisce una raccomandazione di trading.

---

Se vuoi vedere la lettura di EOD Pressure di oggi in tempo reale durante la finestra attiva, insieme a Trap Detection e al contesto di regime, la dashboard gratuita di ZeroGEX mostra tutto questo.
