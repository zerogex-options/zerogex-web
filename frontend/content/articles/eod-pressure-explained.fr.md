# Le signal EOD Pressure expliqué : lire la clôture

*L'analyse approfondie et pratique du signal ZeroGEX EOD Pressure — ce qu'il mesure, pourquoi la clôture connaît une dérive structurelle, comment le score combine charm et pin gravity, et comment le lire au cours des 90 dernières minutes.*

---

## Pourquoi ce signal existe

Les 90 dernières minutes de la séance au comptant sont structurellement différentes du reste de la journée. La décroissance du charm sur les positions 0DTE oblige les dealers à se couvrir en continu. La pin gravity autour des strikes à gamma élevé s'intensifie. Le book du dealer est plus contraint qu'à n'importe quel autre moment de la séance.

Ces forces ne sont pas aléatoires. Elles sont directionnelles et lisibles — *à condition* de savoir quoi chercher. Le signal EOD Pressure existe pour faire remonter cette dérive directionnelle en temps réel, afin que les traders puissent se positionner dans le sens du flux de clôture plutôt que de le combattre.

Cet article propose la lecture orientée trader du signal EOD Pressure. Il couvre ce qu'il mesure, pourquoi la clôture est différente, comment le score est construit à partir du charm et de la pin gravity, et comment le lire à l'intérieur de la fenêtre. Pour l'article méthodologique plus approfondi qui associe EOD Pressure et Trap Detection, voir [Trading the Close](/education/eod-pressure-and-trap-detection) ; pour la mécanique sous-jacente, [Vanna and Charm Explained](/education/vanna-and-charm-explained) détaille comment le charm entraîne la couverture forcée.

---

## Qu'est-ce que le signal EOD Pressure ?

Le signal EOD Pressure pose une seule question :

> Compte tenu du book actuel du dealer et de la proximité d'un strike aimant, dans quel sens la couverture forcée pousse-t-elle le prix vers la clôture ?

C'est un signal **Advanced** dans la stack ZeroGEX — il produit à la fois un score continu sur la droite numérique [-1, +1] et un déclenchement discret lorsque le score absolu franchit **0,20**. Le seuil est volontairement plus bas que pour les autres signaux Advanced, car le contexte structurel (la fenêtre de clôture) constitue lui-même un filtre — lorsque EOD Pressure affiche 0,15+ à l'intérieur de la fenêtre active, il est déjà informatif sur le plan directionnel.

Biais de trading : **lecture directionnelle**. Le signal indique dans quel sens penche la pression — il ne prescrit pas en soi de suivre ou de faire un fade. Cela dépend du contexte de régime.

---

## Pourquoi la clôture est différente

Trois mécanismes structurels se cumulent dans la dernière fenêtre de la séance :

1. **La décroissance du charm s'accélère.** À mesure que les options 0DTE approchent de l'expiration, leur delta dérive de façon prévisible vers 0 ou 1. Les dealers qui gèrent un book delta-neutre doivent se recouvrir en continu, et le rythme de cette recouverture *augmente* à l'approche de la clôture.
2. **La pin gravity s'intensifie.** Les strikes à gamma élevé attirent davantage le prix à mesure que le temps avant expiration diminue. Dans un régime long gamma, le magnétisme vers le strike lourd le plus proche se renforce au fil de l'après-midi.
3. **La liquidité s'amenuise.** Les flux en blocs, le rééquilibrage de fin de journée et les ordres structurels sur indices font passer le profil du flux de continu à saccadé. Les dealers disposent de moins de marge pour absorber les erreurs.

EOD Pressure combine les deux premiers éléments en une lecture directionnelle. Le troisième est implicite dans le calibrage du score.

---

## Les quatre composantes principales

Le signal agrège quatre composantes — trois contribuent à l'ampleur, une agit comme un verrou strict.

### Composante 1 : charm au spot

La mesure la plus directe du flux de couverture forcée. Le signal fait la somme de l'exposition au charm des dealers sur une bande at-the-money mise à l'échelle de la volatilité, pondérée par bucket d'expiration :

| Bucket | Poids | Pourquoi |
|---|---|---|
| 0DTE | 0,70 | Le charm frappe le plus fort le jour de l'expiration. Contribution dominante. |
| Weekly | 0,20 | Significative mais secondaire. |
| Monthly | 0,10 | Contribution de fond. |
| LEAPS | 0,00 | Trop lointaine pour compter dans la clôture du jour. |

L'agrégat est normalisé de sorte que ±20 M$ de charm dealer regroupé par bucket sature le sous-score à ±1,0.

### Composante 2 : pin gravity

Le terme pin encode l'attraction, dépendante du régime, exercée par le strike aimant :

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

Un pin target situé 0,3 % au-dessus du spot, dans un régime à gamma positif, donne un pin score de +1,0 — l'aimant est au-dessus et la gravité agit. Dans un régime à gamma négatif, ce même pin au-dessus du spot produit un pin score *négatif*, car la couverture des dealers amplifie désormais les mouvements *s'éloignant* du strike.

Ce renversement de signe est l'idée clé. La pin gravity n'est pas un niveau fixe. C'est une force dont le signe — et donc la direction — dépend du régime de gamma.

### Composante 3 : la rampe temporelle (le verrou)

La rampe est multiplicative. Avant **14h30 ET**, elle est exactement nulle — l'ensemble du signal est court-circuité.

| Heure (ET) | Rampe |
|---|---|
| Avant 14h30 | 0,00 |
| 14h30 | 0,00 |
| 14h45 | 0,20 |
| 15h00 | 0,40 |
| 15h30 | 0,80 |
| 15h45 – 16h00 | 1,00 |

C'est pourquoi EOD Pressure affiche zéro pendant la majeure partie de la journée de trading. Le signal est structurellement inactif en dehors de la fenêtre.

### Composante 4 : amplificateur calendaire

L'amplificateur augmente la conviction aux dates où le positionnement se concentre :

| Calendrier | Amp |
|---|---|
| Jour normal | 1,0× |
| OPEX mensuel (troisième vendredi) | 1,5× |
| Quad witching (troisième vendredi de mars/juin/sept/déc) | 2,0× |

C'est le seul point du signal où le score intermédiaire peut dépasser ±1 — le plafonnement final le ramène dans la plage.

---

## Comment le score est calculé

L'agrégation finale :

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

La pondération 60/40 traduit un parti pris assumé : **le charm est la mesure directe du flux de couverture forcée**, tandis que **la pin gravity est l'attraction indirecte, dépendante du régime**. Les deux comptent. Le charm mène la danse.

---

## Interprétation du score

| Score | Lecture |
|---|---|
| +0,6 à +1,0 | Forte dérive haussière attendue vers la clôture |
| +0,2 à +0,6 | Légère dérive haussière — le biais intraday favorise le maintien de positions longues, mais sans augmenter la taille de manière agressive |
| -0,2 à +0,2 | Pas d'edge — soit c'est encore trop tôt dans la fenêtre, soit les termes s'annulent |
| -0,2 à -0,6 | Légère dérive baissière |
| -0,6 à -1,0 | Forte dérive baissière attendue vers la clôture |

Le seuil de déclenchement est de **0,20** — plus bas que le 0,25 habituel — parce que la fenêtre elle-même fait office de filtre.

---

## Quand le signal se déclenche et quand il reste silencieux

L'état dominant est le **silence**. Pendant la majeure partie de la journée de trading, EOD Pressure est à zéro — et ce zéro est *informatif*, pas "neutre". Il signifie que la fenêtre active n'a pas encore commencé.

Le signal peut aussi afficher zéro à l'intérieur de la fenêtre lorsque :

- Aucun strike ne se situe dans la bande ATM mise à l'échelle de la volatilité, sur une chaîne d'options clairsemée ou peu cotée.
- `max_pain` et `max_gamma_strike` sont tous deux nuls.
- Le pin target se trouve exactement au niveau du spot.
- Les scores charm et pin s'annulent par hasard — rare, cela suppose des directions opposées et des amplitudes à peu près équivalentes.

Un 0 en dehors de la fenêtre est normal. Un 0 à l'intérieur de la fenêtre est informatif — *EOD Pressure n'a rien à ajouter aujourd'hui.*

---

## Ce qu'un trader en fait

Trois schémas d'utilisation :

### 1. Préparation avant la fenêtre

Avant 14h30 ET, EOD Pressure est nul par construction. Utilisez ce temps avant la fenêtre pour identifier ce que *sera* le setup structurel : où se situe le gamma maximal, où se situe le gamma flip, dans quel régime sommes-nous, où se trouve le spot par rapport au pin target ? Quand la fenêtre s'ouvrira, le signal ne vous surprendra pas — il confirmera ou contredira la lecture que vous avez déjà construite.

### 2. L'inflexion de 15h30

EOD Pressure franchit la rampe à 0,8× à 15h30 ET. Si les termes charm et pin ont été en accord pendant la première partie de la fenêtre de rampe (14h45–15h30), la conviction tend à se consolider vers 15h30. Prenez position avant, pas après.

### 3. Le quad witching est un contexte structurel

L'amplificateur 2,0× lors des jours de quad witching est assez important pour faire passer un signal non amplifié de +0,4 à +0,8 amplifié. Considérez ces jours comme structurellement plus porteurs de conviction — et structurellement plus exposés au risque de whipsaw en début de journée, avant l'ouverture de la fenêtre.

