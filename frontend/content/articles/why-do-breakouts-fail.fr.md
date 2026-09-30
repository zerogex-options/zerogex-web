# Pourquoi les breakouts échouent-ils ? La raison structurelle derrière les breakouts ratés
> **Note méthodologique.** ZeroGEX estime l’inventaire des dealers à partir de données publiques sans l’observer directement. Le modèle conserve la convention calls positifs/puts négatifs (`Net GEX = Call GEX − Put GEX`) et suppose les dealers nets longs calls et nets shorts puts. Les calls et puts longs ont un gamma positif ; les calls et puts shorts ont un gamma négatif. Le Put Wall est la plus grande concentration de gamma put sous le spot et représente localement un gamma dealer négatif : il peut coïncider avec un support, mais la couverture du put short ne crée pas mécaniquement un plancher. Les walls peuvent migrer avec le spot, le temps et la volatilité implicite alors que l’open interest officiel ne change pas en séance. À l’approche de l’échéance, le gamma se concentre près de l’ATM : le gamma ATM peut augmenter, tandis que le gamma nettement ITM ou OTM tend vers zéro. Le Gamma Flip sélectionné est une transition locale ; le profil peut avoir plusieurs croisements ou aucun croisement significatif. Charm et vanna sont des variations conditionnelles du delta, pas des ordres programmés. Les scores sont des résultats heuristiques du modèle, pas des probabilités calibrées. Un gamma négatif amplifie la direction déjà engagée ; la distance à une cible n’implique pas une répulsion. Qu’en gamma négatif le terme de pin d’EOD Pressure suive le mouvement récent est une heuristique ZeroGEX. Max Pain minimise le paiement intrinsèque agrégé et ne maximise pas exactement le notionnel expirant sans valeur. Le DEX brut mesure le delta des seules options, pas le futur flux de couverture ; prime et côté agresseur ne prouvent ni information, ni ouverture, ni conviction.


*Pourquoi les breakouts échouent-ils si souvent ? Les breakouts ratés ont une cause structurelle enracinée dans le hedging des dealers, le régime de gamma et la façon dont le positionnement se concentre au niveau que le prix tente de franchir - et nous avons mesuré à quelle fréquence ce hedging l'emporte. Voici ce qu'il faut observer avant de se lancer à la poursuite du mouvement.*

---

## Les breakouts ratés ont une cause structurelle

Si vous tradez régulièrement SPY, SPX ou QQQ, vous l'avez vu se produire des dizaines de fois : le prix franchit un niveau de résistance clé sur un volume convaincant, vous (et un millier d'autres traders) achetez la cassure, et en vingt minutes le mouvement s'est déjà défait et vous êtes dans le rouge. Même setup, même résultat.

Le réflexe est d'appeler ça du "bruit", un "faux signal" ou une "chasse aux stops". Mais le schéma est souvent trop cohérent pour que ces explications constituent toute la réponse. De nombreux breakouts ratés sur les produits indiciels de type SPX peuvent être rattachés à un mécanisme structurel - les réflexes de hedging des dealers qui tendent à s'activer autour des strikes que les traders essaient de franchir. À quelle fréquence ce hedging l'emporte-t-il ? Nous l'avons mesuré : les walls du S&P ont tenu environ deux fois sur trois dans l'heure suivant un test, ceux du Nasdaq environ une fois sur deux, et le régime n'a pas changé ces probabilités ([À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break)).

Cet article explique pourquoi les breakouts échouent, les trois conditions structurelles que les traders vérifient pour repérer un échec et ce que nos mesures ont montré à leur sujet, et comment lire ces conditions avant de vous lancer dans la poursuite. Pour le contexte plus large sur la gamma exposure, voir le [pilier Gamma Exposure](/education/gamma-exposure-explained) ; pour la stratégie associée de fade du breakout, voir l'[approfondissement combiné EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection).

---

## Le schéma classique du breakout raté

Le setup est presque identique à chaque fois :

1. Le prix se comprime dans un range sous un niveau de résistance évident - souvent un strike à forte call gamma, un précédent plus haut de swing, ou une cible de max pain.
2. Une poussée de volume fait franchir le niveau au prix. La première bougie au-dessus paraît décisive.
3. Le volume s'amenuise. Le prix oscille juste au-dessus du niveau pendant quelques minutes.
4. Le retournement commence lentement, puis s'accélère. Le prix redescend à travers le niveau, revenant dans le range précédent.
5. Les retardataires qui ont poursuivi la cassure se retrouvent en perte ; les dealers qui ont absorbé le mouvement sont flat.

C'est un breakout raté. Le mécanisme derrière - pour les produits indiciels liquides - n'est généralement pas aléatoire.

---

