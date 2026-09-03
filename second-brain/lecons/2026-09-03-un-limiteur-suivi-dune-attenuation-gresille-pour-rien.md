# Un limiteur suivi d'une atténuation grésille pour rien

Le propriétaire a signalé « un petit grésillement » sur un montage vertical dont
toutes les mesures étaient conformes : sonie dans la cible, vrai pic à
−11,3 dBTP, aucun échantillon écrêté. Rien ne le signalait.

La cause était dans l'ordre des étages, pas dans un réglage :

```
voix → présence +3,5 / +2,5 dB → gain +12 dB → limiteur à −1,4 dBFS → … → sortie −10 dB
```

**Le limiteur se voyait demander 9,67 dB de réduction sur 3,81 % des
échantillons** — mesuré en flottant, avant lui — puis la sortie rendait ces
décibels dix lignes plus bas. On distordait la voix pour la baisser ensuite.

## Ce que ça coûte, mesuré

Deux versions du même montage, même voix, même musique, comparées sur trois
secondes de parole :

| | 400–2000 Hz | 8–16 kHz | écart |
| --- | --- | --- | --- |
| avec le limiteur | −25,1 dB | −49,8 dB | 24,70 dB |
| sans | −28,5 dB | −58,0 dB | **29,50 dB** |

**4,8 dB d'aigu en trop par rapport à la bande de la voix** : c'est le
grésillement, et c'est de la distorsion d'intermodulation fabriquée par un
limiteur qui travaille en permanence avec une attaque de 5 ms.

## La règle qui en sort

**Le gain qui précède un limiteur se règle sur le niveau qu'on veut vraiment
sortir, jamais sur un maximum qu'on rattrape après.** S'il reste une
atténuation en fin de chaîne, elle prouve que le gain d'entrée était trop
haut de la même quantité.

Le contrôle tient en trois lignes et se fait **avant** le limiteur, sur un flux
flottant :

```bash
ffmpeg -i voix.mp3 -af "<toute la chaîne sauf le limiteur>" -f f32le - \
  | python3 -c "import array,math,sys; a=array.array('f'); a.frombytes(sys.stdin.buffer.read()); \
    print(20*math.log10(max(abs(v) for v in a)))"
```

Au-dessus du plafond de quelques dixièmes, c'est normal. **À dix décibels
au-dessus, le limiteur n'est plus une sécurité, c'est un effet** — et personne
ne l'a choisi.

`/master-telephone` disait déjà « c'est la présence qu'il faut réduire, pas le
seuil » et « au-dessus de −0,3 dBFS pendant plusieurs secondes, le limiteur
sculpte le son ». Ce qui manquait est le cas où **le niveau visé est bas** :
là, la parade n'est ni la présence ni le seuil, c'est de retirer le limiteur,
qui n'a plus rien à protéger. Le fichier final sort à −10,3 dBTP sans un seul
échantillon limité.
