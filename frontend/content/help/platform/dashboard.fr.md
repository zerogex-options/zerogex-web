# Lire le Dashboard

*La page que tu ouvres en premier chaque matin. Chaque tuile, chaque graphique, chaque indice expliqué.*

---

## À quoi sert le Dashboard

Le Dashboard est la **lecture en un seul écran** du marché actuel. Il répond, en 30 secondes, à trois questions :

1. **Comment les dealers sont-ils positionnés ?** (le régime GEX)
2. **Que dit le tape ?** (flow + technique)
3. **Quelle est la lecture composite ?** (les signaux combinés en une seule direction)

Tu ne prends pas de décisions sur le Dashboard. Tu t'orientes. À partir de là, tu vas creuser dans la page appropriée.

## L'anatomie

### 1. L'en-tête de régime

Le haut de la page affiche le **label de régime GEX** — Positive Gamma, Negative Gamma ou Transitioning — accompagné d'une brève lecture de ce que cela signifie pour le comportement du marché en ce moment. Si tu n'as le temps que pour une seule information aujourd'hui, c'est celle-ci.

### 2. La tuile de prix

La tuile de prix principale affiche le dernier prix en direct, la variation par rapport à la clôture de la session précédente, et le badge de session. Les cotations pre-market et after-hours sont affichées avec la clôture précédente comme référence ; pendant les heures régulières, l'ouverture de la même session sert de référence.

### 3. La tuile Net GEX

La tuile Net GEX affiche le chiffre principal d'exposition gamma — calculé **au spot** afin de refléter le bon côté du gamma flip. Un chiffre positif signifie que les dealers sont net long gamma ; négatif, qu'ils sont net short. La couleur et le chip de tendance renforcent le signe et la direction.

### 4. La tuile Gamma Flip

Distance au flip — à la fois en strike et en pourcentage du spot. Le flip est le niveau où la courbe de gamma des dealers croise zéro. Au-dessus du flip, le hedging des dealers amortit les mouvements ; en dessous, il les amplifie. Plus tu es proche du flip, plus le risque structurel d'un changement de régime est élevé.

### 5. Les tuiles Call Wall / Put Wall

Les strikes avec le plus grand gamma call et gamma put respectivement. Ils ont tendance à agir comme résistance et support intraday, en particulier lorsque le marché est en gamma positif. Voir [Gamma Walls Explained](/education/gamma-walls-explained) pour la lecture structurelle.

### 6. La tuile Max Pain

Le strike qui minimise la valeur totale en dollars des options en circulation à l'expiration. Le plus pertinent dans les dernières 24 à 48 heures avant une expiration significative. Voir [Max Pain Explained](/education/max-pain-explained).

### 7. Les tuiles de Volatilité

IV en direct, IV rank et volatilité réalisée avec sparklines. Utiles pour le dimensionnement — un Squeeze Setup à faible volatilité réalisée est un trade différent d'un Squeeze Setup à forte volatilité.

### 8. La section Trade Bias

Un chip de bias combiné ("Long bias", "Short bias", "Neutral") avec les inputs contributifs en dessous. C'est une synthèse de lecture descendante — **ce n'est pas** un signal de trading.

### 9. Le panneau Composite Score

Le composite score MSI, l'état du trigger et les poids des signaux contributifs. Pour le détail complet, clique sur [Composite Score](/help/platform/composite-score).

### 10. Le snapshot Flow

Une brève lecture du flow pondéré par la prime, du bias smart-money et du volume net — trois façons différentes de regarder le tape. Les pages complètes se trouvent dans [Flow Analysis](/help/platform/flow-analysis) et [Smart Money](/help/platform/smart-money).

## Comment le dashboard se met à jour

Les tuiles se mettent à jour en direct. La plupart se rafraîchissent chaque seconde pendant les heures de négociation régulières. La surface GEX se rafraîchit à une cadence légèrement plus lente — typiquement toutes les 5 à 15 secondes — car le snapshot de la chaîne sous-jacente est le goulot d'étranglement. Il n'est pas nécessaire de recharger la page.

## Pre-market, after-hours et marché fermé

Le Dashboard s'adapte à la session :

- **Pre-market / After-hours** — la cotation en heures étendues est affichée avec la clôture de la session régulière précédente.
- **Fermé** — la clôture la plus récente de la session régulière est affichée ; les signaux reflètent le dernier état calculé.

Regarde le badge de session dans la ligne de prix pour confirmer.

## Lire le Dashboard en 30 secondes

La discipline :

1. Lis le **label de régime**.
2. Lis **Net GEX** et la **distance au flip**.
3. Lis **call wall et put wall** — ce sont tes niveaux.
4. Lis le **trade bias** et le **composite score**.
5. Décide quelle page ouvrir pour le trade proprement dit.

C'est tout. Si tu te surprends à passer plus de 30 secondes ici, tu as cessé de t'orienter et commencé à analyser — va sur la page de signal concernée.

## Voir aussi

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Using the Live Bulletin](/help/platform/live-bulletin)
