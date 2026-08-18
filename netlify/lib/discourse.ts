/// <reference types="@netlify/edge-functions" />

import type { Organization } from '@clerk/backend'
import { createClerkClient } from '@clerk/backend'

export const clerkClient = createClerkClient({
  secretKey: Netlify.env.get('CLERK_SECRET_KEY'),
})

export function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export interface Caller {
  orgId: string
  userId: string
  isAdmin: boolean
  organization: Organization
  savedGroups: Record<string, DiscourseGroup>
  owned: Set<string>
}

export async function authorize(req: Request): Promise<Caller | Response> {
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

  return { orgId, userId, isAdmin, organization, savedGroups, owned }
}

export function canManage({ isAdmin, owned }: Caller, name: string) {
  return isAdmin || owned.has(name)
}

export async function saveGroups(
  { orgId, organization }: Caller,
  groups: Record<string, DiscourseGroup>,
) {
  const updated = await clerkClient.organizations.replaceOrganizationMetadata(orgId, {
    publicMetadata: {
      ...organization.publicMetadata,
      discourse: {
        ...organization.publicMetadata?.discourse,
        groups,
      },
    },
  })

  return updated.publicMetadata?.discourse?.groups ?? {}
}

export function errorMessage(error: unknown, fallback: string) {
  const errors = (error as { errors?: unknown })?.errors

  if (Array.isArray(errors)) {
    const message = errors
      .map((entry: { longMessage?: string, message?: string }) => entry.longMessage ?? entry.message)
      .filter(Boolean)
      .join(' ')

    if (message) {
      return message
    }
  }

  return error instanceof Error && error.message ? error.message : fallback
}
