import { ImageResponse } from 'next/og';

/**
 * Même image que `opengraph-image.tsx`, dupliquée plutôt que réimportée.
 *
 * X lit sa propre convention de fichier et ne reprend pas automatiquement
 * `opengraph-image` dans tous les cas ; le fichier existe donc en propre,
 * pour ne pas dépendre d'un repli qu'aucun test d'ici ne peut vérifier.
 */
export const runtime = 'edge';
export const alt = 'Amorce — le studio qui rend tes vidéos IA virales';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 96px',
          background: '#08060f',
          color: '#f2effc',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#25e3c4',
          }}
        >
          Amorce
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.08,
            maxWidth: 920,
          }}
        >
          Monte ta vidéo verticale sans rien envoyer à personne.
        </div>
        <div
          style={{
            marginTop: 44,
            display: 'flex',
            alignItems: 'baseline',
            gap: 20,
            fontSize: 32,
            color: '#aaa4c6',
          }}
        >
          <span style={{ color: '#f2effc', fontWeight: 700 }}>49 € une fois</span>
          <span>·</span>
          <span>Gratuit pour essayer</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
