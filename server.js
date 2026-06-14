const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);

try {
  const adminJsPath = path.join(ROOT, 'js', 'admin.js');
  if (fs.existsSync(adminJsPath)) {
    let content = fs.readFileSync(adminJsPath, 'utf8');
    let modified = false;
    const targetRegex = /\/\/ ── Print window ──+.*window\.generateYearlyReport/;
    if (targetRegex.test(content)) {
      content = content.replace(targetRegex, '// ── Print window ───────────────────────────────────────────\n  window.generateYearlyReport');
      modified = true;
    }
    const initMarker = '// ── Init ─────────────────────────────────────────────────';
    const markerIndex = content.indexOf(initMarker);
    if (markerIndex !== -1 && content.indexOf(initMarker, markerIndex + 1) !== -1) {
      content = content.slice(0, markerIndex) + initMarker + '\nloadDashboard();\n';
      modified = true;
    }
    if (modified) {
      fs.writeFileSync(adminJsPath, content, 'utf8');
      console.log('[AUTO-REPAIR] Fixed js/admin.js at startup');
    }
  }
} catch (e) {
  console.error('[AUTO-REPAIR] Startup Error:', e);
}
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
      }
    });
  }
  return env;
}

const PORT = 3333;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      return res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });

    if (urlPath === '/js/storage.service.js') {
      let content = data.toString('utf8');
      const env = loadEnv();
      if (env.SUPABASE_URL) {
        content = content.replace(/const SUPABASE_URL = '[^']*';/, `const SUPABASE_URL = '${env.SUPABASE_URL}';`);
      }
      if (env.SUPABASE_KEY) {
        content = content.replace(/const SUPABASE_KEY = '[^']*';/, `const SUPABASE_KEY = '${env.SUPABASE_KEY}';`);
      }
      return res.end(content);
    }

    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Lab Accounts running at http://localhost:${PORT}`);
});
