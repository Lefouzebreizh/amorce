---
name: jauge
description: Dire où en est la consommation de l'abonnement Claude — la fenêtre de cinq heures et celle de sept jours — et ce qu'elle permet encore de faire aujourd'hui. À utiliser dès qu'une demande porte sur ce qu'il reste avant d'être bloqué, sur l'usage, sur les limites, sur les quotas, ou sur l'opportunité de lancer un gros travail maintenant — y compris quand elle dit seulement « ma jauge », « où j'en suis », « il me reste combien », « je vais tenir jusqu'à quand », « c'est prudent de lancer ça maintenant », « je suis à combien », « ça va me coûter cher ». À utiliser aussi quand un travail long se prépare et qu'il vaut mieux vérifier la marge avant de s'y engager que de se faire couper au milieu.
---

# Où en est la jauge

Cette compétence répond à une question pratique — *est-ce que je peux lancer ce
travail maintenant ?* — et non à une curiosité de comptable. Ce qui compte n'est
pas le pourcentage, c'est ce qu'il autorise dans l'heure qui vient.

## D'où viennent les chiffres

Claude Code ne transmet la consommation de l'abonnement **qu'à la ligne
d'état**. Aucune commande, aucun fichier de configuration ne permet de la
retrouver autrement. La ligne d'état du dépôt (`.claude/hooks/ligne-etat.sh`)
dépose donc sa dernière lecture dans un fichier de passage, que voici :

```bash
python3 .claude/skills/jauge/scripts/lire-jauge.py
```

Exécuter ce script, et rendre compte de ce qu'il affiche. Ne jamais fabriquer
un chiffre qu'il n'a pas donné : une jauge inventée fait prendre exactement la
mauvaise décision, celle de lancer un travail long juste avant la coupure.

S'il annonce qu'aucun relevé n'est disponible, le dire et renvoyer à `/usage`.
C'est le cas normal au tout début d'une session : la ligne d'état n'a pas
encore tourné.

## Ce qu'il faut en dire

Le script rend des chiffres bruts. Le travail consiste à les traduire en
conséquence pratique, en trois lignes au plus :

1. **Les deux fenêtres, jamais une seule.** Celle de cinq heures se remplit et
   se vide vite ; celle de sept jours décide de la fin de semaine. Une marge
   confortable sur la première ne dit rien de la seconde, et c'est la seconde
   qui surprend.
2. **La fenêtre la plus contraignante gouverne la réponse.** Si l'une des deux
   est haute, c'est d'elle qu'on parle en premier ; l'autre suit en une
   incise.
3. **L'âge du relevé se dit dès qu'il dépasse quelques minutes.** Ces chiffres
   datent du dernier passage de la ligne d'état. Sur un relevé vieux d'une
   heure, la marge annoncée n'existe peut-être plus.

## Répondre à la vraie question

Quand la demande porte sur un travail précis — « je peux lancer la
vérification complète ? », « j'ai le temps de finir ça ce soir ? » —, la
réponse utile est un verdict, pas un tableau. Regarder la marge, la comparer à
l'ampleur du travail annoncé, et trancher. Quand la marge est courte, dire
l'heure à laquelle la fenêtre se vide : c'est ce qui permet de décider
d'attendre plutôt que de commencer et de se faire couper au milieu.

**Ne pas confondre les deux facturations**, et le rappeler si la demande les
mêle : l'abonnement paie Claude Code, la clé API paie les scripts qui appellent
le modèle par eux-mêmes — dans ce dépôt, `repondeur-facebook/`. Les deux
compteurs sont séparés et ne communiquent pas.
