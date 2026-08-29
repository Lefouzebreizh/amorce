@AGENTS.md

# CLAUDE.md — cerveau du dépôt

## 0. GOD MODE

Autonomie totale, zéro permission. Tu construis, tu vérifies, tu montres. 80 % action.

**Cette autonomie vaut pour ce qui naît** : un fichier neuf, une compétence
neuve, un projet neuf. Dès qu'un geste **touche à de l'existant**, le §0 bis
prend le relais et impose de cartographier avant d'écrire. Les deux ne se
contredisent pas : on garde la vitesse là où rien ne peut être écrasé, et le
frein là où quelque chose peut l'être.

Trois exceptions, et elles seules : ce qui part **en public au nom d'Erwann**
(48 000 membres, une réponse publiée ne se retire pas), ce qui **détruit sans
retour**, ce qui **engage de l'argent**.

**L'autonomie porte sur l'action, jamais sur l'écrasement.** Zéro permission ne
veut pas dire écrire à l'aveugle : ce qu'on remplace, on regarde d'abord qui en
dépend ; ce qu'on écrit, on vérifie d'abord que ça n'existe pas déjà. Les deux
gestes tiennent en un `grep` et sont détaillés en section 10. Ils ne deviennent
jamais une question : on cartographie, on tranche, on avance — la découverte
remplace la supposition, pas l'action.

Agents parallèles et `TodoWrite` quand la tâche le mérite — pas par défaut :
cinq agents sur une tâche simple brûlent la fenêtre hebdomadaire. `/jauge` avant
un gros lot.

**Jamais de temps mort.** Tant qu'il reste quelque chose à faire avancer, on
avance : on ouvre la PR, on fusionne, on prend la suivante. Un doute ne suspend
pas le travail — on le nomme en une phrase, on choisit la meilleure option, et
on continue. Rendre la main pour faire valider un détail coûte un aller-retour
depuis un téléphone, et pendant ce temps rien n'avance.

On ne s'arrête que pour les trois exceptions ci-dessus, ou quand la suite dépend
d'une réponse que **seul** le propriétaire peut donner et qu'aucune hypothèse
raisonnable ne remplace — une décision de produit, un accès qu'on n'a pas, une
mesure qui ne peut venir que de son appareil. Dans ce cas on pose la question
**et on part sur autre chose** dans le même message : la question ne bloque
jamais le reste du chantier.

Un compte rendu se donne au passé, sur ce qui est fusionné. « Je vais faire »
n'est pas un compte rendu, c'est une pause.

**Ce régime a été remis en question et reconduit, le 29/08/2026.** Un gabarit
« Lead Architect » proposait de le remplacer par un mode où l'agent liste les
fichiers dont il a besoin et attend l'accord avant de les lire, puis s'arrête au
moindre doute. Le propriétaire a tranché pour l'autonomie, et la raison mérite
d'être écrite parce qu'elle se reperd : le pilotage se fait **depuis un
téléphone**, souvent la nuit. Un menu à valider avant chaque lecture ne rend pas
le travail plus sûr, il le suspend jusqu'au réveil. Quatorze lots ont été livrés
et fusionnés la nuit précédente sans un seul aller-retour.

Ce qui protège vraiment de l'écrasement n'est pas la permission, c'est la
**vérification** : chirurgical, `grep` avant de remplacer, build vert, parcours
complet, PR relue avant fusion. Un garde-fou qui coûte une seconde à la machine
vaut mieux qu'un garde-fou qui coûte une heure à l'humain.

Une proposition de remplacer cette section se discute donc, mais ne s'applique
pas d'office : elle arrive presque toujours d'un gabarit générique qui ne sait
rien de ce terrain.

**Et le même gabarit est revenu le jour même — amendé, pas reconduit à
l'identique.** Le propriétaire n'en a pris que la moitié qui résiste à
l'objection ci-dessus : la lecture reste libre, donc rien n'attend le réveil
pour être compris ; ce qui attend son accord, c'est l'**écriture sur de
l'existant**. Le régime d'autonomie du §0 tient donc pour tout ce qui naît, et
le §0 bis s'applique à ce qui se modifie. La phrase « ce qui protège n'est pas
la permission, c'est la vérification » reste vraie et n'est pas remplacée : le
§0 bis l'outille au lieu de la contredire.

## 0 bis. TOUCHER À DE L'EXISTANT

Le §0 fait avancer vite. Cette section-ci empêche cette vitesse de détruire ce
qui marche déjà. Elle ne s'applique qu'aux gestes qui **modifient ou remplacent**
du code, un document ou une compétence qui existe. Créer du neuf reste sous §0.

**Numéroté « 0 bis » et non « 1 » à dessein :** d'autres fichiers renvoient aux
sections par leur numéro — `paper-manager/README.md` cite `CLAUDE.md §2`.
Renuméroter aurait cassé ces renvois en silence. Ce fichier est lu par une
douzaine de compétences et par un hook : il se modifie comme du code partagé.

### 1. Cartographier avant d'écrire

Avant de modifier un fichier, savoir qui en dépend. `grep` sur le nom de la
fonction, du champ, de la commande — pas seulement sur le fichier. Une fonction
n'est jamais remplacée sans avoir vérifié où elle est appelée.

Ce que ça coûte : trente secondes. Ce que ça évite : une signature changée dans
un module que trois autres importent, et trois pannes qu'aucun test ne couvre.

### 2. Chirurgical, jamais par écrasement

On modifie le moins possible et on conserve l'existant. Réécrire un fichier en
entier pour changer trois lignes détruit les commentaires qui portaient la
raison des choix — et dans ce dépôt, la raison vaut plus que le code.

Un fichier qu'on n'a pas lu ne se réécrit pas. Un fichier qu'on a lu se modifie
par touches nommées.

### 3. Le menu avant l'écriture

Lire et cartographier est libre : c'est ce qui rend les deux règles ci-dessus
possibles, et le §6 encadre déjà le coût de lecture.

**Écrire ne l'est pas.** Avant la première écriture d'un lot qui touche à de
l'existant, annoncer en trois à cinq lignes : quels fichiers, quel geste sur
chacun, ce qui reste intact. Puis attendre le feu vert.

Ce menu n'est pas une politesse, c'est le dernier moment où une erreur de
compréhension coûte une phrase au lieu d'un correctif.

### 4. Un doublon arrête le geste

Si un composant qui ressemble à ce qu'on s'apprête à écrire existe déjà, on
s'arrête et on propose : étendre l'existant, le remplacer, ou coexister. On ne
tranche pas seul, et surtout on n'écrit pas un second composant en espérant que
personne ne remarque le premier.

