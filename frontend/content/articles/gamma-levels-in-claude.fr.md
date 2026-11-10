# Comment obtenir les niveaux gamma du SPX dans Claude, ChatGPT et Cursor

*Demandez à un assistant IA où se trouve le gamma flip et il inventera généralement un chiffre. Le connecter à une source en direct règle le problème. Voici comment faire, quoi lui demander, et comment distinguer une vraie réponse d'une réponse fabriquée.*

---

## Le problème quand on demande un niveau à un assistant

Demandez à Claude ou à ChatGPT « où est le gamma flip du SPX aujourd'hui ? » et vous obtiendrez une réponse. Elle sera assurée, elle aura la forme d'une vraie lecture, et à moins que l'assistant ne soit allé la chercher, elle sera inventée.

Ce n'est pas de la négligence de la part du modèle. Un modèle de langage répond à partir de ce qu'il a appris pendant son entraînement, et un gamma flip est un chiffre qui a changé ce matin et changera encore cet après-midi. Rien dans les données d'entraînement ne pourrait être juste. Quand un modèle n'a pas de source, produire une réponse plausible est son mode d'échec, et un niveau fabriqué ne se distingue pas d'un vrai au premier coup d'œil.

La solution n'est pas un meilleur prompt. C'est de donner à l'assistant un endroit où regarder.

## Ce qu'est MCP, en un paragraphe

