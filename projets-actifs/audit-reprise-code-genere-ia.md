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
| **1 — L'audit non sollicité** | Trouver 3 personnes qui disent publiquement que leur application générée par IA est cassée (communautés Lovable / Bolt / v0, Indie Hackers, forums no-code FR). En auditer **une** gratuitement : 1 page, 5 constats classés **par ce qui cassera en premier en production**, avec le correctif du n°1 déjà écrit. Envoyer sans rien demander. | **< 48 h** |
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
