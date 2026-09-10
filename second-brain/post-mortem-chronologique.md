# Post-mortem — chronologie des problèmes rencontrés dans ce dépôt

Écrit le 10/09/2026, à la demande du propriétaire. Ce fichier réunit, en un
seul endroit, tous les problèmes documentés dans `CLAUDE.md` (les paragraphes
datés « mesuré le JJ/MM/2026 ») et dans les 74 fiches de
`second-brain/lecons/`, avec pour chacun : sa position chronologique, son coût
mesuré quand il est chiffré, la raison pour laquelle il n'a pas été vu plus
tôt, une éventuelle déviation par rapport à une priorité annoncée, ce qui dans
le processus de l'époque a permis qu'il traîne, et une règle concrète à
ajouter à `CLAUDE.md`.

**Ce que ce fichier n'est pas** : une nouvelle leçon. Il ne mesure rien de
nouveau — il relit ce qui est déjà mesuré ailleurs, sous un angle différent (le
temps perdu et le processus), et propose des règles là où aucune parade
générale n'existe encore. Quand une parade existe déjà et couvre exactement le
cas (la majorité des cas), l'entrée le dit — « déjà couvert » — plutôt que de
la recopier, par respect du §3 : ce que le dépôt dit déjà ne s'écrit pas une
seconde fois.

**Sur les coûts** : peu de problèmes portent un chiffre de temps explicite dans
le texte source — la plupart des fiches chiffrent un écart de mesure (dB,
pourcentage, nombre de tests) plutôt qu'un temps perdu en heures. Quand le
texte ne chiffre ni l'un ni l'autre, ce fichier écrit **NON CHIFFRÉ** plutôt
que d'inventer un ordre de grandeur.

**Organisation** : chronologique par date de mesure, pas par gravité ni par
projet. Une même cause profonde revient sous des formes différentes à
plusieurs dates — elle n'est pas fusionnée en une seule entrée : la question
posée porte justement sur le nombre de fois où le même type de défaut a dû
être repayé avant qu'une règle générale n'existe.

**Sources** : les 74 fiches de `second-brain/lecons/` (extraites intégralement,
aucune ignorée, aucun doublon parmi elles), et les épisodes datés de
`CLAUDE.md` qu'aucune fiche ne couvre par ailleurs — le texte de `CLAUDE.md`
étant lui-même un journal d'incidents continu, plusieurs de ses paragraphes
recoupent une fiche existante ; dans ce cas, seule la fiche (plus détaillée,
chiffrée) figure ci-dessous, et le paragraphe de CLAUDE.md n'est pas dupliqué.

---

## 29/08/2026 — Quatre chemins d'image donnés pour fermés, conclusion étendue à tort au-delà de ce qu'elle mesurait

**Coût** : NON CHIFFRÉ en heures, mais la conséquence fausse (« une session ne
peut pas fabriquer d'illustration ») a circulé jusqu'au 01/09/2026, soit
plusieurs jours de promesse erronée répétée à chaque session qui la lisait.

**Pourquoi non détecté plus tôt** : la mesure elle-même (`torch`/`diffusers`
absents, quatre hôtes à `000`) était juste ; ce qui était faux est la
généralisation qu'on en a tirée à toute une catégorie de solutions (les
connecteurs MCP), jamais testée avant le 01/09.

**Déviation de priorité** : aucune signalée.

**Ce qui a permis que ça traîne** : une impossibilité mesurée sur des chemins
précis (API directe, bibliothèque locale) a été lue comme une impossibilité
sur toute la catégorie, y compris des chemins jamais essayés.

**Règle proposée** : une conclusion d'impossibilité écrite dans `CLAUDE.md`
doit citer la liste exacte des chemins essayés ; toute extension au-delà de
cette liste (« donc on ne peut pas X ») se marque explicitement comme
hypothèse non vérifiée, jamais comme une mesure.

## 29/08/2026 — Un greffon installé annonce une capacité que cette machine ne lui laisse pas

**Coût** : NON CHIFFRÉ — risque permanent tant que le greffon reste installé :
il répète son annonce fausse à chaque nouvelle session.

**Pourquoi non détecté plus tôt** : le message vient du README du greffon, pas
d'une mesure locale ; personne n'avait confronté l'annonce au sondage réseau
avant que le paragraphe §7 le fasse.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : rien ne distingue, dans le hook de
démarrage d'un greffon tiers, ce qu'il *peut faire en général* de ce que
*cette machine* lui permet.

**Règle proposée** : tout nouveau connecteur ou greffon installé se sonde par
un aller-retour réseau réel avant que son message d'auto-présentation soit
cru, et le résultat du sondage s'écrit à côté de l'annonce d'origine plutôt
que de la remplacer silencieusement.

## 29/08/2026 — Messagerie inter-sessions jugée impossible après un seul essai

**Coût** : NON CHIFFRÉ — l'hypothèse fausse (« aucun canal n'existe ») a tenu
jusqu'à sa précision le 06/09/2026 (voir aussi l'entrée du 06/09 sourcée dans
les fiches, qui est la reproduction du même piège sous une forme plus fine).

**Pourquoi non détecté plus tôt** : l'échec initial (`ListAgents` ne rend
aucun pair, `SendMessage` refuse) a été pris pour une propriété du mécanisme,
jamais reproduit contre une cible réellement `connected`.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un refus d'outil a été interprété comme une
absence de canal plutôt que comme un état de la cible — la distinction
(mécanisme vs état de la cible) n'existait pas encore dans la méthode de ce
dépôt à cette date.

**Règle proposée** : déjà couverte depuis — voir l'entrée du 06/09/2026
ci-dessous (« La messagerie entre sessions marche — sur une cible connectée »)
qui porte la règle définitive. Exclu du §3 pour ne pas la répéter deux fois.

## 29/08/2026 — Mauvaise machine choisie par réflexe pour l'agrandissement d'image

**Coût** : NON CHIFFRÉ.

**Pourquoi non détecté plus tôt** : le PC et le conteneur distant portent
chacun un mur différent (Python 3.14 casse `basicsr` sur le PC ; pas de GPU et
mandataire qui refuse la roue CPU sur le conteneur) — router vers le PC par
habitude a précédé toute comparaison des deux.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : l'habitude « le PC a plus de capacités » a
remplacé la vérification au cas par cas.

**Règle proposée** : quand une tâche peut tourner sur plusieurs machines (PC,
conteneur distant, runner), sonder les deux avant de choisir plutôt que de
router par défaut vers le PC — déjà en germe dans CLAUDE.md (« Router vers le
PC est donc un choix, pas un réflexe ») ; à généraliser explicitement à toute
tâche multi-machine, pas seulement à ce cas précis.

## 31/08/2026 → 01/09/2026 — Quota de déploiements Vercel crevé trois fois de suite

**Coût** : « crevé trois fois » — 2ᵉ fois à 80 fusions dans la journée, 3ᵉ fois
le 01/09 à 18 PR fusionnées, chaque fois avec des rouges de CI qui n'étaient
pas des défauts de code mais des refus de quota.

**Pourquoi non détecté plus tôt** : chaque nouveau projet Vercel lié au dépôt
se crée depuis le tableau de bord, sans laisser de trace dans Git — un relevé
d'hier ne dit rien d'aujourd'hui, et le nombre de projets liés (donc le seuil
réel) changeait plus vite qu'il n'était revérifié.

**Déviation de priorité** : non signalée comme telle, mais un temps notable a
été consommé à diagnostiquer des rouges de CI qui n'étaient pas des défauts.

**Ce qui a permis que ça traîne** : aucune routine ne recalculait le seuil du
jour avant un gros lot de fusions — le chiffre écrit dans CLAUDE.md se périmait
en silence.

**Règle proposée** : avant un lot de plus de cinq fusions prévues dans la même
journée, appeler `list_projects` une fois pour recalculer le seuil du jour
plutôt que de se fier au chiffre écrit dans CLAUDE.md, qui peut avoir changé
depuis la veille.

## 31/08/2026 — `visual_library/` : 1117 lignes non déclarées nulle part

**Coût** : « plus gros chantier nu du dépôt » avant découverte ; corrigé « en
une nuit » une fois trouvé.

**Pourquoi non détecté plus tôt** : `verifier.sh` découvre les suites Python au
lieu de les énumérer par nom — un `grep` sur le nom du projet rendait zéro et
laissait croire qu'il était ignoré, alors que ses 18 tests tournaient déjà
sans être vus.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : aucun audit périodique ne confrontait les
dossiers de premier niveau réellement présents à la liste documentée en §4
STACK — un projet entier peut exister sans être nommé nulle part avant qu'un
audit ponctuel, pas systématique, ne le trouve.

**Règle proposée** : `/coherence-depot` liste aussi les dossiers de premier
niveau absents du §4 STACK, pas seulement les incohérences de compétences déjà
déclarées — un audit qui ne détecte que ce qu'il connaît déjà ne détecte
jamais un projet entièrement oublié.

## 31/08/2026 → 03/09/2026 (~3 jours) — `amorce-51up` servie derrière un mur d'authentification sans que personne ne le voie

**Coût** : « deux sessions et le README d'artisan-express s'étaient contredits
là-dessus pendant trois jours ».

**Pourquoi non détecté plus tôt** : un contrôle « j'ouvre le lien, ça marche »
depuis une session authentifiée à Vercel passe toujours, donc chaque
vérification confirmait le mur sans le voir — seul le réglage `ssoProtection`
ou une navigation privée le révèle.

**Déviation de priorité** : oui — la page de vente à 300 € était censée être
publique et ne l'était pas, pendant que la prospection tournait.

**Ce qui a permis que ça traîne** : la méthode de vérification elle-même
(ouvrir le lien) était biaisée par l'authentification de l'outil qui
vérifiait — trois jours de contradiction sans qu'aucune session ne change de
méthode de contrôle.

**Règle proposée** : pour vérifier qu'une adresse Vercel est publique, ne
jamais se fier à un accès via un outil authentifié au compte (connecteur,
navigateur connecté) — lire directement `ssoProtection` / *Deployment
Protection* via l'API, ou tester en navigation privée.

## 01/09/2026 — Composio installable, mais backend inatteignable ; une clé d'API n'y change rien