## Pourquoi le hedging des dealers absorbe les breakouts

La cause structurelle dominante est **le hedging long-gamma des dealers sur des strikes concentrés**.

Voici l'enchaînement :

1. Les clients vendent massivement des calls sur un strike donné (disons le strike SPX 5 850) - overwriting et vente de calls. Les dealers sont modélisés comme acheteurs de ces calls, ce qui les rend longs gamma sur ce strike.
2. Pour rester delta-neutres, les dealers détiennent une quantité correspondante de delta short sur le sous-jacent - autrement dit, ils sont short par rapport à l'exposition aux calls. À mesure que le spot monte vers 5 850, leur exposition en options accumule du delta positif qu'ils tendent à compenser en *vendant* le sous-jacent.
3. Plus le spot se rapproche de 5 850, plus la gamma se concentre - et plus les dealers tendent à vendre de sous-jacent par tick de mouvement de prix pour rester neutres.
4. Cette vente peut agir comme une offre structurelle. Elle n'a pas besoin de venir d'un seul endroit - c'est l'agrégat des dealers qui se couvrent de la même manière, selon le modèle.
5. Quand le prix essaie de franchir 5 850, les dealers tendent à vendre dans le mouvement même où les poursuivants achètent - et cette offre peut l'emporter.

C'est ce que les gens veulent dire quand ils disent que "le call wall a absorbé le breakout". Le wall est un positionnement réel ; l'absorption est une opération de hedging réelle. Les deux sont observables en temps réel.

L'analyse plus approfondie de ce qu'est un wall et pourquoi il se comporte ainsi se trouve dans [Gamma Walls Explained](/education/gamma-walls-explained).

---

## Les trois conditions structurelles que vérifient les traders

Chacune décrit une partie du mécanisme. Aucune d'entre elles, sur les 737 tests de walls que nous avons mesurés, n'a permis de distinguer les walls qui ont cédé de ceux qui ont tenu - lisez-les donc comme une description de ce que fait le hedging, pas comme des probabilités.

### 1. Le régime est long-gamma

L'ensemble du mécanisme selon lequel "les dealers absorbent les breakouts" ne fonctionne que dans un régime de **gamma positive** - typiquement lorsque le spot est au-dessus du gamma flip. Dans ce régime, le hedging des dealers amortit les mouvements directionnels ; le réflexe consiste à vendre la force et à acheter la faiblesse.

Dans un régime de **gamma négative** - spot sous le flip - le réflexe s'inverse. Les dealers tendent à acheter dans les rallyes et à vendre dans les selloffs, ce qui amplifie les mouvements. Si un breakout survient dans un régime de gamma négative, le hedging le renforce au lieu de s'y opposer.

Lire le gamma flip en temps réel constitue l'essentiel de ce filtre. Voir [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) pour la méthode.

### 2. Le positionnement des dealers se renforce, il ne se dénoue pas

Le hedging long-gamma n'absorbe que si le positionnement est réellement maintenu. Si le Net GEX décline (les positions se ferment ou se roulent vers l'échéance), le réflexe d'absorption s'affaiblit en conséquence. La thèse du trap detection pénalise spécifiquement les lectures de breakout raté quand le Net GEX se contracte.

Un breakout contre un wall avec un Net GEX **en renforcement** est le setup classique de fade. Un breakout contre un wall avec un Net GEX **en déclin** trouve moins d'absorption modélisée derrière le wall - l'absorbeur structurel quitte la table. Selon nos mesures, ni l'un ni l'autre ne rendait une cassure plus ou moins probable.

### 3. Le wall ne migre pas avec le prix

Un wall qui reste sur un même strike pendant que le prix le teste diffère d'un wall qui migre. Le spot, le temps et la volatilité implicite peuvent modifier le classement de la gamma même lorsque l'open interest officiel est inchangé ; la migration à elle seule n'établit pas que de nouvelles positions ont été ouvertes. Elle indique que la référence structurelle modélisée a changé.

Les setups de fade-the-breakout les plus nets présentent un wall statique avec un prix qui le teste. La migration du wall vous indique que la référence s'est déplacée ; selon nos mesures, elle ne permettait pas de prédire si la cassure allait durer.

---

## Quand la structure cesse de s'opposer à un breakout

À l'inverse, voici les conditions que le modèle interprète comme jouant contre le fade :

- Le spot est sous le gamma flip (régime short-gamma - le réflexe des dealers amplifie).
- Le Net GEX est faible, en déclin, ou négatif.
- Le wall au-dessus du prix migre vers le haut avec le prix (poursuivant le mouvement).
- Un véritable catalyseur survient (CPI, FOMC, surprise macro) qui écrase le flux structurel.
- Le flux vers le breakout *s'accélère*, au lieu de ralentir.

