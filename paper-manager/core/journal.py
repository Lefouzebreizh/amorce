"""L'index de ce que la machine a lu — `coffre/documents.json`.

Séparé d'`admin_config.json`, et c'est la décision principale du projet :

- `admin_config.json` porte ce qui vient d'une **décision humaine** — les
  contrats, les préférences, le statut d'une alerte. Il est irremplaçable.
- `documents.json` porte ce que la **machine a lu**. Il se jette et se
  refabrique en relisant le coffre.

Confondre les deux, c'est risquer six mois de saisie de contrats à chaque bogue
d'extraction.

Le journal sert aussi de garde anti-doublon : chaque document y entre avec
l'empreinte SHA-256 de son contenu. Le même relevé déposé deux fois — ce qui
arrive dès qu'on synchronise deux dossiers — n'est classé qu'une fois.
"""
