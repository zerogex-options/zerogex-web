# Segnale Squeeze Setup spiegato: leggere i mercati compressi

*L'approfondimento pratico sul segnale Squeeze Setup di ZeroGEX — cosa misura, i cinque input che determinano il punteggio, quando scatta e quando resta silenzioso, e come usarlo per identificare i mercati compressi e pronti per un movimento direzionale.*

---

## Perché esiste questo segnale

La maggior parte degli strumenti di options-flow ti dice che sta succedendo qualcosa *proprio ora*. Quasi nessuno ti dice che il book ha silenziosamente **accumulato** l'energia per muoversi — che flow, momentum, gamma e volatilità si stanno allineando prima che il movimento vero e proprio scatti.

Questo è il vuoto che il segnale Squeeze Setup è costruito per colmare. Non predice la direzione in modo diretto. Ti dice quando le condizioni per un movimento direzionale si sono accumulate su più input strutturali, così che quando arriva il catalizzatore, il movimento ha carburante dietro di sé.

Questo articolo è la lettura orientata al trader del segnale Squeeze Setup. Copre cosa chiede, come viene calcolato il punteggio, quando scatta e quando resta silenzioso, e come agire durante una sessione. Il riferimento completo ai segnali ZeroGEX si trova nella [guida Signals: Explained](/guides/signals-explained), e le meccaniche strutturali che guidano la maggior parte dei suoi input sono trattate nel [pillar sulla Gamma Exposure](/education/gamma-exposure-explained).

---

## Cos'è il segnale Squeeze Setup?

Il segnale Squeeze Setup pone una domanda:

> Il mercato è compresso — flow, momentum, gamma e volatilità si stanno allineando per caricare energia che non è ancora stata rilasciata?

È un segnale **Avanzato** nello stack ZeroGEX — produce sia un punteggio continuo sulla linea numerica [-1, +1] sia un trigger discreto quando il punteggio assoluto supera **0,25**.

È fondamentale notare che Squeeze Setup è un segnale di **Continuazione**, non di fade. Quando scatta, l'inclinazione pratica è tradare *nella direzione* del movimento una volta che rompe, non contro di esso. Questo lo rende l'opposto di strumenti di mean-reversion come Positioning Trap o Trap Detection. Sapere a quale categoria appartiene un segnale è metà del lavoro per leggerlo correttamente.

---

## Il meccanismo: come si costruisce la compressione

I mercati non si comprimono sempre prima di muoversi — ma quando lo fanno, certe condizioni misurabili tendono a raggrupparsi:

1. **Il flow ha iniziato a inclinarsi direzionalmente.** Il premio delle call domina costantemente quello delle put, o viceversa — e l'inclinazione è abbastanza ampia rispetto alla tipica volatilità del flow del simbolo da risultare evidente.
2. **Il momentum a breve termine sta accelerando.** Il momentum a 5 barre supera quello a 10 barre. La pendenza si sta irripidendo, non solo trendando.
3. **La net gamma è abbastanza densa da rendere l'hedging rilevante.** Un book dei dealer piatto non propaga i movimenti; uno carico sì.
4. **Lo spot è posizionato rispetto al gamma flip in un modo che apre spazio al rialzo.** Se lo spot è appena sotto il flip e il flow è rialzista, è presente il setup strutturale per un attraversamento del flip seguito da estensione.
5. **Il regime di volatilità è quello giusto.** Un regime VIX da panico smorza i setup (tutto si sta già muovendo); un regime VIX morto può produrre compressioni false.

Squeeze Setup combina tutti e cinque in un unico punteggio continuo per lato (bull e bear), per poi nettarli.

---

## I cinque input principali

| Input | Cosa cattura |
|---|---|
| Flow z-score | I delta di flow call/put standardizzati (z-score) in base alla volatilità del flow per singolo simbolo — un flow "grande" su un simbolo tranquillo è considerato significativo; un flow "grande" su un simbolo rumoroso deve superare una soglia più alta |
| Momentum 5/10 barre | Due orizzonti temporali confrontati, alla ricerca di accelerazione (5 barre che supera 10 barre) e non solo di direzione |
| Gamma readiness | La net gamma fatta passare attraverso una tanh regolare, dando come risultato "il book è abbastanza carico da contare?" come moltiplicatore continuo da 0 a 1 |
| Distanza dal flip | Quanto è vicino lo spot al gamma flip, con il lato moltiplicato in modo che un setup bull vicino al flip da sotto ottenga un punteggio più alto |
| Regime VIX | Morto / normale / elevato / panico — usato per smorzare o amplificare il punteggio a seconda del contesto |

