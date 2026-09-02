@AGENTS.md

# CLAUDE.md — cerveau du dépôt

## 0. GOD MODE

Autonomie totale, zéro permission. Tu construis, tu vérifies, tu montres. 80 % action.

**Cette autonomie vaut pour ce qui naît** : un fichier neuf, une compétence
neuve, un projet neuf. Dès qu'un geste **touche à de l'existant**, le §0 bis
prend le relais : cartographier avant d'écrire, **et annoncer le menu du lot
avant la première écriture**. Résumer §0 bis à la seule cartographie en
retirerait la moitié qui attend une réponse. Les deux ne se contredisent pas :
on garde la vitesse là où rien ne peut être écrasé, et le frein là où quelque
chose peut l'être.

Trois exceptions, et elles seules : ce qui part **en public au nom d'Erwann**
(48 000 membres, une réponse publiée ne se retire pas), ce qui **détruit sans
retour**, ce qui **engage de l'argent**.

**L'autonomie porte sur l'action, jamais sur l'écrasement.** Zéro permission ne
veut pas dire écrire à l'aveugle : ce qu'on remplace, on regarde d'abord qui en
dépend ; ce qu'on écrit, on vérifie d'abord que ça n'existe pas déjà. Les deux
gestes tiennent en un `grep` et sont détaillés en section 10.

**Ces deux gestes-là ne deviennent jamais une question** : cartographier et
chercher un doublon sont libres et se font sans rien demander — la découverte
remplace la supposition, pas l'action. Ce qui passe par le menu du §0 bis, c'est
l'**écriture** qui suit, et seulement quand elle touche à de l'existant.

La distinction n'est pas un détail de rédaction : les confondre dans un sens
suspend la lecture jusqu'au réveil, ce que le §0 bis refuse en propres termes ;
les confondre dans l'autre fait écrire sur de l'existant sans que personne ait
vu passer le geste.

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

**Et un fichier se livre, il ne se décrit pas.** Le pilotage se fait depuis un
téléphone : un fichier qu'on ne peut pas ouvrir en deux gestes est un fichier
perdu. Dès qu'une session produit quelque chose pour le propriétaire — page,
image, document, export, planche — elle le lui **envoie**, directement
téléchargeable. Il l'ouvre, il voit le rendu, il le télécharge, il le transmet
ailleurs. C'est la seule forme qui traverse les trois étapes.

Ce qui accompagne l'envoi, et qui n'est pas facultatif :

- le **chemin exact dans le dépôt**, depuis la racine — jamais « dans le
  dossier des images » ;
- pour un fichier versionné, le **lien GitHub direct vers ce fichier**, sur sa
  branche. Pas le lien du dossier, pas celui de la PR ;
- pour une page en ligne, l'**adresse complète en https, seule sur sa ligne**,
  sans texte autour — elle doit se copier d'un appui long.

« Tu le trouveras dans la branche », « voir la PR », « c'est dans le dossier » :
ces formulations font naviguer à l'aveugle sur un écran de six pouces, et le
fichier n'est jamais ouvert. **Une session qui ne peut pas produire le lien le
dit franchement et explique pourquoi**, plutôt que de décrire vaguement un
emplacement — une adresse approximative coûte plus qu'une absence d'adresse.

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

**Et « go » a un sens fixé.** Ce mot-là, en réponse à un menu ou à une
proposition déjà posée, veut dire : feu vert, on continue ce qui a été proposé
ou déjà entamé. S'il restait plusieurs façons de continuer, prendre la
meilleure pour le propriétaire et avancer — ne pas revenir avec une question
supplémentaire sur ce qui était déjà sur la table.

