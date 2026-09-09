import type { User } from './UserIdentity.tsx'
import { useAuth, useOrganization, useUser } from '@clerk/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { groupUrl, isDiscourse, ownedGroupNames } from '../lib/organizations.ts'
import ConfirmDialog from './ConfirmDialog.tsx'
import DiscourseGroupInvite from './DiscourseGroupInvite.tsx'
import DiscourseGroupRoster from './DiscourseGroupRoster.tsx'
import FloatingBar from './FloatingBar.tsx'

type Groups = Record<string, DiscourseGroup>

const OWNERS_DESCRIPTION = 'Owners are given moderator permissions on the Discourse community and can manage the list of members.'
const MEMBERS_DESCRIPTION = 'Members can view and participate in the Discourse community.'

function toGroups(saved: Groups | undefined): Groups {
  return Object.fromEntries(
    Object.entries(saved ?? {}).map(([name, group]) => [name, {
      ...group,
      owners: [...group.owners],
      members: [...group.members],
    }]),
  )
}

function visibleGroups(organization: any, userId: string | undefined, isAdmin: boolean): Groups {
  const saved = toGroups(organization?.publicMetadata?.discourse?.groups)

  if (isAdmin) {
    return saved
  }

  const owned = new Set(ownedGroupNames(organization, userId))

  return Object.fromEntries(Object.entries(saved).filter(([name]) => owned.has(name)))
}

function fingerprint(groups: Groups) {
  return JSON.stringify(
    Object.keys(groups).sort().map(name => [
      name,
      [...groups[name].owners].sort(),
      [...groups[name].members].sort(),
    ]),
  )
}

function toUsers(userIds: string[], usersById: Map<string, User>): User[] {
  return userIds.map(userId => usersById.get(userId) ?? {
    userId,
    name: userId,
    email: 'Not in this organization',
    imageUrl: '',
  })
}

