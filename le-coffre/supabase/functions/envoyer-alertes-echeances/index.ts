// Tourne une fois par jour (pg_cron → pg_net → cette fonction), jamais
// appelée par un navigateur — protégée par un secret partagé en plus de la
// vérification JWT standard. C'est la seule fonction de ce projet qui voit
// les échéances de tous les comptes à la fois, et strictement leur date :
// jamais un nom de document, jamais un libellé, jamais un contenu. Voir
// SECURITY.md, section « La couche échéances : ce qui reste en clair ».

import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_PROJET = Deno.env.get("SUPABASE_URL")!;
const CLE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLE_RESEND = Deno.env.get("RESEND_API_KEY");
const SECRET_CRON = Deno.env.get("CRON_SECRET");
const JOURS_DE_MARGE = 7; // prévenir une semaine avant l'échéance

Deno.serve(async (requete: Request) => {
  if (!SECRET_CRON || requete.headers.get("x-cron-secret") !== SECRET_CRON) {
    return new Response("Non autorisé", { status: 401 });
  }
  if (!CLE_RESEND) {
    return new Response(JSON.stringify({ erreur: "RESEND_API_KEY absente côté serveur." }), { status: 500 });
  }

  const admin = createClient(URL_PROJET, CLE_SERVICE);

  const limite = new Date();
  limite.setDate(limite.getDate() + JOURS_DE_MARGE);
  const limiteIso = limite.toISOString().slice(0, 10);

  const { data: echeances, error } = await admin
    .from("coffre_echeances")
    .select("id, user_id, date")
    .is("alerte_envoyee_le", null)
    .lte("date", limiteIso);

  if (error) {
    return new Response(JSON.stringify({ erreur: error.message }), { status: 500 });
  }

  let envoyees = 0;
  const echecs: { id: string; raison: string }[] = [];

  for (const echeance of echeances ?? []) {
    const { data: utilisateur, error: erreurUtilisateur } =
      await admin.auth.admin.getUserById(echeance.user_id);
    const email = utilisateur?.user?.email;
    if (erreurUtilisateur || !email) {
      echecs.push({ id: echeance.id, raison: erreurUtilisateur?.message || "e-mail introuvable" });
      continue;
    }

    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLE_RESEND}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Le Coffre <alertes@erwannchevallier.com>",
        to: email,
        subject: "Une échéance approche dans Le Coffre",
        text:
          `Un document déposé dans Le Coffre a une échéance le ${echeance.date}.\n\n` +
          `Connecte-toi et déverrouille ton coffre pour voir de quoi il s'agit — ` +
          `ce message ne dit jamais lequel, ni pourquoi : nous ne le savons pas nous-mêmes.\n\n` +
          `https://coffre-puce.vercel.app`,
      }),
    });

    if (reponse.ok) {
      await admin
        .from("coffre_echeances")
        .update({ alerte_envoyee_le: new Date().toISOString() })
        .eq("id", echeance.id);
      envoyees++;
    } else {
      const detail = await reponse.text();
      echecs.push({ id: echeance.id, raison: `${reponse.status} ${detail.slice(0, 300)}` });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, envoyees, total: echeances?.length ?? 0, echecs }),
    { headers: { "Content-Type": "application/json" } },
  );
});
