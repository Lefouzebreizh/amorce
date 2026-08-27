---
name: radar-ia
description: Travailler sur le site d'affiliation auto-piloté Radar IA (`ia-affiliation/`) : le catalogue `outils.json` d'outils d'intelligence artificielle, la page unique qui l'affiche, l'auto-pilote qui publie une fiche tous les deux jours, le sitemap, et les deux workflows GitHub qui mettent le site en ligne. Donne les quatre commandes qui remplacent tout geste manuel, les onze pièges déjà payés (CDN Tailwind qui rend les tests de rendu menteurs, ESLint de la racine, `file://`, commit de bot qui ne déclenche aucun workflow, vivier qui s'épuise au trentième jour) et un tableau symptôme → cause. À utiliser dès qu'une demande parle d'ajouter, de retirer ou de modifier **un outil dans le catalogue** — « ajoute Cursor », « mets Gamma dans la liste des outils », « écris la fiche de Perplexity », « enlève celui-là », « corrige le prix de Midjourney » — ou touche à une fiche, au vivier, à l'auto-pilote, au sitemap, au référencement du site, à ses liens d'affiliation, à sa mise en ligne, à GitHub Pages, au cron de publication. À utiliser aussi quand la demande dit seulement « le site ne se met plus à jour », « il ne publie plus rien », « la page est vide », « ça n'apparaît pas en ligne », « le défi des 30 jours ». Ne pas attendre le mot « Radar IA » : c'est le seul site d'affiliation du dépôt, et la seule liste d'outils qu'il contienne.
---

# Radar IA — le site qui se publie tout seul

Un catalogue JSON, une page qui le lit, un script qui l'allonge, un workflow qui
enchaîne les deux et met en ligne. **Aucun humain entre la publication et le
visiteur** : c'est la promesse du défi des trente jours, et c'est ce qui rend
chaque invariant ci-dessous non négociable — il n'y a personne pour rattraper.

## Où vit quoi

Tout est dans `ia-affiliation/`, sauf les deux workflows, que GitHub ne lit
qu'à la racine.

| Fichier | Rôle |
| --- | --- |
| `outils.json` | **Le** catalogue. Le site n'a pas d'autre source de vérité. |
| `index.html` | La page entière : HTML, Tailwind par CDN, JavaScript natif. Aucun build. |
| `auto-pilot.js` | Publie une fiche par exécution, prise dans le vivier. |
| `generate-sitemap.js` | Réécrit `sitemap.xml` à partir du catalogue. |
| `verifier.mjs` | La barrière. Données, sitemap, et parcours réel dans Chromium. |
| `nouvelle-fiche.mjs` | Fabrique le squelette d'une fiche dans `vivier/`. |
| `servir.mjs` | Serveur local, sans `npx` ni réseau. |
| `vivier/*.json` | Fiches en attente ajoutées après coup (le dossier n'existe qu'une fois créé). |
| `.github/workflows/autopilot.yml` | Le cycle : publier → sitemap → vérifier → committer → mettre en ligne. |
| `.github/workflows/radar-ia-pages.yml` | La mise en ligne sur GitHub Pages. |

## Les quatre commandes

```bash
node ia-affiliation/servir.mjs                    # voir le site : http://127.0.0.1:4321
node ia-affiliation/verifier.mjs                  # la barrière, une seconde
node ia-affiliation/verifier.mjs --navigateur     # + le parcours réel dans Chromium
node ia-affiliation/auto-pilot.js && node ia-affiliation/generate-sitemap.js   # un cycle à la main
```

`verifier.mjs` avant toute poussée, `--navigateur` dès qu'on touche à
`index.html`. `--strict` transforme les avertissements en erreurs : c'est le
contrôle d'avant-lancement, pas celui du quotidien.

## Ajouter un outil

C'est le geste le plus fréquent, il doit coûter deux minutes.

