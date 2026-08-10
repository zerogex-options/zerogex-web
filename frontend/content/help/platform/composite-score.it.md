# Composite Score

*La lettura combinata del **regime** di mercato attuale — come viene costruita, perché non è un'indicazione di direzione e come usarla come filtro piuttosto che come previsione.*

---

## Cos'è il Composite Score

Il Composite Score — internamente **MSI**, il Market State Index — è il **riepilogo in un unico numero del regime attuale della struttura in opzioni** sul simbolo attivo. Risponde a una sola domanda: *è probabile che il tape vada in trend o in fase laterale (chop)?*

Si colloca su una **scala 0–100, dove 50 è neutro.** **Non** è un punteggio direzionale — non ti dice rialzo vs. ribasso. Un MSI alto significa che i trend hanno probabilità di *correre*; un MSI basso significa che il tape è *inchiodato, laterale o fragile*. Per la direzione, leggi [Trade Bias](/help/platform/trade-bias) — quella è la lettura con segno, rialzo-vs-ribasso.

> **Un MSI alto non significa "rialzista". Significa che i trend possono correre.**
> **Un MSI basso non significa "ribassista". Significa che è improbabile che i trend funzionino.**

## Le bande di regime

| Punteggio | Regime | Cosa significa |
| --- | --- | --- |
| ≥ 70 | **Trend / Expansion** | Regime direzionale forte — privilegia i trade nel bias prevalente |
| 40 – 70 | **Controlled Trend** | Edge direzionale moderato — opera con size ridotta |
| 20 – 40 | **Chop / Range** | Mercato laterale — fai fade degli estremi, evita i trade di trend |
| < 20 | **High-Risk Reversal** | Solo mean-reversion — rischio di movimenti estremi elevato, tape fragile |

Nota che le bande riguardano il *regime*, non la *direzione*. Un tape laterale segna **20–40 sia che il mercato stia salendo lentamente, sia che stia scendendo.** È voluto — un punteggio basso in un mercato in salita non è una contraddizione, è il gauge che ti dice che è improbabile che il movimento vada in trend in modo pulito.

## Come viene costruito

L'MSI combina **sei componenti indipendenti**, ciascuna valutata su una linea −1…+1 e ponderata in un budget di punti che somma a 100:

| Componente | Punti | Cosa legge |
| --- | --- | --- |
| Gamma Anchor | 30 | Prossimità al gamma flip, densità gamma locale, strike a max-gamma — inchiodato vs. libero |
| Order Flow Imbalance | 19 | Premio call vs. put dello smart-money — *l'unico input direzionale* |
| Dealer Delta Pressure | 17 | Direzione dell'hedging forzato dei dealer |
| Net GEX Sign | 16 | Dealer long gamma (smorza i movimenti) vs. short gamma (li amplifica) |
| Put/Call Ratio | 12 | Proxy di fragilità strutturale |
| Volatility Regime | 6 | Vol live vs. il pivot di volatilità a 20 |

Le componenti vengono sommate sulla baseline neutra a 50 tramite una combinazione a saturazione morbida (tanh), così che nessun singolo input possa inchiodare il gauge da solo. **Circa due terzi del peso è struttura priva di direzione** (Gamma Anchor, Net GEX Sign, Put/Call, Vol) — questi spingono verso il *trend* o il *chop*, non verso l'alto o il basso. Solo Order Flow Imbalance e Dealer Delta sono genuinamente direzionali, ed è per questo che un tape fortemente sbilanciato da un lato può spostare leggermente il punteggio, anche se il gauge è una lettura di regime.

Per ciascuna componente, **+1 depone per un regime tradabile / in trend; −1 depone per chop / inchiodamento / inversione.**

## Il gauge MSI

La pagina Composite Score mostra:

- Il **gauge MSI** — punteggio sull'arco 0–100, colorato per *banda di regime* (non per rialzo/ribasso).
- L'**etichetta di regime** — Trend / Expansion, Controlled Trend, Chop / Range o High-Risk Reversal.
- Il pannello delle **componenti contribuenti** — la spinta attuale di ciascun input, a destra per "trend", a sinistra per "chop / inversione", ordinato per magnitudine.
- Il **Δ dall'apertura** e il **Δ ultimi 5 min** — di quanto si è mosso il punteggio di regime (verso il trend se positivo, verso il chop se negativo). Sono momentum di regime, non direzione.
- Uno **sparkline** del punteggio nel corso della sessione.

## Interpretare il composite

Una regola semplice — leggilo come *quanto fidarti di un trend*, e prendi la direzione dal Trade Bias:

| Composite | Lettura |
| --- | --- |
| ≥ 70 | Regime in trend — i trend nel bias prevalente possono correre; spingi con il trend |
| 40 – 70 | Trend controllato — un edge reale ma moderato; riduci la size |
| 20 – 40 | Chop / range — fai fade degli estremi, non inseguire i breakout, privilegia il rischio definito |
| < 20 | Fragile / alto rischio di inversione — solo mean-reversion, aspettati breakout falliti |

Gli estremi più utili sono la parte alta e quella bassa. La zona centrale (~40–60) è una zona "nessun regime forte" — non forzare un trade di trend a partire da essa.

## Come usarlo

Tre schemi d'uso:

1. **Come manopola di convinzione sulla direzione.** Il Trade Bias ti dà il lato; l'MSI ti dice con quanta forza spingere. Bias long + MSI 75 → spingi. Bias long + MSI 25 → compra il ribasso in piccolo, fai fade degli estremi, non inseguire.
2. **Come filtro anti-chop.** Non aprire trade di trend/breakout quando l'MSI è basso (< 40) — il tape è laterale o in mean-reversion *indipendentemente dalla direzione*. Un punteggio basso non è un segnale per andare short.
3. **Come conferma del regime.** Le letture dell'MSI *tendono a* essere più forti e più persistenti nelle sessioni a negative gamma, coerentemente con il comportamento più direzionale che quei regimi tendono a mostrare.

## Cosa NON è

Il composite **non è un segnale di trading**, e **non è un'indicazione di direzione.** Ti dice che *tipo* di tape hai davanti — trend vs. chop; non ti dice in quale direzione, quale timeframe usare o dove posizionare lo stop. Abbinalo al Trade Bias (direzione) e ai singoli segnali (trigger).

## Perché il composite può ribaltarsi rapidamente

Due motivi:

- Un attraversamento del gamma flip può far oscillare con forza le componenti strutturali (Gamma Anchor, Net GEX Sign), spostando rapidamente la lettura di regime.
- Un brusco cambiamento del flusso smart-money muove l'unica componente direzionale abbastanza da spostare leggermente la combinazione.

Lo sparkline rende visibili questi cambi improvvisi — cerca le discontinuità.

## Abitudini dei trader che si sono rivelate efficaci

- Leggi l'MSI all'apertura e alle 11:00 / 12:30 / 14:30 ET come punti di controllo.
- Tratta l'MSI come **sizing** della posizione, e il Trade Bias come **direzione** della posizione.
- Tratta i punteggi tra ~40 e ~60 come "nessun regime forte — aspetta" piuttosto che come una direzione.

## Nota sui livelli

La pagina Composite Score è riservata al livello Pro. Il gauge MSI compare anche nella Dashboard per tutti i livelli a pagamento.

## Vedi anche

- [Trade Bias](/help/platform/trade-bias) — la lettura direzionale con segno
- [Come funzionano i segnali end-to-end](/help/platform/signals-overview)
- [Segnali: spiegati](/guides/signals-explained)
