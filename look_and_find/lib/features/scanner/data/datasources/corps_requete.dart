/// L'enveloppe d'une requête Gemini : la même pour toutes les invites.
///
/// **Pourquoi elle est seule ici.** Deux invites cohabitent — celle de la fiche
/// v1 et celle du comparateur, gardée pour la v2 — et elles ne diffèrent que par
/// deux valeurs : la consigne et le schéma. Tout le reste (l'ordre texte puis
/// photo, le type MIME, le décodage contraint, la température) est une décision
/// prise une fois, qui n'a aucune raison d'exister en deux exemplaires.
///
/// Il y a aussi un troisième appelant, hors application : `tool/banc_invite.dart`
/// envoie cette requête depuis un terminal pour éprouver une invite sans
/// appareil. Il ne vaut que s'il envoie exactement ce que l'application envoie —
/// c'est pourquoi il passe par ici, et non par une copie qui finirait par
/// diverger sans que rien ne le signale.
library;

Map<String, Object?> enveloppeGemini({
  required String instruction,
  required Map<String, Object?> schema,
  required String photoBase64,
}) => {
  'contents': [
    {
      'parts': [
        // La consigne précède la photo : l'ordre inverse dégrade
        // l'identification, le modèle lisant ce qu'on attend de lui après avoir
        // déjà regardé l'image.
        {'text': instruction},
        {
          'inline_data': {'mime_type': 'image/jpeg', 'data': photoBase64},
        },
      ],
    },
  ],
  'generationConfig': {
    // Une même photo doit donner la même fiche : sans cela, deux scans du même
    // objet se contrediraient sans que rien n'ait changé dans la pièce.
    'temperature': 0.1,
    'responseMimeType': 'application/json',
    'responseSchema': schema,
  },
};
