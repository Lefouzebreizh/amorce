'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { enregistrerBilan } from '@/lib/actions/patrimoine';
import type { Situation } from '@/lib/bilan/modeles';
import { CONSTATS_MONTRES_MAX, premierGesteTexte, type Bilan } from '@/lib/bilan/redaction';
import { ETIQUETTES, type Constat, type Ton } from '@/lib/bilan/modeles';
import { euros } from '@/lib/bilan/valorisation';

/*
 * Le rendu en cartes du `Bilan` — `bilan.constats` et `bilan.patrimoine`,
 * pas `bilan.texte` (le Markdown assemblé pour `npm run exemple`, pensé pour
 * un terminal, pas pour cette mise en page).
 *
 * Contrainte de conception, préférence durable : jamais d'orange ni de jaune,
 * aucun feu tricolore. `--warning` (proche de l'orange) existe dans la
 * palette d'agence/ pour d'autres écrans ; ce composant ne l'utilise jamais.
 * Les trois `ton` se distinguent par `--success` (bravo, seule couleur du
 * trio) et par le fond neutre (`--muted`/`--accent`) pour `attention` et
 * `coute` — cohérent avec un texte qui n'est lui-même jamais alarmiste.
 */

const VARIANTE_PAR_TON: Readonly<Record<Ton, 'succes' | 'neutre' | 'information'>> = {
  bravo: 'succes',
  attention: 'neutre',
  coute: 'information',
};

const LIBELLE_TON: Readonly<Record<Ton, string>> = {
  bravo: 'Ça va bien',
  attention: 'À regarder',
  coute: 'Ça vous coûte',
};

function CarteConstat({ constat }: { constat: Constat }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{constat.titre}</CardTitle>
        <Badge variante={VARIANTE_PAR_TON[constat.ton]}>{LIBELLE_TON[constat.ton]}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        {constat.explication.split('\n\n').map((paragraphe, index) => (
          <p key={index}>{paragraphe}</p>
        ))}
        {constat.coutAnnuelEur !== null ? (
          <p className="font-semibold text-foreground">Environ {euros(constat.coutAnnuelEur)} par an.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RapportBilan({ bilan, situation, connecte }: { bilan: Bilan; situation: Situation; connecte: boolean }) {
  const { patrimoine, constats } = bilan;
  const bravos = constats.filter((constat) => constat.ton === 'bravo');
  const problemes = constats.filter((constat) => constat.ton !== 'bravo').slice(0, CONSTATS_MONTRES_MAX);
  const geste = premierGesteTexte(problemes);

  const lignesConnues = patrimoine.lignes.filter((ligne) => ligne.montantEur !== null && ligne.montantEur > 0);

  return (
    <div className="flex flex-col gap-8">
      {bilan.baremesARelire ? (
        <p role="status" className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          Les taux de référence de cet outil n’ont pas été revus récemment. Les constats ci-dessous
          restent vrais, mais certains montants peuvent être absents plutôt que faux.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_100%_0%,rgba(64,224,208,.16),transparent_35%),linear-gradient(135deg,#f8fafc,#f5f3ff)] p-6 sm:p-8" aria-labelledby="titre-resultat">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-800">Votre photographie patrimoniale</p>
        <h2 id="titre-resultat" className="mt-3 text-3xl font-semibold leading-tight tracking-[-.035em] text-slate-950 sm:text-4xl">
          {patrimoine.totalEur > 0
            ? euros(patrimoine.totalEur)
            : "Nous n'avons pas encore assez d'éléments pour faire un total."}
        </h2>
        {patrimoine.totalEur > 0 ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Estimation des éléments que vous avez indiqués.
            {patrimoine.partiel
              ? ` Le total est partiel : vous n'avez rien indiqué pour ${patrimoine.pochesInconnues
                  .map((poche) => ETIQUETTES[poche].toLowerCase())
                  .join(', ')}.`
              : ''}
          </p>
        ) : null}

        {lignesConnues.length > 0 ? (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {lignesConnues.map((ligne) => (
              <div key={ligne.poche} className="rounded-2xl border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{ETIQUETTES[ligne.poche]}</dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                  {euros(ligne.montantEur ?? 0)}
                  {ligne.detail ? <span className="ml-1 text-xs font-normal text-slate-500">({ligne.detail})</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {bravos.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Ce qui va bien</h2>
          {bravos.map((constat) => (
            <CarteConstat key={constat.cle} constat={constat} />
          ))}
        </div>
      ) : null}

      {problemes.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            {problemes.some((constat) => constat.coutAnnuelEur !== null) ? 'Ce qui vous coûte, en revanche' : 'Ce qui mérite un regard'}
          </h2>
          {problemes.map((constat) => (
            <CarteConstat key={constat.cle} constat={constat} />
          ))}
        </div>
      ) : bravos.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Nous n&apos;avons rien trouvé qui vous coûte de l&apos;argent inutilement. C&apos;est plus rare
          qu&apos;on ne croit, et ça se dit.
        </p>
      ) : null}

      {geste !== null ? (
        <Card className="border-primary/30 bg-accent">
          <CardContent className="pt-6 text-sm text-accent-foreground">
            <span className="font-semibold">Si vous ne faites qu&apos;une chose ce mois-ci :</span> {geste}
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden rounded-3xl border-violet-200 bg-[linear-gradient(130deg,#f5f3ff,#f0fdfa)]">
        <CardHeader>
          <CardTitle className="text-lg">FinancIA peut suivre cette évolution</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm leading-6 text-slate-700">
          <p>
            Gardez une trace datée de ce bilan pour le comparer au suivant. Vous pourrez supprimer chaque instantané depuis votre espace. Aucun nom de banque, IBAN ou numéro de contrat n’est demandé.
          </p>
          {connecte ? (
            <form action={enregistrerBilan}>
              <input type="hidden" name="situation" value={JSON.stringify(situation)} />
              <Button type="submit" className="min-h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-violet-800"><Check aria-hidden className="size-4" /> Enregistrer ce bilan</Button>
            </form>
          ) : (
            <Link href="/inscription" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-slate-950 px-5 py-2 font-medium text-white transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700">
              Créer mon espace de suivi <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </CardContent>
      </Card>

      <p className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-teal-700" />
        Ce bilan fournit des repères généraux à partir de vos réponses. Il ne constitue pas une recommandation d&apos;investissement personnalisée ni un conseil délivré par un conseiller en investissements financiers. Toute décision d&apos;investissement comporte un risque de perte en capital.
      </p>

      <div>
        <Button variante="contour" className="min-h-11 rounded-full px-5" onClick={() => window.location.reload()}>
          Refaire un bilan
        </Button>
      </div>
    </div>
  );
}
