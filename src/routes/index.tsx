import { createRoute } from '@tanstack/react-router'
import App from '../App'
import { rootRoute } from './__root'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
})
