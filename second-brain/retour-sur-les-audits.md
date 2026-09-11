# Retour sur la série d'audits — 01 au 03/09/2026

**Ce que ce fichier couvre** : les problèmes rencontrés pendant l'audit de
dépendances du dépôt, l'audit de sécurité d'Amorce et la remise en état de
l'audit Life-Organizer — la séance qui va de la pose du plafond OpenCV
(01/09, 23 h 13) à la clôture documentaire de l'audit (03/09, 02 h 02).

**Ce qu'il ne couvre pas** : le reste du dépôt sur la même période — Le Coffre,
le réseau d'annuaires, IPTV, KDP —, les audits des six autres projets qui
portent un `AUDIT.md`, et tout ce qui s'est passé après le 03/09 au matin.
Écrit par la session `018G9NfggFroJMGkkLmSZd98`, qui a fait la remise en état
mais **pas** l'audit initial (#562, session `01JKvRQnfahCocynmjCTgryN`).

---

## Sur la mesure du temps, avant de lire les chiffres

Ce document aurait été plus lisible avec une durée en minutes en face de chaque
ligne. Il n'en porte pas, et c'est délibéré : **je ne peux pas mesurer un temps
de travail**, seulement des horodatages de commits et un nombre d'allers-retours.
Écrire « 20 minutes perdues » aurait produit exactement le défaut que ce dépôt
combat — un chiffre plausible que personne n'a mesuré, et qui se relit ensuite
comme s'il l'avait été.

Trois unités sont donc employées, et chacune dit d'où elle vient :

| Unité | Ce qu'elle vaut |
| --- | --- |
| **Délai mesuré** | écart entre deux horodatages Git. Fiable, mais il compte aussi le sommeil et les autres tâches. |
| **Jets repris** | nombre de fois où un travail a été refait avant d'être juste. Compté, pas estimé. |
| **Allers-retours** | échanges avec le propriétaire qu'un défaut a coûtés. Compté. |

Le coût réel d'un défaut est presque toujours dans la troisième colonne : le
pilotage se fait depuis un téléphone, et un aller-retour nocturne coûte plus
qu'une heure de machine.

*Note de méthode : ce fichier a été écrit pendant que le classificateur de
session refusait Bash. Les dates viennent donc de l'API GitHub et non de
`git log`. Aucune n'est de mémoire.*

---

## 1. Chronologie

### P1 · Le garde-fou « visage » rendu inerte par une installation sans borne

