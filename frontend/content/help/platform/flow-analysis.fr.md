# Analyse du flux

*Flux pondéré par la prime et en volume net, les buckets smart money, la répartition des agresseurs selon Lee-Ready, et comment repérer une vraie conviction dans le tape.*

---

## Ce que montre cette page

La page Flow Analysis est la **vue du tape** du marché des options. Là où Dealer Positioning montre le carnet statique, cette page montre le **flux** — ce que font les agresseurs en temps réel.

## Les trois angles du flux

ZeroGEX présente le flux sous trois angles, car chacun compte différemment.

### Volume net de contrats

Compte simplement les contrats. Utile comme référence de bruit de fond. Peu utile à lui seul comme lecture de conviction — mille contrats à 0,05 $ et un contrat à 500 $ comptent pareil.

### Flux pondéré par la prime

Multiplie le volume de contrats par la prime payée. **C'est la lecture de conviction.** Un trader qui paie 500 $/contrat pour un call OTM 0DTE prend un vrai pari ; un trader qui scalpe des tickets de loterie à 0,05 $ non.

### Flux directionnel (répartition des agresseurs Lee-Ready)

Classe chaque transaction comme initiée par l'acheteur ou par le vendeur à l'aide de l'algorithme Lee-Ready (de quel côté du bid/ask la transaction a eu lieu). Fait la somme des transactions initiées par l'acheteur moins celles initiées par le vendeur. Indique si les agresseurs paient pour la hausse ou pour la baisse.

## La tuile principale

Le haut de la page affiche le flux net pondéré par la prime sur la fenêtre glissante. Positif ⇒ les agresseurs paient net pour des calls / vendent des puts ; négatif ⇒ les agresseurs paient pour des puts / vendent des calls.

## Les panneaux de détail

Sous la tuile principale :

- Prime **achat call / vente call**
- Prime **achat put / vente put**
- **Delta net de l'agresseur** — la sortie de Lee-Ready pondérée par le delta du contrat

Chacun est tracé comme une série afin que vous puissiez voir la pente, pas seulement le niveau.

## Le badge smart money

Des étiquettes sur des transactions individuelles les signalent comme smart money — typiquement de gros blocs, des sweeps, des prints agressifs répétés dans la même direction. Le flux smart money est affiché comme une sous-série distincte. Utilisez-le comme vérification croisée de la tuile principale.

## Comment le lire

Trois schémas :

1. **Flux positif pondéré par la prime fort avec un gradient de GEX négatif** ⇒ les traders paient pour une hausse sur laquelle les dealers sont structurellement short. Lecture de continuation à forte conviction.
2. **Achat de puts fort avec le signal Positioning Trap également élevé** ⇒ la foule est mal positionnée ; attendez-vous à un retour brutal.
3. **Flux plat près d'un niveau clé** ⇒ attendez la cassure. Un flux sans conviction n'est pas un trade.

## Volume net vs flux directionnel

Pour une analyse plus approfondie de pourquoi le volume brut peut induire en erreur, pourquoi le flux directionnel apporte du signal, et pourquoi le flux pondéré par la prime est généralement la métrique de conviction la plus solide, voir [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow).

## Quand cette page est la plus utile

- **Juste après l'ouverture** — les 30 premières minutes en disent long sur le biais de la journée.
- **À tout niveau clé** — le flux vers un wall ou le VWAP indique si le niveau est défendu ou franchi.
- **Vers la clôture** — combinée à EOD Pressure, la lecture du flux affine l'indication directionnelle.

## Voir aussi

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow)
