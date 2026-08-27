---
name: regenerer-planche
description: Remplacer une planche illustrée du recueil Roussy & Zéphy par une version régénérée — décider si le remplacement en vaut la peine, écrire l'invite qui évite les trois pièges connus, greffer la planche neuve dans le cadre du volume, la lettrer en vectoriel, et lire le verdict chiffré. À utiliser dès qu'une demande parle de régénérer, refaire, remplacer ou améliorer une planche, une page ou une illustration du recueil, dès qu'une planche paraît molle, floue, pixellisée, mal cadrée ou hors charte, dès qu'une nouvelle image arrive pour prendre la place d'une ancienne, et dès qu'on parle de la résolution ou du piqué d'une planche. À utiliser aussi quand la demande dit seulement « cette page est ratée », « on la refait », « le texte est mou », « la bordure ne va pas », « je t'envoie la nouvelle » ou « tu peux l'intégrer ». Pour corriger une planche sans la régénérer — une coquille, un regard, un élément à effacer — voir plutôt `retouche-planche`.
---

# Régénérer une planche du recueil

Une régénération coûte un aller-retour avec l'auteur, annule les corrections
déjà posées sur la planche, et **peut sortir moins bonne que l'originale**.
C'est arrivé : 808 de piqué contre 853, alors que la nouvelle était deux fois
moins agrandie. Le travail commence donc par décider si elle vaut la peine, pas
par écrire une invite.

## 1. Mesurer ce qui est imprimé, jamais la matière première

Le piège coûte une régénération pour rien, et il est passé à un cheveu.

`kdp/relecture/PASSE-RESOLUTION.md` désignait « Ce livre appartient à » comme la
planche la plus molle du volume. Vrai — et sans objet : `page_garde.py` avait
déjà recomposé cette page entièrement en vectoriel, précisément pour cette
raison. La planche mesurée **ne figurait plus dans le livre**.

Avant toute chose, vérifier ce que le PDF contient réellement :

```bash
python3 - <<'PY'
import pymupdf
d = pymupdf.open('.travail/sortie2/interieur_kdp.pdf')
for i, p in enumerate(d, 1):
    if p.get_text().strip():
        print(f"page {i} porte du texte vectoriel — elle est composée")
PY
```

Une page composée n'a pas de planche à régénérer. Et le numéro de page du livre
n'est pas celui de la planche : **le volume s'ouvre sur deux pages de titre,
donc planche N tombe en page N + 2.**

Ensuite seulement, mesurer. Deux chiffres décident, et ils se lisent ensemble :

| | ce qu'il dit | seuil |
| --- | --- | --- |
| **agrandissement** vers 2600 px | au-delà de ×2, la calligraphie décroche | ×2 |
| **piqué des contours** à taille normalisée | la netteté intrinsèque du dessin | médiane du volume |

Une planche cumulant les deux défauts mérite d'être refaite. Une seule des deux
ne suffit pas : la planche la moins agrandie du recueil (×1,27) était aussi
l'une des plus piquées, et la « refaire » n'aurait rien corrigé.

`kdp/pipeline/remplacer.py` porte la fonction `pique()` si une mesure ponctuelle
est nécessaire.

## 2. Écrire l'invite : trois interdits, chacun payé d'un aller-retour

`kdp/tome1/REGENERER-FaireLeSinge.txt` est le modèle à copier. Ce qui compte n'y
est pas la description de la scène — elle se relève sur la planche existante —
mais trois interdits.

**Aucun texte.** C'est la leçon la plus chère du tome 1 : trois coquilles
pixellisées, trois réémissions de planche. Un texte tracé se corrige en une
ligne. L'invite interdit donc titre, bulles, parchemin, numéros de case,
signature — et demande que **le tiers supérieur de chaque case reste calme**,
pour que les bulles vectorielles aient où se poser.

**Aucune bordure.** Une bordure générée ne ressemble jamais tout à fait à celle
du volume — feuilles plus grosses, orange plus saturé — et cela se voit au
premier feuilletage. Comme la planche sera greffée dans un cadre existant,
demander une bordure ne peut produire qu'un écart à retirer.

**Aucune texture de papier.** « Vintage paper texture » fait poser la texture
*par-dessus* le dessin : contraste écrasé, contours mous. C'est ce qui a fait
perdre les 45 points. Demander au contraire une aquarelle saturée à contours
d'encre francs, et interdire explicitement voile, sépia, vieillissement, grain.

Décrire aussi les couleurs de la charte en toutes lettres — les ailes de Zéphy
sont sorties lavande pâle là où elle demande violet profond vers or.

## 3. Une seule commande

```bash
python3 kdp/pipeline/remplacer.py --neuve <la planche reçue> --page 4
```

Elle greffe dans le cadre d'une planche de même nature, lettre en vectoriel
depuis le dossier de production, mesure l'ancienne et la nouvelle, et rend le
verdict. `--reperes` trace les boîtes à vide au lieu de lettrer, pour vérifier
qu'aucune bulle ne couvre le personnage qui parle — ce que le chiffre ne dit pas.

## 4. Lire le verdict, et ne pas le contourner

Il annonce parfois une perte. C'est une information, pas un échec de la
commande : le texte devenu vectoriel reste un gain, mais sur le dessin
l'originale peut être meilleure. Le dire à l'auteur avec les deux chiffres, et
**le laisser trancher** — le style d'un album est de son ressort, pas d'une
mesure.

Trois issues, toutes légitimes : garder l'ancienne, garder la nouvelle pour son
lettrage, ou régénérer une fois de plus avec une invite plus précise.

## 5. Regarder, toujours

Rendre la page et l'ouvrir, à côté d'une planche voisine. Aucune mesure ne voit
une bulle posée sur un museau, un médaillon effacé, un style qui décroche, ni un
titre de la donneuse qui transparaît. Dans ce projet, c'est l'auteur qui a
repéré le regard vide de Zéphy et la bordure qui ne collait pas — deux défauts
qu'aucun script n'avait relevés.

## Les pièges déjà payés

| Symptôme | Cause | Parade |
| --- | --- | --- |
| Bandes brunes autour du collage | `couleur_du_fond` rend l'orange de la bordure, pas le crème | prélever la teinte sur la donneuse |
| Titre fantôme sous le nouveau | fondu sur le bord bas de la bande de papier | bord bas franc, non fondu |
| Frise mécanique en bordure | bordure reconstituée depuis une grappe d'angle | greffer dans un cadre, jamais l'inverse |
| Texte sortant « grandn ! » | Lora ne dessine pas l'espace fine insécable | `lettrage.rendable()` la remplace |
| Médaillon effacé par une bulle | ordre de tracé | le coin haut-gauche leur est réservé |
| Page qui ne ressemble à rien | donneuse de nature différente | même nature — histoire, atelier, garde |
