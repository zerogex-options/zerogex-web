# Options SPY vs SPX : Quels Niveaux de Gamma Comptent ?

*SPY et SPX suivent le même indice à travers deux contrats différents — et deux carnets de gamma des dealers distincts. Voici en quoi leurs niveaux de gamma diffèrent, comment convertir un niveau de l'un à l'autre, quel carnet pèse le plus, et pourquoi le niveau qui compte le plus est celui sur lequel les deux s'accordent.*

---

## La réponse courte

Si vous tradez le SPX, lisez les niveaux de gamma du SPX. Si vous tradez le SPY, lisez les niveaux de gamma du SPY. Mais comme les deux contrats couvrent le **même** indice sous-jacent à partir de pools d'open interest **distincts**, la lecture la plus précise consiste à observer les deux — et à considérer les niveaux où ils convergent comme les plus susceptibles de tenir.

Le reste de cet article explique pourquoi les deux carnets diffèrent, comment convertir un niveau entre eux, et lequel mérite le plus de poids en cas de désaccord.

---

## Même indice, deux contrats différents

Le SPX et le SPY suivent tous deux le S&P 500. Ce qui diffère, c'est le *contrat* qui l'enveloppe — et ces différences façonnent la manière dont les dealers couvrent chacun d'eux.

| Caractéristique | SPX | SPY |
|---|---|---|
| Ce que c'est | Options sur **indice** S&P 500 | Options sur **ETF** S&P 500 |
| Échelle de prix | Le niveau de l'indice (ex. 6000) | ~1/10 de l'indice (ex. 600) |
| Règlement | Réglé en espèces | Réglé physiquement (actions) |
| Style d'exercice | Européen — pas d'exercice anticipé | Américain — risque d'exercice anticipé |
| Notionnel du contrat | ~$100 × niveau de l'indice (≈10× SPY) | ~$100 × prix de l'ETF |
| Espacement des strikes | Plus large (généralement 5 points) | Plus fin ($1, parfois $0,50) |
| Dividendes et fiscalité | Pas de dividende ; traitement Section 1256 | Verse des dividendes ; traitement option sur action |
| Public typique | Institutionnels, desks indice et 0DTE | Retail plus institutionnels, hedgers d'actions |

La ligne la plus importante pour le gamma est le **notionnel du contrat**. Un contrat SPX contrôle environ dix fois l'exposition en dollars d'un contrat SPY, donc la couverture des dealers sur le SPX déplace bien plus de delta équivalent-indice par contrat. Cela compte pour la suite.

---

## Pourquoi SPY et SPX ont des carnets de gamma distincts

L'exposition gamma est calculée à partir de l'open interest d'une chaîne d'options — strike par strike, échéance par échéance. SPX et SPY sont des chaînes différentes avec un open interest différent, donc chacune produit son **propre** [profil de gamma](/education/gamma-exposure-explained) : son propre [gamma flip](/education/how-to-read-a-gamma-flip), son propre [call wall et put wall](/education/gamma-walls-explained), son propre net GEX.

Comme les deux chaînes se réfèrent au même indice, ces niveaux pointent généralement vers le même endroit en termes de S&P. Mais ils sont construits par des publics différents — le SPX penche vers les institutionnels et l'indice/0DTE, le SPY porte un flux retail et de couverture d'actions important — donc les deux carnets peuvent pondérer les strikes différemment et diverger en marge. Quand ils divergent, c'est une information, pas du bruit.

---

## Convertir un niveau de l'un à l'autre

Le SPY se traite à environ un dixième de l'indice S&P 500, donc en première approximation :

> Niveau SPY ≈ Niveau SPX ÷ 10 — SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Deux réserves empêchent cette correspondance d'être exacte :

