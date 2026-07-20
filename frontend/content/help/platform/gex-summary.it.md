# GEX Summary & Greeks

*I numeri principali del GEX più gli aggregati di delta, gamma, vanna e charm.*

---

## Cosa mostra questa pagina

La pagina GEX Summary è l'**aggregazione per greca** del book di opzioni. Mentre Dealer Positioning è strutturale (walls, flip, profilo), questa pagina fornisce i totali numerici: delta, gamma, vanna, charm, vega aggregati.

## I cinque numeri principali

### Net GEX

Il gamma aggregato dei dealer in dollari. Positivo ⇒ i dealer comprano sulla debolezza, vendono sulla forza. Negativo ⇒ i dealer inseguono il prezzo. Mostrato allo spot.

### Net DEX

Il delta aggregato dei dealer. Un valore fortemente negativo significa che i dealer sono short di delta e devono strutturalmente comprare a prezzi più alti.

### Net VEX (Vanna)

La vanna aggregata dei dealer — la sensibilità del delta all'IV. Positiva significa che un calo dell'IV costringe i dealer a vendere; un aumento dell'IV li costringe a comprare. Questo è il motore delle giornate di "grind da compressione della volatilità".

### Net Charm

Il charm aggregato dei dealer — la sensibilità del delta al tempo. Positivo sostiene strutturalmente il drift verso la chiusura; negativo lo contrasta. Il flusso guidato dal charm si intensifica nelle ultime due ore.

### Net Vega

Il vega aggregato dei dealer. Indica quanto i dealer siano esposti a un movimento significativo dell'IV.

## Il dettaglio per strike

Sotto i totali, la pagina mostra gli stessi numeri suddivisi per strike — i contributi per strike a gamma, delta, vanna e charm. Usalo quando:

- Vuoi vedere **quali strike** stanno guidando il numero principale.
- Vuoi confermare che il call wall si trovi effettivamente dove indicato dal profilo GEX.
- Vuoi individuare una concentrazione di vanna o charm che il profilo GEX non rende evidente.

## Convenzioni sui segni

ZeroGEX usa in modo coerente la prospettiva del dealer:

- Gamma positivo ⇒ i dealer sono net long di call / short di put, e si coprono contro il prezzo.
- Delta positivo ⇒ i dealer sono long di delta.
- Vanna positiva ⇒ i dealer traggono beneficio (in termini di delta) quando la volatilità sale.
- Charm positivo ⇒ i dealer traggono beneficio (in termini di delta) col passare del tempo.

Quando consulti un altro provider di dati GEX, verifica sempre la convenzione dei segni. La maggior parte usa la stessa convenzione basata sulla prospettiva del dealer, ma alcuni la invertono.

## Come leggere la pagina

Due schemi:

1. **Verifica incrociata con Dealer Positioning.** Se il Net GEX è significativamente positivo ma il profilo GEX mostra la curva che scende in negativo appena sotto lo spot, ti trovi sulla linea di regime — il rischio è asimmetrico.
2. **Osserva vanna e charm verso la chiusura.** Entrambi raggiungono il picco di influenza intraday nelle ultime due ore; il contributo del charm per strike ti indica dove si posizionerà il pin.

## Vedi anche

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Vanna e Charm spiegati per i trader di opzioni](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) spiegato](/education/gamma-exposure-explained)
