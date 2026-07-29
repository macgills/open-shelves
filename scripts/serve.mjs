import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { root } from './lib.mjs';
const port = Number(process.env.PORT ?? 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
createServer(async (req,res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname).replace(/^\/open-shelves-\/?/, '');
    let file = path.join(root, 'dist', pathname || 'index.html');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, {'content-type': mime[path.extname(file)] ?? 'application/octet-stream'}); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, () => console.log(`http://localhost:${port}/open-shelves-/`));
