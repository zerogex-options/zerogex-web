# Vanna: quando la paura svanisce, i dealer comprano

*Vanna è la velocità con cui il delta di un'opzione cambia al variare della volatilità implicita. Quando la paura prezzata nel mercato si dissolve dopo un evento che non ha prodotto nulla, vanna costringe i dealer a comprare azioni con un flusso lento e costante — quel "sale senza notizie" che si vede sul grafico ma mai nei volumi.*

---

## Il flusso che non vedi nel tape

C'è un tipo di seduta che ogni trader riconosce e pochi sanno spiegare: il mercato galleggia verso l'alto per tutta la giornata, candela verde dopo candela verde, su volumi nella norma e in assenza totale di notizie. Nessuno sembra comprare, eppure continua a salire. Chiedi in giro e ricevi solo scrollate di spalle — "melt-up," "deriva a bassa volatilità," "gamma." Il motore reale è di solito vanna, e una volta capito, quelle sedute smettono di sembrare misteriose.

Vanna è la sensibilità del delta rispetto alla volatilità implicita — ∂Δ/∂σ. È il terzo dei tre "figli" del delta, insieme a gamma (delta rispetto al prezzo) e charm (delta rispetto al tempo), descritti in [Delta e i suoi tre figli](/education/delta-and-its-three-children). Come charm, costringe i dealer a operare anche con lo spot perfettamente fermo. A differenza di charm, il suo innesco non è l'orologio ma la paura: l'aspettativa di movimento futuro prezzata dal mercato, quotata come volatilità implicita.

Questo è l'approfondimento meccanico che sta alla base della nostra guida più ampia [Vanna e Charm spiegati](/education/vanna-and-charm-explained). Quel pezzo colloca vanna nel quadro dei regimi di mercato; questo mostra esattamente perché un calo della vol si trasforma in un bid dei dealer.

---

## Perché il delta si muove quando si muove la vol

La volatilità implicita determina l'ampiezza della distribuzione attesa degli esiti dal mercato. Un'IV alta significa che il mercato ritiene plausibile un'ampia gamma di prezzi; un'IV bassa significa che si aspetta che i prezzi restino vicini a dove sono ora.

Ora pensa a cosa comporta questo per una call out-of-the-money. Quando l'IV è alta e la distribuzione è ampia, quello strike lontano ha una probabilità concreta di essere raggiunto, quindi il suo delta è nettamente sopra zero — diciamo 0,25. Lascia che la paura si dissolva, che la distribuzione si restringa, e quello stesso strike appare improvvisamente molto meno raggiungibile. Il suo delta scende verso zero — diciamo 0,15. Lo spot non si è mai mosso. L'unica cosa cambiata è stata la stima del mercato su quanto lo spot *potrebbe* muoversi, e questo da solo ha ri-prezzato il delta dell'opzione.

Questo spostamento è vanna. Ogni opzione out-of-the-money della catena ri-prezza il proprio delta quando la vol si muove, e il delta dell'intero book del dealer si sposta di conseguenza. Il dealer era coperto sui delta di ieri; il print di vol di oggi li ha appena cambiati; l'hedge deve muoversi per recuperare.

---

## Perché la paura che svanisce tende a essere un bid

La direzione del flusso di vanna dipende da come è composto il book, ma lo schema da manuale — quello che produce la deriva riconoscibile — funziona così.

I clienti sono, in aggregato, long di opzioni. Comprano call per l'upside e put per protezione, e i dealer sono short dall'altra parte. Considera i momenti *dopo* uno spavento: la vol implicita era stata spinta in alto in vista di un dato CPI, un meeting FOMC, un earnings. Il rischio passa. Il movimento temuto non si materializza. La vol implicita, che era ricca, comincia a scendere nelle ore e nei giorni successivi.

Man mano che la vol scende:

1. I delta delle opzioni out-of-the-money su cui il dealer è short si spostano verso zero.
2. La posizione netta short-delta del dealer si riduce — sono meccanicamente meno short sul mercato di quanto lo fossero.
3. Per ripristinare l'hedge, comprano azioni.
4. La vol continua a scendere, quindi lo spostamento continua, quindi gli acquisti continuano ad arrivare — piccoli, costanti, per tutta la giornata.

