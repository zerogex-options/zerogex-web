# Che cos'è un put wall? Come i trader di opzioni usano i put wall come supporto dei dealer

*Il put wall è lo strike dove si concentra il gamma dei dealer sul lato put — di solito il supporto più solido garantito dall'hedging dei dealer sul book. Ecco cos'è davvero un put wall, perché il prezzo reagisce lì, come si muove durante la sessione e quando tiene o si rompe.*

---

## Che cos'è un put wall?

Un **put wall** è lo strike sotto lo spot che porta la concentrazione più pesante di esposizione gamma dei dealer sul lato put nella catena di opzioni. È il livello di prezzo in cui i flussi di hedging dei dealer sono più propensi a *difendere il lato ribassista* — motivo per cui i trader considerano il put wall come il pavimento strutturale dell'attuale range di posizionamento dei dealer.

Il significato di put wall, in una frase: non è un livello psicologico né una media mobile — è posizionamento reale. Open interest, contratto per contratto, ponderato per il gamma che ciascun contratto porta con sé. Lo strike singolo dove quel gamma put è più denso sotto il prezzo corrente è il put wall.

Il put wall ha un'immagine speculare sopra lo spot: il [call wall](/education/what-is-a-call-wall), lo strike con il gamma call più pesante, che tende a limitare il rialzo. Insieme, i due wall delineano il range che le dinamiche di hedging dei dealer tendono a difendere. Questo articolo si concentra specificamente sul put wall — cos'è, perché funge da supporto, come si muove e quando la lettura si rompe. Per il quadro strutturale completo, abbinalo a [Gamma Walls Explained](/education/gamma-walls-explained) e al [pilastro sul Gamma Exposure](/education/gamma-exposure-explained).

---

## Perché il put wall funge da supporto

Il meccanismo è l'hedging dei dealer, non il sentiment. In un regime di **gamma positivo** — spot sopra il [gamma flip](/education/how-to-read-a-gamma-flip) — i dealer sono net long gamma, e i desk che hanno scritto le put pesanti allo strike del put wall sono short su quelle put. Per rimanere delta-neutrali, devono **comprare** il sottostante man mano che il prezzo scende verso lo strike, perché una posizione short put acquisisce delta più lungo quando il mercato scende.

Quel comprare è il supporto. Man mano che il prezzo scivola verso uno strike put denso, il riflesso di hedging si intensifica: un piccolo movimento al ribasso costringe a un acquisto di hedging relativamente più grande. Il risultato è un livello in cui la vendita viene assorbita e i ribassi tendono a essere comprati — non perché qualcuno creda in quel numero, ma perché l'hedge è meccanico.

Alcune cose che derivano direttamente dal meccanismo:

- Il put wall è un **supporto probabilistico**, non un pavimento rigido. È dove si concentra il flusso assorbente, non un rimbalzo garantito.
- È più forte in un regime di gamma positivo e con un gamma relativo elevato allo strike.
- È un'*inclinazione* che un catalizzatore genuino — CPI, FOMC, uno spike di volatilità — può ribaltare in pochi secondi.

---

## Put wall vs. call wall

I due wall sono simmetrici ma opposti:

|Wall|Dove|Hedge del dealer in gamma positivo|Comportamento tipico|
|---|---|---|---|
|Put wall|Gamma put più pesante sotto lo spot|Compra man mano che il prezzo scende verso di esso|Supporto / pavimento ribassista|
|Call wall|Gamma call più pesante sopra lo spot|Vende man mano che il prezzo sale verso di esso|Resistenza / tetto rialzista|

Nessuno dei due wall è direzionale di per sé. Il put wall non è "rialzista" e il call wall non è "ribassista" — sono livelli di concentrazione il cui *effetto* dipende da quale lato del gamma flip ci si trova. Sopra il flip, entrambi i wall assorbono i movimenti. Sotto di esso, entrambi possono invertirsi e rilasciarli.

---

## Come si muove il put wall durante la sessione

Il put wall è una lettura viva, non una linea che si fissa all'apertura e a cui ci si affida fino alla chiusura. Migra per tre motivi comuni:

1. **Ribilanciamento dell'OI.** Nuovo volume su uno strike diverso può spostare la concentrazione più pesante di gamma put. Il put wall alle 10:00 ET potrebbe trovarsi uno strike più in basso entro mezzogiorno.
2. **Migrazione con il prezzo.** Se il prezzo scende gradualmente verso il put wall e i trader continuano a comprare protezione appena sotto, il wall può derivare verso il basso insieme al movimento. Un put wall che *insegue* il prezzo è una lettura di supporto più debole rispetto a uno che *tiene* — il wall sta rincorrendo, non difendendo.
3. **Decadimento a scadenza.** Nelle catene ricche di 0DTE, i contratti che hanno costruito il wall scadono nel corso del pomeriggio. Un put wall su cui ci si appoggiava alle 11:00 ET può assottigliarsi entro le 14:30 ET.

