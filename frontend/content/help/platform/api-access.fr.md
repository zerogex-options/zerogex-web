# Accès API et clés (Pro)

*Comment lire la documentation de l'API, ce que débloque votre niveau Pro, et le modèle de base pour l'authentification et les limites de débit.*

---

## Ce que l'API ZeroGEX vous offre

Tout ce que la plateforme web vous affiche est calculé par le même backend qui alimente l'API. Les abonnés Pro obtiennent un accès programmatique à :

- Résumés GEX et détails par strike (y compris l'endpoint consolidé niveaux des dealers + profil gamma)
- Données de flow (prime, volume, buckets smart-money)
- Max pain et indicateurs techniques intraday (VWAP, range d'ouverture, volume, momentum)
- Signaux de trading (scores et états de déclenchement)
- Historique GEX et historique des signaux

## La documentation

La référence complète se trouve sur **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. La documentation est conforme à OpenAPI 3.1 et disponible en deux vues :

- **Swagger UI** - interactive ; cliquez sur **Authorize**, collez votre clé et testez des requêtes directement depuis le navigateur
- **ReDoc** - lecture seule ; plus rapide pour parcourir l'ensemble de la surface de l'API

Pour envoyer des requêtes - depuis la documentation ou ailleurs - il faut une clé Pro. Dans l'application, le lien **API Specs** renvoie les comptes Public et Basic vers la page Pricing.

## Authentification

L'authentification utilise des **jetons bearer**. Vous générez votre clé vous-même depuis votre compte - rien à attendre :

1. Connectez-vous et ouvrez **Compte → API Access** (`/account#api-access`).
2. Cliquez sur **Generate API Key** et copiez la clé lors de l'affichage unique - elle n'apparaît qu'une seule fois, pendant quelques minutes, et ne peut plus être récupérée ensuite. Conservez-la dans un gestionnaire de mots de passe ou un coffre à secrets.
3. Envoyez-la sous la forme `Authorization: Bearer <key>` dans chaque requête.

Les clés API personnelles sont une fonctionnalité Pro ; les comptes Basic et Public sont redirigés vers la page Tarifs. Générer une nouvelle clé révoque immédiatement la précédente (vous n'avez au plus qu'une seule clé active), la rotation consiste donc simplement à en regénérer une. Besoin d'aide ou de révoquer une clé ? Écrivez à [support@zerogex.io](mailto:support@zerogex.io).

## Limites de débit

L'API limite les requêtes par clé, sur une fenêtre d'une minute fixée bien au-dessus de ce dont ont besoin des dashboards de production et des bots respectant une hygiène de requêtes normale. Les requêtes dépassant la limite renvoient `429 Too Many Requests` avec un en-tête `Retry-After`.

## Format de réponse

Tous les endpoints renvoient du JSON, en deux versions :

- **v1** (`/api/...` et `/api/v1/levels/...`) - la charge utile constitue directement le corps de la réponse.
- **v2** (`/api/v2/...`) - la même charge utile sous `data`, plus un bloc `freshness` : quand les données sous-jacentes ont été observées, la séance de marché, à partir de quand considérer la réponse comme périmée, et un `freshness_status` synthétique (`fresh`, `aging`, `stale`, `session_closed`, ...). Recommandée pour les nouvelles intégrations - remplacez le `/api` initial (ou `/api/v1`) par `/api/v2` et lisez la charge utile dans `data`.

Les erreurs renvoient le statut HTTP correspondant avec un corps `{"detail": ...}`, dans les deux versions.

Les champs numériques sont typés avec précision - les valeurs de gamma sont des dollars signés, les scores de chaque signal (`clamped_score`) sont des flottants dans [-1, +1], les horodatages sont au format ISO 8601 UTC.

## Modèles courants

### Polling vs streaming

Pour la plupart des cas d'usage, un polling à une cadence raisonnable (toutes les quelques secondes pour les métriques en direct, toutes les minutes pour l'historique) suffit. Le streaming n'est pas actuellement exposé dans l'API publique ; la plateforme web utilise un canal interne.

### Mise en cache

Les réponses sont mises en cache côté serveur pendant environ cinq secondes, et les analyses derrière la plupart des endpoints sont recalculées environ une fois par minute : un polling plus serré renvoie donc le plus souvent le même corps. Les endpoints de signaux sont estampillés avec l'horodatage du score le plus récent, ce qui vous permet d'ignorer les réponses identiques.

### Backfill

Les endpoints d'historique dérivé - GEX (`/api/gex/historical`), max pain et historique des signaux - prennent en charge des fenêtres de plusieurs jours. Les données d'options font exception : les cotations par contrat sont servies sous forme de dernière cotation ou d'une seule séance intraday (`/api/option/contract`), **pas** sous forme de série historique sur plusieurs jours - et les cotations par contrat ne font de toute façon pas partie du niveau standard (voir *Ce qui est restreint*). Si vous avez besoin d'un historique plus long des cotations d'options, contactez le support avec les détails.

## Ce qui est restreint

- L'accès à l'API nécessite un compte **Pro**. Les comptes Basic et Public ne peuvent pas générer de clés.
- Les données de marché brutes en amont - cotations des contrats d'options individuels (la dernière cotation comme l'historique intraday du contrat) - ne font pas partie du niveau d'API standard. L'API sert les analyses dérivées (GEX, flow, max pain, indicateurs techniques, signaux) et leur historique. Besoin de données d'options brutes pour un cas d'usage précis ? Écrivez au support et nous étudierons les possibilités.

