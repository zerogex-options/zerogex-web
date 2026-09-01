# Couverture des données et fréquence de mise à jour

*Symboles pris en charge, comportement pendant les heures de marché, fréquence de mise à jour de chaque module, et ce qui se passe autour des jours fériés et des demi-journées.*

---

## Symboles couverts

ZeroGEX offre une couverture analytique complète pour quatre sous-jacents au comptant :

- **SPY** — ETF S&P 500
- **SPX** — Indice S&P 500 (options de style européen)
- **QQQ** — ETF Nasdaq 100
- **NDX** — Indice Nasdaq 100 (options de style européen)

Ce sont les quatre sous-jacents les plus liquides et les plus riches en gamma du marché des options américain — les instruments où l'activité de couverture des dealers a l'impact le plus important sur le prix intrajournalier.

S'y ajoutent deux contrats à terme sur indices du CME, comme symboles à part entière :

- **ES** — future E-mini S&P 500
- **NQ** — future E-mini Nasdaq 100

ES et NQ n'ont pas de carnet d'options propre. ES et SPX suivent le même indice : le carnet des dealers derrière un graphique ES *est* donc le carnet SPX — les niveaux SPX (ou NDX, pour NQ) sont projetés sur l'axe de prix du future, tandis que la série de prix provient du flux CME. Le ratio de projection est mesuré sur le tape plutôt que modélisé à partir du carry ; il se corrige donc de lui-même à chaque roulement trimestriel et il n'y a aucun décalage de base à configurer. Les expositions en dollars (GEX net, call et put) sont délibérément laissées non projetées : l'histogramme est mis à l'échelle sur l'exposition *relative*, la forme est donc identique dans les deux cas. Les micro-contrats (/MES, /MNQ) sont le même contrat au dixième de la taille — les mêmes niveaux s'appliquent.

Nous ne prévoyons pas de prendre en charge les actions individuelles. Le modèle de signaux et le concept de régime sont conçus autour du comportement des dealers à l'échelle de l'indice.

## Heures de marché

ZeroGEX utilise en permanence l'heure de l'Est des États-Unis (ET) :

- **Pré-ouverture (pre-market)** — 4h00 – 9h30 ET
- **Séance régulière** — 9h30 – 16h00 ET
- **Après-clôture (after-hours)** — 16h00 – 20h00 ET (lorsque disponible)

Le badge de séance dans l'en-tête confirme dans quelle plage horaire vous vous trouvez.

**ES et NQ suivent en revanche la séance électronique du CME**, bien plus large : du dimanche 18h00 ET jusqu'au vendredi 17h00 ET sans interruption, avec une pause de maintenance quotidienne de 17h00 à 18h00 ET. Cela couvre intégralement les séances asiatique et européenne, et les cotations ES/NQ sont du CME en temps réel. Lorsqu'un indice au comptant est fermé mais que son future se traite, le badge de séance affiche « Futures » et la tuile de prix montre le future — avec la variation mesurée par rapport à son propre cours de clôture de 16h00 ET — plutôt que l'indice au comptant figé.

Les niveaux de dealers sur un graphique de futures proviennent toujours du carnet d'options de l'indice, qui se cote pendant les heures américaines. La nuit, vous observez donc l'ES/NQ se traiter en direct face aux niveaux tels qu'ils étaient à la clôture américaine, actualisés à mesure que les données de chaîne nocturnes sont publiées (voir *Pré-ouverture et après-clôture* plus bas) ; ils ne sont pas recalculés tick par tick à 3h00 ET. Si une cotation de future devient obsolète, le prix porte un badge indiquant le retard mesuré.

## Fréquence de mise à jour par module

| Module | Fréquence |
| --- | --- |
| Cotation du prix | 1 seconde |
| Résumé GEX | 5–15 secondes |
| Heatmap GEX strike/DTE | 5–15 secondes |
| Flow / tape | 1 seconde |
| Scores de signaux | 1–5 secondes selon le signal |
| Composite Score | 5 secondes |
| Live Bulletin | piloté par événements, en temps réel |
| Données de backtesting | instantané EOD (fin de journée) |

