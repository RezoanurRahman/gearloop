import {
  GEAR_CATEGORIES,
  isGearCategory,
  isGearStatus,
  type Activity,
  type ActivityType,
  type CheckoutInput,
  type CreateGearInput,
  type DashboardStats,
  type GearCategory,
  type GearFilters,
  type GearItem,
  type GearResponse,
  type GearStatus,
} from '../shared/types'

export type ApiErrorStatus = 400 | 404 | 409

/** Thrown by the store when a request is invalid; the Hono app maps it to JSON. */
export class GearStoreError extends Error {
  readonly status: ApiErrorStatus

  constructor(status: ApiErrorStatus, message: string) {
    super(message)
    this.name = 'GearStoreError'
    this.status = status
  }
}

/** How many recent activity entries are exposed by the API. */
export const ACTIVITY_LIMIT = 12

const DAY_MS = 24 * 60 * 60 * 1000
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Formats a Date as a `YYYY-MM-DD` calendar date (UTC). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** True for real `YYYY-MM-DD` dates; rejects `2026-02-30` and similar. */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function isOverdue(item: GearItem, today: string): boolean {
  return item.status === 'checked-out' && item.dueDate !== undefined && item.dueDate < today
}

export interface GearStoreOptions {
  /** Injectable clock so tests never depend on a fixed calendar date. */
  now?: () => Date
}

interface SeedActivity {
  type: ActivityType
  actor: string
  daysAgo: number
  detail?: string
}

interface SeedGear {
  id: string
  name: string
  category: GearCategory
  description: string
  location: string
  condition: string
  status: GearStatus
  borrower?: string
  dueInDays?: number
  checkoutDaysAgo?: number
  addedDaysAgo: number
  history?: readonly SeedActivity[]
}

const SEED_GEAR: readonly SeedGear[] = [
  {
    id: 'gear-001',
    name: 'Canon EOS R6 Body',
    category: 'Camera',
    description: 'Full-frame mirrorless body with two batteries and a charger.',
    location: 'Studio / Shelf A',
    condition: 'Excellent',
    status: 'available',
    addedDaysAgo: 40,
  },
  {
    id: 'gear-002',
    name: 'Sony FX3 Cinema Camera',
    category: 'Camera',
    description: 'Compact cinema camera with cage, top handle, and two CFexpress cards.',
    location: 'Studio / Vault 2',
    condition: 'Excellent',
    status: 'checked-out',
    borrower: 'Maya Chen',
    dueInDays: 4,
    checkoutDaysAgo: 6,
    addedDaysAgo: 32,
  },
  {
    id: 'gear-003',
    name: 'Rode Wireless GO II',
    category: 'Audio',
    description: 'Dual-channel wireless mic kit with two transmitters and a carry case.',
    location: 'Audio Cabinet / Drawer 3',
    condition: 'Good',
    status: 'checked-out',
    borrower: 'Dev Patel',
    dueInDays: -2,
    checkoutDaysAgo: 9,
    addedDaysAgo: 28,
  },
  {
    id: 'gear-004',
    name: 'Shure SM7B Vocal Mic',
    category: 'Audio',
    description: 'Dynamic broadcast microphone with boom arm and pop filter.',
    location: 'Audio Cabinet / Drawer 1',
    condition: 'Good',
    status: 'available',
    addedDaysAgo: 21,
    history: [
      { type: 'checkout', actor: 'Priya Nair', daysAgo: 6, detail: 'Due two days later' },
      {
        type: 'return',
        actor: 'Priya Nair',
        daysAgo: 1,
        detail: 'Returned to Audio Cabinet / Drawer 1',
      },
    ],
  },
  {
    id: 'gear-005',
    name: 'Aputure LS 300X',
    category: 'Lighting',
    description: 'Bi-color point-source LED with reflector, ballast, and stand.',
    location: 'Lighting Bay / Rack 1',
    condition: 'Good',
    status: 'available',
    addedDaysAgo: 18,
  },
  {
    id: 'gear-006',
    name: 'Godox SL60W Kit',
    category: 'Lighting',
    description: '60W LED light with softbox, grid, and light stand.',
    location: 'Lighting Bay / Rack 2',
    condition: 'Fair',
    status: 'checked-out',
    borrower: 'Priya Nair',
    dueInDays: 7,
    checkoutDaysAgo: 3,
    addedDaysAgo: 14,
  },
  {
    id: 'gear-007',
    name: 'REI Half Dome 4 Tent',
    category: 'Outdoor',
    description: 'Four-person three-season tent with footprint and repair kit.',
    location: 'Storage / Bin 12',
    condition: 'Good',
    status: 'available',
    addedDaysAgo: 9,
  },
  {
    id: 'gear-008',
    name: 'Yeti Tundra 45 Cooler',
    category: 'Outdoor',
    description: '45-quart cooler used for shoot-day catering and cold storage.',
    location: 'Storage / Bin 5',
    condition: 'Like new',
    status: 'available',
    addedDaysAgo: 5,
  },
]

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GearStoreError(400, `${field} is required`)
  }
  return value.trim()
}

