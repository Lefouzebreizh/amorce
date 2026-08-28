# Layer blockbuster

L'ordre n'est pas négociable : chaque étage suppose le précédent.

1. **B-Roll** ou plan source, à sa pleine définition.
2. **LUT_teal_orange.cube**, en premier. Un étalonnage posé après le grain
   déplace le grain avec lui et le fait virer.
3. **light_leak_orange.png** en *superposition*, opacité **20 %**. Au-delà de
   30 % la fuite devient un filtre, et ça se voit.
4. **film_grain_4k.mp4** en *superposition*, opacité **12 %**, en boucle. Le
   grain se pose en **dernier** des images : tout filtre suivant le lisse et il
   ne reste qu'un flou.
5. **vignette_soft.png**, opacité 60 %. `vignette_strong` seulement si le sujet
   est centré — sinon elle mange le bord où il se trouve.
6. **Un impact** de `kits/sfx/impacts/` sur la coupe. Sans lui, l'œil voit un
   changement d'image et l'oreille n'entend rien : le montage paraît mou quel
   que soit son rythme.

Contrôle avant publication : `python3 .claude/skills/voir-le-son/scripts/voir.py`
pour le son, et la note `visibilite_telephone` du catalogue pour l'image.
