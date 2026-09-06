# Un port qui accepte n'est pas une page qui répond

06/09/2026 — mesuré sur `iptv/`, en écrivant le script de lancement en une
commande.

## Ce qui a été mesuré

Un serveur de développement Next.js **accepte la connexion TCP avant d'avoir
compilé la première page**. Les deux instants ont été chronométrés séparément
sur la même machine, par une boucle qui teste d'un côté l'ouverture du port et
de l'autre une vraie requête HTTP :

| état du cache de construction | le port accepte | la page rend 200 | écart |
| --- | --- | --- | --- |
| chaud (`.next` présent) | 0,006 s | 0,508 s | **80×** |
| **froid (`.next` supprimé)** | 0,659 s | **3,451 s** | **5,2×**, soit 2,8 s |

Le port est donc joignable pendant près de trois secondes sans qu'aucune page
n'existe derrière — et c'est le cas *froid* qui compte, puisque c'est celui du
premier lancement, le seul où quelqu'un regarde l'écran en se demandant si ça
marche.

## Pourquoi ça coûte quelque chose

Un script qui annonce l'adresse dès que le serveur est **lancé** l'annonce trop
tôt. La personne tape l'adresse sur son téléphone, tombe sur une erreur de
connexion, et **accuse l'adresse** — pas le délai. Elle la retape, doute du
Wi-Fi, cherche l'adresse ailleurs. Le défaut ne se voit jamais depuis la
machine qui héberge, où l'on met plus de trois secondes à changer de fenêtre.

Les deux parades habituelles échouent chacune à leur façon :

- **attendre que le processus soit vivant** (`kill -0`, un `&` qui rend la
  main) mesure le lancement, pas le service — c'est l'erreur ci-dessus ;
- **attendre un délai fixe** (`sleep 5`) est faux dans les deux sens : trop
  long quand le cache est chaud, trop court sur une machine lente ou un projet
  plus gros. Un nombre écrit à la main vieillit avec le projet.

## Le geste juste

Attendre une **vraie réponse HTTP**, en boucle, avec une sortie par le haut :

```bash
for _ in $(seq 60); do
  kill -0 "$serveur" 2>/dev/null || { echo "le serveur s'est arrêté"; exit 1; }
  curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:${PORT}/" && break
  sleep 1
done
```

Les deux moitiés comptent. `curl -sf` mesure ce qu'on annonce ; le `kill -0`
évite d'attendre soixante secondes un serveur mort à la deuxième — sans lui,
un plantage à la compilation ressemble à une machine lente.

## Ce que ça généralise

C'est la forme la plus courante d'un défaut que ce dépôt écrit partout :
**une mesure juste sur le mauvais objet.** Le port était bien ouvert, la mesure
ne mentait pas — elle ne portait simplement pas sur la chose qu'on s'apprêtait
à promettre. Vaut pour tout ce qui se vérifie « en amont » de ce qu'on annonce :
un processus lancé n'est pas un service rendu, un déploiement créé n'est pas une
page servie, un test vert n'est pas un fichier regardé.
