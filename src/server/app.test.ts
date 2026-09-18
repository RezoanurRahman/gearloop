import { describe, expect, it } from 'vitest'
import type { Activity, GearCategory, GearItem, GearResponse } from '../shared/types'
import { createApp } from './app'
import { GearStore, isValidIsoDate, toIsoDate } from './store'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonRequest(body: unknown): RequestInit {
  return { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }
}

async function getGear(app: ReturnType<typeof createApp>, search = ''): Promise<GearResponse> {
  const response = await app.request(`/api/gear${search}`)
  expect(response.status).toBe(200)
  return (await response.json()) as GearResponse
}

describe('GET /api/health', () => {
  it('reports the GearLoop service as ok', async () => {
    const app = createApp()
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({ status: 'ok', service: 'gearloop' })
  })
})

describe('GET /api/gear', () => {
  it('seeds 7-9 items across camera, audio, lighting, and outdoor', async () => {
    const { items } = await getGear(createApp())

    expect(items.length).toBeGreaterThanOrEqual(7)
    expect(items.length).toBeLessThanOrEqual(9)

    const categories = new Set(items.map((item) => item.category))
    for (const category of ['Camera', 'Audio', 'Lighting', 'Outdoor'] as GearCategory[]) {
      expect(categories.has(category)).toBe(true)
    }

    for (const item of items) {
      expect(item.id).toMatch(/^gear-\d{3}$/)
      expect(item.name.trim().length).toBeGreaterThan(0)
      expect(typeof item.description).toBe('string')
      expect(item.location.trim().length).toBeGreaterThan(0)
      expect(item.condition.trim().length).toBeGreaterThan(0)
      expect(['available', 'checked-out']).toContain(item.status)
      expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false)
    }

    const ids = items.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('reports stats for the complete inventory, including overdue gear', async () => {
    const { items, stats } = await getGear(createApp())

    expect(stats.total).toBe(items.length)
    expect(stats.available + stats.checkedOut).toBe(stats.total)
    expect(stats.checkedOut).toBeGreaterThanOrEqual(1)
    expect(stats.overdue).toBeGreaterThanOrEqual(1)
    expect(stats.overdue).toBeLessThanOrEqual(stats.checkedOut)
    expect(items.filter((item) => item.status === 'available')).toHaveLength(stats.available)
    expect(items.filter((item) => item.status === 'checked-out')).toHaveLength(stats.checkedOut)

    const today = toIsoDate(new Date())
    const overdue = items.filter(
      (item) => item.status === 'checked-out' && item.dueDate !== undefined && item.dueDate < today,
    )
    expect(overdue).toHaveLength(stats.overdue)
  })

  it('returns a useful newest-first activity feed capped at 12 entries', async () => {
    const { activity } = await getGear(createApp())

    expect(activity.length).toBeGreaterThan(0)
    expect(activity.length).toBeLessThanOrEqual(12)
    expect(activity.some((entry) => entry.type === 'checkout')).toBe(true)

    const timestamps = activity.map((entry) => entry.timestamp)
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b.localeCompare(a)))

    for (const entry of activity as Activity[]) {
      expect(entry.id.length).toBeGreaterThan(0)
      expect(['checkout', 'return', 'added']).toContain(entry.type)
      expect(entry.gearId).toMatch(/^gear-/)
      expect(entry.gearName.trim().length).toBeGreaterThan(0)
      expect(entry.actor.trim().length).toBeGreaterThan(0)
      expect(entry.detail.trim().length).toBeGreaterThan(0)
    }
  })

  it('returns copies so callers cannot mutate store state', async () => {
    const app = createApp()
    const first = await getGear(app)

    first.items[0].name = 'Mutated name'
    first.items[0].status = 'checked-out'
    first.activity[0].detail = 'Mutated detail'

    const second = await getGear(app)
    expect(second.items[0].name).not.toBe('Mutated name')
    expect(second.items[0].status).toBe('available')
    expect(second.activity[0].detail).not.toBe('Mutated detail')
  })
})

