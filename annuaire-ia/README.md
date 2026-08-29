# Réseau d'annuaires IA — onze sites, un seul code

Onze sites de niche à page unique — un annuaire d'outils d'intelligence
artificielle par métier — qui partagent **le même gabarit et la même
automatisation**, mais **pas une ligne de contenu**. C'est la condition pour
qu'un réseau de sites d'affiliation ne se fasse pas déclasser pour contenu
dupliqué : ce qui est commun est technique, ce qui est visible est propre à
chaque niche.

**Aucun serveur, aucune base de données, aucune étape de compilation au
déploiement.** Un dossier déposé sur un hébergement statique, et le site tourne.

```
index.html            le gabarit unique — il se configure sur la niche demandée
styles.src.css        la source de la feuille ; styles.css est le fichier compilé
niches/<niche>.json   une base par site : identité, charte, outils, avis
auto-pilot.js         publie un outil par niche ; contient la réserve rédigée
valider.js            la seule définition de ce qu'est une base valide
verifier.mjs          le parcours en vrai navigateur
construire-styles.mjs compile la feuille
construire-sites.js   fabrique dist/<niche>/, prêt à déposer sur son domaine
generate-sitemap.js   sitemaps/sitemap-<niche>.xml et robots-<niche>.txt
nouvelle-niche.js     dégrossit un douzième site
alerte-reserve.js     rédige le billet quand la réserve s'épuise
```

Deux travaux automatisés à la racine du dépôt :
`.github/workflows/autopilot.yml` publie et pousse tous les deux jours ;
`.github/workflows/annuaire-ia.yml` est la barrière de vérification.


**Les liens d'affiliation sont encore ceux de démonstration.** Les programmes
à ouvrir, leurs commissions et leurs adresses d'inscription sont rassemblés dans
[`AFFILIATION.md`](AFFILIATION.md).

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
les sitemaps et les sites construits les lisent. Les changer là suffit.

## Mise en ligne

Automatique : toute poussée sur `main` touchant ce dossier construit les onze
sites et les dépose sur Cloudflare Pages, sous un projet unique où chaque niche
occupe son sous-dossier. L'auto-pilote appelle le même workflow après avoir
publié.

Les adresses publiques se règlent en une commande, jamais à la main :

```bash
node regler-domaines.mjs --etat
node regler-domaines.mjs btp https://ia-btp.fr
```

## Tester en local

Un navigateur refuse de lire un `.json` en `file://` : il faut un serveur, même
pour un simple essai.

```bash
cd annuaire-ia
npm start                     # http://localhost:8080
```

```
http://localhost:8080/                            → la niche par défaut (immobilier)
http://localhost:8080/?niche=btp                  → le site BTP
http://localhost:8080/?niche=btp&outil=togal-ai   → la fiche ouverte, comme depuis Google
```

## Les commandes

```bash
npm run valider          # les données : instantané, à lancer tout le temps
npm run styles           # recompile styles.css — après toute classe ajoutée
npm run verifier         # ouvre vraiment les pages dans Chromium
npm run verifier btp     # une seule niche, pour isoler un défaut
npm run autopilot:essai  # ce que l'auto-pilote publierait, sans rien écrire
npm run autopilot        # publie un outil par niche
npm run reserve          # combien de passages avant la panne sèche
npm run sitemap          # refabrique les onze sitemaps
npm run sites            # fabrique dist/<niche>/, prêt à déposer
npm run niche            # dégrossit un douzième site
```

`valider.js` distingue **erreurs** et **alertes** : une erreur casse un site et
arrête tout ; une alerte coûte du trafic mais pas le site, elle s'affiche et
laisse passer. Bloquer une publication sur une longueur de balise reviendrait à
préférer un site figé à un site imparfait.

## L'auto-pilote

Il tient une **réserve de cinq outils par niche**, déjà rédigés, dans
`auto-pilot.js`. À chaque exécution il en publie un par site, tiré au sort
parmi ceux qui ne sont pas en ligne, daté du jour. Le travail programmé fait
la même chose tous les deux jours à 08:00 UTC, puis committe et pousse.

