import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: '/APItester/',
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
})

