# Studio audio — voix, texte et bruitages

Aligner une voix off sur son texte, la ponctuer de bruitages, régler les volumes
et sortir un fichier. Les fichiers restent sur la machine ; seules la voix de
synthèse et la récupération d'un son par son adresse sortent sur le réseau.

## Installation

```bash
pip install -r requirements.txt
streamlit run app.py
```

L'interface s'ouvre sur `http://localhost:8501`.

`ffmpeg` n'est pas à installer à part : le paquet `imageio-ffmpeg` en fournit un.
S'il y en a déjà un sur la machine, c'est celui-là qui sert. Sans ffmpeg du tout,
l'application se limite aux fichiers WAV et le dit.

**Installation légère.** PyTorch et Whisper pèsent plusieurs gigaoctets et ne
servent qu'à l'alignement au mot près. En les retirant du fichier, tout le reste
fonctionne — l'application propose alors l'alignement par les silences, et le
minutage exact des voix de synthèse.

## Le parcours

1. **Texte & voix** — le script d'un côté (`.txt` ou `.srt` ; un `.srt` déjà
   minuté est accepté, ses minutages sont recalculés), la voix de l'autre :
   un enregistrement déposé, ou une voix fabriquée sur place.
2. **Synchronisation** — le texte reçoit ses minutages. Sortie : un tableau de
   répliques, téléchargeable en `.srt`.
3. **Bruitages** — poser un son à un instant donné. Les débuts de réplique sont
   proposés comme repères : c'est là qu'un bruitage tombe juste.
4. **Mixage** — un curseur par source, plus la baisse automatique de la musique
   sous la voix. Le résultat est écrit dans `stockage/resultats/`.

## Les trois façons d'aligner

Aucune ne remplace les deux autres.

| | Précision | Coût | Quand |
| --- | --- | --- | --- |
| **Voix de synthèse** | au mot, exact | offert | la voix a été fabriquée ici : le service dit lui-même quand il prononce quoi |
| **Whisper** | au mot | lent, gros | un enregistrement à caler proprement |
| **Silences** | à la réplique | instantané | tout de suite, ou sans PyTorch, ou quand la transcription déraille |

Dans les deux premiers cas, **seuls les minutages sont retenus** : le texte
affiché reste celui qui a été écrit. Whisper francise, invente une liaison, se
trompe de nom propre — le script, lui, est juste. Les deux suites de mots sont
donc appariées (alignement global classique), et une erreur de transcription ne
décale pas les cinquante répliques suivantes. Une réplique qu'aucun mot n'a
accrochée est interpolée entre ses voisines et **signalée** par un `~` : une
position approchée vaut mieux qu'un trou, à condition de ne pas la donner pour
sûre.

L'alignement par les silences, lui, découpe le signal aux silences et répartit le
texte sur les passages parlés au prorata des caractères. Deux réglages rattrapent
les cas difficiles :

- **Durée d'un silence** : en deçà, une pause est traitée comme une respiration
  et ne coupe pas la réplique.
- **Sensibilité** : le seuil de parole se mesure sous la crête de
  l'enregistrement, pas dans l'absolu. Une voix captée au téléphone crête vers
  -30 dBFS ; un seuil fixe à -38 dB n'y trouverait aucun passage parlé.

## Arborescence

```
app.py                 l'interface (Streamlit) — aucune logique de traitement
core/synchroniseur.py  transcription, appariement script/voix, découpe aux silences, SRT
core/synthese.py       voix de synthèse (edge-tts) et minutage des mots
core/mixeur.py         bruitages, volumes, baisse du fond sous la voix, export
stockage/voix/         les enregistrements
stockage/textes/       les scripts (.txt, .srt)
stockage/bruitages/    la bibliothèque de sons — bruitages et musiques
stockage/resultats/    les mixages produits
```

Le contenu de `stockage/` n'est pas versionné, l'arborescence l'est.

## Vérifier

```bash
python3 -m unittest discover -s tests
```

Les tests couvrent ce qui décide : découpe du script, appariement avec une
transcription, interpolation des répliques manquantes, détection des passages,
répartition du texte, format SRT, plan d'atténuation, calage de la musique et
durée du mixage. Ils tournent sans réseau et sans PyTorch — les deux appels qui
sortent de la machine (modèle Whisper, service de synthèse) sont réduits à une
fonction de conversion, vérifiée à part.

Ce qu'ils ne couvrent pas : le rendu de l'interface, la qualité réelle d'une
transcription, et la voix de synthèse elle-même. Cela se regarde en lançant
l'application.
