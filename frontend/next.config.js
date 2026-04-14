/** @type {import('next').NextConfig} */
const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/:path*` },
    ];
  },
};

module.exports = nextConfig;
