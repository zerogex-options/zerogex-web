# Squeeze Setup, Positioning Trap et Trap Detection : Trois Signaux, Trois Histoires

Si vous avez passé du temps dans l'onglet Signals, vous avez sans doute remarqué trois noms qui semblent mesurer la même chose : Squeeze Setup, Positioning Trap et Trap Detection. Tous les trois produisent un nombre bien ordonné entre −1 et +1. Tous les trois changent de signe selon la direction. Et tous les trois s'activent autour des mêmes types de points de bascule.

Mais sous le capot, ils répondent à trois questions très différentes sur le tape. Comprendre à quelle question chacun répond fait toute la différence entre anticiper un breakout et se faire écraser par lui.

Cet article détaille ce que mesure réellement chaque signal, comment l'interpréter et — surtout — quand *ne pas* trader en fonction de lui.

---

## La Version en 30 Secondes

| | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Question posée | « Le marché est-il comprimé ? » | « La foule est-elle mal positionnée ? » | « Ce breakout vient-il d'échouer ? » |
| Biais de Trading | Continuation (dans le sens du mouvement) | Retour à la moyenne (contre la foule) | Retour à la moyenne (à travers le niveau cassé) |
| Horizon | Setup multi-jours | Intraday (5–10 min) | Intraday → overnight |
| Inputs Principaux | Flow, accélération du momentum, disponibilité gamma | Ratio put/call, déséquilibre smart-money | Proximité des walls, régime gamma, migration des walls |
| Output | [-1, +1], déclenché à ±0,25 | [-1, +1], continu | [-1, +1], déclenché à ±0,25 |

Trois signaux. Trois thèses. Une même droite numérique.

---

## Squeeze Setup — « Le Ressort Comprimé »

**Ce qu'il mesure :** Si la volatilité implicite s'est comprimée, si le gamma est dense et si le flow commence à s'orienter directionnellement — autrement dit, si le marché a accumulé de l'énergie potentielle pour un breakout.

**Inputs :**

