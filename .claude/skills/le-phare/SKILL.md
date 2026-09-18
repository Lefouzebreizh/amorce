---
name: le-phare
description: "Orchestrer une demande ou un événement qui concerne plusieurs projets du studio : choisir la prochaine action utile et les compétences déjà présentes, sans dupliquer leurs procédures. À utiliser au début d'un travail transversal, après un changement de code, lors d'un signal marketing ou client, et pour faire un bilan de priorités."
---

# Le Phare

Le Phare relie les compétences du dépôt ; il ne les remplace pas. Son résultat
doit être court et actionnable : **objectif, priorité, compétence suivante,
preuve attendue et point d'arrêt**.

## Trier avant d'agir

1. Identifier le projet, le signal reçu et son impact : client, production,
   acquisition ou dette interne.
2. Distinguer l'action déterministe (un contrôle, une publication planifiée,
   un test) d'une tâche ouverte qui nécessite un agent.
3. Choisir la plus petite compétence existante qui peut avancer le sujet.
   Ne pas créer de compétence jumelle.
4. Faire le contrôle avant l'action externe, puis conserver une preuve
   vérifiable : résultat de test, lien de déploiement, brouillon ou métrique.
5. Terminer dès que la prochaine décision revient à Erwan.

## Routage

| Signal | Compétence à enchaîner | Sortie attendue |
| --- | --- | --- |
| Modification de code ou demande de mise en ligne | `/verifier`, puis `/steward` | Vérifications ciblées ; déploiement seulement après feu vert |
| Erreur, CI rouge ou déploiement échoué | `/debogage-systematique` puis `/verifier` | Cause isolée, correctif vérifié |
| Projet ou priorité incertains | `/etat-du-depot` | Inventaire court et prochain chantier |
| Contenu ou réponse Facebook | `/repondeur-facebook` ou `/tiktok` | Brouillon, calendrier ou analyse ; pas de publication sans accord |
| Mesure de performance réseau | Metricool si un réseau est relié | Bilan, enseignement et prochaine action |
| Nouvelle capacité envisagée | `/nouvelle-competence` | Décision d'étendre l'existant ou compétence justifiée |
| Risque ou changement sensible | compétence de vérification adaptée | Preuve et validation humaine avant effet irréversible |

## Autonomie sûre

- Les analyses, contrôles, brouillons et recherches peuvent s'enchaîner.
- Une publication, un message envoyé, une suppression, une dépense, une
  modification d'accès ou un déploiement de production demande l'accord explicite
  d'Erwan, sauf automatisation déjà créée avec ce périmètre.
- Si une intégration n'est pas connectée, produire le brouillon ou le plan
  exécutable ; ne pas prétendre l'avoir exécutée.
- Ne pas inventer un KPI. L'absence de données est un résultat à signaler.
- Une automatisation existante peut produire un bilan ; elle ne doit pas prendre
  seule d'action publique ou irréversible.

## Bilan hebdomadaire

Pour un bilan réseau, produire : les comptes réellement reliés, les métriques
disponibles, les contenus publiés ou prévus, un enseignement et une seule action
prioritaire pour la semaine. Si Metricool n'a aucun compte relié, demander la
connexion des pages ou comptes avant de conclure sur leurs performances.