describe('GET /api/gear filters', () => {
  it('filters by category', async () => {
    const { items, stats } = await getGear(createApp(), '?category=Audio')

    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.category === 'Audio')).toBe(true)
    expect(stats.total).toBeGreaterThan(items.length)
  })

  it('filters by status', async () => {
    const app = createApp()
    const all = await getGear(app)
    const checkedOut = await getGear(app, '?status=checked-out')
    const available = await getGear(app, '?status=available')

    expect(checkedOut.items.length).toBeGreaterThan(0)
    expect(checkedOut.items.every((item) => item.status === 'checked-out')).toBe(true)
    expect(available.items.every((item) => item.status === 'available')).toBe(true)
    expect(available.items.length + checkedOut.items.length).toBe(all.items.length)
    expect(checkedOut.stats.total).toBe(all.stats.total)
  })

  it('matches query text case-insensitively across name, description, location, and category', async () => {
    const app = createApp()

    const byName = await getGear(app, '?query=FX3')
    expect(byName.items).toHaveLength(1)
    expect(byName.items[0].name).toContain('FX3')

    const byDescription = await getGear(app, '?query=softbox')
    expect(byDescription.items.length).toBeGreaterThan(0)
    expect(byDescription.items.every((item) => item.description.includes('softbox'))).toBe(true)

    const byLocation = await getGear(app, '?query=storage')
    expect(byLocation.items.length).toBeGreaterThan(0)
    expect(byLocation.items.every((item) => item.location.toLowerCase().includes('storage'))).toBe(
      true,
    )

    const byCategory = await getGear(app, '?query=outdoor')
    expect(byCategory.items.length).toBeGreaterThan(0)
    expect(byCategory.items.every((item) => item.category === 'Outdoor')).toBe(true)

    const noMatches = await getGear(app, '?query=submarine')
    expect(noMatches.items).toHaveLength(0)
    expect(noMatches.stats.total).toBe(byName.stats.total)
  })

  it('combines filters and ignores blank values', async () => {
    const app = createApp()
    const combined = await getGear(app, '?category=Camera&status=checked-out')
    expect(combined.items.length).toBeGreaterThan(0)
    expect(
      combined.items.every((item) => item.category === 'Camera' && item.status === 'checked-out'),
    ).toBe(true)

    const blank = await getGear(app, '?query=&category=&status=')
    const unfiltered = await getGear(app)
    expect(blank.items).toHaveLength(unfiltered.items.length)
  })

  it('rejects unknown filter values with 400', async () => {
    const app = createApp()
    const badStatus = await app.request('/api/gear?status=maybe')
    const badCategory = await app.request('/api/gear?category=Spaceship')

    expect(badStatus.status).toBe(400)
    expect(badCategory.status).toBe(400)
    expect(((await badStatus.json()) as { error: string }).error).toBeTruthy()
  })
})

