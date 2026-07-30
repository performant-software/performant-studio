import type { FormEvent } from 'react'
import { useAuth, useOrganization } from '@clerk/react'
import { useState } from 'react'

export default function DiscourseGroups() {
  const { organization } = useOrganization()
  const { getToken } = useAuth()

  const savedGroups = organization?.publicMetadata?.discourse?.groups ?? []

  const [groups, setGroups] = useState<string[]>(savedGroups)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = groups.length !== savedGroups.length
    || groups.some((group, index) => group !== savedGroups[index])

  function addGroup(event: FormEvent) {
    event.preventDefault()

    const name = draft.trim()

    if (!name) {
      return
    }

    if (groups.includes(name)) {
      setError(`"${name}" is already in the list.`)
      return
    }

    setGroups([...groups, name])
    setDraft('')
    setError(null)
  }

  function removeGroup(name: string) {
    setGroups(groups.filter(group => group !== name))
    setError(null)
  }

  async function save() {
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

      // Pull the new metadata back into the Clerk client so savedGroups — and
      // anything else reading the org — reflects what was just stored.
      await organization?.reload()
    }
    catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save groups.')
    }
    finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Groups</h2>
        <p className="mt-1 text-[15px] text-gray-600">
          Manage the list of Discourse groups for this organization.
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

      {groups.length
        ? (
            <ul className="divide-y divide-gray-200 rounded-xl bg-white shadow-sm">
              {groups.map(group => (
                <li key={group} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="text-[15px]">{group}</span>
                  <button
                    type="button"
                    onClick={() => removeGroup(group)}
                    className="text-sm font-semibold text-gray-500 transition-colors hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
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
    </div>
  )
}
