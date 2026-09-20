import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Tu es "Respire", un compagnon d'écoute bienveillant, calme, empathique et rassurant.
Ton rôle est d'accueillir la personne, de l'aider à déposer ce qui pèse (angoisse, surcharge mentale, pensées en boucle, tristesse) et de l'inviter doucement à revenir à son souffle et à ses sensations corporelles.

Directives clés :
- Sois bref, doux, posé (pas de longs pavés, 2 à 4 phrases maximum par réponse).
- Valide systématiquement son ressenti sans jugement ni minimisation.
- Propose des ancrages simples (respiration lente, observation de ce qui l'entoure, relâchement des épaules).
- Ne pose pas de diagnostic médical ni d'injonction. Si la personne évoque un péril immédiat ou des idées suicidaires, rappelle avec douceur l'existence du 3114 (numéro national de prévention).
- Ton ton est celui d'une présence apaisante face à l'océan.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { text: "Je suis là avec vous. Prenez une grande inspiration face à cet horizon et soufflez lentement. (Clé API non configurée)." },
        { status: 200 }
      );
    }

    // Appel direct à l'API Gemini 2.5 Flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: messages.map((m: { sender: string; text: string }) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          })),
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();
    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Je vous écoute. Prenez tout votre temps pour déposer ce que vous ressentez.";

    return NextResponse.json({ text: replyText });
  } catch (error) {
    console.error('Erreur API Chat:', error);
    return NextResponse.json(
      { text: "Prenez une grande inspiration... Je suis toujours là avec vous. Que ressentez-vous dans votre corps en cet instant ?" },
      { status: 200 }
    );
  }
}
