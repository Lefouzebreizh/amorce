# Studio audio (Streamlit)

> **En sommeil — 26/08/2026.** Le code vit dans `archives-backlog/mon-app-audio/`,
> il n'a pas été touché. **35 tests, tous verts** au moment de la mise de côté.

## Pitch

Studio audio en Python/Streamlit : synthèse vocale, mixage, synchronisation.
Trois modules dans `core/` (`synthese`, `mixeur`, `synchroniseur`), une
interface Streamlit, un stockage local par catégories.

## Pourquoi il est ici

Pas d'échec technique, pas de blocage : simplement aucun avancement en cours.
Il occupait une place de « chantier actif » dans la grille d'alignement, ce qui
gonflait le score de toute idée prétendant s'y greffer. Le ranger rend la
grille honnête.

## Ce qui le ferait remonter

- Un besoin réel d'Amorce que la voix off maison ne couvre pas — le
  recoupement entre les deux est déjà large (`src/lib/voice.ts`, `sfx.ts`).
- Ou un premier utilisateur extérieur. Sans lui, c'est un outil pour une
  personne, et Amorce le recouvre en partie.

## État à la reprise

```bash
python3 -m unittest discover -s archives-backlog/mon-app-audio/tests   # 35 tests
bash archives-backlog/mon-app-audio/lancer.sh
```

PyTorch et Whisper restent volontairement non installés — six gigaoctets pour
un chemin d'alignement que la détection de silences remplace.
