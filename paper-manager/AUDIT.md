# Audit de sécurité — Paper-Manager

**Date** : 02/09/2026 · **Périmètre** : `paper-manager/` (5 864 lignes de Python)
**Posture** : lecture seule. Aucun fichier de code n'a été modifié.

Chaque constat est **vérifié par exécution**. Les trois points non vérifiables
depuis une session distante sont dits comme tels plutôt que supposés.

## Coordination — ce que d'autres audits couvrent déjà

Pour qu'une prochaine session ne refasse pas le travail, ni ne croie couvert ce
qui ne l'est pas :

| Périmètre | Où |
| --- | --- |
| Amorce (studio) et serveur de licence | PR #563, branche `claude/audit-securite-amorce` |
| Life-Organizer | `life-organizer/AUDIT.md`, fusionné en `460237e` |
| **Paper-Manager** | **ce fichier** |
| `agence/` (Supabase + RLS), `iptv/`, `titan-builder/`, `hypersensible-bienveillance/`, `conseiller-patrimoine/` | **personne** |

`agence/` est le seul projet du dépôt qui porte une vraie authentification
multi-utilisateurs et des politiques RLS. C'est le plus gros angle mort restant.

---

## 🔴 CRITIQUE

### P-1 · Les documents les plus sensibles partent chez un tiers **par défaut**

**Où** — `admin_config.exemple.json:70-72`, `core/extraction.py:368-370`,
`core/extraction.py:436-439`, `core/scan.py:128-138`.

**Vérifié** :

```
extraction.active   : True        ← dans le modèle livré
fournisseur         : anthropic
cle_api             : env:ANTHROPIC_API_KEY
```

Le chemin réel, tel qu'il s'exécute :

```python
if vision is not None and lecture.images and champs.confiance < seuil:
    bruts = lire_par_modele(lecture.images, ...)      # extraction.py:369
```

et ce qui est transmis (`extraction.py:436-439`) :

```python
"source": {"type": "base64", "media_type": genre,
           "data": base64.standard_b64encode(chemin.read_bytes()).decode("ascii")}
```

Ce sont les **images des pages entières**, pas des champs extraits.

**Pourquoi c'est dangereux** — La condition de déclenchement sélectionne
exactement les documents les plus sensibles. `scan.py` ne rend une page en image
que lorsqu'elle **ne contient aucun texte utile** : c'est la définition d'un
scan ou d'une photo. Une facture PDF native est lue par motifs et ne part
jamais ; un bulletin de salaire photographié, une ordonnance scannée, un relevé
reçu en image partent intégralement. La configuration livrée sait d'ailleurs
reconnaître ces types — `quittance`, `releve`, `impots` — donc l'outil est conçu
pour eux.

Trois facteurs se combinent, et c'est leur produit qui fait la gravité :

1. `active` vaut **true** dans le modèle que le `README` invite à copier.
2. La clé n'a pas à être posée pour ce projet : `ANTHROPIC_API_KEY` est une
   variable d'environnement **déjà présente** sur la machine d'un utilisateur de
   Claude Code. Le commentaire d'`extraction.py:459-461` va plus loin et le
   revendique — le SDK est laissé libre de chercher aussi
   `ANTHROPIC_AUTH_TOKEN` ou un profil `ant auth login`.
3. Rien ne demande confirmation **par document**, et rien n'annonce à l'écran
   qu'un envoi a eu lieu.

Un utilisateur peut donc téléverser des dizaines de documents médicaux et
bancaires sans avoir fait un seul geste explicite d'autorisation.

Ce n'est pas un défaut de code : la fonctionnalité est assumée, documentée, et
le repli par motifs est bien conçu. C'est un **défaut de réglage par défaut**,
et c'est le plus coûteux des trois parce qu'il est invisible.

**Piste de correction** — Livrer le modèle avec `extraction.active: false`, et
faire de l'activation un geste conscient. Afficher, au moment de l'envoi, le nom
du document qui part et vers qui — une ligne suffit. Prévoir un refus explicite
pour les catégories que la configuration nomme déjà comme sensibles (santé,
banque), plutôt qu'un réglage global. Et cesser de laisser le SDK chercher une
clé ailleurs que dans `cle_api` : hériter silencieusement de la clé d'un autre
outil est ce qui rend l'envoi possible sans décision.

---

## 🟠 IMPORTANT

### P-2 · `modele_dossier` n'est jamais validé — les documents peuvent sortir du coffre

**Où** — `core/nommage.py:100-117`, `core/config.py:277`.

