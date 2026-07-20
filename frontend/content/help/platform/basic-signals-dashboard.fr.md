# Basic Signal Dashboard

*Les six lectures continues qui alimentent le composite — ce qu'elles sont, comment les lire et où creuser davantage.*

---

## Qu'est-ce que le Basic Signal Dashboard

Le Basic Signal Dashboard est la **grille en un coup d'œil** des six signaux Basic. Chaque carte affiche le score actuel sur l'échelle [-1, +1], la contribution qu'il apporte au composite et un sparkline.

Les signaux Basic sont **continus**. Ils ne déclenchent pas d'alertes discrètes — ils poussent le composite vers le haut ou vers le bas à chaque rafraîchissement.

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

Le spread entre l'IV des puts OTM et l'IV des calls OTM, comparé à sa baseline. Des lectures négatives signifient que la peur est intégrée dans les prix ; des lectures positives signifient que la prime des calls est intégrée (avidité). Utile davantage comme thermomètre de sentiment que comme signal de précision.

### Vanna/Charm Flow

Vanna et charm agrégés des dealers. Le vanna correspond à ce que les dealers couvriront si la vol bouge ; le charm à ce qu'ils couvriront à mesure que le temps passe. Des lectures positives signifient que le flux structurel soutient des prix plus élevés ; négatives, l'inverse. Le charm s'accélère à l'approche de la clôture.

### Dealer Delta Pressure

Le delta net des dealers issu de la chaîne d'options (call_delta_oi + put_delta_oi). Une valeur fortement négative signifie que les dealers sont short delta et achèteront si le prix monte ; une valeur fortement positive signifie qu'ils sont long et vendront si le prix monte. Le signal demande « les dealers sont-ils forcés de poursuivre ? ».

### GEX Gradient

Le gamma au-dessus du spot comparé au gamma en dessous du spot, avec un contrôle de concentration ATM. Indique de quel côté du spot se trouve le plus de poids gamma. Gradient positif ⇒ gamma concentré au-dessus du spot ⇒ pin structurel haussier ; négatif ⇒ pin structurel baissier.

### Positioning Trap

PCR + déséquilibre signé du smart money + momentum sur 5 barres + inclinaison au flip + contexte de régime. Demande si la foule est positionnée dans le mauvais sens. **Il s'agit d'un signal de retour à la moyenne** — un score positif élevé est un signal « vendre la hausse », pas « passer long ».

## Comment lire le dashboard

Trois schémas :

1. **Rechercher la confluence.** Si trois ou quatre des six signaux pointent dans la même direction avec des amplitudes non négligeables, le composite le reflétera.
2. **Rechercher la divergence.** Lorsque le Tape Flow Bias est fortement positif mais que le GEX Gradient est nettement négatif, les dealers vont fader les achats — le tape se trompe sur l'emplacement du pin structurel.
3. **Observer le Positioning Trap séparément.** C'est le seul signal Basic à biais de retour à la moyenne. Traitez une lecture de Trap fortement positive combinée à un Tape fortement long comme un avertissement, pas comme une confirmation.

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
