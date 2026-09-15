import type { MetadataRoute } from 'next';

const URL_PUBLIQUE = 'https://coffre-puce.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${URL_PUBLIQUE}/`,
      lastModified: new Date('2026-09-15'),
      changeFrequency: 'monthly',
      priority: 1,
      images: [`${URL_PUBLIQUE}/brand/tiroir-secret-coffre-mer-phare-v2.jpg`],
    },
  ];
}
