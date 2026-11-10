# Charm : l'horloge est un trader

*Charm est la sensibilité du delta au temps, toutes choses égales par ailleurs. Il estime une pression de couverture potentielle et conditionnelle - et non un ordre programmé des dealers - lorsque le spot, l'IV et l'inventaire supposé restent proches de leurs valeurs actuelles.*

---

## La grecque qui trade sur un tape vide

La plupart des flux ont besoin qu'il se passe quelque chose. Gamma a besoin d'un mouvement de prix. Les news ont besoin d'actualité. Charm n'a besoin que de l'horloge. C'est la sensibilité du delta au passage du temps - ∂Δ/∂t, à spot et vol constants - et le temps passe, que le tape bouge ou non. Un dealer peut rester face à un marché qui n'a pas bougé d'un tick pendant quatre-vingt-dix minutes et constater malgré tout que le delta modélisé de son book se dégrade silencieusement, ce qui le pousse à vendre des actions tout du long pour garder sa couverture alignée.

C'est ce qui rend charm à la fois étrange et, une fois qu'on l'a compris, évident. L'horloge est un trader - un trader modélisé. Elle ne s'arrête jamais, elle ne change jamais d'avis, et, les autres paramètres restant fixes, elle pousse dans le même sens toute la séance. Les seules questions sont de savoir dans quelle direction elle pousse, quelle ampleur prend cette poussée, et si les mouvements réels du spot et de la vol au cours de la journée la laissent intacte.

Cet article est le complément mécanique de notre explication plus large [Vanna et charm expliqués](/education/vanna-and-charm-explained). Cet article-là présente charm comme l'un des ingrédients de la lecture de fin de journée ; celui-ci va sous le capot - d'où vient le drift, pourquoi il s'accélère, et comment on peut lui attribuer un montant en dollars et une échéance avant même qu'il ne se produise.

---

## D'où vient le drift

Le delta est étroitement lié - sans lui être exactement égal - à la probabilité risque-neutre qu'une option termine dans la monnaie. Un call avec un delta de 0,30 est en gros la manière dont le marché indique qu'il y a quelque chose comme 30 % de chances que cette option expire avec de la valeur. Cette probabilité implicite est une estimation vivante, et à l'approche de l'échéance, elle doit s'effondrer vers un verdict : soit l'option termine dans la monnaie (delta → 1), soit elle n'y termine pas (delta → 0), seul le cas limite à la monnaie restant indécis jusqu'à la cloche.

Charm, c'est la vitesse de cet effondrement. Observez une option légèrement hors de la monnaie tout au long d'un après-midi avec un spot figé :

- Ce matin, elle affichait un delta de 0,35 - une réelle chance de générer un gain.
- À midi, avec moins de temps sur l'horloge et un spot inchangé, delta 0,28.
- À 15h, delta 0,18.
- À l'approche de la cloche, le delta glisse vers 0.

Rien n'a bougé. Le delta de l'option a pourtant chuté de moitié, uniquement parce que le temps restant s'est raccourci. Chacune de ces étapes est un changement du ratio de couverture, et chaque changement oblige le dealer détenteur de cette option à ajuster sa position en actions. Cet ajustement, c'est le flux de charm.

Les options dans la monnaie font le mouvement inverse, se raffermissant de 0,80 vers 1,00 à mesure que leur issue devient une quasi-certitude. Le charm net du book est modélisé comme la somme sur tous les strikes, pondérée par le volume d'open interest qui s'y trouve et, selon la convention de positionnement, par le camp dans lequel le dealer est supposé se trouver - l'inventaire réel des dealers n'est pas directement observable à partir des données publiques sur les options.

---

## Pourquoi il s'accélère à l'approche de la clôture

Charm n'est pas constant tout au long de la journée. Le rythme de dégradation du delta est faible lorsqu'il reste beaucoup de temps et s'accroît à mesure que l'échéance approche - il est maximal dans la dernière heure et maximal entre tous dans les dernières minutes, pour les strikes proches de la monnaie dont le verdict reste en suspens. Sur une chaîne dominée par des échéances du jour même, ce qui est désormais la norme pour SPX, l'essentiel du flux de charm de la journée se comprime dans les soixante à quatre-vingt-dix dernières minutes.

C'est la raison mécanique pour laquelle le « drift vers la clôture » est un phénomène récurrent et non une superstition de graphique. Ce n'est pas que les traders deviennent émotifs à 15h. C'est que les mathématiques de la dégradation du delta y concentrent l'essentiel de leur force modélisée, et les dealers qui couvrent cette dégradation tendent à effectuer l'essentiel de leurs ajustements tard - même ceux qui travaillent avec des bandes de couverture plutôt que de trader en continu. Le flux modélisé s'intensifie parce que la grecque s'intensifie.

Le graphique en direct [Charm into Close](/forced-flow) illustre exactement cela : il maintient le spot et la vol fixes, fait avancer l'horloge jusqu'à la cloche, et trace les actions cumulées que, selon le modèle, le book des dealers négocie à chaque étape. La courbe part de zéro à l'instant présent et s'en éloigne à mesure que l'après-midi avance - la pente la plus forte se situant à la fin, parce que c'est là que vit charm.

---

## Une prévision assortie d'une échéance

Voici la propriété qui rend charm exceptionnellement utile, et c'est ce que vous ne trouverez pas dans une présentation standard des grecques.

