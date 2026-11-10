# À quelle fréquence les gamma walls cèdent-ils vraiment ? Nous l'avons mesuré

*Tout le monde traite le call wall comme une résistance et le put wall comme un support. Presque personne ne publie de chiffre. Nous avons mesuré 737 tests de walls sur SPY, SPX, QQQ et NDX - et la réponse s'est avérée dépendre de quelque chose que la plupart des traders ne vérifient jamais.*

---

## La question à laquelle personne ne répond par un chiffre

Un utilisateur de ZeroGEX nous a posé la question sans détour : il y avait un gros call wall, le prix l'a percé, et il voulait savoir comment évaluer la probabilité que cela se produise. Son instinct lui disait que les walls tiennent généralement. Le nôtre aussi. Ni lui ni nous n'avions de chiffre.

C'est une lacune étrange pour un niveau que les gens tradent tous les jours. Alors nous avons construit la mesure.

Cet article en est le résultat, y compris les parties qui n'ont pas fonctionné - qui se sont avérées être la majorité, et qui sont plus utiles que celles qui ont fonctionné.

---

## Comment nous l'avons mesuré

Les définitions comptent plus que les chiffres, car une définition bâclée produit un chiffre assuré qui ne veut rien dire.

**Un test**, c'est le prix qui arrive à moins de 5 points de base du wall en vigueur à cette minute-là. Pas le wall de ce matin - les walls migrent, et le niveau que vous tradez est celui publié à ce moment-là.

**Une cassure**, c'est le prix qui clôture au-delà du wall, avec une marge, pendant **dix minutes consécutives**. C'est ce seuil qui est important. Les faux breakouts percent couramment un niveau et tiennent dix ou quinze minutes avant de se dénouer. Une définition qui se déclenche au premier tick de l'autre côté compte chacun d'eux comme une cassure, et la probabilité qui en résulte ne veut rien dire.

**Un maintien**, c'est l'heure qui s'écoule sans cette confirmation.

Deux autres choix méritent d'être précisés. Les tests qui ont buté sur la cloche de clôture avant de pouvoir se résoudre sont comptés pour la durée pendant laquelle nous *avons pu* les observer, au lieu d'être écartés - les exclure biaiserait l'échantillon au détriment du tape de fin de séance, qui est précisément le moment où le gamma 0DTE est le plus lourd. Et un grind de quarante minutes au contact d'un wall compte comme une seule observation, pas quarante, car c'est une seule décision à laquelle un trader fait face.

L'échantillon : **737 tests de walls, quatre produits indiciels, dix semaines (de fin juin à début septembre 2026).**

---

## La réponse est une courbe, pas un chiffre

La première chose que les données ont faite, c'est refuser de nous donner un chiffre unique.

« Le wall cède-t-il ? » n'est pas une question bien posée sans horloge. Plus on observe longtemps, plus il y a d'occasions de cassure. Sur le SPX, les mêmes tests ont produit un taux de cassure de 17,5 % à un horizon de trente minutes et de 30,7 % à soixante. Tout pourcentage brut est en réalité une affirmation sur une fenêtre de temps que quelqu'un a choisie.

La forme honnête est donc P(cassure dans les *t* minutes suivant le test) :

| dans les | SPX | QQQ |
|---|---|---|
| 15 min | 7,6 % | 12,3 % |
| 30 min | 17,5 % | 30,0 % |
| 45 min | 26,8 % | 40,6 % |
| 60 min | **30,7 %** | **50,1 %** |

Lisez la ligne qui correspond à votre durée de détention. « Est-ce qu'il cède ? » et « est-ce qu'il cède avant que je doive être sorti ? » sont des questions différentes, et seule la seconde se prête au trading.

---

## C'est l'indice, pas l'instrument

Voici le résultat auquel nous ne nous attendions pas.