---

## Lire EOD Pressure avec d'autres signaux

EOD Pressure est une **lecture directionnelle** — elle indique dans quel sens penche la pression sans prescrire en soi de suivre ou de faire un fade. La décision fade-versus-suivi vient du régime :

- **Régime à gamma positif + score EOD Pressure positif :** la dérive est haussière, la couverture des dealers amortit — la lecture favorise le fade des rallyes vers le strike aimant pour capter la dérive vers le pin.
- **Régime à gamma négatif + score EOD Pressure positif :** le signal traduit un biais haussier porté par le charm, mais dans un régime à gamma court, le réflexe des dealers amplifie au lieu d'absorber — une poursuite du momentum est plus probable.

Combiné à d'autres signaux :

- **EOD Pressure + Trap Detection dans la même direction :** le setup à forte conviction le plus courant. La dérive EOD confirme un fade sur un breakout raté.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) dans la même direction :** compression vers la clôture avec une dérive portée par le charm qui la confirme. Setup de continuation solide.
- **EOD Pressure ≠ 0 à l'intérieur de la fenêtre sans autre signal actif :** la dérive structurelle est la seule lecture disponible. Taille réduite, à traiter comme une inclinaison directionnelle plutôt que comme un trade à forte conviction.

---

## Erreurs de lecture courantes

Trois pièges :

- **Considérer un zéro avant la fenêtre comme "pas de signal aujourd'hui".** La fenêtre ne s'est pas encore ouverte. Le signal est *structurellement inactif*, pas dépourvu d'information.
- **Ignorer le renversement de signe lié au régime dans la pin gravity.** Un strike lourd au-dessus du spot attire *vers le haut* dans un régime long gamma et *repousse vers le bas* dans un régime short gamma. Le même niveau sur le graphique signifie l'inverse d'un régime à l'autre.
- **Trader le score brut sans tenir compte de la rampe.** Une lecture de +0,4 à 14h45 (rampe 0,20) correspond en réalité à un score effectif de +0,08. Lisez l'ampleur ajustée à la rampe, pas le score d'entrée brut.

---

## Comment ZeroGEX affiche le signal EOD Pressure

Le tableau de bord l'affiche à plusieurs endroits :

- **La carte EOD Pressure** affiche le score en direct, l'état du déclenchement et la répartition par composante (contributions charm vs. pin).
- **Le Composite Signal Score** intègre EOD Pressure comme l'un de ses inputs.
- **Le Trade Stream** signale les trades du playbook filtrés par `eod_pressure` lorsqu'ils se déclenchent.

*[Emplacement d'image : carte ZeroGEX EOD Pressure avec score, composantes et statut de la rampe pendant la fenêtre active — déposer le fichier dans /public/blog/zerogex-eod-pressure-card.png]*

Un exemple chiffré. Le SPX est à 5 825 à 15h15 ET un vendredi d'OPEX mensuel, et ZeroGEX affiche :

- **EOD Pressure :** -0,55 (déclenché baissier)
- **Net GEX :** +1,2 Md$ (positif)
- **Gamma Flip :** le spot est à +15 (au-dessus du flip)
- **Max Pain :** 5 810 (en dessous du spot)
- **Charm au spot :** modérément négatif (des ventes se chargent)
- **Amp calendaire :** 1,5× (OPEX mensuel)

La lecture structurelle : régime à gamma positif avec un aimant lourd 15 points en dessous du spot, la couverture portée par le charm pointe vers le bas, et l'amplificateur OPEX renforce la conviction. Inclinaison pratique : la dérive vers 5 810 est le chemin le plus probable vers la clôture. Le trade n'est pas EOD Pressure en lui-même — c'est un positionnement cohérent avec le sens de la dérive, avec une taille calibrée sur la lecture OPEX à forte conviction.

---

## À retenir

> EOD Pressure vous indique dans quel sens pointe la couverture forcée pendant la fenêtre de clôture. Il ne vous dit rien sur le reste de la journée. Ce silence est précisément le message.

La discipline consiste à l'utiliser comme lecture directionnelle pour les 90 dernières minutes, à la recouper avec le régime pour trancher entre suivi et fade, et à la valider face aux autres signaux Advanced à la recherche d'une confluence. En dehors de la fenêtre, il faut regarder ailleurs.

Contenu éducatif uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous souhaitez voir la lecture d'EOD Pressure du jour en temps réel pendant la fenêtre active, aux côtés de Trap Detection et du contexte de régime, le tableau de bord gratuit de ZeroGEX affiche tout cela.
