# Post-mortem — défauts de processus, 28/08 → 09/09/2026

Écrit le 10/09/2026, à partir de `CLAUDE.md` (tel qu'il se lisait le 06/09, puis
tel qu'il se lit aujourd'hui) et de l'intégralité de `second-brain/lecons/`
(63 fichiers) et de la fin de `second-brain/lecons.md` (l'archive, lue en
entier de la ligne 5200 à la fin — la partie non datée en tête n'a pas été
relue mot à mot). Environ **95 incidents distincts** en ressortent.

**Ce que ce fichier fait, et ce qu'il ne fait pas.** Il ne réécrit pas les
leçons — chacune reste à sa place, avec sa règle. Il répond à une question que
personne n'avait posée sur l'ensemble : *qu'est-ce qui, dans la façon dont on
travaille ici, a permis à autant d'incidents du même genre de se reproduire ?*
Ce n'est pas une critique du travail fait — chaque incident listé a été
corrigé, souvent le jour même. C'est un inventaire de ce qui a coûté du temps
**avant** la correction, et de ce qui, dans le processus, ne l'a pas empêché.

---

## 1. Les quatre motifs qui reviennent, et rien d'autre n'en approche

Comptés sur les 95 incidents, quatre familles couvrent à elles seules plus de
la moitié des cas — et aucune des quatre n'a de garde-fou écrit qui les couvre
**toutes**, seulement des rustines projet par projet.

### A. Une impossibilité mesurée généralisée au-delà de ce qu'elle mesure

**Le plus cher des quatre en jours perdus cumulés.** Le motif : un hôte refusé
par UN client (le mandataire de la session distante, `curl` direct) devient
« personne ne peut », alors qu'un autre client — un connecteur MCP, un
bac-à-sable de connecteur, PyPI, un runner GitHub Actions, `fetch` au lieu de
`curl`, un navigateur au lieu d'un autre — atteint la même adresse sans
problème.

