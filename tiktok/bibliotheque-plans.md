# Bibliothèque de plans — inventaire mesuré

Ce que le dépôt garde d'une bibliothèque de médias qu'il ne peut pas versionner :
**ce qu'elle contient, ce que chaque plan vaut, et lequel piocher.** Les fichiers
vivent chez l'auteur — l'invariant du dépôt interdit tout binaire.

Relevé sur **63 fichiers**. Régénérable d'une commande :

```bash
python3 .claude/skills/trier-les-rushes/scripts/trier.py <dossier> --sortie <sortie>
```

## La colonne qui décide d'un montage

Deux niveaux existent pour un même plan, et **ils ne se suivent pas** :

- le **niveau entier**, celui qu'un ordinateur ou un casque restitue ;
- le **niveau entendu**, ce qui reste après le filtre d'un haut-parleur de
  téléphone, qui ne rend rien sous 400 Hz.

Mesuré sur les six plans de TITANS EP01 :

| | écart entre les plans |
| --- | --- |
| niveau entier | 5,1 dB — l'oreille croit l'ensemble équilibré |
| niveau entendu | **15,4 dB** — l'œil et le vortex passent 15 dB sous la voix |

**C'est la cause de quatre jours de montages rejetés.** Ils étaient réglés sur la
première ligne ; le spectateur écoute la seconde. Le remède tient en une phrase :
**égaliser les plans sur leur niveau entendu, pas sur leur niveau entier.**

```bash
# ce que le plan vaut vraiment, avant de lui donner son gain
ffmpeg -hide_banner -nostats -ss <debut> -t <duree> -i <plan> \
       -af highpass=f=400,volumedetect -f null -
```

Appliqué à EP01, l'écart tombe de **15,4 dB à 4,0 dB** — sans toucher au timbre,
donc sans le grésillement que produit l'excitation harmonique sur un
enregistrement (voir `/bande-son`).

## Ce que la mesure a trouvé

- Perte médiane du lot : **8.5 dB**. Stable sur soixante fichiers :
  c'est le comportement des générateurs employés, pas un accident.
- Les montages déjà mixés ne perdent que **0,9 à 1,5 dB** : le défaut se corrige
  au montage, jamais à la génération.

### À supprimer — doublons au bit près

- `Chasing_The_Turquoise_Vortex.mp4` en 2 exemplaires identiques
- `Holographic_Sci_Fi_Symbol_Rotation2.mp4` en 2 exemplaires identiques
- `Duration_seconds_Cinemat.mp4` en 2 exemplaires identiques
- `Cyberpunk_Druid_Wormhole_Dragon_Sequence.mp4` en 2 exemplaires identiques
- `PLAN3_eclairs_SON_1s5.mp4` en 2 exemplaires identiques

### Sans son, ou muet

- `Holographic_Sci_Fi_Symbol_Rotation2.mp4` — piste présente, amplitude nulle (−180 dB)
- `PLAN3_eclairs_1s5.mp4` — **aucune piste audio** : version muette à sonoriser
- `Holographic_Sci_Fi_Symbol_Rotation2.mp4` — piste présente, amplitude nulle (−180 dB)

### Pièges de cadrage

- `Biomechanical_Dragon_Volcanic_Eruption2.mp4` est en **2544×1456, horizontal**.
  Monté tel quel en vertical, il n'occupe qu'une bande au milieu de l'écran.
  Le n° 1, `1456×2544`, est celui à prendre.

## Les plans, par famille de couleur

Une famille par épisode : le feuilleton respire sans perdre son unité.