- Deltas de flow calls et puts, normalisés en z-score selon la volatilité de flow par symbole
- Momentum sur 5 barres vs. 10 barres (pour détecter l'accélération, pas seulement la direction)
- Net gamma exposure, passée dans une tanh lissée pour la « disponibilité gamma »
- Distance au strike de gamma flip
- Régime du VIX (mort / normal / élevé / panique)

**Comment il est calculé :** Pour chaque côté (bull et bear), le signal multiplie flow normalisé × force du momentum directionnel × disponibilité gamma × multiplicateur d'accélération × multiplicateur de côté-flip. Le score net est bull moins bear, borné à [-1, +1]. Les triggers se déclenchent lorsque abs(score) ≥ 0,25.

**Ce qu'un trader en fait :** Un Squeeze Setup positif qui persiste sur deux séances consécutives est la porte de déclenchement du playbook Squeeze Breakout — entrée sur une cassure nette d'une enveloppe de volatilité à 30 barres, dans la direction vers laquelle penche le signal. Les scores négatifs reflètent cela à la baisse.

> **Intuition clé :** Squeeze Setup est le seul des trois qui vous invite à trader *dans le sens* du mouvement. C'est un signal de continuation.

---

## Positioning Trap — « Le Trade Surpeuplé »

**Ce qu'il mesure :** Si la foule d'options est positionnée de manière déséquilibrée (fortement long ou fortement short) et que le tape commence à invalider ce biais — le setup classique d'un short-cover squeeze ou d'un long-side flush.

**Inputs :**

- Momentum sur 5 barres
- Ratio put/call (la mesure de l'encombrement)
- Déséquilibre smart-money signé : (call_signed − put_signed) / (abs(call) + abs(put))
- Proximité du gamma flip
- Régime de Net GEX (lissé via tanh)

**Comment il est calculé :** Une somme pondérée — 0,45 sur l'encombrement, 0,25 sur le biais du déséquilibre, 0,15 sur le momentum, 0,10 sur l'inclinaison du flip, 0,05 sur le régime de GEX négatif — calculée indépendamment pour le côté squeeze (foule long à risque) et le côté flush (foule short à risque). Les deux sont compensés en un score unique.

Contrairement aux deux autres, Positioning Trap n'a pas de flag de trigger — il alimente le composite MSI comme composante continue (poids 0,06) et ouvre le playbook `positioning_trap_squeeze` lorsque abs(score) ≥ 0,5.

**Ce qu'un trader en fait :** Identifier le côté surpeuplé, puis attendre que le tape se retourne contre lui. Une foule long ne subit pas de squeeze tant que les vendeurs ne se montrent pas. Le signal vous indique que le carburant est présent ; c'est au tape de fournir l'étincelle.

> **Intuition clé :** Positioning Trap parie contre le pari de la foule.

---

## Trap Detection — « Le Breakout Raté »

**Ce qu'il mesure :** Si le prix a percé un niveau structurel clé — call wall, put wall, VWAP, strike de gamma maximal ou gamma flip — mais échoue à soutenir le mouvement, signalant que les dealers vont le faire refluer.

**Inputs :**

- Call wall et put wall — ainsi que leurs positions antérieures (pour détecter la migration des walls)
- Strike de gamma maximal, VWAP, gamma flip
- Net GEX et le taux de variation du Net GEX
- Deltas de flow calls/puts (en quête de décélération)
- Volatilité réalisée (utilisée pour calibrer le buffer de breakout)

**Comment il est calculé :** Le signal identifie d'abord le niveau cassé le plus proche au-dessus et en dessous de la clôture, et applique un buffer calibré sur la volatilité (~0,15 % × σ × √5) pour confirmer une cassure réelle. Puis, pour chaque côté, il multiplie la force du breakout × facteur continu de long-gamma × facteur de renforcement du GEX × pénalité de migration des walls × magnitude × multiplicateur de flow.

Le contrôle de migration des walls est ce qui distingue ce signal : si le wall s'est éloigné du prix, le breakout est réel, pas un piège, et le score est fortement pénalisé.

**Ce qu'un trader en fait :** Un fade baissier déclenché (le prix a cassé à la hausse, mais les dealers sont long gamma et le flow décélère) est la porte du playbook Overnight Trap Continuation — un débit 1DTE positionné contre le faux breakout, conservé jusqu'à la séance suivante. Les fades haussiers reflètent cela à la baisse.

> **Intuition clé :** Trap Detection parie contre la cassure d'un niveau structurel par le prix.

---

## Même Chiffre, Signification Différente

Voici le piège qui piège les traders : les trois signaux affichent un score [-1, +1], et un +0,6 sur l'un n'est pas le même trade qu'un +0,6 sur un autre.

| Signe du Score | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Positif (+) | Acheter le breakout haussier | Parier contre la foule short → squeeze haussier | Acheter le breakdown raté |
| Négatif (−) | Vendre le breakout baissier | Parier contre la foule long → flush baissier | Vendre le breakout raté |
| Zéro (0) | Pas d'énergie comprimée / pas d'inclinaison de flow | Pas d'extrême de foule | Aucun niveau structurel n'échoue |

Un 0 ne signifie pas « marché neutre ». Cela signifie que *cette question précise n'a pas de réponse pour l'instant*. Squeeze Setup à 0 ne vous dit pas que le positionnement est équilibré — cela vous dit que rien n'est comprimé. Trap Detection à 0 ne vous dit pas que la foule va bien — cela vous dit qu'aucun niveau n'est en train d'être rejeté.

Trois signaux lisent le même tape à travers trois prismes différents. Traitez-les comme tels.

---

## Comment les Lire Ensemble

Quelques schémas à surveiller :

**Confluence (forte conviction) :** Squeeze Setup +0,5 et Trap Detection +0,4 → le marché est comprimé à la hausse et une cassure baissière vient d'échouer. Les deux signaux pointent vers le même trade sous des angles différents.

**Séquence (meilleures entrées) :** Positioning Trap signale une foule long à +0,7 → attendez. Trap Detection bascule ensuite en négatif (la cassure haussière échoue) → c'est l'étincelle. Tradez le fade avec la foule comme carburant.

**Contradiction (restez à l'écart) :** Squeeze Setup indique +0,6 (aller long sur la cassure). Trap Detection indique −0,5 (la cassure haussière échoue). L'un des deux se trompe. Passez votre tour.

Les signaux sont indépendants pour une raison — quand ils s'accordent, écoutez-les. Quand ils se contredisent, le trade le plus intelligent consiste généralement à ne pas trader.
