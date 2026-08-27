---
name: annuaire-ia
description: Toucher au réseau d'annuaires d'outils IA (`annuaire-ia/`) — onze sites de niche à page unique qui partagent un gabarit, une automatisation de publication et pas une ligne de contenu. Dit comment vérifier un changement, ce qui casse en silence sur une page sans compilation, et ce qui part en public au nom de quelqu'un. À utiliser dès qu'une demande parle de l'annuaire, d'une niche, d'un outil à ajouter ou à retirer, d'un lien d'affiliation, du gabarit `index.html`, de l'auto-pilote, d'un sitemap, du référencement de ces sites, ou d'un domaine du réseau — y compris quand elle dit seulement « ajoute un outil », « le site est cassé », « change la couleur d'un site », « il faut plus de trafic », « les fiches ne s'affichent plus ». Le projet n'a ni typecheck ni lint : la seule chose qui dise s'il marche est le parcours de vérification décrit ici.
---

# Toucher au réseau d'annuaires IA

**Lire `annuaire-ia/README.md` d'abord.** Il porte la structure, la liste des
onze sites, la mise en ligne, l'auto-pilote et les décisions de conception. Rien
de tout cela n'est répété ici : cette page ne contient que ce qu'on n'apprend
qu'en cassant quelque chose.

## Vérifier — la seule chose qui dise que ça marche

Ce projet n'a ni compilation, ni typecheck, ni lint. Une accolade oubliée, un
identifiant renommé d'un côté seulement, une recherche qui renvoie tout : **la
page a l'air normale** et le défaut ne se voit qu'en l'ouvrant.

```bash
node .claude/skills/annuaire-ia/scripts/verifier.mjs        # niche par défaut
node .claude/skills/annuaire-ia/scripts/verifier.mjs btp    # une niche précise
```

Seize contrôles dans un vrai Chromium, une quinzaine de secondes. Le script sert
le dossier lui-même sur un port libre — `fetch` d'un JSON local est refusé en
`file://`, et dépendre d'un serveur lancé à côté fait rater le parcours une fois
sur deux. Les captures atterrissent dans `.verif-ci/annuaire/`.

Ce qu'il garde, et pourquoi chacun a déjà servi :

- **La recherche discrimine.** Une recherche qui renvoie *toutes* les fiches est
  le défaut le plus discret de cet écran : rien n'a l'air anormal. Le premier
  jeu de données en souffrait — un titre de section répété dans chaque avis
  (« L'avis de la rédaction ») rendait le mot « rédaction » présent partout.
- **Échap referme vraiment.** La fenêtre de détail se cache par la classe
  `hidden`, qui vient du CDN Tailwind. Si le CDN tarde ou est bloqué, elle reste
  ouverte par-dessus la page et le site devient inutilisable — d'où les deux
  règles de style écrites en dur dans `index.html`, qu'il ne faut pas retirer.
- **Un lien profond ouvre la bonne fiche.** `?niche=…&outil=…` est ce que Google
  indexe et ce que les sitemaps annoncent. Une adresse qui ouvre l'accueil au
  lieu de la fiche fait tomber tout le trafic de longue traîne.
- **Rien ne déborde sur un téléphone.** C'est là que le trafic arrive.

Après le parcours, **regarder les captures**. Deux défauts de mise en page sont
passés au travers de contrôles verts : un bouton coupé en deux lignes et une
carte déséquilibrée. Aucune assertion ne les voyait.

## Ajouter une niche : ce que le script attend

Le parcours lit la niche par défaut dans la balise `niche-par-defaut`
d'`index.html` et charge `niches/<id>.json`. Une niche nouvelle est donc
vérifiable sans toucher au script — mais elle doit porter les mêmes clés que ses
voisines. Le plus simple est de copier une niche existante et de tout remplacer,
plutôt que d'écrire le JSON de mémoire.

## Ce qui part en public au nom de quelqu'un

L'auto-pilote publie **tout seul**, tous les deux jours, un outil par niche sur
des domaines qui portent le nom de l'auteur. Trois conséquences :

- Modifier ses gabarits de texte, son ton ou ce qu'il choisit de publier n'est
  pas un changement technique : c'est une décision éditoriale. Elle se soumet,
  elle ne se prend pas à sa place. Pour le ton, `/charte-editoriale`.
- Un lien d'affiliation faux ou mort ne se voit pas depuis le dépôt. Un outil
  ajouté à la main se vérifie en cliquant le lien produit par le parcours.
- La mention de transparence sur les liens affiliés et l'imprécision assumée des
  prix ne sont pas décoratives : les retirer d'un pied de page transforme une
  page honnête en publicité déguisée.

## Deux pièges qui ne se voient pas d'ici

- **Aucun chemin absolu hors du dépôt.** Un chemin sous `/mnt/skills/` existe
  dans une session Claude Code et nulle part ailleurs : le code marche ici et
  échoue partout, sans message utile. Poser ces chemins par variable
  d'environnement, avec le chemin de session pour seul défaut.
- **Pas de framework, pas d'étape de compilation.** C'est ce qui permet de
  déposer le dossier sur n'importe quel hébergement statique et d'y publier sans
  chaîne de build. Introduire un bundler ferait perdre cette propriété au profit
  d'un confort d'écriture — le marché n'en vaut pas la peine ici.
