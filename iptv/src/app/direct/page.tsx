import { Catalogue, type Recherche } from '../../composants/Catalogue.tsx'

export default async function Direct({ searchParams }: { searchParams: Promise<Recherche> }) {
  return (
    <Catalogue genre="direct" titre="En direct" base="/direct" recherche={await searchParams} />
  )
}
