# Niveaux, accès et ce qui se débloque où

*Une carte claire des pages publiques, Basic et Pro - et de ce qui change entre les niveaux sur chaque page.*

---

## Les trois niveaux

ZeroGEX propose trois niveaux de compte. Ils déterminent quelles données et quels signaux vous voyez.

| Niveau | Pour qui | Ce que vous obtenez |
| --- | --- | --- |
| Public | Consultation, formation | Le site vitrine, l'espace éducatif, les guides, les articles, le Gamma Terminal et les pages gratuites de niveaux gamma SPX / SPY / QQQ / NDX / ES / NQ (décalées d'environ 15 minutes), ainsi que les pages Justificatifs |
| Basic | Traders intraday actifs | Tableau de bord principal, Mon tableau de bord, le Gamma Terminal en direct, Bulletin en direct, tous les Indicateurs, Générateur de stratégies, Cotations d'options en direct, Premium Surface, tous les Basic Signals |
| Pro | Opérateurs sérieux | Tout ce qui est inclus dans Basic + Trade Bias + Score composite + tous les Advanced Signals + TradeWorkz™ (bots et backtesting) + accès API |

Consultez la répartition en direct sur la page [Pricing](/pricing). Basic mensuel inclut un essai gratuit de 7 jours ; toutes les autres formules bénéficient d'une garantie satisfait ou remboursé de 7 jours.

## Ce qui est restreint et où

### Public (aucun compte requis)

- Le site marketing (landing, About, Education Hub, Articles, Guides)
- Le [Gamma Terminal](/chart) - une vue SPY décalée d'environ 15 minutes
- Pages gratuites de niveaux gamma SPX, SPY, QQQ, NDX, ES et NQ - décalées d'environ 15 minutes
- Les pages Justificatifs - la prévision du jour et son cône intrajournalier, l'historique des prévisions, le bilan quotidien des signaux et la relecture de séance
- Les pages Intégrations pour les plateformes de graphiques - les scripts TradingView et thinkorswim sont gratuits
- Help Center, FAQ, Quick Starts
- Confidentialité, Conditions

### Niveau Basic

- **Tableau de bord principal** - métriques complètes en temps réel
- **Mon tableau de bord** - votre propre tableau, composé de widgets
- **Gamma Terminal** - en direct, sur tous les symboles
- **Bulletin en direct** - un instantané dealer-gamma en direct et prêt à partager
- **Toutes les pages Indicateurs** - Positioning (Dealer Positioning, GEX Summary, GEX Strike Profile, GEX Heatmap, Gamma Shift, Pair Comparison, Max Pain), Options Flow (Flow Analysis, Hedging Flow, Forced Flow, Smart Money, Market Tide) et Market Context (Volatility, Technicals, Spread Monitor)
- **Basic Signals** - Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Générateur de stratégies** - pricing d'options complet et P&L
- **Cotations d'options en direct** - la chaîne d'options en direct
- **Premium Surface** - la valeur temps des options et la distance au point mort, par strike et par échéance

### Niveau Pro

- Tout ce qui est inclus dans Basic, plus :
- **Trade Bias** - le détail complet derrière la carte Trade Bias du tableau de bord
- **Score composite** - la page complète du MSI, la lecture de 0 à 100 du régime de marché (Basic voit le MSI lui-même sur le Tableau de bord principal)
- **Tous les Advanced Signals** - Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **TradeWorkz™** (bêta) - Trading par bots, Backtesting et Analyse des motifs
- **Accès API** - des clés API personnelles pour les mêmes données via `api.zerogex.io`, qui alimentent aussi les indicateurs NinjaTrader et Sierra Chart à mise à jour automatique

## Ce qui change entre niveaux sur une même page

Certaines pages existent pour tous les niveaux mais se comportent différemment selon l'accès dont vous disposez :

- Le **Gamma Terminal** est ouvert à tous. Les visiteurs voient une vue SPY décalée d'environ 15 minutes ; Basic et Pro le voient en direct, sur tous les symboles.
- Le **Tableau de bord principal** nécessite Basic. Sans connexion, l'ouvrir vous mène à la place vers la page gratuite des niveaux gamma SPX. Avec Basic, la carte Regime Triggers, réservée à Pro, affiche un bouton **Unlock with Pro**.
- **Mon tableau de bord** nécessite Basic. Avec Basic, les widgets réservés à Pro affichent une carte de mise à niveau à leur place.
- La **barre latérale** suit votre formule. Connecté, les pages au-dessus de votre formule portent un badge cadenas (par exemple 🔒 Pro), et un clic sur l'une d'elles ouvre [Pricing](/pricing). Sans connexion, ou sans formule, le menu ne liste que ce que vous pouvez ouvrir.

## Comment passer à un niveau supérieur ou en changer

Les modifications de compte se font à deux endroits :

1. **[Compte](/account)** - affiche votre niveau actuel, le statut de votre forfait actuel et le lien vers le portail de facturation.
2. **[Stripe Billing Portal](/account)** - accessible depuis la page Compte. Changez entre Basic et Pro, passez d'une facturation mensuelle, trimestrielle ou annuelle à une autre, modifiez le moyen de paiement, consultez les factures.

Pour un guide pas à pas, consultez [Facturation et portail Stripe](/help/platform/billing).

## Lorsque vous êtes en période d'essai

L'essai gratuit de 7 jours est réservé à Basic mensuel (un par compte). Environ 48 heures avant sa fin, nous vous envoyons un rappel par e-mail avec le montant qui sera prélevé. À la fin de l'essai, l'abonnement se poursuit automatiquement au tarif auquel vous vous êtes inscrit. Pour l'éviter, annulez avant l'expiration de l'essai - dans le portail de facturation ou via **Cancel subscription** sur la page Compte - et vous ne serez pas facturé.

Passer à Pro, ou à une formule trimestrielle ou annuelle, pendant l'essai met fin à l'essai et facture la nouvelle formule le jour même ; la page [Pricing](/pricing) affiche le montant exact et vous demande de confirmer, et ce paiement est couvert par la garantie satisfait ou remboursé de 7 jours.

## Que se passe-t-il si vous cliquez sur quelque chose auquel vous n'avez pas accès ?

Depuis le menu, une page verrouillée vous mène à [Pricing](/pricing) plutôt qu'à une erreur. Si vous ouvrez directement une page restreinte - depuis un favori ou un lien partagé -, vous verrez un écran de déverrouillage qui indique la formule qui l'inclut, avec un bouton pour obtenir cette formule. Sans connexion, il vous sera d'abord demandé de vous connecter.

## Voir aussi

- [Pricing](/pricing) - la répartition en direct des niveaux et les formules
- [Paramètres du compte](/help/platform/account)
- [Facturation et portail Stripe](/help/platform/billing)
