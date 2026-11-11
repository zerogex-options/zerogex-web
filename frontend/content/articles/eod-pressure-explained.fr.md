# Le signal EOD Pressure expliqué : lire la clôture

*L'analyse approfondie et pratique du signal ZeroGEX EOD Pressure - la question qu'il pose, pourquoi la clôture connaît une dérive structurelle, comment le score combine charm et pin gravity, et comment le lire au cours des 90 dernières minutes.*

---

## Pourquoi ce signal existe

Les 90 dernières minutes de la séance au comptant sont structurellement différentes du reste de la journée. La décroissance du charm sur les positions 0DTE tend à pousser les dealers à se recouvrir plus activement. La pin gravity autour des strikes à gamma élevé peut s'intensifier. Le book modélisé des dealers est plus contraint qu'à presque n'importe quel autre moment de la séance.

Ces forces sont souvent directionnelles et lisibles - *à condition* de savoir quoi chercher. Le signal EOD Pressure est conçu pour faire remonter cette dérive directionnelle modélisée en temps réel, afin que les traders puissent se positionner dans le sens du flux de clôture plutôt que de le combattre.

Cet article propose la lecture orientée trader du signal EOD Pressure. Il couvre ce qu'il mesure, pourquoi la clôture est différente, comment le score est construit à partir du charm et de la pin gravity, et comment le lire à l'intérieur de la fenêtre. Pour l'article méthodologique plus approfondi qui associe EOD Pressure et Trap Detection, voir [Trader la clôture](/education/eod-pressure-and-trap-detection) ; pour la mécanique sous-jacente, [Vanna et charm expliqués](/education/vanna-and-charm-explained) détaille comment le charm entraîne les flux de couverture modélisés.

---

## Qu'est-ce que le signal EOD Pressure ?

Le signal EOD Pressure pose une seule question :

> Compte tenu du book modélisé des dealers et de la proximité d'un strike aimant, de quel côté la couverture modélisée penche-t-elle à l'approche de la clôture ?

C'est un signal **Advanced** dans la stack ZeroGEX - il produit à la fois un score continu sur une échelle de -100 à +100 et un déclenchement discret lorsque le score franchit **±20**. Le seuil est volontairement plus bas que celui de la plupart des signaux Advanced (±25), car le contexte structurel (la fenêtre de clôture) fait déjà office de filtre - quand EOD Pressure affiche 15 ou plus dans un sens ou dans l'autre pendant la fenêtre active, il est déjà informatif sur la direction. Comme tous les signaux Advanced, il fait partie de Pro.

Biais de trading : **lecture directionnelle**. Le signal indique dans quel sens penche la pression - il ne prescrit pas en soi de suivre ou de faire un fade. Cela dépend du contexte de régime.

---

## Pourquoi la clôture est différente

Trois mécanismes structurels se cumulent dans la dernière fenêtre de la séance :

1. **La décroissance du charm s'accélère.** À mesure que les options 0DTE approchent de l'expiration, leur delta tend à dériver vers 0 (hors de la monnaie) ou ±1 (dans la monnaie), toutes choses égales par ailleurs. Les dealers qui gèrent un book à peu près delta-neutre tendent à se recouvrir plus souvent, et le rythme modélisé de cette recouverture *augmente* à l'approche de la clôture.
2. **La pin gravity s'intensifie.** Les strikes à gamma élevé peuvent attirer davantage le prix à mesure que le temps avant expiration diminue. Dans un régime long gamma modélisé, le magnétisme modélisé vers le strike lourd le plus proche tend à se renforcer au fil de l'après-midi.
3. **La liquidité s'amenuise.** Les flux en blocs, le rééquilibrage de fin de journée et les ordres structurels sur indices font passer le profil du flux de continu à saccadé. Les dealers disposent de moins de marge pour absorber les erreurs.

EOD Pressure combine les deux premiers éléments en une lecture directionnelle. Le troisième est implicite dans le calibrage du score.