Il publie en priorité les outils **vendus en libre-service** tant qu'une niche
compte plus d'outils « sur devis » que d'outils à prix affiché. Un outil vendu
par un commercial n'a pas de programme d'affiliation : au lancement, `juridique`
n'avait que ceux-là, `btp` et `rh` trois sur quatre. `valider.js` le signale, le
tirage le corrige.

Quand il ne reste que deux passages, il **ouvre un billet** sur le dépôt. C'est
volontaire : une réserve vide ne casse rien — le script continue de tourner
sans rien publier, l'intégration continue reste verte, et le réseau se fige en
silence. C'est le seul point qui demande une main humaine, il ne doit pas être
découvert trois semaines trop tard.

## Mettre un site en ligne

```bash
npm run styles && npm run sites
```

`dist/<niche>/` contient tout : un `index.html` dont la tête est **déjà
remplie** (titre, description, balises sociales, canonique, couleurs), la
feuille, la base de cette seule niche, `sitemap.xml` et `robots.txt`. Déposer
le contenu à la racine du domaine, puis déclarer le sitemap dans Google Search
Console — c'est ce qui déclenche l'exploration en heures plutôt qu'en semaines.

Il reste à remplacer les `lien_affiliation` par les vrais liens du programme
d'affiliation : tant qu'ils sont en `exemple-affiliation.com`, `npm run valider`
le rappelle à chaque exécution et le réseau ne rapporte rien.

## Ajouter un outil, une niche

Un outil, c'est une entrée dans le tableau `outils` de la base — ni le gabarit
ni les scripts ne connaissent la liste, et les boutons de filtre se construisent
sur les catégories présentes.

| Champ | Rôle |
| --- | --- |
| `id` | Identifiant en minuscules sans accent. Il sert d'adresse : `?niche=x&outil=<id>`. Ne plus le changer une fois indexé. |
| `nom`, `categorie`, `prix` | Affichés sur la carte. Le prix est du texte libre. |
| `description_courte` | Une à deux phrases sur la carte. C'est ce que lit un visiteur qui survole. |
| `description_longue` | Le mini-article, en quatre sections : verdict, points forts, points faibles, idéal pour. `## Titre` fait une section, `- ` une puce. |
| `lien_affiliation` | Cible du bouton principal, ouverte en `rel="sponsored noopener"`. |
| `score_avis` | Note sur 5, décimale acceptée. Alimente les étoiles et les données structurées. |
| `date_ajout` | `AAAA-MM-JJ`. Pilote le badge « Nouveau », la date d'entête et le `lastmod` du sitemap. |

Une niche se dégrossit d'une commande :

```bash
node nouvelle-niche.js transport "IA Transport" 🚚 https://ia-transport.fr \
  --metier "transporteurs et logisticiens"
```

Le script pose le bloc `niche`, choisit une teinte encore libre, refuse un
domaine déjà pris, et écrit une base valide mais vide — signalée « en
chantier » tant que personne ne l'a remplie. Reste le travail éditorial, et
l'entrée correspondante dans `BACKLOG`.

## Décisions à connaître avant de modifier

- **Aucune dépendance externe au chargement, hors polices.** La feuille est
  compilée et servie depuis le même domaine. La première version chargeait
  Tailwind depuis un CDN : mesuré dans un vrai navigateur, sans le script
  distant **aucune utilitaire n'était appliquée** — pas de grille, pas de
  cartes, des boutons de dix-neuf pixels. Un réseau qui filtre le CDN rendait
  les onze sites illisibles. Les polices restent distantes parce que leur
  absence fait retomber sur la pile système : ça enlaidit, ça ne casse rien.
- **Les couleurs de niche passent par deux variables CSS**, jamais par des
  classes fabriquées en JavaScript : une classe construite à la volée n'est pas
  dans la feuille compilée, donc elle n'existe pas.
- **Toute adresse porte `?niche=<id>`**, canonique et sitemap compris : deux
  formes concurrentes pour la même page, ce sont deux pages en double aux yeux
  de Google.
- **Les fiches s'adressent en `?outil=<id>`, jamais en `#id`.** Un fragment
  n'est pas une URL distincte pour un moteur de recherche.
- **La description longue est du texte, convertie en nœuds DOM.** Jamais
  d'`innerHTML` : chaque fiche deviendrait une porte d'entrée pour du script
  injecté.
