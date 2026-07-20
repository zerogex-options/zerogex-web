# Risoluzione dei problemi

*L'elenco essenziale — problemi di accesso, dati mancanti, grafici non aggiornati, problemi di pagamento, cache del browser e quando scrivere al supporto.*

---

## Impossibile accedere

**Hai dimenticato la password.** Usa [Password dimenticata](/forgot-password). Ti verrà inviato un link via email; clicca e imposta una nuova password. Se l'email non arriva, controlla lo spam.

**Ti sei registrato con Google o Apple e non hai una password.** Accedi tramite il provider che hai usato. Dalla pagina Account potrai poi impostare una password come alternativa futura.

**Il provider dice "nessun account trovato".** Potresti esserti registrato con un'email diversa. Prova l'altro provider, oppure scrivi a [support@zerogex.io](mailto:support@zerogex.io) — possiamo verificare l'account.

**La richiesta di autenticazione a due fattori o del dispositivo non scompare.** Accedi da zero da una finestra in incognito. Se il problema persiste, il supporto può cancellare le sessioni obsolete sul tuo account.

## Dati mancanti o non aggiornati

**Il badge di sessione indica Chiuso.** È normale — i mercati sono chiusi. Vengono mostrati gli ultimi valori calcolati.

**Un grafico indica "nessun dato".** Di solito è un problema legato alla finestra di sessione (EOD Pressure fuori dalla sua finestra, 0DTE in un giorno senza scadenza). Passa il mouse sullo stato vuoto — il tooltip spiega il motivo.

**I valori dei tile sembrano bloccati.** Controlla il timestamp sul tile del prezzo. Se è più vecchio di 30 secondi durante l'orario regolare, ricarica la pagina forzatamente (Cmd+Shift+R / Ctrl+Shift+R).

**Il signal score mostra 0.** Di solito significa "nessuna lettura", non "neutro". Vedi [Leggere la Score Line [-1, +1]](/help/platform/score-line).

## Pagamenti

**La carta è stata rifiutata.** Aggiorna il metodo di pagamento nel portale di fatturazione Stripe (raggiungibile dalla pagina [Account](/account)). I rifiuti più comuni sono dovuti a carte scadute, indirizzi non corrispondenti o restrizioni regionali.

**L'abbonamento indica "scaduto".** Stripe sta ritentando l'addebito. Aggiorna il metodo di pagamento per risolvere. Le funzioni a pagamento restano attive durante la finestra di tentativi.

**La fattura è più alta del previsto.** Apri la fattura nel portale — le voci sono dettagliate. Sorprese comuni: un cambio di piano o di cadenza viene calcolato in proporzione — ricevi un credito per la parte non utilizzata del periodo corrente più l'addebito del nuovo piano, applicato alla **prossima fattura** anziché addebitato immediatamente.

**La cancellazione non è andata a buon fine.** La cancellazione ha effetto alla fine del periodo di fatturazione. Fino ad allora, mantieni l'accesso a pagamento. Il portale mostra la data di fine prevista.

## Livello e accesso

**Una pagina reindirizza a /pricing invece di aprirsi.** Quella pagina richiede un livello che non hai attualmente. [Pricing](/pricing) mostra cosa lo sblocca.

**Hai fatto l'upgrade ma una pagina è ancora bloccata.** Ricarica forzatamente per aggiornare la sessione. Se rimane bloccata, esci e accedi di nuovo. Se rimane ancora bloccata, scrivi al supporto.

## Browser

**La pagina è vuota.** Probabilmente un'estensione del browser sta bloccando gli script. Prova una finestra in incognito con le estensioni disabilitate. Se funziona, identifica l'estensione disattivandole una alla volta.

**I grafici hanno colori strani.** Mancata corrispondenza nella cache del tema. Cambia tema una volta (icona sole/luna). Al successivo ricaricamento il rendering sarà corretto.

**I cookie di accesso non persistono.** Potresti trovarti in una modalità del browser con privacy rigorosa (Brave shields su aggressive, Safari con "Impedisci il tracciamento tra siti diversi", alcuni container di Firefox). Aggiungi `zerogex.io` alla lista consentita per i cookie, oppure accedi da zero ad ogni sessione.

## Grafici

**Il grafico è vuoto mentre altri hanno dati.** La causa più comune è una restrizione di livello — il grafico appartiene a un livello che non hai. Altre volte: il segnale sottostante è volutamente inattivo (la sua finestra non è aperta). Passa il mouse sullo stato vuoto per la spiegazione.

**I tooltip al passaggio del mouse non appaiono.** È un dispositivo touch. Usa la pressione prolungata, oppure passa a un desktop.

## Mobile

**Il layout appare compresso.** ZeroGEX è progettato per desktop. Il layout mobile funziona per il monitoraggio; le pagine complesse con più grafici presuppongono più spazio orizzontale.

**Lo scorrimento si blocca durante il trascinamento di un grafico.** Tocca prima fuori dall'area del grafico, poi scorri. I grafici catturano intenzionalmente il trascinamento orizzontale per lo zoom/pan.

## Quando scrivere al supporto

Dopo aver provato le voci pertinenti sopra elencate. Includi:

- L'URL della pagina in cui ti trovavi.
- Uno screenshot, se rilevante.
- Browser, sistema operativo e il momento approssimativo in cui è successo (con fuso orario).
- La tua email dell'account.

Scrivi a [support@zerogex.io](mailto:support@zerogex.io). Rispondiamo velocemente — di solito nella stessa giornata di trading.

## Vedi anche

- [Streaming e prestazioni](/help/platform/streaming-and-performance)
- [Impostazioni account](/help/platform/account)
- [Fatturazione e portale Stripe](/help/platform/billing)
- [FAQ](/help/faqs)
