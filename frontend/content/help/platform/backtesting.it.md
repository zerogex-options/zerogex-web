# Backtesting

*Riesegui qualsiasi segnale ZeroGEX o una regola personalizzata sui dati storici delle opzioni, valutata come veri round trip su gambe di opzioni — al netto di slippage e commissioni — con un tearsheet completo aggiustato per il rischio, un cono di esiti Monte Carlo e risultati suddivisi per regime di gamma.*

---

## Cos'è la pagina Backtesting

La pagina Backtesting ti permette di verificare come si sarebbe comportata una regola sui dati storici e di vederla prezzata come un trade reale — attraversando lo spread bid/ask, pagando la commissione e restando esposta al drawdown della posizione aperta. È uno **strumento di ricerca**: usalo per mettere sotto pressione le tue idee e scartare quelle che non reggono, non per costruire una curva che sembri bella.

## Cosa puoi sottoporre a backtest

- **Pattern del Playbook** — uno qualsiasi dei pattern di segnale integrati che guidano le Action Card live (rottura del gamma flip, fade sul call wall, rimbalzo sul put wall, drift di pressione a fine giornata, e altri), da soli o come basket.
- **Strategie personalizzate** — un condition builder sulla struttura di mercato al minuto (net GEX / net GEX at spot, distanza dal gamma flip, distanze dal call/put wall, put-call ratio, MSI e regime MSI, convexity, …) compilato in entrate.
- **Strutture di opzioni reali** — opzioni singole ATM, verticali a rischio definito, e straddle, strangle e iron condor neutrali.

## Le manopole dei parametri

- **Simbolo** — SPY / SPX / QQQ
- **Intervallo di date** — fino alla profondità di storico disponibile (indicata nel form)
- **Entrata** — un basket di pattern, oppure una regola condizionale personalizzata in AND
- **Uscita** — target/stop sul livello del sottostante, un overlay take-profit / stop-loss sul premio dell'opzione, e uno stop temporale di durata massima della posizione (scatta il primo che si verifica)
- **Modello di fill** — % di slippage e commissione per contratto (entrambe applicate — vedi sotto)
- **Dimensionamento** — capitale, rischio per trade, numero massimo di posizioni concorrenti, e limiti opzionali di net-delta / net-vega
- **Sweep dei parametri** — esegui una griglia su uno o due assi per confrontare le impostazioni fianco a fianco

## Gli output

### La curva dell'equity

Il valore del tuo account nel corso della run, marcato **a mercato** — le posizioni aperte vengono prezzate a ogni barra, quindi un trade in perdita non realizzata si riflette sulla curva e sul max drawdown. Il drawdown è calcolato picco-valle su questa curva, non solo sulle perdite realizzate.

### Il tearsheet di performance

La batteria di metriche aggiustate per il rischio che un lettore serio controlla per primo:

- **Sharpe, Sortino, Calmar** e **CAGR**
- **Volatilità annualizzata**, **esposizione**, e la **serie massima di perdite**
- **Expectancy per trade**, **payoff ratio**, vincita e perdita media e massima
- Un **edge t-stat** — il risultato medio del trade è distinguibile dal rumore (|t| ≥ 2)?
- Un **benchmark**: il tuo rendimento a confronto con il semplice buy-and-hold del sottostante nello stesso periodo, e l'eccesso di rendimento.

### Il cono di esiti Monte Carlo

La sequenza dei tuoi trade ricampionata in mille modi diversi, perché una singola curva di equity può sembrare un destino ineluttabile quando non lo è. Ottieni la **probabilità di chiudere in profitto**, il **rischio di rovina** (probabilità di un drawdown ≥50%), l'intervallo **p5 / p50 / p95** dei rendimenti e dei drawdown massimi, e un **cono di equity** sfumato che indica dove l'account può plausibilmente arrivare.

### Risultati per regime di mercato

Il taglio distintivo di ZeroGEX: le stesse regole suddivise per **contesto di dealer-gamma** (gamma positivo/soppressivo vs. negativo/amplificante) e per **regime MSI**, con win rate, P&L netto e expectancy per ciascuno. Una regola che rende nelle sessioni a gamma negativo e perde in quelle a gamma positivo è una scommessa sul regime — ed è qui che lo scopri.

### Il registro dei trade

Ogni round trip con premio di entrata/uscita, contratti, net Δ/vega, il regime all'entrata, P&L netto ed esito. Esporta l'intero registro in CSV.

## Come vengono modellati i fill

- **Sensibile allo slippage.** Ogni gamba viene eseguita attraverso lo spread quotato — compri all'ask, vendi al bid — allargato dalla tua impostazione di slippage. Questo è il costo dominante e realistico sugli 0DTE.
- **Sensibile alla commissione.** La commissione è addebitata per contratto, per gamba, sia in entrata che in uscita, ed è integrata nel dimensionamento della posizione.
- **Sensibile al rischio definito.** Le strutture multi-gamba sono vincolate alla loro perdita massima / guadagno massimo no-arbitrage, così una quotazione illiquida vicino alla scadenza non può registrare un risultato impossibile.

I rendimenti riportati sono **al netto di tutto quanto sopra** — i numeri che vedi sono dopo i costi, non lordi.

## Cosa **non** è il backtester

- **Non è un previsore.** Le performance passate non predicono i rendimenti futuri. Usa il backtester per **scartare** regole che sembrano deboli, non per "trovare" regole che sembrano buone.
- **Non sostituisce la disciplina out-of-sample.** Il cono Monte Carlo e l'edge t-stat ti dicono quanto è fragile un risultato, ma l'abitudine resta fondamentale: progetta su un periodo, conferma su un altro tenuto da parte.
- **Limitato dalla profondità dei dati.** Puoi testare solo la finestra archiviata dalla piattaforma. Una finestra breve è un campione piccolo — leggi il t-stat e l'intervallo Monte Carlo di conseguenza, e affidati alla suddivisione per regime per sapere da quale contesto provengono i tuoi numeri.

## Leggere i risultati con onestà

> Giudica una regola dai suoi numeri **aggiustati per il rischio** e dal suo **intervallo di esiti**, non dalla sua migliore singola riga.

Un win rate alto con un payoff ratio sotto 1 e un ampio cono Monte Carlo non è un edge. Un win rate modesto con expectancy positiva, un t-stat oltre 2, un drawdown contenuto e coerenza tra i regimi di gamma lo è. Verifica sempre quale regime ha prodotto il risultato — e se regge in quello in cui stai facendo trading oggi.

## Nota sul livello

Il Backtesting è una funzionalità Pro.

## Vedi anche

- [Composite Score](/help/platform/composite-score)
- [Come funzionano i segnali dall'inizio alla fine](/help/platform/signals-overview)