Elles décrivent le mécanisme, pas les probabilités. Selon nos mesures, le régime, le Net GEX, la migration et le flux au strike du wall ne permettaient pas de prédire quels walls allaient céder (les catalyseurs ne faisaient pas partie du test). La thèse du fade n'a le mécanisme de son côté que lorsque la structure la soutient, et même dans ce cas, c'est un pari sur le taux de base.

---

## Comment lire cela sur ZeroGEX en temps réel

La vue gratuite `/spx-gamma-levels`, décalée d'environ 15 minutes, affiche les trois conditions côte à côte :

- **Carte Gamma Flip** - indique dans quel régime vous vous trouvez.
- **Carte Net GEX** - indique l'ampleur et (dans le temps) la trajectoire du positionnement des dealers.
- **Carte Call Wall** - indique le strike de call actuellement le plus lourd, avec sa distance par rapport au spot.

Les deux formules payantes affichent ces niveaux en temps réel, et ZeroGEX Pro ajoute le signal **Trap Detection**, un score dérivé de -100 à +100 conçu pour signaler une cassure qui se heurte à ces conditions - une lecture modélisée, pas une probabilité calibrée. Une lecture bearish-fade signifie que les *trois* conditions ci-dessus s'accumulent du côté du fade.

Un exemple concret. SPY est à 583,20 et ZeroGEX affiche :

- **Gamma Flip :** 582,50 (le spot est en territoire long-gamma)
- **Net GEX :** +1,4 milliard de dollars, stable pendant la matinée
- **Call Wall :** 584,00 (le niveau que le prix essaie de franchir)
- **Migration du wall :** plate durant la dernière heure

Le Net GEX est ici une estimation modélisée de la gamma des dealers, calculée selon la convention traditionnelle d'open interest call-positif / put-négatif, et non un inventaire observé des dealers. Une poussée jusqu'à 584,10 se produit sur un pic de volume. La lecture structurelle : régime long-gamma, Net GEX sain, le wall n'a pas bougé, et le prix vient tout juste de le percer. Sur le plan du mécanisme, chaque condition s'aligne du côté du fade. Ce que disent nos mesures, c'est que ces conditions ne permettaient pas de prédire quels walls allaient céder ; elles ne font donc pas pencher les probabilités dans le sens que suggère ce setup : le fade est un pari sur le mécanisme, pas un avantage mesuré.

Si un véritable catalyseur survient, le hedging peut être purement et simplement submergé. La lecture structurelle n'est pas une prévision : elle décrit le mécanisme, et le taux de base de l'indice est la seule probabilité que nous ayons mesurée.

---

## Erreurs de lecture courantes

Trois pièges :

- **"Le volume sur la cassure la confirme."** Le volume sur un breakout ne vous dit pas qui achète ni pourquoi. Le dealer qui absorbe le mouvement génère lui aussi du volume. Le volume seul n'est pas une lecture directionnelle.
- **"La cassure a tenu dix minutes, elle est réelle."** Les breakouts ratés tiennent souvent les dix ou quinze premières minutes avant de se défaire. Le retournement se produit lentement au début. Traiter la tenue initiale comme une confirmation est exactement la façon dont les poursuivants se font piéger.
- **"C'est déjà cassé ; le trade est de poursuivre."** Poursuivre le mouvement suppose que la cassure va durer. Selon toute définition rigoureuse, une première cotation au-delà d'un wall n'est pas encore une cassure - notre étude sur les walls exigeait dix minutes d'affilée au-delà du niveau, parce que les breakouts ratés percent couramment le niveau avant de se défaire. Traiter chaque cassure comme un setup de continuation, c'est l'ignorer.

---

## À retenir

> Les breakouts ratés ont une cause structurelle : le hedging des dealers sur des strikes concentrés, qui s'oppose au mouvement dans un régime long-gamma. La fréquence à laquelle ce hedging l'emporte relève d'un taux de base, pas d'une lecture : selon nos mesures, les walls du S&P ont tenu environ deux fois sur trois dans l'heure, ceux du Nasdaq environ une fois sur deux, et ni le régime, ni le Net GEX, ni la migration du wall n'y ont rien changé.

La discipline consiste à vérifier le régime avant de vous lancer dans la poursuite, et à savoir ce qu'il vous dit : si le hedging s'oppose à la cassure ou la renforce. Il ne vous dit pas si cette cassure va durer ; le taux de base de l'indice est la seule réponse mesurée à cette question.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous voulez voir le gamma flip du jour, le Net GEX et le positionnement du wall avant votre prochain trade de breakout, les pages gratuites gamma-levels de ZeroGEX affichent les trois pour SPY, SPX, QQQ et NDX, avec un décalage d'environ 15 minutes.
