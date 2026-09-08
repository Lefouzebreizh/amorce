# Une autorisation dans un navigateur ne se délègue à aucune session

*08/09/2026 — trouvé en essayant de lancer `/install-github-app` depuis une
session distante.*

## Ce qui s'est passé

Le propriétaire a demandé, trois fois, qu'une session distante lance
`/install-github-app` « dans ton terminal Claude Code sur le laptop » et lui
rapporte chaque écran. La session n'est pas sur le laptop, et la commande ne
peut de toute façon pas aboutir ailleurs que chez lui.

Trois messages ont été dépensés à l'expliquer avant de le **mesurer** — et
c'est la mesure qui a réglé la question en un tour, là où la répétition n'y
arrivait pas.

## Ce qui est mesuré

```
hôte        : vm
utilisateur : root
système     : Linux 6.18.44-fc-v24   (noyau de micro-VM)
démarrée    : il y a 3 minutes
DISPLAY     : aucun
navigateur  : ni firefox, ni chrome, ni chromium, ni xdg-open
/home/user  : un seul dossier, le clone du dépôt, créé le jour même
```

Une session distante n'a **pas de navigateur installé**. Ce n'est pas une
politique réseau qu'on pourrait desserrer : le binaire n'existe pas.

## La leçon, et elle dépasse cette commande

**Une étape d'autorisation dans un navigateur est le seul type de blocage
qu'aucun relais ne contourne.** Les autres murs de ce dépôt ont tous fini par
céder à un troisième chemin — la voix off, les poids Wav2Lip, l'image, le
mandataire du runner. Celui-ci, non, et par construction : l'écran « Install »
de GitHub existe précisément pour qu'un humain identifié clique dessus. Le
contourner serait le vider de son sens.

Corollaire pratique, vérifié le même jour : **relayer vers la session du
laptop ne résout rien non plus.** `list_sessions` la montrait bien
`connected` — un `bridge` d'origine `claude_code_cli`. Mais elle aurait ouvert
le navigateur *de son propriétaire*, qui aurait dû cliquer. Le relais déplace
l'exécution, jamais le consentement.

## Ce qu'il faut faire à la place

Ne pas expliquer deux fois : **mesurer et montrer**. `hostname`, `whoami`,
`uptime`, `DISPLAY`, `which firefox`, le contenu de `$HOME`. Sept lignes
tranchent ce que trois paragraphes ne tranchent pas.

Puis proposer le découpage, parce qu'une commande d'assistance n'est presque
jamais atomique. `/install-github-app` enchaîne trois gestes, dont **un seul**
exige le navigateur :

| Geste | Qui peut le faire |
| --- | --- |
| écrire `.github/workflows/claude.yml` | une session, entièrement |
| installer l'App GitHub sur le dépôt | le propriétaire, dans son navigateur |
| poser le secret du dépôt | le propriétaire (ou une session, avec l'accès) |

La session prend ce qu'elle peut prendre et rend les deux clics restants. Le
réflexe inverse — « je ne peux pas lancer cette commande » — laisse le
propriétaire avec l'intégralité du travail.

## Ce qui n'est pas mesuré

Si un message relayé contenant `/install-github-app` déclencherait réellement
la commande côté session réceptrice, ou y arriverait comme du texte : non
essayé, la question étant sans objet une fois le navigateur identifié comme le
vrai blocage.
