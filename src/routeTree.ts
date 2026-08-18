import { rootRoute } from './routes/__root'
import { discourseRoute } from './routes/discourse'
import { indexRoute } from './routes/index'
import { oauthConsentRoute } from './routes/oauth-consent'
import { signInRoute } from './routes/sign-in'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  discourseRoute,
  oauthConsentRoute,
  signInRoute,
])
