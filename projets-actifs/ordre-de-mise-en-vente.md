# Dans quel ordre mettre en vente — 31 août 2026

Classement des chantiers du dépôt sur **deux axes seulement** : à quelle vitesse
ça se déploie, et à quelle vitesse ça encaisse. Établi en lisant l'état réel des
projets, pas les notes de faisabilité.

## La note de faisabilité ne dit pas le délai jusqu'au premier euro

C'est le premier enseignement, et il retourne le classement. La grille de
`/idee-faisabilite` mesure la **faisabilité** — temps de construction,
complexité, coût, alignement. Elle ne mesure ni la distance à un client, ni
l'existence d'un canal de vente.

Résultat : les deux idées les mieux notées de l'atelier — **Reconnaissance de
couleurs (9/10)** et **Accord (8/10)** — sont les **plus éloignées** d'un
premier euro. Ce sont des applications mobiles sans modèle de revenu défini, et
un dépôt sur une boutique demande un compte développeur et un délai de
validation avant la première vente possible.

Une note haute dit « ça se construit ». Elle ne dit pas « ça se vend ».

## Le classement

| Rang | Chantier | Déploiement | Premier euro | Montant |
| --- | --- | --- | --- | --- |
| **1 ?** | **Artisan Express** — site vitrine | **une heure** | jours | 300 € / vente |
| 2 | Audit de code généré par IA | **néant** (service) | jours à semaines | ~500 € / audit |
| **1 ?** | KDP — Roussy & Zéphy tome 1 | jours | jours après dépôt | quelques € / vente, **48 000 personnes déjà acquises** |
| 4 | Amorce à 49 € | semaines | semaines | 49 € / vente |
| 5 | Réseau d'annuaires IA | **heures** | 3 à 6 mois | affiliation, passif |
| 6 | Accord, couleurs, ingrédients | mois | indéterminé | aucun modèle défini |

**Ce classement est à revoir, et sa propre règle le dit.** La section 3 posait
« si cette image se débloque, ce chantier passe premier ». Elle s'est débloquée
le 31/08/2026 — sans image, en mesurant que le livre était déjà déposable — et
le rang 1 est par ailleurs suspendu au SIRET. Le rang de KDP n'est pas changé
ici parce qu'un ordre de mise en vente est une décision de produit ; la
condition, elle, est remplie.

## Le rang 1 n'est plus tranché, et une seule question le décide

Ce classement plaçait Artisan Express premier et KDP troisième, ce dernier étant
donné pour bloqué par une image manquante. **Le blocage n'existait pas** — mesuré
le 31/08, le livre rend un verdict PUBLIABLE sans une seule image neuve. La règle
écrite plus bas dans ce document disait : *« si cette image se débloque, ce
chantier passe premier »*. Sa condition est remplie.

Mais la promotion ne s'applique pas mécaniquement, parce que **les deux
prétendants butent sur le même mur, et peut-être pas de la même façon** :
l'immatriculation est en cours au guichet unique de l'INPI, pas validée.

- **Artisan Express vend une prestation de service à 300 €.** Facturer sans
  numéro n'est pas possible, et l'encaissement en ligne est fermé pour cette
  raison exacte — voir `SIRET_ACTIF` dans `artisan-express/src/components/Offre.tsx`.
- **KDP verse des redevances d'auteur.** Est-ce soumis à la même contrainte ?
  **Je n'en sais rien, et je ne l'invente pas.** C'est une question fiscale, pas
  technique, et elle décide à elle seule lequel des deux est réellement premier.

**Comment y répondre sans rien engager, et gratuitement :** ouvrir un compte KDP
et remplir le questionnaire fiscal. Il est gratuit, il ne publie rien, et il dit
exactement ce qu'Amazon demande pour verser. Si les redevances passent sans
numéro d'entreprise, **KDP est premier sans discussion** — c'est le seul chantier
qui a déjà son public, et le seul qui encaisserait avant le SIRET.

Tant que cette réponse manque, les deux portent le rang **1 ?** dans le tableau.

## 1. Artisan Express — le seul dont tout est prêt sauf le déploiement

C'est le premier parce que **rien ne manque, sauf un déploiement d'une heure** :

- la page de vente existe, avec sa route d'API et ses tests au vert ;
- le prix est fixé — 300 €, une fois, livré en 48 h, sans abonnement ;
- `FACTURER.md` dit comment facturer ;
- `PROSPECTION.md` (199 lignes) porte **les messages pour aller chercher les
  trois premiers clients**, et ce qui les empêche d'être du spam ;
- `prospects-modele.md` porte le tableau à remplir.

Autrement dit : la partie qui bloque tous les autres chantiers — *comment on
trouve le premier client* — est **déjà écrite ici**.

Son `README.md` dit, daté du 30/08/2026 : **pas déployé**, vérifié sur le
tableau de bord Vercel. Il ajoute que cela « a été affirmé à tort » auparavant —
donc le vérifier avant d'annoncer quoi que ce soit.

### L'état du déploiement est à revérifier avant tout

