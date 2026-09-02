# Audit de sécurité — Life-Organizer

**Date** : 02/09/2026 · **Périmètre** : `life-organizer/` (7 243 lignes de Python)
**Posture** : lecture seule. Aucun fichier de code n'a été modifié.

Chaque constat ci-dessous a été **vérifié par exécution**, pas déduit de la
lecture. Les trois cas où je n'ai pas pu vérifier sont dits comme tels.

---

## Ce que l'audit cherchait et qui **ne s'applique pas ici**

À dire avant le reste, sinon l'absence de constat se lit comme un oubli.

| Cherché | Verdict |
| --- | --- |
| Injection SQL | **Sans objet** — aucune base de données. `grep` sur `sqlite`, `psycopg`, `sqlalchemy` : zéro résultat. |
| Route sans vérification de propriétaire | **Sans objet** — aucun serveur HTTP, aucune route. `flask`, `fastapi`, `django`, `http.server` : zéro résultat. |
| Fichier accessible par une URL devinable | **Sans objet** — rien n'est servi sur le réseau. |
| Désérialisation dangereuse | **Absente** — ni `pickle`, ni `yaml.load`, ni `marshal`, ni `shelve`. |

C'est un outil **local en ligne de commande**. La surface d'attaque n'est pas
le réseau : ce sont les **chemins de fichiers**, les **permissions disque** et
les **dépendances**.

---

## 🔴 CRITIQUE

### C-1 · La destination du rangement n'est jamais confinée à la bibliothèque

**Où** — `modules/classement/traitement.py:156`, alimenté par
`modules/classement/regles.py:188` et `regles.py:144-158`.

```python
destination = bibliotheque / rangement.destination      # traitement.py:156
return Path(trouve["dossier"]), f"thème « {trouve['nom']} »"   # regles.py:188
```

`trouve["dossier"]` vient **directement** de `classement.themes[].dossier` dans
la configuration, sans aucune validation de forme. Or en Python, un opérande
droit absolu **remplace** le gauche.

**Vérifié par exécution** :

| `dossier` configuré | chemin réellement écrit | dans la bibliothèque ? |
| --- | --- | --- |
| `Documents/Administratif/Entreprise` | `~/Life-Organizer/Bibliotheque/Documents/…` | oui |
| `/tmp/exfiltration` | `/tmp/exfiltration/releve-bancaire.pdf` | **non** |
| `../../../tmp/ailleurs` | `/tmp/ailleurs/releve-bancaire.pdf` | **non** |

`grep` sur `is_relative_to`, `relative_to`, `commonpath` dans tout le paquet :
**aucun garde-fou**. `noyau/config.py` valide scrupuleusement une quinzaine de
réglages — périodicités, seuils, doublons d'extensions — et **jamais** la forme
de ces chemins.

Le même défaut vaut pour `classement.schema` (`regles.py:147`) : un schéma
commençant par `../..` s'applique tel quel.

**Pourquoi c'est dangereux** — Ce sont des relevés bancaires, avis d'imposition,
ordonnances et quittances qui sont déplacés. Un seul champ mal formé dans un
fichier JSON les envoie, en un lot de plusieurs centaines, dans n'importe quel
dossier accessible en écriture : un dossier synchronisé vers un nuage, un
partage réseau, `/tmp`. `noyau/fichiers.py:deplacer()` crée au passage
l'arborescence manquante (`mkdir(parents=True)`), donc rien ne résiste.

La configuration n'est pas nécessairement de confiance : `organizer.py` accepte
`--config <chemin>` vers **n'importe quel fichier**, et le `README` invite
explicitement à copier et partager le modèle. Un fichier de configuration reçu,
récupéré d'une sauvegarde ou modifié par un autre programme suffit.

**Piste de correction** — Ajouter dans `noyau/config.py`, à côté des
validations existantes, un refus de tout `themes[].dossier` et de tout
`classement.schema` qui soit absolu ou contienne un segment `..`. Doubler d'un
contrôle à l'écriture dans `traitement.py` : résoudre la destination et refuser
si elle n'est pas sous la bibliothèque résolue — la vérification en deux
endroits est justifiée, la configuration pouvant être contournée par un appel
direct au module. Le refus doit être **bloquant**, pas un avertissement : ces
commandes tournent sur des lots de plus de mille fichiers, et personne ne lit la
sortie en entier.

---

