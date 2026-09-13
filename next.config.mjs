/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/((?!_next|api|favicon.ico|.*\\..*).*)',
        destination: '/',
      },
    ]
  },
};

export default nextConfig;
