---
name: paper-manager
description: Recette pour développer l'assistant administratif Paper-Manager (`paper-manager/`) — où poser chaque fichier, la frontière entre ce que l'humain décide et ce que la machine calcule, et les huit pièges d'arithmétique de dates, de montants et de réécriture de configuration qui ont chacun déjà coûté un bogue. À utiliser dès qu'on touche à `paper-manager/`, qu'on ajoute un module au parcours scan / calendrier / abonnements / résiliation, ou qu'une demande parle d'abonnements suivis, d'échéance, de préavis, de reconduction tacite, de tableau de bord de contrats ou de rappels d'agenda.
---

# Travailler sur Paper-Manager

Lire d'abord `paper-manager/README.md` : les décisions de conception y sont
justifiées, et cette recette ne les répète pas. Ce document dit **où poser les
fichiers**, **dans quel ordre travailler**, et **ce qui casse en silence**.

## Où va quoi

| Ce que tu ajoutes | Où |
| --- | --- |
| Une notion métier (objet, énumération, calcul de dates) | `core/modele.py` |
| Un réglage dans `admin_config.json` | `core/config.py`, via un lecteur `_Bloc` |
| Une étape de lecture d'un document | `core/scan.py`, `core/extraction.py`, `core/nommage.py` |
| Une règle sur les contrats ou les alertes | `core/abonnements.py` |
| Un format de sortie (`.ics`, courrier, PDF) | `core/calendrier.py`, `core/resiliation.py`, `core/formulaires.py` |
| Une trace de ce que la machine a lu | `core/journal.py` |
| Une commande | une sous-commande dans `paper.py`, jamais un second script |
| Un gabarit de courrier ou un plan de formulaire | `modeles/` |
| Un test | `tests/test_<module>.py` (`unittest`, sans dépendance ajoutée) |

L'affichage reste dans `paper.py` ; les modules de `core/` rendent des données.
Un module qui `print` ne se teste plus.

## La frontière qui tient le projet

- `admin_config.json` porte ce qui vient d'une **décision humaine** : contrats,
  préférences, statut d'une alerte. Irremplaçable.
- `coffre/documents.json` porte ce que la **machine a lu**. Se jette et se
  refabrique en relisant le coffre.

Avant d'ajouter un champ, se demander de quel côté il tombe. Écrire dans la
configuration ce que le programme sait recalculer, c'est fabriquer une donnée
qui se périme ; écrire dans le journal une décision humaine, c'est la perdre au
premier bogue d'extraction.

## L'ordre qui évite de revenir en arrière

1. **Le calcul d'abord**, dans `core/modele.py`, sans disque ni réseau. Il se
   teste immédiatement, et c'est là que sont les décisions.
2. **Le test du calcul**, avant tout le reste.
3. **Le réglage** dans `core/config.py` s'il en faut un : lecture typée,
   validation qui nomme le champ fautif, valeur par défaut.
4. **Le module métier**, qui compose le calcul et rend des données.
5. **La sous-commande** dans `paper.py`, qui met en forme.
6. **Le `README.md` du projet** : une décision non écrite est une décision
   qu'on refera autrement dans six mois.

## Les huit pièges qui coûtent une heure

- **Une date qui avance se recalcule depuis l'origine.** Décaler de proche en
  proche cumule le rabotage du jour : une échéance au 31 janvier tombe au
  28 février, puis y reste pour toujours. Passer par `modele._avancer`.
- **`engagement.fin` est la fin de la *première* période**, pas la prochaine
  date anniversaire. Utiliser `Engagement.terme`, qui la recalcule depuis
  `debut` + `duree_mois` quand il le peut — sinon une assurance reconduite
  depuis quatre ans se voit attribuer un coût de sortie, et on renonce à
  résilier un contrat qu'on pouvait quitter gratuitement.
- **On alerte sur le préavis, jamais sur l'échéance.** Un contrat à deux mois
  de préavis n'est plus résiliable deux mois avant son terme. Toute date
  affichée à l'utilisateur passe par `date_preavis`.
- **Les montants sont des `Decimal`, construits depuis une chaîne.**
  `Decimal(0.1)` vaut 0.1000000000000000055 ; `Decimal(str(0.1))` vaut 0,1. En
  `float`, un total de trois abonnements affiche 89.97000000000001.
- **Une écriture dans `admin_config.json` passe par `enregistrer_alertes`**, et
  ne touche que la section `alertes` : copie en `.bak`, fichier temporaire,
  remplacement atomique. La **mise en forme** du fichier devient celle du
  programme au premier passage — c'est attendu, ne pas chercher à la préserver.
- **Aucun binaire n'est versionné.** Les PDF de test se fabriquent à
  l'exécution (voir `tests/test_formulaires.py`) ; les formulaires vierges
  vivent dans `coffre/formulaires/`, ignoré par git, comme tout le coffre.
- **Une dépendance ajoutée doit exister en session distante.** Seul PyMuPDF est
  installé, et par la branche KDP du hook de démarrage. Ajouter une
  bibliothèque oblige à ajouter une branche à `.claude/hooks/session-start.sh`,
  faute de quoi `python3 -m unittest` ne démarre plus dans une session fraîche.
  Avant d'ajouter : est-ce que trente lignes de code ne suffiraient pas ?
  (`core/calendrier.py` écrit son `.ics` sans bibliothèque, pour cette raison.)
- **`admin_config.exemple.json` doit rester cohérent avec le code.** Un test
  compare ses dates d'alerte à ce que le calcul produit : un exemple qui
  contredit le programme enseigne une règle fausse. Le régénérer plutôt que de
  le retoucher à la main :

  ```python
  configuration.alertes = []
  enregistrer_alertes(configuration, alertes(configuration, date(AAAA, M, J)))
  ```

## Vérifier

```bash
python3 -m unittest discover -s paper-manager/tests -q
```

Ce que les tests ne disent pas, et qu'il faut signaler quand ça s'applique :
qu'un vrai Cerfa porte bien les noms de champs que son plan lui prête, qu'un
document photographié de travers se lit, et qu'un `.ics` s'ouvre dans l'agenda
d'un téléphone. Ces trois-là ne se voient qu'en le faisant.

## Conventions

Celles du dépôt (français partout, identifiants de code en anglais, commentaires
qui disent *pourquoi*), plus deux propres à ce projet :

- **Un bloc en tête de module** qui énumère les décisions numérotées, chacune
  avec ce qu'elle évite. C'est le format de tous les fichiers de `core/`, et
  c'est ce qui rend le projet reprenable.
- **Les intitulés de test sont des phrases** qui décrivent le comportement
  attendu : `test_l_alerte_porte_la_date_du_preavis_et_non_celle_de_l_echeance`.
  Un test dont le nom ne dit pas la règle ne documente rien.
