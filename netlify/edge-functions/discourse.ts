/* eslint-disable no-console */

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

async function handler(req: Request) {
  const url = new URL(req.url)
  const homeUrl = new URL('/', url.origin).toString()

  const discourseSsoParam = url.searchParams.get('sso')
  const discourseSigParam = url.searchParams.get('sig')

  if (!discourseSsoParam || !discourseSigParam) {
    console.log('Missing required params')
    return Response.redirect(homeUrl)
  }

  const decoded = Buffer.from(discourseSsoParam, 'base64').toString('utf8')
  const returnSsoUrl = new URLSearchParams(decoded).get('return_sso_url')
  if (!returnSsoUrl) {
    console.log('Missing return_sso_url')
    return Response.redirect(homeUrl)
  }

  const discourseDomain = new URL(returnSsoUrl).hostname

  const authResponse = await clerkClient.authenticateRequest(req, {
    publishableKey: Netlify.env.get('VITE_CLERK_PUBLISHABLE_KEY'),
  })

  if (authResponse.status === 'handshake') {
    return new Response(null, { status: 307, headers: authResponse.headers })
  }

  if (!authResponse?.isAuthenticated) {
    console.log('User not authenticated, redirecting to homepage')
    const signInUrl = new URL('/sign-in', url.origin)
    signInUrl.searchParams.set('redirect_url', url.href)
    return Response.redirect(signInUrl.toString())
  }

  const { toAuth } = authResponse

  const user = await clerkClient.users.getUser(toAuth().userId)

  if (!user) {
    console.log('User not found')
    return Response.redirect(homeUrl)
  }

  const primaryEmail = user.emailAddresses.find(
    e => e.id === user.primaryEmailAddressId,
  )?.emailAddress
  if (!primaryEmail) {
    console.log(`User ${user.id} missing primary email address`)
    return Response.redirect(homeUrl)
  }

  console.log(`${primaryEmail}: Fetching organization membership list`)
  const { data: orgMemberships } = await clerkClient.users.getOrganizationMembershipList({
    userId: user.id,
    limit: 100,
  })

  const match = orgMemberships.find(om => (
    (om.organization.privateMetadata.discourse as any)?.domain === discourseDomain
  ))

  if (!match) {
    console.log(`${primaryEmail}: No matching org found`)
    return Response.redirect(homeUrl)
  }

  const { organization, role } = match

  const discourseConfig = organization.privateMetadata.discourse

  if (!isDiscourseConfig(discourseConfig)) {
    console.log(`${primaryEmail}: Missing Discourse config in Clerk organization`)
    return Response.redirect(homeUrl)
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
    console.log(`${primaryEmail}: Invalid Discourse Connect payload`)
    return Response.redirect(homeUrl)
  }

  const redirectUrl = buildResponseUrl(
    returnUrl,
    {
      nonce,
      external_id: user.id,
      email: primaryEmail,
      username: user.username ?? undefined,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      avatar_url: user.imageUrl,
      groups: discourseConfig.roles ? discourseConfig.roles[role] : undefined,
      admin: role === 'org:admin',
      moderator: role === 'org:moderator' || role === 'org:admin',
    },
    discourseConfig.secret,
  )

  console.log(`${primaryEmail}: Successful login, redirecting to Discourse`)

  return Response.redirect(redirectUrl)
}

export const config: Config = {
  path: '/sso/discourse',
}

export default handler
