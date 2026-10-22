# Utiliser le Gamma Terminal

*Un guide de chaque panneau, contrôle et superposition du Gamma Terminal : ce que chacun affiche, comment le lire et ce qu'il ne peut pas te dire.*

---

## À quoi sert le Gamma Terminal

Le [Gamma Terminal](/chart) réunit le prix et le gamma modélisé des dealers sur un seul écran. Les bougies montrent ce que fait le prix. Les lignes, les ombrages et les panneaux qui les entourent montrent où le hedging des dealers d'options est, selon le modèle, le plus lourd, et si ce hedging amortit les mouvements ou les renforce en ce moment.

Chaque chiffre de gamma de la page est une estimation. Les données d'options publiques indiquent combien de contrats sont ouverts à chaque strike, mais pas qui les détient : ZeroGEX applique donc la convention standard selon laquelle les dealers sont nets longs sur les calls et nets courts sur les puts. Prends les niveaux comme un contexte pour tes propres décisions, pas comme un carnet d'ordres mesuré ni comme un objectif de prix. La page [Méthodologie](/methodology) explique le modèle.

De haut en bas, la page comporte :

1. **Key Levels** - les six chiffres qui comptent le plus, avec leur écart par rapport au prix.
2. **About this terminal** - une courte description, repliée pour les membres.
3. **Beside the tape** - un sélecteur pour le panneau situé à côté du graphique : **Gamma Ladders** ou **Strike Panel**.
4. **Le Gamma Chart** - les bougies, avec les niveaux de gamma et les superpositions tracés dessus, et le panneau que tu as choisi à sa droite (en dessous sur les écrans plus étroits).
5. **What you're looking at** - six cartes qui résument les principales fonctionnalités.
6. **Playbook** - ce qu'implique le régime actuel quand le prix approche d'un wall.

Les membres Basic et Pro ont le terminal en direct. Tous les autres voient un aperçu gratuit de SPY, différé d'environ 15 minutes ; voir [Aperçu gratuit vs accès en direct](/help/platform/gamma-terminal#apercu-gratuit-vs-acces-en-direct).

## Tes cinq premières minutes

1. **Choisis un sous-jacent.** Utilise les boutons de symbole du graphique, le menu déroulant de la première échelle ou les flèches du bandeau Key Levels. Chacun change toute la page.
2. **Lis le régime.** L'encadré **Dealer Gamma @ Spot**, en haut à droite du graphique, affiche **LONG Γ** ou **SHORT Γ**. En long gamma, le hedging modélisé des dealers s'oppose aux mouvements (pinning). En short gamma, il les renforce (tendance). Le fond teinté du graphique dit la même chose.
3. **Repère les lignes clés.** La ligne azur `FLIP` marque l'endroit où le régime change. Le `CALL WALL` rouge au-dessus du prix et le `PUT WALL` vert en dessous sont les strikes qui portent le plus de gamma call et de gamma put. Les cartes Key Levels donnent l'écart exact jusqu'à chacun.
4. **Regarde à côté du graphique.** Les échelles listent le gamma net des dealers à chaque strike proche du prix, alignées sur le graphique. Les plus grandes valeurs correspondent aux strikes qui concentrent le plus de hedging.
5. **Ajoute ce dont tu as besoin.** Active **Expected Range** pour le mouvement anticipé par la volatilité implicite, **Centroids** pour voir où est centré le trading d'options du jour, ou **PD/PM Levels** pour le plus haut, le plus bas et la clôture de la veille.
6. Utilise **Rewind** pour rejouer l'évolution du prix et du carnet de gamma au fil de la séance.

## Le bandeau Key Levels

Le bandeau en haut de la page affiche les six niveaux que trace le graphique, pour le symbole et le filtre d'expiration du graphique.

- **Spot** - le prix actuel et sa variation depuis la clôture précédente.
- **Gamma Flip** - le prix où le gamma net modélisé des dealers change de signe.
- **Pin Strike** - le strike proche, sur l'expiration du jour (0DTE), vers lequel le gamma modélisé des dealers attire le prix le plus fortement d'ici la clôture, avec un label de force.
- **Call Wall** - le strike situé au niveau du prix ou au-dessus avec le plus fort gamma call.
- **Put Wall** - le strike situé au niveau du prix ou en dessous avec le plus fort gamma put.
- **Max Pain** - le strike où les détenteurs d'options toucheraient le moins à l'expiration.

Chaque carte affiche le niveau et son écart par rapport au prix, en dollars et en pourcentage, avec une flèche verte quand le niveau est au-dessus du prix et une flèche rouge quand il est en dessous. Survole une carte pour lire sa définition complète. L'en-tête indique les expirations dont proviennent les niveaux et porte un chip **LONG Γ** ou **SHORT Γ**.

Quand une carte affiche un tiret au lieu d'un chiffre, la note en dessous en donne la raison :