Tout autre flux de dealers est conditionnel. Le flux de gamma dépend d'un mouvement du spot qui peut se produire ou non. Le flux de vanna dépend d'un basculement de volatilité que l'on ne peut pas programmer. La *composante* charm ne dépend que du temps, et le temps est la seule variable qui fera exactement ce qu'on attend d'elle. À 9h35 le matin, en maintenant le spot et la vol à leurs niveaux actuels, on peut estimer combien d'actions la *seule* dégradation temporelle amènerait les dealers à acheter ou vendre d'ici la clôture. On obtient une taille et une direction modélisées pour un flux important des heures avant qu'il ne se déroule - à condition que le reste du monde ne bouge pas, ce qui n'est jamais tout à fait le cas.

C'est une prévision assortie d'une échéance. La prévision est assortie d'une condition - « si le spot et la vol se maintiennent près d'ici » - et ils se maintiennent rarement à la perfection, si bien que la clôture réelle mêle charm au gamma et à la vanna, quels qu'ils soient, que produisent les mouvements de la journée. Mais la composante charm est estimable à l'avance comme presque rien d'autre sur les marchés. C'est ce qui se rapproche le plus d'un flux prévisible, dicté par le calendrier, que le marché puisse offrir - une pression modélisée fixée par l'horloge, et non un ordre programmé que quiconque serait tenu d'exécuter.

C'est essentiellement le chiffre que le [bulletin Charm-into-Close](/forced-flow) affiche avant l'ouverture : *selon le modèle, la seule dégradation temporelle amène les dealers à acheter/vendre \$X d'ici la clôture si le sous-jacent se maintient ici.* Une échéance, une direction et un montant en dollars, le tout estimable dès l'aube.

---

## Mettre un chiffre dessus

Supposons que l'on soit un vendredi avec un positionnement 0DTE massif sur SPY, spot à 560. Le book des dealers contient les options du jour même, et à mesure que l'horloge tourne vers la cloche, chacune d'elles doit se résoudre - terminer dans la monnaie ou expirer sans valeur - de sorte que les deltas couverts par les dealers oscillent fortement. En réévaluant l'ensemble du book à la clôture avec un spot maintenu à 560, le flux total modélisé induit par le temps lors d'une journée fortement 0DTE peut atteindre l'ordre du **milliard de dollars**. C'est le chiffre que trace le graphique en direct Charm-into-Close, et c'est ce que signifie en pratique « ce que les dealers sont censés trader d'ici la clôture, selon le modèle ».

Deux réserves honnêtes concernant ce chiffre phare. D'abord, l'essentiel provient des options du jour même qui *se résolvent* à la cloche - un effet de pin qui dépend exactement de l'endroit où le spot se stabilise, et non d'une dégradation régulière - d'où un chiffre à la fois important et sensible au spot. Ensuite, le drift de charm pur, la part qui relève véritablement de la dégradation temporelle du book survivant plutôt que de l'événement d'expiration, n'en représente qu'une fraction : de l'ordre de quelques centaines de millions, qui s'accumulent régulièrement tout au long de l'après-midi. Le tableau de bord affiche les deux - le flux complet de clôture et le drift de charm seul - car ils répondent à des questions différentes, et le chiffre plus modeste du charm seul constitue la lecture la plus propre et la moins sensible au spot.

Inversez la composition du book, et la même horloge pointe plutôt vers des achats. Charm n'a pas de direction inhérente comme la gravité a le « bas » ; la direction est déterminée par les strikes sur lesquels les dealers sont modélisés short et long. Ce qui tend à tenir, c'est le *timing* : quel que soit le signe, le flux modélisé se concentre à l'approche de la clôture, et cette concentration est estimable dès 9h35 ce matin-là.

---

## Comment l'exploiter concrètement

Une discipline succincte :

- **Lisez le signe à l'ouverture.** Le chiffre de charm-into-close indique dans quel sens l'horloge pousse aujourd'hui et à peu près avec quelle intensité. C'est un contexte de régime, pas un signal d'entrée.
- **Cherchez la confluence.** Lorsque charm pointe dans la même direction que l'aimant de gamma - le strike lourd vers lequel dérive le prix - les deux forces se cumulent et le drift vers la clôture est à son plus net. Lorsqu'elles divergent, attendez-vous à du chop, pas à du drift.
- **Respectez la condition « si le spot se maintient ».** Charm est une prévision conditionnelle. Un mouvement de 1 % en milieu d'après-midi passe le volant à gamma et peut totalement submerger la lecture de charm. L'estimation fondée sur le seul temps est plus facile à isoler lors des journées calmes, mais ZeroGEX n'a pas présenté cette observation comme un résultat de performance calibré.
- **Relativisez-la quand la volatilité s'accroît.** Lors d'une journée réellement volatile, les réactions de gamma dominent et le drift bien ordonné de charm devient du bruit.

Charm maintient par définition le spot et l'IV constants. Les portefeuilles réels contiennent des compensations entre strikes et échéances ; les dealers peuvent utiliser des bandes de couverture, des futures ou d'autres options, et de nouvelles transactions peuvent modifier l'inventaire. L'estimation représente donc une pression de couverture potentielle liée au seul temps, et non la preuve du moment où les dealers traderont ni des montants qu'ils traderont.

Pour le concept parent, voir [Delta et ses trois enfants](/education/delta-and-its-three-children) ; pour le frère piloté par la volatilité, voir [Vanna : comment la baisse de la volatilité implicite peut modifier la couverture des dealers](/education/vanna-when-fear-fades) ; et pour voir la courbe vers la clôture se construire en temps réel, ouvrez la page en direct [Forced Flow](/forced-flow).

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.
