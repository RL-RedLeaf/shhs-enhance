import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const entry = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// 双入口 MPA：index.html(/) 与 login.html(/login)。
// 服务器端现有页面路由表不变：/{,/workbench} 出 index、{,/login,/account,/change-password,/admin/accounts} 出 login。
// GitHub Pages 部署在子路径下时需要设置 VITE_BASE=/<repo>/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        index: entry('index.html'),
        login: entry('login.html'),
      },
      output: {
        manualChunks: {
          antd: ['antd'],
        },
      },
    },
  },
  server: {
    proxy: {
      // 本地开发：GET 直读线上公开接口（写接口会被边缘源校验拦截，属预期）
      '/api': { target: 'https://shhspost.cn', changeOrigin: true, secure: true },
    },
  },
})
