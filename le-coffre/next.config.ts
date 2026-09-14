import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  async headers() {
    const privees = ['/coffre/:path*', '/compte/:path*', '/auth/:path*', '/api/:path*'];

    return privees.map((source) => ({
      source,
      headers: [
        {
          key: 'X-Robots-Tag',
          value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
        },
      ],
    }));
  },
};

export default nextConfig;
