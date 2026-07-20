# Alertes de signaux

*Comment les déclenchements de signaux apparaissent dans la plateforme, ce qui se déclenche par rapport à ce qui reste silencieux, et comment utiliser le Live Bulletin comme journal de vos alertes.*

---

## Où les alertes apparaissent

ZeroGEX délivre les alertes **dans l'application**, pas par SMS ni notification push. Elles apparaissent à trois endroits :

1. **Live Bulletin** — chaque déclenchement y atterrit avec le contexte complet. C'est votre journal d'audit.
2. **La carte de signal** — sur le dashboard ou la page de liste des signaux, un déclenchement illumine la carte et la teinte dans la direction du score.
3. **Le panneau composite** — lorsqu'un déclenchement a une conviction suffisamment élevée, il déplace visiblement le composite.

C'est intentionnel. ZeroGEX est conçu pour être **observé, pas interrompu**. Les alertes de type push provoquent de l'overtrading ; le journal in-app vous permet de consulter quand vous le décidez.

## Ce qui se déclenche

Seuls les déclenchements de signaux Advanced et les événements structurels se déclenchent :

- Les huit signaux Advanced lorsque leurs seuils de déclenchement sont franchis.
- Les croisements de gamma flip.
- Les transitions de régime (gamma positif ↔ négatif au spot).
- Les migrations de wall de plus de 0,5 % par rapport au niveau précédent.
- Les événements de flow notables (block prints, clusters de sweep, mouvements de smart money).

Les signaux Basic ne se déclenchent **pas**. Ce sont des inputs continus pour le composite.

## Comment un déclenchement atterrit

Lorsqu'un déclenchement franchit son seuil :

1. Le score du signal est enregistré au moment du croisement.
2. La ligne du Live Bulletin est créée avec horodatage, direction, score, seuil et contexte.
3. La carte de signal sur chaque page reflète le nouvel état.
4. Le composite se met à jour.

Si un signal reste en état de déclenchement sur plusieurs barres, seul le **premier** événement de déclenchement est enregistré dans le bulletin. Les barres suivantes sont agrégées dans l'entrée existante.

## Référence des seuils de déclenchement

| Signal | Seuil |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

## Pourquoi certains signaux ne se déclenchent pas

Un signal peut être à +0.7 et **ne pas** être en état de déclenchement. Raisons possibles :

- Le seuil de déclenchement du signal utilise un composite (Market Pressure nécessite aussi loading ≥ 50).
- Le signal est conditionné par une fenêtre de session (EOD Pressure n'est actif que de 14:30 à 15:45 ET).
- Le signal a un debounce — il doit maintenir le seuil pendant un nombre minimum de barres.

La carte de signal sur la page explique l'état actuel du déclenchement en langage clair.

## Utiliser le bulletin comme journal de vos alertes

Le Live Bulletin est le **système de référence** pour les déclenchements. Si vous étiez parti déjeuner, vous n'ouvrez pas chaque page pour voir ce qui s'est déclenché — vous ouvrez le bulletin, filtrez par symbole et famille de signaux, et lisez les événements de la journée dans l'ordre chronologique.

## Ce qui arrive bientôt

Nous n'envoyons actuellement pas d'alertes par e-mail, SMS, notification push ou webhook. Si la demande le justifie, ces canaux pourront être ajoutés — écrivez à [support@zerogex.io](mailto:support@zerogex.io) pour voter.

## Voir aussi

- [Utiliser le Live Bulletin](/help/platform/live-bulletin)
- [Comment fonctionnent les signaux de bout en bout](/help/platform/signals-overview)
- [Préférences e-mail](/help/platform/email-preferences)
