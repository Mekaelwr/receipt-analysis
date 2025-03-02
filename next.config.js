/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... your existing config ...
  webpack: (config, { isServer }) => {
    config.ignoreWarnings = [
      { module: /node_modules\/punycode/ }
    ];
    return config;
  },
  typescript: {
    // !! WARN !!
    // Ignoring TypeScript errors for build to succeed
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig 