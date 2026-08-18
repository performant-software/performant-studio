import type { Config } from '@netlify/edge-functions'
import { createClerkClient } from '@clerk/backend'

// Discourse's character limit for group display names
const MAX_GROUP_LENGTH = 50

// Discourse group name validation
const MIN_DISCOURSE_NAME_LENGTH = 3
const MAX_DISCOURSE_NAME_LENGTH = 20
const MODERATORS_SUFFIX = '-mods'
const MODERATORS_LABEL = 'Moderators'
const FULL_CATEGORY_PERMISSION = 1
const MEMBERS_VISIBILITY_LEVEL = 2
const DISCOURSE_API_USERNAME = 'system'

interface DiscourseRecords {
  groupId: number
  groupName: string
  moderatorsGroupId: number
  // storing the group name because DiscourseConnect only accepts
  // names instead of IDs for some reason :/
  moderatorsGroupName: string
  categoryId: number
}

type Group = DiscourseGroup & Partial<DiscourseRecords>

interface DiscourseNames {
  slug: string
  groupName: string
  moderatorsGroupName: string
}

interface DiscourseConfig {
  domain: string
  apiKey: string
}

const clerkClient = createClerkClient({
  secretKey: Netlify.env.get('CLERK_SECRET_KEY'),
})

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

async function getMemberIds(organizationId: string) {
  const ids = new Set<string>()
  const limit = 500

  for (let offset = 0; ; offset += limit) {
    const { data, totalCount } = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId,
      limit,
      offset,
    })

    for (const membership of data) {
      if (membership.publicUserData?.userId) {
        ids.add(membership.publicUserData.userId)
      }
    }

    if (!data.length || offset + data.length >= totalCount) {
      return ids
    }
  }
}

function readUserIds(
  raw: unknown,
  memberIds: Set<string>,
  label: string,
): { ids: Set<string> } | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: `${label} must be an array of user IDs` }
  }

  const ids = new Set<string>()

  for (const userId of raw) {
    if (typeof userId !== 'string' || !memberIds.has(userId)) {
      return { error: `${label} contains a user who is not in this organization` }
    }

    ids.add(userId)
  }

  return { ids }
}

function normalizeGroups(
  input: unknown,
  memberIds: Set<string>,
): { groups: Record<string, Group> } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'groups must be an object keyed by group name' }
  }

  const groups = new Map<string, Group>()

  for (const [rawName, value] of Object.entries(input as Record<string, unknown>)) {
    const name = rawName.trim()

    if (!name) {
      return { error: 'group names cannot be empty' }
    }

    if (name.length > MAX_GROUP_LENGTH) {
      return { error: `group names cannot be longer than ${MAX_GROUP_LENGTH} characters` }
    }

    if (groups.has(name)) {
      return { error: `"${name}" is listed more than once` }
    }

    if (!value || typeof value !== 'object') {
      return { error: `"${name}" must be an object` }
    }

    const { owners: rawOwners, members: rawMembers } = value as { owners?: unknown, members?: unknown }

    const owners = readUserIds(rawOwners, memberIds, `owners of "${name}"`)

    if ('error' in owners) {
      return owners
    }

    const members = readUserIds(rawMembers, memberIds, `members of "${name}"`)

    if ('error' in members) {
      return members
    }

    groups.set(name, {
      owners: [...owners.ids],
      // Hide owners from the member list to prevent confusion
      members: [...members.ids].filter(userId => !owners.ids.has(userId)),
    })
  }

  return { groups: Object.fromEntries(groups) }
}

function provisioned(group: Group | undefined): DiscourseRecords | null {
  const { groupId, groupName, moderatorsGroupId, moderatorsGroupName, categoryId } = group ?? {}

  return groupId && groupName && moderatorsGroupId && moderatorsGroupName && categoryId
    ? { groupId, groupName, moderatorsGroupId, moderatorsGroupName, categoryId }
    : null
}