**Coût** : NON CHIFFRÉ, mais un aller-retour complet (installation, login,
tentative de clé d'API) a été mené avant de conclure au mur réseau.

**Pourquoi non détecté plus tôt** : chaque étape individuelle (installation,
`--version`) avait réussi, ce qui a retardé la découverte que la vraie limite
était `backend.composio.dev` refusé au tunnel.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : la même confusion que pour ElevenLabs
(« ce n'est pas la clé qui manque, c'est l'hôte ») a dû être redécouverte une
seconde fois sur un outil différent, alors que le motif était déjà écrit dans
CLAUDE.md.

**Règle proposée** : avant de chercher une clé d'API pour un outil qui refuse,
relire d'abord la liste des blocages d'hôte déjà connus en §7 — un refus
d'authentification qui suit un `403`/`000` au premier appel réseau est très
probablement le même mur, pas une clé manquante.

## 02/09/2026 — Annuaria : onze usages de l'accent au lieu d'un, invisible à toutes les mesures existantes

**Coût** : NON CHIFFRÉ.

**Pourquoi non détecté plus tôt** : la seule mesure existante portait sur le
texte posé sur le bouton (juste, 4,9–10,5:1) ; personne n'avait mesuré la
couleur du bouton contre le reste de la page (3,42:1 réel, sous le plancher).

**Déviation de priorité** : le lien affilié — seule chose qui rapporte sur ce
site — n'avait rien qui le distingue du décor pendant toute cette période.

**Ce qui a permis que ça traîne** : « une mesure juste sur le mauvais objet
laisse un défaut intact et donne l'impression du contraire » — la présence
d'une mesure verte a dispensé de chercher s'il y avait la bonne mesure.

**Règle proposée** : quand une règle de conception cite un seuil chiffré (ici
7:1 sur la surface la plus claire), le commentaire du test doit nommer
explicitement les deux objets comparés — pas seulement le chiffre attendu —
pour qu'une relecture future voie en un coup d'œil si c'est le bon objet qui a
été mesuré.

## 02/09/2026 → 03/09/2026 (~13h) — GitHub Pages du réseau d'annuaires resté en mode branche, onze sites « en ligne » nulle part

**Coût** : billet #557 ouvert du 02/09 15h46 au 03/09 05h15 (~13h), onze sites
inaccessibles pendant cette fenêtre malgré un workflow vert en permanence.

**Pourquoi non détecté plus tôt** : le workflow `annuaire-ia-pages.yml` restait
vert (il détecte, prévient, s'arrête) — un vert qui ne veut pas dire « déployé »
a été lu comme suffisant.

**Déviation de priorité** : aucune signalée, mais un rouge structurel non lié
au diff (Jekyll qui casse sur un fichier Astro sans rapport, à chaque poussée
sur `main`) a consommé de l'attention de diagnostic à chaque PR pendant cette
période.

**Ce qui a permis que ça traîne** : la correction attendait un geste que seul
le propriétaire pouvait faire (changer la source Pages) ; l'ouverture d'un
billet nommé n'a pas suffi à le faire agir vite, faute d'un rappel explicite
dans le compte rendu.

**Règle proposée** : quand un service tiers reste dans un état que seul le
propriétaire peut corriger, la phrase de compte rendu du même message doit
dire explicitement « bloqué, geste attendu : X » plutôt que de laisser un vert
de façade (workflow qui ne fait qu'avertir) masquer l'attente.

## 03/09/2026 — `le-coffre-hosted` retiré : le doublon couvrait un schéma SQL que le projet conservé n'utilisait pas *(second-brain/lecons/2026-09-03-un-doublon-couvre-ce-qui-manque.md)*

**Coût** : NON CHIFFRÉ ; `supabase/schema.sql` a dû être reconstruit depuis le
code, colonne par colonne, et n'a pas pu être rejoué contre un vrai projet.

**Pourquoi non détecté plus tôt** : le seul fichier SQL du dépôt vivait dans le
doublon qu'on s'apprêtait à retirer, décrivant *son* modèle à lui (`coffres`),
pas celui du projet conservé (`coffre_cles`, `coffre_index`).

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : aucun test ni contrôle ne comparait le
schéma SQL déclaré au code qui l'interroge réellement — la seule vérité vivait
dans un projet Supabase externe, non lu automatiquement.

**Règle proposée** : avant de retirer un doublon de code, `grep` sur ce que
chacune des deux copies référence comme source de vérité externe (base de
données, config, secret) — pas seulement sur ce que le code fait — pour
repérer si l'une des deux est seule à documenter une dépendance externe.

## 03/09/2026 — GitHub MCP : deux rédactions contradictoires de la même règle en un jour

**Coût** : NON CHIFFRÉ, mais deux versions opposées de la règle ont coexisté
dans `CLAUDE.md` le même jour avant clarification.

**Pourquoi non détecté plus tôt** : chaque session décrivait fidèlement *sa
propre* expérience (l'une a eu un 403 en écriture, l'autre a fusionné sept
fois par le MCP le même jour) — aucune des deux rédactions n'était fausse pour
son auteur, mais généralisée à tort à « le MCP » sans nuance.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : l'accès en écriture au MCP GitHub se donne
à la conversation, pas au dépôt — une propriété invisible depuis un texte qui
parle comme si c'était une propriété stable de l'outil.

**Règle proposée** : déjà couverte — « une observation d'outillage n'est
jamais une propriété de l'outil » est désormais écrit en toutes lettres.
Exclu du §3.

## 03/09/2026 — TITAN Builder : palette mesurée sur la mauvaise surface (`ink` au lieu de `panel`)

**Coût** : NON CHIFFRÉ, mais deux mesures complètes ont dû être refaites (cinq
teintes, puis réécartement des angles).

**Pourquoi non détecté plus tôt** : la règle générale du §2 bis dit « sur la
surface la plus claire — c'est le pire cas » mais la première mesure a porté
sur `ink` (la plus sombre, le meilleur cas) — la moitié de la phrase s'était
perdue entre la règle et le test.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : aucun test automatisé ne vérifiait *quelle*
surface était utilisée dans le calcul de contraste — seul le résultat du
calcul était testé, jamais son entrée.

**Règle proposée** : quand une règle transverse impose « mesurer contre X »
(ici la surface la plus claire), le nom littéral de X doit apparaître dans le
test qui vérifie la règle, jamais seulement le résultat numérique attendu.

## 03/09/2026 — Artisan Express : l'accent rendait 4,6:1 sur blanc, sous le plancher de 7:1

**Coût** : NON CHIFFRÉ, mais a forcé un changement de thème (clair → sombre)
sur une page déjà en production.

**Pourquoi non détecté plus tôt** : la phrase « c'est une page de vente »
suffisait à justifier le thème clair sans que personne ne mesure le contraste
réel du bouton d'action contre son fond.

**Déviation de priorité** : le bouton qui portait toute la page (l'action à
faire) était sous le plancher de lisibilité pendant toute cette période.

**Ce qui a permis que ça traîne** : la règle du §2 bis (accent ≥ 7:1) existait
déjà pour d'autres produits, mais n'avait pas été systématiquement appliquée à
chaque nouveau produit au moment de son lancement.

**Règle proposée** : tout nouveau produit qui rejoint le registre des accents
du §2 bis mesure son contraste **avant** sa première mise en ligne, pas après
— la case « mesuré et conforme » se remplit à la création du produit, jamais
a posteriori.

## 03/09/2026 — ElevenLabs rend ses fichiers, et un lit musical à -13dB était inaudible sur téléphone *(lecons/2026-09-03-le-connecteur-elevenlabs-rend-ses-fichiers.md)*

**Coût** : génération à 16,36 centimes ; musique à -13dB rendait -40,2dB dans
les pauses contre -41,9dB de silence — 1,7dB au-dessus du silence seulement.

**Pourquoi non détecté plus tôt** : « personne n'avait regardé par quel hôte
ElevenLabs sert ses générations » ; côté mixage, « aucune des deux causes ne se
voit en LUFS ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un mur mesuré sur un connecteur (impossible
de récupérer un fichier) avait été généralisé à tous les connecteurs, sans
vérification par produit.

**Règle proposée** : un mur mesuré sur un connecteur ne se généralise jamais
aux autres sans sondage propre ; un lit musical se règle systématiquement
au-dessus de 400Hz avec une détente plus courte que la plus courte pause du
montage.

## 03/09/2026 — Le DCA aveugle bat la stratégie NexusCrypto sur les trois fenêtres réelles, alors qu'un avertissement le disait déjà *(lecons/2026-09-03-le-dca-aveugle-gagne-sur-trois-fenetres.md)*

**Coût** : écarts de -23%/-11%/-36% selon la fenêtre ; ratio gain/douleur 11,77
contre 15,25 pour le témoin.

**Pourquoi non détecté plus tôt** : « l'avertissement était imprimé à chaque
exécution depuis qu'il existe […] on regardait la ligne de la stratégie […]
pas la ligne d'en dessous ».

**Déviation de priorité** : aucune signalée comme telle, mais un signal
explicite existait et n'a pas été lu pendant toute cette période.

**Ce qui a permis que ça traîne** : un avertissement inconditionnel, imprimé à
chaque fois qu'il soit vrai ou non pertinent, finit par ne plus être lu.

**Règle proposée** : un avertissement automatique qui s'imprime à chaque
exécution sans jamais varier perd sa valeur de signal — le rendre conditionnel
(ne s'affiche que quand l'écart dépasse un seuil) ou le faire remonter dans un
résumé explicite plutôt que dans le flux continu.

## 03/09/2026 — `rem` vaut 16px, jamais les 18px que le corps déclare *(lecons/2026-09-03-le-rem-vaut-16-px.md)*

**Coût** : NON CHIFFRÉ ; trois tailles sous le plancher de 18px passées
inaperçues (signature pied 15,2px, mention à 3,10:1, `--color-danger` à
2,52:1).

**Pourquoi non détecté plus tôt** : « les trois fois c'est le contrôle visuel
qui l'a vu, jamais les tests » ; la règle `.mention` dormait car « aucune
démonstration ne portait d'avis ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : aucun test ne relisait toutes les tailles
réellement émises par la feuille de style — seules les valeurs déclarées dans
le code source étaient vérifiées, pas celles calculées.

**Règle proposée** : un test doit lire toutes les tailles de la feuille de
style **émise** (par regex sur le CSS généré, commentaires retirés d'abord),
jamais seulement les valeurs déclarées dans le fichier source.

## 03/09/2026 — Une série longue peut n'avoir aucun prix, et sa longueur le cache *(lecons/2026-09-03-serie-vide-mais-longue.md)*

**Coût** : 2235 lignes dans `sol.csv`, mais colonne de repli remplie sur 7
lignes seulement ; portefeuille à 4 lignes dont 3 seulement mesurables.

**Pourquoi non détecté plus tôt** : « les trois signaux qui rassurent — taille,
plage de dates, nombre de colonnes — sont exactement ceux qui ne mesurent pas
ce dont on a besoin ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : aucune vérification ne comptait les valeurs
réellement présentes par colonne avant de bâtir un calcul dessus.

**Règle proposée** : avant de bâtir un calcul sur une série de données, compter
les valeurs non vides par colonne (pas les lignes totales) et refuser de
continuer si la colonne nécessaire est trop clairsemée.

## 03/09/2026 — Supprimer une branche distante : trois chemins, trois murs différents *(lecons/2026-09-03-supprimer-une-branche-distante-est-impossible-dici.md)*

**Coût** : NON CHIFFRÉ.

**Pourquoi non détecté plus tôt** : NON PRÉCISÉ dans la fiche.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : trois tentatives, trois causes
indépendantes (mandataire, classificateur, outil inexistant) — chacune aurait
pu être prise seule pour une preuve définitive d'impossibilité, ce que le
dépôt a depuis appris à ne pas faire (« un refus du classifieur désigne
l'outil, jamais le geste »).

**Règle proposée** : déjà couverte — la parade dégradée (script listant les
branches supprimables, lancé par le propriétaire) est appliquée et documentée
en §10 « Après la fusion : supprimer la branche ». Exclu du §3.

## 03/09/2026 — Trois défauts d'une chaîne ffmpeg, tous invisibles dans la mesure d'avant *(lecons/2026-09-03-trois-defauts-de-chaine-ffmpeg.md)*

**Coût** : écart de sonie -11,9 LUFS annoncé contre -14,4 LUFS réel (2,5dB) ;
perte de 3dB sur un doublement mono→stéréo mal fait.

**Pourquoi non détecté plus tôt** : « la mesure disait vert sur la source, et
le fichier livré était faux » ; « aucun avertissement, aucune erreur, et la
commande rend le bon format ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : chaque étape de la chaîne ffmpeg était
mesurée isolément et jugée correcte, jamais le fichier final réellement
produit par l'enchaînement complet.

**Règle proposée** : déjà en grande partie couverte par la règle du §8 « on
revérifie le fichier qu'on envoie, pas celui d'avant » — étendre
explicitement cette règle aux chaînes ffmpeg multi-étapes : mesurer le
**fichier de sortie final**, jamais une étape intermédiaire jugée conforme.

## 03/09/2026 — Un détecteur sans témoin ne se règle pas, il se persuade *(lecons/2026-09-03-un-detecteur-sans-temoin-se-persuade.md)*

**Coût** : `influence_score` de NexusCrypto ne déplace le résultat que de 0,42
point, de façon non monotone, sur toute sa plage de réglage.

**Pourquoi non détecté plus tôt** : le radar de pépites n'a aucun témoin
comparatif — seulement une régression sur ses propres résultats.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : « un détecteur ne se juge jamais sur ses
propres sorties » — règle non appliquée avant cette mesure.

**Règle proposée** : tout détecteur ou score ajouté au dépôt doit être
accompagné d'un banc d'essai comparatif (un témoin réel, pas seulement une
régression sur lui-même) dès son premier jour, pas ajouté après coup.

## 03/09/2026 — Un garde-fou juste qui ne se déclenche jamais *(lecons/2026-09-03-un-garde-fou-juste-qui-ne-se-declenche-jamais.md)*

**Coût** : 6 faux positifs sur 12 cadres réels, non détectés par le garde-fou
censé les attraper.

**Pourquoi non détecté plus tôt** : « les tests passent […] le code se relit
bien […] et l'application ne se tait jamais : elle répond, avec aplomb, autre
chose » — une troisième condition cumulative trop restrictive empêchait le
déclenchement.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : rien ne comptait combien de fois le
garde-fou s'était réellement déclenché sur un corpus réel — un déclenchement
zéro n'alertait personne.

**Règle proposée** : tout garde-fou de prudence porte un compteur de
déclenchements réels sur le corpus de test ; un compteur à zéro sur un corpus
qui devrait le déclencher au moins une fois est traité comme une alerte, pas
comme un silence normal.

## 03/09/2026 — Un limiteur suivi d'une atténuation grésille pour rien *(lecons/2026-09-03-un-limiteur-suivi-dune-attenuation-gresille-pour-rien.md)*

**Coût** : réduction de 9,67dB sur 3,81% des échantillons, rattrapée en aval au
lieu d'être réglée en amont ; 4,8dB d'aigu en trop.

**Pourquoi non détecté plus tôt** : « rien ne le signalait » — les mesures de
sonie et de vrai pic étaient toutes conformes, seule l'écoute directe l'a
détecté.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un gain était rattrapé après le limiteur
plutôt que réglé avant lui — une mesure globale conforme masquait un défaut
local.

**Règle proposée** : le gain avant un limiteur se règle sur le niveau visé,
jamais rattrapé après coup ; contrôler le niveau en flottant *avant* le
limiteur, pas seulement le résultat final.

## 03/09/2026 — Un menu §0 bis peut périmer avant le feu vert *(lecons/2026-09-03-un-menu-peut-perimer-avant-le-feu-vert.md)*

**Coût** : moins de 5 minutes ont suffi (16:09:42 → 16:14:59) pour que trois
autres sessions corrigent en parallèle les mêmes points qu'un menu venait de
lister.

**Pourquoi non détecté plus tôt** : « un contrôle rouge sur `main` est visible
par tout le monde en même temps » — plusieurs sessions convergent sur le même
défaut sans coordination explicite.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le menu §0 bis n'était revérifié qu'*avant*
d'être posé, jamais *après* réception du feu vert, alors que `main` avait pu
bouger entre-temps.

**Règle proposée** : après réception d'un « go » sur un menu §0 bis, refaire un
`git fetch` et rejouer le contrôle concerné avant d'écrire — pas seulement
avant de poser le menu.

## 03/09/2026 — Un outil qui note tout sauf lui-même *(lecons/2026-09-03-un-outil-qui-note-tout-sauf-lui-meme.md)*

**Coût** : NON CHIFFRÉ ; le nom des pépites notées 55-70 était perdu car le
symbole d'un jeton n'était stocké qu'au-dessus du seuil d'alerte.

**Pourquoi non détecté plus tôt** : « ce qui était vérifié […] qu'il ne plante
pas […] aucun des trois ne dit si le radar a raison ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : « un outil sans bulletin ressemble trait
pour trait à un outil qui a un bon bulletin » — l'absence de journal de
verdicts était indiscernable, de l'extérieur, d'un journal qui dirait « tout va
bien ».

**Règle proposée** : tout outil de classement ou de notation écrit
systématiquement son propre verdict dans un journal relisible — deux
questions à se poser à chaque nouvel outil de ce type : qu'enregistre-t-il et
ne relit jamais ? a-t-il été jugé sur le fait de tourner ou sur le fait
d'avoir raison ?

## 03/09/2026 — Un stop coupe la perte et la reprise avec — sur ce qu'on accumule, c'est le mauvais échange *(lecons/2026-09-03-un-stop-coupe-aussi-la-reprise.md)*

**Coût** : 11 stops déclenchés en 2018 ont encaissé 1538$ de perte sur des
positions qui valaient 25 331$ fin 2021 (16×).

**Pourquoi non détecté plus tôt** : « décomposé, ce fait n'en explique qu'un
cinquième » — l'attribution initiale au capital retenu était incomplète.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le raisonnement initial ne décomposait pas
l'effet du stop en ses composantes réelles (perte immédiate vs. rebond
manqué), se contentant d'un chiffre agrégé trompeur.

**Règle proposée** : tout réglage de gestion du risque (stop, coupe-circuit)
mesuré sur un rejeu doit décomposer son effet en composantes séparées
(perte évitée, gain manqué) plutôt que de rapporter un seul chiffre agrégé.

## 03/09/2026 — Une absence constatée est datée à la minute, pas acquise *(lecons/2026-09-03-une-absence-est-datee-a-la-minute.md)*

**Coût** : trois minutes seulement entre la recherche (zéro résultat) et le
commit contradictoire qui créait la compétence cherchée — doublon de 220
lignes produit.

**Pourquoi non détecté plus tôt** : « la branche […] avait dix minutes de
retard sur `main` » — l'écart entre deux sessions parallèles suffit à rendre
une conclusion d'absence fausse en quelques minutes.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un `git fetch` avait été fait avant de
*chercher*, mais pas juste avant d'*écrire* — l'écart s'est creusé entre les
deux gestes.

**Règle proposée** : `git fetch` se refait juste avant le geste d'écriture
lui-même (création de fichier, commit), pas seulement avant la recherche qui
l'a précédé — une absence constatée est datée à la minute de la recherche, pas
acquise pour toute la durée du geste qui suit.

## 03/09/2026 — Une baisse de fréquence de défaut n'est pas une correction *(lecons/2026-09-03-une-baisse-de-frequence-nest-pas-une-correction.md)*

**Coût** : le taux de faux positifs a baissé de 15/17 à 8/32, mais les 8
restants sont tous le même défaut intact sur des sujets sans rapport — « deux
jours de confiance dans un seuil qui ne mesure pas ce qu'on croyait ».

**Pourquoi non détecté plus tôt** : « un correctif qui rate mais rétrécit la
porte fait baisser le compte sans toucher à la cause, et les deux se
ressemblent parfaitement dans un tableau de résultats ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : après un correctif, les cas restants
étaient comptés, jamais regardés individuellement.

**Règle proposée** : après tout correctif censé réduire un taux d'erreur, les
cas qui restent en échec se regardent un par un plutôt que de se compter — une
baisse du compte total ne dit rien sur le fait que la cause ait changé.

## 03/09/2026 — Dans un dépôt qui fusionne en squash, git ne sait pas dire quelles branches sont mortes *(lecons/2026-09-03-une-branche-fusionnee-en-squash-parait-vivante.md)*

**Coût** : sur 320 branches, deux mesures git déclaraient 225/224 « vivantes »
alors que l'état réel des PR n'en comptait que 32 — 193 branches jugées
vivantes à tort.

**Pourquoi non détecté plus tôt** : « ce dépôt fusionne en squash. La fusion
réécrit l'histoire […] les deux commandes répondent exactement à ce qu'on leur
demande. C'est la question qui était mauvaise ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : `git branch --merged` était utilisé comme
seule source de vérité pour juger une branche « morte », sans tenir compte du
mode de fusion réellement pratiqué par le dépôt à cette date (ce dépôt
utilise désormais des commits de fusion, pas le squash, ce qui rend
`--merged` de nouveau fiable — mais la leçon générale reste vraie pour tout
dépôt en squash).

**Règle proposée** : sur un dépôt qui pratique (ou a pratiqué) le squash-merge,
seule l'état des pull requests via l'API GitHub tranche si une branche est
morte — `git branch --merged` seul n'y suffit jamais.

## 03/09/2026 — Une capture d'écran 9:16 ne se zoome pas, et la voix off dit ce qu'il fallait montrer *(lecons/2026-09-03-une-capture-9-16-ne-se-zoome-pas.md)*

**Coût** : trois montages livrés avant qu'une transcription de la voix off
n'existe, révélant après coup ce que le montage aurait dû montrer depuis le
début.

**Pourquoi non détecté plus tôt** : NON PRÉCISÉ pour le problème géométrique du
zoom (mesure directe possible dès le départ, jamais faite) ; pour la voix off,
la transcription n'avait simplement jamais été faite avant le montage.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : la marge de zoom disponible n'était pas
mesurée avant de promettre un plan serré ; la voix off n'était pas transcrite
avant le premier montage.

**Règle proposée** : mesurer la marge latérale disponible avant de promettre un
plan serré sur une capture déjà cadrée ; transcrire systématiquement la voix
off avant le premier montage, pas après.

## 03/09/2026 — Une correction en masse déplace le défaut en aval *(lecons/2026-09-03-une-correction-en-masse-deplace-le-defaut-en-aval.md)*

**Coût** : 33 fichiers sur 66 avaient un frontmatter YAML fautif (certains
« depuis des semaines ») ; la correction en masse a ensuite fait apparaître un
guillemet ouvrant en tête de 33 lignes du tableau généré.

**Pourquoi non détecté plus tôt** : « le contrôle de cohérence du dépôt
vérifie qu'une compétence est citée, jamais que son entête se lit » — le
défaut a été trouvé en relisant le diff, pas en mesurant.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : après une correction touchant de nombreux
fichiers, ce qui consomme ces fichiers (le générateur de tableau) n'était pas
relancé pour regarder sa sortie.

**Règle proposée** : après une correction en masse touchant N fichiers,
relancer systématiquement ce qui les consomme (générateur, agrégateur) et
regarder sa sortie — le correctif n'est vérifié qu'une fois son effet en aval
observé, pas seulement les fichiers modifiés eux-mêmes.

## 03/09/2026 — Une fusion sans conflit peut rendre un document qui se contredit *(lecons/2026-09-03-une-fusion-propre-nest-pas-un-texte-coherent.md)*

**Coût** : deux fois le même jour, une fusion git sans conflit sur `CLAUDE.md`
a produit une phrase dupliquée et une phrase orpheline.

**Pourquoi non détecté plus tôt** : « le contrôle de cohérence passe au vert :
il vérifie que le dépôt dit vrai sur lui-même […] pas que les phrases
s'enchaînent ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une fusion réussie (sans marqueur de
conflit git) était considérée comme suffisante, sans relecture du texte
produit.

**Règle proposée** : après toute fusion sur un fichier partagé à forte
densité de prose (`CLAUDE.md` en tête), relire le paragraphe entier autour du
point de fusion (`git diff HEAD~1`), pas seulement constater l'absence de
marqueur de conflit.

## 03/09/2026 — `zoompan` multiplie les images d'une boucle au lieu de les remplacer *(lecons/2026-09-03-zoompan-multiplie-les-images-dune-boucle.md)*

**Coût** : un montage de 14,7s attendu est sorti à 548,7s (16 462 images) — 37×
trop long, sans aucun avertissement de l'outil.

**Pourquoi non détecté plus tôt** : « la commande réussit, le fichier est
valide, il dure trente-sept fois trop longtemps » — sans avertissement, le
timeout initial a fait chercher du côté de la performance plutôt que du
paramètre.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le paramètre `d` de `zoompan` s'applique
par image d'entrée et non en sortie, un comportement non intuitif jamais
vérifié avant l'usage.

**Règle proposée** : donner à `zoompan` une seule image en entrée (sans
`-loop`) et lire `nb_frames`/`duration` via `ffprobe` avant même de regarder le
fichier produit, pour détecter une durée aberrante avant l'encodage complet.

## 04/09/2026 — Deux demandes dans un message en font zéro *(lecons/2026-09-04-deux-demandes-dans-un-message-en-font-zero.md)*

**Coût** : « un aller-retour complet, depuis un téléphone » ; la décision
attendait depuis deux jours.

**Pourquoi non détecté plus tôt** : sans objet — le défaut se manifeste au
moment même du message ambigu.

**Déviation de priorité** : une décision attendait depuis deux jours pendant
que le message qui aurait dû la débloquer restait incompris.

**Ce qui a permis que ça traîne** : « deux demandes dans un même paragraphe
obligent le lecteur à trancher laquelle compte […] ce tri-là n'est écrit nulle
part ».

**Règle proposée** : un message qui répond au propriétaire se termine par au
plus une chose à faire ; poser un choix en options cliquables plutôt qu'en
prose quand plusieurs pistes existent.

## 04/09/2026 — Le défaut vit dans la couture entre deux moitiés justes *(lecons/2026-09-04-le-defaut-vit-dans-la-couture-entre-deux-moities-justes.md)*

**Coût** : « l'aller-retour complet a échoué deux fois avant de passer » —
au-delà, NON CHIFFRÉ.

**Pourquoi non détecté plus tôt** : « aucune des deux moitiés n'est fautive
[…] c'est leur enchaînement qui casse, et un enchaînement ne se relit pas : il
s'exécute » ; rien ne signale le défaut à la restauration, qui se termine sans
erreur.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une sauvegarde jamais restaurée n'avait
jamais été éprouvée bout en bout — `pg_dump` excluait un déclencheur que la
restauration réveillait, créant des profils vides en collision avec les vrais.

**Règle proposée** : une sauvegarde qui n'a jamais été restaurée n'est pas une
sauvegarde ; le contrôle porte sur deux volets — un manifeste de comptage et
une vérification RLS/politiques/déclencheurs après restauration réelle, pas
seulement sur la réussite de l'export.

## 04/09/2026 — Le mandataire d'une session distante n'est pas celui d'un runner GitHub *(lecons/2026-09-04-le-mandataire-du-runner-nest-pas-celui-de-la-session.md)*

**Coût** : le radar de pépites, fini et vert, est resté **à l'arrêt cinq
jours** faute de savoir qu'un simple workflow GitHub Actions pouvait joindre
les hôtes de marché refusés à une session distante.

**Pourquoi non détecté plus tôt** : « les deux premières propositions [de la
phrase fautive] sont vraies. La troisième ne l'est pas » — une conséquence
fausse attachée à une mesure juste.

**Déviation de priorité** : oui, potentiellement la plus coûteuse en temps
mesuré explicitement de tout le dépôt (cinq jours pour un produit fini et
prêt).

**Ce qui a permis que ça traîne** : personne n'a testé l'hypothèse alternative
(« un runner aurait-il un accès réseau différent ? ») avant le 04/09/2026.

**Règle proposée** : déjà couverte, écrite le jour même — « avant de conclure
qu'une tâche a besoin du PC, se demander si elle tiendrait dans un workflow ».
Exclu du §3.

## 04/09/2026 — Un banc d'essai fabriqué mesure la thèse de son auteur avant de mesurer l'outil *(lecons/2026-09-04-un-banc-fabrique-mesure-son-auteur.md)*

**Coût** : un premier verdict chiffré faux (« le radar fait 9 points de moins
que le hasard ») ; corrélation de 0,838 entre la variation passée et le
rendement futur du marché fabriqué, avec 37/100 points de la note du radar
reposant sur des critères sans sens dans ce marché-là.

**Pourquoi non détecté plus tôt** : « sans le vouloir, j'avais écrit un monde
momentum […] le banc ne mesurait donc pas la note. Il mesurait ma thèse de
marché. »

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : la thèse de rendement encodée dans le
générateur de marché fabriqué était implicite, jamais explicitée ni balayée.

**Règle proposée** : la thèse de rendement d'un banc d'essai fabriqué devient
un paramètre explicitement balayé dans le code, jamais une hypothèse cachée
dans le générateur ; un banc doit imprimer ce qu'il n'éprouve pas.

## 04/09/2026 — Un binaire installé par une roue Python n'existe que pour Python *(lecons/2026-09-04-un-binaire-installe-par-une-roue-python-nexiste-que-pour-python.md)*

**Coût** : NON CHIFFRÉ (qualifié de « coûte une soirée à quelqu'un d'autre »).

**Pourquoi non détecté plus tôt** : « tout ce qui n'est pas écrit en Python ne
le voit pas […] ne se voit pas chez celui qui écrit le code s'il a par
ailleurs un ffmpeg système ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : `imageio-ffmpeg` pose un `ffmpeg` invisible
sur le PATH réservé à Python ; un outil non-Python (`yt-dlp`) ne le trouve pas
et pousse à tort à en installer un second.

**Règle proposée** : désigner explicitement le binaire (`--ffmpeg-location` ou
équivalent) plutôt que d'espérer qu'un outil non-Python le trouve sur le PATH
posé par une roue Python ; réutiliser la fonction du dépôt qui sait déjà le
chercher plutôt que d'en écrire une nouvelle.

## 04/09/2026 — Un corpus fabriqué ne contient que ce qu'on savait demander *(lecons/2026-09-04-un-corpus-fabrique-ne-contient-que-ce-quon-savait-demander.md)*

**Coût** : 30 chats sur 40 (ESC-50, vrais chats) ressortaient faussement en
« stress » annoncé comme mesuré, malgré deux jours de développement sur un
corpus fabriqué qui séparait parfaitement.

**Pourquoi non détecté plus tôt** : « invisible depuis l'intérieur : sur son
propre corpus, la règle sépare parfaitement. Tous les tests étaient verts » ;
« une réserve écrite n'empêche rien. Seule la mesure qui manque empêche. »

**Déviation de priorité** : le produit aurait dit à quatre propriétaires de
chat sur cinq que leur animal va mal — un risque direct pour l'utilisateur
final, resté deux jours sans être mesuré contre le réel.

**Ce qui a permis que ça traîne** : un corpus entièrement fabriqué a servi de
plancher de référence pendant tout le développement, sans jamais être confronté
au réel avant l'échéance de mise en ligne.

**Règle proposée** : tout seuil de détection dérivé d'un corpus fabriqué (donc
jamais confronté au réel) porte une mention explicite « provisoire, non
confronté au réel » dans le code et toute documentation utilisateur, jusqu'à
ce qu'un corpus réel — même petit — confirme ou corrige le seuil ; quand aucun
réglage ne sépare correctement sur le réel, retirer la lecture plutôt que d'en
choisir une par défaut.

## 04/09/2026 — Un `enum` ne survit pas au retrait de types *(lecons/2026-09-04-un-enum-ne-survit-pas-au-retrait-de-types.md)*

**Coût** : NON CHIFFRÉ.

**Pourquoi non détecté plus tôt** : « l'outil qui vérifie et l'outil qui
exécute ne regardent pas la même chose » — `tsc --noEmit` ne détecte pas ce
qui casse en mode `strip-only` de Node.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le mode d'exécution réel (retrait de types
Node, sans compilation complète) diverge du mode de vérification habituel
(`tsc`), sans qu'aucun contrôle ne teste les deux ensemble.

**Règle proposée** : remplacer tout `enum` TypeScript par un objet `as const` +
type dérivé dans les projets exécutés en mode `strip-only` ; ajouter
systématiquement tout nouveau projet TS neuf à l'exclusion du `tsconfig.json`
racine, pour ne pas être absorbé silencieusement par un typecheck qui ne le
concerne pas.

## 04/09/2026 — Un état reconstruit champ par champ perd ce qu'il ne nomme pas *(lecons/2026-09-04-un-etat-reconstruit-champ-par-champ-perd-ce-qu-il-ne-nomme-pas.md)*

**Coût** : NON CHIFFRÉ ; 4 des 5 fonctions réécrivant l'index du coffre
effaçaient silencieusement `rendezVous` et `identite`, cassant la génération de
lettres de résiliation.

**Pourquoi non détecté plus tôt** : « TypeScript est d'accord : rendezVous et
identite sont optionnels » ; les tests existants relisaient les valeurs de
retour, cohérentes avec ce qui avait été écrit, jamais ce qui partait
réellement au stockage.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un état partagé se reconstruisait par
énumération explicite des champs conservés (`{champ1, champ2}`) au lieu d'un
étalement (`{...index, x}`), effaçant silencieusement tout champ non nommé.

**Règle proposée** : un état partagé se conserve toujours par étalement
(`{...index, x}`), jamais par énumération de champs — et tester ce qui part
réellement (ce qui est écrit au stockage), pas seulement ce que la fonction
rend en retour.

## 04/09/2026 — Un hôte qui répond ne donne pas ses octets *(lecons/2026-09-04-un-hote-qui-repond-ne-donne-pas-ses-octets.md)*

**Coût** : NON CHIFFRÉ ; contredit une mesure antérieure du 29/08 qui donnait
`youtube.com` pour refusé, alors qu'il répond `200` depuis le 04/09.

**Pourquoi non détecté plus tôt** : « un 403 et un 000 ne disent pas la même
chose, et on les confond » — la distinction entre un mur réseau et un refus
applicatif n'était pas systématiquement faite.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une conséquence fausse (« on ne peut rien
obtenir de YouTube ») était restée accrochée à une mesure juste (l'hôte était
refusé le 29/08) sans être revérifiée après un changement d'état probable.

**Règle proposée** : séparer explicitement par écrit ce qui a été sondé de ce
qu'on en a déduit — la première moitié (le sondage) se re-teste
périodiquement, la seconde (la conséquence) ne se recopie jamais sans
re-sondage.

## 04/09/2026 — Un rouge d'intégration continue est illisible depuis une session *(lecons/2026-09-04-un-rouge-de-ci-est-illisible-depuis-une-session.md)*

**Coût** : NON CHIFFRÉ.

**Pourquoi non détecté plus tôt** : NON PRÉCISÉ dans la fiche.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le journal complet d'un job GitHub Actions
ne s'obtient pas depuis une session distante (redirection Azure refusée),
empêchant de savoir lequel des tests a échoué et pourquoi, sans détour.

**Règle proposée** : faire écrire les échecs en annotations GitHub
(`::error::` avec `set -o pipefail`) dans les workflows CI — les annotations
sont lisibles depuis une session distante, pas le journal brut complet.

## 04/09/2026 — Un témoin qui diverge accuse d'abord le témoin *(lecons/2026-09-04-un-temoin-qui-diverge-accuse-dabord-le-temoin.md)*

**Coût** : écart initial de 1,7×10⁻¹ entre deux implémentations censées être
identiques (Python/navigateur) ; ramené à 0,000×10⁺⁰ après correction.

**Pourquoi non détecté plus tôt** : « le réflexe était de mettre en cause le
moteur alpha […] le moteur n'y était pour rien » — l'erreur était dans le
générateur de bruit de test du banc de comparaison lui-même.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le premier suspect naturel (le nouveau
moteur porté) a été investigué avant le banc de comparaison qui le testait,
alors que la cause réelle (dépassement de la limite entière exacte de
JavaScript) était dans ce dernier.

**Règle proposée** : quand un témoin diverge, le suspect numéro un est le
témoin lui-même (le banc de comparaison), pas le code qu'il teste ; exiger une
tolérance zéro plutôt qu'un epsilon quand une comparaison bit-à-bit est
possible, pour ne pas masquer une divergence réelle par une marge trop large.

## 04/09/2026 — Une suite qui reste verte sur une mutation ment sur ce qu'elle garde *(lecons/2026-09-04-une-suite-verte-sur-une-mutation-ment.md)*

**Coût** : sur 11 mutations de code injectées volontairement, 2 tests censés
détecter un défaut réintroduit sont restés verts malgré le défaut réel.

**Pourquoi non détecté plus tôt** : « aucun test ne regardait la requête » —
l'un testait la fonction pure au lieu de l'appelant, l'autre avait un cas ne
pouvant pas discriminer.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : personne n'avait jamais vérifié qu'un test
donné tombait effectivement en rouge quand le défaut qu'il prétend garder est
réintroduit — une mutation qui ne fait rien tomber est un résultat, pas un
échec de la mutation.

**Règle proposée** : écrire le test avant le correctif et vérifier qu'il
échoue d'abord (rouge → vert) ; quand un test de mutation ne fait tomber
aucun test malgré un défaut réintroduit, chercher le trou plutôt que de
conclure que le code est robuste.

## 04/09/2026 — YouTube ne demande pas un compte, il demande un jeton *(lecons/2026-09-04-youtube-ne-demande-pas-un-compte-mais-un-jeton.md)*

**Coût** : 7 clients `yt-dlp` sur 8 rendaient un message trompeur (« Sign in to
confirm you're not a bot ») ; facturation piège du connecteur TubeAlfred — un
crédit par vidéo malgré le mot « batch », 29 identifiants = 29 crédits.

**Pourquoi non détecté plus tôt** : « la phrase des sept [clients] est
trompeuse : elle fait chercher un compte » ; deux phrases du dépôt disaient
« adresse de centre de données refusée » — « c'est la conséquence, pas la
cause ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le 8ᵉ client (le seul à nommer la vraie
cause — un jeton PO calculé par JavaScript) n'avait pas été essayé en premier ;
sept refus trompeurs ont fait chercher du côté d'un compte inexistant.

**Règle proposée** : inutile de chercher une clé ou un compte quand le mur est
logiciel (jeton calculé), pas contractuel — trier sur les résultats de
recherche, qui portent déjà titre/durée/vues, avant de demander des fiches
facturées au crédit.

## 05/09/2026 — Aucun modèle joignable d'ici ne sait écouter *(lecons/2026-09-05-aucun-modele-joignable-dici-ne-sait-ecouter.md)*

**Coût** : quota higgsfield épuisé à « 0 credits remaining » sur 130341,
16,665 crédits par variation de bruitage.

**Pourquoi non détecté plus tôt** : « une variable présente n'est pas un
accès » ; « le solde ne se lit nulle part dans la réponse d'une génération
réussie ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : trois tentatives indépendantes de faire
« écouter » un son généré (clé Gemini invalide, nœud LLM sans port audio,
higgsfield refusant les bruitages autonomes) ont chacune été explorées à fond
avant de conclure.

**Règle proposée** : faire juger le résultat posé dans le montage final
plutôt que la matière isolée avant intégration ; compter le quota restant
avant de lancer une génération, pas après l'échec.

## 05/09/2026 — `decodeImage` lève au lieu de rendre `null`, et un registre plausible est faux *(lecons/2026-09-05-decodeimage-leve-au-lieu-de-rendre-null.md)*

**Coût** : quatre octets suffisent à déclencher l'exception ; contraste réel
2,93:1 contre un plancher requis de 7:1 pour `look_and_find`.

**Pourquoi non détecté plus tôt** : « un appelant […] croit avoir traité le cas
d'échec et ne l'a pas traité » ; « une description fausse ne se contente pas
d'être fausse, elle dispense de la vérification ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le registre des accents donnait
`look_and_find` pour un thème clair (faux depuis toujours), ce qui dispensait
quiconque de mesurer le contraste réel de son thème sombre effectif.

**Règle proposée** : une entrée du registre des accents se relit contre le
code qui la pose (ici `app.dart`), jamais contre l'idée qu'on se fait du
produit ; ne jamais poser un chiffre de contraste inventé ou recopié sans
mesure fraîche.

## 05/09/2026 — Ce moteur est une assurance, pas un moteur de performance *(lecons/2026-09-05-le-bot-est-une-assurance-pas-un-moteur.md)*

**Coût** : sur FTT (jeton mort à -99,60%), la stratégie divise la perte par 4
par rapport au témoin — un effet noyé si le jeton mort ne pèse que 5% d'un
panier de survivants.

**Pourquoi non détecté plus tôt** : les conclusions précédentes (« le DCA
aveugle gagne toujours ») étaient incomplètes car mesurées sur un échantillon
qui n'avait pas subi le scénario extrême contre lequel le dispositif de
protection existe réellement.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un banc d'essai avait été bâti sans se
demander si le scénario catastrophe (jeton qui s'effondre à zéro) était bien
représenté dans les données utilisées.

**Règle proposée** : avant de bâtir un banc d'essai pour un dispositif de
protection (stop, coupe-circuit, assurance), vérifier explicitement que le
scénario contre lequel il existe est présent dans les données du banc — un
dispositif de protection ne se juge jamais sur un échantillon qui n'a pas subi
le sinistre.

## 05/09/2026 — Sur une hausse longue, aucun timing ne bat celui qui engage le plus tôt *(lecons/2026-09-05-sur-une-hausse-longue-le-timing-ne-peut-que-perdre.md)*

**Coût** : la conclusion de la veille (mesurée avec un écart de 21% en faveur
de la stratégie) était fausse — la vraie cause de l'écart était une modulation
par zone retardant les achats, pas un avantage réel de timing.

**Pourquoi non détecté plus tôt** : « l'erreur venait d'un chiffre juste lu au
mauvais endroit : sans stop du tout, le moteur n'engage que 6 397$ […] elle
décrivait un cas extrême, pas le régime ordinaire ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un seul réglage (le stop) avait été
balayé la veille sans mesurer sa plage entière contre le témoin, laissant
une conclusion partielle passer pour définitive.

**Règle proposée** : avant de tourner un bouton de réglage, mesurer sa plage
entière contre le témoin, pas un seul point ; contre un actif jugé haussier
à long terme, traiter le timing comme une dépense probable plutôt qu'un
avantage supposé.

## 05/09/2026 — Ta propre branche de PR est un fichier partagé *(lecons/2026-09-05-ta-propre-branche-est-un-fichier-partage.md)*

**Coût** : « quinze minutes de travail, dont la partie coûteuse, étaient à
jeter » — deux sessions avaient résolu le même conflit chacune de son côté.

**Pourquoi non détecté plus tôt** : « la seconde session avait bien fait
`git fetch` en ouvrant » mais l'écart s'est allongé entre l'ouverture et le
geste coûteux, laissant le temps à une autre session de fusionner `main` dans
la même branche.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : rien ne garantissait qu'une seule session
travaille sur une branche donnée à un instant T — deux sessions ont fusionné
`main` dans la même branche à quelques minutes d'écart.

**Règle proposée** : récupérer sa propre branche (`git fetch` + merge/rebase)
juste avant le geste coûteux (résolution de conflit, push), pas seulement au
réveil de la session — ce qui est publié en premier gagne toujours.

## 05/09/2026 — Un serveur d'épreuve qui reconstitue les chemins ne prouve rien sur l'hébergement réel *(lecons/2026-09-05-un-alias-de-serveur-de-test-nest-pas-un-hebergeur.md)*

**Coût** : NON CHIFFRÉ ; l'application était en réalité servable nulle part
(404 réels en déploiement) malgré un serveur d'épreuve tout vert.

**Pourquoi non détecté plus tôt** : « le serveur d'épreuve n'est pas
l'hébergeur en petit. Il est plus capable que lui » — un fichier manquant se
chargeait par `fetch`, pas par une balise, sans erreur ni symptôme lisible
côté épreuve.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le serveur d'épreuve, via des alias
`node_modules`, résolvait des chemins que le vrai déploiement ne résout pas —
un vert d'épreuve masquait un manque d'hébergement réel.

**Règle proposée** : un test qui fabrique son propre environnement (alias,
chemins spéciaux) ne mesure pas le déploiement réel — bâtir une épreuve qui
part du tas de fichiers exact déployé et compte les 404 dessus.

## 05/09/2026 — Un aller-retour de cadre sur un plan fixe donne mal au crâne *(lecons/2026-09-05-un-aller-retour-de-cadre-sur-un-plan-fixe-donne-mal-au-crane.md)*

**Coût** : deux montages renvoyés d'affilée pour ce défaut, contre huit autres
coupes d'échelle similaires jamais signalées ailleurs.

**Pourquoi non détecté plus tôt** : « sur un plan où rien ne change, il n'y a
rien pour l'absorber : le cerveau ne lit pas une coupe, il lit un mouvement
d'appareil ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : la même transformation de cadre (zoom
avant-arrière) était appliquée indifféremment sur des plans fixes et des
plans où l'image change, sans distinction entre les deux cas.

**Règle proposée** : sur un plan fixe (image qui ne change pas), l'échelle ne
fait que croître en continu, jamais d'aller-retour, et le centre ne bouge
jamais — règle distincte de celle qui s'applique sur un plan où l'image change
réellement.

## 05/09/2026 — Un commit de fusion n'est pas coupable par défaut *(lecons/2026-09-05-un-commit-de-fusion-nest-pas-coupable-par-defaut.md)*

**Coût** : NON CHIFFRÉ ; une hypothèse fausse s'est retransmise de session en
session comme un fait établi.

**Pourquoi non détecté plus tôt** : « une explication plausible, construite
sans preuve à l'appui, se retransmet comme un fait d'une session à l'autre ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une hypothèse plausible (« la fusion a
déclenché un build Vercel iptv ») n'avait jamais été vérifiée par un diff réel
avant d'être répétée comme une certitude.

**Règle proposée** : calculer le diff réel avant d'écrire une cause, jamais
après — une hypothèse plausible non vérifiée ne se transmet pas d'une session
à l'autre comme un fait établi.

## 05/09/2026 — Un cri de synthèse passe les mesures et pas l'oreille *(lecons/2026-09-05-un-cri-de-synthese-passe-les-mesures-et-pas-loreille.md)*

**Coût** : « les trois quarts du travail passé dessus » en rattrapages
inutiles ; écart de 66 points entre quatre tentatives sur la part d'énergie
sous 400Hz (82,9% à 40,9%).

**Pourquoi non détecté plus tôt** : « toutes vertes […] et aucune mesure ne
voit » le mélange de deux fondamentales sans rapport ni le manque de matière
d'une synthèse par formants.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une seule variation était générée et jugée
à chaque essai, rendant le choix non comparatif et la mesure aveugle à ce
qu'elle ne savait pas chercher.

**Règle proposée** : générer plusieurs variations d'un son synthétique rend le
choix mesurable par comparaison directe — la mesure seule ne dit jamais ce qui
raconte la bonne chose, l'écoute comparative tranche là où elle ne le peut
pas.

## 05/09/2026 — Un décodage mono annonce une crête que le fichier n'a pas *(lecons/2026-09-05-un-decodage-mono-annonce-une-crete-que-le-fichier-na-pas.md)*

**Coût** : crête annoncée +2,48dBFS (écrêtage) contre -0,50dBFS réel — écart de
3dB ayant conduit à une réduction de mixage erronée de 1dB.

**Pourquoi non détecté plus tôt** : « un décodeur AAC rend des valeurs
flottantes qui dépassent le plein échelle entre les échantillons — le fichier
est conforme, la reconstruction déborde ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le contrôle d'écrêtage se faisait sur un
décodage de travail intermédiaire (mono), pas sur le flux livré final.

**Règle proposée** : le contrôle d'écrêtage se fait toujours sur le flux
livré (`ebur128=peak=true`), jamais sur un décodage de travail intermédiaire
qui peut introduire ses propres artefacts de reconstruction.

## 05/09/2026 — Un outil de mesure vieillit quand le corpus change de nature *(lecons/2026-09-05-un-outil-de-mesure-vieillit-quand-le-corpus-change-de-nature.md)*

**Coût** : un chiffre faux d'un facteur dix rapporté au propriétaire (3/40 sans
la tête acoustique contre 31/40 avec), risquant de peser sur une décision de
mise en ligne.

