---
name: verifier
description: Prouver qu'un changement d'Amorce fonctionne — lancer les parcours navigateur, mesurer le son d'un fichier exporté, lire les pistes d'un rush sans codec. À utiliser dès qu'on touche au rendu, à l'audio, à l'export ou à la mise en page mobile, et pour diagnostiquer un export dont le son ou l'image pose problème.
---

# Vérifier Amorce

L'essentiel du studio ne se teste pas hors navigateur. `npm test` couvre le
calculable ; tout ce qui touche au décodage, au mixage, au tracé et à
l'enregistrement demande un vrai Chromium et de vraies mesures.

Ce qui suit est ce que la pratique a appris, y compris les défauts qu'aucun
autre contrôle n'aurait vus.

## Les quatre parcours

Tous exigent `npm run dev` dans un autre terminal, et `npm run fixtures` une
fois pour fabriquer `.fixtures/rushes/`.

| Commande | Ce qu'elle prouve |
| --- | --- |
| `npm run verify` | Le parcours complet, profil ordinateur puis téléphone bridé ×4 |
| `npm run verify:reprise` | Le montage revient après un rechargement, et se relit |
| `npm run verify:partage` | Le service worker reçoit un fichier partagé, et ne met rien en cache |

Le bridage du processeur sur le profil téléphone n'est pas décoratif : sans lui,
la dégradation automatique de qualité ne se déclencherait jamais.

## Mesurer le son d'un fichier exporté

**Un niveau crête ne prouve rien.** Il est atteint par la première seconde. Un
export dont tout le reste est muet passe ce contrôle sans broncher — c'est
exactement le défaut qui a été trouvé : du son de la première à la cinquième
seconde, puis le silence numérique absolu jusqu'à la treizième.

Ce qu'il faut regarder, c'est la répartition dans le temps :

```bash
ffmpeg -v quiet -i FICHIER.mp4 -vn -ac 1 -ar 8000 -f s16le - | python3 -c "
import sys, struct, math
d = sys.stdin.buffer.read(); n = len(d)//2
v = struct.unpack(f'<{n}h', d[:n*2]); r = 8000
for s in range(n//r):
    b = v[s*r:(s+1)*r]
    rms = math.sqrt(sum(x*x for x in b)/len(b))/32768
    db = 20*math.log10(rms) if rms > 0 else -99
    print(f'{s:3d} s {db:6.1f} dB ' + '█'*max(0, int((db+60)/1.5)))
"
```

Une seconde sous −60 dB est un trou, pas un passage discret. `npm run verify`
fait cette mesure automatiquement quand ffmpeg est présent.

Le niveau global se lit plus vite :

```bash
ffmpeg -i FICHIER.mp4 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
```

Un montage sain tourne autour de −17 dB de moyenne et frôle 0 dB en crête.

## Lire les pistes d'un rush sans aucun codec

Utile quand le navigateur refuse un fichier : la structure MP4 se lit en Python
pur, et dit si une piste audio existe et ce qu'elle pèse. Un rush dont le son a
été détruit par un outil de découpe extérieur n'a **aucune** piste `soun`.

```bash
ffprobe -v error -show_entries stream=codec_type,codec_name,duration,bit_rate \
  -of default=noprint_wrappers=1 FICHIER.mp4
```

Un débit audio autour de 200 kb/s indique une piste réelle ; l'absence de ligne
`codec_type=audio` indique un fichier muet à la source.

## Ce que ces mesures ont déjà trouvé

- **Le son coupé à mi-montage.** Les plans n'étaient branchés sur le mixage
  qu'une fois, à la création du moteur audio ; tout plan né ensuite — un
  découpage, un import, le bouton des réglages recommandés — s'affichait sans
  son. Voir `usePlayback.ts`.
- **Les sous-titres hors champ.** Un texte posé au-delà de la dernière image ne
  s'affiche jamais et ne compte dans aucune couverture, mais figure dans la
  liste comme les autres.
- **Un remède qui aggrave.** Le bouton « Poser un bruitage sur chaque coupe »
  était offert sans condition, y compris à un montage qui en comptait déjà le
  double de la plage visée.

## L'environnement distant

Le hook `.claude/hooks/session-start.sh` installe les dépendances, présente le
Chromium disponible sous le numéro de révision qu'attend Playwright, et installe
ffmpeg. Ne pas lancer `playwright install` : cet environnement l'interdit.

## Le piège qui n'est pas dans le code

Sur Android, le sélecteur de fichiers rend régulièrement un fichier de **zéro
octet** quand l'entrée choisie vient d'un espace de stockage en ligne. Le
fichier est bon, c'est la copie qui manque. Le studio le dit désormais
explicitement, et accepte le bouton « Partager » qui, lui, transmet les octets
réels — à condition que l'application soit installée sur l'écran d'accueil.
