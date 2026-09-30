import { authorizeMouvanceRequest, boundedText, providerError, readJsonObject } from "@/lib/mouvance-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "model"; text: string };

export async function POST(request: Request) {
  const denied = authorizeMouvanceRequest(request);
  if (denied) return denied;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return providerError("La clé Gemini n’est pas configurée.", 503);

  const body = await readJsonObject(request);
  const raw = body?.messages;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) {
    return providerError("La conversation doit contenir de 1 à 20 messages.", 400);
  }

  const messages: ChatMessage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return providerError("Message invalide.", 400);
    const item = entry as Record<string, unknown>;
    if (item.role !== "user" && item.role !== "model") return providerError("Rôle de message invalide.", 400);
    const text = boundedText(item.text, 4_000);
    if (!text) return providerError("Chaque message doit contenir au plus 4 000 caractères.", 400);
    messages.push({ role: item.role, text });
  }
  if (messages[messages.length - 1]?.role !== "user") {
    return providerError("Le dernier message doit venir de toi.", 400);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "Tu es le copilote créatif de Mouvance Studio. Aide à imaginer, préparer et monter des vidéos. Réponds en français, de façon concise et concrète." }],
          },
          contents: messages.map((message) => ({
            role: message.role,
            parts: [{ text: message.text }],
          })),
          generationConfig: { maxOutputTokens: 900, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      },
    );
    const data = await response.json().catch(() => null) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    } | null;
    if (!response.ok) return providerError(data?.error?.message ?? "Gemini n’a pas répondu. Réessaie.", 502);
    const answer = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!answer) return providerError("La réponse Gemini était vide.", 502);
    return Response.json({ text: answer });
  } catch {
    return providerError("Impossible de joindre Gemini pour le moment.", 502);
  }
}
