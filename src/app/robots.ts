import type { MetadataRoute } from 'next';

/**
 * Public crawler policy for the Le Phare website.
 *
 * This invites compliant crawlers, including AI search crawlers, to index public
 * pages while keeping API endpoints out of ordinary discovery. robots.txt is
 * not access control: private data must remain protected by authentication and
 * authorization independently of this file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
  };
}
