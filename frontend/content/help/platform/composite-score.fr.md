# Composite Score

*La lecture combinée de tous les signaux ZeroGEX — comment elle est construite, comment l'interpréter et comment l'utiliser comme filtre plutôt que comme prévision.*

---

## Qu'est-ce que le Composite Score

Le Composite Score — en interne **MSI**, le Market Score Indicator — est le **résumé en un seul nombre** de tous les signaux ZeroGEX sur le symbole actif. Il se situe sur la même ligne **[-1, +1]** que tout autre score de signal.

Composite positif ⇒ biais structurel haussier. Négatif ⇒ biais structurel baissier. L'amplitude indique la conviction.

## Comment il est construit

Trois entrées glissantes se combinent en un seul nombre :

1. **Signaux Basic** — chaque signal Basic contribue avec un petit poids fixe (4–8 % du composite). Même lorsqu'ils ne se déclenchent pas, ils influencent le composite en continu en arrière-plan.
2. **Déclencheurs de signaux Advanced** — lorsqu'un déclencheur de signal Advanced est actif, il contribue avec son score signé et un poids plus élevé.
3. **Contexte de régime** — le régime de gamma actif agit comme multiplicateur sur les entrées directionnelles.

Les pondérations sont calibrées pour qu'aucun signal ne domine à lui seul. Une lecture du composite proche de ±0,4–0,6 nécessite généralement l'alignement de plusieurs entrées.

## La jauge MSI

La page Composite Score affiche :

- La **jauge MSI** — score sur la ligne [-1, +1], avec un code couleur allant du rouge profond au vert profond.
- L'**état du déclencheur** — indique si le composite a franchi un seuil d'attention.
- Le panneau des **signaux contributeurs** — chaque entrée avec sa contribution actuelle au composite, triée par amplitude.
- L'**en-tête de régime** — Positive Gamma, Negative Gamma ou Transitioning.
- Un **sparkline** du composite sur la dernière session.

## Interpréter le composite

Une règle simple :

| Composite | Lecture |
| --- | --- |
| ≥ +0,6 | Fortement haussier — plusieurs signaux alignés à la hausse, le régime le soutient |
| +0,3 à +0,6 | Biais haussier — le biais est réel mais pas écrasant |
| -0,3 à +0,3 | Aucune lecture — le composite n'est pas utile, regarder les signaux individuels |
| -0,6 à -0,3 | Biais baissier |
| ≤ -0,6 | Fortement baissier |

La plage la plus utile est celle des extrêmes. La zone médiane est volontairement une zone où « les données ne vous disent rien » — ne forcez pas de trades à partir de là.

## Comment l'utiliser

Trois cas d'usage :

1. **Comme filtre.** Ne prenez pas de trades directionnels longs lorsque le composite est à -0,6, sauf si votre edge est spécifiquement contre-tendance.
2. **Comme vérification de confluence.** Un déclencheur Advanced à haute confiance appuyé par un composite dans la même direction constitue une lecture plus fiable que le déclencheur seul.
3. **Comme confirmation de régime.** Les lectures du composite ont tendance à être plus fortes et plus persistantes lors des sessions en negative gamma — elles concordent avec le comportement sous-jacent du marché.

## Ce qu'il n'est pas

Le composite **n'est pas un signal de trading**. Il indique si le tableau structurel penche dans une direction ; il ne vous dit pas de prendre un trade, quel horizon temporel utiliser, ni où placer votre stop.

## Pourquoi le composite peut basculer rapidement

Deux raisons :

- Un signal Advanced à fort poids peut se déclencher et dominer la lecture.
- Le contexte de régime (franchissement du gamma flip) peut modifier le multiplicateur appliqué à tout le reste.

Le sparkline rend ces changements brusques visibles — repérez les discontinuités.

## Habitudes de traders qui ont fait leurs preuves

- Lisez le composite à l'ouverture ainsi qu'à 11h00 / 12h30 / 14h30 ET comme points de contrôle.
- Ne tradez pas à contre-courant du composite pendant la fenêtre d'EOD Pressure.
- Traitez les scores composites entre -0,3 et +0,3 comme un signal d'« attente » plutôt que de « neutralité ».

## Note sur les niveaux

La page Composite Score est réservée à l'offre Pro. La jauge du composite apparaît également sur le Dashboard pour tous les niveaux payants.

## Voir aussi

- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Lire la ligne de score [-1, +1]](/help/platform/score-line)
- [Signaux : expliqués](/guides/signals-explained)
