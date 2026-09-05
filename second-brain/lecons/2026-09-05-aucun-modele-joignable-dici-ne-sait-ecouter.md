# Aucun modèle joignable d'ici ne sait écouter

05/09/2026 — mesuré après un « fais écouter à Gemini avant de me l'envoyer ».

## Les trois portes, et pourquoi chacune est fermée

**La clé Gemini de l'environnement est un leurre.** `GEMINI_API_KEY` **existe**
bien dans les variables de la session — ce qui suffit à croire le chemin
ouvert — mais elle fait 68 caractères et commence par `ta_c`, quand une clé
Google en fait 39 et commence par `AIza`. L'API le dit sans ambiguïté :

```
{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.",
          "status":"INVALID_ARGUMENT","reason":"API_KEY_INVALID"}}
```

C'est un 400 sur la clé, pas un 403 sur l'hôte : `generativelanguage.googleapis.com`
répond parfaitement, comme le §7 de `CLAUDE.md` le mesurait le 01/09. Ce que ce
§7 laissait croire — « une clé y servira donc réellement », donc il suffirait
d'en avoir une — est vrai en droit et faux en fait : **il y en a une, et elle ne
vaut rien.** Une variable présente n'est pas un accès.

**Le nœud LLM du connecteur ElevenLabs ne prend que du texte.** Il porte pourtant
Gemini 3.1 Pro, Claude Sonnet 4.6 et GPT-5.5 — de quoi faire croire qu'on tient
l'oreille. `creative_get_flow_node_types` tranche : son seul port déclaré est une
sortie `text`, et ses consignes ne parlent que de `prompt`. Aucun port d'entrée
audio. Le connecteur sait **transcrire** (`speech-to-text`), c'est-à-dire lire
des mots ; il ne sait pas dire si un rugissement va avec une créature.

**higgsfield refuse les bruitages.** Son `generate_audio` l'écrit dans sa propre
description : il ne fait que de la parole, et ses modèles de musique et d'effets
« existent uniquement pour le pipeline de génération de jeu et ne doivent pas
servir à de l'audio autonome ».

## Ce qu'il faut faire à la place

**Faire juger le résultat, pas la matière.** La seule oreille disponible est
celle du propriétaire, et ce qui lui coûte le moins n'est pas d'écouter quatre
bruitages nus : c'est de regarder quatre fois les deux dernières secondes du
film, chacune avec un candidat **posé à sa place et au même niveau**. Il juge ce
qui sortira, pas ce qu'on lui demande d'imaginer.

Un carton numéroté sépare les prises — en pastilles dessinées par Pillow, parce
que le `ffmpeg` de cette machine n'a pas `drawtext`. Sa réponse tient alors en
un chiffre.

## Et le quota se compte avant, pas après

Un bruitage ElevenLabs coûte **16,665 crédits**, soit trois dixièmes de centime.
Quatre variations d'un même prompt en coûtent donc 67, et huit — quatre
caractères en deux exemplaires — en demandent 134. Le compte est parti à zéro au
milieu de la seconde salve :

```
This request exceeds your quota of 130341. You have 0 credits remaining,
while 17 credits are required for this request.
```

Les quatre premiers cris avaient pris les derniers crédits. **La leçon n'est pas
« générer moins » mais « compter avant »** : le solde ne se lit nulle part dans
la réponse d'une génération réussie, et rien ne prévient qu'on approche du bord.
`estimate_only` chiffre la demande sans rien dépenser — il chiffre le coût, pas
le reste à dépenser, et c'est le second qui manque.
