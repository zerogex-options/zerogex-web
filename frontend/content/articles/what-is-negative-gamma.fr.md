# Que Signifie Gamma Négatif ? Une Explication en Termes Simples

*Que signifie gamma négatif — et pourquoi un trader d'options devrait-il s'en soucier ? En bref : cela signifie que le hedging des dealers amplifie les mouvements au lieu de les amortir. Voici à quoi ce terme se réfère réellement, comment repérer un régime de gamma négatif en temps réel, et ce qui change dans votre trading lorsque vous êtes dans un tel régime.*

---

## La réponse courte

**Le gamma négatif**, dans le contexte de l'options-flow, signifie que les dealers qui se trouvent de l'autre côté des transactions d'options des clients ont un book net short-gamma. La conséquence pratique : quand SPY monte, ils doivent *acheter* SPY pour rester couverts, et quand SPY baisse, ils doivent *vendre* SPY. Leurs opérations de hedging vont **dans le même sens** que le prix — pas à contre-courant.

Ce réflexe mécanique transforme le book des dealers en amplificateur. Les selloffs s'accélèrent. Les rallyes s'étendent. La volatilité intraday réalisée tend à être plus élevée que l'implicite. Le comportement de pin se rompt. Le même setup graphique qui fonctionnait hier (quand les dealers étaient long gamma et absorbaient les mouvements) se fait écraser aujourd'hui (quand ils sont short gamma et courent après le mouvement).

L'inverse — le **gamma positif** — est la configuration par défaut la plus courante pour SPY pendant la plupart des séances calmes. Les dealers sont long gamma, couvrent le mouvement et amortissent la volatilité. Le tableau complet est traité dans le [pilier Gamma Exposure](/education/gamma-exposure-explained) ; cet article se concentre spécifiquement sur ce que signifie "gamma négatif" et comment le reconnaître.

---

## À quoi le "gamma négatif" se réfère réellement

Le gamma est un Greek d'options du second ordre qui mesure comment le delta d'une option évolue lorsque le sous-jacent bouge. Un chiffre de "gamma exposure" signé est le gamma agrégé sur l'ensemble du book des dealers, où les calls (typiquement détenus short par les dealers) contribuent positivement et les puts (également typiquement détenus short) contribuent négativement.

Lorsque le *net* de ces contributions signées est négatif, le book des dealers est short gamma dans l'ensemble. La façon conventionnelle dont cela apparaît dans les outils de flow : Net GEX < 0.

L'hypothèse standard client-long-call / client-long-put implique que les dealers sont typiquement short sur les deux — mais les *magnitudes* varient selon le positioning. Lorsque la demande des clients penche fortement vers les puts (par exemple pendant les régimes de peur), le gamma net du book des dealers peut basculer en négatif ; lorsqu'elle penche vers les calls (par exemple lors de tendances haussières calmes), le book est long gamma.

