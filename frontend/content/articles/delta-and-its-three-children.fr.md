# Delta et ses trois enfants

*Delta indique à un dealer combien d'actions détenir. Mais delta ne reste jamais immobile — et il ne peut se déplacer que de trois façons : avec le prix, avec le temps et avec la volatilité. Ces trois sensibilités sont gamma, charm et vanna. Chaque dollar de flux forcé du dealer est l'un des trois enfants de delta qui vient percevoir son dû.*

---

## On commence par le hedge ratio

Delta est le chiffre le plus important d'une option et, en même temps, le moins intéressant. C'est simplement le hedge ratio : le nombre d'actions qui se comportent, à cet instant précis, comme un contrat d'option. Un call avec un delta de 0,55 se déplace comme 55 actions ; un put avec un delta de −0,30 se déplace comme 30 actions vendues à découvert. Un dealer qui ne veut aucune exposition directionnelle détient l'action compensatoire, et le book reste plat.

Si delta était une constante, l'histoire s'arrêterait là. On couvrirait la position une fois pour toutes et on n'y toucherait plus jamais. Mais delta est une dérivée — le taux de variation de la valeur de l'option par rapport au spot — et les dérivées sont elles-mêmes des fonctions du monde. Le monde change, delta change. Le travail permanent du dealer, et toute la source de flux de dealer lisible, consiste à courir après delta pendant qu'il se déplace.

La question qui compte vraiment n'est donc pas « qu'est-ce que delta » mais « qu'est-ce qui fait bouger delta ». Il y a exactement trois réponses.

---

## Les trois façons dont delta peut bouger

Entre le moment où un dealer met en place une couverture et le moment où l'option expire, trois choses dans le monde peuvent changer, et chacune entraîne delta avec elle :

1. **Le prix de l'action change.** La sensibilité de delta au spot est le **gamma** (∂Δ/∂S).
2. **Le temps passe.** La sensibilité de delta au temps est le **charm** (∂Δ/∂t).
3. **La volatilité implicite change.** La sensibilité de delta à la vol est le **vanna** (∂Δ/∂σ).

Voilà toute la famille. Gamma, charm et vanna sont les trois dérivées premières de delta, une pour chaque variable susceptible de bouger sous un book couvert. Les traders les mémorisent comme des greeks distincts aux noms exotiques ; on les comprend mieux comme une seule idée — *comment delta se déplace* — répartie en trois selon *ce qui l'a fait bouger*.

C'est le modèle mental le plus clair pour le flux du dealer : un dealer ne couvre pas delta, il couvre la **variation** de delta. Et il n'existe précisément que trois canaux par lesquels cette variation peut arriver. Nommez le canal, et vous avez nommé le flux.

---

## Gamma : delta bouge parce que le prix a bougé

Le gamma, c'est celui que tout le monde connaît. Quand l'action monte, les deltas des calls augmentent et les deltas des puts remontent vers zéro ; quand elle baisse, ils chutent. Le gamma, c'est la vitesse à laquelle cela se produit. Un book à gamma élevé se recouvre énergiquement à chaque tick ; un book à gamma faible bouge à peine.

La caractéristique déterminante du flux de gamma est qu'il est **réactif**. Rien ne se passe tant que le prix ne bouge pas. Le spot reste immobile, le gamma reste silencieux. Puis le marché bouge de 0,5 % et le dealer doit échanger un bloc d'actions pour se replatir — achetant dans un rallye et vendant dans un repli s'il est short gamma, faisant l'inverse s'il est long gamma. C'est le flux à l'origine du gamma flip, du pinning et du squeeze, traité en profondeur dans le [pilier Gamma Exposure](/education/gamma-exposure-explained).

Le gamma est l'enfant le plus bruyant. C'est aussi le seul qui a besoin d'un mouvement du spot pour s'exprimer. Les deux autres sont plus dérangeants, car ils imposent des opérations alors même qu'il ne se passe absolument rien.

---

## Charm : delta bouge parce que le temps a passé

Le charm est la sensibilité de delta au passage du temps. Une option hors de la monnaie ne vaut quelque chose aujourd'hui que parce qu'il reste encore du temps pour que le spot l'atteigne ; à mesure que ce temps s'écoule, son delta s'effrite vers zéro. Le delta d'une option dans la monnaie, lui, se raffermit vers 1. Delta représente approximativement la probabilité d'expirer dans la monnaie, et à l'approche de l'échéance, cette probabilité doit se résoudre en un oui ou un non net. La dérive pendant cette résolution, *c'est* le charm.