Il n'est pas nécessaire d'actualiser la page. Tout est diffusé en streaming.

## Pré-ouverture et après-clôture

Pendant les heures étendues :

- La tuile de prix affiche la cotation des heures étendues aux côtés de la clôture de la séance régulière précédente.
- Les scores de signaux continuent de se mettre à jour lorsque les données sont suffisantes. Certains signaux (EOD Pressure, 0DTE Position Imbalance) ne sont calculés intentionnellement que pendant la séance régulière.
- La surface GEX reflète l'état de clôture de la séance régulière, plus les éventuelles mises à jour de la chaîne d'options survenues durant la nuit.

## Lorsque le marché est fermé

Lorsque le marché est fermé, la plateforme affiche les dernières valeurs de clôture de la séance régulière pour tous les modules. Le badge de séance indique « Closed ». Les pages de signaux affichent des horodatages « dernier calcul ».

## Jours fériés

Jours fériés de marché à journée complète (à l'exception de la veille du Nouvel An) — pas de données en direct ; la plateforme affiche la séance précédente.

Demi-journées (clôture anticipée à 13h00 ET certains vendredis proches des jours fériés) — la plateforme respecte la clôture anticipée. La fenêtre de l'EOD Pressure s'adapte à une rampe démarrant à 11h30 ET lors des demi-journées.

## Profondeur historique

- **Cotations et flow** — plusieurs années de données historiques.
- **Scores de signaux** — reconstitués depuis la création de chaque signal.
- **Surfaces GEX** — historique d'instantanés quotidiens ; l'historique intrajournalier est limité à la fenêtre récente.

La page de Backtesting affiche l'horizon historique disponible pour le signal sélectionné.

## Sources de données

ZeroGEX utilise des données de marché professionnelles en temps réel sur les options et les sous-jacents, sous licences commerciales. Il ne s'agit pas d'un tape unique : les **options sur SPY et QQQ** sont diffusées via OPRA (le tape consolidé des options américaines), tandis que **SPX, SPXW et NDX** sont des options sur indices, dont les entitlements sont licenciés séparément auprès de la bourse de cotation et qui ne circulent *pas* sur le tape OPRA. Les prix ES et NQ proviennent du flux CME en temps réel. L'open interest est une donnée distincte de fin de séance issue du clearing, et non une valeur en temps réel. Les grecques et toutes les mesures de positionnement des dealers sont calculées par ZeroGEX à partir de ces entrées — voir [Méthodologie et validation](/methodology).

Nous ne communiquons pas publiquement le nom précis de nos fournisseurs, mais le niveau de qualité est institutionnel — les mêmes flux de données que ceux utilisés par les desks quantitatifs.

## Latence

La latence de bout en bout entre l'impression d'une transaction sur le tape et son arrivée dans votre navigateur est généralement inférieure à une seconde pendant les heures régulières. Le goulot d'étranglement, ce sont rarement les données — ce sont plutôt votre réseau et votre navigateur. Voir [Streaming et performance](/help/platform/streaming-and-performance).

## Pourquoi seulement le complexe des indices

Deux raisons :

1. Le modèle de positionnement des dealers ne fonctionne bien que là où le flow des dealers représente une fraction significative du flow total. C'est le cas du complexe des indices — SPY, SPX, QQQ, NDX et les futures ES / NQ, qui suivent ces deux mêmes indices.
2. Nous préférons bien maîtriser une poignée d'instruments plutôt que de maîtriser à moitié dix instruments.

Les actions individuelles peuvent dériver sous l'effet de nouvelles idiosyncrasiques, ce qui rend la lecture du GEX plus bruitée. Ce n'est pas notre terrain de jeu.

## Voir aussi

- [Accès API et clés (Pro)](/help/platform/api-access)
- [Streaming et performance](/help/platform/streaming-and-performance)
