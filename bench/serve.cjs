// Serves bench/fixtures on 127.0.0.1 only. /api/bug-fetch answers 500, /api/ok answers 200.
// Usage: node serve.cjs [port]   (prints the base URL)
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const DIR = path.join(__dirname, 'fixtures');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' };

function start(port = 0) {
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/api/bug-fetch') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{"error":"boom"}'); }
    if (url === '/api/ok') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
    const file = path.join(DIR, path.normalize(url === '/' ? '/clean.html' : url).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(DIR + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}
module.exports = { start };
if (require.main === module) start(Number(process.argv[2]) || 0).then(({ base }) => console.log(base));