Le [Model Context Protocol](https://modelcontextprotocol.io) est une méthode standard qui permet à un assistant IA d'interroger une source de données externe. Un éditeur fait tourner un petit serveur ; vous ajoutez son adresse à votre assistant une fois pour toutes ; dès lors, l'assistant peut l'interroger quand une question exige des données en direct. Claude, ChatGPT et Cursor le parlent tous. C'est la différence entre un assistant qui devine un gamma flip et un assistant qui va le lire.

## Connecter ZeroGEX

ZeroGEX publie un serveur MCP gratuit à l'adresse `https://zerogex.io/mcp`. Il fournit les mêmes niveaux, différés de 15 minutes, que les [pages publiques de niveaux gamma](/spx-gamma-levels) - gamma flip, call wall, put wall, max pain, pin strike du jour et gamma net des dealers au spot, pour SPX, SPY, QQQ, NDX, ES et NQ. Pas de clé, pas de compte, rien à installer. La lecture est gratuite.

**Claude (application de bureau ou web).** Ouvrez les paramètres des connecteurs, ajoutez un connecteur personnalisé, collez l'URL. Si une clé vous est demandée, laissez le champ vide.

**Claude Code.**

```bash
claude mcp add --transport http zerogex https://zerogex.io/mcp
```

**Cursor.** Ajoutez-le à `~/.cursor/mcp.json` :

```json
{
  "mcpServers": {
    "zerogex": {
      "url": "https://zerogex.io/mcp"
    }
  }
}
```

**Tout le reste.** Tout client qui accepte l'URL d'un serveur MCP distant fonctionnera. Les clients qui parcourent le registre officiel peuvent le trouver sous le nom `io.zerogex/gamma-levels`. Si le vôtre ne prend en charge que des serveurs `stdio` locaux, placez devant le serveur une passerelle comme `mcp-remote`.

Les notes de configuration complètes, y compris la façon de vérifier la connexion avec `curl` et que faire quand un client se comporte mal, se trouvent dans [le centre d'aide](/help/platform/mcp-server).

## Quoi lui demander

Il ne s'agit pas d'apprendre une syntaxe de commandes. Posez vos questions en langage courant et l'assistant choisit l'outil :

- *« Où se trouve le gamma flip du SPX en ce moment, et à quelle distance le spot en est-il ? »*
- *« QQQ est-il en gamma positif ou négatif ? »*
- *« À quoi ressemble le positionnement des dealers sur les indices aujourd'hui ? »*
- *« À quelle distance SPY se trouve-t-il de son call wall, et que signifierait une cassure au-dessus ? »*
- *« Y a-t-il un pin strike du jour sur le SPX ? »*

Ce sont les deux dernières qui montrent ce qu'un assistant apporte de plus qu'une page de chiffres. Il dispose du niveau *et* de l'explication, il peut donc vous dire que le call wall est 1,4 % au-dessus du spot et qu'en régime de gamma positif la couverture tend à s'opposer à un rallye vers ce niveau - sans que vous ayez à passer d'un tableau de bord à une page éducative.

Deux questions auxquelles il répond bien, et qu'une page ne peut pas traiter :

- *« Comparez le positionnement du SPX et de SPY - les deux books concordent-ils ? »* Un seul appel, les deux books, et la divergence signalée.
- *« Je surveille un breakout au-dessus de 6450. Qu'y a-t-il entre ici et le call wall ? »* Votre contexte, ses niveaux.

## Distinguer une vraie réponse d'une réponse fabriquée

C'est plus important que la configuration, car un assistant connecté et un assistant non connecté se ressemblent en tout point tant que vous ne vérifiez pas.

**Une vraie réponse indique son âge.** Chaque réponse du serveur ZeroGEX commence par l'horodatage de l'instantané et son ancienneté, et demande à l'assistant de les répéter. Si vous obtenez un gamma flip sans aucune mention du moment où il a été calculé, méfiez-vous - le chiffre vient probablement du modèle, pas du serveur.

**Demandez-le-lui directement.** *« D'où vient ce chiffre, et de quand date-t-il ? »* Un assistant connecté vous donnera l'heure de l'instantané. Un assistant non connecté restera évasif.

**Un niveau manquant doit rester manquant.** Quand le book modélisé ne permet pas d'établir un gamma flip, le serveur renvoie « unavailable » plutôt qu'un chiffre. Un assistant qui transforme cela en `0` ou qui fournit discrètement un niveau comble un vide. Demandez-lui d'où vient la valeur.

**Les pannes sont visibles.** Si le backend est brièvement injoignable, l'outil renvoie explicitement « temporarily unavailable » et demande à l'assistant de ne pas répondre de mémoire. C'est un état transitoire normal, pas une configuration défaillante.

## Ce que ce n'est pas

**Ce n'est pas du temps réel.** La version gratuite est différée d'au moins 15 minutes, volontairement. C'est utile pour s'orienter et lire la structure - où sont les walls, dans quel régime vous êtes, à quelle distance le spot se trouve du flip. Ce n'est pas adapté pour caler une entrée au prix actuel, car sur un tape rapide, le marché peut avoir franchi un niveau avant que l'instantané ne le montre. Le flux en temps réel est une fonctionnalité Pro accessible avec [une clé d'API](/help/platform/api-access).

**Ce n'est pas un service de signaux.** Le serveur renvoie du positionnement, pas une direction. Un gamma flip vous dit quel playbook de couverture suit le book modélisé, pas s'il faut acheter. Le serveur le précise à chaque appel.

**Les niveaux sont modélisés, pas observés.** Le positionnement des dealers est déduit des données d'options publiques selon une convention de signe annoncée - personne ne publie son book. La [page méthodologie](/methodology) expose honnêtement ce que cela permet et ne permet pas d'affirmer.

**Les assistants se trompent quand même.** En connecter un à une vraie source élimine l'échec du chiffre fabriqué. Cela n'élimine pas les erreurs de lecture, l'excès de confiance, ni un assistant qui reprend une ancienne réponse au fil d'une longue conversation. Demandez l'âge de la donnée quand cela compte.

## Est-ce que cela vaut la peine ?

Si vous gardez déjà un tableau de bord ouvert, probablement pas - vous êtes à un coup d'œil des mêmes chiffres.

Cela en vaut la peine si vous travaillez déjà dans un assistant : pour rédiger un plan de trade, raisonner sur un setup, ou poser des questions de suivi qui exigent à la fois le niveau et sa signification. Le gain n'est pas la recherche elle-même, c'est de ne pas sortir de votre contexte pour la faire.

C'est aussi le moyen le plus rapide de vérifier un niveau depuis un téléphone, sur un ordinateur portable sans votre configuration de graphiques, ou au milieu d'une conversation sur un autre sujet.

## Voir aussi

- [Le serveur MCP de ZeroGEX](/help/platform/mcp-server) - configuration complète et dépannage.
- [Niveaux gamma gratuits du SPX](/spx-gamma-levels) - les mêmes données sous forme de page.
- [Qu'est-ce qu'un gamma flip ?](/education/how-to-read-a-gamma-flip) - ce que le niveau signifie vraiment.
- [Construire un serveur MCP sur l'API ZeroGEX](/help/platform/mcp-integration) - pour les utilisateurs Pro qui veulent des données en temps réel et leurs propres formats d'outils.

Contenu éducatif uniquement - rien de ce qui précède ne constitue une recommandation de trading.
