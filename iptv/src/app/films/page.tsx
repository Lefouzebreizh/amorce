import { Catalogue, type Recherche } from '../../composants/Catalogue.tsx'

export default async function Films({ searchParams }: { searchParams: Promise<Recherche> }) {
  return <Catalogue genre="film" titre="Films" base="/films" recherche={await searchParams} />
}
