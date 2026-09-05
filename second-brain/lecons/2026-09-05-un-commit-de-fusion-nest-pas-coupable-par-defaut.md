# Un commit de fusion n'est pas coupable par défaut — il faut le prouver, pas le déduire

`scripts/vercel-ignorer.sh` décide en comparant `git diff HEAD^ HEAD -- <chemins>`.
Sur un commit de fusion (deux parents), ce diff rend **tout ce que le second
parent a apporté depuis la divergence** — pas seulement le travail propre de la
branche. L'hypothèse semblait donc évidente : une session avait vu `iptv`
passer en « Building » sur PR #605 juste après une fusion d'`origin/main`, alors
que son propre travail ne touchait que `second-brain/lecons.md` — et en avait
conclu que la fusion avait ramené des changements `iptv/` venus de `main`.

**Mesuré le 05/09/2026 : c'est faux pour ce cas précis.** Les deux commits de
fusion de PR #605 (`3cc6b156..fbc2ee0e` puis `fbc2ee0e..b5aac072`) ne touchent
aucun fichier sous `iptv/` — vérifié par un diff direct sur les deux parents de
chaque fusion. Et les quatre commits `main` absorbés par la PR (#600, #601,
#602, #604) ne touchent `iptv/` non plus : `git log 8a35258..0f991ad -- iptv/`
rend une liste vide.

Le mécanisme décrit (diff contre le premier parent seul = tout ce qu'apporte la
fusion) reste vrai en général, et vaut d'être gardé en tête pour un futur cas.
Mais ici, il n'explique rien : soit l'observation portait sur une autre PR que
celle qu'on lui attribuait, soit une autre cause a joué (quota, projet sans
filtre de chemins, aléa du tableau de bord).

**La leçon n'est donc pas sur Vercel, elle est sur la méthode** : une
explication plausible, construite sans preuve à l'appui, se retransmet comme un
fait d'une session à l'autre — c'est exactement le défaut que la leçon voisine
sur `modules/depot/` décrit pour une absence. Ici c'était une accusation, pas
une absence, mais le remède est le même : **calculer le diff avant d'écrire la
cause**, jamais après.