## 🟠 IMPORTANT

### I-1 · La borne `opencv<5` n'est pas tenue à l'exécution — le garde-fou « visage » est **inerte**

**Où** — `requirements.txt` (borne déclarée), `modules/nettoyage/traitement.py:229-258`
(dégradation), `tests/test_plafond_opencv.py` (test censé tenir la borne).

**Vérifié sur cette machine** :

```
opencv-python-headless installé : 5.0.0.93
cv2.CascadeClassifier           : ABSENT
tests/test_plafond_opencv.py    : 4 tests, OK
```

Les quatre tests passent — et pourtant la protection ne s'applique pas. Ils
vérifient que les **quatre fichiers de déclaration** plafonnent sous la 5 et que
le code cherche le classifieur au lieu de le supposer. Aucun ne vérifie la
**version réellement installée**.

Conséquence directe : `nettoyage_medias.flou.ignorer_si_visage_detecte: true`
est sans effet, et `regles.py:375` ne peut jamais rendre son verdict
« floue, mais un visage y est reconnu ».

**Pourquoi c'est dangereux** — `CLAUDE.md` porte la mesure faite le 02/09/2026
sur la machine du propriétaire : **9 portraits de famille sur 10** marqués
« flous » avaient un visage détectable. Sans le classifieur, ces photos partent
en quarantaine. Elles sont récupérables pendant
`retention_quarantaine_jours` (30 par défaut), puis **définitivement effacées**
par `noyau/fichiers.py:purger_quarantaine()`. Le seul avertissement
(`commande.py:188-194`) est imprimé une fois, en tête d'un traitement qui
défile sur des milliers de fichiers.

C'est une perte de données irréversible, silencieuse, sur le contenu le plus
sentimentalement irremplaçable du disque.

**Piste de correction** — Faire échouer le démarrage, et non seulement avertir,
quand `ignorer_si_visage_detecte` est demandé et que le détecteur est
introuvable : le réglage promet une protection qui n'existe pas, et un
avertissement ne suffit pas à un traitement en lot. Ajouter au test un contrôle
de la version **importée** (`cv2.__version__`), pas seulement des fichiers qui
la déclarent — c'est l'écart exact entre ce que le dépôt affirme et ce que la
machine fait. À défaut, désactiver d'office l'analyse de flou quand le
classifieur manque : ne rien écarter vaut mieux qu'écarter les portraits.

### I-2 · Bibliothèque, quarantaine et journal sont lisibles par tout utilisateur local

**Où** — `noyau/fichiers.py:110` (`mkdir(parents=True, exist_ok=True)`),
`fichiers.py:118` (manifeste `origines.jsonl`), `fichiers.py:200`
(`destination.parent.mkdir`). `grep` sur `chmod` et `umask` dans le paquet :
**aucun**, hors un test.

**Vérifié par exécution** — dossiers créés en `0o755` (`drwxr-xr-x`), fichiers
en `0o644` (`-rw-r--r--`), sous l'umask par défaut `0o022`.

**Pourquoi c'est dangereux** — Ces dossiers contiennent, par conception, ce que
la configuration livrée nomme elle-même : relevés de compte, RIB, avis
d'imposition, décomptes de remboursement de mutuelle, ordonnances, baux, cartes
grises. Sur une machine partagée — poste familial, session multi-comptes,
machine d'entreprise — n'importe quel autre utilisateur les lit sans privilège
particulier. Le manifeste `origines.jsonl` aggrave le cas : il consigne en clair
le **chemin d'origine complet** de chaque document écarté, ce qui cartographie
l'arborescence personnelle même pour qui ne lirait pas les fichiers eux-mêmes.

**Piste de correction** — Créer bibliothèque, quarantaine et journal en `0o700`,
et les fichiers de manifeste et de journal en `0o600`, au moment de leur
création dans `noyau/fichiers.py` et `noyau/journal.py`. Ne pas compter sur
l'umask de l'utilisateur, qui est un réglage global qu'aucun outil ne maîtrise.
Sur Windows le mode POSIX est ignoré : le dire dans le `README` plutôt que de
laisser croire à une protection uniforme.

### I-3 · La promesse « aucun fichier ne quitte la machine » n'est tenue par aucun garde-fou