**Pourquoi non détecté plus tôt** : « l'outil n'était pas faux quand il a été
écrit […] le défaut naît le jour où le corpus change de nature » — « le
symptôme est traître parce qu'il est plausible ».

**Déviation de priorité** : oui — un chiffre potentiellement décisif pour une
mise en ligne a été rapporté sans que l'outil de mesure ait été revérifié
contre le nouveau corpus utilisé.

**Ce qui a permis que ça traîne** : l'outil de mesure appelait un juge écrit
pour un ancien corpus (ESC-50, sans étiquettes) sur un nouveau corpus étiqueté,
sans que personne ne revérifie sa pertinence au changement de nature des
données.

**Règle proposée** : un outil de mesure se juge sur le corpus pour lequel il a
été écrit, et se relit explicitement — pas seulement se relance — à chaque
fois que le corpus qu'il mesure change de nature.

## 05/09/2026 — Un plan unique se coupe dans l'échelle, pas dans le temps *(lecons/2026-09-05-un-plan-unique-se-coupe-dans-l-echelle-pas-dans-le-temps.md)*

**Coût** : NON CHIFFRÉ ; trou de son de 0,97s à -37,4dB contre -20dB de
voisinage (20dB d'écart) dans une première tentative corrigée.

**Pourquoi non détecté plus tôt** : NON PRÉCISÉ — hypothèse a priori corrigée
par expérimentation directe.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une hypothèse de départ (couper dans le
temps un rush continu pour créer du rythme) aurait désynchronisé les lèvres et
cassé la construction sonore, non anticipée avant l'essai.

**Règle proposée** : sur un plan unique et continu, changer de cadre sans
changer d'instant — les coupes suivent les instants réels du rush, jamais une
grille temporelle régulière imposée a priori.

## 05/09/2026 — Un rejeu multi-actifs écarte en silence ce qui n'est pas dans l'allocation *(lecons/2026-09-05-un-rejeu-multi-ecarte-en-silence.md)*

**Coût** : « quatre fichiers passés, trois mesurés, aucun message » — un
tableau plausible produit pour un autre panier que celui réellement demandé.

**Pourquoi non détecté plus tôt** : « il ne ressemble pas à un défaut, il
ressemble à un résultat » — le cas où rien ne reste lève une exception, le cas
partiel non.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : `rejeu --multi` filtre silencieusement les
symboles absents de l'allocation demandée, sans jamais le signaler.

**Règle proposée** : une fonction qui filtre une partie de son entrée doit
toujours dire explicitement ce qu'elle a retiré ; l'intitulé de la sortie
nomme ce qui a réellement été mesuré, pas ce qui avait été demandé au départ.

## 05/09/2026 — Un seuil absolu ment sur les petites valeurs, et ses tests ne le voient pas *(lecons/2026-09-05-un-seuil-absolu-ment-sur-les-petites-valeurs.md)*

**Coût** : une poche visée à 1 100€ tolérée jusqu'à 10 780€ sans alerte (11×
l'écart) — un seuil de tolérance en points absolus (5pts) sur des cibles
variant de 0,5% à 95%.

**Pourquoi non détecté plus tôt** : « ce qu'aucun test ne pouvait attraper […]
les tests éprouvent le calcul, qui est exact ; le défaut est dans l'unité du
seuil, pas dans l'arithmétique ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un seuil de tolérance absolu était appliqué
à une grandeur variant sur plusieurs ordres de grandeur (de 0,5% à 95%),
sans que la disproportion résultante ne soit jamais mesurée.

**Règle proposée** : un seuil de tolérance sur une grandeur variant sur
plusieurs ordres de grandeur (allocation patrimoniale, pourcentages faibles à
élevés) doit être relatif à la cible, avec un plancher absolu séparé pour les
très petites valeurs — jamais un seul chiffre absolu appliqué uniformément.

## 05/09/2026 — Une étape « ignorée » se résout depuis le dossier racine du projet, pas du dépôt *(lecons/2026-09-05-une-etape-ignoree-se-resout-depuis-le-dossier-racine-du-projet.md)*

**Coût** : NON CHIFFRÉ ; le projet Vercel `chat-traducteur` échouait sur
**toutes** les PR sans qu'aucune ne le cause réellement.

**Pourquoi non détecté plus tôt** : « l'hypothèse évidente […] est fausse
ici » ; trois observations de statut disaient « échec » sans dire par quoi —
la commande d'étape ignorée pointait vers un chemin valable seulement pour le
projet racine `amorce`.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une commande d'étape ignorée (`ignoreCommand`
Vercel) avait été copiée d'un projet à racine différente sans adapter le
chemin qu'elle référence.

