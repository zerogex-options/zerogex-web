# Risoluzione dei problemi

*L'elenco essenziale - problemi di accesso, dati mancanti, grafici non aggiornati, problemi di pagamento, cache del browser e quando scrivere al supporto.*

---

## Impossibile accedere

**Hai dimenticato la password.** Usa [Password dimenticata](/forgot-password). Ti verrà inviato un link via email; clicca e imposta una nuova password. Il link funziona una sola volta e scade dopo 30 minuti. Se l'email non arriva, controlla lo spam.

**Ti sei registrato con Google o Apple e non hai una password.** Accedi tramite il provider che hai usato. Dalla pagina Account potrai poi impostare una password come alternativa futura.

**Hai effettuato l'accesso, ma il tuo piano non c'è.** Probabilmente hai effettuato l'accesso con un'email diversa da quella del tuo abbonamento - per esempio un altro account Google -, e così è stato creato un account separato. Esci e accedi di nuovo con l'email originale, oppure scrivi a [support@zerogex.io](mailto:support@zerogex.io) - possiamo verificare l'account.

**Una richiesta di verifica di Google o Apple non scompare.** Quella richiesta arriva dal provider - ZeroGEX non ha un proprio passaggio di autenticazione a due fattori. Accedi da zero da una finestra in incognito. Se il problema persiste, scrivi al supporto.

## Dati mancanti o non aggiornati

**Il badge di sessione indica Chiuso.** È normale - i mercati sono chiusi. Vengono mostrati gli ultimi valori calcolati.

**Un pannello è vuoto o segna zero.** Di solito dipende dalla finestra di sessione: EOD Pressure è attivo solo dalle 14:30 ET alla chiusura, e 0DTE Position Imbalance solo durante la sessione regolare. Entrambe le pagine lo indicano a schermo finché sono inattive.

**I valori sembrano bloccati.** Passa il mouse sul prezzo nell'intestazione per vedere quando è arrivata l'ultima quotazione, oppure controlla l'orario di «Ultimo aggiornamento» in fondo alla Dashboard principale. Se risale a più di un paio di minuti fa durante l'orario regolare, ricarica la pagina forzatamente (Cmd+Shift+R / Ctrl+Shift+R). I dati sul posizionamento dei dealer vengono ricalcolati circa una volta al minuto, quindi brevi pause tra un cambiamento e l'altro sono normali.

**Il signal score mostra 0.** Di solito significa "nessuna lettura", non "neutro". Vedi [Leggere la linea del punteggio da -100 a +100](/help/platform/score-line).

## Pagamenti

**La carta è stata rifiutata.** Aggiorna il metodo di pagamento nel portale di fatturazione Stripe (raggiungibile dalla pagina [Account](/account)). I rifiuti più comuni sono dovuti a carte scadute, indirizzi non corrispondenti o restrizioni regionali.

**L'abbonamento indica "scaduto".** Stripe sta ritentando l'addebito. Aggiorna il metodo di pagamento, oppure salda la fattura aperta con **Apri il portale di fatturazione** nella tua pagina Account, per risolvere. Le funzioni a pagamento restano attive per un breve periodo di tolleranza mentre Stripe ritenta.

**La fattura è più alta del previsto.** Apri la fattura nel portale - le voci sono dettagliate. Sorprese comuni: un upgrade a metà periodo viene calcolato in proporzione - ricevi un credito per la parte non utilizzata del periodo corrente più l'addebito del nuovo piano, applicato alla **prossima fattura** anziché addebitato immediatamente. Lasciare la prova gratuita di Basic per Pro o per un periodo di fatturazione più lungo addebita il nuovo piano il giorno stesso.

**La cancellazione non è andata a buon fine.** La cancellazione ha effetto alla fine del periodo di fatturazione. Fino ad allora, mantieni l'accesso a pagamento. Il portale e la tua pagina Account mostrano la data di fine prevista.

## Livello e accesso

**Una pagina ti porta a Pricing o a una schermata di sblocco invece di aprirsi.** Quella pagina richiede un livello che non hai attualmente. La schermata di sblocco indica il piano che la include, e [Pricing](/pricing) mostra il quadro completo.

**Hai fatto l'upgrade ma una pagina è ancora bloccata.** Ricarica forzatamente per aggiornare la sessione. Se rimane bloccata, esci e accedi di nuovo. Se rimane ancora bloccata, scrivi al supporto.

## Browser

**La pagina è vuota.** Probabilmente un'estensione del browser sta bloccando gli script. Prova una finestra in incognito con le estensioni disabilitate. Se funziona, identifica l'estensione disattivandole una alla volta.

**I grafici hanno colori inattesi.** Controlla il menu delle palette accanto all'icona sole/luna nell'intestazione - una palette diversa cambia i colori di tutti i grafici. Se la palette è quella giusta, cambia tema una volta (icona sole/luna); al successivo ricaricamento il rendering sarà corretto.

**I cookie di accesso non persistono.** Potresti trovarti in una modalità del browser con privacy rigorosa (Brave shields su aggressive, Safari con "Impedisci il tracciamento tra siti diversi", alcuni container di Firefox). Aggiungi `zerogex.io` alla lista consentita per i cookie, oppure accedi da zero ad ogni sessione.

## Grafici

**Il grafico è vuoto mentre altri hanno dati.** La causa più comune è una restrizione di livello - il grafico appartiene a un livello che non hai, e i pannelli riservati a Pro mostrano al suo posto un invito all'upgrade. Altre volte: il segnale sottostante è volutamente inattivo (la sua finestra non è aperta).

**I tooltip al passaggio del mouse non appaiono.** È un dispositivo touch. Tocca il grafico o tieni premuto, oppure passa a un desktop.

## Mobile

**Il layout appare compresso.** ZeroGEX è progettato per desktop. Il layout mobile funziona per il monitoraggio; le pagine complesse con più grafici presuppongono più spazio orizzontale.

**La pagina non scorre mentre il dito è su un grafico.** Scorri verso l'alto o verso il basso - i grafici catturano solo il trascinamento laterale (per spostarsi nel tempo), quindi uno scorrimento verticale fa scorrere la pagina.

## Quando scrivere al supporto

Dopo aver provato le voci pertinenti sopra elencate. Includi:

- L'URL della pagina in cui ti trovavi.
- Uno screenshot, se rilevante.
- Browser, sistema operativo e il momento approssimativo in cui è successo (con fuso orario).
- La tua email dell'account.

Scrivi a [support@zerogex.io](mailto:support@zerogex.io). Rispondiamo velocemente - di solito nella stessa giornata di trading.

## Vedi anche

- [Streaming e prestazioni](/help/platform/streaming-and-performance)
- [Impostazioni account](/help/platform/account)
- [Fatturazione e portale Stripe](/help/platform/billing)
- [FAQ](/help/faqs)
