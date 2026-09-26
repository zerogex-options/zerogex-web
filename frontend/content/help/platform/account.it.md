# Impostazioni account

*Email, password, provider di accesso collegati (Google/Apple), livello e stato del piano, e come gestirli in sicurezza.*

---

## Cosa fa la pagina Account

La pagina [Account](/account) è il punto di riferimento unico per tutto ciò che riguarda l'utente: la tua email, il tuo abbonamento, i tuoi metodi di accesso, le notifiche, il pannello referral e l'eliminazione dell'account.

## L'intestazione

Mostra la tua email e il tuo livello (Public, Basic, Pro o Admin). Sotto Pro, un pulsante **Esegui upgrade** accanto al tuo livello ti porta a [Pricing](/pricing). Se la tua email non è ancora verificata, un banner in cima alla pagina te lo segnala.

## Email e verifica

- L'indirizzo email con cui ti sei registrato è l'ID del tuo account. Non può essere modificato senza passare dall'assistenza.
- I nuovi account devono verificare l'email - un link di verifica viene inviato al momento della registrazione e scade dopo 24 ore. Finché non la verifichi, non puoi avviare una prova né abbonarti.
- Se non hai ricevuto il messaggio originale, clicca su **Resend** nel banner di verifica in cima alla pagina Account.

## Password

- Imposta una password se ti sei registrato con Google o Apple e vuoi avere un'alternativa. In Metodi di accesso, il pulsante **Imposta password** appare per gli account senza password.
- Per cambiare una password esistente, clicca su **Reimposta password**: ti inviamo via email un link per impostarne una nuova.
- La lunghezza minima è di 12 caratteri.
- Usa un gestore di password. Non applichiamo regole di complessità: la lunghezza e l'unicità contano più della varietà di caratteri.

## Provider di accesso collegati

Puoi collegare **Google** e **Apple** allo stesso account. La sezione Metodi di accesso mostra quali provider sono connessi. Se accanto ad Apple compare «Prossimamente», l'accesso con Apple non è ancora attivo.

- **Collegare un nuovo provider** - clicca su **Connetti** accanto al provider, oppure accedi una volta con il provider; il sistema lo collega automaticamente al tuo account esistente se l'email corrisponde.
- **Scollegare un provider** - clicca su **Disconnetti**. È possibile solo se hai almeno un altro modo per accedere (un altro provider O una password). La pagina impone questa regola per evitare che tu resti bloccato fuori dall'account.

## Livello e abbonamento

- Il tuo livello attuale è mostrato in cima alla pagina.
- **Gestisci abbonamento**, nella sezione Abbonamento, apre il portale di fatturazione ospitato da Stripe. Cambio piano, metodi di pagamento, fatture e cancellazione avvengono tutti lì.
- Puoi anche annullare con il link **Cancel subscription** sotto quel pulsante, che in alternativa ti propone una pausa da uno a tre mesi se ti basta una pausa.
- Se un pagamento non va a buon fine, la sezione lo segnala e il pulsante diventa **Apri il portale di fatturazione**, dove puoi saldare la fattura aperta con qualsiasi carta o aggiornare il metodo di pagamento.
- Entro 7 giorni dal primo pagamento di un piano coperto dalla garanzia soddisfatti o rimborsati di 7 giorni (Pro, o qualsiasi piano trimestrale o annuale), clicca su **Richiedi il rimborso completo** nella pagina Account. L'accesso termina quando il rimborso viene emesso; un rimborso per cliente.

Per la procedura dettagliata, vedi [Fatturazione e portale Stripe](/help/platform/billing).

## Accesso API (Pro)

Con Pro, nella sezione **API Access** crei e revochi le tue chiavi API personali. Le chiavi vengono revocate automaticamente se il tuo piano scende sotto Pro. Vedi [API Access & Keys (Pro)](/help/platform/api-access).

## Notifiche

**Gestisci notifiche** apre una pagina dedicata ai bot TradeWorkz™ che segui, dove scegli come ti raggiunge ciascuno: in app, via email o tramite webhook.

## Social media

Puoi aggiungere facoltativamente il tuo **handle X (ex Twitter)** nella sezione Social Media, in modo che il team ZeroGEX possa contattarti lì. Non è mai obbligatorio: non ti viene richiesto in fase di registrazione e puoi aggiungerlo, modificarlo o rimuoverlo in qualsiasi momento dal tuo account.

- Inserisci l'handle con o senza la `@` iniziale - 1-15 caratteri, solo lettere, numeri e underscore.
- Svuota il campo e salva per rimuovere un handle aggiunto in precedenza.

## Pannello referral

Se il programma referral è attivo, la sezione **Invita un amico** mostra:

- Il tuo link referral, con un pulsante **Copia link**
- **Iscritti** - quante persone si sono iscritte tramite il tuo link (passa il mouse per vedere i loro indirizzi email)
- **Abbonati** - quante di loro hanno sottoscritto un piano a pagamento (passa il mouse per vedere chi)
- **Mesi gratuiti guadagnati**
- **Mesi accumulati** - mesi gratuiti in attesa di essere applicati al tuo prossimo abbonamento (visibile solo se ne hai)
- Il credito che verrà applicato alla tua prossima fattura, quando presente

Per le regole del programma, vedi [Referral](/help/platform/referrals).

## Disconnessione

Apri il menu profilo nell'intestazione e scegli **Esci** (da smartphone, **Esci** si trova nel menu). Questo cancella il cookie di sessione. Accedi di nuovo da [/login](/login).

## Eliminare il tuo account

Scorri fino a **Delete account**, in fondo alla pagina Account, clicca su **Delete my account**, digita DELETE e clicca su **Permanently delete account**. L'eliminazione annulla subito qualsiasi abbonamento attivo, ti disconnette, revoca le tue chiavi API e interrompe tutte le nostre email. Non si può annullare dalla pagina: per recuperare l'accesso in seguito, scrivi a [support@zerogex.io](mailto:support@zerogex.io). La nostra politica sulla [Privacy](/privacy) spiega come vengono trattati i dati dell'account.

## Vedi anche

- [Fatturazione e portale Stripe](/help/platform/billing)
- [Referral](/help/platform/referrals)
- [Preferenze email](/help/platform/email-preferences)
