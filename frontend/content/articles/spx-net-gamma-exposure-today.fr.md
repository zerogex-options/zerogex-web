# Net GEX du SPX aujourd'hui : valeur actuelle de la net gamma exposure du SPX

*« Quelle est la net gamma exposure actuelle du SPX ? » La lecture différée du jour figure en haut de cette page et se met à jour tout au long de la séance. En dessous : ce qu'est le net GEX du SPX, comment lire un relevé positif par rapport à un relevé négatif, ce que signifie l'unité « dollar gamma », et où se situe le zero-cross.*

---

## Où voir la net gamma exposure du SPX aujourd'hui

Si vous êtes ici pour le chiffre actuel, il se trouve dans l'encadré ci-dessus - le même **net GEX du SPX**, différé d'environ 15 minutes, avec le gamma flip, le call wall, le put wall et le max pain que publie la [page gratuite des niveaux gamma SPX](/spx-gamma-levels), actualisés au même rythme. La même lecture est disponible pour [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) et [NDX](/ndx-gamma-levels). Pour la valeur en direct, le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte) se met à jour tout au long de la séance. Le reste de cette page explique ce que signifie ce chiffre et comment l'utiliser.

---

## Qu'est-ce que la net gamma exposure du SPX ?

La **net gamma exposure (net GEX)** du SPX est la somme du gamma des dealers sur l'ensemble de la chaîne d'options du S&P 500, condensée en un seul chiffre signé en dollars - souvent appelé « dollar gamma ». Elle estime combien d'exposition à l'indice S&P les dealers d'options devraient, mécaniquement, acheter ou vendre pour rester couverts à mesure que le SPX évolue.

- Le **signe** indique le régime : positif signifie que le hedging des dealers tend à atténuer les mouvements, négatif signifie qu'il tend à les amplifier.
- L'**ampleur** (par ex. +1,5 Md$, −800 M$) indique le niveau de hedging modélisé sous-jacent au marché - avec quelle intensité le régime est susceptible de s'exprimer.

Le net GEX est le chiffre phare du cadre plus large de la [gamma exposure](/education/what-is-gex-in-trading). Il est calculé au prix spot actuel, donc il évolue à mesure que le SPX bouge et que la chaîne d'options est revalorisée au fil de la journée.

> Le net GEX est une estimation *modélisée*. Il utilise la convention traditionnelle d'open interest call-positif / put-négatif - les dealers étant modélisés comme nets longs des calls que les clients vendent et nets short des puts que les clients achètent. L'inventaire réel des dealers n'est pas directement observable à partir des données publiques de la chaîne d'options.

---

## Le net GEX en « dollar gamma » : ce que signifie l'unité

Le net GEX est exprimé en dollars - « 1,5 Md$ de gamma » - parce qu'il est calibré pour répondre à une question en dollars : quelle exposition à l'indice S&P les dealers devraient-ils environ traiter pour se recouvrir si le SPX bougeait de 1 % ? C'est pourquoi les recherches « SPX net GEX dollar gamma » et « SPX net gamma exposure » aboutissent au même chiffre : le dollar gamma *est* le net GEX, exprimé par mouvement de 1 %. Le signe porte le régime ; l'ordre de grandeur en dollars porte le volume de couverture modélisée qui se tient derrière. Un relevé de +1,5 Md$ et un de +150 M$ décrivent le même régime avec dix fois le coussin.

---

## Comment lire la lecture actuelle du net GEX

Deux cas, deux playbooks opposés :

- **Net GEX du SPX positif (régime long-gamma).** Les dealers sont net long gamma au spot. Ils vendent les rallyes et achètent les creux pour se couvrir, ce qui tend à *comprimer* la volatilité. Attendez-vous à des ranges plus serrés, à davantage de mean reversion, à un pinning vers les strikes lourds, et à un hedging qui s'oppose aux rallyes vers le call wall. Une lecture fortement positive est le signe d'un marché « calme et sans tendance ».
- **Net GEX du SPX négatif (régime short-gamma).** Les dealers sont net short gamma au spot. Ils achètent les rallyes et vendent les creux, ce qui tend à *amplifier* la volatilité. Attendez-vous à des ranges plus larges, à des tendances qui filent, et à un hedging qui renforce un breakout dès qu'un wall cède. Une lecture fortement négative est le signe d'un marché « rapide, en tendance, respectez vos stops ». C'est [ce que signifie un gamma négatif](/education/what-is-negative-gamma) pour le marché.

