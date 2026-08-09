# Usare il Live Bulletin

*Un'istantanea in tempo reale e pronta da condividere del posizionamento gamma dei dealer, per il simbolo che stai seguendo.*

---

## Cos'è il Live Bulletin

Il Live Bulletin è una **scheda in tempo reale del posizionamento gamma dei dealer**, per un sottostante alla volta. Scegli un simbolo e recupera l'istantanea di posizionamento corrente direttamente dal backend e la presenta su un'unica scheda: il regime gamma, i livelli chiave (gamma flip, call wall, put wall, max pain), il Net GEX, il rapporto put/call, una banda di range atteso (expected range) e una mappa di posizionamento che colloca lo spot rispetto a quei livelli.

È pensata per essere letta a colpo d'occhio — e per essere condivisa. Puoi modificare il titolo e il riepilogo, poi scaricare o copiare un PNG pulito della scheda per i tuoi appunti, una chat di trading o i social.

## Cosa contiene la scheda

- **Badge del regime gamma** — positivo (dealer lunghi di gamma; mercato ancorato, bassa volatilità), negativo (dealer corti di gamma; mercato in trend, alta volatilità), al flip (transizione), o non risolto quando la chain è troppo sottile per determinare un flip in modo affidabile.
- **Titolo + riepilogo** — una lettura in linguaggio chiaro generata automaticamente dai numeri in tempo reale: la postura dei dealer, dove si trova lo spot rispetto al flip, il corridoio tra i wall e cosa implica il regime per la tape. Modificabile — vedi sotto.
- **Spot** — il prezzo del sottostante e la variazione di giornata. Quando un indice cash è fuori dalla sua sessione (es. lo SPX durante la notte), lo spot è **implicito dai futures** (ES/NQ) e chiaramente segnalato come tale — mai mostrato come quotazione cash in tempo reale.
- **Griglia di metriche** — Gamma Flip, Net GEX, rapporto Put/Call, Call Wall, Put Wall e Max Pain.
- **Expected Range** — una banda di movimento implicito a 1σ (~68%) per l'orizzonte scelto, derivata dal VIX (SPX/SPY) o dal VXN (QQQ/NDX), più una nota su dove si collocano i wall dei dealer rispetto a quella banda.
- **Mappa di posizionamento** — put wall, gamma flip, spot e call wall disposti su un unico asse dei prezzi, con la banda di range atteso ombreggiata, per vedere a colpo d'occhio dove si trova il prezzo tra i magneti.

## Controlli

- **Sottostante** — SPX, SPY, QQQ o NDX.
- **Orizzonte del range atteso** — Daily, Weekly o Monthly. «Daily» è una sessione di trading di volatilità implicita (l'Expected Daily Range), non un giorno di calendario; Weekly sono 5 sessioni, Monthly ~21. Se l'indice di volatilità implicita non è disponibile, la banda viene nascosta anziché stimata.
- **Titolo / Riepilogo** — il testo generato automaticamente è un punto di partenza; modifica uno dei due campi e la scheda si aggiorna in tempo reale. «Reset to auto» ripristina il testo generato.
- **Download PNG / Copy to clipboard** — esporta la scheda come immagine pronta da condividere (la scheda riporta un watermark zerogex.io).

## Come si aggiorna

La scheda è **in tempo reale**. Interroga il backend per tutta la sessione — lo spot ogni pochi secondi, il riepilogo e il profilo gamma ogni ~10 secondi, l'indicatore di volatilità ogni ~30 secondi — così che i livelli, il regime, la banda di range atteso e la lettura generata automaticamente si aggiornino al variare delle condizioni. I livelli di gamma dei dealer stessi vengono ricalcolati dal motore di analytics con un ciclo di circa un minuto durante la sessione regolare, così che wall, flip e max pain possano muoversi in intraday al variare di spot e posizionamento. Un timestamp «as of» (ET) sulla scheda ti indica quanto è fresca l'istantanea.

## Quando è più utile

- **Prima dell'apertura** — una lettura rapida di dove si collocano wall, flip e range atteso in avvicinamento alla sessione, con lo spot implicito dai futures finché l'indice cash è ancora chiuso.
- **Attorno ai livelli principali** — dai un'occhiata alla mappa di posizionamento quando il prezzo si avvicina al flip, al call wall o al put wall.
- **Per condividere una lettura** — esporta la scheda quando vuoi passare a qualcuno il quadro del posizionamento gamma della giornata senza fare uno screenshot dell'intera app.

## Cosa non è

Il Live Bulletin **non è un feed di segnali di trading**. È un'istantanea di posizionamento/contesto — ti mostra *dove* si trova il gamma dei dealer e quale regime implica, non *quando* agire. Per i segnali e gli inneschi, usa i dashboard Basic e Advanced Signals e i [Signal Alerts](/help/platform/alerts); per una lettura direzionale, consulta il Trade Bias e il [Composite Score](/help/platform/composite-score).

## Visibilità per livello

Il Live Bulletin è una funzione **Basic** — inclusa in Basic e Pro. I segnali Advanced verso cui ti indirizza sono riservati separatamente al livello Pro.

## Lo specchio admin

Esiste una versione admin senza watermark della stessa scheda, usata per screenshot e demo. Si tratta di un percorso solo interno.

## Vedi anche

- [Leggere il Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Max Pain](/help/platform/max-pain)
