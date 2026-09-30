import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, LockKeyhole, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BoutonSupprimerBilan } from '@/components/bouton-supprimer-bilan';
import { formaterMontant } from '@/lib/format';
import { evolutionEur, listerBilans } from '@/lib/patrimoine';
import { exigerSession } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'FinancIA — suivi patrimonial' };

const dateFrance = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

export default async function PagePatrimoine({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const session = await exigerSession();
  const parametres = await searchParams;
  const bilans = await listerBilans(session);
  const evolution = evolutionEur(bilans);

  return (
    <div className="financia-surface flex flex-col gap-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(ellipse_at_100%_0%,rgba(64,224,208,.15),transparent_34%),linear-gradient(135deg,#f8fafc,#f5f3ff)] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-800">FINANCIA · ESPACE PERSONNEL</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-slate-950">Votre trajectoire patrimoniale</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Des bilans datés pour comparer vos estimations dans le temps. Les montants reflètent vos saisies, pas des cours en temps réel.
          </p>
        </div>
        <Link href="/bilan-patrimoine" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 font-medium text-white transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700">
          Nouveau bilan <ArrowRight aria-hidden className="size-4" />
        </Link>
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><CalendarDays aria-hidden className="size-4 text-teal-700" />{bilans.length} bilan{bilans.length === 1 ? '' : 's'} enregistré{bilans.length === 1 ? '' : 's'} · jusqu&apos;à 60 conservés</div>
      </header>

      {parametres.erreur ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {parametres.erreur === 'suppression'
            ? "Ce bilan n’a pas pu être supprimé. Réessayez dans un instant."
            : "Ce bilan n’a pas pu être enregistré. Vos données n’ont pas été ajoutées."}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Synthèse patrimoniale">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dernier total estimé</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold tracking-tight text-slate-950">
            {bilans[0] ? formaterMontant(bilans[0].total_eur) : '—'}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Écart avec le bilan le plus ancien</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-950">
            {evolution === null ? '—' : formaterMontant(evolution)}
            {evolution !== null && evolution >= 0 ? <TrendingUp aria-hidden className="size-5 text-teal-700" /> : null}
            {evolution !== null && evolution < 0 ? <TrendingDown aria-hidden className="text-destructive" /> : null}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="historique">
        <div className="flex items-center gap-2">
          <LockKeyhole aria-hidden className="size-4 text-primary" />
          <h2 id="historique" className="text-lg font-semibold tracking-tight">Vos bilans enregistrés</h2>
        </div>
        {bilans.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-300"><CardContent className="flex flex-col items-start gap-4 pt-6 text-sm text-slate-600">
            <p>Aucun bilan n&apos;est conservé pour le moment. Le bilan gratuit reste sans stockage tant que vous ne choisissez pas explicitement de l&apos;enregistrer.</p>
            <Link href="/bilan-patrimoine" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 px-5 font-medium text-slate-800 hover:bg-slate-50">Faire un bilan <ArrowRight aria-hidden className="size-4" /></Link>
          </CardContent></Card>
        ) : (
          <ol className="flex flex-col gap-3">
            {bilans.map((bilan) => (
              <li key={bilan.id}>
                <Card className="rounded-2xl border-slate-200 shadow-sm"><CardContent className="flex min-h-20 items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold tracking-tight text-slate-950">{formaterMontant(bilan.total_eur)}</p>
                    <p className="text-sm text-slate-500">
                      {dateFrance.format(new Date(bilan.created_at))}{bilan.is_partial ? ' · total partiel' : ' · total complet'}
                    </p>
                  </div>
                  <BoutonSupprimerBilan identifiant={bilan.id} date={dateFrance.format(new Date(bilan.created_at))} />
                </CardContent></Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        Ce suivi conserve les instantanés que vous avez choisi d&apos;enregistrer. Les écarts reflètent vos saisies et ne constituent ni des performances calculées à partir de cours de marché ni une recommandation d&apos;investissement.
      </p>
    </div>
  );
}
