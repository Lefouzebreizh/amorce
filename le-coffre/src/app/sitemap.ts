import type { MetadataRoute } from 'next';

const URL_PUBLIQUE = 'https://coffre-puce.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${URL_PUBLIQUE}/`,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
