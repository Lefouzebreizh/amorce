# Producteur de formats courts IA

> **En pause — pivot du 26/08/2026.** Rien dans la fiche ne s'est révélé faux :
> le score de 7/10 tient, la niche est tranchée, l'étape 1 est prête. Ce qui a
> tranché est ailleurs — il fallait **créer le désir** chez le client, là où
> l'audit de code trouve un client déjà en douleur. À charge égale, la douleur
> se vend mieux que l'envie.
>
> **Ce qui la ferait remonter :** un cabinet comptable, un organisme de
> formation ou un éditeur SaaS qui demande spontanément une vidéo. La chaîne
> technique reste montée, la reprise coûterait un week-end.

> **Hypothèses posées faute de réponses** — trois questions restent ouvertes en
> bas de fiche. Le score tient entre 6 et 8 selon les réponses ; il ne bascule
> pas au-delà, c'est ce qui autorise à écrire la fiche maintenant.
> Hypothèses retenues : activité de **service** (on vend des vidéos, pas un
> logiciel), menée **en solo à temps partiel**, sans client déjà signé.

## Pitch

Production de vidéos verticales courtes clés en main — script, voix off
synthétique, avatar, montage rythmé — pour des créateurs et des PME qui veulent
une présence vidéo sans y consacrer de temps. La chaîne technique est déjà
assemblée : Amorce couvre le montage, le reste est de l'abonnement.

## Objectif mesurable

**Une facture payée pour une vidéo livrée**, avant toute construction d'outil.
Pas « un pipeline qui marche », pas « trois démos » : un virement.

Cible de palier : **3 clients à 300 €/mois** de forfait (4 vidéos/mois chacun)
= 900 €/mois pour ~16 vidéos, soit un coût de production sous 20 €/vidéo.

## Score de faisabilité — 7/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 8/10 | Une vidéo démo complète tient dans un week-end : Amorce assure le montage vertical, le script sort d'un LLM, la voix d'une API. |
| Complexité technique | 6/10 | Rien à inventer, tout est intégration tierce. La brique avatar est l'exception : la plus chère, la plus lente à rendre, et celle qui trahit le plus vite le « fait à la machine ». |
| Coût / Rentabilité | 5/10 | ~50–200 €/mois d'abonnements engagés avant le premier euro encaissé (ordres de grandeur à confirmer sur les grilles tarifaires du jour). Marché saturé, prix effondrés par la commoditisation. |
| Alignement | 8/10 | Monétisation directe d'Amorce : chaque commande devient un test du studio en conditions réelles, et les manques du studio deviennent des besoins clients identifiés. |

**Verdict :** le 5 en rentabilité plafonne l'intérêt, et pour une raison
précise — **le goulot n'est pas la production, c'est l'acquisition**. Produire
dix vidéos par semaine est faisable dès aujourd'hui ; vendre la première ne
l'est pas. Tout plan qui commence par construire un outil se trompe de
problème.

## Plan d'action (MVP)

| Étape | Livrable | Délai |
| --- | --- | --- |
| **1 — La démo non sollicitée** | Choisir **3 entreprises locales réelles** dont la présence vidéo est mauvaise ou absente. Produire **une** vidéo de 20 s pour l'une d'elles, sans lui demander, avec ses vraies infos. L'envoyer : « je l'ai faite, elle est à vous, j'en fais 4/mois pour 300 € ». | **< 48 h** |
| **2 — Le premier oui** | Répéter l'étape 1 jusqu'à un client payant. Mesurer le vrai temps par vidéo, et le coût réel des abonnements. Ne rien automatiser tant que ce chiffre n'est pas connu. | 2 à 6 semaines |
| **3 — L'industrialisation** | Une fois 3 clients signés : automatiser le maillon le plus chronophage mesuré à l'étape 2 — probablement le montage, donc **dans Amorce**. C'est là que le projet rejoint le dépôt. | Après le 3ᵉ client |

L'étape 1 est volontairement une vente, pas une construction. Une démo envoyée
à une entreprise qui n'a rien demandé apporte en 48 h l'information que six
mois de développement n'apportent pas : est-ce que quelqu'un paie pour ça.

