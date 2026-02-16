import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    const isElectron = !!process.env.ELECTRON

    return {
        plugins: [
            react(),
            // Only include electron plugin when building for electron
            ...(isElectron ? [electron({
                entry: 'electron/main.ts',
            })] : []),
        ],
        base: isElectron ? './' : '/APItester/',
        server: {
            proxy: {
                '^/api-proxy/.*': {
                    target: 'http://placeholder',
                    changeOrigin: true,
                    secure: false,
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            // Extract actual target URL from path: /api-proxy/https://example.com/path
                            const fullUrl = req.url?.replace('/api-proxy/', '') || ''
                            try {
                                const targetUrl = new URL(decodeURIComponent(fullUrl))
                                proxyReq.setHeader('host', targetUrl.host)
                                proxyReq.path = targetUrl.pathname + targetUrl.search
                                    // Update the proxy target dynamically
                                    ; (proxy as any).options.target = targetUrl.origin
                            } catch (e) {
                                console.error('Invalid proxy URL:', fullUrl, e)
                            }
                        })
                        proxy.on('error', (err) => {
                            console.error('Proxy error:', err)
                        })
                    },
                    rewrite: () => '' // Will be set in proxyReq handler
                }
            }
        }
    }
})
