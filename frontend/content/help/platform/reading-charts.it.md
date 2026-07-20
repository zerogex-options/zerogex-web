# Come leggere i grafici di ZeroGEX

*Un linguaggio visivo condiviso — colori, scale, comportamento al passaggio del mouse, legende e le note specifiche per il grafico del profilo GEX, i wall e le heatmap.*

---

## Il linguaggio dei colori

ZeroGEX utilizza una tavolozza piccola e coerente in tutti i grafici. Una volta compresa, ogni grafico si legge più velocemente.

- **Ambra / arancione caldo** — colore di accento; usato per gli avvisi, l'enfasi del brand e la traccia della score-line.
- **Verde** — rialzista, positivo, direzione long, guadagno.
- **Rosso** — ribassista, negativo, direzione short, perdita.
- **Blu / blu navy scuro** — informazione strutturale neutra; linee di riferimento, assi, baseline.
- **Corallo / rosa** — informativo secondario; tag smart-money, evidenziazioni speciali.

Il **significato** dei colori è stabile in tutti i grafici. Lo stesso verde è "rialzista" ovunque.

## La score line

Ogni score di segnale viene tracciato sullo stesso asse y **[-1, +1]** con la linea dello zero al centro. La colorazione di sfondo vicino alle soglie di trigger ricorda dove il segnale diventa operativo.

- Il colore della traccia codifica la magnitudine.
- Il segno codifica la direzione.
- Una linea tratteggiata orizzontale in corrispondenza della soglia di trigger rende visibile l'incrocio.

Per un approfondimento, vedi [Come leggere la Score Line [-1, +1]](/help/platform/score-line).

## Il grafico del profilo GEX

Un elemento cardine della pagina Dealer Positioning.

- **Asse X** — prezzo di strike.
- **Asse Y** — gamma del dealer in dollari, con segno.
- **Linea verticale** — spot attuale.
- **Punto in cui la curva attraversa lo zero** — il gamma flip.
- **Barre positive alte** — candidati a call wall.
- **Barre negative alte** — candidati a put wall.

Il grafico si centra automaticamente sullo spot. L'intervallo predefinito è di circa ±5% rispetto allo spot — abbastanza ampio da mostrare i wall strutturali, abbastanza stretto da mantenere leggibili gli strike rilevanti.

## Il grafico dei wall

Stessi dati del profilo GEX ma con la struttura dei wall evidenziata: il call wall, il put wall, il max pain e il gamma flip sovrapposti sullo stesso asse. Utilizzalo quando vuoi un'unica immagine che catturi l'intera lettura strutturale.

## La heatmap strike × DTE

Una heatmap 2D nella pagina Dealer Positioning.

- **Righe** — strike (ordinati intorno allo spot).
- **Colonne** — DTE (0DTE, 1DTE, settimanale, mensile).
- **Colore della cella** — gamma del dealer per quella combinazione strike/scadenza.

Le celle più "calde" sono gli strike che contano per le scadenze più vicine. Osserva come la heatmap si sposta durante la giornata — se la cella più luminosa salta di strike, il wall si sta muovendo.

## Il grafico a candele

Candele OHLC standard con VWAP e gli overlay gamma. Gli overlay sono il tocco distintivo di ZeroGEX:

- La linea del **gamma flip**.
- Le linee del **call wall** e del **put wall**.
- **Max pain** (dove rilevante).

Gli overlay ti permettono di leggere il price action attraverso la lente del dealer positioning senza uscire dal grafico.

## Comportamento al passaggio del mouse

La maggior parte dei grafici mostra un tooltip al passaggio del mouse con i valori precisi alla coordinata x del cursore. Il tooltip rispetta il linguaggio dei colori del grafico — il colore del chip del valore corrisponde alla serie.

## Legende

Le legende sono cliccabili nella maggior parte dei grafici — clicca su una serie per nasconderla. Utile per isolare un singolo segnale o un singolo greek.

## Sparkline

Le card dei segnali nelle dashboard utilizzano le sparkline — piccoli mini-grafici inline dello score nella finestra recente. La pendenza della sparkline è più informativa del suo livello assoluto: uno score a +0.4 in salita è una lettura diversa rispetto a +0.4 in discesa.

## Modalità chiara

Ogni grafico funziona sia nel tema scuro che in quello chiaro. Le **identità** dei colori restano le stesse; i **valori** si invertono per mantenere il contrasto. Verde-rialzista e rosso-ribassista sono stabili tra i temi.

## Errori comuni

- **Leggere l'asse sbagliato.** I grafici degli score sono [-1, +1]; i grafici GEX sono in dollari. Non confrontarli tra loro.
- **Trattare una sparkline come un grafico operativo.** Le sparkline sono contesto, non segnali di ingresso.
- **Leggere la heatmap da lontano.** Il punto centrale della heatmap è la texture — ingrandisci se le celle sono piccole.

## Vedi anche

- [Come leggere la Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Come leggere la Score Line [-1, +1]](/help/platform/score-line)
