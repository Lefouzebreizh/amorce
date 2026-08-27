# kdp — chaîne éditoriale de Roussy & Zéphy

Ce dossier n'a rien à voir avec l'application Amorce qui l'entoure. Il fabrique
un album jeunesse imprimé : trier des planches, corriger ce qui est pixellisé,
composer ce qui doit l'être, assembler deux PDF pour KDP, et contrôler le tout.

## Avant de toucher à quoi que ce soit

`charte.py` porte les données : sommaire de chaque tome, cotes KDP, palette des
personnages, règle de nommage. **Ouvrir ce fichier d'abord.** Les outils
identifient une planche par son slug, jamais par son numéro — c'est ce qui
permet de renuméroter un sommaire entier en relançant le renommage.

## Les commandes

```bash
python3 kdp/kdp.py --tome 1 controler --source planches/
python3 kdp/pipeline/tout.py --rushes rushes/ --travail travail/
python3 kdp/pipeline/valider.py --dossier sortie/
python3 kdp/tome2/relire.py kdp/tome2/DOSSIER.md
```

`valider.py` sort en erreur. C'est lui qui décide, pas l'œil.

## Les leçons dures

Elles ont toutes coûté un aller-retour. Les relire vaut mieux que les répéter.

- **L'agrandissement interpole, il ne crée pas de détail.** Il rend conforme,
  pas net. Toujours donner le facteur : au-delà de ×2, la calligraphie décroche.
- **Ne jamais générer le texte dans l'image.** Un titre vectoriel est net en
  vignette et se corrige en une ligne ; un titre pixellisé impose de tout refaire.
- **Un contrôle qui recale sa propre référence est faux, pas sévère.** Le premier
  contrôle de palette rejetait la planche de modèle. Calibrer chaque contrôle sur
  un cas connu bon et un cas connu mauvais, sinon ne pas le livrer.
- **Une lecture à basse résolution invente des fautes.** Le tréma de « lëttres »
  n'existait pas : c'était la barre d'un double « t ». Établir une coquille sur
  la carte d'encre avant de la corriger.
- **La bande « or » d'une palette contient tout le feuillage d'automne.** Une
  mesure vraie ne mesure pas forcément ce qu'on croit.
- **Le fondu d'un masque ne doit jamais rencontrer d'encre**, sinon fantôme.
- **La tranche se calcule sur le nombre de pages du PDF final**, pas sur le
  nombre d'illustrations.
- **« Texture de papier » dans une invite lave tout le dessin.** Le générateur
  la pose *par-dessus* l'illustration au lieu de la mettre dessous : contraste
  écrasé, contours mous. La première régénération de « Faire le singe » en est
  sortie moins piquée que la planche qu'elle devait remplacer — 808 contre 853
  à la taille d'impression, alors qu'elle était deux fois moins agrandie.
- **Ne pas faire générer la bordure d'une planche à remplacer.** Elle ne
  ressemblera jamais tout à fait aux autres, et cela se voit au feuilletage.
  Demander les cases seules, puis `greffe.py` les pose dans le cadre du volume.
- **Un défaut de dessin échappe à tout script.** C'est l'auteur qui a vu le
  regard vide. Mesurer avant de corriger, et avant de contester.
- **Un chemin sous `/mnt/skills/` n'existe que dans une session Claude Code.**
  Les polices du lettrage ont été écrites ainsi : les tests passaient dans la
  session qui les écrivait et rougissaient partout ailleurs, laissant `main`
  rouge cinq exécutions durant sans que la cause se lise nulle part. Tout
  chemin hors du dépôt se pose désormais par variable d'environnement
  (`KDP_POLICES`), avec le chemin de session pour seul défaut — et à **un seul
  endroit**, `charte.POLICES` : les dix outils qui lettrent une page le
  portaient chacun en dur, ce qui rendait la chaîne inexécutable ailleurs et
  demandait dix corrections pour une seule décision.

## Manière de travailler avec l'auteur

**Devant un choix technique, trancher et avancer.** Ne pas remonter une question
dont la réponse se déduit d'une mesure, d'une contrainte du format ou d'une
règle déjà écrite ici. Choisir la meilleure solution, l'appliquer, et dire en
une phrase ce qui a été choisi et pourquoi — l'auteur corrige après coup si le
choix ne lui va pas, et cela coûte toujours moins cher qu'un aller-retour.

Cela ne change rien à la discipline de mesure : **ne pas savoir n'autorise pas à
deviner.** Devant un fait incertain on mesure, puis on tranche. La règle porte
sur ce qu'on fait après la mesure, pas sur le droit de s'en passer.

Trois cas continuent de remonter à l'auteur, parce que la bonne réponse n'y est
pas technique :

- **La voix du livre.** Un titre, une réplique, le ton d'un parchemin. Deux
  lectures de la demande y donnent deux livres différents.
- **Ce qui sort vers le monde.** Publier, envoyer, dépenser. Une fois parti,
  cela ne se reprend pas.
- **Ce qu'il est le seul à savoir.** Une adresse, une date, un prix, un choix
  commercial.

Partout ailleurs : décider, faire, et le dire.

## Ce qui n'est pas versionné

Les planches, les PDF et les épreuves vivent dans `.travail/`, ignoré par git.
Le dépôt porte l'outillage et les décisions ; le PDF se refait, le savoir-faire
non.