Quell'acquisto costante e meccanico è il vanna grind. Non è una scommessa. Nessun dealer ha deciso che il mercato dovesse salire. La vol è scesa, i delta si sono spostati, e l'hedge ha richiesto azioni. Ma l'aggregato di migliaia di piccoli acquisti forzati è indistinguibile, sul grafico, da una domanda genuina — ed è esattamente per questo che il tape sale mentre i volumi non segnalano nulla. Gli acquisti sono reali; arrivano semplicemente come un flusso di ordini limit anziché un'ondata di ordini a mercato, quindi muovono il prezzo senza far accendere le barre dei volumi.

---

## La scala di vanna

Poiché il flusso di vanna è guidato da una variabile che puoi shockare direttamente, puoi rappresentarlo come una scala: tieni fissi spot e tempo, muovi la vol implicita su e giù di un punto alla volta, e leggi quanta azione il book dei dealer è costretto a scambiare a ogni gradino.

Il grafico live [Vanna Ladder](/forced-flow) fa esattamente questo. A variazione di vol zero il flusso forzato è zero — nulla si è mosso, quindi nulla è obbligato. Fai scendere la vol di un punto e il grafico mostra l'acquisto forzato che una compressione di un punto produrrebbe; falla scendere di due punti e l'acquisto raddoppia circa. Fai salire la vol e il segno si inverte: un'impennata di vol costringe i dealer a vendere, il che è parte del motivo per cui la paura si autoalimenta in un selloff. La scala rende leggibile l'asimmetria — puoi vedere, prima che accada, quanto vale in termini di bid un calo di due punti della vol oggi.

---

## Mettere un numero sopra

Diciamo che SPX è a 5.800 la mattina dopo un dato sull'inflazione tranquillo, la vol implicita comincia a rientrare, e il book dei dealer porta il tipico skew customer-long. Il motore ri-prezza il book con lo spot fermo a 5.800 e la vol giù di due punti, e trova il delta del dealer più alto per un equivalente di 60 milioni di dollari di esposizione sull'indice. Sono all'incirca **60 milioni di dollari** di acquisti forzati, distribuiti lungo la seduta mentre la vol effettivamente scende — un bid persistente senza alcun catalizzatore alle spalle che qualsiasi titolo di giornale possa riportare.

Inverti il movimento della vol e lo stesso meccanismo forza vendite. Vanna, come charm, non ha una direzione intrinseca; il segno viene dal book e dalla direzione del movimento di vol. Ciò che è affidabile è il *carattere* del flusso: lento, costante, invisibile nei volumi, e strettamente legato al trend della vol piuttosto che al trend del prezzo.

---

## Come leggerlo senza inseguirlo

Vanna è contesto, non un trigger. Una breve disciplina:

- **Controlla prima il trend della vol.** Un calo di IV su più giorni dopo un evento è lo schema classico del bid da vanna. Una vol in salita inverte il flusso verso le vendite. Nessun trend di vol, nessuna storia di vanna.
- **Conferma il regime.** Il vanna grind coesiste naturalmente con un regime di gamma positivo — entrambi favoriscono lo stesso tape calmo e assorbente. In un regime di gamma negativo lo stesso movimento di vol può essere sopraffatto da reazioni di prezzo amplificate. Leggi prima [gamma](/education/gamma-exposure-explained), vanna al suo interno.
- **Aspettati il grind, non un pop.** Gli acquisti da vanna sono un gocciolio. Producono deriva, non spinta. Se stai aspettando una candela da vanna, hai frainteso il flusso — si nasconde nella pendenza, non nel picco.
- **Rispetta la discrepanza dei volumi.** "Sale senza volumi" non è un campanello d'allarme in un regime di vanna; è la firma. L'assenza di volumi è l'indizio che gli acquisti sono meccanici.

Quando lo spavento che non arriva mai passa finalmente, la paura deve smaltirsi da qualche parte. Si smaltisce attraverso il book dei dealer, un ri-hedge alla volta, e sembra un mercato che decide silenziosamente di salire senza motivo. Ora conosci il motivo.

Per il fratello guidato dall'orologio vedi [Charm: l'orologio è un trader](/education/charm-the-clock-is-a-trader), per le fondamenta vedi [Perché i market maker sono costretti a scambiare azioni](/education/why-market-makers-trade-stock), e per vedere la scala di vanna muoversi con il book di oggi, apri la pagina live [Forced Flow](/forced-flow).

Contenuto solo a scopo educativo — nulla di quanto sopra è una raccomandazione di trading.
