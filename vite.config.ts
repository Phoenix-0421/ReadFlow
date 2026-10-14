import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 开发环境把 /api/openlibrary/... 转发到 https://openlibrary.org/...
      // 例：/api/openlibrary/search.json?q=harry%20potter
      //   → https://openlibrary.org/search.json?q=harry%20potter
      '/api/openlibrary': {
        target: 'https://openlibrary.org',
        changeOrigin: true,
        // 转发时去掉本地前缀；查询参数会原样带过去
        rewrite: (path) => path.replace(/^\/api\/openlibrary/, ''),
        // 上游连不上时不要无限期等待
        proxyTimeout: 10000,
        timeout: 10000,
      },
    },
  },
})
