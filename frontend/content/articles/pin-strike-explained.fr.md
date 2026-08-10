# Le Pin Strike expliqué : le pin de gamma 0DTE atteignable
> **Note méthodologique mise à jour — elle prévaut sur toute formulation incompatible plus bas.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. L’inversion du terme de pin d’EOD Pressure reste donc une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.


*Le Pin Strike est le strike 0DTE atteignable présentant la plus forte stabilisation modélisée par gamma dealer positif à l'approche de l'expiration. Ce que c'est, comment il est construit, pourquoi il n'est délibérément pas « le plus gros strike de gamma », et pourquoi il est autorisé à ne renvoyer aucun pin actif.*

---

## Le problème que le Pin Strike cherche à résoudre

Dans les dernières heures d'une séance 0DTE, une question domine le tape : *si le prix dérive, où veut-il se poser ?* Les traders puisent dans un assortiment de niveaux pour y répondre — le call wall, le put wall, le max pain, le plus gros strike de gamma — et chacun répond à une question légèrement différente, aucun exactement à celle qui est posée.

Le Pin Strike est une réponse conçue sur mesure à cette question précise. Il estime le strike proche présentant la plus forte combinaison de deux éléments :

1. **Un gamma dealer stabilisant *à ce strike*** — la couverture des dealers y pencherait-elle *contre* les mouvements (ramenant le prix), et
2. **L'atteignabilité** — le prix peut-il réalistement atteindre ce strike, et finir près de lui, avant la clôture 0DTE ?

Les deux moitiés comptent, et c'est la seconde qui rend le Pin Strike différent de tous les autres niveaux du tableau. Un strike peut porter une empreinte de gamma énorme et rester un piètre candidat au pin si le prix n'a aucune chance réaliste de l'atteindre à l'approche de la cloche. Le Pin Strike est construit pour rétrograder ces géants inatteignables et faire ressortir le nœud atteignable autour duquel le prix peut réellement s'organiser.

Si vous découvrez les mécanismes sous-jacents, le [pilier Gamma Exposure](/education/gamma-exposure-explained) couvre la façon dont le gamma dealer entraîne la couverture, [Comment lire un gamma flip](/education/how-to-read-a-gamma-flip) couvre la ligne de régime, et [Le Max Pain expliqué](/education/max-pain-explained) couvre l'idée d'aimant de règlement avec laquelle le Pin Strike est souvent confondu. Cet article suppose ce contexte acquis et s'appuie dessus.

---

## Qu'est-ce qu'un pin, mécaniquement ?

Un « pin » est un équilibre auto-renforçant créé par la couverture en delta des dealers dans un voisinage à **gamma positif**. Le mécanisme mérite d'être énoncé précisément, car le Pin Strike est une tentative directe de le mesurer.

Lorsque les dealers sont nets longs gamma autour d'un strike, leur couverture est *stabilisante* : à mesure que le prix monte vers le strike, ils doivent vendre le sous-jacent, et à mesure qu'il baisse vers lui, ils doivent acheter. Cette couverture s'oppose au mouvement des deux côtés — c'est une force de rappel qui ramène le prix vers le nœud et amortit la volatilité réalisée autour de lui. Plus ce gamma positif est lourd et concentré, plus la force de rappel est forte, et plus le prix tend à rester « coincé » près du strike à l'approche de l'expiration.

Le régime opposé compte tout autant. Lorsque les dealers sont nets *shorts* gamma autour d'un niveau, la couverture est *déstabilisante* — ils vendent dans la faiblesse et achètent dans la force, amplifiant les mouvements au lieu de les amortir. Un voisinage à gamma court ne peut pas pinner ; il fait l'inverse. La matière première d'un pin est donc spécifiquement un **gamma dealer net positif, concentré localement** — pas le gamma en général, ni le gamma situé ailleurs sur la chaîne.

