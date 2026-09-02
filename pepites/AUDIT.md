# Audit de sécurité — Radar de pépites

**Date** : 02/09/2026 · **Périmètre** : `pepites/` (6 305 lignes Python)
**Posture** : lecture seule. Aucun fichier de code modifié.

**Aucun constat.** Ce rapport est court parce que les vecteurs cherchés ne sont
pas là — et il dit précisément lesquels ont été cherchés, pour qu'on ne le lise
pas comme un blanc-seing.

## Ce qui a été cherché, et n'a rien donné

| Cherché | Résultat |
| --- | --- |
| Clé ou jeton en clair | **aucun** — `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` sont lus dans l'environnement (`skills/telegram.py:102-103`) |
| Exécution de commande | **aucune** — ni `subprocess`, ni `os.system`, ni `shell=True`, ni `eval`, ni `exec` |
| Désérialisation dangereuse | **aucune** — ni `pickle`, ni `yaml.load` |
| Injection SQL | **sans objet** — pas de base relationnelle |
| Vérification TLS désactivée | **aucune** — pas de `verify=False` ; `requests` vérifie par défaut |
| Requête sans délai | **aucune** — `timeout=self.delai` sur les deux chemins de `core/reseau.py` (98 et 152) |

## Deux protections délibérées, et elles méritent d'être nommées

**Le nom d'un jeton est traité comme hostile, et le code l'écrit** — c'est le
bon réflexe, et rare :

> *« Le texte du jeton — nom, symbole — vient d'un contrat que n'importe qui a pu
> déployer. Il est échappé avant d'entrer dans un message en HTML : un jeton
> nommé `<b>` casserait la mise en forme »*

C'est la seule donnée réellement contrôlée par un tiers dans tout le projet — un
attaquant peut déployer un contrat au nom de son choix — et elle est neutralisée
au bon endroit.

**Le verrou de scan** (`core/verrou.py:145`) entoure le tour entier et non la
seule écriture, ce que `main.py:56-58` explique : deux tours simultanés valent
deux fois le débit annoncé, et les 429 frappent les deux. Ce n'est pas de la
sécurité au sens strict, mais c'est ce qui empêche le radar de se faire bannir
des API qu'il interroge.

## Ce que cet audit ne dit pas

Il n'a **pas** examiné la logique de notation, le bouclier anti-rugpull, ni la
justesse des seuils — ce sont des questions de justesse, pas de sécurité, et
`/regler-le-radar` et `/eprouver-une-regle` les couvrent.

Il n'a **pas** confronté les dépendances à une base de vulnérabilités : aucun
hôte de ce type n'est joignable depuis une session distante et `pip-audit` n'est
pas installé.

Et il n'a **pas** pu observer un tour réel : les neuf hôtes de marché rendent
tous `000` depuis ici, ce que `CLAUDE.md` §7 documente déjà.
