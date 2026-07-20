# Strategy Builder

*Costruisci qualsiasi strategia in opzioni, a singola o multipla gamba. Come il calcolatore effettua il pricing, come vengono calcolate le greche e come leggere gli scenari di P&L.*

---

## Cos'è lo Strategy Builder

Lo Strategy Builder è lo **strumento di modellazione per singola operazione**. Costruisci una strategia gamba per gamba, la pagina la valuta in tempo reale e tu leggi la superficie di P&L e le greche aggregate.

È il posto in cui vai dopo che la dashboard ti dice "la struttura è rialzista" e devi scegliere lo strumento effettivo.

## Costruire una strategia

1. **Scegli un simbolo** (SPY, SPX, QQQ).
2. **Aggiungi una gamba** — acquisto o vendita, call o put, strike, scadenza. La catena è live.
3. **Ripeti** per strutture multi-gamba (verticali, condor, calendar, ratio, straddle, strangle).
4. **Imposta lo spot per l'analisi** — di default è lo spot live, ma puoi testare qualsiasi prezzo come scenario.

Il prezzo aggregato, i breakeven e le greche si aggiornano a ogni modifica.

## Il modello di pricing

Il Builder utilizza **Black-Scholes** con la superficie di volatilità implicita live per ogni gamba. La superficie IV viene estratta dalla nostra pipeline dati — la stessa superficie che alimenta la catena nella pagina [Quotazioni Opzioni Live](/help/platform/option-contracts).

Per le considerazioni relative all'esercizio di tipo americano (rilevanti per ETF come SPY e QQQ), il modello approssima con un premio da esercizio anticipato sulle gambe deep ITM vicine alla scadenza. SPX ha esercizio di tipo europeo, quindi non viene applicato alcun aggiustamento.

## Il pannello delle greche

Per ogni gamba e per l'aggregato:

- **Delta** — esposizione direzionale
- **Gamma** — quanto si muove il delta rispetto allo spot
- **Theta** — decadimento temporale (al giorno)
- **Vega** — sensibilità alla IV (per variazione dell'1%)
- **Charm** — decadimento del delta (al giorno)

Le greche aggregate ti permettono di leggere una struttura multi-gamba con un solo colpo d'occhio — ad esempio, un calendar lungo è net long vega, short theta sul mese anteriore, long theta su quello posteriore.

## La superficie di P&L

Il grafico P&L 2D mostra:

- Prezzo spot sull'asse x.
- Valore del P&L sull'asse y.
- Curve multiple: a scadenza (il payoff), e in varie date tra oggi e la scadenza.

Puoi anche vedere i breakeven evidenziati sull'asse x.

## Test degli scenari

Il pannello degli scenari ti permette di far variare due variabili contemporaneamente — tipicamente spot e IV — e vedere la griglia di P&L risultante. Utile per:

- Una struttura long-vol: quanto guadagni con uno shock di 2 punti di volatilità?
- Un pin trade: quanto puoi perdere se lo spot diverge dell'1% dal max pain?

## Cosa non fa

Lo Strategy Builder è uno **strumento di pricing**, non uno strumento di instradamento ordini. Non si connette al tuo broker. Prendi la struttura e la implementi tu stesso.

## Nota sui livelli

Lo Strategy Builder è disponibile per i piani Basic e Pro.

## Vedi anche

- [Quotazioni Opzioni Live](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