**Où** — `organizer.py:170` l'affiche dans l'aide de la commande. La
configuration livrée porte pourtant trois points de sortie réseau :
`scan_ocr.api_vision` (avec `envoyer_hors_ligne_seulement_si_echec_local`),
`upscale.api`, et `resiliation.cle_variable_env: ANTHROPIC_API_KEY`.

**Vérifié** — `grep` sur `requests`, `urllib`, `httpx`, `socket`,
`point_de_terminaison`, `os.environ` dans tout le paquet : **aucun code réseau**.
Les seules occurrences sont la validation de `noyau/config.py:205` et un test.

La promesse est donc **vraie aujourd'hui**, et tenue uniquement par l'absence de
code. Rien ne l'empêche de devenir fausse.

**Pourquoi c'est dangereux** — La configuration décrit une fonctionnalité qui
n'existe pas : elle se lit comme une invitation à l'implémenter. Le jour où un
module câble `api_vision`, il enverra à un tiers le texte d'avis d'imposition et
d'ordonnances — exactement les documents que
`scan_ocr.types_reconnus` apprend à reconnaître. Aucun test ne tomberait, et
l'aide de la commande continuerait d'afficher la promesse inverse. C'est le
motif que `CLAUDE.md` §3 nomme : *une règle périmée est pire qu'une règle
absente, parce qu'on la suit*.

**Piste de correction** — Deux gestes indépendants. D'abord un test qui relit le
source du paquet et refuse tout import réseau — le projet `conseiller-patrimoine/`
en porte déjà un, éprouvé en injectant les violations : il y a un modèle à
recopier, pas à inventer. Ensuite, trancher sur les trois sections de
configuration : soit les retirer, soit écrire noir sur blanc, à côté d'elles,
qu'activer l'une d'elles rompt la promesse de l'outil.

---

## 🟡 MINEUR

### M-1 · Aucun verrouillage des dépendances

**Où** — `requirements.txt`, six paquets, tous en `>=` sans borne haute (sauf
`opencv-python-headless>=4.9,<5`). Ni fichier de verrouillage, ni empreintes.

**Pourquoi c'est dangereux** — Deux installations à deux dates donnent deux
environnements différents ; un audit fait ici ne vaut pas pour la machine du
propriétaire. C'est exactement ce que I-1 démontre. Sans empreintes, une version
compromise d'un paquet en amont s'installe sans que rien ne l'arrête.

Je n'ai **pas** pu confronter les versions installées à une base de
vulnérabilités : aucun hôte de ce type n'est joignable depuis cette session, et
`pip-audit` n'est pas installé. Versions relevées, à vérifier sur une machine
connectée : Pillow 12.3.0, pillow-heif 1.5.0, pypdf 6.16.2, ImageHash 4.3.2,
python-dateutil 2.9.0. Aucune n'est ancienne, ce qui rend le risque théorique
plutôt qu'observé.

**Piste de correction** — Produire un fichier de verrouillage avec empreintes,
et lancer `pip-audit` dans l'intégration continue plutôt qu'à la main. Prévoir
que le plafond `opencv<5` finira par retenir un correctif de sécurité de la
branche 5 : la décision est bonne aujourd'hui, elle mérite une date de
réexamen.

### M-2 · Fenêtre de concurrence entre le choix du nom et l'écriture

**Où** — `noyau/fichiers.py:88-101` (`nom_disponible`), appelé par
`mettre_en_quarantaine` (`:107`) et `deplacer` (`:198`).

Le nom libre est choisi par `exists()`, puis le fichier est écrit. Entre les
deux, un autre processus peut créer ce nom — `shutil.move` écrase alors sans
rien dire, ce qui annule la promesse de la quarantaine (« pouvoir tout remettre
en place »).

**Pourquoi c'est mineur** — L'outil est mono-utilisateur et séquentiel ; la
fenêtre est étroite et personne d'autre n'écrit dans la quarantaine. Le risque
réel est un dossier synchronisé vers un nuage, dont le client écrit en
arrière-plan.

**Piste de correction** — Créer la destination en exclusivité (`O_EXCL`) et
réessayer au nom suivant si elle existe déjà, plutôt que de vérifier puis
d'écrire.

### M-3 · Le modèle versionné porte des abonnements qui ressemblent à de vraies données

**Où** — `organizer_config.json`, suivi par git, dans un dépôt **public**.

La séparation est correcte et explicite : `organizer.py:78-96` charge d'abord
`~/.config/life-organizer/config.json`, et le `.gitignore` couvre
`/life-organizer/config.json`. Le modèle versionné n'est donc pas le fichier de
travail — c'est un bon montage.

