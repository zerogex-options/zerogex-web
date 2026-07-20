# Le GEX et le Gamma Flip — Comment ZeroGEX les calcule

*Une explication en langage simple du profil d'exposition gamma des dealers, du resolver qui le transforme en un niveau exploitable, et de la comparaison de cette méthodologie avec celle d'autres fournisseurs populaires.*

---

## Ce qu'est réellement le "gamma des dealers"

Les teneurs de marché (les "dealers") se trouvent de l'autre côté de chaque option que vous négociez. Quand vous achetez un call, un dealer vous le vend. Pour rester neutres directionnellement, ils se couvrent en achetant ou en vendant le sous-jacent. À mesure que l'action bouge, le ratio de couverture de l'option (le delta) change, si bien que le dealer doit continuellement racheter ou revendre.

Le **gamma** mesure la vitesse à laquelle ce besoin de couverture évolue. Le **GEX** ("gamma exposure") traduit le gamma de toute la chaîne d'options en dollars — schématiquement, *le montant en dollars de sous-jacent que les dealers doivent négocier pour chaque mouvement de 1% de l'action.*

Il existe deux régimes, séparés par un unique niveau de prix appelé le **gamma flip** :

- **Au-dessus du flip — dealers net long gamma.** Quand l'action monte, ils vendent ; quand elle baisse, ils achètent → effet de retour à la moyenne / de suppression de la volatilité.
- **En dessous du flip — dealers net short gamma.** Quand l'action monte, ils achètent ; quand elle baisse, ils vendent → effet d'amplification du momentum / d'expansion de la volatilité.

---

## Comment nous le calculons (et pourquoi de cette façon)

L'élément central est une courbe unique : le **profil de gamma des dealers à spot déplacé (spot-shift)**.

