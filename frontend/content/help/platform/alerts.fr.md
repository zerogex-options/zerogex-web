# Alertes de signaux

*Comment les déclenchements de signaux apparaissent dans la plateforme, ce qui se déclenche par rapport à ce qui reste silencieux, et comment revoir ce qui s'est déclenché.*

---

## Où les alertes apparaissent

ZeroGEX affiche les déclenchements de signaux **dans l'application**, pas par e-mail, SMS ni notification push. Ils apparaissent à deux endroits :

1. **La carte de signal** - sur l'Advanced Signal Dashboard (Pro), un déclenchement encadre la carte, la teinte dans la direction du score et fait passer son état de *Stand by* à *Triggered*.
2. **L'Event Timeline** - dans l'onglet Event Timelines du dashboard et en bas de la page de chaque signal : le parcours récent du score, avec les changements de direction marqués.

Les déclenchements n'arrivent pas dans le Bulletin en direct - c'est une carte partageable de l'instantané actuel du gamma des dealers - et ils ne font pas bouger le Composite Score.

C'est intentionnel. ZeroGEX est conçu pour être **observé, pas interrompu**. Les alertes de type push provoquent de l'overtrading ; les vues in-app vous permettent de consulter quand vous le décidez.

## Ce qui se déclenche

Seuls les huit signaux Advanced se déclenchent, chacun lorsque son seuil de déclenchement est franchi (voir le tableau ci-dessous).

Les signaux Basic ne se déclenchent **pas**. Ce sont des lectures continues et consultatives, et ils n'ont aucun poids dans le Composite Score. Leurs cartes sont encadrées et marquées *Triggered* au-delà de ±25, mais cela ne fait que souligner une lecture forte.

Les changements structurels - le prix qui franchit le gamma flip, une wall qui se déplace - ne sont pas non plus des alertes. Ils se lisent sur le Gamma Chart et sur les pages Indicateurs.

## Comment un déclenchement atterrit

Lorsqu'un déclenchement franchit son seuil :

1. Le moteur de signaux marque le signal comme déclenché lors du cycle où son score franchit le seuil.
2. La carte sur l'Advanced Signal Dashboard passe à *Triggered* et prend la couleur de la direction. La page vérifie les nouvelles valeurs toutes les quelques secondes, inutile donc de recharger.
3. Le Composite Score n'est pas affecté.

Une carte reste *Triggered* tant que le score se maintient au-delà du seuil, et revient à *Stand by* quand il repasse en deçà. Il n'existe pas de liste séparée des déclenchements - l'Event Timeline en tient lieu.

## Référence des seuils de déclenchement

| Signal | Seuil |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Les scores vont de -100 à +100. Voir [Lire la ligne de score de -100 à +100](/help/platform/score-line).

## Pourquoi certains signaux ne se déclenchent pas

Un signal peut afficher un score conséquent sans se déclencher, ou rester à 0 alors que vous attendez une lecture. Raisons possibles :

- Son déclenchement ne dépend pas du seul score : Market Pressure Index exige aussi loading ≥ 50 et une direction nette, et Range Break Imminence se déclenche à imminence ≥ 65.
- Il est conditionné par une fenêtre de session : EOD Pressure ne fonctionne que de 14:30 à 16:00 ET et est forcé à 0 en dehors, et 0DTE Position Imbalance affiche *Inactive* lorsque sa fenêtre est fermée.

La carte affiche son état actuel : *Triggered*, *Stand by* ou *Inactive* avec la raison.

## Revoir ce qui s'est déclenché

Il n'y a pas de journal des déclenchements. Pour voir ce qu'a fait un signal pendant votre absence, ouvrez l'onglet **Event Timelines** de l'Advanced Signal Dashboard, ou l'Event Timeline en bas de la page du signal. Elle trace le score sur les deux dernières sessions, avec les changements de direction marqués, à côté du mouvement du sous-jacent sur les 30, 60 ou 120 minutes suivantes, et vous pouvez zoomer de 30 minutes jusqu'à la période complète.

Pour un bilan noté d'une session entière, le scorecard public **Signaux - un jour** (sous Justificatifs dans la barre latérale) montre quels signaux ont changé de direction, combien de ces changements ont pu être évalués et comment ils se sont soldés.

## Alertes sortantes

Les déclenchements de signaux sont affichés **uniquement dans l'application** - sur les cartes de signal et dans les Event Timelines. Ils ne sont pas envoyés par e-mail, SMS, notification push ou webhook.

Les commutateurs de canaux dans [Compte → Notifications](/account/notifications) concernent **TradeWorkz™ Trading par bots** (Pro, bêta), pas les déclenchements de signaux : ils couvrent les notifications d'entrée et de sortie des bots que vous suivez. Dans l'application (la cloche de la page Trading par bots) et par e-mail, elles sont distribuées dès aujourd'hui ; le canal webhook enregistre votre préférence mais ne distribue encore rien, alors ne construisez rien dessus. Pour automatiser sur les signaux aujourd'hui, interrogez l'[API](/help/platform/api-access) (Pro) plutôt que d'attendre un push qui n'arrivera pas.

La distribution sortante est sur la liste, pas livrée. Si elle changeait votre façon de trader, écrivez à [support@zerogex.io](mailto:support@zerogex.io) en précisant le canal et les signaux souhaités - les détails concrets la font remonter.

## Voir aussi

- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Préférences e-mail](/help/platform/email-preferences)