Une mise en garde honnête d'emblée, la même que pour toute lecture du positionnement des dealers sur la plateforme : le signe du gamma dealer est une **convention modélisée**, non un fait directement observé. L'open interest public ne révèle pas si les dealers sont longs ou shorts sur un contrat donné. ZeroGEX utilise la convention standard de type SPX — dealers modélisés longs sur les calls que les clients vendent en overwriting (gamma positif) et shorts sur les puts que les clients achètent (gamma négatif) — et le Pin Strike réutilise cette convention exacte plutôt que d'en inventer une seconde. C'est un modèle de positionnement, et il est décrit tout du long comme ce que la couverture *tend* à faire, jamais comme une garantie.

---

## L'idée clé : valoriser le book *comme si le spot était au strike*

Voici le mouvement conceptuel qui fait fonctionner le Pin Strike, et celui que la plupart des outils de niveaux ignorent.

Le gamma n'est pas une propriété fixe d'un strike. Le gamma d'un contrat dépend de l'endroit où se trouve le spot *à l'instant présent* par rapport à ce strike — il culmine lorsque l'option est à la monnaie et décroît à mesure qu'elle entre dans la monnaie ou en sort. Ainsi, le gamma qu'un strike affiche *aujourd'hui, au prix actuel* vous indique dans quelle mesure ce strike contribue à la couverture **ici**. Il ne vous indique **pas** quelle force stabilisante existerait **là-bas**, si le prix voyageait effectivement jusqu'à ce strike.

Mais « là-bas, si le prix y voyageait » est exactement la question que pose un pin. Un pin est une hypothèse : *si le prix arrivait au strike K, le book le retiendrait-il ?*

Le Pin Strike répond donc directement à cette hypothèse. Pour chaque strike candidat `K`, il **simule l'intégralité du book d'options comme si le spot était situé à `K`** et revalorise le gamma de chaque contrat à ce spot hypothétique en utilisant le même gamma de Black-Scholes que le reste de la plateforme. Il signe et met ensuite à l'échelle ce gamma revalorisé en gamma dealer en dollars selon la convention canonique de la plateforme :

```
GEX_i(K) = dealer_sign_i × gamma_i_at_K × OI_i × 100 × K² × 0.01
```

Lisez cela attentivement : le spot dans la formule de gamma en dollars est `K` lui-même (de sorte que l'échelle `S²` devient `K²`), car nous valorisons le monde dans lequel le spot *est* `K`. `dealer_sign_i` vaut `+` pour les calls et `−` pour les puts (la convention modélisée ci-dessus), `OI_i` est l'open interest, `100` est le multiplicateur de contrat, et le `× 0.01` final ramène le tout sur la base standard du secteur, « dollars de couverture par mouvement de 1 % ». C'est la convention GEX identique à celle utilisée pour les walls et le gamma flip — le Pin Strike n'introduit pas une définition concurrente du gamma dealer ; il se contente d'évaluer la définition existante à un spot différent et hypothétique.

C'est là le nœud de la raison pour laquelle le Pin Strike est une métrique véritablement différente et non une lecture du plus grand GEX réemballée : il repose sur un gamma *contrefactuel* (ce que serait le book à K), et non sur le gamma *actuel* (ce qu'est le book maintenant).

---

## Gamma de rappel local : un pin est un voisinage, pas un total de chaîne

Un pin est une caractéristique *locale*. Il s'agit du gamma aggloméré juste autour d'un strike, pas du gamma agrégé de l'ensemble de la chaîne, et certainement pas du gamma situé à des centaines de points de distance. Ainsi, pour chaque `K` candidat, le Pin Strike pondère la contribution de chaque contrat selon la proximité du strike de ce contrat à `K`, à l'aide d'un noyau gaussien :

```
kernel(K, strike_i) = exp( −(strike_i − K)² / (2 × bandwidth²) )
```

Les contrats situés exactement à `K` comptent pleinement ; les contrats à quelques strikes d'écart comptent moins ; les contrats éloignés ne contribuent pratiquement rien. La somme du GEX dealer pondéré par le noyau donne le **gamma local** à `K` :

```
local_gex(K) = Σ  GEX_i(K) × kernel(K, strike_i)
```

