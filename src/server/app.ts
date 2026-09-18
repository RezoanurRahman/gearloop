import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Context } from 'hono'
import type { GearFilters } from '../shared/types'
import { GearStore, GearStoreError } from './store'

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const DEFAULT_DEV_ORIGIN = 'http://localhost:5173'

export interface CreateAppOptions {
  /** Injectable store so tests (and future callers) get isolated state. */
  store?: GearStore
}

type JsonObject = Record<string, unknown>

type CreateGearBody = {
  name?: unknown
  category?: unknown
  description?: unknown
  location?: unknown
  condition?: unknown
}

type CheckoutBody = {
  borrower?: unknown
  dueDate?: unknown
}

async function readJsonBody(c: Context): Promise<JsonObject | undefined> {
  let parsed: unknown
  try {
    parsed = await c.req.json()
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  return parsed as JsonObject
}

function badRequest(c: Context, message: string): Response {
  return c.json({ error: message }, 400)
}

/**
 * Builds the API app. Pass a store to share or reset state; with no options a
 * freshly seeded store is created so every call starts from the same data.
 */
export function createApp(options: CreateAppOptions = {}): Hono {
  const store = options.store ?? new GearStore()
  const app = new Hono()

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (LOCAL_DEV_ORIGIN.test(origin) ? origin : DEFAULT_DEV_ORIGIN),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: 86_400,
    }),
  )

  app.get('/api/health', (c) => c.json({ status: 'ok', service: 'gearloop' }))

  app.get('/api/gear', (c) => {
    const filters: GearFilters = {
      query: c.req.query('query'),
      category: c.req.query('category'),
      status: c.req.query('status'),
    }
    return c.json(store.list(filters))
  })

  app.post('/api/gear', async (c) => {
    const raw = await readJsonBody(c)
    if (raw === undefined) return badRequest(c, 'Request body must be a JSON object')
    const body = raw as CreateGearBody

    if (typeof body.name !== 'string') return badRequest(c, 'name is required')
    if (typeof body.category !== 'string') return badRequest(c, 'category is required')
    if (typeof body.location !== 'string') return badRequest(c, 'location is required')
    if (typeof body.condition !== 'string') return badRequest(c, 'condition is required')
    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== 'string'
    ) {
      return badRequest(c, 'description must be a string')
    }

    const item = store.create({
      name: body.name,
      category: body.category,
      description: typeof body.description === 'string' ? body.description : '',
      location: body.location,
      condition: body.condition,
    })

    return c.json(item, 201)
  })

  app.post('/api/gear/:id/checkout', async (c) => {
    const raw = await readJsonBody(c)
    if (raw === undefined) return badRequest(c, 'Request body must be a JSON object')
    const body = raw as CheckoutBody

    if (typeof body.borrower !== 'string') return badRequest(c, 'borrower is required')
    if (typeof body.dueDate !== 'string') return badRequest(c, 'dueDate is required')

    const item = store.checkout(c.req.param('id'), {
      borrower: body.borrower,
      dueDate: body.dueDate,
    })
    return c.json(item)
  })

  app.post('/api/gear/:id/return', (c) => c.json(store.returnItem(c.req.param('id'))))

  app.notFound((c) => {
    if (c.req.path.startsWith('/api')) return c.json({ error: 'Not found' }, 404)
    return c.text('Not Found', 404)
  })

  app.onError((error, c) => {
    if (error instanceof GearStoreError) return c.json({ error: error.message }, error.status)
    console.error(error)
    return c.json({ error: 'Internal server error' }, 500)
  })

  return app
}

/** Shared app instance used by the Node entrypoint in `src/server.ts`. */
export const app = createApp()
