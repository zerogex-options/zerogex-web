# Pourquoi SPY s'ancre-t-il près d'un strike ? Le pinning des options expliqué

*Pourquoi SPY s'ancre-t-il près de strikes spécifiques — surtout le vendredi et vers la clôture ? Ce n'est pas une coïncidence. Le pinning des options expliqué : le mécanisme de couverture des dealers derrière cette attraction, pourquoi il est le plus fort lors de l'OPEX et en fin de journée, et comment savoir si la séance du jour va s'ancrer.*

---

## Le pinning n'est pas de la superstition

Si vous tradez régulièrement des options hebdomadaires SPY, vous l'avez déjà observé : SPY dérive vers un strike à nombre rond — 580, 583, 585 — et le vendredi après-midi, il y reste, oscillant dans une fourchette de 30 cents, refusant de s'en écarter. La même chose se produit autour des échéances trimestrielles et lors de l'OPEX mensuel. Et cela arrive aussi bien des mercredis et jeudis ordinaires, lorsque la chaîne 0DTE est chargée.

Beaucoup de traders particuliers traitent le pinning comme un phénomène relevant du ressenti — « le marché sait où il veut se stabiliser » — ou l'attribuent à des figures chartistes. Le mécanisme est en réalité structurel et observable : la couverture des dealers sur les strikes à forte concentration de gamma produit des flux directionnels qui ramènent le prix vers le strike chaque fois qu'il tente de s'en éloigner. Une fois que l'on perçoit ce mécanisme, on peut aussi voir quand il est susceptible d'être à l'œuvre aujourd'hui, et quand il ne l'est pas.

Cet article détaille la mécanique réelle du pinning, explique pourquoi elle s'intensifie près de l'échéance, présente les deux types de pin que la plupart des traders confondent, et les conditions structurelles qui font d'aujourd'hui une journée de pin. Pour la checklist orientée trader « SPY est-il ancré en ce moment ? », voir [Comment savoir si SPY est ancré](/education/how-to-know-if-spy-is-pinned). Pour la discussion connexe sur le max pain, voir [Le max pain expliqué](/education/max-pain-explained).

---

## Le mécanisme de couverture des dealers derrière le pinning

Le mécanisme est simple une fois détaillé :

1. Un strike précis — disons SPY 583 — concentre un volume important de gamma. Les clients ont acheté beaucoup de calls et de puts à 583 ; les dealers sont vendeurs à découvert sur l'équivalent.
2. Le book du dealer est **long gamma** sur ce strike. C'est le cas lorsque, au net, les dealers sont *short* sur les options que les clients détiennent en position longue. (Convention standard.)
3. Quand SPY monte au-dessus de 583, le delta des options des dealers devient plus positif (ils sont net short calls ; une hausse du spot fait croître leur exposition delta liée aux calls vendus). Pour rester neutres, ils **vendent** SPY.
4. Quand SPY passe sous 583, le delta des options des dealers devient plus négatif (leur exposition delta liée aux puts vendus croît à la baisse). Pour rester neutres, ils **achètent** SPY.
5. Chaque écart par rapport à 583 impose une opération de couverture *de retour vers* 583. Le strike agit comme un aimant — non pas parce que quelqu'un le viserait, mais parce que la mathématique de la couverture ramène le prix mécaniquement à cet endroit.

C'est ce qui se produit structurellement lorsqu'on observe SPY osciller dans une fourchette étroite. Ce n'est pas « le marché qui décide de s'ancrer » ; c'est le book agrégé des dealers qui se corrige vers la neutralité à chaque mouvement.

---

## Pourquoi le pinning s'intensifie près de l'échéance

Le mécanisme décrit ci-dessus s'applique à toute option — mais la *force* du pin dépend de l'ampleur du gamma sur le strike. Deux facteurs rendent cette ampleur considérable à l'approche de l'échéance :

### Le gamma évolue en 1/√T

Le gamma par contrat d'option est à peu près inversement proportionnel à la racine carrée du temps restant avant échéance. Le gamma at-the-money d'une option 0DTE est environ 5 fois supérieur à celui d'une option de même strike à 5 jours d'échéance, et de plusieurs ordres de grandeur supérieur à celui d'une option mensuelle. Plus on se rapproche de l'échéance, plus le gamma par contrat est élevé — et plus l'opération de couverture requise à chaque tick de prix est importante.

Un strike 0DTE sur lequel tout le monde est positionné devient en pratique un trou noir pour le spot. Les dealers doivent déplacer des quantités très importantes de sous-jacent pour des variations de prix très faibles. Le pinning devient le chemin de moindre résistance.