Mais le modèle porte trois abonnements avec montants, dates de souscription et
notes personnelles : *« Prix passé de 29,99 € à 39,99 € en janvier 2026 »*,
*« Non ouvert depuis mai »*. Ce ne sont pas des valeurs neutres.

**Pourquoi c'est dangereux** — Ce n'est ni un secret ni un identifiant, et rien
ne permet d'ouvrir un compte avec. C'est de la donnée personnelle de dépense,
publiée et indexable, dans l'historique git — donc non retirable par une simple
modification.

**Piste de correction** — Remplacer les trois entrées par des valeurs
manifestement fictives. Ne pas réécrire l'historique pour si peu : le coût
dépasse l'enjeu, et une branche partagée réécrite casse tous les clones.

### M-4 · Les chemins passés à ffmpeg ne sont pas préfixés `file:`

**Où** — `modules/conversion/traitement.py:240,471,521` et
`modules/nettoyage/traitement.py:441,502`.

Les appels sont **corrects sur l'essentiel** : forme liste, jamais `shell=True`,
délai posé partout, et `--` avant le chemin sur les deux sondes `ffprobe`. Il
n'y a **pas** d'injection de commande possible.

Reste que ffmpeg interprète son entrée par préfixe de protocole. Un fichier
nommé `concat:a|b` serait lu comme le protocole `concat` et non comme un
fichier. En pratique les chemins sont absolus — ils commencent par `/`, aucun
protocole ne correspond — donc le cas n'est **pas atteignable en l'état**.

**Piste de correction** — Préfixer `file:` les entrées de ffmpeg, ou poser
`-protocol_whitelist file`. C'est du durcissement : cela ferme la porte avant
qu'une racine relative, un jour, ne la rende atteignable.

---

## Ce qui est sain, et qui doit être dit

Un audit qui ne liste que des fautes donne une image fausse. Ce projet est
défendu mieux que la moyenne, et plusieurs protections sont explicitement
conçues :

- **Aucun secret en clair**, et mieux : `noyau/config.py:205-213` **refuse
  activement** une configuration contenant `cle`, `cle_api`, `token` ou
  `api_key`, avec la raison écrite (« ce fichier se copie et se sauvegarde »).
- **Aucune injection de commande** : cinq appels `subprocess`, tous en forme
  liste, aucun `shell=True`, délai sur chacun.
- **Les liens symboliques ne sont pas suivis** (`os.walk(followlinks=False)` et
  saut explicite des `is_symlink()`) — ce qui ferme la traversée par lien et la
  boucle infinie.
- **Rien n'est jamais écrasé** : `nom_disponible()` décale le nom.
- **L'empreinte SHA-256 est vérifiée avant que l'original ne soit retiré**
  (`fichiers.py:186-215`), dans le seul ordre qui protège d'une copie tronquée.
- **Un seul point d'effacement** dans tout le projet, borné aux dossiers dont le
  nom se lit comme une date ISO : un dossier étranger dans la quarantaine n'est
  pas touché.
- **Simulation par défaut** (`securite.simulation_par_defaut: true`), et
  `suppression_directe: true` est **refusée** par la validation.
- **Extraction d'IBAN et de numéro de sécurité sociale désactivées** par défaut.
- **Le parcours ne s'interrompt jamais** sur un fichier illisible, ce qui évite
  l'état à moitié traité — le plus difficile à rattraper.

---

## Ordre de traitement conseillé

1. **C-1** — le seul défaut qui déplace des documents hors de la zone prévue,
   et il ne coûte qu'une validation.
2. **I-1** — perte de photos déjà en cours **sur cette machine**, silencieuse,
   avec une fenêtre de rattrapage de 30 jours.
3. **I-2** — une ligne de `chmod` par dossier créé.
4. **I-3** — un test, à recopier de `conseiller-patrimoine/`.
5. Les mineurs, au fil de l'eau.

**Non couvert par cet audit**, et dit plutôt que supposé : les versions
installées n'ont pas été confrontées à une base de vulnérabilités (aucun hôte
joignable depuis cette session) ; le comportement sur Windows et macOS n'a pas
été observé ; et l'audit porte sur `life-organizer/` seul — `paper-manager/`,
qui partage le domaine des documents sensibles, n'était pas dans le périmètre.
