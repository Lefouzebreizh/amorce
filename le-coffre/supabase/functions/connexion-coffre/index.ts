import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINES_AUTORISEES = new Set([
  "https://mon-tiroir-secret-erwann.vercel.app",
  "https://coffre-puce.vercel.app",
  "https://coffre-erwannchevallier-6916s-projects.vercel.app",
  "https://coffre-git-main-erwannchevallier-6916s-projects.vercel.app",
  "https://coffre-lpqwia05y-erwannchevallier-6916s-projects.vercel.app",
  "https://coffre-6iij6owb1-erwannchevallier-6916s-projects.vercel.app",
  "https://coffre-git-claude-le-cof-73ea7b-erwannchevallier-6916s-projects.vercel.app",
]);

function origineAutorisee(origin: string | null): boolean {
  return !origin || ORIGINES_AUTORISEES.has(origin);
}

function cors(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && origineAutorisee(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function response(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (!origineAutorisee(origin)) return response({ error: "Origine non autorisée." }, 403, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return response({ error: "Méthode non autorisée." }, 405, origin);

  try {
    const { identifiant, motDePasse } = await req.json();
    const alias = typeof identifiant === "string" ? identifiant.trim().toLowerCase() : "";
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(alias) || typeof motDePasse !== "string" || !motDePasse) {
      return response({ error: "Identifiant ou mot de passe incorrect." }, 401, origin);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const empreinte = await sha256(alias + ":" + (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnu"));
    const { count } = await admin.from("coffre_connexion_tentatives").select("*", { count: "exact", head: true }).eq("empreinte", empreinte).gte("cree_le", new Date(Date.now() - 15 * 60 * 1000).toISOString());
    if ((count ?? 0) >= 10) return response({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, 429, origin);
    await admin.from("coffre_connexion_tentatives").insert({ empreinte });
    await admin.from("coffre_connexion_tentatives").delete().lt("cree_le", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    const { data: mapping } = await admin.from("coffre_identifiants").select("user_id").eq("alias", alias).maybeSingle();
    if (!mapping) return response({ error: "Identifiant ou mot de passe incorrect." }, 401, origin);
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(mapping.user_id);
    if (userError || !userResult.user?.email) return response({ error: "Identifiant ou mot de passe incorrect." }, 401, origin);

    const tokenResponse = await fetch(url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      body: JSON.stringify({ email: userResult.user.email, password: motDePasse }),
    });
    if (!tokenResponse.ok) return response({ error: "Identifiant ou mot de passe incorrect." }, 401, origin);
    const session = await tokenResponse.json();
    return response({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, expires_at: session.expires_at, token_type: session.token_type, user: session.user }, 200, origin);
  } catch {
    return response({ error: "Connexion indisponible. Réessaie." }, 503, origin);
  }
});