L'output è un solo numero, ma porta con sé la struttura congiunta di tutti e cinque gli input.

---

## Come viene calcolato il punteggio

Per ciascun lato (bull e bear), il segnale moltiplica:

```
side_score = normalized_flow × directional_momentum_strength
           × gamma_readiness × acceleration_multiplier × flip_side_multiplier
```

Il punteggio netto è `bull_score − bear_score`, limitato all'intervallo [-1, +1]. Il trigger scatta quando il punteggio assoluto è ≥ **0,25**.

Due fatti strutturali su questa formula sono rilevanti per la lettura:

- **Ogni termine moltiplica, non somma.** Se anche solo uno dei cinque termini va a zero, il lato si azzera. Il segnale ha un'opinione precisa su *quando* funzionano gli squeeze — si rifiuta di scattare quando una delle condizioni non è soddisfatta, anche se le altre urlano.
- **I lati bull e bear vengono calcolati indipendentemente, poi nettati.** Nei rari casi in cui entrambi scattano contemporaneamente (setup genuinamente contesi), si annullano parzialmente — il che è appropriato, perché la lettura è ambigua.

---

## Interpretazione del punteggio

| Punteggio | Lettura |
|---|---|
| da +0,6 a +1,0 | Fortemente compresso al rialzo |
| da +0,25 a +0,6 | Attivato rialzista — il playbook di breakout al rialzo è operativo |
| da -0,25 a +0,25 | Sotto soglia — informativo, non azionabile da solo |
| da -0,25 a -0,6 | Attivato ribassista — il playbook di breakout al ribasso è operativo |
| da -0,6 a -1,0 | Fortemente compresso al ribasso |

La soglia di 0,25 è deliberatamente conservativa. Squeeze Setup pone un'asticella alta — si allineano *tutti* gli input strutturali? — e la soglia riflette questo. Una lettura di 0,20 è borderline; solo 0,25+ conta come attivato.

---

## Quando il segnale scatta e quando resta silenzioso

Lo stato dominante è **silenzioso**. Squeeze Setup è progettato per rimanere silenzioso la maggior parte del tempo. Sulla maggior parte dei simboli, per la maggior parte della giornata di trading, nessuna delle cinque condizioni si sta accumulando — e quel silenzio è informativo. Ti dice che le precondizioni strutturali per un breakout non sono presenti, quindi i breakout che vedi sono probabilmente rumore.

Il segnale scatta solo quando:

- Il flow è abbastanza grande da essere statisticamente significativo rispetto allo storico del simbolo (la componente z-score non è trascurabile).
- Il momentum sta accelerando, non solo trendando.
- La gamma è abbastanza carica da permettere ai flussi di hedging di propagare i movimenti.
- Lo spot è posizionato rispetto al flip in un modo che apre asimmetria direzionale.
- Il regime di volatilità non smorza il segnale a zero.

Pochi minuti di ogni sessione, sui pochi simboli dove tutto questo si allinea — è lì che vive Squeeze Setup.

---

## Cosa fa un trader quando scatta

Il gate del playbook canonico:

> Un punteggio Squeeze Setup persistentemente sopra la soglia per due sessioni consecutive attiva il playbook Squeeze Breakout — entrata su una rottura pulita di un inviluppo di volatilità a 30 barre, nella direzione verso cui pende il segnale.

La persistenza su due sessioni è un filtro deliberato. I trigger su singola barra sono troppo rumorosi; la compressione strutturale deve *reggere*. Quando lo fa, il segnale sta essenzialmente dicendo: le condizioni per muoversi ci sono, aspetta la rottura, poi tradare nella direzione del punteggio.

Alcune note pratiche:

- **La direzione viene dal segno del punteggio, non dalla tecnica di entrata.** Il segnale fa la lettura direzionale; la rottura dell'inviluppo di volatilità è il trigger di timing.
- **La magnitudine conta.** Un punteggio di +0,55 è materialmente diverso da +0,27 — entrambi attivati, ma il trade a convinzione più alta è quello col punteggio più alto.
- **I punteggi sotto soglia comunque informano.** Una lettura persistente di +0,20 non è azionabile da sola, ma se ogni altro segnale è anch'esso inclinato al rialzo, si aggiunge alla lettura composita.

---

## Leggere Squeeze Setup insieme ad altri segnali

