export type StatTone = 'neutral' | 'available' | 'checked-out' | 'overdue'

interface StatCardProps {
  label: string
  value: number | string
  hint: string
  tone: StatTone
}

function StatIcon({ tone }: { tone: StatTone }) {
  if (tone === 'available') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M6.8 10.3l2.2 2.2 4.2-4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (tone === 'checked-out') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path
          d="M11.5 3.2h-3a1.6 1.6 0 0 0-1.6 1.6v1.1H5.8a1.6 1.6 0 0 0-1.6 1.6v7.6a1.6 1.6 0 0 0 1.6 1.6h8.4a1.6 1.6 0 0 0 1.6-1.6V7.5a1.6 1.6 0 0 0-1.6-1.6h-1.1V4.8a1.6 1.6 0 0 0-1.6-1.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M8.4 6V4.6h3.2V6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }

  if (tone === 'overdue') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path
          d="M10 3.4l7 12.2H3l7-12.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M10 8.2v3.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="10" cy="13.9" r="0.9" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect
        x="3.2"
        y="3.2"
        width="5.6"
        height="5.6"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="11.2"
        y="3.2"
        width="5.6"
        height="5.6"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="3.2"
        y="11.2"
        width="5.6"
        height="5.6"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="11.2"
        y="11.2"
        width="5.6"
        height="5.6"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}

export function StatCard({ label, value, hint, tone }: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__head">
        <span className="stat-card__icon" aria-hidden="true">
          <StatIcon tone={tone} />
        </span>
        <h3 className="stat-card__label">{label}</h3>
      </div>
      <p className="stat-card__value">{value}</p>
      <p className="stat-card__hint">{hint}</p>
    </article>
  )
}

export default StatCard
