import type { GearCategory, GearStatus } from '../shared/types'
import { GEAR_CATEGORIES, GEAR_STATUSES } from '../shared/types'

const STATUS_LABELS: Record<GearStatus, string> = {
  available: 'Available',
  'checked-out': 'Checked out',
}

interface FilterBarProps {
  query: string
  category: GearCategory | ''
  status: GearStatus | ''
  resultCount: number
  totalCount: number
  isFiltering: boolean
  isLoading?: boolean
  onQueryChange: (value: string) => void
  onCategoryChange: (value: GearCategory | '') => void
  onStatusChange: (value: GearStatus | '') => void
  onSubmit: () => void
  onClear: () => void
}

export function FilterBar({
  query,
  category,
  status,
  resultCount,
  totalCount,
  isFiltering,
  isLoading = false,
  onQueryChange,
  onCategoryChange,
  onStatusChange,
  onSubmit,
  onClear,
}: FilterBarProps) {
  const summary = isLoading
    ? 'Loading the gear room…'
    : isFiltering
      ? `Showing ${resultCount} of ${totalCount} item${totalCount === 1 ? '' : 's'}`
      : `${totalCount} item${totalCount === 1 ? '' : 's'} in the gear room`

  return (
    <section className="filter-bar" aria-labelledby="filters-title">
      <h2 className="sr-only" id="filters-title">
        Filter gear
      </h2>
      <form
        className="filter-bar__form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div className="field field--search">
          <label className="sr-only" htmlFor="gear-search">
            Search gear
          </label>
          <span className="field__icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <circle cx="9" cy="9" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M13.2 13.2L17 17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            id="gear-search"
            name="query"
            type="search"
            value={query}
            placeholder="Search by name, borrower, or location"
            autoComplete="off"
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query.length > 0 ? (
            <button
              type="button"
              className="field__clear"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="field field--select">
          <label htmlFor="gear-category">Category</label>
          <select
            id="gear-category"
            name="category"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value as GearCategory | '')}
          >
            <option value="">All categories</option>
            {GEAR_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="field field--select">
          <label htmlFor="gear-status">Status</label>
          <select
            id="gear-status"
            name="status"
            value={status}
            onChange={(event) => onStatusChange(event.target.value as GearStatus | '')}
          >
            <option value="">All statuses</option>
            {GEAR_STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn--secondary filter-bar__submit">
          Apply
        </button>
      </form>

      <div className="filter-bar__footer">
        <p className="filter-bar__count" role="status">
          {summary}
        </p>
        {isFiltering ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={onClear}>
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  )
}

export default FilterBar
