# Cartographie honnête — les projets de paperasse administrative

Écrit le 10/09/2026, après avoir cloné `Lefouzebreizh/ensemble-mdph` (dépôt
séparé, jamais lu avant) et relu `moteur-administratif/`, `le-coffre/`,
`life-organizer/modules/coffre/` et `projets-actifs/cinq-produits-grand-public.md`
sur le disque — rien de ce qui suit ne vient de la mémoire d'une session
précédente.

**Résultat en une phrase** : sur les cinq noms demandés, deux sont de vraies
idées jamais construites, un a été absorbé sans le dire nulle part, un existe
en trois exemplaires, et le cinquième est devenu — sans qu'on l'ait décidé —
le moteur générique que le plan du 02/09 réclamait.

---

## 1. Ce que chaque projet fait RÉELLEMENT aujourd'hui

### Le Dossier (MDPH)

**N'existe pas comme produit séparé.** Aucun dossier, aucun dépôt à ce nom.
C'est resté une fiche d'idée dans `projets-actifs/cinq-produits-grand-public.md`
§2 — jamais codée sous ce nom. Son contenu (formulaire MDPH, délai de 4 mois,
recours à 1 mois) a été repris, sans qu'aucun document ne le dise, dans la
démarche `mdph` d'`ensemble-mdph` (voir plus bas).

### Le Classeur (l'après-décès)

**N'existe pas.** Fiche d'idée seule (`cinq-produits-grand-public.md` §1),
aucune ligne de code, aucun dépôt.

### Le Recours (litiges du quotidien)

**N'existe pas.** Fiche d'idée seule (`cinq-produits-grand-public.md` §4),
aucune ligne de code, aucun dépôt.

### Le Coffre

**Construit — trois fois, dans trois dépôts différents.** Précision qui
manquait dans une première lecture : « Le Coffre » n'est le nom public
d'aucun des trois — c'est le nom de code interne au dépôt. Le n°2 seul porte
un nom public, et ce n'est plus « Le Coffre » depuis le 05/09/2026 :
`le-coffre/README.md` documente son renommage en **« Le Tiroir Secret »**
(textes visibles seulement — titre, en-têtes, e-mail d'alerte ; l'adresse
`coffre-puce.vercel.app`, le projet Vercel `coffre` et le chemin `le-coffre/`
restent inchangés). Le n°1 (`life-organizer`) n'a jamais porté ce nom : il
reste un module interne sans identité publique.

1. `life-organizer/modules/coffre/stockage.py` (dans `amorce/`) — coffre
   local, Python/Flask, un seul utilisateur, servi sur `127.0.0.1`, sans nom
   public.
2. `le-coffre/` (dans `amorce/`) — la productisation hébergée, publiquement
   **« Le Tiroir Secret »** depuis le 05/09/2026 : Next.js 16 + Supabase,
   multi-utilisateurs, chiffrement porté depuis le n°1 sans changer la
   logique, plus un classement automatique par vision et des alertes
   d'échéance par courriel.
3. `ensemble-mdph/js/coffre.js` (dépôt séparé) — un **troisième** coffre
   local chiffré, en JavaScript pur, propre au site statique. Le fichier le
   dit lui-même en commentaire : *« Même principe cryptographique que le
   module coffre de life-organizer (…), adapté à un site 100 % client »* —
   ce n'est donc pas un doublon accidentel, c'est une ré-implémentation
   **consciente**, parce qu'un site statique sans serveur ne peut pas
   installer un paquet Python ni appeler Supabase.

Les trois utilisent PBKDF2 (600 000 itérations) → AES-GCM 256 via Web Crypto
API — le même schéma cryptographique, réécrit trois fois.

### Ensemble Face à la MDPH (dépôt `Lefouzebreizh/ensemble-mdph`)

