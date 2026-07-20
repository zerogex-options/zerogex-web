# Qu'est-ce que le GEX en trading ? L'exposition gamma expliquée simplement

*Le GEX — l'exposition gamma — est le chiffre unique qui explique pourquoi certains jours le marché reste bloqué dans un range étroit tandis que d'autres partent en tendance forte. Voici la version en langage clair : ce que mesure le GEX, pourquoi il fait bouger le marché, et ce que signifient les valeurs positives et négatives pour votre trading.*

---

## Qu'est-ce que le GEX en trading ?

**GEX signifie gamma exposure (exposition gamma).** En trading, le GEX mesure combien les dealers d'options qui font le marché doivent acheter ou vendre du sous-jacent — mécaniquement, pour rester couverts (hedgés) — à mesure que le prix évolue. C'est un indicateur du flux de couverture *forcé* qui se trouve sous le marché à chaque instant.

C'est toute l'idée en une phrase : le GEX estime dans quelle direction, et avec quelle intensité, les dealers doivent trader pour garder leurs positions neutres lorsque le prix bouge. Quand ce flux de couverture s'oppose aux mouvements, le marché est plus collant et plus calme. Quand il va *dans le sens* des mouvements, le marché devient plus rapide et les tendances se renforcent.

Tout le reste — le gamma flip, les call walls, les put walls, le pinning — n'est qu'une lecture plus détaillée de cette même force. Voici la version simple. Pour un traitement complet et approfondi, lisez le guide [Gamma Exposure (GEX) Explained: The Complete Guide](/education/gamma-exposure-explained).

---

## Que mesure réellement le GEX ?

Les market makers qui vous vendent des options ne veulent pas d'un pari directionnel — ils veulent la commission, pas le risque. Ils se couvrent donc. Le **gamma** est la grecque qui indique à quelle vitesse l'exposition directionnelle d'une option (delta) évolue lorsque le sous-jacent bouge. Comme le gamma oblige les dealers à se re-couvrir en permanence, le gamma *agrégé* sur l'ensemble de la chaîne d'options indique combien de re-couverture le marché doit effectuer.

Le GEX résume tout cela en un seul chiffre signé — généralement exprimé en dollars de gamma, ou « dollar gamma » — pour tout un indice comme le S&P 500. Une magnitude plus élevée signifie plus de couverture forcée sous le marché. Le **signe** indique dans quelle direction cette couverture pousse.

---

## GEX positif vs négatif (pourquoi c'est important)

C'est la partie qui change votre façon de trader :

- **GEX positif (régime long-gamma).** Les dealers sont nets longs en gamma. Pour se couvrir, ils **vendent lors des rallyes et achètent lors des baisses** — en tradant *contre* le mouvement. Cela amortit la volatilité. Attendez-vous à des ranges plus étroits, à un retour à la moyenne (mean reversion) et à du pinning près des strikes les plus lourds. Les breakouts ont tendance à caler.
- **GEX négatif (régime short-gamma).** Les dealers sont nets courts en gamma. Ils **achètent désormais lors des rallyes et vendent lors des baisses** — en tradant *avec* le mouvement. Cela amplifie la volatilité. Attendez-vous à des ranges plus larges, à des breakouts qui s'étendent, et à des tendances qui filent. C'est [ce que signifie le gamma négatif](/education/what-is-negative-gamma) en pratique.

Même indice, même graphique — un caractère de marché opposé selon le signe du GEX. Savoir dans quel régime vous vous trouvez est l'élément le plus utile que le GEX puisse vous fournir.

---

## Niveaux clés du GEX : le gamma flip, le call wall, le put wall

Le GEX n'est pas qu'un simple chiffre ; il se traduit par des niveaux de prix précis à surveiller :

- **Gamma flip** — le prix auquel le gamma total des dealers passe de positif à négatif. Au-dessus, le marché est généralement dans le régime apaisant du long-gamma ; en dessous, dans le régime amplificateur du short-gamma. C'est la ligne de démarcation entre les régimes. Voir [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).
- **Call wall** — le strike affichant le plus fort gamma d'achat (call) au-dessus du spot, qui tend à plafonner les rallyes en gamma positif.
- **Put wall** — le strike affichant le plus fort gamma de vente (put) en dessous du spot, qui tend à soutenir les baisses.

Le call wall et le put wall dessinent le range que les dealers défendent ; le gamma flip vous indique s'ils vont le défendre ou le faire sauter. [Gamma Walls Explained](/education/gamma-walls-explained) traite en détail ces deux walls.

---

## Comment les traders utilisent le GEX

Vous ne tradez pas le GEX directement — vous l'utilisez comme un **filtre** qui fixe la stratégie à adopter avant même de regarder quoi que ce soit d'autre :

1. **Vérifiez le régime.** GEX positif → privilégiez les fades, le retour à la moyenne et le trading en range. GEX négatif → privilégiez le momentum et les breakouts, et respectez vos stops.
2. **Notez les niveaux.** Repérez le gamma flip, le call wall et le put wall comme carte structurelle de la séance.
3. **Surveillez le flip.** Un franchissement du gamma flip est un changement de stratégie, pas simplement un tick de prix — l'ensemble du caractère du marché peut changer.

Le GEX ne vous dira pas *ce qui* va se passer ensuite. Il vous indique dans quel *type* de journée vous vous trouvez probablement, afin que vous arrêtiez d'appliquer une stratégie de retour à la moyenne un jour de tendance.

---

## Où consulter le GEX par vous-même

Vous n'avez pas besoin de calculer le gamma des dealers à la main. ZeroGEX publie le Net GEX du jour, le gamma flip, le call wall et le put wall — gratuitement et avec environ 15 minutes de décalage — pour [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels). Pour une lecture en direct, à la sous-seconde, avec le profil gamma complet, une heatmap strike par DTE et le composite à 13 signaux, ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte).

---

## À retenir

> Le GEX — l'exposition gamma — est une lecture de la couverture forcée des dealers sous le marché. Le GEX positif amortit les mouvements ; le GEX négatif les amplifie. Identifiez d'abord correctement le signe, et le reste du marché commencera à faire sens.

Contenu éducatif uniquement — rien de ce qui précède ne constitue une recommandation de trading.

---

Vous voulez le voir en temps réel ? Consultez la lecture GEX du jour sur les pages gratuites de niveaux gamma de [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels) et [QQQ](/qqq-gamma-levels), puis approfondissez avec le [guide complet du GEX](/education/gamma-exposure-explained) ou ouvrez le [tableau de bord GEX 0DTE en temps réel](/real-time-gex-0dte).