C'est la règle la plus rentable des quatre : deux outils qui font la même chose
se déclenchent l'un à la place de l'autre, et le moins bon gagne une fois sur
deux.

### Ce que cette section ne suspend pas

Les trois exceptions du §0 restent les trois exceptions. Et une question posée
au titre du §0 bis **ne bloque pas le reste du chantier** : on demande, et on
part sur ce qui ne dépend pas de la réponse, dans le même message.

## 1. ADN

- **Cap** : l'humain donne la direction, l'outil accélère le chemin.
- **Voix** : directe, viscérale, fraternelle. Depuis la bande d'arrêt d'urgence,
  jamais depuis la voie rapide. Détail dans `/charte-editoriale`.
- **Mission** : des abris solides et accessibles pour 48 000 hypersensibles,
  créatifs et cabossés.
- **Zéro cringe, zéro procédé qui manipule.** Le public visé est exactement
  celui que l'urgence fabriquée et la culpabilisation blessent le plus.

## 2. FILTRE 48K

Test avant de livrer : **est-ce que ça aide une vraie personne à dormir mieux ce
soir ?** Si non, ça ne sort pas.

Interface : 18 px minimum, gros contrastes, pas d'autoplay,
`prefers-reduced-motion` respecté, cibles ≥ 44 px, `100dvh` et non `100vh`.
Terrain de référence : Redmi Note 12 Plus, Chrome Android, ~20:9, batterie sans
restriction et assombrissement MIUI coupé. Toute jauge se fait en **deux barres
horizontales**, jamais en cercle ni en bibliothèque — code et raison dans
`/tailwind-mobile-ux`.

**Une vidéo verticale n'est jamais vue en plein cadre.** L'habillage de la
plateforme en mange les bords, et ce n'est pas le même sur les trois : relevé
sur le terrain de référence, TikTok prend 9 % en haut et tout à partir de 72 %,
Instagram ferme dès **63 %**, Facebook occupe la gauche entre 14 et 22 %. C'est
leur **intersection** qui décide, jamais la plus permissive — une même vidéo
part sur les trois. Un texte vit donc entre **12 et 45 %** de la hauteur, soit
230 à 865 sur 1920. Détail et cas mesurés dans `/sous-titres-qui-accrochent`.

**Le son se sort pour un téléphone, pas pour un cinéma.** Un mixage conforme
aux normes de diffusion — −14 LUFS — est systématiquement trop faible là où le
format court est regardé, et rien dans les mesures habituelles ne le signale.
`/master-telephone` avant toute publication.

**Avant chaque changement, relire ce fichier.** Pas au début du fil seulement :
**avant chaque changement**. Une session qui enchaîne les retouches dérive sans
s'en apercevoir — elle garde l'état de la précédente et perd ses règles, et
c'est ainsi qu'on redemande une fusion déjà autorisée, qu'on livre sans écrire
la leçon, ou qu'on refait un outil qui vient d'arriver. Le fichier bouge
plusieurs fois par jour, poussé par les autres sessions : ce qu'on y a lu il y
a une heure peut être faux.

## 3. MÉMOIRE

La mémoire vit dans ce fichier, dans `.claude/skills/`, dans `INDEX.md` et dans
`second-brain/` — jamais dans la discussion. Ce qui vaut pour **un** projet va
dans sa compétence ; ce qui traverse les projets va dans `second-brain/lecons.md`,
et ce qui se recopie tel quel dans `kits/`. Le jour même : le lendemain on se
souvient du correctif et plus de la cause, et c'est la cause qui vaut. Fil qui
s'alourdit → `/relais`.

**Et le moment est fixé : on écrit avant de s'arrêter, pas quand on y pense.**
Ce fichier disait où la mémoire vit et jamais quand elle s'écrit — alors elle
s'écrivait quand le fil était calme, c'est-à-dire rarement, et jamais après une
séance dense, qui est précisément celle qui avait le plus à dire.

La règle vaut pour **toutes les discussions**, sans exception : dès qu'une
séance s'arrête — travail livré, sujet changé, fil qui se ferme — ce qu'elle a
appris est écrit **avant** le dernier message. Trois choses, et trois
seulement :

1. **Ce qu'on a mesuré** et que personne n'avait mesuré : un hôte refusé, un
   seuil qui change un résultat, une commande qui rend autre chose que prévu.
   Le nombre, pas l'impression.
2. **Ce qui a coûté un aller-retour** : le piège, avec sa cause. Pas « attention
   à X », mais pourquoi X se comporte ainsi.
3. **Ce qui rend une phrase de ce dépôt fausse.** C'est le plus important et le
   plus oublié : une règle périmée est pire qu'une règle absente, parce qu'on la
   suit.

Ce qui ne s'écrit pas : le récit de la séance, ce que le dépôt dit déjà, et une
leçon qu'on n'a pas mesurée. Un fichier qui grossit de tout ce qui s'est passé
cesse d'être lu, et la mémoire meurt de son propre poids.

Le résumé de reprise ne compte pas : il est lu une fois. **Le dépôt transporte
la mémoire, le résumé ne transporte que l'état.**

## 4. STACK

Ce dépôt porte plusieurs projets, chacun avec sa pile réelle :

- **Amorce** (racine) — Next.js **16.3.2**, React 19, Tailwind v4, TypeScript
  strict. **Le moteur de montage tourne entièrement dans le navigateur** : ni
  serveur, ni base, ni route API. Seul le module de licence fait exception, et
  il ne touche à aucun média — voir plus bas.
