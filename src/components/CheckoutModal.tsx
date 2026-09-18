import { useEffect, useRef, useState } from 'react'
import type { CheckoutInput, GearItem } from '../shared/types'

interface CheckoutModalProps {
  item: GearItem
  onCancel: () => void
  onConfirm: (input: CheckoutInput) => Promise<void>
}

interface FieldErrors {
  borrower?: string
  dueDate?: string
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function useModalBehavior(onClose: () => void, enabled = true) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!enabled) {
      return
    }
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') {
        return
      }
      const panel = panelRef.current
      if (!panel) {
        return
      }
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) {
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [enabled])

  return panelRef
}

export function CheckoutModal({ item, onCancel, onConfirm }: CheckoutModalProps) {
  const panelRef = useModalBehavior(onCancel)
  const borrowerRef = useRef<HTMLInputElement>(null)
  const today = toDateInputValue(new Date())
  const [borrower, setBorrower] = useState('')
  const [dueDate, setDueDate] = useState(() => toDateInputValue(addDays(new Date(), 7)))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    borrowerRef.current?.focus()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }

    const nextErrors: FieldErrors = {}
    const trimmedBorrower = borrower.trim()
    if (!trimmedBorrower) {
      nextErrors.borrower = "Enter the borrower's name."
    }
    if (!dueDate) {
      nextErrors.dueDate = 'Choose a due date.'
    } else if (dueDate < today) {
      nextErrors.dueDate = "The due date can't be in the past."
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await onConfirm({ borrower: trimmedBorrower, dueDate })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not check out this item.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        aria-describedby="checkout-description"
        ref={panelRef}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id="checkout-title">
              Check out gear
            </h2>
            <p className="modal__description" id="checkout-description">
              Log who is taking <strong>{item.name}</strong> and when it comes back.
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path
                d="M5.5 5.5l9 9M14.5 5.5l-9 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <ul className="modal__summary">
          <li>
            <span className="modal__summary-label">Category</span>
            <span>{item.category}</span>
          </li>
          <li>
            <span className="modal__summary-label">Location</span>
            <span>{item.location || '—'}</span>
          </li>
          <li>
            <span className="modal__summary-label">Condition</span>
            <span>{item.condition || '—'}</span>
          </li>
        </ul>

        <form className="form" onSubmit={handleSubmit} noValidate>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="field">
            <label htmlFor="checkout-borrower">Borrower</label>
            <input
              id="checkout-borrower"
              name="borrower"
              type="text"
              ref={borrowerRef}
              value={borrower}
              placeholder="e.g. Priya Raman"
              autoComplete="off"
              required
              disabled={submitting}
              aria-invalid={errors.borrower ? true : undefined}
              aria-describedby={errors.borrower ? 'checkout-borrower-error' : undefined}
              onChange={(event) => setBorrower(event.target.value)}
            />
            {errors.borrower ? (
              <p className="field-error" id="checkout-borrower-error">
                {errors.borrower}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="checkout-due-date">Due date</label>
            <input
              id="checkout-due-date"
              name="dueDate"
              type="date"
              min={today}
              value={dueDate}
              required
              disabled={submitting}
              aria-invalid={errors.dueDate ? true : undefined}
              aria-describedby={errors.dueDate ? 'checkout-due-date-error' : undefined}
              onChange={(event) => setDueDate(event.target.value)}
            />
            {errors.dueDate ? (
              <p className="field-error" id="checkout-due-date-error">
                {errors.dueDate}
              </p>
            ) : (
              <p className="field__hint">Defaults to one week from today.</p>
            )}
          </div>

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Checking out…' : 'Confirm checkout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CheckoutModal
