import { defineConfig } from 'vite';
export default defineConfig({
  resolve: { conditions: ['development', 'browser'] },
  server: { proxy: {
    '/matchmake': { target: 'http://127.0.0.1:2567' },
    '/health': { target: 'http://127.0.0.1:2567' },
    '/api': { target: 'http://127.0.0.1:2567' },
    '^/[^/]+/[^/]+': { target: 'ws://127.0.0.1:2567', ws: true, bypass(req) { if (req.headers.upgrade !== 'websocket') return req.url; } },
  } },
});
