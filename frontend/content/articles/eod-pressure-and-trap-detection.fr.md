# Trader la clôture : comment EOD Pressure et Trap Detection lisent en temps réel le hedging des dealers

*Deux ZeroGEX™ Advanced Signals conçus pour les points d'inflexion structurels de la journée de trading — les flux de hedging forcé qui entraînent le prix vers la clôture, et les breakouts ratés qui repartent en sens inverse lorsque les dealers les absorbent.*

---

## Pourquoi ces deux signaux existent

La plupart des outils intraday vous disent *où* se situe le prix. Ils vous disent rarement *pourquoi* il est sur le point de bouger — ou, plus utile encore, *pourquoi il ne devrait pas bouger davantage*.

Les 90 dernières minutes de la séance cash et les instants qui suivent immédiatement la rupture d'un niveau clé sont les deux fenêtres où la mécanique de hedging des dealers est la plus observable dans le tape. EOD Pressure et Trap Detection sont conçus pour se déclencher précisément à ces points d'inflexion structurels — et rester silencieux le reste de la journée.

Ce silence est une caractéristique voulue, pas un défaut. Les deux signaux afficheront **zéro** pendant la majeure partie de la journée de trading. Lorsqu'ils se déclenchent, ils vous indiquent quelque chose de précis sur un flux forcé que le reste du tape ne vous montrera pas directement.

Cet article s'adresse aux traders qui comprennent déjà le gamma exposure, le hedging des dealers, et la différence entre un régime positive-gamma et un régime negative-gamma. Si ces termes vous sont nouveaux, commencez par notre article complémentaire **Decoding Gamma Exposure**, puis revenez ici.

---

# Partie 1 — EOD Pressure

## Ce qu'il mesure

EOD Pressure est un **estimateur de biais directionnel pour les ~90 dernières minutes de la séance cash**. Il tente de répondre à une question :

> Étant donné le book actuel des dealers et la proximité d'un strike aimant, dans quelle direction le hedging forcé *pousse*-t-il le prix vers la clôture ?

Deux mécanismes physiques guident la réponse :

**La décroissance du charm.** À mesure que les options 0DTE et à courte échéance approchent de l'expiration, leur delta ne reste pas immobile — il décroît à un rythme qui s'accélère au fil du temps. Les dealers qui gèrent un book delta-neutral doivent se rééquilibrer en permanence pour maintenir cette neutralité. Le signe agrégé de l'exposition au charm des dealers près du spot vous indique dans quelle direction pointent ces flux de hedging aujourd'hui.

**La gravité du pin.** Dans un régime positive-gamma, les dealers achètent la faiblesse et vendent la force — ce réflexe mécanique attire le prix vers le strike de douleur maximale / gamma maximal comme un aimant. Dans un régime negative-gamma, la même mécanique s'inverse : les dealers poursuivent les mouvements, et le strike devient un point de répulsion plutôt qu'un attracteur.

EOD Pressure combine ces deux effets, les met à l'échelle selon la proximité de la clôture, et les amplifie aux dates du calendrier où le positionnement compte le plus.

---

## Interprétation du score

Le résultat est un score continu sur **[−1,0, +1,0]**.

| Score | Interprétation pour le trader |
|-------|----------------------|
| +0,6 à +1,0 | Forte dérive haussière attendue vers la clôture. L'aimant se situe au-dessus du spot et les dealers sont contraints d'acheter. |
| +0,2 à +0,6 | Légère dérive haussière. Le biais intraday reste acheteur mais sans se positionner agressivement. |
| −0,2 à +0,2 | Pas d'avantage. Soit trop tôt dans la fenêtre, soit les termes charm et pin s'annulent. |
| −0,2 à −0,6 | Légère dérive baissière. Biais vendeur ou clôture des positions longues. |
| −0,6 à −1,0 | Forte dérive baissière attendue vers la clôture. |

Le signal se marque lui-même comme **déclenché** lorsque le score absolu franchit **0,2**. Tout ce qui reste en dessous est enregistré à titre de contexte mais ne déclenchera pas les schémas de playbook en aval.

---

## Comment le score est construit

