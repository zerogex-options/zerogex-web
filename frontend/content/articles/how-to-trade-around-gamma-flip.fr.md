# Comment trader autour des niveaux de Gamma Flip

*Le gamma flip est la ligne de régime la plus nette dans l'analyse du positionnement des dealers. Voici comment trader autour de lui — ce qui change quand le spot le franchit, les trois types de setups que chaque régime soutient, et le workflow pour utiliser le flip comme un changement de playbook plutôt que comme un signal directionnel.*

---

## Le flip n'est pas un niveau — c'est un changement de playbook

La plupart des traders particuliers qui entendent parler du "gamma flip" le traitent comme une nouvelle ligne de support/résistance. Acheter au flip ; vendre au flip ; trader le rebond. Cette lecture passe à côté de ce qu'est réellement le flip. Le flip n'est pas un niveau que le prix respecte — c'est une **frontière de régime** qui détermine quel playbook le mécanisme de couverture des dealers soutient aujourd'hui.

Au-dessus du flip, le réflexe du dealer est de vendre la force et d'acheter la faiblesse. Les playbooks de retour à la moyenne bénéficient d'un vent structurel favorable. Les breakouts ont tendance à échouer ; les pins ont tendance à se former ; la volatilité se comprime.

En dessous du flip, ce même réflexe s'inverse. Le book du dealer amplifie les mouvements au lieu de les amortir. Les playbooks de continuation de tendance ont le vent favorable ; les breakouts s'étendent ; les pins se cassent ; la volatilité s'accroît.

Ce n'est pas "support et résistance au flip". Ce sont deux playbooks différents pour le même graphique, selon le côté du prix précis où l'on se trouve. Bien trader autour du flip signifie changer de playbook au croisement — pas trader un niveau.

Cet article couvre le workflow. Pour une lecture plus approfondie sur ce qu'est le flip et comment l'interpréter conceptuellement, voir [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) ; pour la mécanique sous-jacente, le [pilier Gamma Exposure](/education/gamma-exposure-explained).

---

## Les trois setups que chaque régime soutient

### Au-dessus du flip (régime long-gamma)

**Setup type 1 : Fader les extrêmes en retour vers l'aimant.**
Le réflexe du dealer tire le prix vers les strikes à gamma élevé. Vendre lors des poussées près du call wall et acheter les creux près du put wall bénéficie d'un soutien structurel — le flux de couverture est de votre côté. Dimensionner la position petit ; prendre les profits à l'aimant.

**Setup type 2 : Fader les breakouts échoués.**
Quand SPX perce au-dessus du call wall mais que le Net GEX est positif et se renforce, le breakout est structurellement susceptible d'échouer. Le fade — short sur la cassure, avec pour objectif un retour dans le range précédent — est le trade canonique du long-gamma. Le signal Trap Detection existe précisément pour cette lecture ; voir l'[article combiné EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection).

**Setup type 3 : Vente de prime autour de l'aimant gamma.**
Le comportement de pin dans un régime à gamma positif tend à comprimer la volatilité réalisée. Vendre de la prime proche de la monnaie contre le strike aimant peut fonctionner — même s'il s'agit d'un trade à risque défini, pas d'un verrou structurel. Dimensionner de façon appropriée pour le risque de queue.

### En dessous du flip (régime short-gamma)

**Setup type 1 : Breakouts de continuation.**
Dans ce régime, les dealers doivent acheter la force et vendre la faiblesse — le réflexe étend les mouvements. Acheter une cassure nette au-dessus de la résistance (surtout avec un Net GEX clairement négatif) bénéficie d'un vent structurel favorable. Le signal Squeeze Setup note précisément ce type de setup comprimé et en extension ; voir [Squeeze Setup Signal Explained](/education/squeeze-setup-explained).

**Setup type 2 : Ne pas attraper le couteau qui tombe.**
Le même réflexe qui amplifie les rallyes amplifie aussi les ventes massives. Attraper des setups de "couteau qui tombe" dans un régime short-gamma profond tend à aggraver les pertes, car le mécanisme du dealer qui aurait produit le rebond en long-gamma est ici inversé. La thèse de l'achat du creux perd spécifiquement son soutien structurel en dessous du flip.

**Setup type 3 : Trader dans le sens du flux, pas contre.**
Le Tape Flow Bias et les signaux de continuation similaires pèsent davantage dans les régimes short-gamma. Quand le flux pondéré par la prime penche dans une direction et que le Net GEX est négatif, le mouvement tend à s'étendre plutôt qu'à se faire fader.

---

## Comment utiliser réellement le flip en intraday

Un workflow court :

### Étape 1 : Vérifier le régime à l'ouverture

Avant tout setup, relever le gamma flip et le Net GEX. Noter le gamma magnet et les walls. La position du spot par rapport au flip est la première lecture de la journée — et l'attente de playbook doit en découler.

### Étape 2 : Définir un déclencheur de "changement de régime"

Si le spot franchit le flip pendant la session, votre playbook par défaut s'inverse. Ce n'est pas symbolique — c'est le mécanisme réel qui s'inverse. Un trader qui fade les rallyes depuis deux heures au-dessus du flip devrait arrêter dès l'instant où le spot passe en dessous ; le même trade n'est désormais plus soutenu structurellement.

### Étape 3 : Observer la distance, pas seulement le côté

