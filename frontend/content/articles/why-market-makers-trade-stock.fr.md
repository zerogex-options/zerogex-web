# Pourquoi les market makers sont contraints de trader l'action

*Les market makers ne tradent pas l'action parce qu'ils ont un avis sur le marché. Ils le font parce que le delta des options qu'ils détiennent continue de bouger tout seul — et à chaque fois qu'il bouge, ils sont mécaniquement contraints de trader le sous-jacent pour rester plats. Ce flux forcé est l'order flow le plus prévisible du marché.*

---

## Le métier du dealer, c'est de n'avoir aucun avis

Un market maker qui vous vend une call ne veut pas être short le marché. Il veut le spread — les quelques centimes entre le bid et l'ask — et il veut rentrer chez lui plat. Vendre la call l'a laissé short en delta, donc il achète de l'action en face jusqu'à ce que la position n'ait plus d'exposition directionnelle nette. C'est le delta-hedging, et c'est tout le modèle économique d'un dealer d'options : stocker l'option, neutraliser la direction, encaisser l'edge.

Le problème, c'est qu'être « plat » n'est pas un endroit où l'on arrive une bonne fois pour toutes. C'est un endroit où il faut sans cesse revenir, toute la journée, tous les jours, parce que le delta d'un book d'options refuse de rester immobile. Et voici la partie qui compte pour quiconque lit le flow : quand ce delta bouge, le dealer ne *choisit* pas de trader le sous-jacent. Il y est *contraint*. Le trade ne porte aucun avis, aucune conviction, aucune discrétion. Le delta a bougé, donc de l'action est achetée ou vendue. Point final.

Cette distinction — forcé contre discrétionnaire — explique pourquoi le hedging des dealers est lisible. Le flow discrétionnaire est une supposition sur ce qu'un trader va faire. Le flow forcé est un calcul de ce qu'un dealer *doit* faire. L'un relève du pile ou face. L'autre, de l'arithmétique.

---

## Le delta est une cible mobile, pas un chiffre fixe

Le delta est le ratio de couverture : combien d'actions compensent un contrat d'option. Une call avec un delta de 0,40 se comporte, à l'instant présent, comme 40 actions longues par contrat. Vendez 100 de ces contrats et vous êtes short de 4 000 deltas ; achetez 4 000 actions et vous êtes plat.

Mais 0,40 est une photographie, pas une constante. Cette même call aura un delta différent demain même si l'action ne bouge jamais, un delta différent si la volatilité implicite recule, et un delta très différent si l'action monte de 1%. Le dealer s'est couvert à 0,40. Dès que le delta dérive à 0,44, il se retrouve short de 400 deltas qu'il n'avait pas prévus, et il doit acheter 400 actions supplémentaires pour redevenir plat.

Le dealer ne couvre donc jamais vraiment le delta. Il couvre la *variation* du delta. La couverture initiale est gratuite — on la met en place une seule fois. Le flow, ce qui apparaît sur le tape, c'est ce flux incessant de re-hedges qui poursuivent le delta au fil de ses mouvements. Comprendre ce qui fait bouger le delta, c'est comprendre ce qui force le flow.

---

## L'action déjà détenue par le dealer ne vous dit rien

Voici un piège qu'il vaut mieux éviter dès le départ, car il plombe beaucoup d'analyses naïves du positionnement des dealers.

On pourrait penser que la bonne façon de mesurer la pression des dealers consiste à additionner tout le delta du book — le delta de chaque contrat multiplié par son open interest — et à appeler ça « l'exposition du dealer ». Ça semble juste. C'est le cousin naturel de la gamma exposure. C'est aussi quasiment inutile, et la raison en est la couverture en actions.

Les actions qu'un dealer détient en face de ses options ont chacune un delta exactement égal à 1,00. Ce delta d'actions est mis en place *spécifiquement pour annuler* le delta de l'option. Par construction, le delta net d'un dealer correctement couvert est approximativement nul — le delta de l'option et le delta de l'action s'additionnent pour donner zéro. C'est tout l'intérêt de la couverture. Donc un chiffre qui mesure le *niveau* du delta dans le book mesure précisément le greek que les dealers ont déjà ramené à zéro. Il vous renseigne sur une position qui, par construction, n'a plus aucune exposition directionnelle nette.

Ce qui n'est pas nul — ce qui ne peut jamais être pré-couvert — c'est l'ampleur avec laquelle ce delta est sur le point de *bouger*. L'action a un delta de 1 et il ne change jamais. On ne peut pas utiliser un instrument à delta constant pour pré-neutraliser un delta qui se déplace avec le spot, le temps et la vol. Ce résidu, cette dérive du delta du book qu'on ne peut pas pré-couvrir, est l'unique source du flow forcé. (Nous avons écrit un article entier sur les raisons pour lesquelles le chiffre du niveau de delta est un piège et pourquoi nous refusons de le publier — voir [Pourquoi nous ne publions pas le DEX](/education/why-we-dont-publish-dex).)

