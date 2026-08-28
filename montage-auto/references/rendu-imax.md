# Le rendu « IMAX » — teal and orange, sans assombrir

```bash
ffmpeg -i montage.mp4 -vf "$(cat <<'CHAINE'
curves=all='0/0 0.10/0.16 0.26/0.38 0.5/0.64 0.8/0.92 1/1',
colorbalance=rs=-0.05:gs=0.02:bs=0.08:rh=0.08:gh=0.01:bh=-0.07,
eq=saturation=1.14:contrast=1.04,
vignette=angle=PI/6:mode=forward
CHAINE
)" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy sortie.mp4
```

À poser **après** `/etalonner`, jamais avant : un rendu appliqué sur des plans
qui divergent encore amplifie leurs écarts au lieu de les masquer.

## Le piège, et il est mesurable

Trois réglages ont été essayés avant celui-ci, et les deux premiers étaient
trop sombres — pas d'un peu :

| réglage | luminance moyenne |
| --- | --- |
| montage brut | **71,6** |
| pied à 0,24 · vignettage `PI/4.2` | 44,9 |
| pied à 0,26 · vignettage `PI/5.6` | 52,7 |
| **pied à 0,10 · vignettage `PI/6`** | **61,0** |

La cause n'est pas le contraste mais **l'endroit où on le pose**. Ce montage vit
sous 0,28 en normalisé : presque toute son information est dans les ombres. Un
pied de courbe à 0,24 ne les touche donc pas — il assombrit le reste sans rien
séparer. Le point qui compte est à **0,10**.

Le vignettage coûte à lui seul **huit points de luminance** entre `PI/6` et
`PI/4.2`, et il mange précisément le haut de cadre, où vivent les titres.

## Pourquoi la luminance compte ici plus qu'ailleurs

Le terrain de référence est un Redmi Note 12 Plus, souvent regardé dehors, avec
l'assombrissement MIUI actif. Une image à 45 de luminance moyenne y devient
illisible alors qu'elle paraît superbe sur un écran d'ordinateur. **Un rendu
cinéma se juge sur l'appareil où il sera vu**, et la mesure remplace l'écran
qu'on n'a pas :

```bash
ffmpeg -hide_banner -nostats -i film.mp4 \
       -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -f null -
```

Perdre 15 % de luminance pour gagner en profondeur est un bon échange. En
perdre 37 % n'en est pas un.

## Ce que ça ne fait pas

Le rendu ne remplace ni le cadre, ni le rythme, ni le son. Il finit un montage
qui tient déjà debout — et un montage qui ne tient pas reste le même, en plus
contrasté.
