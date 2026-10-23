import type { SongDraft } from './types.ts';

/** Brief lisible par un outil de création musicale, sans ajouter de promesse d'IA intégrée. */
export function musicPrompt(draft: SongDraft): string {
  const sections = [
    draft.title.trim() && `Titre : ${draft.title.trim()}`,
    draft.style.trim() && `Style musical : ${draft.style.trim()}`,
    draft.mood.trim() && `Ambiance : ${draft.mood.trim()}`,
    draft.voice.trim() && `Voix : ${draft.voice.trim()}`,
    draft.lyrics.trim() && `Paroles :\n${draft.lyrics.trim()}`,
    'Créer un morceau cohérent avec cette intention. Respecter les paroles et leur structure, laisser respirer les transitions et terminer proprement.',
  ].filter(Boolean);

  return sections.join('\n\n');
}