**Règle proposée** : une commande d'étape ignorée est une propriété du
**projet** (et de sa racine réelle), pas du dépôt entier — elle ne se copie
jamais telle quelle d'un `vercel.json` à un autre sans vérifier la racine
effective de chacun.

## 05/09/2026 — Une rampe de creux posée sur la coupe ne baisse rien *(lecons/2026-09-05-une-rampe-de-creux-posee-sur-la-coupe-ne-baisse-rien.md)*

**Coût** : cinq essais de réglage, dont trois sur le mauvais objet ; crête du
mixage sous le creux mesurée dix fois trop haute (0,812 au lieu de 0,082
attendu).

**Pourquoi non détecté plus tôt** : NON PRÉCISÉ explicitement — description du
symptôme seule dans la fiche.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : la rampe d'atténuation du mixage était
posée sur la coupe elle-même au lieu d'être posée avant, sans que les cinq
essais successifs ne ciblent d'abord le bon objet à corriger.

**Règle proposée** : calculer séparément les deux bornes en jeu (le niveau
cible demandé, la crête permise), prendre la plus contraignante des deux et
écrire explicitement laquelle a mordu dans le résultat final.

## 05/09/2026 — Une suite de tests qui grossit peut avoir perdu des tests *(lecons/2026-09-05-une-suite-qui-grossit-peut-avoir-perdu-des-tests.md)*

