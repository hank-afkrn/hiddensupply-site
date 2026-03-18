const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const GITHUB_TOKEN = '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';
const REPO = 'hank-afkrn/hiddensupply-site';
const PORT = 8083;

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'hidden-supply-admin',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/gate/status') {
    try {
      const data = await githubRequest('GET', `/repos/${REPO}/contents/index.html`);
      const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
      const enabled = !content.includes('#hs-gate { display: none !important; }');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ enabled }));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/gate/toggle') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { enable } = JSON.parse(body);
        const data = await githubRequest('GET', `/repos/${REPO}/contents/index.html`);
        const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
        const sha = data.sha;

        let newContent;
        if (enable) {
          newContent = raw.replace('\n    #hs-gate { display: none !important; }', '');
        } else {
          if (raw.includes('#hs-gate { display: none !important; }')) {
            res.writeHead(200); res.end(JSON.stringify({ ok: true, message: 'Already disabled' })); return;
          }
          newContent = raw.replace('/* ─── PASSWORD GATE ─── */', '/* ─── PASSWORD GATE ─── */\n    #hs-gate { display: none !important; }');
        }

        const encoded = Buffer.from(newContent).toString('base64');
        const result = await githubRequest('PUT', `/repos/${REPO}/contents/index.html`, {
          message: enable ? 'Admin: enable password gate' : 'Admin: disable password gate',
          content: encoded,
          sha
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, commit: result.commit?.sha }));
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ---- IMAGE GENERATION ENDPOINT ----
  if (req.method === 'POST' && url.pathname === '/generate-image') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { prompt, slot, aspect_ratio, ref_images } = JSON.parse(body);
        if (!prompt) { res.writeHead(400); res.end(JSON.stringify({ error: 'prompt required' })); return; }

        const ts = Date.now();
        const outFile = path.join(os.tmpdir(), `hs_gen_${ts}_${slot || 'img'}.webp`);
        const ratio = aspect_ratio || '1:1';

        // Build gsk img args — add reference images if provided
        const args = ['img', prompt, '-r', ratio, '-o', outFile];
        if (ref_images && ref_images.length > 0) {
          for (const refPath of ref_images) {
            // Accept absolute paths on this server
            if (fs.existsSync(refPath)) {
              args.push('-i', refPath);
            }
          }
        }

        console.log('gsk', args.join(' '));

        execFile('gsk', args, { timeout: 180000 }, (err, stdout, stderr) => {
          if (err) {
            console.error('gsk img error:', err.message, stderr);
            res.writeHead(500); res.end(JSON.stringify({ error: err.message, stderr }));
            return;
          }

          // Find output file (gsk may use a slightly different name/ext)
          let found = outFile;
          if (!fs.existsSync(outFile)) {
            const tmpFiles = fs.readdirSync(os.tmpdir())
              .filter(f => f.startsWith(`hs_gen_${ts}`) && /\.(webp|png|jpg|jpeg)$/.test(f));
            if (tmpFiles.length > 0) {
              found = path.join(os.tmpdir(), tmpFiles[0]);
            } else {
              // Fallback: most recently modified hs_gen_ file
              const all = fs.readdirSync(os.tmpdir())
                .filter(f => f.startsWith('hs_gen_') && /\.(webp|png|jpg|jpeg)$/.test(f))
                .map(f => ({ f, t: fs.statSync(path.join(os.tmpdir(), f)).mtimeMs }))
                .sort((a,b) => b.t - a.t);
              if (all.length > 0) found = path.join(os.tmpdir(), all[0].f);
              else { res.writeHead(500); res.end(JSON.stringify({ error: 'output file not found', stdout, stderr })); return; }
            }
          }

          const buf = fs.readFileSync(found);
          const ext = path.extname(found).slice(1).toLowerCase();
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, slot, dataUrl: `data:${mime};base64,${buf.toString('base64')}` }));
          try { fs.unlinkSync(found); } catch(e) {}
        });
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => console.log(`Admin API running on port ${PORT}`));