```bash
node ia-affiliation/nouvelle-fiche.mjs "Cursor" "Développement" "À partir de 20$/mois"
# → écrit vivier/cursor.json avec le gabarit d'avis
# remplacer les « À COMPLÉTER », puis :
node ia-affiliation/verifier.mjs
```

La fiche part toute seule à son tour. **Ne pas** l'écrire directement dans
`outils.json` : ce serait publier immédiatement et casser le rythme d'une fiche
tous les deux jours, qui est précisément ce qui envoie à Google un signal de
fraîcheur.

Le tableau `BACKLOG` d'`auto-pilot.js` reste la file d'origine ; `vivier/` la
prolonge. Les deux se fusionnent, le code d'abord, pour que l'ordre de parution
déjà décidé ne bouge pas quand on rallonge la file.

Un avis se juge sur ses **points faibles**. Une fiche sans reproche ne se
distingue pas d'une publicité, et c'est le seul endroit où ce site peut être
meilleur qu'une page de vente.

## Ce qui ne se casse pas

1. **Un seul catalogue fait foi.** La page, le sitemap et l'auto-pilote lisent
   tous `outils.json`. Ne jamais dupliquer une donnée d'outil dans `index.html`
   « pour aller plus vite » : les deux copies divergeraient dès la première
   publication automatique, et personne ne serait là pour le voir.
2. **Ce que le sitemap annonce doit répondre.** Chaque fiche y figure en
   `?outil=<id>`, et `index.html` ouvre l'avis correspondant en changeant le
   titre du document. Inventer des chemins (`/outils/cursor`) donnerait vingt
   404 au robot et disqualifierait le sitemap entier.
3. **Rien ne part sans `verifier.mjs`.** Le workflow l'exécute avant le commit.
   Le retirer, c'est mettre en ligne un JSON cassé un dimanche matin.
4. **Une fiche marquée « À COMPLÉTER » ne se publie pas.** L'auto-pilote la
   saute et le dit. C'est le dernier filet avant une fiche à trous mise en ligne
   toute seule à huit heures du matin.
5. **L'écriture de `outils.json` est atomique** (fichier temporaire, relecture,
   renommage). Une coupure au milieu d'un `writeFile` laisserait un catalogue
   tronqué, c'est-à-dire un site entièrement vide.
6. **Les identifiants sont des URLs.** Minuscules, sans accent, sans espace.
   Changer l'`id` d'une fiche déjà publiée casse l'URL que Google a indexée.

## Les onze pièges déjà payés

Chacun a coûté au moins une heure. Aucun ne se devine.

- **Le CDN Tailwind absent rend les tests menteurs.** Hors ligne ou derrière un
  mandataire, `cdn.tailwindcss.com` ne charge pas : `.hidden` n'existe alors pas,
  et Playwright répond « visible » pour un élément masqué. Un contrôle « la
  modale s'ouvre » passait au vert alors que rien ne s'ouvrait. Juger sur
  `classList.contains('hidden')`, jamais sur `isVisible()`. `verifier.mjs` le
  fait déjà et signale le CDN manquant en avertissement.
- **L'ESLint de la racine analyse ce projet.** C'est celui d'Amorce, Next.js et
  TypeScript : il interdit `require()`. Le dossier est donc ignoré dans
  `eslint.config.mjs`, avec `look_and_find/` et `agence/`. Ne pas « corriger »
  les scripts en ESM pour contourner : `node auto-pilot.js` doit rester
  exécutable sans configuration, c'est ce que fait le workflow.
- **`file://` donne une page vide.** `outils.json` se lit par requête réseau ;
  un double-clic sur `index.html` la bloque. D'où `servir.mjs`, et l'encadré
  d'explication déjà présent dans la page.
- **Un commit poussé par le jeton d'Actions ne déclenche aucun workflow.**
  Protection anti-boucle de GitHub, pas un réglage. Sans l'appel explicite
  `uses: ./.github/workflows/radar-ia-pages.yml` à la fin de l'auto-pilote, la
  fiche du jour n'apparaîtrait en ligne que deux jours plus tard.
