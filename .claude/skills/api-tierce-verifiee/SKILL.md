---
name: api-tierce-verifiee
description: Écrire du code contre une bibliothèque ou une API qu'on ne connaît pas de première main — SDK, service en ligne, module livré avec un logiciel — en lisant sa surface réelle au lieu de l'écrire de mémoire. Dit comment récupérer le paquet et relever les signatures, les valeurs autorisées et les types d'exception en trente secondes, et comment provoquer une erreur pour apprendre sa vraie classe. À utiliser avant la première ligne écrite contre n'importe quelle dépendance extérieure : « intègre l'API de X », « ajoute la synthèse vocale », « branche Stripe », « utilise cette bibliothèque », « pourquoi mon except n'attrape rien », « ça marchait dans la doc », « le paramètre n'existe pas », « AttributeError sur le client ». À utiliser aussi quand du code existant contre une API tierce est modifié, et quand une erreur remonte d'une bibliothèque sans qu'on sache d'où elle sort. Ne pas attendre qu'un appel échoue : le moment utile est avant d'écrire.
---

# Lire l'API avant de l'écrire

Ce que je crois savoir d'un SDK a une date. Les bibliothèques qui bougent le
plus vite sont précisément celles qu'on intègre — les clients d'API sont
souvent générés, renumérotés et réorganisés plusieurs fois par an.

Écrire de mémoire puis corriger ce que la machine refuse **semble** rapide :
chaque erreur paraît à un caractère de la solution. En pratique c'est la boucle
la plus lente qui existe, parce qu'elle ne converge pas — un nom de paramètre
corrigé révèle un ordre d'arguments, qui révèle un type de retour. Trente
secondes de lecture remplacent trois cycles.

Et surtout : certaines erreurs ne se voient **pas** dans cette boucle. Une
branche `except` qui n'attrape jamais rien ne se manifeste que le jour de la
panne, chez l'utilisateur.

## Relever la surface réelle

Récupérer le paquet sans l'installer, et le lire. Pas la documentation en
ligne, qui décrit souvent une autre version que celle qui sera résolue.

```bash
# Python — le paquet tel qu'il sera installé
pip download <paquet> --no-deps -d /tmp/pkg && cd /tmp/pkg && unzip -q *.whl

grep -rn "def <methode>" <paquet>/ | head          # où vit la méthode
sed -n "/def <methode>/,+30p" <chemin/client.py>   # sa signature entière
```

```bash
# Node — même idée
npm pack <paquet> && tar xf *.tgz
sed -n '1,80p' package/dist/index.d.ts
```

Trois choses valent d'être relevées, parce que ce sont les trois qu'on invente
sans s'en rendre compte :

- **la signature** — quels arguments sont positionnels, lesquels sont nommés,
  ce que la méthode rend vraiment (un itérateur de blocs n'est pas un fichier) ;
- **les valeurs autorisées** — un format, un identifiant de modèle, une énumération.
  Elles sont dans le code, souvent dans un type littéral. Les deviner donne un
  code qui échoue à l'exécution, pas à l'écriture ;
- **les classes d'exception** — leur nom *et* leur module. Elles ne sont pas
  toujours exportées à la racine.

## Provoquer l'erreur pour connaître sa classe

Le point le plus rentable de cette compétence, et celui qu'on saute.

Une hiérarchie d'exceptions ne se déduit pas d'un nom plausible. Ranger les
pannes réseau d'un client HTTP sous `OSError` paraît évident — et c'est faux
pour `httpx`, dont les erreurs de transport dérivent de `httpx.RequestError`,
sans aucun lien avec `OSError`. Le code compile, les tests passent, la branche
n'attrape rien, et la panne réseau tombe dans le filet générique avec un
message inexploitable.

Alors on provoque :

```python
try:
    client.methode(...)          # clé bidon, hôte injoignable, entrée invalide
except Exception as e:
    print(type(e).__mro__[:5])   # la chaîne d'héritage, pas seulement le nom
    print("est OSError :", isinstance(e, OSError))
    print(e)
```

Trois provocations couvrent l'essentiel : **authentification refusée** (clé
fausse), **transport** (hôte injoignable, proxy filtrant), **entrée invalide**.
Ce sont les trois branches qu'on écrira, et la seule façon honnête de savoir
laquelle attrape quoi.

Quand le vrai service est hors d'atteinte, fabriquer l'objet d'erreur à la main
et vérifier ce qu'on en fait : le tri se teste entièrement hors ligne, et il ne
se teste que comme ça.

## Trier sur ce que le service dit, pas sur ce qu'on espère

Beaucoup d'API n'ont **pas** de classe distincte par cause. Un quota épuisé
arrive comme une erreur générique, et parfois sous deux codes selon le cas.
Trier sur le type d'exception donne alors un message faux dans la moitié des
cas — c'est le code HTTP, ou le corps de la réponse, qui porte l'information.

Le contrôle qui le prouve tient en quelques lignes : fabriquer une erreur par
code attendu, et vérifier que chacune produit le conseil qu'on veut lire.

## Ce qu'on ne conclut pas trop vite

- **Un `403` n'est pas toujours le service.** Dans un environnement filtré,
  c'est le proxy qui répond, et le compte n'est pas en cause. Regarder le type
  de l'exception avant d'accuser la clé.
- **Un exemple de documentation n'est pas un contrat.** Il est souvent écrit
  pour une version majeure antérieure. La version résolue par le gestionnaire
  de paquets est la seule vérité.
- **Un identifiant de modèle récent n'est pas ouvert à tous.** Ce qui est le
  plus récent chez l'éditeur n'est pas forcément accessible au compte. Choisir
  par défaut la version la plus récente **généralement disponible**, et laisser
  l'autre en option : un défaut qui échoue chez la moitié des utilisateurs est
  pire qu'un défaut modeste.
