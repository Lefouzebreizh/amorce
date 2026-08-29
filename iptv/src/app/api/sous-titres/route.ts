// Chercher et servir un sous-titre externe.
//
// Deux gestes en une route, parce qu'ils vont toujours ensemble : lister ce qui
// existe, puis rapporter celui qu'on a choisi, converti en WebVTT.
//
// Le fichier ne transite pas par le navigateur pour être converti : il arrive
// ici en octets bruts, souvent en windows-1252, et repart en WebVTT UTF-8. Le
// faire côté client demanderait de deviner l'encodage en JavaScript, ce que le
// navigateur ne sait pas faire sur un `fetch`.

import { texte } from '../../../domaine/valeurs.ts'
import { depot } from '../../../serveur/depot-partage.ts'
import { versVtt } from '../../../sous-titres/conversion.ts'
import { fournisseursDisponibles } from '../../../sous-titres/fournisseurs.ts'

export const dynamic = 'force-dynamic'

function reglages() {
  const cle = process.env['OPENSUBTITLES_API_KEY']
  return cle === undefined ? {} : { openSubtitlesKey: cle }
}

export async function GET(requete: Request): Promise<Response> {
  const parametres = new URL(requete.url).searchParams
  const fournisseurs = fournisseursDisponibles(reglages())

  if (fournisseurs.length === 0) {
    // 200 et non 503 : l'absence de clé n'est pas une panne, c'est un réglage
    // qu'on n'a pas fait. L'interface doit pouvoir le dire calmement.
    return Response.json({
      disponible: false,
      raison:
        'Aucune clé de service de sous-titres. Poser OPENSUBTITLES_API_KEY dans .env pour activer la recherche externe.',
      pistes: [],
    })
  }

  const idPiste = texte(parametres.get('piste'))
  if (idPiste !== undefined) {
    for (const fournisseur of fournisseurs) {
      const octets = await fournisseur.telecharger(idPiste)
      if (octets === undefined) continue
      const vtt = versVtt(octets)
      if (vtt === undefined) continue
      return new Response(vtt, {
        headers: { 'content-type': 'text/vtt; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
    return new Response('Sous-titre introuvable ou illisible', { status: 404 })
  }

  const idElement = texte(parametres.get('e'))
  if (idElement === undefined) return new Response('Il faut un élément (e)', { status: 400 })
  const element = depot().element(idElement)
  if (element === undefined) return new Response('Élément inconnu', { status: 404 })

  // Ce qui part : un titre, une année, une saison, un épisode. Rien de l'URL du
  // flux, qui porte les identifiants du fournisseur IPTV en clair.
  const demande = {
    titre: element.titre,
    annee: element.annee,
    serie: element.serie,
    saison: element.saison,
    episode: element.episode,
    langues: ['fr', 'en'],
  }

  const pistes = []
  for (const fournisseur of fournisseurs) {
    try {
      pistes.push(...(await fournisseur.chercher(demande)))
    } catch {
      // Un service qui ne répond pas ne doit pas empêcher les autres, ni faire
      // échouer la lecture en cours.
    }
  }

  return Response.json({ disponible: true, pistes: pistes.slice(0, 12) })
}
