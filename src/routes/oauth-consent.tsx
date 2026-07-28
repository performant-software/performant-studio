import { createRoute } from '@tanstack/react-router'
import OAuthConsentPage from '../components/OAuthConsent'
import { rootRoute } from './__root'

export const oauthConsentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/oauth-consent',
  component: OAuthConsentPage,
})