**Construit et activement travaillé**, dans un dépôt GitHub séparé d'`amorce`,
jamais rattaché à aucune session avant aujourd'hui. Nom réel du produit :
« Ensemble face aux démarches ». Ce n'est **pas** un produit MDPH seul —
c'est une plateforme à **huit démarches** (le README n'en annonce que quatre,
lui-même périmé) :

`mdph`, `employeur` (conflit avec un employeur), `caf`, `impots`, `logement`,
`medical`, `retraite`, `surendettement` — 4 444 lignes de JavaScript au total.

Elle porte, en propre :

- **`js/engine.js`** (585 lignes) — moteur générique de questionnaire à
  étapes (choix, saisie de date, notice), sans aucun contenu métier.
- **`js/coffre.js`** — le troisième coffre chiffré, décrit ci-dessus.
- **`js/dates.js`** — utilitaires de délai (ajout de jours/mois, jours
  restants).
- **`js/data/*.js`** (huit fichiers, ~2 300 lignes) — pour chaque démarche,
  les questions, les branches, et des **calculateurs d'échéance en ligne**
  (ex. `calcAttente`, `calcRecours` dans `mdph.js`) qui produisent une date
  limite et son sens.
- **`js/chat.js`** — un assistant conversationnel, via le SDK Anthropic
  (dépendance `@anthropic-ai/sdk` dans `package.json`).
- **`js/numeros.js`** — numéros utiles par démarche.

Site statique, sans backend, sans compte. 90 tests côté moteur/dates/coffre,
mais le rendu (`engine.js`) se revérifie encore à la main.

### Moteur administratif (dans `amorce/`, `moteur-administratif/`)

Pas demandé dans la liste, mais indispensable à la suite : c'est la tentative
du 03/09/2026 de faire enfin **le moteur unique** que le plan du 02/09
réclamait — quatre briques Python (lecture, règles de délais, rédaction,
rappels), fonctionnelles et testées (90 tests), sans aucune règle métier,
pensées pour être installées par Le Coffre, Le Dossier, Le Recours, Le
Classeur et La Relève.

**Elle n'a, à ce jour, aucun consommateur réel.** Ni `le-coffre/`, ni
`ensemble-mdph` ne l'installent — le premier est un projet Supabase/TypeScript,
le second un site JavaScript pur sans aucune dépendance Python. Le moteur a
été construit avant que ses portes existent, et les deux portes qui existent
aujourd'hui (Le Coffre hébergé, Ensemble face aux démarches) sont passées par
ailleurs.

---

## 2. Les zones de chevauchement

### A. Le Coffre (life-organizer) × Le Tiroir Secret (le-coffre) × Ensemble Face à la MDPH — même besoin, trois moteurs de chiffrement

**Le besoin couvert trois fois** : stocker localement, chiffré, des données
sensibles (documents, suivis, échéances) sans qu'aucun serveur ne puisse les
lire.

- **Fusionner** : impossible à moindre coût. Les trois tournent dans des
  contextes d'exécution différents — Python/Flask local, Next.js/Supabase
  hébergé, JavaScript pur sans build. Aucun ne peut importer les deux autres.
- **Garder les trois, mais différencier et documenter** : c'est déjà fait
  aux deux tiers. `le-coffre/README.md` documente le port depuis
  `life-organizer` ; `ensemble-mdph/js/coffre.js` documente en commentaire
  qu'il reprend le même principe. Rien ne relie les trois **depuis un seul
  endroit** — la table « Moteurs techniques partagés » d'`INDEX.md` (dans
  `amorce/`) ne connaît même pas l'existence du troisième, parce qu'il vit
  dans un dépôt qu'aucune session n'avait ouvert avant aujourd'hui.
- **Supprimer l'un des deux** : aucun n'est candidat — les trois servent un
  usage réellement différent (poste personnel, plateforme multi-utilisateurs,
  site sans backend).

