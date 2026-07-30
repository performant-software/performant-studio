import type { Config } from '@netlify/edge-functions'
import { createClerkClient } from '@clerk/backend'

const MAX_GROUP_LENGTH = 100

const clerkClient = createClerkClient({
  secretKey: Netlify.env.get('CLERK_SECRET_KEY'),
})

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function normalizeGroups(input: string[]): string[] | { error: string } {
  const names = new Set<string>()

  for (const item of input) {
    const name = item.trim()

    if (!name) {
      return { error: 'group names cannot be empty' }
    }

    if (name.length > MAX_GROUP_LENGTH) {
      return { error: `group names cannot be longer than ${MAX_GROUP_LENGTH} characters` }
    }

    names.add(name)
  }

  return [...names]
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

  const groups = normalizeGroups(body?.groups)

  if (!Array.isArray(groups)) {
    return json(groups, 400)
  }

  const organization = await clerkClient.organizations.getOrganization({ organizationId: orgId })

  const organizationAfterUpdate = await clerkClient.organizations.replaceOrganizationMetadata(orgId, {
    publicMetadata: {
      ...organization.publicMetadata,
      discourse: {
        ...organization.publicMetadata?.discourse,
        groups,
      },
    },
  })

  return json({ groups: organizationAfterUpdate.publicMetadata?.discourse?.groups ?? [] })
}

export const config: Config = {
  path: '/api/discourse/groups',
}

export default handler