Occurrences : génération d'image (29/08→01/09, 3 jours), radar de pépites
(04/09, **5 jours**, chiffré explicitement), GitHub Pages `*.github.io`
« personne ne peut voir » (08/09, alors que le bac-à-sable higgsfield l'atteint
sans broncher), recherche GitHub confondue avec lecture GitHub (08/09),
transcription YouTube (04/09, 8 jours après le cas identique sur l'image),
Vercel `*.vercel.app` refusé confondu avec « personne ne peut regarder »
(08/09), mandataire de session confondu avec mandataire du Worker qui exécutera
le code (Meta/MiniMax, 08/09).

Chaque occurrence porte déjà sa propre phrase dans `CLAUDE.md` ou dans une
leçon. Aucune ne dit la règle une fois pour toutes, en amont de tous les cas
particuliers.

**Règle à ajouter** : *Un hôte refusé par le mandataire de cette session ne
prouve que ça — jamais qu'aucun client ne peut l'atteindre. Avant d'écrire
« impossible », changer de client (connecteur MCP, PyPI, runner GitHub, un
navigateur réel) avant de changer de conclusion. C'est le premier réflexe, pas
le dernier.*

### B. Une mesure juste sur le mauvais objet

**Le second motif le plus coûteux, et le plus vicieux** : la mesure elle-même
est correcte, le calcul est bon, le test est vert — mais elle porte sur un
objet qui n'est pas celui qui compte pour la décision.

Occurrences : l'accent d'Annuaria mesuré sur le texte posé sur le bouton
(juste) au lieu du bouton contre la page (le vrai défaut, 03/09) ; la palette
web-artisan mesurée sur `ink` (le meilleur cas) au lieu de `panel` (le pire
cas, 03/09) ; le contraste d'un jeton de couleur mesuré contre le jeton déclaré
au lieu du fond composite réellement peint (09/09, deux fois) ; le garde
anti-lien-mort jugé sur ce qu'il retire au lieu de ce qui reste — 0 lien mort
et 0 lien rendent le même vert (09/09, **7 outils sans aucun lien
d'affiliation depuis le lancement**) ; l'en-tête `X-Frame-Options` bloquant les
propres aperçus du site, DOM correct mais réponse HTTP fautive (08/09) ; un
sélecteur global comptant le montage du DOM au lieu de l'état réel selon la
coque (08/09) ; une moyenne qui confond coupe et mouvement de caméra (08/09) ;
un seuil en écart absolu qui tolère 11× la cible sur une petite grandeur
(05/09) ; une sonde de couverture noir/image placée après le post-traitement
qui repeint tout le cadre (08/09).

**Règle à ajouter** : *Avant de croire un vert, dire en une phrase CE QU'IL
mesure — contre quel fond, sur quel flux, à quelle étape du traitement, sur
quelle grandeur. Un vert qui ne peut pas répondre à cette question ne prouve
rien. Se poser systématiquement : "et si je change l'objet mesuré (l'échelle,
le fond, l'étape, la coque), est-ce que je vois encore le même défaut que
je cherche à couvrir ?"*

### C. Une description plausible dispense de la vérification

Le plus insidieux : une phrase fausse qui **sonne juste** ne déclenche aucune
alerte, alors qu'une absence ou une contradiction, elles, se voient. `CLAUDE.md`
le dit déjà une fois (look_and_find, « thème clair assumé », faux depuis
toujours, 05/09) mais ne le pose pas comme principe général au-delà de ce cas.
Rejoint par : un commentaire de code qui affirme une propriété non mesurée, lu
comme un constat vérifié (03/09, deux défauts d'accessibilité livrés des
semaines) ; un brief qui cite sa propre source sans l'avoir lue (Kling/MiniMax,
08/09, un facteur 35 à 70 raté) ; une épingle de version qui se lit juste et
n'est pourtant pas honorée par le gestionnaire de paquets (08/09) ; un test de
non-régression qu'on n'a jamais vu rougir sur la régression qu'il prétend
garder (04/09 et 08/09, deux fois).

**Règle à ajouter** : *Une description qui sonne juste est exactement aussi
suspecte qu'une description qui sonne faux — elle se vérifie contre le code,
le fichier ou la mesure réelle, jamais contre sa propre plausibilité. Et un
test de garde qui n'a jamais été vu échouer sur l'injection réelle du défaut
qu'il prétend garder n'est pas un test : le faire rougir une fois avant de lui
faire confiance.*

### D. Aucun contrôle périodique nulle part — tout est réactif, après la douleur

Le dépôt sait très bien décrire un piège **après** l'avoir payé. Il ne pose
jamais « vérifier X toutes les N sessions » comme une routine.

Occurrences : quota Vercel épuisé **trois fois** (31/08, 02/09, 01/09) par un
projet neuf créé au tableau de bord, invisible en Git, sans filtre de chemin —
le correctif protège les projets déjà équipés, rien ne surveille l'apparition
d'un nouveau ; le compte Vercel passé en plan payant pendant **8 jours** sans
que personne ne le remarque, découvert par accident (08/09) ; le radar de
pépites resté fini et vert **10 jours** sans qu'aucun workflow ne le lance
(03/09), puis **5 jours** de plus sur une fausse conviction (04/09) ;
`licence-serveur/` et `motion/` sans aucune CI pendant des mois, dont celui qui
gère l'argent (02/09).

**Règle à ajouter** : *Après toute session qui a pu créer un projet Vercel
(dépôt de fichiers ou lien Git), ou au moins une fois par semaine : `list_projects`
(compte des projets ET du plan de facturation), et pour tout projet fini et
gardé par des tests, vérifier qu'un déclencheur (workflow, cron) le lance
réellement — un code fini et jamais exécuté n'est pas livré, il est en
sommeil sans le savoir.*

---

## 2. Les incidents à risque réel (argent, image publique, santé) — traités en détail

Ceux-là méritent les cinq colonnes demandées, parce qu'ils touchent à autre
chose qu'un défaut technique corrigible dans la foulée.

### artisan-express — correction de prix fusionnée, page publique inchangée 3 jours (06/09)

- **Coût** : trois jours avec une ligne tarifaire fautive en ligne, **pendant
  qu'une campagne de douze SMS de prospection s'apprêtait à pointer vers cette
  adresse**.
- **Cause de non-détection** : le projet Vercel est né d'un dépôt de fichiers,
  sans lien Git — aucun commit ne le déclenche. `CLAUDE.md` le disait déjà en
  toutes lettres ; ce qui manquait n'était pas l'information, c'était le
  réflexe de vérifier l'adresse publique après la fusion.
- **Déviation de priorité** : oui, nette — §8 règle 1 de `CLAUDE.md` (« ne
  jamais présenter un livrable comme prêt sans l'avoir vérifié soi-même ») a
  été traitée comme satisfaite par « la PR est verte et fusionnée », alors que
  la demande portait explicitement sur le site en ligne.
- **Faille de processus** : rien ne distingue, au moment de fusionner, un
  projet lié à Git (la fusion suffit) d'un projet en dépôt de fichiers (la
  fusion ne suffit jamais). Le tableau des moteurs partagés d'`INDEX.md` ne
  porte pas cette distinction-là.
- **Règle déjà écrite** (`second-brain/lecons/2026-09-06-une-correction-fusionnee-nest-pas-une-correction-en-ligne.md`) :
  vérifier par une requête sur l'adresse réelle, jamais par la fusion de la PR.

### artisan-express — douze SMS crus envoyés, aucun ne l'a été (07/09)

- **Coût** : une matinée de prospection perdue, douze cases cochées par le
  propriétaire en croyant chaque SMS parti.
- **Cause de non-détection** : la page de prospection s'est ouverte dans la
  visionneuse Claude (un bac-à-sable), qui bloque silencieusement les liens
  `sms:`/`tel:` — bouton inerte, aucune erreur affichée.
- **Déviation de priorité** : oui — le geste demandait un canal réel vers le
  monde extérieur ; personne ne l'a vérifié dans son environnement réel avant
  de le déclarer utilisable.
- **Faille de processus** : même famille que l'incident précédent, un cran
  plus général — rien dans ce dépôt ne dit qu'une action censée atteindre le
  monde réel (SMS, appel, e-mail, publication) doit être éprouvée dans un vrai
  navigateur, jamais dans le bac-à-sable qui sert à la produire.
- **Règle à ajouter** (généralise la leçon isolée déjà écrite) : *Toute page
  ou action censée déclencher un geste réel vers l'extérieur (SMS, appel,
  e-mail, paiement, publication) se valide dans un vrai navigateur, jamais
  dans la visionneuse de la session qui l'a produite — un bac-à-sable qui
  bloque silencieusement un lien `sms:`/`tel:` ne le signale pas.*

### annuaire-ia — 7 outils sans aucun lien d'affiliation depuis le lancement (09/09)

- **Coût** : revenu potentiel nul sur les sept outils les plus cherchés du
  site (ChatGPT, Claude, Perplexity, Midjourney, Canva, Notion AI, Gemini) —
  depuis le lancement, pas depuis un incident ponctuel.