- **Unresolved this snapshot** - le modèle n'a renvoyé aucun niveau cette fois-ci, généralement parce que la chaîne d'options était mince. Survole le **?** ambre pour les détails. Le niveau revient normalement lors d'une mise à jour ultérieure.
- **No flip in selected expiries** - les expirations que tu as choisies ne changent jamais de signe. Voir [Le filtre Expiry](/help/platform/gamma-terminal#le-filtre-expiry).
- **No active pin** - aucun strike proche, sur l'expiration du jour, ne remplit en ce moment les conditions d'un pin.

Les membres disposent ici de trois fonctions supplémentaires. Sur ordinateur, survole le bandeau pour faire apparaître des flèches qui passent d'un symbole à l'autre ; sur téléphone, balaie-le du doigt. Toute la page suit. La cloche des cartes Call Wall et Put Wall crée une [alerte](/help/platform/alerts) qui se déclenche quand le prix atteint ce wall. Enfin, la carte Pin Strike indique depuis combien de temps le pin actuel tient, comme dans "Held since 09:41".

## Les Gamma Ladders et le Strike Panel

Le panneau à côté du graphique présente le carnet de gamma des dealers par strike sous l'une de deux formes. Choisis-en une avec le sélecteur **Gamma Ladders** / **Strike Panel** au-dessus du graphique. Le graphique lui-même reste identique dans les deux cas, et ton choix est mémorisé.

### Gamma Ladders

Deux échelles côte à côte. Chaque ligne est un strike, le plus haut en tête, et son chiffre est le **gamma net des dealers** à ce strike. Par défaut, il est exprimé en dollars pour un mouvement de 1 % : à peu près le montant d'actions que les dealers devraient traiter à ce strike pour rester couverts si le prix bougeait de 1 %.

- Les **lignes orange** sont long gamma (positives) et les **lignes bleu marine** short gamma (négatives). Plus la couleur est soutenue, plus le chiffre est grand.
- La ligne dont le strike apparaît dans une pastille en surbrillance est le strike le plus proche du prix. Sur les grands écrans, elle se trouve à la même hauteur que le prix sur le graphique.
- Les étiquettes `GF`, `CW`, `PW` et `MP` marquent le Gamma Flip, le Call Wall, le Put Wall et le Max Pain sur la ligne la plus proche. L'en-tête donne leurs valeurs, ou `NA` quand un niveau n'est pas disponible.
- La **couronne** marque le strike le plus chargé visible dans cette échelle. Ce n'est pas le GEX King du graphique, qui est le strike le plus chargé de toute la chaîne.
- Le chip **LONG Γ** / **SHORT Γ** de chaque en-tête compare le prix au flip de ce symbole.

La première échelle correspond au symbole du graphique. La seconde sert à comparer n'importe quel autre symbole et s'ouvre sur le carnet correspondant : SPY avec SPX, QQQ avec NDX, ES avec SPX, NQ avec NDX et NVDA avec QQQ. [Niveaux de gamma SPY vs SPX](/education/spy-vs-spx-gamma-levels) explique pourquoi deux carnets sur le même indice se lisent différemment.

Les contrôles en haut du panneau :

- **Strikes: Active / All** - **Active** (par défaut) masque les strikes sans open interest. **All** affiche tous les strikes listés proches du prix.
- **Session Δ: On / Off** - marque chaque strike d'un ▲ vert là où le gamma des dealers s'est accru depuis l'ouverture de 9h30 ET, ou d'un ▼ rouge là où il s'est érodé. Les petites variations ne sont pas marquées. En direct uniquement.
- **Unit: 1% / 1pt** - affiche le gamma pour un mouvement de 1 % (par défaut) ou pour un mouvement d'un point. Même exposition, unité différente. Ce réglage s'applique à tout le site.

Une note ambre "Positioning as of 15:55 ET" signifie que les dernières mises à jour ne contenaient aucun positionnement (après la clôture des options, par exemple) : l'échelle affiche donc la plus récente qui en contenait. Les niveaux de son en-tête restent en direct.

### Strike Panel

Le même carnet, en image : le gamma net des dealers à chaque prix. Sur les grands écrans, il est tracé sur l'échelle de prix du graphique lui-même, de sorte que chaque strike se trouve à la hauteur de ce prix sur les bougies.

Il existe quatre vues, à choisir en haut du panneau :

- **Silhouette** (par défaut) - une courbe lissée. Le lobe vert à droite représente le long gamma, le lobe rouge à gauche le short gamma, et des points marquent le plus grand pic de chaque côté.
- **Net** - une barre par strike : verte vers la droite pour le long gamma, rouge vers la gauche pour le short.
- **Split** - calls et puts séparés : une barre call verte à droite et une barre put rouge à gauche.
- **Combined** - les barres de Split, plus une barre violette pour le net.

Un axe fin le long du bord gauche du panneau étiquette les strikes. Quand ils sont trop rapprochés pour être tous étiquetés, il n'en étiquette qu'un sur 2, 5 ou 10, et le strike sous ton pointeur est toujours étiqueté.

En Split et Combined, chaque barre est nuancée par expiration : la plus marquée contre la ligne centrale pour l'expiration la plus proche, la plus pâle à l'extrémité pour la plus lointaine. **Labels** affiche les montants en dollars sur les barres. Ils disparaissent quand les strikes sont trop serrés : zoome alors sur l'axe des prix pour les faire réapparaître. Une ligne azur en tirets marque le flip.

Survole un strike, ou touche-le sur téléphone, pour afficher sa carte : gamma call, put et net, open interest et ratio put/call, son poids par rapport au strike le plus chargé affiché, son écart par rapport au prix et tout niveau qui s'y trouve. "Long Γ · magnet / brake" et "Short Γ · accelerant" décrivent ce que fait, selon le modèle, le hedging des dealers à ce strike : s'opposer aux mouvements, ou les renforcer.

L'aperçu gratuit n'affiche que la vue Silhouette.

## L'en-tête du graphique

- **Badge de séance** - **● LIVE** pendant la séance régulière, **○ PRE-MARKET** et **○ AFTER HOURS** hors séance, **CLOSED** quand le marché est fermé, **◀ REWIND** pendant une relecture, et **◷ DELAYED ~15 MIN** sur l'aperçu gratuit. **◆ FUTURES** apparaît sur un indice cash en dehors des heures régulières, quand le prix affiché en tête est celui du contrat future ; les bougies restent celles de l'indice.
- **Prix et variation** - la variation est calculée depuis la clôture de la séance régulière précédente. En dehors des heures régulières, le prix affiché en tête reste sur la clôture de 16h00, et SPY, QQQ et NVDA ajoutent une seconde ligne avec le prix hors séance.
- **Updated** - le moment où le dernier tick de prix est arrivé.
- **Dealer Gamma @ Spot** - **LONG Γ** ou **SHORT Γ**, et le gamma net des dealers au prix actuel, en dollars, par exemple +$1.23B. C'est cet encadré qui donne la lecture du régime pour toute la page. Quand un filtre Expiry est actif, il affiche le chiffre propre aux expirations sélectionnées et les nomme.
- **Sur ES et NQ** - un chip **IMPLIED FROM SPX** (ou **NDX**) et le code du contrat future. Voir [ES et NQ](/help/platform/gamma-terminal#es-et-nq).

## La barre d'outils

- **Symbole** - SPY, QQQ, SPX, NDX, ES, NQ et NVDA. Changer de symbole réinitialise le zoom, met fin au Rewind et remet le filtre Expiry sur All, sauf s'il est sur 0DTE.
- **Timeframe** - barres **1M**, **5M**, **15M**, **1H** ou **1D**. Le graphique s'ouvre en 5M à chaque visite.
- **Style** - **Candle**, **Line** ou **Area**. Une bougie est verte quand sa clôture est au niveau de la clôture précédente ou au-dessus, et rouge quand elle est en dessous. Elle est creuse quand sa clôture est au niveau de sa propre ouverture ou au-dessus.
- **VOL** - l'œil affiche ou masque le volet de volume. Voir [Le volet de volume](/help/platform/gamma-terminal#le-volet-de-volume).
- **Pastilles de superposition** - une par superposition. Voir [Les superpositions](/help/platform/gamma-terminal#les-superpositions). Sur téléphone, les contrôles des superpositions, du style, du volume et d'Expiry se trouvent sous **Layers**, qui indique combien de superpositions sont activées.
- **Expiry** - les expirations qui alimentent les niveaux de gamma. Voir [Le filtre Expiry](/help/platform/gamma-terminal#le-filtre-expiry).
- **Reset** - apparaît dès que tu as zoomé ou déplacé le graphique, et ramène à la vue en direct.
- **Save** - télécharge le graphique en image PNG : les bougies, les lignes, les étiquettes et les axes, sans la barre d'outils, la légende ni le panneau à côté du graphique.

## Les superpositions

Chaque superposition a sa pastille dans la barre d'outils. Clique dessus pour activer ou désactiver la superposition ; le graphique mémorise tes choix. La légende sous le graphique est une clé de couleurs, pas un interrupteur.

| Superposition | Ce qu'elle trace | Activée par défaut | Où elle fonctionne |
|---|---|---|---|
| Gamma Levels | Les lignes du Gamma Flip, du Call Wall et du Put Wall | Oui | Partout |
| Regime | L'ombrage de fond long gamma et short gamma | Oui | Partout |
| Ribbons | Le gamma de chaque strike dans le temps, derrière les bougies | Oui | En direct |
| VWAP | Le prix moyen pondéré par les volumes de la séance | Oui | Partout |
| Max Pain | Le strike de max pain | Oui | Partout |
| Pin Strike | Le pin strike du jour et sa force | Oui | En direct |
| GEX King | Le strike le plus chargé en gamma de toute la chaîne | Non | En direct |
| PD/PM Levels | Le plus haut, le plus bas et la clôture de la veille ; le plus haut et le plus bas du pre-market | Non | En direct : SPY, QQQ, NVDA |
| Expected Range | Le mouvement à ±1σ anticipé par la volatilité implicite | Non | En direct, sauf NVDA |
| Centroids | Là où est centré le trading de calls et de puts du jour | Non | En direct, barres de 1M à 1H |
| Bar Timer | Le temps restant dans la bougie en cours | Non | En direct |

Quelques règles valent pour toutes les lignes de niveau :

- Chaque niveau est une ligne en tirets qui traverse le graphique, avec son nom dans un chip au bord gauche et son prix dans une étiquette sur l'axe de droite.
- Un niveau situé hors de la plage de prix affichée apparaît sous forme d'étiquette épinglée en haut ou en bas de l'axe, marquée ▲ ou ▼. Dézoome l'axe des prix pour voir la ligne elle-même.
- Le flip, les walls et le VWAP élargissent l'axe des prix pour rester visibles quand ils sont raisonnablement proches du prix, tout comme les lignes PD/PM et Centroids tant qu'elles sont activées. Max Pain, Pin Strike, GEX King et les lignes d'Expected Range ne le font jamais : on ne les voit donc souvent que sous forme d'étiquettes fléchées.
- Quand le prix se trouve à moins d'environ 0,12 % d'un niveau, la ligne de ce niveau est tracée plus épaisse.

### Gamma Levels

Trois lignes :

- **Gamma Flip** (`FLIP`, azur, tirets longs) - le prix où le gamma net modélisé des dealers change de signe.
- **Call Wall** (`CALL WALL`, rouge, tirets courts) - le strike situé au niveau du prix ou au-dessus avec la plus forte exposition gamma call.
- **Put Wall** (`PUT WALL`, vert, tirets courts) - le strike situé au niveau du prix ou en dessous avec la plus forte exposition gamma put.

Les walls sont colorés selon ce qu'ils font, pas selon calls et puts. Le wall rouge au-dessus est l'endroit où, selon le modèle, les ventes des dealers s'opposent à une hausse ; le wall vert en dessous, celui où leurs achats s'opposent à une vague de ventes.

**Comment les lire.** Au-dessus du flip, le modèle place les dealers en long gamma : leur hedging vend les hausses et achète les replis, ce qui amortit les mouvements. En dessous, il les place en short gamma : leur hedging court après le mouvement, ce qui l'amplifie. Plus le prix est proche du flip, plus le marché est proche d'un changement de régime.

Les walls sont là où se concentre le plus de hedging. Ils agissent souvent comme résistance et support : dans notre étude portant sur 737 tests de walls, les walls du S&P ont tenu environ deux fois sur trois dans l'heure et ceux du Nasdaq environ une fois sur deux, quel que soit le côté du gamma flip où se trouvait le prix. Considère un wall comme un endroit à surveiller, pas comme un endroit où le prix doit s'arrêter. Voir [À quelle fréquence les gamma walls cèdent-ils vraiment ?](/education/how-often-do-gamma-walls-break) et [Les Gamma Walls expliqués](/education/gamma-walls-explained).

**Comment les walls sont choisis.** Ils ne sautent pas à chaque tick. Un wall est resélectionné dès la minute où le prix le franchit, et sinon toutes les 15 minutes. À chaque resélection, le wall en place garde sa position tant qu'il porte encore au moins les trois quarts du gamma du plus gros strike de son côté.

**Quand la ligne du flip manque**, un chip près du bas du graphique en donne la raison :

- `FLIP ↑ 7,750.00` ou `FLIP ↓ 22,600.00` - le flip est au-dessus ou en dessous des prix affichés. Dézoome l'axe des prix avec **Price −**, Maj + molette, ou en faisant glisser l'échelle de prix de droite.
- `FLIP UNAVAILABLE` - le modèle n'a trouvé aucun passage par zéro auquel il se fie : un passage assez proche du prix pour compter et adossé à un open interest réel. Cela arrive quand le prix est loin à l'intérieur d'un régime ou que la chaîne est mince, par exemple hors séance ou pendant un pic de volatilité. Le problème se résout généralement lors d'une mise à jour ultérieure. Survole le **?** ambre pour les détails.
- `NO FLIP IN SELECTED EXPIRIES` - voir [Le filtre Expiry](/help/platform/gamma-terminal#le-filtre-expiry).

Sans flip, le graphique ne peut pas non plus tracer l'ombrage Regime.

### Regime

**Ce qu'on voit.** Le fond du graphique est teinté en vert du côté long gamma du flip et en rouge du côté short gamma. Sur les écrans plus larges, les teintes portent les libellés `LONG Γ · PINNING` et `SHORT Γ · TRENDING`.

**Comment le lire.** En long gamma, le hedging modélisé des dealers s'oppose aux mouvements, ce qui tend à amortir la volatilité et à ancrer le prix. En short gamma, il renforce les mouvements, ce qui tend à les amplifier. [Que signifie un gamma négatif ?](/education/what-is-negative-gamma) et [Comment trader autour du Gamma Flip](/education/how-to-trade-around-gamma-flip) vont plus loin.

**À garder en tête.**

- La bande qui contient le prix concorde toujours avec l'encadré **Dealer Gamma @ Spot**. En général, cela veut dire long gamma au-dessus du flip et short gamma en dessous, mais sur un carnet irrégulier, l'ombrage peut être inversé. Fie-toi à l'encadré.
- Si tu déplaces ou zoomes le graphique jusqu'à faire sortir le flip de l'écran, toute la vue prend une seule teinte. Elle décrit les prix affichés, qui ne correspondent pas forcément à l'endroit où se trouve le prix actuellement.
- Pas de flip, pas d'ombrage.

### Ribbons

**Ce qu'on voit.** Chaque strike est un couloir qui court derrière les bougies, et chaque barre y dépose un orbe. La taille et l'opacité de l'orbe montrent le gamma net des dealers à ce strike sur la fenêtre de 5 minutes de la barre, par rapport au strike le plus chargé à l'écran. Les orbes **dorés** sont long gamma ; les orbes **violets** sont short gamma.

**Comment le lire.**

- Un couloir épais qui persiste toute la séance est un wall.
- Le doré est un aimant et un frein : selon le modèle, les dealers y vendent la force et y achètent la faiblesse. Le violet est un accélérateur : les dealers y courent après les mouvements.
- Un couloir gonfle quand le prix approche de son strike et s'amincit quand le prix s'en éloigne. C'est le gamma qui culmine à la monnaie, pas de nouvelles positions : l'open interest n'est mis à jour qu'une fois par jour, après la clôture. Un couloir épais juste au niveau du prix indique où le hedging est le plus actif en ce moment.
- Un couloir qui change de couleur est un strike dont les contrats long gamma et short gamma sont proches de l'équilibre.

**Contrôles.** Le curseur **Opacity** à côté de la pastille atténue ou renforce tous les orbes à la fois. Survole un couloir pour voir la valeur exacte du strike. Les orbes inférieurs à 5 % du strike le plus chargé ne sont pas tracés, et la légende sous le graphique comporte une clé.

**À garder en tête.** Les Ribbons ne fonctionnent qu'en direct et sont activés par défaut sur le Gamma Terminal. Ils suivent le filtre Expiry. L'historique couvre les strikes suivis à ce moment-là : les barres plus anciennes sur des strikes éloignés peuvent donc être vides.

### VWAP

**Ce qu'on voit.** Le prix moyen pondéré par les volumes de la séance (`VWAP`, en tirets) : le prix moyen traité aujourd'hui, chaque prix étant pondéré par le volume qui s'y est échangé. Il repart de zéro chaque jour de bourse.

**Comment le lire.** Beaucoup de traders considèrent le VWAP comme la juste valeur du jour. Un prix au-dessus signifie que les acheteurs ont, en moyenne, accepté de payer plus cher ; en dessous, que les vendeurs ont mis la pression. Quand le VWAP coïncide avec un niveau de gamma, voir [Confluence Gamma-VWAP](/education/gamma-vwap-confluence-explained).

**À garder en tête.** SPX et NDX ne se négocient pas directement : leur VWAP applique donc le profil de volume de SPY et de QQQ aux prix de l'indice. Le filtre Expiry ne l'affecte pas.

### Max Pain

**Ce qu'on voit.** Le strike où les détenteurs d'options toucheraient le moins si le sous-jacent était réglé à ce niveau (`MAX PAIN`, doré, en pointillés). Sans filtre Expiry, c'est le max pain de l'expiration la plus proche : celle du jour, quand il y en a une.

**Comment le lire.** Il est surtout pertinent dans les un ou deux derniers jours avant une expiration significative. Le reste du temps, il se trouve souvent loin du prix, et les walls et le flip comptent davantage. Voir [Le Max Pain expliqué](/education/max-pain-explained).

**À garder en tête.** Max Pain n'élargit jamais l'axe des prix : on ne le voit donc souvent que sous forme d'étiquette fléchée. Avec un filtre Expiry, le graphique et la carte Key Levels le recalculent à partir des expirations que tu as choisies ; les échelles affichent `NA` à la place.

### Pin Strike

**Ce qu'on voit.** Le strike proche, sur l'expiration du jour (0DTE), où le gamma positif des dealers et la probabilité que le prix l'atteigne avant la clôture se combinent le plus fortement (turquoise, avec le libellé `PIN · STRONG`, `PIN · MODERATE` ou `PIN · WEAK`).

**Comment le lire.** Le mot de force mesure à quel point le strike retenu se détache de ses voisins, pas l'ampleur de son gamma. **Weak** signifie que l'attraction est répartie sur plusieurs strikes voisins, pas que le niveau est sans importance. C'est un niveau de pinning modélisé, pas un objectif de prix. [Pin Strike](/help/platform/pin-strike) explique comment il est construit.

**À garder en tête.** Aucune ligne n'est tracée quand il n'y a pas de pin actif. Le pin porte par construction sur l'expiration du jour : il ignore donc le filtre Expiry. Il ne fait pas partie de l'aperçu gratuit.

### GEX King

**Ce qu'on voit.** Le strike qui porte le plus fort gamma net des dealers, long ou short, sur toute la chaîne d'options (`GEX KING`, violet). Désactivé par défaut.

**Comment le lire.** Le King est le pendant structurel, lent à bouger, du Pin du jour : le strike qui concentre le plus de hedging, quelle que soit son expiration. Ce peut être un strike short gamma.

**À garder en tête.** Il ignore le filtre Expiry, car le restreindre en ferait une autre mesure. La couronne des échelles marque le strike le plus chargé visible dans l'échelle concernée, qui n'est pas toujours le King. Il ne fait pas partie de l'aperçu gratuit.

### PD/PM Levels

**Ce qu'on voit.** Là où le prix est passé : le plus haut, le plus bas et la clôture de la séance régulière précédente (`PDH`, `PDL`, `PDC`, gris, tirets longs), et le plus haut et le plus bas du pre-market du jour (`PMH`, `PML`, gris, pointillés). Désactivés par défaut.

**Comment le lire.** Ce ne sont pas des niveaux de dealers. Ce sont des prix de référence que beaucoup de traders surveillent, tracés en gris pour ne jamais être confondus avec un niveau de gamma.

**À garder en tête.** Ils ne sont disponibles que sur SPY, QQQ et NVDA. SPX et NDX n'ont pas de pre-market, et ES et NQ se négocient presque 24 heures sur 24 : ces niveaux ne s'y appliquent donc pas. Les chiffres sont toujours listés dans une rangée au-dessus du graphique. La pastille, ou l'œil au bout de cette rangée, les trace sous forme de lignes.

### Expected Range

**Ce qu'on voit.** Une bande ombrée entre `ER HIGH` et `ER LOW` : le mouvement anticipé par la volatilité implicite, à un écart-type de part et d'autre du prix actuel. Désactivé par défaut. Choisis **Daily**, **Weekly** ou **Monthly** une fois qu'il est activé.

**Comment c'est calculé.** Il utilise le VIX pour SPX, SPY et ES, et le VXN pour QQQ, NDX et NQ. Le mouvement vaut prix × (VIX ÷ 100) × √(jours ÷ 252), avec 1, 5 ou 21 jours de bourse. Avec SPY à 600 $ et le VIX à 16, le mouvement quotidien est d'environ 6,05 $ : la bande va donc d'environ 593,95 $ à 606,05 $.

**Comment le lire.** Selon les hypothèses habituelles, le prix termine à l'intérieur d'une bande d'un écart-type environ 68 % du temps. La bande t'indique jusqu'où, pas dans quel sens. Elle se recentre à mesure que le prix bouge : elle décrit donc la fourchette à partir d'ici, pas depuis l'ouverture.

**À garder en tête.** Expected Range ne fonctionne qu'en direct et reste masqué pendant le Rewind, car la volatilité est une lecture en direct. Il n'est pas tracé sur NVDA, dont la volatilité propre est bien supérieure à celle de l'un comme de l'autre indice.

### Centroids

**Ce qu'on voit.** Là où est centré le trading d'options du jour. Le **centroïde des calls** (vert) est le strike moyen des calls traités aujourd'hui, pondéré par le nombre de contrats échangés à chaque strike. Le **centroïde des puts** (rouge) est l'équivalent pour les puts. Désactivés par défaut.

- Les **lignes nettes** couvrent les 15 dernières minutes de trading.
- Les **lignes larges et estompées** couvrent toute la séance jusqu'ici.

**Comment le lire.** Les calls se traitent surtout au-dessus du prix et les puts surtout en dessous : les deux lignes encadrent donc généralement le prix. L'écart entre elles montre à quel point le trading du jour est dispersé. Quand le centroïde des calls dérive vers le bas ou que celui des puts dérive vers le haut, le trading se concentre plus près du prix. Les lignes de séance bougent lentement parce qu'elles font la moyenne de toute la journée ; les lignes à 15 minutes suivent le prix et sont plus bruitées. Survole une barre pour lire les deux.

**À garder en tête.** Les centroïdes décrivent où le trading a eu lieu ; ils ne prévoient pas où ira le prix. Ils comptent toutes les expirations que suit ZeroGEX : le filtre Expiry ne s'applique donc pas. Ils ne comptent en outre que les strikes de la bande que ZeroGEX enregistre autour du prix (voir [Couverture des données et fréquence de mise à jour](/help/platform/data-coverage)) : ils se situent ainsi plus près du prix qu'un outil qui compte tous les strikes listés. Quand un strike entre dans cette bande en cours de journée, son volume antérieur est compté d'un seul coup, ce qui peut faire sauter la ligne à 15 minutes. Les Centroids ne fonctionnent qu'en direct, sur des barres de 1M à 1H.

### Bar Timer

**Ce qu'on voit.** Le temps restant avant la clôture de la bougie en cours : un compte à rebours sous l'étiquette du dernier prix, avec une fine barre qui se remplit à mesure que la bougie avance. Survole la bougie en direct pour voir le temps écoulé et le temps restant. Désactivé par défaut.

**À garder en tête.** Il ne s'affiche que lorsque le marché est ouvert et que tu regardes la dernière barre.

### Le volet de volume

Le volet sous les bougies, affiché ou masqué avec l'œil à côté de **VOL** :

- **Up/Down** (par défaut) - le volume sur tick haussier (vert) empilé sur le volume sur tick baissier (rouge), une colonne par barre.
- **Cumulative** - un total cumulé du volume sur tick haussier moins le volume sur tick baissier pour la séance en cours, qui part de zéro à l'ouverture. Au-dessus de zéro, les acheteurs ont mené le tape aujourd'hui ; en dessous, ce sont les vendeurs.

Sur SPX et NDX, le volet porte la mention **PROXY (EST.)**. Un indice cash ne se négocie pas : le volume affiché est donc une estimation dérivée, pas du volume réellement échangé. [Volume net vs flux directionnel](/education/net-volume-vs-directional-flow) approfondit le volume net.

## Le filtre Expiry

Le menu **Expiry** de la barre d'outils choisit les expirations d'options qui alimentent les niveaux de gamma. **All expirations** utilise toute la chaîne que suit ZeroGEX ; [Couverture des données et fréquence de mise à jour](/help/platform/data-coverage) la détaille. **0DTE · today's expiry** suit l'expiration du jour et passe chaque jour à la suivante. Tu peux aussi cocher une ou plusieurs dates précises.

| Élément | Suit le filtre Expiry ? |
|---|---|
| Gamma Flip, Call Wall, Put Wall | Oui |
| Max Pain | Oui sur le graphique et dans Key Levels ; `NA` sur les échelles |
| Ombrage Regime et Dealer Gamma @ Spot | Oui |
| Ribbons, le Strike Panel et les échelles | Oui |
| Le bandeau Key Levels et le Playbook | Oui |
| Pin Strike | Non : toujours l'expiration du jour |
| GEX King | Non : toujours toute la chaîne |
| Centroids | Non : toutes les expirations |
| VWAP, PD/PM Levels, Expected Range | Non : pas construits à partir de la chaîne d'options |

À savoir :

- Un sous-ensemble d'expirations a son propre flip : le prix où le gamma de ce sous-ensemble change de signe. Un carnet 0DTE est souvent d'un seul signe, tous ses strikes se trouvant du même côté : il n'y a alors aucun passage par zéro à tracer, et le graphique affiche `NO FLIP IN SELECTED EXPIRIES`. Cela ne se résoudra pas plus tard, car rien ne manque. Remets Expiry sur **All** pour voir le flip de toute la chaîne.
- `NO 0DTE TODAY · SHOWING ALL EXPIRIES` signifie qu'il n'y a pas d'expiration aujourd'hui, un week-end ou un jour férié par exemple : les niveaux utilisent alors toutes les expirations.
- Le filtre est conservé pour ton onglet de navigateur et partagé avec les autres graphiques qui filtrent par expiration. Changer de symbole le remet sur All, sauf s'il est sur 0DTE.

## Lire le réticule

Survole le graphique, ou touche-le ou fais un appui long sur téléphone, pour afficher un réticule et une carte avec :

- L'heure de la barre, l'ouverture, le plus haut, le plus bas, la clôture et le volume, plus **Net** en mode de volume Cumulative.
- **Strike Γ near** : le gamma net des dealers aux strikes proches du prix du réticule. Il t'indique combien de hedging s'y trouve. Ce n'est **pas** le régime à ce prix, car un strike long gamma peut se trouver dans un carnet short gamma. Lis le régime dans l'ombrage et dans l'encadré Dealer Gamma @ Spot.
- Le niveau tracé le plus proche sur le graphique, et sa distance. Les niveaux que tu as désactivés ne sont pas nommés.
- Avec les Centroids activés : les centroïdes des calls et des puts, la valeur à 15 minutes d'abord, puis la valeur de séance.
- Avec les Ribbons activés : le couloir le plus proche du réticule, son gamma net et sa part par rapport au strike le plus chargé à l'écran.

## Zoom, déplacement et réinitialisation

Avec une souris ou un trackpad :

- **Fais glisser** le graphique latéralement pour te déplacer dans le temps.
- **Ctrl + molette** (**Cmd + molette** sur Mac), ou un pincement sur trackpad, pour zoomer dans le temps. La molette seule fait défiler la page, pas le graphique.
- **Maj + molette**, ou la molette au-dessus de l'échelle de prix de droite, pour zoomer sur l'axe des prix. Tu peux aussi faire glisser l'échelle de prix vers le haut ou vers le bas.
- Les boutons − et + de **Time** et de **Price**, en bas à droite, font la même chose par paliers.
- **»** ramène à la dernière barre.

Sur téléphone, fais glisser latéralement pour te déplacer, pince pour zoomer dans le temps, et utilise les boutons **Price** sous le graphique pour zoomer sur le prix. Touche l'écran, ou fais un appui long puis glisse, pour afficher le réticule ; touche de nouveau pour l'effacer.

Dès que tu zoomes ou que tu te déplaces, l'échelle de prix reste là où tu l'as mise. **Reset**, un double-clic, ou un nouveau symbole ou timeframe la rend à l'ajustement automatique. Sur le Gamma Terminal, l'ajustement automatique garde le prix au centre vertical : c'est ce qui permet aux échelles de gamma de s'aligner sur lui.

## Rewind

**Rewind**, sous le graphique, rejoue la séance : le prix et le carnet de gamma tels qu'ils étaient à chaque instant.

- **Play** et **Pause**, une vitesse de **1×**, **4×**, **8×** ou **16×**, et **Loop**, activé par défaut.
- Fais glisser le **curseur de lecture** pour sauter à n'importe quelle bougie.
- Les niveaux, le Strike Panel, les ribbons et les deux échelles montrent ce qui était connu à ce moment-là. Le VWAP et le Max Pain sont reconstruits pour cet instant.
- Expected Range, Bar Timer et le montant en dollars de Dealer Gamma @ Spot sont masqués pendant le Rewind, car ce sont des lectures en direct.
- Rewind remonte aussi loin que l'historique de gamma que conserve le graphique, soit environ six heures et demie, et moins en barres 1H et 1D. Pour une séance complète depuis l'ouverture, suis le lien **full session** vers [Daily Replay](/replay).
- **● LIVE** ou **»** ramène au direct, tout comme un changement de symbole ou de timeframe.

## Le Playbook

Sous les cartes, **Where do we expect the underlying to go?** expose ce qu'implique le régime actuel quand le prix approche d'un wall :

| | Hausse vers le Call Wall | Baisse vers le Put Wall |
|---|---|---|
| Positive γ (dealers long gamma) | Damped rally | Cushioned dip |
| Negative γ (dealers short gamma) | Squeeze risk | Flush risk |

Il suit le graphique en direct. Clique sur une cellule pour lire un autre scénario, et sur **Follow the chart** pour revenir. Chaque scénario indique quoi surveiller, ce qui l'invalide et à quelle fréquence les walls cèdent.

## ES et NQ

ZeroGEX lit les options sur indice, pas les options sur futures : les niveaux d'ES et de NQ proviennent donc des chaînes SPX et NDX et sont projetés sur le prix du future à la juste valeur (le carry jusqu'à l'échéance du contrat). Le chip **IMPLIED FROM SPX** (ou **NDX**) le signale. Le prix lui-même est celui du contrat future, dont le code, par exemple ESZ26, apparaît dans l'en-tête. Quand les futures se traitent au-dessus ou en dessous de leur juste valeur, les niveaux peuvent être légèrement décalés. [Mois de contrat des futures](/help/platform/futures-contract-months) explique pourquoi les prix peuvent différer de ceux d'autres plateformes.

## Aperçu gratuit vs accès en direct

| | Aperçu gratuit | Basic et Pro |
|---|---|---|
| Données | Différées d'environ 15 minutes ; recharge la page pour un instantané plus récent | En direct |
| Symboles et timeframes | SPY en barres de 5 minutes | Les sept symboles, de 1M à 1D |
| Panneau | Échelles SPY et SPX ; Strike Panel en silhouette uniquement | N'importe quelle paire ; les quatre vues du Strike Panel ; Session Δ |
| Superpositions | Gamma Levels, Regime, VWAP, Max Pain | Toutes |
| Outils | Zoom, réticule, Save | Également le filtre Expiry, Rewind et les alertes de wall |

[Niveaux, accès et ce qui se débloque où](/help/platform/tiers-and-access) couvre le reste du site.

## Ce que le terminal mémorise

Sur ce navigateur, le terminal enregistre tes superpositions, le style du graphique, le mode de volume, l'horizon d'Expected Range, l'opacité des ribbons, ton choix de panneau et la vue du Strike Panel, ainsi que ton symbole et les réglages Strikes, Session Δ et Unit des échelles. Le filtre Expiry est conservé par onglet de navigateur.

Il n'enregistre pas le timeframe (il s'ouvre en 5M), le symbole de la seconde échelle, le zoom et le déplacement, ni le Rewind.

## Ce que le Gamma Terminal ne peut pas te dire

- **Qui détient réellement les options.** Le gamma des dealers est modélisé à partir de l'open interest selon une convention standard. Les carnets réels des dealers diffèrent, et les desks se couvrent d'une manière que les données publiques ne montrent pas.
- **Les nouvelles positions en cours de journée.** L'open interest est mis à jour une fois par jour, après la clôture. Pendant la séance, les niveaux bougent parce que le prix, le temps et la volatilité modifient le gamma des positions déjà ouvertes.
- **Où ira le prix.** Les walls, le pin, le max pain, la fourchette attendue et les centroïdes sont du contexte, pas des objectifs ni des promesses. Les niveaux de gamma sont une aide à la décision, pas un conseil en investissement.

## Voir aussi

- [Lire le Tableau de bord](/help/platform/dashboard)
- [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts)
- [Pin Strike](/help/platform/pin-strike)
- [Gamma Exposure expliqué](/education/gamma-exposure-explained)
- [Les Gamma Walls expliqués](/education/gamma-walls-explained)
- [Comment trader autour du Gamma Flip](/education/how-to-trade-around-gamma-flip)
- [Couverture des données et fréquence de mise à jour](/help/platform/data-coverage)
