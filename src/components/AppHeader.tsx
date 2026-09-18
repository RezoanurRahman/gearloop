interface AppHeaderProps {
  /** Today's date, injected so the header stays deterministic in tests. */
  today: Date
  onAddGear: () => void
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function AppHeader({ today, onAddGear }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" role="img" focusable="false">
              <path
                d="M16 4.5a11.5 11.5 0 1 0 11.5 11.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx="20.5" cy="9" r="4.4" fill="currentColor" />
            </svg>
          </span>
          <span className="brand__text">
            <h1 className="brand__name">GearLoop</h1>
            <span className="brand__tagline">Team gear checkout, tracked in one place</span>
          </span>
        </div>

        <div className="app-header__meta">
          <span className="app-header__cue">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <rect
                x="3"
                y="4.5"
                width="14"
                height="12"
                rx="2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <time dateTime={toIsoDate(today)}>{formatHeaderDate(today)}</time>
            <span className="app-header__env">In-memory demo</span>
          </span>
          <button type="button" className="btn btn--primary" onClick={onAddGear}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path
                d="M10 4.5v11M4.5 10h11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
            Add gear
          </button>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
