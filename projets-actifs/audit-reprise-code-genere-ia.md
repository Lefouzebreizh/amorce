# Audit & reprise de code généré par IA

> **Hypothèses posées** : activité de **service** menée en solo à temps partiel,
> sans client signé, facturation à la prestation. Le score tient entre 7 et 9
> selon les réponses aux questions ouvertes — il ne change pas de dossier, d'où
> la fiche écrite maintenant.

## Pitch

Remettre en état les applications construites par IA qui ne tiennent plus en
production : pas de tests, secrets en clair, dépendances mortes, code que plus
personne n'ose toucher. On vend un diagnostic chiffré, puis la remise en état.
Le client n'est pas à convaincre — il est déjà bloqué.

## Objectif mesurable

**Un audit payé 500 € livré à une entreprise qui a une application générée par
IA en production et des clients qui la paient.** Pas un hobbyiste, pas un
prototype : une application dont l'arrêt coûte de l'argent à quelqu'un.

Palier visé : **2 audits + 1 remise en état par mois**, soit ~4 000 €/mois pour
une charge à temps partiel.

## Score de faisabilité — 8/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 9/10 | Le premier livrable est un audit d'une page sur un dépôt réel : une soirée. Rien à construire au préalable. |
| Complexité technique | 9/10 | C'est le travail déjà pratiqué dans ce dépôt. Aucune techno à apprendre — la compétence rare est la discipline, pas l'outil. |
| Coût / Rentabilité | 8/10 | Zéro coût récurrent, marge ~100 %. Retiré d'un point parce qu'une part de la cible — ceux qui ont bâti seuls pour éviter de payer un développeur — n'a structurellement pas de budget. |
| Alignement | 8/10 | Le dépôt est la démonstration : invariants écrits, harnais de vérification qui contrôle les pixels et le signal sonore, règle de chirurgie minimale. Ça ne se simule pas. |

**Verdict :** aucun critère ne coince, ce qui est rare. La force du dossier
tient à un renversement — **le client est déjà en douleur et le sait**. C'est
exactement ce qui manquait à l'offre vidéo, où il fallait d'abord créer le
désir. On ne vend pas une amélioration, on vend une sortie de crise, et ça
raccourcit le cycle de vente d'un ordre de grandeur.

## Plan d'action (MVP)

| Étape | Livrable | Délai |
| --- | --- | --- |
| **1 — L'audit non sollicité** | Trouver 3 applications **déployées, avec des clients payants**, construites par IA (communautés Lovable / Bolt / v0, Indie Hackers, forums no-code FR, pages de tarifs). En auditer **une** gratuitement depuis sa **surface publique** — `scan_surface.py <url>`, aucun dépôt requis : 1 page, 5 constats classés **par ce qui cassera en premier en production**, avec le correctif du n°1 déjà écrit. Envoyer sans rien demander. | **< 48 h** |
| **2 — Le premier audit payé** | Répéter jusqu'à un audit facturé 500 € à prix fixe. Le prix fixe est le cœur de l'offre : il règle le problème du périmètre inconnu, qui est la vraie raison pour laquelle personne ne veut de ce travail. | 2 à 6 semaines |
| **3 — La remise en état** | Transformer un audit en chantier facturé (3–10 k€ selon l'ampleur). Constituer au passage la grille d'audit réutilisable — c'est elle, et non le code livré, qui devient l'actif. | Après le 2ᵉ audit payé |

L'étape 1 est un audit, pas une prospection. Un diagnostic gratuit envoyé à
quelqu'un qui n'a rien demandé prouve la compétence au lieu de l'affirmer — et
la réaction (« combien pour le reste ? » ou le silence) est l'information que
six mois de site vitrine ne donnent pas.

## Outils nécessaires

**Déjà en place (0 €)**
- Le dépôt lui-même, comme preuve : `CLAUDE.md`, les invariants écrits,
  `scripts/verify.mjs`, les agents `revue-invariants` et `verificateur`.
- Claude Code pour lire vite une base de code inconnue.

**À ajouter**
- Une grille d'audit écrite (se construit à l'étape 2, pas avant).
- Un moyen de facturer et un statut — avant l'étape 2.

**Volontairement absent**
- Aucun abonnement. Aucune plateforme. Aucune avance de trésorerie. C'est la
  différence structurelle avec l'offre vidéo, qui engageait 50–200 €/mois avant
  le premier euro encaissé.

## Ce qui la ferait tomber

1. **La cible sans argent.** Beaucoup de ceux qui ont fait construire leur app
   par IA l'ont fait précisément pour ne pas payer de développeur. Ceux-là ne
   paieront pas non plus la réparation. **Filtre décisif : l'application est en
   production et a des clients payants.** Sans ce filtre, l'activité s'épuise
   en devis non signés.
