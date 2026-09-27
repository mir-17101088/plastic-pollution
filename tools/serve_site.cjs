// Preview the actual build at its production subdirectory, with compression and headers.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.xml':'application/xml', '.txt':'text/plain' };
http.createServer((req,res)=>{
 const url = new URL(req.url,'http://localhost');
 if (url.pathname === '/' || url.pathname === '/plastic-pollution') { res.writeHead(302,{Location:'/plastic-pollution/'}).end(); return; }
 const file = path.resolve(root, '.' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/')?'index.html':''));
 if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
 const ext=path.extname(file); const headers={'Content-Type':types[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'};
 if(url.pathname.includes('/assets/')) headers['Cache-Control']='public, max-age=604800, stale-while-revalidate=86400';
 let data=fs.readFileSync(file);
 if (['.html','.css','.js','.json','.svg','.xml'].includes(ext) && /gzip/.test(req.headers['accept-encoding']||'')) {data=zlib.gzipSync(data);headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';}
 res.writeHead(200,headers).end(data);
}).listen(4174, '127.0.0.1', ()=>console.log('Preview: http://127.0.0.1:4174/plastic-pollution/'));
