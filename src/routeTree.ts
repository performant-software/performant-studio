import { rootRoute } from './routes/__root'
import { indexRoute } from './routes/index'
import { signInRoute } from './routes/sign-in'

export const routeTree = rootRoute.addChildren([indexRoute, signInRoute])
