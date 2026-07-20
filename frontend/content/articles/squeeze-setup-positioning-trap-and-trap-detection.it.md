# Squeeze Setup, Positioning Trap e Trap Detection: Tre Segnali, Tre Storie

Se hai passato del tempo nella scheda Signals, avrai probabilmente notato tre nomi che sembrano misurare la stessa cosa: Squeeze Setup, Positioning Trap e Trap Detection. Tutti e tre restituiscono un numero ordinato tra −1 e +1. Tutti e tre cambiano segno a seconda della direzione. E tutti e tre si accendono attorno agli stessi tipi di pivot.

Ma sotto il cofano, stanno rispondendo a tre domande molto diverse sul tape. Capire quale domanda pone ciascuno è la differenza tra anticipare un breakout e venirne travolti.

Questo articolo analizza cosa misura effettivamente ciascun segnale, come leggerlo e — cosa più importante — quando *non* fare trading basandosi su di esso.

---

## La Versione da 30 Secondi

| | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Domanda | "Il mercato è compresso come una molla?" | "La folla è posizionata male?" | "Questo breakout è appena fallito?" |
| Bias di Trading | Continuazione (nella direzione del movimento) | Mean-reversion (contro la folla) | Mean-reversion (di ritorno attraverso il livello violato) |
| Timeframe | Setup multi-giorno | Intraday (5–10 min) | Intraday → overnight |
| Input Principali | Flow, accelerazione del momentum, prontezza gamma | Put/call ratio, squilibrio smart-money | Prossimità ai wall, regime gamma, migrazione dei wall |
| Output | [-1, +1], attivato a ±0.25 | [-1, +1], continuo | [-1, +1], attivato a ±0.25 |

Tre segnali. Tre tesi. Stessa retta numerica.

---

## Squeeze Setup — "La Molla Compressa"

**Cosa misura:** Se la volatilità implicita si è compressa, la gamma è densa e il flow inizia a inclinarsi direzionalmente — cioè se il mercato ha accumulato energia potenziale per un breakout.

**Input:**

