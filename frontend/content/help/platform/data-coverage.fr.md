# Couverture des données et fréquence de mise à jour

*Symboles pris en charge, comportement pendant les heures de marché, fréquence de mise à jour de chaque module, et ce qui se passe autour des jours fériés et des demi-journées.*

---

## Symboles couverts

ZeroGEX offre une couverture analytique complète pour quatre sous-jacents au comptant :

- **SPY** - ETF S&P 500
- **SPX** - Indice S&P 500 (options de style européen)
- **QQQ** - ETF Nasdaq 100
- **NDX** - Indice Nasdaq 100 (options de style européen)

Ce sont les quatre sous-jacents les plus liquides et les plus riches en gamma du marché des options américain - les instruments où l'activité de couverture des dealers a l'impact le plus important sur le prix intrajournalier.

S'y ajoutent deux contrats à terme sur indices du CME, comme symboles à part entière :

- **ES** - future E-mini S&P 500
- **NQ** - future E-mini Nasdaq 100

ES et NQ n'ont pas de carnet d'options propre. ES et SPX suivent le même indice : le carnet des dealers derrière un graphique ES *est* donc le carnet SPX - les niveaux SPX (ou NDX, pour NQ) sont projetés sur l'axe de prix du future, tandis que la série de prix provient du flux CME. Le ratio de projection est mesuré sur le tape plutôt que modélisé à partir du carry ; il se corrige donc de lui-même à chaque roulement trimestriel et il n'y a aucun décalage de base à configurer. Les expositions en dollars (GEX net, call et put) sont délibérément laissées non projetées : l'histogramme est mis à l'échelle sur l'exposition *relative*, la forme est donc identique dans les deux cas. Les micro-contrats (/MES, /MNQ) sont le même contrat au dixième de la taille - les mêmes niveaux s'appliquent.

Nous ne prévoyons pas de prendre en charge les actions individuelles. Le modèle de signaux et le concept de régime sont conçus autour du comportement des dealers à l'échelle de l'indice.

## Heures de marché

ZeroGEX utilise en permanence l'heure de l'Est des États-Unis (ET) :

- **Pré-ouverture (pre-market)** - 4h00 - 9h30 ET
- **Séance régulière** - 9h30 - 16h00 ET
- **Après-clôture (after-hours)** - 16h00 - 20h00 ET (lorsque disponible)

Le badge de séance dans l'en-tête confirme dans quelle plage horaire vous vous trouvez.

**ES et NQ suivent en revanche la séance électronique du CME**, bien plus large : du dimanche 18h00 ET jusqu'au vendredi 17h00 ET sans interruption, avec une pause de maintenance quotidienne de 17h00 à 18h00 ET. Cela couvre intégralement les séances asiatique et européenne, et les cotations ES/NQ sont du CME en temps réel. La nuit - de 18h00 ET jusqu'à l'ouverture de 9h30, tant que les futures se traitent - SPX et NDX affichent leur future à la place de l'indice au comptant figé : le badge de séance indique « Futures » et le prix dans l'en-tête montre le future, avec la variation mesurée par rapport à son propre cours de 16h00 ET.

Les niveaux de dealers sur un graphique de futures proviennent toujours du carnet d'options de l'indice, qui se cote pendant les heures américaines. La nuit, vous observez donc l'ES/NQ se traiter en direct face aux niveaux tels qu'ils étaient à la clôture américaine, actualisés à mesure que les données de chaîne nocturnes sont publiées (voir *Pré-ouverture et après-clôture* plus bas) ; ils ne sont pas recalculés tick par tick à 3h00 ET. Si une cotation de future devient obsolète, le prix porte un badge indiquant le retard mesuré.

## Fréquence de mise à jour par module

| Module | Fréquence |
| --- | --- |
| Cotation du prix | Environ chaque seconde |
| Résumé GEX, walls, flip et max pain | Recalculés environ une fois par minute |
| Heatmap GEX strike/DTE | Recalculée environ une fois par minute |
| Flux d'options | Barres de cinq minutes |
| Scores de signaux | Environ une fois par minute |
| Score composite | Environ une fois par minute |
| Jauges de volatilité (VIX / VXN) | Barres de cinq minutes |
| Bulletin en direct | Prix toutes les 5 secondes, niveaux toutes les ~10 secondes, volatilité toutes les ~30 secondes |
| Données de backtesting | Données historiques à la minute, pas en direct |

Il n'est pas nécessaire d'actualiser la page. Les pages vérifient les nouveaux chiffres toutes les quelques secondes (toutes les 5 secondes sur les pages de signaux) : une nouvelle valeur apparaît donc quelques secondes après avoir été calculée.

