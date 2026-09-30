const ACCESS_HEADER = 'x-mouvance-access';

export function authorizeMouvanceRequest(request: Request): Response | null {
  const expected = process.env.MOUVANCE_AI_ACCESS_CODE;
  if (!expected) {
    return Response.json(
      { error: "Les fonctions IA ne sont pas encore configurées sur ce déploiement." },
      { status: 503 },
    );
  }

  const supplied = request.headers.get(ACCESS_HEADER) ?? "";
  if (!sameSecret(supplied, expected)) {
    return Response.json({ error: "Code d’accès incorrect." }, { status: 401 });
  }
  return null;
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_000) return null;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

export function providerError(message: string, status = 502): Response {
  return Response.json({ error: message }, { status });
}