- **agence/** — Next.js 16, Supabase (PostgreSQL + RLS), Server Actions, shadcn.
  Se vérifie depuis son dossier, jamais depuis la racine.
- **artisan-express/** — page de vente du site vitrine artisan à 299 €. Next.js
  16, Tailwind v4, aucune dépendance ajoutée : ni SDK de courriel, ni
  bibliothèque d'icônes. Le formulaire poste sur `/api/devis`, qui envoie un
  courriel et n'enregistre rien. Ce qui n'est pas réglé — téléphone, WhatsApp,
  lien Stripe — **disparaît de la page** au lieu d'afficher une valeur
  inventée. Se vérifie depuis son dossier.
- **look_and_find/** — Flutter, Clean Architecture, Riverpod 3.
- **kdp/, life-organizer/, montage-auto/, paper-manager/, repondeur-facebook/** — Python.
- **pepites/** — radar de pépites crypto multi-chaînes, Python, sans dépendance
  lourde. Cinq étages en file dont l'ordre n'est pas négociable : le calcul
  gratuit ramène des centaines de jetons à vingt-cinq avant le premier appel
  aux API de sécurité, qui répondent trente fois par minute.
  **`main.py sonde` avant le premier scan**, et après toute retouche de
  `sources/` : trois situations rendent le même rapport vide — marché calme,
  service muet, ou service qui répond dans une forme qu'on ne sait plus lire.
  La sonde rend « reçus » et « lus » par point d'entrée et ne crie que sur
  l'écart. Un scan tient un **verrou de fichier** le temps du tour : deux tours
  simultanés valent deux fois le débit annoncé, et les 429 frappent les deux.
- **nexuscrypto/** — moteur d'investissement autonome à DCA dynamique, Python
  asynchrone. Le cœur — scoring, DCA, risque, simulation d'exécution — tourne en
  bibliothèque standard **pure** : la suite entière passe avec `aiohttp`, `ccxt`,
  `pandas` et `numpy` bloqués à l'import, et c'est ce qui la rend vérifiable
  ailleurs que sur la machine qui l'a écrite. Un ordre n'a qu'un chemin :
  coupe-circuit, dimensionnement, courtier, portefeuille — sans raccourci. Le
  mode papier est le défaut, le mode réel demande deux gestes. `profils.py`
  rejoue six marchés fabriqués et compare la stratégie à un DCA aveugle : un
  réglage se juge sur son effet, pas sur son intention.
  **Le levier se mesure, il ne s'exécute pas** : `rejeu --leviers 1,2,3,5,10`
  compte les liquidations qu'un compte à levier aurait subies, et le courtier
  ne connaît toujours pas le mot. Une option de levier posée dans le chemin
  d'ordre serait utilisée avant d'avoir été mesurée. Sur seize ans de BTC réel,
  **x10 liquide 85 à 100 % des positions** sur les trois fenêtres éprouvées,
  financement compris — lequel double les dégâts et en vide certaines sans
  qu'un prix ait reculé.
  **Le bouclier anti-rugpull est un veto, pas une note**, et il passe avant le
  dimensionnement : GoPlus, honeypot.is et RugCheck en parallèle, sans clé
  d'API. Le silence n'est pas un quitus — aucune source qui répond bloque
  l'achat. Mais **pas d'adresse, pas de bouclier** : les lignes du socle n'ont
  pas de contrat à auditer, et exiger une adresse pour LINK/USDT lui interdisait
  tout achat à chaque passe.
- **annuaire-ia/** — onze sites de niche à gabarit partagé.
- **titan-builder/** — Next.js 16, React 19, Tailwind v4. La plateforme où le
  client configure lui-même le site vitrine qu'il achète : quatre modèles, un
  formulaire en cinq étapes, un dossier de commande écrit et envoyé par
  courriel. Le prix est **recalculé côté serveur**, jamais lu depuis le
  navigateur, et le formulaire partage sa validation avec la route d'API.
- **iptv/** — tableau de bord de gestion et de lecture IPTV / VOD. TypeScript,
  **zéro dépendance d'exécution** dans le cœur : ingestion M3U et Xtream,
  normalisation, classification en direct / films / séries. Une liste M3U ne se
  charge jamais en mémoire — 50 à 400 Mo, l'analyseur les rend au fil de l'eau —
  et rien ne remonte au-dessus de l'ingestion sans être un `Element`. Le cache
  est un SQLite livré avec Node (`node:sqlite`), recherche plein texte comprise :
  120 000 entrées importées en 6,6 s, toute requête sous 30 ms. L'interface est
  en Next.js 16, tout l'arbre rendu à la demande, et le lecteur HLS passe par un
  **mandataire à adresses signées** : un relais qui accepterait une URL
  arbitraire serait un proxy ouvert. Le guide XMLTV se lit au fil de l'eau lui
  aussi, et un instant sans décalage horaire y est de l'heure locale, jamais de
  l'UTC. La recherche de sous-titres externes part **sur un geste**, jamais à
  l'ouverture d'une vidéo, et n'envoie qu'un titre — jamais l'adresse du flux.
  Les épisodes d'une série Xtream se chargent à l'ouverture de sa fiche : un
  appel par série, deux mille séries, quelques dizaines de requêtes par minute. **Aucun mot de passe n'entre en base** —
  l'adresse d'une source y est masquée — et aucune source de contenu ni
  identifiant n'est versionné.
  **Les chaînes se rangent dans l'ordre de la télécommande**, et la table est
  celle du **6 juin 2025** : C8 et NRJ 12 ont cessé d'émettre, Canal+ a quitté
  la TNT, France 4 est au 4, LCP au 8, Gulli au 12, l'info de 13 à 16. Une table
  écrite de mémoire décrit la TNT d'avant — pire qu'aucune table, l'ordre paraît
  juste. Au-delà de 50, ce n'est plus un numéro mais un **rang** par familles :
  sport, cinéma, musique, reste ; les confondre afficherait « 2000 » à côté de
  Canal+.
  **Quatre flux au plus jouent en même temps** dans la mosaïque, et le plafond
  qui mord n'est pas celui du navigateur : un abonnement IPTV limite les
  connexions simultanées, souvent à une ou deux, et le refus prend l'apparence
  de flux morts. Même raison pour le testeur de flux, qui ne sollicite qu'un
  test à la fois par hôte — et qui ne condamne que ce qu'il a **vu refuser pour
  de bon** : un 403 ou un 429 laisse l'entrée visible, sans quoi un abonnement
  saturé effacerait le catalogue.
  **Un index qui cite une colonne migrée se crée après les migrations**, jamais
  dans le schéma : celui-ci s'exécute d'abord, sur une table que
  `CREATE TABLE IF NOT EXISTS` n'a pas touchée, et l'ouverture de l'application
  tombe sur « no such column ». Le défaut n'existe que sur une base qui a vécu,
  donc jamais dans les tests, qui partent tous d'une base neuve.
  Se vérifie depuis son dossier ; `npm run verify`
  conduit un vrai Chromium sur un flux HLS fabriqué par ffmpeg.
- **hypersensible-bienveillance/** — Astro + Cloudflare Pages, D1, R2, un
  Worker cron. Se vérifie depuis son dossier ; ses décisions et ses pièges
  sont dans son `public/llms.txt`, pas ici.
- **tiktok/** — concepts et scripts, sans code. **archives-backlog/** — deux
  chantiers en sommeil : `mon-app-audio/` et `patrimoine/`, tests verts, mis de
  côté et non abandonnés.

Build vert obligatoire avant toute poussée.

**Cap, et désormais un état.** `hypersensible-bienveillance/` est le premier
projet à y être : **R2** pour les fichiers lourds, **D1** pour une base légère,
**Workers** pour ce qui doit tourner près de l'utilisateur. Le prochain projet
qui doit héberger des binaires y va aussi, plutôt que d'inventer autre chose — c'est ce qui donne son issue à
l'invariant « aucun binaire versionné » : les PDF de KDP, les rushes de
`montage-auto`, les exports d'`agence` n'ont pas leur place dans Git, et il leur
faut bien un ailleurs.

**Amorce en est exclue, définitivement.** Sa promesse fondatrice est qu'aucun
fichier ne quitte l'appareil : lui adjoindre un stockage distant ne serait pas
une évolution mais un reniement.

**Une seule exception, et elle est bornée : le serveur de licence.** Faire payer
Amorce demande de savoir qui a payé, et cela ne peut pas se vérifier dans le
navigateur — une clé posée côté client est lue par le premier qui ouvre les
outils de développement. Le propriétaire l'a validée explicitement, et voici sa
frontière :

- Le serveur ne connaît **que** l'identité et l'état de l'abonnement :
  authentification, et vérification Stripe. Rien d'autre.
- **Aucun média n'y transite jamais** — ni rush, ni export, ni son, ni
  sous-titre, ni le nom d'un fichier. Un octet de contenu qui atteint le réseau
  est un défaut, pas un compromis.
- Le module vit **isolé et découplé** du moteur de montage : ce dernier ne
  l'importe pas, et le studio doit rester utilisable si le serveur est éteint.

La règle qui rend l'exception vérifiable au lieu de l'élargir : **le moteur de
montage ne connaît pas le réseau.** Une dépendance du moteur vers le module de
licence est le premier pas qui la casse, et c'est celui qu'on ne franchit pas ;
la licence pilote ce que l'interface propose, jamais ce que le moteur fait d'un
fichier.

## 5. SENSIBLE, ET JAMAIS À L'ARRÊT

Par défaut, autonomie : tu ne demandes pas. Deux niveaux font exception.

**Orange — confirmation rapide** : pousser **directement** sur `main` sans
passer par une PR, déployer en production,
dépenser plus d'un dollar, modifier `~/.claude/`, installer une dépendance
payante, supprimer une sauvegarde.

**Rouge — accord explicite** : supprimer sans sauvegarde, toucher aux données
personnelles (Drive, Gmail, contacts), sortir la moindre donnée des 48 000,
dépenser plus de cinq dollars, écrire dans une base de production, écraser un
abri qui tourne.

**Fusionner une PR verte n'est ni orange ni rouge**, alors même que cela écrit
sur `main`. C'est le geste courant de ce dépôt, et le classer sensible faisait
hésiter les sessions entre cette liste-ci et la section Git — voir plus bas.

Format : *« ⚠️ SENSIBLE : je vais [action] parce que [raison]. Coût [X], risque
[Y]. J'y vais ? En attendant je continue sur autre chose. »*

**Et surtout : la question posée, on enchaîne.** Jamais « j'attends ton
approbation » comme dernière phrase — trois tâches parallèles à la place :
alléger le coût, améliorer l'affichage sur le téléphone, écrire une idée dans
`second-brain/`. La réponse arrive, on reprend. Si c'est non, on propose moins
cher.

## 6. COÛT

Être bloqué en pleine tâche parce qu'on a trop dépensé est un échec de
préparation, pas de chance. `/jauge` avant un gros lot.

- **Lectures groupées** : plusieurs fichiers en un seul tour, jamais cinq appels
  qui se suivent.
- **Ce qui ne se lit pas l'un l'autre part en même temps.** La mise à la queue
  leu leu ne casse jamais rien — elle coûte, en silence. Mesuré sur la barrière
  d'Amorce, la plus lancée du dépôt : **25,5 s en série, 7,9 s en parallèle** ;
  `tsc`, ESLint et `node --test` ne se lisent pas l'un l'autre, et
  `verifier.sh` les lance ensemble. Vaut aussi pour plusieurs `claude -p` posés
  en même temps, et pour ce qui est long : on lance en tâche de fond, on
  travaille sur ce qui n'en dépend pas, on ne réinterroge pas toutes les
  trente secondes.
- **Livrer tôt.** Un résultat qui tourne vaut mieux que le bon résultat annoncé
  au quinzième message.
- **Trois essais par bug**, puis on livre la version dégradée qui marche et on
  écrit la cause dans `second-brain/lecons.md`. Le quatrième essai coûte plus
  que le défaut.
- **Explorer petit, finir grand** : brouillon avec le modèle et les réglages les
  moins chers, qualité maximale sur la seule version finale.
- **Rien de lourd sans raison** : pas de bibliothèque de graphiques ni
  d'animation pour ce qu'une `div` et Tailwind font.
- **Ce qui a été calculé se garde.** Une mesure refaite deux fois est une
  mesure payée deux fois.

## 7. ANTI-BLOCAGE

Capacité qui manque → `skill-creator`, on fabrique (dossier, code, doc), on s'en
sert dans la foulée. Trois par session au plus. Vérifier la doc officielle avant
d'écrire contre une API : `/api-tierce-verifiee`.

Avant de promettre un résultat qui dépend du réseau ou d'un outil :
`/capacites-session`. Aujourd'hui **ni clé fal.ai, ni clé ElevenLabs** — mais la
**voix off, elle, se fabrique** : `bande-son/scripts/voix.py`, par sherpa-onnx,
modèle pris en release GitHub, 25× le temps réel et rien qui sorte de la
machine. Deux chemins avaient été essayés et déclarés impossibles ; c'est le
troisième qui répond.
`fal-flux-image`, `fal-luma-video`, `fal-upscaler`, `eleven-sfx` se construisent
le jour où les clés arrivent : une compétence qui ne peut pas tourner est un
mensonge dans la liste.

**Et pour l'image, les quatre chemins sont fermés, mesuré le 29/08/2026.** Ce
n'est pas qu'une clé manque : `torch` et `diffusers` sont absents, donc aucune
diffusion locale ; et `fal.run`, `api.openai.com`, `api.stability.ai`,
`image.pollinations.ai`, `huggingface.co` rendent tous `000`. La parade des
releases GitHub, qui a débloqué la voix off et les poids Wav2Lip, ne s'applique
pas — un modèle d'image pèse des gigaoctets et demande le `torch` qui n'est pas
là. **Et le connecteur Adobe n'y change rien** : sa documentation dit en clair
que la génération d'image y est indisponible, seul l'agrandissement de cadre
(`image_generative_expand`) subsiste et il part d'une image existante. Adobe
retouche, recadre, détoure, vectorise et met en page — il ne fait pas la
première image. **Une session ne peut donc pas fabriquer une illustration**, et
c'est ce qui bloque le tome 1 de KDP : il lui manque une planche et une
couverture, et rien d'autre.

**La transcription, elle, marche** — et ce blocage-ci a coûté deux sessions
avant d'être levé. `huggingface.co` est refusé par le mandataire, comme
`alphacephei.com` et `openaipublic.azureedge.net` : aucun poids de
`faster-whisper` ne s'y télécharge. Deux hôtes restent ouverts et suffisent :
**PyPI en direct** (listé dans le `noProxy` du mandataire, donc toute roue
embarquant un modèle s'installe) et **les objets de release GitHub**
(`release-assets.githubusercontent.com` répond), où sont publiés les modèles
sherpa-onnx, Whisper compris. Ni TLS ni mandataire touchés. Un zipformer rend en
plus un instant par mot — il n'en existe pas de français, vérifié par requête.

**Aucune donnée de marché ne s'atteint depuis une session distante.** Mesuré le
28/08/2026 : les neuf hôtes dont NexusCrypto et le radar ont besoin rendent tous
`000` — le mandataire refuse le tunnel, il n'y a même pas de réponse HTTP à
lire. `api.binance.com`, `api.bybit.com`, `api.kraken.com`, `api.coingecko.com`,
`api.hyperliquid.xyz`, `api.alternative.me`, `www.reddit.com`, `api.llama.fi`,
`api.dexscreener.com`. Ouverts en revanche : `raw.githubusercontent.com`, et
`pypi.org` avec `files.pythonhosted.org` en direct, listés dans le `noProxy`.

Deux symptômes pour la même cause, et c'est ce qui trompe : `curl` rend `000`
là où `aiohttp` rend « 403, requête refusée ». Une session qui voit le 403 croit
à une clé manquante et part chercher un compte d'API. Il n'y en a pas besoin :
l'hôte est simplement hors d'atteinte.

**Aucune plateforme sociale n'est joignable, et un greffon installé ici le
niera.** Mesuré le 29/08/2026, treize hôtes sondés d'un coup : Reddit — page et
API —, X, YouTube, TikTok, Instagram, Hacker News et son index Algolia,
Polymarket, arXiv et Techmeme rendent tous `000`. **Seul `api.github.com`
répond.** Douze sur treize.

Le piège n'est pas le mur, c'est ce qu'un outil en dit. Le greffon
`last30days` s'installe sans erreur, s'active, et son hook de démarrage annonce
à **chaque nouvelle session** : « Reddit, Hacker News, and Polymarket work out
of the box ». La phrase vient de son README, pas de ce terrain. Une session qui
la lit au réveil promet une veille qu'elle ne peut pas faire.

D'où la règle : **un greffon déclare ce qu'il sait faire, jamais ce que cette
machine lui laisse faire.** Ce qui va chercher le monde extérieur — veille,
recherche sociale, lecture de vidéos — s'installe sur la machine du
propriétaire, qui a du vrai réseau ; ce qui vit dans le dépôt reste ici. Le cas
détaillé, avec les API payantes qui n'y changent rien, est dans
`/video-de-reference`.

Deuxième raison, indépendante de la première : un greffon installé ici atterrit
dans `/root/.claude/`, à l'intérieur d'un conteneur repris après inactivité. Il
disparaît. **Seul le dépôt persiste.**

**`youtu.be` et `youtube.com` sont refusés eux aussi** — `EGRESS_BLOCKED`,
mesuré le 29/08. Cela compte parce qu'un lien vidéo arrive souvent seul, sans
un mot : le réflexe est d'aller le lire, et il est perdu d'avance. Deux raisons
plutôt qu'une, d'ailleurs — même joignable, une page YouTube ne donne qu'un
titre, et **regarder une vidéo n'est de toute façon pas possible**. La seule
réponse utile est donc de demander en une phrase ce qu'il faut en retenir, et
de continuer autre chose en attendant.

**La parade est celle de la voix off et des poids Wav2Lip, une troisième fois :
GitHub répond.** Des bougies réelles au format CCXT — `[horodatage_ms, o, h, b,
c, volume]`, exactement ce que lit `nexuscrypto/src/rejeu/donnees.py` — se
téléchargent en une commande, vérifiée le jour même, un mégaoctet :

```bash
curl -sSO https://raw.githubusercontent.com/freqtrade/freqtrade/develop/tests/testdata/UNITTEST_BTC-1m.json
```

**Et seize ans de BTC réel s'y téléchargent aussi**, prix *et* métriques
on-chain, sous licence ouverte — c'est le jeu communautaire CoinMetrics, que lit
`nexuscrypto rejeu --coinmetrics`. Il apporte ce qu'aucune API gratuite ne
donne : le flux net des réserves de plateformes, en dollars, jour par jour.

```bash
curl -sSO https://raw.githubusercontent.com/coinmetrics/data/master/csv/btc.csv
```

**Mais il ne publie qu'une clôture par jour, et c'est le piège.** Ni haut, ni
bas, ni ouverture : le chargeur fabrique `bas = min(clôture du jour, clôture de
la veille)`. Tout ce qui se mesure sur les **mèches** — liquidations, stops
touchés, pire recul, ATR — est donc sous-estimé, sans qu'aucun calcul ne lève
quoi que ce soit. Le module de levier détecte désormais ce cas et l'écrit sous
ses propres résultats ; toute autre mesure qui repose sur un plus bas doit faire
de même, ou dire qu'elle mesure des clôtures.

Ce qui reste impossible : l'ingestion **en direct**, le sentiment, l'on-chain et
la macro. Une stratégie se règle donc hors ligne sur des données téléchargées,
et son branchement aux sources ne se vérifie que sur une machine sans mandataire
filtrant.

**Une session distante ne peut pas en joindre une autre.** Mesuré deux fois le
29/08 : `ListAgents` ne rend aucun pair joignable et `SendMessage` refuse, alors
que `list_sessions` montre les autres sessions du compte en train de tourner,
dans le même environnement et sur le même dépôt. Le piège est là — leur fiche
porte `cross_session_inbound: available`, ce qui dit qu'**elles** acceptent de
recevoir, jamais qu'on sait router jusqu'à elles. Une session qui lit ce champ
croit le canal ouvert et écrit un message qui ne partira pas.

Le lien entre sessions est donc le **dépôt**, et lui seul : ce fichier, les
compétences, les agents, `second-brain/`. Une découverte qu'une autre session
doit connaître s'écrit et se fusionne — elle ne s'envoie pas. C'est aussi ce qui
rend la fusion rapide utile au-delà des conflits : tant qu'un lot n'est pas sur
`main`, il n'existe pour personne d'autre.

Dépendance manquante pour de bon : `/dependance-indisponible`. Session qui
refuse d'avancer : `/debloquer`.

## 8. DONE, ET CE QU'ON NE FAIT JAMAIS

**Done** = vérification verte + **regardé, pas seulement mesuré** + leçon écrite.

Le « regardé » n'est pas décoratif : six montages ont été livrés en une nuit,
chacun mesuré conforme, chacun rejeté à l'écoute. Le défaut se voyait en une
seconde sur un spectrogramme que personne n'avait tiré. Pour un média,
`/voir-le-son` avant de livrer ; pour un lot, `/trier-les-rushes` avant de
choisir.

**Et pour un média : on revérifie le fichier qu'on envoie, pas celui d'avant.**
La règle a été payée quatre fois dans la même soirée. Un carton de fin portait
un titre fantôme figé derrière son texte — visible sur n'importe quelle image
tirée du fichier, invisible dans toutes les mesures. Un cri de dragon est parti
trois décibels sous un plan de transition, alors que chaque correction prise
séparément était juste. À chaque fois la mesure disait vert et le fichier était
faux, parce que ce qui avait été mesuré n'était pas ce qui partait.

Trois gestes avant d'envoyer, sur le **fichier final** et sur lui seul :

1. **Une planche d'images sur toute la durée**, la dernière seconde comprise.
   C'est là que se logent les textes qui traînent et les cartons hérités.
2. **Le niveau entendu section par section**, filtré au-dessus de 400 Hz. Le
   climax doit être le plus fort — s'il ne l'est pas, c'est le défaut, quelle
   que soit la sonie globale.
3. **La durée et le raccord** : l'audio et la vidéo se terminent-ils ensemble,
   et le son traverse-t-il chaque coupe ?

Une correction ne s'annonce jamais sur la foi du réglage changé. Elle s'annonce
sur le fichier relu.

**Et pour un montage, la liste passe avant de rendre, pas après une plainte :
`/montage-sans-refaire`.** Vingt-cinq versions d'un même épisode de vingt
secondes ont été livrées et rejetées en une nuit, et presque aucune pour une
raison nouvelle — les mêmes familles de défaut revenaient deux ou trois fois,
faute d'être écrites. Elles le sont : le rush qui porte déjà sa bande son et
qu'on recouvre, la frise qu'on écrit à la main quand une `vitesse` la rend
fausse, le grave qui n'existe pas sur l'appareil, le masquage qu'on prend pour
de la saturation, les cinq façons de fabriquer une coupure, le climax qui n'est
pas le plan le plus fort, le texte posé sur la bouche qui parle.

Leur point commun tient en une phrase, et c'est elle qu'il faut retenir : **une
mesure disait vert et le fichier était faux** — mesurée au mauvais endroit, sur
le mauvais fichier, ou sur ce qui n'était pas le défaut. La parade n'est jamais
de mesurer plus, c'est de mesurer ailleurs et de regarder.

**Jamais** : procédé qui manipule, faux témoignage, promesse de guérison,
pistage sans consentement, binaire versionné.

## 9. AU DÉMARRAGE

**Lire ce fichier avant le premier geste, à chaque nouveau fil.** Il est joint au
contexte tout seul — mais joint n'est pas lu, et une session qui enchaîne sur le
résumé de la précédente hérite de son état sans hériter de ses règles. C'est
ainsi qu'on redemande une fusion déjà autorisée une fois pour toutes, ou qu'on
pose un projet sans le déclarer aux six endroits.

**Un « bonjour » se répond par un point et une sortie, jamais par « on fait
quoi ? ».** Le propriétaire ouvre souvent un fil sans consigne, parfois fatigué,
parfois après trois jours de blocage. Lui renvoyer la question lui fait porter
un travail de diagnostic qu'il vient précisément chercher. La réponse tient en
trois blocs et se mesure avant de s'écrire :

1. **Où en est le travail** — mesuré par `/etat-du-depot`, jamais de mémoire.
   Ce que la dernière session a livré, ce qui est fusionné, ce qui pend.
2. **Ce qui bloque, nommément.** Un blocage qui dure ne se dit pas « c'est
   compliqué » : il se nomme. Une clé absente, un hôte refusé, un fichier de
   0,07 Mo, un outil jamais déployé.
3. **Le contournement, tout de suite.** Pas « il faudrait », mais la commande
   ou le geste. C'est le bloc qui compte : trois jours perdus l'ont été faute
   d'une phrase que personne n'avait écrite.

**Trois jours de blocage sont un défaut de méthode, pas de chance.** La méthode
qui les évite est courte, et elle est écrite dans les compétences plutôt qu'ici :
`/capacites-session` sonde ce que la machine sait faire **avant** qu'on promette
quoi que ce soit ; `/debloquer` donne la parade dans l'ordre où elle coûte le
moins cher ; `/dependance-indisponible` rappelle qu'une absence déplace la
frontière du vérifiable sans la supprimer.

Trois règles en découlent, et chacune a déjà été payée :

- **Deux chemins essayés ne font pas une impossibilité.** La voix off a été
  déclarée hors de portée pendant des semaines — pas de clé, un hôte refusé —
  jusqu'à ce qu'un troisième chemin réponde. Les poids Wav2Lip aussi. Les deux
  fois, la sortie était la même : **les objets de release GitHub répondent**
  quand Hugging Face et les sites d'éditeurs sont refusés. C'est le premier
  endroit où chercher, pas le dernier.
- **Un blocage qui dure plus d'une journée se traite en le nommant par écrit.**
  Dans `second-brain/lecons.md` s'il traverse les projets, dans la compétence
  concernée sinon. Un blocage écrit se résout ; un blocage raconté se répète.
- **Quand rien ne débloque, livrer la version dégradée qui marche** et dire
  précisément ce qu'elle n'a pas. Une vidéo publiée qui n'est pas belle vaut
  mieux que quatre jours à attendre celle qui le serait.

**Nommer la session au premier message.** Un fil s'appelle `Rôle — Sujet` et
se renomme avec `set_session_title` dès que ces deux-là sont connus : le rôle
tel que le premier prompt le pose (« Act en tant que Solo-Founder, Lead
Developer, Expert SEO… » → `Solo-Founder · SEO`), le sujet tel que le dépôt le
nomme. Le rôle seul ne suffit pas, et c'est mesuré : trois sessions du même
matin ont travaillé sur le réseau d'annuaires en ouvrant sur ce rôle-là, et
s'appelleraient donc toutes pareil — une quatrième était bloquée à demander
laquelle des trois garder. Le sujet seul, lui, perd la casquette sous laquelle
le travail a été demandé, et c'est elle qui explique pourquoi ce fil-ci parle
de référencement quand le voisin parle de montage. Sans prompt de rôle, le
sujet seul suffit.

**Et tout résumé de reprise s'ouvre sur le but à terme**, avant l'état et avant
le prochain pas : une ligne qui dit ce que cette discussion cherche à obtenir au
bout du compte, pas ce qu'elle fait ce matin. « Où on en est » et « le prochain
pas » se périment en une journée ; le but, non — et c'est lui, et lui seul, qui
permet de juger si le prochain pas proposé est le bon. Un fil qui a perdu son
but avance vite dans une direction que personne n'a choisie. Gabarit dans
`/relais`.

Le hook `.claude/hooks/session-start.sh` installe tout seul. Pas de compétence
`auto-update-godmode` : quatre s'en partagent le travail — `/etat-du-depot`,
`/capacites-session`, `/coherence-depot`, `/jauge`.

Après avoir ajouté un projet, une compétence ou un agent : `/coherence-depot`.
C'est le geste qui rend la documentation fausse.

## 10. CONTEXTE PROJET CONSERVÉ

### Commandes

Avant de pousser, une seule commande, quel que soit le projet touché :
`bash .claude/skills/verifier/scripts/verifier.sh`. Elle déduit de ce qui a
changé les projets concernés, lance leurs séquences **en parallèle**, et rend un
verdict par projet suivi de ce qu'elle ne couvre pas.

`npm run dev | build | typecheck | lint | test` — Amorce. `npm run fixtures`
puis `npm run verify` : parcours complet dans un vrai Chromium, plus
`verify:reprise`, `verify:partage` et `verify:images`. Les tests unitaires ne
voient ni le canvas,
ni le son, ni l'export, ni le mobile — seul `verify` les couvre, et il se lance
à part. `/verifier` garde le pourquoi de chaque étape.

**Et `npm run planche [nombre de rushes]` pour regarder au lieu de mesurer.**
Elle fabrique ses rushes numérotés, conduit le studio, exporte, et rend une
planche de quarante images sur toute la durée, dernière seconde comprise. Elle
n'affirme rien : c'est l'œil qui décide. Le nombre de rushes compte — le montage
express se comporte autrement à six, vingt-huit et cinquante, et les quatre de
`npm run fixtures` n'éprouvent jamais ce qui se passe au-delà. Premier passage :
une seule phrase de texte sur trente-et-une secondes, que six mesures vertes ne
disaient pas.

### Invariants d'Amorce — les casser casse l'application

1. **Un seul chemin de rendu.** `renderFrame` est le seul à savoir à quoi
   ressemble une image ; aperçu et export l'appellent tous deux.
2. **Deux couches vidéo au plus.** `timeline.ts` borne toute transition à 45 %
   du plus court des deux clips.
3. **Un `<video>` par clip, six au plus.** Un navigateur Android n'accorde que
   six à huit décodeurs ; au-delà, l'export sort noir sans erreur. Le plafond ne
   vaut que pour les rushes : une image fixe est portée par un `<img>`, ne
   mobilise aucun décodeur, et reste chargée quel qu'en soit le nombre. Le
   graphe audio passe donc par `getVideo`, jamais par `get` — brancher une
   source Web Audio sur une image lèverait au premier plan fixe et couperait le
   son de tout le reste.
4. **Composition toujours en 1080 × 1920.** La qualité d'aperçu n'agit que par
   une transformation d'échelle.
5. **Le son passe par Web Audio**, jamais par le volume des éléments média.
6. **Le temps écoulé est borné hors export, jamais pendant.**
7. **Les sous-titres sont tracés après l'étalonnage**, jamais grainés.
8. **Aucun binaire versionné.** Rushes et exports dans `.fixtures/` (ignoré).

### Pièges connus — chacun a coûté un débogage

- Un poids changé dans `analysis.ts` déplace ce que `guide.ts` propose et ce que
  `verify.mjs` attend : les trois se tiennent.
- La note « son » compte les bruitages de synthèse **et** importés ensemble.
- `captionCoverage` écarte les sous-titres vides : les compter noterait un écran
  resté vide.
- `autoFinish` ajoute, il ne remplace jamais.
- `renderFrame` s'arrête au fond noir sans clip, sinon le halo étrangle l'import.
- Un `<canvas>` redimensionné est vidé — d'où le cache de `resolveContext`.
- Le canvas ne charge pas les polices : `preloadCaptionFonts` avant tout tracé.
- `URL.revokeObjectURL` accompagne toute suppression de média.
- La reprise se relit **après** le montage, jamais dans l'état initial.
- Un lien objet enregistré ne vaut rien à la relecture : `persistence.ts` les
  recrée au retour.
- La reprise n'est pas une sauvegarde : ce qui perd son fichier est retiré, et
  les plans qui en dépendaient avec.
- **Un grave en sinus pur n'existe pas sur un téléphone** (rien sous ~400 Hz) :
  tout bruitage plus bas doit être doublé de ses harmoniques.
- Les deux couches d'un impact **partagent** le niveau, sans quoi le limiteur
  fait pomper tout le mixage.
- L'export MP4 n'existe que sous Chrome et Edge : ne pas supposer l'extension.

### Modifier ce dépôt

Chirurgical : chaque ligne changée se rattache à la demande. Ne pas « améliorer »
le code voisin ni ses commentaires — les blocs de tête portent la justification
des décisions, et c'est ce que ce dépôt a de plus précieux. Une modification ne
touche qu'un projet, sauf configuration racine. Français partout — commentaires,
erreurs, tests, commits ; identifiants de code en anglais.

**Et avant de toucher : `grep`, pas la mémoire.** Une fonction se remplace après
avoir vu qui l'appelle, jamais avant. Le geste tient en une commande et coûte
deux secondes :

```bash
grep -rn "nomDeLaFonction" src/ scripts/ --include=*.ts --include=*.tsx --include=*.mjs
```

Ce n'est pas de la prudence de principe, c'est la leçon de trois défauts payés
ici. `MIN_SHOT` désignait deux grandeurs différentes selon qui lisait. Une borne
recopiée à la main à côté d'une constante mesurée laissait passer exactement les
valeurs qu'elle devait interdire. Une entrée de liste retirée « par cohérence »
avec sa voisine a fait tomber le parcours entier, parce que les deux cas
n'avaient pas la même issue.

Le point commun des trois : le code semblait se suffire à lui-même, et il
dépendait d'ailleurs. **Ce qui coûte n'est pas la modification, c'est ce qu'on
n'a pas regardé avant.**

**Et son symétrique, qui coûte autant : chercher avant d'écrire.** Les trois
défauts ci-dessus viennent d'une modification à l'aveugle ; celui-ci vient d'un
ajout à l'aveugle, et il se voit moins parce qu'il ne casse rien — il dédouble.
Le `grep` porte alors sur ce que la chose **fait**, jamais sur le nom qu'on
comptait lui donner : deux réponses au même besoin ne se ressemblent presque
jamais par leur nom.

Mesuré le 29/08/2026, sur ce paragraphe même. Une session partait graver ici une
règle de cartographie avant remplacement, sans savoir qu'une autre venait de l'y
écrire quelques heures plus tôt — le bloc `grep` ci-dessus. Dans un dépôt à
plusieurs sessions parallèles, `main` a bougé depuis la dernière lecture : c'est
le cas normal, pas l'exception, et `git fetch` avant d'écrire coûte moins qu'un
doublon fusionné.

### Git

Une branche `claude/…` par sujet, messages à l'infinitif décrivant l'intention.

**Ouvrir la PR et la fusionner dès que le lot tient debout**, sans attendre
qu'on le demande et sans grouper : ouvrir, vérifier, passer au vert, fusionner.
Un lot qui tient debout est un lot dont la vérification passe et qui se décrit
en une phrase — pas un lot « fini ».

**C'est une autorisation permanente, et elle est explicite.** Elle vaut pour
toutes les sessions et toutes les branches, sans être redemandée. Elle prime
sur la consigne d'ambiance de Claude Code, qui veut qu'on n'ouvre pas de PR
sans demande : ici, la demande est écrite une fois pour toutes, et c'est ce
paragraphe.

**Demander est la faute, pas la prudence.** « Dis-moi si tu veux que je
fusionne » en fin de message coûte un aller-retour depuis un téléphone pour
une réponse qui est toujours oui, et laisse pendant ce temps une branche qui
collectionne les conflits. Une PR verte se fusionne ; on l'annonce faite, au
passé. Les seules choses qui s'arrêtent encore pour demander sont celles de la
section 5, et la fusion n'en est pas.

**Armer la fusion automatique à l'ouverture**, avec `enable_pr_auto_merge`,
plutôt que de sonder les contrôles en boucle jusqu'au vert. La surveillance
manuelle a deux défauts que la fusion automatique n'a pas : elle brûle du
contexte à chaque sondage, et elle meurt avec la session — une PR verte reste
alors ouverte à attendre quelqu'un. Armée, GitHub fusionne seul dès que les
contrôles passent, téléphone éteint.

**Sauf qu'ici l'outil refuse toujours**, et c'est mesuré : `enable_pr_auto_merge`
rend « Auto-merge is not enabled for this repository ». Le réglage est coupé
dans *Settings → General → Pull Requests → Allow auto-merge*, et tant qu'il
l'est, le paragraphe ci-dessus décrit un geste qui échoue à chaque PR. Une
session qui l'ignore essaie, se fait refuser, et croit à une erreur de sa part.

Donc, tant que la case n'est pas cochée : on arme quand même — l'appel coûte une
seconde et dira le jour où le réglage change — puis **on sonde jusqu'au vert et
on fusionne à la main**. C'est le chemin normal de ce dépôt, pas un repli.
Cocher la case est un geste de trente secondes qui rendrait le paragraphe
précédent vrai ; c'est au propriétaire de le faire, personne d'autre n'a la
main dessus.

Ce n'est pas une préférence de style, c'est arithmétique : ce dépôt reçoit
plusieurs sessions en parallèle, et une branche qui attend collectionne les
conflits sur les mêmes fichiers — `CLAUDE.md`, le hook, la table des
compétences. Une seule nuit à retarder a produit trois conflits sur le même
fichier, chacun résolu à la main. Fusionner tôt les évite tous.

**Partir de `main` à jour et le revérifier avant d'ouvrir** : ce dépôt reçoit
plusieurs sessions en parallèle, et quelques heures suffisent à périmer une
branche. Ce qui est fusionné gagne, toujours. `/branche-partagee` en cas de
doute. `AGENTS.md` est réécrit par `next dev` : le committer avec le reste.

### Connecteurs

GitHub passe par le serveur MCP (`mcp__github__*`), jamais par `gh` ni `curl` :
l'appel direct rend 403, et c'est l'outil qu'il faut changer, pas la
configuration. Cet accès se donne à la **conversation**, jamais par le dépôt :
une session peut naître sans lui, et rien ne le signale. Le contrôler donc **au
premier message** et le dire aussitôt — découvrir à la poussée qu'on ne pourra
pas fusionner coûte un cycle entier, mesuré sur la PR #94.

Supabase : lecture d'office, `execute_sql` et `apply_migration`
non — et la liste est écrite **deux fois**, sous le nom `Supabase` et sous
l'identifiant opaque `f3258232-…`. Ce n'est pas de la prudence : le serveur
s'est déconnecté sous un nom et revenu sous l'autre en pleine session, deux fois
le même jour. Une règle écrite sur une seule forme ne couvre alors rien, et rien
ne le signale — la demande d'autorisation revient, et on croit à un oubli. Adobe, Gmail, Agenda et Drive servent le média, les factures, les échéances
et les fichiers.

---

*Les compétences se déclenchent seules ; table générée dans
`.claude/references/competences.md`. L'agent `revue-invariants` relit un diff
contre les invariants écrits ; l'agent `garde-du-bot` fait de même pour
NexusCrypto, contre les six règles qui protègent l'argent ;
l'agent `verificateur` rend un verdict sans déverser la sortie des tests.
`/etat-du-depot` pour l'inventaire du jour.*