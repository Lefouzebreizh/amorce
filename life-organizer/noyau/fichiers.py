"""Parcours, empreintes, quarantaine et déplacements sûrs.

Deux décisions y sont attendues :

1. **Rien ne se supprime** (README, décision 1). `mettre_en_quarantaine` déplace
   dans un dossier daté et consigne d'où venait le fichier ; c'est ce qui rend
   un faux positif rattrapable. Aucun autre fichier du projet n'a le droit
   d'appeler `Path.unlink()` sur un fichier de l'utilisateur.
2. **Le parcours ne s'arrête jamais.** Un dossier réel contient un fichier de
   0 octet, un nom avec un saut de ligne, un lien symbolique qui boucle, un
   fichier verrouillé par une autre application. Chacun est consigné et enjambé :
   échouer au millième fichier sur deux mille est le meilleur moyen de perdre le
   travail des neuf cent quatre-vingt-dix-neuf premiers.

À écrire : `parcourir`, `empreinte`, `mettre_en_quarantaine`, `purger_quarantaine`,
`deplacer`, `nom_disponible`.
"""
