---
name: reprise-de-session
description: Écrire le résumé qui permet de repartir dans une session neuve sans rien perdre, et savoir quand il est temps de passer le relais — `CLAUDE.md` l'impose (« passer le relais avant que le fil ne pèse ») mais ne dit pas comment. Rend un texte prêt à coller, qui porte les décisions et leurs raisons, l'état vérifié du dépôt, ce qui est en vol, et ce qu'il ne faut surtout pas refaire. À utiliser dès qu'une conversation s'allonge, change de sujet, contient des captures d'écran, redevient lente, ou qu'une demande dit « fais un résumé pour continuer ailleurs », « on repart d'où », « nouvelle session », « passe le relais », « ça rame », « résume ce qu'on a fait » — et de soi-même, sans attendre qu'on le demande, quand le fil coûte plus cher que le travail qu'il porte.
---

# Une conversation longue se paie à chaque message

Un fil est relu **en entier** à chaque tour, captures d'écran comprises. Son coût
ne croît pas avec le travail restant mais avec tout ce qui a déjà été dit : au
bout d'un moment, une correction d'une ligne coûte le prix de la conversation
entière. Une session neuve avec un bon résumé fait le même travail pour une
fraction du prix — et souvent mieux, parce qu'elle n'a pas trois faux départs
en mémoire.

C'est pour ça que `CLAUDE.md` en fait une règle. Ce n'est ni un aveu d'échec, ni
une perte : **la mémoire du projet est dans le dépôt et dans les compétences**,
pas dans la discussion.

## Quand passer le relais

Un seul de ces signaux suffit :

- **Le sujet a changé.** On a livré le validateur, on parle maintenant de la
  stratégie éditoriale. Tout le début du fil est devenu du poids mort.
- **Une capture d'écran est passée.** Une image se relit à chaque tour et pèse
  très lourd. Deux ou trois, et le fil est condamné.
- **Le travail est fusionné.** Une PR fermée, c'est une frontière naturelle.
- **Les réponses ralentissent** sans que les tâches soient plus difficiles.

Ne pas attendre qu'on le demande. Proposer le relais **est** le travail bien
fait, et cela se dit en deux lignes à la fin d'une réponse, pas en interrompant.

## Écrire le résumé

D'abord mesurer, ne jamais recopier de mémoire — le dépôt aura bougé pendant la
conversation, parfois de plusieurs fusions :

```bash
python3 .claude/outils/etat.py
```

Puis remplir cette trame. Elle est courte exprès : un résumé qui approche la
longueur du fil qu'il remplace n'a rien économisé.

```markdown
## Reprise — <sujet en cinq mots>

**Où en est le dépôt.** `main` à <tête>, <n> chantiers. Branche <nom> :
<en avance / à jour / fusionnée>.

**Ce qui a été livré.** <une ligne par PR, avec son numéro et son état>

**Les décisions prises, et pourquoi.** <deux à quatre lignes ; la raison compte
plus que la décision, parce que c'est elle qui permet de trancher la suite>

**Ce qui est en vol.** <PR ouverte, vérification en cours, contrôle programmé —
ou « rien »>

**Le prochain pas.** <une seule action, la plus concrète possible>

**À ne pas refaire.** <les pistes déjà écartées et leur motif, les réglages déjà
calibrés>
```

## Les deux rubriques qui font la différence

**« Les décisions prises, et pourquoi ».** Une décision sans son motif se
redébat le lendemain. Écrire « le prix pèse 10 et non 20, parce qu'il notait
20/20 sur les trois niches d'essai » évite qu'on repose la question ; écrire
« le prix pèse 10 » ne l'évite pas.

**« À ne pas refaire ».** C'est ce qu'aucun dépôt ne porte : les impasses. Une
session neuve reprendra naturellement la piste qu'on a déjà écartée, puisque
rien n'en garde la trace. Deux lignes ici valent une heure là-bas.

## Ce qui ne va pas dans le résumé

Ce qui a déjà sa place ailleurs, et qui l'a de façon plus durable :

- une règle générale → `CLAUDE.md`
- une méthode réutilisable → une compétence sous `.claude/skills/`
- un piège de domaine → l'en-tête du fichier concerné, ou `CLAUDE.md`
- une idée à trancher plus tard → une fiche, via `/idee-faisabilite`

**Écrire ces choses-là avant de passer le relais**, pas dans le résumé. Un
résumé se lit une fois puis meurt ; le dépôt, lui, sert à toutes les sessions
suivantes. C'est la seule vraie règle de cette compétence : le relais est le bon
moment pour ranger ce que la conversation a produit et que personne n'a encore
écrit.

## Passer la main

Rendre le résumé **prêt à coller**, dans un bloc, et donner un nom à la session
suivante — court et descriptif, pour qu'on la retrouve dans une liste
(« KDP — calibrer le validateur sur du réel »). Puis dire que celle-ci peut être
archivée.

Si rien n'a encore été poussé, le pousser d'abord : un conteneur de session est
éphémère, et ce qui n'est pas dans le dépôt n'existe pas.
