# Analyse du flux

*Ce qui s'est échangé aujourd'hui et qui a franchi le spread pour l'échanger : contrats achetés et vendus de chaque côté, prime nette et put/call, sur une même horloge.*

---

## Ce que montre cette page

La page Flow Analysis est la **vue du tape** du marché des options. Là où Dealer Positioning montre le carnet en place, cette page montre le **flux** : ce qui s'est échangé aujourd'hui, et quel côté a franchi le spread pour l'échanger.

Deux réglages de l'en-tête s'appliquent à toute la page : **Session** (la séance en cours ou l'une de la dernière semaine, pour voir si aujourd'hui sort vraiment de l'ordinaire) et **Contracts** (tous les contrats, ou les strikes et échéances que vous choisissez). La barre d'outils du graphique règle la taille des barres, **5 min** ou **1 min**.

## Acheté et vendu

Chaque print d'option est classé selon le côté qui a franchi le spread, suivant la convention de Lee-Ready :

- Au **ask** ou tout près, un acheteur a payé le prix : il compte comme **acheté**.
- Au **bid** ou tout près, un vendeur l'a frappé : il compte comme **vendu**.
- Les prints au **milieu** sont répartis entre les deux au prorata des prints au ask et au bid de ce contrat dans la même minute. Les prints sans aucun indice de côté, comme l'enchère d'ouverture de 09:30, comptent pour moitié de chaque côté.

Acheté plus vendu donne donc toujours tout ce qui s'est échangé. La lecture de l'agresseur est ce que le flux de données dit de plus proche de l'intention, mais elle ne distingue pas une ouverture d'une clôture : un put « vendu » au bid peut être un nouveau vendeur ou un acheteur qui prend ses bénéfices.

Les calls achetés et les puts vendus forment le **côté haussier** ; les puts achetés et les calls vendus, le **côté baissier**. Les couleurs suivent cette règle partout sur la page : le vert est le côté haussier, le rouge le côté baissier. C'est pourquoi le « bought » de la ligne des puts est rouge.

## La lecture de la séance

La ligne du haut lit la séance d'un coup d'œil :

- **Flow** - **Risk-on** quand la prime nette et le flux net penchent tous deux à la hausse, **Risk-off** quand ils penchent tous deux à la baisse, et **Two-way** quand ils divergent ou sont tous deux trop faibles pour trancher (flux net sous 1 % des contrats échangés et prime nette sous 5 % de la prime des calls et des puts).
- **Net premium** - prime nette des calls moins prime nette des puts, chacune comptée comme acheté moins vendu, avec la part des calls et celle des puts en dessous. Une part des puts négative signifie que les puts ont été vendus en net.
- **Net flow** - le côté haussier moins le côté baissier, en contrats, et la part du côté haussier dans tout ce qui s'est échangé.
- **Put/call** - volume des puts divisé par volume des calls.
- **Volume** - tous les contrats échangés, et combien depuis l'ouverture de la barre la plus récente.

## Bought vs. sold

Les totaux de la séance pour les calls et les puts, chacun scindé en **acheté** et **vendu**, avec la répartition en barre, le **net** (acheté moins vendu) et ce que la barre la plus récente a ajouté jusqu'ici. La ligne du dessous additionne les deux côtés : le côté haussier face au côté baissier, et l'avance de l'un sur l'autre, qui est le flux net de la séance.

Les chiffres se mettent à jour toutes les quelques secondes pendant la séance.

## Le graphique de la séance

Un seul graphique, en panneaux qui partagent l'horloge de la séance et un réticule, heures en ET :

- **Price** - le sous-jacent au fil de la séance. Sur une séance en cours, son point le plus récent suit la cotation en direct chaque seconde.
- **Strikes** - derrière la ligne de prix, un couloir par strike et un point par barre. Un point est le flux net à ce strike dans cette barre : calls achetés moins calls vendus, plus puts vendus moins puts achetés. Vert au-dessus de zéro, rouge en dessous ; un strike où les deux côtés s'annulent exactement n'a pas de point. Les points existent en trois tailles, et **Dot sizes**, à côté du libellé du panneau des prix, fixe où commence chacune. **Auto** mesure un point par rapport au flux du jour, ce qui convient à tout symbole sans réglage, mais un point peut rétrécir plus tard dans la journée quand un flux plus important arrive. Vos propres chiffres, en contrats nets, gardent le point de chaque minute une fois celle-ci terminée, et ce navigateur les retient pour chaque symbole. **All dots**, **Medium+** et **Large** fixent le plus petit point affiché. Survolez un point, ou touchez-le, pour voir les calls et les puts achetés et vendus à ce strike, chacun avec son net. Les couloirs suivent votre choix de contrats et apparaissent sur les deux tailles de barre.
- **Flip and walls** - le gamma flip et les walls des calls et des puts en lignes pointillées : les mêmes niveaux que le bandeau Key Levels et les graphiques gamma. Ils indiquent où se situent les niveaux maintenant, et n'apparaissent donc que sur la séance en cours. Le flux au strike d'un wall est un contexte, pas un verdict sur le wall : dans notre étude de 737 tests de walls, il n'a pas permis de prévoir quels walls cédaient.
- **Net premium** - la prime nette cumulée, ombrée en vert au-dessus de zéro et en rouge en dessous, avec les **parts des calls et des puts** en lignes fines.
- **Contracts** - ce qui s'est échangé dans chaque barre. Les barres vers le haut sont le côté haussier (calls achetés, avec les puts vendus empilés au-dessus en plus clair) ; les barres vers le bas, le côté baissier (puts achetés, avec les calls vendus).
- **Put/call** - le ratio cumulé, avec une ligne pointillée à 1.
- Les **repères numérotés** en haut correspondent au journal du flux.

Les boutons au-dessus du graphique activent ou masquent chaque panneau, et ce navigateur retient votre choix. Survolez le graphique, ou touchez-le sur mobile, pour voir tous les chiffres de cette barre. **Full screen** donne au graphique toute la fenêtre, avec des panneaux à sa mesure ; Échap ou **Exit** le remet en place.

Pour zoomer sur une partie de la séance, comme sur le Gamma Chart :

- **Ctrl + molette** (**Cmd + molette** sur Mac), ou un pincement sur trackpad, pour zoomer dans le temps. La molette seule fait défiler la page, pas le graphique.
- **Maj + molette**, ou la molette au-dessus de l'échelle de prix de gauche, pour zoomer sur le prix.
- Les boutons − et + de **Time** et de **Price**, en bas à gauche, font la même chose par paliers.
- **Faites glisser** un graphique zoomé latéralement pour vous déplacer dans le temps, ou vers le haut et le bas une fois le prix zoomé.

Une fois zoomé, l'échelle de chaque panneau s'ajuste à ce qui est à l'écran, de sorte que les couloirs des strikes s'écartent avec les barres. Sur une séance en cours, un graphique zoomé suit la barre la plus récente jusqu'à ce que vous le fassiez glisser en arrière. **Reset** revient à la séance entière. Sur téléphone, pincez ou utilisez les boutons **Time** pour zoomer, et faites glisser latéralement pour vous déplacer.

## Journal du flux

Le flux notable de la séance, le plus récent en premier :

- **Net flow turned bullish / bearish** - le flux net cumulé a changé de côté et le nouveau côté mène d'au moins 0,5 % des contrats échangés. Les petites oscillations autour de zéro ne sont pas listées.
- **Net premium turned bullish / bearish** - la même chose pour la prime nette, d'au moins 3 % de la prime des calls et des puts.
- **Put/call rose above 1 / fell below 1** - dès qu'il s'écarte de 1 d'au moins 0,05.
- **Volume burst** - une barre d'au moins 2,5 fois la médiane des barres de l'heure précédente, avec le côté qui l'a menée. Les six plus importantes de la séance sont listées.

Rien n'est signalé pendant les dix premières minutes, quand chaque total est assez petit pour basculer sur un seul print.

## Bar by bar

Les calls et les puts de chaque barre, achetés et vendus, et son flux net, le plus récent en premier. Les barres sans aucun échange sont omises. Pendant la séance, la ligne du haut est la barre encore en cours.

## Choisir les contrats

**Contracts** ouvre le choix des strikes et des échéances. Un choix restreint tout ce qui figure sur la page, si bien que chaque chiffre décrit les mêmes contrats. Le choix des échéances est partagé avec les graphiques gamma du même onglet du navigateur, et l'en-tête indique toujours quels contrats la page lit ; le **×** à côté revient à tous.

ES et NQ n'ont pas de chaîne d'options propre : leur flux est celui du SPX et du NDX, donc les strikes listés sont des strikes de l'indice, pas des prix du future.

## Comment le lire

Trois schémas :

1. **Un fort flux côté haussier et une prime nette en hausse alors que les dealers sont modélisés short gamma** ⇒ les traders paient pour une hausse sur laquelle les dealers sont modélisés short. Une lecture de continuation.
2. **Des puts achetés en force contre un niveau** avec le signal Positioning Trap chargé du côté de la foule short ⇒ la foule baissière est peut-être mal placée ; guettez un rebond.
3. **Un flux plat près d'un niveau clé** ⇒ attendez la cassure. Un flux sans conviction n'est pas un trade.

## Quand la page est la plus utile

- **Juste après l'ouverture** - la première demi-heure en dit long sur l'orientation de la journée.
- **À chaque niveau clé** - le flux vers un wall ou le VWAP montre qui appuie sur le niveau. Dans notre étude de 737 tests de walls, le flux signé au strike du wall n'a pas permis de prévoir quels walls cédaient : lisez-le comme un contexte, pas comme un verdict.
- **Vers la clôture** - avec EOD Pressure, la lecture du flux affine le signal directionnel.

## Volume net vs. flux directionnel

Pour la lecture complète sur les raisons pour lesquelles le volume brut peut tromper, pourquoi la répartition des agresseurs ajoute du signal et pourquoi la prime est en général la mesure de conviction la plus forte, voir [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow).

## Voir aussi

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow)