La statistique récapitulative la plus utile de toutes : le **gamma flip** — le prix auquel le profil gamma des dealers croise zéro. Au-dessus du flip, les dealers sont typiquement long gamma (positif). En dessous du flip, short gamma (négatif). Lire le flip revient essentiellement à lire la ligne du régime. Voir [Comment Lire un Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Pourquoi le gamma négatif amplifie les mouvements

La chaîne mécanique :

1. L'exposition delta nette des dealers est short-gamma. Quand le spot monte, le delta de leur portefeuille d'options baisse (ils deviennent plus short par rapport à la neutralité).
2. Pour rester delta-neutre, ils doivent **acheter** le sous-jacent pour compenser la baisse.
3. Cet achat se produit au moment même où les clients font monter le marché. Cela s'ajoute au momentum.
4. Quand le spot baisse, c'est l'inverse : le delta des options des dealers augmente (ils deviennent plus long par rapport à la neutralité) ; pour neutraliser, ils **vendent** le sous-jacent. Cette vente s'ajoute à la baisse.

Dans les deux sens, le hedging des dealers *renforce* le mouvement. Le réflexe est procyclique. Plus l'exposition short-gamma des dealers est importante, plus chaque point de pourcentage de mouvement nécessite de flow sur le sous-jacent.

Comparez avec le **gamma positif**, où la même chaîne de flow s'inverse : les dealers vendent dans la force et achètent dans la faiblesse, amortissant le mouvement. La force structurelle du marché est anticyclique. La même nouvelle qui produit une fourchette intraday de 0,5 % dans un régime long-gamma peut produire une fourchette de 2 % dans un régime short-gamma.

---

## Gamma négatif vs. gamma positif, côte à côte

| | Gamma positif (long-gamma) | Gamma négatif (short-gamma) |
|---|---|---|
| Réflexe de hedging des dealers | Vendent dans la force, achètent dans la faiblesse | Achètent dans la force, vendent dans la faiblesse |
| Vol réalisée vs. implicite | Tend à être **plus basse** | Tend à être **plus élevée** |
| Breakouts | S'estompent souvent et rebondissent | S'étendent souvent |
| Selloffs | Souvent absorbés près des walls | S'accélèrent souvent |
| Comportement de pin | Les aimants tirent le prix vers les strikes lourds | Les aimants relâchent le prix ; pas de pin |
| Meilleur playbook | Mean-reversion, fade des extrêmes, vente de prime | Continuation de tendance, momentum, breakout |
| Pire playbook | Courir après les breakouts, momentum | Fader les rallyes, acheter les dips dans la structure |
| Typique quand | SPY au-dessus du gamma flip, Net GEX > 0 | SPY en dessous du gamma flip, Net GEX < 0 |

Ce sont des tendances générales de régime, pas des garanties. Les catalyseurs et les chocs peuvent les annuler. Mais le taux de base est suffisamment significatif pour que suivre le mauvais playbook pour le régime représente l'essentiel du coût.

---

## Comment repérer un régime de gamma négatif en temps réel

Un court workflow :

1. **Vérifiez d'abord le gamma flip.** Si SPY est en dessous du flip, vous êtes par définition dans un régime short-gamma.
2. **Confirmez avec le Net GEX.** Une valeur de Net GEX négative donne la lecture de magnitude — plus elle est négative, plus le régime est marqué. Un Net GEX proche de zéro est un régime disputé ; les deux réflexes sont partiellement actifs.
3. **Recoupez avec le tableau de la vol réalisée.** Les régimes short-gamma se traduisent par des fourchettes intraday plus larges que ce que la vol implicite d'ouverture de la journée suggérait. Si la réalisée s'élargit pendant que l'implicite reste plate, c'est la signature du régime.
4. **Observez le comportement des walls.** Dans les régimes short-gamma, les walls s'affaiblissent ou s'inversent. Le call wall qui plafonnait les rallyes hier peut devenir aujourd'hui un objectif de breakout.
5. **Observez la direction du flow à la clôture.** Le short-gamma en fin de séance produit souvent des mouvements directionnels qui s'accélèrent (le signal de pression EOD devient une lecture de continuation, pas une lecture de fade).

---

## Ce qui change dans votre trading

Concrètement, des choses à *arrêter* de faire dans un régime de gamma négatif :

- **Ne fadez pas les rallyes.** Le réflexe des dealers amplifie. Votre "short de mean-reversion" combat le flow structurel d'achat.
- **N'achetez pas les dips dans la structure.** Même problème inversé. Le put wall qui soutenait le marché en long-gamma peut devenir un point de slippage en short-gamma.
- **Ne vous attendez pas au pinning.** L'attraction structurelle vers les strikes lourds est désactivée. La thèse de l'aimant ne s'applique pas.
- **Ne dimensionnez pas pour une fourchette normale.** La vol réalisée est structurellement plus élevée. Dimensionnez vos positions en supposant que des stops plus larges sont nécessaires.

Des choses à *commencer* à faire :

- **Tradez avec le mouvement.** Les setups trend-following ont un taux de réussite plus élevé.
- **Traitez les walls comme des objectifs de breakout, pas comme des résistances.** Le même niveau que vous auriez fadé en long-gamma pourrait être une entrée de continuation en short-gamma.
- **Soyez plus sélectif sur le timing d'entrée.** Des fourchettes plus larges signifient plus de risque par trade. Compensez avec des critères de setup plus stricts.
- **Surveillez les retours vers un régime de gamma positif.** Cela arrive — le flip est dynamique. Quand le spot repasse au-dessus du gamma flip, le playbook bascule avec lui.

---

## Exemple concret

SPX ouvre la journée à 5 780. ZeroGEX affiche :

- **Net GEX :** −1,1 Md $ (négatif — régime short-gamma)
- **Gamma Flip :** 5 810 (spot 30 points en dessous)
- **Call Wall :** 5 820
- **Put Wall :** 5 750

Au cours de la matinée, SPX grimpe progressivement jusqu'à 5 800. L'instinct lors d'une journée long-gamma serait de commencer à fader les rallyes vers le flip de 5 810 et le call wall de 5 820.

La lecture structurelle dit ici le contraire. SPX est en territoire short-gamma ; le hedging des dealers amplifie. La poussée vers 5 810 pourrait s'étendre au-delà plutôt que de s'estomper — surtout si le Net GEX continue de se dégrader davantage en négatif. Le call wall à 5 820 dans ce régime a plus de chances d'agir comme objectif de breakout que comme résistance.

L'inclination pratique : sautez le fade. Soit vous tradez avec le momentum, soit vous restez à l'écart. Inversez le playbook par rapport à une journée long-gamma typique.

Imaginez maintenant le même graphique avec un Net GEX à +1,2 Md $ et le gamma flip à 5 760 (spot 40 points au-dessus). La lecture structurelle s'inverse : 5 820 agit probablement comme résistance, le réflexe long-gamma absorbe les rallyes, le setup de fade est valable. Même tape, lecture opposée, selon une seule variable de régime.

---

## Idées reçues courantes

- **"Le gamma négatif est baissier."** Ce n'est pas vrai. Il est **amplificateur de volatilité**. Le marché peut rallier fortement dans un régime de gamma négatif — et le rallye tend à s'étendre davantage qu'il ne le ferait en long-gamma. Le gamma négatif concerne le *caractère des mouvements*, pas la direction.
- **"Le gamma positif est haussier."** Faux également. Le gamma positif est **amortisseur de volatilité**. Le marché peut dériver à la baisse dans un régime de gamma positif ; il tend simplement à le faire lentement, avec des rebonds de mean-reversion en chemin.
- **"On peut trader les signaux de gamma négatif de la même façon que ceux de gamma positif."** La plupart des pertes chez les particuliers viennent de là. Les signaux et les lectures structurelles s'inversent d'un régime à l'autre. Une thèse "acheter le dip" qui fonctionne au-dessus du flip peut amplifier les pertes en dessous.
- **"Le gamma négatif est rare."** Cela arrive régulièrement — en particulier après des pics de vol, pendant le stress macro, et quand la chain est fortement skewée vers les puts. Connaître le régime en temps réel est ce qui vous indique quand.

---

## À retenir

> Le gamma négatif signifie que les dealers amplifient le mouvement au lieu de l'amortir. Même chaîne, même SPY, caractère opposé du tape — et playbooks opposés pour le trader capable de lire le régime.

La discipline consiste à commencer chaque séance par la lecture du régime : où est le gamma flip, où est le spot, quel est le Net GEX ? Ces trois chiffres vous indiquent quel playbook la force structurelle du marché va soutenir aujourd'hui. Suivre le mauvais playbook contre le régime est l'erreur la plus coûteuse au menu.

Contenu éducatif uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le Net GEX du jour, le gamma flip et la lecture de régime en direct pour SPY, SPX et QQQ — les trois chiffres qui vous disent si les dealers sont actuellement long gamma ou short gamma — la vue gratuite gamma-levels de ZeroGEX les affiche tous.
