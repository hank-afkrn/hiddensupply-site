/**
 * NFS Shared Projects API
 * GET  /api/projects          → { projects: [...] }
 * POST /api/projects          → { projects: [...] }  (body = { projects: [...] })
 * Serves static files from parent directory on port 8000.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const STORE = path.join(__dirname, 'projects.json');
const STATIC_ROOT = path.join(__dirname, '..');

// ── MIME types ───────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.webp': 'image/webp', '.mp4': 'video/mp4',
};

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch(_) { return []; }
}
function writeStore(data) {
  fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // CORS headers (allow Joe's browser)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API routes ─────────────────────────────────────────────────
  if (url === '/api/projects') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ projects: readStore() }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try {
          const { projects } = JSON.parse(body);
          writeStore(Array.isArray(projects) ? projects : []);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, count: (projects||[]).length }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  // ── Static file serving ────────────────────────────────────────
  let filePath = path.join(STATIC_ROOT, url === '/' ? '/index.html' : url);
  // If directory, try index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(8000, () => console.log('NFS server on :8000'));
