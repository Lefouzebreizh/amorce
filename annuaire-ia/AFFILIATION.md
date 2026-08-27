# Les programmes d'affiliation à ouvrir

**Ce document existe pour être rempli en une seule fois.** Tant que les liens
restent en `exemple-affiliation.com`, le réseau publie, se référence, et ne
rapporte rien. Chercher chaque programme soi-même est le genre de corvée qu'on
repousse indéfiniment : tout ce qui pouvait être cherché à l'avance l'a donc été.

Relevé le 27 août 2026, par recherche. **Les commissions et les conditions
changent sans préavis** — la colonne « vérifié » dit ce qui a été lu à cette
date et ce qui reste à confirmer au moment de l'inscription.

## Comment s'en servir

1. Ouvrir les comptes de la partie **À ouvrir en premier**, dans l'ordre.
2. Pour chaque outil obtenu, remplacer `lien_affiliation` dans
   `niches/<niche>.json` — ou me donner les liens, je le fais.
3. `npm run valider` compte les liens de démonstration restants : c'est la seule
   mesure d'avancement qui compte ici.

**Trois comptes de place de marché couvrent une bonne partie du lot** :
[Awin](https://www.awin.com/), [PartnerStack](https://partnerstack.com/) et
[Impact](https://impact.com/). Les ouvrir d'abord évite de recréer un profil,
des coordonnées bancaires et une déclaration fiscale à chaque programme.

## À ouvrir en premier

Classés par ce qui rapporte le plus vite : commission récurrente, inscription
sans validation manuelle, et public du réseau qui achète réellement ce produit.

| # | Programme | Commission | Inscription | Couvre | Vérifié |
| --- | --- | --- | --- | --- | --- |
| 1 | **Gamma** | 30 % | [help.gamma.app](https://help.gamma.app/en/articles/11048092-how-do-i-join-the-gamma-affiliate-program) | Gamma (éducation, généraliste) | Taux lu, conditions à confirmer |
| 2 | **Synthesia** | 25 % récurrent pendant 12 mois | Programme public, page partenaires du site | Synthesia (généraliste) | Taux et durée lus |
| 3 | **ElevenLabs** | 22 % récurrent, cookie 60 à 90 j | Programme public | ElevenLabs (généraliste) | Taux et cookie lus |
| 4 | **Klaviyo** | 20 % récurrent pendant 12 mois, cookie 90 j | Programme partenaires Klaviyo | Klaviyo (e-commerce) | Taux, durée et cookie lus |
| 5 | **Shopify Partners** | 20 % de parrainage | [shopify.com/partners](https://www.shopify.com/partners) — quelques minutes, sans dossier | Shopify Magic (e-commerce) | Inscription et taux lus |
| 6 | **Gorgias** | 20 % récurrent | [gorgias.com/affiliate-program](https://www.gorgias.com/affiliate-program) — aussi sur PartnerStack | Gorgias (e-commerce) | Taux lu |
| 7 | **Photoroom** | 20 % sur les abonnements, cookie 30 j | [photoroom.com/affiliates](https://www.photoroom.com/affiliates) — via **Awin** | Photoroom (e-commerce) | Taux, cookie et réseau lus |
| 8 | **Descript** | 15 % récurrent | Programme public | Descript (généraliste) | Taux lu |

Les quatre premiers sont récurrents : une inscription qui reste payée douze
mois vaut mieux qu'une prime unique plus élevée.

## À ne pas chercher — c'est déjà tranché

Autant de temps épargné, et la raison est écrite pour qu'on ne recommence pas
dans six mois.

| Outil | Pourquoi rien à faire |
| --- | --- |
| **ChatGPT**, **Claude**, **Perplexity**, **Gemini** | Aucun de ces éditeurs ne rémunère l'apport d'inscription. Ce sont pourtant les fiches les plus consultées : elles servent l'audience, pas le revenu, et c'est très bien ainsi. |
| **Canva Magic Studio** | Programme **fermé aux nouveaux candidats**. |
| **Notion AI** | Programme Notion **fermé aux nouveaux candidats**, alors qu'il payait le mieux du lot. |
| **Midjourney** | Pas de programme d'affiliation public. |

## À vérifier une par une

Ces outils n'ont pas de programme trouvé par recherche, ce qui **ne prouve pas
qu'il n'y en a pas** : beaucoup d'éditeurs professionnels ont un programme
partenaire discret, réservé aux revendeurs et aux prescripteurs.

**Où regarder, dans cet ordre :** le pied de page du site (« Partenaires »,
« Affiliation », « Partner program »), puis une recherche
`<nom> partner program`, puis les places de marché PartnerStack et Awin.

- **Outillage professionnel grand public** — Runway, Suno, Zapier Agents, Matterport,
  PlanRadar, Virtual Staging AI, PromeAI, Veras, LookX AI, Diffit,
  MagicSchool AI, SchoolAI, Slang.ai, Popmenu. Ce sont les plus susceptibles
  d'avoir un programme ouvert : commencer par eux.
- **Éditeurs français** — Pennylane, Dext, Doctrine, Posos, Lifen, Nabla,
  Therapixel. Rarement un programme d'affiliation, souvent un **programme
  prescripteur** qui se négocie par courriel. Un message suffit à savoir.
- **Offres d'entreprise** — Harvey, Luminance, Lexis+ AI, Aidoc, Buildots,
  Doxel, ALICE Technologies, Togal.AI, Vic.ai, HireVue, SeekOut, Visier,
  Metaview, Textio, Winnow, Tenzo, Tastewise, Khanmigo, Juro, Klippa,
  Booke AI, Octane AI, PriceHubble, Restb.ai, Write.homes, Finch 3D, TestFit.
  Vente par cycle commercial long : **l'apporteur d'affaires y rapporte
  davantage que l'affilié**, mais cela se négocie et ne s'automatise pas.
  À garder pour plus tard, quand le trafic prouvera qu'il y a matière.

## Ce qu'il faut noter pour chaque programme obtenu

Le lien seul ne suffit pas — quatre informations valent d'être gardées, sans
quoi on les recherche à chaque fois :

1. **L'adresse de suivi**, telle quelle. Certaines sont des adresses complètes,
   d'autres demandent d'ajouter un identifiant en paramètre.
2. **La durée du cookie** — 30 jours ou 90 jours changent complètement ce qu'un
   même trafic rapporte.
3. **Récurrent ou non**, et sur combien de mois.
4. **Le seuil de versement**, souvent 50 ou 100 $ : en dessous, rien n'est payé.

## Où va le lien, une fois obtenu

Dans le champ `lien_affiliation` de l'outil, dans `niches/<niche>.json`. Le
gabarit pose déjà `rel="sponsored"` sur le lien sortant — obligation
d'affichage côté moteur de recherche, et le parcours de vérification l'exige.

Rien d'autre à changer : ni le code, ni la feuille de style, ni les sitemaps.