Le 31/08/2026, le robot Vercel a annoncé sur une pull request de ce dépôt un
déploiement du projet **`amorce-51up`, dont le dossier racine est
`artisan-express`**, avec une adresse d'aperçu. Cela contredit le « pas
déployé » du README, daté de la veille.

**Ce point n'est pas tranché**, et il ne peut pas l'être depuis une session
distante : le mandataire refuse `*.vercel.app` — `code=000` au tunnel, mesuré.
Ni le README ni l'annonce du robot ne suffisent seuls, et ce README a déjà
affirmé le contraire à tort une fois.

**Dix secondes depuis un navigateur le règlent** : ouvrir
`https://amorce-51up.vercel.app`. Si la page à 300 € s'affiche, le premier pas
n'est plus le déploiement mais la prospection — et ce chantier passe de
« une heure » à « rien à faire avant d'écrire aux artisans ».

**Le premier pas, sous 48 h :** vérifier cette adresse ; déployer seulement si
elle ne rend rien ; puis envoyer les messages de `PROSPECTION.md` à dix
artisans. Rien à construire dans les deux cas.

## 2. L'audit de code — aucun déploiement du tout

Un service ne se déploie pas. L'outillage est écrit et éprouvé (`/audit-code-ia`,
`scan.py`, `scan_surface.py`, le gabarit de rapport). Le montant est le plus
élevé du lot, ~500 € l'audit.

Le goulot est identifié et écrit dans sa fiche : **la prospection ne se fait pas
depuis une session distante** — Reddit, Hacker News et la recherche GitHub sont
hors d'atteinte. Elle se fait à la main, depuis un navigateur.

## 3. KDP — la meilleure audience, et un blocage qui n'en était pas un

Le seul chantier qui a **déjà son audience** : 48 000 personnes qui suivent
l'auteur, et un `PLAN-DE-LANCEMENT.md` en six semaines écrit pour être exécuté.
On ne cherche pas à recruter, on convertit.

**Corrigé le 31 août 2026.** Cette section disait qu'il manquait « une planche
et une couverture » et que rien ne sortirait tant qu'une image ne serait pas
fabriquée. Les quatre chemins de génération sont bien fermés, cela n'a pas
changé — mais le livre **n'en a pas besoin pour être déposé**. La chaîne a été
relancée de bout en bout : 30 pages, aucun carton d'attente, **9 contrôles sur
9 au vert, verdict PUBLIABLE**, sans une seule image neuve. Le compte exact est
dans `kdp/README.md`.

Ce qui manque réellement, et ce que cela vaut :

- **une planche jamais dessinée** — page 15, *Le secret de l'hermine* — que
  `page12.py` raconte en prose vectorielle en attendant, sommaire et quatrième
  de couverture honorés ;
- **une couverture de face en propre**, dont un provisoire existe qui passe les
  cinq contrôles de vignette et dont le titre se lit à 150 px ; et dont trois
  essais générés dorment déjà chez le propriétaire, l'un d'eux retenu comme le
  meilleur des trois au test des 150 px ;
- une régénération de confort, *Faire le singe*, qui ne bloque rien.

**Ce chantier n'attend donc plus une image, il attend un dépôt.** Le geste
suivant n'est pas de fabriquer une illustration, c'est d'assembler avec le
provisoire, de déposer et de **commander l'épreuve papier** — qui ne publie
rien et dont les deux semaines d'impression courent pendant qu'on travaille la
couverture définitive.

## 4. Amorce à 49 € — la plomberie d'abord

Le studio existe et le contrat du serveur de licence est écrit
(`src/licence/CONTRAT.md`, `licence-serveur/`). Mais entre ici et le premier
euro il reste : brancher Stripe, déployer le serveur, écrire une page de vente,
et amener quelqu'un dessus. Chacune de ces étapes est modeste ; ensemble elles
font des semaines.

## 5. Le réseau d'annuaires — rapide à poser, lent à payer

Onze sites statiques, un auto-pilote qui publie tous les deux jours, une réserve
de trois passages d'avance. Le déploiement est le plus rapide de tout le dépôt :
un dossier déposé sur un hébergement statique.

Mais le revenu est de l'affiliation, et l'affiliation vit du référencement.
Compter **trois à six mois** avant le premier clic qualifié, quoi qu'on fasse.
C'est un actif qu'on pose tôt parce qu'il mûrit lentement — pas une source de
trésorerie.

## 6. Les applications mobiles — les plus loin

Accord, la reconnaissance de couleurs, la lecture d'ingrédients : bien notées
en faisabilité, sans modèle de revenu défini, et derrière un dépôt sur boutique.
Elles se construisent parce qu'elles sont bonnes, pas parce qu'elles paient.

## Ce que ce classement ne dit pas

**Il ne classe pas par intérêt.** Un chantier peut mériter d'être fait sans être
le plus rentable — c'est le cas d'Accord, qui est en cours pour de bonnes
raisons.

**Il ne remplace pas les fiches**, qui portent le détail, les pièges et les
questions ouvertes. Il dit seulement dans quel ordre les mettre en vente si
l'objectif est d'encaisser vite.