Un spot situé 0,05 % au-dessus du flip est structurellement disputé — les deux régimes sont partiellement actifs. Un spot situé 0,4 % au-dessus est fermement en long-gamma. La distance au flip fait partie de la lecture. La zone disputée (environ ±0,1 % du flip) est l'environnement le plus bruité ; réduisez la taille ou restez à l'écart.

### Étape 4 : Surveiller la migration du flip

Le flip se déplace en intraday à mesure que le positionnement se rééquilibre. Un flip qui dérive vers le haut pendant que le prix monte graduellement est une lecture ; un flip figé pendant que le prix grimpe au-dessus de lui en est une autre. La relation entre le prix et le flip est dynamique — suivez le *changement* de l'écart, pas seulement la distance statique.

### Étape 5 : Recouper avec l'ampleur du Net GEX

Un flip avec 1,5 Md$ de Net GEX au-dessus est un régime marqué. Un flip avec 200 M$ est faible. L'ampleur compte autant que le signe. Plus le book du dealer est important, plus le réflexe de régime se manifeste dans le tape.

---

## Quand le flip est disputé

L'état le plus dangereux est celui où le spot se situe *exactement au* flip. Les réflexes des deux régimes sont partiellement actifs, aucun ne domine, et le comportement est instable. Les trades qui fonctionnent au-dessus du flip ne fonctionnent pas ; ceux qui fonctionnent en dessous non plus. En pratique :

- Réduisez la taille de position ou restez à l'écart.
- Ne vous engagez pas dans un seul playbook de régime.
- Observez de quel côté du flip le prix se stabilise — la réponse indique quel playbook exécuter ensuite.
- Soyez particulièrement prudent à l'approche de la clôture, quand les flux de charm peuvent pousser le spot à travers le flip et acter un changement de régime.

Un flip disputé est un signal d'incertitude de régime. La bonne réponse est de réduire l'exposition, pas de faire un autre trade.

---

## Exemple chiffré

SPX est à 5 810 à l'ouverture. ZeroGEX affiche :

- **Gamma Flip :** 5 802 (le spot est +8 au-dessus)
- **Net GEX :** +1,2 Md$
- **Call Wall :** 5 820
- **Put Wall :** 5 790

Lecture initiale : régime long-gamma, positionnement sain, range structurel 5 790-5 820. Playbook par défaut : fader les extrêmes (vendre les poussées vers 5 820, acheter les creux vers 5 790), éviter le milieu.

Vers 13h00 ET, SPX a glissé à 5 800 — désormais 2 points en dessous du flip. Le Net GEX s'est réduit à +300 M$ et le flip a dérivé vers le haut jusqu'à 5 803. Le régime est disputé — le spot vient de franchir le flip, l'ampleur diminue, et le réflexe structurel s'affaiblit.

Le playbook change. Le setup fade-the-rally qui était actif à 14h30 n'est désormais plus soutenu structurellement ; une continuation à la hausse est possible si le Net GEX bascule en négatif. La taille de position devrait diminuer ; le trade par défaut est de ne pas trader jusqu'à ce que le régime se résolve.

À 14h30 ET, le Net GEX a basculé à −200 M$ et SPX a poussé jusqu'à 5 815. C'est désormais un régime short-gamma — le réflexe du dealer amplifie, et le call wall à 5 820 n'est plus une résistance structurelle ; c'est un objectif de breakout. Le trade fade-the-breakout est *hors jeu* ; si le setup est correct, la poursuite du mouvement devient le trade à prendre.

Même graphique, trois playbooks différents au fil de la session — entièrement pilotés par la variable de régime.

---

## Erreurs courantes

- **Traiter le flip comme un support ou une résistance.** C'est une ligne de régime, pas un niveau. Acheter la faiblesse *en direction* du flip depuis le haut est structurellement différent de l'acheter depuis le bas. La même entrée sur le graphique a un mécanisme opposé derrière elle.
- **Ignorer le flip quand le spot en est loin.** Même si le spot est à 1 % au-dessus du flip, celui-ci reste pertinent pour le contexte — il indique dans quel régime se trouve le playbook du jour. Le flip n'a pas d'importance seulement quand le prix en est proche.
- **Traiter la persistance du régime comme inévitable.** Les régimes long-gamma peuvent basculer en short-gamma en une heure. Le flip est dynamique. Une lecture de régime faite ce matin peut être périmée à l'heure du déjeuner.
- **Trader le croisement du flip comme un setup de rebond.** Le croisement du flip est un *signal de playbook*, pas un signal de rebond. Parfois le prix rebondit dessus ; souvent il le traverse. Ne tradez pas le niveau — tradez le changement de régime.

---

## À retenir

> Le gamma flip n'est pas un niveau de prix contre lequel trader. C'est un changement de playbook — la ligne où le réflexe de couverture des dealers s'inverse. Bien trader autour de lui signifie changer les setups que vous prenez, pas changer vos points d'entrée.

La discipline consiste à vérifier le régime avant chaque setup et à le revérifier à chaque croisement du flip. Le playbook qui bénéficie d'un vent structurel favorable d'un côté du flip est celui qui se fait écraser de l'autre côté. La plupart des traders qui perdent de l'argent en "tradant le flip" perdent en réalité de l'argent en exécutant le mauvais playbook pour le régime en cours.

Contenu à visée uniquement éducative — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le gamma flip du jour avec la distance en direct par rapport au spot, la vérification du régime et l'ampleur du Net GEX — les trois chiffres qui déterminent quel playbook la force structurelle du tape soutient en ce moment — la vue gratuite des gamma-levels de ZeroGEX les affiche tous.
