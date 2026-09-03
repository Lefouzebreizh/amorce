# Le courrier qui accompagne un audit non sollicité

Le rapport prouve la compétence. Le courrier décide s'il sera **lu**.

Un message de sécurité que personne n'a demandé se lit comme un racket, sauf
s'il est bâti pour ne pas l'être. Ce n'est pas une question de politesse : c'est
la seule chose qui sépare « quelqu'un m'aide » de « quelqu'un me tient ».

## Les quatre règles, non négociables

1. **Le correctif du constat n°1 est donné entier, gratuit, applicable sans
   nous.** C'est la preuve qu'on ne monnaie pas l'information. Un audit qui
   décrit le défaut sans donner sa réparation *est* une demande de rançon polie.
2. **Aucune échéance, aucune urgence.** Jamais « avant que quelqu'un d'autre ne
   le trouve », jamais « il faut agir vite ». Le fait suffit ; l'urgence
   fabriquée est ce que ce dépôt s'interdit partout ailleurs (§1 de `CLAUDE.md`),
   et elle ne devient pas acceptable parce que le destinataire est une
   entreprise.
3. **Dire où le relevé s'est arrêté.** « Je n'ai lu que ce que votre site sert à
   n'importe quel visiteur, je n'ai rien forcé. » C'est vrai, c'est vérifiable,
   et c'est ce qui rend la suite payante : ce qu'il y a derrière demande son
   accord.
4. **Ne publier le constat nulle part.** Jamais, sous aucune forme, quelle que
   soit la réponse — y compris l'absence de réponse. Un constat publié
   transforme rétrospectivement le courrier en menace.

## Le gabarit

Court. Six lignes, pas douze : un courrier long se lit comme une plaquette.

> **Objet :** deux points techniques sur [nom du produit]
>
> Bonjour [prénom],
>
> Je suis développeur, je remets en état des applications construites avec
> Lovable / Bolt / v0. J'ai regardé [produit] parce que [raison honnête en cinq
> mots — vu sur Product Hunt, croisé sur X].
>
> J'ai trouvé deux ou trois choses qui méritent votre attention, dont une qui
> se corrige en dix minutes. Le correctif est écrit dans le document joint : il
> est à vous, applicable sans moi.
>
> Je n'ai lu que ce que votre application sert à n'importe quel visiteur — la
> page, ses fichiers JavaScript, ses en-têtes. Je n'ai forgé aucune requête et
> rien tenté contre vos données.
>
> Si le reste vous intéresse, dites-le-moi. Sinon, gardez le correctif et bonne
> continuation.
>
> [Prénom Nom] · [contact]

**Ce que le gabarit ne fait pas, et c'est délibéré :** il ne nomme pas le défaut
dans le corps du message. Le fait vit dans le document joint, pas dans un
courrier qui traînera dans une boîte partagée. Le corps dit qu'il existe et que
sa réparation est offerte — c'est tout ce qu'il faut pour être ouvert.

## Les trois réponses, et quoi en faire

| Ce qu'on reçoit | Ce que ça vaut | Le geste |
| --- | --- | --- |
| « Merci, corrigé. » | Le plus fréquent. Ce n'est pas un échec : l'audit a servi. | Une ligne, rien de plus. Ne pas relancer. |
| « Combien pour le reste ? » | Le signal qu'on cherche. | Le tableau à trois options du rapport, sans ajouter un mot. |
| « J'ai déjà passé un scanner. » | **Le mieux qualifié du lot.** | Il a quarante lignes que personne n'a classées, et il est déjà convaincu que le problème existe. Ce qui se vend est le classement, pas le relevé. |

Le silence est la quatrième réponse et la plus courante. Il ne se relance pas :
un second message sur un sujet de sécurité non sollicité bascule du côté de la
pression. Un envoi, un seul.

## Le cadre légal, en deux lignes

En France, un courrier de prospection **entre professionnels** est licite sans
consentement préalable si son objet est en rapport avec la fonction de la
personne démarchée (position CNIL), à condition d'indiquer l'identité de
l'expéditeur et un moyen de s'y opposer. Les deux tiennent dans la signature :
un nom réel, un contact réel, et un mot pour ne plus être recontacté.

Ce n'est pas la partie qui protège le plus. **Ce qui protège, c'est le relevé
passif** : rien n'a été forcé, et le courrier le dit.
