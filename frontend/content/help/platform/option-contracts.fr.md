# Cotations d'Options en Direct

*Parcourez la chaîne en direct. Filtrage par échéance et moneyness, tri des colonnes, et comment la surface de IV illumine les couleurs.*

---

## Ce que montre cette page

La page Cotations d'Options en Direct est la **chaîne d'options en direct** pour le symbole actif. Chaque colonne se met à jour en temps réel pendant les heures de marché.

## Les colonnes

Pour chaque strike et chaque échéance :

- **Strike**
- **Bid / Ask / Mid**
- **Last** et **Volume**
- **Open Interest**
- **Delta, Gamma, Vega, Theta, Charm**
- **Volatilité Implicite**
- **Contribution au GEX** — la valeur en dollars du gamma des dealers à ce strike

Chaque ligne est appariée (call à gauche, put à droite) avec le strike dans la colonne centrale. La disposition classique en chaîne.

## Filtres

La barre de filtres vous permet de délimiter la chaîne :

- **Échéance** — sélection multiple. Par défaut 0DTE si disponible, sinon la plus proche.
- **Moneyness** — bande ATM (p. ex., ±5 % par rapport au spot) ou chaîne complète.
- **Trier** — par strike, volume, OI, IV, contribution au GEX.
- **Afficher uniquement** — volume non nul, OI non nul, sweeps, blocks.

## Les couleurs de la surface de IV

Les cellules sont colorées en dégradé selon la IV — couleurs froides (bleu) pour une IV basse, couleurs chaudes (rouge) pour une IV élevée. L'échelle est propre à chaque échéance, donc un ATM « chaud » dans une colonne ne correspond pas au même niveau absolu de IV qu'un ATM « chaud » dans une autre. L'objectif est de voir la **forme** du smile, pas le niveau absolu.

## Comment lire la chaîne

Trois schémas :

1. **Où l'OI est-il concentré ?** La chaîne est la donnée brute qui sous-tend le profil GEX. Les strikes avec le plus grand OI sont généralement là où se trouvent les walls.
2. **Où se trouve le volume ?** Le volume indique ce qui s'échange **en ce moment même**, ce qui peut diverger fortement de l'OI en cours de séance.
3. **Où se situe le skew de IV ?** Un skew plus prononcé de la IV des puts OTM par rapport à la IV des calls OTM constitue la lecture du skew.

## Actions rapides

- **Cliquez sur une ligne** pour ouvrir le Strategy Builder avec cette jambe (leg) pré-remplie.
- **Survolez une cellule** pour voir tous les détails (taille bid/ask, heure de la dernière transaction, exchange).

## Remarque sur le forfait

Les Cotations d'Options en Direct sont disponibles pour les forfaits Basic et Pro.

## Voir aussi

- [Strategy Builder](/help/platform/options-calculator)
- [Positionnement des Dealers](/help/platform/dealer-positioning)
- [Analyse des Flux](/help/platform/flow-analysis)
