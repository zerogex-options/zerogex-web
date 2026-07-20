# Guide ZeroGEX™ : les Signaux, Expliqués

*Tous les signaux ZeroGEX sur une seule page — ce que chacun demande, l'horizon temporel qu'il lit, quand il se déclenche, et ce que signifie réellement un score positif, négatif ou nul.*

---

## Comment lire ce guide

ZeroGEX fait tourner deux familles de signaux, et elles se comportent différemment par conception.

Les **signaux Advanced** répondent à une question précise et situationnelle ("la clôture est-elle en train de se figer sur un niveau ?", "ce breakout vient-il d'échouer ?"). Chacun produit un score sur une échelle **[-1, +1]** *et* un **trigger** discret : dès que le score franchit le seuil du signal, il déclenche une alerte et peut activer un playbook. Ils sont pilotés par des événements.

Les **signaux Basic** sont continus. Ils ne "se déclenchent" pas — ils alimentent plutôt le **composite MSI** avec un poids fixe, poussant la lecture combinée vers le haut ou vers le bas à chaque rafraîchissement. On les voit comme des inputs pour la vue d'ensemble, pas comme des alertes autonomes.

Trois points valent la peine d'être intériorisés avant les tableaux :

- L'échelle de score est toujours **[-1, +1]**. Le signe indique la direction ; l'ampleur indique la conviction.
- Un score de **0 ne signifie presque jamais "marché neutre".** Pour la plupart des signaux, cela signifie que *les données sont insuffisantes* ou que *cette question précise n'a pas de réponse en ce moment*. Ne lisez pas un 0 comme un feu vert.
- Les signaux Advanced **déclenchent** ; les signaux Basic **pondèrent**. C'est pourquoi vous voyez des alertes de type "BULLISH FADE" pour certains signaux et jamais pour d'autres.

---

## La version en 30 secondes

Ce que demande chaque signal, le biais vers lequel il penche, la fenêtre qu'il lit, les inputs principaux qui le pilotent, et comment il se manifeste.

### Signaux Advanced

| Signal | Demande | Trade Bias | Timeframe | Inputs Principaux | Trigger / Output |
| --- | --- | --- | --- | --- | --- |
| EOD Pressure | "La clôture est-elle en train de se figer sur un niveau ?" | Lecture directionnelle | 90 dernières min (monte en puissance 14:30–15:45 ET) | Charm du dealer au spot, gravité de pin, vol réalisée, flags de witching | Score [-1, +1] ; se déclenche à abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | "Des niveaux clés sont-ils en train de s'empiler ici ?" | Mean-rev (long gamma) / Continuation (short gamma) | Intraday continu | Gamma flip, VWAP, max pain, strike de max-gamma, call wall | Score [-1, +1] ; se déclenche à abs(score) ≥ 0.20 |
| Market Pressure | "Le marché est-il chargé pour bouger, et dans quel sens va-t-il casser ?" | Continuation | Prospectif ; mélange vanna→charm pondéré par la session | Wall pinch, proximité du flip, régime de net-GEX, vanna/charm du dealer, DNI, skew entre premium et flow smart-money, IV rank, squeeze de vol réalisée | Score [-1, +1] plus loading 0–100 ; se déclenche à loading ≥ 50 ET \|direction\| ≥ 0.20 |
| Range Break Imminence | "Ce range est-il sur le point de casser ?" | Changement de régime / playbook | Fenêtre de 20 barres | Skew delta, delta du dealer, trap pressure, ratio de compression 10/60 barres | Score [-1, +1] plus imminence 0–100 ; se déclenche à imminence ≥ 65 |
| Squeeze Setup | "Le marché est-il comprimé comme un ressort ?" | Continuation | Setup multi-jours | Z-score du flow, momentum 5/10 barres, gamma readiness, distance au flip, régime VIX | Score [-1, +1] ; se déclenche à abs(score) ≥ 0.25 |
| Trap Detection | "Ce breakout vient-il d'échouer ?" | Mean-reversion (vs. cassure de prix) | De l'intraday à l'overnight | Walls (actuels + précédents), VWAP, flip, net GEX et ΔGEX, deltas de flow | Score [-1, +1] ; se déclenche à abs(score) ≥ 0.25 |
| Vol Expansion | "La volatilité est-elle sur le point d'exploser ?" | Continuation | Fenêtre de momentum sur 5 barres | Net GEX, z-score de momentum normalisé par la vol, vol réalisée | Score [-1, +1] ; se déclenche à abs(score) ≥ 0.25 |
| Zero DTE Position Imbalance | "Les traders 0DTE penchent-ils d'un côté ?" | Lecture directionnelle | Session 0DTE (pondérée par les heures avant la clôture) | Déséquilibre de flow call/put, ratio C/P smart-money, PCR, buckets de moneyness | Score [-1, +1] ; se déclenche à abs(score) ≥ 0.25 |

