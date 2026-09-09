import type { User } from './UserIdentity.tsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import UserIdentity from './UserIdentity.tsx'

interface UserComboboxProps {
  label: string
  placeholder: string
  users: User[]
  onSelect: (userId: string) => void
  onInvite?: () => void
  inviteDisabledReason?: string
}

export default function UserCombobox({
  label,
  placeholder,
  users,
  onSelect,
  onInvite,
  inviteDisabledReason,
}: UserComboboxProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) {
      return users
    }

    return users.filter(
      user => user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
    )
  }, [query, users])

  // The invite row, when there is one, sits after the people so arrow keys reach it last.
  const inviteIndex = onInvite ? matches.length : -1
  const optionCount = matches.length + (onInvite ? 1 : 0)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)

    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [isOpen])

  const commit = (index: number) => {
    if (index === inviteIndex) {
      if (onInvite && !inviteDisabledReason) {
        setIsOpen(false)
        onInvite()
      }

      return
    }

    const user = matches[index]

    if (!user) {
      return
    }

    onSelect(user.userId)
    setQuery('')
    setActiveIndex(0)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (event.key === 'Tab') {
      setIsOpen(false)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()

      if (!isOpen) {
        setIsOpen(true)
        return
      }

      if (!optionCount) {
        return
      }

      const delta = event.key === 'ArrowDown' ? 1 : -1

      setActiveIndex(current => (current + delta + optionCount) % optionCount)
      return
    }

    if (event.key === 'Enter' && isOpen) {
      event.preventDefault()
      commit(activeIndex)
    }
  }

  const optionClasses = (index: number) =>
    `flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors hover:cursor-pointer ${
      index === activeIndex ? 'bg-gray-100' : 'bg-white'
    }`

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen ? `${listboxId}-${activeIndex}` : undefined}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-performant focus:outline-none focus:ring-1 focus:ring-performant"
      />

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
        >
          <div role="presentation" className="max-h-56 overflow-y-auto">
            {matches.length
              ? matches.map((user, index) => (
                  <div
                    key={user.userId}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    ref={index === activeIndex ? node => node?.scrollIntoView({ block: 'nearest' }) : undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      // Keep focus in the input so the list stays open for the next pick.
                      event.preventDefault()
                      commit(index)
                    }}
                    className={optionClasses(index)}
                  >
                    <UserIdentity user={user} size="sm" />
                  </div>
                ))
              : (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    {users.length ? 'No one matches that search.' : 'Everyone has been added.'}
                  </p>
                )}
          </div>

          {onInvite && (
            <div
              id={`${listboxId}-${inviteIndex}`}
              role="option"
              aria-selected={inviteIndex === activeIndex}
              aria-disabled={Boolean(inviteDisabledReason)}
              onMouseEnter={() => setActiveIndex(inviteIndex)}
              onMouseDown={(event) => {
                event.preventDefault()
                commit(inviteIndex)
              }}
              className={`border-t border-gray-200 ${optionClasses(inviteIndex)} ${
                inviteDisabledReason ? 'opacity-60 hover:cursor-not-allowed' : ''
              }`}
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-performant/10 font-semibold text-performant"
              >
                +
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-gray-900">Invite new user</span>
                {inviteDisabledReason && (
                  <span className="truncate text-xs text-gray-500">{inviteDisabledReason}</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
