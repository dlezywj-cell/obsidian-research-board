import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
createServer(async (request, response) => {
  const pathname = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const target = resolve(root, `.${pathname}`);
  if (!target.startsWith(root)) { response.writeHead(403).end(); return; }
  try {
    response.writeHead(200, { 'content-type': types[extname(target)] || 'text/plain; charset=utf-8' });
    response.end(await readFile(target));
  } catch { response.writeHead(404).end('Not found. Please run npm run build first.'); }
}).listen(4173, () => console.log('知识看板预览：http://localhost:4173'));