### Druide vert-cyan — 24 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `Holographic_Sci_Fi_Symbol_Rotation2.mp4` | 5.2s | 1456x2544 | 0.0 dB | 0 |
| `Holographic_Sci_Fi_Symbol_Rotation2.mp4` | 5.2s | 1456x2544 | 0.0 dB | 0 |
| `Cybernetic_Druid_Warning_Prologue.mp4` | 10.1s | 768x1344 | 4.9 dB | 10 |
| `Cybernetic_Druid_Holding_Earth.mp4` | 5.2s | 1456x2544 | 5.0 dB | 7 |
| `Cybernetic_Druid_Planet_Warning.mp4` | 8.0s | 768x1344 | 5.1 dB | 12 |
| `Cybernetic_Druid_and_Dragon_Titan.mp4` | 17.0s | 480x854 | 7.4 dB | 12 |
| `Cyberpunk_Druid_Portal_Awakening.mp4` | 15.1s | 480x854 | 7.5 dB | 7 |
| `Cybernetic_Druid_Earth_Breach.mp4` | 10.1s | 768x1344 | 7.6 dB | 12 |
| `Prompt_Animation_du_Druide_Pl.mp4` | 10.0s | 720x1280 | 7.6 dB | 14 |
| `Cybernetic_Druid_Solar_Stargate_Awakening.mp4` | 15.1s | 480x854 | 8.3 dB | 6 |
| `Cyber_Druid_Holding_Earth.mp4` | 6.6s | 768x1344 | 8.8 dB | 2 |
| `Cyberpunk_Druid_Stargate_Portal.mp4` | 15.1s | 854x480 | 8.9 dB | 5 |
| `the_root_lion_master_synced.mp4` | 15.0s | 480x854 | 9.1 dB | 4 |
| `episode2_root_lion_with_title.mp4` | 15.0s | 480x854 | 9.2 dB | 8 |
| `Glowing_Turquoise_Celtic_Sigil.mp4` | 5.2s | 1456x2544 | 10.1 dB | 0 |
| `Cyberpunk_Druid_Wormhole_Dragon_Sequence.mp4` | 15.0s | 480x854 | 10.1 dB | 12 |
| `the_first_convergence_top_header_clean.mp4` | 15.0s | 480x854 | 10.1 dB | 12 |
| `the_first_convergence_perfect_layout.mp4` | 15.0s | 480x854 | 10.1 dB | 12 |
| `Cyberpunk_Druid_Wormhole_Dragon_Sequence.mp4` | 15.0s | 480x854 | 10.1 dB | 12 |
| `Cosmic_Druid_Sorcerer_Titan_Awakening.mp4` | 10.1s | 1080x1920 | 10.4 dB | 7 |
| `Glowing_Turquoise_Energy_Knot.mp4` | 5.2s | 768x1344 | 15.9 dB | 5 |
| `PLAN2_druide_SON_2s5.mp4` | 2.5s | 1080x1920 | 16.4 dB | 0 |
| `Cybernetic_Druid_Shattering_A_Planet.mp4` | 6.6s | 768x1344 | 17.3 dB | 6 |
| `Cosmic_Eye_Macro_Shot.mp4` | 5.2s | 768x1344 | 24.4 dB | 0 |

### Rouge crimson — 4 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `Episode_12_Crimson_Reaper_TikTok_Master.mp4` | 16.0s | 1080x1920 | 7.2 dB | 19 |
| `Crimson_Reaper_Mantis_Dragon_Genesis.mp4` | 15.1s | 480x854 | 8.4 dB | 15 |
| `Mantis_Dragon_Titan_Blade_Attack.mp4` | 8.0s | 768x1344 | 9.9 dB | 0 |
| `Mantis_Titan_Scythe_Attack.mp4` | 8.0s | 768x1344 | 10.5 dB | 2 |

### Bleu glace — 2 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `Episode_07_Astral_Leviathan_ViolentRoar_Master.mp4` | 15.7s | 720x1280 | 5.2 dB | 6 |
| `Frost_Leviathan_Cybernetic_Awakening.mp4` | 15.0s | 480x854 | 6.4 dB | 8 |

