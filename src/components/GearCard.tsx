import { useId } from 'react'
import type { GearItem } from '../shared/types'

interface GearCardProps {
  item: GearItem
  onCheckout: (item: GearItem) => void
  onReturn: (item: GearItem) => void
  /** True while a request for this item is in flight. */
  busy?: boolean
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function daysOverdue(dueDate: string): number | null {
  const due = parseDateOnly(dueDate) ?? new Date(dueDate)
  if (Number.isNaN(due.getTime())) {
    return null
  }
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((startOfToday().getTime() - due.getTime()) / 86_400_000)
  return diff > 0 ? diff : null
}

function formatDueDate(dueDate: string): string {
  const due = parseDateOnly(dueDate) ?? new Date(dueDate)
  if (Number.isNaN(due.getTime())) {
    return dueDate
  }
  return due.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function GearCard({ item, onCheckout, onReturn, busy = false }: GearCardProps) {
  const headingId = useId()
  const isCheckedOut = item.status === 'checked-out'
  const overdueDays = isCheckedOut && item.dueDate ? daysOverdue(item.dueDate) : null
  const isOverdue = overdueDays !== null

  const statusLabel = isOverdue ? 'Overdue' : isCheckedOut ? 'Checked out' : 'Available'
  const badgeTone = isOverdue ? 'overdue' : isCheckedOut ? 'checked-out' : 'available'

  return (
    <article
      className="gear-card"
      data-status={item.status}
      data-overdue={isOverdue ? 'true' : undefined}
      aria-labelledby={headingId}
    >
      <div className="gear-card__top">
        <span className="chip">{item.category}</span>
        <span className={`badge badge--${badgeTone}`}>
          <span className="badge__dot" aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <h3 className="gear-card__name" id={headingId}>
        {item.name}
      </h3>

      {item.description ? <p className="gear-card__description">{item.description}</p> : null}

      <dl className="gear-card__meta">
        <div className="gear-card__meta-row">
          <dt>Location</dt>
          <dd>{item.location || '—'}</dd>
        </div>
        <div className="gear-card__meta-row">
          <dt>Condition</dt>
          <dd>{item.condition || '—'}</dd>
        </div>
        {isCheckedOut && item.borrower ? (
          <div className="gear-card__meta-row">
            <dt>Borrower</dt>
            <dd>{item.borrower}</dd>
          </div>
        ) : null}
        {isCheckedOut && item.dueDate ? (
          <div className="gear-card__meta-row">
            <dt>Due</dt>
            <dd className={isOverdue ? 'gear-card__due gear-card__due--overdue' : 'gear-card__due'}>
              {formatDueDate(item.dueDate)}
              {overdueDays !== null ? (
                <span className="gear-card__overdue-note">
                  {overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="gear-card__actions">
        {isCheckedOut ? (
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => onReturn(item)}
            disabled={busy}
          >
            {busy ? 'Returning…' : 'Return gear'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => onCheckout(item)}
            disabled={busy}
          >
            {busy ? 'Checking out…' : 'Check out'}
          </button>
        )}
      </div>
    </article>
  )
}

export default GearCard
