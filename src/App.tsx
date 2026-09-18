import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddGearForm } from './components/AddGearForm'
import type { NewGearInput } from './components/AddGearForm'
import { AppHeader } from './components/AppHeader'
import { CheckoutModal } from './components/CheckoutModal'
import { FilterBar } from './components/FilterBar'
import { GearCard } from './components/GearCard'
import { StatCard } from './components/StatCard'
import { addGear, checkoutGear, getGear, returnGear } from './client/api'
import type {
  CheckoutInput,
  GearCategory,
  GearItem,
  GearResponse,
  GearStatus,
} from './shared/types'

const SEARCH_DEBOUNCE_MS = 300
const NOTICE_TIMEOUT_MS = 6000
const SKELETON_COUNT = 6

interface PendingAction {
  id: string
  kind: 'checkout' | 'return'
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 18) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.round(hours / 24)
  if (days < 7) {
    return `${days}d ago`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function GearCardSkeleton() {
  return (
    <div className="gear-card gear-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--badge" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--short" />
      <div className="skeleton skeleton--button" />
    </div>
  )
}

export function App() {
  const [data, setData] = useState<GearResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<GearCategory | ''>('')
  const [status, setStatus] = useState<GearStatus | ''>('')
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null)
  const [isAddingGear, setIsAddingGear] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const requestRef = useRef<AbortController | null>(null)
  const hasLoadedRef = useRef(false)
  const today = useMemo(() => new Date(), [])

  const loadGear = useCallback(
    async (mode: 'initial' | 'background' = 'background') => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller

      if (mode === 'initial') {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }
      setLoadError(null)

      try {
        const next = await getGear({ query, category, status }, controller.signal)
        if (controller.signal.aborted) {
          return
        }
        hasLoadedRef.current = true
        setData(next)
        setLastUpdated(new Date())
      } catch (error) {
        if (isAbortError(error)) {
          return
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading the gear room.',
        )
      } finally {
        if (requestRef.current === controller) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [query, category, status],
  )

  useEffect(() => {
    void loadGear(hasLoadedRef.current ? 'background' : 'initial')
    return () => {
      requestRef.current?.abort()
    }
  }, [loadGear])

  useEffect(() => {
    if (searchInput === query) {
      return
    }
    const timer = window.setTimeout(() => setQuery(searchInput), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput, query])

  useEffect(() => {
    if (!notice) {
      return
    }
    const timer = window.setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const refresh = useCallback(() => {
    void loadGear('background')
  }, [loadGear])

  const handleCheckoutConfirm = useCallback(
    async (payload: CheckoutInput) => {
      if (!selectedItem) {
        return
      }
      setPending({ id: selectedItem.id, kind: 'checkout' })
      try {
        await checkoutGear(selectedItem.id, payload)
        setSelectedItem(null)
        setNotice(
          `Checked out “${selectedItem.name}” to ${payload.borrower}, due ${formatShortDate(payload.dueDate)}.`,
        )
        refresh()
      } finally {
        setPending(null)
      }
    },
    [refresh, selectedItem],
  )

  const handleReturn = useCallback(
    async (item: GearItem) => {
      setPending({ id: item.id, kind: 'return' })
      setActionError(null)
      try {
        await returnGear(item.id)
        setNotice(`“${item.name}” is back and available.`)
        refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : `Could not return “${item.name}”.`)
      } finally {
        setPending(null)
      }
    },
    [refresh],
  )

  const handleCreate = useCallback(
    async (input: NewGearInput) => {
      await addGear(input)
      setNotice(`Added “${input.name}” to the gear room.`)
      setIsAddingGear(false)
      refresh()
    },
    [refresh],
  )

  const handleSearchSubmit = useCallback(() => {
    setQuery(searchInput)
  }, [searchInput])

  const clearFilters = useCallback(() => {
    setSearchInput('')
    setQuery('')
    setCategory('')
    setStatus('')
  }, [])

  const openCheckout = useCallback((item: GearItem) => {
    setSelectedItem(item)
  }, [])

  const dismissError = useCallback(() => {
    setActionError(null)
    setLoadError(null)
  }, [])

  const stats = data?.stats ?? { total: 0, available: 0, checkedOut: 0, overdue: 0 }
  const items = data?.items ?? []
  const activity = data?.activity ?? []
  const hasActiveFilters = searchInput.trim() !== '' || category !== '' || status !== ''
  const bannerMessage = actionError ?? (loadError && data ? loadError : null)
  const showInitialError = Boolean(loadError && !data)
  const showSkeletons = isLoading && !data

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to gear list
      </a>

      <AppHeader today={today} onAddGear={() => setIsAddingGear(true)} />

      <main className="app-main" id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__text">
            <p className="hero__eyebrow">
              <span>{greetingFor(today)}</span>
              <span className="hero__dot" aria-hidden="true">
                •
              </span>
              <span>{formatLongDate(today)}</span>
            </p>
            <h2 className="hero__title" id="hero-title">
              Everything in the gear room, at a glance.
            </h2>
            <p className="hero__body">
              Track what is available, who has what, and what is due back. Overdue items surface
              automatically so nothing quietly goes missing.
            </p>
          </div>
          <div className="hero__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setIsAddingGear(true)}
            >
              Add gear
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={refresh}
              disabled={isRefreshing || isLoading}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <p className="hero__meta">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'Loading the latest counts…'}
          </p>
        </section>

        <section className="stats" aria-labelledby="stats-title">
          <h2 className="sr-only" id="stats-title">
            Gear overview
          </h2>
          <StatCard
            label="Total gear"
            value={data ? stats.total : '—'}
            hint="Every item on the board"
            tone="neutral"
          />
          <StatCard
            label="Available"
            value={data ? stats.available : '—'}
            hint="Ready to check out now"
            tone="available"
          />
          <StatCard
            label="Checked out"
            value={data ? stats.checkedOut : '—'}
            hint="Currently with a teammate"
            tone="checked-out"
          />
          <StatCard
            label="Overdue"
            value={data ? stats.overdue : '—'}
            hint={stats.overdue > 0 ? 'Needs a nudge today' : 'Nothing past due'}
            tone="overdue"
          />
        </section>

        {bannerMessage ? (
          <div className="banner" role="alert">
            <span className="banner__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false">
                <circle
                  cx="10"
                  cy="10"
                  r="7.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M10 6.4v4.3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="13.6" r="0.95" fill="currentColor" />
              </svg>
            </span>
            <p className="banner__message">{bannerMessage}</p>
            <div className="banner__actions">
              {loadError ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  onClick={() => void loadGear('background')}
                >
                  Retry
                </button>
              ) : null}
              <button type="button" className="btn btn--ghost btn--small" onClick={dismissError}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div className="notice" role="status" aria-live="polite">
          {notice ?? ''}
        </div>

        {showInitialError ? (
          <div className="error-state" role="alert">
            <h2>We could not load the gear room</h2>
            <p>{loadError}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void loadGear('initial')}
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="workspace">
          <section className="workspace__main" aria-labelledby="gear-list-title">
            <div className="section-heading">
              <h2 id="gear-list-title">Gear</h2>
              {isRefreshing ? <span className="refreshing-pill">Refreshing…</span> : null}
            </div>

            <FilterBar
              query={searchInput}
              category={category}
              status={status}
              resultCount={items.length}
              totalCount={hasActiveFilters ? stats.total : items.length}
              isFiltering={hasActiveFilters}
              isLoading={showSkeletons}
              onQueryChange={setSearchInput}
              onCategoryChange={setCategory}
              onStatusChange={setStatus}
              onSubmit={handleSearchSubmit}
              onClear={clearFilters}
            />

            {showSkeletons ? (
              <div className="gear-grid" aria-busy="true" aria-label="Loading gear">
                {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                  <GearCardSkeleton key={index} />
                ))}
              </div>
            ) : items.length > 0 ? (
              <div className="gear-grid">
                {items.map((item) => (
                  <GearCard
                    key={item.id}
                    item={item}
                    onCheckout={openCheckout}
                    onReturn={(nextItem) => void handleReturn(nextItem)}
                    busy={pending?.id === item.id && pending.kind === 'return'}
                  />
                ))}
              </div>
            ) : showInitialError ? null : (
              <div className="empty-state">
                <h3>{hasActiveFilters ? 'No gear matches these filters' : 'No gear yet'}</h3>
                <p>
                  {hasActiveFilters
                    ? 'Try a different search, or clear the filters to see everything again.'
                    : 'Add the first item to start tracking availability, borrowers, and due dates.'}
                </p>
                {hasActiveFilters ? (
                  <button type="button" className="btn btn--secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setIsAddingGear(true)}
                  >
                    Add gear
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className="workspace__aside" aria-labelledby="activity-title">
            <div className="panel">
              <div className="panel__header">
                <h2 id="activity-title">Activity</h2>
                {activity.length > 0 ? (
                  <span className="panel__count">{activity.length}</span>
                ) : null}
              </div>
              {activity.length === 0 ? (
                <p className="panel__empty">
                  Checkouts, returns, and new gear will show up here as the team uses the board.
                </p>
              ) : (
                <ol className="activity-list">
                  {activity.slice(0, 12).map((entry) => (
                    <li key={entry.id} className="activity-item">
                      <span
                        className={`activity-item__dot activity-item__dot--${entry.type}`}
                        aria-hidden="true"
                      />
                      <div className="activity-item__body">
                        <p className="activity-item__detail">{entry.detail}</p>
                        <p className="activity-item__meta">
                          <span>{entry.actor}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeTime(entry.timestamp)}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>

        <footer className="app-footer">
          <p>GearLoop runs on seeded in-memory data — restarting the server resets the board.</p>
        </footer>
      </main>

      {selectedItem ? (
        <CheckoutModal
          item={selectedItem}
          onCancel={() => setSelectedItem(null)}
          onConfirm={handleCheckoutConfirm}
        />
      ) : null}

      <AddGearForm
        open={isAddingGear}
        onCancel={() => setIsAddingGear(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

export default App