Une remarque sur les modules GEX : « mise à jour » signifie que l'exposition est **recalculée**, et non que l'open interest est réinterrogé tick par tick. L'open interest des options cotées est comptabilisé par la chambre de compensation après la séance et publié pour la séance *suivante* - il ne se constitue pas en direct pendant la journée. Les variations intrajournalières du résumé GEX et de la heatmap proviennent donc de la réévaluation du carnet existant à mesure que le spot, le temps et la volatilité implicite évoluent - et non d'un nouvel open interest confirmé. Les estimations de la couverture générée par les transactions du jour sont une lecture distincte, sur la page [Hedging Flow](/help/platform/hedging-flow), *déduite* de la classification des transactions plutôt que d'un open interest confirmé.

## Pré-ouverture et après-clôture

Pendant les heures étendues :

- L'en-tête affiche la dernière clôture de la séance régulière et sa variation, avec sur une deuxième ligne le prix en direct des heures étendues et son mouvement depuis cette clôture.
- Les scores de signaux continuent de se mettre à jour lorsque les données sont suffisantes. Certains signaux (EOD Pressure, 0DTE Position Imbalance) ne sont calculés intentionnellement que pendant la séance régulière.
- La surface GEX reflète l'état de clôture de la séance régulière, plus les éventuelles mises à jour de la chaîne d'options survenues durant la nuit - y compris l'open interest compensé de la séance suivante, dès sa publication.

## Lorsque le marché est fermé

Lorsque le marché est fermé, la plateforme affiche les dernières valeurs de clôture de la séance régulière pour tous les modules. Le badge de séance indique « Closed ».

## Jours fériés

Jours fériés de marché à journée complète - pas de données en direct ; la plateforme affiche la séance précédente.

Demi-journées (clôture anticipée à 13h00 ET autour de certains jours fériés) - la plateforme respecte la clôture anticipée. L'EOD Pressure conserve sa fenêtre habituelle de 14h30 à 16h00 ET : elle reste donc inactive lors d'une demi-journée.

## Profondeur historique

- **Données intrajournalières détaillées** - les instantanés complets de la chaîne d'options, le GEX par strike et le flux par contrat sont conservés sur une fenêtre glissante d'environ deux à trois mois, pas des années.
- **Séries plus légères** - les barres de prix à la minute et le résumé GEX principal sont conservés plus longtemps.
- **Backtesting** - repose sur une archive distincte de la chaîne d'options. La plage de dates de la page Backtesting indique exactement ce qui est disponible pour un test.

## Sources de données

ZeroGEX utilise des données de marché professionnelles en temps réel sur les options et les sous-jacents, sous licences commerciales. Il vaut la peine d'être précis sur ce que cela signifie, car il ne s'agit pas d'un tape unique :

- **Les cotations et transactions d'options** sur SPY, QQQ, SPX et NDX proviennent d'OPRA, le tape consolidé des options cotées aux États-Unis.
- **Les valeurs des indices SPX et NDX** proviennent d'un flux d'indices distinct, et non du tape des options.
- **Les prix de SPY et QQQ** proviennent de Nasdaq Basic, un flux en temps réel de Nasdaq.
- Les prix **ES et NQ** proviennent du flux CME en temps réel.
- L'**open interest** est une donnée distincte de fin de séance issue du clearing, et non une valeur en temps réel.

Les grecques et toutes les mesures de positionnement des dealers sont calculées par ZeroGEX à partir de ces entrées, plutôt que fournies toutes faites par un fournisseur - voir [Méthodologie et validation](/methodology). Nous ne communiquons pas publiquement le nom précis de nos fournisseurs.

## Latence

Pendant les heures régulières, les prix arrivent généralement dans votre navigateur quelques secondes après leur impression sur le tape. Les chiffres de positionnement des dealers et les signaux suivent avec un décalage voulu, car ils sont recalculés selon les cycles ci-dessus plutôt qu'à chaque transaction. Si les mises à jour semblent plus lentes, voir [Streaming et performance](/help/platform/streaming-and-performance).

## Pourquoi seulement le complexe des indices

Deux raisons :

1. Le modèle de positionnement des dealers ne fonctionne bien que là où le flow des dealers représente une fraction significative du flow total. C'est le cas du complexe des indices - SPY, SPX, QQQ, NDX et les futures ES / NQ, qui suivent ces deux mêmes indices.
2. Nous préférons bien maîtriser une poignée d'instruments plutôt que de maîtriser à moitié dix instruments.

Les actions individuelles peuvent dériver sous l'effet de nouvelles idiosyncrasiques, ce qui rend la lecture du GEX plus bruitée. Ce n'est pas notre terrain de jeu.

## Voir aussi

- [Accès API et clés (Pro)](/help/platform/api-access)
- [Streaming et performance](/help/platform/streaming-and-performance)
