import type { ChangeEvent } from 'react'
import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

type Field = 'firstName' | 'lastName' | 'email'

const EMPTY = { firstName: '', lastName: '', email: '' }

const FIELDS: { name: Field, label: string, type: string, placeholder: string }[] = [
  { name: 'firstName', label: 'First name', type: 'text', placeholder: 'First name' },
  { name: 'lastName', label: 'Last name', type: 'text', placeholder: 'Last name' },
  { name: 'email', label: 'Email address', type: 'email', placeholder: 'someone@example.com' },
]

interface DiscourseGroupInviteProps {
  group: string
  onInvited: () => Promise<void>
  onDismiss: () => void
}

export default function DiscourseGroupInvite({ group, onInvited, onDismiss }: DiscourseGroupInviteProps) {
  const { getToken } = useAuth()

  const dialogRef = useRef<HTMLDialogElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const fieldId = useId()

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
    firstFieldRef.current?.focus()
  }, [])

  const update = useCallback((field: Field) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target

    setForm(current => ({ ...current, [field]: value }))
    setError(null)
  }, [])

  const invite = useCallback(async (event: { preventDefault: () => void }) => {
    event.preventDefault()

    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const email = form.email.trim()

    if (!firstName || !lastName || !email) {
      return
    }

    setIsInviting(true)
    setError(null)

    try {
      const response = await fetch('/api/discourse/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ group, email, firstName, lastName }),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(body?.error ?? `Could not invite ${email} (${response.status}).`)
      }

      await onInvited()
      onDismiss()
    }
    catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : `Could not invite ${email}.`)
    }
    finally {
      setIsInviting(false)
    }
  }, [form, getToken, group, onDismiss, onInvited])

  const isComplete = Boolean(form.firstName.trim() && form.lastName.trim() && form.email.trim())

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onDismiss()
        }
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/60"
    >
      <form onSubmit={invite} className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-lg font-semibold">Invite someone new</h2>
          <p className="text-[15px] text-gray-600">
            Invite a new user and add them to&nbsp;
            <strong className="font-semibold text-gray-900">{group}</strong>
            .
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {FIELDS.map(({ name, label, type, placeholder }, index) => (
            <div key={name} className="flex flex-col gap-2">
              <label htmlFor={`${fieldId}-${name}`} className="font-semibold text-gray-700">
                {label}
              </label>
              <input
                ref={index === 0 ? firstFieldRef : undefined}
                id={`${fieldId}-${name}`}
                type={type}
                value={form[name]}
                onChange={update(name)}
                disabled={isInviting}
                placeholder={placeholder}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-performant focus:outline-none focus:ring-1 focus:ring-performant disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isInviting || !isComplete}
            className="rounded-md bg-performant px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-performant/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isInviting ? 'Inviting…' : 'Invite'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