2. **Le « je refais tout avec le prochain outil ».** Un client peut préférer
   regénérer plutôt que réparer. L'audit doit donc chiffrer ce que la
   regénération lui coûterait vraiment — migration des données, perte de
   l'historique, même dette six mois plus tard.
3. **Le périmètre inconnu.** Devis impossible avant d'avoir regardé. L'audit à
   prix fixe existe pour ça : il est le devis. Facturer la reprise au forfait
   sans audit préalable est le moyen le plus sûr de travailler à perte.
4. **L'ingratitude du travail.** Reprendre du code d'inconnu use. C'est aussi
   la barrière qui tient la concurrence dehors — mais elle s'applique à soi
   aussi. À surveiller au 5ᵉ chantier, pas au 1ᵉʳ.

## Questions ouvertes

1. **Prêt à signer des prestations de réparation, ou seulement des audits ?**
   L'audit seul est confortable et plafonne vite ; la reprise paie mais engage.
2. **Une limite de pile ?** (refuser tout ce qui n'est pas JS/TS/Python, par
   exemple) Refuser large simplifie la vente, refuser trop étroit tarit le flux.
3. **Combien d'heures par semaine réellement disponibles ?** Une reprise en
   état supporte mal l'interruption : cinq chantiers tournent déjà dans ce
   dépôt.

---

## Journal — première tentative d'étape 1 (27 août 2026)

Tentative de produire l'audit non sollicité. **Aucun rapport envoyé** : aucune
cible ne passait les filtres. Ce que la tentative a appris tient en un piège
que la fiche ne mentionnait pas, et il est structurel.

### Le cinquième piège : les deux filtres se contredisent

L'étape 1 exige simultanément trois choses d'une même personne :

1. son application est cassée,
2. elle a des clients payants,
3. son dépôt est **public** — la règle d'audit interdit de lire du code privé
   sans invitation.

Les conditions 2 et 3 sont **anticorrélées**. Un dépôt Lovable laissé public par
quelqu'un qui encaisse de l'argent est, presque par définition, tenu par
quelqu'un qui sait ce qu'il fait — sinon il l'aurait fermé, ou quelqu'un le lui
aurait fait fermer. Les applications cassées **avec** des clients payants ont
des dépôts privés. Le public auditable et le solvable en douleur ne se
recouvrent presque pas.

### La preuve, sur un cas mené jusqu'au bout

`coachingfederation-ch/www.coachingfederation.ch` — site d'une fédération de
coachs, construit sous Lovable, dépôt public, adhésions et billetterie
d'événements payants. Sur le papier : la cible parfaite.

Relevé mécanique puis vérification à la main de chaque constat :

