import { AvantApres } from '@/components/AvantApres';
import { BarreAction } from '@/components/BarreAction';
import { CeQueTuAs } from '@/components/CeQueTuAs';
import { FormulaireDevis } from '@/components/FormulaireDevis';
import { Hero } from '@/components/Hero';
import { Offre } from '@/components/Offre';
import { PiedDePage } from '@/components/PiedDePage';
import { Temoignage } from '@/components/Temoignage';

/*
 * L'ordre des sections est l'ordre des questions que se pose un artisan :
 * qu'est-ce que c'est, qu'est-ce que j'ai, en quoi c'est mieux que maintenant,
 * combien, qui l'a déjà fait, comment je te joins.
 *
 * Tout est rendu côté serveur sauf le formulaire : la page s'affiche entière
 * sur une 4G de chantier avant même que le JavaScript arrive.
 */
export default function Page() {
  return (
    <main>
      <Hero />
      <CeQueTuAs />
      <AvantApres />
      <Offre />
      <Temoignage />
      <FormulaireDevis />
      <PiedDePage />
      <BarreAction />
    </main>
  );
}
