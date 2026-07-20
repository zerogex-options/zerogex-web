# Comment fonctionnent les Signals, de bout en bout

*Le modèle complet des signals — Advanced vs. Basic, comment les scores se combinent, ce que montrent les cartes, et comment tout utiliser.*

---

## Les deux familles

ZeroGEX fait tourner **deux familles** de signals. Elles se comportent différemment, et c'est voulu.

- Les **signals Advanced** posent une question précise et situationnelle — *"la clôture est-elle en train de se figer sur un niveau ?"*, *"ce breakout vient-il d'échouer ?"*. Chacun produit un score sur une ligne **[-1, +1]** **et** un **trigger** discret : dès que le score franchit le seuil du signal, il déclenche une alerte et peut activer un playbook. Ils sont event-driven.
- Les **signals Basic** sont continus. Ils ne se déclenchent pas — ils alimentent plutôt le **composite MSI** avec un poids fixe, poussant la lecture combinée vers le haut ou vers le bas à chaque rafraîchissement. On les voit comme des intrants de la vue d'ensemble, pas comme des alertes autonomes.

C'est la distinction la plus importante. Assimilez-la avant de lire les pages de chaque signal.

## La ligne de score

Chaque signal ZeroGEX — Advanced ou Basic — vit sur la même ligne numérique : **[-1, +1]**.

- Le **signe** indique la direction. Positif est haussier ; négatif est baissier. Certains signals sont de mean-reversion (un score positif signifie alors "fader la hausse") ; ils affichent un chip "trade bias" bien visible sur la page.
- La **magnitude** indique la conviction. Plus le score se rapproche de ±1, plus la lecture est forte.
- **Un score de 0 n'est presque jamais neutre.** Pour la plupart des signals, cela signifie que les données sont insuffisantes ou que cette question précise n'a pas de réponse pour le moment. Lisez un 0 comme "pas de lecture", pas comme "pas de trade".

Voir [Lire la ligne de score [-1, +1]](/help/platform/score-line) pour l'approfondissement complet.

## Triggers (signals Advanced uniquement)

Chaque signal Advanced a un seuil de trigger :

| Signal | Seuil du trigger |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

Quand le trigger d'un signal se déclenche, trois choses se produisent :

1. La carte du signal sur le dashboard s'illumine dans la direction du déclenchement.
2. Une entrée apparaît dans le [Live Bulletin](/help/platform/live-bulletin).
3. Le score composite reflète la conviction plus forte.

## Le composite (MSI)

Le Composite Score (Market Score Indicator, MSI) est la **lecture combinée de l'ensemble des signals**. Chaque signal Basic contribue avec un poids fixe ; les signals Advanced contribuent lorsque leur trigger est actif.

Le composite se situe sur la même ligne [-1, +1]. Une lecture du composite supérieure à +0.4, avec plusieurs signals contribuant dans la même direction, constitue une lecture à forte confluence. Un composite oscillant près de 0 avec des contributions mixtes est, intentionnellement, "sans lecture".

Voir [Composite Score](/help/platform/composite-score) pour le détail complet.

## Anatomie d'une page signal

Chaque page signal sur ZeroGEX suit la même anatomie. Une fois qu'on la connaît, tout signal se lit rapidement.

1. **Titre + score hero** — le score, l'état du trigger et le timeframe.
2. **Chip trade-bias** — directionnel, mean-reversion, continuation, regime-switch.
3. **Panneau sparkline** — le score sur la fenêtre la plus récente.
4. **Panneau des inputs** — les intrants principaux qui déterminent le score (par ex., pour EOD Pressure : dealer charm, pin gravity, realized vol).
5. **"Comment c'est construit"** — explication en langage simple de la mécanique sous-jacente.
6. **Triggers récents** — le journal d'audit des derniers déclenchements.

L'ordre est cohérent d'une page à l'autre.

## Catégories de trade bias

Chaque signal a un trade bias déclaré. Il figure sur la carte et sur la page du signal.

- **Lecture directionnelle** — le signe du score correspond à la direction de prix attendue.
- **Mean-reversion (vs. crowd)** — un score positif élevé signifie "fader la hausse" ; on trade à l'opposé du positionnement de la foule.
- **Mean-reversion (long gamma)** — fader l'extension vers la moyenne lorsque les dealers sont long gamma.
- **Continuation** — le signe du score correspond à la direction de la prochaine jambe.
- **Changement de régime / playbook** — le signal indique de changer de stratégie, pas de prendre un trade.

Faites correspondre le trade bias à votre stratégie. Un signal de continuation n'est pas un fade.

## Comment utiliser les signals

Trois schémas d'usage :

1. **Comme filtre.** Ne prenez pas de trades acheteurs quand le composite est à -0.6. Ne fadez pas les rallyes en gamma négatif.
2. **Comme trigger.** Utilisez le trigger d'un signal Advanced comme signal d'entrée, avec votre propre stop et votre propre objectif.
3. **Comme confluence.** Combinez deux ou trois signals indépendants (une lecture de régime Basic + un trigger Advanced + le chip trade bias du dashboard).

## Ce que les signals ne font pas

- Ils ne vous donnent pas les sorties.
- Ils ne dimensionnent pas votre trade.
- Ils ne connaissent pas votre tolérance au risque.

Utilisez-les au sein d'un processus fondé sur des règles, pas comme des tickets de trade autonomes.

## Voir aussi

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) — la matrice de référence complète
