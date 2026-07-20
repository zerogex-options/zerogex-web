# Net Volume vs Directional Flow : qu'est-ce qui compte vraiment dans le tape des options ?

*La plupart des traders débattent du put/call volume face au directional flow. Les professionnels traitent généralement cela comme une première étape, avant de passer rapidement à la conviction pondérée par le premium.*

---

## La réponse honnête : aucun des deux n'est un étalon-or à lui seul

Si vous cherchez une métrique parfaite unique, vous serez déçu.

**Cumulative Net Volume** et **Cumulative Net Directional Volume** sont toutes deux utiles, mais elles répondent à des questions différentes. Les desks de flow sérieux surveillent généralement les deux, puis accordent le plus de poids aux métriques de premium pour calibrer la conviction.

---

## Métrique 1 : **Cumulative Net Volume**

*(Call Volume − Put Volume)*

C'est en fait la lecture inverse du classique put/call ratio.

Elle est largement utilisée car simple, rapide et disponible partout. Mais elle est aussi grossière.

La faiblesse principale : **elle ne peut pas dire qui a initié le trade, ni pourquoi.**

Une hausse du call volume peut signifier :
- de la spéculation directionnelle haussière,
- du covered call overwriting,
- une gestion d'inventaire par le dealer,
- ou une activité de hedge roll.

Le volume seul ne peut pas distinguer la conviction de la mécanique.

---

## Métrique 2 : **Cumulative Net Directional Volume**

*((Calls Bought − Calls Sold) − (Puts Bought − Puts Sold))*

Cette métrique tente de répondre à une meilleure question :

> **Qui était l'agresseur ?**

Lorsque les traders lèvent l'ask, ils expriment généralement de l'urgence et une intention directionnelle. Lorsqu'ils tapent le bid, ils réduisent généralement le risque, encaissent du premium, ou font du fade.

En théorie, cela rend le directional volume plus informatif que le volume brut.

Mais cette métrique présente une vraie faiblesse : **la classification du côté du trade est imparfaite.**

La plupart des systèmes déduisent l'intention acheteur/vendeur à partir de la proximité au bid/ask. Cela échoue lorsque :
- des blocs s'impriment près du mid,
- des croisements négociés se font hors écran,
- ou des exécutions dark/complexes ne se mappent pas proprement sur les cotations lit.

Ironiquement, ces trades « désordonnés » sont souvent les prints institutionnels les plus significatifs.

---

## Ce sur quoi les équipes de flow professionnelles se concentrent réellement

### Le premium, pas les contrats.

Un lot de 50 000 en calls hebdomadaires bon marché type loterie peut sembler énorme en volume, tout en représentant un capital modeste. Un lot de 500 sur des contrats deep ITM peut porter un risque notionnel et une information nettement plus importants.

C'est pourquoi les desks tendent à privilégier le **flow pondéré par le capital**, plutôt que le nombre de contrats.

Votre champ :

**Cumulative Net Premium**

`= (calls bought premium − calls sold premium) − (puts bought premium − puts sold premium)`

constitue généralement une lecture unique plus solide sur l'orientation de l'argent informé, car elle reflète les dollars réellement engagés.

---

## Classement pratique pour la conviction

Si l'objectif est la qualité de la conviction directionnelle :

1. **Net directional premium** (meilleur signal unique)
2. **Net directional volume** (meilleur que le volume brut)
3. **Net volume** (contexte utile, le plus faible isolément)

Ou en une ligne :

> **Le Net Directional Volume surpasse le Net Volume pour la conviction, mais le Net Directional Premium est ce à quoi les desks de flow sérieux accordent généralement le plus de poids.**

---

## Comment l'utiliser dans un workflow en direct

Une séquence pratique que les traders peuvent appliquer en intraday :

- Commencez par le **net volume** pour lire la participation globale.
- Confirmez avec le **net directional volume** pour estimer l'intention de l'agresseur.
- Validez avec le **net directional premium** avant d'engager du risque.
- Si le volume et le premium divergent, faites confiance aux dollars plutôt qu'aux contrats.

Aucun panneau unique ne devrait piloter à lui seul votre arbre de décision. Mais le directional flow pondéré par le premium vous maintiendra généralement plus proche du signal de « l'argent informé » et plus loin des prints bruyants de gros titres.
