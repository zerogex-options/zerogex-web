# ZeroGEX vs SpotGamma (2026) : niveaux gamma, tarifs et outils gratuits comparés

*Une comparaison équitable de ZeroGEX et de SpotGamma : ce pour quoi chaque service est conçu, comment leurs niveaux clés se correspondent, à quelle fréquence chacun se met à jour, ce que coûte chaque offre, ce que vous pouvez voir gratuitement, là où SpotGamma est le choix le plus solide, et là où ZeroGEX convient mieux. Les offres, les prix et les fonctionnalités de SpotGamma proviennent de son propre site et de ses pages de paiement, vérifiés le {{spotgamma:checked}}.*

---

## En bref

SpotGamma et ZeroGEX publient tous deux des niveaux clés dérivés des options : le call wall et le put wall, où le gamma se concentre, et le prix où le gamma dealer modélisé passe par zéro. Ils diffèrent par ce qui accompagne ces niveaux et par la fréquence à laquelle ils bougent.

- **SpotGamma** est un service de recherche autant qu'un outil de données. Chaque offre comprend sa Founder's Note avant l'ouverture et après la clôture de chaque séance, des niveaux clés pour les grands indices américains et des niveaux GEX quotidiens pour plus de 3 500 actions, indices et ETF. Sa page d'accueil place ses outils en temps réel, comme TRACE (une heatmap du S&P 500) et HIRO (son indicateur de couverture en temps réel), dans son offre supérieure.
- **ZeroGEX** couvre six symboles - SPX, SPY, QQQ, NDX, et les futures ES et NQ - et va plus en profondeur sur ceux-ci : des niveaux recalculés environ une fois par minute tout au long de la séance dans les deux offres, une heatmap gamma, le flux de couverture, et quatorze signaux construits sur les niveaux, avec une méthode publiée et un historique noté.

Si vous voulez une note de recherche quotidienne, le GEX d'actions individuelles sur des milliers de valeurs, ou les niveaux propriétaires de SpotGamma, SpotGamma est plus proche de ce qu'il vous faut. Si vous faites du day trading sur le complexe des indices et voulez des niveaux qui bougent tout au long de la séance pour moins cher, c'est le cas de ZeroGEX.

## Les niveaux, côte à côte

| SpotGamma | ZeroGEX | Ce qu'il indique |
|---|---|---|
| Call Wall | Call Wall | Le strike présentant la plus forte concentration de gamma call |
| Put Wall | Put Wall | La même chose côté puts |
| Zero Gamma | Gamma Flip | Le prix où le gamma dealer modélisé passe par zéro |
| Volatility Trigger | Pas d'équivalent | Un niveau propriétaire de SpotGamma |
| Risk Pivot | Pas d'équivalent | Un niveau propriétaire de SpotGamma |

