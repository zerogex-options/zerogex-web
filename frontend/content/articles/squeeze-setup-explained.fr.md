# Signal Squeeze Setup expliqué : lire les marchés comprimés

*L'analyse approfondie et pratique du signal Squeeze Setup de ZeroGEX — ce qu'il mesure, les cinq inputs qui déterminent le score, quand il se déclenche et quand il reste silencieux, et comment l'utiliser pour repérer les marchés comprimés prêts pour un mouvement directionnel.*

---

## Pourquoi ce signal existe

La plupart des outils d'options-flow vous disent que quelque chose se passe *en ce moment même*. Presque aucun ne vous dit que le tape a discrètement **emmagasiné** l'énergie nécessaire pour bouger — que le flow, le momentum, la gamma et la volatilité s'alignent avant même que le mouvement réel ne se déclenche.

C'est le vide que le signal Squeeze Setup est conçu pour combler. Il ne prédit pas la direction de manière directe. Il indique quand les conditions d'un mouvement directionnel se sont accumulées à travers plusieurs inputs structurels, de sorte que lorsque le catalyseur arrive, le mouvement dispose déjà de carburant.

Cet article propose une lecture orientée trader du signal Squeeze Setup. Il couvre ce qu'il évalue, comment le score est calculé, quand il se déclenche et quand il reste silencieux, et comment agir pendant une session. La référence complète des signaux ZeroGEX se trouve dans le [guide Signals: Explained](/guides/signals-explained), et la mécanique structurelle qui alimente la plupart de ses inputs est traitée dans le [pilier Gamma Exposure](/education/gamma-exposure-explained).

---

## Qu'est-ce que le signal Squeeze Setup ?

Le signal Squeeze Setup pose une question :

> Le marché est-il comprimé — le flow, le momentum, la gamma et la volatilité s'alignent-ils pour charger une énergie qui n'a pas encore été libérée ?

C'est un signal **Avancé** dans la pile ZeroGEX — il produit à la fois un score continu sur l'échelle [-1, +1] et un déclenchement discret lorsque le score absolu dépasse **0,25**.

Point essentiel, Squeeze Setup est un signal de **Continuation**, pas de fade. Lorsqu'il se déclenche, l'inclinaison pratique consiste à trader *dans le sens* du mouvement une fois qu'il casse, pas contre lui. Cela en fait l'opposé d'outils de mean-reversion comme Positioning Trap ou Trap Detection. Savoir dans quelle catégorie se situe un signal représente la moitié du travail pour bien le lire.

---

## Le mécanisme : comment la compression se construit

Les marchés ne se compriment pas toujours avant de bouger — mais lorsque c'est le cas, certaines conditions mesurables ont tendance à se regrouper :

1. **Le flow commence à s'incliner directionnellement.** La prime des calls domine constamment celle des puts, ou l'inverse — et l'inclinaison est suffisamment large par rapport à la volatilité de flow habituelle du symbole pour se démarquer.
2. **Le momentum à court terme s'accélère.** Le momentum sur 5 barres dépasse celui sur 10 barres. La pente s'accentue, pas seulement une tendance.
3. **La net gamma est suffisamment dense pour que le hedging compte.** Un book de dealers plat ne propage pas les mouvements ; un book chargé, si.
4. **Le spot est positionné par rapport au gamma flip de manière à ouvrir un potentiel haussier.** Si le spot est juste en dessous du flip et que le flow est haussier, le setup structurel pour un franchissement du flip suivi d'une extension est présent.
5. **Le régime de volatilité est le bon.** Un régime VIX de panique atténue les setups (tout bouge déjà) ; un régime VIX mort peut produire de fausses compressions.

Squeeze Setup combine les cinq en un seul score continu par côté (bull et bear), puis les nette.

---

## Les cinq inputs principaux

| Input | Ce qu'il capture |
|---|---|
| Flow z-score | Les deltas de flow calls/puts standardisés (z-score) selon la volatilité de flow propre à chaque symbole — un flow "important" sur un symbole calme est jugé significatif ; un flow "important" sur un symbole bruyant doit franchir une barre plus haute |
| Momentum 5/10 barres | Deux horizons comparés, à la recherche d'une accélération (5 barres dépassant 10 barres) plutôt que d'une simple direction |
| Gamma readiness | La net gamma passée dans une tanh lissée, donnant "le book est-il assez chargé pour compter ?" sous forme de multiplicateur continu de 0 à 1 |
| Distance au flip | À quel point le spot est proche du gamma flip, le côté étant intégré comme multiplicateur de sorte qu'un setup bull proche du flip par le bas obtienne un score plus élevé |
| Régime VIX | Mort / normal / élevé / panique — utilisé pour atténuer ou amplifier le score selon le contexte |

