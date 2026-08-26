# Producteur de formats courts IA

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

## Questions ouvertes

Les réponses déplacent le score ; la fiche sera reprise ensuite.

1. **Les avatars sont-ils indispensables, ou négociable ?** Les retirer fait
   passer la fiche de 7 à 8 — c'est le levier le plus rentable de toute la
   grille.
2. **Un secteur en tête ?** (restauration, immobilier, artisanat, coaching…)
   Sans angle vertical, le critère rentabilité tombe de 5 à 3, et le plafond
   s'applique : score 5.
3. **Forfait mensuel ou vidéo à l'unité ?** Le forfait rend l'activité
   prévisible et finançable ; l'unité la condamne à recommencer la vente chaque
   mois.
