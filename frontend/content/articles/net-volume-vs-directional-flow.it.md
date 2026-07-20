# Net Volume vs Directional Flow: cosa conta davvero nel tape delle opzioni?

*La maggior parte dei trader dibatte tra put/call volume e directional flow. I professionisti trattano solitamente questo confronto come un primo passo, per poi concentrarsi rapidamente sulle metriche pesate per premium.*

---

## La risposta onesta: nessuna delle due è uno standard d'oro da sola

Se cerchi una metrica perfetta unica, resterai deluso.

**Cumulative Net Volume** e **Cumulative Net Directional Volume** sono entrambe utili, ma rispondono a domande diverse. I desk di flow più seri monitorano tipicamente entrambe, per poi dare il peso maggiore alle metriche di premium quando devono valutare la conviction.

---

## Metrica 1: **Cumulative Net Volume**

*(Call Volume − Put Volume)*

Questa è di fatto l'inquadratura inversa del classico put/call ratio.

È ampiamente utilizzata perché semplice, rapida e disponibile ovunque. Ma è anche una misura grezza.

Il punto debole principale: **non può dirti chi ha iniziato lo scambio né perché.**

Un'impennata nel call volume potrebbe significare:
- speculazione direzionale al rialzo,
- covered call overwriting,
- gestione dell'inventario da parte del dealer,
- oppure attività di hedge roll.

Il volume da solo non può separare la conviction dalla meccanica.

---

## Metrica 2: **Cumulative Net Directional Volume**

*((Calls Bought − Calls Sold) − (Puts Bought − Puts Sold))*

Questa metrica cerca di rispondere a una domanda migliore:

> **Chi è stato l'aggressore?**

Quando i trader sollevano l'ask, esprimono di solito urgenza e intento direzionale. Quando colpiscono il bid, di solito stanno riducendo il rischio, incassando premium o facendo fade.

In teoria, questo rende il directional volume più informativo del volume grezzo.

Ma presenta una debolezza reale: **la classificazione del lato dello scambio è imperfetta.**

La maggior parte dei sistemi deduce l'intento di compratore/venditore dalla vicinanza a bid/ask. Questo approccio fallisce quando:
- i blocchi si stampano vicino al mid,
- avvengono crossing negoziati fuori schermo,
- oppure esecuzioni dark/complesse non si mappano in modo pulito sulle quotazioni lit.

Ironicamente, questi trade "disordinati" sono spesso gli stampi istituzionali più significativi.

---

## Su cosa si concentrano davvero i team di flow professionali

### Premium, non contratti.

Un blocco da 50.000 lotti in call settimanali economiche da lotteria può sembrare enorme in termini di volume, pur rappresentando un capitale modesto. Un blocco da 500 lotti su contratti deep ITM può portare un rischio nozionale e un'informazione decisamente maggiori.

Ecco perché i desk tendono a dare priorità al **flow pesato per capitale**, non al conteggio dei contratti.

Il tuo campo:

**Cumulative Net Premium**

`= (calls bought premium − calls sold premium) − (puts bought premium − puts sold premium)`

è generalmente una lettura singola più forte su dove si sta orientando il denaro informato, perché riflette i dollari effettivamente impegnati.

---

## Classifica pratica per la conviction

Se l'obiettivo è la qualità della conviction direzionale:

1. **Net directional premium** (miglior segnale singolo)
2. **Net directional volume** (meglio del volume grezzo)
3. **Net volume** (contesto utile, il più debole da solo)

O in una riga:

> **Il Net Directional Volume batte il Net Volume in termini di conviction, ma il Net Directional Premium è ciò a cui i desk di flow più seri danno solitamente più peso.**

---

## Come usarlo in un flusso di lavoro live

Una sequenza pratica che i trader possono applicare in intraday:

- Inizia con il **net volume** per leggere la partecipazione complessiva.
- Conferma con il **net directional volume** per stimare l'intento dell'aggressore.
- Valida con il **net directional premium** prima di assumere rischio.
- Se volume e premium sono in disaccordo, fidati dei dollari più dei contratti.

Nessun singolo pannello dovrebbe guidare da solo l'intero albero decisionale. Ma il directional flow pesato per premium ti terrà solitamente più vicino al segnale del "denaro informato" e più lontano dagli stampi rumorosi da titolo.