Le résultat est un seul nombre, mais il porte en lui la structure conjointe des cinq inputs.

---

## Comment le score est calculé

Pour chaque côté (bull et bear), le signal multiplie :

```
side_score = normalized_flow × directional_momentum_strength
           × gamma_readiness × acceleration_multiplier × flip_side_multiplier
```

Le score net est `bull_score − bear_score`, borné à [-1, +1]. Le déclenchement se produit lorsque le score absolu est ≥ **0,25**.

Deux faits structurels de cette formule comptent pour la lecture :

- **Chaque terme multiplie, il ne s'additionne pas.** Si l'un des cinq termes tombe à zéro, le côté est annulé. Le signal a une position tranchée sur *quand* les squeezes fonctionnent — il refuse de se déclencher lorsqu'une des conditions n'est pas remplie, même si les autres crient très fort.
- **Les côtés bull et bear sont calculés indépendamment, puis nettés.** Dans les cas rares où les deux se déclenchent simultanément (setups véritablement disputés), ils s'annulent partiellement — ce qui est approprié, car la lecture est ambiguë.

---

## Interprétation du score

| Score | Lecture |
|---|---|
| +0,6 à +1,0 | Fortement comprimé à la hausse |
| +0,25 à +0,6 | Déclenché haussier — le playbook de breakout haussier est actif |
| -0,25 à +0,25 | Sous le seuil — informatif, non actionnable à lui seul |
| -0,25 à -0,6 | Déclenché baissier — le playbook de breakout baissier est actif |
| -0,6 à -1,0 | Fortement comprimé à la baisse |

Le seuil de 0,25 est délibérément conservateur. Squeeze Setup pose une exigence élevée — *tous* les inputs structurels s'alignent-ils ? — et le seuil reflète cela. Une lecture de 0,20 est limite ; seul 0,25+ compte comme déclenché.

---

## Quand le signal se déclenche et quand il reste silencieux

L'état dominant est le **silence**. Squeeze Setup est conçu pour rester silencieux la plupart du temps. Sur la plupart des symboles, pendant la majeure partie de la journée de trading, aucune des cinq conditions ne s'accumule — et ce silence est informatif. Il indique que les préconditions structurelles d'un breakout ne sont pas réunies, donc les breakouts que vous observez sont probablement du bruit.

Le signal ne se déclenchera que lorsque :

- Le flow est suffisamment important pour être statistiquement significatif par rapport à l'historique du symbole (la composante z-score n'est pas négligeable).
- Le momentum s'accélère, pas seulement une tendance.
- La gamma est suffisamment chargée pour que les flux de hedging puissent propager les mouvements.
- Le spot est positionné par rapport au flip de manière à ouvrir une asymétrie directionnelle.
- Le régime de volatilité n'atténue pas le signal jusqu'à zéro.

Quelques minutes de chaque session, sur les quelques symboles où tout cela s'aligne — c'est là que vit Squeeze Setup.

---

## Ce que fait un trader lorsqu'il se déclenche

Le portail canonique du playbook :

> Un score Squeeze Setup persistant au-dessus du seuil sur deux sessions consécutives déclenche le playbook Squeeze Breakout — entrée sur une cassure nette d'une enveloppe de volatilité à 30 barres, dans la direction vers laquelle penche le signal.

La persistance sur deux sessions est un filtre délibéré. Les déclenchements sur une seule barre sont trop bruyants ; la compression structurelle doit *tenir*. Lorsque c'est le cas, le signal indique essentiellement : les conditions pour bouger sont réunies, attendez la cassure, puis tradez dans la direction du score.

Quelques remarques pratiques :

- **La direction vient du signe du score, pas de la technique d'entrée.** Le signal fournit la lecture directionnelle ; la cassure de l'enveloppe de volatilité est le déclencheur de timing.
- **L'amplitude compte.** Un score de +0,55 est nettement différent de +0,27 — tous deux déclenchés, mais le trade avec la plus forte conviction est celui au score le plus élevé.
- **Les scores sous le seuil restent informatifs.** Une lecture persistante de +0,20 n'est pas actionnable à elle seule, mais si tous les autres signaux penchent également haussier, elle s'ajoute à la lecture composite.

---

## Lire Squeeze Setup avec d'autres signaux