La fonction `destination()` le dit elle-même dans sa docstring : *« Ne vérifie
rien, n'écrit rien. »* Et `config.py:277` lit le gabarit comme du texte libre :

```python
modele_dossier=bloc.texte("modele_dossier", "{annee}/{categorie}")
```

**Vérifié par exécution** :

| `modele_dossier` | chemin résolu | dans le coffre ? |
| --- | --- | --- |
| `{annee}/{categorie}` | `…/coffre/classes/2026/Banque` | oui |
| `/tmp/fuite` | `/tmp/fuite` | **non** |
| `../../../tmp/ailleurs` | `/home/tmp/ailleurs` | **non** |

`grep` sur `is_relative_to`, `relative_to`, `commonpath` dans `core/` et
`interface/` : aucun confinement.

**C'est la même classe de défaut que C-1 de Life-Organizer**, mais **moins
grave**, et la raison mérite d'être dite : ici les valeurs interpolées sont
assainies (voir la section « ce qui est sain »), donc le contenu d'un document
hostile ne peut rien injecter. Seul le gabarit lui-même, écrit par le
propriétaire, peut faire sortir les fichiers.

**Piste de correction** — Refuser dans `core/config.py` un `modele_dossier` ou
un `modele_nom` absolu ou contenant `..`, au même endroit que les autres
contrôles de forme. Doubler d'une vérification de confinement au moment
d'écrire.

### P-3 · Le tableau de bord n'a aucune authentification

**Où** — `interface/app.py`, et l'absence de `.streamlit/config.toml` (vérifiée).

L'écran affiche le total mensuel, la répartition par catégorie, les contrats
classés par urgence de préavis et les alertes — c'est-à-dire une photographie
complète de la situation financière.

Streamlit ne fournit **aucun mécanisme d'authentification**. Toute personne
capable d'atteindre le port voit tout.

**Ce que je n'ai pas pu mesurer, et qui décide de la gravité** : l'adresse
d'écoute réelle. `streamlit` n'est pas installé dans cette session — c'est
délibéré côté projet, il est exclu de `.github/requirements-tests.txt` — donc je
n'ai pas pu lancer le serveur et relever s'il n'écoute que sur `127.0.0.1` ou
sur toutes les interfaces. **À vérifier sur la machine du propriétaire** :
lancer l'interface et lire si la sortie annonce une « Network URL » en plus de
la « Local URL ». Si oui, le tableau de bord est lisible par tout appareil du
réseau local — box partagée, réseau d'entreprise, wifi public.

Le `README` d'`app.py` dit « ce qu'on regarde depuis le téléphone », ce qui
laisse penser à un accès depuis un autre appareil, donc à une écoute ouverte.

**Piste de correction** — Poser un `.streamlit/config.toml` qui force
`server.address = "127.0.0.1"`, et documenter que l'accès depuis le téléphone
passe par un tunnel SSH plutôt que par une exposition directe. Si un accès
réseau est réellement voulu, il lui faut un mot de passe — mais la première
option est plus sûre et coûte une ligne.

### P-4 · Coffre, journal et images de pages rendues créés en permissions par défaut

**Où** — `core/journal.py:111`, `core/scan.py:138`, `core/resiliation.py:249`,
`core/formulaires.py:263`. `grep` sur `chmod` et `umask` dans `core/` :
**aucun**.

Tous les `mkdir(parents=True, exist_ok=True)` héritent de l'umask, soit `0o755`
pour les dossiers et `0o644` pour les fichiers — mesuré sur le projet voisin,
même mécanisme.

**Pourquoi c'est dangereux** — Deux aggravations propres à ce projet, par
rapport au constat équivalent de Life-Organizer :

- `core/scan.py:138` crée un dossier d'**images de pages rendues**. Ce sont des
  reproductions fidèles de scans sensibles, écrites sur disque, et rien dans le
  code ne les efface après lecture. Elles survivent au traitement.
- Les lettres de résiliation produites par `core/resiliation.py` portent nom,
  adresse, courriel et téléphone du propriétaire — l'identité complète, en clair,
  lisible par tout utilisateur local.

**Piste de correction** — Créer coffre, journal et dossier d'images en `0o700`,
les fichiers en `0o600`. Effacer les images de pages une fois l'extraction
terminée, ou les écrire dans un dossier temporaire supprimé en fin de
traitement — elles n'ont aucune raison de survivre au document dont elles
proviennent.

---

## 🟡 MINEUR

### P-5 · Dépendances non verrouillées

`requirements.txt` : cinq paquets en `>=`, sans borne haute ni empreintes.
`anthropic>=1.0` est particulièrement large pour la bibliothèque qui porte le
seul appel réseau du projet.

Le projet fait mieux que la moyenne sur un point, et il faut le dire : la borne
`PyMuPDF>=1.24.3` est **justifiée par écrit**, avec le défaut exact qu'elle
évite (les versions 1.24.0 à .2 ne livrent que `fitz/`, pas `pymupdf/`).

**Non vérifié** : je n'ai pas pu confronter les versions à une base de
vulnérabilités — aucun hôte de ce type n'est joignable d'ici et `pip-audit`
n'est pas installé.

**Piste** — Fichier de verrouillage avec empreintes, et `pip-audit` en
intégration continue.

### P-6 · Le message d'erreur du SDK est propagé tel quel

**Où** — `core/extraction.py:483-487`.

```python
except Exception as erreur:
    raise ErreurVision(f"lecture par modèle impossible : {erreur}") from None
```

Le choix est délibéré et expliqué (« la cause change, la conduite non »), et il
est bon pour le diagnostic. Mais le message d'un SDK HTTP peut porter l'URL
appelée et des en-têtes ; il finit dans la sortie console et, selon l'usage,
dans un journal partagé.

**Piste** — Tronquer ou filtrer le message avant affichage, ou ne montrer le
détail que sous un indicateur de débogage.

---

## Ce qui est sain, et qui doit être dit

Ce projet est mieux défendu que la moyenne, et deux points sortent du lot.

**`core/nommage.py:assainir()` ferme complètement la traversée par contenu de
document.** C'est le point qui comptait le plus, puisque `emetteur` et
`categorie` peuvent venir d'un OCR ou d'un modèle de vision — donc d'un PDF
fabriqué. Éprouvé sur sept entrées hostiles :

| entrée | sortie |
| --- | --- |
| `../../../etc` | `etc` |
| `a/b` | `a-b` |
| `C:\Windows` | `C-Windows` |
| `....//` | *(vide)* |
| `$(whoami)` | `whoami` |

Tout ce qui n'est pas alphanumérique devient un tiret. Il n'y a **aucune
injection de chemin possible par un document**.

Le reste :

- **Aucun secret en clair.** `cle_api` vaut `env:ANTHROPIC_API_KEY`, résolu à
  l'usage par `core/config.py:167-171`, avec la raison écrite : *« ce fichier
  finit tôt ou tard dans une sauvegarde ou une pièce jointe. »*
- **Le modèle de vision est un recours, jamais le chemin par défaut** : il ne
  part que si les motifs ont échoué **et** qu'une image existe **et** qu'une clé
  est disponible. Un document PDF natif ne quitte jamais la machine.
- **L'interface est en lecture seule par décision écrite** : aucun bouton,
  aucune écriture, et `paper.py etat --traiter` reste le seul chemin qui change
  un statut.
- **Écriture atomique** par fichier temporaire puis remplacement
  (`config.py:404`, `journal.py:120`) : une coupure de courant ne laisse pas un
  coffre à moitié écrit.
- **`formulaires.py:229` refuse d'écrire sur le PDF source** (`pdf.resolve() ==
  sortie.resolve()`), ce qui protège l'original d'un Cerfa vierge.
- **Aucune exécution de commande, aucune désérialisation dangereuse** : ni
  `subprocess`, ni `shell=True`, ni `pickle`, ni `eval`.
- **Le journal se déclare jetable** et se refabrique en relisant le coffre —
  donc il n'est jamais une source de vérité à protéger.

---

## Ordre de traitement conseillé

1. **P-1** — un seul champ à basculer dans le modèle livré, et c'est le défaut
   qui expose le plus de données pour le moins de gestes de l'utilisateur.
2. **P-3** — une ligne de configuration, mais **mesurer d'abord** l'adresse
   d'écoute : c'est elle qui dit si le constat est théorique ou immédiat.
3. **P-4** — permissions, et surtout l'effacement des images de pages, qui n'ont
   aucune raison de survivre.
4. **P-2** — une validation à ajouter à côté de celles qui existent déjà.
5. Les mineurs, au fil de l'eau.

**Non couvert, et dit plutôt que supposé** : l'adresse d'écoute de Streamlit
(paquet non installé ici), la confrontation des dépendances à une base de
vulnérabilités (aucun hôte joignable), et le comportement sur Windows et macOS.
