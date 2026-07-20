# Charm : l'horloge est un trader

*Charm est la vitesse à laquelle le delta d'une option évolue au fil du temps qui passe. Il oblige les dealers à négocier des actions même quand le marché est parfaitement plat — et parce que l'horloge est la seule variable que l'on puisse prévoir avec une précision parfaite, charm est ce flux de dealers rare que l'on peut anticiper des heures avant qu'il ne se matérialise. Une prévision assortie d'une échéance.*

---

## Le grec qui s'exprime sur un tape vide

La plupart des flux ont besoin qu'il se passe quelque chose. Gamma a besoin d'un mouvement de prix. Les news ont besoin d'actualité. Charm n'a besoin de rien. C'est la sensibilité du delta au passage du temps — ∂Δ/∂t — et le temps passe, que le tape bouge ou non. Un dealer peut rester face à un marché qui n'a pas bougé d'un tick pendant quatre-vingt-dix minutes et se retrouver malgré tout contraint de vendre des actions tout du long, parce que les deltas de son book se dégradent silencieusement et que la couverture doit se réduire pour suivre le rythme.

C'est ce qui rend charm à la fois étrange et, une fois qu'on l'a compris, évident. L'horloge est un trader. Elle ne s'arrête jamais, elle ne change jamais d'avis, et elle exécute le même ordre à chaque séance. Les seules questions sont dans quelle direction elle pousse et avec quelle intensité.

Cet article est le complément mécanique de notre explication plus large [Vanna and Charm explainer](/education/vanna-and-charm-explained). Cet article-là présente charm comme l'un des ingrédients de la lecture de fin de journée ; celui-ci va sous le capot — d'où vient le drift, pourquoi il s'accélère, et comment on peut lui attribuer un montant en dollars et une échéance avant même qu'il ne se produise.

---

## D'où vient le drift

Le delta est, en gros, la probabilité risque-neutre qu'une option termine dans la monnaie. Un call avec un delta de 0,30 signifie que le marché estime à environ 30 % la probabilité que cette option expire avec de la valeur. Cette probabilité est une estimation vivante, et à l'approche de l'échéance, elle doit s'effondrer en un verdict : soit l'option termine dans la monnaie (delta → 1), soit elle ne l'est pas (delta → 0). Il n'y a pas de juste milieu à la cloche.

Charm, c'est la vitesse de cet effondrement. Observez une option légèrement hors de la monnaie tout au long d'un après-midi avec un spot figé :

- Ce matin, elle affichait un delta de 0,35 — une réelle chance de générer un gain.
- À midi, avec moins de temps sur l'horloge et un spot inchangé, delta 0,28.
- À 15h, delta 0,18.
- À l'approche de la cloche, le delta glisse vers 0.

Rien n'a bougé. Le delta de l'option a pourtant chuté de moitié, uniquement parce que le temps restant s'est raccourci. Chacune de ces étapes est un changement du ratio de couverture, et chaque changement oblige le dealer détenteur de cette option à ajuster sa position en actions. Cet ajustement, c'est le flux de charm.

Les options dans la monnaie font le mouvement inverse, se raffermissant de 0,80 vers 1,00 à mesure que leur issue devient une quasi-certitude. Le charm net du book est la somme sur tous les strikes, pondérée par le volume d'open interest qui s'y trouve et par le camp dans lequel se situe le dealer.

---

## Pourquoi il s'accélère à l'approche de la clôture

Charm n'est pas constant tout au long de la journée. Le rythme de dégradation du delta est faible lorsqu'il reste beaucoup de temps et s'accroît à mesure que l'échéance approche — il est maximal dans la dernière heure et maximal entre tous dans les dernières minutes, pour les strikes proches de la monnaie dont le verdict reste en suspens. Sur une chaîne dominée par des échéances du jour même, ce qui est désormais la norme pour SPX, l'essentiel du flux de charm de la journée se comprime dans les soixante à quatre-vingt-dix dernières minutes.

C'est la raison mécanique pour laquelle le « drift vers la clôture » est un phénomène réel et non une superstition de graphique. Ce n'est pas que les traders deviennent émotifs à 15h. C'est que les mathématiques de la dégradation du delta y concentrent l'essentiel de leur force, et les dealers qui couvrent cette dégradation n'ont pas le choix du moment où trader. Le flux s'intensifie parce que le grec s'intensifie.

Le graphique en direct [Charm into Close](/forced-flow) illustre exactement cela : il maintient le spot fixe, fait avancer l'horloge jusqu'à la cloche, et trace les actions cumulées que le book des dealers est contraint de négocier à chaque étape. La courbe part de zéro à l'instant présent et s'en éloigne à mesure que l'après-midi avance — la pente la plus forte se situant à la fin, là où charm vit le plus intensément.

---

## Une prévision assortie d'une échéance

Voici la propriété qui rend charm exceptionnellement utile, et c'est ce que vous ne trouverez pas dans une présentation standard des grecs.