EOD Pressure agrège quatre composantes. Trois contribuent à l'amplitude ; une joue le rôle de porte (gate).

### Composante 1 : Charm au spot

C'est la mesure la plus directe du flux de hedging forcé. Le signal additionne l'exposition au charm des dealers sur une bande at-the-money, pondérée par bucket d'échéance :

```
band_pct = max(0.5%, 1.5 × σ × √30)
charm_raw = Σ_buckets W_bucket × Σ_strikes_in_band dealer_charm_exposure
charm_score = clip(charm_raw / 2.0e7, [-1, +1])
```

La bande ATM est **mise à l'échelle par la volatilité** — plus large les jours volatils, plafonnée à ±0,5 % les jours de tape mort. La projection sur 30 barres retrace approximativement la fourchette de prix attendue pour le reste de la séance.

Les pondérations des buckets d'échéance sont calibrées selon la physique du charm :

| Bucket | Poids | Pourquoi |
|--------|--------|-----|
| 0DTE | 0,70 | Le charm frappe le plus fort le jour de l'expiration. Contributeur dominant. |
| Hebdomadaire | 0,20 | Significatif mais secondaire. |
| Mensuel | 0,10 | Contribution de fond. |
| LEAPS | 0,00 | Trop éloigné pour compter dans la clôture du jour. |

À ±20 M$ de charm des dealers regroupé par bucket, le sous-score plafonne à ±1,0. En dessous, la réponse est linéaire.

### Composante 2 : Gravité du pin

Le terme pin encode la **traction dépendante du régime** du strike aimant :

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

Un pin target situé 0,3 % au-dessus du spot dans un régime positive-gamma donne un pin score de +1,0 — l'aimant est au-dessus et la gravité opère.

L'inversion de signe dans un régime negative-gamma est le point subtil mais crucial. Le même pin situé au-dessus du spot dans un book short-gamma produit un pin score *négatif*, car les dealers sont contraints de *poursuivre* les mouvements qui s'éloignent du strike plutôt que d'attirer le prix vers lui. La gravité du pin n'est pas un niveau fixe sur le graphique — c'est une force dépendante du signe.

### Composante 3 : Rampe temporelle (Gate)

La rampe est une porte multiplicative sur l'ensemble du signal. Avant **14h30 ET**, elle est exactement nulle — et le signal s'interrompt avant même de calculer quoi que ce soit d'autre.

| Heure (ET) | Rampe |
|-----------|------|
| Avant 14h30 | 0,00 |
| 14h30 | 0,00 |
| 14h45 | 0,20 |
| 15h00 | 0,40 |
| 15h30 | 0,80 |
| 15h45 – 16h00 | 1,00 |

La rampe monte linéairement de 0 à 1 entre 14h30 et 15h45 ET, puis reste à pleine puissance jusqu'à la clôture. C'est pourquoi le signal affiche zéro pendant la majeure partie de la journée de trading — il est structurellement inactif.

### Composante 4 : Amplificateur calendaire

L'amplificateur augmente la conviction aux dates où le positionnement se concentre et où les books des dealers sont exposés de façon inhabituelle :

| Calendrier | Amp |
|----------|-----|
| Jour normal | 1,0× |
| OpEx mensuel (troisième vendredi) | 1,5× |
| Quad witching (troisième vendredi de mars/juin/sept/déc) | 2,0× |

L'amplificateur est le seul point du signal où le score intermédiaire peut dépasser ±1 — l'écrêtage final le ramène dans la plage.

---

## Assembler le tout

L'agrégation finale :

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

La pondération 60/40 reflète une position assumée : **le charm est une mesure directe du flux de hedging forcé**, tandis que **la gravité du pin est une traction indirecte, dépendante du régime**. Les deux comptent. Le charm mène la danse.

---

## Quand EOD Pressure renvoie zéro

Une lecture à zéro est l'état le plus fréquent. Le signal est *conçu* pour rester silencieux en dehors de sa fenêtre.

