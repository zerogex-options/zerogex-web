# Lire la ligne de score [-1, +1]

*Chaque score de signal se situe sur la même ligne numérique. Ce que signifient le signe et l'amplitude, quand un 0 n'est pas une réponse, et quand il faut agir.*

---

## Pourquoi la ligne de score est fixe

Chaque signal ZeroGEX — Advanced ou Basic — exprime sa lecture sur la même échelle **[-1, +1]**. L'avantage est évident : la confluence entre signaux devient une comparaison équitable. Un +0.5 sur Squeeze Setup et un +0.5 sur EOD Pressure expriment conceptuellement des niveaux de confiance similaires.

Le coût : chaque signal a un **biais de trade** différent, donc la signification d'un +0.5 dépend du signal dont il provient.

## Signe

Pour les signaux directionnels, le signe correspond à la direction de prix attendue :

- **Positif ⇒ biais haussier** (le biais de trade est long)
- **Négatif ⇒ biais baissier**

Pour les signaux de mean-reversion (Positioning Trap, Trap Detection dans certaines configurations), le signe indique la **direction du mouvement à fader** :

- **Positif ⇒ le mouvement à la hausse est hors de propos / a échoué** (fade à la baisse)
- **Négatif ⇒ le mouvement à la baisse est hors de propos / a échoué** (fade à la hausse)

La carte du signal sur chaque page précise laquelle des deux lectures s'applique. Lisez le badge de biais de trade avant de lire le score.

## Amplitude

Plus on se rapproche de ±1, plus la conviction est élevée. Repère pratique :

| Plage | Lecture |
| --- | --- |
| 0.0 – 0.2 | Dans le bruit. Aucune lecture exploitable. |
| 0.2 – 0.4 | Biais léger. Filtre, pas un déclencheur. |
| 0.4 – 0.6 | Lecture solide. Combinée à la confluence, exploitable. |
| 0.6 – 0.8 | Lecture forte. Le signal exprime une affirmation réelle. |
| 0.8 – 1.0 | Conviction maximale. Rare. À surveiller attentivement. |

## Un score de 0 n'est presque jamais neutre

C'est le point le plus souvent mal compris à propos des scores de signaux.

Un score de 0 signifie généralement :

- Les données sont **insuffisantes** pour la question que pose ce signal.
- La question ne s'applique pas en ce moment (par exemple, EOD Pressure pendant l'ouverture).
- Les inputs **s'annulent proprement** — également haussiers et baissiers.

Chacun de ces cas est une "absence de lecture", pas un "marché neutre". Un marché structurellement neutre se manifeste habituellement par des scores qui oscillent autour de ±0.1 — pas par un zéro net.

Quand vous voyez un vrai 0, survolez la carte du signal. L'infobulle explique pourquoi.

## Déclencheurs vs. scores

Certains signaux Advanced possèdent un état supplémentaire en plus du score :

- Un **déclencheur** discret (oui/non) qui s'active lorsque le score franchit un seuil.
- Une métrique secondaire (loading 0–100 pour Market Pressure, imminence 0–100 pour Range Break) qui conditionne le déclencheur indépendamment du score.

Le score est la **lecture** ; le déclencheur est l'**événement**. Vous pouvez utiliser le score comme filtre sans attendre le déclencheur.

## Lire le sparkline

La pente compte autant que le niveau.

- Un score à +0.4 en tendance **haussière** est une lecture en développement — le momentum est de son côté.
- Un score à +0.4 en tendance **baissière** depuis +0.7 est une lecture qui s'estompe — le signal avait raison plus tôt, moins maintenant.
- Un score qui change de signe dans une courte fenêtre traduit de la volatilité, pas de la conviction. Attendez que cela se stabilise.

## Quand agir

Une règle simple qui a fait ses preuves :

> Agissez sur la **confluence**, pas sur des scores individuels.

Un seul +0.7 sur un signal est intéressant. Un +0.5 sur trois signaux issus de dimensions indépendantes (un signal Basic, un signal Advanced, le composite) est un trade.

## Ce qui change si le régime change

En franchissant le gamma flip, l'**interprétation** de certains scores change :

- Gamma/VWAP Confluence : gamma longue au-dessus du flip ⇒ mean-revert ; gamma courte en dessous du flip ⇒ continuation.
- Trap Detection est plus tranché en gamma négative.
- EOD Pressure pine plus fortement en gamma positive.

Les cartes de signal en tiennent déjà compte — mais le savoir explique pourquoi le même score peut vouloir dire des choses différentes selon les jours.

## Voir aussi

- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signaux : expliqués](/guides/signals-explained)