Le `bandwidth` — la largeur de la zone « proche » — n'est pas codé en dur, car les grilles de strikes diffèrent selon les produits (SPY et QQQ cotent des strikes espacés d'un dollar près de la monnaie, SPX en imprime tous les cinq points, NDX plus grossièrement encore). Le Pin Strike dérive le bandwidth de l'**espacement médian des strikes cotés à proximité**, de sorte que le noyau s'adapte automatiquement au produit qu'il examine. C'est un paramètre configurable, pas un nombre magique.

Vient ensuite l'étape décisive. Seul un gamma local *positif* peut pinner :

```
restoring_gex(K) = max( local_gex(K), 0 )
```

Si le voisinage autour de `K` présente un gamma dealer net short — une poche déstabilisante, amplificatrice de mouvement — son score de rappel est nul. Ce n'est pas un pin faible ; ce n'est *pas un pin du tout*, et il est noté en conséquence. Ce simple `max(·, 0)` est ce qui encode la physique : les pins sont faits de gamma positif, point final.

---

## Atteignabilité : pourquoi le plus gros nœud ne gagne pas automatiquement

Le gamma de rappel local vous indique à quel point un pin serait *fort* si le prix y parvenait. Il ne dit rien sur la capacité du prix à *y parvenir*. La distance est la moitié manquante.

Prenons une séance où le spot est à 772 et où il existe un nœud à gamma positif colossal à 820. Ce nœud pourrait avoir dix fois le gamma de rappel d'un nœud modeste à 773 — mais avec quelques heures restantes dans la séance et la volatilité à son niveau actuel, 820 est essentiellement hors d'atteinte. Le traiter comme le pin serait absurde. Le prix ne va pas s'organiser autour d'un niveau qu'il ne peut pas atteindre avant la clôture.

Le Pin Strike multiplie donc le gamma de rappel de chaque candidat par un **poids d'atteignabilité** dérivé de la distance du strike, mesurée dans les unités propres au marché que sont les « mouvements attendus ». À l'aide du spot actuel, d'une volatilité implicite représentative et du temps *réel* restant jusqu'à l'expiration :

```
z(K)            = ln(K / spot) / (σ × √τ)
reachability(K) = exp( −½ × z² )
```

`z` est la distance logarithmique jusqu'au strike, exprimée en écarts-types de la distribution du prix terminal — le nombre de mouvements attendus qui l'en sépare. `reachability` est la densité gaussienne (non normalisée) à cette distance : elle vaut `1.0` pour un strike situé exactement au spot et décroît en douceur vers zéro à mesure que le strike s'éloigne au-delà de ce que la volatilité et le temps peuvent plausiblement faire parcourir au prix. Comme la distance est mesurée en unités `σ√τ`, la même formule fonctionne de manière identique sur SPY, QQQ, SPX et NDX, sans constantes en dollars propres à chaque symbole.

Deux entrées de cette formule méritent d'être soulignées, car c'est là que l'atteignabilité justifie son utilité :