Ça ne déplace pas la frontière d'avant : une vraie fourche qui n'a **jamais été
posée** — deux visions différentes découvertes en cours de route, par exemple —
reste ce que le §0 appelle une décision de produit, et se nomme avant qu'on
choisisse à la place du propriétaire. « Go » referme un menu déjà ouvert ; il
n'en ouvre pas un nouveau à sa place.

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
- **artisan-express/** — page de vente du site vitrine artisan à 300 €. Next.js
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
- **licence-serveur/** — le serveur de licence d'Amorce, et l'unique exception à
  sa promesse. **Trois routes** — `GET /etat` dit si une clé vaut, `POST /webhook`
  reçoit Stripe, `GET /remise` rend sa clé à l'acheteur contre son identifiant de
  session. Le verbe s'écrit dans les accents graves à dessein : `/coherence-depot`
  lit toute barre oblique suivie d'un nom, entre accents graves, comme une
  compétence — une route documentée sans son verbe s'y fait donc signaler comme
  compétence disparue.
  Une table de deux colonnes utiles, **zéro
  dépendance** : la plateforme fournit `Request`, `Response` et `crypto.subtle`.
  Il sait deux choses — cette clé est-elle authentique, ce paiement tient-il
  toujours — et **aucun média ne l'atteint jamais**.
  **Pas de comptes** : Amorce se vend une fois, 49 €, et une clé suffit. Le
  serveur ne sait donc pas qui vous êtes, seulement qu'une clé a été payée. La
  clé porte sa propre preuve — `AMO-<référence>-<sceau>`, le sceau étant un
  HMAC de la référence — si bien que la base ne répond qu'aux deux questions que
  le calcul ne tranche pas : ce paiement a-t-il eu lieu, a-t-il été remboursé.
  Tout ce qui décide vit dans `src/index.ts`, qui ne connaît que l'interface
  `Base` : la suite entière, **signature Stripe comprise**, s'éprouve sans D1,
  sans wrangler et sans réseau. Se vérifie depuis son dossier.
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
- **motion/** — les habillages animés des séries verticales, en Remotion 4 :
  titres, cartons, logos, rendus en 1080 × 1920 à 30 i/s puis posés sur les
  rushes dans CapCut en mode de fusion « Écran ». Le fond noir y tient lieu de
  canal alpha, parce que CapCut Android ouvre le H.264 sans discuter là où son
  support du WebM alpha est incertain. **La zone sûre est câblée dans le
  code** — boîte fixe à 22–88 % de large, texte qui passe à la ligne au lieu
  de s'étirer : c'est ce qui rend impossible le défaut de l'épisode 1, où un
  titre trop long avait été étiré de 9,8 % à 94,7 % et se faisait manger par
  les boutons de Facebook. **`remotion render` télécharge son Chrome depuis
  `remotion.media`, que le mandataire refuse** : désigner le `headless_shell`
  de Playwright avec `--browser-executable`, et non le `chromium` complet, qui
  échoue sans dire pourquoi. Se vérifie depuis son dossier.
- **chat-traducteur/** — traducteur de miaulements, Python. Deux étages, et le
  premier est un **veto** : YAMNet en TFLite (4,1 Mo, `storage.googleapis.com`,
  car `tfhub.dev`, `kaggle.com` et `huggingface.co` rendent `000`) dit si c'est
  un chat ; rien ne cherche d'intention avant. Le modèle public livre déjà la
  moitié du produit et la livre **mesurée** — il nomme lui-même `Purr`, `Hiss`
  et `Caterwaul`, soit *contentement* et *stress*. Faim et envie de sortir sont
  deux façons de miauler qu'aucun modèle public ne sépare : l'application rend
  `indécis`, avec son propre écran, plutôt qu'un pourcentage inventé.
  **`Cat` ouvre la porte et ne choisit jamais** — c'est une classe parente, qui
  vaut 0,988 là où `Meow` vaut 0,891 ; la laisser concourir perdait la lecture
  directe à tous les coups, et six tests verts ne le voyaient pas. Le noyau est
  en bibliothèque standard **pure** : 20 tests en 1 ms sans rien installer.
  CatMeows n'est pas récupérable d'ici (Zenodo refusé) et ses trois contextes
  ne sont pas les quatre intentions visées. Se vérifie depuis la racine.
- **conseiller-patrimoine/** — la vue d'ensemble du patrimoine, **en lecture
  seule stricte**. Il lit, il ne touche à rien : ni ordre, ni portefeuille, ni un
  seul fichier de NexusCrypto ou du radar. Une dépendance — PyYAML — et le
  raisonnement entier en bibliothèque standard pure.
  **Ce qu'il faut savoir avant de s'étonner d'un total : NexusCrypto ne persiste
  aucune position.** Son portefeuille naît en mémoire à `capital_initial_usd` et
  meurt avec le processus ; seuls se lisent son allocation *cible* et ses
  journaux. Présenter cette cible comme une détention afficherait un patrimoine
  imaginaire et parfaitement plausible — d'où la poche crypto saisie à la main,
  comme le reste. Le radar, lui, a une vraie mémoire, mais une pépite repérée
  n'est pas une pépite détenue : ses trouvailles sortent en notes, jamais dans le
  total.
  **La lecture seule est vérifiée, pas promise** : zéro dépendance réseau, base
  SQLite ouverte en `mode=ro`, porte unique vers l'environnement, et un test qui
  relit le source du paquet pour refuser `requests`, `ccxt`, `yfinance`, un accès
  à `os.environ` hors de cette porte, une manipulation de `sys.path` ou une
  écriture disque — y compris dans un fichier écrit demain. Les quatre refus ont
  été éprouvés en injectant les quatre violations. Un accès bancaire futur sera
  en portée **AISP** (consultation), jamais **PISP** (initiation de paiement).
  Il **absorbe** l'assistant d'allocation qui dormait sous `archives-backlog/`,
  ses 27 tests compris — le dossier a été retiré, et sa fiche
  `archives-backlog/assistant-patrimoine.md` dit ce qui a été repris et pourquoi.
  Se vérifie depuis son dossier.
- **visual_library/** — catalogue de références visuelles : LUT, étalonnages,
  planches de contact, et les paniers à importer dans DaVinci et Premiere.
  1117 lignes de Python, cinq dépendances, et **18 tests verts** depuis le
  01/09/2026 au soir. Il n'était déclaré nulle part avant l'audit du même jour,
  et il est passé de « plus gros chantier nu du dépôt » à entièrement gardé en
  une nuit : le hook l'installe et annonce sa suite, et `verifier.sh` la lance.
  **Son nom n'apparaît pourtant dans aucun des deux** — `verifier.sh` découvre
  les suites Python au lieu de les énumérer, si bien qu'un `grep` sur le nom du
  projet rend zéro et laisse croire qu'il est ignoré. Mesurer ce que la
  découverte rend, jamais chercher le nom.
  Ce que ses tests gardent vaut au-delà de lui : un calque conforme à l'écran de
  montage **disparaît sur un téléphone en plein jour**, exactement comme un
  mixage conforme au casque devient inaudible. Le garder, l'archiver ou le
  retirer n'est toujours pas tranché.
- **tiktok/** — concepts et scripts, sans code. **archives-backlog/** — un
  chantier en sommeil : `mon-app-audio/`, tests verts, mis de côté et non
  abandonné.

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
- **Annoncer ce qu'on va ouvrir, avant de l'ouvrir.** Trois à cinq fichiers
  nommés en une ligne — « je pioche dans X, Y, Z » — puis on lit et on
  continue. Ce n'est **pas** une demande de permission, et ça ne suspend rien :
  c'est un budget dit à voix haute. Une session qui doit écrire la liste
  choisit ; une session qui ouvre au fil de l'eau parcourt. Le propriétaire
  peut couper d'un mot au message suivant, mais le travail n'attend pas sa
  réponse — le paragraphe « jamais de temps mort » du §0 prime.
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
`/capacites-session`. La **voix off se fabrique** : `bande-son/scripts/voix.py`,
par sherpa-onnx, modèle pris en release GitHub, 25× le temps réel et rien qui
sorte de la machine. Deux chemins avaient été essayés et déclarés impossibles ;
c'est le troisième qui répond.

**Et depuis le 01/09/2026, ce n'est plus la clé qui manque, c'est l'hôte.** Une
clé ElevenLabs à accès complet existe — et `api.elevenlabs.io` est refusé par
le mandataire, `connect_rejected`, comme `mcp.hedra.com`. Le tunnel est refusé
**avant** qu'une requête HTTP existe, donc avant toute authentification : une
clé n'y change rien, et il ne sert à rien d'en demander une.

Ce déplacement change la parade, pas la conclusion. **PyPI est joignable**,
donc le SDK officiel s'installe et sa surface se lit : le code s'écrit contre
l'API réelle, s'éprouve sur tout ce qui ne touche pas au réseau, et tourne sur
la machine du propriétaire. `bande-son/scripts/eleven_sfx.py` est écrit ainsi.
`fal-flux-image`, `fal-luma-video`, `fal-upscaler` restent à construire sur ce
modèle — une compétence qui ne peut pas tourner est un mensonge dans la liste,
mais une compétence qui tourne ailleurs qu'ici n'en est pas un, à condition de
dire où.

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
première image.

**Cette phrase disait « une session ne peut donc pas fabriquer une
illustration ». Elle est fausse depuis le 01/09/2026, et voici l'image qui le
prouve.** Le connecteur MCP **ElevenLabs** génère : une illustration a été
produite depuis une session distante — druide de dos sur une crête volcanique,
1344 × 768, modèle `gemini-2.5-flash-image`, **4,57 centimes, dix secondes**.

Ce qui débloque n'est ni une clé ni un hôte ouvert, et c'est ce qui rend la
leçon transposable : **le trafic d'un connecteur MCP ne passe pas par la liste
de domaines de l'environnement.** L'API directe d'ElevenLabs reste refusée au
tunnel — mesuré le même jour — pendant que son connecteur travaille. Chercher à
ouvrir `*.elevenlabs.io` dans la politique réseau était donc inutile pour cet
usage-là.

Le connecteur porte 22 modèles d'image, 47 de vidéo (Veo, Sora, Kling,
Seedance, Runway, jusqu'en 4K avec audio), le **lipsync** — Sync 3, Veed,
OmniHuman, c'est-à-dire le remplaçant de Wav2Lip —, les bruitages, la musique,
la voix, la transcription Scribe et un montage en frise.

**Le piège, relevé au premier essai : le rapport d'image sort en 16:9.** Il
vaut 16:9 par défaut et l'outil de génération **ne l'expose pas** — il se règle
sur le nœud du flux. Une série verticale demande donc un passage par le flux,
sans quoi on paie une image inutilisable qui a pourtant l'air réussie.

**Et le chemin du flux est barré depuis une session distante — mesuré le
02/09/2026.** Le paramètre existe bien : `aspect_ratio`, valeur par défaut
`16:9`, avec `9:16`, `2:3` et `3:4` dans la liste — vérifié sur
`gemini-2.5-flash-image` comme sur `gpt-image-2`, et **les deux ont le même
défaut paysage**. Mais l'outil de génération directe ne le prend pas : il faut
`creative_update_node` pour poser le rapport, puis `creative_run_flow_nodes`
pour lancer — et **c'est ce second appel que le classificateur de session
refuse**, là où la génération directe passe.

La conséquence est pratique et vaut d'être sue avant de promettre une planche :
depuis une session distante, on sait **fabriquer une image**, on ne sait pas
**choisir son cadrage**. Le nœud se configure ici, et se lance d'un clic sur la
page du flux. Un cadrage demandé dans le texte du prompt ne suffit pas — « composition
verticale » a été ignoré et l'image est sortie en 1344 × 768.

Ce qui n'est **pas** mesuré et ne doit pas être supposé : le 9:16 réellement
obtenu, la génération vidéo, le lipsync, et le quota du compte.

**Et un sixième s'est ouvert le 01/09/2026 : l'API Gemini répond.**
`generativelanguage.googleapis.com` rend 404 sur `/` et 403 sur `/v1beta/models`,
avec le JSON « Please use API Key » — de vraies réponses HTTP, là où
ElevenLabs et Hedra n'accordent même pas le tunnel. Une clé y servira donc
réellement, et le SDK `google-genai` s'installe depuis PyPI.

**Ce qui est mesuré s'arrête là, et la ligne suivante existe pour l'empêcher
d'être étendue.** Ont été vérifiés : l'hôte répond, la route existe, l'API
réclame une clé. N'ont été vérifiés ni le quota du palier sans frais, ni
qu'une image en sorte, ni sa résolution, ni qu'elle tienne une charte
graphique. Le paragraphe ci-dessus sur les quatre chemins fermés reste vrai
pour ce qu'il mesure — `fal.run`, `api.openai.com`, `api.stability.ai`,
`image.pollinations.ai`, `huggingface.co` — et sa conséquence « une session ne
peut pas fabriquer une illustration » redevient **une question ouverte**, pas
une réponse. C'est le premier essai avec la clé qui tranchera.

**Un cinquième chemin existe, et il répond — mesuré le 31/08/2026.** Le
connecteur **Canva** est joignable depuis une session distante : son outil de
génération se charge et son schéma s'obtient. Il n'était dans aucune des quatre
mesures ci-dessus, qui restent vraies pour ce qu'elles couvrent.

Ce qui est mesuré, et rien de plus : **le serveur répond et l'outil est
appelable**. N'ont été vérifiés ni le quota réel du compte, ni la résolution
rendue, ni qu'une illustration exploitable en sorte — et surtout pas qu'elle
tienne une charte graphique existante. Une prochaine session qui lit « Canva
marche » et promet une planche referait l'erreur que la ligne suivante décrit.

Le premier essai coûte donc quelque chose : si le compte gratuit est limité,
chaque génération est prise sur un stock fini. **Demander avant de la
dépenser.**

**Mais cela ne bloque pas le tome 1 de KDP, et la phrase qui le disait était
fausse — mesuré le 31/08/2026.** La chaîne a été relancée de bout en bout :
30 pages, aucun carton d'attente, **9 contrôles sur 9 au vert, verdict
PUBLIABLE**, sans une seule image neuve. La planche jamais dessinée — page 15,
*Le secret de l'hermine* — est racontée en prose vectorielle par `page12.py`,
et la couverture a un provisoire qui passe les cinq contrôles de vignette. Le
compte exact des planches et le chemin le moins cher jusqu'au dépôt sont dans
`kdp/README.md`.

La leçon vaut au-delà de KDP : **une impossibilité mesurée ne rend vrai que ce
qu'elle mesure.** Les quatre chemins d'image sont bien fermés ; ce qui était
faux, c'est la conséquence qu'on en avait tirée — et une conséquence fausse
attachée à une mesure juste se relit comme si elle avait été mesurée elle
aussi.

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

**Mais on peut voir si le PC tourne, et c'est ce qu'il faut faire avant de
déclarer un mur.** `list_sessions` le dit en une ligne :

| Dans la fiche | Ce que c'est |
| --- | --- |
| `environment_kind: bridge` + `origin: claude_code_cli` | **le PC** |
| `environment_kind: anthropic_cloud`, origine `android` ou `claude_code_mcp_seed` | un conteneur distant |
| `connection_status: connected` | elle tourne **maintenant** |

Voir n'est pas joindre : le paragraphe ci-dessus tient toujours, on ne lui parle
pas. Le geste est donc de **nommer la session au propriétaire** — son
identifiant et son titre — avec la tâche exacte à y reprendre, et de continuer
sur ce qui ne dépend pas d'elle. C'est lui qui bascule d'un fil à l'autre ; ça
lui coûte un geste, là où une impossibilité annoncée lui coûte la tâche.

**Et le PC n'est pas d'office le meilleur endroit** : les deux murs ne sont pas
les mêmes. Mesuré le 01/09/2026 sur l'agrandissement d'images — le PC tournait
sur Python 3.14, où `basicsr` casse à l'import ; le conteneur distant sur 3.11,
où il passe, mais sans carte graphique et derrière un mandataire qui refuse
`download.pytorch.org` (la roue CPU allégée) tout en laissant passer PyPI et les
objets de release GitHub. Router vers le PC est donc un **choix**, pas un
réflexe : on regarde lequel des deux peut faire le travail, et on le dit.

Dépendance manquante pour de bon : `/dependance-indisponible`. Session qui
refuse d'avancer : `/debloquer`.

**Un blocage levé se reprend, il ne se constate pas.** Un hôte refusé qui répond
de nouveau, un connecteur qui retrouve ses outils, une clé qui marche enfin : la
session qui l'observe reprend dans la foulée la tâche que ce blocage retenait —
elle ne part pas sur une mesure ou une vérification annexe en laissant la tâche
réelle en attente. Le re-sondage de `/capacites-session` sert à corriger une
promesse, pas à remplacer le travail qu'il vient de débloquer. Trouvé le
01/09/2026 : les 475 outils MCP sont revenus pendant qu'une session attendait
sur une tâche vidéo — elle l'a noté, puis est partie mesurer la documentation au
lieu de reprendre la vidéo. Le geste juste : noter en une phrase, puis reprendre
immédiatement ce qui était en attente.

## 7 bis. MULTIMÉDIA — DOCUMENTATIONS ET DIRECTIVES

Numéroté « 7 bis » pour la même raison que le « 0 bis » : d'autres fichiers
citent les sections par leur numéro, et renuméroter casserait ces renvois en
silence.

### 📚 Nouvelles documentations (à charger via `/page` en cas de besoin)

**`/page` n'existe pas dans ce dépôt** — `/coherence-depot` le signale, et
aucune compétence ne porte ce nom. Le mécanisme de chargement reste donc à
définir : soit une commande intégrée du client, soit une compétence à écrire.
En attendant, une documentation se lit par `curl` — quand son hôte répond, ce
qui n'est le cas d'aucune de celles-ci depuis une session distante.

- **Vidéo** : https://ffmpeg.org · https://replicate.com
- **Image** : https://readthedocs.org · https://sharp.pixelplumbing.com · https://developer.mozilla.org
- **Audio** : https://developer.mozilla.org · https://elevenlabs.io · https://librosa.org
- **Web** : https://tailwindcss.com · https://developer.mozilla.org · https://nextjs.org

**Aucune de ces adresses n'est joignable depuis une session distante.** Les
treize ont été sondées le 01/09/2026 : toutes rendent `000`,
`connect_rejected`. `/page` ne les chargera donc pas ici — elles servent sur la
machine du propriétaire, ou après ouverture de la politique réseau de
l'environnement.

Quatre corrections apportées à la liste d'origine, parce qu'une adresse fausse
fait chercher au mauvais endroit :

| écrit | réel |
| --- | --- |
| `github.io` | ce n'est pas un site : c'est le suffixe des pages GitHub |
| `readthedocs.io` | `readthedocs.org` — le `.io` est le suffixe d'hébergement |
| `mozilla.org` | `developer.mozilla.org` — MDN vit là, pas sur la racine |
| `pixelplumbing.com` | `sharp.pixelplumbing.com` — la doc de Sharp est le sous-domaine |

### 🎯 Directives de production multimédia

- **Vidéo** : MoviePy pour les scripts simples, ou des commandes FFmpeg brutes
  au terminal pour l'encodage et la compression. API Replicate pour la
  génération par IA.
- **Image** : traitement par lot avec Pillow (Python) ou Sharp (Node.js). SVG
  propre pour les icônes et illustrations web.
- **Audio** : appels ElevenLabs structurés pour la voix IA, et Librosa en
  Python pour synchroniser l'audio sur le tempo (BPM) de la vidéo.
- **Web** : JavaScript/TypeScript moderne selon MDN, Tailwind CSS pour les
  interfaces, Next.js ou Vite selon le projet.

### Ce que la machine porte réellement, mesuré le 01/09/2026

| outil | état ici | conséquence |
| --- | --- | --- |
| **Librosa** | **0.11.0 présent** | la synchronisation au BPM se fait d'ici, sans rien installer |
| **Pillow** | **12.3.0 présent** | le lot d'images tourne d'ici |
| **Sharp** | **présent** | idem côté Node |
| **ffmpeg** | **7.0.2 statique** | attention, ce binaire n'a **ni `drawtext` ni codecs propriétaires** — voir §7 et §10 |
| **MoviePy** | **absent** | s'installe depuis PyPI, qui est joignable : `pip install moviepy` |
| **Replicate** | **hôte refusé** | la génération par IA ne passe pas par là ici |

**Et pour la voix IA, deux corrections qui changent le geste :**

`api.elevenlabs.io` est **refusé au tunnel** — une clé n'y sert à rien. Mais
deux chemins existent, tous deux mesurés :

1. **Le connecteur MCP ElevenLabs fonctionne** — le trafic d'un connecteur ne
   passe pas par la politique réseau. C'est lui qui a levé l'impossibilité de
   l'image le 01/09/2026, et il porte aussi la voix, les bruitages, la musique,
   le lipsync et la transcription.
2. **La voix off se fabrique déjà sur la machine**, sans réseau ni clé :
   `bande-son/scripts/voix.py`, par sherpa-onnx, à 25× le temps réel. Y
   recourir avant de dépenser des crédits pour une voix qu'on a déjà.

Un rappel qui vaut pour tout ce bloc : ce sont des **directives de production**,
et le §2 les borne toutes. Un son qui vit sous 400 Hz n'existe pas sur un
téléphone, quel qu'en soit l'outil ; une vidéo verticale se juge entre 12 et
45 % de hauteur ; et `/master-telephone` passe avant toute publication.

## 8. DONE, ET CE QU'ON NE FAIT JAMAIS

**Done** = vérification verte + **regardé, pas seulement mesuré** + leçon écrite.

### Les quatre règles de méthode, posées par le propriétaire le 29/08/2026

Elles viennent d'une série de livrables annoncés prêts et qui ne l'étaient pas.
Leur objectif tient en une phrase : **ne plus faire perdre de temps avec un
« c'est bon » qui n'en est pas un.**

1. **Ne jamais présenter un livrable comme prêt sans l'avoir vérifié soi-même,
   en entier et en détail** — pas seulement constaté que l'exécution technique
   s'est terminée sans erreur. Pour une vidéo : **image par image et son en
   continu**. Pour un autre livrable : le contrôle équivalent, adapté à sa
   nature. « Le rendu s'est terminé » n'est pas une vérification, c'est
   l'absence de plantage.
2. **Ne jamais repartir d'une version antérieure ni d'une base différente de la
   dernière version validée** — même partiellement, même pour un correctif
   ciblé. On part toujours de ce qui est demandé dans l'instant. Reprendre une
   base plus ancienne ramène des défauts déjà corrigés, et c'est invisible dans
   un diff qui ne montre que le correctif.
3. **Si un élément déjà validé disparaît ou change par erreur, le corriger
   soi-même, immédiatement**, pour rester fidèle à la dernière version validée.
   Sans redemander confirmation : une voix synchronisée ou des sous-titres qui
   sautent en cours de route ne sont pas une question, ce sont une régression.
4. **En cas de doute sur la conformité, corriger AVANT de livrer, jamais
   après.** Le doute est une raison de vérifier, pas une raison de livrer en
   prévenant.

**Ce que ces règles ne suspendent pas :** le §0 continue de valoir — on n'attend
pas la permission pour corriger, on corrige. Elles ne rendent pas le travail
plus lent, elles déplacent la vérification **avant** l'annonce au lieu
d'**après** le rejet.

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

## 9 bis. RÈGLE D'ARCHIVAGE

Numéroté « 9 bis » pour la même raison que « 0 bis » et « 7 bis » : ne pas
décaler les sections qui suivent.

**Quand Erwann dit simplement « archive », sans autre précision, cela signifie :
clore la session de conversation en cours et en ouvrir une nouvelle.** Pas
archiver un fichier, une PR ou une session distante précise — ces demandes-là
se disent autrement et se traitent autrement. « archive » seul, c'est le geste
du `/relais` : ce skill porte déjà la mécanique (rassembler l'état depuis le
dépôt, jamais de mémoire ; ce qu'on ne ferme pas ; le gabarit du résumé) et
cette section ne la duplique pas — elle en fait un déclencheur explicite.

Avant de clore, un message final qui résume : l'état d'avancement, ce qui
reste à faire, et toute information nécessaire pour reprendre sans perte de
contexte — le gabarit exact est celui de `/relais` (but à terme, où on en est,
le prochain pas, ce qu'il faut savoir, où c'est écrit). Ce résumé se construit
depuis le dépôt (branche, PR ouvertes, `git status`), jamais depuis le souvenir
de la conversation.

**La nouvelle session doit pouvoir démarrer directement avec ce résumé**, sans
qu'Erwann ait à tout retaper. Comme pour tout ce qui se livre à lui (§0) : le
résumé part en fichier téléchargeable, pas seulement affiché dans le message —
il lui suffit de l'ouvrir et de le coller en premier message du fil suivant.

## 10. CONTEXTE PROJET CONSERVÉ

### Commandes

Avant de pousser, une seule commande, quel que soit le projet touché :
`bash .claude/skills/verifier/scripts/verifier.sh`. Elle déduit de ce qui a
changé les projets concernés, lance leurs séquences **en parallèle**, et rend un
verdict par projet suivi de ce qu'elle ne couvre pas.

`npm run dev | build | typecheck | lint | test` — Amorce. `npm run fixtures`
puis `npm run verify` : parcours complet dans un vrai Chromium, plus
`verify:reprise`, `verify:partage`, `verify:images` et `verify:licence`.
Ce dernier est **exclusif** — il construit le paquet de production et sert
l'application lui-même, donc il ne se lance pas pendant qu'un `npm run dev`
tourne, contrairement aux autres. Les tests unitaires ne
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
- **L'export encode hors ligne, image par image**, et ne filme plus l'aperçu.
  Aucune image ne peut donc manquer, quel que soit l'appareil — c'est ce qui a
  remplacé un export mesuré à 12,7 images par seconde au lieu de 30. Le chemin
  temps réel reste en repli pour les navigateurs sans WebCodecs, et c'est le
  seul cas où la cadence peut encore se perdre.
- **Un Chromium libre n'a pas les codecs propriétaires.** Sondé : il refuse
  toutes les chaînes `avc1` à l'encodage comme au décodage, et l'AAC, et ne
  garde que VP9, AV1 et Opus. Rien qui touche au H.264 ne se départage donc sur
  la machine de vérification — seulement sur un vrai appareil.

### Modifier ce dépôt

Chirurgical : chaque ligne changée se rattache à la demande. **Avant de
remplacer une fonction, chercher qui l'appelle** — `grep` sur son nom, dans tout
le dépôt. Un remplacement qui compile n'est pas un remplacement sans appelant,
et c'est le second qui casse à distance. Ne pas « améliorer »
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

### Déploiements Vercel — un `vercel.json` par projet, sinon tout se déclenche

**Trois** projets Vercel sont branchés sur ce dépôt : `amorce` (racine),
`amorce-51up` (dossier `artisan-express`), `iptv`. Ils étaient quatre jusqu'au
31/08/2026 — `nexuscrypto` a été supprimé côté Vercel ce jour-là, ce qui retire
un quart de la consommation. Les mesures datées de ce jour-là, dans `/debloquer`,
portent donc sur **quatre** projets et restent lues telles quelles. **Chacun se
déclenche sur chaque commit tant qu'il ne filtre pas par chemin**, et le palier
gratuit plafonne à cent déploiements par jour — **crevé trois fois**. La
seconde à 80 fusions seulement, parce que le nombre de projets avait doublé
dans la nuit. La troisième le **01/09/2026**, à **18 PR fusionnées** dans la
journée : trois projets branchés, chacun déclenché sur chaque commit, plus les
commits de fusion — le compte y est sans qu'aucune journée n'ait paru
exceptionnelle.

**Ce que ça change en pratique : rien sur le code, tout sur la lecture des
rouges.** Une fois le quota crevé, Vercel refuse *avant* que l'`ignoreCommand`
tourne, donc le filtre de chemins n'y peut rien — c'est déjà écrit trois
paragraphes plus bas, et c'est cette journée-ci qui l'a confirmé une troisième
fois. Le message est explicite quand on le lit : « Resource is limited - try
again in 24 hours (more than 100, code: api-deployments-free-per-day) ».

Le seuil utile à retenir est donc **une vingtaine de fusions par jour**, pas
cent : chaque fusion vaut trois déploiements ou plus.

**Un quatrième projet existe depuis le 02/09/2026, et il ne compte pas dans ce
total : `artisan-express`.** Il est né d'un **dépôt de fichiers**
(`deploy_to_vercel`), pas d'un lien Git — donc aucun commit ne le déclenche, et
il ne consomme rien du quota quotidien. La contrepartie est symétrique : il ne
se met **pas** à jour tout seul quand la branche bouge. Une modification de
`artisan-express/` n'atteint la page en ligne qu'après un nouveau dépôt de
fichiers, et l'arbre envoyé doit contenir `public/` — l'oubli d'`exemple.html`
au premier essai a mis « Voir un site fini, en vrai » en 404 pendant que le
reste de la page servait parfaitement.

Il a fallu passer par là parce que `create_git_project` **réutilise** tout
projet déjà lié au dépôt au lieu d'en créer un : appelé avec
`projectName: artisan-express` et `rootDirectory: artisan-express`, il a rendu
« Reused project amorce-51up ». Le `rootDirectory` ne s'applique qu'à la
création, jamais à une réutilisation.

**Et `amorce-51up` ne sert rien** — mesuré le même jour : `live: false`, et son
dernier déploiement est `CANCELED`. Le décrire comme « le dossier
`artisan-express` en ligne » ferait chercher une page à une adresse qui ne rend
rien.

D'où le filtre : chaque projet porte un `vercel.json` dont l'`ignoreCommand`
appelle `scripts/vercel-ignorer.sh` avec les chemins qui le concernent. Deux
choses à en retenir, et elles se paient toutes les deux en silence :

- **Un projet Vercel qui arrive n'a pas de `vercel.json`** — il se crée depuis
  le tableau de bord et ne laisse aucune trace dans Git. Lui en écrire un est le
  premier geste, sinon il consomme le quota de tous les autres.
- **Un chemin qui entre dans un build doit entrer dans la liste surveillée.**
  Un fichier que le build lit mais que le filtre ignore fait servir une version
  périmée sans qu'aucune ligne rouge n'apparaisse.
- **Et le filtre n'empêche pas le rouge quand le quota est déjà épuisé.**
  L'`ignoreCommand` s'exécute dans le conteneur de construction, donc *après* la
  création du déploiement ; le refus de quota, lui, tombe *avant* — aucun script
  ne tourne. Mesuré le 31/08/2026 sur deux PR de Markdown à trois minutes
  d'écart : quatre rouges sur l'une, un « Ignored » vert et trois rouges sur
  l'autre. Donc un rouge Vercel sur une PR de documentation **n'est pas un
  signal**, et affiner les chemins surveillés ne desserre rien. Le levier est le
  **nombre de projets branchés**. Détail et ce qui reste non mesuré dans
  `/debloquer`.

`nexuscrypto` n'a rien à déployer — ni `package.json`, ni `api/`, et un moteur
qui tourne en boucle n'a pas sa place sur une plateforme de pages. Son projet
Vercel a donc été **supprimé** le 31/08/2026. Son `vercel.json` (`exit 0`) est
néanmoins **conservé**, et ce n'est pas un oubli : ce fichier ne coûte rien et
il rattrape le piège nommé deux paragraphes plus haut — un projet recréé depuis
le tableau de bord n'a pas de `vercel.json` et se déclenche sur tout. La raison
complète est dans `nexuscrypto/README.md` §6 bis.

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

## 10 bis. COORDINATION ENTRE SESSIONS

Numéroté « 10 bis » pour la même raison que les autres : ne pas décaler des
renvois existants.

Plusieurs sessions travaillent en parallèle sur ce dépôt, et certaines écrivent
dans les **mêmes fichiers partagés** — `CLAUDE.md`, `INDEX.md`, la table des
compétences, le hook, et les fichiers transverses comme `SECURITY.md` ou un
`AUDIT.md`. Elles doivent se coordonner **entre elles**, sans faire arbitrer
Erwann à chaque fois.

**Le canal est le dépôt, et lui seul.** Ce n'est pas un choix de style, c'est
une contrainte mesurée deux fois (§7) : `SendMessage` refuse et `ListAgents` ne
rend aucun pair, alors même que `list_sessions` montre les autres sessions en
train de tourner. Une session ne peut donc pas en prévenir une autre ; elle peut
seulement **lire ce qu'elles ont publié** et **publier ce qu'elles liront**.

Ce que « se coordonner » veut dire concrètement, dans l'ordre :

1. **Regarder avant d'écrire.** Avant de toucher un fichier partagé :
   `git fetch`, puis les branches distantes et les PR ouvertes. Une PR ouverte
   sur le même fichier est une session au travail, pas un obstacle.
2. **Fusionner, jamais écraser.** Si une autre session a déjà écrit à cet
   endroit, lire son contenu, garder ses phrases, et ajouter les siennes à
   côté. Reprendre `main` dans sa branche coûte une commande ; écraser le
   travail d'une autre coûte sa session entière.
3. **Le doublon arrête le geste** (§0 bis règle 4). Deux fichiers qui disent la
   même chose se contredisent au premier changement, et c'est le moins bon qui
   est lu une fois sur deux. Étendre l'existant plutôt qu'en poser un second.
4. **Publier tôt.** Tant qu'un lot n'est pas sur `main`, il n'existe pour
   personne d'autre — c'est aussi ce qui rend la fusion rapide utile au-delà des
   conflits.
5. **Se nommer dans ce qu'on publie.** Un fichier transverse gagne une ligne qui
   dit ce qu'il couvre et ce qu'il ne couvre pas : c'est ce qui évite qu'une
   autre session refasse le travail ou croie couvert ce qui ne l'est pas.

**Ne remonter à Erwann qu'en cas de vrai désaccord de fond** — deux visions
incompatibles d'une même règle, une décision de produit, un arbitrage qu'aucune
hypothèse raisonnable ne remplace. Une fusion à faire, un conflit à résoudre, un
doublon à réunir : ça se règle entre sessions, sans lui.

**Et quand une autre session est bloquée**, ce qu'on ne peut pas lui dire se dit
à Erwann : son identifiant, son titre, et la question exacte à laquelle elle
attend une réponse. C'est le seul relais qui existe, et il lui coûte un geste là
où le silence lui coûte la tâche.

---

---

*Les compétences se déclenchent seules ; table générée dans
`.claude/references/competences.md`. L'agent `revue-invariants` relit un diff
contre les invariants écrits ; l'agent `garde-du-bot` fait de même pour
NexusCrypto, contre les six règles qui protègent l'argent ;
l'agent `verificateur` rend un verdict sans déverser la sortie des tests.
`/etat-du-depot` pour l'inventaire du jour.*