Squeeze Setup n'est qu'un signal parmi d'autres — et c'est dans la confluence que réside le véritable edge. Quelques lectures croisées courantes :

- **Squeeze Setup + Vol Expansion dans la même direction.** Deux signaux de Continuation en accord — le mouvement a à la fois *compression* et *capacité*. Le setup le plus propre.
- **Squeeze Setup + Trap Detection en opposition.** Comprimé à la hausse selon Squeeze, mais Trap Detection indique que la cassure haussière la plus récente échoue. L'un des deux se trompe sur la cassure actuelle ; la bonne réaction est généralement de passer son tour et d'attendre.
- **Squeeze Setup + Positioning Trap alignés.** Compression avec la foule mal positionnée du même côté — un squeeze de couverture de short si la foule est short, un flush si elle est long. Les deux signaux pointent vers le même trade. L'article complémentaire sur le [signal Positioning Trap](/education/positioning-trap-explained) traite cette lecture en détail.
- **Squeeze Setup à 0 alors que tous les autres signaux sont actifs.** Rien de structurel n'est probablement comprimé ; le mouvement que vous observez est réactif, pas chargé.

Lorsque plusieurs signaux de Continuation (Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow) s'alignent dans la même direction, la conviction se cumule. Lorsqu'ils s'opposent aux signaux de Mean-reversion, le tape est disputé.

---

## Erreurs de lecture courantes

Trois pièges :

- **Traiter un 0 comme "neutre".** Un 0 sur Squeeze Setup signifie que *rien n'est comprimé* — pas que le marché est équilibré. Ne tradez pas en le considérant comme un feu vert "calme".
- **Trader sur un score sous le seuil.** Le seuil de 0,25 compte. Une lecture de 0,18 peut *sembler* être un setup, mais elle n'est pas déclenchée — et la différence entre "sensation de compression" et "compression structurelle réelle" représente l'essentiel de l'edge.
- **Ignorer le régime.** Squeeze Setup ne dit rien à lui seul sur le régime de gamma. Un marché comprimé sous le flip se comporte différemment d'un marché au-dessus. Vérifiez toujours avec le workflow [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Comment ZeroGEX affiche le signal Squeeze Setup

Le dashboard l'affiche à plusieurs endroits :

- **La carte Squeeze Setup** affiche le score en direct, l'état du déclenchement et la décomposition des inputs.
- **Le Composite Signal Score** intègre Squeeze Setup comme un input parmi les autres signaux Avancés et de Base.
- **Le Trade Stream** signale les trades du playbook conditionnés par `squeeze_breakout` lorsqu'ils se déclenchent.

*[Emplacement d'image : carte Squeeze Setup de ZeroGEX avec score, état du déclenchement et contributions des inputs — déposer le fichier à /public/blog/zerogex-squeeze-setup-card.png]*

Un exemple concret. Supposons que SPX évolue latéralement pendant la session de mercredi et que ZeroGEX affiche :

- **Squeeze Setup :** +0,42 (déclenché haussier)
- **Net GEX :** +$800M
- **Gamma Flip :** le spot est 0,2 % au-dessus
- **Tape Flow Bias :** +0,6
- **Trap Detection :** 0

La lecture structurelle : un setup comprimé à la hausse avec une inclinaison de flow confirmante, aucun signal contraire de breakout raté, et un régime de gamma longue qui atténuera le mouvement s'il tente de s'étendre trop loin. Inclinaison pratique : rester attentif à une cassure haussière de l'enveloppe de volatilité ; lorsqu'elle survient, les conditions structurelles pour un suivi sont réunies. Rien de tout cela n'est un trade — c'est la lecture du régime qui devrait remodeler les entrées que vous prenez au sérieux.

---

## À retenir

> Squeeze Setup vous indique quand le marché a *emmagasiné* l'énergie pour bouger, pas quand il a déjà bougé. C'est un signal de précondition, pas un signal de timing.

La discipline consiste à l'utiliser comme filtre pour déterminer quels breakouts directionnels prendre au sérieux, plutôt que comme le déclencheur lui-même. Lorsque le score est déclenché, le setup de breakout est réel ; lorsqu'il est à zéro, les breakouts que vous observez ne sont que du bruit. Cette distinction représente l'essentiel de l'edge.

Contenu à but éducatif uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous souhaitez suivre en temps réel la lecture Squeeze Setup du jour aux côtés du gamma flip, des walls et des autres signaux Avancés et de Base, le dashboard gratuit de ZeroGEX affiche tout cela.
