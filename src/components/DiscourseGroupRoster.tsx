import type { User } from './UserIdentity.tsx'
import { useMemo } from 'react'
import UserCombobox from './UserCombobox.tsx'
import UserIdentity from './UserIdentity.tsx'

interface DiscourseGroupRosterProps {
  group: string
  label: string
  description?: string
  singular: string
  users: User[]
  available: User[]
  onChange: (userIds: string[]) => void
  onInvite?: () => void
  inviteDisabledReason?: string
}

export default function DiscourseGroupRoster({
  group,
  label,
  description,
  singular,
  users,
  available,
  onChange,
  onInvite,
  inviteDisabledReason,
}: DiscourseGroupRosterProps) {
  const userIds = useMemo(() => users.map(user => user.userId), [users])

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 p-4 text-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold tracking-wide text-gray-800">
          {label}
        </h3>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </div>
      <UserCombobox
        label={`Add ${singular} to ${group}`}
        placeholder="Search users"
        users={available}
        onSelect={userId => onChange([...userIds, userId])}
        onInvite={onInvite}
        inviteDisabledReason={inviteDisabledReason}
      />

      {users.length
        ? (
            <ul className="flex flex-col divide-y divide-gray-200">
              {users.map((user) => {
                return (
                  <li key={user.userId} className="flex items-center justify-between gap-3 py-2">
                    <UserIdentity user={user} />
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