- **Cause de non-détection** : le garde-fou anti-lien-mort retire un bouton
  cassé mais ne le remplace par rien ; « 0 lien mort » et « 0 lien du tout »
  rendent le même vert.
- **Déviation de priorité** : l'invariant §3 de la charte visuelle dit que
  l'accent ne sert qu'à « l'action à faire, et ce qui va bien » — pour un site
  d'affiliation, l'action à faire EST le lien ; son absence totale sur les
  fiches les plus visitées est la version la plus grave du défaut qu'`INDEX.md`
  documente déjà pour les moteurs partagés (dilution de l'accent).
- **Faille de processus** : aucun contrôle ne compte, sur le site publié, le
  nombre de fiches avec zéro lien d'affiliation — seul le nombre de liens
  MORTS est surveillé.
- **Règle à ajouter** : *Un garde-fou qui retire quelque chose se juge sur ce
  qui reste après le retrait, jamais sur ce qu'il a retiré. Pour `annuaire-ia/`
  précisément : un contrôle qui compte les fiches sans aucun lien d'affiliation
  actif, pas seulement les liens morts.*

### Vercel — compte passé payant, découvert par accident (08/09)

- **Coût** : non chiffré (le plafond réel du plan Pro n'a jamais été sondé),
  mais c'est de l'argent engagé sans confirmation explicite du propriétaire —
  exactement la zone orange de `CLAUDE.md` §5 (« dépenser plus d'un dollar »).
- **Cause de non-détection** : le champ qui portait l'info est apparu par
  accident dans un appel qui vérifiait autre chose ; le relevé `list_projects`
  refait à bonne cadence regardait la colonne des projets, jamais celle du
  plan.
- **Déviation de priorité** : oui, potentiellement grave — §5 exige une
  confirmation rapide avant toute dépense de plus d'un dollar, et un
  changement de palier Vercel n'a manifestement pas été signalé au
  propriétaire au moment où il s'est produit.
- **Faille de processus** : aucun contrôle ne lit jamais le plan de
  facturation d'un compte connecté, seulement ce que ce compte contient.
- **Règle à ajouter** (fusionnée avec le motif D ci-dessus) : le plan de
  facturation entre dans la même vérification périodique que le nombre de
  projets.

### chat-traducteur — signal « stress » construit sur 15 sons fabriqués (04/09)

- **Coût** : contre 40 vrais chats (corpus ESC-50), 30 sur 40 auraient reçu le
  verdict « stress » — le produit aurait dit à quatre propriétaires sur cinq
  que leur chat va mal, sur un simple bâillement ou ronronnement.
- **Cause de non-détection** : le corpus fabriqué séparait parfaitement sur
  lui-même (tests verts en permanence) parce qu'il ne contenait que ce qu'on
  avait su lui demander — jamais un vrai chat.
- **Déviation de priorité** : oui, et c'est la plus grave du lot en principe :
  le filtre 48K (§2) et les règles DONE (§8, « en cas de doute, corriger avant
  de livrer ») visent explicitement à ne jamais fabriquer une fausse alarme.
  Le dépôt savait et écrivait lui-même que ce plancher n'avait « jamais » vu
  un vrai chat — un doute écrit, documenté, et pourtant pas traité comme
  bloquant avant d'aller plus loin dans le produit.
- **Faille de processus** : rien n'exige qu'un signal touchant à la santé
  (humaine ou animale) soit validé sur des données réelles avant d'être
  considéré comme un signal utilisable, même provisoirement.
- **Règle à ajouter** : *Un signal qui porte sur la santé ou le bien-être
  (humain ou animal) ne compte comme mesuré que s'il a été confronté à des
  données réelles, pas seulement fabriquées. Un doute écrit sur cette
  confrontation ("jamais vérifié sur un cas réel") est un motif de blocage
  avant d'avancer, pas une note de bas de page qu'on relira plus tard.*

### generation-serveur (MiniMax) — plafond de 20 $/mois non testable (08/09)

- **Coût** : le garde-fou financier du projet avait 0 % de couverture réelle
  sur sa branche « plafond dépassé » — invisible tant qu'aucun dépassement
  réel n'était tenté.
- **Cause de non-détection** : une grille tarifaire vide, posée « à dessein »
  avec un commentaire rassurant, se lit comme « déjà géré » plutôt que comme
  « rien ne peut se déclencher ici ».
- **Déviation de priorité** : les six règles qui protègent l'argent de
  NexusCrypto (citées dans `CLAUDE.md`) existent précisément pour ce genre de
  cas ; aucune règle équivalente n'a été écrite pour ce second garde-fou
  financier du dépôt.
- **Faille de processus** : un garde-fou d'argent peut être écrit, committé,
  passer tous les tests existants, et ne rien garder du tout.
- **Règle à ajouter** : *Un garde-fou d'argent (plafond, coupe-circuit) ne
  compte comme vérifié que si un test l'a vu se déclencher pour de vrai, sur
  une donnée qui dépasse réellement le seuil. Une grille tarifaire vide ou un
  placeholder rend cette vérification structurellement impossible et bloque
  la mise en production du garde-fou — pas seulement de la fonctionnalité
  qu'il protège.*

### `get_status` aveugle aux vraies suites CI, fusion sur un rouge invisible (08/09)

- **Coût** : au moins une PR fusionnée alors qu'une vraie suite (« Cohérence
  du dépôt ») était rouge, découvert seulement après la fusion.
- **Cause de non-détection** : `get_status` ne rend que les *commit statuses*
  (Vercel) ; les *check runs* (GitHub Actions) sont ailleurs
  (`get_check_runs`). La règle déjà écrite dans `CLAUDE.md` (« un rouge Vercel
  n'est pas un signal ») a été apprise sans son corollaire, au point de faire
  lire la liste des statuts Vercel comme la liste complète des contrôles.
- **Déviation de priorité** : `CLAUDE.md` §10 (Git) exige « la fusion n'attend
  que le vert de la CI » — mais la moitié de la CI n'était pas regardée.
- **Faille de processus** : aucune procédure écrite ne dit d'appeler
  systématiquement `get_check_runs` en plus de `get_status` avant de fusionner.
- **Règle à ajouter** : *Avant de fusionner : `get_check_runs` ET `get_status`,
  toujours les deux — le premier donne les suites GitHub Actions (tests,
  cohérence), le second les statuts externes (Vercel). Une règle qui apprend à
  ignorer une famille d'alertes doit toujours dire explicitement ce qu'elle ne
  couvre pas, sinon elle enseigne à ignorer l'absence de vérification plutôt
  que le bruit.*

---

## 3. Table chronologique complète

Tous les incidents recensés, dans l'ordre. Colonnes réduites pour les cas
purement techniques sans portée transverse ; renvoi vers la section 2 pour les
six détaillés plus haut.

| Date | Projet | Problème | Coût | Cause de non-détection | Règle (existante → citée / nouvelle → §1-2) |
| --- | --- | --- | --- | --- | --- |
| 28/08 | NexusCrypto/radar | 9 hôtes de marché à `000` en session distante ; `curl` et `aiohttp` rapportent des symptômes différents pour la même cause | Confusion répétée, clé cherchée à tort | `curl`→`000`, `aiohttp`→`403` pour le même mur | Écrite (CLAUDE.md §7) |
| 29/08 | Amorce (image) | 4 chemins fermés (torch/diffusers absents) → « impossible de fabriquer une illustration » généralisé à tort | ~3 jours de fausse conviction | Motif A | Motif A |
| 29/08 | last30days (plugin) | Annonce « marche out of the box » alors que 12/13 hôtes sociaux à `000` ici | Risque de promesse impossible | Auto-description du greffon prise pour argent comptant | Écrite |
| 29/08 | Messagerie inter-sessions | Jugée impossible sans nuance ; précisée le 06/09 (marche si connecté) | — | Motif A (généralisation) | Écrite (corrigée 06/09) |
| 31/08, 01/09, 02/09 | Vercel (plateforme) | Quota de 100/jour crevé **trois fois** ; un projet neuf sans filtre à chaque fois | Un vrai échec de build (nexuscrypto) masqué dans le bruit | Motif D | Motif D |
| 01/09 | Session (méthode) | 475 outils MCP reviennent pendant qu'une tâche vidéo attend ; la session part re-mesurer la doc au lieu de reprendre | Temps mal alloué | Pas d'habitude « on reprend d'abord » | Écrite |
| 01/09 | Composio | S'installe, tourne, ne peut rien faire (hôte bloqué) | Cycle de diagnostic inutile | Clé confondue avec hôte | Écrite |
| 02/09 | bilan-patrimoine | Recommandations triées par euros, mélangeant risque et coût d'opportunité | Rattrapé avant livraison ; 53 tests ne l'avaient pas vu | Deux grandeurs incommensurables sur une échelle | Écrite |
| 02/09 | licence-serveur, motion | Aucun workflow CI ne les surveille, dont celui qui gère l'argent | Des mois sans vérification automatique | Deux listes tenues à la main divergent en silence | Motif D |
| 02/09 | Vercel (amorce) | `Ready` mais servait l'ancienne version | Deux diagnostics faux avant la bonne cause | `Ready` décrit une construction, pas ce que rend l'adresse | Écrite |
| 02/09 | CI (racine) | `tsc` vert en local, rouge en CI (`TS2688`) | Échec dès la première exécution | Mesure faite depuis un dossier héritant du `node_modules` racine | Écrite |
| 02/09 | GitHub (méthode) | PR sans aucun contrôle CI affiché | Plusieurs minutes cherchées au mauvais endroit | `mergeable_state: dirty` ne déclenche aucun workflow | Écrite |
| 02/09 | TITAN, Hypersensible, Annuaria (audits) | Trois faux constats d'audit publiés le même jour | Rapports d'audit faux, dont un « critique » | Mesure sur une copie/reconstruction, jamais le vrai fichier entier | Écrite |
| 02/09 | Artisan Express (amorce-51up) | Mur d'authentification Vercel invisible ; répété le jour même sur un second projet | Plusieurs jours de page « publique » invisible au public | `200` obtenu via un outil authentifié lu comme preuve de publicité | **Déviation nette** — voir §2 et texte plus haut |
| 02/09 | Vercel (amorce) | Filtre semblait ignoré | Vérification déléguée au propriétaire pour rien | Statuts lus sans le journal de construction | Écrite |
| 03/09 | Amorce (modale) | `querySelector` de repli cible le voile, pas le bouton — repli d'accessibilité inopérant | Six contrôles verts ne le voyaient pas | Sélecteur générique partagé par deux éléments | Écrite |
| 03/09 | chat-traducteur | Test de contraste écrit sur l'ancienne barre (4,5:1), le nouveau standard interne est 7:1 | 3 accents sur 5 sous le nouveau standard, suite restée verte | Un test écrit sur l'ancienne barre ne signale pas qu'une nouvelle existe | Écrite ; motif C |
| 03/09 | GitHub (méthode) | Auto-fusion citée « coupée » sur la foi d'un message qui ne sort plus | Rattrapé avant fusion | Même outil, deux causes de refus, messages voisins | Écrite (§10 Git) |
| 03/09 | Git (méthode) | `push --force-with-lease` refusé « stale » sans divergence réelle | 3 tentatives | Branche supprimée à la fusion, le refnfait référence à un commit disparu | Écrite |
| 03/09 | life-organizer | Module `depot` déclaré à tort inexistant, transmis à une autre session | Fausse info propagée entre sessions | `ls` sur une branche vieille de 8 jours | Écrite ; motif C |
| 03/09 | coherence-depot (outil) | Alerte connue et assumée criée en boucle | Bruit permanent qui masque les vraies alertes | Le contrôle se déclenche sur sa propre phrase explicative | Écrite |
| 03/09 | chat-traducteur | Référentiel appliqué sans borne classe un chat détendu en détresse | Risque de faux diagnostic santé animale | Table appliquée hors de son domaine | Écrite ; rejoint motif santé (§2) |
| 03/09 | Artisan Express | 3 pièges de bascule de thème (garde sur chaîne littérale, `rem`≠corps, serveur fantôme) | Aller-retour évité de justesse, 70 tests verts aveugles | Motif B (trois fois dans le même incident) | Motif B |
| 03/09 | pepites (radar) | Complet, 167 tests verts, aucun workflow ne le déclenche | **10 jours** sans une donnée accumulée | Tous les signaux du dépôt regardent le code, aucun ne regarde s'il tourne | Motif D |
| 03/09 | agence | Espace insécable copiée en espace normale dans une constante `INSECABLE` | Montants coupés en 2 lignes sur mobile | Le nom affirme une propriété jamais testée au point de code | Écrite |
| 03/09 | nouveau-client.sh | Doublon complet du Bilan Patrimoine recréé, déjà présent ailleurs | Clone en 4s + 4 branchements racine, à défaire | `grep` sur le nom du produit, pas sur le geste qu'il fait | Écrite ; §0 bis règle 4 |
| 03/09 | Outil de contraste maison | Ne lit pas `lab()`/`oklch()` (Tailwind v4) | 90 faux défauts remontés | Format de couleur supposé figé | Écrite |
| 03/09 | Socle Agence | Commentaire pris pour une mesure ; vert réel à 4,11:1 | 2 défauts d'accessibilité livrés des semaines | Motif C | Motif C |
| 03/09 | ElevenLabs (connecteur) | Mur supposé comme higgsfield, faux | Aurait bloqué une capacité en réalité ouverte | Motif A (généralisation à l'envers, ici bonne nouvelle) | Motif A |
| 03/09 | bande-son | Musique à −13dB rendait −40,2dB au-dessus de 400Hz | Bande son livrée inaudible malgré LUFS conformes | Réglage choisi sur sonie pleine bande, pas la bande qui compte | Motif B ; écrite |
| 03/09 | Git (méthode) | 320 branches, 3 méthodes de mesure rendent 3 comptes incompatibles | 193 branches classées à tort « à conserver » | Squash-merge rend `rev-list`/`diff` non fiables | Écrite |
| 03/09 | le-coffre | Retrait du doublon `le-coffre-hosted` découvre le seul `schema.sql` du dépôt chez le doublon | Un clone neuf du survivant n'aurait pas eu la bonne base | Le doublon comblait un trou du projet gardé | Écrite |
| 03/09 | web-artisan (compétence) | Déclarée inexistante, créée 3 minutes plus tard par une autre session | Doublon de 220 lignes écrit pour rien | Absence valide à la seconde près, non revérifiée | Écrite |
| 03/09 | motion (zoompan) | `d=90` sur une source déjà étalée multiplie les images (8100 au lieu de 90) | Rendu à 548,7s au lieu de 14,7s, timeout | `d` vaut par image d'entrée, pas de sortie, sans avertissement | Écrite |
| 03/09 | look_and_find | Garde de prudence à 3 conditions ne se déclenche jamais en pratique | 6 cas sur 12 où l'app s'engage sur un nom faux | Garde à conditions cumulées invisible aux tests qui n'éprouvent que le déclenchement | Écrite ; motif C |
| 03/09 | montage-auto (ffmpeg) | 3 défauts de chaîne invisibles sur la source (crop, 16 bits, `-ac 2`) | Verdicts de réglage inversés à chaque fois | Mesure sur la source, jamais le fichier livré | Motif B ; écrite |
| 03/09 | look_and_find / Accord | Deux seuils ajoutés, faux positifs 15/17→8/32 lus comme correction | 2 jours de confiance dans un mauvais seuil | 8 cas restants tous identiques, jamais regardés | Motif B ; écrite |
| 03/09 | NexusCrypto | Stop coupe la perte ET le rebond, attribution erronée du déficit | Diagnostic financier faux pendant un temps non chiffré | Spéculation et accumulation confondues sous « risque » | Écrite |
| 03/09 | NexusCrypto (CoinMetrics) | Colonne prix vide sur `sol.csv` malgré fichier plausible | Rejeu impossible sur 1 des 4 actifs | Taille/plage de dates rassurent sans dire si la colonne cible est remplie | Écrite |
| 03/09 | NexusCrypto (scoring) | Balayage du score ne déplace que 0,42 point, aucun témoin comparatif | Jours de réglage sur presque rien | Détecteur jugé sur ses propres sorties | Écrite |
| 03/09 | Communication (méthode) | Message à 2 sollicitations reçu comme incompris | Aller-retour complet, décision qui attendait 2 jours | Deux demandes de rang égal, non hiérarchisées | Écrite |
| 03/09 | Vidéo (montage) | Capture 9:16 déjà au format de sortie, cadrage serré impossible | 3 montages livrés avant de transcrire la voix off | Source et sortie au même ratio | Écrite |
| 04/09 | look_and_find (Dart) | `decodeImage` lève au lieu de rendre `null` sur octets non-image | Une photo tronquée fait échouer toute la description | Décodeur PSD lit hors tampon avant de conclure | Écrite |
| 04/09 | agence | Sauvegarde/restauration : déclencheur exclu puis réactivé, doublons | 2 échecs avant de passer | Deux gestes corrects cassent seulement enchaînés | Écrite |
| 04/09 | CLAUDE.md (méthode) | Fusion sans conflit produit une phrase dupliquée, deux fois le même jour | Doc illisible sans qu'aucun outil ne s'en aperçoive | Git recoud sans arbitrer un même paragraphe touché des deux côtés | Écrite |
| 04/09 | chat-traducteur | Signal stress sur 15 sons fabriqués | **Détaillé en section 2** | Motif C + santé | Motif C + nouvelle règle santé |
| 04/09 | yt-dlp / ffmpeg | Binaire posé par une roue Python invisible au `PATH` système | Risque d'installation redondante | Visibilité limitée aux outils Python | Écrite |
| 04/09 | le-coffre | 4 fonctions sur 5 reconstruisent l'index champ par champ, perdent des champs | Fonctionnalité de résiliation disparaît silencieusement | TypeScript valide, valeurs de retour semblent cohérentes | Écrite ; motif B |
| 04/09 | pepites (banc d'essai) | Banc fabriqué annonce le radar 9 points sous le hasard | Résultat chiffré, reproductible, faux | Banc encode la thèse de l'auteur, pas celle de l'outil | Écrite |
| 04/09 | bande-son | Limiteur réglé après un gain +12dB trop haut | Grésillement signalé malgré mesures conformes | Sur-aigu invisible en LUFS/dBTP | Motif B ; écrite |
| 04/09 | coherence-depot (outil) | Correction en masse de 33 frontmatters casse un générateur en aval | Trouvé en relisant le diff, pas par mesure | Contrôle vérifie la citation, pas sa forme | Écrite |
| 04/09 | pepites (tests) | `enum` TS ne s'exécute pas en mode strip-only Node | Cassait l'exécution, `tsc --noEmit` restait vert | `enum` produit du code contrairement à un type pur | Écrite |
| 04/09 | NexusCrypto (rejeu) | `--multi` écarte silencieusement les symboles absents | Tableau plausible pour un panier différent de celui demandé | Aucun message sur le retrait partiel | Écrite |
| 04/09 | Coordination (méthode) | Menu §0 bis approuvé après attente, 3/4 points déjà corrigés ailleurs | « go » sur un lot déjà partiellement obsolète | Rouge visible par toutes les sessions parallèles simultanément | Écrite |
| 04/09 | chat-traducteur (portage web) | Comparaison Python/WASM diverge de 1,7e-1, suspicion sur le mauvais composant | Aurait masqué une vraie divergence avec une tolérance | Générateur pseudo-aléatoire dépassant 2^53 en JS | Écrite |
| 04/09 | Tests (méthode) | 2 mutations sur 11 non détectées par des tests fraîchement écrits | Défaut serait revenu intact | Tests jamais vus rouges avant le correctif | Motif C ; écrite |
| 04/09 | YouTube (méthode) | « Impossible de rien tirer d'une vidéo » faux, transcription dispo | 8 jours après le cas identique sur l'image | Rien ne signale qu'une mesure réseau a vieilli | Motif A ; écrite |
| 04/09 | Git (méthode) | Suppression de branche distante : 3 chemins, 3 murs | Coût de découverte répété à chaque session | Chaque échec ressemble à un problème contournable | Écrite |
| 04/09 | CI (méthode) | Journal de job GitHub Actions inaccessible en session | On sait que ça tombe, jamais pourquoi | API redirige vers un hôte refusé au mandataire | Écrite |
| 04/09 | Communication (SMS) | Format GSM-7 vs UCS-2, coût en centimes | Mineur, déjà accepté | — | Écrite |
| 05/09 | conseiller-patrimoine | Seuil en écart absolu tolère 11× la cible sur une petite poche | Poche à 10 780€ au lieu de 1 100€ jugée « rien à faire » | Motif B | Motif B |
| 05/09 | Amorce (rejoue par cette session) | Hypothèse « fusion a ramené iptv » transmise sans diff | Une investigation d'agent (~15 min) | Explication plausible retransmise comme un fait | Écrite (par cette session) |
| 05/09 | Montage vidéo | 2 renvois « mal au crâne » sur des recadrages où l'image ne bouge pas vraiment | 2 renvois d'affilée | Aller-retour de cadre sur un plan sans vrai mouvement | Écrite |
| 05/09 | montage-auto (audio) | Mesure d'écrêtage sur décodage mono annonce +2,48dBFS, vrai pic −0,50dBFS | Réserve de niveau retirée pour rien | Décodeur AAC + rééchantillonnage mono ajoutent un dépassement fictif | Motif B ; écrite |
| 05/09 | bande-son (synthèse) | Rugissement formantique renvoyé « horrible » malgré mesures vertes | 3/4 du travail de traitement inutile | Synthèse par formants sans matière d'enregistrement réel | Motif B ; écrite |
| 05/09 | montage-auto (ducking) | Rampe posée sur la coupe, mixage restait à pleine crête | 5 essais de rattrapage sur le mauvais objet | Boucle de réglage sans jamais dire ce qui borne | Motif B ; écrite |
| 05/09 | chat-traducteur (web) | 100% vert en tests, inservable en vrai déploiement (404 sur 2 fichiers) | Aurait laissé la page se charger sans jamais rendre de verdict | Serveur d'épreuve recrée les chemins, plus capable que le vrai hébergeur | Motif B ; écrite |
| 05/09 | chat-traducteur (audio) | Aucun modèle joignable ne peut juger un bruitage ; quota épuisé en cours de tâche | Génération à moitié faite, crédits à 0 | Clé présente ≠ accès valide ; solde non affiché après succès | Écrite |
| 05/09 | Vercel (chat-traducteur) | Rouge en permanence même sur des PR Markdown sans rapport | Diagnostiqué à tort « trop de projets liés » | Chemin de script recopié d'un autre projet, invalide au dossier racine | Écrite |
| 06/09 | Amorce (méthode, par cette session) | INDEX.md annonçait 25 pour 21 réels ; vérificateur avait un trou de dictionnaire | Corrigé le jour même | Silence au lieu d'un « à regarder » sur une valeur non reconnue | Écrite (par cette session) |
| 06/09 | Sessions (méthode, par cette session) | Messagerie inter-sessions re-précisée (marche si connecté) | — | Motif A | Écrite (par cette session) |
| 06/09 | Next.js (méthode) | `pkill -f "next dev"` tue le shell qui l'appelle lui-même | Diagnostic parti dans la mauvaise direction | Motif recherché inclus dans sa propre ligne de commande | Écrite |
| 06/09 | Next.js (méthode) | Port TCP accepté ~2,8s avant la première vraie réponse 200 | Accusation portée sur l'adresse/le réseau | Port ouvert ≠ service prêt | Écrite |
| 06/09 | GitHub (PR #750) | Déclarée « CI rouge, fusion bloquée » alors que réellement verte | Une tâche de réparation ouverte pour rien | Test échouait seulement dans le conteneur de session, jamais sur le runner | **Déviation** — annonce d'un blocage non vérifiée sur le runner réel |
| 06/09 | artisan-express | Correction fusionnée non répercutée en ligne 3 jours | **Détaillé en section 2** | — | Motif D + écrite |
| 06/09 | iptv | 9 compteurs affichent un pluriel figé (« 1 séries ») | Défaut visible au premier coup d'œil, jamais vu | Ni la démo (6) ni la prod (120 000) ne descendent à 1 | Écrite |
| 06/09 | comptes-serveur | Worker Cloudflare jamais déployé signalé comme incident prod urgent | Un aller-retour propriétaire pour une panne qui ne pouvait pas exister | Code committé confondu avec service qui tourne | Écrite |
| 06/09 | annuaire-ia | Taux d'affiliation Gamma 30% annoncé, 25% réel (1ère année) | Tout prévisionnel bâti dessus surestimé d'office | Page de recrutement lue comme un contrat | Motif C ; écrite |
| 06/09 | Gemini (méthode) | Document de découverte répond sans clé, débloque un diagnostic bloqué ailleurs | A évité un blocage qui aurait pu durer | Source non pensée avant d'être trouvée | Écrite |
| 07/09 | artisan-express | 12 SMS crus envoyés, aucun ne l'a été | **Détaillé en section 2** | — | Nouvelle règle §2 |
| 07/09 | ensemble-mdph (dépôt tiers) | 6e projet Vercel lié consomme le quota du compte partagé, invisible d'un décompte par dépôt | Sous-estimation permanente de la consommation réelle | Décompte scopé à un seul dépôt | Motif D |
| 08/09 | Vercel (compte) | Passé payant, découvert par accident | **Détaillé en section 2** | — | Motif D + nouvelle règle §5 |
| 08/09 | generation-serveur (MiniMax) | Plafond 20$/mois non testable, grille tarifaire vide | **Détaillé en section 2** | — | Nouvelle règle |
| 08/09 | comptes-serveur (test) | Test anti-fuite par mots-clés, faux positif sur un mot légitime | Aurait laissé passer une vraie fuite ou bloqué du code correct | Grep sur le vocabulaire, pas sur ce qui traverse | Motif B |
| 08/09 | CI (méthode, tout le dépôt) | `get_status` aveugle aux check-runs GitHub Actions | **Détaillé en section 2** | — | Nouvelle règle |
| 08/09 | Tests Python (CI) | `unittest discover` sans `-t` casse un projet, masque une 2e panne réelle | Rouge sur `main` plusieurs jours | Erreur de collecte comptée comme échec ordinaire, rend 0 information | Motif C |
| 08/09 | artisan-express | `X-Frame-Options: DENY` bloque les 7 aperçus du site lui-même | Aperçu invisible en prod le temps du diagnostic | Motif B | Motif B |
| 08/09 | Vercel (méthode) | Mandataire filtre par outil, pas par hôte (`curl` passe, `fetch`/Chromium non) | A débloqué une capture d'écran de prod (révèle un vrai défaut visuel) | `ECONNRESET` lu comme mur définitif | Motif A |
| 08/09 | GitHub Pages (méthode) | `*.github.io` refusé au mandataire lu comme « personne ne peut voir » | Vérification de sites en ligne retardée par excès de prudence | Motif A | Motif A |
| 08/09 | GitHub (méthode) | Recherche fermée confondue avec lecture fermée | Risque d'avoir inventé du code de mémoire | Refus de recherche généralisé à la lecture | Motif A |
| 08/09 | Kling/MiniMax (briefs) | Plan gratuit annoncé faux, facturation réelle 35-70× le prix d'une image | Aurait fait construire dans le mauvais ordre | Brief cite sa source sans l'avoir lue | Motif C |
| 08/09 | generation-serveur (MiniMax) | Brief décrit les routes de Kling, pas de MiniMax | Aurait produit des 404 sur toute intégration | Deux fournisseurs sondés le même jour, confondus | Motif C |
| 08/09 | verify.mjs (Amorce) | Sonde noir/image placée après le post-traitement qui repeint tout | N'aurait jamais attrapé le défaut réel en prod | Motif B | Motif B |
| 08/09 | verify.mjs (Amorce) | Sélecteur global compte 0 média sur une coque, 4 sur l'autre | Contrôle aurait échoué seulement sur un parcours | Motif B | Motif B |
| 08/09 | life-organizer (CI) | Épingle `opencv-python-headless<5` non honorée sur le runner | Rouge CI persistant, deux fausses pistes locales | Épingle qui se lit juste convainc qu'elle est honorée | Motif C |
| 08/09 | Amorce (suivi de caméra) | Moyenne px/s contredit son propre sens (bon réglage lu « deux fois pire ») | Aurait fait rejeter un bon réglage | Moyenne confond panoramique et coupe | Motif B |
| 08/09 | pepites (bulletin) | Taux de hausse ne compte que les jetons survivants | Tout taux affiché penche vers le haut sans signal | Condition d'entrée (survie) corrèle avec ce qu'on mesure | Motif B |
| 08/09 | install-github-app (méthode) | 3 messages à expliquer avant 7 lignes à mesurer | 3 allers-retours évitables | Explication répétée au lieu de mesure immédiate | Écrite |
| 08/09 | Amorce (tests de garde) | Deux versions d'un test de seuil vertes à tort | Aurait fusionné vert en croyant garder une propriété non gardée | Jamais vu rougir sur l'injection réelle | Motif C |
| 08/09 | MiniMax (méthode) | Éditeur injoignable, mais son paquet PyPI donne la surface API exacte | A résolu le blocage et révélé l'erreur de brief ci-dessus | Éditeur = hôte fermé, PyPI pas pensé comme source | Motif A |
| 09/09 | annuaire-ia | 7 outils sans lien d'affiliation depuis le lancement | **Détaillé en section 2** | — | Nouvelle règle |
| 09/09 | annuaire-ia (contraste) | Jeton à 6,17:1 mesuré contre lui-même, pas le fond composite | Défaut invisible tant que mesuré contre le mauvais fond | Motif B | Motif B |
| 09/09 | annuaire-ia (dégradé) | Dégradé de texte horizontal correct en large, faux dès que le titre passe à la ligne | Invisible en dev (écran large), visible seulement sur téléphone réel | `getComputedStyle` confirme la déclaration, pas le rendu selon la largeur | Motif B |

---

## 4. Nouvelles règles à ajouter à CLAUDE.md — liste consolidée

Neuf règles couvrent l'essentiel des ~95 incidents ci-dessus qui n'ont pas déjà
la leur. Toutes les autres lignes du tableau renvoient à une règle qui existe
déjà (dans `CLAUDE.md` ou dans le fichier de leçon cité) — les recopier une par
une aurait produit quatre-vingts variations du même principe, ce que §0 bis
règle 4 interdit précisément.

1. *(Motif A)* Une impossibilité mesurée ne généralise jamais au-delà de ce
   qu'elle mesure — changer de client (connecteur, PyPI, runner, navigateur)
   avant de changer de conclusion.
2. *(Motif B)* Avant de croire un vert, dire ce qu'il mesure — contre quel
   fond, sur quel flux, à quelle étape, sur quelle coque.
3. *(Motif C)* Une description plausible se vérifie contre le réel, jamais
   contre sa propre plausibilité ; un test de garde jamais vu rougir sur
   l'injection réelle du défaut n'est pas un test.
4. *(Motif D)* Contrôle périodique : après toute session pouvant créer un
   projet Vercel, ou chaque semaine, `list_projects` (compte ET plan de
   facturation) ; pour tout projet fini et testé, vérifier qu'un déclencheur
   le lance réellement.
5. Toute action censée atteindre le monde réel (SMS, appel, e-mail, paiement,
   publication) se valide dans un vrai navigateur, jamais dans le
   bac-à-sable qui l'a produite.
6. Un signal touchant à la santé ou au bien-être ne compte comme mesuré que
   validé sur des données réelles ; un doute écrit là-dessus bloque, il ne se
   note pas pour plus tard.
7. Un garde-fou d'argent ne compte comme vérifié que si un test l'a vu se
   déclencher pour de vrai sur un dépassement réel.
8. Avant de fusionner : `get_check_runs` ET `get_status`, toujours les deux —
   et toute règle qui apprend à ignorer une famille d'alertes doit dire ce
   qu'elle ne couvre pas.
9. Un changement de plan de facturation sur un compte connecté (Vercel ou
   autre) est une dépense au sens du §5 orange, même sans geste explicite —
   à vérifier, pas seulement à subir.

Ces neuf-là, une fois écrites dans `CLAUDE.md`, couvrent par construction la
plupart des lignes du tableau ci-dessus qui ne portent pas déjà leur propre
règle citée.