Squeeze Setup è uno tra i molti segnali — ed è nella confluenza che vive il vero edge. Alcune letture incrociate comuni:

- **Squeeze Setup + Vol Expansion nella stessa direzione.** Due segnali di Continuazione concordi — il movimento ha sia *compressione* sia *capacità*. Il setup più pulito.
- **Squeeze Setup + Trap Detection in opposizione.** Compresso al rialzo secondo Squeeze, ma Trap Detection dice che la rottura al rialzo più recente sta fallendo. Uno dei due si sbaglia sulla rottura attuale; di solito la mossa giusta è saltare e aspettare.
- **Squeeze Setup + Positioning Trap allineati.** Compressione con la folla scoperta dallo stesso lato — uno squeeze da copertura di short se la folla è short, un flush se è long. Entrambi i segnali puntano allo stesso trade. L'articolo di approfondimento sul [segnale Positioning Trap](/education/positioning-trap-explained) tratta questa lettura in dettaglio.
- **Squeeze Setup a 0 con ogni altro segnale attivo.** Probabilmente nulla di strutturale è compresso; il movimento che stai vedendo è reattivo, non carico.

Quando diversi segnali di Continuazione (Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow) si allineano nella stessa direzione, la convinzione si moltiplica. Quando entrano in conflitto con i segnali di Mean-reversion, il book è conteso.

---

## Letture errate comuni

Tre trappole:

- **Trattare uno 0 come "neutrale".** Uno 0 su Squeeze Setup significa *niente è compresso* — non che il mercato è bilanciato. Non tradare su di esso come un semaforo verde "calmo".
- **Tradare su un punteggio sotto soglia.** La soglia di 0,25 conta. Una lettura di 0,18 può *sembrare* un setup, ma non è attivata — e la differenza tra "sembra compresso" e "è strutturalmente compresso" è la maggior parte dell'edge.
- **Ignorare il regime.** Squeeze Setup di per sé non dice nulla sul regime gamma. Un mercato compresso sotto il flip si comporta diversamente da uno sopra. Verifica sempre con il workflow [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Come ZeroGEX mostra il segnale Squeeze Setup

La dashboard lo mostra in diversi punti:

- **La card Squeeze Setup** mostra il punteggio live, lo stato del trigger e la scomposizione degli input.
- **Il Composite Signal Score** integra Squeeze Setup come uno degli input insieme agli altri segnali Avanzati e Base.
- **Il Trade Stream** segnala i trade del playbook gated da `squeeze_breakout` quando scattano.

*[Segnaposto immagine: card Squeeze Setup di ZeroGEX con punteggio, stato del trigger e contributi degli input — inserire il file in /public/blog/zerogex-squeeze-setup-card.png]*

Un esempio pratico. Supponiamo che SPX stia grindando lateralmente nella sessione di mercoledì e che ZeroGEX mostri:

- **Squeeze Setup:** +0,42 (attivato rialzista)
- **Net GEX:** +$800M
- **Gamma Flip:** lo spot è 0,2% sopra
- **Tape Flow Bias:** +0,6
- **Trap Detection:** 0

La lettura strutturale: setup compresso al rialzo con inclinazione del flow di conferma, nessun segnale di breakout fallito che vada in senso contrario, e un regime long-gamma che smorzerà il movimento se prova a estendersi troppo. Inclinazione pratica: rimanere vigili per una rottura dell'inviluppo di volatilità al rialzo; quando arriva, le condizioni strutturali per il proseguimento sono in atto. Nulla di tutto questo è un trade — è la lettura del regime che dovrebbe rimodellare quali entrate prendere sul serio.

---

## Conclusione

> Squeeze Setup ti dice quando il mercato ha *accumulato* l'energia per muoversi, non quando si è già mosso. È un segnale di precondizione, non un segnale di timing.

La disciplina consiste nell'usarlo come filtro per capire quali breakout direzionali prendere sul serio, piuttosto che come trigger in sé. Quando il punteggio è attivato, il setup di breakout è reale; quando è a zero, i breakout che stai vedendo sono rumore. Questa distinzione è la maggior parte dell'edge.

Solo a scopo educativo — nulla di quanto sopra è una raccomandazione di trading.

---

Se vuoi vedere la lettura di Squeeze Setup di oggi in tempo reale insieme al gamma flip, ai walls e agli altri segnali Avanzati e Base, la dashboard gratuita di ZeroGEX mostra tutto questo.
