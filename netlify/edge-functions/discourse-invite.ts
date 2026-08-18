import type { Config } from '@netlify/edge-functions'
import { authorize, canManage, clerkClient, errorMessage, json, saveGroups } from '../lib/discourse.ts'

const MEMBER_ROLE = 'org:member'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

async function findUserByEmail(email: string) {
  const { data } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 100 })

  return data.find(user => user.emailAddresses.some(
    address => address.emailAddress.toLowerCase() === email,
  )) ?? null
}

function errorStatus(error: unknown) {
  const status = (error as { status?: unknown })?.status

  return typeof status === 'number' && status >= 400 && status < 500 ? 400 : 502
}

async function isOrganizationMember(organizationId: string, userId: string) {
  const { data } = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId,
    userId: [userId],
    limit: 1,
  })

  return data.length > 0
}

async function handler(req: Request) {
  const caller = await authorize(req)

  if (caller instanceof Response) {
    return caller
  }

  let body: any
  try {
    body = await req.json()
  }
  catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const name = typeof body?.group === 'string' ? body.group.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : ''
  const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : ''

  if (!EMAIL_PATTERN.test(email)) {
    return json({ error: 'Enter a valid email address' }, 400)
  }

  const group = caller.savedGroups[name]

  if (!group || !canManage(caller, name)) {
    return json({ error: `You are not an owner of "${name}"` }, 403)
  }

  let user = await findUserByEmail(email)
  const isNewUser = !user

  if (!user) {
    // Only creating an account needs a name, so an existing user can go without.
    if (!firstName || !lastName) {
      return json({ error: `${email} has no account yet, so a first and last name are required.` }, 400)
    }

    try {
      user = await clerkClient.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        skipPasswordRequirement: true,
      })
    }
    catch (createError) {
      return json(
        { error: errorMessage(createError, `Could not create an account for ${email}.`) },
        errorStatus(createError),
      )
    }
  }

  if (!await isOrganizationMember(caller.orgId, user.id)) {
    try {
      await clerkClient.organizations.createOrganizationMembership({
        organizationId: caller.orgId,
        userId: user.id,
        role: MEMBER_ROLE,
      })
    }
    catch (membershipError) {
      return json(
        { error: errorMessage(membershipError, `Could not add ${email} to this organization.`) },
        errorStatus(membershipError),
      )
    }
  }

  if (!group.owners.includes(user.id) && !group.members.includes(user.id)) {
    await saveGroups(caller, {
      ...caller.savedGroups,
      [name]: { ...group, members: [...group.members, user.id] },
    })
  }

  return json({ userId: user.id, isNewUser })
}

export const config: Config = {
  path: '/api/discourse/invite',
  method: 'POST',
}

export default handler
