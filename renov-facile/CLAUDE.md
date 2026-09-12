Ce projet n'a pas d'`AGENTS.md` : c'est un site statique, HTML/CSS/JS natif,
sans Next.js et sans build — rien à générer, rien à réécrire au démarrage.

## Ce que c'est, en une phrase

Un accompagnement pas à pas pour une demande d'aide à la rénovation
énergétique (MaPrimeRénov', CEE) : avant le dépôt, pendant l'instruction, en
cas de refus ou de blocage. Public différent d'`ensemble-mdph` — moins dans la
détresse psychologique, plus dans le pratico-pratique — mais zéro langue de
bois administrative, comme un pote qui a vécu la galère.

## D'où vient le moteur, et ce qui n'a pas été repris

Le moteur générique de questionnaire (`js/engine.js`), le coffre chiffré
(`js/coffre.js`), le brouillon de reprise (`js/brouillon.js`), les utilitaires
de date (`js/dates.js`) et le rappel `.ics` (`js/ics.js`) sont **portés sans
changement de logique** depuis `Lefouzebreizh/ensemble-mdph` (dépôt séparé,
hors de portée d'ici) — voir `INDEX.md`, tableau « Moteurs techniques
partagés ». Ces fichiers ne connaissent aucun contenu de démarche : toute la
matière propre à la rénovation énergétique vit dans `js/data/renovation.js`,
seul fichier de contenu du site.

Deux choses ont volontairement **pas** été reprises, et ce n'est pas un
oubli :

- **La personnalisation de notice par LLM** (`api/notice.js` côté
  ensemble-mdph) : ce site n'a aucun serveur. `js/engine.js` a été retouché
  pour retirer l'appel `fetch("/api/notice")` — le laisser aurait échoué à
  chaque notice affichée (pas d'API ici), silencieusement pour l'utilisateur
  mais en erreur dans la console à chaque fois, ce que le §8 bis de la racine
  interdit de laisser passer.
- **Le rappel par e-mail et le chat** (`api/alerte-echeance.js`,
  `api/chat.js`, `api/confirmer-alerte.js`, `api/desinscrire-alerte.js` côté
  ensemble-mdph, plus Supabase et Resend) : hors du périmètre demandé pour ce
  lot. Le rappel de calendrier `.ics`, lui, est repris tel quel — il ne
  demande aucun serveur.

Si l'un des deux revient un jour, ne pas recopier ces fichiers à l'aveugle :
`ensemble-mdph` a bougé depuis, et ce dépôt-ci n'a aucun moyen de le savoir
sans le récupérer à nouveau (`add_repo`).

## La charte visuelle

Turquoise lagon (`--lagon: #40e0d0`) sur fond sombre — la même palette
qu'`ensemble-mdph`, demandée explicitement par le propriétaire pour son
ambiance accueillante avant les questions techniques. `css/style.css` est
repris tel quel : les classes qu'il stylise (`.etape`, `.bloc-section`,
`.checklist`, `.message-dynamique`, etc.) sont exactement celles que
`js/engine.js` génère, donc ne pas renommer l'un sans l'autre.

Contrairement à `ensemble-mdph`, qui alterne turquoise et violet d'une carte à
l'autre sur sa grille de douze démarches, ce site n'en a qu'**une** : pas de
grille, un seul accent (turquoise), un bouton unique qui démarre directement
le questionnaire — voir `js/main.js`.

## Ce qui est différent du gabarit MDPH

- **Une seule démarche**, pas un registre de douze : `js/main.js` ne
  construit pas de grille de cartes.
- **Trois branches, pas de sous-arborescence par sujet** :
  `js/data/renovation.js` porte une unique `DEMARCHE_RENOVATION`, avec un
  aiguillage initial (pas encore déposé / en instruction / refusé-bloqué) que
  le propriétaire du produit a lui-même écrit et fourni tel quel — les textes
  des trois blocs ne sont pas à réécrire sans raison.
- **`bloc_blocage` est partagé par deux étapes de notice** (`notice_refus` et
  `notice_silence`) : la première y arrive avec un délai de recours calculé
  (`calcDelaiRecours`), la seconde sans, mais les deux affichent le même
  contenu de fond. Ce n'est pas un doublon, c'est volontaire — voir
  `tests/demarches.test.mjs`, qui l'autorise explicitement.

## Les trois règles qui ne dépendent pas du projet

Posées dans le `CLAUDE.md` de la racine, rappelées ici à la demande du
propriétaire.

**Ce bloc dit la règle, jamais son détail.** Le détail vit à la racine, à
l'endroit cité, et ne se recopie pas : une règle écrite à deux endroits diverge
au premier changement.

1. **Jamais un minimum qui fonctionne juste** — racine, §1 ter. « Ça marche »
   et « les tests sont verts » sont le début du travail, pas sa fin.
2. **`Projet : renov-facile` en tête de la toute première réponse** — racine,
   §9 — et rappelé à chaque changement de sujet.
3. **Rebase sur `main` à jour avant d'ouvrir la pull request** — racine,
   section Git — puis fusionner dès que le lot tient debout.

   ```bash
   git fetch --prune -q origin main && git rebase origin/main
   ```

## Vérifier ce projet

```bash
cd renov-facile
npm test           # dates, coffre, .ics, brouillon, structure de la démarche
python3 -m http.server 8080   # puis ouvrir index.html dans un vrai navigateur
```

Les tests automatiques ne couvrent ni le rendu DOM (`js/engine.js`
manipule directement le DOM), ni les icônes, ni la mise en page — comme pour
`ensemble-mdph` (voir son `CLAUDE.md`, §« Ce que ces deux règles ont déjà
coûté »). **Parcourir les trois branches dans un vrai navigateur avant de
déclarer le travail terminé**, pas seulement lancer `npm test`.

Tout le reste — invariants du dépôt, garde-fous, zones sensibles — est dans le
`CLAUDE.md` de la racine. Le relire avant chaque changement, pas seulement au
début du fil.

Et avant le premier geste : `inbox/renov-facile.md`, la boîte aux lettres de
ce chantier.
