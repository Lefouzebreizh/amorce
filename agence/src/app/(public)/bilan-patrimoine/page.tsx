import type { Metadata } from 'next';

import Link from 'next/link';
import { ArrowDown, ShieldCheck, Sparkles } from 'lucide-react';

import { FormulaireBilan } from '@/components/formulaire-bilan';
import { lireSession } from '@/lib/supabase/session';

export const metadata: Metadata = {
  title: 'Bilan de patrimoine gratuit',
  description:
    'Huit questions, deux minutes : un bilan clair de ce que vous possédez et de ce qui vous coûte, sans jargon et sans compte à créer.',
  // Le socle interdit l'indexation par défaut ; cet outil existe pour être
  // trouvé, à l'inverse des pages privées de tableau de bord.
  robots: { index: true, follow: true },
};

/*
 * Le lot 2 : l'interface du Bilan Patrimoine (lot 1, dans
 * `@/lib/bilan`). Public, sans session — voir `@/lib/actions/bilan.ts`.
 */
export default async function PageBilanPatrimoine() {
  const connecte = (await lireSession()) !== null;
  return (
    <article className="relative left-1/2 w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_30px_100px_-48px_rgba(31,41,55,.28)] sm:w-[min(72rem,calc(100vw-3rem))]">
      <header className="relative grid gap-8 overflow-hidden bg-[radial-gradient(ellipse_at_80%_10%,rgba(64,224,208,.18),transparent_36%),radial-gradient(ellipse_at_100%_100%,rgba(124,58,237,.10),transparent_38%),linear-gradient(135deg,#f8faf9_0%,#f4f5f8_58%,#f2f0f8_100%)] px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:px-14 lg:py-16">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-700 shadow-sm">
            <Sparkles aria-hidden className="size-3.5 text-violet-700" /> FINANCIA · VOTRE POINT DE DÉPART
          </p>
          <h1 className="text-4xl font-semibold leading-[1.04] tracking-[-.045em] text-slate-950 text-balance sm:text-5xl lg:text-6xl">
            Votre patrimoine, <span className="text-violet-700">plus clair.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Faites le point sur ce que vous possédez, ce qui reste à rembourser et les sujets à regarder de plus près. Des repères simples, sans jargon.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a href="#mon-bilan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700">
              Commencer mon bilan <ArrowDown aria-hidden className="size-4" />
            </a>
            <span className="text-sm text-slate-600">Environ 2 minutes · gratuit</span>
          </div>
        </div>
        <div className="relative hidden min-h-56 items-end lg:flex">
          <div aria-hidden className="absolute right-0 top-2 size-52 rounded-full border border-violet-900/10 bg-white/40 shadow-[inset_0_0_50px_rgba(124,58,237,.08)]" />
          <div aria-hidden className="absolute right-12 top-10 size-36 rounded-full border border-teal-800/20 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.95),rgba(64,224,208,.22)_45%,rgba(124,58,237,.18))] shadow-[0_24px_70px_-30px_rgba(28,35,62,.45)]" />
          <div className="relative z-10 ml-auto w-64 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-xl shadow-slate-900/10 backdrop-blur">
            <div className="flex items-center justify-between text-xs text-slate-500"><span>Une vue d&apos;ensemble</span><ShieldCheck aria-hidden className="size-4 text-teal-700" /></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-teal-500 to-violet-600" /></div>
            <div className="mt-3 flex justify-between text-xs text-slate-500"><span>Actifs</span><span>Repères</span><span>Prochaine étape</span></div>
          </div>
        </div>
      </header>

      <section id="mon-bilan" className="grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-12 lg:px-14 lg:py-12">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-700">Le bilan en bref</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Une photo de votre situation.</h2>
          </div>
          <ul className="flex flex-col gap-3 text-sm leading-6 text-slate-600">
            <li className="flex gap-3"><span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">1</span><span>Quelques informations générales sur votre foyer.</span></li>
            <li className="flex gap-3"><span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">2</span><span>Les grandes lignes de votre épargne et de votre logement.</span></li>
            <li className="flex gap-3"><span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">3</span><span>Des constats pédagogiques et une piste à explorer.</span></li>
          </ul>
          <div className="rounded-2xl border border-teal-900/10 bg-teal-50/70 p-4 text-sm leading-6 text-teal-950">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck aria-hidden className="size-4" /> Vos réponses restent privées</p>
            <p className="mt-1 text-teal-950/75">Elles ne sont pas enregistrées avec ce bilan. Vous seul pouvez choisir de le conserver dans un espace sécurisé.</p>
          </div>
          <p className="text-xs leading-5 text-slate-500">Ce bilan donne des repères généraux. Il ne remplace pas l&apos;analyse d&apos;un professionnel habilité.</p>
        </aside>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,.32)] sm:p-8">
          <FormulaireBilan connecte={connecte} />
        </div>
      </section>
      <div className="border-t border-slate-200 px-6 py-5 text-xs text-slate-500 sm:px-10 lg:px-14">
        <Link href="/confidentialite" className="underline decoration-slate-300 underline-offset-4 hover:text-slate-900">Comment nous protégeons vos données</Link>
      </div>
    </article>
  );
}