### Signaux Basic

| Signal | Demande | Trade Bias | Timeframe | Inputs Principaux | Poids dans le Composite |
| --- | --- | --- | --- | --- | --- |
| Dealer Delta Pressure | "Les dealers sont-ils contraints de courir après ce mouvement ?" | Lecture directionnelle | Intraday immédiat | Delta net du dealer (call_delta_oi + put_delta_oi), distribution de l'OI par strike | Poids MSI 0.08 |
| GEX Gradient | "Le gamma est-il empilé d'un côté ?" | Lecture directionnelle | Snapshot par strike (au rafraîchissement du GEX) | Gamma au-dessus du spot, gamma en dessous du spot, concentration ATM, fraction sur les ailes, vol réalisée | Poids MSI 0.08 |
| Positioning Trap | "La foule est-elle mal positionnée ?" | Mean-reversion (vs. foule) | Intraday (5–10 min) | PCR, déséquilibre signé de smart-money, momentum 5 barres, inclinaison au flip, régime de net GEX | Poids MSI 0.06 |
| Skew Delta | "À quel point la peur est-elle pariée sur les puts ?" | Lecture directionnelle | Intraday (au rafraîchissement des cotations) | IV des puts OTM, IV des calls OTM, spread vs. baseline | Poids MSI 0.04 |
| Tape Flow Bias | "De quel côté penche le tape ?" | Continuation | Courte fenêtre glissante (Lee-Ready) | Premium d'achat/vente sur les calls, premium d'achat/vente sur les puts, flow total de premium | Poids MSI 0.08 |
| Vanna/Charm Flow | "La vol ou le temps vont-ils forcer les dealers à se re-couvrir ?" | Continuation | Intraday (le charm monte dans les 2 dernières heures) | Vanna agrégée du dealer, charm agrégé du dealer, multiplicateur de charm selon l'heure de session | Poids MSI 0.04 |

---

## Ce que signifie le signe du score

Même échelle numérique, questions très différentes. Voici ce que signifient positif, négatif et zéro pour chaque signal — lisez attentivement la **colonne du zéro**, c'est là que se produisent la plupart des mauvaises lectures.

### Signaux Advanced

