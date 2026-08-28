import { notFound } from 'next/navigation';
import { Configurateur } from '@/components/Configurateur';
import { MODELES, modeleParId } from '@/lib/commande';

/* Les quatre pages sont connues à l'avance : les pré-rendre évite un aller-retour
   au serveur au moment où le visiteur vient de cliquer, c'est-à-dire au moment
   où il est le plus prêt à partir. */
export function generateStaticParams() {
  return MODELES.map((m) => ({ modele: m.id }));
}

export default async function PageConfigurer({ params }: { params: Promise<{ modele: string }> }) {
  const { modele: id } = await params;
  const modele = modeleParId(id);
  if (!modele) notFound();
  return <Configurateur modele={modele} />;
}
