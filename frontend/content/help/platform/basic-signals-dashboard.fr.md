# Basic Signal Dashboard

*Les six lectures continues qui accompagnent le composite - ce qu'elles sont, comment les lire et où creuser davantage.*

---

## Qu'est-ce que le Basic Signal Dashboard

Le Basic Signal Dashboard (Basic et Pro) est la **vue en un coup d'œil** des six signaux Basic. Un bandeau en haut affiche les six scores d'un seul coup. En dessous, trois onglets :

- **Signal Grid** - une carte par signal avec son score sur l'échelle de -100 à +100, un sparkline, une description d'une ligne et des **Context values** que vous pouvez déplier pour voir les intrants derrière le score.
- **Confluence Matrix** - à quelle fréquence chaque paire de signaux s'est accordée ou contredite sur la direction.
- **Event Timelines** - le parcours récent du score de chaque signal, avec les changements de direction marqués.

Les signaux Basic sont **continus** et **consultatifs**. Ils ne déclenchent pas d'alertes discrètes et ont un **poids nul dans le Composite Score (MSI)** - un mouvement ici ne fait pas bouger le MSI. Utilisez-les comme contre-vérification précoce : quand les lectures de flux divergent des lectures de structure, un changement de régime est souvent déjà en cours avant que le MSI ne réagisse.

Une carte dont le score dépasse ±25 est encadrée et marquée *Triggered* ; en dessous, elle affiche *Stand by*. Sur ce dashboard, cela souligne une lecture forte - ce n'est pas un événement de trigger.

## Les six signaux

| Signal | Ce qu'il demande | Biais de trade |
| --- | --- | --- |
| Tape Flow Bias | « Dans quel sens penche le tape ? » | Continuation |
| Skew Delta | « Quelle part de peur est intégrée dans les puts ? » | Lecture directionnelle |
| Vanna/Charm Flow | « La vol ou le temps pourraient-ils pousser les dealers à se re-couvrir ? » | Continuation |
| Dealer Delta Pressure | « Les dealers sont-ils forcés de poursuivre ce mouvement ? » | Lecture directionnelle |
| GEX Gradient | « Le gamma est-il concentré d'un côté ? » | Lecture directionnelle |
| Positioning Trap | « La foule est-elle mal positionnée ? » | Retour à la moyenne (vs. la foule) |

Aucun des six n'alimente le Composite Score. Seul recoupement : le MSI possède sa propre composante Dealer Delta Pressure, construite sur la même lecture du delta net des dealers que le signal Basic.

## Lecture rapide de chacun

### Tape Flow Bias

Classification de l'agresseur selon Lee-Ready sur le tape des options. Net entre prime d'achat/vente de calls et prime d'achat/vente de puts. Positif = les agresseurs paient pour la hausse. Un signal fort ici, en l'absence d'un GEX gradient opposé, traduit une conviction en temps réel.

### Skew Delta

Le spread entre l'IV des puts OTM et l'IV des calls OTM, comparé à sa baseline, dont le signe est inversé de sorte que le score se lise directionnellement : négatif signifie que la peur est intégrée dans les prix (skew des puts élevé) ; positif signifie que la prime des calls est intégrée (avidité). Utile davantage comme thermomètre de sentiment que comme signal de précision.

### Vanna/Charm Flow

Vanna et charm agrégés des dealers. Le vanna modélise ce que les dealers *pourraient* couvrir si la vol bouge ; le charm modélise la dérive du delta due à l'écoulement du temps (à spot et IV constants). Une lecture positive modélise un flux de couverture qui *peut* soutenir des prix plus élevés ; négative, l'inverse - la direction et l'ampleur dépendent toujours de la composition du book et de qui détient les options. La pression du charm tend à s'accentuer à l'approche de la clôture.

### Dealer Delta Pressure

Le delta net des dealers issu de la chaîne d'options (call_delta_oi + put_delta_oi) - une lecture modélisée distincte, séparée du gamma. Le score est inversé : un score fortement **positif** modélise des dealers short delta, qui *auraient tendance* à acheter dans une hausse pour rester couverts (biais haussier) ; un score fortement **négatif** les modélise long delta, ayant tendance à vendre dans les hausses (biais baissier). Le signal demande « les dealers sont-ils susceptibles de poursuivre ce mouvement ? ».

### GEX Gradient

Le gamma au-dessus du spot comparé au gamma en dessous du spot, avec un contrôle de la part logée dans les ailes très OTM (beaucoup de gamma dans les ailes réduit la confiance). Indique de quel côté du spot se trouve le plus de poids gamma modélisé, et la lecture dépend du régime :

- Quand les dealers sont modélisés **short gamma**, davantage de gamma au-dessus du spot donne un score **positif** (les dealers poursuivraient une hausse) et davantage en dessous un score négatif (ils poursuivraient une baisse).
- Quand ils sont modélisés **long gamma**, la lecture s'inverse et s'atténue : davantage de gamma en dessous du spot donne un score positif (un plancher de soutien), davantage au-dessus un score négatif (une résistance au-dessus).

Ce biais suppose que le signe modélisé du gamma des dealers se vérifie.

### Positioning Trap

PCR + déséquilibre signé du smart money + momentum sur 5 barres + inclinaison au flip + contexte de régime. Demande si la foule est positionnée dans le mauvais sens - et il fade la foule, pas le prix. Un score **positif** élevé signale une foule penchée du côté short (beaucoup de puts) qui peut être squeezée **vers le haut** - un short-cover squeeze haussier ; un score **négatif** élevé signale une foule penchée du côté long (beaucoup de calls) vulnérable à un flush **à la baisse**. Lisez le signe comme la direction du squeeze/flush, pas comme un simple signal « passer long/short ».

## Comment lire le dashboard

Trois schémas :

1. **Rechercher la confluence.** Si trois ou quatre des six signaux pointent dans la même direction avec des amplitudes non négligeables, c'est de la conviction. L'onglet **Confluence Matrix** montre quelles paires se sont accordées.
2. **Rechercher la divergence.** Lorsque le Tape Flow Bias est fortement positif mais que le GEX Gradient est nettement négatif, le positionnement modélisé des dealers va à contre-courant des achats - le tape se trompe peut-être sur l'emplacement du pin structurel. Des lectures de flux qui divergent des lectures de structure, c'est précisément l'alerte précoce pour laquelle cette page est conçue.
3. **Observer le Positioning Trap séparément.** C'est le seul signal Basic à biais de retour à la moyenne. Une lecture de Trap fortement **négative** (une foule penchée du côté long risquant un flush à la baisse) combinée à un Tape fortement long est un avertissement, pas une confirmation - la foule que le tape rejoint est précisément celle que le Trap signale comme mal positionnée.

## Ce qui ne figure pas sur le dashboard Basic

Les règles de trigger. Aucun de ces signaux ne se déclenche - la mention *Triggered* ne fait que signaler un score au-delà de ±25. Pour des signaux pilotés par des triggers, consultez l'[Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard), qui fait partie de l'offre Pro.

## Chaque carte a une page d'approfondissement

Cliquez sur n'importe quelle carte (ou choisissez le signal sous Tableau de signaux basique dans la barre latérale) pour ouvrir la page du signal individuel, qui affiche :

- Le score avec une lecture en une ligne et un historique du score dépliable
- Les valeurs d'entrée actuelles (les composantes qui alimentent le score)
- L'explication "How it's built"
- L'Event Timeline - le parcours récent du score, avec les changements de direction marqués

## Voir aussi

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
