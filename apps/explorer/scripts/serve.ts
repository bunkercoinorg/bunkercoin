import { createServer, type Server } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// Files a request may resolve to inside `root`, Next export style: `/block`
// serves block.html. Null when the path escapes the root or is malformed.
export function candidates(root: string, url: string): string[] | null {
  let path: string;
  try {
    path = decodeURIComponent(url.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (path.includes('\0')) return null;
  const abs = resolve(root, '.' + normalize('/' + path));
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  if (path.endsWith('/')) return [join(abs, 'index.html')];
  return [abs, `${abs}.html`, join(abs, 'index.html')];
}

async function firstFile(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      if ((await stat(p)).isFile()) return p;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export function serveStatic(dir: string): Server {
  const root = resolve(dir);
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const paths = candidates(root, req.url ?? '/');
    const file = paths && (await firstFile(paths));
    const target = file ?? join(root, '404.html');
    const immutable = target.startsWith(join(root, '_next', 'static') + sep);
    res.writeHead(file ? 200 : 404, {
      'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    pipeline(createReadStream(target), res, () => {});
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST;
  serveStatic(process.argv[2] ?? 'out').listen(port, host, () => {
    console.log(`Serving ${process.argv[2] ?? 'out'} on http://${host ?? 'localhost'}:${port}`);
  });
}
