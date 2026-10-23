import { NextResponse } from 'next/server';

/** Contrat restreint : Gemini propose du texte et des gestes connus de l'app. */
const REPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    draftProposal: {
      type: ['object', 'null'],
      properties: {
        title: { type: 'string' },
        lyrics: { type: 'string' },
        style: { type: 'string' },
        mood: { type: 'string' },
        voice: { type: 'string' },
      },
      required: ['title', 'lyrics', 'style', 'mood', 'voice'],
    },
    runAutoEdit: { type: 'boolean' },
    autoEditOptions: {
      type: 'object',
      properties: {
        shorten: { type: 'boolean' },
        visualEffects: { type: 'boolean' },
        soundEffects: { type: 'boolean' },
        captionGuide: { type: 'boolean' },
      },
      required: ['shorten', 'visualEffects', 'soundEffects', 'captionGuide'],
    },
    mixUpdate: {
      type: ['object', 'null'],
      properties: {
        clips: { type: 'number' },
        sfx: { type: 'number' },
        music: { type: 'number' },
        voice: { type: 'number' },
        ducking: { type: 'number' },
      },
      required: ['clips', 'sfx', 'music', 'voice', 'ducking'],
    },
    exportPreset: { type: 'string', enum: ['none', 'full', 'light', 'share'] },
    openStep: {
      type: 'string',
      enum: ['none', 'import', 'montage', 'composer', 'texte', 'son', 'cinema', 'analyse', 'export'],
    },
  },
  required: ['reply', 'draftProposal', 'runAutoEdit', 'autoEditOptions', 'mixUpdate', 'exportPreset', 'openStep'],
} as const;

const INSTRUCTIONS = `Tu es Amorce, le réalisateur assistant d'un studio de création vidéo musical.
L'utilisateur te parle normalement. Il n'a pas à connaître les rubriques ni les réglages.
Tu l'aides à écrire ses paroles avec tact, respectes sa voix et ne remplaces jamais son texte sans qu'il demande une rédaction ou une réécriture. Quand tu proposes des paroles, fournis un brouillon complet dans draftProposal et explique brièvement ce que tu as fait dans reply.
Tu pilotes les fonctions existantes seulement quand la demande le justifie : montage express des médias déjà importés, mixage, choix de définition d'export ou ouverture d'un outil existant. Le montage express conserve les rushes entiers par défaut. N'active pas découpe courte, effets visuels, bruitages ou guide de sous-titres sauf si cela sert clairement l'intention exprimée.
N'invente jamais une musique, une image, une vidéo ou une synchronisation qui n'existe pas. Amorce ne génère pas encore directement la musique ou les visuels. Si une action nécessite un média manquant ou une synchronisation vocale, demande-le simplement.
Toutes les modifications appliquées par Amorce restent annulables. Pour une demande de création de clip, utilise runAutoEdit uniquement si le projet a des visuels importés. N'affirme pas avoir exporté un fichier si l'utilisateur ne l'a pas demandé et si l'export n'a pas réellement été exécuté.
Réponds en français, de façon chaleureuse et concise. Une seule question à la fois, uniquement si une information manque pour avancer.`;

type Message = { role: 'user' | 'assistant'; content: string };

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string';
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return NextResponse.json({ error: 'Origine de la demande invalide.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Origine de la demande invalide.' }, { status: 403 });
    }
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'Gemini n’est pas encore connecté. Ajoute GEMINI_API_KEY dans les variables privées du serveur.' },
      { status: 503 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'La demande n’a pas pu être lue.' }, { status: 400 });
  }
  if (new TextEncoder().encode(rawBody).byteLength > 32_000) {
    return NextResponse.json({ error: 'La demande est trop volumineuse.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'La demande n’a pas pu être lue.' }, { status: 400 });
  }

  const data = body as { messages?: unknown; project?: unknown };
  if (!Array.isArray(data.messages) || data.messages.length === 0 || data.messages.length > 12 || !data.messages.every(isMessage)) {
    return NextResponse.json({ error: 'Écris un message pour commencer.' }, { status: 400 });
  }
  const messages = data.messages.slice(-12) as Message[];
  if (messages.some((message) => message.content.length > 6000)) {
    return NextResponse.json({ error: 'Ce message est trop long. Tu peux le raccourcir un peu.' }, { status: 413 });
  }

  const contexte = JSON.stringify(data.project ?? {});
  const input = `État utile du projet (les médias restent dans le navigateur et ne sont pas envoyés à Google) :\n${contexte}\n\nConversation récente :\n${messages.map((message) => `${message.role === 'user' ? 'Utilisateur' : 'Amorce'} : ${message.content}`).join('\n')}`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        input,
        system_instruction: INSTRUCTIONS,
        response_format: { type: 'text', mime_type: 'application/json', schema: REPONSE_SCHEMA },
        store: false,
      }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Gemini n’a pas pu répondre. Réessaie dans un instant.' }, { status: 502 });
    }
    const result = (await response.json()) as { output_text?: unknown };
    if (typeof result.output_text !== 'string') {
      return NextResponse.json({ error: 'Gemini a renvoyé une réponse inexploitable. Réessaie.' }, { status: 502 });
    }
    const parsed: unknown = JSON.parse(result.output_text);
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as { reply?: unknown }).reply !== 'string') {
      return NextResponse.json({ error: 'La réponse de Gemini n’a pas le format attendu. Réessaie.' }, { status: 502 });
    }
    return NextResponse.json(parsed, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'La connexion à Gemini a échoué. Vérifie la connexion puis réessaie.' }, { status: 502 });
  }
}
