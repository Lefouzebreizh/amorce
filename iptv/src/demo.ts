// Un catalogue de démonstration, pour voir l'application tourner sans abonnement.
//
// **Pourquoi ce fichier existe.** La première question de quelqu'un qui vient
// d'installer n'est pas « comment je branche mon fournisseur », c'est « est-ce
// que ça marche ». Sans réponse à celle-là, un écran vide se confond avec une
// panne, et l'on se met à chercher un défaut dans l'installation alors qu'il
// manque simplement des données.
//
// **Les flux sont publics et prévus pour cet usage** : ce sont les flux de test
// que les fabricants de lecteurs vidéo publient pour éprouver leur code. Aucun
// contenu sous droits, aucun abonnement, rien à cacher — et c'est justement ce
// qui rend cette liste versionnable, là où une vraie liste ne le serait jamais.
//
// Ils passent par le même chemin que le reste : analyse M3U, normalisation,
// cache, mandataire. Ce qui se voit à l'écran est donc une preuve réelle du
// fonctionnement, pas une maquette avec de fausses données.

/**
 * Une liste M3U de démonstration, écrite dans la même syntaxe qu'un fournisseur.
 *
 * Les titres portent volontairement les mêmes scories que les vraies listes —
 * préfixe de pays, étiquette de langue, définition — pour que le nettoyage se
 * voie à l'œuvre plutôt que de rester une promesse du README.
 */
export const LISTE_DEMO = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="demo.mux" tvg-logo="" group-title="FR | DÉMO",FR | Flux de test HLS FHD',
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  '#EXTINF:-1 tvg-id="demo.bipbop" group-title="FR | DÉMO",FR | Bip-Bop Apple HD',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  // Les films et les épisodes sont des **fichiers**, les chaînes des flux :
  // c'est ce qui les distingue dans la vraie vie, et la démonstration doit le
  // montrer plutôt que de faire passer un manifeste pour une œuvre.
  '#EXTINF:-1 group-title="FILMS VF",Big Buck Bunny (2008) VF 1080p',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  '#EXTINF:-1 group-title="FILMS MULTI",Sintel (2010) MULTI 720p',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  '#EXTINF:-1 group-title="SERIES VF",Démonstration S01E01',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  '#EXTINF:-1 group-title="SERIES VF",Démonstration S01E02',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  '#EXTINF:-1 group-title="SERIES VOSTFR",[VOSTFR] Démonstration S02E01',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
].join('\n')

/**
 * Un guide des programmes calé sur l'instant présent.
 *
 * Les horaires se calculent au lancement plutôt que d'être écrits en dur : une
 * grille figée serait « en ce moment » le jour où on l'écrit, et jamais plus —
 * la démonstration montrerait alors une case vide, ce qui est pire que rien.
 */
export function guideDemo(maintenant = Date.now()): string {
  const format = (date: Date): string =>
    `${date.toISOString().replace(/[-:T]/g, '').slice(0, 14)} +0000`
  const avant = new Date(maintenant - 25 * 60 * 1000)
  const milieu = new Date(maintenant + 35 * 60 * 1000)
  const apres = new Date(maintenant + 95 * 60 * 1000)

  return `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="demo.mux"><display-name>Flux de test HLS</display-name></channel>
  <channel id="demo.bipbop"><display-name>Bip-Bop</display-name></channel>
  <programme start="${format(avant)}" stop="${format(milieu)}" channel="demo.mux">
    <title>Émission de démonstration</title>
    <desc>Ce texte vient du guide des programmes, chargé au format XMLTV comme celui de votre fournisseur.</desc>
    <category>Démonstration</category>
  </programme>
  <programme start="${format(milieu)}" stop="${format(apres)}" channel="demo.mux">
    <title>Ce qui suit</title>
  </programme>
  <programme start="${format(avant)}" stop="${format(apres)}" channel="demo.bipbop">
    <title>Séquence Bip-Bop</title>
    <desc>Le flux de test historique d'Apple, utilisé pour éprouver les lecteurs HLS.</desc>
  </programme>
</tv>`
}
