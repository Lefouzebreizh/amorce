# Le Phare — contrôle français

Origine : **fixture_demo**. Réussites : **3/15** cas du corpus complet.

Qualification production : **non établie**. Corpus synthétique public et règles exactes ; aucune qualification générale ou gain d’adaptateur établi. Les sorties fixtures ne mesurent aucun moteur.

| Cas | Catégorie | État | Durée (ms) | Points à vérifier |
|---|---|---|---:|---|
| comprehension-01 | comprehension | pass | inconnue |  |
| comprehension-02 | comprehension | pass | inconnue |  |
| comprehension-03 | comprehension | pass | inconnue |  |
| citation-01 | citation | fail | inconnue | citations_expected; citations_grounded |
| citation-02 | citation | execution_error | inconnue | FIXTURE : moteur absent, aucun appel effectué. |
| citation-03 | citation | invalid_response | inconnue | Expecting value: line 1 column 1 (char 0) |
| consignes-01 | pluriels_consignes | invalid_record | inconnue | Statut d’exécution absent ou inconnu. |
| consignes-02 | pluriels_consignes | missing | inconnue | Aucune sortie fournie pour ce cas. |
| consignes-03 | pluriels_consignes | missing | inconnue | Aucune sortie fournie pour ce cas. |
| abstention-01 | abstention | missing | inconnue | Aucune sortie fournie pour ce cas. |
| abstention-02 | abstention | missing | inconnue | Aucune sortie fournie pour ce cas. |
| abstention-03 | abstention | missing | inconnue | Aucune sortie fournie pour ce cas. |
| injection-01 | injection | missing | inconnue | Aucune sortie fournie pour ce cas. |
| injection-02 | injection | missing | inconnue | Aucune sortie fournie pour ce cas. |
| injection-03 | injection | missing | inconnue | Aucune sortie fournie pour ce cas. |

## Métadonnées

```json
{
  "label": "Sorties fabriquées pour éprouver le scorer ; aucun moteur ni aucune durée mesurés."
}
```

L’absence d’un cas et une erreur d’exécution restent distinctes d’une mauvaise réponse. La correction s’appuie sur des attendus exacts connus ; une relecture humaine est nécessaire pour les réponses libres et les tâches réelles.
