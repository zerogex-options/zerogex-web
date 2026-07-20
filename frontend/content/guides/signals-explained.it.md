# Guida ZeroGEX™: i Segnali, Spiegati

*Tutti i segnali ZeroGEX in un'unica pagina — cosa chiede ciascuno, l'orizzonte temporale che legge, quando scatta e cosa significa realmente un punteggio positivo, negativo o pari a zero.*

---

## Come leggere questa guida

ZeroGEX gestisce due famiglie di segnali, e per progettazione si comportano in modo diverso.

I **segnali Advanced** rispondono a una domanda precisa e situazionale ("la chiusura si sta impuntando?", "questo breakout è appena fallito?"). Ciascuno produce un punteggio su una linea numerica **[-1, +1]** *e* un **trigger** discreto: quando il punteggio supera la soglia del segnale, scatta un alert e può abilitare un playbook. Sono guidati dagli eventi.

I **segnali Basic** sono continui. Non "scattano" — al contrario alimentano il **composito MSI** con un peso fisso, spingendo la lettura combinata verso l'alto o il basso a ogni aggiornamento. Li vedi come input per il quadro d'insieme, non come alert autonomi.

Prima di passare alle tabelle, tre cose vale la pena interiorizzarle:

- La linea del punteggio è sempre **[-1, +1]**. Il segno indica la direzione; la magnitudine indica la convinzione.
- Un punteggio di **0 quasi mai significa "mercato neutro".** Per la maggior parte dei segnali significa che *i dati sono insufficienti* oppure che *questa specifica domanda al momento non ha risposta*. Non leggere uno 0 come un via libera.
- I segnali Advanced **scattano**; i segnali Basic **pesano**. Ecco perché vedi alert in stile "BULLISH FADE" per alcuni segnali e mai per altri.

---

## La versione da 30 secondi

Cosa chiede ciascun segnale, la direzione verso cui pende, la finestra che legge, gli input principali che lo guidano e come si manifesta.

### Segnali Advanced

| Segnale | Chiede | Trade Bias | Timeframe | Input principali | Trigger / Output |
| --- | --- | --- | --- | --- | --- |
| EOD Pressure | "La chiusura si sta impuntando?" | Lettura direzionale | Ultimi 90 min (sale 14:30–15:45 ET) | Charm del dealer sullo spot, gravità del pin, volatilità realizzata, flag di witching | Punteggio [-1, +1]; scatta ad abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | "I livelli chiave si stanno sovrapponendo qui?" | Mean-rev (long gamma) / Continuation (short gamma) | Intraday continuo | Gamma flip, VWAP, max pain, strike a max-gamma, call wall | Punteggio [-1, +1]; scatta ad abs(score) ≥ 0.20 |
| Market Pressure | "Il mercato è carico per muoversi, e in che direzione romperà?" | Continuation | Prospettico; mix vanna→charm pesato sulla sessione | Wall pinch, prossimità al flip, regime di net-GEX, vanna/charm del dealer, DNI, skew tra premium e flow smart-money, IV rank, squeeze di vol realizzata | Punteggio [-1, +1] più loading 0–100; scatta a loading ≥ 50 E \|direction\| ≥ 0.20 |
| Range Break Imminence | "Questo range sta per rompersi?" | Cambio di regime / playbook | Finestra a 20 barre | Skew delta, delta del dealer, trap pressure, rapporto di compressione 10/60 barre | Punteggio [-1, +1] più imminence 0–100; scatta a imminence ≥ 65 |
| Squeeze Setup | "Il mercato è compresso a molla?" | Continuation | Setup multi-giorno | Flow z-score, momentum a 5/10 barre, gamma readiness, distanza dal flip, regime VIX | Punteggio [-1, +1]; scatta ad abs(score) ≥ 0.25 |
| Trap Detection | "Questo breakout è appena fallito?" | Mean-reversion (vs. rottura del prezzo) | Da intraday a overnight | Wall (attuali + precedenti), VWAP, flip, net GEX e ΔGEX, delta di flow | Punteggio [-1, +1]; scatta ad abs(score) ≥ 0.25 |
| Vol Expansion | "La volatilità sta per esplodere?" | Continuation | Finestra di momentum a 5 barre | Net GEX, z-score del momentum normalizzato per vol, volatilità realizzata | Punteggio [-1, +1]; scatta ad abs(score) ≥ 0.25 |
| Zero DTE Position Imbalance | "I trader 0DTE stanno pendendo da una parte?" | Lettura direzionale | Sessione 0DTE (pesata per ore alla chiusura) | Squilibrio call/put flow, rapporto C/P smart-money, PCR, bucket di moneyness | Punteggio [-1, +1]; scatta ad abs(score) ≥ 0.25 |