Tout autre flux de dealers est conditionnel. Le flux de gamma dépend d'un mouvement du spot qui peut se produire ou non. Le flux de vanna dépend d'un basculement de volatilité que l'on ne peut pas programmer. Mais le flux de charm ne dépend que du temps, et le temps est la seule variable qui fera exactement ce qu'on attend d'elle. À 9h35 le matin, en maintenant le spot à son niveau actuel, on peut calculer combien d'actions la seule dégradation temporelle contraindra les dealers à acheter ou vendre d'ici 16h. On connaît la taille et la direction d'un flux important six heures et demie avant qu'il ne se conclue.

C'est une prévision assortie d'une échéance. Elle est assortie d'une condition — « si le spot se maintient près d'ici » — et le spot se maintient rarement à la perfection, si bien que la clôture réelle mélange charm avec le gamma que produit le mouvement de la journée. Mais la composante charm est connaissable à l'avance d'une manière dont presque rien d'autre sur les marchés ne bénéficie. C'est ce qui se rapproche le plus d'un ordre programmé que le marché puisse offrir, et il est programmé par le calendrier, non par la décision de qui que ce soit.

C'est précisément le chiffre que le [bulletin Charm-into-Close](/forced-flow) affiche avant l'ouverture : *la seule dégradation temporelle contraint les dealers à acheter/vendre \$X d'ici 16h heure de New York si le sous-jacent se maintient ici.* Une échéance, une direction et un montant en dollars, le tout calculable dès l'aube.

---

## Mettre un chiffre dessus

Supposons que l'on soit un vendredi avec un positionnement 0DTE massif sur SPY, spot à 560. Le book des dealers contient les options du jour même, et à mesure que l'horloge tourne vers la cloche, chacune d'elles doit se résoudre — terminer dans la monnaie ou expirer sans valeur — de sorte que les deltas couverts par les dealers oscillent fortement. En réévaluant l'ensemble du book à 16h avec un spot maintenu à 560, le flux forcé total induit par le temps lors d'une journée fortement 0DTE atteint l'ordre du **milliard de dollars**. C'est le chiffre que trace le graphique en direct Charm-into-Close, et c'est littéralement ce que signifie « les dealers doivent trader avant la clôture ».

Deux réserves honnêtes concernant ce chiffre phare. D'abord, l'essentiel provient des options du jour même qui *se résolvent* à la cloche — un effet de pin qui dépend exactement de l'endroit où le spot se stabilise, et non d'une dégradation régulière — d'où un chiffre à la fois important et très sensible au spot. Ensuite, le drift de charm pur, la part qui relève véritablement de la dégradation temporelle du book survivant plutôt que de l'événement d'expiration, n'en représente qu'une fraction : de l'ordre de quelques centaines de millions, qui s'accumulent régulièrement tout au long de l'après-midi. Le tableau de bord affiche les deux — le flux complet de clôture et le drift de charm seul — car ils répondent à des questions différentes, et le chiffre plus modeste du charm seul constitue la lecture la plus propre et la moins sensible au spot.

Inversez la composition du book, et la même horloge force des achats plutôt que des ventes. Charm n'a pas de direction inhérente comme la gravité a le « bas » ; la direction est déterminée par les strikes sur lesquels les dealers sont short ou long. Ce qui est invariant, c'est le *timing* : quel que soit le signe, le flux se concentre à l'approche de la clôture et on peut le voir venir — calculable dès 9h35 ce matin-là.

---

## Comment l'exploiter concrètement

Une discipline succincte :

- **Lisez le signe à l'ouverture.** Le chiffre de charm-into-close indique dans quel sens l'horloge pousse aujourd'hui et à peu près avec quelle intensité. C'est un contexte de régime, pas un signal d'entrée.
- **Cherchez la confluence.** Lorsque charm pointe dans la même direction que l'aimant de gamma — celui vers lequel dérive le strike price le plus lourd —, les deux forces se cumulent et le drift vers la clôture est à son plus net. Lorsqu'elles divergent, attendez-vous à du chop, pas à du drift.
- **Respectez la condition « si le spot se maintient ».** Charm est une prévision conditionnelle. Un mouvement de 1 % en milieu d'après-midi passe le volant à gamma et peut totalement submerger la lecture de charm. La prévision est la plus fiable lors des journées calmes, cantonnées à une fourchette — qui sont aussi les journées où elle compte le plus.
- **Relativisez-la quand la volatilité s'accroît.** Lors d'une journée réellement volatile, les réactions de gamma dominent et le drift bien ordonné de charm devient du bruit.

L'horloge est le trader le plus fiable du marché. Elle exécute le même ordre chaque jour, elle vous dit à l'avance ce qu'elle va faire, et elle ne manque jamais de se présenter à 16h. Charm, c'est la manière de lire son ticket.

Pour le concept parent, voir [Delta and Its Three Children](/education/delta-and-its-three-children) ; pour le frère piloté par la volatilité, voir [Vanna: When Fear Fades, Dealers Buy](/education/vanna-when-fear-fades) ; et pour voir la courbe vers la clôture se construire en temps réel, ouvrez la page en direct [Forced Flow](/forced-flow).

Contenu à visée uniquement pédagogique — rien de ce qui précède ne constitue une recommandation de trading.
