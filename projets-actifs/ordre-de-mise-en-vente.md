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
| **1** | **Artisan Express** — site vitrine | **fait** | jours | 300 € / vente |
| 2 | KDP — Roussy & Zéphy tome 1 | jours | jours après dépôt | quelques € / vente, **48 000 personnes déjà acquises** |
| 3 | Audit de code généré par IA | **néant** (service) | jours à semaines | ~500 € / audit |
| 4 | Amorce à 49 € | semaines | semaines | 49 € / vente |
| 5 | Réseau d'annuaires IA | **heures** | 3 à 6 mois | affiliation, passif |
| 6 | Accord, couleurs, ingrédients | mois | indéterminé | aucun modèle défini |

## Le rang 1 est tranché — et pas par la réponse qu'on attendait

**Le SIRET est validé.** SIREN **109356972**, immatriculation confirmée par le
propriétaire, validée le 31/08/2026. Les deux verrous d'encaissement sont levés
le 03/09 — `ENCAISSEMENT_OUVERT` dans `artisan-express/src/lib/config.ts` et
`SIRET_ACTIF` dans `Offre.tsx` — et un test refuse qu'on efface le SIREN écrit à
côté.

Ce document a longtemps porté une question fiscale comme arbitre du rang 1 :
*« les redevances KDP peuvent-elles être versées sans SIRET ? »* **Elle n'a plus
d'objet.** Il y a un SIRET. La question n'était pas mauvaise — elle était la
bonne tant que l'immatriculation traînait — mais elle est devenue sans effet, et
une question périmée gardée comme arbitre fait attendre une réponse qui ne
changerait plus rien.

**Artisan Express est donc premier, sans « ? ».** Non par arbitrage, mais parce
que plus rien ne lui manque :

- déployé et public, mur d'authentification Vercel abattu le 02/09 ;
- le SIRET permet de facturer ;
- `npm run facture` produit la facture entière, virement en premier, avec toutes
  les mentions obligatoires — éprouvée de bout en bout le 03/09 ;
- les messages de prospection sont écrits, et l'adresse de démonstration y est
  collée.

Il ne reste que deux gestes, et **aucun n'est du code** : l'IBAN dans
`factures/emetteur.json`, et écrire à dix artisans.

**KDP passe deuxième**, et son propre blocage n'existait pas non plus : mesuré le
31/08, le livre rend un verdict PUBLIABLE sans une seule image neuve. Il est
derrière Artisan Express pour une raison de délai, pas de blocage — il faut
déposer, commander l'épreuve, et attendre deux semaines d'impression.

### Ce que devient le questionnaire fiscal KDP

**Une formalité de versement, plus un arbitre.** Amazon ne verse rien sans lui,
donc il reste à faire ; il ne décide plus de l'ordre. Le parcours est déroulé
écran par écran dans `kdp/depot/FISCAL.md`. **Le compte est ouvert depuis le
31/08/2026 ; le questionnaire ne l'est pas.**

Et le SIREN change peut-être la réponse à donner sur l'écran qui compte —
particulier ou entreprise. `FISCAL.md` a été écrit quand aucune entreprise
n'existait ; il porte désormais l'avertissement.

## 1. Artisan Express — le seul dont plus rien ne manque

C'est le premier parce que **rien ne manque** — le déploiement d'une heure que
ce classement lui portait au débit était déjà fait, voir plus bas :

- la page de vente existe, avec sa route d'API et ses tests au vert ;
- le prix est fixé — 300 €, une fois, livré en 48 h, sans abonnement ;
- `FACTURER.md` dit comment facturer ;
- `PROSPECTION.md` (199 lignes) porte **les messages pour aller chercher les
  trois premiers clients**, et ce qui les empêche d'être du spam ;
- `prospects-modele.md` porte le tableau à remplir.

Autrement dit : la partie qui bloque tous les autres chantiers — *comment on
trouve le premier client* — est **déjà écrite ici**.

Son `README.md` a dit **pas déployé** du 30/08 au 02/09/2026, et c'était faux ;
il porte désormais la mesure, et la raison pour laquelle deux sessions s'étaient
trompées dans les deux sens.

### L'état du déploiement est tranché — et le déploiement n'était pas le sujet

**Tranché le 02/09/2026, par le connecteur Vercel.** Le projet `amorce-51up`
existe, il sert bien cette page, et `https://amorce-51up.vercel.app` rend 200.
Le robot avait raison, le « pas déployé » du README avait tort. Le déploiement
d'une heure que ce classement portait au débit d'Artisan Express **n'existe
pas** : il était déjà fait.

**Mais la page était déployée et invisible**, et c'est le vrai blocage, que
personne n'avait cherché. Le projet portait `ssoProtection` à
`all_except_custom_domains` : toutes ses adresses en `.vercel.app` étaient
derrière l'authentification Vercel, et un artisan qui cliquait tombait sur un
mur de connexion. Le réglage a été mis à `false` le même jour, sur accord
explicite du propriétaire.

**Ce document proposait « dix secondes depuis un navigateur » pour trancher, et
cette méthode ne pouvait pas donner la bonne réponse.** Depuis le navigateur du
propriétaire, connecté à Vercel, la page s'affiche — mur ou pas. Le contrôle
aurait donc conclu « déployé, tout va bien » alors qu'aucun prospect ne voyait
la page. Ce qui tranche est le réglage de *Deployment Protection*, jamais
l'affichage ; et de l'extérieur, seule la navigation privée le dit. Le détail
est dans `artisan-express/README.md`.

**Le premier pas, sous 48 h :** envoyer les messages de `PROSPECTION.md` à dix
artisans. Rien à déployer, rien à construire.

## 2. KDP — la meilleure audience, et un blocage qui n'en était pas un

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

## 3. L'audit de code — aucun déploiement du tout

Un service ne se déploie pas. L'outillage est écrit et éprouvé (`/audit-code-ia`,
`scan.py`, `scan_surface.py`, le gabarit de rapport). Le montant est le plus
élevé du lot, ~500 € l'audit.

Le goulot est identifié et écrit dans sa fiche : **la prospection ne se fait pas
depuis une session distante** — Reddit, Hacker News et la recherche GitHub sont
hors d'atteinte. Elle se fait à la main, depuis un navigateur.

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