Leggere il wall in movimento è la maggior parte dell'edge. Un put wall che non si è mosso in due ore è un segnale molto diverso da uno che è scivolato più in basso insieme al prezzo tre volte.

---

## Quando il put wall tiene o si rompe

Il put wall è un'inclinazione che funziona più spesso quando la struttura lo sostiene. Una breve checklist:

**Più probabile che tenga:**

- Lo spot è in un regime di gamma positivo (sopra il flip).
- Lo strike porta un gamma relativo elevato e il Net GEX è significativamente positivo.
- Il wall *non* sta migrando più in basso insieme al prezzo.
- La vendita verso il livello sta decelerando.

**Più probabile che si rompa:**

- Lo spot è in un regime di **gamma negativo** (sotto il flip). Qui il riflesso del dealer si inverte — invece di comprare il ribasso, l'hedging può *aggiungersi* al sell-off, e il put wall diventa un punto di scivolamento anziché un pavimento.
- Il Net GEX è piccolo o si sta contraendo rapidamente.
- Il wall sta rincorrendo il prezzo verso il basso.
- Un catalizzatore macro colpisce mentre il livello viene testato.
- La vendita direzionale sta *accelerando* verso lo strike.

Il più importante di questi è il regime. Un put wall in gamma positivo è un pavimento che i dealer difendono. Lo stesso strike in gamma negativo è una trappola — una volta che il prezzo lo attraversa, i flussi di hedging rinforzano il movimento al ribasso invece di attenuarlo.

---

## Un esempio pratico

Supponiamo che SPX sia scambiato a 5.830 e che il book dei dealer indichi:

- **Put Wall:** 5.790 (−0,69% dallo spot)
- **Call Wall:** 5.850 (+0,34% dallo spot)
- **Gamma Flip:** 5.810
- **Net GEX:** +1,5 miliardi di $

Lo spot è comodamente sopra il flip, quindi si tratta di una sessione a gamma lunga e il put wall a 5.790 è il bordo più solido del range. L'inclinazione pratica: i ribassi verso 5.790 rappresentano la zona di *acquisto* a probabilità più alta, e una rottura pulita di 5.790 sarebbe un segnale reale — probabilmente significa o un attraversamento del flip sotto 5.810 verso gamma negativo, oppure un catalizzatore abbastanza forte da sopraffare l'hedge. Sotto il flip, quello stesso 5.790 smette di essere supporto e può accelerare la gamba ribassista successiva.

Cambia una variabile — diciamo che il put wall migra da 5.790 a 5.782 mentre il prezzo sonda 5.795 — e la lettura cambia con esso. Il wall ora sta rincorrendo il prezzo verso il basso, l'inclinazione di supporto si indebolisce, e una rottura diventa più credibile di quanto sembrasse dieci minuti prima.

---

## Come trovare il put wall di oggi

Non devi calcolare il gamma dei dealer a mano. ZeroGEX pubblica il put wall corrente — insieme a call wall, gamma flip, max pain e Net GEX — per i tre prodotti indice più scambiati, gratuitamente e con circa 15 minuti di ritardo: guarda il put wall di oggi su [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) e [QQQ](/qqq-gamma-levels). Per la versione live, al di sotto del secondo, con il profilo gamma completo e la heatmap strike-per-DTE, la [dashboard GEX 0DTE in tempo reale](/real-time-gex-0dte) traccia il put wall mentre migra nel corso della sessione.

---

## Conclusione

> Il put wall è posizionamento reale, non psicologia — lo strike dove l'hedging dei dealer è più propenso a difendere il lato ribassista. Ma è un pavimento solo finché lo spot è in gamma positivo. Leggi prima il regime, poi il wall, e infine la migrazione del wall.

Solo contenuto educativo — nessuno di quanto sopra è una raccomandazione di trading.

---

Vuoi vederlo in tempo reale? Guarda oggi i **put wall di SPX / SPY / QQQ** su ZeroGEX — le pagine gratuite dei livelli gamma di [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) e [QQQ](/qqq-gamma-levels) tracciano il put wall accanto al [call wall](/education/what-is-a-call-wall), al gamma flip e al Net GEX. Per i livelli che contano di più come supporto e resistenza, vedi [supporto e resistenza basati sulle opzioni](/education/options-support-and-resistance), e per la lettura in tempo reale, apri la [dashboard GEX 0DTE in tempo reale](/real-time-gex-0dte).
