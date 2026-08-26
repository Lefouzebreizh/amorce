# De la phrase aux décibels

Ce fichier détaille le tableau de `SKILL.md`. Le lire quand l'intention ne
tombe dans aucune des cinq familles, ou quand l'utilisateur conteste un réglage.

## Le principe

Un seul chiffre décide de tout le reste : **de combien la musique est sous la
voix**. Tout le reste — le fondu, les bruitages, la cible de loudness — se
déduit ou se règle indépendamment.

La voix se pose à 0 dB et ne bouge pas. C'est la référence. On règle la musique
autour d'elle, jamais l'inverse : monter la voix pour la faire ressortir la fait
saturer, et la normalisation finale annule le gain qu'on croyait avoir pris.

## Les cinq familles, en détail

**Voix off, tutoriel, explication — musique 16 dB sous la voix, plongée de 10 à 12 dB.**
La musique est là pour qu'il ne se passe pas rien entre deux phrases. Elle ne
doit jamais devenir un élément qu'on écoute. Si l'utilisateur dit « on entend
trop la musique », creuser l'écart à 18 dB avant de toucher à la plongée.

**Ambiance, voyage, sans parole — musique seule, pas de plongée.**
Ici la musique *est* le propos. Elle porte le montage. Le fondu de sortie
compte double : c'est le seul moment où elle se remarque.

**Rythmé, sport, accroche courte — musique 10 dB sous la voix, plongée de 8 dB.**
Baisse plus faible que d'habitude, et c'est voulu : sur une accroche de quinze
secondes, une musique qui s'efface casse l'élan qu'on cherchait à créer. On
préfère une voix qui lutte un peu plutôt qu'un trou.

**Calme, intime, témoignage — musique 20 dB sous la voix, plongée de 12 dB.**
La parole porte l'émotion, la musique ne doit pas la commenter. Baisse profonde,
remontée lente (c'est le réglage par défaut de `enveloppe_baisse`).

**Démonstration produit — musique 14 dB sous la voix, plongée de 10 dB, un bruitage par geste.**
La seule famille où les bruitages ne sont pas décoratifs : ils marquent ce qu'il
faut regarder.

## Les cas qui ne rentrent pas dans le tableau

| Situation | Ce qu'on fait |
| --- | --- |
| La musique a elle-même des paroles | Creuser l'écart de 4 dB de plus : deux voix qui se répondent sont illisibles quel que soit le niveau |
| Vidéo de moins de 10 s | Pas de fondu de sortie (`--fondu 0.3`) : une accroche courte se termine net, un fondu la fait traîner |
| Voix enregistrée très bas | Ne pas compenser en montant `--voix-db` de 20 dB : on remonterait le souffle avec. Le dire, et proposer de traiter la voix d'abord |
| Vidéo destinée à être regardée sans le son | La bande-son ne sauvera rien : orienter vers les sous-titres |
| Plusieurs musiques à la suite | Les monter en un seul fichier avec `acrossfade` avant d'appeler `monter.py` |
| L'utilisateur veut « plus fort » alors qu'on est déjà à la cible | Expliquer que la plateforme rebaissera. Ce qu'il veut est en général plus de présence : resserrer l'étendue dynamique, pas monter le niveau |

## Ce que veut vraiment dire chaque reproche

Les mots que les gens emploient ne désignent presque jamais le réglage à toucher.

| Ce qui est dit | Ce qu'il faut changer |
| --- | --- |
| « ça sonne amateur » | Le plus souvent : la coupure nette en fin de musique, et la boucle audible. Fondu et `acrossfade` |
| « le son est trop faible » | Vérifier la loudness avant de toucher au volume : c'est presque toujours -20 LUFS ou moins |
| « on n'entend pas ma voix » | La profondeur de baisse, pas le niveau de la voix |
| « c'est plat » | L'étendue dynamique trop resserrée, ou une musique sans relief. Ne pas monter le niveau |
| « ça pompe » | Deux passages parlés trop rapprochés : la musique remonte et replonge. Fusionner (`enveloppe_baisse` le fait au-delà de 0,6 s d'écart) |
| « il manque du rythme » | Des bruitages sur les coupes, pas un changement de musique |