---

## Trois choses font bouger le delta, et le dealer n'en contrôle aucune

Entre maintenant et l'échéance, exactement trois variables d'état font bouger le delta d'un book d'options, et un dealer ne peut en influencer aucune :

- **Le prix spot.** Quand l'action bouge, le delta de chaque option bouge avec elle. La sensibilité du delta au spot, c'est le **gamma**. C'est le flow réactif — il ne se déclenche que lorsque le prix bouge réellement, et il est important et immédiat.
- **Le temps.** À mesure que l'échéance approche, le delta dérive même lorsque le spot est figé : les options out-of-the-money glissent vers un delta de 0, les options in-the-money grimpent vers un delta de 1. La sensibilité du delta au temps, c'est le **charm**. Il tourne en continu, que quelque chose se passe ou non.
- **La volatilité implicite.** Quand la peur intégrée par le marché monte ou descend, le delta se déplace alors même que le spot reste parfaitement immobile. La sensibilité du delta à la vol, c'est le **vanna**. Une réinitialisation de la vol peut faire fortement bouger le delta du book sans le moindre tick sur le prix.

Le prix, l'horloge et la peur. Ce sont les trois leviers, et le dealer y est attaché tous les trois. Chacun d'eux, quand il bouge, tire le delta du book hors de sa couverture et force un trade sur l'action pour le remettre en place. C'est pourquoi nous appelons la sortie combinée le **forced flow** : c'est le montant en dollars d'actions qu'un dealer est mécaniquement contraint d'acheter ou de vendre à mesure que le spot, le temps et la vol évoluent.

---

## Ce que cela représente en dollars

L'abstraction devient concrète dès l'instant où on lui attribue une taille.

Disons que le book des dealers sur SPY est positionné de telle sorte qu'un mouvement de 1% du sous-jacent modifie le delta agrégé des dealers d'environ 1 million d'actions. La couverture forcée correspond à cette variation d'actions multipliée par le prix de l'action : avec SPY à $560, cela donne 1 000 000 × $560 ≈ **560 millions de dollars** d'actions qui doivent changer de mains rien que pour maintenir le book couvert — avant même qu'un seul trader discrétionnaire ne se soit forgé une opinion. Dans un régime de gamma courte, le dealer achète dans la force et vend dans la faiblesse, et ces 560 millions de dollars poussent *dans le sens* du mouvement, élargissant l'amplitude. Dans un régime de gamma longue, il s'oppose au mouvement et le comprime. Même mécanique de forced flow, signe opposé, tape complètement différent.

Le charm et le vanna portent leurs propres étiquettes en dollars. La seule décroissance temporelle peut forcer des dizaines de millions d'actions d'ici la clôture, lors d'une lourde journée de 0DTE. Une baisse de deux points de la vol implicite après une publication du CPI calme peut forcer un volume d'achats similaire, étalé sur l'après-midi. Rien de tout cela n'est l'opinion de qui que ce soit. Tout cela, c'est le book qui poursuit son propre delta pour redevenir plat.

---

## Pourquoi le forced flow est le flow qui mérite d'être lu

La majeure partie de l'order flow est un brouillard d'intentions concurrentes. Quelqu'un achète, quelqu'un vend, et vous devinez le motif. Le flow forcé des dealers est différent par nature : c'est le seul flux large et persistant du marché qui soit entièrement déterminé par le positionnement et les trois variables évoquées plus haut. Vous n'avez pas à deviner s'il va se produire. Si le spot bouge de 1%, la couverture de gamma se déclenche. Si l'horloge approche de 16h, le flow de charm arrive. Si la vol baisse de deux points, la couverture de vanna suit. Le flow est une conséquence, pas une décision.

C'est ce que le reste de cette série développe. [Le delta et ses trois enfants](/education/delta-and-its-three-children) décompose le gamma, le charm et le vanna comme les trois dérivées du delta. [Charm : l'horloge est un trader](/education/charm-the-clock-is-a-trader) montre comment la seule décroissance temporelle force un flow prévisible vers la clôture, calculable des heures à l'avance. [Vanna : quand la peur s'estompe, les dealers achètent](/education/vanna-when-fear-fades) explique la dynamique de la compression de vol. Et la page en direct [Forced Flow](/forced-flow) reprice l'ensemble du book sous n'importe quel scénario de spot/temps/vol, afin que vous puissiez voir le trade obligé avant même qu'il ne s'imprime.

Le dealer n'a aucun avis. C'est précisément pour cela que son flow vaut plus que la plupart des avis.

Contenu purement éducatif — rien de ce qui précède ne constitue une recommandation de trading.