La lecture n'est pas une direction - c'est un *caractère*. Un net GEX positif ne dit pas « hausse », il dit « collant ». Un négatif ne dit pas « baisse », il dit « volatil ».

---

## Le zero-cross : net GEX et le gamma flip

Le moment le plus surveillé est le **zero-cross** - le point où le net GEX traverse le zéro. Ce prix est le [gamma flip](/education/how-to-read-a-gamma-flip) : au-dessus, les dealers sont généralement net long gamma (positif), en dessous, net short (négatif).

Quand les traders recherchent « SPX net gamma exposure zero cross », c'est exactement cela qu'ils visent - la ligne de régime. Observer le net GEX par rapport au zéro, et le spot par rapport au flip, revient à la même lecture sous deux angles :

- Spot bien au-dessus du flip avec un net GEX fortement positif → en plein dans le régime apaisant.
- Spot proche du flip avec un net GEX proche de zéro → un marché instable et nerveux, susceptible de basculer dans un sens ou dans l'autre.
- Spot en dessous du flip avec un net GEX négatif → le régime amplificateur domine.

Pour savoir dans lequel de ces états se trouve le SPX, consultez les [niveaux gamma SPX du jour](/spx-gamma-levels).

---

## Pourquoi le book 0DTE du SPX fait bouger le chiffre du jour

Les options 0DTE représentent une large part de l'activité de trading sur le SPX et peuvent dominer la sensibilité gamma près du spot lors de certaines séances. À l'approche de l'échéance, le gamma ATM peut augmenter fortement, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le spot, le temps et la volatilité implicite peuvent donc faire bouger le Net GEX modélisé en intraday, même si l'OI officiel n'est généralement mis à jour qu'après la compensation. Le volume brut et l'OI ne révèlent pas l'équilibre entre achats et ventes des clients, et ne prouvent pas l'exposition nette des dealers.

Implication pratique : un chiffre de net GEX vieux de trois heures peut déjà être périmé. Pour le SPX en particulier, la lecture *actuelle* compte davantage que pour des books plus lents et à échéances plus longues - c'est justement pour cela qu'il vaut mieux consulter la valeur en direct plutôt que de se fier à un instantané du matin. Pour le contexte sur le positionnement des dealers derrière cette oscillation intraday, voir [le positionnement des dealers 0DTE expliqué](/education/0dte-dealer-positioning-explained).

---

## Comment utiliser la lecture dans votre séance

1. **Commencez par le chiffre.** Avant votre premier trade, vérifiez si le net GEX du SPX est positif ou négatif, et son ampleur. Cela détermine le playbook de la journée.
2. **Repérez le zero-cross.** Marquez le gamma flip. Sachez si le spot est au-dessus ou en dessous, et de combien.
3. **Adaptez les tactiques au signe.** Positif → fades, trading de range et patience près des walls. Négatif → momentum, breakouts et risque plus serré.
4. **Revérifiez en intraday.** Comme le book 0DTE évolue, jetez à nouveau un œil à la lecture actuelle après le matin et vers la dernière heure.

---

## À retenir

> La net gamma exposure du SPX est un seul chiffre signé qui indique si les dealers atténuent ou amplifient le mouvement du jour. Lisez d'abord le signe, observez-le par rapport au zero-cross, et gardez à l'esprit que le book du SPX, dominé par le 0DTE, maintient ce chiffre en perpétuel mouvement - consultez donc la valeur *actuelle*, ne vous fiez pas à celle de ce matin.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Envie de voir le chiffre du jour ? Consultez le net GEX du SPX du jour sur la [page des niveaux gamma SPX](/spx-gamma-levels) gratuite (également [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) et [NDX](/ndx-gamma-levels)), approfondissez avec [Gamma Exposure (GEX) expliqué](/education/gamma-exposure-explained), ou ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte) - [démarrez un essai gratuit](/register) pour la lecture en direct.
