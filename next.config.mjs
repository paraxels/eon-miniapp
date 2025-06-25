/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence warnings
  // https://github.com/WalletConnect/walletconnect-monorepo/issues/1908
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },

  async headers() {
    const isPreview = process.env.VERCEL_ENV === 'preview';

    return isPreview
      ? [
          {
            source: '/(.*)',
            headers: [
              {
                key: 'X-Frame-Options',
                value: 'ALLOWALL',
              },
              {
                key: 'Content-Security-Policy',
                value: 'frame-ancestors *',
              },
            ],
          },
        ]
      : [];
  },
};

export default nextConfig;
