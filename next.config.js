/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/traccar/:path*',
        destination: 'http://unotracker.rastrear.app.br/api/:path*',
      },
    ];
  },
}

module.exports = nextConfig
