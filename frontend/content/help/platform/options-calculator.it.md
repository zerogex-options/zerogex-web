# Strategy Builder

*Valuta una strategia in opzioni, a singola o multipla gamba, ai prezzi live. Come scegliere una strategia, regolarne le gambe e leggere il grafico di profitti e perdite a scadenza.*

---

## Cos'è lo Strategy Builder

Lo Strategy Builder è lo **strumento di modellazione per singola operazione**. Scegli una strategia e ne regoli le gambe, la pagina la valuta ai prezzi live e tu leggi il suo profitto o la sua perdita a scadenza su un intervallo di prezzi.

È il posto in cui vai dopo che la dashboard ti dice "la struttura è rialzista" e devi scegliere lo strumento effettivo.

## Costruire una strategia

1. **Scegli un simbolo** (SPY, SPX, QQQ, NDX) con il selettore dei simboli.
2. **Scegli una strategia** dal menu **Strategy** - oltre 40 modelli, dalle singole call e put a verticali, straddle, strangle, iron condor, butterfly, ratio, backspread, calendar, diagonali, collar e sintetici. Ogni gamba parte da uno strike e una scadenza di default sensati.
3. **Regola le gambe** - ogni gamba in opzioni ha i propri menu **Exp** e **Strike**, alimentati dalla catena live.
4. **Imposta Contracts** - il numero di contratti, applicato a ogni gamba; una gamba con ratio mantiene il suo rapporto.

I prezzi delle gambe, il totale, il grafico e i breakeven si aggiornano a ogni modifica.

ES e NQ non hanno una catena di opzioni propria, quindi lo Strategy Builder non è disponibile per loro - passa a SPX o NDX.

## Come vengono prezzate le gambe

Ogni gamba in opzioni è prezzata alla sua **quotazione live**, aggiornata ogni pochi secondi: una gamba lunga all'**ask**, una gamba corta al **bid** - ciò che pagheresti o incasseresti davvero attraversando lo spread. Ogni gamba mostra il suo contratto, quel prezzo e il lato usato. Le gambe in azioni (in covered call, collar, conversion e simili) valgono 100 azioni per contratto, aperte allo spot attuale.

**Total position** somma tutto su ogni gamba e contratto: **debit** indica quanto costa aprire la struttura, **credit** quanto incassa.

## Il grafico P&L

**Profit / Loss at Expiration** mostra quanto vale la struttura il giorno della scadenza, al netto di quanto è costata o ha incassato all'apertura:

- Prezzo del sottostante sull'asse x - di default ±5% intorno allo spot. I pulsanti **+** e **-** ingrandiscono e riducono, **RESET** torna alla vista di default, e il selettore **%** / **$** etichetta ogni linea della griglia come movimento percentuale o in dollari dallo spot.
- P&L in dollari sull'asse y, per il numero di contratti impostato.
- Una linea tratteggiata allo spot attuale e una linea **BE** a ogni breakeven visibile.

Passa il mouse sulla curva per vedere il P&L a quel prezzo e la sua distanza dallo spot.

## Calendar e diagonali

Quando le gambe scadono in date diverse, il grafico valuta comunque ogni gamba al suo valore intrinseco, come se scadessero tutte insieme. Questo sottostima quanto vale ancora la gamba a scadenza più lontana, quindi la pagina lo segnala - usa la curva solo come indicazione di massima.

## Cosa non fa

Lo Strategy Builder è uno **strumento di pricing**, non uno strumento di instradamento ordini. Non si connette al tuo broker. Prendi la struttura e la implementi tu stesso.

Inoltre mostra solo il payoff a scadenza - non ci sono greche né curve per date precedenti alla scadenza.

## Nota sui livelli

Lo Strategy Builder è disponibile per i piani Basic e Pro.

## Vedi anche

- [Quotazioni Opzioni Live](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