- **Dérive de suivi.** Le prix du SPY reflète les dividendes accumulés et de petites différences de suivi, donc le ratio n'est jamais un 10,000 parfait. Convertissez pour vous orienter, pas au centime près.
- **Granularité des strikes.** Les strikes du SPX sont espacés plus largement (généralement cinq points d'indice) tandis que le SPY liste chaque dollar. Un wall du SPX tombe sur un nombre d'indice rond ; le wall SPY correspondant peut se situer à une résolution plus fine — le SPY montre souvent *où à l'intérieur* d'un bucket de cinq points du SPX le gamma se concentre réellement.

---

## Quel carnet pèse le plus ?

Pour la *véritable* pression de couverture des dealers sur le S&P, le SPX est généralement la carte principale. Trois raisons :

1. **Notionnel.** Environ 10 fois le delta en dollars par contrat signifie que les flux de couverture du SPX dominent le gamma au niveau de l'indice, celui qui déplace réellement l'indice cash et le /ES.
2. **Profondeur 0DTE.** Le SPX liste une échéance chaque jour de bourse et constitue le marché d'options sur indice le plus profond qui soit ; le [positionnement des dealers](/education/0dte-dealer-positioning-explained) du jour même, qui pilote la volatilité intrajournalière, s'y manifeste en premier.
3. **Mécanique plus propre.** Le règlement en espèces et l'exercice européen signifient l'absence de course à l'exercice anticipé qui viendrait distordre le carnet à l'approche de l'échéance.

Le SPY mérite sa place en tant que couche de **granularité et de confirmation** : strikes plus fins, énorme liquidité sur les actions, et le flux retail et de hedgers qui produit le [pinning spécifique au SPY](/education/why-spy-pins-near-strikes). Et lorsque vous tradez le SPY lui-même, ce sont ses propres walls auxquels votre instrument réagira réellement.

---

## Quels niveaux comptent pour votre trade ?

Faites correspondre la carte à l'instrument que vous tradez réellement :

- **SPX, /ES, ou SPX 0DTE** → les niveaux de gamma du SPX sont votre carte.
- **Actions SPY ou options SPY** → niveaux de gamma du SPY — les walls et le pin propres à votre instrument.
- **QQQ** → niveaux QQQ (voir ci-dessous).

Cherchez ensuite la **confluence**. Quand le call wall du SPX à 6000 s'aligne avec le call wall du SPY à 600, ce niveau partagé est plus solide que chacun pris isolément — deux carnets de dealers distincts s'appuyant sur le même prix. Quand ils *ne sont pas d'accord*, considérez les deux comme plus fragiles et laissez le prix vous indiquer quel carnet a le contrôle.

> Le niveau basé sur les options le plus solide n'est pas le plus grand wall sur un seul graphique. C'est le niveau sur lequel le SPX et le SPY s'accordent.

---

## QQQ et NDX : la même logique sur le Nasdaq

Le Nasdaq-100 présente la même scission : **QQQ** est l'ETF, **NDX** est l'indice cash, et chacun porte son propre carnet de gamma à une échelle de prix différente. Si vous tradez le QQQ, lisez les [niveaux de gamma QQQ](/qqq-gamma-levels) ; si vous tradez le NDX ou le /NQ, le carnet de l'indice est votre référence. L'idée de confluence s'applique aussi ici — les walls du QQQ qui concordent avec le carnet NDX sont ceux qu'il vaut la peine de respecter.

---

## Les lire côte à côte sur ZeroGEX

Les pages gratuites de niveaux de gamma de ZeroGEX publient les trois carnets côte à côte afin que l'accord soit évident d'un coup d'œil :

- [Niveaux de gamma SPX](/spx-gamma-levels) — le carnet de l'indice, la carte principale du S&P.
- [Niveaux de gamma SPY](/spy-gamma-levels) — le carnet de l'ETF, strikes plus fins et détail du pinning.
- [Niveaux de gamma QQQ](/qqq-gamma-levels) — la lecture du Nasdaq-100.

Chaque page débute par le gamma flip, le call wall, le put wall, le max pain et le net dealer GEX de son propre ticker, puis affiche les deux autres pour recoupement. Pour comprendre la mécanique derrière ces niveaux, commencez par [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained), puis [Gamma Walls Explained](/education/gamma-walls-explained) et [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## En résumé

Le SPY et le SPX suivent un même indice à travers deux contrats et deux carnets de gamma des dealers distincts. Tradez les niveaux propres à votre instrument, utilisez le ratio de ~10× pour convertir entre eux, appuyez-vous sur le SPX comme carte principale au niveau de l'indice et sur le SPY pour la granularité et le pinning — et accordez le plus grand respect aux niveaux sur lesquels les deux s'accordent.

*Il s'agit d'analyses dérivées à des fins éducatives, et non d'un conseil en investissement. Le trading d'options comporte des risques significatifs.*
