# Advanced Signal Dashboard

*Les signaux event-driven - ce que chacun demande, quand chacun se déclenche et comment les utiliser.*

---

## Ce qu'est l'Advanced Signal Dashboard

L'Advanced Signal Dashboard (Pro) est la **grille de triggers** pour les huit signaux Advanced. Un bandeau en haut affiche les huit scores. En dessous se trouvent trois onglets - **Signal Grid**, **Confluence Matrix** et **Event Timelines**. Chaque carte de la grille affiche le score de -100 à +100, le niveau auquel elle s'active, un état *Triggered* ou *Stand by*, un sparkline et des **Context values** dépliables. EOD Pressure et 0DTE Position Imbalance affichent *Inactive* tant que leur fenêtre horaire est fermée.

Les signaux Advanced sont **event-driven**. Chacun produit un score continu et modélisé - une lecture dérivée, pas une prévision garantie -, mais le moment intéressant est celui où le score franchit le seuil de trigger du signal. Aucun des huit ne fait partie du Composite Score (MSI).

## Les huit signaux

| Signal | Demande | Biais de trading | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | « La clôture est-elle en train de se pinner ? » | Directionnel | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | « Les niveaux clés s'empilent-ils ici ? » | Mean-rev (long gamma) / Continuation (short gamma) | \|score\| ≥ 20 |
| Market Pressure Index | « Le marché est-il chargé pour bouger ? » | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | « Ce range est-il sur le point de casser ? » | Changement de régime / de playbook | imminence ≥ 65 |
| Squeeze Setup | « Le marché est-il comprimé ? » | Continuation | \|score\| ≥ 25 |
| Trap Detection | « Ce breakout vient-il d'échouer ? » | Mean-reversion (vs. cassure de prix) | \|score\| ≥ 25 |
| Volatility Expansion | « La volatilité est-elle sur le point de se détendre ? » | Continuation | \|score\| ≥ 25 |
| 0DTE Position Imbalance | « Les traders 0DTE penchent-ils d'un côté ? » | Directionnel | \|score\| ≥ 25 |

## Lecture rapide de chacun

### EOD Pressure

Actif durant les 90 dernières minutes. Monte en puissance à partir de 14h30 ET, avec un pic vers 15h45 ET. Construit à partir du dealer charm au spot, de la pin gravity, de la volatilité réalisée et des flags de witching. Traduit « la clôture *pourrait* se fixer vers X » avec une direction - un biais modélisé, car le pinning reste probabiliste.

### Gamma/VWAP Confluence

Empile le gamma flip, le VWAP, le max pain, le strike de gamma maximal et la call wall. Cherche à savoir si ces niveaux sont alignés sur un même prix. En gamma positif, les lectures de confluence sont des lectures de fade ; en gamma négatif, ce sont des lectures de continuation.

### Market Pressure Index

La lecture globale « le marché est-il chargé ». Combine le wall pinch, la proximité du flip, le régime, vanna/charm, le DNI, le skew entre le flux premium et le smart money, l'IV rank et la compression de la volatilité réalisée. Bidimensionnel : un **loading de 0 à 100** et une **direction de -1 à +1**.

### Range Break Imminence

Lecture de compression sur 20 barres. Skew delta + dealer delta + trap pressure + ratio de compression 10/60 barres. Produit à la fois un score et une imminence de 0 à 100. Se déclenche à imminence ≥ 65 - le début de la bande Break Watch (à partir de 80, c'est Breakout Mode), où la page conseille d'arrêter de fader le range à l'aveugle.

### Squeeze Setup

Détecteur de setup pluri-journalier. Z-score du flux, momentum 5/10 barres, préparation du gamma, distance au flip, régime du VIX. Biais de continuation - une lecture dérivée selon laquelle le marché *pourrait* être comprimé vers X, pas une prochaine jambe garantie.

### Trap Detection

Le détecteur de breakouts échoués. Walls (actuelle + précédente), VWAP, flip, net GEX et ΔGEX, deltas de flux. Biais de mean-reversion - signale qu'une cassure d'un niveau clé (une wall, le VWAP, le gamma flip ou le strike de gamma maximal) a de bonnes chances d'échouer lorsque les dealers sont modélisés long gamma et que le gamma se renforce ; une wall qui migre avec la cassure affaiblit la lecture. En gamma négatif, il reste à 0.

### Volatility Expansion

Fenêtre de momentum sur 5 barres, mise à l'échelle par la volatilité réalisée. Net GEX + z-score de momentum normalisé par la vol + volatilité réalisée. Cherche à savoir si la volatilité est sur le point de se détendre. Lecture de continuation.

### 0DTE Position Imbalance

Lecture sur la fenêtre 0DTE. Pondérée par les heures restantes avant la clôture. Déséquilibre du flux call/put, ratio C/P du smart money, PCR, buckets de moneyness. Indique de quel côté penchent les traders 0DTE aujourd'hui.

## Comment fonctionnent les triggers

Lorsque le trigger d'un signal se déclenche :

1. Sa carte est encadrée et teintée dans la direction du score, et son état passe de *Stand by* à *Triggered*.
2. Le Composite Score ne change pas - les signaux Advanced ne font pas partie du MSI.

Il n'y a ni alerte ni entrée de journal : rien ne vous est envoyé et rien n'arrive dans le Bulletin en direct. Une carte reste *Triggered* tant que le score se maintient au-delà de son seuil. Pour voir ce qui s'est passé plus tôt, ouvrez l'onglet **Event Timelines** ou la page du signal - la timeline trace le score sur les deux dernières sessions, avec les changements de direction marqués.

## Lire le dashboard

Deux approches :

1. **Repérer les triggers actifs.** Les cartes déclenchées sont encadrées et teintées dans la grille. Les cartes gardent un ordre fixe, alors repérez la couleur.
2. **Repérer les triggers empilés.** Deux signaux Advanced ou plus se déclenchant dans la même direction constituent la lecture à plus haute confluence de la plateforme. L'onglet **Confluence Matrix** montre quelles paires ont tendance à s'accorder. Ajoutez le composite pour la lecture structurelle.

## Chaque carte a une page d'analyse approfondie

Cliquez sur n'importe quelle carte pour accéder à la page dédiée du signal, avec le score et son historique, les inputs, l'explication "How it's built" et l'Event Timeline.

## Important : le biais de trading compte

Certains signaux Advanced sont de continuation, d'autres de mean-reversion. Trap Detection fade une *cassure de prix échouée*, pas un breakout : un score **positif** signifie qu'une cassure à la baisse a échoué (le fade est à la hausse - achetez la cassure baissière échouée), un score **négatif** qu'une cassure à la hausse a échoué (le fade est à la baisse) - l'image inversée d'un signal de continuation comme Squeeze Setup. Vérifiez toujours quel type de signal vous lisez - [Signals: Explained](/guides/signals-explained) répertorie le biais de trading de chaque signal.

## Voir aussi

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
