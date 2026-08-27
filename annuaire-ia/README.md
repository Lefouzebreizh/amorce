# Réseau d'annuaires IA — dix sites, un seul code

Onze sites de niche à page unique — un annuaire d'outils d'intelligence
artificielle par métier — qui partagent **le même gabarit et la même
automatisation**, mais **pas une ligne de contenu**. C'est la condition pour
qu'un réseau de sites d'affiliation ne se fasse pas déclasser pour contenu
dupliqué : ce qui est commun est technique, ce qui est visible est propre à
chaque niche.

**Aucun serveur, aucune base de données, aucune étape de compilation.** Un
dossier déposé sur un hébergement statique, et le site tourne.

```
index.html            le gabarit unique — il se configure sur la niche demandée
niches/<niche>.json   une base par site : identité, charte, outils, avis
auto-pilot.js         publie un nouvel outil par niche à chaque exécution
generate-sitemap.js   fabrique un sitemap et un robots.txt par domaine
sitemaps/             leur sortie, versionnée parce qu'elle est déterministe
```

Le travail programmé qui fait tourner tout cela sans intervention est dans
`.github/workflows/autopilot.yml`, à la racine du dépôt.

## Les onze sites

| Niche | Métier visé | Domaine prévu |
| --- | --- | --- |
| `immobilier` | Agents et négociateurs | ia-immobilier.fr |
| `btp` | Conducteurs de travaux, entreprises du bâtiment | ia-btp.fr |
| `rh` | Recruteurs, responsables RH | ia-rh.fr |
| `comptabilite` | Experts-comptables, collaborateurs de cabinet | ia-comptabilite.fr |
| `juridique` | Avocats, juristes d'entreprise | ia-juridique.fr |
| `education` | Enseignants, formateurs | ia-education.fr |
| `restauration` | Restaurateurs, gérants | ia-restauration.fr |
| `sante` | Médecins, professionnels de santé | ia-sante.fr |
| `ecomm` | E-commerçants | ia-ecommerce.fr |
| `architecture` | Architectes, maîtres d'œuvre | ia-architecture.fr |
| `generaliste` | Tous métiers — l'annuaire d'origine | boite-a-outils-ia.fr |

Les domaines sont écrits dans chaque base (`niche.domaine`) : c'est de là que
`generate-sitemap.js` les lit. Les changer là suffit.

## Tester en local

Un navigateur refuse de lire un fichier `.json` quand la page est ouverte en
`file://` : il faut un serveur, même pour un simple essai.

```bash
cd annuaire-ia
npm start                     # sert le dossier sur http://localhost:8080
```

Puis, dans le navigateur :

```
http://localhost:8080/                      → la niche par défaut (immobilier)
http://localhost:8080/?niche=btp            → le site BTP
http://localhost:8080/?niche=sante          → le site santé
http://localhost:8080/?niche=btp&outil=togal-ai   → la fiche ouverte, comme depuis Google
```

Sans Node, n'importe quel serveur statique fait l'affaire :

```bash
python3 -m http.server 8080
```

## Faire tourner l'auto-pilote

```bash
cd annuaire-ia
npm run autopilot:essai   # montre ce qui serait publié, sans rien écrire
npm run autopilot         # publie un outil par niche et écrit les fichiers
npm run sitemap           # refabrique les onze sitemaps dans sitemaps/
```

L'auto-pilote tient une **réserve de cinq outils par niche**, déjà rédigés,
dans `auto-pilot.js`. À chaque exécution il en publie un par site, tiré au sort
parmi ceux qui ne sont pas encore en ligne, daté du jour. Quand la réserve
s'épuise, il le dit et ne casse rien — c'est le signal qu'il faut la
réalimenter.

Le travail programmé fait la même chose tous les deux jours à 08:00 UTC, puis
committe et pousse sur `main` tout seul.

## Mettre un site en ligne

1. Remplacer les `lien_affiliation` de la niche par les vrais liens du
   programme d'affiliation (les adresses `exemple-affiliation.com` sont des
   remplaçants).
2. Vérifier le `domaine` de la niche dans son fichier JSON.
3. Déposer sur le domaine : `index.html`, le dossier `niches/`, et **une seule
   ligne à changer** — celle qui désigne la niche servie par défaut :

```bash
sed -i 's/content="immobilier"/content="btp"/' index.html
```

4. Renommer `sitemaps/sitemap-btp.xml` en `sitemap.xml` et
   `sitemaps/robots-btp.txt` en `robots.txt`, à la racine du domaine.
5. Déclarer `https://mon-domaine.fr/sitemap.xml` dans Google Search Console :
   c'est ce qui déclenche l'exploration en heures plutôt qu'en semaines.