**Quand** — Plafond `opencv<5` posé aux quatre endroits le **01/09 à 23 h 13**
(`fef571f`). Constaté inerte par l'audit le **02/09 à 20 h 59** (#562).
Corrigé le **02/09 à 23 h 13** (#585).

**Le défaut** — Une session a lancé `pip install opencv-python-headless` sans la
borne, pour tout autre chose. La 5.0.0 est arrivée, elle a retiré
`CascadeClassifier`, et la protection « ne pas écarter une photo où un visage
est reconnu » a cessé d'exister. Sur la machine du propriétaire, **9 portraits
de famille sur 10** marqués « flous » ont un visage détectable : ils partaient
en quarantaine, effacée au bout de 30 jours.

**Coût** — Délai mesuré entre la pose du plafond et le constat : **21 h 46**, sur
ce conteneur. Aucune photo perdue, la fenêtre de rattrapage de 30 jours n'ayant
pas été franchie. Le coût réel est ailleurs : c'est le défaut le plus proche
d'avoir détruit quelque chose d'irremplaçable.

**Pourquoi pas détecté plus tôt** — Trois raisons qui se cumulent, et c'est le
cumul qui compte :

1. Le dépôt déclarait la borne à quatre endroits — un `pip install` tapé à la
   main n'en lit aucun.
2. Le seul avertissement était imprimé **une fois**, en tête d'un traitement qui
   défile sur des milliers de fichiers.
3. Et surtout, voir P2.

---

### P2 · Quatre tests verts qui gardaient la déclaration, pas la machine

**Quand** — Écrits le **01/09 à 23 h 13**, en même temps que le plafond. Défaut
constaté le **02/09 à 20 h 59**, corrigé le **02/09 à 23 h 13**.

**Le défaut** — `tests/test_plafond_opencv.py` portait quatre tests, tous verts,
sur une machine où OpenCV 5.0.0 était installé et `CascadeClassifier` absent.
Ils vérifiaient que les **quatre fichiers de déclaration** plafonnent sous la 5.
Aucun ne lisait `cv2.__version__`.

**Coût** — Il ne se compte pas en délai : ce test a rendu P1 **structurellement
invisible**. Une suite verte est un signal qu'on croit, et celle-ci disait vrai
sur ce qu'elle mesurait.

**Pourquoi pas détecté plus tôt** — Parce que le test était **juste**. Il
mesurait exactement ce que son auteur voulait garder — que personne ne retire la
borne d'un des quatre fichiers — et il l'a bien fait. Ce qui manquait n'était pas
une rigueur mais un **objet de mesure** : la version installée, et non la version
déclarée.

C'est la même famille que le défaut d'Annuaria écrit au §2 bis de `CLAUDE.md` —
le contraste mesuré sur le texte *posé* sur le bouton, jamais sur le bouton
contre la page. **Une mesure juste sur le mauvais objet laisse le défaut intact
et donne l'impression du contraire.**

---

### P3 · La destination du rangement jamais confinée (C-1)

**Quand** — Relevé le **02/09 à 20 h 59**. Corrigé le **02/09 à 23 h 02** (#579).

**Le défaut** — `destination = bibliotheque / rangement.destination`, sans
validation de forme. En Python, **un opérande droit absolu remplace le gauche** :
`/tmp/exfiltration` et `../../../tmp/ailleurs` sortaient tous deux de la
bibliothèque. Ce sont des relevés bancaires et des avis d'imposition.

**Coût** — Délai mesuré entre le constat et le correctif : **2 h 03**, le plus
court des huit. Le vrai coût est en amont : le défaut existait depuis que le
module de classement existe.

**Pourquoi pas détecté plus tôt** — `noyau/config.py` validait déjà **une
quinzaine de réglages** et jamais ceux-là. Un fichier de validation bien fourni
se lit comme une validation complète : plus il couvre, moins on vérifie ce qu'il
ne couvre pas. Et aucun `is_relative_to` n'existait nulle part dans le projet —
donc aucun `grep` ne pouvait révéler l'absence par contraste.

---

### P4 · Une promesse tenue par rien, devenue fausse en 2 h 52 (I-3)

**Quand** — L'audit écrit le **02/09 à 20 h 59** : « la promesse est vraie
aujourd'hui, et tenue uniquement par l'absence de code. Rien ne l'empêche de
devenir fausse. » `modules/depot/` arrive avec `requests` le **02/09 à 23 h 51**
(`25a3809`). Garde-fou posé le **03/09 à 00 h 34** (#598).

**Le défaut** — Onze occurrences de `requests` dans un fichier sur trente-sept.
La promesse « aucun fichier ne quitte la machine » n'était plus vraie, moins de
trois heures après qu'un audit ait écrit qu'elle pouvait cesser de l'être.

**Coût** — **2 h 52** entre l'avertissement et sa réalisation. Le correctif a
suivi 43 minutes plus tard. Aucun aller-retour, aucun dégât : la session qui a
apporté `requests` avait **borné la promesse de `organizer.py` en même temps**,
au lieu de la laisser fausse. C'est ce qui a permis au garde-fou d'être une
**porte** plutôt qu'un mur.

**Pourquoi pas détecté plus tôt** — Ce n'est pas un défaut de détection, c'est un
défaut de **transmission**. L'audit était sur `main` à 20 h 59 ; la session qui
écrivait `modules/depot/` travaillait déjà et ne l'a jamais lu. Le §10 bis le dit
en propres termes : une session ne peut pas en prévenir une autre, le canal est
le dépôt. Ce que l'audit n'avait pas, c'est un **garde-fou exécutable** — un
document prévient les humains, un test prévient les machines.

---

### P5 · Documents sensibles lisibles par tout compte local (I-2)

**Quand** — Relevé le **02/09 à 20 h 59**. Corrigé le **03/09 à 00 h 35** (#599).

**Le défaut** — Bibliothèque, quarantaine et journal naissaient en `0o755` /
`0o644` sous l'umask par défaut. Ils portent, d'après la configuration livrée
elle-même, relevés de compte, RIB, avis d'imposition, décomptes de mutuelle,
ordonnances, baux et cartes grises. Le manifeste `origines.jsonl` aggravait le
cas : il consigne le **chemin d'origine complet** de chaque document écarté,
donc l'arborescence personnelle même pour qui ne lirait aucun fichier.

**Coût** — Délai mesuré : **3 h 36**. Un jet repris (voir P13).

**Pourquoi pas détecté plus tôt** — Un défaut de permissions ne produit **aucun
symptôme** pour son propriétaire : sur un poste à un seul compte, tout marche
exactement pareil. Il ne se voit qu'en le cherchant, et rien ne pousse à le
chercher.

---

### P6 · Des données de dépense plausibles dans un modèle versionné (M-3)

**Quand** — Relevé le **02/09 à 20 h 59**. Corrigé le **03/09 à 00 h 53** (#600).

**Le défaut** — Trois abonnements avec montants au centime, dates de
souscription et notes qui se lisent comme un carnet de comptes, dans un fichier
versionné d'un dépôt public — que l'historique Git garde même après correction.

**Coût** — Délai mesuré : **3 h 54**. Un jet repris (voir P12).

**Pourquoi pas détecté plus tôt** — **Ni secret ni identifiant.** Aucun scanner
de secrets ne s'en émeut, aucune règle ne s'y applique. Le montage était même
bon : `organizer.py` charge d'abord `~/.config/`, et le `.gitignore` couvre le
fichier de travail. Le test qui gardait « aucune donnée personnelle réelle »
existait — il ne couvrait que `resiliation.expediteur`. **L'identité était
gardée, les dépenses non.**

---

### P7 · Sept dépendances sur huit sans borne haute (M-1)

**Quand** — Relevé le **02/09 à 20 h 59**. Corrigé le **03/09 à 00 h 56** (#601).

**Le défaut** — Aucune borne haute, donc deux installations à deux dates donnent
deux environnements, et un audit fait ici ne vaut pas pour la machine du
propriétaire.

**Coût** — Délai mesuré : **3 h 57**. Mais le coût de ce constat **avait déjà été
payé** : P1 en est la démonstration exacte, sur le seul paquet qui était borné.

**Pourquoi pas détecté plus tôt** — Un `>=` sans plafond ne casse rien le jour où
on l'écrit. Il casse le jour où quelqu'un installe, ailleurs, plus tard. Il n'y a
littéralement aucun moment où ce défaut produit un signal.

---

### P8 · L'audit affirmait une impossibilité qui n'en était pas une

**Quand** — Écrit le **02/09 à 20 h 59**. Corrigé le **03/09 à 02 h 02** (#613).

**Le défaut** — L'audit disait, de bonne foi : « aucun hôte de ce type n'est
joignable depuis cette session, et `pip-audit` n'est pas installé ». **Les deux
moitiés étaient fausses.** `pip-audit` s'installe depuis PyPI — joignable, et
`CLAUDE.md` §7 le dit — et il joint sa base.

**Coût** — Délai mesuré : **5 h 03** entre l'affirmation et sa correction. Le vrai
coût est ce qu'elle aurait produit si personne ne l'avait reprise : une
génération de sessions renonçant à confronter les dépendances aux vulnérabilités
« puisque c'est écrit que ça ne marche pas ici ».

**Pourquoi pas détecté plus tôt** — Parce qu'une impossibilité ne se vérifie
jamais. Un constat positif se fait contredire par la réalité au premier essai ;
un constat négatif est **auto-confirmant** — on ne réessaie pas ce qui est
déclaré impossible. C'est la même mécanique que les quatre chemins d'image du §7,
et que la voix off déclarée hors de portée pendant des semaines.

---

### P9 · Un audit sans champ d'état, qui se relit entièrement ouvert

**Quand** — Audit écrit le **02/09 à 20 h 59**. Six constats sur huit corrigés
entre 23 h 02 et 00 h 56. Section « Suites données » ajoutée le **03/09 à
02 h 02** (#613).

**Le défaut** — Pendant **5 h 03**, `AUDIT.md` décrivait huit défauts comme s'ils
étaient tous ouverts, alors que six étaient fusionnés. Rien dans le document ne
disait lesquels.

**Coût** — Nul cette fois, parce que la même session tenait les deux bouts. Le
coût est **entièrement potentiel**, et il est double : refaire un travail déjà
fait, ou croire couvert ce qui ne l'est pas. Les deux se paient plus tard, par
quelqu'un d'autre.

**Pourquoi pas détecté plus tôt** — Parce que ce n'est un défaut pour **personne
dans l'instant**. L'auteur d'un audit sait ce qu'il a trouvé ; celui qui corrige
sait ce qu'il a corrigé. Le manque n'apparaît qu'au troisième lecteur, qui
n'était là ni pour l'un ni pour l'autre.

---

## 2. Mes propres défauts, dans le même ordre

Ils sont ici parce qu'un retour d'expérience qui n'inspecte que le code
qu'il a trouvé est un retour d'expérience à moitié.

### P10 · Un faux positif Playwright dans mon audit de dépendances

J'ai signalé `iptv/` et `annuaire-ia/` comme oubliant de déclarer Playwright.
Les deux le chargent par `await import()` sous `try`, avec un message d'aide.
**Le déclarer aurait installé une seconde révision** et cassé la vérification
que je prétendais protéger.

**Coût** — Un jet repris, corrigé avant fusion. Zéro aller-retour.

**Pourquoi pas détecté plus tôt** — Un croisement automatique imports/manifeste
**ne peut pas** distinguer un import optionnel d'un import oublié. L'outil était
juste, sa conclusion ne l'était pas.

### P11 · Une fausse affirmation sur `verifier.sh`

J'ai écrit qu'il ignorait `visual_library`, sur la foi d'un `grep -c` rendant 0.
`verifier.sh` **découvre** les suites Python : le grep rend 0 pour les douze.

**Coût** — Un jet repris, corrigé avant fusion, prouvé en provoquant un
changement et en voyant `✓ visual_library — tests`.

**Pourquoi pas détecté plus tôt** — Détecté au bon moment, en fait, mais après
avoir été écrit avec assurance. La règle qui l'évite existe déjà dans
`CLAUDE.md` §4 : « Mesurer ce que la découverte rend, jamais chercher le nom. »
**Elle y était avant que je fasse l'erreur.**

### P12 · Un `json.dumps` qui a reformaté tout un fichier

Premier jet de M-3 : relu par `json.dumps`, tout le JSON reformaté, des lignes
compactées à la main écrasées. C'est la violation du §0 bis règle 2 que
j'appliquais ailleurs dans la même heure.

**Coût** — Un jet repris. Refait en remplacement textuel du seul bloc :
dix-huit lignes pour dix-huit.

**Pourquoi pas détecté plus tôt** — `json.dumps` est le geste évident, il rend un
fichier valide, et le diff n'a l'air suspect qu'à la relecture.

### P13 · Un correctif de permissions qui ne corrigeait que le neuf

Premier jet de I-2 : il resserrait ce qu'il créait, laissant ouverts les
dossiers de bibliothèque déjà existants — **le cas exact que l'audit décrivait.**

**Coût** — Un jet repris. Attrapé par mon propre test
`un_dossier_deja_ouvert_est_resserre`, écrit après le code et qui a rougi.

**Pourquoi pas détecté plus tôt** — C'est l'inverse : détecté au bon endroit. Le
test écrit **après** le code a trouvé ce que le code supposait. À garder comme
contre-exemple utile — écrire le test après n'est pas toujours écrire le test à
la mesure du code.

### P14 · Une sur-affirmation dans ma propre correction

Dans #613, j'écrivais que les cinq versions relevées ne portaient aucune
vulnérabilité, en m'appuyant sur un `pip-audit` lancé sur le **fichier
d'exigences** — qui résout les bornes, et mesure donc autre chose que ce qui
était installé.

**Coût** — Un jet repris, avant commit. Corrigé en épinglant les cinq versions
une à une.

**Pourquoi pas détecté plus tôt** — Parce que la commande était verte et que la
phrase était *presque* vraie. Exactement le défaut que le document corrigeait :
**mesurer le bon objet, pas seulement mesurer.**

### P15 · `pkill -f "next start"` a tué mon propre shell

Deux fois, sortie 144.

**Coût** — Deux cycles perdus. Résolu en tuant par PID.

**Pourquoi pas détecté plus tôt** — Le motif passé à `pkill -f` correspond aussi
à la ligne de commande qui contient ce motif. C'est un piège classique, et il
n'était écrit nulle part ici.

### P16 · Trois diagnostics pour un seul défaut

La vérification d'`iptv` a échoué trois fois : d'abord un `.m3u8` manquant
(ffmpeg absent), puis deux fois « port 3210 répond déjà » — un `next start`
orphelin que `ss` ne montrait pas et que `curl` révélait.

**Coût** — Trois cycles. Le §6 fixe la limite à **trois essais par bug** : elle a
été atteinte pile, ce qui est moins un succès qu'un avertissement.

**Pourquoi pas détecté plus tôt** — Parce que `ss` mentait. Un outil de
diagnostic qui rend « rien » sans que rien ne soit faux fabrique un mauvais
diagnostic, exactement comme un `pip-audit` déconnecté qui rendrait
« aucune vulnérabilité ».

### P17 · Une règle de `CLAUDE.md` citant un message qui ne sort plus

`enable_pr_auto_merge` est documenté comme rendant « Auto-merge is not enabled
for this repository ». Il ne rend plus cela. Il a rendu, dans cette séance,
« is a draft » puis « in unstable status ».

**Coût** — Deux appels inutiles. Zéro aller-retour — mais une phrase de
`CLAUDE.md` était fausse pendant que je la suivais. Une autre session l'a
corrigée le 03/09, et sa correction porte la nuance juste : **le réglage du dépôt
n'était pas le blocage.**

**Pourquoi pas détecté plus tôt** — Une règle écrite sur un **message d'erreur**
se périme dès que le fournisseur reformule, sans que rien ne le signale.

### P18 · Seize notifications lues, deux porteuses d'information

Sur les seize notifications traitées dans cette séance, **quatorze étaient
l'écho de mes propres gestes** — abonnement que je venais de poser, sortie de
brouillon que je venais de faire, fusion que je venais de déclencher, et les
commentaires du robot Vercel annonçant des déploiements « Ignored » attendus.
Seules les deux `check_suite.completed` portaient une information que je n'avais
pas.

**Coût** — Chaque lecture consomme du contexte et interrompt le fil. Pas un
aller-retour, mais une érosion.

**Pourquoi pas détecté plus tôt** — Ce n'est pas un défaut, c'est un **rapport
signal/bruit**. Il ne se voit qu'en comptant, et personne ne compte ses
notifications.

---

## 3. Déviations par rapport à la priorité annoncée

L'audit terminait sur un ordre de traitement conseillé : **C-1, I-1, I-2, I-3,
puis les mineurs.** L'ordre réel a été **C-1, I-1, I-3, I-2, M-3, M-1** — deux
mineurs faits, deux écartés.

| Déviation | Décidée par | Verdict |
| --- | --- | --- |
| **I-3 avant I-2** | le propriétaire, explicitement | **Justifiée par les faits.** `requests` était arrivé dans `modules/depot/` trois heures plus tôt : I-3 avait cessé d'être théorique pendant que la liste était écrite. |
| **M-3 et M-1 traités, M-2 et M-4 écartés** | le propriétaire, explicitement | **Justifiée.** Les deux écartés supposent un second processus ou un chemin venu d'ailleurs — ni l'un ni l'autre n'existe sur un outil local mono-utilisateur. |
| **Look & Find / Flutter mis en pause** | le propriétaire, explicitement | Hors périmètre de cet audit, sans effet sur lui. |

**Aucune déviation silencieuse.** Les trois ont été demandées, et l'ordre
conseillé par l'audit n'était pas un engagement mais une recommandation d'un
document, ce qui est précisément le statut qu'il doit garder.

**La déviation qui compte est ailleurs**, et personne ne l'a décidée : entre
20 h 59 et 23 h 51, une autre session a fait entrer `requests` dans le projet
que l'audit venait de déclarer sans réseau. Ce n'est pas une faute — cette
session avait borné la promesse en même temps, ce qui est le geste juste. C'est
une **déviation de coordination** : la priorité annoncée par un document ne
s'impose qu'à qui l'a lu.

---

## 4. Ce qui, dans le processus actuel, a laissé traîner

Cinq mécanismes, et aucun n'est un manque de rigueur.

### 4.1 · Un garde-fou qui mesure la déclaration au lieu de l'exécution

P1 et P2 sont le même défaut vu de deux côtés. Un test qui relit des fichiers de
configuration protège contre le retrait volontaire d'une règle — pas contre
un environnement qui la contredit. Le dépôt a plusieurs gardes de cette forme,
et ils sont bons ; ce qui manquait est le **second étage**, qui mesure ce que la
machine fait.

### 4.2 · Un document ne prévient que ceux qui le lisent

P4 en est la démonstration mesurée : 2 h 52 entre l'avertissement écrit et sa
réalisation, par une session qui ne pouvait pas l'avoir lu. Le §10 bis dit déjà
que le canal est le dépôt ; ce qu'il ne dit pas, c'est qu'un **fichier
Markdown est le plus lent des canaux du dépôt**. Un test, lui, s'impose à la
poussée suivante.

### 4.3 · Un audit sans état se relit comme un audit ouvert

P9. Le format lui-même le permettait : huit constats, aucun champ pour dire
lequel est réglé. Et le dépôt porte **sept `AUDIT.md`** — `agence/`,
`hypersensible-bienveillance/`, `iptv/`, `life-organizer/`, `paper-manager/`,
`pepites/`, `titan-builder/`. Compté le 10/09/2026 : **un seul des sept** porte
l'état de ses constats, celui de Life-Organizer, et depuis une semaine
seulement. Les six autres se relisent aujourd'hui comme entièrement ouverts,
qu'ils le soient ou non.

### 4.4 · Une impossibilité écrite ne se revérifie jamais

P8. Ce dépôt a déjà payé ce mécanisme trois fois — la voix off, les poids
Wav2Lip, la génération d'image — et le §9 en tire la règle « deux chemins
essayés ne font pas une impossibilité ». Elle vaut pour les chemins réseau ;
elle ne dit rien des **outils** déclarés absents, qui est le cas de P8.

### 4.5 · Une règle écrite sur un symptôme se périme sans bruit

P17. Le message d'erreur a changé, la règle est restée. Rien ne pouvait le
signaler : le contrôle de cohérence vérifie les chemins et les compétences, pas
la véracité des citations d'un fournisseur.

---

## 5. Les règles proposées pour `CLAUDE.md`

**Une par problème, et deux existent déjà.** Les proposer quand même serait un
doublon, ce que le §0 bis règle 4 interdit — elles sont donc listées comme
telles, avec leur emplacement, parce que « la règle existait déjà et n'a pas
suffi » est une information différente de « il manque une règle ».

**Rien de ce qui suit n'a été écrit dans `CLAUDE.md`.** C'est une proposition :
toucher à ce fichier passe par son propre menu.

### Règles nouvelles

| # | Où | Règle proposée |
| --- | --- | --- |
| **R1** | §8, après « Done » | **Un garde-fou se mesure sur la machine, pas sur les fichiers qui le déclarent.** Un test qui relit une configuration atteste qu'une règle est encore écrite, jamais qu'elle s'applique. Tout plafond de version, toute borne, toute permission demande **deux** tests : l'un sur la déclaration, l'autre sur ce que l'exécution rend — `cv2.__version__` et non `requirements.txt`, les droits obtenus et non le `mode=` passé. Quatre tests verts ont gardé une protection inerte pendant 21 h 46. |
| **R2** | §0 bis, règle 5 | **Une promesse qu'aucun code ne peut casser demande le test qui l'empêchera de casser.** Écrire « c'est vrai aujourd'hui, rien ne l'empêche de devenir faux » et s'arrêter là ne protège de rien : mesuré le 02/09, la promesse réseau de Life-Organizer est devenue fausse **2 h 52** après cette phrase. Le garde-fou autorise une porte nommée plutôt qu'il n'interdit tout, et vérifie **aussi que la porte existe encore à l'endroit déclaré** — un fichier renommé rendrait l'autorisation muette et le test resterait vert avec plus rien à autoriser. |
| **R3** | §3, après les trois choses qui s'écrivent | **Tout document de constat porte l'état de chacun de ses constats.** Un `AUDIT.md`, une liste de défauts, un relevé de dette : chaque entrée dit ✅ corrigé (avec sa PR), ⏸️ écarté sciemment (avec la raison **et ce qui le rouvrirait**), ou 🔲 ouvert. Sans ce champ, un document dont six constats sur huit sont réglés se relit comme entièrement ouvert — et on refait le travail, ou l'on croit couvert ce qui ne l'est pas. **Le champ se met à jour dans la PR qui corrige, jamais dans une passe de ménage ultérieure.** |
| **R4** | §7, à côté de « deux chemins essayés » | **Une impossibilité écrite porte sa date et son moyen de rejeu.** « X n'est pas installé », « aucun hôte de ce type ne répond » : ces phrases sont auto-confirmantes — personne ne réessaie ce qui est déclaré impossible. Chacune s'écrit donc avec la commande qui la reteste en une ligne. Mesuré : `pip-audit` a été déclaré indisponible et hors d'atteinte ; **les deux moitiés étaient fausses**, et il s'installe depuis PyPI en une commande. |
| **R5** | §5 ou §10, Connecteurs | **Une règle ne se cale jamais sur le texte d'un message d'erreur.** Un fournisseur reformule sans prévenir, et la règle devient fausse en silence pendant qu'on la suit. Décrire le **comportement** et l'état qui le produit — « l'outil n'arme pas quand des contrôles tournent encore » — puis citer le message en second, daté. |
| **R6** | §0 bis, règle 2 | **Un fichier structuré se modifie par remplacement textuel, jamais par relecture-réécriture.** `json.dumps`, `yaml.dump`, un formateur automatique : chacun rend un fichier valide et écrase la mise en forme faite à la main, dont les alignements et les regroupements portent souvent une intention. Dix-huit lignes changées doivent rendre dix-huit lignes changées. |
| **R7** | §10, Modifier ce dépôt | **Un correctif qui protège quelque chose de neuf doit dire ce qu'il fait de l'existant.** Resserrer des permissions, confiner un chemin, borner une valeur : la question « et ce qui existait avant ? » se pose **avant** d'écrire, pas au premier test rouge. Et sa réponse se borne — on resserre ce qui appartient à l'outil, jamais ce qui appartient à l'utilisateur (dossier personnel, point de montage, disque partagé). |
| **R8** | §6, à côté des trois essais | **`pkill -f` tue le shell qui l'appelle.** Le motif correspond aussi à la ligne de commande qui le contient. Tuer par PID, relevé au préalable. Payé deux fois, sortie 144. |
| **R9** | §6 ou §8 | **Un outil de diagnostic qui rend « rien » est un diagnostic à vérifier, pas un résultat.** `ss` ne montrait pas le processus que `curl` révélait ; un `pip-audit` déconnecté rendrait « aucune vulnérabilité » avec la même sérénité qu'un `pip-audit` qui a regardé. Tout outil de contrôle s'éprouve **dans les deux sens** — on lui donne un cas qu'il doit refuser, et on regarde s'il refuse. |
| **R10** | §5, sous le format « SENSIBLE » | **Un rapport de sécurité qui ne relève ni secret ni identifiant n'a pas fini de chercher.** Des montants au centime, des dates de souscription, un chemin d'origine complet, une arborescence personnelle : aucun scanner ne s'en émeut, et l'historique Git les garde après correction. Ce qui compte n'est pas la classe de la donnée, c'est **ce qu'on peut reconstituer d'une vie avec**. |

### Règles qui existaient déjà, et n'ont pas suffi

| # | Où elle est écrite | Ce que P11 et P14 ajoutent |
| --- | --- | --- |
| **R11** | `CLAUDE.md` §4, `visual_library` : « Mesurer ce que la découverte rend, jamais chercher le nom. » | Elle y était **avant** que je refasse l'erreur, sur un autre objet. Une règle rangée dans la fiche d'un projet ne se lit pas quand on travaille sur un autre. **Proposition : la remonter au §10, section « Modifier ce dépôt », à côté de « `grep`, pas la mémoire »** — c'est le même geste et le même moment. |
| **R12** | `CLAUDE.md` §8 : « une mesure disait vert et le fichier était faux — mesurée au mauvais endroit, sur le mauvais fichier ». | Écrite pour les médias, elle vaut pour **tout** : le contraste d'Annuaria mesuré sur le mauvais objet, mon `pip-audit` lancé sur les bornes au lieu des versions installées. **Proposition : en faire une ligne générale du §8**, dont le montage devient l'exemple plutôt que le périmètre. |

---

## 6. Ce qui a bien marché, et qu'il ne faut pas casser en corrigeant

Un retour d'expérience qui n'énumère que des défauts fait supprimer ce qui
tenait. Quatre choses ont tenu, mesurées :

- **L'audit a été fait par une session, la correction par une autre.** Le regard
  neuf a trouvé un critique que personne ne cherchait. Faire corriger l'auteur
  d'un audit par lui-même aurait produit un audit plus doux.
- **Chaque correctif a été éprouvé dans les deux sens.** Huit lignes attrapées
  en remettant l'ancien `requirements.txt`, six échecs en neutralisant le
  `chmod`, cinquante-trois vulnérabilités sur des versions volontairement
  anciennes. **Un test qui n'a jamais rougi n'a rien prouvé.**
- **Les six correctifs ont été fusionnés en moins de quatre heures**, un par PR,
  sans grouper. Aucun conflit sur `main`, alors que trois autres sessions
  écrivaient en parallèle dans le même dépôt.
- **Les limites ont été écrites plutôt que sous-entendues** : le mode POSIX
  ignoré sous Windows, les parents préexistants non resserrés, l'historique Git
  non réécrit et pourquoi. C'est ce qui permet de relire un correctif sans le
  croire plus large qu'il n'est.

---

*Écrit le 10/09/2026. Les délais viennent des horodatages Git lus par l'API
GitHub ; les jets repris et les allers-retours sont comptés, jamais estimés.
Aucune durée de travail n'est avancée — voir la note d'ouverture.*
