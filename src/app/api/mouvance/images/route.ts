import { authorizeMouvanceRequest, boundedText, providerError, readJsonObject } from "@/lib/mouvance-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = authorizeMouvanceRequest(request);
  if (denied) return denied;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return providerError("La clé Gemini n’est pas configurée.", 503);

  const body = await readJsonObject(request);
  const prompt = boundedText(body?.prompt, 1_200);
  if (!prompt) return providerError("Décris l’image en 1 200 caractères maximum.", 400);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image",
        input: prompt,
        response_format: { type: "image", aspect_ratio: "16:9", image_size: "1K" },
      }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null) as {
      steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string; mime_type?: string }> }>;
      error?: { message?: string };
    } | null;
    if (!response.ok) return providerError(data?.error?.message ?? "Gemini n’a pas pu créer l’image.", 502);
    const image = data?.steps?.find((step) => step.type === "model_output")?.content
      ?.find((item) => item.type === "image" && item.data);
    if (!image?.data) return providerError("La génération n’a pas renvoyé d’image.", 502);
    return Response.json({
      dataUrl: `data:${image.mime_type || "image/png"};base64,${image.data}`,
    });
  } catch {
    return providerError("La génération d’image a échoué. Réessaie dans un instant.", 502);
  }
}
