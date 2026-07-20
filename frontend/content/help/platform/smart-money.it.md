# Smart Money

*La schermata smart-money — cosa qualifica un trade come smart-money, come si calcola il rapporto C/P e come usare il bias intraday.*

---

## Cosa significa "smart money" qui

Smart money è un'euristica — un'etichetta che applichiamo ai trade in opzioni che hanno l'impronta strutturale di una scommessa informata:

- **Dimensione** — premio e dimensione del contratto significativamente sopra la media per strike/scadenza.
- **Aggressività** — pagato al prezzo dell'offerta o oltre (acquisto) oppure venduto al bid (vendita), non a prezzi mid.
- **Ripetizione** — più stampe aggressive nella stessa direzione in una finestra temporale breve.
- **Premio di convinzione** — il trade paga una percentuale non trascurabile del valore del contratto.

Un singolo blocco da solo non basta a qualificarsi. Un pattern di trade di convinzione su uno strike sì.

## Cosa mostra questa pagina

### Il rapporto C/P smart-money

Il rapporto tra il premio call smart-money e il premio put smart-money. Una lettura ben sopra 1 indica che il flusso smart-money è strutturalmente orientato verso le call; ben sotto 1 indica le put. Questo **non** è lo stesso del PCR (put/call ratio) principale — filtra solo le stampe ad alta convinzione.

### Il tape smart-money

Un feed live di trade etichettati come smart-money — dimensione, premio, strike, scadenza, direzione, orario. Clicca per vedere il trade nel suo contesto.

### Il bias smart-money

Un chip di bias combinato — rialzista, ribassista, neutrale — costruito dal rapporto C/P più il flusso netto ponderato per premio sul sottoinsieme smart-money.

### La mappa di concentrazione per strike

Dove il flusso smart-money si è concentrato per strike, colorato per direzione. Utile per individuare "dove sta pendendo il grande capitale".

## Come usarla

Tre pattern:

1. **Smart-money fortemente long su call + composite positivo + gradiente GEX di supporto** ⇒ la lettura strutturale si allinea con il flusso smart-money. Direzionale ad alta convinzione.
2. **Smart-money fortemente long su put al put wall** ⇒ difesa o fading. Combinato con una lettura di Positioning Trap, può essere un counter-bias tradabile.
3. **Flusso smart-money neutrale, flusso principale forte** ⇒ il flusso principale è guidato dal retail; trattare con cautela.

## Cosa non è

L'etichetta smart-money è un'**euristica probabilistica**. Non ogni stampa smart-money è informata; non ogni trade informato viene segnalato. La pagina è più utile a **livello di bias** — qual è l'inclinazione cumulativa? — piuttosto che come segnale di trading su singole stampe.

## Il quadro d'insieme

Il flusso smart-money è uno dei diversi input nel segnale base di Positioning Trap (che usa lo sbilanciamento smart-money con segno) e nel Market Pressure Index (skew del flusso smart-money). La pagina smart-money è la lettura autonoma; i segnali sono le interpretazioni.

## Vedi anche

- [Analisi del flusso](/help/platform/flow-analysis)
- [Volume netto vs flusso direzionale](/education/net-volume-vs-directional-flow)
- [Segnale Positioning Trap spiegato](/education/positioning-trap-explained)
