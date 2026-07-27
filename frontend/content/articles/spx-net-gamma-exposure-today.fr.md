# Net Gamma Exposure du SPX aujourd'hui : comment lire le Net GEX actuel
> **Note méthodologique mise à jour — elle prévaut sur toute formulation incompatible plus bas.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. L’inversion du terme de pin d’EOD Pressure reste donc une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.


*« Quelle est la net gamma exposure actuelle du SPX ? » Le chiffre change à chaque séance — mais pas la manière de le lire. Voici ce qu'est le net GEX du SPX, comment distinguer une lecture positive d'une négative, où se situe le zero-cross, et comment consulter la valeur en direct du jour.*

---

## Où voir la net gamma exposure du SPX aujourd'hui

Si vous êtes ici pour le chiffre actuel, commencez ici : ZeroGEX publie le **net GEX du SPX** du jour — avec le gamma flip, le call wall, le put wall et le max pain — gratuitement et avec un décalage d'environ 15 minutes sur la [page des niveaux gamma SPX](/spx-gamma-levels). La même lecture est disponible pour [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels). Pour la valeur en direct, actualisée à la seconde près, le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte) se met à jour tout au long de la séance. Le reste de cette page explique ce que signifie ce chiffre et comment l'utiliser.

---

## Qu'est-ce que la net gamma exposure du SPX ?

La **net gamma exposure (net GEX)** du SPX est la somme du gamma des dealers sur l'ensemble de la chaîne d'options du S&P 500, condensée en un seul chiffre signé en dollars — souvent appelé « dollar gamma ». Elle estime combien d'exposition à l'indice S&P les dealers d'options devraient, mécaniquement, acheter ou vendre pour rester couverts à mesure que le SPX évolue.

- Le **signe** indique le régime : positif signifie que le hedging des dealers tend à atténuer les mouvements, négatif signifie qu'il tend à les amplifier.
- L'**ampleur** (par ex. +$1.5B, −$800M) indique le niveau de hedging modélisé sous-jacent au marché — avec quelle intensité le régime est susceptible de s'exprimer.

Le net GEX est le chiffre phare du cadre plus large de la [gamma exposure](/education/what-is-gex-in-trading). Il est calculé au prix spot actuel, donc il évolue à mesure que le SPX bouge et que la chaîne d'options se repricé au fil de la journée.

> Le net GEX est une estimation *modélisée*. Il utilise la convention traditionnelle d'open interest call-positif / put-négatif — les dealers étant modélisés comme nets longs des calls que les clients vendent et nets short des puts que les clients achètent. L'inventaire réel des dealers n'est pas directement observable à partir des données publiques de la chaîne d'options.

---

## Comment lire la lecture actuelle du net GEX

Deux cas, deux playbooks opposés :

- **Net GEX du SPX positif (régime long-gamma).** Les dealers sont net long gamma au spot. Ils vendent les rallyes et achètent les creux pour se couvrir, ce qui tend à *comprimer* la volatilité. Attendez-vous à des ranges plus serrés, à davantage de mean reversion, à un pinning vers les strikes lourds, et à des tentatives de rally qui calent souvent près du call wall. Une lecture fortement positive est le signe d'un marché « calme et sans tendance ».
- **Net GEX du SPX négatif (régime short-gamma).** Les dealers sont net short gamma au spot. Ils achètent les rallyes et vendent les creux, ce qui tend à *amplifier* la volatilité. Attendez-vous à des ranges plus larges, à des breakouts qui s'étendent, et à des tendances qui filent. Une lecture fortement négative est le signe d'un marché « rapide, en tendance, respectez vos stops ». C'est [ce que signifie un gamma négatif](/education/what-is-negative-gamma) pour le marché.

La lecture n'est pas une direction — c'est un *caractère*. Un net GEX positif ne dit pas « hausse », il dit « collant ». Un négatif ne dit pas « baisse », il dit « volatil ».

---

## Le zero-cross : net GEX et le gamma flip

Le moment le plus surveillé est le **zero-cross** — le point où le net GEX traverse le zéro. Ce prix est le [gamma flip](/education/how-to-read-a-gamma-flip) : au-dessus, les dealers sont généralement net long gamma (positif), en dessous, net short (négatif).

Quand les traders recherchent « SPX net gamma exposure zero cross », c'est exactement cela qu'ils visent — la ligne de régime. Observer le net GEX par rapport au zéro, et le spot par rapport au flip, revient à la même lecture sous deux angles :

- Spot bien au-dessus du flip avec un net GEX fortement positif → en plein dans le régime apaisant.
- Spot proche du flip avec un net GEX proche de zéro → un marché instable et nerveux, susceptible de basculer dans un sens ou dans l'autre.
- Spot en dessous du flip avec un net GEX négatif → le régime amplificateur domine.

---

## Pourquoi le book 0DTE du SPX fait bouger le chiffre du jour

Le SPX est désormais dominé par les échéances du jour même (0DTE), ce qui rend le net GEX particulièrement *vivant*. Les contrats du jour même portent un gamma énorme juste at-the-money, gamma qui décroît jusqu'à zéro à la clôture. La lecture actuelle du net GEX du SPX peut donc osciller de manière significative au cours d'une même séance — en grande partie parce que le spot bouge, que le temps passe et que les variations de la volatilité implicite re-pricent ce gamma concentré au fil de la journée. (L'open interest officiel est compensé pour la séance suivante, de sorte que toute lecture d'un positionnement en train de *se construire* en intraday est déduite du flux, et non confirmée par l'OI.)

Implication pratique : un chiffre de net GEX vieux de trois heures peut déjà être périmé. Pour le SPX en particulier, la lecture *actuelle* compte davantage que pour des books plus lents et à échéances plus longues — c'est justement pour cela qu'il vaut mieux consulter la valeur en direct plutôt que de se fier à un instantané du matin. Pour le contexte sur le positionnement des dealers derrière cette oscillation intraday, voir [le positionnement des dealers 0DTE expliqué](/education/0dte-dealer-positioning-explained).

---

## Comment utiliser la lecture dans votre séance

1. **Commencez par le chiffre.** Avant votre premier trade, vérifiez si le net GEX du SPX est positif ou négatif, et son ampleur. Cela détermine le playbook de la journée.
2. **Repérez le zero-cross.** Marquez le gamma flip. Sachez si le spot est au-dessus ou en dessous, et de combien.
3. **Adaptez les tactiques au signe.** Positif → fades, trading de range et patience près des walls. Négatif → momentum, breakouts et risque plus serré.
4. **Revérifiez en intraday.** Comme le book 0DTE évolue, jetez à nouveau un œil à la lecture actuelle après le matin et vers la dernière heure.

---

## À retenir

> La net gamma exposure du SPX est un seul chiffre signé qui indique si les dealers atténuent ou amplifient le mouvement du jour. Lisez d'abord le signe, observez-le par rapport au zero-cross, et gardez à l'esprit que le book du SPX, dominé par le 0DTE, maintient ce chiffre en perpétuel mouvement — consultez donc la valeur *actuelle*, ne vous fiez pas à celle de ce matin.

Contenu à visée éducative uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Envie de le voir en temps réel ? Consultez le net GEX du SPX du jour sur la [page des niveaux gamma SPX](/spx-gamma-levels) gratuite (également [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels)), approfondissez avec [Gamma Exposure Explained](/education/gamma-exposure-explained), ou ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte) — [démarrez un essai gratuit](/register) pour la lecture en direct, actualisée à la seconde près.