| produit | strikes | indice | P(cassure dans les 60 min) |
|---|---|---|---|
| SPY | 1 $ | S&P 500 | 31,1 % |
| SPX | 5 $ | S&P 500 | 30,7 % |
| QQQ | 1 $ | Nasdaq 100 | 50,1 % |
| NDX | 25 $ | Nasdaq 100 | 46,8 % |

**Les walls du S&P ont tenu environ deux fois sur trois dans l'heure. Ceux du Nasdaq étaient proches du pile ou face.**

Regardez maintenant les paires. SPY et SPX sont statistiquement indiscernables. QQQ et NDX sont indiscernables. Chaque comparaison S&P contre Nasdaq diffère, et pas à la marge.

Cela écarte l'explication que nous jugions la plus probable. Des grilles de strikes plus fines répartissent l'open interest sur davantage de strikes, de sorte que chaque « wall » représente une plus petite part du book - une raison purement mécanique pour laquelle les walls de QQQ pourraient être plus faibles. Si c'était le facteur déterminant, SPY (avec ses strikes à 1 $) se comporterait comme QQQ. Ce n'est pas le cas. Il se comporte comme le SPX.

**Les probabilités de cassure d'un wall sont une propriété de l'indice sous-jacent, et elles sont invariantes selon le marché d'options à travers lequel vous les observez.** Une chaîne d'ETF au pas de 1 $ et une chaîne d'indice au pas de 25 $ donnent la même réponse pour le même sous-jacent.

La version pratique : un call wall sur QQQ est une structure nettement plus faible qu'un call wall sur le SPX, et la différence est d'environ dix-sept points de pourcentage. Si vous gardez en tête un seul taux de maintien pour tous les produits, vous vous trompez sur au moins l'un d'eux.

Les call walls et les put walls, soit dit en passant, ont cédé au même rythme à chaque horizon et pour chaque produit. Quelle que soit l'asymétrie qui existe entre eux, elle ne tient pas à la fréquence à laquelle ils cèdent.

---

## Ce qui n'a *pas* permis de prédire une cassure

C'est la partie qui mérite votre attention, car c'est là que nous nous sommes trompés.

Nous avons testé dix-neuf candidats - ceux vers lesquels se tournerait n'importe quel trader qui suit le positionnement des dealers :

- la taille du wall en dollars, sa part du book et son percentile par rapport à son propre historique
- si le gamma du wall **se renforçait ou était consommé** pendant que le prix pesait dessus
- si le wall **migrait** devant le prix
- le net GEX, sa trajectoire, la distance au gamma flip, le côté du flip où se trouvait le prix
- le **flux d'ordres signé au strike du wall lui-même**, et l'éventuelle accélération de ce flux
- depuis combien de temps le wall était en place, combien de fois il avait déjà été testé, l'heure de la journée, la volatilité réalisée

Un véritable prédicteur devrait pointer dans le même sens pour chaque produit. Sur les quatre, **deux variables l'ont fait - et le hasard seul en produit 2,6.**

Au niveau du hasard, voire en dessous. Après trois approches statistiques différentes, rien n'a survécu.

Nous nous sommes aussi trompés sur un résultat nul, dans l'autre sens. Au début, en travaillant uniquement sur le SPX, nous avions affirmé que la taille du wall ne portait aucune information. Sur quatre produits, elle pointe de façon constante dans le sens intuitif - wall plus gros, moins de cassures - mais trop faiblement pour se distinguer du bruit. Le SPX s'est trouvé être le seul échantillon où l'effet disparaissait, et nous avions bâti une affirmation dessus. L'énoncé honnête est *un petit effet dans le sens attendu que ces données ne permettent pas de distinguer du bruit* - pas un résultat nul, et pas une découverte.

---

## Alors, comment utiliser un wall ?

**Comme un a priori, pas comme un déclencheur.**

L'information structurelle d'un gamma wall est réelle. Elle n'est simplement pas là où la plupart des gens la cherchent. Elle réside dans le taux de base de l'indice auquel appartient le wall - S&P 500 ou Nasdaq-100, quel que soit le produit par lequel vous l'observez - plutôt que dans le côté du flip où se trouve le prix, ou dans une quelconque propriété lisible du wall particulier que vous avez sous les yeux.