### Segnali Basic

| Segnale | Chiede | Trade Bias | Timeframe | Input principali | Peso nel Composite |
| --- | --- | --- | --- | --- | --- |
| Dealer Delta Pressure | "I dealer sono costretti a inseguire questo movimento?" | Lettura direzionale | Intraday immediato | Delta netto del dealer (call_delta_oi + put_delta_oi), distribuzione OI per strike | Peso MSI 0.08 |
| GEX Gradient | "Il gamma è accumulato da un lato?" | Lettura direzionale | Snapshot per strike (al refresh del GEX) | Gamma sopra lo spot, gamma sotto lo spot, concentrazione ATM, frazione sulle ali, volatilità realizzata | Peso MSI 0.08 |
| Positioning Trap | "La folla è fuori posizione?" | Mean-reversion (vs. folla) | Intraday (5–10 min) | PCR, squilibrio smart-money con segno, momentum a 5 barre, inclinazione al flip, regime di net GEX | Peso MSI 0.06 |
| Skew Delta | "Quanto la paura è scommessa sulle put?" | Lettura direzionale | Intraday (al refresh delle quote) | IV delle put OTM, IV delle call OTM, spread vs. baseline | Peso MSI 0.04 |
| Tape Flow Bias | "Da che parte pende il tape?" | Continuation | Finestra rolling breve (Lee-Ready) | Premium in acquisto/vendita sulle call, premium in acquisto/vendita sulle put, flow totale di premium | Peso MSI 0.08 |
| Vanna/Charm Flow | "Vol o tempo costringeranno i dealer a ri-coprirsi?" | Continuation | Intraday (charm sale nelle ultime 2 ore) | Vanna aggregata del dealer, charm aggregato del dealer, moltiplicatore charm legato all'orario di sessione | Peso MSI 0.04 |

---

## Cosa significa il segno del punteggio

Stessa linea numerica, domande molto diverse. Ecco cosa significano positivo, negativo e zero per ciascun segnale — leggi con attenzione la **colonna dello zero**, è lì che avvengono la maggior parte delle letture errate.

### Segnali Advanced

| Segnale | Punteggio positivo | Punteggio negativo | Zero |
| --- | --- | --- | --- |
| EOD Pressure | Pressione di pin rialzista (charm in acquisto + gamma che tira su) | Pressione di pin ribassista (charm in vendita + gamma che tira giù) | Nessuna compressione di pin o attività di charm nella finestra finale |
| Gamma/VWAP Confluence | Prezzo sopra il cluster di confluenza (fade verso il basso sotto long gamma / accelerazione verso l'alto sotto short gamma) | Prezzo sotto il cluster di confluenza (speculare) | Input principali mancanti (flip / VWAP non disponibili) — *non* "neutro" |
| Market Pressure | Loading rialzista — i dealer sono costretti a comprare a qualsiasi catalyst (inclinazione vanna+charm verso l'alto, flow lato call, dealer short delta) | Loading ribassista — i dealer sono costretti a vendere a qualsiasi catalyst (speculare) | Manca un pilastro (nessun wall, nessun flip, nessuna greca, nessun flow) oppure la molla non è realmente caricata — non "mercato neutro". Quando è caricato con direction = 0, le forze opposte si stanno annullando. |
| Range Break Imminence | Rottura rialzista imminente (pressione strutturale al rialzo allineata) | Rottura ribassista imminente | Imminence bassa — resta in modalità range-fade; nessun loading di rottura |
| Squeeze Setup | Compra il breakout al rialzo (flow sulle call + accelerazione al rialzo) | Vendi il breakout al ribasso (flow sulle put + accelerazione al ribasso) | Nulla è compresso — nessuna energia a molla, nessuna inclinazione di flow |
| Trap Detection | Compra il breakdown fallito (la rottura al ribasso non regge) | Vendi il breakout fallito (la rottura al rialzo non regge) | Nessun livello strutturale viene rigettato in questo momento |
| Vol Expansion | Momentum rialzista + capacità di espansione della vol (dealer short gamma) | Momentum ribassista + capacità di espansione della vol | Nessun momentum, oppure GEX positivo che smorza il movimento |
| Zero DTE Position Imbalance | Posizionamento 0DTE sbilanciato sulle call (skew di flow al rialzo) | Posizionamento 0DTE sbilanciato sulle put (bid di protezione al ribasso) | Flow 0DTE bilanciato — o segnale dormiente fuori dagli orari RTH |

### Segnali Basic

| Segnale | Punteggio positivo | Punteggio negativo | Zero |
| --- | --- | --- | --- |
| Dealer Delta Pressure | Dealer long delta — devono vendere i rally (ribassista) | Dealer short delta — devono comprare i dip (rialzista) | Book del dealer bilanciato o OI insufficiente |
| GEX Gradient | Gamma accumulato sotto lo spot (amplificatore ribassista in short gamma; smorzato in long gamma) | Gamma accumulato sopra lo spot (bias ribassista) | Gradiente piatto o OI insufficiente |
| Positioning Trap | Folla long fuori posizione — loading di short-cover squeeze al rialzo | Folla short fuori posizione — loading di flush al ribasso | Nessun estremo di folla rilevato |
| Skew Delta | Skew delle put *sotto* la baseline — la paura si sta sciogliendo (inclinazione rialzista) | Skew delle put elevato — la paura è scommessa (inclinazione ribassista) | Skew sulla baseline, o dati mancanti |
| Tape Flow Bias | Domina l'acquisto aggressivo di call sul tape (convinzione rialzista) | Domina l'acquisto aggressivo di put sul tape (convinzione ribassista) | Flow di premium bilanciato o volume insufficiente |
| Vanna/Charm Flow | L'hedging del dealer è un vento a favore in acquisto (vol-crush / decay) | L'hedging del dealer è un vento contrario in vendita (vol-up / unwind) | Esposizione del dealer bilanciata o righe dealer mancanti |

---

## Uno zero (quasi) non è mai "neutro"

Questa è la lettura errata più comune in assoluto, per questo merita una sezione a sé.

> Un punteggio di 0 di solito significa *dati insufficienti* oppure *questa specifica domanda al momento non ha risposta* — **non** "il mercato è bilanciato, fai trading liberamente."

Quando Gamma/VWAP Confluence restituisce 0 perché il gamma flip o il VWAP non sono disponibili, è un *punto cieco*, non un tape calmo. Quando EOD Pressure è 0 fuori dalla finestra di chiusura, la domanda semplicemente non si applica ancora. Tratta uno 0 come "questa lente è spenta", dimensiona di conseguenza, e affidati ai segnali che *stanno* riportando dati.

## I quattro bucket di trade-bias

Il "Trade Bias" di ogni segnale rientra in una di quattro famiglie. Sapere in quale bucket vive un segnale ti dice come agire ancora prima di leggere il punteggio.

- **Continuation (5):** Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow — questi dicono *il movimento ha carburante; cavalcalo*.
- **Mean-reversion (2):** Positioning Trap, Trap Detection — questi dicono *il movimento è eccessivo o falso; sfumalo*. Gamma/VWAP Confluence si unisce a questo bucket quando i dealer sono long gamma.
- **Directional read (5):** EOD Pressure, Zero DTE Imbalance, Dealer Delta Pressure, GEX Gradient, Skew Delta — questi ti dicono *in che direzione punta la pressione*, senza prescrivere da soli se cavalcare o sfumare.
- **Regime / structural (1):** Range Break Imminence — questo da solo cambia il playbook, facendoti passare tra modalità range-fade e breakout.

Quando più segnali dello **stesso** bucket si allineano, la convinzione si moltiplica. Quando i segnali di Continuation e Mean-reversion sono in disaccordo, quel conflitto è di per sé informazione: il tape è conteso.

## Trigger booleani vs. pesi nel composito

I segnali Advanced e Basic non sono semplicemente versioni "più difficili" e "più facili" l'uno dell'altro — sono collegati al sistema in modo diverso.

- **I segnali Advanced fanno scattare trigger discreti.** Quando il punteggio supera la soglia (es. abs(score) ≥ 0.25 per Squeeze Setup), il segnale *scatta*: fa scattare un alert e può abilitare un playbook. Tra un trigger e l'altro è informativo.
- **I segnali Basic non scattano mai.** Sono input continui per il composito MSI, ciascuno con un peso fisso (da 0.04 a 0.08). Contribuiscono sempre, non generano mai alert.

Ecco *perché* vedi alert in stile "BULLISH FADE" solo per alcuni segnali e non per altri — i segnali Basic fanno il loro lavoro silenziosamente dentro il composito per tutto il tempo.
