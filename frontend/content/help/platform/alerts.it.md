# Avvisi sui segnali

*Come i trigger dei segnali emergono all'interno della piattaforma, cosa scatta rispetto a cosa resta silenzioso, e come rivedere cosa è scattato.*

---

## Dove compaiono gli avvisi

ZeroGEX mostra i trigger dei segnali **in-app**, non via email, SMS o notifica push. Emergono in due punti:

1. **La scheda del segnale** - sull'Advanced Signal Dashboard (Pro), un trigger borda la scheda, la colora nella direzione dello score e ne cambia lo stato da *Stand by* a *Triggered*.
2. **La Event Timeline** - nella scheda Event Timelines della dashboard e in fondo alla pagina di ogni segnale: il percorso recente dello score, con i cambi di direzione segnati.

I trigger non arrivano nel Bollettino live - che è una card condivisibile con lo snapshot attuale del gamma dei dealer - e non muovono il Composite Score.

Questo è intenzionale. ZeroGEX è progettato per essere **osservato, non interrotto**. Gli avvisi in stile push causano overtrading; le viste in-app ti permettono di scorrere quando decidi tu.

## Cosa scatta

Scattano solo gli otto segnali Advanced, ciascuno quando viene superata la sua soglia di trigger (vedi la tabella più sotto).

I segnali Basic **non** scattano. Sono letture continue e consultive, e non hanno alcun peso nel Composite Score. Le loro schede vengono bordate e marcate *Triggered* oltre ±25, ma questo evidenzia solo una lettura forte.

Anche i cambiamenti strutturali - il prezzo che attraversa il gamma flip, un wall che si sposta - non sono avvisi. Si leggono sul Gamma Chart e nelle pagine Metriche.

## Come atterra un trigger

Quando un trigger scatta:

1. Il motore dei segnali marca il segnale come scattato nel ciclo in cui il suo score supera la soglia.
2. La scheda sull'Advanced Signal Dashboard passa a *Triggered* e prende il colore della direzione. La pagina controlla i nuovi valori ogni pochi secondi, quindi non serve ricaricare.
3. Il Composite Score non cambia.

Una scheda resta *Triggered* finché lo score si mantiene oltre la soglia, e torna a *Stand by* quando rientra. Non esiste un elenco separato degli eventi di trigger - la Event Timeline è la registrazione.

## Riferimento soglie di trigger

| Segnale | Soglia |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Gli score vanno da -100 a +100. Vedi [Leggere la linea del punteggio da -100 a +100](/help/platform/score-line).

## Perché alcuni segnali non scattano

Un segnale può mostrare uno score consistente e non essere in stato di trigger, oppure restare a 0 quando ti aspetti una lettura. I motivi:

- Il suo trigger non dipende solo dallo score: Market Pressure Index richiede anche loading ≥ 50 e una direzione chiara, e Range Break Imminence scatta con imminence ≥ 65.
- È vincolato a una finestra di sessione: EOD Pressure funziona solo dalle 14:30 alle 16:00 ET e fuori da quella finestra viene forzato a 0, e 0DTE Position Imbalance mostra *Inactive* quando la sua finestra è chiusa.

La scheda mostra il suo stato attuale: *Triggered*, *Stand by* o *Inactive* con il motivo.

## Rivedere cosa è scattato

Non esiste un registro dei trigger. Per vedere cosa ha fatto un segnale mentre eri via, apri la scheda **Event Timelines** dell'Advanced Signal Dashboard, oppure la Event Timeline in fondo alla pagina del segnale. Traccia lo score delle ultime due sessioni con i cambi di direzione segnati, accanto a quanto si è mosso il sottostante nei 30, 60 o 120 minuti successivi, e puoi zoomare da 30 minuti fino all'intero intervallo.

Per un riepilogo valutato di un'intera sessione, lo scorecard pubblico **Segnali - un giorno** (sotto Riscontri nella barra laterale) mostra quali segnali hanno cambiato direzione, quanti di quei cambi si sono potuti valutare e come si sono risolti.

## Avvisi in uscita

I trigger dei segnali vengono mostrati **solo nell'app** - sulle schede dei segnali e nelle Event Timelines. Non vengono inviati via email, SMS, notifica push o webhook.

Gli interruttori dei canali in [Account → Notifiche](/account/notifications) riguardano **TradeWorkz™ Trading con bot** (Pro, beta), non i trigger dei segnali: coprono le notifiche di entrata e uscita dei bot che segui. In-app (la campanella nella pagina Trading con bot) e via email vengono consegnate già oggi; il canale webhook salva la tua preferenza ma non consegna ancora nulla, quindi non costruirci sopra. Per automatizzare sui segnali oggi, interroga l'[API](/help/platform/api-access) (Pro) invece di aspettare un push che non arriverà.

La consegna in uscita è in lista, non rilasciata. Se cambierebbe il tuo modo di operare, scrivi a [support@zerogex.io](mailto:support@zerogex.io) indicando canale e segnali che vorresti - i dettagli concreti la fanno salire di priorità.

## Vedi anche

- [Come funzionano i segnali end-to-end](/help/platform/signals-overview)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Preferenze email](/help/platform/email-preferences)
