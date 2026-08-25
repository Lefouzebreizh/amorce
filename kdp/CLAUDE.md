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
- **Un défaut de dessin échappe à tout script.** C'est l'auteur qui a vu le
  regard vide. Mesurer avant de corriger, et avant de contester.

## Ce qui n'est pas versionné

Les planches, les PDF et les épreuves vivent dans `.travail/`, ignoré par git.
Le dépôt porte l'outillage et les décisions ; le PDF se refait, le savoir-faire
non.
