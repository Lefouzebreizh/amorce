import type { Bilingual } from '../types'

/** Toutes les chaînes d'interface, FR et EN (cahier §2). */
export const strings = {
  // — Barre du haut —
  'app.tagline': { fr: 'Éditeur court format', en: 'Short-form editor' },
  'app.project': { fr: 'Projet sans titre', en: 'Untitled project' },
  'top.export': { fr: 'Exporter', en: 'Export' },
  'top.exporting': { fr: 'Export…', en: 'Exporting…' },
  'top.lang': { fr: 'Langue', en: 'Language' },

  // — Rail d'icônes —
  'rail.library': { fr: 'Bibliothèque', en: 'Library' },
  'rail.hooks': { fr: 'Accroches', en: 'Hooks' },
  'rail.audio': { fr: 'Audio', en: 'Audio' },
  'rail.export': { fr: 'Export', en: 'Export' },

  // — Import —
  'import.title': { fr: 'Importer une vidéo', en: 'Import a video' },
  'import.drop': { fr: 'Glissez une vidéo ici', en: 'Drop a video here' },
  'import.or': { fr: 'ou', en: 'or' },
  'import.browse': { fr: 'Parcourir les fichiers', en: 'Browse files' },
  'import.formats': { fr: 'MP4 ou MOV · 1 minute maximum', en: 'MP4 or MOV · 1 minute max' },
  'import.reading': { fr: 'Lecture du fichier…', en: 'Reading file…' },
  'import.errFormat': {
    fr: 'Format non pris en charge. Utilisez un fichier MP4 ou MOV.',
    en: 'Unsupported format. Please use an MP4 or MOV file.',
  },
  'import.errDuration': {
    fr: 'Vidéo trop longue ({d}). La durée maximale est de 1 minute.',
    en: 'Video too long ({d}). Maximum duration is 1 minute.',
  },
  'import.errDecode': {
    fr: 'Impossible de lire cette vidéo dans le navigateur.',
    en: 'This video could not be read in the browser.',
  },
  'import.addAnother': { fr: 'Ajouter une vidéo', en: 'Add a video' },

  // — Bibliothèque —
  'lib.title': { fr: 'Bibliothèque', en: 'Library' },
  'lib.transitions': { fr: 'Transitions', en: 'Transitions' },
  'lib.sfx': { fr: 'Bruitages', en: 'Sound effects' },
  'lib.search': { fr: 'Rechercher…', en: 'Search…' },
  'lib.preview': { fr: 'Prévisualiser', en: 'Preview' },
  'lib.apply': { fr: 'Appliquer', en: 'Apply' },
  'lib.applyHintTransition': {
    fr: 'Sélectionnez une coupe sur la timeline pour appliquer une transition.',
    en: 'Select a cut on the timeline to apply a transition.',
  },
  'lib.applyHintSfx': {
    fr: 'Le bruitage est posé à la position de la tête de lecture.',
    en: 'The sound effect is placed at the playhead position.',
  },
  'lib.empty': { fr: 'Aucun résultat.', en: 'No results.' },
  'lib.energy': { fr: 'Énergie', en: 'Energy' },
  'energy.impact': { fr: 'Impact', en: 'Impact' },
  'energy.fluide': { fr: 'Fluide', en: 'Smooth' },
  'energy.doux': { fr: 'Doux', en: 'Soft' },
  'sfx.transition': { fr: 'Transition', en: 'Transition' },
  'sfx.accent': { fr: 'Accent', en: 'Accent' },
  'sfx.ambiance': { fr: 'Ambiance', en: 'Ambience' },

  // — Aperçu —
  'preview.title': { fr: 'Aperçu 9:16', en: '9:16 preview' },
  'preview.play': { fr: 'Lecture', en: 'Play' },
  'preview.pause': { fr: 'Pause', en: 'Pause' },
  'preview.empty': { fr: 'Importez une vidéo pour commencer', en: 'Import a video to get started' },
  'preview.muted': { fr: 'Couper le son', en: 'Mute' },
  'preview.unmuted': { fr: 'Rétablir le son', en: 'Unmute' },

  // — Score d'accroche —
  'score.title': { fr: "Score d'accroche", en: 'Hook Score' },
  'score.subtitle': { fr: '2 premières secondes', en: 'First 2 seconds' },
  'score.analyzing': { fr: 'Analyse en cours…', en: 'Analyzing…' },
  'score.none': { fr: 'Aucune vidéo à analyser.', en: 'No video to analyze.' },
  'score.recompute': { fr: 'Relancer l’analyse', en: 'Re-run analysis' },
  'score.signals': { fr: 'Signaux mesurés', en: 'Measured signals' },
  'score.advice': { fr: 'Conseils', en: 'Advice' },
  'score.gain': { fr: 'jusqu’à +{n} pts', en: 'up to +{n} pts' },
  'score.presets': { fr: "Styles d'ouverture", en: 'Opening styles' },
  'score.reference': { fr: 'référence', en: 'reference' },
  'score.audioUnavailable': {
    fr: 'Piste audio illisible : score calculé sur les signaux visuels uniquement.',
    en: 'Audio track unreadable: score computed from visual signals only.',
  },
  'level.faible': { fr: 'Faible', en: 'Weak' },
  'level.moyen': { fr: 'Moyen', en: 'Average' },
  'level.fort': { fr: 'Fort', en: 'Strong' },
  'signal.cutRhythm': { fr: 'Rythme de coupe', en: 'Cut rhythm' },
  'signal.motion': { fr: 'Mouvement', en: 'Motion' },
  'signal.contrast': { fr: 'Contraste visuel', en: 'Visual contrast' },
  'signal.saturation': { fr: 'Densité colorée', en: 'Color punch' },
  'signal.audioOnset': { fr: 'Attaque sonore', en: 'Audio attack' },
  'signal.timeToAction': { fr: 'Entrée en action', en: 'Time to action' },

  // — Hooks viraux —
  'hooks.title': { fr: 'Accroches virales', en: 'Viral hooks' },
  'hooks.subtitle': {
    fr: 'Patrons d’ouverture éprouvés, à adapter à votre sujet.',
    en: 'Proven opening patterns, to adapt to your topic.',
  },
  'hooks.pace': { fr: 'Rythme', en: 'Pace' },
  'hooks.estimated': { fr: 'Score estimé', en: 'Estimated score' },
  'hooks.apply': { fr: 'Appliquer le rythme', en: 'Apply pacing' },
  'hooks.applied': {
    fr: 'Rythme appliqué au début de la timeline.',
    en: 'Pacing applied to the start of the timeline.',
  },
  'hooks.needClip': {
    fr: 'Importez une vidéo avant d’appliquer une accroche.',
    en: 'Import a video before applying a hook.',
  },
  'hooks.tooShort': {
    fr: 'Le premier clip est trop court pour ce rythme.',
    en: 'The first clip is too short for this pacing.',
  },
  'pace.rapide': { fr: 'Coupes rapides', en: 'Fast cuts' },
  'pace.moyen': { fr: 'Rythme moyen', en: 'Medium pace' },
  'pace.lent': { fr: 'Coupes lentes', en: 'Slow cuts' },

  // — Audio —
  'audio.title': { fr: 'Niveaux audio', en: 'Audio levels' },
  'audio.voice': { fr: 'Voix originale', en: 'Original voice' },
  'audio.music': { fr: 'Musique de fond', en: 'Background music' },
  'audio.sfx': { fr: 'Bruitages', en: 'Sound effects' },
  'audio.addMusic': { fr: 'Importer une musique', en: 'Import music' },
  'audio.removeMusic': { fr: 'Retirer la musique', en: 'Remove music' },
  'audio.noMusic': { fr: 'Aucune musique importée', en: 'No music imported' },
  'audio.errFormat': {
    fr: 'Fichier audio non pris en charge (MP3, M4A, WAV ou AAC).',
    en: 'Unsupported audio file (MP3, M4A, WAV or AAC).',
  },

  // — Timeline —
  'timeline.title': { fr: 'Timeline', en: 'Timeline' },
  'timeline.video': { fr: 'Vidéo', en: 'Video' },
  'timeline.sfxTrack': { fr: 'Bruitages', en: 'SFX' },
  'timeline.split': { fr: 'Découper', en: 'Split' },
  'timeline.delete': { fr: 'Supprimer', en: 'Delete' },
  'timeline.zoomIn': { fr: 'Zoom avant', en: 'Zoom in' },
  'timeline.zoomOut': { fr: 'Zoom arrière', en: 'Zoom out' },
  'timeline.duration': { fr: 'Durée totale', en: 'Total duration' },
  'timeline.empty': { fr: 'Timeline vide', en: 'Empty timeline' },
  'timeline.cut': { fr: 'Coupe', en: 'Cut' },
  'timeline.noTransition': { fr: 'Coupe franche', en: 'Hard cut' },
  'timeline.removeTransition': { fr: 'Retirer la transition', en: 'Remove transition' },
  'timeline.splitHint': {
    fr: 'Placez la tête de lecture dans un clip puis découpez.',
    en: 'Place the playhead inside a clip, then split.',
  },
  'timeline.reorderHint': {
    fr: 'Glissez un clip pour le réorganiser.',
    en: 'Drag a clip to reorder it.',
  },

  // — Export —
  'export.title': { fr: 'Export', en: 'Export' },
  'export.spec': { fr: '9:16 · 1080×1920 · MP4', en: '9:16 · 1080×1920 · MP4' },
  'export.start': { fr: 'Exporter la vidéo', en: 'Export video' },
  'export.preparing': { fr: 'Préparation…', en: 'Preparing…' },
  'export.loadingCore': { fr: 'Chargement du moteur vidéo…', en: 'Loading video engine…' },
  'export.encoding': { fr: 'Encodage {p}%', en: 'Encoding {p}%' },
  'export.done': { fr: 'Export terminé', en: 'Export complete' },
  'export.download': { fr: 'Télécharger le MP4', en: 'Download MP4' },
  'export.failed': { fr: 'L’export a échoué : {e}', en: 'Export failed: {e}' },
  'export.emptyTimeline': { fr: 'Ajoutez au moins un clip.', en: 'Add at least one clip.' },
  'export.cancel': { fr: 'Annuler', en: 'Cancel' },
  'export.note': {
    fr: 'L’encodage se fait dans votre navigateur : aucune vidéo n’est envoyée sur un serveur.',
    en: 'Encoding runs in your browser: no video is sent to a server.',
  },

  // — Divers —
  'common.close': { fr: 'Fermer', en: 'Close' },
  'common.seconds': { fr: '{n} s', en: '{n}s' },
  'common.reset': { fr: 'Réinitialiser le projet', en: 'Reset project' },
  'common.resetConfirm': {
    fr: 'Supprimer le projet et tous les médias importés ?',
    en: 'Delete the project and all imported media?',
  },
  'disclaimer.virality': {
    fr: 'AMORCE mesure des signaux de montage. Aucun outil ne peut garantir la viralité d’une vidéo.',
    en: 'AMORCE measures editing signals. No tool can guarantee that a video goes viral.',
  },
} satisfies Record<string, Bilingual>

export type StringKey = keyof typeof strings
