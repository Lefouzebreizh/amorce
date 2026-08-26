# Chaîne de montage automatisée

Trois scripts indépendants, à lancer dans l'ordre. Chacun rend un fichier que le
suivant consomme, et chacun rend un code de retour non nul en cas d'échec — ils
s'enchaînent donc avec `&&` sans risquer de traiter un fichier absent.

```bash
# 1. Le texte devient une voix off
python elevenlabs_voice.py --text "Bienvenue dans cette nouvelle vidéo !" --output voice.mp3

# 2. Les lèvres du visage filmé se recalent sur cette voix
python auto_lipsync.py --video mon_visage.mp4 --audio voice.mp3 --output rendu_final.mp4

# 3. Le résultat atterrit sur une timeline DaVinci Resolve
python prepare_my_edit.py --file rendu_final.mp4
```

Les trois marchent aussi séparément : le troisième dérushe n'importe quel
dossier de rushes, sans rien devoir aux deux premiers.

## Installation

```bash
pip install -r requirements.txt
```

Suffisant pour la voix off. Le lip-sync demande deux choses de plus, décrites
plus bas — et `python auto_lipsync.py --check` dit à tout moment ce qui manque.

## 1. `elevenlabs_voice.py` — la voix off

La clé d'API se lit **uniquement** dans l'environnement, jamais en argument :

```bash
export ELEVENLABS_API_KEY="sk_..."          # Linux, macOS
$env:ELEVENLABS_API_KEY="sk_..."            # Windows, PowerShell
```

| Option | Défaut | Rôle |
| --- | --- | --- |
| `--text` | — | Le texte à faire dire. Obligatoire. |
| `--output` | `voice.mp3` | Fichier MP3 à écrire. |
| `--voice` | voix « Rachel » du catalogue public | Identifiant de la voix. |
| `--model` | `eleven_multilingual_v2` | `eleven_v3` pour plus d'expressivité. |

Le modèle par défaut est le plus récent qui soit ouvert à **tous** les comptes.
`eleven_v3` rend mieux mais son accès dépend de l'abonnement : en faire le défaut
ferait échouer le script chez une partie des utilisateurs.

Le MP3 n'est écrit sous son nom définitif qu'une fois le flux entièrement reçu.
Une coupure réseau ne laisse donc pas un fichier tronqué — qui passerait le
contrôle de présence du lip-sync et donnerait une vidéo muette à mi-parcours.

## 2. `auto_lipsync.py` — la synchronisation labiale

Wav2Lip n'est pas une bibliothèque : c'est un dépôt à cloner.

```bash
git clone https://github.com/Rudrabha/Wav2Lip montage-auto/Wav2Lip
pip install -r montage-auto/Wav2Lip/requirements.txt
```

Il faut ensuite **deux** jeux de poids, et c'est là que tout le monde trébuche :

| Fichier | Taille | Où le déposer | Rôle |
| --- | --- | --- | --- |
| `wav2lip_gan.pth` | ~416 Mo | `montage-auto/models/` | Fait bouger les lèvres |
| `s3fd.pth` | ~86 Mo | `montage-auto/models/` | **Trouve le visage dans l'image** |

Le second est le piège classique : Wav2Lip ne le télécharge pas et signale son
absence par une trace illisible. Déposé dans `models/`, le script le recopie
tout seul là où Wav2Lip va le chercher.

Aucun lien de téléchargement n'est écrit dans le code : les liens d'origine sont
morts et les miroirs se déplacent. Les adresses à jour sont dans le README du
dépôt Wav2Lip. Avec un miroir à soi :

```bash
export WAV2LIP_CHECKPOINT_URL="https://…/wav2lip_gan.pth"
export S3FD_URL="https://…/s3fd.pth"
```

Le script les télécharge alors lui-même, barre de progression comprise.

```bash
python auto_lipsync.py --check      # dit ce qui manque, sans rien traiter
```

| Option | Défaut | Rôle |
| --- | --- | --- |
| `--video`, `--audio`, `--output` | — | Les trois fichiers de la chaîne. |
| `--pads` | `0 10 0 0` | Marges autour du visage. Augmenter le deuxième si le menton est coupé. |
| `--resize-factor` | `1` | Divise la résolution. `2` si la mémoire GPU manque. |
| `--nosmooth` | non | Coupe le lissage temporel. À essayer si la tête bouge vite. |

Sans GPU CUDA, le traitement se fait quand même — environ trente fois plus
lentement. Le script le dit avant de commencer, pas après.

`WAV2LIP_HOME` pointe vers un clone situé ailleurs.

## 3. `prepare_my_edit.py` — le dérushage

**DaVinci Resolve doit être ouvert**, et le scripting externe autorisé
(`Preferences → System → General → External scripting using = Local`).

Le script crée un projet `Nouveau_Montage_Auto` en 1080p, importe les `.mp4`,
`.mov` et `.mkv` du dossier, et les pose dans l'ordre alphabétique sur une
timeline `Master_Cut`.

```bash
python prepare_my_edit.py                       # tout le dossier courant
python prepare_my_edit.py --dossier ~/Rushes
python prepare_my_edit.py --file rendu_final.mp4
```

Deux points qui ont coûté cher :

- **La cadence est lue avant l'import.** Resolve verrouille `timelineFrameRate`
  dès qu'un média entre dans le chutier ; le réglage est ensuite refusé sans un
  mot. La cadence du premier rush est donc mesurée par `ffprobe`, hors de
  Resolve, et posée sur un projet encore vide. Sans `ffprobe` : 24 im/s.
- **Un projet existant n'est jamais rouvert.** Si `Nouveau_Montage_Auto` existe
  déjà, le script crée `Nouveau_Montage_Auto_2`. Ajouter les mêmes rushes à un
  projet de la veille doublerait sa timeline.

Si Resolve est installé hors des chemins standards, `RESOLVE_SCRIPT_API` et
`RESOLVE_SCRIPT_LIB` l'emportent sur la recherche automatique.
