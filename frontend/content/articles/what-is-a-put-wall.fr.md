# Qu'est-ce qu'un put wall ? Comment les traders d'options utilisent les put walls comme support des dealers

*Le put wall est le strike où se concentre le gamma des dealers côté put — généralement le support le plus solide, adossé au hedging des dealers, sur le tableau. Voici ce qu'est réellement un put wall, pourquoi le prix y réagit, comment il se déplace en intraday, et quand il tient ou cède.*

---

## Qu'est-ce qu'un put wall ?

Un **put wall** est le strike situé sous le spot qui concentre le plus lourd exposure gamma des dealers côté put sur la chaîne d'options. C'est le niveau de prix où les flux de hedging des dealers sont le plus susceptibles de *défendre le côté baissier* — c'est pourquoi les traders considèrent le put wall comme le plancher structurel de la fourchette de positionnement actuelle des dealers.

Le sens du put wall, en une phrase : ce n'est ni un niveau psychologique ni une moyenne mobile — c'est un positionnement réel. L'open interest, contrat par contrat, pondéré par le gamma que porte chaque contrat. Le strike unique où ce gamma put est le plus dense sous le prix actuel, c'est le put wall.

Le put wall a une image miroir au-dessus du spot : le [call wall](/education/what-is-a-call-wall), le strike au gamma call le plus lourd, qui tend à plafonner la hausse. Ensemble, les deux walls dessinent la fourchette que la mécanique de hedging des dealers tend à défendre. Cet article porte spécifiquement sur le put wall — ce qu'il est, pourquoi il agit comme support, comment il se déplace, et quand la lecture cède. Pour la vision structurelle complète, associez-le à [Gamma Walls Explained](/education/gamma-walls-explained) et au [pilier Gamma Exposure](/education/gamma-exposure-explained).

---

## Pourquoi le put wall agit comme support

Le mécanisme, c'est le hedging des dealers, pas le sentiment de marché. Dans un régime de **gamma positif** — spot au-dessus du [gamma flip](/education/how-to-read-a-gamma-flip) — les dealers sont net long gamma, et les desks qui ont émis les puts lourds au strike du put wall sont short sur ces puts. Pour rester delta-neutres, ils doivent **acheter** le sous-jacent à mesure que le prix se rapproche du strike à la baisse, car une position short put gagne du delta long quand le marché baisse.

Cet achat, c'est le support. À mesure que le prix glisse vers un strike put dense, le réflexe de hedging s'intensifie : un petit mouvement baissier force un achat de hedging relativement plus important en retour. Le résultat est un niveau où la vente est absorbée et où les replis ont tendance à être achetés — non pas parce que quelqu'un croit en ce chiffre, mais parce que le hedge est mécanique.

Quelques éléments qui découlent directement du mécanisme :

- Le put wall est un **support probabiliste**, pas un plancher absolu. C'est là où se concentre le flux absorbant, pas un rebond garanti.
- Il est le plus fort dans un régime de gamma positif et avec un gamma relatif élevé au strike.
- C'est un *biais* qu'un catalyseur véritable — CPI, FOMC, un pic de volatilité — peut annuler en quelques secondes.

---

## Put wall vs. call wall

Les deux walls sont symétriques mais opposés :

|Wall|Où|Hedge du dealer en gamma positif|Comportement typique|
|---|---|---|---|
|Put wall|Gamma put le plus lourd sous le spot|Achète à mesure que le prix baisse vers lui|Support / plancher baissier|
|Call wall|Gamma call le plus lourd au-dessus du spot|Vend à mesure que le prix monte vers lui|Résistance / plafond haussier|

Aucun des deux walls n'est directionnel en soi. Le put wall n'est pas « haussier » et le call wall n'est pas « baissier » — ce sont des niveaux de concentration dont l'*effet* dépend du côté du gamma flip où l'on se trouve. Au-dessus du flip, les deux walls absorbent les mouvements. En dessous, les deux peuvent s'inverser et les relâcher.

---

## Comment le put wall se déplace en intraday

Le put wall est une lecture vivante, pas une ligne que l'on fixe à l'ouverture et à laquelle on se fie jusqu'à la clôture. Il migre pour trois raisons courantes :

