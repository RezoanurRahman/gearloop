/**
 * Shared GearLoop types. Imported by both the Hono API and the React frontend.
 */

export type GearCategory = 'Audio' | 'Camera' | 'Lighting' | 'Outdoor' | 'Other'

export type GearStatus = 'available' | 'checked-out'

export type ActivityType = 'checkout' | 'return' | 'added'

export interface GearItem {
  id: string
  name: string
  category: GearCategory
  description: string
  location: string
  condition: string
  status: GearStatus
  borrower?: string
  dueDate?: string
  createdAt: string
}

export interface DashboardStats {
  total: number
  available: number
  checkedOut: number
  overdue: number
}

export interface Activity {
  id: string
  type: ActivityType
  gearId: string
  gearName: string
  actor: string
  timestamp: string
  detail: string
}

export interface GearResponse {
  items: GearItem[]
  stats: DashboardStats
  activity: Activity[]
}

/**
 * Optional filters accepted by `GET /api/gear`. Explicit `| undefined` keeps
 * callers safe under `exactOptionalPropertyTypes`.
 */
export interface GearFilters {
  query?: string | undefined
  category?: string | undefined
  status?: string | undefined
}

export interface CreateGearInput {
  name: string
  category: string
  description?: string | undefined
  location: string
  condition: string
}

export interface CheckoutInput {
  borrower: string
  dueDate: string
}

export interface ErrorResponse {
  error: string
}

export const GEAR_CATEGORIES: readonly GearCategory[] = [
  'Audio',
  'Camera',
  'Lighting',
  'Outdoor',
  'Other',
]

export const GEAR_STATUSES: readonly GearStatus[] = ['available', 'checked-out']

export function isGearCategory(value: unknown): value is GearCategory {
  return typeof value === 'string' && (GEAR_CATEGORIES as readonly string[]).includes(value)
}

export function isGearStatus(value: unknown): value is GearStatus {
  return typeof value === 'string' && (GEAR_STATUSES as readonly string[]).includes(value)
}