- **`σ` est une volatilité implicite à la monnaie représentative**, tirée des options 0DTE proches de la monnaie elles-mêmes (la même base d'ATM-IV que la plateforme utilise ailleurs). Ce n'est pas une valeur par défaut fabriquée — s'il n'existe pas d'ATM IV exploitable, l'atteignabilité ne peut pas être considérée comme fiable et la métrique renonce à produire un pin plutôt que d'inventer un nombre.
- **`τ` est le temps *intraday réel* restant jusqu'au règlement 0DTE**, en années — des secondes jusqu'à la clôture, pas un paresseux `1/365`. Cela compte énormément pour le 0DTE : à 10h00, un strike à cinq points d'écart est très atteignable ; à 15h45, le même strike peut être à plusieurs mouvements attendus. L'atteignabilité s'effondre à mesure que le temps s'écoule, exactement comme le fait un véritable pin à l'approche de l'expiration.

---

## Assembler le tout : le score de pin

Chaque strike candidat reçoit un score unique — le produit des deux moitiés :

```
pin_score(K) = restoring_gex(K) × reachability(K)
```

Un strike ne l'emporte qu'en étant **à la fois** un nœud à fort gamma positif **et** réalistement atteignable. Un nœud énorme mais inatteignable obtient un score proche de zéro (l'atteignabilité le tue). Un strike parfaitement atteignable mais sans gamma local positif obtient un score exactement nul (le gamma de rappel le tue). Le Pin Strike est le strike coté au `pin_score` maximal.

Les candidats sont d'emblée restreints aux strikes situés à environ deux mouvements attendus du spot — les seuls strikes dotés d'une atteignabilité significative — de sorte que la simulation reste peu coûteuse et ne considère même jamais la queue lointaine. Et seuls des **strikes réellement cotés** sont renvoyés, de sorte que le Pin Strike est toujours un contrat réel et cotable.

Aux côtés du strike, le Pin Strike rapporte une **confiance** — le degré de domination du vainqueur sur les autres pins viables :

```
pin_confidence = max_pin_score / Σ (all positive pin_scores)
```

Une confiance proche de 1.0 signifie qu'un seul nœud domine outrageusement le paysage atteignable à gamma positif — un pin net et singulier. Une confiance faible signifie que plusieurs candidats comparables sont en concurrence, et que le prix est plus susceptible de ballotter entre eux que de se verrouiller sur un seul. Le score maximal brut est également conservé, car la concentration seule peut induire en erreur lorsque *chaque* score est minuscule — un pin « dominant » parmi des candidats négligeables reste négligeable.

---

## Pourquoi le Pin Strike n'est pas les autres niveaux

Le Pin Strike s'inscrit dans une famille de niveaux de positionnement des dealers, et toute sa valeur tient à sa distinction véritable par rapport à chacun d'eux. Les différences ne sont pas cosmétiques :

- **Call Wall / Put Wall** — les strikes au-dessus et en dessous du spot présentant le plus grand gamma call/put unilatéral *actuel*. Ils marquent les concentrations dominantes de résistance et de support au prix *d'aujourd'hui*. Le Pin Strike ne concerne pas la plus grande concentration unilatérale et n'est pas mesuré au prix d'aujourd'hui — il concerne la stabilisation locale *nette* évaluée à chaque strike candidat comme si le prix s'y trouvait. Voir [Les gamma walls expliqués](/education/gamma-walls-explained).

- **Gamma Flip** — le spot hypothétique auquel le gamma dealer *agrégé* change de signe ; la frontière entre les régimes stabilisant et déstabilisant pour l'ensemble du book. Le flip est une ligne de régime ; le Pin Strike est un aimant spécifique *à l'intérieur* d'un régime stabilisant. (De fait, si le spot se situe sous le flip, en territoire de gamma net short, le Pin Strike ne trouvera souvent rien à quoi se pinner — ce qui est la bonne réponse.) Voir [Comment lire un gamma flip](/education/how-to-read-a-gamma-flip).

- **Max Pain** — le strike de règlement qui minimise le paiement intrinsèque agrégé aux détenteurs d'options. Il n'utilise que l'open interest et les strikes — pas de grecques, pas de volatilité, pas de signe de dealer, et aucune notion d'atteignabilité ni de la *façon* dont les dealers se couvrent. C'est un niveau de comptabilité des paiements. Le Pin Strike est un niveau de mécanique de couverture. Ils divergent fréquemment, et lorsqu'ils concordent, c'est généralement parce qu'un gamma lourd et un open interest lourd coïncident par hasard. Voir [Le Max Pain expliqué](/education/max-pain-explained).

- **King Node / strike au plus grand GEX** — simplement le strike au plus grand gamma en dollars *actuel*. C'est celui pour lequel on confond le plus souvent le Pin Strike, et le poids d'atteignabilité est précisément ce qui les sépare. **Le Pin Strike ne sélectionne délibérément pas le strike au GEX le plus élevé.** Le King Node ignore si le prix peut l'atteindre et ignore si le nœud est net stabilisant ; le Pin Strike est conçu pour rétrograder un géant inatteignable ou à gamma court au profit d'un nœud atteignable à gamma positif. Lorsque les deux coïncident, c'est parce que le gamma dominant se trouve aussi être près du spot et stabilisant — une confirmation significative, pas une redondance.

La version en une ligne : **les walls sont une concentration, le flip est une frontière de régime, le max pain est un minimum de paiement, le King Node est une taille brute — et le Pin Strike est une stabilisation locale, atteignable et net positive, à l'approche de l'expiration.**

---

## Pourquoi uniquement le 0DTE, et pourquoi l'open interest

Deux choix de périmètre méritent d'être explicités.

**Le Pin Strike est une métrique 0DTE.** Il n'utilise que l'échéance du jour même la plus proche et n'y mêle ni les hebdomadaires, ni les mensuelles, ni le gamma à échéance plus longue. C'est délibéré : un pin est un phénomène *d'approche de la clôture*. Le gamma du jour même est ce qui se dénoue aujourd'hui, sa fenêtre d'atteignabilité se mesure en heures, et son profil de gamma en `1/√τ` s'aiguise de façon spectaculaire à l'approche de la cloche — ce qui est précisément le régime où le pinning est un comportement réel et observable. Le gamma à échéance plus longue est une toile de fond structurelle, pas un aimant intraday, et l'y mêler brouillerait l'effet même que la métrique cherche à isoler. Le Pin Strike est donc une lecture intraday, à l'approche de l'expiration — pas un niveau d'options structurel au sens large.

**Le Pin Strike utilise la même base d'open interest que le moteur GEX central.** Il ne cherche pas à ajuster le positionnement à l'aide du flux intraday — pas d'inférence ouverture-contre-clôture, pas de repondération en direct de l'open interest. Ce type d'ajustement de flux introduit une incertitude supplémentaire bien réelle et constitue un problème distinct ; l'intégrer au pin rendrait la métrique plus difficile à considérer comme fiable, pas plus facile. Le pin que vous voyez repose sur la même base de positionnement que toute autre lecture du gamma dealer sur la plateforme, ce qui le maintient cohérent et interprétable.

---

## Quand le Pin Strike entre en jeu

Le Pin Strike est le plus informatif dans une fenêtre et un régime spécifiques, et le moins informatif en dehors :

- **Tard dans une séance 0DTE, dans un régime à gamma positif.** C'est son terrain de prédilection. Lorsque le spot est au-dessus du gamma flip et qu'il existe un nœud à gamma positif atteignable, le Pin Strike marque l'endroit où la couverture stabilisante est concentrée, et le prix y fait souvent du mean-reversion à l'approche de la clôture. Il se lit au mieux comme *le centre de gravité de la fourchette de pinning actuelle*, encadré par les walls.

- **Comme un niveau de contexte, pas une cible.** Un Pin Strike est un aimant modélisé, pas une prédiction que le prix va s'y imprimer. Il tend à décrire où une fourchette s'organise, avec quelle étroitesse et avec quelle confiance (via le score de confiance) — pas une destination garantie ni un signal de timing. C'est un contexte pour une décision, jamais une décision.

- **À lire aux côtés de la confiance et des walls.** Un pin à confiance élevée situé entre un call wall et un put wall solides constitue une image de pinning cohérente et bien définie. Un pin à confiance faible, ou un pin dont les walls sont éloignés, en constitue une bien plus lâche. Le chiffre n'a de sens qu'à hauteur de la structure qui l'entoure.

Et surtout, il reconnaît quand *rien* de tout cela ne s'applique — ce qui fait l'objet de la dernière section.

---

## Quand le Pin Strike est nul — et pourquoi nous avons fait ce choix

C'est la partie qui distingue le plus le Pin Strike d'un outil naïf du type « strike lourd le plus proche » : **il est autorisé, et censé, à ne renvoyer aucun pin actif.** Un outil qui imprime toujours un niveau est facile à construire et facile à mal interpréter — il fabrique une fausse confiance précisément les jours où il n'y a rien à quoi se pinner. Le Pin Strike fait la chose la plus difficile et la plus honnête : lorsqu'il n'existe aucun pin à gamma positif significatif, il ne renvoie rien, et vous en dit *la raison*.

Lorsqu'il n'y a aucun pin actif, la métrique rapporte l'une des raisons suivantes :

- **Aucune échéance 0DTE** — aucune échéance du jour même n'est cotée pour le sous-jacent. Sans chaîne 0DTE, un pin intraday n'a aucun objet.
- **Expiré** — l'instant de règlement 0DTE est déjà passé (temps jusqu'à l'expiration ≤ 0), par exemple après la clôture cash. L'atteignabilité est indéfinie une fois les options réglées.
- **Aucun gamma de rappel positif** — l'algorithme s'est exécuté, mais aucun candidat atteignable ne présente de gamma dealer local net positif. C'est le cas nul significatif et non dégénéré : le prix se trouve dans un voisinage à gamma court où la couverture est déstabilisante, de sorte que *rien ne pinne*. Forcer un niveau ici induirait activement en erreur — cela pointerait vers un strike qui repousse mécaniquement le prix *au loin*, et non vers lui.
- **Données de volatilité implicite insuffisantes** — il n'existe pas de volatilité implicite à la monnaie exploitable pour ancrer le calcul d'atteignabilité, de sorte que les distances ne peuvent pas être considérées comme fiables. Aucune volatilité par défaut arbitraire n'est substituée.
- **Données d'options insuffisantes** — il n'existe pas de données d'options 0DTE valides (pas de spot, ou aucun contrat doté d'un open interest, d'une IV, d'un temps et d'un strike exploitables), de sorte qu'il n'y a rien à modéliser.
- **Score de pin trop faible** — un plancher de magnitude optionnel qui supprime un pin dont le score brut est négligeable. Il est désactivé par défaut, de sorte qu'il ne se déclenche que lorsqu'il est explicitement configuré — la plateforme n'invente pas de seuils visibles par l'utilisateur.

Deux autres cas courants se présentent comme un pin vide sans code de raison : les **images de replay historique** écrites avant le lancement du Pin Strike ne portent tout simplement aucune valeur (la ligne est omise, et rien n'est rempli rétroactivement), et le **graphique de gamma en direct masque le pin pendant le rembobinage temporel**, car le pin est une valeur de niveau résumé qui n'est pas reconstruite pour le tampon de rembobinage par minute.

Le principe de conception qui sous-tend tout cela : **un honnête « aucun pin » est plus utile qu'un pin forcé.** Une séance à gamma négatif, en tendance, ou dont l'expiration est passée n'a véritablement aucun pin de gamma, et le résultat correct dans ces états est le silence — pas le strike le plus proche déguisé en aimant. La métrique fait ressortir exactement laquelle des conditions ci-dessus s'applique, de sorte qu'un « — » n'est jamais ambigu : c'est un énoncé spécifique et inspectable sur le marché, pas une lacune dans les données. Dans l'interface, cela s'affiche toujours sous la forme d'un tiret — jamais un `0`, un `NaN`, ni un strike de repli trompeur.

---

## Comment le lire en une phrase

Le Pin Strike est le strike 0DTE atteignable où la revalorisation du book à ce strike produit le gamma dealer net positif (stabilisant) le plus concentré localement à l'approche de l'expiration — un centre de gravité modélisé pour une fourchette de pinning de fin de séance, rapporté avec une confiance et, lorsque le marché n'offre aucun nœud de ce type, délibérément rapporté comme n'étant rien du tout.

Pour le voir en direct aux côtés des walls, du flip et du max pain, affichez [les niveaux de gamma SPX / SPY / QQQ / NDX du jour](/spx-gamma-levels) et observez comment le Pin Strike se comporte à l'approche de la dernière heure — et notez les séances où il devient silencieux.
