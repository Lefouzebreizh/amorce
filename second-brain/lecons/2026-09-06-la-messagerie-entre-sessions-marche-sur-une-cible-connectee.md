# La messagerie entre sessions marche — sur une cible connectée, pas sur n'importe laquelle

`CLAUDE.md` §7 affirmait depuis le 29/08/2026, sans condition : « une session
distante ne peut pas en joindre une autre ». Mesuré à nouveau le 06/09/2026, en
situation réelle — retrouver une session qui portait un rapport d'audit et un
fichier volontairement non committé (`cibles-audit.md`, même traitement que
`prospects.md`) avant que son conteneur ne soit repris.

`ListAgents` a rendu un texte différent de ce qu'on attendait d'une
impossibilité : « peer messaging itself is available » — le mécanisme existe.
Zéro pair listé, mais pour une raison précise : `get_session` sur l'identifiant
visé rendait `connection_status: disconnected`. `SendMessage` vers cet
identifiant a échoué proprement — « No agent named … is reachable » — plutôt
que par un refus générique.

**Ce qui était faux n'est donc pas « le canal n'existe pas », c'est « le canal
n'atteint jamais rien ».** Il atteint une session `connected` au même instant.
La mesure du 29/08 portait sans doute sur des cibles déjà déconnectées, ce qui
donne exactement le même symptôme qu'un mécanisme bloqué — et c'est ce qui
trompe : un échec de messagerie ne dit pas si c'est le mécanisme ou la cible
qui est en cause, il faut lire `connection_status` pour trancher.

Conséquence pratique : **essayer coûte un appel, conclure sans essayer coûte
une fausse certitude.** Sur une session vue `connected` par `list_sessions`,
tenter `SendMessage` a une chance réelle de marcher. Sur une session
`disconnected` ou absente de la liste, ça échouera à coup sûr — mais on ne
peut pas parier lequel des deux cas on a devant soi sans regarder.

Ce que ça ne change pas : le dépôt reste le seul canal **durable**. Une session
peut disparaître entre l'envoi et la lecture, un message ne survit pas à ça —
seul ce qui est écrit et fusionné persiste pour la session suivante.
