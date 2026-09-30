import { authorizeMouvanceRequest, providerError } from "@/lib/mouvance-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const denied = authorizeMouvanceRequest(request);
  if (denied) return denied;
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) return providerError("La clé Runway n’est pas configurée.", 503);

  const { taskId } = await params;
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(taskId)) return providerError("Identifiant de tâche invalide.", 400);
  try {
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "x-runway-version": "2024-11-06",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null) as {
      id?: string;
      status?: string;
      output?: string[];
      failure?: string;
      error?: { message?: string };
    } | null;
    if (!response.ok) return providerError(data?.error?.message ?? "Impossible de lire l’état de la vidéo.", 502);
    return Response.json({
      status: data?.status ?? "UNKNOWN",
      videoUrl: data?.status === "SUCCEEDED" ? data.output?.[0] ?? null : null,
      error: data?.status === "FAILED" ? data.failure ?? "Runway n’a pas terminé la vidéo." : null,
    });
  } catch {
    return providerError("Impossible de joindre Runway pour lire l’avancement.", 502);
  }
}