function cloneItem(item: GearItem): GearItem {
  const copy: GearItem = {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    location: item.location,
    condition: item.condition,
    status: item.status,
    createdAt: item.createdAt,
  }
  if (item.borrower !== undefined) copy.borrower = item.borrower
  if (item.dueDate !== undefined) copy.dueDate = item.dueDate
  return copy
}

function cloneActivity(activity: Activity): Activity {
  return { ...activity }
}

interface NewActivity {
  type: ActivityType
  gearId: string
  gearName: string
  actor: string
  detail: string
  timestamp?: string
}

/** In-memory gear inventory, activity log, and dashboard stats. */
export class GearStore {
  private readonly now: () => Date
  private readonly items: GearItem[] = []
  private activity: Activity[] = []
  private itemSequence = 0
  private activitySequence = 0

  constructor(options: GearStoreOptions = {}) {
    this.now = options.now ?? (() => new Date())
    this.seed()
  }

  /** Full inventory view: filtered items plus stats over all gear and recent activity. */
  list(filters: GearFilters = {}): GearResponse {
    return {
      items: this.filterItems(filters).map(cloneItem),
      stats: this.stats(),
      activity: this.activity.slice(0, ACTIVITY_LIMIT).map(cloneActivity),
    }
  }

  get(id: string): GearItem | undefined {
    const item = this.find(id)
    return item === undefined ? undefined : cloneItem(item)
  }

  create(input: CreateGearInput): GearItem {
    const name = requireText(input.name, 'name')
    const category = requireText(input.category, 'category')
    if (!isGearCategory(category)) {
      throw new GearStoreError(400, `category must be one of: ${GEAR_CATEGORIES.join(', ')}`)
    }
    const location = requireText(input.location, 'location')
    const condition = requireText(input.condition, 'condition')
    if (input.description !== undefined && typeof input.description !== 'string') {
      throw new GearStoreError(400, 'description must be a string')
    }

    const item: GearItem = {
      id: this.nextItemId(),
      name,
      category,
      description: input.description?.trim() ?? '',
      location,
      condition,
      status: 'available',
      createdAt: this.now().toISOString(),
    }

    this.items.push(item)
    this.recordActivity({
      type: 'added',
      gearId: item.id,
      gearName: item.name,
      actor: 'You',
      detail: `Added to ${item.location}`,
    })

    return cloneItem(item)
  }

  checkout(id: string, input: CheckoutInput): GearItem {
    const item = this.find(id)
    if (item === undefined) throw new GearStoreError(404, 'Gear item not found')
    if (item.status === 'checked-out') {
      throw new GearStoreError(409, `${item.name} is already checked out`)
    }

    const borrower = requireText(input.borrower, 'borrower')
    const dueDate = requireText(input.dueDate, 'dueDate')

    if (!isValidIsoDate(dueDate)) {
      throw new GearStoreError(400, 'dueDate must be a valid date in YYYY-MM-DD format')
    }
    if (dueDate < toIsoDate(this.now())) {
      throw new GearStoreError(400, 'dueDate cannot be earlier than today')
    }

    item.status = 'checked-out'
    item.borrower = borrower
    item.dueDate = dueDate

    this.recordActivity({
      type: 'checkout',
      gearId: item.id,
      gearName: item.name,
      actor: borrower,
      detail: `Due ${dueDate}`,
    })

    return cloneItem(item)
  }

