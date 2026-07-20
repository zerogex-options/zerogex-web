# Pourquoi nous ne publions pas le DEX

*Le Delta Exposure — DEX, la somme du delta de chaque contrat multiplié par son open interest — a tout l'air du jumeau naturel du gamma exposure. Nous refusons de le publier. Il mesure le seul greek que les dealers ont déjà couvert jusqu'à le ramener à zéro, il concentre tout son poids sur les strikes où les données sont les plus mauvaises, et il est le plus bruyant précisément là où le flux forcé est le plus faible. Voici l'argumentaire complet contre un chiffre que beaucoup d'outils seront ravis de vous vendre.*

---

## Le chiffre qui a l'air juste et se lit mal

Si le gamma exposure fonctionne, le delta exposure devrait fonctionner aussi. C'est l'intuition, et c'est pourquoi le « DEX » apparaît sur tableau de bord après tableau de bord, aux côtés du GEX comme son jumeau. On prend chaque option de la chaîne, on multiplie le delta de chaque contrat par son open interest, on additionne le tout, et on obtient un chiffre unique censé indiquer dans quel sens penche directionnellement le book des dealers. DEX positif, les dealers sont longs ; DEX négatif, les dealers sont courts. Net, symétrique, facile à vendre.

C'est aussi proche du dénué de sens, et nous avons pris tôt la décision de ne le montrer à personne. Non pas parce qu'il est difficile à calculer — il est trivial à calculer, ce qui fait d'ailleurs partie du problème — mais parce que ce chiffre est faux de trois façons indépendantes qui se cumulent. Chacune d'elles suffirait à le disqualifier. Ensemble, elles font du DEX non pas simplement un indicateur peu informatif, mais activement trompeur, car il attire le regard exactement sur la mauvaise partie de la chaîne.

C'est l'article que nous avons le plus voulu écrire dans cette série, car la discipline consistant à *ne pas* publier une métrique d'apparence plausible vaut plus que la plupart des métriques effectivement publiées.

---

## Premier grief : les dealers ont déjà couvert le delta jusqu'à zéro

Le gamma exposure est significatif en raison d'un fait précis : **on ne peut pas couvrir le gamma avec l'action.** L'action a un delta de 1 et un gamma exactement égal à zéro. Un dealer qui est court en gamma après avoir vendu des options n'a aucun moyen de le neutraliser avec le sous-jacent — il est obligé de le porter, et c'est ce gamma piégé qui le force à courir après le prix. Le GEX mesure une exposition réelle, non neutralisée. C'est pourquoi il fait bouger les marchés.

Le delta est l'exact opposé à tous égards. Le delta est *précisément* le greek que les dealers couvrent avec l'action, parce que l'action est un instrument à delta pur. C'est tout leur métier. Un dealer vend un call de delta 0,40, achète 40 actions en contrepartie, et le delta net de la position est nul. Faites cela sur l'ensemble du book et le delta *net* du dealer est, par construction, à peu près nul. Le delta-hedging, c'est la définition même du métier.

Alors que mesure réellement un agrégat Σ(Δ·OI) ? Il mesure le delta des *options seules*, en ignorant la montagne d'actions compensatoires que le dealer détient en face. C'est une jambe d'une position à deux jambes, présentée comme si elle constituait le tout. L'autre jambe — la couverture en actions qui l'annule — est invisible pour la formule. Le DEX est un chiffre grand et spectaculaire précisément parce qu'il omet la couverture dont l'unique but est de le rendre petit.

Le GEX mesure une exposition dont les dealers *ne peuvent pas* se débarrasser. Le DEX mesure la seule exposition dont ils se sont déjà débarrassés. Cette asymétrie n'est pas un détail. C'est tout l'enjeu, et c'est pourquoi les deux chiffres ne sont absolument pas jumeaux.

---

## Deuxième grief : le poids du delta se trouve là où les données sont les pires