Le dossier `niches/` peut être déployé en entier sur chaque domaine sans
inconvénient : rien n'y mène, et la niche servie est celle de la balise.

## Ajouter un outil, une niche

Un outil, c'est une entrée dans le tableau `outils` de la base — ni le HTML ni
le JavaScript ne connaissent la liste, et les boutons de filtre sont construits
à partir des catégories présentes dans le fichier.

| Champ | Rôle |
| --- | --- |
| `id` | Identifiant en minuscules sans accent. Il sert d'adresse : `?niche=x&outil=<id>`. Ne plus le changer une fois indexé. |
| `nom`, `categorie`, `prix` | Affichés sur la carte. Le prix est du texte libre. |
| `description_courte` | Une à deux phrases sur la carte. C'est ce que lit un visiteur qui survole. |
| `description_longue` | Le mini-article. `## Titre` fait une section, `- ` une puce, le reste un paragraphe. |
| `lien_affiliation` | Cible du bouton principal, ouverte en `rel="sponsored noopener"`. |
| `score_avis` | Note sur 5, décimale acceptée. Alimente les étoiles et les données structurées. |
| `date_ajout` | Date au format `AAAA-MM-JJ`. Elle pilote le badge « Nouveau », la date d'entête et le `lastmod` du sitemap. |

Une niche, c'est un fichier de plus dans `niches/`, avec son bloc `niche`
(identité, domaine, accroches, balises, deux couleurs) et ses outils. Rien
d'autre à déclarer : ni dans le gabarit, ni dans les scripts. Pour que
l'auto-pilote l'alimente, lui ajouter une entrée dans `BACKLOG`.

## Décisions à connaître avant de modifier

- **Les couleurs de niche passent par deux variables CSS**, jamais par des
  classes Tailwind fabriquées en JavaScript. Le CDN compile ce qu'il voit dans
  le DOM, et une classe construite à la volée arrive parfois après le premier
  rendu ; une variable s'applique au moment où on l'écrit.
- **Toutes les adresses portent `?niche=<id>`**, y compris l'accueil d'un
  domaine qui sert déjà cette niche. C'est la forme qu'écrit la balise
  canonique et celle que contient le sitemap : deux formes concurrentes pour la
  même page, ce sont deux pages en double aux yeux de Google.
- **Les fiches s'adressent en `?outil=<id>`, jamais en `#id`.** Un fragment
  n'est pas une URL distincte pour un moteur de recherche : le sitemap n'aurait
  qu'une adresse par site à proposer, et les recherches par nom d'outil —
  l'essentiel du trafic qualifié d'un annuaire — n'atteindraient jamais rien.
- **La description longue est du texte, convertie en nœuds DOM.** Jamais
  d'`innerHTML` : chaque fiche de la base — et donc chaque outil publié
  automatiquement — deviendrait une porte d'entrée pour du script injecté.
- **Un `?niche=` inconnu retombe sur la niche du domaine.** Le panneau d'erreur
  est réservé au cas où c'est cette base-là qui manque ; un visiteur avec un
  lien mal recopié voit le site, pas un message technique.
- **`lastmod` est la vraie date d'ajout, jamais celle du jour.** Un sitemap qui
  déclare tout modifié à chaque passage perd sa crédibilité auprès du moteur,
  qui cesse alors de s'y fier pour prioriser son exploration.
- **La réserve de l'auto-pilote est écrite à la main, dans le script.** Un
  contenu publié sans relecture doit avoir été écrit une fois par un humain :
  la réserve est le point où cette relecture a eu lieu.
- **Deux règles de style sont écrites en dur dans la page** (`.hidden` et le
  fond du `body`). Le reste vient du CDN Tailwind ; ces deux-là sont celles dont
  l'absence casse la page au lieu de l'enlaidir.
- **Les prix vieillissent vite.** La mention de transparence du pied de page le
  dit au visiteur ; c'est aussi une obligation d'information sur les liens
  affiliés.

## Ce que cette architecture ne fait pas

- **Le titre et la description de la page sont posés par JavaScript.** Les
  moteurs qui exécutent le JavaScript les voient, les autres lisent le gabarit
  brut. Sans serveur ni compilation, c'est le compromis assumé ; si le
  référencement devait plafonner pour cette raison, l'étape suivante est de
  pré-écrire un `index.html` par domaine plutôt que d'ajouter un serveur.
- **Rien ne vérifie qu'un lien d'affiliation est encore valide.** L'auto-pilote
  publie ce que contient la réserve ; c'est à la relecture humaine de cette
  réserve que la vérification appartient.
