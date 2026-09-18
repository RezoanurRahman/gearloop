import type {
  CheckoutInput,
  CreateGearInput,
  GearFilters,
  GearItem,
  GearResponse,
} from '../shared/types'

export type { CheckoutInput, CreateGearInput, GearFilters, GearItem, GearResponse }

const NETWORK_ERROR_MESSAGE =
  'Could not reach the GearLoop server. Check your connection and try again.'

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function readErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as { error?: unknown }).error
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim()
    }
  }
  return `GearLoop request failed (HTTP ${status}).`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error(NETWORK_ERROR_MESSAGE, { cause: error })
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    throw new Error(readErrorMessage(payload, response.status))
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new Error('The GearLoop server returned an unexpected response.', { cause: error })
  }
}

/** Builds a clean `?query=&category=&status=` string, skipping empty filters. */
export function buildGearQuery(filters: GearFilters = {}): string {
  const params = new URLSearchParams()
  const query = filters.query?.trim()
  if (query) {
    params.set('query', query)
  }
  if (filters.category) {
    params.set('category', filters.category)
  }
  if (filters.status) {
    params.set('status', filters.status)
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

export function getGear(filters: GearFilters = {}, signal?: AbortSignal): Promise<GearResponse> {
  return request<GearResponse>(`/api/gear${buildGearQuery(filters)}`, { signal })
}

export function checkoutGear(id: string, payload: CheckoutInput): Promise<GearItem> {
  return request<GearItem>(`/api/gear/${encodeURIComponent(id)}/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function returnGear(id: string): Promise<GearItem> {
  return request<GearItem>(`/api/gear/${encodeURIComponent(id)}/return`, {
    method: 'POST',
  })
}

export function addGear(payload: CreateGearInput): Promise<GearItem> {
  return request<GearItem>('/api/gear', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