Mettons de côté le problème de la couverture et admettons, pour les besoins de l'argument, que l'on veuille pondérer la chaîne par le delta. Regardons où cette pondération place sa masse.

Le delta va de 0 à 1. Il est proche de 0 pour les options très hors de la monnaie, franchit 0,5 près de la monnaie, et s'approche de 1 pour les options très dans la monnaie. Comparez cela au gamma, qui atteint un pic marqué à la monnaie et retombe vers zéro dans les deux ailes. Pondérer la chaîne par le delta plutôt que par le gamma fait une chose précise : cela entraîne le centre de masse de la métrique **vers le côté dans la monnaie** — et donne un poids réel à la **queue profondément dans la monnaie**, des strikes qu'une métrique pondérée par le gamma ignore à juste titre parce que leur gamma est nul.

Cette queue dans la monnaie est la pire partie de la chaîne sur laquelle appuyer une métrique :

- Elle est illiquide. Les options très ITM se négocient à peine.
- Leurs spreads sont larges, donc leurs cotations sont obsolètes et peu fiables.
- Leur open interest est souvent ancien, résidu de positions ouvertes il y a longtemps, roulées, ou oubliées — et l'open interest est précisément la donnée par laquelle le DEX multiplie.

Pendant ce temps, les trois greeks qui pilotent réellement le flux forcé — gamma, charm et vanna — atteignent tous leur pic **près de la monnaie**, où les options sont liquides, cotées de façon serrée, activement négociées, et où l'open interest reflète un positionnement vivant. Le GEX tire son signal de la partie la plus propre de la chaîne. Le DEX tire son signal de la plus sale. On aurait du mal à concevoir une métrique plus parfaitement calibrée pour capter le bruit.

---

## Troisième grief : le delta n'est pas là où se trouve le flux

C'est le problème le plus profond, et c'est celui qui relie toute la série. **Le flux forcé ne provient pas du niveau du delta. Il provient de la variation du delta.** Un dealer ne négocie pas d'actions parce que son book a du delta ; il négocie des actions parce que le delta de son book *a changé*. (C'est toute la thèse de [Pourquoi les market makers sont contraints de négocier des actions](/education/why-market-makers-trade-stock).)

Demandons-nous maintenant quels strikes génèrent ce changement. Le delta évolue le plus vite là où le gamma, le charm et la vanna sont les plus élevés — près de la monnaie, près de l'échéance. Il bouge à peine dans les ailes profondes. Un call deep-ITM avec un delta de 0,98 a un gamma proche de zéro, un charm proche de zéro, et une vanna proche de zéro. Son delta va rester à peu près à 0,98 quoi que fassent le spot, l'horloge ou la vol dans les heures qui suivent. Il génère essentiellement **aucun flux de couverture.**

Et pourtant, ce même contrat à delta 0,98, multiplié par son open interest, déverse presque tout son poids dans le DEX. La métrique attribue une importance maximale au strike qui produit un flux minimal. Appliquez cette logique à toute la chaîne et vous constaterez que le DEX est le plus bruyant précisément là où le flux forcé est le plus silencieux, et le plus silencieux — près de la monnaie, où le delta est un médiocre 0,5 — précisément là où le flux forcé est le plus bruyant. Le DEX n'est pas simplement décorrélé de ce qui intéresse les traders. Il est proche d'être *anti*-corrélé avec cela. Il pointe systématiquement à l'opposé des strikes qui font bouger le marché.

Trois griefs. Une métrique qui mesure une exposition déjà couverte et plate, la pondère vers les données les plus sales de la chaîne, et concentre son signal précisément là où aucun flux n'est généré. Il n'existe aucune version de ce chiffre qui mérite d'être affichée à l'écran.

---

## Ce que nous publions à la place

La solution n'est pas une meilleure pondération du delta. C'est d'arrêter de mesurer le *niveau* de quoi que ce soit et de commencer à mesurer la *transaction forcée*.

