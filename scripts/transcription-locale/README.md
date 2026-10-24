# Transcription locale pour Amorce

Ce petit outil lance WhisperX sur l’ordinateur. Le morceau n’est pas envoyé à un service. Au premier lancement, WhisperX télécharge ses modèles publics ; les lancements suivants les réutilisent depuis le cache local.

## Préparer l’outil

Installe Python, FFmpeg et WhisperX dans l’environnement Python que tu veux utiliser :

```bash
python -m pip install whisperx
```

## Transcrire et caler les mots

Depuis le dossier du projet Amorce :

```bash
python scripts/transcription-locale/transcrire.py "chemin/vers/ma-chanson.mp3"
```

Le script travaille sur le processeur avec Whisper `small` et écrit un fichier `ma-chanson.whisperx.json` à côté du morceau. Pour limiter l’usage mémoire ou processeur, ajoute `--threads 2 --batch-size 1`.

## Importer dans Amorce

1. Importe la même musique dans Amorce et ajoute tes plans à la timeline.
2. Ouvre le panneau **Sous-titres**, puis **Importer le calage**.
3. Choisis le fichier JSON créé par le script.
4. Écoute les paroles et retouche les repères incertains dans **Calage mot à mot** avant l’export.

Les temps du JSON sont relatifs au début du fichier audio. Amorce tient compte du décalage choisi dans le panneau Musique. Le script conserve les répétitions reconnues par WhisperX et ajoute un score d’alignement quand WhisperX en fournit un.

WhisperX fournit une première proposition automatique. Les paroles chantées, les mots tenus et les passages instrumentaux peuvent produire des mots ou des temps incertains : le contrôle à l’écoute reste nécessaire.