function slugify(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function truncate(slug: string, length: number) {
  return slug.slice(0, length).replace(/-+$/, '')
}

function getNames(name: string): DiscourseNames | null {
  const slug = slugify(name)

  if (slug.length < MIN_DISCOURSE_NAME_LENGTH) {
    return null
  }

  return {
    slug,
    groupName: truncate(slug, MAX_DISCOURSE_NAME_LENGTH),
    moderatorsGroupName: truncate(slug, MAX_DISCOURSE_NAME_LENGTH - MODERATORS_SUFFIX.length) + MODERATORS_SUFFIX,
  }
}

function resolveNames(
  groups: Record<string, Group>,
): { names: Record<string, DiscourseNames> } | { error: string } {
  const names: Record<string, DiscourseNames> = {}
  const claimedBy = new Map<string, string>()

  for (const [name, group] of Object.entries(groups)) {
    const calculated = getNames(name)

    if (!calculated) {
      return {
        error: `"${name}" needs at least ${MIN_DISCOURSE_NAME_LENGTH} letters or numbers to name a Discourse group`,
      }
    }

    // Groups Discourse already has keep the names they were provisioned with,
    // so the rest are checked against those rather than a fresh derivation.
    const records = provisioned(group)
    const claims = [
      records?.groupName ?? calculated.groupName,
      records?.moderatorsGroupName ?? calculated.moderatorsGroupName,
    ]

    for (const claim of claims) {
      const claimant = claimedBy.get(claim)

      if (claimant) {
        return {
          error: `"${claimant}" and "${name}" would both use the Discourse group "${claim}". Give one of them a shorter or more distinct name.`,
        }
      }

      claimedBy.set(claim, name)
    }

    if (!records) {
      names[name] = calculated
    }
  }

  return { names }
}

async function discourseRequest(
  { domain, apiKey }: DiscourseConfig,
  method: string,
  path: string,
  body?: unknown,
) {
  const response = await fetch(`https://${domain}${path}`, {
    method,
    headers: {
      'Api-Key': apiKey,
      'Api-Username': DISCOURSE_API_USERNAME,
      'Accept': 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let payload: any = null

  if (text) {
    try {
      payload = JSON.parse(text)
    }
    catch {
      payload = null
    }
  }

  return { response, payload }
}

function discourseError(path: string, response: Response, payload: any) {
  const message = Array.isArray(payload?.errors)
    ? payload.errors.join(' ')
    : payload?.error ?? `responded ${response.status}`

  return new Error(`Discourse ${path} ${message}`)
}

/** Sends a request that is expected to succeed, returning its parsed body. */
async function send(config: DiscourseConfig, method: string, path: string, body?: unknown) {
  const { response, payload } = await discourseRequest(config, method, path, body)

  if (!response.ok) {
    throw discourseError(path, response, payload)
  }

  return payload
}

/** Fetches a record, returning null when Discourse does not have one. */
async function find(config: DiscourseConfig, path: string) {
  const { response, payload } = await discourseRequest(config, 'GET', path)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw discourseError(path, response, payload)
  }

  return payload
}

async function ensureGroup(config: DiscourseConfig, name: string, fullName: string) {
  const existing = await find(config, `/groups/${encodeURIComponent(name)}.json`)

  if (existing) {
    return existing.group.id as number
  }

  const created = await send(config, 'POST', '/admin/groups.json', {
    group: { name, full_name: fullName, visibility_level: MEMBERS_VISIBILITY_LEVEL },
  })

  return created.basic_group.id as number
}

async function ensureCategory(
  config: DiscourseConfig,
  { name, slug, permissions }: { name: string, slug: string, permissions: Record<string, number> },
) {
  const existing = await find(config, `/c/${encodeURIComponent(slug)}/find_by_slug.json`)

  if (existing) {
    return existing.category.id as number
  }

  const created = await send(config, 'POST', '/categories.json', { name, slug, permissions })

  return created.category.id as number
}

async function deleteGroup(config: DiscourseConfig, id: number) {
  const path = `/admin/groups/${id}.json`
  const { response, payload } = await discourseRequest(config, 'DELETE', path)

  if (!response.ok && response.status !== 404) {
    throw discourseError(path, response, payload)
  }
}

async function deprovision(config: DiscourseConfig, records: DiscourseRecords) {
  await deleteGroup(config, records.groupId)
  await deleteGroup(config, records.moderatorsGroupId)
}

async function provision(
  config: DiscourseConfig,
  name: string,
  { slug, groupName, moderatorsGroupName }: DiscourseNames,
): Promise<DiscourseRecords> {
  const groupId = await ensureGroup(config, groupName, name)
  const moderatorsGroupId = await ensureGroup(
    config,
    moderatorsGroupName,
    `${name} ${MODERATORS_LABEL}`,
  )

  const permissions = {
    [groupName]: FULL_CATEGORY_PERMISSION,
    [moderatorsGroupName]: FULL_CATEGORY_PERMISSION,
  }

  const categoryId = await ensureCategory(config, { name, slug, permissions })

  await send(config, 'PUT', `/categories/${categoryId}.json`, {
    name,
    permissions,
    moderating_group_ids: [moderatorsGroupId],
  })

  return { groupId, groupName, moderatorsGroupId, moderatorsGroupName, categoryId }
}

async function handler(req: Request) {
  const authResponse = await clerkClient.authenticateRequest(req, {
    publishableKey: Netlify.env.get('VITE_CLERK_PUBLISHABLE_KEY'),
  })

  if (!authResponse.isAuthenticated) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // The org comes from the session token rather than the request body so an
  // admin of one org cannot edit another org's groups.
  const { orgId, orgRole, userId } = authResponse.toAuth()

  if (!orgId) {
    return json({ error: 'Forbidden' }, 403)
  }

  let body: any
  try {
    body = await req.json()
  }
  catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const organization = await clerkClient.organizations.getOrganization({ organizationId: orgId })

  const savedGroups = organization.publicMetadata?.discourse?.groups ?? {}

  const isAdmin = orgRole === 'org:admin'
  const owned = new Set(
    Object.entries(savedGroups)
      .filter(([, group]) => group.owners.includes(userId))
      .map(([name]) => name),
  )

  if (!isAdmin && !owned.size) {
    return json({ error: 'Forbidden' }, 403)
  }

  const result = normalizeGroups(body?.groups, await getMemberIds(orgId))

  if ('error' in result) {
    return json(result, 400)
  }

  if (!isAdmin) {
    const notOwned = Object.keys(result.groups).find(name => !owned.has(name))

    if (notOwned) {
      return json({ error: `You are not an owner of "${notOwned}"` }, 403)
    }

    const submitted = result.groups

    result.groups = { ...savedGroups }

    for (const [name, group] of Object.entries(submitted)) {
      const saved = savedGroups[name]

      result.groups[name] = {
        ...saved,
        members: group.members.filter(memberId => !saved.owners.includes(memberId)),
      }
    }
  }

  const newNames = Object.keys(result.groups).filter(name => !provisioned(savedGroups[name]))

  const removals: { name: string, records: DiscourseRecords }[] = []

  for (const [name, group] of Object.entries(savedGroups)) {
    const records = provisioned(group)

    if (records && !Object.hasOwn(result.groups, name)) {
      removals.push({ name, records })
    }
  }

  for (const [name, group] of Object.entries(result.groups)) {
    Object.assign(group, provisioned(savedGroups[name]))
  }

  const resolved = resolveNames(result.groups)

  if ('error' in resolved) {
    return json(resolved, 400)
  }

  const failures: string[] = []
  const stillTaken = new Map<string, string>()

  if (newNames.length || removals.length) {
    const { domain } = organization.publicMetadata?.discourse ?? {}
    const { apiKey } = organization.privateMetadata?.discourse ?? {}

    if (!domain || !apiKey) {
      return json({ error: 'This organization is not connected to a Discourse server' }, 400)
    }

    for (const { name, records } of removals) {
      try {
        await deprovision({ domain, apiKey }, records)
      }
      catch (deleteError) {
        result.groups[name] = savedGroups[name]
        stillTaken.set(records.groupName, name)
        stillTaken.set(records.moderatorsGroupName, name)
        failures.push(
          deleteError instanceof Error
            ? `Could not remove "${name}": ${deleteError.message}`
            : `Could not remove "${name}"`,
        )
      }
    }

    for (const name of newNames) {
      const names = resolved.names[name]
      const blockedBy = stillTaken.get(names.groupName) ?? stillTaken.get(names.moderatorsGroupName)

      if (blockedBy) {
        delete result.groups[name]
        failures.push(`Could not set up "${name}" until "${blockedBy}" is removed from Discourse.`)
        continue
      }

      try {
        Object.assign(result.groups[name], await provision({ domain, apiKey }, name, names))
      }
      catch (provisionError) {
        delete result.groups[name]
        failures.push(provisionError instanceof Error ? provisionError.message : `Could not set up "${name}"`)
      }
    }
  }

  const organizationAfterUpdate = await clerkClient.organizations.replaceOrganizationMetadata(orgId, {
    publicMetadata: {
      ...organization.publicMetadata,
      discourse: {
        ...organization.publicMetadata?.discourse,
        groups: result.groups,
      },
    },
  })

  const groups = organizationAfterUpdate.publicMetadata?.discourse?.groups ?? {}

  if (failures.length) {
    return json({ error: failures.join(' '), groups }, 502)
  }

  return json({ groups })
}

export const config: Config = {
  path: '/api/discourse/groups',
}

export default handler
