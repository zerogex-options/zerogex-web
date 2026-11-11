# Options SPY vs SPX : Quels Niveaux de Gamma Comptent ?

*SPY et SPX suivent le même indice à travers deux contrats différents - et deux carnets de gamma des dealers distincts. Voici en quoi leurs niveaux de gamma diffèrent, comment convertir un niveau de l'un à l'autre, quel carnet tend à peser le plus, et pourquoi les niveaux sur lesquels les deux s'accordent peuvent compter le plus.*

---

## La réponse courte

Si vous tradez le SPX, lisez les niveaux de gamma du SPX. Si vous tradez le SPY, lisez les niveaux de gamma du SPY. Mais comme les deux contrats suivent le **même** indice sous-jacent tout en portant des pools d'open interest **distincts**, observer les deux peut apporter un contexte supplémentaire. ZeroGEX n'a pas établi qu'un accord entre les deux garantisse une plus grande fiabilité.

Le reste de cet article explique pourquoi les deux carnets diffèrent, comment convertir un niveau entre eux, et lequel mérite le plus de poids en cas de désaccord.

---

## Même indice, deux contrats différents

Le SPX et le SPY suivent tous deux le S&P 500. Ce qui diffère, c'est le *contrat* qui l'enveloppe - et ces différences façonnent la manière dont les dealers couvrent chacun d'eux.

| Caractéristique | SPX | SPY |
|---|---|---|
| Ce que c'est | Options sur **indice** S&P 500 | Options sur **ETF** S&P 500 |
| Échelle de prix | Le niveau de l'indice (ex. 6000) | ~1/10 de l'indice (ex. 600) |
| Règlement | Réglé en espèces | Réglé physiquement (actions) |
| Style d'exercice | Européen - pas d'exercice anticipé | Américain - risque d'exercice anticipé |
| Notionnel du contrat | ~100 $ × niveau de l'indice (≈10× SPY) | ~100 $ × prix de l'ETF |
| Espacement des strikes | Plus large (généralement 5 points) | Plus fin (1 $, parfois 0,50 $) |
| Dividendes et fiscalité | Pas de dividende ; traitement Section 1256 | Verse des dividendes ; traitement option sur action |
| Public typique | Institutionnels, desks indice et 0DTE | Investisseurs particuliers et institutionnels, hedgers d'actions |

La ligne la plus importante pour le gamma est le **notionnel du contrat**. Un contrat SPX contrôle environ dix fois l'exposition en dollars d'un contrat SPY, donc la couverture des dealers sur le SPX déplace bien plus de delta équivalent-indice par contrat. Cela compte pour la suite.

---

## Pourquoi SPY et SPX ont des carnets de gamma distincts

L'exposition gamma est calculée à partir de l'open interest d'une chaîne d'options - strike par strike, échéance par échéance - puis se voit attribuer un signe de dealer par convention. SPX et SPY sont des chaînes différentes avec un open interest différent, donc chacune produit son **propre** [profil de gamma](/education/gamma-exposure-explained) : son propre [gamma flip](/education/how-to-read-a-gamma-flip), son propre [call wall et put wall](/education/gamma-walls-explained), son propre net GEX.

Une précision de cadrage sur l'ensemble de ces éléments : le net GEX et le « carnet de gamma des dealers » sont des estimations *modélisées* - des magnitudes de gamma tirées de la chaîne publique, signées selon la convention traditionnelle calls positifs / puts négatifs. L'inventaire réel des dealers n'est pas directement observable à partir des données de la chaîne d'options ; considérez donc les deux carnets comme des modèles de positionnement plutôt que comme un registre de ce que les dealers détiennent réellement.

Comme les deux chaînes portent sur le même indice, ces niveaux pointent en général au même endroit en termes de S&P. Mais elles sont construites par des publics différents - le SPX penche vers l'institutionnel et l'indice/0DTE, le SPY porte une part plus lourde d'investisseurs particuliers et de flux de couverture sur actions - si bien que les deux carnets peuvent pondérer les strikes différemment et s'écarter à la marge. Quand ils divergent, cela peut être une information plutôt qu'un bruit.

---

## Convertir un niveau de l'un à l'autre

Le SPY se traite à environ un dixième de l'indice S&P 500, donc en première approximation :

> Niveau SPY ≈ Niveau SPX ÷ 10 - SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Deux réserves empêchent cette correspondance d'être exacte :

- **Dérive de suivi.** Le prix du SPY reflète les dividendes accumulés et de petites différences de suivi, donc le ratio n'est jamais un 10,000 parfait. Convertissez pour vous orienter, pas au centime près.
- **Granularité des strikes.** En dollars bruts, le SPY liste des strikes plus fins (1 $, parfois 0,50 $) que l'espacement de cinq points du SPX - mais appliquez l'échelle de ~10× : un dollar de SPY vaut dix points d'indice, de sorte que les strikes à 1 $ du SPY sont en réalité *plus grossiers* que les strikes de cinq points du SPX en termes d'indice, et ses strikes à 0,50 $ ne font que les égaler. En termes d'indice, le SPX résout le gamma au moins aussi finement que le SPY ; le véritable atout du SPY réside dans ses strikes à dollar rond, qui peuvent attirer le pinning, et dans sa liquidité sur les actions, non dans une résolution d'indice plus fine.

