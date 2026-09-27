# Comment fonctionnent les Signals, de bout en bout

*Le modèle complet des signals - Advanced vs. Basic, leur lien avec le Composite Score et le Trade Bias, ce que montrent les cartes, et comment tout utiliser.*

---

## Les deux familles

ZeroGEX fait tourner **deux familles** de signals. Elles se comportent différemment, et c'est voulu.

- Les **signals Advanced** (Pro) posent une question précise et situationnelle - *"la clôture est-elle en train de se figer sur un niveau ?"*, *"ce breakout vient-il d'échouer ?"*. Chacun produit un score sur une ligne de **-100 à +100** **et** un **trigger** discret : dès que le score franchit le seuil du signal, sa carte passe de *Stand by* à *Triggered*, et le trigger peut activer un playbook. Ils sont event-driven.
- Les **signals Basic** (Basic et Pro) sont continus. Ils ne se déclenchent pas et n'ont **aucun poids dans le Composite Score (MSI)** - ce sont des lectures consultatives qui l'accompagnent. Leur valeur tient à leur accord (conviction) ou à leur désaccord (divergence) : quand les lectures de flux divergent des lectures de structure, un changement de régime est souvent déjà en cours avant que le MSI ne bouge.

C'est la distinction la plus importante. Assimilez-la avant de lire les pages de chaque signal.

## La ligne de score

Chaque signal ZeroGEX - Advanced ou Basic - vit sur la même ligne numérique : **de -100 à +100**.

- Le **signe** indique la direction. Pour la plupart des signals, positif est haussier et négatif est baissier - mais certains sont de mean-reversion ou autrement à signe inversé, de sorte qu'un score positif ne signifie pas toujours "passer long". Vérifiez le trade bias du signal (ci-dessous) avant de lire son signe.
- La **magnitude** indique la conviction. Plus le score se rapproche de ±100, plus la lecture est forte.
- **Un score de 0 n'est presque jamais neutre.** Pour la plupart des signals, cela signifie que les données sont insuffisantes ou que cette question précise n'a pas de réponse pour le moment. Lisez un 0 comme "pas de lecture", pas comme "pas de trade".

Voir [Lire la ligne de score de -100 à +100](/help/platform/score-line) pour l'approfondissement complet.

## Triggers (signals Advanced uniquement)

Chaque signal Advanced a un seuil de trigger :

| Signal | Seuil du trigger |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Quand le trigger d'un signal se déclenche :

1. Sa carte sur l'Advanced Signal Dashboard est encadrée et teintée dans la direction du déclenchement, et son état passe de *Stand by* à *Triggered*.
2. Le Composite Score ne bouge **pas** - les signals Advanced ne font pas partie du MSI.

Rien ne vous est envoyé et rien n'est ajouté au Bulletin en direct. Pour revoir ce qu'a fait un signal, utilisez son Event Timeline - voir [Alertes de signaux](/help/platform/alerts).

## Le composite (MSI)

Le Composite Score (Market State Index, MSI) est une lecture distincte, construite à partir de **six composantes de la structure d'options** : signe du net GEX, gamma anchor, put/call ratio, régime de volatilité, déséquilibre du flux d'ordres smart-money et dealer delta pressure. Les signals Basic et Advanced ne font pas partie de ses intrants.

Le composite est un **score de régime 0-100**, où 50 est neutre - pas un point sur la ligne de -100 à +100. Une lecture élevée (≥ 70) signale un régime de tendance / expansion où les tendances peuvent se prolonger ; une lecture basse (< 20) correspond à la bande Compression, où les mouvements ont historiquement parcouru le moins de distance. Il vous indique le régime, pas la direction - pour voir dans quel sens penche le flux, consultez le Trade Bias.

Là où les signals se rejoignent vraiment :

- **Trade Bias** combine le MSI et plusieurs signals Basic et Advanced en une lecture du positionnement des dealers et du sens dans lequel penche le flux. Il décrit ; il ne prévoit pas. La page complète est Pro ; une carte compacte figure sur le Tableau de bord principal.
- **Signal Breadth**, sur le Tableau de bord principal, compte combien de signals penchent du côté haussier, neutre ou baissier.

Voir [Composite Score](/help/platform/composite-score) pour le détail complet.

## Anatomie d'une page signal

Chaque page signal sur ZeroGEX suit la même anatomie. Une fois qu'on la connaît, tout signal se lit rapidement.

1. **Titre et question** - le nom du signal, la question qu'il pose et une infobulle ⓘ qui résume son fonctionnement.
2. **Score hero** - le score actuel de -100 à +100, sa lecture en une ligne et un historique du score dépliable.
3. **Panneaux des inputs** - les intrants principaux qui déterminent le score (par ex., pour EOD Pressure : le time ramp, le pin target, le dealer charm au spot et le régime de gamma).
4. **"How it's built"** - la mécanique, en formules et en notes courtes.
5. **Event Timeline** - le parcours du score sur les deux dernières sessions, avec les changements de direction marqués et le mouvement du sous-jacent sur les 30, 60 ou 120 minutes suivantes.

L'ordre est cohérent d'une page à l'autre.

## Catégories de trade bias

Chaque signal a un trade bias déclaré ; [Signals: Explained](/guides/signals-explained) les répertorie tous.

- **Lecture directionnelle** - le signe du score correspond à la direction de prix attendue.
- **Mean-reversion (vs. crowd)** - le score reflète le fait de fader la foule, pas le prix : un score positif signale une foule penchée du côté baissier qui peut squeezer *vers le haut*, un score négatif une foule penchée du côté haussier qui peut être flushée *vers le bas*.
- **Mean-reversion (long gamma)** - fader l'extension vers la moyenne lorsque les dealers sont long gamma.
- **Continuation** - le signe du score correspond à la direction de la prochaine jambe.
- **Changement de régime / playbook** - le signal indique de changer de stratégie, pas de prendre un trade.

Faites correspondre le trade bias à votre stratégie. Un signal de continuation n'est pas un fade.

## Comment utiliser les signals

Trois schémas d'usage :

1. **Comme filtre.** Ne prenez pas de trades de tendance / breakout quand le MSI est bas (régime de chop). Ne fadez pas les rallyes en gamma négatif.
2. **Comme trigger.** Utilisez le trigger d'un signal Advanced comme signal d'entrée, avec votre propre stop et votre propre objectif.
3. **Comme confluence.** Combinez deux ou trois signals indépendants (la lecture d'un signal Basic + un trigger Advanced + la carte Trade Bias du Tableau de bord principal).

## Ce que les signals ne font pas

- Ils ne vous donnent pas les sorties.
- Ils ne dimensionnent pas votre trade.
- Ils ne connaissent pas votre tolérance au risque.

Utilisez-les au sein d'un processus fondé sur des règles, pas comme des tickets de trade autonomes.

## Voir aussi

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) - la matrice de référence complète
