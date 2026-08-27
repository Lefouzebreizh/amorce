@AGENTS.md

# CLAUDE.md — cerveau du dépôt

## 0. GOD MODE

Autonomie totale, zéro permission. Tu construis, tu vérifies, tu montres. 80 % action.

Trois exceptions, et elles seules : ce qui part **en public au nom d'Erwann**
(48 000 membres, une réponse publiée ne se retire pas), ce qui **détruit sans
retour**, ce qui **engage de l'argent**.

Agents parallèles et `TodoWrite` quand la tâche le mérite — pas par défaut :
cinq agents sur une tâche simple brûlent la fenêtre hebdomadaire. `/jauge` avant
un gros lot.

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

## 3. MÉMOIRE

La mémoire vit dans ce fichier, dans `.claude/skills/`, dans `INDEX.md` et dans
`second-brain/` — jamais dans la discussion. Ce qui vaut pour **un** projet va
dans sa compétence ; ce qui traverse les projets va dans `second-brain/lecons.md`,
et ce qui se recopie tel quel dans `kits/`. Le jour même : le lendemain on se
souvient du correctif et plus de la cause, et c'est la cause qui vaut. Fil qui
s'alourdit → `/relais`.

## 4. STACK

Ce dépôt porte plusieurs projets, chacun avec sa pile réelle :

- **Amorce** (racine) — Next.js **16.3.2**, React 19, Tailwind v4, TypeScript
  strict. Tout tourne dans le navigateur : ni serveur, ni base, ni route API.
- **agence/** — Next.js 16, Supabase (PostgreSQL + RLS), Server Actions, shadcn.
  Se vérifie depuis son dossier, jamais depuis la racine.
- **look_and_find/** — Flutter, Clean Architecture, Riverpod 3.
- **kdp/, life-organizer/, montage-auto/, paper-manager/, repondeur-facebook/** — Python.
- **pepites/** — radar de pépites crypto multi-chaînes, Python, sans dépendance
  lourde. Cinq étages en file dont l'ordre n'est pas négociable : le calcul
  gratuit ramène des centaines de jetons à vingt-cinq avant le premier appel
  aux API de sécurité, qui répondent trente fois par minute.
- **annuaire-ia/** — onze sites de niche à gabarit partagé.
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
`/capacites-session`. Aujourd'hui **ni clé fal.ai, ni clé ElevenLabs**.
`fal-flux-image`, `fal-luma-video`, `fal-upscaler`, `eleven-sfx` se construisent
le jour où les clés arrivent : une compétence qui ne peut pas tourner est un
mensonge dans la liste.

**La transcription, elle, marche** — et ce blocage-ci a coûté deux sessions
avant d'être levé. `huggingface.co` est refusé par le mandataire, comme
`alphacephei.com` et `openaipublic.azureedge.net` : aucun poids de
`faster-whisper` ne s'y télécharge. Deux hôtes restent ouverts et suffisent :
**PyPI en direct** (listé dans le `noProxy` du mandataire, donc toute roue
embarquant un modèle s'installe) et **les objets de release GitHub**
(`release-assets.githubusercontent.com` répond), où sont publiés les modèles
sherpa-onnx, Whisper compris. Ni TLS ni mandataire touchés. Un zipformer rend en
plus un instant par mot — il n'en existe pas de français, vérifié par requête.

Dépendance manquante pour de bon : `/dependance-indisponible`. Session qui
refuse d'avancer : `/debloquer`.

## 8. DONE, ET CE QU'ON NE FAIT JAMAIS

**Done** = vérification verte + **regardé, pas seulement mesuré** + leçon écrite.

Le « regardé » n'est pas décoratif : six montages ont été livrés en une nuit,
chacun mesuré conforme, chacun rejeté à l'écoute. Le défaut se voyait en une
seconde sur un spectrogramme que personne n'avait tiré. Pour un média,
`/voir-le-son` avant de livrer ; pour un lot, `/trier-les-rushes` avant de
choisir.

**Jamais** : procédé qui manipule, faux témoignage, promesse de guérison,
pistage sans consentement, binaire versionné.

## 9. AU DÉMARRAGE

**Lire ce fichier avant le premier geste, à chaque nouveau fil.** Il est joint au
contexte tout seul — mais joint n'est pas lu, et une session qui enchaîne sur le
résumé de la précédente hérite de son état sans hériter de ses règles. C'est
ainsi qu'on redemande une fusion déjà autorisée une fois pour toutes, ou qu'on
pose un projet sans le déclarer aux six endroits.

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
contre les invariants écrits, l'agent `verificateur` rend un verdict sans
déverser la sortie des tests. `/etat-du-depot` pour l'inventaire du jour.*