---

## Les quatre composantes principales

Le signal agrège quatre composantes - trois contribuent à l'ampleur, une agit comme un verrou strict.

### Composante 1 : charm au spot

La mesure modélisée la plus directe du flux de couverture. Le signal fait la somme de l'exposition au charm modélisée des dealers sur une bande at-the-money mise à l'échelle de la volatilité, pondérée par bucket d'expiration :

| Bucket | Poids | Pourquoi |
|---|---|---|
| 0DTE | 0,70 | Le charm frappe le plus fort le jour de l'expiration. Contribution dominante. |
| Weekly | 0,20 | Significative mais secondaire. |
| Monthly | 0,10 | Contribution de fond. |
| LEAPS | 0,00 | Trop lointaine pour compter dans la clôture du jour. |

L'agrégat est normalisé de sorte que ±20 M$ de charm dealer regroupé par bucket sature le sous-score à ±1,0.

### Composante 2 : pin gravity

Le terme pin dépend du régime de gamma modélisé :

```
if net_gex >= 0:   # zero or positive gamma: pull toward the magnet
    pin_target   = max_pain  OR  max_gamma_strike
    distance_pct = (pin_target − close) / close
    pin_score    = clip(distance_pct / 0.003, [-1, +1])
else:              # negative gamma: follow the move already underway
    trailing_ret = (latest_close − earliest_close) / earliest_close
    pin_score    = clip(trailing_ret / 0.003, [-1, +1])
```

Une cible de pin 0,3 % au-dessus du spot dans un régime modélisé de gamma positif donne un score de pin de +1,0 - l'aimant est au-dessus et la gravité agit. Dans un régime modélisé de gamma négatif, la distance à la cible ne porte aucune information directionnelle : le terme l'ignore donc et lit plutôt le rendement récent - une hausse de 0,3 % sur les dernières clôtures donne aussi +1,0, et une baisse de 0,3 % donne -1,0. Si le Net GEX manque, ou s'il y a moins de deux clôtures exploitables, le terme pin vaut 0.

**Limite méthodologique :** les deux branches sont des heuristiques ZeroGEX aux seuils de saturation choisis à la main, pas des probabilités calibrées. La branche gamma négative traduit l'idée que le gamma négatif amplifie la direction déjà engagée ; elle ne prédit pas cette direction.

### Composante 3 : la rampe temporelle (le verrou)

La rampe est multiplicative. Avant **14h30 ET**, elle est exactement nulle - l'ensemble du signal est court-circuité.

| Heure (ET) | Rampe |
|---|---|
| Avant 14h30 | 0,00 |
| 14h30 | 0,00 |
| 14h45 | 0,20 |
| 15h00 | 0,40 |
| 15h30 | 0,80 |
| 15h45 - 16h00 | 1,00 |

C'est pourquoi EOD Pressure affiche zéro pendant la majeure partie de la journée de trading. Le signal est structurellement inactif en dehors de la fenêtre.

### Composante 4 : amplificateur calendaire

L'amplificateur augmente la conviction aux dates où le positionnement se concentre :

| Calendrier | Amp |
|---|---|
| Jour normal | 1,0× |
| OPEX mensuel (troisième vendredi) | 1,5× |
| Quad witching (troisième vendredi de mars/juin/sept/déc) | 2,0× |

C'est le seul point du signal où le score intermédiaire peut dépasser ±1 - le plafonnement final le ramène dans la plage.

---

## Comment le score est calculé

L'agrégation finale :

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

Le calcul se fait sur -1 à +1 ; la carte et la page du signal affichent le résultat multiplié par 100, donc un score de 0,55 ici apparaît comme 55 à l'écran.

La pondération 60/40 est un choix de conception fait à la main, et non ajusté sur des données : elle reflète l'idée que **le charm est la mesure modélisée la plus directe du flux de couverture**, tandis que **la pin gravity est l'attraction indirecte, dépendante du régime**. Les deux comptent dans le modèle. Le charm mène la danse.

