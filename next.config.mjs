/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Allow importing sql.js which has a .wasm dependency
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
}

export default nextConfig
