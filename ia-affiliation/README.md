# Radar IA

Site d'affiliation d'outils d'intelligence artificielle qui publie une fiche
tous les deux jours et se met en ligne tout seul. Pas de serveur, pas de base
de données, pas de build : un fichier JSON, une page HTML, deux scripts Node.

## Voir le site

```bash
node servir.mjs      # http://127.0.0.1:4321
```

Un double-clic sur `index.html` donne une page vide : le catalogue se lit par
requête réseau, et le navigateur bloque ça en `file://`.

## Ajouter un outil

```bash
node nouvelle-fiche.mjs "Cursor" "Développement" "À partir de 20$/mois"
```

Le fichier atterrit dans `vivier/`. Remplace les « À COMPLÉTER », puis vérifie.
La fiche partira toute seule à son tour — tant qu'elle porte ces marques, elle
reste hors ligne.

## Vérifier

```bash
node verifier.mjs                # données, sitemap, liens — une seconde
node verifier.mjs --navigateur   # + le parcours réel dans Chromium
```

C'est la même commande que celle du workflow avant chaque publication. Elle dit
aussi combien de jours d'autonomie il reste au vivier.

## Publier à la main

```bash
node auto-pilot.js && node generate-sitemap.js
```

## Réglages à faire une fois sur GitHub

1. Settings → Actions → General → Workflow permissions → **Read and write**
2. Settings → Pages → Source → **GitHub Actions**
3. Settings → Secrets and variables → Actions → Variables → `SITE_URL` avec le
   vrai domaine, et la même adresse dans la balise `<link rel="canonical">`
   d'`index.html`

Et remplacer les liens `exemple-affiliation.com` par les vrais : tant qu'ils
sont là, le site ne rapporte rien. `verifier.mjs` les compte à chaque passage.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `outils.json` | Le catalogue. Seule source de vérité du site. |
| `index.html` | La page entière — Tailwind par CDN, JavaScript natif. |
| `auto-pilot.js` | Publie une fiche du vivier par exécution. |
| `generate-sitemap.js` | Réécrit `sitemap.xml` à partir du catalogue. |
| `verifier.mjs` | La barrière avant toute publication. |
| `nouvelle-fiche.mjs` | Squelette d'une fiche dans `vivier/`. |
| `servir.mjs` | Serveur local, sans `npx` ni réseau. |

Les deux workflows vivent à la racine du dépôt : `.github/workflows/autopilot.yml`
(le cycle de publication) et `radar-ia-pages.yml` (la mise en ligne).
