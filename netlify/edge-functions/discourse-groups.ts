import type { Config } from '@netlify/edge-functions'
import { createClerkClient } from '@clerk/backend'

const MAX_GROUP_LENGTH = 100

interface Group {
  owners: string[]
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

  const organizationAfterUpdate = await clerkClient.organizations.replaceOrganizationMetadata(orgId, {
    publicMetadata: {
      ...organization.publicMetadata,
      discourse: {
        ...organization.publicMetadata?.discourse,
        groups: result.groups,
      },
    },
  })

  return json({ groups: organizationAfterUpdate.publicMetadata?.discourse?.groups ?? {} })
}

export const config: Config = {
  path: '/api/discourse/groups',
}

export default handler
