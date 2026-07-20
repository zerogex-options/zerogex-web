# Advanced Signal Dashboard

*Les signaux event-driven — ce que chacun demande, quand chacun se déclenche et comment les utiliser.*

---

## Ce qu'est l'Advanced Signal Dashboard

L'Advanced Signal Dashboard est la **grille de triggers** pour les huit signaux Advanced. Chaque carte affiche le score sur [-1, +1], l'état du trigger (idle, hot, tout juste déclenché) et un sparkline.

Les signaux Advanced sont **event-driven**. Chacun produit un score continu, mais le moment intéressant est celui où le score franchit le seuil de trigger du signal.

## Les huit signaux

| Signal | Demande | Biais de trading | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | « La clôture est-elle en train de se pinner ? » | Directionnel | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | « Les niveaux clés s'empilent-ils ici ? » | Mean-rev (long gamma) / Continuation (short gamma) | abs(score) ≥ 0.20 |
| Market Pressure Index | « Le marché est-il chargé pour bouger ? » | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | « Ce range est-il sur le point de casser ? » | Changement de régime / de playbook | imminence ≥ 65 |
| Squeeze Setup | « Le marché est-il comprimé ? » | Continuation | abs(score) ≥ 0.25 |
| Trap Detection | « Ce breakout vient-il d'échouer ? » | Mean-reversion (vs. cassure de prix) | abs(score) ≥ 0.25 |
| Volatility Expansion | « La volatilité est-elle sur le point de se détendre ? » | Continuation | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | « Les traders 0DTE penchent-ils d'un côté ? » | Directionnel | abs(score) ≥ 0.25 |

## Lecture rapide de chacun

### EOD Pressure

Actif durant les 90 dernières minutes. Monte en puissance à partir de 14h30 ET, avec un pic vers 15h45 ET. Construit à partir du dealer charm au spot, de la pin gravity, de la volatilité réalisée et des flags de witching. Traduit « la clôture est en train de se fixer sur X » avec une direction.

### Gamma/VWAP Confluence

Empile le gamma flip, le VWAP, le max pain, le strike de gamma maximal et la call wall. Cherche à savoir si ces niveaux sont alignés sur un même prix. En gamma positif, les lectures de confluence sont des lectures de fade ; en gamma négatif, ce sont des lectures de continuation.

### Market Pressure Index

La lecture globale « le marché est-il chargé ». Combine le wall pinch, la proximité du flip, le régime, vanna/charm, le DNI, le skew entre le flux premium et le smart money, l'IV rank et la compression de la volatilité réalisée. Bidimensionnel : un **loading de 0 à 100** et une **direction de -1 à +1**.

### Range Break Imminence

Lecture de compression sur 20 barres. Skew delta + dealer delta + trap pressure + ratio de compression 10/60 barres. Produit à la fois un score et une imminence de 0 à 100. Se déclenche à imminence ≥ 65 — ce qui signifie que le range est réellement resserré par rapport à son historique récent.

### Squeeze Setup

Détecteur de setup pluri-journalier. Z-score du flux, momentum 5/10 barres, préparation du gamma, distance au flip, régime du VIX. Biais de continuation — traduit « le marché est comprimé, la prochaine jambe est X ».

### Trap Detection

Le détecteur de breakouts échoués. Walls (actuelle + précédente), VWAP, flip, net GEX et ΔGEX, deltas de flux. Biais de mean-reversion — se déclenche lorsqu'une cassure au-dessus de la call wall ou en dessous de la put wall se rétracte brutalement.

### Volatility Expansion

Fenêtre de momentum sur 5 barres, mise à l'échelle par la volatilité réalisée. Net GEX + z-score de momentum normalisé par la vol + volatilité réalisée. Cherche à savoir si la volatilité est sur le point de se détendre. Lecture de continuation.

### 0DTE Position Imbalance

Lecture sur la fenêtre 0DTE. Pondérée par les heures restantes avant la clôture. Déséquilibre du flux call/put, ratio C/P du smart money, PCR, buckets de moneyness. Indique de quel côté penchent les traders 0DTE aujourd'hui.

## Comment fonctionnent les triggers

Lorsqu'un trigger de signal se déclenche :

1. La carte du signal sur le dashboard s'illumine dans la direction du score.
2. Une entrée apparaît dans le [Live Bulletin](/help/platform/live-bulletin) avec le score, le seuil de trigger et un contexte en une ligne.
3. Le composite reflète la conviction la plus forte.

Un signal peut rester en état « hot » sur plusieurs barres. L'entrée du bulletin affiche le **premier** franchissement du trigger ; les barres suivantes dans le même état hot sont agrégées.

## Lire le dashboard

Deux approches :

1. **Repérer les triggers actifs.** Les cartes hot remontent en haut dans la disposition par défaut.
2. **Repérer les triggers empilés.** Deux signaux Advanced ou plus se déclenchant dans la même direction constituent la lecture à plus haute confluence de la plateforme. Ajoutez le composite pour la lecture structurelle.

## Chaque carte a une page d'analyse approfondie

Cliquez sur n'importe quelle carte pour accéder à la page dédiée du signal, avec le sparkline du score, les inputs, l'historique des triggers et l'explication « Comment il est construit ».

## Important : le biais de trading compte

Certains signaux Advanced sont de continuation, d'autres de mean-reversion. Trap Detection qui se déclenche en positif ne signifie **pas** « passer long » — cela signifie « fader le breakout échoué à la baisse ». Vérifiez toujours le chip de biais de trading sur la carte.

## Voir aussi

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
