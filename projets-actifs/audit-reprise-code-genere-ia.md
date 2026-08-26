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
