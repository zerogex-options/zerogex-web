# Composite Score

*La lettura combinata di tutti i segnali ZeroGEX — come viene costruita, come interpretarla e come usarla come filtro piuttosto che come previsione.*

---

## Cos'è il Composite Score

Il Composite Score — internamente **MSI**, il Market Score Indicator — è il **riepilogo in un unico numero** di tutti i segnali ZeroGEX sul simbolo attivo. Si colloca sulla stessa linea **[-1, +1]** di ogni altro punteggio di segnale.

Composite positivo ⇒ propensione strutturale rialzista. Negativo ⇒ propensione strutturale ribassista. La magnitudine indica la convinzione.

## Come viene costruito

Tre input in evoluzione continua si combinano in un unico numero:

1. **Segnali Basic** — ogni segnale Basic contribuisce con un peso fisso ridotto (4–8% del composite). Anche quando non scattano, spingono il composite in modo continuo sullo sfondo.
2. **Trigger dei segnali Advanced** — quando un trigger di segnale Advanced è attivo, contribuisce con il proprio punteggio con segno e un peso maggiore.
3. **Contesto del regime** — il regime gamma attivo agisce come moltiplicatore sugli input direzionali.

I pesi sono calibrati per evitare che un singolo segnale domini. Una lettura del composite vicina a ±0,4–0,6 richiede tipicamente l'allineamento di più input.

## Il gauge MSI

La pagina Composite Score mostra:

- Il **gauge MSI** — punteggio sulla linea [-1, +1], con codifica a colori dal rosso intenso al verde intenso.
- Lo **stato del trigger** — se il composite ha superato una soglia di attenzione.
- Il pannello dei **segnali contribuenti** — ogni input con il suo contributo attuale al composite, ordinato per magnitudine.
- L'**intestazione del regime** — Positive Gamma, Negative Gamma o Transitioning.
- Uno **sparkline** del composite nell'ultima sessione.

## Interpretare il composite

Una regola semplice:

| Composite | Lettura |
| --- | --- |
| ≥ +0,6 | Fortemente rialzista — più segnali allineati al rialzo, il regime lo sostiene |
| +0,3 a +0,6 | Propensione rialzista — il bias è reale ma non schiacciante |
| -0,3 a +0,3 | Nessuna lettura — il composite non è utile, guarda i singoli segnali |
| -0,6 a -0,3 | Propensione ribassista |
| ≤ -0,6 | Fortemente ribassista |

L'intervallo più utile è quello degli estremi. La zona centrale è intenzionalmente una zona "i dati non ti stanno dicendo nulla" — non forzare trade a partire da essa.

## Come usarlo

Tre schemi d'uso:

1. **Come filtro.** Non aprire trade direzionali long quando il composite è a -0,6, a meno che il tuo edge non sia specificamente controtrend.
2. **Come verifica di confluenza.** Un trigger Advanced ad alta confidenza sostenuto da un composite nella stessa direzione è una lettura a confidenza più alta rispetto al trigger da solo.
3. **Come conferma del regime.** Le letture del composite tendono a essere più forti e più persistenti nelle sessioni a negative gamma — si allineano con il comportamento sottostante del mercato.

## Cosa NON è

Il composite **non è un segnale di trading**. Ti dice se il quadro strutturale propende in una direzione; non ti dice di aprire un trade, quale timeframe usare o dove posizionare lo stop.

## Perché il composite può ribaltarsi rapidamente

Due motivi:

- Un segnale Advanced ad alto peso può scattare e dominare la lettura.
- Il contesto del regime (attraversamento del gamma flip) può spostare il moltiplicatore su tutto il resto.

Lo sparkline rende visibili questi cambi improvvisi — cerca le discontinuità.

## Abitudini dei trader che si sono rivelate efficaci

- Leggi il composite all'apertura e alle 11:00 / 12:30 / 14:30 ET come punti di controllo.
- Non fare trading contro il composite durante la finestra di EOD Pressure.
- Tratta i punteggi composite tra -0,3 e +0,3 come "aspetta" piuttosto che come "neutro".

## Nota sui livelli

La pagina Composite Score è riservata al livello Pro. Il gauge del composite compare anche nella Dashboard per tutti i livelli a pagamento.

## Vedi anche

- [Come funzionano i segnali end-to-end](/help/platform/signals-overview)
- [Leggere la linea di punteggio [-1, +1]](/help/platform/score-line)
- [Segnali: spiegati](/guides/signals-explained)
