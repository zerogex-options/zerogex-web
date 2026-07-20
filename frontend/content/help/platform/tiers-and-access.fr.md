# Niveaux, accès et ce qui se débloque où

*Une carte claire des pages publiques, Basic et Pro — et de ce qui change entre les niveaux sur chaque page.*

---

## Les trois niveaux

ZeroGEX propose trois niveaux de compte. Ils déterminent quelles données et quels signaux vous voyez.

| Niveau | Pour qui | Ce que vous obtenez |
| --- | --- | --- |
| Public | Consultation, formation | Le site vitrine, l'espace éducatif, les guides, les articles, les pages gratuites de niveaux gamma SPX / SPY / QQQ (décalées de 15 minutes) |
| Basic | Traders intraday actifs | Dashboard, Live Bulletin, tous les Metrics, Strategy Builder, Live Options Quotes, tous les Basic Signals |
| Pro | Opérateurs sérieux | Tout ce qui est inclus dans Basic + tous les Advanced Signals + Composite Score + Backtesting + accès API |

Consultez la répartition en direct — et un essai de 14 jours — sur la page [Pricing](/pricing).

## Ce qui est restreint et où

### Public (aucun compte requis)

- Le site marketing (landing, About, Education Hub, Articles, Guides)
- Pages gratuites de niveaux gamma SPX, SPY et QQQ — décalées d'environ 15 minutes
- Help Center, FAQ, Quick Starts
- Confidentialité, Conditions

### Niveau Basic

- **Dashboard** — métriques complètes en temps réel
- **Live Bulletin** — flux en streaming des événements de signaux
- **Toutes les pages Metrics** — Dealer Positioning, GEX Summary & Greeks, Flow Analysis, Smart Money, Max Pain, Technicals
- **Basic Signals** — Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Strategy Builder** — pricing d'options complet et P&L
- **Live Options Quotes** — la chaîne d'options en direct

### Niveau Pro

- Tout ce qui est inclus dans Basic, plus :
- **Composite Score** — la lecture combinée de tous les signaux
- **Tous les Advanced Signals** — Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **Backtesting** — backtests historiques des signaux
- **Accès API** — les mêmes données via `api.zerogex.io`

## Ce qui change entre niveaux sur une même page

Certaines pages existent pour tous les niveaux mais se comportent différemment selon l'accès dont vous disposez :

- Le **Dashboard** est entièrement renseigné pour Basic et Pro. Les utilisateurs Public voient un aperçu qui renvoie vers la page en direct après connexion.
- La section **Signals** de la barre latérale est toujours visible — n'importe qui peut cliquer sur le nom d'un signal. Sans accès, le clic redirige vers la page [Pricing](/pricing) afin que vous voyiez ce qui le débloque.
- Les badges et puces du **Live Bulletin** sont adaptés au niveau : les éléments réservés à Pro affichent une petite puce de verrouillage pour les utilisateurs Basic.

## Comment passer à un niveau supérieur ou en changer

Les modifications de compte se font à deux endroits :

1. **[Account](/account)** — affiche votre niveau actuel, le statut de votre forfait actuel et le lien vers le portail de facturation.
2. **[Stripe Billing Portal](/account)** — accessible depuis la page Account. Changez entre Basic et Pro, passez de mensuel à annuel, modifiez le moyen de paiement, consultez les factures.

Pour un guide pas à pas, consultez [Billing & Stripe Portal](/help/platform/billing).

## Lorsque vous êtes en période d'essai

Si votre compte est en période d'essai gratuite (Basic ou Pro), la page Account affiche une puce « Trial active — X days left ». À la fin de l'essai, l'abonnement se poursuit automatiquement au tarif auquel vous vous êtes inscrit. Pour l'éviter, annulez dans le portail de facturation avant l'expiration de l'essai.

## Que se passe-t-il si vous cliquez sur quelque chose auquel vous n'avez pas accès ?

Vous êtes redirigé vers la page [Pricing](/pricing) plutôt que bloqué ou confronté à une erreur. La landing page de Pricing vous indique exactement quel niveau débloque la page que vous avez tenté d'ouvrir.

## Voir aussi

- [Pricing](/pricing) — la répartition en direct des niveaux et le parcours d'essai
- [Account Settings](/help/platform/account)
- [Billing & Stripe Portal](/help/platform/billing)