- En dehors de la fenêtre active (le cas dominant) : la rampe temporelle s'interrompt avant même que toute autre composante soit calculée.
- Aucun strike à l'intérieur de la bande ATM sur une chaîne éparse ou peu cotée.
- `max_pain` et `max_gamma_strike` sont tous deux nuls.
- Le pin target se situe exactement au spot.
- Les scores charm et pin s'annulent exactement — rare, cela exige des directions opposées et une magnitude égale.

Si vous observez le panneau à 13h55 ET et qu'il affiche zéro, c'est correct et attendu. Le signal se peuplera à 14h30 ET et montera en rampe jusqu'à la clôture.

---

# Partie 2 — Trap Detection

## Ce qu'il mesure

Trap Detection identifie les configurations où **le prix vient de franchir un niveau clé de positionnement des dealers mais où ce franchissement risque d'échouer et de s'inverser**.

Le schéma classique : dans un régime long-gamma où le positionnement des dealers se renforce, les dealers absorbent les breakouts. Ils vendent la hausse et achètent le repli — mécaniquement, non par conviction directionnelle. Le prix pointe au-dessus de la résistance, se heurte à l'offre, et repart brusquement dans la fourchette précédente. Le breakout était un piège.

Le signal recherche deux configurations symétriques :

> **Bear trap sur un faux mouvement haussier.** Le prix pointe au-dessus d'un niveau de résistance — `call_wall`, `max_gamma_strike`, `vwap`, ou `gamma_flip` — mais les conditions structurelles indiquent que le breakout va échouer. Produit un score *négatif* (`bearish_fade`).

> **Bull trap sur un faux mouvement baissier.** Le prix pointe sous le support — `put_wall`, `max_gamma_strike`, `vwap`, ou `gamma_flip` — mais la cassure semble factice. Produit un score *positif* (`bullish_fade`).

Le signe du résultat encode la direction dans laquelle *fader* le mouvement, et non la direction dans laquelle le prix vient de casser.

---

## Interprétation du score

| Score | Étiquette | Interprétation pour le trader |
|-------|-------|----------------------|
| +0,5 à +1,0 | `bullish_fade` | Bull-trap-fade à forte conviction. La cassure baissière est factice — un retour brutal à la hausse est attendu. |
| +0,25 à +0,5 | `bullish_fade` (déclenché) | Modéré. Envisager des entrées longues en mean-reversion. |
| 0 à +0,25 | sous le seuil | Conviction faible ; non exploitable seul. |
| 0 | aucun | Aucun piège en formation. L'état par défaut. |
| 0 à −0,25 | sous le seuil | Conviction faible. |
| −0,25 à −0,5 | `bearish_fade` (déclenché) | Bear-trap-fade modéré. Fader les longs, une inversion baissière est attendue. |
| −0,5 à −1,0 | `bearish_fade` | Bear-trap-fade à forte conviction. Fader les rallyes à l'intérieur du breakout. |

Le seuil de déclenchement ici est **0,25** — délibérément plus strict que le 0,20 d'EOD Pressure. Les configurations de trap exigent une conviction plus élevée pour se déclencher activement, car trader contre un breakout actif comporte un risque de queue plus élevé que suivre le flux de fin de journée.

---

## Comment le score est construit

### Étape 1 : Identifier le niveau franchi

```
up_levels = [call_wall, max_gamma_strike, vwap, gamma_flip]
dn_levels = [put_wall, max_gamma_strike, vwap, gamma_flip]
broken_resistance = max(level for level in up_levels if level < close)
broken_support    = min(level for level in dn_levels if level > close)
```

Notez la terminologie. *Broken resistance* est le niveau que le prix vient de dépasser à la hausse — il se situe donc désormais sous la clôture. *Broken support* est le niveau sous lequel le prix vient de glisser. Les noms reflètent la perspective post-breakout.

### Étape 2 : Buffer de breakout mis à l'échelle par la volatilité

Un léger dépassement d'un niveau relève du bruit, pas d'un breakout. Le signal utilise un buffer mis à l'échelle par la volatilité pour filtrer :

```
σ           = realized_sigma(recent_closes, 60 bars)
buffer_pct  = max(0.1%, 0.15 × σ × √5)
```