### Solaire / zèbre — 5 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `Episode_04_Solar_Zebra_HyperPaced_Master.mp4` | 16.0s | 720x1280 | 4.3 dB | 8 |
| `Episode_04_Solar_Zebra_Master_Raw.mp4` | 15.0s | 720x1280 | 4.8 dB | 7 |
| `Awakening_of_the_Solar_Stag.mp4` | 15.0s | 480x854 | 6.1 dB | 11 |
| `Awakening_of_the_Solar_Zebra_Phoenix.mp4` | 15.1s | 480x854 | 6.7 dB | 11 |
| `Episode_04_Solar_Zebra_ARRI_FieryFlight_Master.mp4` | 15.7s | 720x1280 | 8.9 dB | 4 |

### Créatures titan — 5 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `cyberhydraconforme.mp4` | 19.5s | 1080x1920 | 5.5 dB | 19 |
| `RootGorilla_Titan_Cinematic_Awakening.mp4` | 15.0s | 480x854 | 7.3 dB | 14 |
| `Mechanical_Gravitin_Sphinx_Attack.mp4` | 8.0s | 768x1344 | 7.7 dB | 0 |
| `Awakening_of_the_Chrono_Scarab.mp4` | 15.1s | 480x854 | 7.8 dB | 14 |
| `Mechanical_Sphinx_Lion_Attack.mp4` | 6.6s | 768x1344 | 9.1 dB | 0 |

### Vortex / portail — 5 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `Biomechanical_Dragon_Volcanic_Eruption2.mp4` | 6.6s | 2544x1456 | 8.7 dB | 0 |
| `Biomechanical_Dragon_Volcanic_Eruption.mp4` | 6.6s | 1456x2544 | 8.7 dB | 0 |
| `the_dragon_rift_audio_synced_perfect.mp4` | 15.0s | 480x854 | 10.1 dB | 12 |
| `Chasing_The_Turquoise_Vortex.mp4` | 5.2s | 768x1344 | 14.8 dB | 0 |
| `Chasing_The_Turquoise_Vortex.mp4` | 5.2s | 768x1344 | 14.8 dB | 0 |

### Montages finis — 6 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `final_1080x19201.mp4` | 18.5s | 1080x1920 | 0.9 dB | 0 |
| `final_1080x1920.mp4` | 18.5s | 1080x1920 | 1.0 dB | 0 |
| `final_v2.mp4` | 18.5s | 1080x1920 | 1.5 dB | 0 |
| `jour1tiktok.mp4` | 10.9s | 1080x1920 | 2.5 dB | 14 |
| `nouveaumontage.mp4` | 20.0s | 1080x1920 | 5.6 dB | 21 |
| `MONTAGE_EP01_FINAL_v3.mp4` | 13.5s | 1080x1920 | 15.7 dB | 3 |

### Plans découpés — 3 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `PLAN3_eclairs_SON_1s5.mp4` | 1.5s | 1080x1920 | 18.0 dB | 0 |
| `PLAN3_eclairs_SON_1s5.mp4` | 1.5s | 1080x1920 | 18.0 dB | 0 |
| `PLAN3_eclairs_1s5.mp4` | 1.5s | 1080x1920 | — | 0 |

### À classer — 9 plans

| plan | durée | définition | perte téléphone | parole |
| --- | --- | --- | --- | --- |
| `Cinematic_vertical_shot_.mp4` | 10.0s | 1280x720 | 7.2 dB | 11 |
| `92283607_1787576945468986.mp4` | 6.0s | 720x1280 | 8.2 dB | 2 |
| `951044067_1787577002023554.mp4` | 6.0s | 1080x1920 | 8.2 dB | 2 |
| `Duration_seconds_Cinemat.mp4` | 10.0s | 720x1280 | 8.5 dB | 5 |
| `Duration_seconds_Cinemat.mp4` | 10.0s | 720x1280 | 8.5 dB | 5 |
| `611117619_1787578340724210.mp4` | 8.0s | 1080x1920 | 10.5 dB | 2 |
| `689772262_1787229249927488.mp4` | 8.0s | 720x1280 | 10.6 dB | 5 |
| `753120157_1787226977226525.mp4` | 8.0s | 1280x2274 | 12.0 dB | 3 |
| `339643689_1787226720158020.mp4` | 8.0s | 720x1280 | 12.0 dB | 3 |