---

## Interprétation du score

| Score | Lecture |
|---|---|
| +60 à +100 | Forte dérive haussière modélisée vers la clôture |
| +20 à +60 | Inclinaison positive du modèle |
| -20 à +20 | Composantes du modèle faibles ou qui se compensent |
| -20 à -60 | Inclinaison négative du modèle |
| -60 à -100 | Forte dérive baissière modélisée vers la clôture |

Le déclenchement à **±20** est un seuil du modèle choisi à la main, pas une probabilité calibrée ni un taux de réussite attendu. Une validation historique est nécessaire avant de le traiter comme un avantage de performance.

---

## Quand le signal se déclenche et quand il reste silencieux

L'état dominant est le **silence**. Pendant la majeure partie de la journée de trading, EOD Pressure est à zéro - et ce zéro est *informatif*, pas "neutre". Il signifie que la fenêtre active n'a pas encore commencé.

Le signal peut aussi afficher zéro à l'intérieur de la fenêtre lorsque :

- Aucun strike ne se situe dans la bande ATM mise à l'échelle de la volatilité, sur une chaîne d'options clairsemée ou peu cotée.
- `max_pain` et `max_gamma_strike` sont tous deux nuls.
- Le pin target se trouve exactement au niveau du spot.
- Les scores charm et pin s'annulent par hasard - rare, cela suppose des directions opposées et des amplitudes à peu près équivalentes.

Un 0 en dehors de la fenêtre est normal. Un 0 à l'intérieur de la fenêtre est informatif - *EOD Pressure n'a rien à ajouter aujourd'hui.*

---

## Ce qu'un trader en fait

Trois schémas d'utilisation :

### 1. Préparation avant la fenêtre

Avant 14h30 ET, EOD Pressure est nul par construction. Utilisez ce temps avant la fenêtre pour identifier ce que *sera* le setup structurel : où se situe le gamma maximal, où se situe le gamma flip, dans quel régime sommes-nous, où se trouve le spot par rapport au pin target ? Quand la fenêtre s'ouvrira, le signal ne vous surprendra pas - il confirmera ou contredira la lecture que vous avez déjà construite.

### 2. L'inflexion de 15h30

EOD Pressure franchit la rampe à 0,8× à 15h30 ET. Si les termes charm et pin ont été en accord pendant la première partie de la fenêtre de rampe (14h45-15h30), la conviction tend à se consolider vers 15h30. Considérez cette rampe comme un repère temporel du modèle, pas comme une consigne de prendre position à l'avance ni comme la preuve que des ordres de dealers sont programmés.

### 3. Le quad witching est un contexte structurel

L'amplificateur 2,0× lors des jours de quad witching est assez important pour faire passer un signal non amplifié de +40 à +80 amplifié. Considérez ces jours comme structurellement plus porteurs de conviction - et structurellement plus exposés au risque de whipsaw en début de journée, avant l'ouverture de la fenêtre.

---

## Lire EOD Pressure avec d'autres signaux

EOD Pressure est une **lecture directionnelle** - elle indique dans quel sens penche la pression sans prescrire en soi de suivre ou de faire un fade. La décision fade-versus-suivi vient du régime :

- **Régime à gamma positif modélisé + score EOD Pressure positif :** la dérive modélisée est haussière, la couverture des dealers est modélisée comme un amortisseur, la lecture favorise un positionnement *dans le sens* de la dérive vers le strike aimant - acheter la faiblesse plutôt que de la vendre - et ne réserve le fade qu'aux débordements au-delà de l'aimant.
- **Régime à gamma négatif modélisé + score EOD Pressure positif :** le score combine un biais porté par le charm et le mouvement récent (en gamma négatif, le terme pin suit la direction déjà engagée), et le réflexe des dealers est modélisé comme amplificateur plutôt qu'amortisseur - la poursuite du momentum est plus probable.

