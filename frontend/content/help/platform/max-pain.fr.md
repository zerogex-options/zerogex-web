# Max Pain

*Comment le max pain est calculé, quand il agit comme un aimant et quand il n'est qu'une coïncidence, et comment le lire aux côtés du gamma profile.*

---

## Ce qu'est le max pain

Le max pain est le **strike à l'expiration** auquel la valeur totale en dollars de toutes les options ouvertes est minimale - c'est-à-dire le niveau où, globalement, les acheteurs d'options "perdent le plus".

C'est une géométrie de paiement, pas une preuve de manipulation : il marque l'endroit où la plus grande part de la prime d'options expire sans valeur, et il ne mesure pas à lui seul le hedging des dealers. La vieille idée selon laquelle les market makers (les vendeurs naturels d'options aux clients) pousseraient activement le spot vers le max pain est bien plus nuancée qu'il n'y paraît - voir [Max Pain Expliqué](/education/max-pain-explained).

Le max pain est calculé à partir de l'open interest, qui est compensé et publié par séance plutôt que mis à jour tick par tick en intraday - traitez-le donc comme une structure de contexte, et non comme une cible prédictive en temps réel.

## Ce que montre cette page

### Le bandeau de régime

**Max Pain Regime** résume la position du spot par rapport au max pain : **Pin Risk Elevated** lorsque le spot est à moins de 0,4 % de celui-ci, sinon **Upside Magnet** (max pain au-dessus du spot) ou **Downside Magnet** (max pain en dessous), avec une courte lecture en dessous.

### Les cartes de synthèse

- **Current Max Pain (All Expirations)** - le max pain de toute la chaîne : toutes les échéances listées réunies en une seule courbe de paiement, recalculée une fois par jour avant l'ouverture. Le badge à côté est le mouvement implicite - max pain moins spot, en points et en pourcentage.
- **Nearest-Expiration Max Pain** - le max pain de l'échéance la plus proche uniquement. Comme il ne couvre qu'une seule échéance, il peut se situer à quelques points du chiffre de toute la chaîne.
- **Underlying Price** - le dernier prix.

### Notional Open Interest by Strike

Le notionnel des calls et des puts à chaque strike pour l'échéance choisie dans le menu **Expiration**, avec le max pain et le spot marqués. Le max pain est propre à chaque échéance : la ligne pointillée du max pain se déplace donc avec le menu. Les barres montrent où se trouve l'argent ; le max pain est l'endroit où les deux blocs s'équilibrent.

### Max Pain vs Underlying Price

Le max pain sous forme de ligne au-dessus des bougies du sous-jacent, avec son propre menu de timeframe - utile pour repérer une dérive vers (ou à l'écart de) le spot. Attendez-vous à des paliers plutôt qu'à une dérive régulière : le max pain ne bouge que lorsque l'open interest est réécrit au moment de la compensation.

## Quand le max pain compte

Le max pain est le plus fiable :

- **Dans les 24 à 48 dernières heures avant une échéance significative.** Avant cela, la chaîne est trop active pour que le max pain soit stable.
- **Pour le 0DTE sur SPX.** La chaîne 0DTE est assez grande pour que des effets de pin *puissent* apparaître - même si le pinning reste probabiliste, pas mécanique.
- **Quand l'aimant gamma s'aligne avec l'aimant du max pain.** Lorsque le strike de max pain est aussi un strike à gamma élevé (un wall), un pin est *plus probable*. Lorsqu'ils ne s'alignent pas, le max pain relève plus probablement de la coïncidence - mais aucune des deux lectures n'est garantie.

## Quand il ne compte pas

- **Sur des marchés activement en tendance.** Les catalyseurs macro l'emportent sur le comportement de pin.
- **Pour les échéances minces ou les weeklies peu liquides.** Il n'y a pas assez d'open interest pour créer une pression de pinning.
- **Loin de l'expiration.** Le temps restant avant l'expiration est l'un des principaux facteurs - au début de la vie d'un contrat, la chaîne est trop active pour que le max pain se stabilise.

## Comment le lire aux côtés du gamma

Deux lectures :

1. **Max pain très proche d'un wall** ⇒ une pression de pin vers la clôture est plus probable. Le wall est le niveau structurel ; le max pain apporte du contexte, pas une garantie.
2. **Max pain éloigné des walls et du spot** ⇒ ignorez le max pain. La pression structurelle se situe ailleurs.

## Voir aussi

- [Max Pain Expliqué - Est-ce Vraiment Efficace ?](/education/max-pain-explained)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Gamma Walls Expliqués](/education/gamma-walls-explained)