Cela recadre le trade. Si vous fadez un call wall sur le SPX, vous pariez sur un niveau qui a tenu environ deux fois sur trois dans l'heure dans cet échantillon. C'est un taux de base significatif, et c'est aussi une chance sur trois de vous faire écraser. Sur QQQ, le même pari est proche du pile ou face. Ce sont des paris différents, et ils méritent un dimensionnement différent.

Ce que cela n'autorise **pas**, c'est de traiter un wall comme un niveau qui va tenir. Rien dans dix semaines de données ne justifie de lire un wall précis et d'en conclure que celui-ci est différent.

---

## Ce que cela ne dit pas

Quatre limites honnêtes.

**Dix semaines, c'est dix semaines.** Un seul régime de volatilité, un seul été. Les taux de base peuvent évoluer, et nous continuerons à mesurer.

**C'est la probabilité de cassure *sachant que le prix a atteint le wall*.** C'est délibérément une question différente de celle de savoir si le prix y parvient tout court. Conditionner sur le test élimine le terme de distance - et la distance est le principal facteur qui détermine si un niveau est testé au départ. Il est tout à fait possible que l'essentiel de l'information prévisible se soit trouvé dans « sera-t-il atteint ? », et que ce qui reste après l'arrivée soit proche du hasard au sein d'un indice. Ce serait en soi une découverte.

**Le positionnement des dealers est modélisé, pas observé.** Les gamma walls proviennent de la convention standard d'open interest calls positifs / puts négatifs. Un jour où les clients étaient *acheteurs* nets des options du côté du wall, ce wall n'a jamais été une résistance au départ, et aucune surveillance ne vous l'aurait appris. C'est une limite de ce que les données publiques peuvent révéler, et c'est la raison la plus probable pour laquelle un wall cède « de façon inattendue ».

**« Aucune variable n'a prédit la cassure » ne veut pas dire « le GEX ne fonctionne pas ».** C'est une affirmation sur une question conditionnelle précise, mesurée d'une façon précise, sur une fenêtre précise.

---

## Comment lire cela sur ZeroGEX

Les niveaux eux-mêmes figurent sur les pages gratuites de niveaux gamma pour [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) et [NDX](/ndx-gamma-levels) - call wall, put wall, gamma flip et Net GEX côte à côte. Pour la lecture en direct pendant que les walls migrent au fil de la séance, c'est le [tableau de bord 0DTE en temps réel](/real-time-gex-0dte) qu'il faut suivre.

Associez le niveau au taux de base du produit que vous tradez, et à [comment lire un gamma flip](/education/how-to-read-a-gamma-flip) - le régime n'a pas changé ici la fréquence des cassures, mais c'est bien lui qui détermine si la couverture modélisée s'oppose à un mouvement ou le renforce une fois qu'un wall cède. Le [pilier sur les gamma walls](/education/gamma-walls-explained) explique ce qu'est un wall et pourquoi il se comporte ainsi, et [pourquoi les breakouts échouent](/education/why-do-breakouts-fail) aborde le mécanisme sous l'angle opposé.

---

## À retenir

> Un gamma wall est un taux de base, pas une prédiction. Les walls du S&P ont tenu à peu près deux fois sur trois dans l'heure suivant leur test ; ceux du Nasdaq étaient plus proches du pile ou face - et peu importait que vous observiez l'ETF ou l'indice. Sur dix-neuf éléments que nous avons mesurés à propos des walls individuels, aucun ne nous a dit lesquels allaient céder. Tradez le wall comme un a priori au taux de réussite connu, dimensionné pour le produit sur lequel vous êtes, et accueillez avec méfiance toute affirmation selon laquelle *ce* wall-ci serait différent.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading, et aucun chiffre présenté ici n'est calibré comme un signal de trading.
