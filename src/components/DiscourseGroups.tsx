import { useAuth, useOrganization } from '@clerk/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { isDiscourse } from '../lib/organizations.ts'
import ConfirmDialog from './ConfirmDialog.tsx'

type Groups = Record<string, DiscourseGroup>

function toGroups(saved: Groups | undefined): Groups {
  return Object.fromEntries(
    Object.entries(saved ?? {}).map(([name, group]) => [name, { ...group, owners: [...group.owners] }]),
  )
}

function fingerprint(groups: Groups) {
  return JSON.stringify(
    Object.keys(groups).sort().map(name => [name, [...groups[name].owners].sort()]),
  )
}

function displayName(user: { firstName?: string | null, lastName?: string | null, identifier?: string } = {}) {
  const { firstName, lastName, identifier } = user
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  if (fullName && identifier) {
    return `${fullName} (${identifier})`
  }

  return fullName || identifier || ''
}

export default function DiscourseGroups() {
  const { organization, memberships } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true, pageSize: 100 },
  })
  const { getToken } = useAuth()

  const savedGroups = useMemo(
    () => toGroups(organization?.publicMetadata?.discourse?.groups),
    [organization?.publicMetadata],
  )

  const [groups, setGroups] = useState<Groups>(savedGroups)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  useEffect(() => {
    if (memberships?.hasNextPage && !memberships.isFetching) {
      memberships.fetchNext()
    }
  }, [memberships])

  const users = useMemo(
    () => (memberships?.data ?? [])
      .map(membership => ({
        userId: membership.publicUserData?.userId,
        name: displayName(membership.publicUserData),
      }))
      .filter((user): user is { userId: string, name: string } => Boolean(user.userId))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [memberships?.data],
  )

  const usersById = useMemo(
    () => new Map(users.map(user => [user.userId, user.name])),
    [users],
  )

  const isDirty = fingerprint(groups) !== fingerprint(savedGroups)

  const addGroup = useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault()

    const name = draft.trim()

    if (!name) {
      return
    }

    if (Object.hasOwn(groups, name)) {
      setError(`"${name}" is already in the list.`)
      return
    }

    setGroups({ ...groups, [name]: { owners: [] } })
    setDraft('')
    setError(null)
  }, [draft, groups])

  const removeGroup = useCallback((name: string) => {
    setGroups(Object.fromEntries(Object.entries(groups).filter(([key]) => key !== name)))
    setPendingDelete(null)
    setError(null)
  }, [groups])

  const setOwners = useCallback((name: string, userIds: string[]) => {
    setGroups({ ...groups, [name]: { ...groups[name], owners: userIds } })
    setError(null)
  }, [groups])

  const save = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/discourse/groups', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groups }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? `Could not save groups (${response.status}).`)
      }
    }
    catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save groups.')
    }
    finally {
      // Groups whose Discourse setup fails are left out of the save, so reload
      // even on failure to show which ones actually made it.
      await organization?.reload()
      setIsSaving(false)
    }
  }, [getToken, groups, organization])

  const groupNames = useMemo(() => Object.keys(groups), [groups])

  return (
    <div className="flex flex-col gap-6">
      { organization && isDiscourse(organization)
        ? (
            <>
              <div>
                <h2 className="text-lg font-semibold">Groups</h2>
                <p className="mt-1 text-[15px] text-gray-600">
                  Manage the list of Discourse groups for this organization, and who owns each one.
                </p>
              </div>

              <form onSubmit={addGroup} className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder="Group name"
                  aria-label="Group name"
                  className="min-w-64 rounded-md border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-performant focus:outline-none focus:ring-1 focus:ring-performant"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="rounded-md bg-performant px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-performant/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </form>

              {groupNames.length
                ? (
                    <ul className="flex flex-col gap-4">
                      {groupNames.map((name) => {
                        const { owners } = groups[name]
                        const available = users.filter(user => !owners.includes(user.userId))
                        const selectId = `${name}-owners`

                        return (
                          <li key={name} className="flex flex-col gap-5 rounded-xl bg-white px-5 py-4 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[15px] font-semibold">{name}</span>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(name)}
                                aria-label={`Delete ${name}`}
                                className="text-sm font-semibold text-gray-500 transition-colors hover:text-red-600"
                              >
                                Delete group
                              </button>
                            </div>

                            <div className="flex flex-col gap-2">
                              <label htmlFor={selectId} className="text-sm font-semibold text-gray-700">
                                Owners
                              </label>
                              <select
                                id={selectId}
                                value=""
                                disabled={!available.length}
                                onChange={event => setOwners(name, [...owners, event.target.value])}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-performant focus:outline-none focus:ring-1 focus:ring-performant disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="" disabled>
                                  {available.length ? 'Add owner…' : 'Everyone added'}
                                </option>
                                {available.map(user => (
                                  <option key={user.userId} value={user.userId}>{user.name}</option>
                                ))}
                              </select>

                              {owners.length
                                ? (
                                    <ul className="flex flex-col gap-1">
                                      {owners.map(userId => (
                                        <li key={userId} className="flex items-center justify-between gap-3 text-[15px]">
                                          <span className={usersById.has(userId) ? undefined : 'text-gray-500 italic'}>
                                            {usersById.get(userId) ?? `${userId} (not in this organization)`}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setOwners(name, owners.filter(id => id !== userId))}
                                            aria-label={`Remove ${usersById.get(userId) ?? userId} from owners of ${name}`}
                                            className="text-sm font-semibold text-gray-500 transition-colors hover:text-red-600"
                                          >
                                            Remove
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                : <p className="text-sm text-gray-600">No owners yet.</p>}

                              <p className="text-sm text-gray-500">
                                Owners will be able to manage members via Discourse.
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )
                : (
                    <p className="rounded-xl bg-white px-5 py-8 text-center text-[15px] text-gray-600 shadow-sm">
                      No groups yet. Add one above.
                    </p>
                  )}

              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!isDirty || isSaving}
                  className="rounded-md bg-performant px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-performant/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
                {isDirty && !isSaving && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroups(savedGroups)
                      setError(null)
                    }}
                    className="text-sm font-semibold text-gray-600 hover:underline"
                  >
                    Discard changes
                  </button>
                )}
              </div>

              {!!pendingDelete && (
                <ConfirmDialog
                  title="Delete group"
                  confirmLabel="Delete group"
                  onConfirm={() => removeGroup(pendingDelete)}
                  onDismiss={() => setPendingDelete(null)}
                >
                  <p>
                    Are you sure you want to remove&nbsp;
                    <strong className="font-semibold text-gray-900">{pendingDelete}</strong>
                    ?
                  </p>
                  <p>
                    Any existing posts in this group will be private. You can re-enable the group by creating one with the same name in the future.
                  </p>
                </ConfirmDialog>
              )}
            </>
          )
        : <p>This organization is not connected to a Discourse server.</p>}
    </div>
  )
}