| Signal | Score positif | Score négatif | Zéro |
| --- | --- | --- | --- |
| EOD Pressure | Pression de pin haussière (charm à l'achat + gamma qui tire vers le haut) | Pression de pin baissière (charm à la vente + gamma qui tire vers le bas) | Aucune compression de pin ni activité de charm dans la fenêtre finale |
| Gamma/VWAP Confluence | Prix au-dessus du cluster de confluence (fade vers le bas sous long gamma / accélération vers le haut sous short gamma) | Prix en dessous du cluster de confluence (miroir) | Inputs clés manquants (flip / VWAP indisponibles) — *pas* "neutre" |
| Market Pressure | Loading haussier — les dealers sont contraints d'acheter au moindre catalyseur (inclinaison vanna+charm vers le haut, flow côté call, dealers short delta) | Loading baissier — les dealers sont contraints de vendre au moindre catalyseur (miroir) | Un pilier manque (pas de walls, pas de flip, pas de greeks, pas de flow), ou le ressort n'est réellement pas armé — pas un "marché neutre". Quand le loading est chargé avec direction = 0, des forces opposées s'annulent. |
| Range Break Imminence | Cassure haussière imminente (pression structurelle haussière alignée) | Cassure baissière imminente | Imminence faible — restez en mode range-fade ; pas de loading de cassure |
| Squeeze Setup | Achetez le breakout haussier (flow calls + accélération à la hausse) | Vendez le breakout baissier (flow puts + accélération à la baisse) | Rien n'est comprimé — pas d'énergie accumulée, pas d'inclinaison de flow |
| Trap Detection | Achetez le breakdown raté (la cassure baissière ne tient pas) | Vendez le breakout raté (la cassure haussière ne tient pas) | Aucun niveau structurel n'est en train d'être rejeté actuellement |
| Vol Expansion | Momentum haussier + capacité d'expansion de la vol (dealers short gamma) | Momentum baissier + capacité d'expansion de la vol | Pas de momentum, ou GEX positif amortissant le mouvement |
| Zero DTE Position Imbalance | Positionnement 0DTE penchant vers les calls (skew de flow haussier) | Positionnement 0DTE penchant vers les puts (bid de protection baissier) | Flow 0DTE équilibré — ou signal dormant en dehors des RTH |

### Signaux Basic

| Signal | Score positif | Score négatif | Zéro |
| --- | --- | --- | --- |
| Dealer Delta Pressure | Dealers long delta — doivent vendre les rallyes (baissier) | Dealers short delta — doivent acheter les creux (haussier) | Book du dealer équilibré ou OI insuffisant |
| GEX Gradient | Gamma empilé en dessous du spot (amplificateur baissier en short gamma ; amorti en long gamma) | Gamma empilé au-dessus du spot (biais baissier) | Gradient plat ou OI insuffisant |
| Positioning Trap | Foule long mal positionnée — loading de short-cover squeeze haussier | Foule short mal positionnée — loading de flush baissier | Aucun extrême de foule détecté |
| Skew Delta | Skew des puts *en dessous* de la baseline — la peur se dissipe (inclinaison haussière) | Skew des puts élevé — la peur est pariée (inclinaison baissière) | Skew au niveau de la baseline, ou données manquantes |
| Tape Flow Bias | L'achat agressif de calls domine le tape (conviction haussière) | L'achat agressif de puts domine le tape (conviction baissière) | Flow de premium équilibré ou volume insuffisant |
| Vanna/Charm Flow | Le hedging du dealer est un vent arrière acheteur (vol-crush / decay) | Le hedging du dealer est un vent contraire vendeur (vol-up / unwind) | Exposition du dealer équilibrée ou lignes dealer manquantes |

---

## Un zéro n'est (presque) jamais "neutre"

C'est la mauvaise lecture la plus fréquente de toutes, elle mérite donc sa propre section.

> Un score de 0 signifie généralement *données insuffisantes* ou *cette question précise n'a pas de réponse en ce moment* — **pas** "le marché est équilibré, tradez librement."

Quand Gamma/VWAP Confluence renvoie 0 parce que le gamma flip ou le VWAP est indisponible, c'est un *angle mort*, pas un tape calme. Quand EOD Pressure est à 0 en dehors de la fenêtre de clôture, la question ne s'applique tout simplement pas encore. Traitez un 0 comme "cette lentille est éteinte", dimensionnez en conséquence, et appuyez-vous sur les signaux qui *sont* effectivement en train de reporter des données.

## Les quatre buckets de trade-bias

Le "Trade Bias" de chaque signal se range dans l'une de quatre familles. Savoir dans quel bucket vit un signal vous dit comment agir dessus avant même de lire le score.

- **Continuation (5) :** Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow — ceux-ci disent *le mouvement a du carburant ; accompagnez-le*.
- **Mean-reversion (2) :** Positioning Trap, Trap Detection — ceux-ci disent *le mouvement est surétendu ou faux ; fadez-le*. Gamma/VWAP Confluence rejoint ce bucket quand les dealers sont long gamma.
- **Directional read (5) :** EOD Pressure, Zero DTE Imbalance, Dealer Delta Pressure, GEX Gradient, Skew Delta — ceux-ci vous disent *dans quel sens pointe la pression*, sans prescrire à eux seuls d'accompagner ou de fader.
- **Regime / structural (1) :** Range Break Imminence — celui-ci change le playbook lui-même, en vous faisant basculer entre mode range-fade et mode breakout.

Quand plusieurs signaux du **même** bucket s'alignent, la conviction se démultiplie. Quand les signaux de Continuation et de Mean-reversion se contredisent, ce conflit est en soi une information : le tape est disputé.

## Booléens déclenchés vs. poids du composite

Les signaux Advanced et Basic ne sont pas simplement des versions "plus difficiles" et "plus faciles" l'un de l'autre — ils sont câblés différemment dans le système.

- **Les signaux Advanced déclenchent des triggers discrets.** Dès que le score franchit le seuil (par ex. abs(score) ≥ 0.25 pour Squeeze Setup), le signal *se déclenche* : il déclenche une alerte et peut activer un playbook. Entre deux déclenchements, il est purement informatif.
- **Les signaux Basic ne se déclenchent jamais.** Ce sont des inputs continus pour le composite MSI, chacun portant un poids fixe (0.04 à 0.08). Ils contribuent en permanence, sans jamais alerter.

C'est *pourquoi* vous ne voyez des alertes de type "BULLISH FADE" que pour certains signaux et pas pour d'autres — les signaux Basic font leur travail discrètement à l'intérieur du composite tout du long.
