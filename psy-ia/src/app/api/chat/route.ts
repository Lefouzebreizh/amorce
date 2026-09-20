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

    const prompt = `Tu es Respire, un compagnon d'écoute bienveillant, calme, empathique et rassurant face à l'océan.
Consignes :
- Réponds en français avec douceur et empathie, en 2 à 3 phrases courtes.
- Valide ce que la personne ressent sans jugement, invite-la à revenir à son souffle et à relâcher ses épaules.
- Si détresse vitale ou idées noires, rappelle avec bienveillance le 3114.

Message reçu : "${lastUserMessage}"`;

    // Appel au modèle gemini-2.5-flash sur l'API v1beta
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.7
          }
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error('Erreur API Gemini détails:', res.status, JSON.stringify(data));
      return NextResponse.json({
        text: "Prenez une grande inspiration... Je reste avec vous. Qu'est-ce qui pèse le plus en cet instant précis ?"
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return NextResponse.json({
      text: reply || "Je vous entends. Prenez tout votre temps pour déposer vos pensées."
    });
  } catch (err) {
    console.error('Erreur route chat:', err);
    return NextResponse.json({
      text: "Je suis là avec vous. Prenez une respiration profonde face à l'océan..."
    });
  }
}
