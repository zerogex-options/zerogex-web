# Segnale EOD Pressure spiegato: leggere la chiusura

*L'approfondimento pratico sul segnale ZeroGEX EOD Pressure - cosa chiede, perché la chiusura ha una deriva strutturale, come il punteggio combina charm e pin gravity, e come leggerlo negli ultimi 90 minuti.*

---

## Perché questo segnale esiste

Gli ultimi 90 minuti della sessione cash sono strutturalmente diversi dal resto della giornata. Il decadimento del charm sulle posizioni 0DTE tende a spingere i dealer a ricoprirsi più attivamente. La pin gravity attorno agli strike con gamma elevato può intensificarsi. Il book modellato dei dealer è più vincolato che in quasi qualsiasi altro momento della sessione.

Queste forze sono spesso direzionali e leggibili - *se* sai cosa cercare. Il segnale EOD Pressure è progettato per portare in superficie quella deriva direzionale modellata in tempo reale, così i trader possono posizionarsi assecondando il flusso di chiusura invece di contrastarlo.

Questo articolo è la lettura orientata al trader del segnale EOD Pressure. Copre cosa misura, perché la chiusura è diversa, come viene costruito il punteggio a partire da charm e pin gravity, e come leggerlo all'interno della finestra. Per l'approfondimento sulla metodologia combinata che abbina EOD Pressure a Trap Detection, vedi [Trading in chiusura](/education/eod-pressure-and-trap-detection); per la meccanica sottostante, [Vanna e Charm spiegati](/education/vanna-and-charm-explained) descrive nel dettaglio come il charm guida i flussi di hedging modellati.

---

## Che cos'è il segnale EOD Pressure?

Il segnale EOD Pressure pone una sola domanda:

> Dato il book modellato dei dealer e la vicinanza di uno strike magnete, da che parte si inclina l'hedging modellato verso la chiusura?

È un segnale **Advanced** nello stack ZeroGEX - produce sia un punteggio continuo su una scala da -100 a +100 sia un trigger discreto quando il punteggio supera **±20**. La soglia è volutamente più bassa di quella della maggior parte dei segnali Advanced (±25), perché il contesto strutturale (la finestra di chiusura) fa già da filtro - quando EOD Pressure segna 15 o più in una delle due direzioni dentro la finestra attiva, è già informativo sulla direzione. Come tutti i segnali Advanced, fa parte di Pro.

Bias di trading: **lettura direzionale**. Il segnale indica da che parte si sta inclinando la pressione - non prescrive di per sé se cavalcare o fadare il movimento. Questo dipende dal contesto di regime.

---

## Perché la chiusura è diversa

Tre meccanismi strutturali si sommano nella finestra finale della sessione:

1. **Il decadimento del charm accelera.** Man mano che le opzioni 0DTE si avvicinano alla scadenza, il loro delta tende a spostarsi verso 0 (out-of-the-money) o ±1 (in-the-money), mantenendo costanti gli altri input. I dealer che gestiscono un book grosso modo delta-neutrale tendono a ricoprirsi più spesso, e il ritmo modellato di quella ricopertura *aumenta* man mano che si avvicina la chiusura.
2. **La pin gravity si intensifica.** Gli strike con gamma elevato possono attrarre il prezzo con più forza man mano che il tempo alla scadenza si riduce. In un regime modellato di long gamma, il magnetismo modellato verso lo strike pesante più vicino tende a rafforzarsi nel corso del pomeriggio.
3. **La liquidità si assottiglia.** I flussi a blocchi, il ribilanciamento di fine giornata e gli ordini strutturali sugli indici spostano il profilo del flusso da continuo a intermittente. I dealer hanno meno margine per assorbire errori.

EOD Pressure combina i primi due elementi in una lettura direzionale. Il terzo è implicito nella calibrazione del punteggio.

---

## Le quattro componenti principali

Il segnale aggrega quattro componenti - tre contribuiscono alla magnitudine, una funge da gate rigido.

### Componente 1: Charm a spot

La misura modellata più diretta del flusso di hedging. Il segnale somma l'esposizione modellata al charm dei dealer su una banda at-the-money scalata per volatilità, ponderata per bucket di scadenza:

| Bucket | Peso | Perché |
|---|---|---|
| 0DTE | 0,70 | Il charm colpisce più duramente nel giorno di scadenza. Contributo dominante. |
| Weekly | 0,20 | Rilevante ma secondario. |
| Monthly | 0,10 | Contributo di sfondo. |
| LEAPS | 0,00 | Troppo lontano per contare ai fini della chiusura odierna. |

L'aggregato è normalizzato in modo che ±20 milioni di $ di charm dei dealer suddiviso per bucket saturino il sub-punteggio a ±1,0.

### Componente 2: Pin gravity

Il termine pin dipende dal regime di gamma modellato:

```
if net_gex >= 0:   # zero or positive gamma: pull toward the magnet
    pin_target   = max_pain  OR  max_gamma_strike
    distance_pct = (pin_target − close) / close
    pin_score    = clip(distance_pct / 0.003, [-1, +1])
else:              # negative gamma: follow the move already underway
    trailing_ret = (latest_close − earliest_close) / earliest_close
    pin_score    = clip(trailing_ret / 0.003, [-1, +1])
```