- **`lastmod` est la vraie date d'ajout, jamais celle du jour.** Un sitemap qui
  déclare tout modifié à chaque passage cesse d'être cru par le moteur.
- **La réserve est écrite à la main.** Le travail programmé pousse sans
  relecture : la réserve est le point où cette relecture a eu lieu.
- **Un `?niche=` inconnu retombe sur la niche du domaine**, pas sur un panneau
  technique.

## Vérifier

Les données se valident hors navigateur (`npm run valider`) : champs, dates,
identifiants en double, domaines en double, couleurs, longueurs de balises.

Tout le reste — la charte qui suit la niche, la modale, l'adresse profonde, le
repli, les cibles tactiles — ne se voit qu'en exécutant la page, d'où
`npm run verifier`, qui pilote un vrai Chromium. **Ses attentes sont tirées des
données, jamais écrites en dur** : la première version affirmait « trois
cartes », l'auto-pilote en a publié une quatrième et le parcours est passé au
rouge sans qu'aucun défaut n'existe. Un filet qui se déchire à chaque
publication finit désactivé.

Et une limite à connaître : **vérifier le comportement n'est pas vérifier le
rendu**. Vingt-sept contrôles sont passés au vert sur une page sans la moindre
mise en page. Quand un changement touche à l'apparence, prendre une capture et
la regarder.

Chromium est déjà installé dans les sessions distantes ; ne pas lancer
`playwright install`. `AMORCE_CHROMIUM` permet d'en désigner un autre.

## Trois verrous, et l'ordre compte

Le réseau est construit, contrôlé et tenu à jour. **Rien de tout cela n'est en
ligne ni ne rapporte**, pour trois raisons indépendantes qui se cumulent — et
les traiter dans le désordre fait perdre le bénéfice des deux premières.

| # | Verrou | Mesuré | Ce que ça coûte |
| --- | --- | --- | --- |
| 1 | **Rien n'est déposé** | billet [#181](https://github.com/Lefouzebreizh/amorce/issues/181), ouvert depuis le 27/08 | dix minutes, gratuit — deux secrets GitHub et un projet Cloudflare Pages |
| 2 | **Le domaine ne résout pas** | `ma-panoplie-ia.com` → aucune résolution DNS, le 29/08 | rien, si l'on prend l'adresse gratuite de Pages |
| 3 | **73 liens sur 73 sont des exemples** | `npm run valider` | une soirée de formulaires, `AFFILIATION.md` |

**Et un piège entre le 1 et le 2 :** déposer sans régler l'adresse mettrait onze
sites en ligne déclarant tous une balise canonique vers un domaine que personne
ne sert. C'est le pire signal qu'on puisse envoyer à un moteur, et il est
invisible — le site s'affiche parfaitement.

L'ordre juste, donc :

```bash
node regler-domaines.mjs --base https://annuaire-ia.pages.dev   # avant le dépôt
npm run sites                                                    # reconstruire
# puis les secrets Cloudflare, et le workflow « Annuaire IA — mise en ligne »
```

Le domaine acheté se branche plus tard, par la même commande, sans rien casser.
`node regler-domaines.mjs --etat` interroge maintenant le DNS et le dit.

## Ce que le réseau rapporte aujourd'hui : rien

Mesuré : **73 liens sur 73**, sur les onze sites publiés, pointent encore vers
`exemple-affiliation.com`. Le réseau se met à jour tout seul, se référence, tient
213 contrôles au vert — et ne peut pas encaisser un centime.

Ce n'était écrit nulle part. Chaque lien produisait **une** alerte parmi 234,
sous un verdict « 0 erreur(s) » qui se lit comme « tout va bien ». `npm run
valider` le dit maintenant en clair, à la fin, et sépare ce qui est en ligne
(73) de ce qui attend en réserve (158) — confondre les deux triple le chiffre et
décourage pour un travail qui n'est pas encore à faire.

**Ce qui débloque, et personne d'autre ne peut le faire :** ouvrir les comptes
d'affiliation. `AFFILIATION.md` les a déjà cherchés et classés par ce qui paie le
plus vite ; trois places de marché — Awin, PartnerStack, Impact — couvrent une
bonne partie du lot en une seule inscription. C'est une soirée de formulaires,
et c'est la seule chose qui sépare ce réseau de son premier euro.