## Bonnes pratiques

- Vous n'avez qu'une clé active, donc tous vos environnements (dev, prod) la partagent. Faites-la tourner selon un calendrier régulier en la regénérant - l'ancienne clé cesse de fonctionner immédiatement, alors mettez-la à jour partout où elle est utilisée.
- Ne placez pas de clé dans du code côté client. La plateforme est conçue pour une consommation côté serveur.
- Définissez un `User-Agent` pertinent - cela nous aide à vous aider lorsqu'une requête pose problème.

## Intégrations de graphiques

Si vous voulez simplement nos niveaux sur votre propre graphique, vous n'avez peut-être rien à coder. Les quatre figurent sur la page [Intégrations](/integrations) :

- **NinjaTrader 8** - un indicateur NinjaScript inclus avec Pro qui interroge `GET /api/v1/levels/{symbol}` avec votre clé Pro et trace le Gamma Flip, le Call Wall, le Put Wall, le Max Pain et le Pin Strike. En tant qu'abonné Pro, téléchargez-le depuis n'importe quelle page gratuite de niveaux gamma (par exemple [/spx-gamma-levels](/spx-gamma-levels)), importez-le dans NinjaTrader (**File → Utilities → Import NinjaScript…**) et collez-y votre clé. Sur un graphique ES ou NQ, réglez le symbole sur `ES` ou `NQ` : les niveaux arrivent déjà sur l'axe de prix des futures, sans écart de base à appliquer.
- **Sierra Chart** - une étude ACSIL incluse avec Pro qui interroge le même endpoint avec votre clé et trace les mêmes cinq niveaux. En tant qu'abonné Pro, téléchargez-la depuis [/sierra-chart-indicator](/sierra-chart-indicator) et compilez-la avec le compilateur intégré de Sierra Chart (**Analysis → Build Custom Studies DLL**).
- **TradingView** - un script Pine gratuit. Saisie manuelle uniquement : Pine Script ne peut pas effectuer d'appels HTTP, vous saisissez donc vous-même les chiffres du jour.
- **thinkorswim** - une étude thinkScript gratuite. Saisie manuelle uniquement : thinkScript est cloisonné comme Pine Script, vous recopiez donc l'étude chaque jour - elle contient déjà les chiffres du jour.

Si votre plateforme ne peut pas accéder au réseau - ou si vous préférez demander les niveaux plutôt que les lire -, connectez un assistant IA à notre [serveur MCP](/help/platform/mcp-server) gratuit (niveaux différés, sans clé), ou consultez [Construire un serveur MCP sur l'API ZeroGEX](/help/platform/mcp-integration), qui explique comment brancher l'API sur un assistant.

## Voir aussi

- [Niveaux, accès et ce que chacun débloque](/help/platform/tiers-and-access)
- [Couverture et actualisation des données](/help/platform/data-coverage)
- [Le serveur MCP de ZeroGEX (gratuit, sans clé)](/help/platform/mcp-server)
- [Construire un serveur MCP sur l'API ZeroGEX](/help/platform/mcp-integration)
- [Documentation de l'API (externe)](https://api.zerogex.io/docs)