1. Prenez l'instantané du jour de la chaîne d'options.
2. Imaginez l'action à chaque prix d'une grille couvrant environ ±20% du spot (par pas de 0,25% du spot — quelques centaines de points de grille).
3. À chaque prix de la grille, **recalculez le gamma de chaque option** avec Black-Scholes (le gamma est lui-même fonction du spot, donc on ne peut pas utiliser la valeur statique de l'instantané).
4. Multipliez le gamma de chaque contrat par `OI × 100 × S² × 0.01` (la convention du secteur "dollar GEX par mouvement de 1%" utilisée par SpotGamma / SqueezeMetrics / Cheddar Flow), et appliquez la convention de signe des dealers (calls +, puts −).
5. Pondérez chaque contrat par `min(1, DTE / 5 days)` — une rampe d'occupation d'horizon, pour qu'un mur 0DTE du jour même (qui porte un pic de gamma colossal en `1/√T`) ne puisse pas figer un niveau de régime pluri-journalier.
6. Sommez sur toute la chaîne → une courbe, *dealer dollar gamma vs. spot hypothétique.*

Deux lectures proviennent de cette **même** courbe :

- **Gamma Flip** = le prix où la courbe croise zéro (le croisement exploitable).
- **Net GEX au spot** = la valeur de la courbe au prix du jour.

Comme les deux proviennent d'une seule courbe, le chiffre-clé de GEX et le régime spot-vs-flip *ne peuvent jamais se contredire* — c'est un invariant structurel du calcul. C'est pour cela que nous l'avons construit ainsi. L'ancien raccourci "cumuler le gamma statique par strike" (encore utilisé par plusieurs fournisseurs) pouvait vous donner un net GEX positif tout en indiquant que le spot était sous le flip — incohérent.

---

## Le resolver de flip renforcé

Le simple croisement de zéro ne suffit pas à lui seul — il fallait se prémunir contre trois modes de défaillance réels :

1. **Croisements en bord de grille.** Le gamma décroît vers ~0 aux extrémités de la grille, si bien qu'un déséquilibre infime peut y inverser le signe → **Interior gate** : un croisement doit se situer à ≥10% de la largeur de la grille de distance de chaque bord.
2. **Croisements dans le bruit de fond** (artefacts d'ouverture matinale / de pic d'IV). Quand le gamma de toute la chaîne est dégradé, le profil dérive à travers zéro dans une zone à faible signal → **Structural gate** : le pic local |profile| d'un candidat doit être ≥ 2% d'une référence robuste (le p90 de |profile| sur une bande canonique de ±15%, restreinte aux points de grille proches d'un strike avec un OI > 0 réel).
3. **Croisements loin du spot.** Un croisement structurellement valide mais situé 20% sous le spot n'est exploitable sur aucun horizon raisonnable → **Actionable-distance gate** : les candidats à plus de 8% du spot sont rejetés.

Si la grille ±20% ne fournit aucun croisement qualifié, le resolver **élargit la grille** à ±35%, puis ±50% (une échelle adaptative). Si aucun échelon ne se qualifie, le flip est signalé comme **non résolu (NULL + WARN)** — honnêtement, plutôt que d'inventer une valeur limite ou de figer une valeur périmée.

---

## En quoi cela diffère des sites populaires

| Site | Méthode | Avantages | Inconvénients |
| --- | --- | --- | --- |
|! **ZeroGEX (cette base de code)** | Profil de gamma des dealers à spot déplacé, échelle adaptative de grille, gates d'acceptation interior / structural / actionable-distance, pondération d'occupation d'horizon DTE, NULL honnête sur chaînes dégradées | La définition publiée par le secteur ; chiffre-clé cohérent en signe (flip et net-GEX-au-spot lus sur une même courbe) ; renforcé contre les artefacts de chaîne dégradée, de proximité de bord et d'éloignement du spot ; les endpoints multi-horizons exposent des flips à 1j / 5j / 20j à partir d'un seul primitif | Plus de calcul par cycle (recalcule les grecques de la chaîne sur une grille, parfois à plusieurs échelons) ; plus de paramètres ajustables (regroupés dans des profils `default` / `strict` / `lenient` pour garder une surface réduite) ; simplification de volatilité sticky-strike (un re-décalage complet de la surface de volatilité est hors périmètre) |
| **SpotGamma** | Profil de gamma des dealers à spot déplacé (la définition canonique / originale) | Référence du secteur pour la définition ; lignée de recherche publiée | Méthodologie fermée ; également sticky-strike ; le flip rapporté ne concerne qu'un seul horizon |
| **SqueezeMetrics** | Profil de gamma des dealers à spot déplacé (l'autre source canonique) | Le paper original DIX / GEX fait référence publique pour cette construction | Produit retail majoritairement à cadence journalière ; pas en temps réel |
| **Unusual Whales** | Agrégation du GEX par strike (cumule gamma × OI par strike) | Peu coûteux à calculer ; très rapide ; graphique en barres par strike intuitif | Pas la définition spot-shift — un niveau "zero gamma" cumulatif par strike est une approximation retail ; se fige quand le véritable zero-gamma est en dehors de la bande de strikes ingérée |
| **Cheddar Flow** | Agrégation du GEX par strike | Comme UW — rapide et intuitif | Même réserve — pas la définition spot-shift |

La plus grande différence pratique : **les fournisseurs qui agrègent par strike vous donneront un "flip" qui reste collé à un mur tant que ce mur figure dans leur instantané, même quand le véritable niveau de zero-gamma est éloigné de plusieurs points de pourcentage.** Nous avons observé exactement ce symptôme dans nos propres données historiques avant la réécriture — le flip persisté restait plat pendant des heures. Recalculer les prix sur une grille plus large corrige cela.

La seconde différence est l'**honnêteté sur les données dégradées** : la plupart des fournisseurs reportent silencieusement la dernière valeur connue quand leur flux devient obsolète. Nous persistons NULL et émettons un avertissement de santé (health warning) à la place, pour qu'un flux dégradé soit visible plutôt que masqué.