### L'open interest se concentre sur les strikes ronds

Le marché concentre structurellement l'open interest sur les nombres ronds — 580, 583, 585 sur SPY, 5800, 5810 sur SPX. Le vendredi après-midi, la concentration de gamma sur un ou deux de ces strikes peut dominer le reste de la chaîne combinée. Cette domination d'un strike unique produit le « magnétisme » visible que les traders ressentent à la clôture.

Combinez les deux facteurs — temps restant court avant échéance et OI concentré sur des strikes ronds — et les pins du vendredi après-midi deviennent structurellement prévisibles. Le mercredi et le lundi présentent des versions plus faibles du même schéma, à mesure que le flux 0DTE continue de croître.

---

## Deux types de pin — et ce n'est pas la même chose

Une source de confusion fréquente : le **max pain** face à l'**aimant de gamma**. Les deux sont appelés « le pin », mais ils sont calculés différemment et peuvent diverger.

### Max pain

Le max pain est le strike auquel le paiement total aux détenteurs d'options serait minimisé à l'échéance. C'est un calcul de géométrie de payoff — pure mathématique de valeur intrinsèque. Il indique le strike « structurellement favorable » aux vendeurs d'options.

### Aimant de gamma

L'aimant de gamma est le strike présentant la plus grande concentration absolue de gamma chez les dealers — le strike où la couverture forcée est la plus intense. C'est une lecture du flux de couverture.

Lorsque les deux strikes coïncident, la thèse du pin est à son maximum de force. La chaîne est équilibrée dans les deux sens. Lorsqu'ils divergent, c'est généralement l'aimant de gamma qui l'emporte, car c'est le mécanisme qui produit réellement le flux de couverture qui attire le prix.

[Le max pain expliqué](/education/max-pain-explained) approfondit cette distinction et indique honnêtement à quelle fréquence le max pain seul induit en erreur.

---

## Quand le pin tient

Les conditions structurelles qui font d'aujourd'hui une journée de pin :

- **Régime de gamma positif.** Spot au-dessus du gamma flip. Net GEX clairement positif. Sans cela, le mécanisme s'inverse entièrement.
- **Forte concentration de strike près du spot.** L'aimant de gamma se situe à 0,3-0,5 % du prix actuel. Les aimants éloignés du spot ne pinnent pas ; ils ciblent.
- **Le max pain et l'aimant de gamma concordent.** Les deux pointent vers le même niveau. Cela renforce la traction structurelle.
- **Chaîne dominée par l'échéance.** Les options 0DTE/hebdomadaires portent l'essentiel du gamma. Les chaînes dominées par les options mensuelles pinnent de manière beaucoup moins fiable.
- **Calendrier des catalyseurs calme.** Pas de données macro majeures ni d'événement de banque centrale durant la séance.
- **Volatilité réalisée en compression.** Le tape montre que le réflexe amortisseur des dealers fonctionne.

Lorsque la plupart de ces conditions s'alignent, le pin bénéficie d'une probabilité structurelle en sa faveur.

---

## Quand le pin se rompt

Le pin se défait lorsque :

- **Le croisement du gamma flip se produit.** Le spot passe sous le flip ; le régime s'inverse. Le même aimant relâche alors le prix.
- **Un catalyseur survient.** CPI, FOMC, NFP, choc sur une valeur individuelle. Le flux macro submerge le réflexe des dealers.
- **Le Net GEX se dégrade significativement.** Les positions s'éteignent à l'approche de l'échéance. À 15h30 ET le vendredi, le gamma diminue rapidement.
- **L'open interest migre.** Du nouvel OI qui se construit sur un autre strike déplace l'aimant ailleurs en cours de séance.
- **Le skew se déplace.** Une forte demande sur les puts (peur) peut inverser le signe du book des dealers, même sur le même strike.

Un pin qui tient depuis deux heures est plus durable qu'un pin qui vient de se former, mais aucun pin ne dure indéfiniment. Les conditions qui le soutenaient doivent continuer de tenir pour que le pin persiste.

---

## Lire le pin en temps réel

Une démarche rapide :