  returnItem(id: string): GearItem {
    const item = this.find(id)
    if (item === undefined) throw new GearStoreError(404, 'Gear item not found')
    if (item.status === 'available') {
      throw new GearStoreError(409, `${item.name} is already available`)
    }

    const borrower = item.borrower
    item.status = 'available'
    delete item.borrower
    delete item.dueDate

    this.recordActivity({
      type: 'return',
      gearId: item.id,
      gearName: item.name,
      actor: borrower ?? 'Front Desk',
      detail: `Returned to ${item.location}`,
    })

    return cloneItem(item)
  }

  stats(): DashboardStats {
    const today = toIsoDate(this.now())
    let available = 0
    let checkedOut = 0
    let overdue = 0

    for (const item of this.items) {
      if (item.status === 'available') {
        available += 1
      } else {
        checkedOut += 1
        if (isOverdue(item, today)) overdue += 1
      }
    }

    return { total: this.items.length, available, checkedOut, overdue }
  }

  private filterItems(filters: GearFilters): GearItem[] {
    const query = (filters.query ?? '').trim().toLowerCase()
    const category = (filters.category ?? '').trim()
    const status = (filters.status ?? '').trim()

    if (category !== '' && !isGearCategory(category)) {
      throw new GearStoreError(400, `Unknown category filter: ${category}`)
    }
    if (status !== '' && !isGearStatus(status)) {
      throw new GearStoreError(400, `Unknown status filter: ${status}`)
    }

    return this.items.filter((item) => {
      if (category !== '' && item.category.toLowerCase() !== category.toLowerCase()) return false
      if (status !== '' && item.status !== status) return false
      if (query === '') return true

      const haystack = [item.name, item.description, item.location, item.category]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }

  private find(id: string): GearItem | undefined {
    return this.items.find((item) => item.id === id)
  }

  private nextItemId(): string {
    this.itemSequence += 1
    return `gear-${String(this.itemSequence).padStart(3, '0')}`
  }

  private recordActivity(entry: NewActivity): void {
    const activity: Activity = {
      id: this.nextActivityId(),
      type: entry.type,
      gearId: entry.gearId,
      gearName: entry.gearName,
      actor: entry.actor,
      timestamp: entry.timestamp ?? this.now().toISOString(),
      detail: entry.detail,
    }

    this.activity.unshift(activity)
    if (this.activity.length > ACTIVITY_LIMIT) this.activity.length = ACTIVITY_LIMIT
  }

  private nextActivityId(): string {
    this.activitySequence += 1
    return `act-${String(this.activitySequence).padStart(3, '0')}`
  }

  private seed(): void {
    const now = this.now()
    const pending: Activity[] = []

    const record = (
      type: ActivityType,
      item: GearItem,
      actor: string,
      detail: string,
      daysAgo: number,
    ): void => {
      pending.push({
        id: '',
        type,
        gearId: item.id,
        gearName: item.name,
        actor,
        timestamp: new Date(now.getTime() - daysAgo * DAY_MS).toISOString(),
        detail,
      })
    }

    for (const seed of SEED_GEAR) {
      const item: GearItem = {
        id: seed.id,
        name: seed.name,
        category: seed.category,
        description: seed.description,
        location: seed.location,
        condition: seed.condition,
        status: seed.status,
        createdAt: new Date(now.getTime() - seed.addedDaysAgo * DAY_MS).toISOString(),
      }

      if (seed.status === 'checked-out') {
        item.borrower = seed.borrower ?? 'Front Desk'
        item.dueDate = toIsoDate(addDays(now, seed.dueInDays ?? 0))
        record(
          'checkout',
          item,
          item.borrower,
          `Due ${item.dueDate}`,
          seed.checkoutDaysAgo ?? seed.addedDaysAgo,
        )
      }

      for (const history of seed.history ?? []) {
        record(
          history.type,
          item,
          history.actor,
          history.detail ??
            (history.type === 'return' ? `Returned to ${item.location}` : 'Checked out'),
          history.daysAgo,
        )
      }

      record('added', item, 'Front Desk', `Added to ${item.location}`, seed.addedDaysAgo)
      this.items.push(item)
    }

    this.itemSequence = SEED_GEAR.length
    this.activitySequence = pending.length

    pending.sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    this.activity = pending.slice(0, ACTIVITY_LIMIT).map((entry, index) => ({
      ...entry,
      id: `act-${String(index + 1).padStart(3, '0')}`,
    }))
  }
}

/** Convenience factory mirroring `new GearStore(options)`. */
export function createGearStore(options: GearStoreOptions = {}): GearStore {
  return new GearStore(options)
}
