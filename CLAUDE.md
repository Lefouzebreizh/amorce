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
restriction et assombrissement MIUI coupé. Détail dans `/tailwind-mobile-ux`.

## 3. MÉMOIRE

La mémoire vit dans ce fichier, dans `.claude/skills/` et dans `INDEX.md` —
jamais dans la discussion. Une leçon s'écrit dans la compétence concernée le
jour même, sinon elle est perdue. Fil qui s'alourdit → `/relais`.

## 4. STACK

Ce dépôt porte plusieurs projets, chacun avec sa pile réelle :

- **Amorce** (racine) — Next.js **16.3.2**, React 19, Tailwind v4, TypeScript
  strict. Tout tourne dans le navigateur : ni serveur, ni base, ni route API.
- **agence/** — Next.js 16, Supabase (PostgreSQL + RLS), Server Actions, shadcn.
  Se vérifie depuis son dossier, jamais depuis la racine.
- **look_and_find/** — Flutter, Clean Architecture, Riverpod 3.
- **kdp/, life-organizer/, montage-auto/, paper-manager/, repondeur-facebook/** — Python.
- **annuaire-ia/** — onze sites de niche à gabarit partagé.
- **tiktok/** — concepts et scripts, sans code. **archives-backlog/** — deux
  chantiers en sommeil : `mon-app-audio/` et `patrimoine/`, tests verts, mis de
  côté et non abandonnés.

Build vert obligatoire avant toute poussée. R2 / D1 / Workers ne sont utilisés
nulle part aujourd'hui : les écrire ici comme acquis serait faux. À poser comme
cap si un projet les adopte.

## 5. ANTI-BLOCAGE

Capacité qui manque → `skill-creator`, on fabrique (dossier, code, doc), on s'en
sert dans la foulée. Trois par session au plus. Vérifier la doc officielle avant
d'écrire contre une API : `/api-tierce-verifiee`.

Avant de promettre un résultat qui dépend du réseau ou d'un outil :
`/capacites-session`. Aujourd'hui **ni clé fal.ai, ni clé ElevenLabs**, et
Hugging Face refusé par le mandataire — donc pas de transcription automatique.
`fal-flux-image`, `fal-luma-video`, `fal-upscaler`, `eleven-sfx` se construisent
le jour où les clés arrivent : une compétence qui ne peut pas tourner est un
mensonge dans la liste.

Dépendance manquante pour de bon : `/dependance-indisponible`. Session qui
refuse d'avancer : `/debloquer`.

## 6. DONE, ET CE QU'ON NE FAIT JAMAIS

**Done** = vérification verte + **regardé, pas seulement mesuré** + leçon écrite.

Le « regardé » n'est pas décoratif : six montages ont été livrés en une nuit,
chacun mesuré conforme, chacun rejeté à l'écoute. Le défaut se voyait en une
seconde sur un spectrogramme que personne n'avait tiré. Pour un média,
`/voir-le-son` avant de livrer ; pour un lot, `/trier-les-rushes` avant de
choisir.

**Jamais** : procédé qui manipule, faux témoignage, promesse de guérison,
pistage sans consentement, binaire versionné.

## 7. AU DÉMARRAGE

Le hook `.claude/hooks/session-start.sh` installe tout seul. Pas de compétence
`auto-update-godmode` : quatre s'en partagent le travail — `/etat-du-depot`,
`/capacites-session`, `/coherence-depot`, `/jauge`.

Après avoir ajouté un projet, une compétence ou un agent : `/coherence-depot`.
C'est le geste qui rend la documentation fausse.

## 8. CONTEXTE PROJET CONSERVÉ

### Commandes

`npm run dev | build | typecheck | lint | test` — Amorce. `npm run fixtures`
puis `npm run verify` : parcours complet dans un vrai Chromium, plus
`verify:reprise` et `verify:partage`. Les tests unitaires ne voient ni le canvas,
ni le son, ni l'export, ni le mobile — seul `verify` les couvre. `/verifier`
donne la séquence de chaque projet.

### Invariants d'Amorce — les casser casse l'application

1. **Un seul chemin de rendu.** `renderFrame` est le seul à savoir à quoi
   ressemble une image ; aperçu et export l'appellent tous deux.
2. **Deux couches vidéo au plus.** `timeline.ts` borne toute transition à 45 %
   du plus court des deux clips.
3. **Un `<video>` par clip, six au plus.** Un navigateur Android n'accorde que
   six à huit décodeurs ; au-delà, l'export sort noir sans erreur.
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
PR menées de bout en bout : ouvrir, vérifier, passer au vert, fusionner.

**Partir de `main` à jour et le revérifier avant d'ouvrir** : ce dépôt reçoit
plusieurs sessions en parallèle, et quelques heures suffisent à périmer une
branche. Ce qui est fusionné gagne, toujours. `/branche-partagee` en cas de
doute. `AGENTS.md` est réécrit par `next dev` : le committer avec le reste.

### Connecteurs

GitHub passe par le serveur MCP (`mcp__github__*`), jamais par `gh` ni `curl` :
l'appel direct rend 403, et c'est l'outil qu'il faut changer, pas la
configuration. Supabase : lecture d'office, `execute_sql` et `apply_migration`
non. Adobe, Gmail, Agenda et Drive servent le média, les factures, les échéances
et les fichiers.

---

*Les compétences se déclenchent seules ; table générée dans
`.claude/references/competences.md`. L'agent `revue-invariants` relit un diff
contre les invariants écrits, l'agent `verificateur` rend un verdict sans
déverser la sortie des tests. `/etat-du-depot` pour l'inventaire du jour.*