1. **Rééquilibrage de l'OI.** Un volume frais sur un strike différent peut déplacer la concentration de gamma put la plus lourde. Le put wall à 10h00 ET peut se retrouver un strike plus bas à midi.
2. **Migration avec le prix.** Si le prix descend progressivement vers le put wall et que les traders continuent d'acheter de la protection juste en dessous, le wall peut dériver vers le bas avec le mouvement. Un put wall qui *suit* le prix est une lecture de support plus faible qu'un wall qui *tient* — le wall poursuit, il ne défend pas.
3. **Décroissance liée à l'expiration.** Dans les chaînes fortement 0DTE, les contrats qui ont bâti le wall arrivent à expiration au fil de l'après-midi. Un put wall sur lequel on s'appuyait à 11h00 ET peut s'amenuiser d'ici 14h30 ET.

Lire le wall en mouvement constitue l'essentiel de l'edge. Un put wall qui n'a pas bougé depuis deux heures est un signal très différent d'un wall qui a glissé plus bas avec le prix à trois reprises.

---

## Quand le put wall tient ou cède

Le put wall est un biais qui fonctionne plus souvent lorsque la structure le soutient. Une brève checklist :

**Plus susceptible de tenir :**

- Le spot est dans un régime de gamma positif (au-dessus du flip).
- Le strike porte un gamma relatif important et le Net GEX est nettement positif.
- Le wall *ne* migre *pas* vers le bas avec le prix.
- La vente vers ce niveau décélère.

**Plus susceptible de céder :**

- Le spot est dans un régime de **gamma négatif** (sous le flip). Ici, le réflexe du dealer s'inverse — au lieu d'acheter le repli, le hedging peut *amplifier* la vente massive, et le put wall devient un point de slippage plutôt qu'un plancher.
- Le Net GEX est faible ou se contracte rapidement.
- Le wall poursuit le prix à la baisse.
- Un catalyseur macro survient pendant que le niveau est testé.
- La vente directionnelle *s'accélère* vers le strike.

Le plus important de ces éléments, c'est le régime. Un put wall en gamma positif est un plancher que les dealers défendent. Le même strike en gamma négatif est une trappe — une fois que le prix le traverse, les flux de hedging renforcent le mouvement baissier au lieu de l'atténuer.

---

## Un exemple chiffré

Supposons que SPX se négocie à 5 830 et que le book des dealers indique :

- **Put Wall :** 5 790 (−0,69 % par rapport au spot)
- **Call Wall :** 5 850 (+0,34 % par rapport au spot)
- **Gamma Flip :** 5 810
- **Net GEX :** +1,5 Md$

Le spot est confortablement au-dessus du flip, il s'agit donc d'une séance en gamma long, et le put wall à 5 790 est le bord le plus solide de la fourchette. Le biais pratique : les replis vers 5 790 constituent la zone d'*achat* la plus probable, et une cassure nette de 5 790 serait un signal réel — cela signifie probablement soit un passage du flip sous 5 810 vers le gamma négatif, soit un catalyseur assez fort pour submerger le hedge. En dessous du flip, ce même 5 790 cesse d'être un support et peut accélérer la prochaine jambe baissière.

Changez une variable — disons que le put wall migre de 5 790 à 5 782 pendant que le prix teste 5 795 — et la lecture change avec lui. Le wall poursuit désormais le prix à la baisse, le biais de support s'affaiblit, et une cassure devient plus crédible qu'elle ne le paraissait dix minutes plus tôt.

---

## Comment trouver le put wall du jour

Vous n'avez pas besoin de calculer le gamma des dealers à la main. ZeroGEX publie le put wall actuel — aux côtés du call wall, du gamma flip, du max pain et du Net GEX — pour les trois produits indiciels les plus échangés, gratuitement et avec environ 15 minutes de retard : consultez le put wall du jour sur [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels). Pour la version en direct, à la sous-seconde, avec le profil gamma complet et la heatmap strike par DTE, le [dashboard GEX 0DTE en temps réel](/real-time-gex-0dte) trace le put wall à mesure qu'il migre au fil de la séance.

---

## À retenir

> Le put wall est un positionnement réel, pas de la psychologie — le strike où le hedging des dealers est le plus susceptible de défendre le côté baissier. Mais ce n'est un plancher que tant que le spot est en gamma positif. Lisez d'abord le régime, puis le wall, et enfin la migration du wall.

Contenu à visée éducative uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Envie de le voir en temps réel ? Consultez dès aujourd'hui les **put walls SPX / SPY / QQQ** sur ZeroGEX — les pages gratuites de niveaux gamma [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels) tracent le put wall aux côtés du [call wall](/education/what-is-a-call-wall), du gamma flip et du Net GEX. Pour les niveaux qui comptent le plus comme support et résistance, voir [support et résistance basés sur les options](/education/options-support-and-resistance), et pour la lecture en direct, ouvrez le [dashboard GEX 0DTE en temps réel](/real-time-gex-0dte).