Pour le SPX avec une σ intraday typique proche de 8 points de base par minute, le buffer se situe autour de 0,1 %. Les jours volatils, il se met automatiquement à l'échelle. Le prix doit franchir le niveau de plus que le buffer avant même que le signal commence à enregistrer de la force.

### Étape 3 : Facteurs de force continus

Une itération antérieure de ce signal utilisait des ET booléens et produisait un comportement en tout-ou-rien — des préconditions à peine remplies faisaient basculer le score on/off. Le design actuel utilise des **facteurs continus [0, 1]** qui se multiplient entre eux :

| Facteur | Point de saturation | Ce qu'il capture |
|--------|------------------|------------------|
| `long_gamma_factor` | Plein à net_gex ≥ 1 Md$ | Les dealers absorbent-ils structurellement les mouvements ? |
| `strengthening_factor` | Plein à +2 % de delta GEX | Le positionnement des dealers se *construit*-il, plutôt que de se dénouer ? |
| `breakout_strength` | Plein à 3× le buffer au-delà du niveau | Le prix a-t-il réellement franchi le niveau de façon significative ? |
| `wall_migration` | 0,3× si le wall s'est déplacé de >0,05 % avec le prix | Décote si le niveau lui-même se déplace — cela suggère un breakout réel. |

La force directionnelle de chaque côté est le produit :

```
upside_strength   = breakout_strength_up   × long_gamma × strengthening × wall_up
downside_strength = breakout_strength_dn   × long_gamma × strengthening × wall_dn
```

Dès que l'un de ces facteurs tombe à zéro, il annule tout le côté concerné. Régime negative-gamma ? `long_gamma_factor = 0` — pas de piège. Gamma qui ne se renforce pas ? `strengthening_factor = 0` — pas de piège. Le signal a une position assumée sur *quand* les fades fonctionnent et refuse de se déclencher en dehors de ce régime.

### Étape 4 : Terme de magnitude

Un poids de base plus des bonus de distance et d'accélération du gamma :

```
dist_strength = min(1, |distance_pct| / max(buffer_pct × 3, 0.3%))
gex_boost     = min(1, |net_gex_delta_pct| / 0.05)
magnitude     = 0.4 + 0.4 × dist_strength + 0.2 × gex_boost   // range: [0.4, 1.0]
```

Un piège qualifiant porte un poids minimal de 0,4 même s'il ne fait que tout juste se qualifier. Des breakouts plus amples et un positionnement des dealers en accélération le font tendre vers 1,0.

### Étape 5 : Multiplicateur de flux

Le terme de flux distingue les breakouts *réels* des breakouts *épuisés* :

```
flow_mult = 1.1                                          if flow is decelerating
          = max(0.3, 1 − flow_delta / flow_norm)         otherwise
```

Un flux directionnel qui ralentit à l'intérieur d'un breakout correspond exactement à la thèse du piège — les acheteurs se retirent juste au moment où le prix franchit le niveau, laissant le mouvement sans soutien. Le signal *augmente* la conviction de 10 % dans ce cas.

À l'inverse, un flux qui accélère dans le sens du breakout signifie que le mouvement est porté par des participants réels. La thèse du piège s'affaiblit — le multiplicateur se réduit vers 0,3.

### Étape 6 : Agrégation finale

```
bear_score = clip(magnitude × flow_mult × upside_strength,   [0, 1])
bull_score = clip(magnitude × flow_mult × downside_strength, [0, 1])
score      = clip(bull_score − bear_score, [-1, +1])
triggered  = abs(score) >= 0.25
```

Les deux scores de côté sont non négatifs. Leur différence encode de façon continue à la fois la direction et la conviction. Dans le cas rare où le prix se retrouve coincé entre deux niveaux récemment franchis, les deux côtés s'annulent partiellement — ce qui est approprié, car la configuration est réellement ambiguë.

---

## Quand Trap Detection renvoie zéro

Pendant la majeure partie de la journée de trading, ce signal affiche zéro. Les conditions qui le ramènent à zéro sont précisément celles dont vous devez avoir conscience :