1. **Identifiez le strike au gamma le plus élevé près du spot.** C'est le candidat aimant.
2. **Vérifiez le Net GEX.** Une valeur positive substantielle est le prérequis. Négative ou proche de zéro, elle exclut le pin.
3. **Vérifiez le gamma flip.** Le spot doit se situer au-dessus. Si le flip est exactement au niveau du spot, la situation est disputée — le pin peut se former ou non.
4. **Recoupez avec le max pain.** Même strike ou à moins de 0,3 % de l'aimant → pin net. Nettement différent → thèse de pin plus faible ; faites confiance à l'aimant.
5. **Lisez l'heure de la journée.** Avant midi ET, le charm ne s'est pas encore suffisamment accumulé pour imposer fortement le pin. Après 14h00 ET, l'attraction s'intensifie. Après 15h30 ET, les dynamiques de la fenêtre de clôture dominent.

Une fois le pin identifié, le playbook de trading se trouve dans [Comment savoir si SPY est ancré](/education/how-to-know-if-spy-is-pinned) — version courte : fader les extrêmes, éviter le milieu, taille de position réduite.

---

## Exemple chiffré

SPY est à 582,95 un vendredi après-midi. ZeroGEX affiche :

- **Net GEX :** +1,4 Md$ (positif — régime long-gamma)
- **Gamma Flip :** 581,20 (spot largement au-dessus)
- **Strike 0DTE le plus lourd :** 583,00 (pratiquement au niveau du spot)
- **Max Pain :** 583,00 (concorde avec l'aimant de gamma)
- **Heure :** 14h15 ET (l'accumulation de charm démarre)

Toutes les conditions structurelles d'un pin sont réunies. L'aimant se situe à 583 ; le max pain concorde à 583 ; le régime est long-gamma ; on se trouve dans la fenêtre active de fin de journée. La probabilité que SPY oscille dans une fourchette d'environ 30 cents autour de 583 jusqu'à la clôture est sensiblement élevée.

Lecture pratique : une fourchette resserrée de 582,70-583,30 constitue le trajet attendu. Les incursions vers les bords sont des candidats à des setups de fade. Le centre de la fourchette est une zone de non-intervention. Taille de position réduite. Surveiller les conditions de rupture — en particulier en cas de choc sur une valeur individuelle ou de titre inattendu.

Imaginez maintenant le même scénario mais avec un Net GEX à −600 M$ et un gamma flip à 583,50 (spot en dessous). La thèse du « pin » est morte. Même chaîne, même strike, lecture opposée — car la variable de régime qui détermine si l'aimant attire ou relâche est inversée.

---

## Idées reçues courantes

- **« Le pinning, c'est de la psychologie. »** C'est de la mécanique. Les dealers couvrent leurs positions indépendamment de qui les observe ; le flux se produit, que les traders y croient ou non.
- **« SPY s'ancre toujours sur les nombres ronds. »** Il s'ancre sur les strikes où le positionnement se concentre. Les nombres ronds sont fréquents parce que l'OI s'y agglomère — mais le véritable mécanisme, c'est l'OI, pas le fait que le nombre soit rond.
- **« Si le max pain est X, le prix clôturera à X. »** Souvent faux. Le max pain seul n'est pas le mécanisme du pin ; c'est l'aimant de gamma qui l'est. En cas de divergence, l'aimant de gamma l'emporte.
- **« Les pins sont haussiers/baissiers. »** Ni l'un ni l'autre. Ils sont anti-volatilité. Bornés dans une fourchette. La direction vient d'ailleurs ; le pin concerne le *caractère* de l'action des prix, pas la direction.
- **« Le pinning se produit tous les vendredis. »** Souvent, mais pas toujours. Certains vendredis comportent des catalyseurs, des régimes short-gamma ou des aimants migrants qui empêchent le pin. Lire les conditions est essentiel.

---

## À retenir

> SPY s'ancre parce que la couverture des dealers sur des strikes à forte concentration de gamma ramène mécaniquement le prix vers le strike. La traction est réelle, observable et suffisamment prévisible pour être exploitée — à condition que les conditions structurelles la soutiennent.

La discipline consiste à vérifier les conditions avant de supposer qu'aujourd'hui est une journée de pin. Régime long-gamma + strike lourd au niveau du spot + concordance avec le max pain + séance avancée = pin net. Que l'un seul de ces éléments s'inverse affaiblit la lecture. Que tous s'inversent l'annule.

Contenu à but purement éducatif — rien de ce qui précède ne constitue une recommandation de trading.

---

Si vous souhaitez consulter le strike au gamma le plus lourd du jour, le max pain, le gamma flip et le Net GEX — les quatre chiffres qui déterminent si SPY s'ancre aujourd'hui —, la vue gratuite des gamma-levels de ZeroGEX les affiche tous.