Les walls partagent une définition. L'[article explicatif sur le call wall](https://spotgamma.com/call-wall-put-wall-explained/) de SpotGamma décrit le call wall comme le strike présentant la plus forte concentration de gamma call, et le put wall comme son pendant côté puts. ZeroGEX les définit presque de la même façon : le strike au-dessus du spot qui porte la plus forte exposition gamma sur les calls, et le strike sous le spot qui porte la plus forte exposition gamma sur les puts. Tous deux traitent un wall comme un repère plutôt que comme un plafond ou un plancher rigide. ZeroGEX a mesuré à quelle fréquence les walls ont réellement tenu : dans son étude de 737 tests de walls, les walls du S&P ont tenu environ deux fois sur trois dans l'heure suivant un test et ceux du Nasdaq environ une fois sur deux ([l'étude](/education/how-often-do-gamma-walls-break)).

Le zero gamma et le gamma flip sont construits de la même façon dans leur principe. Le [guide GEX](https://spotgamma.com/gamma-exposure-gex/) de SpotGamma décrit le recalcul du gamma des options sur une plage de prix spot hypothétiques et la localisation du passage par zéro. ZeroGEX calcule lui aussi son flip à partir d'un profil de gamma sur une plage de prix, et laisse le flip vide lorsque la chaîne ne permet pas de déterminer un croisement fiable. La méthode figure sur sa page [Méthodologie](/methodology).

SpotGamma publie aussi deux niveaux qui lui sont propres. Il décrit le Volatility Trigger comme un niveau propriétaire dérivé de sa distribution estimée du gamma plutôt que d'un passage par zéro, et un de ses propres articles, plus ancien, le qualifie de dernier niveau majeur de support en gamma positif, qui peut se situer plusieurs points au-dessus du zero gamma. Il décrit le Risk Pivot comme un niveau de scénario qui délimite où la structure du marché peut devenir plus ou moins porteuse ; les pages consultées n'indiquent pas comment il est calculé. Le niveau de ZeroGEX le plus proche de l'un comme de l'autre est le gamma flip. ZeroGEX ajoute ses propres niveaux : GEX King, le strike qui porte le plus de gamma, et le Pin Strike, le strike 0DTE proche où le gamma dealer positif et les chances que le prix l'atteigne se combinent le plus fortement.

### Comment les positions des dealers sont modélisées

Aucun des deux services ne voit directement l'inventaire des dealers. ZeroGEX le modélise à partir de l'open interest selon la convention standard qui suppose les dealers longs sur les calls et shorts sur les puts. Le graphique gamma gratuit de SpotGamma utilise cette même convention standard, et SpotGamma indique que son modèle payant, SGOI, estime le positionnement des teneurs de marché et du buy-side strike par strike. Des modèles différents peuvent placer les walls sur des strikes différents le même jour ; attendez-vous donc à ce que les niveaux des deux services diffèrent parfois.

### À quelle fréquence les niveaux sont mis à jour

La Founder's Note de SpotGamma, avec ses niveaux pour les grands indices américains, est diffusée avant l'ouverture et après la clôture de chaque séance dans toutes les offres, et les niveaux de son Equity Hub pour les actions individuelles sont mis à jour chaque jour avant l'ouverture. La FAQ de sa page d'accueil place HIRO, TRACE et son Volatility Dashboard dans l'offre Alpha, bien que certaines de ses autres pages les indiquent dans toutes les offres ; vérifiez donc auprès de SpotGamma quelle offre inclut ce dont vous avez besoin.

ZeroGEX recalcule ses niveaux environ une fois par minute tout au long de la séance régulière, dans les deux offres, et ses pages gratuites affichent les mêmes niveaux avec environ 15 minutes de retard.

## Prix

Prix catalogue, hors promotions et hors taxes, tels que les formulaires de paiement de SpotGamma les facturaient le {{spotgamma:checked}}. La page de tarifs de SpotGamma affichait aussi des offres sur le premier mois que ses formulaires de paiement n'appliquaient pas ce jour-là ; consultez donc son site pour connaître l'offre en cours. SpotGamma vend aussi une offre Institutional, qui n'est pas comparée ici. Les prix de ZeroGEX sont ceux qui figurent aujourd'hui sur sa page [Tarifs](/pricing).

| Offre | Facturation mensuelle | Facturation annuelle |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mois | {{zgx:basic:annual}}/an (environ {{zgx:basic:annual:mo}}/mois) |
| ZeroGEX Pro, avec accès API | {{zgx:pro:monthly}}/mois | {{zgx:pro:annual}}/an (environ {{zgx:pro:annual:mo}}/mois) |
| SpotGamma Essential | {{spotgamma:essential:monthly}}/mois | {{spotgamma:essential:annual}}/an (environ {{spotgamma:essential:annual:mo}}/mois) |
| SpotGamma Alpha | {{spotgamma:alpha:monthly}}/mois | {{spotgamma:alpha:annual}}/an (environ {{spotgamma:alpha:annual:mo}}/mois) |

Les deux offres ZeroGEX coûtent moins cher que l'une ou l'autre des offres SpotGamma, en mensuel comme en annuel, et un an de ZeroGEX Pro coûte le même prix qu'un mois de SpotGamma Alpha. Ces prix n'achètent toutefois pas la même chose : celui de SpotGamma couvre des milliers d'actions, une note de recherche deux fois par jour, des webinaires et, avec Alpha, ses outils en temps réel ; celui de ZeroGEX couvre six symboles en profondeur, avec des niveaux qui bougent tout au long de la séance dans les deux offres.

Les essais et les remboursements diffèrent aussi. ZeroGEX Basic mensuel commence par un essai gratuit de 7 jours, sans aucun prélèvement avant la fin de l'essai, et toutes les autres offres ZeroGEX sont couvertes par une garantie satisfait ou remboursé de 7 jours. La page de tarifs de SpotGamma n'indique aucun essai gratuit sur ses offres payantes ; par ailleurs, SpotGamma propose une semaine gratuite de son rapport quotidien Opening Setup, sans carte requise. Ses conditions indiquent que les paiements d'abonnement ne sont pas remboursables, sauf indication contraire.

## Ce que vous pouvez voir gratuitement

- **SpotGamma** publie un [graphique d'exposition gamma du SPX](https://spotgamma.com/free-tools/spx-gamma-exposure/) gratuit qui, selon SpotGamma, est mis à jour chaque jour, ainsi qu'un calculateur de profit sur options et un graphique des mouvements implicites autour des résultats.
- **ZeroGEX** publie le gamma flip, le call wall, le put wall et le net GEX pour chacun de ses six symboles, avec environ 15 minutes de différé et une actualisation tout au long de la séance, sans inscription : tous les symboles sur une seule page, [niveaux GEX du jour](/gex-levels), et une page par symbole, comme [niveaux gamma SPX](/spx-gamma-levels). Le [Gamma Terminal](/chart) affiche gratuitement un graphique gamma de SPY en différé, et le [serveur MCP](/education/gamma-levels-in-claude) met les niveaux différés à disposition d'assistants IA comme Claude et ChatGPT.

## Là où SpotGamma est le choix le plus solide

- **Recherche et commentaires.** La Founder's Note avant l'ouverture et après la clôture de chaque séance, dans toutes les offres, plus des webinaires hebdomadaires en direct, une communauté Discord et, avec Alpha, des sessions de formation quotidiennes en direct. ZeroGEX propose des articles pédagogiques et un centre d'aide, et pas de note quotidienne.
- **Étendue.** Des niveaux GEX quotidiens pour plus de 3 500 actions, indices et ETF américains dans son Equity Hub et, avec Alpha, HIRO sur plus de 3 000 actions. ZeroGEX couvre six symboles.
- **Son propre modèle de positionnement et ses propres niveaux.** SGOI, son estimation du positionnement des teneurs de marché et du buy-side, ainsi que le Volatility Trigger et le Risk Pivot. ZeroGEX utilise la convention standard et ne publie aucun équivalent de l'un ou l'autre de ces niveaux.
- **Plus de plateformes.** SpotGamma indique des intégrations avec TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap, TrendSpider, Jigsaw, eSignal et EdgePro. ZeroGEX fonctionne avec six : TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap et SabrTrader.

## Là où ZeroGEX est le choix le plus solide

- **Prix.** Les deux offres ZeroGEX coûtent moins cher que l'une ou l'autre des offres SpotGamma, et ZeroGEX Pro inclut l'accès API. Les listes de fonctionnalités des offres Essential et Alpha de SpotGamma n'incluent pas d'API.
- **Des niveaux qui bougent tout au long de la séance dans les deux offres.** Environ une fois par minute, sur Basic comme sur Pro. Les pages de SpotGamma décrivent des niveaux mis à jour chaque jour avant l'ouverture, et sa page d'accueil place ses outils en temps réel dans Alpha.
- **ES et NQ sur le prix des futures.** ZeroGEX construit les niveaux ES à partir de la chaîne SPX et les niveaux NQ à partir de la chaîne NDX, puis les projette sur le contrat future dont il affiche le cours ([comment cela fonctionne](/help/platform/futures-contract-months)), gratuitement en différé sur [niveaux gamma ES](/es-gamma-levels) et [niveaux gamma NQ](/nq-gamma-levels). Le site de SpotGamma indique que ses niveaux s'intègrent aux plateformes de futures, mais les pages consultées n'indiquent pas qu'il publie des niveaux sur le prix des futures.
- **Plus de contenu gratuit.** Les niveaux des six symboles, actualisés tout au long de la séance en différé, face au graphique SPX quotidien de SpotGamma.
- **Une méthode publiée et un historique noté.** La page [Méthodologie](/methodology) expose la façon dont les niveaux sont calculés, le [Track Record](/track-record) note chaque prévision que ZeroGEX publie, erreurs comprises, et l'[étude sur les walls](/education/how-often-do-gamma-walls-break) publie la fréquence à laquelle les walls ont réellement cédé.
- **Profondeur sur le complexe des indices.** Une heatmap gamma tout au long de la séance, le gamma par échéance, le flux de vanna et de charm, le flux de couverture, et quatorze signaux construits sur les niveaux, dont les méthodes sont exposées dans le [guide des signaux](/guides/signals-explained).

## Comment choisir

- **Vous voulez une note de recherche quotidienne avec vos niveaux, ou des webinaires et de la formation :** SpotGamma.
- **Vous tradez des actions individuelles et voulez des niveaux GEX sur des milliers de valeurs :** SpotGamma.
- **Vous faites du day trading sur SPX, SPY, QQQ, NDX, ES ou NQ et voulez un flip et des walls qui bougent tout au long de la séance, pour moins cher :** ZeroGEX.
- **Vous cherchez une alternative gratuite à SpotGamma :** ouvrez la page [niveaux GEX du jour](/gex-levels), sans inscription, et comparez-la avec les niveaux que vous utilisez actuellement.

---

Les offres, les prix et les fonctionnalités de SpotGamma proviennent de [spotgamma.com](https://spotgamma.com) et de ses pages de paiement, vérifiés le {{spotgamma:checked}}, et peuvent changer à tout moment ; confirmez-les donc sur ce site. Les prix de ZeroGEX indiqués sur cette page sont lus en direct dans sa grille tarifaire. ZeroGEX n'est pas affilié à SpotGamma. Contenu éducatif uniquement, pas une recommandation de trading.
