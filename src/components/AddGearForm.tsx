import { useEffect, useRef, useState } from 'react'
import type { GearCategory } from '../shared/types'
import { GEAR_CATEGORIES } from '../shared/types'

export interface NewGearInput {
  name: string
  category: GearCategory
  description: string
  location: string
  condition: string
}

interface AddGearFormProps {
  open: boolean
  onCancel: () => void
  onCreate: (input: NewGearInput) => Promise<void>
}

interface FieldErrors {
  name?: string
  category?: string
  location?: string
  condition?: string
}

const CONDITION_SUGGESTIONS = ['Excellent', 'Good', 'Fair', 'Needs repair']

function useModalBehavior(onClose: () => void, enabled: boolean) {
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

export function AddGearForm({ open, onCancel, onCreate }: AddGearFormProps) {
  const panelRef = useModalBehavior(onCancel, open)
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<GearCategory | ''>('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [condition, setCondition] = useState('Good')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setName('')
    setCategory('')
    setDescription('')
    setLocation('')
    setCondition('Good')
    setErrors({})
    setFormError(null)
    setSubmitting(false)
    nameRef.current?.focus()
  }, [open])

  if (!open) {
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }

    const nextErrors: FieldErrors = {}
    if (!name.trim()) {
      nextErrors.name = 'Give this item a name.'
    }
    if (!category) {
      nextErrors.category = 'Pick a category.'
    }
    if (!location.trim()) {
      nextErrors.location = 'Where does this item live?'
    }
    if (!condition.trim()) {
      nextErrors.condition = 'Describe its condition.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await onCreate({
        name: name.trim(),
        category: category as GearCategory,
        description: description.trim(),
        location: location.trim(),
        condition: condition.trim(),
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not add this item.')
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
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-gear-title"
        aria-describedby="add-gear-description"
        ref={panelRef}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id="add-gear-title">
              Add gear
            </h2>
            <p className="modal__description" id="add-gear-description">
              New items start out available so anyone on the team can check them out.
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

        <form className="form" onSubmit={handleSubmit} noValidate>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="field">
            <label htmlFor="add-gear-name">Name</label>
            <input
              id="add-gear-name"
              name="name"
              type="text"
              ref={nameRef}
              value={name}
              placeholder="e.g. Sony FX3 cinema camera"
              autoComplete="off"
              required
              disabled={submitting}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'add-gear-name-error' : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name ? (
              <p className="field-error" id="add-gear-name-error">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="form__row">
            <div className="field">
              <label htmlFor="add-gear-category">Category</label>
              <select
                id="add-gear-category"
                name="category"
                value={category}
                required
                disabled={submitting}
                aria-invalid={errors.category ? true : undefined}
                aria-describedby={errors.category ? 'add-gear-category-error' : undefined}
                onChange={(event) => setCategory(event.target.value as GearCategory | '')}
              >
                <option value="">Select a category</option>
                {GEAR_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.category ? (
                <p className="field-error" id="add-gear-category-error">
                  {errors.category}
                </p>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="add-gear-condition">Condition</label>
              <input
                id="add-gear-condition"
                name="condition"
                type="text"
                list="gear-condition-suggestions"
                value={condition}
                placeholder="e.g. Good"
                autoComplete="off"
                required
                disabled={submitting}
                aria-invalid={errors.condition ? true : undefined}
                aria-describedby={errors.condition ? 'add-gear-condition-error' : undefined}
                onChange={(event) => setCondition(event.target.value)}
              />
              <datalist id="gear-condition-suggestions">
                {CONDITION_SUGGESTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {errors.condition ? (
                <p className="field-error" id="add-gear-condition-error">
                  {errors.condition}
                </p>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="add-gear-description">Description</label>
            <textarea
              id="add-gear-description"
              name="description"
              rows={3}
              value={description}
              placeholder="What is it used for, and what should borrowers know?"
              disabled={submitting}
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="field__hint">Optional, but it helps the next borrower.</p>
          </div>

          <div className="field">
            <label htmlFor="add-gear-location">Location</label>
            <input
              id="add-gear-location"
              name="location"
              type="text"
              value={location}
              placeholder="e.g. Studio shelf B2"
              autoComplete="off"
              required
              disabled={submitting}
              aria-invalid={errors.location ? true : undefined}
              aria-describedby={errors.location ? 'add-gear-location-error' : undefined}
              onChange={(event) => setLocation(event.target.value)}
            />
            {errors.location ? (
              <p className="field-error" id="add-gear-location-error">
                {errors.location}
              </p>
            ) : null}
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
              {submitting ? 'Adding…' : 'Add gear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddGearForm
