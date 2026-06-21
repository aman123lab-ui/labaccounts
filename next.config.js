const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Serve legacy CSS and JS from project root via rewrites
  async rewrites() {
    return [
      // Map old HTML requests directly to the processed static shells in /public
      { source: '/debtors.html', destination: '/debtors-shell.html' },
      // Redirects for Next.js pages
      { source: '/login.html', destination: '/login' },
      { source: '/student.html', destination: '/student' },
      { source: '/register.html', destination: '/register' },
      // Note: We removed the API rewrites for /css and /js because 
      // Next.js automatically serves everything inside /public directly!
    ];
  },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
    ];
  },
};

module.exports = nextConfig;