**Ce que je recommande** : ne pas fusionner les applications, mais extraire
le **primitif cryptographique** (dérivation PBKDF2 + chiffrement AES-GCM,
~80 lignes) dans `kits/` (voir `CLAUDE.md` §3 : « ce qui se recopie tel quel »)
en JavaScript, pour que la prochaine ré-implémentation — et il y en aura une,
vu le rythme — se fasse par copie relue plutôt que réécrite de zéro. Mettre à
jour la table d'`INDEX.md` pour y faire figurer les trois, pas deux.

### B. Détection d'échéance — quatre moteurs indépendants, et c'est le chevauchement le plus coûteux

**Le besoin couvert quatre fois**, avec quatre logiques distinctes qui
peuvent déjà diverger sans que personne ne le remarque :

1. `paper-manager/core/calendrier.py` (Python, CLI, dates lues dans un
   document scanné).
2. `le-coffre/supabase/functions/classer-document/` (TypeScript, vision,
   Supabase).
3. `moteur-administratif/moteur_administratif/regles_delais/` (Python, conçu
   *exprès* pour être LE moteur partagé — une table de règles en donnée, pas
   en code).
4. `ensemble-mdph/js/data/*.js` (JavaScript, calculateurs écrits à la main
   dans chaque démarche — `calcAttente`, `calcRecours`, etc.).

- **Fusionner** : la n°3 a été écrite précisément pour absorber les n°1 et
  ailleurs — mais elle est Python, et les deux produits qui existent
  réellement aujourd'hui (le-coffre, ensemble-mdph) sont tous deux en
  JavaScript/TypeScript. Le moteur partagé a été construit dans le mauvais
  langage pour ses seuls consommateurs réels.
- **Garder et différencier** : chaque moteur reste seul juge de ses propres
  règles, mais rien ne garantit qu'un même type de délai (ex. « deux mois de
  recours après un refus ») donne la même réponse selon qu'on passe par l'un
  ou l'autre.
- **Supprimer** : aucun n'est un doublon inutile — chacun répond à un contexte
  réel (CLI hors ligne, Supabase, site statique).

**Ce que je recommande, honnêtement** : partager du **code** entre Python et
JavaScript coûte plus cher que ça ne rapporte pour un seul développeur.
Partager la **donnée** est réaliste : écrire les tables de règles de délai
(type de document → délai → conséquence) dans un format neutre (JSON), lu à
la fois par `moteur_administratif.regles_delais` (Python) et par un futur
chargeur JS pour `ensemble-mdph`. Ça n'unifie pas le code, mais ça empêche
qu'une même règle légale (ex. le délai de recours MDPH) diverge silencieusement
entre deux produits qui la citent chacun de leur côté.

### C. Le Dossier × Ensemble Face à la MDPH — un chevauchement qui s'est déjà réglé tout seul, et c'est une bonne nouvelle

« Le Dossier » promettait exactement ce que la démarche `mdph` d'`ensemble-mdph`
fait aujourd'hui : lire le délai légal de 4 mois, calculer le délai de recours
d'un mois, produire l'écrit qui va avec. **Personne n'a reconstruit ça deux
fois** — l'idée est passée directement dans le produit qui existe, sans jamais
être codée sous son nom d'origine.

- **Option retenue** : ni fusion ni suppression au sens propre, puisqu'il n'y
  a rien à fusionner — **acter** que « Le Dossier » est clos, en le remplaçant
  dans `cinq-produits-grand-public.md` §2 par un renvoi vers `ensemble-mdph`.
  Sans ça, une session future qui lit cette fiche et ne connaît pas
  `ensemble-mdph` (comme c'était le cas ici avant aujourd'hui) reconstruira
  « Le Dossier » de zéro — exactement le doublon que le §0 bis d'`amorce`
  interdit.

### D. Le Recours × la démarche `employeur` d'Ensemble Face à la MDPH — chevauchement partiel, mais l'infrastructure est déjà là