describe('POST /api/gear/:id/checkout', () => {
  it('checks out an available item, trims the borrower, and records activity', async () => {
    const app = createApp()
    const before = await getGear(app)
    const target = before.items.find((item) => item.status === 'available')
    expect(target).toBeDefined()

    const dueDate = toIsoDate(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000))
    const response = await app.request(
      `/api/gear/${target?.id}/checkout`,
      jsonRequest({ borrower: '  Alex Rivera  ', dueDate }),
    )

    expect(response.status).toBe(200)
    const item = (await response.json()) as GearItem
    expect(item.status).toBe('checked-out')
    expect(item.borrower).toBe('Alex Rivera')
    expect(item.dueDate).toBe(dueDate)

    const after = await getGear(app)
    expect(after.stats.checkedOut).toBe(before.stats.checkedOut + 1)
    expect(after.stats.available).toBe(before.stats.available - 1)
    expect(after.stats.overdue).toBe(before.stats.overdue)
    expect(after.activity[0]).toMatchObject({
      type: 'checkout',
      gearId: target?.id,
      actor: 'Alex Rivera',
    })
  })

  it('accepts a due date of today', async () => {
    const app = createApp()
    const target = (await getGear(app)).items.find((item) => item.status === 'available')
    const response = await app.request(
      `/api/gear/${target?.id}/checkout`,
      jsonRequest({ borrower: 'Sam Ortiz', dueDate: toIsoDate(new Date()) }),
    )

    expect(response.status).toBe(200)
    expect(((await response.json()) as GearItem).dueDate).toBe(toIsoDate(new Date()))
  })

  it('returns 404 for unknown gear', async () => {
    const response = await createApp().request(
      '/api/gear/gear-999/checkout',
      jsonRequest({ borrower: 'Alex Rivera', dueDate: toIsoDate(new Date()) }),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Gear item not found' })
  })

  it('returns 409 when the gear is already checked out', async () => {
    const app = createApp()
    const target = (await getGear(app)).items.find((item) => item.status === 'checked-out')
    const response = await app.request(
      `/api/gear/${target?.id}/checkout`,
      jsonRequest({ borrower: 'Alex Rivera', dueDate: toIsoDate(new Date()) }),
    )

    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: string }).error).toBeTruthy()
  })

  it('rejects invalid checkout payloads with 400', async () => {
    const app = createApp()
    const target = (await getGear(app)).items.find((item) => item.status === 'available')
    const url = `/api/gear/${target?.id}/checkout`
    const today = toIsoDate(new Date())

    const cases: Array<[string, RequestInit]> = [
      ['blank borrower', jsonRequest({ borrower: '   ', dueDate: today })],
      ['missing borrower', jsonRequest({ dueDate: today })],
      ['missing due date', jsonRequest({ borrower: 'Alex Rivera' })],
      ['malformed date', jsonRequest({ borrower: 'Alex Rivera', dueDate: '10/06/2026' })],
      ['impossible date', jsonRequest({ borrower: 'Alex Rivera', dueDate: '2026-02-30' })],
      ['past date', jsonRequest({ borrower: 'Alex Rivera', dueDate: '2000-01-01' })],
      ['not an object', { method: 'POST', headers: JSON_HEADERS, body: '[]' }],
    ]

    for (const [label, init] of cases) {
      const response = await app.request(url, init)
      expect(response.status, label).toBe(400)
      expect(((await response.json()) as { error: string }).error, label).toBeTruthy()
    }

    const after = await getGear(app)
    expect(after.items.find((item) => item.id === target?.id)?.status).toBe('available')
  })
})

describe('POST /api/gear/:id/return', () => {
  it('returns a checked-out item and clears borrower and due date', async () => {
    const app = createApp()
    const before = await getGear(app)
    const target = before.items.find((item) => item.status === 'checked-out')
    expect(target).toBeDefined()

    const response = await app.request(`/api/gear/${target?.id}/return`, { method: 'POST' })

    expect(response.status).toBe(200)
    const item = (await response.json()) as GearItem
    expect(item.status).toBe('available')
    expect(item).not.toHaveProperty('borrower')
    expect(item).not.toHaveProperty('dueDate')

    const after = await getGear(app)
    expect(after.stats.checkedOut).toBe(before.stats.checkedOut - 1)
    expect(after.stats.available).toBe(before.stats.available + 1)
    expect(after.activity[0]).toMatchObject({ type: 'return', gearId: target?.id })
  })

  it('returns 404 for unknown gear', async () => {
    const response = await createApp().request('/api/gear/gear-999/return', { method: 'POST' })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Gear item not found' })
  })

  it('returns 409 when the gear is already available', async () => {
    const app = createApp()
    const target = (await getGear(app)).items.find((item) => item.status === 'available')
    const response = await app.request(`/api/gear/${target?.id}/return`, { method: 'POST' })

    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: string }).error).toBeTruthy()
  })
})