## Outils nécessaires

**Déjà installé (0 €)**
- Amorce — montage vertical 1080×1920, sous-titres, bruitages, export MP4.
- Un LLM pour les scripts et les accroches.

**À ajouter (abonnements, ordres de grandeur à vérifier)**
- Voix off synthétique — palier d'entrée à quelques euros/mois, gratuit pour tester.
- Génération de plans (image/vidéo) — le poste le plus variable, ~15–95 €/mois.
- Avatars parlants — ~25–120 €/mois. **Le seul poste réellement optionnel.**

**Gratuit et sous-estimé**
- Un moyen de facturer et un statut. À régler avant l'étape 2, pas après.

## Ce qui la ferait tomber

1. **L'acquisition, et elle seule.** Le marché déborde d'offres identiques à
   prix cassés. Ce qui se vend n'est pas « je fais des vidéos IA » mais « je
   connais votre métier ». Sans angle vertical (un secteur, un type de client),
   l'offre est indifférenciable et se négocie au prix le plus bas.
2. **L'avatar qui sonne faux.** C'est le maillon qui fait dire « c'est de l'IA »
   au bout de deux secondes, et qui coûte le plus cher. Le retirer monterait la
   complexité à 8 et le coût à 7 — **score global 8/10**.
3. **Le service qui ne passe jamais à l'échelle.** Si chaque vidéo demande deux
   heures de main, l'activité plafonne à un salaire, jamais plus. L'étape 2
   existe pour mesurer cette heure avant de s'engager.

## Niche

Trois critères décident, et aucun n'est la taille du marché : **produire sans
tourner** (il n'y a pas de caméra sur place), **récurrence** du besoin, et un
**budget marketing déjà dépensé ailleurs** — un client qui ne paie rien ne
commencera pas par nous.

| Niche | Sans tournage | Récurrence | Budget | Accès | Concurrence | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Professions réglementées | 10 | 9 | 9 | 5 | 8 | **8/10** |
| Organismes de formation | 9 | 8 | 7 | 7 | 6 | 7/10 |
| Éditeurs SaaS B2B | 9 | 7 | 8 | 6 | 5 | 7/10 |
| Artisans du bâtiment | 6 | 7 | 5 | 8 | 6 | 6/10 |
| Auteurs indés / KDP | 10 | 5 | 3 | 9 | 7 | 5/10 (plafonné) |

**Retenue : professions réglementées** (experts-comptables, avocats, notaires).

Le contenu y est purement informationnel — « ce qui change au 1ᵉʳ janvier pour
votre TVA » en 30 s — donc l'absence de tournage cesse d'être une limite pour
devenir le format lui-même. La loi changeant en permanence, la récurrence est
structurelle et non commerciale : un contenu daté doit être refait, personne
n'a besoin d'être convaincu de renouveler.

Le point faible est l'accès (5/10) : cycle long, profession prudente, secrétariat
filtrant. Il est assumé, parce qu'il est la contrepartie de la faible
concurrence — les niches faciles d'accès sont saturées par construction.

**Écartées, et pourquoi :**

- **Restauration, immobilier, salles de sport, e-commerce** — premières idées de
  tout le monde, donc prix effondrés ; et les deux premières exigent de filmer
  le réel, exactement ce qu'on ne sait pas faire.
- **Auteurs indés / KDP** — l'accès est excellent et l'alignement avec `kdp/`
  séduisant, mais le budget à 3/10 déclenche le plafond de la grille. Une niche
  sans argent n'est pas une niche. Bon terrain d'entraînement gratuit, jamais
  un client.

## Questions ouvertes

Les réponses déplacent le score ; la fiche sera reprise ensuite.

1. **Les avatars sont-ils indispensables, ou négociable ?** Les retirer fait
   passer la fiche de 7 à 8 — c'est le levier le plus rentable de toute la
   grille.
2. ~~Un secteur en tête ?~~ **Tranchée** — voir « Niche » ci-dessous.
3. **Forfait mensuel ou vidéo à l'unité ?** Le forfait rend l'activité
   prévisible et finançable ; l'unité la condamne à recommencer la vente chaque
   mois.
