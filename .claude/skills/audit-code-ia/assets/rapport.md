# Audit technique — [Application]

**Pour :** [Nom] · **Le :** [date] · **Portée :** [dépôt / URL publique examinée]

_Audit réalisé sur [le dépôt public / l'accès communiqué le …]. Cinq constats,
classés par ce qui cassera en premier — pas par gravité théorique._

---

## 1. [Le constat le plus urgent]

**Le fait :** _localisé et daté. « La clé OpenAI est lisible dans le dépôt
public depuis le 3 mars, fichier `app.js` ligne 1. »_

**La conséquence :** _ce qui arrive si rien n'est fait, et quand._

**Le correctif :**

```
[le code ou les commandes exactes — écrit, pas décrit]
```

_Ce correctif est à vous, applicable sans moi._

---

## 2. [Constat]

**Le fait :** · **La conséquence :** · **À faire :** _(une ligne chacun)_

## 3. [Constat]

## 4. [Constat]

## 5. Absence de tests automatisés

**Le fait :** _X fichiers source, Y fichiers de test._

**La conséquence :** ce constat ne casse rien par lui-même — il rend les quatre
précédents difficiles à réparer sans en créer d'autres. Chaque correctif devient
un pari tant qu'il n'existe pas de filet.

---

## Ce que je propose

| Option | Contenu | Délai | Prix |
| --- | --- | --- | --- |
| **Arrêter l'hémorragie** | Constats 1 à 3 | | |
| **Remise en état** | Les 5 constats + tests sur les chemins critiques | | |
| **Ne rien faire** | — | — | _coût attendu de l'inaction_ |

_La troisième option est là parce qu'elle est légitime. Certains constats
peuvent attendre ; celui du n°1, non._

---

_[Nom] · [contact]_
