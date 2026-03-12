/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // These packages are Node.js / React Native only — stub them out in the browser bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino-pretty': false,
        '@react-native-async-storage/async-storage': false,
      }
    }
    return config
  },
}

module.exports = nextConfig