- Delta di flow su call e put, normalizzati per z-score in base alla volatilità di flow per simbolo
- Momentum a 5 barre vs. 10 barre (per rilevare l'accelerazione, non solo la direzione)
- Net gamma exposure, elaborata attraverso una tanh smussata per la "prontezza gamma"
- Distanza dallo strike di gamma flip
- Regime VIX (morto / normale / elevato / panico)

**Come viene calcolato:** Per ciascun lato (bull e bear), il segnale moltiplica flow normalizzato × forza del momentum direzionale × prontezza gamma × moltiplicatore di accelerazione × moltiplicatore lato-flip. Il punteggio netto è bull meno bear, limitato a [-1, +1]. I trigger scattano ad abs(score) ≥ 0.25.

**Cosa ne fa un trader:** Uno Squeeze Setup positivo che persiste per due sessioni consecutive è il cancello di attivazione per il playbook Squeeze Breakout — entrata su una rottura netta di un involucro di volatilità a 30 barre, nella direzione verso cui pende il segnale. I punteggi negativi rispecchiano questo sul lato ribassista.

> **Intuizione chiave:** Squeeze Setup è l'unico dei tre che vuole farti fare trading *nella stessa direzione* del movimento. È un segnale di continuazione.

---

## Positioning Trap — "Il Trade Affollato"

**Cosa misura:** Se la folla di opzioni è posizionata in modo sbilanciato (pesantemente long o pesantemente short) e il tape sta iniziando a invalidare quel bias — il classico setup per uno short-cover squeeze o un long-side flush.

**Input:**

- Momentum a 5 barre
- Put/call ratio (la misura dell'affollamento)
- Squilibrio smart-money con segno: (call_signed − put_signed) / (abs(call) + abs(put))
- Prossimità al gamma flip
- Regime Net GEX (smussato via tanh)

**Come viene calcolato:** Una somma pesata — 0.45 sull'affollamento, 0.25 sull'inclinazione dello squilibrio, 0.15 sul momentum, 0.10 sull'inclinazione del flip, 0.05 sul regime di GEX negativo — calcolata indipendentemente per il lato squeeze (folla long a rischio) e il lato flush (folla short a rischio). I due vengono nettati in un unico punteggio.

A differenza degli altri due, Positioning Trap non ha un flag di trigger — alimenta il composito MSI come componente continua (peso 0.06) e apre il playbook `positioning_trap_squeeze` ad abs(score) ≥ 0.5.

**Cosa ne fa un trader:** Identifica il lato affollato, poi aspetta che il tape si giri contro di esso. Una folla long non subisce uno squeeze finché non compaiono i venditori. Il segnale ti dice che il carburante c'è; il tape deve fornire la scintilla.

> **Intuizione chiave:** Positioning Trap fa da contrarian rispetto alla scommessa della folla.

---

## Trap Detection — "Il Breakout Fallito"

**Cosa misura:** Se il prezzo ha bucato un livello strutturale chiave — call wall, put wall, VWAP, strike di massima gamma o gamma flip — ma sta fallendo nel sostenere il movimento, segnalando che i dealer lo faranno tornare indietro.

**Input:**

- Call wall e put wall — e le loro posizioni precedenti (per rilevare la migrazione dei wall)
- Strike di massima gamma, VWAP, gamma flip
- Net GEX e il tasso di variazione del Net GEX
- Delta di flow su call/put (alla ricerca di decelerazione)
- Volatilità realizzata (usata per scalare il buffer di breakout)

**Come viene calcolato:** Prima, il segnale identifica il livello violato più vicino sopra e sotto la chiusura, e applica un buffer scalato per volatilità (~0.15% × σ × √5) per confermare una rottura reale. Poi per ciascun lato moltiplica la forza del breakout × fattore continuo di long-gamma × fattore di rafforzamento del GEX × penalità di migrazione dei wall × magnitudine × moltiplicatore di flow.

Il controllo di migrazione dei wall è ciò che rende diverso questo segnale: se il wall si è spostato *lontano* dal prezzo, il breakout è reale, non una trappola, e il punteggio viene pesantemente penalizzato.

**Cosa ne fa un trader:** Un fade ribassista attivato (il prezzo è salito rompendo un livello, ma i dealer sono long gamma e il flow sta decelerando) è il cancello per il playbook Overnight Trap Continuation — un debito 1DTE posizionato contro il falso breakout, mantenuto fino alla sessione successiva. I fade rialzisti rispecchiano questo sul lato ribassista.

> **Intuizione chiave:** Trap Detection fa da contrarian rispetto alla rottura di un livello strutturale da parte del prezzo.

---

## Stesso Numero, Significato Diverso

Ecco la trappola che intrappola i trader: tutti e tre i segnali stampano un punteggio [-1, +1], e un +0.6 su uno non è lo stesso trade di un +0.6 su un altro.

| Segno del Punteggio | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Positivo (+) | Compra il breakout al rialzo | Fai da contrarian alla folla short → squeeze al rialzo | Compra il breakdown fallito |
| Negativo (−) | Vendi il breakout al ribasso | Fai da contrarian alla folla long → flush al ribasso | Vendi il breakout fallito |
| Zero (0) | Nessuna energia compressa / nessuna inclinazione di flow | Nessun estremo della folla | Nessun livello strutturale in fase di rigetto |

Uno 0 non significa "mercato neutrale". Significa che *questa specifica domanda non ha risposta in questo momento*. Squeeze Setup a 0 non ti dice che il positioning è bilanciato — ti dice che nulla è compresso. Trap Detection a 0 non ti dice che la folla sta bene — ti dice che nessun livello sta venendo respinto.

Tre segnali stanno leggendo lo stesso tape attraverso tre lenti diverse. Trattali di conseguenza.

---

## Come Leggerli Insieme

Alcuni pattern da cercare:

**Confluenza (alta convinzione):** Squeeze Setup +0.5 e Trap Detection +0.4 → il mercato è compresso al rialzo e una rottura al ribasso è appena fallita. Entrambi i segnali puntano allo stesso trade da angolazioni diverse.

**Sequenza (entrate migliori):** Positioning Trap segnala una folla long a +0.7 → aspetta. Trap Detection poi passa a negativo (la rottura al rialzo fallisce) → quella è la scintilla. Fai il fade con la folla come carburante.

**Contraddizione (fermati):** Squeeze Setup dice +0.6 (vai long con la rottura). Trap Detection dice −0.5 (la rottura al rialzo sta fallendo). Uno dei due ha torto. Salta il trade.

I segnali sono indipendenti per un motivo — quando concordano, ascoltali. Quando sono in conflitto, il trade più intelligente è di solito nessun trade.