---

## Quel carnet pèse le plus ?

Pour la pression de couverture agrégée des dealers sur le S&P, le SPX est généralement la carte principale. Trois raisons :

1. **Notionnel.** Environ 10× le delta en dollars par contrat signifie que les flux de couverture du SPX tendent à dominer le gamma au niveau de l'indice, celui qui influence le plus l'indice cash et le /ES.
2. **Profondeur 0DTE.** Le SPX liste une échéance chaque jour de bourse et constitue le marché d'options sur indice le plus profond qui soit ; le [positionnement des dealers](/education/0dte-dealer-positioning-explained) du jour même, qui peut piloter la volatilité intrajournalière, tend à s'y manifester en premier.
3. **Mécanique plus propre.** Le règlement en espèces et l'exercice européen signifient l'absence de course à l'exercice anticipé qui viendrait distordre le carnet à l'approche de l'échéance.

Le SPY mérite sa place en tant que couche de **granularité et de confirmation** : strikes plus fins, énorme liquidité sur les actions, et le flux des investisseurs particuliers et des hedgers qui peut produire le [pinning spécifique au SPY](/education/why-spy-pins-near-strikes). Et lorsque vous tradez le SPY lui-même, ses propres walls sont les niveaux auxquels votre instrument est le plus susceptible de réagir.

---

## Quels niveaux comptent pour votre trade ?

Faites correspondre la carte à l'instrument que vous tradez réellement :

- **SPX, /ES, ou SPX 0DTE** → les niveaux de gamma du SPX sont votre carte.
- **Actions SPY ou options SPY** → niveaux de gamma du SPY - les walls et le pin propres à votre instrument.
- **QQQ** → niveaux QQQ (voir ci-dessous).

Cherchez ensuite la **confluence**. Quand un niveau du SPX s'aligne sur le niveau converti du SPY, ZeroGEX traite cet accord comme une confluence contextuelle entre deux carnets modélisés distincts. C'est une heuristique maison, pas la preuve que le niveau partagé a un taux de réussite plus élevé. Quand ils ne s'accordent pas, conservez les deux comme des références distinctes plutôt que de supposer que l'un ou l'autre carnet contrôle le prix.

> Un niveau sur lequel le SPX et le SPY s'accordent peut compter davantage que le plus grand wall de l'un ou l'autre graphique pris isolément.

---

## QQQ et NDX : la même logique sur le Nasdaq

Le Nasdaq-100 présente la même scission : **QQQ** est l'ETF, **NDX** est l'indice cash, et chacun porte son propre carnet de gamma à une échelle de prix différente. Si vous tradez le QQQ, lisez les [niveaux de gamma QQQ](/qqq-gamma-levels) ; si vous tradez le NDX ou le /NQ, le carnet de l'indice est votre référence. La même comparaison peut apporter du contexte pour QQQ et NDX, sans garantir que la confluence améliore la fiabilité.

---

## Les lire côte à côte sur ZeroGEX

Les pages gratuites de niveaux de gamma de ZeroGEX publient les trois carnets côte à côte afin que l'accord soit évident d'un coup d'œil :

- [Niveaux de gamma SPX](/spx-gamma-levels) - le carnet de l'indice, la carte principale du S&P.
- [Niveaux de gamma SPY](/spy-gamma-levels) - le carnet de l'ETF, strikes plus fins et détail du pinning.
- [Niveaux de gamma QQQ](/qqq-gamma-levels) - la lecture du Nasdaq-100.

Chaque page débute par le gamma flip, le call wall, le put wall, le max pain et le net dealer GEX de son propre ticker, puis affiche les deux autres pour recoupement. Pour comprendre la mécanique derrière ces niveaux, commencez par [Gamma Exposure (GEX) expliqué](/education/gamma-exposure-explained), puis [Les gamma walls expliqués](/education/gamma-walls-explained) et [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip)

---

## En résumé

Le SPY et le SPX suivent un même indice à travers deux contrats et deux carnets de gamma des dealers distincts. Tradez les niveaux propres à votre instrument, utilisez le ratio de ~10× pour convertir entre eux, appuyez-vous sur le SPX comme la carte qui pèse le plus au niveau de l'indice et sur le SPY pour le pinning sur les nombres ronds et la liquidité sur les actions - et accordez un poids supplémentaire aux niveaux sur lesquels les deux s'accordent.

*Il s'agit d'analyses dérivées à des fins éducatives, et non d'un conseil en investissement. Le trading d'options comporte des risques significatifs.*