Combiné à d'autres signaux :

- **EOD Pressure + Trap Detection dans la même direction :** le setup à forte conviction le plus courant. La dérive EOD confirme un fade sur un breakout raté.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) dans la même direction :** compression vers la clôture avec une dérive portée par le charm qui la confirme. Setup de continuation solide.
- **EOD Pressure ≠ 0 à l'intérieur de la fenêtre sans autre signal actif :** la dérive structurelle est la seule lecture disponible. Taille réduite, à traiter comme une inclinaison directionnelle plutôt que comme un trade à forte conviction.

---

## Erreurs de lecture courantes

Trois pièges :

- **Considérer un zéro avant la fenêtre comme "pas de signal aujourd'hui".** La fenêtre ne s'est pas encore ouverte. Le signal est *structurellement inactif*, pas dépourvu d'information.
- **Ignorer le changement de régime dans la pin gravity.** L'attraction vers la cible en gamma positif est une heuristique du modèle. En gamma négatif, le terme pin cesse de regarder la cible et suit plutôt le mouvement récent - c'est aussi une heuristique maison, pas une certitude mécanique.
- **Trader le score brut sans tenir compte de la rampe.** Une lecture de +40 à 14h45 (rampe 0,20) correspond en réalité à un score effectif de +8. Lisez l'ampleur ajustée à la rampe, pas le score d'entrée brut.

---

## Comment ZeroGEX affiche le signal EOD Pressure

Le tableau de bord l'affiche à plusieurs endroits :

- **La carte EOD Pressure** affiche le score en direct, l'état du déclenchement et la répartition par composante (contributions charm vs. pin).
- **L'Event Timeline** sur la page du signal retrace le parcours récent du score, avec les changements de direction signalés.
- **Signal Breadth**, dans le panneau Signaux Propriétaires du tableau de bord, le compte comme l'un des votes directionnels. (Ce n'est pas un input du Composite MSI, qui repose sur ses six composantes propres.)

Un exemple chiffré. Le SPX est à 5 825 à 15h15 ET un vendredi d'OPEX mensuel, et ZeroGEX affiche :

- **EOD Pressure :** -55 (déclenché baissier)
- **Net GEX :** +1,2 Md$ (positif)
- **Gamma Flip :** le spot est à +15 (au-dessus du flip)
- **Max Pain :** 5 810 (en dessous du spot)
- **Charm au spot :** modérément négatif (des ventes se chargent)
- **Amp calendaire :** 1,5× (OPEX mensuel)

La lecture structurelle : régime à gamma positif modélisé avec un aimant lourd 15 points en dessous du spot, la couverture modélisée portée par le charm pointe vers le bas, et l'amplificateur OPEX renforce le score. Inclinaison pratique : selon la lecture du modèle, la dérive vers 5 810 est le chemin que le modèle privilégie jusqu'à la clôture. Le trade n'est pas EOD Pressure en lui-même - c'est un positionnement cohérent avec le sens de la dérive, avec une taille calibrée sur la lecture OPEX modélisée.

---

## À retenir

> EOD Pressure est conçu pour estimer de quel côté penche la couverture modélisée pendant la fenêtre de clôture. Il ne vous dit rien sur le reste de la journée. Ce silence est précisément le message.

La discipline consiste à l'utiliser comme lecture directionnelle pour les 90 dernières minutes, à la recouper avec le régime pour trancher entre suivi et fade, et à la valider face aux autres signaux Advanced à la recherche d'une confluence. En dehors de la fenêtre, il faut regarder ailleurs.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous souhaitez voir la lecture d'EOD Pressure du jour en temps réel pendant la fenêtre active, aux côtés de Trap Detection et du contexte de régime, ZeroGEX Pro affiche tout cela dans le Tableau de signaux avancé.
