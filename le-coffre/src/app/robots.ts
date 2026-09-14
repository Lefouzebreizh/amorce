import type { MetadataRoute } from 'next';

const URL_PUBLIQUE = 'https://coffre-puce.vercel.app';
const ROUTES_PRIVEES = ['/coffre', '/coffre/', '/compte', '/compte/', '/auth', '/auth/', '/api', '/api/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ROUTES_PRIVEES,
    },
    sitemap: `${URL_PUBLIQUE}/sitemap.xml`,
    host: URL_PUBLIQUE,
  };
}
