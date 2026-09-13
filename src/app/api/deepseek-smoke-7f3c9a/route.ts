import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }
  const token = request.headers.get("x-vercel-oidc-token");
  if (!token) {
    return NextResponse.json({ error: "OIDC Vercel absent" }, { status: 503 });
  }

  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-v4.1-flash",
      temperature: 0.6,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "Tu es réalisateur et directeur artistique. Réponds en français, de façon concrète, sans discours marketing.",
        },
        {
          role: "user",
          content:
            "Conçois une vidéo verticale de 15 secondes pour Lefouzèbreizh : un zèbre bienveillant marche sur une falaise bretonne, puis son corps devient une double exposition contenant un phare, l'océan et une aurore violette et turquoise. Donne un titre, cinq plans minutés, mouvements de caméra, lumière, son, voix off de 20 mots maximum, prompt vidéo final en anglais et trois risques visuels à éviter. Termine par une auto-évaluation honnête sur 10.",
        },
      ],
    }),
  });

  const payload = await response.json();
  return NextResponse.json(
    { gatewayStatus: response.status, model: "deepseek/deepseek-v4.1-flash", result: payload },
    { status: response.ok ? 200 : 502 },
  );
}
