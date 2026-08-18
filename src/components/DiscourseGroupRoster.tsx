import { useMemo } from 'react'

export interface User {
  userId: string
  name: string
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
    <div className="flex flex-col gap-2 text-lg">
      <label htmlFor={selectId} className="font-semibold text-gray-700">
        {label}
      </label>
      <select
        id={selectId}
        value=""
        disabled={!available.length}
        onChange={event => onChange([...userIds, event.target.value])}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-performant focus:outline-none focus:ring-1 focus:ring-performant disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>
          {available.length ? `Add ${singular}…` : 'Everyone added'}
        </option>
        {available.map(user => (
          <option key={user.userId} value={user.userId}>{user.name}</option>
        ))}
      </select>

      {users.length
        ? (
            <ul className="flex flex-col divide-y divide-gray-200">
              {users.map((user) => {
                return (
                  <li key={user.userId} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-4">
                      {user.imageUrl
                        ? <img src={user.imageUrl} alt="" className="size-6 shrink-0 rounded-full object-cover" />
                        : <span aria-hidden="true" className="size-6 shrink-0 rounded-full bg-gray-200" />}
                      <span className={user.imageUrl ? undefined : 'text-gray-500 italic'}>
                        {user.name}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange(userIds.filter(id => id !== user.userId))}
                      aria-label={`Remove ${user.name} from ${label.toLowerCase()} of ${group}`}
                      className="text-sm font-semibold text-gray-500 transition-colors hover:text-red-600 hover:cursor-pointer"
                    >
                      Remove
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        : <p className=" text-gray-600">{`No ${label.toLowerCase()} yet.`}</p>}

    </div>
  )
}
