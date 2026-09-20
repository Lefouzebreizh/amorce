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

    const prompt = `Tu es "Respire", un compagnon d'écoute bienveillant, calme et apaisant face à l'océan.
Consignes impératives :
- Réponds en français avec douceur et empathie, en 2 ou 3 phrases courtes.
- Valide avec délicatesse ce que la personne ressent, invite-la à respirer doucement et à relâcher ses tensions.
- Si détresse vitale ou idées suicidaires, mentionne avec bienveillance le 3114 (numéro national de prévention).

Message de la personne : "${lastUserMessage}"`;

    // Endpoint officiel Google AI Studio v1beta avec gemini-1.5-flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 250
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur API Gemini détails:', response.status, JSON.stringify(data));
      return NextResponse.json({
        text: "Prenez une grande inspiration... Je reste avec vous. Qu'est-ce qui pèse le plus en cet instant précis ?"
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return NextResponse.json({
      text: reply || "Je vous entends. Prenez tout votre temps pour déposer vos pensées."
    });
  } catch (err) {
    console.error('Erreur route chat:', err);
    return NextResponse.json({
      text: "Je suis là avec vous. Respirez doucement en observant la vague..."
    });
  }
}