- **Le workflow appelé hérite du SHA d'avant la publication.** D'où `ref: main`
  explicite dans son `checkout` : sans lui on met en ligne le catalogue de
  l'avant-veille, et rien ne le signale.
- **Le push du bot exige un réglage de dépôt.** Settings → Actions → General →
  Workflow permissions → *Read and write*. Sans lui, tout réussit puis la
  dernière ligne échoue.
- **`0 8 */2 * *` veut dire « les jours impairs du mois »**, pas « toutes les
  48 heures ». Le passage du 31 au 1er enchaîne deux exécutions. C'est accepté :
  sortir de cron pour une fiche de plus un mois sur deux ne vaut pas le coût.
- **Le vivier codé en dur tient trente jours pile** (15 fiches × 2 jours). Au
  trente et unième, l'auto-pilote sort en vert sans rien publier. Il alerte dès
  qu'il reste trois fiches ; `verifier.mjs` affiche l'autonomie en jours à
  chaque passage.
- **`history.replaceState` échoue en `file://`.** Enveloppé dans un `try` : la
  fiche doit rester consultable même quand l'URL ne peut pas être réécrite.
- **Chromium de ce dépôt n'est pas à la révision qu'attend Playwright.**
  `AMORCE_CHROMIUM` ou `/opt/pw-browsers/chromium`, jamais `playwright install`.
  `verifier.mjs` résout ce chemin tout seul.
- **Vingt avertissements identiques ne se lisent pas.** Les liens d'affiliation
  d'exemple sont comptés et signalés en une ligne. Toute nouvelle vérification
  qui peut sortir une fois par fiche doit être agrégée de la même façon, sinon
  la sortie du vérificateur devient un mur qu'on saute.

## Symptôme → cause

| Ce qu'on observe | Ce que c'est presque toujours |
| --- | --- |
| La page est vide, aucune carte | Ouverte en `file://`, ou `outils.json` cassé → `node servir.mjs`, puis `verifier.mjs` |
| Le site ne publie plus rien | Vivier épuisé → `nouvelle-fiche.mjs` |
| Le workflow est vert, mais le site n'a pas changé | La mise en ligne n'a pas tourné, ou Pages n'est pas réglé sur « GitHub Actions » |
| Le workflow échoue à la dernière étape | Permissions d'écriture du dépôt (voir plus haut) |
| Le sitemap n'a pas la dernière fiche | `generate-sitemap.js` n'a pas été relancé ; `verifier.mjs` le dit et le régénère |
| Une fiche s'affiche deux fois | Identifiant en double entre `outils.json` et le vivier |
| La page est brute, sans style | CDN Tailwind injoignable — le comportement, lui, est intact |
| Un test de rendu passe alors que rien ne marche | Le piège du CDN ci-dessus : juger sur `classList` |

## Les trois réglages à faire une fois

Ils ne sont pas dans le code et ne peuvent pas y être.

1. **Settings → Actions → General → Workflow permissions** → *Read and write*.
2. **Settings → Pages → Source** → *GitHub Actions*.
3. **Settings → Secrets and variables → Actions → Variables** → `SITE_URL` avec
   le vrai domaine (sur Pages : `https://<compte>.github.io/<dépôt>`), et la
   même adresse dans la balise `<link rel="canonical">` d'`index.html`.

Tant que le troisième n'est pas fait, `verifier.mjs` le rappelle à chaque
passage.

## Ce que cette compétence ne couvre pas

Le **texte** des fiches quand il s'adresse au public d'Erwann : voir
`/charte-editoriale`. Le **choix** des outils à mettre en avant relève de son
jugement, pas d'une recette. Et rien de ce qui touche au studio Amorce, à
`agence/` ou aux huit autres projets du dépôt : ce site n'a aucun code commun
avec eux.
