import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { assets } from './assets.mjs';

const port = Number(process.env.PORT ?? 4310);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');

const hosts = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
const routes = new Map([...assets.keys()].map((asset) => ['/' + asset, asset]));
routes.set('/', 'index.html');
for (const asset of assets.keys()) {
  if (asset.endsWith('.html') && asset !== 'index.html') {
    routes.set('/' + asset.slice(0, -5), asset);
  }
}

createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; font-src 'self'; script-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (!hosts.has(request.headers.host)) return response.writeHead(400).end('Invalid host');
  const path = request.url?.split('?')[0];
  if (path === '/api/serve' && request.method === 'POST') {
    return response.writeHead(503, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Email is unavailable in the development preview.' }));
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return response.writeHead(405, { Allow: 'GET, HEAD' }).end();
  }
  const asset = routes.get(path);
  if (!asset) return response.writeHead(404).end('Page not found');
  try {
    const body = await readFile(new URL('./public/' + asset, import.meta.url));
    return response.writeHead(200, { 'Content-Type': assets.get(asset) }).end(request.method === 'HEAD' ? undefined : body);
  } catch {
    return response.writeHead(500).end('Page unavailable');
  }
}).listen(port, '127.0.0.1', () => console.log('HG Link preview listening on http://127.0.0.1:' + port));
