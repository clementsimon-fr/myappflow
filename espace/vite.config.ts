import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// En local (npm run dev), sert aussi les fonctions /api/*, comme le fait Vercel en production.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', fileURLToPath(new URL('..', import.meta.url)), ''));
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url || '').split('?')[0].replace(/^\//, '');
        if (!['admin-users', 'monthly-invoices'].includes(name)) return next();
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const { default: handler } = await server.ssrLoadModule(`/../api/${name}.js`);
        const wrapped = Object.assign(res, {
          status(code: number) { res.statusCode = code; return wrapped; },
          send(body: string) { res.end(body); },
        });
        await handler(Object.assign(req, { body: Buffer.concat(chunks).toString() || '{}' }), wrapped);
      });
    },
  };
}

export default defineConfig({
  root,
  base: '/espace/',
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react(), localApi()],
  build: {
    outDir: fileURLToPath(new URL('../dist/espace', import.meta.url)),
    emptyOutDir: true,
  },
  test: {
    root,
    include: ['src/**/*.test.ts'],
  },
});
