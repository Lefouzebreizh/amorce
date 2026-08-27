# Boîte à Outils IA — annuaire et comparateur

Site de niche à page unique : un annuaire d'outils d'intelligence artificielle
pensé pour capter du trafic de recherche et le convertir en clics affiliés.
**Aucun serveur, aucune base de données, aucune étape de compilation** — trois
fichiers déposés sur n'importe quel hébergement statique suffisent.

```
index.html            l'application entière (HTML + Tailwind par CDN + JavaScript natif)
outils.json           la base de données : c'est le seul fichier à éditer au quotidien
generate-sitemap.js   fabrique sitemap.xml et robots.txt à partir de outils.json
```

## Tester en local

Un navigateur refuse de lire `outils.json` quand la page est ouverte en
`file://` : il faut donc un serveur, même pour un simple essai.

```bash
cd annuaire-ia
npx serve .          # puis ouvrir http://localhost:3000
```

Sans Node, n'importe quel serveur statique fait l'affaire :

```bash
python3 -m http.server 8080     # puis ouvrir http://localhost:8080
```

## Mettre en ligne

1. Remplacer les `lien_affiliation` de `outils.json` par les vrais liens du
   programme d'affiliation (les adresses `exemple-affiliation.com` sont des
   remplaçants).
2. Remplacer `https://exemple.com/` par le vrai domaine dans les balises
   `canonical` et `og:url` de `index.html`.
3. Fabriquer le sitemap et le robots.txt avec l'adresse réelle :

```bash
node generate-sitemap.js https://mon-domaine.com
```

4. Déposer le dossier sur Netlify, Vercel, Cloudflare Pages, GitHub Pages ou un
   simple hébergement mutualisé.
5. Déclarer `https://mon-domaine.com/sitemap.xml` dans Google Search Console :
   c'est ce qui déclenche l'exploration en heures plutôt qu'en semaines.

`sitemap.xml` et `robots.txt` ne sont pas versionnés : ils dépendent du domaine
et se refabriquent à chaque déploiement.

## Ajouter un outil

Une entrée dans le tableau `outils` de `outils.json`, et rien d'autre — ni le
HTML ni le JavaScript ne connaissent la liste. Les boutons de filtre sont
construits à partir des catégories présentes dans le fichier : une nouvelle
catégorie apparaît d'elle-même.

| Champ | Rôle |
| --- | --- |
| `id` | Identifiant en minuscules sans accent. Il sert d'adresse : `?outil=<id>`. Ne plus le changer une fois indexé. |
| `nom`, `categorie`, `prix` | Affichés sur la carte. Le prix est du texte libre. |
| `description_courte` | Une à deux phrases sur la carte. C'est ce que lit un visiteur qui survole. |
| `description_longue` | Le mini-article. `## Titre` fait une section, `- ` une puce, le reste un paragraphe. |
| `lien_affiliation` | Cible du bouton principal, ouverte en `rel="sponsored noopener"`. |
| `score_avis` | Note sur 5, décimale acceptée. Alimente les étoiles et les données structurées. |

L'ordre du tableau est l'ordre d'affichage : c'est le levier éditorial pour
mettre en avant un outil qui convertit bien.

Une nouvelle couleur de catégorie se déclare dans `CATEGORIES_COULEURS` au début
du script ; sans elle, la catégorie s'affiche en gris et tout fonctionne.

## Décisions à connaître avant de modifier

- **Les fiches s'adressent en `?outil=<id>`, jamais en `#id`.** Un fragment n'est
  pas une URL distincte pour un moteur de recherche : le sitemap n'aurait qu'une
  seule adresse à proposer, et les recherches par nom d'outil — l'essentiel du
  trafic qualifié d'un annuaire — n'atteindraient jamais le site. À l'ouverture
  d'une fiche, le titre, la description et l'URL canonique suivent l'outil.
- **La description longue est du texte, convertie en nœuds DOM.** Jamais
  d'`innerHTML` : chaque fiche de la base deviendrait une porte d'entrée pour du
  script injecté.
- **Deux règles de style sont écrites en dur dans la page** (`.hidden` et le
  fond du `body`). Le reste vient du CDN Tailwind ; ces deux-là sont celles dont
  l'absence casse la page au lieu de l'enlaidir — sans `hidden`, la fenêtre de
  détail resterait ouverte par-dessus le contenu.
- **Le bloc `application/ld+json` est fabriqué au chargement** à partir de la
  base. C'est lui qui fait apparaître les étoiles dans les résultats Google, et
  c'est la seule source de trafic gratuite d'un annuaire.
- **Les prix vieillissent vite.** La mention de transparence du pied de page le
  dit au visiteur ; c'est aussi une obligation d'information sur les liens
  affiliés.
