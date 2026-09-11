# `claude-sonnet-5` réfléchit par défaut : `content[0]` n'est pas le texte

Sur `psy-ia`, une fois la clé Anthropic corrigée, `/api/repondre` rendait un
statut 200 (l'appel à Anthropic réussissait réellement, rien à journaliser)
mais un champ `reponse` **toujours vide**. La panne la plus difficile à
repérer des trois de la journée : aucune erreur, aucun log, un succès complet
qui ne produit rien.

**Mesuré, via la documentation officielle de l'API Claude (compétence
`claude-api`)** : `claude-sonnet-5` tourne en réflexion adaptative par
défaut, y compris sans le moindre paramètre `thinking` posé dans la requête
— contrairement à `claude-opus-4-8`/`4-7`, où omettre `thinking` désactive la
réflexion. Le tableau `content` de la réponse porte alors un premier bloc de
type `thinking` (champ `.thinking`, pas `.text`), et le texte réel arrive
dans un bloc `text` plus loin dans le tableau.

Tout code qui lit `resultat.content[0].text` à l'aveugle contre
`claude-sonnet-5` (ou tout autre modèle de la même famille — Fable 5/5.1,
Opus 5, Opus 4.6, Sonnet 4.6, qui ont tous la réflexion adaptative activable
ou active par défaut selon le modèle) obtient donc `undefined` en silence dès
que le modèle réfléchit, sans qu'aucun statut HTTP ne le signale.

**La parade, générale et pas spécifique à ce projet** : toujours chercher le
premier bloc de type `"text"` dans le tableau `content`, jamais supposer sa
position :

```ts
const blocTexte = resultat.content.find((bloc) => bloc.type === 'text');
const texte = blocTexte?.text ?? '';
```

Coût de ne pas le savoir : un succès qui ressemble à un échec, mesuré ici
après avoir déjà écarté deux fausses pistes (clé malformée, clé invalide) —
la vraie cause était dans le code, pas dans la configuration.
