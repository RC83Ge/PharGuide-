import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En développement, sert api/gemini.ts comme le ferait Vercel, pour que `npm run dev` fonctionne seul.
// La clé Gemini n'est jamais injectée dans le code client : elle reste côté serveur.
function localApi(): Plugin {
  return {
    name: 'pharmaguide-local-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      }

      server.middlewares.use('/api/gemini', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const request = new Request(`http://${req.headers.host}/api/gemini`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });

          const handlers = await server.ssrLoadModule('/api/gemini.ts');
          const handler = handlers[req.method || ''];
          const response: Response = handler
            ? await handler(request)
            : new Response(null, { status: 405 });

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), localApi()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
});