- **Aucun niveau n'est franchi.** Le prix se situe entre `call_wall` et `put_wall` sans toucher l'un ou l'autre, ou il pointe au-delà mais reste dans le buffer mis à l'échelle par la volatilité. L'état par défaut d'un marché calme.
- **Régime negative-gamma.** `long_gamma_factor = 0`. Dans un book short-gamma, les breakouts se poursuivent — ils ne se fadent pas. Le signal refuse à juste titre de se déclencher.
- **Gamma qui ne se renforce pas.** `strengthening_factor = 0`. Les configurations de trap exigent que le positionnement des dealers soit en train de se construire, pas de se dénouer.
- **Niveaux de référence manquants.** Aucune donnée pour `call_wall`, `put_wall`, `max_gamma_strike`, `vwap`, ou `gamma_flip` — rien à casser.
- **Migration du wall du côté actif.** Si le call wall se déplace à la hausse en même temps que le prix, le facteur de décote de 0,3× fait souvent passer le score sous le seuil de déclenchement de 0,25.

Un zéro de Trap Detection est *informatif*. Il vous indique que les conditions préalables à un trade de fade-the-breakout ne sont pas réunies — donc si vous êtes sur le point de trader contre un breakout, le signal vous dit implicitement de chercher des preuves ailleurs.

---

# Lire les deux signaux ensemble

Les deux signaux sont conçus pour être lus conjointement. Ils couvrent des horizons temporels et des régimes différents, mais se recoupent souvent sur des configurations à forte conviction vers la clôture.

| EOD Pressure | Trap Detection | Ce que cela signifie |
|--------------|----------------|---------------|
| +0,5 (haussier) | +0,4 (`bullish_fade`) | Forte conviction pour rester acheteur jusqu'à la clôture. La dérive est haussière et le repli actuel paraît factice. Fader la faiblesse intraday, s'attendre à une journée qui clôture forte. |
| +0,5 (haussier) | −0,4 (`bearish_fade`) | Mixte mais tactiquement utile. EOD indique une dérive haussière ; trap indique que le breakout haussier actuel est excessif. Attendre que le fade se termine, puis se repositionner à l'achat pour la clôture. |
| −0,5 (baissier) | 0 | Configuration baissière la plus nette. La dérive EOD est baissière sans signal de fade contraire. |
| 0 (éteint) | +0,3 (`bullish_fade`) | Trade de trap autonome, avant la fenêtre. Tactique, pas stratégique. Taille plus petite, stop plus serré. |
| 0 | 0 | L'état par défaut pendant la majeure partie de la journée de trading. Les deux signaux sont conçus pour ne se déclencher qu'à des points d'inflexion structurels précis. |

---

## Constantes codées en dur à connaître

Pour les traders qui exécutent leurs propres backtests ou qui dimensionnent des trades par rapport à ces signaux, il vaut la peine de garder à l'esprit quelques chiffres clés. Ils ne sont pas arbitraires — chacun reflète un choix de calibration empirique.

| Constante | Valeur par défaut | Où elle est utilisée |
|----------|---------|------------|
| Normalisateur de charm | 20 M$ | EOD Pressure — sature charm_score à ±1,0 |
| Saturation du pin | 0,3 % | EOD Pressure — sature pin_score à ±1,0 |
| Saturation long-gamma | 1 Md$ de net GEX | Trap Detection — `long_gamma_factor` plein à ce niveau |
| Saturation du renforcement | +2 % de delta GEX | Trap Detection — `strengthening_factor` plein à ce niveau |
| Saturation du GEX boost | ±5 % de delta GEX | Trap Detection — bonus de magnitude plein |
| Sensibilité de migration du wall | 0,05 % | Trap Detection — déclencheur de la décote wall-tracking-with-price |
| Plancher du buffer de breakout | 0,1 % | Trap Detection — filtre minimal du bruit |
| Début de la rampe temporelle | 14h30 ET | EOD Pressure — activation la plus précoce |
| Rampe temporelle pleine | 15h45 ET | EOD Pressure — pleine puissance jusqu'à la clôture |

