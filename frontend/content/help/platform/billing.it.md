# Fatturazione e Portale Stripe

*Come funziona la fatturazione tramite Stripe, la differenza tra mensile e annuale, il cambio di livello, i metodi di pagamento e le fatture.*

---

## Come funziona la fatturazione

ZeroGEX fattura tramite **Stripe**. Non vediamo né conserviamo i dettagli della tua carta di pagamento — se ne occupa interamente Stripe. Ogni azione di fatturazione avviene nel portale di fatturazione ospitato da Stripe, accessibile dalla tua pagina [Account](/account).

## Piani e cadenze

Due livelli — **Basic** e **Pro** — ciascuno disponibile su base **mensile** o **annuale**.

- L'abbonamento annuale è offerto a un prezzo scontato rispetto a quello mensile. La percentuale esatta è indicata nella pagina [Pricing](/pricing).
- Il cambio tra le cadenze è supportato tramite il portale.

## Prova gratuita

Quando attivi un piano a pagamento, ottieni un periodo di prova gratuito (la durata è indicata nella pagina Pricing). Al termine della prova, l'abbonamento continua automaticamente al prezzo con cui ti sei iscritto — senza un secondo passaggio di conferma.

Per evitare questo rinnovo automatico: annulla nel portale prima che la prova termini. Manterrai l'accesso fino alla fine della prova.

## Come gestire il tuo abbonamento

1. Apri [Account](/account).
2. Clicca su "Manage subscription" — questo apre il portale Stripe in una nuova scheda.
3. Dal portale puoi:
   - Cambiare livello (Basic ↔ Pro)
   - Cambiare cadenza (mensile ↔ annuale)
   - Aggiornare il metodo di pagamento
   - Visualizzare e scaricare le fatture
   - Annullare l'abbonamento

## Upgrade e downgrade di livello

- **Upgrade (Basic → Pro)** — viene applicato il rateo (proration). L'accesso al livello si aggiorna immediatamente; la differenza calcolata pro rata (un credito per il tempo non utilizzato più l'addebito del nuovo livello) appare sulla tua **prossima fattura** invece di essere addebitata subito.
- **Downgrade (Pro → Basic)** — la modifica ha effetto alla fine del periodo di fatturazione corrente. Mantieni le funzionalità Pro fino ad allora.
- **Cambio di cadenza** — il passaggio da mensile ad annuale si applica immediatamente (con rateo sulla prossima fattura); il passaggio da annuale a mensile ha effetto alla fine del periodo corrente, come un downgrade.

## Annullamento

- L'annullamento ha effetto alla **fine del periodo di fatturazione corrente**. Mantieni l'accesso a pagamento fino ad allora.
- Al termine del periodo, il tuo livello torna a Public. Il tuo account non viene eliminato; i tuoi progressi nella formazione, i dati di referral e le impostazioni salvate rimangono.
- Puoi riabbonarti in qualsiasi momento.

## Metodi di pagamento

Stripe supporta carte, Apple Pay, Google Pay e (nella maggior parte delle regioni) bonifici bancari. Gestiscili tutti nel portale.

## Fatture e ricevute

Ogni addebito genera una fattura Stripe. Il portale elenca tutte le fatture passate con link di download in PDF. Le ricevute vengono inviate automaticamente anche via email.

## Pagamenti falliti

Se un addebito fallisce, Stripe riprova automaticamente nell'arco di diversi giorni. Durante la finestra di ritentativo, il tuo abbonamento è in stato "past due" — le funzionalità a pagamento restano disponibili temporaneamente. Se tutti i tentativi falliscono, l'abbonamento viene annullato e il livello torna indietro.

Le cause di fallimento più comuni: carta scaduta, mancata corrispondenza nella verifica dell'indirizzo, restrizioni regionali. Aggiorna il metodo di pagamento nel portale per risolvere.

## Rimborsi

La nostra pagina [Pricing](/pricing) documenta la politica di rimborso e annullamento. In breve: gli abbonamenti vengono fatturati in anticipo e non sono rateizzati in caso di annullamento, ma la prova è incondizionata — annulla prima che finisca e non ti verrà mai addebitato nulla.

Per le eccezioni, scrivi a [support@zerogex.io](mailto:support@zerogex.io).

## Passaggio da mensile ad annuale

La maggior parte degli utenti arriva a questo punto intorno al terzo mese — i conti tornano a tuo favore. Il portale gestisce il cambio: si applica immediatamente e il rateo (un credito per la parte non utilizzata del mese corrente più l'addebito annuale) compare sulla tua prossima fattura. Se sei ancora nella prova gratuita, il cambio mantiene la prova — non ti verrà addebitato nulla finché non termina, dopodiché ti verrà fatturata la tariffa annuale.

## Codici promo e coupon

I coupon promozionali vengono applicati al checkout. Se è attiva una promozione, la pagina Pricing mostra la tariffa scontata; altrimenti mostra la tariffa piena.

La **tariffa founding-member** è un percorso separato, riservato agli invitati — consulta la pagina [/founding](/founding) se disponi del codice di accesso.

## Vedi anche

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
