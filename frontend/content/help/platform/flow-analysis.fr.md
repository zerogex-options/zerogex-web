# Analyse du flux

*Flux pondéré par la prime et en volume net, la répartition des agresseurs selon Lee-Ready, et comment repérer une vraie conviction dans le tape.*

---

## Ce que montre cette page

La page Flow Analysis est la **vue du tape** du marché des options. Là où Dealer Positioning montre le carnet statique, cette page montre le **flux** - ce qui s'est échangé aujourd'hui, et quel côté a franchi le spread pour l'échanger.

Deux menus de l'en-tête s'appliquent à toute la page : **Session** (la séance en cours ou la précédente, pour voir si aujourd'hui sort vraiment de l'ordinaire) et **Volume basis** (**Directional** ou **Total Traded** - voir ci-dessous).

## Les trois angles du flux

ZeroGEX présente le flux sous trois angles, car chacun compte différemment.

### Volume net de contrats

Compte simplement les contrats. Utile comme référence de bruit de fond. Peu utile à lui seul comme lecture de conviction - mille contrats à 0,05 $ et un contrat à 500 $ comptent pareil. La base **Total Traded** compte chaque contrat qui a changé de mains ; elle ne fait donc que monter.

### Flux pondéré par la prime

Multiplie le volume de contrats par la prime payée. **C'est la lecture de conviction.** Un trader qui paie 500 $/contrat pour un call OTM 0DTE prend un vrai pari ; un trader qui scalpe des tickets de loterie à 0,05 $ non.

### Flux directionnel (répartition des agresseurs Lee-Ready)

Classe chaque transaction comme initiée par l'acheteur ou par le vendeur à l'aide de l'algorithme Lee-Ready (de quel côté du bid/ask la transaction a eu lieu) ; les prints trop proches du milieu de fourchette pour être attribués restent sans signe. Fait la somme des transactions initiées par l'acheteur moins celles initiées par le vendeur. Indique si les agresseurs paient pour la hausse ou pour la baisse. La base **Directional** signe le volume de cette façon ; elle peut donc passer sous zéro.

## Le bandeau de régime

**Flow Analysis Regime** qualifie la séance jusqu'ici : **Risk-On Flow Regime** quand la prime nette et le flux net penchent tous deux vers les calls, **Risk-Off Flow Regime** quand ils penchent tous deux vers les puts, et **Mixed / Two-Way Flow** quand ils divergent ou sont tous deux faibles. Le paragraphe en dessous donne les chiffres derrière le libellé.

## Le Flow Snapshot

Les totaux de la séance au dernier barreau :

- **Call Volume** et **Put Volume** - les contrats échangés, avec la prime nette de chaque côté en dessous
- **Net Flow** - les contrats nets de calls moins les contrats nets de puts, chacun signé selon l'agresseur
- **Net Premium** - la prime nette des calls moins la prime nette des puts. Positif ⇒ les agresseurs paient net pour des calls / vendent des puts ; négatif ⇒ les agresseurs paient pour des puts / vendent des calls.
- **Put/Call Ratio** - le volume de puts divisé par le volume de calls

## Les graphiques

- **Options Flow** - la prime nette des calls et celle des puts au fil de la séance face au prix du sous-jacent, avec une aire de volume en dessous selon la base choisie. Filtrable par strike ou par échéance.
- **Net Directional Premium** - le total cumulé de la prime nette sur la séance, ombré au-dessus et en dessous de zéro.
- **Put/Call Ratio** - le ratio cumulé de la séance à chaque barreau de 5 minutes.
- **Net Position (Buys vs. Sells)** - le volume net cumulé des calls et des puts, pour distinguer les achats des ventes, ce que le ratio ne permet pas.

Chacun est tracé comme une série afin que vous puissiez voir la pente, pas seulement le niveau.

## Smart money

Les prints smart money ont leur propre page - voir [Smart Money](/help/platform/smart-money). Utilisez-la comme vérification croisée du flux principal de cette page.

## Comment le lire

Trois schémas :

1. **Flux positif pondéré par la prime fort avec un GEX Gradient positif alors que les dealers sont, selon le modèle, short gamma** ⇒ les traders paient pour une hausse sur laquelle les dealers sont short selon le modèle. Lecture de continuation à forte conviction.
2. **Achat de puts fort avec le signal Positioning Trap chargé du côté de la foule short (positif)** ⇒ la foule baissière est mal positionnée ; attendez-vous à un retour brutal à la hausse.
3. **Flux plat près d'un niveau clé** ⇒ attendez la cassure. Un flux sans conviction n'est pas un trade.

## Volume net vs flux directionnel

Pour une analyse plus approfondie de pourquoi le volume brut peut induire en erreur, pourquoi le flux directionnel apporte du signal, et pourquoi le flux pondéré par la prime est généralement la métrique de conviction la plus solide, voir [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow).

## Quand cette page est la plus utile

- **Juste après l'ouverture** - les 30 premières minutes en disent long sur le biais de la journée.
- **À tout niveau clé** - le flux vers un wall ou le VWAP montre qui fait pression sur le niveau. Dans notre étude portant sur 737 tests de walls, le flux signé au strike du wall ne permettait pas de prédire quels walls allaient céder ; lisez-le donc comme un contexte, pas comme un verdict.
- **Vers la clôture** - combinée à EOD Pressure, la lecture du flux affine l'indication directionnelle.

## Voir aussi

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow)