Toutes ces valeurs sont configurables via des variables d'environnement côté backend, mais les valeurs par défaut reflètent ce qui a fonctionné sur des produits indiciels de la classe SPX/SPY avec des chaînes 0DTE profondes et actives. Les sous-jacents moins liquides peuvent nécessiter des seuils plus bas.

---

## Notes pratiques de trading

Quelques schémas reviennent assez souvent pour mériter d'être mentionnés directement :

**L'inflexion de 15h30.** EOD Pressure franchit la rampe à 0,8× à 15h30 ET. Si les termes charm et pin se sont accordés pendant la fenêtre de rampe précoce, la conviction tend à se consolider vers cette heure-là. Se positionner avant, pas après.

**Le quad witching n'est pas un contexte optionnel.** L'amplificateur 2,0× les jours de quad witching est assez important pour faire passer un signal non amplifié de +0,4 à +0,8. Considérez ces jours comme ayant une conviction structurellement plus élevée — et un risque de whipsaw structurellement plus élevé en début de journée, avant l'ouverture de la fenêtre.

**Trap Detection sans confirmation long-gamma doit être ignoré.** Le fait que `long_gamma_factor` annule tout le côté concerné est le garde-fou le plus important du signal. Si le régime plus large est short-gamma — même si le score affiche par hasard une valeur non nulle sur un cas limite de données manquantes — la thèse du piège ne tient pas. Vérifiez le régime.

**Le ralentissement du flux est l'indice de trap-fade le plus net.** Lorsque le flux directionnel *s'assèche* à l'intérieur du breakout, le multiplicateur de flux augmente la conviction de 10 %. C'est le moment où la plupart des trades de trap-fade fonctionnent. Un flux qui accélère à l'intérieur du breakout signifie des participants réels — la thèse du piège est erronée même si le reste des conditions concorde.

---

## Conclusion finale

> **EOD Pressure et Trap Detection sont silencieux la majeure partie de la journée. C'est précisément le but.**

Ils ne sont pas conçus pour vous fournir une lecture continue. Ils sont conçus pour reconnaître les deux moments structurels où la mécanique de hedging des dealers domine le tape — la fenêtre de clôture et le moment du breakout raté — et pour quantifier le biais directionnel que chacun produit.

Pour un trader technique sérieux, le bon usage n'est pas de « surveiller le score ». C'est de :

- **Connaître le régime avant que les signaux ne comptent.** Long-gamma ou short-gamma. En renforcement ou en dénouement.
- **Faire confiance au silence.** Une lecture à zéro en dehors de la fenêtre ou en dehors du régime est une information, pas une absence d'information.
- **Confirmer au point d'inflexion.** Lorsque les deux signaux se déclenchent dans la même direction à l'intérieur de la fenêtre EOD, la lecture structurelle est véritablement forte. Lorsqu'ils divergent, cette divergence elle-même constitue une donnée.

Le hedging des dealers ne fait pas tout le marché. Mais pendant les 90 dernières minutes de la séance cash — et pendant les brèves fenêtres où le prix teste les niveaux de positionnement des dealers — c'est la force dominante du tape. Ces deux signaux en sont la lentille.

---

## Prochaines étapes

Si vous souhaitez pousser le cadre plus loin, les extensions naturelles sont les suivantes :

- Superposer EOD Pressure à l'écart du VWAP intraday pour repérer les conflits entre dérive et mean-reversion.
- Croiser le facteur `wall_migration` de Trap Detection avec l'évolution de votre propre heatmap gamma — quand le wall bouge, la thèse du piège est fragile.
- Suivre la relation entre le signe du charm au spot et le déséquilibre du flux 0DTE — ils devraient généralement concorder, et les divergences sont diagnostiques.
- Les jours d'OpEx et de quad witching, étudier la configuration en amont de la fenêtre : où se situe le charm à 13h00 ET, et comment évolue-t-il jusqu'à l'activation de 14h30 ?

L'objectif n'est pas de mécaniser le trade — c'est de développer une intuition sur *dans quel type de régime de marché vous vous trouvez*, puis de laisser ces deux signaux confirmer ou contredire vos lectures aux moments où le flux des dealers est suffisamment fort pour se faire entendre.
