// Local preview of the site, compressed like a real server.  No dependencies.
// Run from the repository root:  node tools/serve.cjs   (PORT=5000 to change the port)
// The page is served at / and, as on the Daily Star server, at /plastic-pollution/.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};
const compressible = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);

http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/plastic-pollution') { res.writeHead(302, { Location: '/plastic-pollution/' }).end(); return; }
  if (pathname.startsWith('/plastic-pollution/')) pathname = pathname.slice('/plastic-pollution'.length);
  const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  const inside = file.startsWith(root + path.sep) && !file.startsWith(path.join(root, 'tools') + path.sep);
  if (!inside || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
  const ext = path.extname(file);
  const headers = { 'Content-Type': types[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
  headers['Cache-Control'] = pathname.startsWith('/assets/') ? 'public, max-age=604800' : 'no-cache';
  let data = fs.readFileSync(file);
  if (compressible.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    data = zlib.gzipSync(data);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  res.writeHead(200, headers).end(data);
}).listen(port, () => console.log(`Preview: http://localhost:${port}/  (also /plastic-pollution/)`));
