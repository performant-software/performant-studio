import { useMemo } from 'react'

export interface User {
  userId: string
  name: string
  email: string
  imageUrl: string
}

interface DiscourseGroupRosterProps {
  group: string
  label: string
  singular: string
  users: User[]
  available: User[]
  onChange: (userIds: string[]) => void
}

export default function DiscourseGroupRoster({
  group,
  label,
  singular,
  users,
  available,
  onChange,
}: DiscourseGroupRosterProps) {
  const selectId = `${group}-${singular}`

  const userIds = useMemo(() => users.map(user => user.userId), [users])

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 p-4 text-sm">
      <label htmlFor={selectId} className="text-lg font-bold tracking-wide text-gray-800">
        {label}
      </label>
      <select
        id={selectId}
        value=""
        disabled={!available.length}
        onChange={event => onChange([...userIds, event.target.value])}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-performant focus:outline-none focus:ring-1 focus:ring-performant disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>
          {available.length ? `Add ${singular}…` : 'Everyone added'}
        </option>
        {available.map(user => (
          <option key={user.userId} value={user.userId}>
            {user.email ? `${user.name} (${user.email})` : user.name}
          </option>
        ))}
      </select>

      {users.length
        ? (
            <ul className="flex flex-col divide-y divide-gray-200">
              {users.map((user) => {
                return (
                  <li key={user.userId} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-3">
                      {user.imageUrl
                        ? <img src={user.imageUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                        : <span aria-hidden="true" className="size-8 shrink-0 rounded-full bg-gray-200" />}
                      <span className="flex min-w-0 flex-col">
                        <span
                          title={user.name}
                          className={`truncate font-semibold ${user.imageUrl ? 'text-gray-900' : 'text-gray-500 italic'}`}
                        >
                          {user.name}
                        </span>
                        {user.email && (
                          <span title={user.email} className="truncate text-xs text-gray-500">
                            {user.email}
                          </span>
                        )}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange(userIds.filter(id => id !== user.userId))}
                      aria-label={`Remove ${user.name} from ${label.toLowerCase()} of ${group}`}
                      className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-600 transition-colors hover:cursor-pointer hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        : <p className="text-gray-500">{`No ${label.toLowerCase()} yet.`}</p>}
    </div>
  )
}
