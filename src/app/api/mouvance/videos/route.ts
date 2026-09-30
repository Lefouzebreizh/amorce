import { authorizeMouvanceRequest, boundedText, providerError, readJsonObject } from "@/lib/mouvance-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = authorizeMouvanceRequest(request);
  if (denied) return denied;
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) return providerError("La clé Runway n’est pas configurée.", 503);

  const body = await readJsonObject(request);
  const promptText = boundedText(body?.prompt, 1_000);
  if (!promptText) return providerError("Décris la vidéo en 1 000 caractères maximum.", 400);
  const ratio = body?.ratio === "720:1280" ? "720:1280" : "1280:720";

  try {
    const response = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "x-runway-version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen4.5",
        promptText,
        ratio,
        duration: 5,
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null) as {
      id?: string;
      error?: { message?: string };
      message?: string;
    } | null;
    if (!response.ok || !data?.id) {
      return providerError(data?.error?.message ?? data?.message ?? "Runway n’a pas accepté la demande.", 502);
    }
    return Response.json({ taskId: data.id });
  } catch {
    return providerError("Impossible de joindre Runway pour le moment.", 502);
  }
}
