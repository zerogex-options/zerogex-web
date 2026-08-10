# Basic Signal Dashboard

*Les six lectures continues qui alimentent le composite — ce qu'elles sont, comment les lire et où creuser davantage.*

---

## Qu'est-ce que le Basic Signal Dashboard

Le Basic Signal Dashboard est la **grille en un coup d'œil** des six signaux Basic. Chaque carte affiche le score actuel sur l'échelle [-1, +1], la contribution qu'il apporte au composite et un sparkline.

Les signaux Basic sont **continus**. Ils ne déclenchent pas d'alertes discrètes — ils poussent le composite vers le haut (vers la tendance) ou vers le bas (vers le chop) à chaque rafraîchissement.

## Les six signaux

| Signal | Ce qu'il demande | Biais de trade | Poids dans le composite |
| --- | --- | --- | --- |
| Tape Flow Bias | « Dans quel sens penche le tape ? » | Continuation | 0.08 |
| Skew Delta | « Quelle part de peur est intégrée dans les puts ? » | Lecture directionnelle | 0.04 |
| Vanna/Charm Flow | « La vol ou le temps vont-ils forcer les dealers à se re-couvrir ? » | Continuation | 0.04 |
| Dealer Delta Pressure | « Les dealers sont-ils forcés de poursuivre ce mouvement ? » | Lecture directionnelle | 0.08 |
| GEX Gradient | « Le gamma est-il concentré d'un côté ? » | Lecture directionnelle | 0.08 |
| Positioning Trap | « La foule est-elle mal positionnée ? » | Retour à la moyenne (vs. la foule) | 0.06 |

Les poids représentent la part du composite à laquelle chaque signal contribue lorsque le reste de l'univers est silencieux.

## Lecture rapide de chacun

### Tape Flow Bias

Classification de l'agresseur selon Lee-Ready sur le tape des options. Net entre prime d'achat/vente de calls et prime d'achat/vente de puts. Positif = les agresseurs paient pour la hausse. Un signal fort ici, en l'absence d'un GEX gradient opposé, traduit une conviction en temps réel.

### Skew Delta

Le spread entre l'IV des puts OTM et l'IV des calls OTM, comparé à sa baseline, dont le signe est inversé de sorte que le score se lise directionnellement : négatif signifie que la peur est intégrée dans les prix (skew des puts élevé) ; positif signifie que la prime des calls est intégrée (avidité). Utile davantage comme thermomètre de sentiment que comme signal de précision.

### Vanna/Charm Flow

Vanna et charm agrégés des dealers. Le vanna modélise ce que les dealers *pourraient* couvrir si la vol bouge ; le charm modélise la dérive du delta due à l'écoulement du temps (à spot et IV constants). Une lecture positive modélise un flux de couverture qui *peut* soutenir des prix plus élevés ; négative, l'inverse — la direction et l'ampleur dépendent toujours de la composition du book et de qui détient les options. La pression du charm tend à s'accentuer à l'approche de la clôture.

### Dealer Delta Pressure

Le delta net des dealers issu de la chaîne d'options (call_delta_oi + put_delta_oi) — une lecture modélisée distincte, séparée du gamma. Une valeur fortement négative modélise des dealers short delta, qui *auraient tendance* à acheter plus haut pour rester couverts ; fortement positive les modélise long, ayant tendance à vendre plus haut. Le signal demande « les dealers sont-ils susceptibles de poursuivre ce mouvement ? ».

### GEX Gradient

Le gamma au-dessus du spot comparé au gamma en dessous du spot, avec un contrôle de concentration ATM. Indique de quel côté du spot se trouve le plus de poids gamma modélisé. Gradient positif ⇒ davantage de gamma en dessous du spot ⇒ un plancher de soutien modélisé (biais haussier, en supposant que les dealers y soient long gamma) ; négatif ⇒ davantage de gamma au-dessus du spot ⇒ un biais d'amplification à la baisse. Ce biais suppose que le signe modélisé du gamma des dealers se vérifie.

### Positioning Trap

PCR + déséquilibre signé du smart money + momentum sur 5 barres + inclinaison au flip + contexte de régime. Demande si la foule est positionnée dans le mauvais sens — et il fade la foule, pas le prix. Un score **positif** élevé signale une foule penchée du côté short (beaucoup de puts) qui peut être squeezée **vers le haut** — un short-cover squeeze haussier ; un score **négatif** élevé signale une foule penchée du côté long (beaucoup de calls) vulnérable à un flush **à la baisse**. Lisez le signe comme la direction du squeeze/flush, pas comme un simple signal « passer long/short ».

## Comment lire le dashboard

Trois schémas :

1. **Rechercher la confluence.** Si trois ou quatre des six signaux pointent dans la même direction avec des amplitudes non négligeables, le composite évoluera vers un régime de tendance ou de chop en conséquence.
2. **Rechercher la divergence.** Lorsque le Tape Flow Bias est fortement positif mais que le GEX Gradient est nettement négatif, les dealers vont fader les achats — le tape se trompe sur l'emplacement du pin structurel.
3. **Observer le Positioning Trap séparément.** C'est le seul signal Basic à biais de retour à la moyenne. Une lecture de Trap fortement **négative** (une foule penchée du côté long risquant un flush à la baisse) combinée à un Tape fortement long est un avertissement, pas une confirmation — la foule que le tape rejoint est précisément celle que le Trap signale comme mal positionnée.

## Ce qui ne figure pas sur le dashboard Basic

Les triggers. Aucun de ces signaux ne se déclenche. Pour des alertes pilotées par des triggers, consultez l'[Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard).

## Chaque carte a une page d'approfondissement

Cliquez sur n'importe quelle carte pour accéder à la page du signal individuel, qui affiche :

- Le sparkline du score en plus haute résolution
- Les valeurs d'entrée actuelles (les composantes qui alimentent le score)
- L'explication « Comment il est construit »
- L'historique récent

## Voir aussi

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
