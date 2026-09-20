import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({
        text: "Je suis là avec vous. Prenez une grande inspiration face à cet horizon et soufflez lentement."
      });
    }

    const lastUserMessage = messages[messages.length - 1]?.text || "Bonjour";

    const prompt = `Tu es Respire, un compagnon d'écoute bienveillant, doux et apaisant face à l'océan.
Consignes :
- Réponds en français avec douceur et empathie, en 2 ou 3 phrases courtes.
- Valide ce que la personne ressent, invite-la à respirer doucement et à relâcher ses épaules.
- Si détresse vitale ou idées suicidaires, rappelle avec délicatesse le 3114.

Message de la personne : "${lastUserMessage}"`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error('Erreur Google API:', res.status, JSON.stringify(data));
      return NextResponse.json({
        text: "Prenez une grande inspiration... Je reste avec vous. Qu'est-ce qui pèse le plus en cet instant précis ?"
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return NextResponse.json({
      text: reply || "Je vous entends. Prenez tout votre temps pour déposer vos ressentis."
    });
  } catch (error) {
    console.error('Erreur interne chat:', error);
    return NextResponse.json({
      text: "Je suis là avec vous. Respirez doucement en observant la vague..."
    });
  }
}
