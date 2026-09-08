/// <reference types="@netlify/edge-functions" />

import type { Organization } from '@clerk/backend'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
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

const DISCOURSE_API_USERNAME = 'system'

export interface DiscourseConfig {
  domain: string
  apiKey: string
}

function encodeBody(body: unknown) {
  if (body === undefined) {
    return {}
  }

  if (body instanceof URLSearchParams) {
    return { contentType: 'application/x-www-form-urlencoded', body: body.toString() }
  }

  return { contentType: 'application/json', body: JSON.stringify(body) }
}

export async function discourseRequest(
  { domain, apiKey }: DiscourseConfig,
  method: string,
  path: string,
  body?: unknown,
) {
  const { contentType, body: encoded } = encodeBody(body)

  const response = await fetch(`https://${domain}${path}`, {
    method,
    headers: {
      'Api-Key': apiKey,
      'Api-Username': DISCOURSE_API_USERNAME,
      'Accept': 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: encoded,
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

export function discourseError(path: string, response: Response, payload: any) {
  const message = Array.isArray(payload?.errors)
    ? payload.errors.join(' ')
    : payload?.error ?? `responded ${response.status}`

  return new Error(`Discourse ${path} ${message}`)
}

/** Sends a request that is expected to succeed, returning its parsed body. */
export async function send(config: DiscourseConfig, method: string, path: string, body?: unknown) {
  const { response, payload } = await discourseRequest(config, method, path, body)

  if (!response.ok) {
    throw discourseError(path, response, payload)
  }

  return payload
}

/** Fetches a record, returning null when Discourse does not have one. */
export async function find(config: DiscourseConfig, path: string) {
  const { response, payload } = await discourseRequest(config, 'GET', path)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw discourseError(path, response, payload)
  }

  return payload
}

/** Base64-encodes and signs a set of DiscourseConnect fields. */
export function signPayload(fields: Record<string, unknown>, secret: string) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    params.set(key, String(value))
  }

  const sso = Buffer.from(params.toString(), 'utf8').toString('base64')
  const sig = crypto.createHmac('sha256', secret).update(sso).digest('hex')

  return { sso, sig }
}

/** The Discourse groups a user belongs to, and the ones they no longer do. */
export function syncedGroups(groups: Record<string, DiscourseGroup>, userId: string) {
  const add: string[] = []
  const remove: string[] = []
  const sync = (name: string, belongs: boolean) => (belongs ? add : remove).push(name)

  for (const group of Object.values(groups)) {
    if (!group.groupName || !group.moderatorsGroupName) {
      continue
    }

    const isOwner = group.owners.includes(userId)

    // Add owner to the regular member group too
    sync(group.groupName, isOwner || group.members.includes(userId))
    sync(group.moderatorsGroupName, isOwner)
  }

  return { add, remove }
}

/**
 * Pushes a user's group membership to Discourse so it takes effect without
 * waiting for their next sign-in. Returns false when Discourse has no account
 * for them yet, which is the case until they first sign in through
 * DiscourseConnect; that sign-in carries the same groups.
 */
export async function syncGroups(
  config: DiscourseConfig,
  secret: string,
  groups: Record<string, DiscourseGroup>,
  userId: string,
) {
  const { add, remove } = syncedGroups(groups, userId)

  if (!add.length && !remove.length) {
    return false
  }

  if (!await find(config, `/u/by-external/${encodeURIComponent(userId)}.json`)) {
    return false
  }

  // Only external_id is needed to update someone Discourse already knows, and
  // leaving the rest out keeps this from overwriting their profile.
  const { sso, sig } = signPayload({
    external_id: userId,
    add_groups: add.join(','),
    remove_groups: remove.join(','),
  }, secret)

  await send(config, 'POST', '/admin/users/sync_sso', new URLSearchParams({ sso, sig }))

  return true
}