Un target di pin allo 0,3% sopra lo spot in un regime modellato di gamma positivo dà un pin score di +1,0 - la calamita è sopra e la gravità agisce. In un regime modellato di gamma negativo la distanza dal target non porta informazione direzionale, quindi il termine la ignora e legge invece il rendimento recente: un rialzo dello 0,3% sulle ultime chiusure dà anch'esso +1,0, e un ribasso dello 0,3% dà -1,0. Se manca il Net GEX, o ci sono meno di due chiusure utilizzabili, il termine pin vale 0.

**Limite metodologico:** entrambi i rami sono euristiche interne di ZeroGEX con punti di saturazione scelti a mano, non probabilità calibrate. Il ramo a gamma negativo traduce l'idea che lo short gamma amplifichi la direzione già in corso; non prevede quella direzione.

### Componente 3: Rampa temporale (il gate)

La rampa è moltiplicativa. Prima delle **14:30 ET**, è esattamente zero - l'intero segnale va in cortocircuito.

| Orario (ET) | Rampa |
|---|---|
| Prima delle 14:30 | 0,00 |
| 14:30 | 0,00 |
| 14:45 | 0,20 |
| 15:00 | 0,40 |
| 15:30 | 0,80 |
| 15:45 - 16:00 | 1,00 |

Ecco perché EOD Pressure legge zero per la maggior parte della giornata di trading. Il segnale è strutturalmente inattivo fuori dalla finestra.

### Componente 4: Amplificatore di calendario

L'amplificatore aumenta la convinzione nelle date in cui il posizionamento si concentra:

| Calendario | Amp |
|---|---|
| Giorno normale | 1,0× |
| OPEX mensile (terzo venerdì) | 1,5× |
| Quad witching (terzo venerdì di mar/giu/set/dic) | 2,0× |

Questo è l'unico punto del segnale in cui il punteggio intermedio può superare ±1 - il clamp finale lo riporta nell'intervallo.

---

## Come viene calcolato il punteggio

L'aggregazione finale:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

Il calcolo avviene sulla scala da -1 a +1; la card e la pagina del segnale mostrano il risultato moltiplicato per 100, quindi un punteggio di 0,55 qui appare come 55 a schermo.

La ponderazione 60/40 è una scelta progettuale fissata a mano, non stimata sui dati: riflette l'idea che **il charm sia la misura modellata più diretta del flusso di hedging**, mentre **la pin gravity sia l'attrazione indiretta, dipendente dal regime**. Nel modello contano entrambi. Il charm guida.

---

## Interpretazione del punteggio

| Punteggio | Lettura |
|---|---|
| +60 a +100 | Forte deriva al rialzo modellata verso la chiusura |
| +20 a +60 | Inclinazione positiva del modello |
| -20 a +20 | Componenti del modello deboli o che si compensano |
| -20 a -60 | Inclinazione negativa del modello |
| -60 a -100 | Forte deriva al ribasso modellata verso la chiusura |

Il trigger a **±20** è una soglia del modello scelta a mano, non una probabilità calibrata né un win rate atteso. Serve una validazione storica prima di trattarlo come un edge di performance.

---

## Quando il segnale scatta e quando resta silenzioso

Lo stato dominante è il **silenzio**. Per la maggior parte della giornata di trading, EOD Pressure è zero - e quello zero è *informativo*, non "neutro". Significa che la finestra attiva non è ancora iniziata.

Il segnale può leggere zero anche all'interno della finestra quando:

- Nessuno strike si trova all'interno della banda ATM scalata per volatilità su una catena sparsa o poco quotata.
- Sia `max_pain` che `max_gamma_strike` sono null.
- Il pin target si trova esattamente sullo spot.
- Charm score e pin score capitano ad annullarsi a vicenda - raro, richiede direzioni opposte e magnitudine grosso modo uguale.

Uno 0 fuori dalla finestra è normale. Uno 0 dentro la finestra è informativo - *oggi EOD Pressure non ha nulla da aggiungere.*

---

## Cosa ne fa un trader

Tre pattern operativi:

### 1. Preparazione prima della finestra

Prima delle 14:30 ET, EOD Pressure è zero per costruzione. Usa il tempo pre-finestra per individuare quale *sarà* il setup strutturale: dov'è il gamma massimo, dov'è il gamma flip, in che regime siamo, dov'è lo spot rispetto al pin target? Quando la finestra si apre, il segnale non ti sorprenderà - confermerà o smentirà la lettura che hai già costruito.

### 2. L'inflessione delle 15:30

EOD Pressure attraversa la rampa allo 0,8× alle 15:30 ET. Se i termini charm e pin sono stati concordi durante la prima parte della rampa (14:45-15:30), la convinzione tende a consolidarsi intorno alle 15:30. Considera quella rampa come timing del modello, non come un invito a posizionarti in anticipo né come prova che gli ordini dei dealer siano programmati.

