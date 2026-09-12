import { AvantApres } from '@/components/AvantApres';
import { BarreAction } from '@/components/BarreAction';
import { CeQueTuAs } from '@/components/CeQueTuAs';
import { FormulaireDevis } from '@/components/FormulaireDevis';
import { Galerie } from '@/components/Galerie';
import { Hero } from '@/components/Hero';
import { Offre } from '@/components/Offre';
import { PiedDePage } from '@/components/PiedDePage';

/*
 * L'ordre des sections est l'ordre des questions que se pose un artisan :
 * qu'est-ce que c'est, qu'est-ce que j'ai, en quoi c'est mieux que maintenant,
 * à quoi ça ressemble, combien, comment je te joins.
 *
 * La galerie précède l’offre et présente explicitement des modèles fictifs.
 * Les témoignages seront ajoutés lorsqu’un client aura donné un avis réel.
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
      <Galerie />
      <Offre />
      <FormulaireDevis />
      <PiedDePage />
      <BarreAction />
    </main>
  );
}
