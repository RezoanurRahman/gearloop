import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './server/app'

const distDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

function isApiPath(requestPath: string): boolean {
  return requestPath === '/api' || requestPath.startsWith('/api/')
}

// Static assets and the SPA fallback only apply outside /api so the API keeps
// working (and answering JSON) even when `dist` has not been built.
if (existsSync(distDirectory)) {
  const serveDistAssets = serveStatic({ root: distDirectory })
  const serveSpaFallback = serveStatic({ root: distDirectory, path: 'index.html' })

  app.use('*', async (c, next) => {
    if (isApiPath(c.req.path)) return next()
    return serveDistAssets(c, next)
  })

  app.use('*', async (c, next) => {
    if (isApiPath(c.req.path)) return next()
    return serveSpaFallback(c, next)
  })
}

const port = Number.parseInt(process.env.PORT ?? '8787', 10) || 8787

serve(
  {
    fetch: app.fetch,
    hostname: '127.0.0.1',
    port,
  },
  (info) => {
    console.log(`GearLoop server listening on http://127.0.0.1:${info.port}`)
  },
)