Notre moteur [Forced Flow](/forced-flow) ne fait pas la somme de Δ·OI. Il définit un scénario — le spot bouge de tant, tant de temps s'écoule, la vol implicite se déplace de tant — et **repricer l'ensemble du book** dans ce nouvel état. Il lit le delta du dealer après le scénario, soustrait le delta actuel du dealer, et multiplie la différence par le spot. Le résultat est un montant en dollars : l'action que les dealers sont mécaniquement contraints d'acheter ou de vendre pour rester couverts à mesure que le monde change.

Ce chiffre est tout ce que le DEX n'est pas :

- C'est un **flux**, pas un niveau — il mesure la transaction forcée, c'est-à-dire ce qui frappe réellement le marché.
- Il est piloté par le **gamma, le charm et la vanna**, qui vivent près de la monnaie, dans la partie propre, liquide et vivante de la chaîne.
- Il est dominé par les strikes qui **génèrent** de la couverture, pas par les contrats deep-ITM inertes qui n'en génèrent aucune.
- Il provient d'un **reprix complet**, de sorte que les termes croisés entre spot, temps et vol sont traités correctement plutôt qu'approximés jusqu'à disparaître.

Nous découpons ensuite ce total en bandes d'attribution gamma, charm et vanna, afin que vous puissiez voir non seulement combien les dealers doivent négocier, mais *pourquoi*. C'est un chiffre qui a du sens. Σ(Δ·OI) n'en a pas.

---

## La réserve honnête

Nous n'affirmons pas que le delta est factice ou que les dealers l'ignorent. Le delta est le greek le plus important de toute option individuelle — c'est le ratio de couverture, et le couvrir constitue tout le métier du dealer. Nous n'affirmons pas non plus que personne, nulle part, ne peut extraire quoi que ce soit des données de delta avec suffisamment de rigueur sur la liquidité et l'hygiène de l'OI.

L'affirmation est plus étroite et, selon nous, imparable : un **agrégat Σ(Δ·OI), publié comme chiffre vedette aux côtés du GEX, n'est pas un signal négociable**, et le présenter comme le jumeau symétrique du GEX suggère un parallèle qui n'existe pas. Le GEX mérite sa place parce que le gamma ne peut pas être couvert avec l'action, se concentre près de la monnaie, et pilote un flux réel. Le DEX échoue aux trois tests. Les placer côte à côte ne vous donne pas deux signaux. Cela vous donne un signal et un chiffre qui empoisonne silencieusement la lecture à côté de lui.

---

## Pourquoi l'omission est le message

Il serait facile d'ajouter une case DEX. Cela ne coûte rien à calculer, cela remplit de l'espace, cela correspond à ce que montrent les concurrents, et la plupart des utilisateurs ne sauraient jamais que c'est creux. C'est précisément pour cela que l'omettre compte. Un tableau de bord est un ensemble d'affirmations sur ce qui mérite votre attention. Chaque chiffre qui y figure dit « ceci vaut la peine d'être regardé. » Nous ne sommes pas prêts à faire cette affirmation à propos d'une métrique qui mesure une exposition déjà couverte et plate, dans les données les plus sales de la chaîne, précisément là où aucun flux ne naît.

Nous préférons publier un seul chiffre qui résiste à l'examen plutôt que deux chiffres dont le second n'est que décoratif. Le DEX est décoratif. Forced Flow est la transaction.

Pour comprendre la mécanique derrière l'alternative, commencez par [Pourquoi les market makers sont contraints de négocier des actions](/education/why-market-makers-trade-stock) et [Le delta et ses trois enfants](/education/delta-and-its-three-children), puis ouvrez la page en direct [Forced Flow](/forced-flow) et regardez la courbe de reprix faire ce que le DEX ne fait que semblant de faire.

Contenu à visée uniquement éducative — rien de ce qui précède ne constitue une recommandation de trading.
