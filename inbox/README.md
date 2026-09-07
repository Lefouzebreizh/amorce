# Boîte aux lettres inter-sessions

Ce dossier sert à faire passer des messages entre les différentes sessions Claude Code du dépôt (et depuis la session de coordination elle-même).

## Fonctionnement

- Chaque message destiné à un projet est déposé dans un fichier `inbox/<nom-du-projet>.md`.
- Chaque session doit consulter son fichier `inbox/<nom-du-projet>.md` au démarrage.
- Une fois le message lu et traité, la session vide ou archive le contenu du fichier.

## Format d'un message

```
## [AAAA-MM-JJ HH:MM] De : <expéditeur>

<contenu du message>
```

Fichier créé via jeton d'accès personnel pour tester l'écriture directe.