| Constat brut du script | Après vérification |
| --- | --- |
| 11 « secrets en clair » | **Faux positifs.** 9 sont des jetons de design (`token: "--background"`), 2 sont les en-têtes PEM d'une fonction de parsing — la vraie clé vient de `process.env`. |
| `.env` et `.env.development` versionnés | **Sans gravité.** Ne contiennent que des clés *publiables* Supabase, exposées au navigateur par conception. |
| Coûts non bornés (beaucoup d'IA) | **Déjà traité.** Un `src/lib/rate-limit.server.ts` dédié, appliqué sur la route de chat. |
| Impossible à redéployer | **Non.** 164 migrations SQL versionnées. Seul manque réel : pas de fichier de verrouillage des dépendances. |
| 1 fichier de test / 603 fichiers source | **Réel.** |

Rapport qu'on aurait pu écrire : « il vous manque un lockfile et des tests ».
Personne ne paie 500 € pour ça. **Envoyer cet audit aurait coûté la
crédibilité que l'étape 1 est censée construire.**

Le tri manuel a donc fonctionné exactement comme prévu — il a servi à ne *pas*
envoyer. C'est la première validation réelle de la discipline « un faux positif
coûte tout le reste ».

### Le correctif à apporter à l'étape 1

**Cesser d'exiger un dépôt.** La règle est « ne lire que ce à quoi on a été
invité » — elle n'a jamais dit « un dépôt Git ». Or toute application déployée
sert publiquement, à quiconque ouvre son URL :

- son bundle JavaScript — donc tout secret parti côté navigateur ;
- sa configuration cliente — projet Supabase / Firebase, clés publiables ;
- ses en-têtes de réponse — CORS, cookies, politique de sécurité.

C'est **la même surface pour tout le monde**, sans dépôt, et elle supprime
l'anticorrélation : n'importe quelle application avec des clients payants
devient auditable.

**Appliqué.** L'étape 1 ci-dessus est réécrite, la compétence `audit-code-ia`
porte la méthode et sa frontière, et `scripts/scan_surface.py` fait le relevé :
GET seulement, sur l'URL donnée puis sur les seuls fichiers que la page dit
elle-même au navigateur d'aller chercher. Il relève les secrets partis dans le
bundle, la configuration des services qui portent les données, les protections
absentes des en-têtes, et les **cartes de sources** laissées en production —
celles-ci rendent tout le code d'origine lisible et rouvrent l'audit complet
sans dépôt. Les valeurs sensibles sont recopiées tronquées : un rapport part
par courrier, et un rapport qui reproduit la clé qu'il signale est la deuxième
fuite.

**Ce qui ne tourne pas depuis une session distante.** La politique réseau de
l'environnement refuse tout hôte non listé — vérifié : `example.com` rend 000.
Le relevé de surface se lance donc depuis ta machine, pas d'ici. Ce n'est pas
une gêne : le goulot était déjà l'acquisition, et elle est humaine.

**La limite, à tenir strictement :** lire ce que l'application *sert
spontanément* est passif et légitime. Forger une requête pour voir si une règle
d'autorisation cède ne l'est pas, sans accord écrit. Un audit non sollicité
s'arrête à ce que le navigateur reçoit sans qu'on le pousse — et le rapport
doit dire où il s'est arrêté, ce qui est aussi ce qui donne au client une raison
de payer la suite.

### Canaux de découverte — état constaté

Depuis une session Claude Code, la prospection est étroite :

| Canal | État |
| --- | --- |
| Reddit, Hacker News, HN Algolia | Bloqués par la politique réseau de l'environnement |
| API de recherche GitHub | Restreinte aux dépôts de la session |
| Recherche web GitHub | 429, une heure d'attente |
| Recherche web générale | Ne remonte que du contenu SEO, jamais des individus |
| Pages `github.com/topics/*`, clone de dépôts publics | Fonctionnent |

**Conséquence :** l'étape 1 se fait mieux à la main, depuis un navigateur, dans
les communautés où la cible écrit — pas depuis une session automatisée. Le
goulot reste l'acquisition, et il est humain.

### Concurrence apparue

Des scanners de sécurité pour applications « vibe-codées » existent déjà
(Talon, supashield, VibeGuard). Ils vendent l'automatique. **L'offre reste
distincte** : ce qui se vend ici n'est pas le relevé — le cas ci-dessus montre
qu'un relevé automatique aurait produit onze faux positifs — mais le tri, le
classement, et le correctif écrit. À surveiller quand même : si l'un d'eux
ajoute un service humain, il arrive avec le flux d'acquisition déjà constitué.

---

## Plan de bataille

Le goulot n'est pas la production, c'est l'acquisition — et depuis que
`scan_surface.py` existe, **qualifier une cible coûte trente secondes au lieu
d'une soirée**. Tout le plan découle de ça : aller large sur les cibles, pas
profond sur une seule.

**Le partage du travail est net.** À toi : la liste, les envois, les réponses —
c'est humain, ça se fait au navigateur, et ça part en ton nom. À moi : le tri,
le classement, le correctif écrit, le chiffrage, le texte du rapport. Ne jamais
attendre l'un pour faire l'autre.

### Phase 0 — trancher les trois questions ouvertes (30 min, une fois)

Elles bloquent la rédaction du rapport, pas la prospection. Recommandations :

1. **Signer aussi les réparations**, mais jamais sans audit préalable. L'audit
   seul plafonne autour de 1 000 €/mois ; et l'actif visé — la grille
   réutilisable — se construit pendant les reprises, pas pendant les audits.
2. **Limiter la pile à JS/TS + Supabase/Firebase.** Pas parce que le reste est
   dur, mais parce que le scan, le gabarit et la bibliothèque de correctifs ne
   se capitalisent que si les cibles se répètent. Refuser Python et Rails ne
   coûte presque rien à ce volume et double la réutilisation.
3. **Une seule reprise en chantier à la fois.** Cinq projets tournent déjà ici,
   et une reprise supporte mal l'interruption.

### Phase 1 — la liste (une soirée, toi)

**Vingt** applications déployées, construites par IA, avec un palier payant.
Où chercher : vitrines Lovable / Bolt / v0, Product Hunt sur six mois,
Indie Hackers, r/SaaS, X sur « built with Lovable » + MRR, et côté français les
forums no-code, les Discord no-code et LinkedIn.

Filtrer dans cet ordre, du moins cher au plus cher :

1. une page de tarifs avec un vrai palier payant — c'est le filtre décisif ;
2. un contact joignable, avec un nom d'humain ;
3. l'application répond.

**Et rien d'autre.** Surtout ne pas essayer de deviner si elle est cassée :
c'est précisément ce que le scan fait pour trente secondes.

### Phase 2 — le tri mécanique (10 min, moi)

`scan_surface.py` sur les vingt, tu me colles les relevés. Je fais le tri.

**Attendre un taux de succès bas.** Le seul cas mené jusqu'au bout a rendu onze
constats bruts et zéro constat réel. Sur vingt cibles, tabler sur quatre à six
qui portent quelque chose de vrai. Ce n'est pas un échec du scan : c'est le
scan qui fait son travail, et c'est exactement ce qui rend le tri vendable.

### Phase 3 — trois rapports, pas un

La fiche disait d'en auditer **une**. C'était écrit quand un audit coûtait une
soirée. Un envoi unique est un échantillon de taille 1 : le silence n'y apprend
rien. Trois envois la même semaine, même gabarit — ce sont les **écarts entre
les réponses** qui portent l'information.

### Phase 4 — le ton, et c'est là qu'on peut tout perdre

Un courrier de sécurité non sollicité se lit comme un racket, sauf s'il est
construit pour ne pas l'être. Quatre règles, non négociables :

- **Le correctif du n°1 est donné entier, gratuit, applicable sans nous.** C'est
  la seule chose qui sépare l'aide du chantage.
- **Aucune échéance, aucune urgence**, jamais « avant que quelqu'un d'autre ne
  le trouve ». Le filtre 48K vaut ici aussi : l'urgence fabriquée blesse
  exactement les gens qu'on veut servir.
- **Dire où le relevé s'est arrêté** : « je n'ai lu que ce que votre site sert à
  n'importe quel visiteur, je n'ai rien forcé ».
- **Ne publier le constat nulle part.** Jamais, sous aucune forme, quelle que
  soit la réponse — y compris l'absence de réponse.

### Phase 5 — mesurer, et le seuil de décision

Écrire chaque envoi dans un tableau : date, cible, constat n°1, réponse.

- **≥ 2 réponses sur 10 envois** (« combien pour le reste ? ») → l'offre tient,
  passer à l'étape 2 et facturer.
- **0 réponse sur 10** → ce n'est pas le rapport, c'est la cible. **Changer de
  canal avant de changer de texte** — réécrire le rapport est le réflexe, et
  c'est celui qui fait perdre un mois.

### La parade sur la concurrence

Talon, supashield, VibeGuard vendent le scan automatique. Un prospect qui
répond « j'ai déjà passé un scanner » n'est pas perdu : **c'est le mieux
qualifié du lot**. Il a une liste de quarante lignes que personne n'a classée,
et il est déjà convaincu que le problème existe. L'offre, c'est le classement —
et le cas ci-dessus prouve ce que l'automatique rend seul.

---

## Le canal qui trouve les cibles — mesuré le 03/09/2026

Le plan disait « la liste, c'est toi, au navigateur ». **C'est faux pour la
moitié du travail**, et la correction vaut d'être écrite parce qu'elle change le
partage des tâches.

**Ce qui marche : `site:lovable.app` dans WebSearch.** Toute application Lovable
déployée sans domaine propre vit sur ce suffixe, et l'index les voit. Croisé
avec le vocabulaire du métier visé — « devis facture artisan », « tarifs
abonnement professionnels », « gestion clients » — il rend en une recherche une
douzaine d'applications françaises réelles, avec leur adresse et une ligne sur
ce qu'elles font. Une session peut donc **constituer la liste**.

**Ce qui ne marche pas : les ouvrir.** `*.lovable.app` est refusé au mandataire,
comme `lovable.dev`, Product Hunt, Reddit et Hacker News. Une session ne peut ni
lire la page de tarifs, ni lancer `scan_surface.py`. Le filtre décisif — un vrai
palier payant — et le relevé restent sur la machine du propriétaire.

Le partage devient donc : **la liste et le tri d'un côté, l'ouverture et le
relevé de l'autre.** C'est un meilleur découpage que le précédent, parce que la
partie longue — chercher — se fait ici, et la partie courte — trente secondes
par adresse — se fait là-bas.

**La liste elle-même ne se versionne pas.** Elle nomme des entreprises réelles à
côté d'une hypothèse sur leur sécurité ; dans un dépôt public, c'est une liste
de proies. Elle vit dans `projets-actifs/cibles-audit.md`, ignoré, pour la même
raison que `artisan-express/prospects.md`.

**Et toute cible ne se démarche pas.** Un service de télévision en direct à
6,99 €/mois a été trouvé et écarté : sans licence de diffusion, son problème
n'est pas la sécurité de son code. Envoyer un audit à une activité elle-même
irrégulière n'apporte ni client ni crédit.
