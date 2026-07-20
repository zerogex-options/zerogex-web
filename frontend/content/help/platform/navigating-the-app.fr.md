# Naviguer dans l'application

*La barre latérale, le sélecteur de symboles, le sélecteur de période, les bascules de thème et les raccourcis clavier qui accélèrent le quotidien.*

---

## La barre latérale

La barre latérale gauche est le principal moyen de se déplacer dans l'application. Elle est organisée en groupes :

- **Main** — Dashboard, Live Bulletin
- **Signals** — Composite Score, Signaled Trades, le Basic Signal Dashboard et l'Advanced Signal Dashboard (chacun extensible vers les pages de signaux individuelles)
- **Metrics** — Dealer Positioning, GEX Summary, Flow Analysis, Smart Money, Max Pain, Technicals
- **Strategy Tools** — Strategy Builder, Live Options Quotes, Backtesting
- **Education** — Hub, Help, Guides (extensible), Articles (extensible)
- **More** — About, API Specs, Account

Chaque groupe peut être réduit ou développé. Cliquez sur l'en-tête du groupe pour basculer son état.

### Afficher et masquer la barre latérale

Toute la barre latérale peut être masquée. Survolez le bord droit de la barre latérale : un onglet en forme de chevron apparaît — cliquez dessus pour la masquer. Cliquez sur le petit onglet chevron du bord gauche pour la faire réapparaître. La préférence est mémorisée d'une session à l'autre.

## L'en-tête

L'en-tête reste fixe en haut de chaque page d'analyse et affiche :

- Le logo et un lien retour vers l'accueil
- Le symbole actif et son cours en temps réel
- Un badge de session — Pre-market, Open, After-Hours ou Closed
- La bascule de thème (soleil / lune)

Vous pouvez réduire l'en-tête pour récupérer de l'espace vertical — la préférence se synchronise avec la carte récapitulative compacte de la barre latérale.

## Le sélecteur de symboles

ZeroGEX couvre **SPY**, **SPX** et **QQQ**. Le sélecteur de symboles se trouve dans l'en-tête. Choisir un symbole met à jour chaque page de la plateforme — tuiles du tableau de bord, signaux, graphiques — avec ce symbole.

## Le sélecteur de période

La plupart des pages basées sur des graphiques disposent d'un sélecteur de période — 1 min / 5 min / 15 min / 1 h / 1 jour. Il contrôle la fenêtre glissante utilisée pour le graphique, pas la logique de signal sous-jacente. Le score du signal lui-même est calculé en continu.

## Thème

ZeroGEX est disponible en mode sombre et clair. Le mode sombre est celui par défaut. La bascule se trouve dans l'en-tête. La préférence est enregistrée par navigateur.

## Raccourcis clavier

Un petit ensemble de raccourcis accélère l'utilisation quotidienne :

- `/` — donne le focus au sélecteur de symboles
- `t` — bascule le thème
- `b` — affiche/masque la barre latérale
- `?` — affiche la palette des raccourcis

Ces raccourcis ne remplacent volontairement pas les raccourcis par défaut du navigateur (Cmd/Ctrl + n'importe quelle touche).

## Le bouton Live Bulletin

Le lien Live Bulletin dans la barre latérale affiche un petit badge lorsqu'il y a des événements non lus depuis votre dernière ouverture. Cliquez dessus et le badge disparaît.

## Éléments de menu selon le niveau d'abonnement

Si vous n'avez pas accès à une page, l'élément de menu vous redirige vers [Pricing](/pricing) au clic plutôt que vers la page restreinte. Les entrées réservées aux administrateurs sont entièrement masquées.

## Aperçu rapide de l'anatomie des pages

Chaque page d'analyse de ZeroGEX suit la même anatomie :

1. **Ligne de titre** — le nom de la page et un court sous-titre.
2. **Métrique ou graphique principal** — la lecture phare.
3. **Bandeau de contexte** — étiquette de régime, puce de biais de trading, état déclenché/inactif.
4. **Panneaux de support** — les données qui alimentent la métrique phare.
5. **« How it's built »** — une explication en langage clair des calculs sous-jacents.

Une fois qu'on a lu une page selon cette anatomie, chaque autre page se parcourt rapidement.

## Voir aussi

- [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts)
- [Lire le Dashboard](/help/platform/dashboard)
- [Utiliser le Live Bulletin](/help/platform/live-bulletin)
