import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BoutonSupprimerBilan } from '@/components/bouton-supprimer-bilan';
import { variantesBouton } from '@/components/ui/button';
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
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">FinancIA</p>
          <h1 className="text-2xl font-semibold tracking-tight">Votre trajectoire patrimoniale</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Des instantanés datés, jamais des cours prétendument en temps réel. Vous voyez ce qui a
            réellement changé entre deux bilans.
          </p>
        </div>
        <Link href="/bilan-patrimoine" className={variantesBouton({})}>
          Faire un nouveau bilan <ArrowRight aria-hidden />
        </Link>
      </header>

      {parametres.erreur ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {parametres.erreur === 'suppression'
            ? "Ce bilan n’a pas pu être supprimé. Réessayez dans un instant."
            : "Ce bilan n’a pas pu être enregistré. Vos données n’ont pas été ajoutées."}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Synthèse">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Dernier total connu</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">
            {bilans[0] ? formaterMontant(bilans[0].total_eur) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Évolution depuis le premier bilan</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-3xl font-semibold">
            {evolution === null ? '—' : formaterMontant(evolution)}
            {evolution !== null && evolution >= 0 ? <TrendingUp aria-hidden className="text-success" /> : null}
            {evolution !== null && evolution < 0 ? <TrendingDown aria-hidden className="text-destructive" /> : null}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="historique">
        <div className="flex items-center gap-2">
          <LockKeyhole aria-hidden className="size-4 text-primary" />
          <h2 id="historique" className="text-lg font-semibold">Historique privé</h2>
        </div>
        {bilans.length === 0 ? (
          <Card><CardContent className="flex flex-col items-start gap-4 pt-6 text-sm text-muted-foreground">
            <p>Aucun bilan enregistré. Le diagnostic gratuit reste sans stockage tant que vous ne choisissez pas de le conserver.</p>
            <Link href="/bilan-patrimoine" className={variantesBouton({ variante: 'contour' })}>Commencer mon suivi</Link>
          </CardContent></Card>
        ) : (
          <ol className="flex flex-col gap-3">
            {bilans.map((bilan) => (
              <li key={bilan.id}>
                <Card><CardContent className="flex min-h-20 items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold">{formaterMontant(bilan.total_eur)}</p>
                    <p className="text-sm text-muted-foreground">
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

      <p className="text-xs leading-relaxed text-muted-foreground">
        Je suis un assistant IA d’aide à la décision. Ceci ne constitue pas un conseil en investissement
        financier officiel (statut CIF). Investir comporte des risques de perte en capital.
      </p>
    </div>
  );
}
