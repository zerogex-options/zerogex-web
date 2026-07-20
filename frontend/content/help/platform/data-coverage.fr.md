# Couverture des données et fréquence de mise à jour

*Symboles pris en charge, comportement pendant les heures de marché, fréquence de mise à jour de chaque module, et ce qui se passe autour des jours fériés et des demi-journées.*

---

## Symboles couverts

ZeroGEX offre une couverture analytique complète pour trois instruments :

- **SPY** — ETF S&P 500
- **SPX** — Indice S&P 500 (options de style européen)
- **QQQ** — ETF Nasdaq 100

Ce sont les trois sous-jacents les plus liquides et les plus riches en gamma du marché des options américain — les instruments où l'activité de couverture des dealers a l'impact le plus important sur le prix intrajournalier.

Nous ne prévoyons pas de prendre en charge les actions individuelles. Le modèle de signaux et le concept de régime sont conçus autour du comportement des dealers à l'échelle de l'indice.

## Heures de marché

ZeroGEX utilise en permanence l'heure de l'Est des États-Unis (ET) :

- **Pré-ouverture (pre-market)** — 4h00 – 9h30 ET
- **Séance régulière** — 9h30 – 16h00 ET
- **Après-clôture (after-hours)** — 16h00 – 20h00 ET (lorsque disponible)

Le badge de séance dans l'en-tête confirme dans quelle plage horaire vous vous trouvez.

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

ZeroGEX utilise **des données d'options issues du flux OPRA** (le tape consolidé des options américaines), associées au flux de cotation de l'action sous-jacente. Ce sont toutes deux des sources de données professionnelles et en temps réel.

Nous ne communiquons pas publiquement le nom précis de nos fournisseurs, mais le niveau de qualité est institutionnel — les mêmes flux de données que ceux utilisés par les desks quantitatifs.

## Latence

La latence de bout en bout entre l'impression d'une transaction sur le tape et son arrivée dans votre navigateur est généralement inférieure à une seconde pendant les heures régulières. Le goulot d'étranglement, ce sont rarement les données — ce sont plutôt votre réseau et votre navigateur. Voir [Streaming et performance](/help/platform/streaming-and-performance).

## Pourquoi seulement SPY / SPX / QQQ

Deux raisons :

1. Le modèle de positionnement des dealers ne fonctionne bien que là où le flow des dealers représente une fraction significative du flow total. C'est le cas du complexe des indices.
2. Nous préférons bien maîtriser trois instruments plutôt que de maîtriser à moitié dix instruments.

Les actions individuelles peuvent dériver sous l'effet de nouvelles idiosyncrasiques, ce qui rend la lecture du GEX plus bruitée. Ce n'est pas notre terrain de jeu.

## Voir aussi

- [Accès API et clés (Pro)](/help/platform/api-access)
- [Streaming et performance](/help/platform/streaming-and-performance)
