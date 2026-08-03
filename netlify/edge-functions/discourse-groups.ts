import type { Config } from '@netlify/edge-functions'
import { createClerkClient } from '@clerk/backend'

// Discourse's character limit for category names
const MAX_GROUP_LENGTH = 50

// Discourse group name validation
const MIN_DISCOURSE_NAME_LENGTH = 3
const MAX_DISCOURSE_NAME_LENGTH = 20
const MODERATORS_SUFFIX = '-moderators'
const MODERATORS_LABEL = 'Moderators'
const FULL_CATEGORY_PERMISSION = 1
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

    const { owners: rawOwners } = value as { owners?: unknown }

    if (!Array.isArray(rawOwners)) {
      return { error: `owners of "${name}" must be an array of user IDs` }
    }

    const owners = new Set<string>()

    for (const userId of rawOwners) {
      if (typeof userId !== 'string' || !memberIds.has(userId)) {
        return { error: `owners of "${name}" contains a user who is not in this organization` }
      }

      owners.add(userId)
    }

    groups.set(name, { owners: [...owners] })
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
    group: { name, full_name: fullName },
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

async function provision(config: DiscourseConfig, name: string): Promise<DiscourseRecords> {
  const slug = slugify(name)

  if (slug.length < MIN_DISCOURSE_NAME_LENGTH) {
    throw new Error(
      `"${name}" needs at least ${MIN_DISCOURSE_NAME_LENGTH} letters or numbers to name a Discourse group`,
    )
  }

  const groupName = truncate(slug, MAX_DISCOURSE_NAME_LENGTH)
  const moderatorsGroupName = truncate(slug, MAX_DISCOURSE_NAME_LENGTH - MODERATORS_SUFFIX.length) + MODERATORS_SUFFIX

  const groupId = await ensureGroup(config, groupName, name)
  const moderatorsGroupId = await ensureGroup(
    config,
    moderatorsGroupName,
    `${name} ${MODERATORS_LABEL}`,
  )

  const categoryId = await ensureCategory(config, {
    name,
    slug,
    permissions: {
      [groupName]: FULL_CATEGORY_PERMISSION,
      [moderatorsGroupName]: FULL_CATEGORY_PERMISSION,
    },
  })

  await send(config, 'PUT', `/categories/${categoryId}.json`, {
    name,
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
  const { orgId, orgRole } = authResponse.toAuth()

  if (!orgId || orgRole !== 'org:admin') {
    return json({ error: 'Forbidden' }, 403)
  }

  let body: any
  try {
    body = await req.json()
  }
  catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const result = normalizeGroups(body?.groups, await getMemberIds(orgId))

  if ('error' in result) {
    return json(result, 400)
  }

  const organization = await clerkClient.organizations.getOrganization({ organizationId: orgId })

  const savedGroups = organization.publicMetadata?.discourse?.groups ?? {}
  const newNames = Object.keys(result.groups).filter(name => !provisioned(savedGroups[name]))

  for (const [name, group] of Object.entries(result.groups)) {
    Object.assign(group, provisioned(savedGroups[name]))
  }

  const failures: string[] = []

  // Only groups that still need provisioning need Discourse credentials, so an
  // org without them can go on editing the owners of groups it already has.
  if (newNames.length) {
    const { domain } = organization.publicMetadata?.discourse ?? {}
    const { apiKey } = organization.privateMetadata?.discourse ?? {}

    if (!domain || !apiKey) {
      return json({ error: 'This organization is not connected to a Discourse server' }, 400)
    }

    for (const name of newNames) {
      try {
        Object.assign(result.groups[name], await provision({ domain, apiKey }, name))
      }
      catch (provisionError) {
        // Drop the group rather than storing one Discourse knows nothing about,
        // so saving again retries it from scratch.
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
