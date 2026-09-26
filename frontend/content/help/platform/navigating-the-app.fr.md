# Naviguer dans l'application

*La barre latérale, l'en-tête, le sélecteur de symboles, le sélecteur de période et les bascules de thème.*

---

## La barre latérale

La barre latérale gauche est le principal moyen de se déplacer dans l'application. Elle est organisée en groupes :

- **Accueil** - Tableau de bord principal, Mon tableau de bord, Gamma Terminal, Bulletin en direct
- **Signaux** - Trade Bias, Score composite, le Tableau de signaux basique et le Tableau de signaux avancé (chacun extensible vers les pages de signaux individuelles)
- **TradeWorkz™** - Trading par bots, Backtesting, Analyse des motifs
- **Indicateurs** - Positioning, Options Flow et Market Context, chacun extensible vers ses pages
- **Outils de stratégie** - Générateur de stratégies, Cotations d'options en direct, Premium Surface
- **Justificatifs** - les prévisions du jour et intrajournalière, l'historique des prévisions, le bilan des signaux du jour et la relecture de séance
- **Formation** - Hub, Guides, Articles et Aide (chacun extensible)
- **Plus** - À propos, Intégrations, API Specs, Assistance, Compte

Chaque groupe peut être réduit ou développé. Cliquez sur l'en-tête du groupe pour basculer son état. Les pages encore en développement portent un badge **Beta**.

### Favoris

Survolez une page dans la barre latérale et cliquez sur l'icône d'épingle à côté pour l'ajouter aux **Favoris**, un groupe en haut de la barre latérale pour les pages que vous utilisez le plus. Cliquez à nouveau sur l'épingle pour la retirer. Les favoris sont enregistrés dans votre navigateur.

### Afficher et masquer la barre latérale

Toute la barre latérale peut être masquée. Survolez le bord droit de la barre latérale : un onglet en forme de chevron apparaît - cliquez dessus pour la masquer. Cliquez sur le petit onglet chevron du bord gauche pour la faire réapparaître. La préférence est mémorisée d'une session à l'autre.

## L'en-tête

L'en-tête reste fixe en haut de chaque page d'analyse et affiche :

- Le logo et un lien retour vers l'accueil
- Le sélecteur de symboles et le cours en temps réel du symbole actif, avec sa variation du jour
- Un badge de session - Pre-market, Market Open, After Hours, Closed ou Futures, lorsque SPX ou NDX affiche son contrat à terme pendant la nuit. Cliquez dessus pour afficher un compte à rebours jusqu'à l'ouverture ou la clôture.
- La bascule de thème (soleil / lune) et le menu des palettes
- Des horloges pour New York, Londres et Tokyo, un calendrier des options et les principaux titres de l'actualité
- Un bouton appareil photo qui enregistre une capture PNG de la page affichée
- Le menu de langue, la recherche et votre menu de profil (Compte, Passer à l'offre supérieure, Se déconnecter)

Vous pouvez réduire l'en-tête pour récupérer de l'espace vertical - la préférence se synchronise avec la carte récapitulative compacte de la barre latérale.

## Le sélecteur de symboles

ZeroGEX couvre **SPY**, **SPX**, **QQQ** et **NDX**, ainsi que les contrats à terme **ES** et **NQ**. Le sélecteur de symboles se trouve dans l'en-tête. Choisir un symbole met à jour chaque page de la plateforme - le tableau de bord, les signaux, les graphiques - avec ce symbole, et votre choix est mémorisé dans ce navigateur. ES et NQ sont lus à partir des carnets d'options SPX et NDX : les quelques pages qui listent des contrats d'options individuels ne les proposent donc pas.

## Le sélecteur de période

Les graphiques de prix - le Gamma Terminal, le Gamma Chart du Tableau de bord principal et quelques autres - disposent d'un sélecteur de période : 1 min / 5 min / 15 min / 1 h / 1 jour. Il contrôle la fenêtre glissante utilisée pour le graphique, pas la logique de signal sous-jacente. Le score du signal lui-même est calculé en continu.

## Thème

ZeroGEX est disponible en mode sombre et clair. Le mode sombre est celui par défaut. La bascule soleil / lune de l'en-tête passe de l'un à l'autre, et le menu des palettes, juste à côté, propose plusieurs palettes de couleurs. Connecté, votre choix est enregistré dans votre compte et vous suit sur vos autres appareils ; sans connexion, il est enregistré dans le navigateur.

## Éléments de menu selon le niveau d'abonnement

Connecté, les pages que votre formule n'inclut pas portent un badge cadenas (🔒 Basic ou 🔒 Pro) ; un clic sur l'une d'elles vous mène vers [Pricing](/pricing) plutôt que vers la page restreinte. Sans connexion, ou sans formule, le menu ne liste que les pages que vous pouvez ouvrir. Les entrées réservées aux administrateurs sont entièrement masquées.

## Aperçu rapide de l'anatomie des pages

Les pages Indicateurs partagent le même en-tête : une fois que vous en avez lu une, les autres se parcourent rapidement.

1. **Surtitre** - le sous-groupe du menu dans lequel la page est rangée : Positioning, Options Flow ou Market Context.
2. **Titre** - le nom de la page, identique à son libellé dans le menu, avec un badge Beta si la page est en bêta.
3. **Icône d'information** - survolez-la pour l'explication complète : ce qu'est le chiffre, comment il est construit et comment l'utiliser.
4. **Chapô** - un résumé d'une ou deux phrases sous le titre.
5. **Filtres** - les réglages propres à la page, à droite.

Les pages de signaux individuelles se terminent par une section **« How it's built »** - une explication en langage clair des calculs sous-jacents.

## Voir aussi

- [Comment lire les graphiques ZeroGEX](/help/platform/reading-charts)
- [Lire le Dashboard](/help/platform/dashboard)
- [Utiliser le Live Bulletin](/help/platform/live-bulletin)