Le côté déstabilisant : le charm impose une couverture même avec un spot parfaitement immobile. L'horloge est un trader. Un dealer peut observer le tape ne rien faire du tout pendant une heure et se retrouver quand même contraint de vendre des actions tout ce temps, parce que les deltas du book se dégradent silencieusement et que la couverture doit se réduire en conséquence. Sur une chaîne fortement 0DTE, ce flux se concentre violemment dans la dernière heure, lorsque le taux de dégradation atteint son maximum. [Charm : l'horloge est un trader](/education/charm-the-clock-is-a-trader) en propose le traitement complet.

---

## Vanna : delta bouge parce que la peur a bougé

Le vanna est la sensibilité de delta à la volatilité implicite. Augmenter la peur intégrée dans les prix du marché épaissit la distribution des issues possibles, tirant les deltas hors de la monnaie vers le centre ; la diminuer resserre la distribution, les repoussant vers leur valeur intrinsèque de 0 ou 1. Un changement de vol reprice donc le delta de chaque option sans que le spot ne bouge d'un centime.

Le vanna est l'enfant le plus discret et, dans le bon régime, le plus persistant. Après une frayeur qui ne se concrétise jamais — un événement où la vol implicite s'est envolée puis se dégonfle lentement pendant des jours une fois le risque passé — le delta du book du dealer glisse un peu plus bas chaque heure, et le rehedge devient une offre constante et mécanique. C'est le grind de compression de vol : des marchés qui montent sans nouvelles et sans volume. [Vanna : quand la peur s'estompe, les dealers achètent](/education/vanna-when-fear-fades) détaille le mécanisme.

---

## Pourquoi on ne peut pas simplement les additionner

Un raccourci tentant : calculer le flux de chaque greek séparément et les additionner. Flux de gamma plus flux de charm plus flux de vanna égale flux forcé total. C'est une bonne première approximation et une mauvaise réponse finale, car les trois enfants interagissent entre eux.

Le gamma lui-même change à mesure que le temps passe et que la vol évolue. Le charm que l'on a au spot d'aujourd'hui n'est pas le charm que l'on a après un mouvement de 2 %. Un scénario combinant un mouvement du spot, un après-midi de dégradation et une baisse de vol n'est pas la somme des trois effets calculés isolément — les termes croisés sont bien réels et, à l'approche de l'échéance, importants. Additionner les greeks revient à faire un développement de Taylor, et les développements de Taylor s'effondrent précisément là où se joue l'action : proche de la monnaie, proche de l'échéance, là où la surface se courbe le plus fortement.

La façon honnête de calculer le flux forcé consiste à **repricer entièrement le book** dans le nouveau scénario, à relever le delta du dealer dans ce nouvel état, puis à en prendre la différence avec le delta actuel. Les greeks deviennent alors utiles pour l'**attribution** — indiquer quelle part de l'opération imposée relevait du gamma, du charm ou du vanna —, mais le total provient du repricing, pas de la sommation. C'est exactement ce que fait la courbe de repricing en direct [Forced Flow](/forced-flow) : elle déplace le spot sur une grille, reprice chaque contrat et lit directement la couverture imposée. La répartition gamma/charm/vanna est représentée en dessous sous forme de bandes d'attribution, afin de voir à la fois le total et quel enfant en est le moteur.

---

## La version en une phrase

Delta est un hedge ratio qui refuse de rester immobile. Il bouge avec le prix (gamma), avec le temps (charm) et avec la volatilité (vanna) — et rien d'autre. Chaque opération forcée d'un dealer sur le marché correspond à l'une de ces trois sensibilités qui tire le book hors de sa couverture et exige une opération sur l'action pour le rééquilibrer.

Apprenez le parent et les trois enfants, et le flux du dealer cesse d'être un mystère pour devenir un problème de comptabilité. Pour les fondations de toute cette idée, voir [Pourquoi les market makers sont contraints d'échanger des actions](/education/why-market-makers-trade-stock).

Contenu à visée pédagogique uniquement — rien de ce qui précède ne constitue une recommandation d'investissement.
