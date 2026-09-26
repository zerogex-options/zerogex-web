# Lire la ligne de score de -100 à +100

*Chaque score de signal se situe sur la même ligne numérique. Ce que signifient le signe et l'amplitude, quand un 0 n'est pas une réponse, et quand il faut agir.*

---

## Pourquoi la ligne de score est fixe

Chaque signal ZeroGEX - Advanced ou Basic - exprime sa lecture sur la même échelle de **-100 à +100**. (En interne, chaque signal calcule une valeur entre -1 et +1 ; l'application l'affiche multipliée par 100.) L'avantage est évident : la confluence entre signaux devient une comparaison équitable. Un +50 sur Squeeze Setup et un +50 sur EOD Pressure expriment conceptuellement des niveaux de confiance similaires.

Le coût : chaque signal a un **biais de trade** différent, donc la signification d'un +50 dépend du signal dont il provient.

Le seul chiffre clé qui ne se trouve pas sur cette ligne est le Composite Score (MSI) : une jauge de régime 0-100 où 50 est neutre. Voir [Composite Score](/help/platform/composite-score).

## Signe

Pour les signaux directionnels, le signe correspond à la direction de prix attendue :

- **Positif ⇒ biais haussier** (le biais de trade est long)
- **Négatif ⇒ biais baissier**

Pour les signaux de mean-reversion (Positioning Trap, Trap Detection), le signe indique le **biais directionnel résolu** - le trade se joue *contre* la foule mal positionnée ou la cassure avortée, de sorte que le signe pointe dans le même sens que pour les signaux directionnels ci-dessus :

- **Positif ⇒ biais haussier** - p. ex. une foule short/baissière menacée d'un squeeze vers le haut, ou une cassure baissière avortée que vous achèteriez
- **Négatif ⇒ biais baissier** - p. ex. une foule long/haussière menacée d'un flush vers le bas, ou une cassure haussière avortée que vous vendriez

Sachez quel type de signal vous lisez avant de lire le score. L'infobulle ⓘ et le panneau "How it's built" de chaque page de signal indiquent ce que signifie son signe, et [Signaux : expliqués](/guides/signals-explained) répertorie le biais de trade de chaque signal.

## Amplitude

Plus on se rapproche de ±100, plus la conviction est élevée. Un repère pratique, fondé sur les seuils et les libellés qu'utilisent les pages de signaux :

| Score (quel que soit le signe) | Lecture |
| --- | --- |
| 0 - 25 | Sous la ligne d'activation de la plupart des signaux. Les pages le qualifient d'équilibré, plat, neutre ou "no edge". Aucune lecture exploitable à elle seule. |
| 25 - 50 | Un biais qui se construit. La plupart des cartes s'activent à ±25 ; EOD Pressure et Gamma/VWAP Confluence se déclenchent un peu plus tôt, à ±20. Filtre, ou déclencheur avec confluence. |
| 50 - 70 | Lecture forte. Plusieurs pages de signaux passent à leur libellé le plus fort à ±50 ou ±60 - Positioning Trap parle alors, par exemple, d'un setup de squeeze ou de flush. |
| 70 - 100 | Le haut de l'échelle. EOD Pressure et Volatility Expansion réservent leurs libellés les plus forts à ±70 et plus. Rare. À surveiller attentivement. |

Chaque page de signal affiche aussi sa propre lecture en une ligne du score actuel. Là où la page et ce tableau divergent, fiez-vous à la page. Range Break Imminence et Market Pressure Index ne se déclenchent pas du tout sur le score - voir Déclencheurs vs. scores ci-dessous.

## Un score de 0 n'est presque jamais neutre

C'est le point le plus souvent mal compris à propos des scores de signaux.

Un score de 0 signifie généralement :

- Les données sont **insuffisantes** pour la question que pose ce signal.
- La question ne s'applique pas en ce moment (par exemple, EOD Pressure avant l'ouverture de sa fenêtre à 14:30 ET).
- Les inputs **s'annulent proprement** - également haussiers et baissiers.

