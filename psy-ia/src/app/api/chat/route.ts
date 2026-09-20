import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Tu es "Respire", un compagnon d'écoute bienveillant, calme, empathique et rassurant.
Ton rôle est d'accueillir la personne, de l'aider à déposer ce qui pèse (angoisse, surcharge mentale, pensées en boucle, tristesse) et de l'inviter doucement à revenir à son souffle et à ses sensations corporelles.

Directives clés :
- Sois bref, doux, posé (2 à 4 phrases maximum par réponse).
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
        { text: "Je suis là avec vous. Prenez une grande inspiration face à cet horizon et soufflez lentement." },
        { status: 200 }
      );
    }

    const formattedContents = messages.map((m: { sender: string; text: string }) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: formattedContents,
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.7
          }
        })
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Gemini API Error:', response.status, errBody);
      return NextResponse.json(
        { text: "Prenez une grande inspiration... Je reste avec vous. Qu'est-ce qui pèse le plus en cet instant précis ?" },
        { status: 200 }
      );
    }

    const data = await response.json();
    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Je vous entends. Prenez tout votre temps, je suis là.";

    return NextResponse.json({ text: replyText });
  } catch (error) {
    console.error('Erreur API Chat:', error);
    return NextResponse.json(
      { text: "Je suis là avec vous. Prenez une inspiration profonde face à l'océan... Que ressentez-vous dans votre corps ?" },
      { status: 200 }
    );
  }
}
