import { rootRoute } from './routes/__root'
import { indexRoute } from './routes/index'
import { ssoRoute } from './routes/sso'

export const routeTree = rootRoute.addChildren([indexRoute, ssoRoute])