export default function DiscourseGroups() {
  const { organization, membership, memberships } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true, pageSize: 100 },
  })
  const { getToken } = useAuth()
  const { user } = useUser()

  const isAdmin = membership?.role === 'org:admin'

  const savedGroups = useMemo(
    () => visibleGroups(organization, user?.id, isAdmin),
    [isAdmin, organization, user?.id],
  )

  const [groups, setGroups] = useState<Groups>(savedGroups)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingInvite, setPendingInvite] = useState<string | null>(null)

  useEffect(() => {
    if (memberships?.hasNextPage && !memberships.isFetching) {
      memberships.fetchNext()
    }
  }, [memberships])

  const users = useMemo(
    () => (memberships?.data ?? [])
      .map((membership) => {
        const { firstName, lastName, identifier = '' } = membership.publicUserData ?? {}
        const fullName = [firstName, lastName].filter(Boolean).join(' ')

        return {
          userId: membership.publicUserData?.userId,
          // Members without a name fall back to their email, so don't repeat it below.
          name: fullName || identifier,
          email: fullName ? identifier : '',
          imageUrl: membership.publicUserData?.imageUrl ?? '',
        }
      })
      .filter((user): user is User => Boolean(user.userId))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [memberships?.data],
  )

  const usersById = useMemo(
    () => new Map(users.map(user => [user.userId, user])),
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

    setGroups({ ...groups, [name]: { owners: [], members: [] } })
    setDraft('')
    setError(null)
  }, [draft, groups])

  const removeGroup = useCallback((name: string) => {
    setGroups(Object.fromEntries(Object.entries(groups).filter(([key]) => key !== name)))
    setPendingDelete(null)
    setError(null)
  }, [groups])

  const setOwners = useCallback((name: string, userIds: string[]) => {
    setGroups({
      ...groups,
      [name]: {
        ...groups[name],
        owners: userIds,
        members: groups[name].members.filter(userId => !userIds.includes(userId)),
      },
    })
    setError(null)
  }, [groups])

  const setMembers = useCallback((name: string, userIds: string[]) => {
    setGroups({ ...groups, [name]: { ...groups[name], members: userIds } })
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

  const refresh = useCallback(async () => {
    const [reloaded] = await Promise.all([
      organization?.reload(),
      memberships?.revalidate?.(),
    ])

    if (reloaded) {
      setGroups(visibleGroups(reloaded, user?.id, isAdmin))
    }
  }, [isAdmin, memberships, organization, user?.id])

  const groupNames = useMemo(() => Object.keys(groups), [groups])

  // Inviting reloads the organization, which would throw away unsaved edits.
  const inviteDisabledReason = isDirty || isSaving
    ? 'Save or discard your changes first'
    : undefined

  return (
    <div className="flex flex-col gap-6">
      { organization && isDiscourse(organization)
        ? (
            <>
              <div>
                <h2 className="text-lg font-semibold">Discourse communities</h2>
                <p className="mt-1 text-[15px] text-gray-600">
                  {isAdmin
                    ? 'Add and manage communities for your organization\'s Discourse site.'
                    : 'Manage the members of the communities you own.'}
                </p>
              </div>

              {isAdmin && (
                <form onSubmit={addGroup} className="flex flex-wrap justify-end items-center gap-3">
                  <input
                    type="text"
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="New community name"
                    aria-label="New community name"
                    className="min-w-64 rounded-md border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-performant focus:outline-none focus:ring-1 focus:ring-performant"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="rounded-md bg-performant px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:cursor-pointer hover:bg-performant/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create new community
                  </button>
                </form>
              )}

              {groupNames.length
                ? (
                    <ul className="flex flex-col gap-4">
                      {groupNames.map((name) => {
                        const { owners, members, categoryId } = groups[name]

                        // Groups that have not been saved yet have no category to link to.
                        const url = categoryId ? groupUrl(organization, name) : null

                        return (
                          <li key={name} className="flex flex-col gap-5 rounded-xl bg-white px-5 py-4 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xl font-semibold">{name}</span>
                              <span className="flex shrink-0 items-center gap-2">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setPendingDelete(name)}
                                    aria-label={`Delete ${name}`}
                                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm font-semibold text-gray-600 transition-colors hover:cursor-pointer hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                  >
                                    Delete community
                                  </button>
                                )}
                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`View ${name} in Discourse`}
                                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
                                  >
                                    View in Discourse
                                  </a>
                                )}
                              </span>
                            </div>

                            <div className={`grid divide-y divide-gray-200 rounded-lg border border-gray-200 bg-gray-50 ${
                              isAdmin
                                ? 'md:grid-cols-2 md:grid-rows-[auto_auto_1fr] md:divide-x md:divide-y-0 md:*:row-span-3 md:*:grid md:*:grid-rows-subgrid'
                                : ''
                            }`}
                            >
                              {isAdmin && (
                                <DiscourseGroupRoster
                                  group={name}
                                  label="Owners"
                                  description={OWNERS_DESCRIPTION}
                                  singular="owner"
                                  users={toUsers(owners, usersById)}
                                  available={users.filter(candidate => !owners.includes(candidate.userId))}
                                  onChange={userIds => setOwners(name, userIds)}
                                />
                              )}

                              <DiscourseGroupRoster
                                group={name}
                                label="Members"
                                description={MEMBERS_DESCRIPTION}
                                singular="member"
                                users={toUsers(members, usersById)}
                                available={users.filter(
                                  candidate => !members.includes(candidate.userId)
                                    && !owners.includes(candidate.userId),
                                )}
                                onChange={userIds => setMembers(name, userIds)}
                                onInvite={() => setPendingInvite(name)}
                                inviteDisabledReason={inviteDisabledReason}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )
                : (
                    <p className="rounded-xl bg-white px-5 py-8 text-center text-[15px] text-gray-600 shadow-sm">
                      {isAdmin ? 'No groups yet. Add one above.' : 'You do not own any groups.'}
                    </p>
                  )}

              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

              <FloatingBar show={isDirty || isSaving} label="Unsaved changes">
                {!isSaving && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroups(savedGroups)
                      setError(null)
                    }}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:cursor-pointer hover:bg-gray-50"
                  >
                    Discard changes
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={isSaving}
                  className="rounded-md bg-performant px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:cursor-pointer hover:bg-performant/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
              </FloatingBar>

              {!!pendingInvite && (
                <DiscourseGroupInvite
                  group={pendingInvite}
                  onInvited={refresh}
                  onDismiss={() => setPendingInvite(null)}
                />
              )}

              {!!pendingDelete && (
                <ConfirmDialog
                  title="Delete group"
                  confirmLabel="Delete group"
                  confirmPhrase={pendingDelete}
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
