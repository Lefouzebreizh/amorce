---
name: api-tierce-verifiee
description: Écrire du code contre une bibliothèque ou une API qu'on ne connaît pas de première main — SDK, service en ligne, module livré avec un logiciel — en lisant sa surface réelle au lieu de l'écrire de mémoire. Dit comment récupérer le paquet et relever signatures, valeurs autorisées et classes d'exception en trente secondes, et comment provoquer une erreur pour apprendre sa vraie classe. À utiliser avant la première ligne écrite contre n'importe quelle dépendance extérieure : « intègre l'API de X », « ajoute la synthèse vocale », « branche Stripe », « utilise cette bibliothèque », « pourquoi mon except n'attrape rien », « ça marchait dans la doc », « le paramètre n'existe pas », « AttributeError sur le client ». À utiliser aussi quand du code existant contre une API tierce est modifié, et quand une erreur remonte d'une bibliothèque sans qu'on sache d'où elle sort. Ne pas attendre qu'un appel échoue : le moment utile est avant d'écrire.
---

# Lire l'API avant de l'écrire

Ce que je crois savoir d'un SDK a une date, et les clients d'API sont
précisément ce qui bouge le plus — souvent générés, renumérotés, réorganisés
plusieurs fois par an.

Écrire de mémoire puis corriger ce que la machine refuse ne converge pas : un
nom de paramètre corrigé révèle un ordre d'arguments, qui révèle un type de
retour. Mais surtout, **certaines erreurs ne se manifestent pas dans cette
boucle** — une branche `except` qui n'attrape rien passe tous les tests et ne
se voit que le jour de la panne, chez l'utilisateur.

## Relever la surface réelle

Récupérer le paquet sans l'installer et le lire. Pas la documentation en ligne,
qui décrit souvent une autre version que celle qui sera résolue.

```bash
pip download <paquet> --no-deps -d /tmp/pkg && cd /tmp/pkg && unzip -q *.whl
sed -n "/def <methode>/,+30p" <paquet>/<chemin>/client.py
```

```bash
npm pack <paquet> && tar xf *.tgz && sed -n '1,80p' package/dist/index.d.ts
```

Trois choses valent d'être relevées, parce que ce sont les trois qu'on invente
sans s'en rendre compte : **la signature** (ce qui est positionnel, ce qui est
nommé, ce que la méthode rend — un itérateur de blocs n'est pas un fichier) ;
**les valeurs autorisées** d'un format ou d'un identifiant de modèle, qui vivent
dans un type littéral ; **les classes d'exception**, leur nom *et* leur module,
rarement exportées à la racine.

## Provoquer l'erreur pour connaître sa classe

C'est le point rentable, et celui qu'on saute.

Une hiérarchie d'exceptions ne se déduit pas d'un nom plausible. Ranger les
pannes réseau d'un client HTTP sous `OSError` paraît évident — et c'est **faux**
pour `httpx`, dont les erreurs de transport dérivent de `httpx.RequestError`,
sans aucun lien avec `OSError`. Tous les SDK générés par Fern sont concernés
(ElevenLabs, Deepgram…). Le code compile, les tests passent, la branche
n'attrape rien, et la panne réseau tombe dans le filet générique avec un
message inexploitable.

```python
try:
    client.methode(...)          # clé bidon, hôte injoignable, entrée invalide
except Exception as e:
    print(type(e).__mro__[:5])   # la chaîne d'héritage, pas seulement le nom
    print("est OSError :", isinstance(e, OSError))
```

Trois provocations suffisent : **authentification refusée**, **transport**,
**entrée invalide**. Ce sont les trois branches qu'on écrira.

Quand le service est hors d'atteinte, fabriquer l'objet d'erreur à la main et
vérifier ce qu'on en fait : le tri se teste entièrement hors ligne, et il ne se
teste que comme ça.

## Trier sur ce que le service dit, pas sur ce qu'on espère

Beaucoup d'API n'ont **pas** de classe distincte par cause. Un quota épuisé
arrive comme une erreur générique, parfois sous deux codes selon le cas. Trier
sur le type donne alors le même message pour une clé morte et pour un crédit
épuisé — c'est le code HTTP, ou le corps de la réponse, qui porte l'information.

Dernier réflexe : **le plus récent n'est pas le plus disponible.** Un
identifiant de modèle tout juste sorti n'est pas ouvert à tous les comptes.
Choisir par défaut la version la plus récente *généralement disponible* et
laisser l'autre en option — un défaut qui échoue chez la moitié des
utilisateurs est pire qu'un défaut modeste.
