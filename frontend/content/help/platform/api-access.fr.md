# Accès API et clés (Pro)

*Comment lire la documentation de l'API, ce que débloque votre niveau Pro, et le modèle de base pour l'authentification et les limites de débit.*

---

## Ce que l'API ZeroGEX vous offre

Tout ce que la plateforme web vous affiche est calculé par le même backend qui alimente l'API. Les abonnés Pro obtiennent un accès programmatique à :

- Résumés GEX et détails par strike
- Cotations en temps réel
- Données de flow (prime, volume, buckets smart-money)
- Signaux de trading (scores et états de déclenchement)
- Barres historiques et historique des signaux

## La documentation

La référence complète se trouve sur **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. La documentation est conforme à OpenAPI 3.0 et disponible en deux vues :

- **Swagger UI** — interactive ; testez des requêtes directement depuis le navigateur
- **ReDoc** — lecture seule ; plus rapide pour parcourir l'ensemble de la surface de l'API

La documentation nécessite un compte Pro. Les utilisateurs publics sont redirigés vers la page Pricing au clic.

## Authentification

L'authentification utilise des **jetons bearer**. La génération de clés en libre-service depuis votre page Compte arrive bientôt ; en attendant son lancement, les clés sont délivrées manuellement :

1. Envoyez un e-mail à [support@zerogex.io](mailto:support@zerogex.io) depuis l'adresse e-mail de votre compte (comptes Pro uniquement).
2. Nous vous envoyons une clé et des notes de configuration.
3. Incluez-la sous la forme `Authorization: Bearer <key>` dans chaque requête.

Besoin de faire tourner ou de révoquer une clé ? Écrivez au support, nous traiterons la demande rapidement.

## Limites de débit

L'API applique des limites de débit par clé. Les limites évoluent selon le niveau :

- **Pro** — plafonds généreux par minute et par jour, suffisants pour des dashboards de production et des bots respectant une hygiène de requêtes normale.

Les requêtes dépassant la limite renvoient `429 Too Many Requests` avec un en-tête `Retry-After`.

## Format de réponse

Tous les endpoints renvoient du JSON. Champs standard :

- `data` — la charge utile
- `meta` — pagination, horodatages, ID de requête
- `error` — présent sur les réponses d'erreur ; omis en cas de succès

Les champs numériques sont typés avec précision — les valeurs de gamma sont des dollars signés, les scores sont des flottants dans [-1, +1], les horodatages sont au format ISO 8601 UTC.

## Modèles courants

### Polling vs streaming

Pour la plupart des cas d'usage, un polling à une cadence raisonnable (toutes les quelques secondes pour les métriques en direct, toutes les minutes pour l'historique) suffit. Le streaming n'est pas actuellement exposé dans l'API publique ; la plateforme web utilise un canal interne.

### Mise en cache

La plupart des endpoints définissent des en-têtes de cache HTTP sensés — respectez-les. Les endpoints de signaux sont estampillés avec l'horodatage du score le plus récent, ce qui vous permet d'ignorer les réponses identiques.

### Backfill

Les endpoints historiques prennent en charge des fenêtres de plusieurs jours. Pour des backfills approfondis, paginez à l'aide du champ `meta.cursor`.

## Ce qui est restreint

- L'accès à l'API nécessite un compte **Pro**. Les comptes Basic et Public ne peuvent pas générer de clés.
- Certains endpoints disposent de flags supplémentaires réservés aux Pro (par exemple, les exports bruts de la chain) — la documentation les signale.

## Bonnes pratiques

- Une clé par environnement (dev, prod). Faites-les tourner selon un calendrier régulier.
- Ne placez pas de clé dans du code côté client. La plateforme est conçue pour une consommation côté serveur.
- Définissez un `User-Agent` pertinent — cela nous aide à vous aider lorsqu'une requête pose problème.

## Voir aussi

- [Niveaux, accès et ce que chacun débloque](/help/platform/tiers-and-access)
- [Couverture et actualisation des données](/help/platform/data-coverage)
- [Documentation de l'API (externe)](https://api.zerogex.io/docs)