**Coût** : le défaut a vécu quinze minutes et trois exécutions vertes avant
d'être vu ; 5 tests effacés par un écrasement de fichier (`cat >` sur un
fichier de même nom que la veille).

**Pourquoi non détecté plus tôt** : « une suppression de tests ne se voit pas
dans un compteur qui augmente, tant qu'on ajoute plus qu'on ne détruit » — le
compteur global montait malgré la perte.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : rien ne comparait le nombre de tests
attendu (calculé à l'avance) au nombre réellement exécuté après chaque
modification de la suite.

**Règle proposée** : calculer le nombre de tests attendu d'une suite avant de
la lancer et le comparer au compte rendu réel après exécution ; vérifier
qu'un nom de fichier de test n'est pas déjà pris (`test -e`) avant de
l'écrire, pour ne jamais écraser silencieusement une suite existante.

## 06/09/2026 — La messagerie entre sessions marche, mais seulement sur une cible connectée *(lecons/2026-09-06-la-messagerie-entre-sessions-marche-sur-une-cible-connectee.md)*

**Coût** : NON CHIFFRÉ — précision qui corrige l'affirmation catégorique du
29/08/2026 (voir plus haut) après plusieurs jours d'hypothèse trop large.

**Pourquoi non détecté plus tôt** : « un échec de messagerie ne dit pas si
c'est le mécanisme ou la cible qui est en cause, il faut lire
`connection_status` » — la distinction n'avait pas été faite lors du premier
essai fin août.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : la règle « aucun canal n'existe » posée le
29/08 n'avait jamais été retestée contre une cible réellement connectée avant
cette date.

**Règle proposée** : déjà couverte — c'est la règle actuelle du §7/§10 bis
(« essayer coûte un appel, conclure sans essayer coûte une fausse
certitude »). Exclu du §3.

## 06/09/2026 — Le document de découverte d'une API Google répond sans clé, et il tranche *(lecons/2026-09-06-le-document-de-decouverte-repond-sans-cle.md)*

**Coût** : « deux minutes ont suffi » une fois la bonne méthode trouvée — contre
une recherche web non concluante auparavant sur un appel Gemini rendant un 400
inexplicable.

**Pourquoi non détecté plus tôt** : NON PRÉCISÉ au-delà de « les causes
documentées de 400 sur Gemini sont nombreuses et contradictoires ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : la documentation officielle complète était
hors d'atteinte, et personne n'avait pensé à interroger le document de
découverte de l'API lui-même (accessible sans clé) avant de chercher sur le
web.

**Règle proposée** : quand la documentation officielle d'une API Google est
hors d'atteinte, interroger d'abord son document de découverte
(`<service>.googleapis.com/$discovery/rest`, accessible sans clé) — souvent
plus rapide et plus fiable qu'une recherche web.

## 06/09/2026 — Le jeu de démonstration fixe un plancher, et ce plancher cache des défauts en dessous *(lecons/2026-09-06-le-jeu-de-demonstration-fixe-un-plancher.md)*

**Coût** : NON CHIFFRÉ ; neuf compteurs d'interface et cinq messages CLI
d'`iptv` écrivaient un pluriel en dur (« 1 séries ») jamais vu.

**Pourquoi non détecté plus tôt** : « `verifier.sh` est passé au vert avant et
après, tests, types et construction compris […] il n'existe qu'à l'écran, et
seulement sous un seuil que le décor n'atteint pas » — ni la démo (6 entrées)
ni la production (120 000) ne passent jamais par la valeur exacte 1.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le jeu de démonstration (6 entrées) et la
production (120 000 entrées) encadraient tous deux la valeur singulière
problématique sans jamais la traverser.

**Règle proposée** : pour tout compteur affiché à l'utilisateur, regarder
explicitement son affichage à zéro, à un, et à beaucoup — un jeu de
démonstration fixe un plancher, et rien en dessous de ce plancher n'est jamais
naturellement exercé par les tests existants.

## 06/09/2026 — `pkill -f` tue le shell qui l'appelle *(lecons/2026-09-06-pkill-tue-le-shell-qui-lappelle.md)*

**Coût** : NON CHIFFRÉ ; diagnostic retardé car le symptôme (code 143) ne
désignait pas la vraie victime.

**Pourquoi non détecté plus tôt** : « le symptôme ment sur sa victime […] on
part lire son journal — qui est vide et normal, puisque c'est le shell qui est
mort ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : `pkill -f "next dev"` matche aussi la
ligne de commande du shell appelant lui-même (`bash -c "..."`), qui contient le
motif recherché — une auto-correspondance non anticipée.

**Règle proposée** : briser l'auto-correspondance d'un `pkill -f` par une
classe de caractères (`n[e]xt dev`), ou garder le PID exact du processus visé
et utiliser un `trap EXIT` plutôt qu'un `pkill` sur motif.

## 06/09/2026 — Une suite rouge en session n'est pas rouge en CI *(lecons/2026-09-06-suite-rouge-en-session-nest-pas-rouge-en-ci.md)*

**Coût** : « deux affirmations fausses […] plus une tâche ouverte pour
'réparer' un test qui n'était pas cassé » — annoncé à tort au propriétaire et
sur une PR.

**Pourquoi non détecté plus tôt** : « avoir pris le résultat local pour la
vérité […] un rouge a l'air d'un fait dur qu'on n'ose pas contredire ».

**Déviation de priorité** : une PR a été annoncée bloquée à tort, consommant du
temps de diagnostic sur un problème qui n'existait pas en réalité.

**Ce qui a permis que ça traîne** : un test échouant uniquement dans le
conteneur de session (mauvaise résolution de dépendances locale) a été pris
pour un échec réel de CI sans vérifier les check-runs GitHub réels.

**Règle proposée** : avant d'annoncer un blocage CI, lire les check-runs
réels du head de la PR (autorité unique), jamais se fier au résultat d'une
exécution locale dans la session — les deux environnements peuvent diverger.

## 06/09/2026 — Un port qui accepte une connexion n'est pas une page qui répond *(lecons/2026-09-06-un-port-qui-accepte-nest-pas-une-page-qui-repond.md)*

**Coût** : cache froid — port accepté en 0,659s, page compilée réellement
disponible seulement à 3,451s (2,8s d'écart, 5,2× plus long qu'en cache
chaud).

**Pourquoi non détecté plus tôt** : « le défaut ne se voit jamais depuis la
machine qui héberge, où l'on met plus de trois secondes à changer de fenêtre »
— un délai humain naturel masquait le problème lors des tests manuels.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un script annonçait l'adresse dès le
lancement du processus serveur, avant que la première page ne soit réellement
compilée et servable.

**Règle proposée** : attendre une vraie réponse HTTP en boucle (`curl -sf`
répété) avant d'annoncer un serveur prêt, jamais seulement la confirmation
qu'un processus a démarré ou un délai fixe arbitraire.

## 06/09/2026 — Un taux lu sur une page de présentation n'est pas celui du contrat réel *(lecons/2026-09-06-un-taux-lu-sur-une-page-nest-pas-celui-du-contrat.md)*

**Coût** : 30% de commission annoncés (page publique) contre 25% réels
(courriel d'acceptation, première année) — écart toujours défavorable au
dépôt.

**Pourquoi non détecté plus tôt** : « la colonne portait la mention 'Taux lu',
qui avait l'air d'une vérification […] une note d'honnêteté relue comme une
garantie ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : une mention destinée à signaler la source
d'une information (« lu sur telle page ») a été interprétée par la suite comme
une garantie de fiabilité, sans que personne ne revérifie contre le contrat
réel.

**Règle proposée** : une condition commerciale (taux, commission) ne se note
qu'accompagnée de sa source exacte — une page publique vaut une estimation,
seul un courriel d'acceptation ou un tableau de bord de compte vaut ce qui
sera réellement payé.

## 06/09/2026 — Un correctif fusionné n'atteint pas la production d'un service jamais réellement déployé *(lecons/2026-09-06-un-worker-cloudflare-non-deploye-na-pas-de-base.md)*

**Coût** : « un aller-retour » (qualitatif) ; un geste de production urgent a
été annoncé à tort au propriétaire.

**Pourquoi non détecté plus tôt** : « un `schema.sql` et un `wrangler.toml`
commités décrivent une intention, pas un service qui tourne » — le README le
disait déjà, mais n'avait pas été vérifié avant l'annonce.

**Déviation de priorité** : un geste présenté comme urgent (« avant que le
worker ne serve du trafic ») portait sur un service dont la base D1 n'existait
même pas (`database_id` resté au placeholder).

**Ce qui a permis que ça traîne** : `comptes-serveur` a été traité comme
déployé sur la seule foi de fichiers commités (schéma, config), sans vérifier
l'état réel du déploiement.

**Règle proposée** : avant d'annoncer un geste de production urgent, vérifier
que le service concerné est réellement déployé (`wrangler d1 list`,
`database_id` non placeholder) — des fichiers commités décrivent une
intention, jamais un service qui tourne.

## 06/09/2026 — Une correction fusionnée n'est pas une correction en ligne *(lecons/2026-09-06-une-correction-fusionnee-nest-pas-une-correction-en-ligne.md)*

**Coût** : « trois jours durant, elle servait toujours la version du 3
septembre » ; douze SMS de prospection s'apprêtaient à partir vers cette
adresse pendant cette fenêtre.

**Pourquoi non détecté plus tôt** : « CLAUDE.md le dit déjà en propres termes —
ce qui manquait n'était pas l'information, c'était le réflexe de la relier à
un geste quotidien ».

**Déviation de priorité** : oui — une correction de tarif fusionnée sur `main`
n'avait pas atteint la page réellement servie, juste avant une campagne de
prospection ciblant précisément cette page.

**Ce qui a permis que ça traîne** : le projet Vercel de la page (dépôt de
fichiers, pas lien Git) ne se met pas à jour automatiquement sur fusion, et
rien ne vérifiait le contenu réellement servi avant l'envoi de la campagne.

**Règle proposée** : avant d'annoncer une correction comme faite et
opérationnelle, vérifier par une requête HTTP réelle sur l'adresse publique
exacte (`curl` + `grep`) que le contenu servi correspond à la dernière
fusion — pas seulement relire le code source.

## 08/09/2026 — Deux points de sonde ne mesurent pas un écart entre deux seuils *(lecons/2026-09-08-deux-points-de-sonde-ne-mesurent-pas-un-ecart-de-seuil.md)*

**Coût** : NON CHIFFRÉ ; un test de non-régression est resté vert à tort dans
deux versions successives du code.

**Pourquoi non détecté plus tôt** : « deux littéraux égaux sont égaux. Sonder à
3,5 puis à 4,0 encadre les deux seuils de la même façon » — les deux points de
sonde choisis ne tombaient jamais dans l'intervalle où le désaccord existait
réellement (entre 3,5 et 3,8).

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : un test censé garder deux modules
synchronisés ne balayait que deux points fixes au lieu de couvrir tout
l'intervalle pertinent.

**Règle proposée** : un test de non-régression sur un seuil numérique balaie
l'intervalle avec un pas fin plutôt que deux points isolés ; casser le code
exprès une fois pour juger qu'un test réagit correctement avant de lui faire
confiance.

## 08/09/2026 — `get_status` ne montre jamais les contrôles qui comptent réellement *(lecons/2026-09-08-get-status-ne-montre-jamais-les-controles-qui-comptent.md)*

**Coût** : PR #802 fusionnée sur un « tout vert » incomplet ; sur une PR
précédente, deux rouges (Cohérence du dépôt, Tests Python) restaient invisibles
derrière un état `success` global.

**Pourquoi non détecté plus tôt** : « GitHub a deux canaux distincts, et
l'outil n'en lit qu'un » — `get_status` ne lit que le canal des commit
statuses (Vercel), jamais les check runs GitHub Actions.

**Déviation de priorité** : une PR a été fusionnée en croyant tous les
contrôles verts, alors que deux contrôles décisifs n'étaient simplement pas
lus par l'outil utilisé.

**Ce qui a permis que ça traîne** : la règle du dépôt sur les rouges Vercel
(« un rouge Vercel n'est pas un signal ») « apprend à traiter la liste comme
complète » — une habitude correcte pour un cas a été généralisée à tort à
l'outil de lecture de statut entier.

**Règle proposée** : avant de fusionner, lire les check runs complets
(`list_workflow_runs` ou équivalent), jamais seulement `get_status` — les deux
canaux de GitHub (commit statuses et check runs) doivent être lus ensemble,
aucun des deux seul ne suffit.

## 08/09/2026 — Kling répond, Meta non, et le « plan gratuit » annoncé n'existe pas *(lecons/2026-09-08-kling-repond-meta-non-et-le-gratuit-nexiste-pas.md)*

**Coût** : réalité tarifaire — 5s de vidéo avec audio à 0,70$, un film de six
plans à environ 4,20$, soit 35 à 70× le prix d'une image — contre un « plan
gratuit » de 60 crédits/jour annoncé dans le brief initial.

**Pourquoi non détecté plus tôt** : « un brief qui cite sa propre source ne
l'a pas forcément lue […] son auteur a écrit le guide, puis généré six clips
sans l'appliquer ».

**Déviation de priorité** : un modèle économique gratuit a été annoncé et
potentiellement planifié en amont, contredit par la source citée par le brief
lui-même.

**Ce qui a permis que ça traîne** : personne n'avait relu la source citée par
le brief avant de l'accepter comme vraie — la citation d'une source n'implique
pas qu'elle a été vérifiée.

**Règle proposée** : quand un brief cite sa propre source de tarification,
cloner ou consulter cette source directement (`credit|free|pricing` dedans)
avant d'accepter le modèle économique qu'il décrit — une citation n'est pas
une vérification.

## 08/09/2026 — La recherche GitHub est fermée à une session, la lecture d'un dépôt public ne l'est pas *(lecons/2026-09-08-la-recherche-github-est-fermee-mais-pas-la-lecture.md)*

**Coût** : NON CHIFFRÉ — near-miss : la conclusion fausse potentielle n'a
finalement pas été tirée.

**Pourquoi non détecté plus tôt** : sans objet — la fiche documente une
distinction correctement établie avant qu'elle ne cause un vrai coût.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : « une session qui reçoit le refus de la
recherche en conclut naturellement qu'elle ne peut pas atteindre un dépôt
tiers […] c'est un refus d'outil, pas une limite du monde ».

**Règle proposée** : un refus de l'outil de **recherche** GitHub ne dit rien
de la capacité de **lecture** d'un dépôt public déjà identifié — on ne peut
pas chercher un dépôt inconnu par mot-clé, mais on peut lire n'importe lequel
dont on connaît déjà le chemin (`add_repo` + `git clone`).

## 08/09/2026 — La surface de MiniMax se lit sans joindre MiniMax *(lecons/2026-09-08-la-surface-de-minimax-se-lit-sans-joindre-minimax.md)*

**Coût** : « cinq hôtes de l'éditeur […] `000` sur les cinq » ; le brief V3
décrivait en réalité les routes API de Kling, pas de MiniMax — ce qui aurait
produit du code rendant systématiquement 404.

**Pourquoi non détecté plus tôt** : « un brief décrit une intention, jamais une
API — et l'écart ne se voit qu'en lisant la surface réelle ».

**Déviation de priorité** : un fournisseur (MiniMax) avait déjà été choisi et
un plafond de dépense fixé avant que la surface de son API réelle ne soit
lue — voir aussi l'entrée « MiniMax injoignable » du §8 de `CLAUDE.md`, sur le
même sujet.

**Ce qui a permis que ça traîne** : le brief citait des routes qui étaient en
réalité celles d'un fournisseur différent (Kling), sans que personne ne
compare le brief à la documentation du SDK officiel avant d'écrire du code
contre lui.

**Règle proposée** : télécharger le paquet officiel du fournisseur
(`pip download --no-deps` ou équivalent) pour lire sa surface d'API réelle
sans l'installer ni joindre son serveur — un brief décrit une intention,
jamais une API, et l'écart entre les deux ne se voit qu'en lisant le code
source du SDK.

## 08/09/2026 — Le compte Vercel n'est plus gratuit, et le plafond de cent déploiements est parti avec *(lecons/2026-09-08-le-compte-vercel-nest-plus-gratuit-et-le-plafond-de-cent-avec.md)*

**Coût** : NON CHIFFRÉ directement, mais tout le calcul de seuil de
fusions/jour écrit dans `CLAUDE.md` en dépendait et a dû être requalifié.

**Pourquoi non détecté plus tôt** : « le relevé des projets était refait
consciencieusement […] et il regardait la mauvaise colonne […] le champ qui
avait bougé […] était dans l'appel d'à côté […] dont on jette la réponse ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : l'information décisive (changement de
palier de compte) vivait dans un champ de retour habituellement ignoré
(`list_teams`), jamais relu par la routine de surveillance existante.

**Règle proposée** : une valeur servant de base à un calcul écrit dans le
dépôt (ici le seuil de fusions/jour) se relit systématiquement avec **tous**
les champs pertinents de la source qui la détermine, pas seulement ceux qui
ont historiquement changé.

## 08/09/2026 — Le mandataire filtre par outil, pas par hôte — et ça débloque la capture d'écran de production *(lecons/2026-09-08-le-mandataire-filtre-par-outil-pas-par-hote.md)*

**Coût** : NON CHIFFRÉ, mais « deux questions confiées au propriétaire depuis
des jours » ont été tranchées en trois appels une fois la bonne méthode
trouvée.

**Pourquoi non détecté plus tôt** : « l'hôte n'est pas refusé. C'est le client
qui décide » — `curl` rend 200 pendant que Chromium rend
`ERR_CONNECTION_RESET` sur la même adresse, au même moment.

**Déviation de priorité** : des jours ont été passés à considérer un hôte
comme fermé alors qu'un seul client (`curl`) y avait déjà accès.

**Ce qui a permis que ça traîne** : un seul client (fetch Node ou Chromium)
avait été essayé par le passé pour juger un hôte « refusé » — personne n'avait
comparé les trois clients disponibles sur la même adresse au même moment.

**Règle proposée** : toute mesure « hôte refusé / `000` » écrite dans
`CLAUDE.md` précise désormais avec quel client elle a été obtenue (`curl` /
`fetch` Node / Chromium) — un mur mesuré avec un seul client n'est qu'une
mesure partielle, jamais une propriété de l'hôte lui-même.

## 08/09/2026 — Un en-tête de sécurité vide son propre aperçu, et rien ne le dit *(lecons/2026-09-08-un-en-tete-de-securite-vide-son-propre-apercu.md)*

**Coût** : sept aperçus en `iframe` vides alors que lint, typecheck, 73 tests
et build étaient tous verts.

**Pourquoi non détecté plus tôt** : « la panne est silencieuse côté serveur et
visible seulement à l'œil. Aucun 4xx, aucune trace, aucune exception » ; « un
test d'intégration ne l'aurait pas vu davantage ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : `X-Frame-Options: DENY` était posé sur
tout le site, y compris pour lui-même (auto-blocage), avec en plus un piège
d'ordre des règles Next.js qui a fait persister le défaut malgré une première
correction.

**Règle proposée** : vérifier les en-têtes réellement rendus par une requête
directe (`curl`), jamais seulement la configuration source qui les déclare ;
une règle générale de sécurité doit explicitement exclure son propre cas
particulier quand elle est censée s'appliquer différemment à lui.

## 08/09/2026 — Un hôte refusé au mandataire se regarde depuis le bac à sable d'un connecteur MCP *(lecons/2026-09-08-un-hote-refuse-au-mandataire-se-regarde-depuis-un-bac-a-sable.md)*

**Coût** : NON CHIFFRÉ — near-miss corrigé avant de devenir un vrai coût.

**Pourquoi non détecté plus tôt** : sans objet — la fiche documente une
déduction correcte, dans la continuité de la leçon plus générale de §7 sur les
connecteurs MCP.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : « une impossibilité mesurée ne rend vrai
que ce qu'elle mesure. Le mandataire de la session refuse l'hôte ; il ne
refuse pas qu'on regarde la page. »

**Règle proposée** : trois voies existent pour regarder une page inaccessible
au mandataire de la session — le navigateur du propriétaire, un runner
GitHub, ou le bac à sable d'un connecteur MCP disposant de son propre accès
réseau (déjà écrit en substance en §10 bis pour Vercel ; à généraliser
explicitement à tout hôte refusé, pas seulement `*.vercel.app`).

## 08/09/2026 — Un jeton qui s'effondre sort du comptage, celui qui tient y reste *(lecons/2026-09-08-un-jeton-qui-seffondre-sort-du-comptage.md)*

**Coût** : au tour 18, sur 33 lignes du tableau, 17 jugeables, 3 trop tôt, 13
indécidables — dont 37 rejets pour liquidité contre 1 seul pour « déjà parti ».

**Pourquoi non détecté plus tôt** : « un jeton qui s'effondre […] se fige en
indécidable sans jamais compter comme une perte » ; « aucun [des quatre refus
documentés] ne couvre celui-ci ».

**Déviation de priorité** : aucune signalée, mais le biais structurel gonflait
silencieusement la crédibilité perçue du taux de réussite du radar.

**Ce qui a permis que ça traîne** : quand la condition d'entrée dans une
mesure est la survie de ce qu'on mesure, la mesure ne peut que flatter — rien
ne comptait ce qui sortait en silence.

**Règle proposée** : compter explicitement, dans tout bulletin comparatif
fondé sur une re-mesure conditionnelle à la survie du sujet, ce qui est sorti
silencieusement (colonne « indécidable » ou équivalente) — et afficher
clairement quand une « Note » est un maximum historique et non la note du
jour.

## 08/09/2026 — Une autorisation dans un navigateur ne se délègue à aucune session *(lecons/2026-09-08-une-autorisation-dans-un-navigateur-ne-se-delegue-pas.md)*

**Coût** : trois messages dépensés à expliquer en prose pourquoi une session
distante ne peut pas lancer `/install-github-app` « sur le laptop », avant
qu'une mesure directe (une seule commande) ne règle la question.

**Pourquoi non détecté plus tôt** : NON PRÉCISÉ — le blocage matériel
lui-même était réel (une micro-VM sans navigateur installé) ; c'est la méthode
(explication répétée) qui a coûté, pas le blocage.

**Déviation de priorité** : le propriétaire a demandé trois fois la même chose
avant d'obtenir une réponse mesurée plutôt qu'expliquée.

**Ce qui a permis que ça traîne** : la première réaction a été d'expliquer en
prose pourquoi c'était impossible, plutôt que de mesurer directement
(`hostname`, `whoami`, `DISPLAY`, `which firefox`) et de montrer le résultat.

**Règle proposée** : face à une demande impliquant un geste qui pourrait
exiger un navigateur ou une interface graphique, mesurer et montrer
(`hostname`, `DISPLAY`, `which firefox`) plutôt qu'expliquer en prose — et
découper la tâche pour ne rendre au propriétaire que le geste précis qui exige
réellement un navigateur.

## 08/09/2026 — Une frontière se mesure sur ce qui la traverse, pas sur les mots du code qui la garde *(lecons/2026-09-08-une-frontiere-se-mesure-sur-ce-qui-monte-pas-sur-les-mots-du-source.md)*

**Coût** : NON CHIFFRÉ ; un premier test censé garantir qu'aucun média ne
monte vers MiniMax échouait à tort.

**Pourquoi non détecté plus tôt** : « le mot est du côté de la descente, pas de
la montée » — un `grep` sur des mots-clés mesure le style d'écriture du code,
pas ce qui traverse réellement la frontière réseau.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le test de frontière était construit sur
un `grep` de mots-clés (« image », « fichier », « octets ») dans le code
source, plutôt que sur le contenu réel de la requête envoyée.

**Règle proposée** : une frontière (aucun média ne doit sortir, par exemple) se
mesure toujours sur ce qui la traverse réellement — relire le corps réel de la
requête envoyée et n'y accepter qu'une liste explicite de clés autorisées —
jamais sur le vocabulaire du code qui prétend la garder.

## 08/09/2026 — Une suite verte chez son auteur que le lanceur du dépôt ne sait pas lancer *(lecons/2026-09-08-une-suite-que-le-lanceur-du-depot-ne-sait-pas-lancer.md)*

**Coût** : 90 tests passent avec `-t`, 6 erreurs sans `-t` — un lanceur CI
commun à « douze autres projets Python » sans que personne ne le demande
explicitement pour chacun.

**Pourquoi non détecté plus tôt** : « 'mes tests passent' n'est pas une
propriété de la suite : c'est une propriété du couple suite + invocation » ;
« une épingle écrite et non honorée, parce que quiconque ouvre le fichier
conclut que le sujet est traité ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : le workflow CI lançait chaque suite via
`unittest discover -s <dossier>` sans l'option `-t`, un détail d'invocation
jamais vérifié contre chaque projet réel — et une épingle de version déjà
écrite (`OpenCV <5`) n'était simplement pas honorée par l'environnement CI
réel.

**Règle proposée** : vérifier qu'un projet passe avec la commande **exacte**
du dépôt (celle que la CI utilise réellement), jamais une commande tapée à la
main localement ; vérifier une épingle de version sur la version réellement
installée dans l'environnement CI, pas seulement sur le fichier qui la
déclare.

## 08/09/2026 — Une suite qui ne collecte pas cache ce qu'elle aurait mesuré *(lecons/2026-09-08-une-suite-qui-ne-collecte-pas-cache-ce-quelle-aurait-mesure.md)*

**Coût** : une seconde panne distincte (module `pypdf` manquant) restait
totalement masquée par une première panne de collecte, sans laisser de trace ;
un correctif appliqué trop largement a ensuite fait tomber 13 suites sur 14.

**Pourquoi non détecté plus tôt** : « une erreur de collecte n'est pas un
échec de plus, c'est un aveuglement […] on ne sait rien du tout » ; « deux
fois dans la même heure, une mesure locale a désigné la mauvaise cause ».

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : les tests n'étaient jamais collectés
avant la première erreur rencontrée — toute panne suivante restait
invisible tant que la première n'était pas résolue, et le premier correctif a
été jugé sur « c'est vert » plutôt que sur le nombre réel de tests qui
s'exécutaient.

**Règle proposée** : un correctif touchant la collecte de tests se juge sur le
**nombre de tests qui s'exécutent réellement** après coup, jamais sur le seul
fait que la commande rende un code de sortie vert ; lire les annotations
GitHub avant de tenter de reproduire une panne CI localement.

## 08/09/2026 — Une table vide à dessein rend intestable tout ce qu'elle garde *(lecons/2026-09-08-une-table-vide-a-dessein-rend-intestable-tout-ce-quelle-garde.md)*

**Coût** : zéro test couvrant la branche « plafond dépassé » d'un garde-fou
financier protégeant 20$/mois, avant correction ; sept tests après.

**Pourquoi non détecté plus tôt** : « aucun test n'aurait pu l'atteindre. Ce
n'était pas un oubli de couverture, c'était une impossibilité posée par la
constante elle-même » ; « un provisoire […] masque les tests de tout ce qui
vient après lui ».

**Déviation de priorité** : un garde-fou censé protéger une dépense réelle de
20$/mois n'était couvert par aucun test, sans que cela ne soit jamais
signalé comme une lacune critique.

**Ce qui a permis que ça traîne** : la grille `TARIFS` de `generation-serveur`
était vide à dessein (hôtes MiniMax injoignables), rendant la branche
« plafond dépassé » du garde-fou totalement inatteignable par construction,
dans un fichier qui se lisait par ailleurs comme entièrement testé.

**Règle proposée** : rendre toute table de données vide à dessein (en attente
d'une source externe injoignable) injectable par un paramètre par défaut, pour
pouvoir éprouver les garde-fous qui en dépendent malgré la table vide — sur le
modèle déjà appliqué par `comptes-serveur` avec `PACKS`.

## Fenêtre courante (10/09/2026) — Push direct sur `main` sans passer par une PR

**Coût** : NON CHIFFRÉ (un seul fichier doc, `inbox/le-coffre.md`), mais
processus Orange du §5 violé sans confirmation rapide obtenue.

**Pourquoi non détecté plus tôt** : la session a jugé le contenu « faible
risque » (texte, aucune zone sensible) et en a déduit à tort que le
*processus* (branche + PR) pouvait être sauté — confusion entre le risque du
contenu et la règle de méthode, qui sont indépendants.

**Déviation de priorité** : oui, auto-signalée par la session elle-même dès
qu'elle l'a repéré.

**Ce qui a permis que ça traîne** : rien ne rappelle, au moment d'un
`git push origin main`, que le §5 exige une confirmation rapide même pour un
contenu jugé anodin — aucun garde-fou technique, seulement une règle écrite
que la session a mal appliquée.

**Règle proposée** : ajouter au §5 : « faible risque de contenu » n'exempte
jamais de la confirmation Orange pour un push direct sur `main` — le risque du
contenu et le respect du processus sont deux jugements indépendants, et le
second ne se déduit jamais du premier.

## Fenêtre courante (10/09/2026) — Une valeur de contraste recopiée d'un paragraphe périmé au lieu d'être mesurée

**Coût** : NON CHIFFRÉ — corrigé avant publication (near-miss), donc coût réel
nul, mais la cause vaut d'être notée pour ne pas se reproduire sans filet.

**Pourquoi non détecté plus tôt** : sans objet — détecté par vérification
volontaire avant fusion, via un script de mesure écrit spécifiquement pour
confronter le chiffre au code réel.

**Déviation de priorité** : aucune.

**Ce qui a permis que ça traîne** : rien n'a traîné — mais le réflexe fautif
(recopier une valeur ancienne présente dans le paragraphe même qu'on corrige,
« 8,1:1 » lié à un ancien candidat `#22d3ee`, plutôt que mesurer le code
actuel) a bien eu lieu avant d'être rattrapé.

**Règle proposée** : quand une correction de `CLAUDE.md` porte sur un chiffre
mesuré (contraste, coût, temps), ne jamais réutiliser un chiffre déjà présent
dans le paragraphe à corriger sans le premesurer soi-même contre le code
actuel — un paragraphe qu'on corrige contient souvent précisément la valeur
périmée qu'on cherche à remplacer.

---

## Ce qui ressort, une fois la liste posée bout à bout

Trois motifs reviennent bien plus souvent que les autres — pas comme
statistique précise, mais comme constat qualitatif après lecture des 89
entrées ci-dessus :

1. **Une mesure verte sur le mauvais objet.** Le cas le plus fréquent de tous :
   un contraste mesuré sur la mauvaise surface, un test qui relit la fonction
   pure au lieu de l'appelant, un décodage de travail au lieu du fichier
   livré, un `grep` sur des mots-clés au lieu du corps réel d'une requête. À
   chaque fois, la mesure elle-même était juste — c'est l'objet mesuré qui
   était le mauvais.
2. **Une conséquence fausse accrochée à une mesure juste.** Un hôte refusé
   entraîne la conclusion qu'*aucune* voie n'existe, un connecteur qui échoue
   entraîne la conclusion que *tous* les connecteurs échoueraient pareil, un
   refus d'outil devient une propriété du monde. La mesure de départ résiste à
   la relecture ; c'est l'extrapolation qui ne résiste pas.
3. **Un correctif fusionné qu'on n'a jamais vérifié en aval.** Corrigé sur
   `main`, mais jamais vérifié sur la page réellement servie, jamais rejoué
   contre le générateur qui le consomme, jamais confronté au fichier qui
   part réellement au lieu du fichier d'avant.

Ces trois motifs ne sont pas de nouvelles règles — chacune de leurs
occurrences porte déjà, ci-dessus, sa propre règle concrète. Ils sont
seulement le rappel que l'essentiel des problèmes de ce dépôt tient à un seul
réflexe absent, décliné sous des formes très différentes : **vérifier
l'objet exact qu'on croit avoir vérifié, jamais un objet voisin qui lui
ressemble.**