Chacun de ces cas est une "absence de lecture", pas un "marché neutre". Un marché structurellement neutre se manifeste habituellement par des scores qui oscillent autour de ±10 - pas par un zéro net.

Les signaux Basic affichent rarement un vrai 0 : quand l'un d'eux n'a pas de données principales, le moteur affiche à la place une petite inclinaison tirée du régime, dans une fourchette de ±10. Traitez aussi un score Basic à un seul chiffre comme une "absence de lecture".

Quand vous voyez un vrai 0, consultez la carte et la page du signal. Les cartes EOD Pressure et 0DTE Position Imbalance affichent *Inactive* tant que leur fenêtre est fermée, et, sur de nombreuses pages de signaux, le panneau "How it's built" explique ce que signifie un 0 pour ce signal.

## Déclencheurs vs. scores

Les signaux Advanced possèdent un état supplémentaire en plus du score :

- Un **déclencheur** qui s'active lorsque le score franchit un seuil - ±25 pour la plupart, ±20 pour EOD Pressure et Gamma/VWAP Confluence. La carte affiche *Triggered* ou *Stand by*.
- Une métrique secondaire (loading 0-100 pour Market Pressure Index, imminence 0-100 pour Range Break Imminence) qui fixe le déclencheur à la place du score : Market Pressure Index se déclenche à loading ≥ 50 avec une direction nette, Range Break Imminence à imminence ≥ 65.

Le score est la **lecture** ; le déclencheur est l'**événement**. Vous pouvez utiliser le score comme filtre sans attendre le déclencheur.

Les cartes des signaux Basic sont elles aussi encadrées et marquées *Triggered* au-delà de ±25, mais pour les signaux Basic cela ne fait que souligner une lecture forte - aucune règle de déclenchement ne se trouve derrière.

## Lire le sparkline

La pente compte autant que le niveau. Chaque carte des tableaux de bord porte un sparkline ; sur une page de signal, ouvrez **Expand score history**.

- Un score à +40 en tendance **haussière** est une lecture en développement - le momentum est de son côté.
- Un score à +40 en tendance **baissière** depuis +70 est une lecture qui s'estompe - le signal avait raison plus tôt, moins maintenant.
- Un score qui change de signe dans une courte fenêtre traduit de la volatilité, pas de la conviction. Attendez que cela se stabilise.

## Quand agir

Une règle simple qui a fait ses preuves :

> Agissez sur la **confluence**, pas sur des scores individuels.

Un seul +70 sur un signal est intéressant. Un +50 sur trois signaux issus de dimensions indépendantes (par exemple, deux signaux Basic et un signal Advanced) est un trade. Le composite ne fait pas partie de ce décompte - c'est une jauge de régime 0-100, pas un score directionnel de -100 à +100, donc ne lisez pas son niveau comme haussier/baissier.

## Ce qui change si le régime change

En franchissant le gamma flip, l'**interprétation** de certains scores change :

- Gamma/VWAP Confluence : gamma longue au-dessus du flip ⇒ mean-revert ; gamma courte en dessous du flip ⇒ continuation.
- GEX Gradient s'inverse avec le régime : en gamma courte, un gamma concentré au-dessus du spot est noté haussier ; en gamma longue, c'est le gamma concentré sous le spot qui l'est, et la lecture est atténuée.
- Trap Detection ne se déclenche que lorsque les dealers sont modélisés long gamma - en gamma négative, il reste à 0.
- EOD Pressure tire vers le pin en gamma positive ; en gamma négative, il suit plutôt le mouvement récent.

Les cartes de signal en tiennent déjà compte - mais le savoir explique pourquoi le même score peut vouloir dire des choses différentes selon les jours.

## Voir aussi

- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signaux : expliqués](/guides/signals-explained)
