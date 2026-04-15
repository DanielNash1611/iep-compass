import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.GEMMA_PROXY_TARGET?.trim() || 'http://127.0.0.1:11434'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/ollama': {
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, '/v1'),
          target: proxyTarget,
        },
      },
    },
  }
})
