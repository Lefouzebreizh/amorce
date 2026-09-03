import type { Metadata } from 'next';

import { FormulaireBilan } from '@/components/formulaire-bilan';

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
export default function PageBilanPatrimoine() {
  return (
    <article className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Votre bilan de patrimoine, gratuit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Huit questions, trois écrans, deux minutes. Rien n&apos;est enregistré : vous répondez, nous
          calculons, vous lisez — et c&apos;est tout.
        </p>
      </header>

      <FormulaireBilan />
    </article>
  );
}
