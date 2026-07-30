import { rootRoute } from './routes/__root'
import { indexRoute } from './routes/index'
import { oauthConsentRoute } from './routes/oauth-consent'
import { settingsRoute } from './routes/settings'
import { signInRoute } from './routes/sign-in'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  oauthConsentRoute,
  settingsRoute,
  signInRoute,
])
