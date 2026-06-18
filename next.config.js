const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Serve legacy CSS and JS from project root via rewrites
  async rewrites() {
    return [
      // Legacy HTML pages served via API handler
      { source: '/index.html', destination: '/api/serve-html?file=index' },
      { source: '/debtors.html', destination: '/api/serve-html?file=debtors' },
      // Old .html routes → Next.js pages
      { source: '/login.html', destination: '/login' },
      { source: '/student.html', destination: '/student' },
      { source: '/register.html', destination: '/register' },
      // Legacy static assets served via API
      { source: '/css/:file*', destination: '/api/serve-static?type=css&file=:file*' },
      { source: '/js/:file*', destination: '/api/serve-static?type=js&file=:file*' },
    ];
  },
};

module.exports = nextConfig;