« Le Recours » (litiges de consommation généraux — remboursement,
garantie légale, rétractation) n'est pas exactement la démarche `employeur`
(conflits du travail), mais les deux partagent la même mécanique : extraire
des faits, choisir le bon fondement juridique, produire une lettre qui cite
un article et fixe un délai. C'est très exactement ce que `engine.js` +
`coffre.js` + `numeros.js` d'`ensemble-mdph` savent déjà faire de façon
générique.

- **Option retenue** : si « Le Recours » se construit un jour, ce n'est pas
  un nouveau produit ni un nouveau dépôt — c'est une **neuvième démarche**
  dans `ensemble-mdph` (`js/data/consommation.js`, sur le modèle des huit
  existantes). Le README du dépôt le dit lui-même : « Ajouter une nouvelle
  démarche… Le moteur et le coffre n'ont rien à changer. » Construire « Le
  Recours » en dehors de cette structure reviendrait à refaire un moteur de
  questionnaire, un coffre chiffré et une base de numéros utiles qui existent
  déjà.

### E. Le Classeur — pas de chevauchement de code aujourd'hui, mais un chevauchement de structure évident

« Le Classeur » (checklist post-décès, courriers, compte à rebours) n'a pas
une ligne écrite nulle part. Mais sa structure annoncée — questionnaire →
liste ordonnée par délai → courrier prêt → suivi conservé — est au mot près
celle qu'`ensemble-mdph` fournit déjà pour huit sujets différents.

- **Option retenue** : même logique que « Le Recours » — une future démarche
  `deces.js` dans `ensemble-mdph`, pas un produit à part. Le seul écart réel
  avec les huit démarches actuelles est le module « ce que vous pouvez
  toucher » (capital décès, pension de réversion), qui demande un calcul
  financier que le moteur ne fait pas encore — un ajout à la brique, pas une
  raison de repartir de zéro.

---

## 3. Mon avis honnête

**Le plan du 02/09/2026 disait : « Ne fais pas cinq applications. Fais un
moteur et cinq portes. »** Deux moteurs ont été construits en parallèle, sans
se parler : `moteur-administratif` (Python, réfléchi, testé, et sans aucun
consommateur réel) et le couple `engine.js`/`coffre.js` d'`ensemble-mdph`
(JavaScript, construit sans jamais porter ce nom-là, mais qui **est** devenu
ce moteur générique — huit portes tiennent déjà dessus).

**Trois recommandations concrètes, dans l'ordre où je les ferais :**

1. **Abandonner « Le Recours » et « Le Classeur » comme produits séparés,
   dès maintenant.** Ce ne sont que des fiches d'idée — rien à défaire, rien
   à migrer. Les remplacer dans `cinq-produits-grand-public.md` par un
   renvoi : « à construire comme démarche d'`ensemble-mdph`, pas comme
   produit ». C'est le seul des cinq gestes qui ne coûte rien et évite un
   vrai doublon futur.
2. **Clore « Le Dossier »** de la même façon — remplacer sa fiche par un
   renvoi vers la démarche `mdph` existante, pour la même raison.
3. **Ne pas fusionner les trois Coffre** — le coût dépasserait le gain pour
   un développeur seul — mais **extraire le chiffrement en `kits/`** pour que
   la prochaine porte (une neuvième démarche, un futur produit) recopie du
   code relu plutôt que d'en réécrire un quatrième.

Ce que je ne ferais **pas** : abandonner `moteur-administratif`. Il n'a pas
de consommateur aujourd'hui, mais il porte la seule tentative de règles de
délai **découplées du code** (une table, pas des `if`) — l'inverse
d'`ensemble-mdph`, où chaque démarche code son échéance à la main dans son
propre fichier JS. Le jour où un produit Python voit le jour (peu probable
vu que les deux portes réelles sont en JavaScript), c'est lui qui sert. En
attendant, la vraie dette n'est pas d'avoir construit ce moteur — c'est de
ne pas avoir écrit, nulle part avant aujourd'hui, qu'il n'a personne à qui
parler.
