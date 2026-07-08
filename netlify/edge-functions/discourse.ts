import type { Config } from '@netlify/edge-functions'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { createClerkClient } from '@clerk/backend'

interface DiscourseConfig {
  domain: string
  secret: string
  roles?: Record<string, string>
}

const clerkClient = createClerkClient({
  secretKey: Netlify.env.get('CLERK_SECRET_KEY'),
})

function isDiscourseConfig(config: any): config is DiscourseConfig {
  return !(!config || !config.secret || !config.domain)
}

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ message }),
    { status },
  )
}

function verifyDiscoursePayload(sso: string, sig: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(sso).digest('hex')

  const given = Buffer.from(sig, 'hex')
  const good = Buffer.from(expected, 'hex')
  if (given.length !== good.length || !crypto.timingSafeEqual(given, good)) {
    throw new Error('Invalid signature on DiscourseConnect payload')
  }

  const decoded = Buffer.from(sso, 'base64').toString('utf8')
  const params = new URLSearchParams(decoded)
  const nonce = params.get('nonce')
  const returnUrl = params.get('return_sso_url')
  if (!nonce || !returnUrl) {
    throw new Error('Payload missing nonce or return_sso_url')
  }

  return { nonce, returnUrl }
}

function buildResponseUrl(returnUrl: string, fields: Record<string, any>, secret: string) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '')
      continue
    params.set(key, String(value))
  }

  const payload = Buffer.from(params.toString(), 'utf8').toString('base64')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  const url = new URL(returnUrl)
  url.searchParams.set('sso', payload)
  url.searchParams.set('sig', sig)
  return url.toString()
}

async function authenticate(req: Request): Promise<string | null> {
  console.log('publishable key:')
  console.log(Netlify.env.get('VITE_CLERK_PUBLISHABLE_KEY'))

  console.log('request cookies:')
  console.log(req.headers.get('cookie'))

  console.log('request headers:')
  console.log(req.headers)

  const { toAuth } = await clerkClient.authenticateRequest(req, {
    publishableKey: Netlify.env.get('VITE_CLERK_PUBLISHABLE_KEY'),
  })

  const auth = toAuth()
  console.log('AUTH', auth)

  if (!auth?.userId) {
    return null
  }

  return auth.userId
}

async function handler(req: Request) {
  const referrer = req.headers.get('referer')

  console.log('REFERRER', referrer)

  if (!referrer) {
    return errorResponse('Missing referrer', 400)
  }

  const referrerDomain = new URL(referrer).hostname

  if (!referrerDomain) {
    return errorResponse('Missing referrer', 400)
  }

  const url = new URL(req.url)
  const discourseSsoParam = url.searchParams.get('sso')
  const discourseSigParam = url.searchParams.get('sig')

  if (!discourseSsoParam || !discourseSigParam) {
    return errorResponse('Missing required params', 400)
  }

  const userId = await authenticate(req)

  if (!userId) {
    console.log('User not authenticated, redirecting to /')
    return Response.redirect('/')
  }

  const user = await clerkClient.users.getUser(userId)

  if (!user) {
    return errorResponse('User not found', 400)
  }

  const primaryEmail = user.emailAddresses.find(
    e => e.id === user.primaryEmailAddressId,
  )?.emailAddress
  if (!primaryEmail) {
    return errorResponse('User missing primary email address', 400)
  }

  const { data: orgMemberships } = await clerkClient.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })

  const match = orgMemberships.find(om => (
    (om.organization.privateMetadata.discourse as any)?.domain === referrerDomain
  ))

  if (!match) {
    return errorResponse('No matching org found', 400)
  }

  const { organization, role } = match

  const discourseConfig = organization.privateMetadata.discourse

  if (!isDiscourseConfig(discourseConfig)) {
    return errorResponse('Missing Discourse config in Clerk organization', 400)
  }

  let nonce: string
  let returnUrl: string

  try {
    const payloadVerificationResult = verifyDiscoursePayload(
      discourseSsoParam,
      discourseSigParam,
      discourseConfig.secret,
    )
    nonce = payloadVerificationResult.nonce
    returnUrl = payloadVerificationResult.returnUrl
  }
  catch {
    return errorResponse('Invalid Discourse Connect payload', 400)
  }

  const redirectUrl = buildResponseUrl(
    returnUrl,
    {
      nonce,
      external_id: userId,
      email: primaryEmail,
      username: user.username ?? undefined,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      avatar_url: user.imageUrl,
      groups: discourseConfig.roles ? discourseConfig.roles[role] : undefined,
      admin: role === 'org:admin',
    },
    discourseConfig.secret,
  )

  return Response.redirect(redirectUrl)
}

export const config: Config = {
  path: '/sso/discourse',
}

export default handler

/**
 * notes:
 *
 * 1. Discourse Connect data stored in org private metadata:
 *    - Discourse Connect secret key
 *    - Discourse Connect domain
 *    - mapping of Clerk roles to Discourse groups
 */