### 3. Il quad witching è contesto strutturale

L'amplificatore 2,0× nei giorni di quad witching è abbastanza grande da spingere un segnale non amplificato di +40 fino a +80 amplificato. Considera quei giorni come dotati di una convinzione strutturalmente più alta - e di un rischio di whipsaw strutturalmente più alto nella parte iniziale della giornata, prima che la finestra si apra.

---

## Leggere EOD Pressure insieme ad altri segnali

EOD Pressure è una **lettura direzionale** - indica da che parte punta la pressione senza prescrivere di per sé se cavalcare o fadare il movimento. La decisione tra fade e ride arriva dal regime:

- **Regime modellato a gamma positivo + punteggio EOD Pressure positivo:** la deriva modellata è al rialzo, l'hedging dei dealer è modellato come smorzante, la lettura favorisce il posizionamento *assecondando* la deriva verso lo strike magnete - comprando la debolezza anziché fadare verso di esso - e il fade si applica solo agli overshoot oltre il magnete.
- **Regime modellato a gamma negativo + punteggio EOD Pressure positivo:** il punteggio combina un bias guidato dal charm con il movimento recente (in short gamma il termine pin segue la direzione già in corso), e il riflesso dei dealer è modellato come amplificante anziché assorbente - la prosecuzione del momentum è più probabile.

Combinato con altri segnali:

- **EOD Pressure + Trap Detection nella stessa direzione:** il setup ad alta convinzione più comune. La deriva EOD conferma un fade da breakout fallito.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) nella stessa direzione:** compresso verso la chiusura con deriva guidata dal charm a confermare. Setup di continuazione robusto.
- **EOD Pressure ≠ 0 dentro la finestra senza altri segnali attivi:** la deriva strutturale è l'unica lettura disponibile. Size più piccola, va trattata come un'inclinazione direzionale piuttosto che come un trade ad alta convinzione.

---

## Fraintendimenti comuni

Tre trappole:

- **Trattare uno zero pre-finestra come "nessun segnale oggi".** La finestra non si è ancora aperta. Il segnale è *strutturalmente inattivo*, non privo di informazione.
- **Ignorare il cambio di regime nella pin gravity.** L'attrazione verso il target in gamma positivo è un'euristica del modello. In gamma negativo il termine pin smette di guardare il target e segue invece il movimento recente - anche questa un'euristica interna, non una certezza meccanica.
- **Fare trading sul punteggio grezzo senza considerare la rampa.** Una lettura di +40 alle 14:45 (rampa 0,20) è in realtà un punteggio effettivo di +8. Leggi la magnitudine corretta per la rampa, non il punteggio grezzo in input.

---

## Come ZeroGEX mostra il segnale EOD Pressure

La dashboard lo mostra in diversi punti:

- **La card EOD Pressure** mostra il punteggio live, lo stato del trigger e la scomposizione per componente (contributi charm vs. pin).
- **L'Event Timeline** nella pagina del segnale mostra il percorso recente del punteggio, con i cambi di direzione evidenziati.
- **Signal Breadth**, nel pannello Segnali Proprietari della dashboard, lo conta come uno dei voti direzionali. (Non è un input del Composite MSI, che è costruito dalle sue sei componenti.)

Un esempio pratico. SPX è a 5.825 alle 15:15 ET in un venerdì di OPEX mensile e ZeroGEX mostra:

- **EOD Pressure:** -55 (trigger ribassista)
- **Net GEX:** +1,2 miliardi di $ (positivo)
- **Gamma Flip:** lo spot è a +15 (sopra il flip)
- **Max Pain:** 5.810 (sotto lo spot)
- **Charm a spot:** moderatamente negativo (vendite in accumulo)
- **Amp di calendario:** 1,5× (OPEX mensile)

La lettura strutturale: regime modellato a gamma positivo con un magnete pesante 15 punti sotto lo spot, l'hedging modellato guidato dal charm punta verso il basso, e l'amplificatore OPEX sta aumentando il punteggio. Inclinazione operativa: secondo la lettura del modello, la deriva verso 5.810 è il percorso favorito dal modello verso la chiusura. Il trade non è EOD Pressure in sé - è un posizionamento coerente con la direzione della deriva, con size calibrata sulla lettura OPEX modellata.

---

## Da portare a casa

> EOD Pressure è progettato per stimare da che parte si inclina l'hedging modellato nella finestra di chiusura. Non ti dice nulla sul resto della giornata. Quel silenzio è il punto.

La disciplina consiste nell'usarlo come lettura direzionale per gli ultimi 90 minuti, verificarlo incrociandolo con il regime per decidere se cavalcare o fadare, e convalidarlo rispetto agli altri segnali Advanced per cercarne la confluenza. Fuori dalla finestra, cerca altrove.

Solo contenuto educativo - nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere la lettura di EOD Pressure di oggi in tempo reale durante la finestra attiva, insieme a Trap Detection e al contesto di regime, ZeroGEX Pro mostra tutto questo nella Dashboard segnali avanzati.