describe('POST /api/gear', () => {
  it('adds gear with trimmed values, an initial status, and an activity entry', async () => {
    const app = createApp()
    const before = await getGear(app)

    const response = await app.request(
      '/api/gear',
      jsonRequest({
        name: '  DJI RS 4 Gimbal  ',
        category: 'Camera',
        description: '  3-axis stabilizer  ',
        location: '  Studio / Shelf C  ',
        condition: '  New  ',
      }),
    )

    expect(response.status).toBe(201)
    const item = (await response.json()) as GearItem
    expect(item).toMatchObject({
      name: 'DJI RS 4 Gimbal',
      category: 'Camera',
      description: '3-axis stabilizer',
      location: 'Studio / Shelf C',
      condition: 'New',
      status: 'available',
    })
    expect(item.id).toMatch(/^gear-\d{3}$/)
    expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false)
    expect(item).not.toHaveProperty('borrower')

    const after = await getGear(app)
    expect(after.stats.total).toBe(before.stats.total + 1)
    expect(after.stats.available).toBe(before.stats.available + 1)
    expect(after.items.some((candidate) => candidate.id === item.id)).toBe(true)
    expect(after.activity[0]).toMatchObject({ type: 'added', gearId: item.id })
  })

  it('allows a blank or omitted description', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/gear',
      jsonRequest({
        name: 'Sandbags',
        category: 'Other',
        location: 'Lighting Bay',
        condition: 'Good',
      }),
    )

    expect(response.status).toBe(201)
    expect(((await response.json()) as GearItem).description).toBe('')
  })

  it('rejects invalid payloads with 400', async () => {
    const app = createApp()
    const cases: Array<[string, unknown]> = [
      [
        'invalid category',
        { name: 'Drone', category: 'Spaceship', location: 'Studio', condition: 'Good' },
      ],
      ['missing name', { category: 'Camera', location: 'Studio', condition: 'Good' }],
      ['blank name', { name: '   ', category: 'Camera', location: 'Studio', condition: 'Good' }],
      ['blank location', { name: 'Drone', category: 'Camera', location: '  ', condition: 'Good' }],
      ['missing condition', { name: 'Drone', category: 'Camera', location: 'Studio' }],
      ['non-string name', { name: 42, category: 'Camera', location: 'Studio', condition: 'Good' }],
    ]

    for (const [label, body] of cases) {
      const response = await app.request('/api/gear', jsonRequest(body))
      expect(response.status, label).toBe(400)
      expect(((await response.json()) as { error: string }).error, label).toBeTruthy()
    }

    const invalidJson = await app.request('/api/gear', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: '{not-json',
    })
    expect(invalidJson.status).toBe(400)

    const unknownRoute = await app.request('/api/nope')
    expect(unknownRoute.status).toBe(404)
    await expect(unknownRoute.json()).resolves.toEqual({ error: 'Not found' })
  })
})

describe('app instance', () => {
  it('keeps state isolated between apps', async () => {
    const appA = createApp()
    const appB = createApp()
    const target = (await getGear(appA)).items.find((item) => item.status === 'available')

    const response = await appA.request(
      `/api/gear/${target?.id}/checkout`,
      jsonRequest({ borrower: 'Alex Rivera', dueDate: toIsoDate(new Date()) }),
    )
    expect(response.status).toBe(200)

    const other = await getGear(appB)
    expect(other.items.find((item) => item.id === target?.id)?.status).toBe('available')
  })

  it('supports an injected store', async () => {
    const fixedNow = () => new Date('2031-05-04T09:00:00.000Z')
    const store = new GearStore({ now: fixedNow })
    const app = createApp({ store })

    const response = await app.request('/api/gear')
    expect(response.status).toBe(200)
    const body = (await response.json()) as GearResponse
    expect(body.stats.overdue).toBe(1)

    store.create({
      name: 'C-Stand',
      category: 'Lighting',
      location: 'Lighting Bay',
      condition: 'Good',
    })
    const after = (await (await app.request('/api/gear')).json()) as GearResponse
    expect(after.stats.total).toBe(body.stats.total + 1)
  })

  it('answers CORS preflight requests from the Vite dev server', async () => {
    const response = await createApp().request('/api/gear', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
    })

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })
})

describe('GearStore', () => {
  it('derives seed dates from the injected clock', () => {
    const store = new GearStore({ now: () => new Date('2031-05-04T09:00:00.000Z') })
    const { items, stats } = store.list()

    expect(stats.overdue).toBe(1)
    expect(
      items.filter((item) => item.dueDate !== undefined && item.dueDate < '2031-05-04'),
    ).toHaveLength(1)
    expect(items.filter((item) => item.status === 'checked-out')).toHaveLength(3)
  })

  it('validates ISO calendar dates', () => {
    expect(isValidIsoDate('2026-06-15')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('15/06/2026')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })

  it('caps the activity feed without breaking ids', () => {
    const store = new GearStore({ now: () => new Date('2031-05-04T09:00:00.000Z') })
    for (let index = 0; index < 10; index += 1) {
      store.create({
        name: `Item ${index}`,
        category: 'Other',
        location: 'Studio',
        condition: 'Good',
      })
    }

    const { activity } = store.list()
    expect(activity).toHaveLength(12)
    expect(new Set(activity.map((entry) => entry.id)).size).toBe(activity.length)
    expect(activity[0]).toMatchObject({ type: 'added', gearName: 'Item 9' })
  })
})
